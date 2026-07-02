-- ════════════════════════════════════════════════════════════════════════
-- ملف واحد يجمع كل التحديثات الجديدة — شغّله وحده في Supabase SQL Editor.
-- (يُغني عن: features / joker / seed / livephase — لا تشغّلها منفصلة.)
-- آمن وإضافي وقابل لإعادة التشغيل بالكامل. لا يحذف بيانات. لا يلمس التطبيق المجاور.
-- يشمل: توزيع الجمهور + الجوكر + بذر الإقصائيات + أطوار المباراة الحية.
-- ════════════════════════════════════════════════════════════════════════

-- ① الأعمدة الجديدة
alter table wc.predictions add column if not exists joker boolean not null default false;
alter table wc.matches     add column if not exists live_phase text;   -- null | 'ET' | 'PENS'
alter table wc.matches     add column if not exists live_manual boolean not null default false;
alter table wc.matches     alter column team_a drop not null;          -- (للأمان إن لم يُطبّق سابقًا)
alter table wc.matches     alter column team_b drop not null;

-- ② get_matches النهائية (تُرجع المنتخبين + جوكر توقعي + الطور الحي)
drop function if exists public.get_matches(uuid);
create or replace function public.get_matches(p_token uuid)
returns table (
  id text, status text, stage text, kickoff_at timestamptz, locks_at timestamptz,
  result_h int, result_a int, qualified text,
  my_h int, my_a int, my_qualified text, predictors bigint, server_now timestamptz,
  live_h int, live_a int, team_a text, team_b text, my_joker boolean, live_phase text,
  live_manual boolean
) language plpgsql security definer set search_path = wc, public as $$
declare u wc.profiles;
begin
  u := wc._auth(p_token);
  return query
  select m.id, m.status, m.stage, m.kickoff_at, wc.lock_at(m),
         m.result_h, m.result_a, m.qualified,
         p.h, p.a, p.qualified,
         (select count(*) from wc.predictions x where x.match_id = m.id),
         now(), m.live_h, m.live_a, m.team_a, m.team_b, coalesce(p.joker, false), m.live_phase,
         m.live_manual
  from wc.matches m
  left join wc.predictions p on p.match_id = m.id and p.user_id = u.id
  order by m.kickoff_at;
end $$;
grant execute on function public.get_matches(uuid) to anon, authenticated;

-- ③ الجوكر: اختيار/إلغاء (جوكر واحد لكل يوم مكة، قبل القفل)
create or replace function public.set_joker(p_token uuid, p_match_id text, p_on boolean default true)
returns json language plpgsql security definer set search_path = wc, public as $$
declare u wc.profiles; m wc.matches; d date;
begin
  u := wc._auth(p_token);
  select * into m from wc.matches where id = p_match_id;
  if m.id is null then raise exception 'MATCH_NOT_FOUND'; end if;
  if now() >= wc.lock_at(m) then raise exception 'PREDICTIONS_LOCKED'; end if;
  if not exists (select 1 from wc.predictions where user_id = u.id and match_id = p_match_id) then
    raise exception 'PREDICTION_NOT_FOUND'; end if;
  if p_on then
    d := (m.kickoff_at at time zone 'Asia/Riyadh')::date;
    -- الجوكر مستهلَك فقط على مباراة أُقفلت ولم تُلغَ (الملغاة لا تأكل جوكر اليوم)
    if exists (select 1 from wc.predictions pp join wc.matches mm on mm.id = pp.match_id
      where pp.user_id = u.id and pp.joker and pp.match_id <> p_match_id
        and (mm.kickoff_at at time zone 'Asia/Riyadh')::date = d
        and now() >= wc.lock_at(mm) and mm.status <> 'cancelled')
      then raise exception 'JOKER_USED'; end if;
    update wc.predictions pp set joker = false from wc.matches mm
      where pp.user_id = u.id and pp.match_id = mm.id and pp.joker
        and (mm.kickoff_at at time zone 'Asia/Riyadh')::date = d;
    update wc.predictions set joker = true where user_id = u.id and match_id = p_match_id;
  else
    update wc.predictions set joker = false where user_id = u.id and match_id = p_match_id;
  end if;
  return json_build_object('ok', true);
end $$;
grant execute on function public.set_joker(uuid, text, boolean) to anon, authenticated;

-- ④ طور المباراة الحي (للأدمن): أشواط إضافية / ركلات ترجيح
create or replace function public.admin_set_phase(p_token uuid, p_match_id text, p_phase text)
returns json language plpgsql security definer set search_path = wc, public as $$
declare u wc.profiles;
begin
  u := wc._auth_admin(p_token);
  if p_phase is not null and p_phase not in ('ET','PENS') then raise exception 'STAGE_INVALID'; end if;
  update wc.matches set live_phase = p_phase where id = p_match_id and status = 'scheduled';
  if not found then raise exception 'MATCH_NOT_FOUND'; end if;
  insert into wc.audit_log (admin_id, action, details)
  values (u.id, 'set_phase', json_build_object('match', p_match_id, 'phase', p_phase));
  return json_build_object('ok', true);
end $$;
grant execute on function public.admin_set_phase(uuid, text, text) to anon, authenticated;

-- ④ب تأجيل/إلغاء المباراة يصفّر أيضًا الحالة الحية (نتيجة لحظية/طور) — لا حالة هجينة
create or replace function public.admin_reschedule(p_token uuid, p_match_id text, p_kickoff timestamptz)
returns json language plpgsql security definer set search_path = wc, public as $$
declare u wc.profiles;
begin
  u := wc._auth_admin(p_token);
  update wc.matches set kickoff_at = p_kickoff, status = 'scheduled',
                        result_h = null, result_a = null, qualified = null,
                        live_h = null, live_a = null, live_phase = null, live_manual = false
  where id = p_match_id;
  if not found then raise exception 'MATCH_NOT_FOUND'; end if;
  insert into wc.audit_log (admin_id, action, details)
  values (u.id, 'reschedule', json_build_object('match', p_match_id, 'kickoff', p_kickoff));
  return json_build_object('ok', true);
end $$;

create or replace function public.admin_cancel_match(p_token uuid, p_match_id text)
returns json language plpgsql security definer set search_path = wc, public as $$
declare u wc.profiles;
begin
  u := wc._auth_admin(p_token);
  update wc.matches set status = 'cancelled',
                        live_h = null, live_a = null, live_phase = null, live_manual = false
  where id = p_match_id;
  if not found then raise exception 'MATCH_NOT_FOUND'; end if;
  insert into wc.audit_log (admin_id, action, details)
  values (u.id, 'cancel_match', json_build_object('match', p_match_id));
  return json_build_object('ok', true);
end $$;

-- ⑤ توزيع توقعات الجمهور (بعد القفل فقط)
create or replace function public.match_distribution(p_token uuid, p_match_id text)
returns json language plpgsql security definer set search_path = wc, public as $$
declare u wc.profiles; m wc.matches; tot int;
begin
  u := wc._auth(p_token);
  select * into m from wc.matches where id = p_match_id;
  if m.id is null then raise exception 'MATCH_NOT_FOUND'; end if;
  if now() < wc.lock_at(m) then raise exception 'STILL_OPEN'; end if;
  select count(*) into tot from wc.predictions where match_id = p_match_id;
  return json_build_object(
    'total', tot,
    'home', (select count(*) from wc.predictions where match_id = p_match_id and h > a),
    'draw', (select count(*) from wc.predictions where match_id = p_match_id and h = a),
    'away', (select count(*) from wc.predictions where match_id = p_match_id and h < a),
    'top',  coalesce((select json_agg(t) from (
              select h, a, count(*) as c from wc.predictions
              where match_id = p_match_id group by h, a
              order by c desc, h desc, a desc limit 3) t), '[]'::json));
end $$;
grant execute on function public.match_distribution(uuid, text) to anon, authenticated;

-- ⑥ مضاعفة الجوكر في كل دوال احتساب النقاط (نسخ دوالك + المضاعفة فقط)
create or replace function public.leaderboard(p_token uuid, p_challenge_id uuid)
 returns table(rank bigint, username text, points bigint, exact_count bigint, direction_count bigint, played bigint)
 language plpgsql security definer set search_path to 'wc', 'public' as $function$
declare u wc.profiles;
begin
  u := wc._auth(p_token);
  if not exists (select 1 from wc.memberships where user_id = u.id and challenge_id = p_challenge_id)
    then raise exception 'NOT_A_MEMBER'; end if;
  return query
  with scored as (
    select pr.id as uid, pr.display_name as dname,
      coalesce(sum(wc.match_points(p.h, p.a, p.qualified, m.result_h, m.result_a, m.qualified, m.stage) * (case when p.joker then 2 else 1 end)), 0) as pts,
      count(*) filter (where p.h = m.result_h and p.a = m.result_a) as ex,
      count(*) filter (where sign(p.h - p.a) = sign(m.result_h - m.result_a)) as dir,
      (select count(*) from wc.predictions pp where pp.user_id = pr.id) as tot,
      avg(extract(epoch from p.updated_at)) filter (where p.h = m.result_h and p.a = m.result_a) as tb
    from wc.memberships mb
    join wc.profiles pr on pr.id = mb.user_id and not pr.is_banned
    left join wc.predictions p on p.user_id = mb.user_id
    left join wc.matches m on m.id = p.match_id and m.status = 'finished' and m.kickoff_at >= mb.joined_at
    where mb.challenge_id = p_challenge_id
    group by pr.id, pr.display_name)
  select rank() over (order by s.pts desc, s.tb asc nulls last), s.dname, s.pts, s.ex, s.dir, s.tot
  from scored s order by s.pts desc, s.tb asc nulls last, s.dname;
end $function$;

create or replace function public.my_ranks(p_token uuid)
 returns table(challenge_id uuid, my_rank bigint, members bigint, my_points bigint)
 language plpgsql security definer set search_path to 'wc', 'public' as $function$
declare u wc.profiles;
begin
  u := wc._auth(p_token);
  return query
  with scored as (
    select mb.challenge_id as cid, mb.user_id as uid,
      coalesce(sum(wc.match_points(p.h, p.a, p.qualified, m.result_h, m.result_a, m.qualified, m.stage) * (case when p.joker then 2 else 1 end)), 0) as pts,
      avg(extract(epoch from p.updated_at)) filter (where p.h = m.result_h and p.a = m.result_a) as tb
    from wc.memberships mb
    join wc.profiles pr on pr.id = mb.user_id and not pr.is_banned
    left join wc.predictions p on p.user_id = mb.user_id
    left join wc.matches m on m.id = p.match_id and m.status = 'finished' and m.kickoff_at >= mb.joined_at
    group by mb.challenge_id, mb.user_id
  ), ranked as (
    select cid, uid, pts, rank() over (partition by cid order by pts desc, tb asc nulls last) as rnk,
      count(*) over (partition by cid) as total from scored)
  select r.cid, r.rnk, r.total, r.pts from ranked r where r.uid = u.id;
end $function$;

create or replace function public.match_predictions(p_token uuid, p_challenge_id uuid, p_match_id text)
 returns table(username text, h integer, a integer, qualified text, points integer, predicted_at timestamp with time zone)
 language plpgsql security definer set search_path to 'wc', 'public' as $function$
declare u wc.profiles; m wc.matches;
begin
  u := wc._auth(p_token);
  select * into m from wc.matches where id = p_match_id;
  if m.id is null then raise exception 'MATCH_NOT_FOUND'; end if;
  if now() < wc.lock_at(m) then raise exception 'STILL_OPEN'; end if;
  if not exists (select 1 from wc.memberships where user_id = u.id and challenge_id = p_challenge_id)
    then raise exception 'NOT_A_MEMBER'; end if;
  return query
  select pr.display_name, p.h, p.a, p.qualified,
         wc.match_points(p.h, p.a, p.qualified, m.result_h, m.result_a, m.qualified, m.stage) * (case when p.joker then 2 else 1 end),
         p.updated_at
  from wc.predictions p
  join wc.memberships mb on mb.user_id = p.user_id and mb.challenge_id = p_challenge_id
  join wc.profiles pr on pr.id = p.user_id
  where p.match_id = p_match_id order by 5 desc, p.updated_at asc, pr.display_name;
end $function$;

create or replace function public.day_stars(p_token uuid, p_date date default null::date)
 returns json language plpgsql security definer set search_path to 'wc', 'public' as $function$
declare u wc.profiles; d date;
begin
  u := wc._auth(p_token);
  d := coalesce(p_date, (select max((kickoff_at at time zone 'Asia/Riyadh')::date) from wc.matches where status = 'finished'));
  if d is null then return json_build_object('date', null, 'stars', '[]'::json); end if;
  return json_build_object('date', d, 'stars', (
    select coalesce(json_agg(x), '[]') from (
      select pr.display_name,
        sum(wc.match_points(p.h, p.a, p.qualified, m.result_h, m.result_a, m.qualified, m.stage) * (case when p.joker then 2 else 1 end)) as points,
        count(*) filter (where p.h = m.result_h and p.a = m.result_a) as exact_count
      from wc.predictions p
      join wc.matches m on m.id = p.match_id and m.status = 'finished' and (m.kickoff_at at time zone 'Asia/Riyadh')::date = d
      join wc.profiles pr on pr.id = p.user_id and not pr.is_banned
      group by pr.id, pr.display_name
      having sum(wc.match_points(p.h, p.a, p.qualified, m.result_h, m.result_a, m.qualified, m.stage) * (case when p.joker then 2 else 1 end)) > 0
      order by 2 desc, avg(extract(epoch from p.updated_at)) filter (where p.h = m.result_h and p.a = m.result_a) asc nulls last
      limit 10) x));
end $function$;

create or replace function public.admin_challenge_board(p_token uuid, p_challenge_id uuid)
 returns json language plpgsql security definer set search_path to 'wc', 'public' as $function$
declare u wc.profiles; c wc.challenges;
begin
  u := wc._auth_admin(p_token);
  select * into c from wc.challenges where id = p_challenge_id;
  if c.id is null then raise exception 'CHALLENGE_NOT_FOUND'; end if;
  return json_build_object('name', c.name, 'type', c.type, 'code', c.code, 'join_locked', c.join_locked,
    'owner', (select pr.display_name || ' (' || pr.username || ')' from wc.profiles pr where pr.id = c.owner_id),
    'created_at', c.created_at,
    'board', (select coalesce(json_agg(y), '[]') from (
      select rank() over (order by x.points desc, x.tb asc nulls last) as rank,
             x.display_name, x.username, x.phone, x.joined_at, x.points, x.exact_count, x.total_predictions
      from (
        select pr.display_name, pr.username, pr.phone, mb.joined_at,
          coalesce(sum(wc.match_points(p.h, p.a, p.qualified, m.result_h, m.result_a, m.qualified, m.stage) * (case when p.joker then 2 else 1 end)), 0) as points,
          count(*) filter (where p.h = m.result_h and p.a = m.result_a) as exact_count,
          (select count(*) from wc.predictions pp where pp.user_id = pr.id) as total_predictions,
          avg(extract(epoch from p.updated_at)) filter (where p.h = m.result_h and p.a = m.result_a) as tb
        from wc.memberships mb
        join wc.profiles pr on pr.id = mb.user_id and not pr.is_banned
        left join wc.predictions p on p.user_id = mb.user_id
        left join wc.matches m on m.id = p.match_id and m.status = 'finished' and m.kickoff_at >= mb.joined_at
        where mb.challenge_id = c.id
        group by pr.id, pr.display_name, pr.username, pr.phone, mb.joined_at) x
      order by x.points desc, x.tb asc nulls last, x.display_name) y));
end $function$;

create or replace function public.admin_list_users(p_token uuid, p_query text default null::text)
 returns table(username text, display_name text, phone text, is_admin boolean, is_banned boolean, created_at timestamp with time zone, predictions bigint, points bigint)
 language plpgsql security definer set search_path to 'wc', 'public' as $function$
declare u wc.profiles;
begin
  u := wc._auth_admin(p_token);
  return query
  select pr.username, pr.display_name, pr.phone, pr.is_admin, pr.is_banned, pr.created_at,
    (select count(*) from wc.predictions p where p.user_id = pr.id),
    coalesce((select sum(wc.match_points(p.h, p.a, p.qualified, m.result_h, m.result_a, m.qualified, m.stage) * (case when p.joker then 2 else 1 end))
       from wc.predictions p join wc.matches m on m.id = p.match_id and m.status = 'finished' where p.user_id = pr.id), 0)
  from wc.profiles pr
  where p_query is null or p_query = '' or pr.username ilike '%' || p_query || '%'
     or pr.display_name ilike '%' || p_query || '%' or coalesce(pr.phone, '') like '%' || p_query || '%'
  order by pr.created_at desc;
end $function$;

create or replace function public.admin_match_winners(p_token uuid, p_match_id text)
 returns json language plpgsql security definer set search_path to 'wc', 'public' as $function$
declare u wc.profiles; m wc.matches;
begin
  u := wc._auth_admin(p_token);
  select * into m from wc.matches where id = p_match_id;
  if m.id is null then raise exception 'MATCH_NOT_FOUND'; end if;
  return json_build_object('match_id', m.id, 'status', m.status,
    'result_h', m.result_h, 'result_a', m.result_a, 'stage', m.stage,
    'total_predictors', (select count(*) from wc.predictions p where p.match_id = m.id),
    'winners', case when m.status <> 'finished' then '[]'::json else
      (select coalesce(json_agg(x), '[]') from (
        select pr.display_name, pr.username, pr.phone, p.updated_at as predicted_at,
               wc.match_points(p.h, p.a, p.qualified, m.result_h, m.result_a, m.qualified, m.stage) * (case when p.joker then 2 else 1 end) as points
        from wc.predictions p
        join wc.profiles pr on pr.id = p.user_id and not pr.is_banned
        where p.match_id = m.id and p.h = m.result_h and p.a = m.result_a
        order by p.updated_at asc) x) end);
end $function$;

create or replace function public.admin_user_detail(p_token uuid, p_username text)
 returns json language plpgsql security definer set search_path to 'wc', 'public' as $function$
declare u wc.profiles; t wc.profiles;
begin
  u := wc._auth_admin(p_token);
  select * into t from wc.profiles where lower(username) = lower(trim(p_username));
  if t.id is null then raise exception 'USER_NOT_FOUND'; end if;
  return json_build_object('username', t.username, 'display_name', t.display_name, 'phone', t.phone,
    'is_admin', t.is_admin, 'is_banned', t.is_banned, 'created_at', t.created_at,
    'predictions', (select coalesce(json_agg(x order by x.kickoff_at), '[]') from (
      select p.match_id, p.h, p.a, p.created_at, p.updated_at, m.kickoff_at,
             (p.updated_at > wc.lock_at(m) - interval '60 seconds') as last_minute,
             wc.match_points(p.h, p.a, p.qualified, m.result_h, m.result_a, m.qualified, m.stage) * (case when p.joker then 2 else 1 end) as points
      from wc.predictions p join wc.matches m on m.id = p.match_id where p.user_id = t.id) x),
    'challenges', (select coalesce(json_agg(c.name), '[]')
      from wc.memberships mb join wc.challenges c on c.id = mb.challenge_id where mb.user_id = t.id));
end $function$;

-- ⑥ب سباق الإقصائيات 🏁 — لوحة موازية تحتسب مباريات الأدوار الإقصائية فقط
-- (بداية جديدة للجميع من صفر — محرك عودة لمن تأخر، واللوحة الرئيسية لا تُمس)
create or replace function public.leaderboard_knockout(p_token uuid, p_challenge_id uuid)
 returns table(rank bigint, username text, points bigint, exact_count bigint, direction_count bigint, played bigint)
 language plpgsql security definer set search_path to 'wc', 'public' as $function$
declare u wc.profiles;
begin
  u := wc._auth(p_token);
  if not exists (select 1 from wc.memberships where user_id = u.id and challenge_id = p_challenge_id)
    then raise exception 'NOT_A_MEMBER'; end if;
  return query
  with scored as (
    select pr.id as uid, pr.display_name as dname,
      coalesce(sum(wc.match_points(p.h, p.a, p.qualified, m.result_h, m.result_a, m.qualified, m.stage) * (case when p.joker then 2 else 1 end)), 0) as pts,
      count(*) filter (where p.h = m.result_h and p.a = m.result_a) as ex,
      count(*) filter (where sign(p.h - p.a) = sign(m.result_h - m.result_a)) as dir,
      (select count(*) from wc.predictions pp join wc.matches mx on mx.id = pp.match_id
        where pp.user_id = pr.id and mx.stage <> 'group') as tot,
      avg(extract(epoch from p.updated_at)) filter (where p.h = m.result_h and p.a = m.result_a) as tb
    from wc.memberships mb
    join wc.profiles pr on pr.id = mb.user_id and not pr.is_banned
    left join wc.predictions p on p.user_id = mb.user_id
    left join wc.matches m on m.id = p.match_id and m.status = 'finished'
         and m.stage <> 'group'                       -- ← الإقصائيات فقط
         and m.kickoff_at >= mb.joined_at
    where mb.challenge_id = p_challenge_id
    group by pr.id, pr.display_name)
  select rank() over (order by s.pts desc, s.tb asc nulls last), s.dname, s.pts, s.ex, s.dir, s.tot
  from scored s order by s.pts desc, s.tb asc nulls last, s.dname;
end $function$;
grant execute on function public.leaderboard_knockout(uuid, uuid) to anon, authenticated;

-- ⑦ البذر التلقائي المبكر لمباريات الإقصائيات (كل 30 دقيقة)
alter table wc.sync_config add column if not exists last_seed_run timestamptz;
alter table wc.sync_config add column if not exists last_seed_status text;

create or replace function wc.seed_knockouts()
returns text language plpgsql security definer set search_path = wc, public, extensions
set statement_timeout = '25s' as $$
declare
  cfg wc.sync_config; resp record; payload jsonb; x jsonb;
  home_code text; away_code text; st text; k timestamptz; iso text; new_id text; m wc.matches;
  n_new int := 0; n_upd int := 0; msg text;
begin
  select * into cfg from wc.sync_config where id;
  if cfg.id is null or not cfg.enabled then return 'disabled'; end if;
  -- الاكتمال يُقاس بالخانات المكتملة الطرفين فقط (خانات الأدمن الفارغة لا تُحتسب)
  if (select count(*) from wc.matches
      where stage in ('r32','r16','qf','sf','tp','f')
        and team_a is not null and team_b is not null) >= 32 then
    update wc.sync_config set last_seed_run = now(), last_seed_status = 'مكتمل' where id;
    return 'complete';
  end if;
  perform http_set_curlopt('CURLOPT_TIMEOUT', '15');
  perform http_set_curlopt('CURLOPT_CONNECTTIMEOUT', '8');
  select status, content into resp from http((
    'GET',
    'https://api.football-data.org/v4/competitions/WC/matches?dateFrom='
      || to_char(now(), 'YYYY-MM-DD') || '&dateTo=' || to_char(now() + interval '21 days', 'YYYY-MM-DD'),
    ARRAY[http_header('X-Auth-Token', cfg.api_token)], null, null)::http_request);
  if resp.status <> 200 then
    update wc.sync_config set last_seed_run = now(), last_seed_status = 'HTTP ' || resp.status where id;
    return 'HTTP ' || resp.status;
  end if;
  payload := resp.content::jsonb;
  for x in select * from jsonb_array_elements(payload->'matches') loop
    st := case x->>'stage'
            when 'LAST_32' then 'r32' when 'LAST_16' then 'r16'
            when 'QUARTER_FINALS' then 'qf' when 'SEMI_FINALS' then 'sf'
            when 'THIRD_PLACE' then 'tp' when 'FINAL' then 'f' else null end;
    if st is null then continue; end if;
    select code into home_code from wc.team_map where fd_tla = x#>>'{homeTeam,tla}';
    select code into away_code from wc.team_map where fd_tla = x#>>'{awayTeam,tla}';
    if home_code is null or away_code is null then continue; end if;
    k := (x->>'utcDate')::timestamptz;
    select * into m from wc.matches where kickoff_at = k
      and ((team_a = home_code and team_b = away_code) or (team_a = away_code and team_b = home_code));
    if m.id is not null then
      if m.status = 'scheduled' and m.stage is distinct from st then
        update wc.matches set stage = st where id = m.id; n_upd := n_upd + 1; end if;
      continue;
    end if;
    -- خانة أدمن فارغة بنفس المرحلة والموعد؟ املأ منتخبيها بدل إنشاء صف مكرر
    -- (يحفظ توقعات مَن توقعوا على الخانة ويمنع انقسام المباراة على صفّين)
    select * into m from wc.matches
    where kickoff_at = k and stage = st and status = 'scheduled'
      and (team_a is null or team_b is null)
    order by id limit 1;
    if m.id is not null then
      update wc.matches set team_a = home_code, team_b = away_code where id = m.id;
      n_upd := n_upd + 1;
      insert into wc.audit_log (admin_id, action, details)
      values (null, 'seed_fill_slot', jsonb_build_object('id', m.id, 'a', home_code, 'b', away_code, 'stage', st));
      continue;
    end if;
    iso := to_char(k at time zone 'Asia/Riyadh', 'YYYY-MM-DD');
    new_id := iso || '_' || home_code || '_' || away_code;
    insert into wc.matches (id, team_a, team_b, kickoff_at, stage, status)
    values (new_id, home_code, away_code, k, st, 'scheduled') on conflict (id) do nothing;
    if found then
      n_new := n_new + 1;
      insert into wc.audit_log (admin_id, action, details)
      values (null, 'seed_knockout', jsonb_build_object('id', new_id, 'a', home_code, 'b', away_code, 'stage', st));
    end if;
  end loop;
  msg := 'seed ok — جديدة ' || n_new || ' · محدّثة ' || n_upd;
  update wc.sync_config set last_seed_run = now(), last_seed_status = msg where id;
  return msg;
exception when others then
  update wc.sync_config set last_seed_run = now(), last_seed_status = 'error: ' || sqlerrm where id;
  return 'error: ' || sqlerrm;
end $$;

do $job$ begin perform cron.unschedule('wc26-seed-knockouts'); exception when others then null; end $job$;
select cron.schedule('wc26-seed-knockouts', '*/30 * * * *', 'select wc.seed_knockouts()');
select wc.seed_knockouts();
