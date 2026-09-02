-- =====================================================================
--  La Meute Normande — Élections
--  Schéma Supabase (Postgres). À exécuter dans l'éditeur SQL du projet.
--  Idempotent : peut être relancé sans casser les données.
-- =====================================================================

create extension if not exists pgcrypto;
create extension if not exists pg_net;
create extension if not exists pg_cron;

-- ---------------------------------------------------------------------
-- 0. Réglages internes (URL de la function de notification + secret)
-- ---------------------------------------------------------------------
create table if not exists public.app_settings (
  key   text primary key,
  value text not null
);
alter table public.app_settings enable row level security;

-- ---------------------------------------------------------------------
-- 1. Catalogue des rôles (miroir de assets/roles.js)
-- ---------------------------------------------------------------------
create table if not exists public.role_catalog (
  id           text primary key,
  label        text not null,
  description  text not null default '',
  seats        int  not null default 1 check (seats > 0),
  max_choices  int  not null default 1 check (max_choices > 0),
  requires     text check (requires in ('telegram','discord')),
  sort_order   int  not null default 0
);
alter table public.role_catalog enable row level security;

insert into public.role_catalog (id,label,description,seats,max_choices,requires,sort_order) values
  ('tete',          'Tête de meute',                    'Responsable du groupe : coordination générale, représentation de la meute.', 1, 1, null, 10),
  ('patte_gauche',  'Patte gauche',                     'Responsable adjoint·e : seconde la Tête de meute.',                         1, 1, null, 20),
  ('patte_droite',  'Patte droite',                     'Responsable adjoint·e : seconde la Tête de meute.',                         1, 1, null, 30),
  ('communication', 'Responsable de la communication',  'Réseaux sociaux, annonces, site et visibilité de la meute.',                1, 1, null, 40),
  ('modo_telegram', 'Modérateur·ice Telegram',          'Modération des groupes Telegram (2 postes).',                              2, 2, 'telegram', 50),
  ('modo_discord',  'Modérateur·ice Discord',           'Modération du serveur Discord (2 postes).',                                2, 2, 'discord', 60)
on conflict (id) do update set
  label = excluded.label, description = excluded.description, seats = excluded.seats,
  max_choices = excluded.max_choices, requires = excluded.requires, sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------
-- 2. Profils (un par compte auth, alimenté par les Edge Functions)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  provider           text not null check (provider in ('telegram','discord')),
  provider_id        text not null,
  username           text,
  display_name       text,
  avatar_url         text,
  is_member          boolean not null default false,
  member_checked_at  timestamptz,
  account_created_at timestamptz,
  is_admin           boolean not null default false,
  banned             boolean not null default false,
  created_at         timestamptz not null default now(),
  unique (provider, provider_id)
);
alter table public.profiles enable row level security;

-- Création automatique du profil quand un compte apparaît (Discord OAuth ou Telegram via admin API)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_provider text := coalesce(new.raw_user_meta_data->>'provider', new.raw_app_meta_data->>'provider', 'discord');
  v_pid      text := coalesce(new.raw_user_meta_data->>'provider_id', new.raw_user_meta_data->>'sub', new.id::text);
begin
  if v_provider not in ('telegram','discord') then v_provider := 'discord'; end if;
  insert into public.profiles (user_id, provider, provider_id, username, display_name, avatar_url)
  values (
    new.id, v_provider, v_pid,
    coalesce(new.raw_user_meta_data->>'username', new.raw_user_meta_data->>'user_name', new.raw_user_meta_data->>'preferred_username'),
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helpers d'autorisation
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin and not banned from public.profiles where user_id = auth.uid()), false);
$$;

create or replace function public.is_active_member()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_member and not banned from public.profiles where user_id = auth.uid()), false);
$$;

-- ---------------------------------------------------------------------
-- 3. Scrutins
-- ---------------------------------------------------------------------
create table if not exists public.elections (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  title             text not null,
  description       text not null default '',
  roles             jsonb not null default '["tete","patte_gauche","patte_droite","communication","modo_telegram","modo_discord"]'::jsonb,
  status            text not null default 'draft' check (status in ('draft','open','closed','archived')),
  candidacy_open    boolean not null default false,
  voting_open       boolean not null default false,
  voting_closes_at  timestamptz,
  results_public    boolean not null default true,
  reminder_sent     boolean not null default false,
  results_sent      boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
alter table public.elections enable row level security;

-- ---------------------------------------------------------------------
-- 4. Candidatures (libres, sans validation)
-- ---------------------------------------------------------------------
create table if not exists public.candidates (
  id                uuid primary key default gen_random_uuid(),
  election_id       uuid not null references public.elections(id) on delete cascade,
  user_id           uuid not null references public.profiles(user_id) on delete cascade,
  role              text not null references public.role_catalog(id),
  display_name      text not null check (char_length(display_name) between 1 and 60),
  bio               text not null default '' check (char_length(bio) <= 600),
  telegram_username text,
  discord_username  text,
  withdrawn         boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (election_id, user_id, role)
);
alter table public.candidates enable row level security;
create index if not exists candidates_election_idx on public.candidates (election_id, role);

-- ---------------------------------------------------------------------
-- 5. Bulletins et choix
-- ---------------------------------------------------------------------
create table if not exists public.ballots (
  id                  uuid primary key default gen_random_uuid(),
  election_id         uuid not null references public.elections(id) on delete cascade,
  user_id             uuid not null references public.profiles(user_id) on delete cascade,
  first_submitted_at  timestamptz not null default now(),
  submitted_at        timestamptz not null default now(),
  invalidated         boolean not null default false,
  invalidated_by      uuid references public.profiles(user_id),
  invalidated_reason  text,
  unique (election_id, user_id)
);
alter table public.ballots enable row level security;

create table if not exists public.ballot_choices (
  ballot_id    uuid not null references public.ballots(id) on delete cascade,
  role         text not null references public.role_catalog(id),
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  primary key (ballot_id, role, candidate_id)
);
alter table public.ballot_choices enable row level security;
create index if not exists ballot_choices_candidate_idx on public.ballot_choices (candidate_id);

-- ---------------------------------------------------------------------
-- 6. Journal d'audit
-- ---------------------------------------------------------------------
create table if not exists public.audit_log (
  id       bigint generated always as identity primary key,
  at       timestamptz not null default now(),
  actor    uuid,
  action   text not null,
  target   text,
  details  jsonb not null default '{}'::jsonb
);
alter table public.audit_log enable row level security;

create or replace function public.log_audit(p_action text, p_target text, p_details jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.audit_log (actor, action, target, details) values (auth.uid(), p_action, p_target, coalesce(p_details, '{}'::jsonb));
$$;

-- ---------------------------------------------------------------------
-- 7. Politiques RLS
-- ---------------------------------------------------------------------
-- app_settings : admin uniquement
drop policy if exists app_settings_admin on public.app_settings;
create policy app_settings_admin on public.app_settings for all using (public.is_admin()) with check (public.is_admin());

-- role_catalog : lecture publique
drop policy if exists role_catalog_read on public.role_catalog;
create policy role_catalog_read on public.role_catalog for select using (true);

-- profiles : soi-même + admin (les Edge Functions passent par la service_role qui ignore la RLS)
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles for update using (public.is_admin()) with check (public.is_admin());

-- elections : lecture publique sauf brouillons ; écriture admin
drop policy if exists elections_read on public.elections;
create policy elections_read on public.elections for select using (status <> 'draft' or public.is_admin());
drop policy if exists elections_admin_write on public.elections;
create policy elections_admin_write on public.elections for all using (public.is_admin()) with check (public.is_admin());

-- candidates : lecture via la vue public_candidates ; propriétaire lit les siennes ; admin tout
drop policy if exists candidates_owner_read on public.candidates;
create policy candidates_owner_read on public.candidates for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists candidates_admin_write on public.candidates;
create policy candidates_admin_write on public.candidates for all using (public.is_admin()) with check (public.is_admin());

-- ballots / choices : propriétaire lit son bulletin ; admin tout ; écriture uniquement via RPC
drop policy if exists ballots_owner_read on public.ballots;
create policy ballots_owner_read on public.ballots for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists ballot_choices_owner_read on public.ballot_choices;
create policy ballot_choices_owner_read on public.ballot_choices for select
  using (exists (select 1 from public.ballots b where b.id = ballot_id and (b.user_id = auth.uid() or public.is_admin())));

-- audit_log : admin
drop policy if exists audit_admin_read on public.audit_log;
create policy audit_admin_read on public.audit_log for select using (public.is_admin());

-- ---------------------------------------------------------------------
-- 8. Vues publiques (agrégats uniquement)
-- ---------------------------------------------------------------------
create or replace view public.public_candidates as
  select c.id, c.election_id, c.role, c.display_name, c.bio,
         c.telegram_username, c.discord_username, c.created_at, c.updated_at,
         p.provider, p.avatar_url
  from public.candidates c
  join public.profiles p on p.user_id = c.user_id
  join public.elections e on e.id = c.election_id
  where c.withdrawn = false and e.status <> 'draft';

create or replace view public.results as
  select c.election_id, c.role, c.id as candidate_id, c.display_name, p.avatar_url, p.provider,
         c.telegram_username, c.discord_username,
         count(bc.ballot_id) filter (where b.invalidated = false)::int as votes
  from public.candidates c
  join public.profiles p on p.user_id = c.user_id
  join public.elections e on e.id = c.election_id
  left join public.ballot_choices bc on bc.candidate_id = c.id
  left join public.ballots b on b.id = bc.ballot_id
  where c.withdrawn = false and e.status <> 'draft' and e.results_public
  group by c.election_id, c.role, c.id, c.display_name, p.avatar_url, p.provider, c.telegram_username, c.discord_username;

create or replace view public.participation as
  select e.id as election_id,
         count(b.id) filter (where b.invalidated = false)::int as voters,
         count(b.id) filter (where b.invalidated = true)::int  as invalidated,
         max(b.submitted_at) as last_vote_at
  from public.elections e
  left join public.ballots b on b.election_id = e.id
  where e.status <> 'draft'
  group by e.id;

create or replace view public.participation_timeline as
  select election_id, hour,
         sum(n) over (partition by election_id order by hour)::int as cumulative
  from (
    select b.election_id, date_trunc('hour', b.first_submitted_at) as hour, count(*) as n
    from public.ballots b
    join public.elections e on e.id = b.election_id
    where b.invalidated = false and e.status <> 'draft'
    group by b.election_id, date_trunc('hour', b.first_submitted_at)
  ) t;

-- Vue admin : votants + drapeaux de suspicion (security_invoker => RLS de ballots/profiles)
create or replace view public.admin_voters with (security_invoker = true) as
  select b.id as ballot_id, b.election_id, b.user_id,
         p.provider, p.provider_id, p.username, p.display_name, p.avatar_url,
         p.is_member, p.member_checked_at, p.account_created_at, p.banned,
         b.first_submitted_at, b.submitted_at, b.invalidated, b.invalidated_reason,
         array_remove(array[
           case when p.account_created_at is not null and p.account_created_at > now() - interval '30 days' then 'nouveau_compte' end,
           case when not p.is_member then 'non_membre' end,
           case when exists (
             select 1 from public.ballots b2 join public.profiles p2 on p2.user_id = b2.user_id
             where b2.election_id = b.election_id and b2.user_id <> b.user_id and p2.provider <> p.provider
               and (
                 (p.username is not null and p2.username is not null and lower(p.username) = lower(p2.username))
                 or (p.display_name is not null and p2.display_name is not null and lower(p.display_name) = lower(p2.display_name))
               )
           ) then 'doublon_pseudo' end
         ], null) as suspicion,
         (select count(*) from public.ballot_choices bc where bc.ballot_id = b.id)::int as nb_choix
  from public.ballots b
  join public.profiles p on p.user_id = b.user_id;

grant select on public.public_candidates, public.results, public.participation, public.participation_timeline to anon, authenticated;
grant select on public.admin_voters to authenticated;

-- ---------------------------------------------------------------------
-- 9. RPC : candidatures
-- ---------------------------------------------------------------------
create or replace function public.upsert_candidacy(
  p_election uuid, p_role text, p_display_name text, p_bio text,
  p_telegram_username text default null, p_discord_username text default null
) returns public.candidates
language plpgsql security definer set search_path = public as $$
declare
  v_election public.elections;
  v_role     public.role_catalog;
  v_row      public.candidates;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.is_active_member() then raise exception 'NOT_MEMBER'; end if;
  select * into v_election from public.elections where id = p_election;
  if v_election is null or v_election.status = 'draft' then raise exception 'ELECTION_NOT_FOUND'; end if;
  if not v_election.candidacy_open then raise exception 'CANDIDACY_CLOSED'; end if;
  if not (v_election.roles ? p_role) then raise exception 'ROLE_NOT_IN_ELECTION'; end if;
  select * into v_role from public.role_catalog where id = p_role;
  if v_role.requires = 'telegram' and coalesce(trim(p_telegram_username),'') = '' then raise exception 'TELEGRAM_USERNAME_REQUIRED'; end if;
  if v_role.requires = 'discord'  and coalesce(trim(p_discord_username),'') = ''  then raise exception 'DISCORD_USERNAME_REQUIRED'; end if;

  insert into public.candidates (election_id, user_id, role, display_name, bio, telegram_username, discord_username)
  values (p_election, auth.uid(), p_role, trim(p_display_name), coalesce(p_bio,''),
          nullif(ltrim(trim(p_telegram_username), '@'), ''), nullif(trim(p_discord_username), ''))
  on conflict (election_id, user_id, role) do update set
    display_name = excluded.display_name, bio = excluded.bio,
    telegram_username = excluded.telegram_username, discord_username = excluded.discord_username,
    withdrawn = false, updated_at = now()
  returning * into v_row;

  perform public.log_audit('candidacy_upsert', v_row.id::text, jsonb_build_object('role', p_role, 'election', p_election));
  return v_row;
end $$;

create or replace function public.withdraw_candidacy(p_candidate uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  update public.candidates set withdrawn = true, updated_at = now()
  where id = p_candidate and (user_id = auth.uid() or public.is_admin());
  if not found then raise exception 'CANDIDATE_NOT_FOUND'; end if;
  perform public.log_audit('candidacy_withdraw', p_candidate::text);
end $$;

-- ---------------------------------------------------------------------
-- 10. RPC : vote
--   p_choices = {"tete":["<uuid>"], "modo_telegram":["<uuid>","<uuid>"], ...}
-- ---------------------------------------------------------------------
create or replace function public.cast_ballot(p_election uuid, p_choices jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_election public.elections;
  v_ballot   public.ballots;
  v_replaced boolean := false;
  v_role     text;
  v_ids      jsonb;
  v_max      int;
  v_id       uuid;
  v_total    int := 0;
  v_cnt      int;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.is_active_member() then raise exception 'NOT_MEMBER'; end if;
  select * into v_election from public.elections where id = p_election;
  if v_election is null or v_election.status <> 'open' then raise exception 'ELECTION_NOT_OPEN'; end if;
  if not v_election.voting_open then raise exception 'VOTING_CLOSED'; end if;
  if v_election.voting_closes_at is not null and now() >= v_election.voting_closes_at then raise exception 'VOTING_CLOSED'; end if;
  if jsonb_typeof(p_choices) <> 'object' then raise exception 'BAD_CHOICES'; end if;

  -- Validation de chaque rôle
  for v_role, v_ids in select * from jsonb_each(p_choices) loop
    if not (v_election.roles ? v_role) then raise exception 'ROLE_NOT_IN_ELECTION: %', v_role; end if;
    if jsonb_typeof(v_ids) <> 'array' then raise exception 'BAD_CHOICES'; end if;
    select max_choices into v_max from public.role_catalog where id = v_role;
    select count(distinct t.v) into v_cnt from jsonb_array_elements_text(v_ids) as t(v);
    if v_cnt > v_max then raise exception 'TOO_MANY_CHOICES: %', v_role; end if;
    for v_id in select distinct t.v::uuid from jsonb_array_elements_text(v_ids) as t(v) loop
      if not exists (select 1 from public.candidates c where c.id = v_id and c.election_id = p_election and c.role = v_role and c.withdrawn = false) then
        raise exception 'INVALID_CANDIDATE: %', v_id;
      end if;
    end loop;
    v_total := v_total + v_cnt;
  end loop;
  if v_total = 0 then raise exception 'EMPTY_BALLOT'; end if;

  select * into v_ballot from public.ballots where election_id = p_election and user_id = auth.uid();
  if v_ballot.id is not null then
    v_replaced := true;
    update public.ballots set submitted_at = now(), invalidated = false, invalidated_by = null, invalidated_reason = null
    where id = v_ballot.id;
    delete from public.ballot_choices where ballot_id = v_ballot.id;
  else
    insert into public.ballots (election_id, user_id) values (p_election, auth.uid()) returning * into v_ballot;
  end if;

  insert into public.ballot_choices (ballot_id, role, candidate_id)
  select v_ballot.id, kv.key, distinct_ids.id
  from jsonb_each(p_choices) kv
  cross join lateral (select distinct t.v::uuid as id from jsonb_array_elements_text(kv.value) as t(v)) distinct_ids;

  perform public.log_audit(case when v_replaced then 'ballot_replaced' else 'ballot_cast' end, v_ballot.id::text,
                           jsonb_build_object('election', p_election, 'choices', v_total));
  return jsonb_build_object('ok', true, 'replaced', v_replaced, 'ballot_id', v_ballot.id);
end $$;

-- Le bulletin courant du compte connecté (pour pré-remplir / rappeler)
create or replace function public.my_ballot(p_election uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(
    (select jsonb_build_object(
        'ballot_id', b.id, 'submitted_at', b.submitted_at, 'invalidated', b.invalidated,
        'choices', coalesce((select jsonb_object_agg(role, ids) from (
            select role, jsonb_agg(candidate_id) ids from public.ballot_choices where ballot_id = b.id group by role) t), '{}'::jsonb))
     from public.ballots b where b.election_id = p_election and b.user_id = auth.uid()),
    'null'::jsonb);
$$;

-- ---------------------------------------------------------------------
-- 11. RPC : administration
-- ---------------------------------------------------------------------
create or replace function public.admin_invalidate_ballot(p_ballot uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  update public.ballots set invalidated = true, invalidated_by = auth.uid(), invalidated_reason = coalesce(p_reason, '')
  where id = p_ballot;
  if not found then raise exception 'BALLOT_NOT_FOUND'; end if;
  perform public.log_audit('ballot_invalidated', p_ballot::text, jsonb_build_object('reason', p_reason));
end $$;

create or replace function public.admin_restore_ballot(p_ballot uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  update public.ballots set invalidated = false, invalidated_by = null, invalidated_reason = null where id = p_ballot;
  if not found then raise exception 'BALLOT_NOT_FOUND'; end if;
  perform public.log_audit('ballot_restored', p_ballot::text);
end $$;

create or replace function public.admin_ban_user(p_user uuid, p_banned boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  update public.profiles set banned = p_banned where user_id = p_user;
  if p_banned then
    update public.ballots set invalidated = true, invalidated_by = auth.uid(), invalidated_reason = 'Compte banni'
    where user_id = p_user and invalidated = false;
  end if;
  perform public.log_audit(case when p_banned then 'user_banned' else 'user_unbanned' end, p_user::text);
end $$;

create or replace function public.admin_save_election(p jsonb)
returns public.elections language plpgsql security definer set search_path = public as $$
declare v public.elections;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p->>'id' is null then
    insert into public.elections (slug, title, description, roles, status, candidacy_open, voting_open, voting_closes_at, results_public)
    values (p->>'slug', p->>'title', coalesce(p->>'description',''), coalesce(p->'roles', '[]'::jsonb),
            coalesce(p->>'status','draft'), coalesce((p->>'candidacy_open')::boolean,false),
            coalesce((p->>'voting_open')::boolean,false), (p->>'voting_closes_at')::timestamptz,
            coalesce((p->>'results_public')::boolean,true))
    returning * into v;
  else
    update public.elections set
      slug = coalesce(p->>'slug', slug), title = coalesce(p->>'title', title),
      description = coalesce(p->>'description', description), roles = coalesce(p->'roles', roles),
      status = coalesce(p->>'status', status),
      candidacy_open = coalesce((p->>'candidacy_open')::boolean, candidacy_open),
      voting_open = coalesce((p->>'voting_open')::boolean, voting_open),
      voting_closes_at = case when p ? 'voting_closes_at' then (p->>'voting_closes_at')::timestamptz else voting_closes_at end,
      results_public = coalesce((p->>'results_public')::boolean, results_public),
      updated_at = now()
    where id = (p->>'id')::uuid returning * into v;
    if v is null then raise exception 'ELECTION_NOT_FOUND'; end if;
  end if;
  perform public.log_audit('election_saved', v.id::text, p - 'description');
  return v;
end $$;

-- Un seul scrutin « open » à la fois est recommandé ; le front prend le plus récent.
create or replace function public.active_election()
returns setof public.elections language sql stable security definer set search_path = public as $$
  select * from public.elections where status = 'open' order by created_at desc limit 1;
$$;

-- ---------------------------------------------------------------------
-- 12. Notifications Telegram (pg_net -> Edge Function telegram-notify)
--   app_settings : notify_url = https://<proj>.functions.supabase.co/telegram-notify
--                  notify_secret = <même valeur que le secret NOTIFY_SECRET de la function>
-- ---------------------------------------------------------------------
create or replace function public.notify_telegram(p_payload jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_url text; v_secret text;
begin
  select value into v_url from public.app_settings where key = 'notify_url';
  select value into v_secret from public.app_settings where key = 'notify_secret';
  if v_url is null or v_secret is null then return; end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type','application/json','x-notify-secret', v_secret),
    body := p_payload
  );
end $$;

create or replace function public.on_candidate_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.notify_telegram(jsonb_build_object('type','candidacy','candidate_id', new.id, 'election_id', new.election_id));
  return new;
end $$;
drop trigger if exists candidates_notify on public.candidates;
create trigger candidates_notify after insert on public.candidates for each row execute function public.on_candidate_insert();

-- Tick horaire : clôture automatique, rappel J-1, résultats finaux
create or replace function public.elections_tick()
returns void language plpgsql security definer set search_path = public as $$
declare e record;
begin
  -- Rappel 24 h avant la clôture (fenêtre 23h-25h)
  for e in select * from public.elections
           where status = 'open' and voting_open and not reminder_sent
             and voting_closes_at is not null
             and voting_closes_at between now() + interval '23 hours' and now() + interval '25 hours' loop
    perform public.notify_telegram(jsonb_build_object('type','reminder','election_id', e.id));
    update public.elections set reminder_sent = true where id = e.id;
  end loop;

  -- Clôture automatique
  update public.elections set voting_open = false, status = 'closed', updated_at = now()
  where status = 'open' and voting_closes_at is not null and now() >= voting_closes_at;

  -- Résultats finaux
  for e in select * from public.elections where status = 'closed' and not results_sent loop
    perform public.notify_telegram(jsonb_build_object('type','results','election_id', e.id));
    update public.elections set results_sent = true where id = e.id;
  end loop;
end $$;

do $$
begin
  perform cron.unschedule('elections_tick') where exists (select 1 from cron.job where jobname = 'elections_tick');
  perform cron.schedule('elections_tick', '*/15 * * * *', 'select public.elections_tick();');
end $$;

-- ---------------------------------------------------------------------
-- 13. Realtime : broadcast public « elections » (les visiteurs anonymes
--     ne verraient pas les postgres_changes à cause de la RLS)
-- ---------------------------------------------------------------------
create or replace function public.broadcast_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_election uuid;
begin
  v_election := coalesce(
    case when tg_table_name = 'elections' then coalesce(new.id, old.id) end,
    case when tg_table_name in ('candidates','ballots') then coalesce(new.election_id, old.election_id) end,
    case when tg_table_name = 'ballot_choices' then (select election_id from public.ballots where id = coalesce(new.ballot_id, old.ballot_id)) end);
  begin
    perform realtime.send(jsonb_build_object('table', tg_table_name, 'op', tg_op, 'election_id', v_election), 'change', 'elections', false);
  exception when others then null; -- realtime.send absent : on ignore, le front garde un rafraîchissement périodique
  end;
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['ballots','ballot_choices','candidates','elections'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_broadcast', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.broadcast_change()', t || '_broadcast', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 14. Scrutin d'exemple (brouillon, à ouvrir depuis le panel admin)
-- ---------------------------------------------------------------------
insert into public.elections (slug, title, description, status)
values ('staff-2026', 'Élection du staff 2026', 'Renouvellement de l''équipe de la Meute Normande.', 'draft')
on conflict (slug) do nothing;

-- Pour promouvoir un admin après sa première connexion :
--   update public.profiles set is_admin = true where username = 'nitrafox';
