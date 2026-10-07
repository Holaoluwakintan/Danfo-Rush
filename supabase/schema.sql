
create schema if not exists danfo;
revoke all on schema danfo from public, anon, authenticated;

create table if not exists danfo.players (
  device_id uuid primary key,
  nickname text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists danfo.runs (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  score int, coins int, distance int, passengers int, near_misses int, duration_ms int,
  offline boolean not null default false,
  flagged boolean not null default false,
  flag_reason text,
  client_version text
);
create index if not exists runs_dev_idx on danfo.runs(device_id, started_at desc);
create index if not exists runs_score_idx on danfo.runs(score desc) where submitted_at is not null and not flagged;
create index if not exists runs_week_idx on danfo.runs(submitted_at) where submitted_at is not null and not flagged;
alter table danfo.players enable row level security;
alter table danfo.runs enable row level security;
-- no policies: only the security-definer RPCs below can read/write.

create or replace function danfo.clean_nick(p text) returns text language sql immutable as $$
  select coalesce(nullif(left(regexp_replace(trim(coalesce(p,'')), '[^A-Za-z0-9 _.\-]', '', 'g'), 16), ''), 'Driver')
$$;

create or replace function public.danfo_start_run(p_device uuid) returns uuid
language plpgsql security definer set search_path = danfo, public as $$
declare n int; rid uuid;
begin
  if p_device is null then raise exception 'device required'; end if;
  select count(*) into n from danfo.runs where device_id = p_device and started_at > now() - interval '1 hour';
  if n >= 120 then raise exception 'slow down'; end if;
  insert into danfo.runs(device_id) values (p_device) returning id into rid;
  return rid;
end $$;

create or replace function public.danfo_submit(
  p_device uuid, p_run uuid, p_nick text, p_score int, p_coins int, p_distance int,
  p_passengers int, p_near int, p_duration_ms int, p_version text, p_sig text
) returns json
language plpgsql security definer set search_path = danfo, public as $$
declare r danfo.runs%rowtype; reason text := null; secs numeric; elapsed numeric; off boolean := false;
  nick text := danfo.clean_nick(p_nick); n int; best int; rank_all int; rank_week int; wk timestamptz;
begin
  if p_device is null then raise exception 'device required'; end if;
  secs := greatest(coalesce(p_duration_ms,0),0) / 1000.0;
  -- signature: cheap tamper check (not security, just raises the bar)
  if p_sig is distinct from encode(sha256(convert_to(p_device::text || ':' || p_score || ':' || p_distance || ':' || p_coins || ':danfo-oshodi-2026', 'UTF8')), 'hex') then
    reason := 'bad signature';
  end if;
  if p_run is not null then
    select * into r from danfo.runs where id = p_run and device_id = p_device for update;
    if not found then reason := coalesce(reason, 'unknown run');
    elsif r.submitted_at is not null then
      return json_build_object('ok', false, 'error', 'already submitted');
    else
      elapsed := extract(epoch from (now() - r.started_at));
      if secs > elapsed + 5 then reason := coalesce(reason, 'run longer than server clock'); end if;
    end if;
  else
    off := true;
    select count(*) into n from danfo.runs where device_id = p_device and offline and submitted_at > now() - interval '1 day';
    if n >= 30 then return json_build_object('ok', false, 'error', 'too many offline runs'); end if;
  end if;
  -- physics sanity: top speed incl. boost is ~56 m/s
  if secs < 1 or secs > 7200 then reason := coalesce(reason, 'duration'); end if;
  if p_distance < 0 or p_distance > secs * 70 + 50 then reason := coalesce(reason, 'distance vs time'); end if;
  if p_passengers < 0 or p_passengers > p_distance / 25 + 3 then reason := coalesce(reason, 'passengers'); end if;
  if p_near < 0 or p_near > p_distance / 8 + 3 then reason := coalesce(reason, 'near misses'); end if;
  if p_coins < 0 or p_coins > p_distance + 200 then reason := coalesce(reason, 'coins'); end if;
  if p_score < 0 or p_score > p_distance * 6 + p_passengers * 300 + p_near * 150 + p_coins * 6 + 500 then reason := coalesce(reason, 'score vs distance'); end if;

  insert into danfo.players(device_id, nickname) values (p_device, nick)
    on conflict (device_id) do update set nickname = excluded.nickname, updated_at = now();

  if off then
    insert into danfo.runs(device_id, started_at, submitted_at, score, coins, distance, passengers, near_misses, duration_ms, offline, flagged, flag_reason, client_version)
    values (p_device, now() - make_interval(secs => secs), now(), p_score, p_coins, p_distance, p_passengers, p_near, p_duration_ms, true, reason is not null, reason, left(p_version,20))
    returning * into r;
  else
    if r.id is null then
      insert into danfo.runs(device_id, submitted_at, score, coins, distance, passengers, near_misses, duration_ms, flagged, flag_reason, client_version)
      values (p_device, now(), p_score, p_coins, p_distance, p_passengers, p_near, p_duration_ms, true, reason, left(p_version,20)) returning * into r;
    else
      update danfo.runs set submitted_at = now(), score = p_score, coins = p_coins, distance = p_distance, passengers = p_passengers,
        near_misses = p_near, duration_ms = p_duration_ms, flagged = reason is not null, flag_reason = reason, client_version = left(p_version,20)
      where id = r.id returning * into r;
    end if;
  end if;

  wk := date_trunc('week', now() at time zone 'Africa/Lagos') at time zone 'Africa/Lagos';
  select max(score) into best from danfo.runs where device_id = p_device and submitted_at is not null and not flagged;
  select count(*) + 1 into rank_all from (select device_id, max(score) s from danfo.runs where submitted_at is not null and not flagged group by device_id) t where t.s > coalesce(best, -1);
  select count(*) + 1 into rank_week from (select device_id, max(score) s from danfo.runs where submitted_at >= wk and not flagged group by device_id) t
    where t.s > coalesce((select max(score) from danfo.runs where device_id = p_device and submitted_at >= wk and not flagged), -1);
  return json_build_object('ok', true, 'accepted', reason is null, 'reason', reason, 'best', best, 'rank_all', rank_all, 'rank_week', rank_week);
end $$;

create or replace function public.danfo_leaderboard(p_board text, p_device uuid default null, p_limit int default 50) returns json
language plpgsql stable security definer set search_path = danfo, public as $$
declare wk timestamptz := date_trunc('week', now() at time zone 'Africa/Lagos') at time zone 'Africa/Lagos';
  since timestamptz; rows json; me json;
begin
  since := case when p_board = 'weekly' then wk else '-infinity'::timestamptz end;
  with best as (
    select device_id, max(score) s from danfo.runs where submitted_at >= since and submitted_at is not null and not flagged group by device_id
  ), ranked as (
    select b.device_id, b.s, p.nickname, rank() over (order by b.s desc) rk from best b join danfo.players p using (device_id)
  )
  select coalesce(json_agg(json_build_object('rank', rk, 'nick', nickname, 'score', s, 'me', device_id = p_device) order by rk, nickname), '[]'::json)
    into rows from (select * from ranked order by rk limit least(greatest(coalesce(p_limit,50),1),100)) x;
  with best as (
    select device_id, max(score) s from danfo.runs where submitted_at >= since and submitted_at is not null and not flagged group by device_id
  ), ranked as (select device_id, s, rank() over (order by s desc) rk from best)
  select json_build_object('rank', rk, 'score', s) into me from ranked where device_id = p_device;
  return json_build_object('board', coalesce(p_board,'all'), 'week_start', wk, 'rows', rows, 'me', me, 'players', (select count(*) from (select 1 from danfo.runs where submitted_at >= since and not flagged group by device_id) z));
end $$;

revoke all on function public.danfo_start_run(uuid) from public;
revoke all on function public.danfo_submit(uuid,uuid,text,int,int,int,int,int,int,text,text) from public;
revoke all on function public.danfo_leaderboard(text,uuid,int) from public;
grant execute on function public.danfo_start_run(uuid) to anon, authenticated;
grant execute on function public.danfo_submit(uuid,uuid,text,int,int,int,int,int,int,text,text) to anon, authenticated;
grant execute on function public.danfo_leaderboard(text,uuid,int) to anon, authenticated;
