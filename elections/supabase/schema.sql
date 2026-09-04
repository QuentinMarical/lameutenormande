-- =====================================================================
--  La Meute Normande — Élections (identification par code individuel)
--  Schéma Supabase (Postgres). À exécuter dans l'éditeur SQL du projet.
--  Idempotent : peut être relancé sans casser les données.
--
--  Principe : l'admin génère des codes (un par membre) et les distribue.
--  Le votant saisit son code pour candidater / voter, sans compte.
--  Les admins se connectent par e-mail + mot de passe (Supabase Auth).
-- =====================================================================

create extension if not exists pgcrypto;
create extension if not exists pg_net;
create extension if not exists pg_cron;

-- Nettoyage de l'ancienne version (connexion Telegram/Discord), sans effet si absente
drop view if exists public.admin_voters;
drop view if exists public.public_candidates;
drop view if exists public.results;
drop view if exists public.participation;
drop view if exists public.participation_timeline;
drop table if exists public.ballot_choices cascade;
drop table if exists public.ballots cascade;
drop table if exists public.candidates cascade;
drop table if exists public.profiles cascade;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.is_active_member();
drop function if exists public.cast_ballot(uuid, jsonb);
drop function if exists public.my_ballot(uuid);
drop function if exists public.upsert_candidacy(uuid, text, text, text, text, text);
drop function if exists public.upsert_candidacy(text, uuid, text, text, text, text, text);
drop function if exists public.withdraw_candidacy(uuid);
drop function if exists public.admin_ban_user(uuid, boolean);

-- ---------------------------------------------------------------------
-- 0. Réglages internes (URL de la function de notification + secret)
-- ---------------------------------------------------------------------
create table if not exists public.app_settings (
  key   text primary key,
  value text not null
);
alter table public.app_settings enable row level security;

-- ---------------------------------------------------------------------
-- 1. Administrateurs (comptes Supabase Auth e-mail + mot de passe)
-- ---------------------------------------------------------------------
create table if not exists public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  label      text,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------
-- 2. Catalogue des rôles (miroir de assets/roles.js)
-- ---------------------------------------------------------------------
create table if not exists public.role_catalog (
  id           text primary key,
  label        text not null,
  description  text not null default '',
  seats        int  not null default 1 check (seats > 0),
  max_choices  int  not null default 1 check (max_choices > 0),
  sort_order   int  not null default 0
);
alter table public.role_catalog enable row level security;

insert into public.role_catalog (id,label,description,seats,max_choices,sort_order) values
  ('tete',          'Tête de meute',                    'Responsable du groupe : coordination générale, représentation de la meute.', 1, 1, 10),
  ('patte_gauche',  'Patte gauche',                     'Responsable adjoint : seconde la Tête de meute.',                          1, 1, 20),
  ('patte_droite',  'Patte droite',                     'Responsable adjoint : seconde la Tête de meute.',                          1, 1, 30),
  ('communication', 'Responsable de la communication',  'Réseaux sociaux, annonces, site et visibilité de la meute.',                1, 1, 40),
  ('modo_telegram', 'Modérateur Telegram',              'Modération des groupes Telegram (2 postes).',                              2, 2, 50),
  ('modo_discord',  'Modérateur Discord',               'Modération du serveur Discord (2 postes).',                                2, 2, 60)
on conflict (id) do update set
  label = excluded.label, description = excluded.description, seats = excluded.seats,
  max_choices = excluded.max_choices, sort_order = excluded.sort_order;

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
-- 4. Codes individuels (un code = un membre, pour un scrutin)
-- ---------------------------------------------------------------------
create table if not exists public.voter_codes (
  id             uuid primary key default gen_random_uuid(),
  election_id    uuid not null references public.elections(id) on delete cascade,
  code           text not null,                                   -- forme affichée, ex. MEUTE-7K3F-Q9XA
  code_key       text generated always as (upper(replace(code, '-', ''))) stored,
  label          text,                                            -- à qui le code a été remis (pseudo), optionnel
  distributed    boolean not null default false,
  first_used_at  timestamptz,
  last_used_at   timestamptz,
  uses           int not null default 0,
  revoked        boolean not null default false,
  revoked_reason text,
  created_at     timestamptz not null default now(),
  unique (code_key)
);
alter table public.voter_codes enable row level security;
create index if not exists voter_codes_election_idx on public.voter_codes (election_id);

-- Normalisation de la saisie utilisateur : majuscules, sans espaces ni tirets
create or replace function public.norm_code(p text)
returns text language sql immutable set search_path = public as $$
  select upper(regexp_replace(coalesce(p, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

-- Retire les caractères de contrôle bidirectionnels Unicode (LRE/RLE/LRO/RLO/PDF, isolats,
-- espaces de largeur nulle, BOM) : un candidat pourrait sinon s'en servir pour faire
-- apparaître un nom trompeur (usurpation visuelle) sur les pages publiques.
create or replace function public.strip_bidi(p text)
returns text language sql immutable set search_path = public as $$
  select regexp_replace(
    coalesce(p, ''),
    '[' || chr(8203) || '-' || chr(8207) || chr(8234) || '-' || chr(8238) || chr(8288) || '-' || chr(8297) || chr(65279) || ']',
    '', 'g');
$$;

-- Résout un code saisi en ligne voter_codes valide (sinon exception)
drop function if exists public.resolve_code(text, uuid);
create or replace function public.resolve_code(p_code text, p_election uuid, p_touch boolean default false)
returns public.voter_codes language plpgsql security definer set search_path = public as $$
declare v public.voter_codes;
begin
  select * into v from public.voter_codes where code_key = public.norm_code(p_code) and election_id = p_election;
  if v.id is null then raise exception 'CODE_INVALID'; end if;
  if v.revoked then raise exception 'CODE_REVOKED'; end if;
  -- p_touch : compter une « saisie » du code (check_code) ; les autres RPC ne gonflent pas le compteur
  if p_touch then
    update public.voter_codes set first_used_at = coalesce(first_used_at, now()), last_used_at = now(), uses = uses + 1 where id = v.id;
  end if;
  return v;
end $$;

-- Génération : PREFIX-XXXX-XXXX avec un alphabet sans caractères ambigus.
-- gen_random_bytes (pgcrypto, CSPRNG) plutôt que random() : ces codes sont le seul secret
-- qui protège un bulletin de vote, ils doivent venir d'une source aléatoire imprévisible.
create or replace function public.gen_code(p_prefix text)
returns text language plpgsql volatile set search_path = public as $$
declare alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; s text := ''; i int; b bytea;
begin
  b := extensions.gen_random_bytes(8);
  for i in 1..8 loop s := s || substr(alphabet, 1 + (get_byte(b, i - 1) % length(alphabet)), 1); end loop;
  return upper(coalesce(nullif(trim(p_prefix), ''), 'MEUTE')) || '-' || substr(s, 1, 4) || '-' || substr(s, 5, 4);
end $$;

-- ---------------------------------------------------------------------
-- 5. Candidatures (libres, liées à un code)
-- ---------------------------------------------------------------------
create table if not exists public.candidates (
  id                uuid primary key default gen_random_uuid(),
  election_id       uuid not null references public.elections(id) on delete cascade,
  code_id           uuid not null references public.voter_codes(id) on delete cascade,
  role              text not null references public.role_catalog(id),
  display_name      text not null check (char_length(display_name) between 1 and 60),
  bio               text not null default '' check (char_length(bio) <= 600),
  withdrawn         boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (election_id, code_id, role)
);
alter table public.candidates enable row level security;
create index if not exists candidates_election_idx on public.candidates (election_id, role);
-- Couvre la FK candidates.role -> role_catalog(id) (signalée sans index par le linter Supabase).
create index if not exists candidates_role_idx on public.candidates (role);
-- Sert le "where code_id = ..." de my_candidacies() et de la cascade de révocation d'admin_update_code().
create index if not exists candidates_code_id_idx on public.candidates (code_id);
-- On ne conserve aucun identifiant de compte tiers (Telegram/Discord) sur les candidatures.
alter table public.candidates drop column if exists telegram_username;
alter table public.candidates drop column if exists discord_username;
alter table public.role_catalog drop column if exists requires;
-- Index orphelins d'une version antérieure du schéma, redondants avec les contraintes/index
-- ci-dessus (candidates_election_id_code_id_idx est un sous-ensemble de la contrainte unique
-- (election_id, code_id, role) ; aucune requête ne filtre ballot_choices par role seul).
drop index if exists public.candidates_election_id_code_id_idx;
drop index if exists public.ballot_choices_role_idx;

-- ---------------------------------------------------------------------
-- 6. Bulletins et choix (un bulletin par code)
-- ---------------------------------------------------------------------
create table if not exists public.ballots (
  id                  uuid primary key default gen_random_uuid(),
  election_id         uuid not null references public.elections(id) on delete cascade,
  code_id             uuid not null references public.voter_codes(id) on delete cascade,
  first_submitted_at  timestamptz not null default now(),
  submitted_at        timestamptz not null default now(),
  submissions         int not null default 1,
  invalidated         boolean not null default false,
  invalidated_by      uuid,
  invalidated_reason  text,
  unique (election_id, code_id)
);
alter table public.ballots enable row level security;
-- Sert le "where code_id = ..." de la cascade de révocation d'admin_update_code().
create index if not exists ballots_code_id_idx on public.ballots (code_id);

create table if not exists public.ballot_choices (
  ballot_id    uuid not null references public.ballots(id) on delete cascade,
  role         text not null references public.role_catalog(id),
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  primary key (ballot_id, role, candidate_id)
);
alter table public.ballot_choices enable row level security;
create index if not exists ballot_choices_candidate_id_idx on public.ballot_choices (candidate_id);

-- ---------------------------------------------------------------------
-- 7. Journal d'audit
-- ---------------------------------------------------------------------
create table if not exists public.audit_log (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  actor      text,                     -- 'admin:<uuid>' ou 'code:<label|code>'
  action     text not null,
  target     text,
  details    jsonb not null default '{}'::jsonb,
  ip         text,                     -- IP telle que vue par PostgREST (proxy Supabase/Cloudflare)
  user_agent text
);
alter table public.audit_log enable row level security;
alter table public.audit_log add column if not exists ip text;
alter table public.audit_log add column if not exists user_agent text;

-- IP/navigateur capturés automatiquement depuis les en-têtes HTTP de la requête PostgREST
-- (absents hors contexte de requête, ex. appel depuis elections_tick() via pg_cron : reste NULL).
-- Ne JAMAIS faire porter à log_audit() le contenu d'un bulletin (choix/candidat) : seul le nombre
-- de choix doit être journalisé (voir cast_ballot), jamais qui a été choisi.
create or replace function public.log_audit(p_actor text, p_action text, p_target text, p_details jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_headers json;
begin
  v_headers := nullif(current_setting('request.headers', true), '')::json;
  insert into public.audit_log (actor, action, target, details, ip, user_agent) values (
    p_actor, p_action, p_target, coalesce(p_details, '{}'::jsonb),
    nullif(split_part(coalesce(v_headers->>'cf-connecting-ip', v_headers->>'x-forwarded-for', ''), ',', 1), ''),
    v_headers->>'user-agent'
  );
end $$;

-- ---------------------------------------------------------------------
-- 8. Politiques RLS
--   Les votants n'ont pas de session : ils passent uniquement par les RPC.
--   Les admins (auth.uid() dans admins) lisent tout.
-- ---------------------------------------------------------------------
drop policy if exists app_settings_admin on public.app_settings;
create policy app_settings_admin on public.app_settings for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists admins_self on public.admins;
create policy admins_self on public.admins for select using (user_id = (select auth.uid()) or public.is_admin());

drop policy if exists role_catalog_read on public.role_catalog;
create policy role_catalog_read on public.role_catalog for select using (true);

drop policy if exists elections_read on public.elections;
create policy elections_read on public.elections for select using (status <> 'draft' or public.is_admin());
drop policy if exists elections_admin_write on public.elections;
drop policy if exists elections_admin_insert on public.elections;
drop policy if exists elections_admin_update on public.elections;
drop policy if exists elections_admin_delete on public.elections;
create policy elections_admin_insert on public.elections for insert with check (public.is_admin());
create policy elections_admin_update on public.elections for update using (public.is_admin()) with check (public.is_admin());
create policy elections_admin_delete on public.elections for delete using (public.is_admin());

drop policy if exists voter_codes_admin on public.voter_codes;
create policy voter_codes_admin on public.voter_codes for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists candidates_admin on public.candidates;
create policy candidates_admin on public.candidates for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists ballots_admin on public.ballots;
create policy ballots_admin on public.ballots for select using (public.is_admin());
drop policy if exists ballot_choices_admin on public.ballot_choices;
create policy ballot_choices_admin on public.ballot_choices for select using (public.is_admin());

drop policy if exists audit_admin_read on public.audit_log;
create policy audit_admin_read on public.audit_log for select using (public.is_admin());

-- Journal d'audit avec un nom lisible plutôt que l'identifiant technique de l'acteur
-- ('admin:<uuid>' → étiquette ou e-mail de l'admin, 'code:<x>' → x tel quel).
-- Fonction security definer (pas une vue security_invoker) : la résolution de l'e-mail admin
-- lit auth.users, table à laquelle le rôle authenticated n'a pas accès direct — seul le
-- propriétaire de la fonction (postgres) le peut. is_admin() reproduit la restriction RLS
-- perdue en passant d'une vue à une fonction.
drop view if exists public.audit_log_readable;
drop function if exists public.audit_log_readable();
create or replace function public.audit_log_readable()
returns table (id bigint, at timestamptz, actor text, action text, target text, details jsonb, actor_label text, ip text, user_agent text)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  return query
    select al.id, al.at, al.actor, al.action, al.target, al.details,
      case
        when al.actor like 'admin:%' then coalesce(
          (select coalesce(a.label, u.email) from public.admins a join auth.users u on u.id = a.user_id
           where a.user_id::text = substring(al.actor from 7)),
          al.actor)
        when al.actor like 'code:%' then substring(al.actor from 6)
        else al.actor
      end as actor_label,
      al.ip, al.user_agent
    from public.audit_log al
    order by al.at desc
    limit 300;
end $$;
grant execute on function public.audit_log_readable() to authenticated;

-- ---------------------------------------------------------------------
-- 9. Agrégats publics (RPC security definer, jamais de lien code → choix)
--    Des fonctions plutôt que des vues : le Security Advisor de Supabase
--    signale les vues « security definer », alors qu'une fonction qui
--    n'expose que des agrégats est la forme attendue.
-- ---------------------------------------------------------------------
drop view if exists public.public_candidates;
drop view if exists public.results;
drop view if exists public.participation;
drop view if exists public.participation_timeline;

create or replace function public.public_candidates(p_election uuid)
returns table (id uuid, election_id uuid, role text, display_name text, bio text,
               created_at timestamptz, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id, c.election_id, c.role, c.display_name, c.bio,
         c.created_at, c.updated_at
  from public.candidates c
  join public.elections e on e.id = c.election_id
  where c.election_id = p_election and c.withdrawn = false and e.status <> 'draft'
  order by c.created_at;
$$;

create or replace function public.results(p_election uuid)
returns table (election_id uuid, role text, candidate_id uuid, display_name text, votes int)
language sql stable security definer set search_path = public as $$
  select c.election_id, c.role, c.id as candidate_id, c.display_name,
         count(bc.ballot_id) filter (where b.invalidated = false)::int as votes
  from public.candidates c
  join public.elections e on e.id = c.election_id
  left join public.ballot_choices bc on bc.candidate_id = c.id
  left join public.ballots b on b.id = bc.ballot_id
  where c.election_id = p_election and c.withdrawn = false and e.status <> 'draft'
    and (e.results_public or e.status in ('closed','archived'))
  group by c.election_id, c.role, c.id, c.display_name;
$$;

create or replace function public.participation(p_election uuid)
returns table (election_id uuid, voters int, invalidated int, codes_issued int, last_vote_at timestamptz)
language sql stable security definer set search_path = public as $$
  select e.id as election_id,
         count(b.id) filter (where b.invalidated = false)::int as voters,
         count(b.id) filter (where b.invalidated = true)::int  as invalidated,
         (select count(*) from public.voter_codes vc where vc.election_id = e.id and not vc.revoked)::int as codes_issued,
         max(b.submitted_at) as last_vote_at
  from public.elections e
  left join public.ballots b on b.election_id = e.id
  where e.id = p_election and e.status <> 'draft'
    and (e.results_public or e.status in ('closed','archived'))
  group by e.id;
$$;

create or replace function public.participation_timeline(p_election uuid)
returns table (election_id uuid, hour timestamptz, cumulative int)
language sql stable security definer set search_path = public as $$
  select election_id, hour, sum(n) over (partition by election_id order by hour)::int as cumulative
  from (
    select b.election_id, date_trunc('hour', b.first_submitted_at) as hour, count(*) as n
    from public.ballots b
    join public.elections e on e.id = b.election_id
    where b.election_id = p_election and b.invalidated = false and e.status <> 'draft'
      and (e.results_public or e.status in ('closed','archived'))
    group by b.election_id, date_trunc('hour', b.first_submitted_at)
  ) t
  order by hour;
$$;

-- Vue admin : bulletins + code + drapeaux (security_invoker => RLS admin)
create or replace view public.admin_voters with (security_invoker = true) as
  select b.id as ballot_id, b.election_id, b.code_id, vc.code, vc.label, vc.distributed, vc.revoked, vc.uses,
         b.first_submitted_at, b.submitted_at, b.submissions, b.invalidated, b.invalidated_reason,
         array_remove(array[
           case when vc.label is null or vc.label = '' then 'sans_etiquette' end,
           case when b.submissions >= 5 then 'nombreuses_soumissions' end,
           case when vc.uses >= 20 then 'code_tres_utilise' end,
           case when exists (select 1 from public.voter_codes v2 where v2.election_id = vc.election_id and v2.id <> vc.id
                             and vc.label is not null and v2.label is not null and lower(trim(v2.label)) = lower(trim(vc.label))) then 'etiquette_en_double' end
         ], null) as suspicion,
         (select count(*) from public.ballot_choices bc where bc.ballot_id = b.id)::int as nb_choix
  from public.ballots b
  join public.voter_codes vc on vc.id = b.code_id;

grant select on public.admin_voters to authenticated;

-- ---------------------------------------------------------------------
-- 10. RPC votants (identifiés par leur code)
-- ---------------------------------------------------------------------

-- Vérifie un code : renvoie ce que le front a besoin de savoir (jamais d'autre secret)
-- p_touch (défaut true, comportement historique préservé) : ne mettre à true que pour une vraie
-- saisie de code par la personne (formulaire "Continuer"). La revalidation silencieuse d'un code
-- déjà en localStorage à chaque chargement de page doit passer p_touch=false, sinon "uses" (et le
-- drapeau de suspicion code_tres_utilise, et le libellé "code saisi ×N" dans l'onglet Votants)
-- grimpe avec la simple navigation au lieu de refléter de vraies saisies.
drop function if exists public.check_code(text, uuid);
create or replace function public.check_code(p_code text, p_election uuid, p_touch boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.voter_codes;
begin
  v := public.resolve_code(p_code, p_election, p_touch);
  return jsonb_build_object('ok', true, 'code', v.code, 'label', v.label,
    'has_ballot', exists (select 1 from public.ballots b where b.code_id = v.id and not b.invalidated),
    'candidacies', (select count(*) from public.candidates c where c.code_id = v.id and not c.withdrawn));
end $$;

-- Résout un code SANS connaître son scrutin à l'avance (le code identifie son scrutin de façon
-- unique). Permet à la page d'accueil de proposer la saisie d'un code même quand aucun scrutin
-- n'est autrement visible publiquement (ex. le scrutin est encore en préparation par le staff).
drop function if exists public.code_lookup(text);
create or replace function public.code_lookup(p_code text, p_touch boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.voter_codes; e public.elections;
begin
  select * into v from public.voter_codes where code_key = public.norm_code(p_code);
  if v.id is null then raise exception 'CODE_INVALID'; end if;
  if v.revoked then raise exception 'CODE_REVOKED'; end if;
  select * into e from public.elections where id = v.election_id;
  if p_touch then
    update public.voter_codes set first_used_at = coalesce(first_used_at, now()), last_used_at = now(), uses = uses + 1 where id = v.id;
  end if;
  return jsonb_build_object('ok', true, 'code', v.code, 'label', v.label,
    'election_id', e.id, 'election_slug', e.slug, 'election_title', e.title, 'election_status', e.status,
    'has_ballot', exists (select 1 from public.ballots b where b.code_id = v.id and not b.invalidated),
    'candidacies', (select count(*) from public.candidates c where c.code_id = v.id and not c.withdrawn));
end $$;

create or replace function public.upsert_candidacy(
  p_code text, p_election uuid, p_role text, p_display_name text, p_bio text
) returns public.candidates
language plpgsql security definer set search_path = public as $$
declare
  v_code     public.voter_codes;
  v_election public.elections;
  v_role     public.role_catalog;
  v_row      public.candidates;
begin
  v_code := public.resolve_code(p_code, p_election);
  select * into v_election from public.elections where id = p_election;
  if v_election is null or v_election.status = 'draft' then raise exception 'ELECTION_NOT_FOUND'; end if;
  if v_election.status <> 'open' or not v_election.candidacy_open then raise exception 'CANDIDACY_CLOSED'; end if;
  if not (v_election.roles ? p_role) then raise exception 'ROLE_NOT_IN_ELECTION'; end if;
  select * into v_role from public.role_catalog where id = p_role;

  insert into public.candidates (election_id, code_id, role, display_name, bio)
  values (p_election, v_code.id, p_role, trim(public.strip_bidi(p_display_name)), public.strip_bidi(coalesce(p_bio,'')))
  on conflict (election_id, code_id, role) do update set
    display_name = excluded.display_name, bio = excluded.bio,
    withdrawn = false, updated_at = now()
  returning * into v_row;

  perform public.log_audit('code:' || coalesce(v_code.label, v_code.code), 'candidacy_upsert', v_row.id::text, jsonb_build_object('role', p_role));
  return v_row;
end $$;

create or replace function public.withdraw_candidacy(p_code text, p_election uuid, p_candidate uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_code public.voter_codes;
begin
  v_code := public.resolve_code(p_code, p_election);
  -- Pas de désistement après la clôture : les résultats sont figés
  if not exists (select 1 from public.elections where id = p_election and status = 'open') then raise exception 'ELECTION_NOT_OPEN'; end if;
  update public.candidates set withdrawn = true, updated_at = now() where id = p_candidate and code_id = v_code.id;
  if not found then raise exception 'CANDIDATE_NOT_FOUND'; end if;
  perform public.log_audit('code:' || coalesce(v_code.label, v_code.code), 'candidacy_withdraw', p_candidate::text);
end $$;

create or replace function public.my_candidacies(p_code text, p_election uuid)
returns setof public.candidates language plpgsql security definer set search_path = public as $$
declare v_code public.voter_codes;
begin
  v_code := public.resolve_code(p_code, p_election);
  return query select * from public.candidates where code_id = v_code.id order by created_at;
end $$;

--   p_choices = {"tete":["<uuid>"], "modo_telegram":["<uuid>","<uuid>"], ...}
create or replace function public.cast_ballot(p_code text, p_election uuid, p_choices jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_code     public.voter_codes;
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
  v_code := public.resolve_code(p_code, p_election);
  select * into v_election from public.elections where id = p_election;
  if v_election is null or v_election.status <> 'open' then raise exception 'ELECTION_NOT_OPEN'; end if;
  if not v_election.voting_open then raise exception 'VOTING_CLOSED'; end if;
  if v_election.voting_closes_at is not null and now() >= v_election.voting_closes_at then raise exception 'VOTING_CLOSED'; end if;
  if jsonb_typeof(p_choices) <> 'object' then raise exception 'BAD_CHOICES'; end if;

  for v_role, v_ids in select * from jsonb_each(p_choices) loop
    if not (v_election.roles ? v_role) then raise exception 'ROLE_NOT_IN_ELECTION: %', v_role; end if;
    if jsonb_typeof(v_ids) <> 'array' then raise exception 'BAD_CHOICES'; end if;
    select max_choices into v_max from public.role_catalog where id = v_role;
    select count(distinct t.v) into v_cnt from jsonb_array_elements_text(v_ids) as t(v);
    if v_max is null or v_cnt > v_max then raise exception 'TOO_MANY_CHOICES: %', v_role; end if;
    for v_id in select distinct t.v::uuid from jsonb_array_elements_text(v_ids) as t(v) loop
      if not exists (select 1 from public.candidates c where c.id = v_id and c.election_id = p_election and c.role = v_role and c.withdrawn = false) then
        raise exception 'INVALID_CANDIDATE: %', v_id;
      end if;
    end loop;
    v_total := v_total + v_cnt;
  end loop;
  if v_total = 0 then raise exception 'EMPTY_BALLOT'; end if;

  select * into v_ballot from public.ballots where election_id = p_election and code_id = v_code.id;
  if v_ballot.id is not null then
    v_replaced := true;
    update public.ballots set submitted_at = now(), submissions = submissions + 1, invalidated = false, invalidated_by = null, invalidated_reason = null
    where id = v_ballot.id;
    delete from public.ballot_choices where ballot_id = v_ballot.id;
  else
    insert into public.ballots (election_id, code_id) values (p_election, v_code.id) returning * into v_ballot;
  end if;

  insert into public.ballot_choices (ballot_id, role, candidate_id)
  select v_ballot.id, kv.key, distinct_ids.id
  from jsonb_each(p_choices) kv
  cross join lateral (select distinct t.v::uuid as id from jsonb_array_elements_text(kv.value) as t(v)) distinct_ids;

  perform public.log_audit('code:' || coalesce(v_code.label, v_code.code), case when v_replaced then 'ballot_replaced' else 'ballot_cast' end,
                           v_ballot.id::text, jsonb_build_object('choices', v_total));
  return jsonb_build_object('ok', true, 'replaced', v_replaced, 'ballot_id', v_ballot.id);
end $$;

create or replace function public.my_ballot(p_code text, p_election uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_code public.voter_codes; v jsonb;
begin
  v_code := public.resolve_code(p_code, p_election);
  select jsonb_build_object(
      'ballot_id', b.id, 'submitted_at', b.submitted_at, 'invalidated', b.invalidated,
      'choices', coalesce((select jsonb_object_agg(role, ids) from (
          select role, jsonb_agg(candidate_id) ids from public.ballot_choices where ballot_id = b.id group by role) t), '{}'::jsonb))
  into v from public.ballots b where b.election_id = p_election and b.code_id = v_code.id;
  return coalesce(v, 'null'::jsonb);
end $$;

-- ---------------------------------------------------------------------
-- 11. RPC administration
-- ---------------------------------------------------------------------
create or replace function public.admin_generate_codes(p_election uuid, p_n int, p_prefix text default 'MEUTE', p_labels text[] default null)
returns setof public.voter_codes language plpgsql security definer set search_path = public as $$
declare i int; v_code text; v_label text;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_n < 1 or p_n > 1000 then raise exception 'BAD_COUNT'; end if;
  if char_length(coalesce(p_prefix, '')) > 20 then raise exception 'BAD_PREFIX'; end if;
  for i in 1..p_n loop
    v_label := case when p_labels is not null and i <= array_length(p_labels, 1) then nullif(trim(p_labels[i]), '') end;
    loop
      v_code := public.gen_code(p_prefix);
      exit when not exists (select 1 from public.voter_codes where code_key = public.norm_code(v_code));
    end loop;
    return query insert into public.voter_codes (election_id, code, label) values (p_election, v_code, v_label) returning *;
  end loop;
  perform public.log_audit('admin:' || auth.uid()::text, 'codes_generated', p_election::text, jsonb_build_object('n', p_n));
end $$;

create or replace function public.admin_update_code(p_code_id uuid, p_label text default null, p_distributed boolean default null, p_revoked boolean default null, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  update public.voter_codes set
    label = case when p_label is not null then nullif(trim(p_label), '') else label end,
    distributed = coalesce(p_distributed, distributed),
    revoked = coalesce(p_revoked, revoked),
    revoked_reason = case when p_revoked then coalesce(p_reason, revoked_reason) when p_revoked = false then null else revoked_reason end
  where id = p_code_id;
  if p_revoked then
    update public.ballots set invalidated = true, invalidated_by = auth.uid(), invalidated_reason = coalesce(p_reason, 'Code révoqué')
    where code_id = p_code_id and invalidated = false;
    update public.candidates set withdrawn = true, updated_at = now() where code_id = p_code_id and withdrawn = false;
  end if;
  perform public.log_audit('admin:' || auth.uid()::text, 'code_updated', p_code_id::text,
                           jsonb_strip_nulls(jsonb_build_object('label', p_label, 'distributed', p_distributed, 'revoked', p_revoked, 'reason', p_reason)));
end $$;

create or replace function public.admin_delete_code(p_code_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_revoked boolean; v_election uuid;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  select revoked, election_id into v_revoked, v_election from public.voter_codes where id = p_code_id;
  if v_election is null then raise exception 'CODE_NOT_FOUND'; end if;
  if not v_revoked then raise exception 'CODE_NOT_REVOKED'; end if;
  delete from public.voter_codes where id = p_code_id;
  perform public.log_audit('admin:' || auth.uid()::text, 'code_deleted', v_election::text, jsonb_build_object('code_id', p_code_id));
end $$;

create or replace function public.admin_invalidate_ballot(p_ballot uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  update public.ballots set invalidated = true, invalidated_by = auth.uid(), invalidated_reason = coalesce(p_reason, '') where id = p_ballot;
  if not found then raise exception 'BALLOT_NOT_FOUND'; end if;
  perform public.log_audit('admin:' || auth.uid()::text, 'ballot_invalidated', p_ballot::text, jsonb_build_object('reason', p_reason));
end $$;

create or replace function public.admin_restore_ballot(p_ballot uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  update public.ballots set invalidated = false, invalidated_by = null, invalidated_reason = null where id = p_ballot;
  if not found then raise exception 'BALLOT_NOT_FOUND'; end if;
  perform public.log_audit('admin:' || auth.uid()::text, 'ballot_restored', p_ballot::text);
end $$;

create or replace function public.admin_withdraw_candidacy(p_candidate uuid, p_restore boolean default false)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  update public.candidates set withdrawn = not p_restore, updated_at = now() where id = p_candidate;
  if not found then raise exception 'CANDIDATE_NOT_FOUND'; end if;
  perform public.log_audit('admin:' || auth.uid()::text, case when p_restore then 'candidacy_restored' else 'candidacy_withdraw' end, p_candidate::text);
end $$;

-- Trace de connexion/déconnexion admin dans le journal d'audit (avec IP/navigateur, capturés par
-- log_audit lui-même). p_event est restreint à une liste fermée pour éviter tout usage détourné.
create or replace function public.admin_log_event(p_event text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_event not in ('login', 'logout') then raise exception 'BAD_EVENT'; end if;
  perform public.log_audit('admin:' || auth.uid()::text, 'admin_' || p_event, null);
end $$;

-- Remplace l'upsert direct sur app_settings (onglet Réglages) : trace le changement dans l'audit
-- SANS jamais y faire figurer le secret en clair, seulement le fait qu'il a changé.
create or replace function public.admin_save_settings(p_notify_url text, p_notify_secret text)
returns void language plpgsql security definer set search_path = public as $$
declare v_url_changed boolean; v_secret_changed boolean;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  v_url_changed := coalesce((select value from public.app_settings where key = 'notify_url'), '')
                   is distinct from coalesce(p_notify_url, '');
  v_secret_changed := coalesce((select value from public.app_settings where key = 'notify_secret'), '')
                      is distinct from coalesce(p_notify_secret, '');
  insert into public.app_settings (key, value) values ('notify_url', coalesce(p_notify_url, ''))
    on conflict (key) do update set value = excluded.value;
  insert into public.app_settings (key, value) values ('notify_secret', coalesce(p_notify_secret, ''))
    on conflict (key) do update set value = excluded.value;
  if v_url_changed or v_secret_changed then
    perform public.log_audit('admin:' || auth.uid()::text, 'settings_saved', null,
      jsonb_build_object('notify_url', p_notify_url, 'notify_secret_changed', v_secret_changed));
  end if;
end $$;

create or replace function public.admin_save_election(p jsonb)
returns public.elections language plpgsql security definer set search_path = public as $$
declare v public.elections;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p ? 'roles' then
    if exists (
      select 1 from jsonb_array_elements_text(p->'roles') as t(role_id)
      where not exists (select 1 from public.role_catalog rc where rc.id = t.role_id)
    ) then raise exception 'BAD_ROLE'; end if;
    if (select count(*) from jsonb_array_elements_text(p->'roles')) <>
       (select count(distinct role_id) from jsonb_array_elements_text(p->'roles') as t(role_id))
    then raise exception 'BAD_ROLE'; end if;
  end if;
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
      -- Un rappel J-1/résultats déjà envoyés ne doivent pas rester bloqués si l'admin repousse
      -- l'échéance ou rouvre un scrutin clôturé : sinon elections_tick() ne les renverra jamais.
      reminder_sent = case when p ? 'voting_closes_at'
        and (p->>'voting_closes_at')::timestamptz is distinct from voting_closes_at
        then false else reminder_sent end,
      results_sent = case when status = 'closed' and coalesce(p->>'status', status) <> 'closed'
        then false else results_sent end,
      updated_at = now()
    where id = (p->>'id')::uuid returning * into v;
    if v is null then raise exception 'ELECTION_NOT_FOUND'; end if;
  end if;
  perform public.log_audit('admin:' || auth.uid()::text, 'election_saved', v.id::text, p - 'description');
  return v;
end $$;

create or replace function public.active_election()
returns setof public.elections language sql stable security definer set search_path = public as $$
  select * from public.elections where status = 'open' order by created_at desc limit 1;
$$;

-- ---------------------------------------------------------------------
-- 12. Notifications Telegram (pg_net -> Edge Function telegram-notify)
-- ---------------------------------------------------------------------
create or replace function public.notify_telegram(p_payload jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_url text; v_secret text;
begin
  select value into v_url from public.app_settings where key = 'notify_url';
  select value into v_secret from public.app_settings where key = 'notify_secret';
  if v_url is null or v_secret is null or v_url = '' or v_secret = '' then return; end if;
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

create or replace function public.elections_tick()
returns void language plpgsql security definer set search_path = public as $$
declare e record;
begin
  for e in select * from public.elections
           where status = 'open' and voting_open and not reminder_sent
             and voting_closes_at is not null
             and voting_closes_at between now() + interval '23 hours' and now() + interval '25 hours' loop
    perform public.notify_telegram(jsonb_build_object('type','reminder','election_id', e.id));
    update public.elections set reminder_sent = true where id = e.id;
  end loop;

  update public.elections set voting_open = false, candidacy_open = false, status = 'closed', updated_at = now()
  where status = 'open' and voting_closes_at is not null and now() >= voting_closes_at;

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
-- 13. Realtime : broadcast public « elections »
-- ---------------------------------------------------------------------
create or replace function public.broadcast_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_row jsonb; v_election uuid;
begin
  -- NEW/OLD sont convertis en jsonb : un champ absent renvoie null au lieu d'une erreur
  -- (les colonnes diffèrent selon la table qui déclenche le trigger).
  v_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  if tg_table_name = 'elections' then
    v_election := (v_row->>'id')::uuid;
  elsif tg_table_name in ('candidates', 'ballots') then
    v_election := (v_row->>'election_id')::uuid;
  elsif tg_table_name = 'ballot_choices' then
    select election_id into v_election from public.ballots where id = (v_row->>'ballot_id')::uuid;
  end if;
  begin
    perform realtime.send(jsonb_build_object('table', tg_table_name, 'op', tg_op, 'election_id', v_election), 'change', 'elections', false);
  exception when others then null;
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
-- 14. Privilèges d'exécution : tout est révoqué, puis accordé explicitement.
--     Votants / public : anon + authenticated. Admin : authenticated seulement
--     (les fonctions vérifient en plus is_admin()). Helpers internes : postgres.
-- ---------------------------------------------------------------------
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;
do $$
declare r record;
begin
  for r in select p.oid::regprocedure as sig from pg_proc p where p.pronamespace = 'public'::regnamespace loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
  end loop;
end $$;
-- is_admin() doit rester exécutable par anon : les policies RLS elections_read/admins_self
-- l'appellent lors de toute lecture directe (PostgREST) de ces tables par un visiteur anonyme,
-- pas seulement quand le client appelle explicitement le RPC is_admin(). Le retirer casse ces
-- lectures avec "permission denied for function is_admin" (vécu en production, corrigé ici).
grant execute on function
  public.check_code(text, uuid, boolean), public.code_lookup(text, boolean), public.my_ballot(text, uuid), public.my_candidacies(text, uuid),
  public.cast_ballot(text, uuid, jsonb), public.upsert_candidacy(text, uuid, text, text, text),
  public.withdraw_candidacy(text, uuid, uuid), public.active_election(), public.is_admin(),
  public.public_candidates(uuid), public.results(uuid), public.participation(uuid), public.participation_timeline(uuid)
  to anon, authenticated;
grant execute on function
  public.admin_generate_codes(uuid, int, text, text[]), public.admin_update_code(uuid, text, boolean, boolean, text), public.admin_delete_code(uuid),
  public.admin_invalidate_ballot(uuid, text), public.admin_restore_ballot(uuid),
  public.admin_withdraw_candidacy(uuid, boolean), public.admin_save_election(jsonb), public.audit_log_readable(),
  public.admin_log_event(text), public.admin_save_settings(text, text)
  to authenticated;

-- ---------------------------------------------------------------------
-- 15. Scrutin d'exemple (brouillon, à ouvrir depuis le panel admin)
-- ---------------------------------------------------------------------
insert into public.elections (slug, title, description, status)
values ('staff-2026', 'Élection du staff 2026', 'Renouvellement de l''équipe de la Meute Normande.', 'draft')
on conflict (slug) do nothing;

-- Pour donner l'accès admin à un compte créé dans Authentication > Users :
--   insert into public.admins (user_id, label) select id, 'Nitra' from auth.users where email = 'toi@exemple.fr';
