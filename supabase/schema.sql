-- ============================================================
--  تحدي توقعات كأس العالم 2026 — سكيما قاعدة البيانات
--  تُلصق كاملة في Supabase > SQL Editor ثم تُنفّذ، يليها seed.sql
--
--  ⚠️ ملاحظة نشر: هذه النسخة معزولة في سكيما wc لأنها تتعايش مع
--  تطبيق آخر في نفس مشروع Supabase (labbeh-tokyo). الجداول والدوال
--  المساعدة في wc (غير معروضة عبر REST إطلاقًا)، ودوال API فقط في
--  public. لا تستخدم أوامر شاملة على public (revoke/grant on all)
--  حتى لا تكسر التطبيق المجاور.
--
--  مبادئ التصميم:
--  1. لا وصول مباشر للجداول من المتصفح — سكيما wc غير معروضة،
--     وكل العمليات عبر دوال RPC بصلاحية security definer.
--  2. القفل الزمني يُفرض هنا بوقت الخادم (now()) لا بساعة جهاز العضو.
--  3. النقاط ليست بيانات مخزّنة بل دالة محسوبة من (التوقعات + النتائج)
--     — تصحيح أي نتيجة يُحدّث كل اللوحات تلقائيًا.
--  4. الهوية: اسم مستخدم + PIN (بدون إيميل/جوال). الجلسة بتوكن UUID.
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

create schema if not exists wc;

-- ───────────────────────── الجداول ─────────────────────────

create table if not exists wc.profiles (
  id         uuid primary key default gen_random_uuid(),
  username   text unique not null check (char_length(trim(username)) between 2 and 20),
  pin_hash   text not null,
  token      uuid unique not null default gen_random_uuid(),
  is_admin   boolean not null default false,
  is_banned  boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists wc.challenges (
  id          uuid primary key default gen_random_uuid(),
  type        text not null check (type in ('public','private')),
  name        text not null check (char_length(trim(name)) between 2 and 40),
  code        text unique,                 -- كود الانضمام (للخاصة فقط)
  owner_id    uuid references wc.profiles(id) on delete set null,
  scope       text not null default 'all', -- all | group | knockout | team:SA ...
  max_members int,
  join_locked boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists wc.memberships (
  user_id      uuid not null references wc.profiles(id) on delete cascade,
  challenge_id uuid not null references wc.challenges(id) on delete cascade,
  joined_at    timestamptz not null default now(),
  primary key (user_id, challenge_id)
);

create table if not exists wc.matches (
  id         text primary key,            -- مثل: 2026-06-11_MX_ZA
  team_a     text not null,
  team_b     text not null,
  kickoff_at timestamptz not null,
  stage      text not null default 'group',  -- group | r32 | r16 | qf | sf | f
  city       text,
  status     text not null default 'scheduled'
             check (status in ('scheduled','finished','postponed','cancelled')),
  result_h   int,
  result_a   int,
  qualified  text                          -- المتأهل في الإقصائيات (عند الترجيح)
);

create table if not exists wc.predictions (
  user_id    uuid not null references wc.profiles(id) on delete cascade,
  match_id   text not null references wc.matches(id) on delete cascade,
  h          int not null check (h between 0 and 30),
  a          int not null check (a between 0 and 30),
  qualified  text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, match_id)
);

-- سجل تدقيق لتعديلات الأدمن (تصحيح نتائج، حظر... إلخ)
create table if not exists wc.audit_log (
  id         bigint generated always as identity primary key,
  admin_id   uuid references wc.profiles(id),
  action     text not null,
  details    jsonb,
  created_at timestamptz not null default now()
);

-- إقفال كامل: RLS مفعّل بلا سياسات (دفاع إضافي فوق عزل السكيما)
alter table wc.profiles    enable row level security;
alter table wc.challenges  enable row level security;
alter table wc.memberships enable row level security;
alter table wc.matches     enable row level security;
alter table wc.predictions enable row level security;
alter table wc.audit_log   enable row level security;

-- ───────────────── دوال مساعدة (داخل wc — غير معروضة) ─────────────────

-- التحدي العام (معرّف ثابت تنشئه البذرة)
create or replace function wc.public_challenge_id() returns uuid
language sql immutable as $$ select '00000000-0000-0000-0000-000000000001'::uuid $$;

-- لحظة قفل التوقعات: قبل الانطلاق بـ 5 ثوانٍ
create or replace function wc.lock_at(m wc.matches) returns timestamptz
language sql immutable as $$ select m.kickoff_at - interval '5 seconds' $$;

-- التحقق من التوكن وإرجاع الملف الشخصي (يرفض المحظور)
create or replace function wc._auth(p_token uuid) returns wc.profiles
language plpgsql security definer set search_path = wc, public as $$
declare u wc.profiles;
begin
  select * into u from wc.profiles where token = p_token;
  if u.id is null then raise exception 'AUTH_INVALID'; end if;
  if u.is_banned then raise exception 'AUTH_BANNED'; end if;
  return u;
end $$;

create or replace function wc._auth_admin(p_token uuid) returns wc.profiles
language plpgsql security definer set search_path = wc, public as $$
declare u wc.profiles;
begin
  u := wc._auth(p_token);
  if not u.is_admin then raise exception 'AUTH_NOT_ADMIN'; end if;
  return u;
end $$;

-- ─────────────────── احتساب النقاط (5 / 3 / 1) ───────────────────
-- نتيجة دقيقة = 5 · اتجاه + فارق صحيح = 3 · اتجاه فقط = 1
-- مضاعف المرحلة: group/r32/r16 ×1 · qf ×2 · sf/f ×3
-- +2 لتوقع المتأهل الصحيح عند الترجيح (الإقصائيات)
create or replace function wc.match_points(
  ph int, pa int, pq text, rh int, ra int, rq text, stage text
) returns int language sql immutable as $$
  select case when rh is null or ra is null then 0 else
    (case
      when ph = rh and pa = ra then 5
      when sign(ph - pa) = sign(rh - ra) and (ph - pa) = (rh - ra) then 3
      when sign(ph - pa) = sign(rh - ra) then 1
      else 0
    end)
    * (case stage when 'qf' then 2 when 'sf' then 3 when 'f' then 3 else 1 end)
    + (case when stage <> 'group' and pq is not null and pq = rq then 2 else 0 end)
  end
$$;

-- كود من 6 خانات بأبجدية آمنة (بدون O/0 و I/1 المتشابهة)
create or replace function wc._gen_code() returns text language plpgsql as $$
declare chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; code_out text := '';
begin
  for i in 1..6 loop
    code_out := code_out || substr(chars, 1 + floor(random() * length(chars))::int, 1);
  end loop;
  return code_out;
end $$;

-- ───────────────── دوال API (في public — هي الوحيدة المعروضة) ─────────────────

create or replace function public.register_user(p_username text, p_pin text)
returns json language plpgsql security definer set search_path = wc, public, extensions as $$
declare u wc.profiles;
begin
  if p_pin !~ '^[0-9]{4,6}$' then raise exception 'PIN_INVALID'; end if;
  insert into wc.profiles (username, pin_hash)
  values (trim(p_username), crypt(p_pin, gen_salt('bf')))
  returning * into u;
  -- انضمام تلقائي للتحدي العام
  insert into wc.memberships (user_id, challenge_id) values (u.id, wc.public_challenge_id());
  return json_build_object('token', u.token, 'username', u.username, 'is_admin', u.is_admin);
exception when unique_violation then
  raise exception 'USERNAME_TAKEN';
end $$;

create or replace function public.login_user(p_username text, p_pin text)
returns json language plpgsql security definer set search_path = wc, public, extensions as $$
declare u wc.profiles;
begin
  select * into u from wc.profiles
  where lower(username) = lower(trim(p_username))
    and pin_hash = crypt(p_pin, pin_hash);
  if u.id is null then raise exception 'LOGIN_FAILED'; end if;
  if u.is_banned then raise exception 'AUTH_BANNED'; end if;
  return json_build_object('token', u.token, 'username', u.username, 'is_admin', u.is_admin);
end $$;

-- ───────────────────── التوقعات ─────────────────────

-- ⚠️ القفل يُفرض هنا بوقت الخادم — حتى لو عبثت الواجهة أو ساعة الجهاز
create or replace function public.submit_prediction(
  p_token uuid, p_match_id text, p_h int, p_a int, p_qualified text default null
) returns json language plpgsql security definer set search_path = wc, public as $$
declare u wc.profiles; m wc.matches;
begin
  u := wc._auth(p_token);
  select * into m from wc.matches where id = p_match_id;
  if m.id is null then raise exception 'MATCH_NOT_FOUND'; end if;
  if m.status <> 'scheduled' then raise exception 'MATCH_NOT_OPEN'; end if;
  if now() >= wc.lock_at(m) then raise exception 'PREDICTIONS_LOCKED'; end if;

  insert into wc.predictions (user_id, match_id, h, a, qualified)
  values (u.id, p_match_id, p_h, p_a, p_qualified)
  on conflict (user_id, match_id)
  do update set h = excluded.h, a = excluded.a,
                qualified = excluded.qualified, updated_at = now();
  return json_build_object('ok', true, 'locked_at', wc.lock_at(m));
end $$;

-- مبارياتي: حالة كل مباراة + نتيجتها + توقعي + عدد المتوقعين
create or replace function public.get_matches(p_token uuid)
returns table (
  id text, status text, kickoff_at timestamptz, locks_at timestamptz,
  result_h int, result_a int, qualified text,
  my_h int, my_a int, my_qualified text, predictors bigint
) language plpgsql security definer set search_path = wc, public as $$
declare u wc.profiles;
begin
  u := wc._auth(p_token);
  return query
  select m.id, m.status, m.kickoff_at, wc.lock_at(m),
         m.result_h, m.result_a, m.qualified,
         p.h, p.a, p.qualified,
         (select count(*) from wc.predictions x where x.match_id = m.id)
  from wc.matches m
  left join wc.predictions p on p.match_id = m.id and p.user_id = u.id
  order by m.kickoff_at;
end $$;

-- توقعات الأعضاء لمباراة — تنكشف فقط بعد القفل (داخل تحدٍّ مشترك)
create or replace function public.match_predictions(p_token uuid, p_challenge_id uuid, p_match_id text)
returns table (username text, h int, a int, qualified text, points int)
language plpgsql security definer set search_path = wc, public as $$
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
  select pr.username,
         p.h, p.a, p.qualified,
         wc.match_points(p.h, p.a, p.qualified, m.result_h, m.result_a, m.qualified, m.stage)
  from wc.predictions p
  join wc.memberships mb on mb.user_id = p.user_id and mb.challenge_id = p_challenge_id
  join wc.profiles pr on pr.id = p.user_id
  where p.match_id = p_match_id
  order by 5 desc, pr.username;
end $$;

-- ───────────────────── التحديات ─────────────────────

create or replace function public.create_challenge(p_token uuid, p_name text, p_scope text default 'all')
returns json language plpgsql security definer set search_path = wc, public as $$
declare u wc.profiles; c wc.challenges;
begin
  u := wc._auth(p_token);
  loop
    begin
      insert into wc.challenges (type, name, code, owner_id, scope)
      values ('private', trim(p_name), wc._gen_code(), u.id, p_scope)
      returning * into c;
      exit;
    exception when unique_violation then end; -- تصادم كود نادر: أعد المحاولة
  end loop;
  insert into wc.memberships (user_id, challenge_id) values (u.id, c.id);
  return json_build_object('id', c.id, 'name', c.name, 'code', c.code);
end $$;

create or replace function public.join_challenge(p_token uuid, p_code text)
returns json language plpgsql security definer set search_path = wc, public as $$
declare u wc.profiles; c wc.challenges; n int;
begin
  u := wc._auth(p_token);
  select * into c from wc.challenges
  where code = upper(trim(p_code)) and type = 'private';
  if c.id is null then raise exception 'CODE_NOT_FOUND'; end if;
  if c.join_locked then raise exception 'JOIN_LOCKED'; end if;
  if c.max_members is not null then
    select count(*) into n from wc.memberships where challenge_id = c.id;
    if n >= c.max_members then raise exception 'CHALLENGE_FULL'; end if;
  end if;
  insert into wc.memberships (user_id, challenge_id) values (u.id, c.id)
  on conflict do nothing;
  return json_build_object('id', c.id, 'name', c.name);
end $$;

create or replace function public.my_challenges(p_token uuid)
returns table (id uuid, type text, name text, code text, is_owner boolean,
               members bigint, joined_at timestamptz)
language plpgsql security definer set search_path = wc, public as $$
declare u wc.profiles;
begin
  u := wc._auth(p_token);
  return query
  select c.id, c.type, c.name,
         case when c.owner_id = u.id then c.code else null end, -- الكود يظهر للمنشئ فقط؛ غيره يشاركه شفهيًا
         c.owner_id = u.id,
         (select count(*) from wc.memberships x where x.challenge_id = c.id),
         mb.joined_at
  from wc.memberships mb
  join wc.challenges c on c.id = mb.challenge_id
  where mb.user_id = u.id
  order by (c.type = 'public') desc, mb.joined_at;
end $$;

-- ─────────────────── لوحة الصدارة (محسوبة دائمًا) ───────────────────
-- العضو المنضم متأخرًا تُحسب له فقط المباريات التي انطلقت بعد انضمامه
create or replace function public.leaderboard(p_token uuid, p_challenge_id uuid)
returns table (username text, points bigint, exact_count bigint,
               direction_count bigint, played bigint)
language plpgsql security definer set search_path = wc, public as $$
declare u wc.profiles;
begin
  u := wc._auth(p_token);
  if not exists (select 1 from wc.memberships
                 where user_id = u.id and challenge_id = p_challenge_id)
    then raise exception 'NOT_A_MEMBER'; end if;

  return query
  select pr.username,
    coalesce(sum(wc.match_points(p.h, p.a, p.qualified, m.result_h, m.result_a, m.qualified, m.stage)), 0),
    count(*) filter (where p.h = m.result_h and p.a = m.result_a),
    count(*) filter (where sign(p.h - p.a) = sign(m.result_h - m.result_a)),
    count(p.match_id)
  from wc.memberships mb
  join wc.profiles pr on pr.id = mb.user_id and not pr.is_banned
  left join wc.predictions p on p.user_id = mb.user_id
  left join wc.matches m on m.id = p.match_id
       and m.status = 'finished'
       and m.kickoff_at >= mb.joined_at   -- عدالة الانضمام المتأخر
  where mb.challenge_id = p_challenge_id
  group by pr.username
  order by 2 desc, 3 desc, 4 desc, pr.username;
end $$;

-- ───────────────────── لوحة الأدمن ─────────────────────

-- إدخال أو تصحيح نتيجة — اللوحات تتحدث تلقائيًا لأن النقاط محسوبة
create or replace function public.admin_set_result(
  p_token uuid, p_match_id text, p_h int, p_a int, p_qualified text default null
) returns json language plpgsql security definer set search_path = wc, public as $$
declare u wc.profiles;
begin
  u := wc._auth_admin(p_token);
  update wc.matches set result_h = p_h, result_a = p_a,
                     qualified = p_qualified, status = 'finished'
  where id = p_match_id;
  insert into wc.audit_log (admin_id, action, details)
  values (u.id, 'set_result',
          json_build_object('match', p_match_id, 'h', p_h, 'a', p_a));
  return json_build_object('ok', true);
end $$;

-- تأجيل مباراة: تعديل وقتها (التوقعات تبقى وتُفتح للتعديل تلقائيًا)
create or replace function public.admin_reschedule(p_token uuid, p_match_id text, p_kickoff timestamptz)
returns json language plpgsql security definer set search_path = wc, public as $$
declare u wc.profiles;
begin
  u := wc._auth_admin(p_token);
  update wc.matches set kickoff_at = p_kickoff, status = 'scheduled' where id = p_match_id;
  insert into wc.audit_log (admin_id, action, details)
  values (u.id, 'reschedule', json_build_object('match', p_match_id, 'kickoff', p_kickoff));
  return json_build_object('ok', true);
end $$;

-- إحصاءات مباراة: عدد المتوقعين + توزيع التوقعات + كشف المشبوه (قرب القفل)
create or replace function public.admin_match_stats(p_token uuid, p_match_id text)
returns json language plpgsql security definer set search_path = wc, public as $$
declare u wc.profiles; m wc.matches; total bigint; dist json; suspicious json;
begin
  u := wc._auth_admin(p_token);
  select * into m from wc.matches where id = p_match_id;
  select count(*) into total from wc.predictions where match_id = p_match_id;
  select coalesce(json_agg(t), '[]') into dist from (
    select h, a, count(*) as n from wc.predictions
    where match_id = p_match_id group by h, a order by n desc limit 10) t;
  select coalesce(json_agg(t), '[]') into suspicious from (
    select pr.username, p.updated_at from wc.predictions p
    join wc.profiles pr on pr.id = p.user_id
    where p.match_id = p_match_id
      and p.updated_at > wc.lock_at(m) - interval '60 seconds') t;
  return json_build_object('total', total, 'distribution', dist,
                           'last_minute', suspicious);
end $$;

create or replace function public.admin_overview(p_token uuid)
returns json language plpgsql security definer set search_path = wc, public as $$
declare u wc.profiles;
begin
  u := wc._auth_admin(p_token);
  return json_build_object(
    'users',       (select count(*) from wc.profiles),
    'challenges',  (select count(*) from wc.challenges where type = 'private'),
    'predictions', (select count(*) from wc.predictions),
    'finished',    (select count(*) from wc.matches where status = 'finished')
  );
end $$;

create or replace function public.admin_reset_pin(p_token uuid, p_username text, p_new_pin text)
returns json language plpgsql security definer set search_path = wc, public, extensions as $$
declare u wc.profiles;
begin
  u := wc._auth_admin(p_token);
  if p_new_pin !~ '^[0-9]{4,6}$' then raise exception 'PIN_INVALID'; end if;
  update wc.profiles
  set pin_hash = crypt(p_new_pin, gen_salt('bf')), token = gen_random_uuid()
  where lower(username) = lower(p_username);
  insert into wc.audit_log (admin_id, action, details)
  values (u.id, 'reset_pin', json_build_object('user', p_username));
  return json_build_object('ok', true);
end $$;

create or replace function public.admin_ban_user(p_token uuid, p_username text, p_banned boolean)
returns json language plpgsql security definer set search_path = wc, public as $$
declare u wc.profiles;
begin
  u := wc._auth_admin(p_token);
  update wc.profiles set is_banned = p_banned where lower(username) = lower(p_username);
  insert into wc.audit_log (admin_id, action, details)
  values (u.id, case when p_banned then 'ban' else 'unban' end,
          json_build_object('user', p_username));
  return json_build_object('ok', true);
end $$;

-- ───────────────────── الصلاحيات ─────────────────────
-- سكيما wc مقفلة بالكامل (لا usage لـ anon) — الوصول فقط عبر دوال API أعلاه
-- ⚠️ لا تستخدم revoke/grant شاملة على public — تطبيق آخر يشارك المشروع
revoke all on all tables in schema wc from anon, authenticated;
revoke execute on all functions in schema wc from anon, authenticated, public;
revoke usage on schema wc from anon, authenticated, public;

grant execute on function
  public.register_user(text, text),
  public.login_user(text, text),
  public.submit_prediction(uuid, text, int, int, text),
  public.get_matches(uuid),
  public.match_predictions(uuid, uuid, text),
  public.create_challenge(uuid, text, text),
  public.join_challenge(uuid, text),
  public.my_challenges(uuid),
  public.leaderboard(uuid, uuid),
  public.admin_set_result(uuid, text, int, int, text),
  public.admin_reschedule(uuid, text, timestamptz),
  public.admin_match_stats(uuid, text),
  public.admin_overview(uuid),
  public.admin_reset_pin(uuid, text, text),
  public.admin_ban_user(uuid, text, boolean)
to anon, authenticated;
