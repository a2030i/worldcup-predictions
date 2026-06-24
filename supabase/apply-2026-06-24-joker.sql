-- ════════════════════════════════════════════════════════════════════════
-- تحديث 2026-06-24 — الجوكر 🃏 (مضاعفة نقاط مباراة واحدة كل يوم).
-- شغّل هذا الملف وحده في Supabase SQL Editor. آمن وقابل لإعادة التشغيل.
-- القاعدة: جوكر واحد لكل يوم (تقويم مكة)، يُختار قبل قفل المباراة، يضاعف
-- نقاط التوقع الصحيح فيها فقط. الدوال أدناه نسخ مطابقة لدوالك الحية مع
-- إضافة المضاعفة: * (case when p.joker then 2 else 1 end)
-- ════════════════════════════════════════════════════════════════════════

-- ① عمود الجوكر على التوقعات
alter table wc.predictions add column if not exists joker boolean not null default false;

-- ② اختيار/إلغاء الجوكر — جوكر واحد لكل يوم، قبل القفل فقط
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
    -- جوكر مستخدَم اليوم على مباراة أُقفلت بالفعل؟ لا يمكن نقله (استُهلك)
    if exists (
      select 1 from wc.predictions pp join wc.matches mm on mm.id = pp.match_id
      where pp.user_id = u.id and pp.joker and pp.match_id <> p_match_id
        and (mm.kickoff_at at time zone 'Asia/Riyadh')::date = d
        and now() >= wc.lock_at(mm)
    ) then raise exception 'JOKER_USED'; end if;
    -- أزل أي جوكر على مباريات اليوم لم تُقفل بعد، ثم ثبّته هنا
    update wc.predictions pp set joker = false
      from wc.matches mm
      where pp.user_id = u.id and pp.match_id = mm.id and pp.joker
        and (mm.kickoff_at at time zone 'Asia/Riyadh')::date = d;
    update wc.predictions set joker = true where user_id = u.id and match_id = p_match_id;
  else
    update wc.predictions set joker = false where user_id = u.id and match_id = p_match_id;
  end if;
  return json_build_object('ok', true);
end $$;
grant execute on function public.set_joker(uuid, text, boolean) to anon, authenticated;

-- ③ get_matches يُرجع أيضًا حالة جوكر توقعي (my_joker)
drop function if exists public.get_matches(uuid);
create or replace function public.get_matches(p_token uuid)
returns table (
  id text, status text, stage text, kickoff_at timestamptz, locks_at timestamptz,
  result_h int, result_a int, qualified text,
  my_h int, my_a int, my_qualified text, predictors bigint, server_now timestamptz,
  live_h int, live_a int, team_a text, team_b text, my_joker boolean
) language plpgsql security definer set search_path = wc, public as $$
declare u wc.profiles;
begin
  u := wc._auth(p_token);
  return query
  select m.id, m.status, m.stage, m.kickoff_at, wc.lock_at(m),
         m.result_h, m.result_a, m.qualified,
         p.h, p.a, p.qualified,
         (select count(*) from wc.predictions x where x.match_id = m.id),
         now(), m.live_h, m.live_a, m.team_a, m.team_b, coalesce(p.joker, false)
  from wc.matches m
  left join wc.predictions p on p.match_id = m.id and p.user_id = u.id
  order by m.kickoff_at;
end $$;
grant execute on function public.get_matches(uuid) to anon, authenticated;

-- ════════ مضاعفة الجوكر في كل دوال احتساب النقاط (نسخ مطابقة لدوالك + المضاعفة) ════════

CREATE OR REPLACE FUNCTION public.leaderboard(p_token uuid, p_challenge_id uuid)
 RETURNS TABLE(rank bigint, username text, points bigint, exact_count bigint, direction_count bigint, played bigint)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'wc', 'public'
AS $function$
declare u wc.profiles;
begin
  u := wc._auth(p_token);
  if not exists (select 1 from wc.memberships
                 where user_id = u.id and challenge_id = p_challenge_id)
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
    left join wc.matches m on m.id = p.match_id
         and m.status = 'finished'
         and m.kickoff_at >= mb.joined_at
    where mb.challenge_id = p_challenge_id
    group by pr.id, pr.display_name
  )
  select rank() over (order by s.pts desc, s.tb asc nulls last),
         s.dname, s.pts, s.ex, s.dir, s.tot
  from scored s
  order by s.pts desc, s.tb asc nulls last, s.dname;
end $function$;

CREATE OR REPLACE FUNCTION public.my_ranks(p_token uuid)
 RETURNS TABLE(challenge_id uuid, my_rank bigint, members bigint, my_points bigint)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'wc', 'public'
AS $function$
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
    left join wc.matches m on m.id = p.match_id
         and m.status = 'finished'
         and m.kickoff_at >= mb.joined_at
    group by mb.challenge_id, mb.user_id
  ), ranked as (
    select cid, uid, pts,
      rank() over (partition by cid order by pts desc, tb asc nulls last) as rnk,
      count(*) over (partition by cid) as total
    from scored
  )
  select r.cid, r.rnk, r.total, r.pts from ranked r where r.uid = u.id;
end $function$;

CREATE OR REPLACE FUNCTION public.match_predictions(p_token uuid, p_challenge_id uuid, p_match_id text)
 RETURNS TABLE(username text, h integer, a integer, qualified text, points integer, predicted_at timestamp with time zone)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'wc', 'public'
AS $function$
declare u wc.profiles; m wc.matches;
begin
  u := wc._auth(p_token);
  select * into m from wc.matches where id = p_match_id;
  if m.id is null then raise exception 'MATCH_NOT_FOUND'; end if;
  if now() < wc.lock_at(m) then raise exception 'STILL_OPEN'; end if;
  if not exists (select 1 from wc.memberships
                 where user_id = u.id and challenge_id = p_challenge_id)
    then raise exception 'NOT_A_MEMBER'; end if;

  return query
  select pr.display_name,
         p.h, p.a, p.qualified,
         wc.match_points(p.h, p.a, p.qualified, m.result_h, m.result_a, m.qualified, m.stage) * (case when p.joker then 2 else 1 end),
         p.updated_at
  from wc.predictions p
  join wc.memberships mb on mb.user_id = p.user_id and mb.challenge_id = p_challenge_id
  join wc.profiles pr on pr.id = p.user_id
  where p.match_id = p_match_id
  order by 5 desc, p.updated_at asc, pr.display_name;
end $function$;

CREATE OR REPLACE FUNCTION public.day_stars(p_token uuid, p_date date DEFAULT NULL::date)
 RETURNS json
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'wc', 'public'
AS $function$
declare u wc.profiles; d date;
begin
  u := wc._auth(p_token);
  d := coalesce(p_date, (select max((kickoff_at at time zone 'Asia/Riyadh')::date)
                         from wc.matches where status = 'finished'));
  if d is null then return json_build_object('date', null, 'stars', '[]'::json); end if;
  return json_build_object('date', d, 'stars', (
    select coalesce(json_agg(x), '[]') from (
      select pr.display_name,
        sum(wc.match_points(p.h, p.a, p.qualified, m.result_h, m.result_a, m.qualified, m.stage) * (case when p.joker then 2 else 1 end)) as points,
        count(*) filter (where p.h = m.result_h and p.a = m.result_a) as exact_count
      from wc.predictions p
      join wc.matches m on m.id = p.match_id and m.status = 'finished'
        and (m.kickoff_at at time zone 'Asia/Riyadh')::date = d
      join wc.profiles pr on pr.id = p.user_id and not pr.is_banned
      group by pr.id, pr.display_name
      having sum(wc.match_points(p.h, p.a, p.qualified, m.result_h, m.result_a, m.qualified, m.stage) * (case when p.joker then 2 else 1 end)) > 0
      order by 2 desc,
        avg(extract(epoch from p.updated_at)) filter (where p.h = m.result_h and p.a = m.result_a) asc nulls last
      limit 10) x));
end $function$;

CREATE OR REPLACE FUNCTION public.admin_challenge_board(p_token uuid, p_challenge_id uuid)
 RETURNS json
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'wc', 'public'
AS $function$
declare u wc.profiles; c wc.challenges;
begin
  u := wc._auth_admin(p_token);
  select * into c from wc.challenges where id = p_challenge_id;
  if c.id is null then raise exception 'CHALLENGE_NOT_FOUND'; end if;
  return json_build_object(
    'name', c.name, 'type', c.type, 'code', c.code, 'join_locked', c.join_locked,
    'owner', (select pr.display_name || ' (' || pr.username || ')' from wc.profiles pr where pr.id = c.owner_id),
    'created_at', c.created_at,
    'board', (select coalesce(json_agg(y), '[]') from (
      select rank() over (order by x.points desc, x.tb asc nulls last) as rank,
             x.display_name, x.username, x.phone, x.joined_at,
             x.points, x.exact_count, x.total_predictions
      from (
        select pr.display_name, pr.username, pr.phone, mb.joined_at,
          coalesce(sum(wc.match_points(p.h, p.a, p.qualified, m.result_h, m.result_a, m.qualified, m.stage) * (case when p.joker then 2 else 1 end)), 0) as points,
          count(*) filter (where p.h = m.result_h and p.a = m.result_a) as exact_count,
          (select count(*) from wc.predictions pp where pp.user_id = pr.id) as total_predictions,
          avg(extract(epoch from p.updated_at)) filter (where p.h = m.result_h and p.a = m.result_a) as tb
        from wc.memberships mb
        join wc.profiles pr on pr.id = mb.user_id and not pr.is_banned
        left join wc.predictions p on p.user_id = mb.user_id
        left join wc.matches m on m.id = p.match_id
             and m.status = 'finished'
             and m.kickoff_at >= mb.joined_at
        where mb.challenge_id = c.id
        group by pr.id, pr.display_name, pr.username, pr.phone, mb.joined_at
      ) x
      order by x.points desc, x.tb asc nulls last, x.display_name) y)
  );
end $function$;

CREATE OR REPLACE FUNCTION public.admin_list_users(p_token uuid, p_query text DEFAULT NULL::text)
 RETURNS TABLE(username text, display_name text, phone text, is_admin boolean, is_banned boolean, created_at timestamp with time zone, predictions bigint, points bigint)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'wc', 'public'
AS $function$
declare u wc.profiles;
begin
  u := wc._auth_admin(p_token);
  return query
  select pr.username, pr.display_name, pr.phone, pr.is_admin, pr.is_banned, pr.created_at,
    (select count(*) from wc.predictions p where p.user_id = pr.id),
    coalesce((select sum(wc.match_points(p.h, p.a, p.qualified, m.result_h, m.result_a, m.qualified, m.stage) * (case when p.joker then 2 else 1 end))
       from wc.predictions p join wc.matches m on m.id = p.match_id and m.status = 'finished'
       where p.user_id = pr.id), 0)
  from wc.profiles pr
  where p_query is null or p_query = ''
     or pr.username ilike '%' || p_query || '%'
     or pr.display_name ilike '%' || p_query || '%'
     or coalesce(pr.phone, '') like '%' || p_query || '%'
  order by pr.created_at desc;
end $function$;

CREATE OR REPLACE FUNCTION public.admin_match_winners(p_token uuid, p_match_id text)
 RETURNS json
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'wc', 'public'
AS $function$
declare u wc.profiles; m wc.matches;
begin
  u := wc._auth_admin(p_token);
  select * into m from wc.matches where id = p_match_id;
  if m.id is null then raise exception 'MATCH_NOT_FOUND'; end if;
  return json_build_object(
    'match_id', m.id, 'status', m.status,
    'result_h', m.result_h, 'result_a', m.result_a, 'stage', m.stage,
    'total_predictors', (select count(*) from wc.predictions p where p.match_id = m.id),
    'winners', case when m.status <> 'finished' then '[]'::json else
      (select coalesce(json_agg(x), '[]') from (
        select pr.display_name, pr.username, pr.phone, p.updated_at as predicted_at,
               wc.match_points(p.h, p.a, p.qualified, m.result_h, m.result_a, m.qualified, m.stage) * (case when p.joker then 2 else 1 end) as points
        from wc.predictions p
        join wc.profiles pr on pr.id = p.user_id and not pr.is_banned
        where p.match_id = m.id
          and p.h = m.result_h and p.a = m.result_a
        order by p.updated_at asc) x)
    end
  );
end $function$;

CREATE OR REPLACE FUNCTION public.admin_user_detail(p_token uuid, p_username text)
 RETURNS json
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'wc', 'public'
AS $function$
declare u wc.profiles; t wc.profiles;
begin
  u := wc._auth_admin(p_token);
  select * into t from wc.profiles where lower(username) = lower(trim(p_username));
  if t.id is null then raise exception 'USER_NOT_FOUND'; end if;
  return json_build_object(
    'username', t.username, 'display_name', t.display_name, 'phone', t.phone,
    'is_admin', t.is_admin, 'is_banned', t.is_banned, 'created_at', t.created_at,
    'predictions', (select coalesce(json_agg(x order by x.kickoff_at), '[]') from (
      select p.match_id, p.h, p.a, p.created_at, p.updated_at, m.kickoff_at,
             (p.updated_at > wc.lock_at(m) - interval '60 seconds') as last_minute,
             wc.match_points(p.h, p.a, p.qualified, m.result_h, m.result_a, m.qualified, m.stage) * (case when p.joker then 2 else 1 end) as points
      from wc.predictions p join wc.matches m on m.id = p.match_id
      where p.user_id = t.id) x),
    'challenges', (select coalesce(json_agg(c.name), '[]')
      from wc.memberships mb join wc.challenges c on c.id = mb.challenge_id
      where mb.user_id = t.id)
  );
end $function$;
