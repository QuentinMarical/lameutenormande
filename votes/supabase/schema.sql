-- ===========================================================================
-- Sondages de la Meute Normande — schéma applicatif (schéma Postgres "votes",
-- séparé de "public" utilisé par elections/supabase/schema.sql : rejouer l'un
-- des deux scripts n'affecte jamais les privilèges de l'autre).
--
-- Différence fondamentale avec les élections : ici pas de code individuel,
-- pas de secret par bulletin. N'importe qui peut répondre avec un pseudo
-- librement choisi ; les réponses sont nominatives et publiques (utile pour
-- organiser concrètement présence/covoiturage à un évènement). C'est un outil
-- de coordination interne, pas un scrutin à enjeu : la confiance repose sur le
-- pseudo, pas sur une preuve d'identité. Voir supabase/README.md.
--
-- Script idempotent : peut être rejoué après mise à jour.
-- ===========================================================================

create schema if not exists votes;
grant usage on schema votes to anon, authenticated;

-- ---------------------------------------------------------------------
-- 1. Sondages
-- ---------------------------------------------------------------------
create table if not exists votes.polls (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  title        text not null,
  description  text not null default '',
  status       text not null default 'draft' check (status in ('draft','open','closed')),
  opens_at     timestamptz,
  closes_at    timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table votes.polls enable row level security;

-- ---------------------------------------------------------------------
-- 2. Questions (configurables par sondage : présence, covoiturage, etc.)
-- ---------------------------------------------------------------------
create table if not exists votes.questions (
  id          uuid primary key default gen_random_uuid(),
  poll_id     uuid not null references votes.polls(id) on delete cascade,
  sort_order  int not null default 0,
  label       text not null,
  type        text not null check (type in ('choice','multi_choice','yesno','number','text')),
  options     jsonb not null default '[]'::jsonb,
  required    boolean not null default false
);
alter table votes.questions enable row level security;
create index if not exists questions_poll_idx on votes.questions (poll_id, sort_order);

-- ---------------------------------------------------------------------
-- 3. Réponses. Le device_token (généré côté navigateur, mémorisé comme le
--    code des élections) sert uniquement de clé d'édition pour modifier sa
--    réponse jusqu'à la clôture — jamais exposé publiquement, jamais utilisé
--    comme preuve d'identité (le pseudo est déclaratif, non vérifié).
-- ---------------------------------------------------------------------
create table if not exists votes.responses (
  id             uuid primary key default gen_random_uuid(),
  poll_id        uuid not null references votes.polls(id) on delete cascade,
  pseudo         text not null check (char_length(trim(pseudo)) between 1 and 60),
  device_token   text not null,
  answers        jsonb not null default '{}'::jsonb,
  submitted_at   timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
alter table votes.responses enable row level security;
create index if not exists responses_poll_idx on votes.responses (poll_id);

-- Identité d'une réponse = pseudo (insensible à la casse), pas l'appareil qui l'a soumise : voir
-- votes.respond() plus bas pour le choix assumé que ça implique — reprendre le même pseudo modifie
-- la réponse existante d'où qu'on se connecte (sans compte ni code), mais à l'inverse deux personnes
-- qui choisiraient le même pseudo sur un même sondage peuvent modifier la réponse l'une de l'autre.
-- device_token n'est donc plus une clé d'identité : gardé à titre informatif seulement.
alter table votes.responses drop constraint if exists responses_poll_id_device_token_key;
create unique index if not exists responses_poll_pseudo_idx on votes.responses (poll_id, lower(pseudo));

-- ---------------------------------------------------------------------
-- 4. Politiques RLS
--    Sondages/questions : lecture publique une fois publiés (pas en brouillon).
--    Réponses : AUCUN accès direct anon/authenticated (le device_token ne doit
--    jamais fuiter) — tout passe par les RPC ci-dessous et la vue poll_results
--    (sans device_token).
-- ---------------------------------------------------------------------
drop policy if exists polls_read on votes.polls;
create policy polls_read on votes.polls for select using (status <> 'draft' or public.is_admin());
drop policy if exists polls_admin_insert on votes.polls;
drop policy if exists polls_admin_update on votes.polls;
drop policy if exists polls_admin_delete on votes.polls;
create policy polls_admin_insert on votes.polls for insert with check (public.is_admin());
create policy polls_admin_update on votes.polls for update using (public.is_admin()) with check (public.is_admin());
create policy polls_admin_delete on votes.polls for delete using (public.is_admin());

drop policy if exists questions_read on votes.questions;
create policy questions_read on votes.questions for select using (
  exists (select 1 from votes.polls p where p.id = poll_id and (p.status <> 'draft' or public.is_admin()))
);
drop policy if exists questions_admin on votes.questions;
create policy questions_admin on votes.questions for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists responses_admin on votes.responses;
create policy responses_admin on votes.responses for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 5. Résultats publics (jamais le device_token). RPC security definer plutôt
--    qu'une vue security_invoker : sinon l'appelant devrait avoir un accès
--    direct aux colonnes de votes.responses, ce qui rouvrirait la table de
--    base (même partiellement) au lieu de tout faire transiter par ici.
-- ---------------------------------------------------------------------
drop view if exists votes.poll_results;
create or replace function votes.poll_results(p_poll uuid)
returns table (id uuid, pseudo text, answers jsonb, submitted_at timestamptz, updated_at timestamptz)
language plpgsql security definer set search_path = votes, public as $$
declare v_status text;
begin
  select pl.status into v_status from votes.polls pl where pl.id = p_poll;
  if v_status is null then raise exception 'POLL_NOT_FOUND'; end if;
  if v_status = 'draft' and not public.is_admin() then raise exception 'POLL_NOT_OPEN'; end if;
  return query select r.id, r.pseudo, r.answers, r.submitted_at, r.updated_at
    from votes.responses r where r.poll_id = p_poll order by r.submitted_at;
end $$;

-- ---------------------------------------------------------------------
-- 6. RPC publiques
-- ---------------------------------------------------------------------

-- Valide les réponses contre les questions du sondage (type/options/obligatoire) puis upsert
-- par (poll_id, pseudo) — pas par device_token : reprendre le même pseudo sur un autre appareil
-- modifie la même réponse (une réponse reste modifiable jusqu'à la clôture, d'où qu'on se
-- connecte, sans compte ni code). Compromis assumé : deux personnes qui choisiraient le même
-- pseudo sur un même sondage peuvent modifier la réponse l'une de l'autre.
create or replace function votes.respond(p_poll uuid, p_device_token text, p_pseudo text, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = votes, public as $$
declare
  v_poll     votes.polls;
  v_pseudo   text;
  v_q        record;
  v_val      jsonb;
  v_existing votes.responses;
  v_replaced boolean := false;
begin
  select * into v_poll from votes.polls where id = p_poll;
  if v_poll.id is null or v_poll.status <> 'open' then raise exception 'POLL_NOT_OPEN'; end if;
  if v_poll.closes_at is not null and now() >= v_poll.closes_at then raise exception 'POLL_CLOSED'; end if;
  if coalesce(p_device_token, '') = '' then raise exception 'BAD_DEVICE'; end if;
  v_pseudo := nullif(trim(p_pseudo), '');
  if v_pseudo is null or char_length(v_pseudo) > 60 then raise exception 'BAD_PSEUDO'; end if;
  if jsonb_typeof(p_answers) <> 'object' then raise exception 'BAD_ANSWERS'; end if;

  for v_q in select * from votes.questions where poll_id = p_poll loop
    v_val := p_answers -> v_q.id::text;
    if v_q.required and (v_val is null or v_val = 'null'::jsonb) then
      raise exception 'MISSING_ANSWER: %', v_q.label;
    end if;
    -- Une chaîne/tableau vide est traité comme "pas de réponse" (le client filtre déjà ces cas
    -- avant l'appel, mais le serveur doit faire foi même pour un appel direct de l'API).
    if v_q.required and v_val is not null and v_val <> 'null'::jsonb and (
      (jsonb_typeof(v_val) = 'string' and (v_val #>> '{}') = '') or
      (jsonb_typeof(v_val) = 'array' and jsonb_array_length(v_val) = 0)
    ) then
      raise exception 'MISSING_ANSWER: %', v_q.label;
    end if;
    if v_val is not null and v_val <> 'null'::jsonb then
      if v_q.type = 'choice' and not (v_q.options ? (v_val #>> '{}')) then raise exception 'BAD_CHOICE: %', v_q.label; end if;
      if v_q.type = 'multi_choice' then
        if jsonb_typeof(v_val) <> 'array' then raise exception 'BAD_CHOICE: %', v_q.label; end if;
        if exists (select 1 from jsonb_array_elements_text(v_val) t where not (v_q.options ? t)) then raise exception 'BAD_CHOICE: %', v_q.label; end if;
      end if;
      if v_q.type = 'yesno' and (v_val #>> '{}') not in ('yes','no') then raise exception 'BAD_CHOICE: %', v_q.label; end if;
      if v_q.type = 'number' and jsonb_typeof(v_val) <> 'number' then raise exception 'BAD_CHOICE: %', v_q.label; end if;
      if v_q.type = 'text' and jsonb_typeof(v_val) <> 'string' then raise exception 'BAD_CHOICE: %', v_q.label; end if;
    end if;
  end loop;

  select * into v_existing from votes.responses where poll_id = p_poll and lower(pseudo) = lower(v_pseudo);
  if v_existing.id is not null then
    v_replaced := true;
    update votes.responses set device_token = p_device_token, answers = p_answers, updated_at = now() where id = v_existing.id
    returning * into v_existing;
  else
    insert into votes.responses (poll_id, device_token, pseudo, answers) values (p_poll, p_device_token, v_pseudo, p_answers)
    returning * into v_existing;
  end if;
  perform public.log_audit('poll:' || v_pseudo, case when v_replaced then 'response_updated' else 'response_created' end, v_poll.slug, jsonb_build_object('poll_id', p_poll));
  return jsonb_build_object('ok', true, 'replaced', v_replaced, 'response_id', v_existing.id);
end $$;

-- Récupère la réponse d'un pseudo (pré-remplissage du formulaire), pour proposer une modification
-- même depuis un appareil qui n'a jamais servi à répondre à ce sondage.
create or replace function votes.my_response(p_poll uuid, p_pseudo text)
returns jsonb language plpgsql security definer set search_path = votes as $$
declare v jsonb;
begin
  select jsonb_build_object('pseudo', pseudo, 'answers', answers, 'submitted_at', submitted_at)
  into v from votes.responses where poll_id = p_poll and lower(pseudo) = lower(coalesce(p_pseudo, ''));
  return coalesce(v, 'null'::jsonb);
end $$;

-- Retire la réponse d'un pseudo (même logique d'identité que respond()/my_response : quiconque
-- reprend ce pseudo peut la supprimer, d'où qu'il se connecte). Autorisé tant que le sondage est
-- ouvert, comme la modification.
create or replace function votes.delete_response(p_poll uuid, p_pseudo text)
returns void language plpgsql security definer set search_path = votes, public as $$
declare v_poll votes.polls; v_id uuid;
begin
  select * into v_poll from votes.polls where id = p_poll;
  if v_poll.id is null or v_poll.status <> 'open' then raise exception 'POLL_NOT_OPEN'; end if;
  if v_poll.closes_at is not null and now() >= v_poll.closes_at then raise exception 'POLL_CLOSED'; end if;
  select id into v_id from votes.responses where poll_id = p_poll and lower(pseudo) = lower(coalesce(p_pseudo, ''));
  if v_id is null then raise exception 'RESPONSE_NOT_FOUND'; end if;
  delete from votes.responses where id = v_id;
  perform public.log_audit('poll:self', 'response_deleted_by_voter', v_poll.slug, jsonb_build_object('response_id', v_id));
end $$;

-- ---------------------------------------------------------------------
-- 7. RPC admin
-- ---------------------------------------------------------------------
create or replace function votes.admin_save_poll(p jsonb)
returns votes.polls language plpgsql security definer set search_path = votes, public as $$
declare v votes.polls;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p->>'id' is null then
    insert into votes.polls (slug, title, description, status, opens_at, closes_at)
    values (p->>'slug', p->>'title', coalesce(p->>'description',''), coalesce(p->>'status','draft'),
            (p->>'opens_at')::timestamptz, (p->>'closes_at')::timestamptz)
    returning * into v;
  else
    update votes.polls set
      slug = coalesce(p->>'slug', slug), title = coalesce(p->>'title', title),
      description = coalesce(p->>'description', description),
      status = coalesce(p->>'status', status),
      opens_at = case when p ? 'opens_at' then (p->>'opens_at')::timestamptz else opens_at end,
      closes_at = case when p ? 'closes_at' then (p->>'closes_at')::timestamptz else closes_at end,
      updated_at = now()
    where id = (p->>'id')::uuid returning * into v;
    if v is null then raise exception 'POLL_NOT_FOUND'; end if;
  end if;
  perform public.log_audit('admin:' || auth.uid()::text, 'poll_saved', v.id::text, p - 'description');
  return v;
end $$;

-- Met à jour la liste des questions d'un sondage : une question déjà existante (identifiée par
-- son "id" dans p_questions) est modifiée en place — pas recréée — pour ne jamais casser le lien
-- avec les réponses déjà données (celles-ci référencent l'id de question dans leur jsonb "answers").
-- Une question sans "id" (nouvelle) est insérée ; une question existante absente de p_questions
-- est supprimée (et ses réponses sur cette question, orphelines, disparaissent avec elle).
create or replace function votes.admin_save_questions(p_poll uuid, p_questions jsonb)
returns setof votes.questions language plpgsql security definer set search_path = votes, public as $$
declare v_q jsonb; v_i int := 0; v_id uuid; v_ids uuid[] := '{}';
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if not exists (select 1 from votes.polls where id = p_poll) then raise exception 'POLL_NOT_FOUND'; end if;
  if jsonb_typeof(p_questions) <> 'array' then raise exception 'BAD_QUESTIONS'; end if;
  for v_q in select * from jsonb_array_elements(p_questions) loop
    if not (v_q->>'type' in ('choice','multi_choice','yesno','number','text')) then raise exception 'BAD_QUESTION_TYPE'; end if;
    if v_q ? 'id' and exists (select 1 from votes.questions q where q.id = (v_q->>'id')::uuid and q.poll_id = p_poll) then
      v_id := (v_q->>'id')::uuid;
      update votes.questions set sort_order = v_i, label = v_q->>'label', type = v_q->>'type',
        options = coalesce(v_q->'options', '[]'::jsonb), required = coalesce((v_q->>'required')::boolean, false)
      where id = v_id;
    else
      insert into votes.questions (poll_id, sort_order, label, type, options, required)
      values (p_poll, v_i, v_q->>'label', v_q->>'type', coalesce(v_q->'options', '[]'::jsonb), coalesce((v_q->>'required')::boolean, false))
      returning id into v_id;
    end if;
    v_ids := v_ids || v_id;
    v_i := v_i + 1;
  end loop;
  delete from votes.questions where poll_id = p_poll and not (id = any(v_ids));
  perform public.log_audit('admin:' || auth.uid()::text, 'poll_questions_saved', p_poll::text, jsonb_build_object('n', v_i));
  return query select * from votes.questions where poll_id = p_poll order by sort_order;
end $$;

create or replace function votes.admin_delete_poll(p_poll uuid)
returns void language plpgsql security definer set search_path = votes, public as $$
declare v_slug text;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  select slug into v_slug from votes.polls where id = p_poll;
  if v_slug is null then raise exception 'POLL_NOT_FOUND'; end if;
  delete from votes.polls where id = p_poll;
  perform public.log_audit('admin:' || auth.uid()::text, 'poll_deleted', p_poll::text, jsonb_build_object('slug', v_slug));
end $$;

create or replace function votes.admin_delete_response(p_response uuid)
returns void language plpgsql security definer set search_path = votes, public as $$
declare v_poll uuid;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  select poll_id into v_poll from votes.responses where id = p_response;
  if v_poll is null then raise exception 'RESPONSE_NOT_FOUND'; end if;
  delete from votes.responses where id = p_response;
  perform public.log_audit('admin:' || auth.uid()::text, 'response_deleted', v_poll::text, jsonb_build_object('response_id', p_response));
end $$;

-- ---------------------------------------------------------------------
-- 8. Privilèges d'exécution : tout révoqué, puis accordé explicitement.
--    Scopé au schéma "votes" uniquement (n'affecte, et n'est affecté par,
--    aucun revoke fait dans elections/supabase/schema.sql).
-- ---------------------------------------------------------------------
alter default privileges for role postgres in schema votes revoke execute on functions from public, anon, authenticated;
do $$
declare r record;
begin
  for r in select p.oid::regprocedure as sig from pg_proc p where p.pronamespace = 'votes'::regnamespace loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
  end loop;
end $$;
grant execute on function votes.respond(uuid, text, text, jsonb), votes.my_response(uuid, text), votes.poll_results(uuid), votes.delete_response(uuid, text) to anon, authenticated;
grant execute on function votes.admin_save_poll(jsonb), votes.admin_save_questions(uuid, jsonb), votes.admin_delete_poll(uuid), votes.admin_delete_response(uuid) to authenticated;

-- Tables : select direct nécessaire pour .from('polls')/.from('questions') côté client (RLS filtre
-- déjà les brouillons). Les écritures passent uniquement par les RPC ci-dessus (security definer,
-- exécutées comme postgres qui contourne RLS) : aucun grant insert/update/delete direct nécessaire.
grant select on votes.polls, votes.questions to anon, authenticated;
