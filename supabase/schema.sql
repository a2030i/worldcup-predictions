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
--  4. الهوية: اسم دخول لاتيني فريد + اسم عرض (يجوز تكراره) + جوال
--     سعودي فريد + PIN. الجلسة بتوكن UUID.
--  5. الدخول محمي من القوة الغاشمة: 5 إخفاقات/15 دقيقة = قفل مؤقت.
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

create schema if not exists wc;

-- ───────────────────────── الجداول ─────────────────────────

create table if not exists wc.profiles (
  id           uuid primary key default gen_random_uuid(),
  username     text unique not null check (char_length(trim(username)) between 2 and 20), -- اسم الدخول (لاتيني/أرقام — يُفرض في register_user)
  display_name text,                                  -- الاسم الظاهر في اللوحات (يجوز تكراره)
  phone        text,                                  -- 05xxxxxxxx فريد — للتواصل عند الجوائز
  pin_hash     text not null,
  token        uuid unique not null default gen_random_uuid(),
  is_admin     boolean not null default false,
  is_banned    boolean not null default false,
  created_at   timestamptz not null default now()
);

-- ترقية القواعد القائمة + قيود الهوية (آمنة لإعادة التنفيذ)
alter table wc.profiles add column if not exists display_name text;
alter table wc.profiles add column if not exists phone text;
update wc.profiles set display_name = username where display_name is null;
alter table wc.profiles alter column display_name set not null;
do $$ begin
  alter table wc.profiles add constraint profiles_display_name_len
    check (char_length(trim(display_name)) between 2 and 20);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table wc.profiles add constraint profiles_phone_format
    check (phone is null or phone ~ '^05[0-9]{8}$');
exception when duplicate_object then null; end $$;
create unique index if not exists profiles_username_lower_unique on wc.profiles (lower(trim(username)));
create unique index if not exists profiles_phone_unique on wc.profiles (phone) where phone is not null;
-- قرار منتج: اسم العرض يجوز تكراره — اسم الدخول والجوال وحدهما الفريدان
drop index if exists wc.profiles_display_name_unique;
-- اسم الدخول لاتيني/أرقام/شرطة سفلية فقط — قيد جدول لا يُتجاوز من أي مسار
do $$ begin
  alter table wc.profiles add constraint profiles_username_format
    check (username ~ '^[A-Za-z0-9_]{3,20}$');
exception when duplicate_object then null; end $$;

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

-- محاولات الدخول — كبح القوة الغاشمة على PIN
create table if not exists wc.login_attempts (
  username     text not null,
  attempted_at timestamptz not null default now(),
  success      boolean not null
);
create index if not exists login_attempts_user_time on wc.login_attempts (username, attempted_at desc);

-- إقفال كامل: RLS مفعّل بلا سياسات (دفاع إضافي فوق عزل السكيما)
alter table wc.profiles       enable row level security;
alter table wc.challenges     enable row level security;
alter table wc.memberships    enable row level security;
alter table wc.matches        enable row level security;
alter table wc.predictions    enable row level security;
alter table wc.audit_log      enable row level security;
alter table wc.login_attempts enable row level security;

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

-- ─────────────────── احتساب النقاط (قرار المالك 2026-06-12) ───────────────────
-- التوقع الصحيح = النتيجة بالضبط، ويأخذ نقاط مرحلته كاملة:
-- مجموعات 2 · دور32 4 · دور16 6 · ربع 8 · نصف 10 · المركز الثالث 10 · النهائي 20
-- (عمود qualified خارج الاحتساب حاليًا)
create or replace function wc.match_points(
  ph int, pa int, pq text, rh int, ra int, rq text, stage text
) returns int language sql immutable as $$
  select case
    when rh is null or ra is null then 0
    when ph = rh and pa = ra then
      case stage when 'group' then 2 when 'r32' then 4 when 'r16' then 6
                 when 'qf' then 8 when 'sf' then 10 when 'tp' then 10
                 when 'f' then 20 else 2 end
    else 0
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

-- التسجيل: اسم دخول لاتيني + اسم عرض (مطبَّع NFKC بلا محارف خفية) + جوال + PIN
drop function if exists public.register_user(text, text);

create or replace function public.register_user(
  p_username text, p_pin text, p_display_name text, p_phone text
) returns json language plpgsql security definer set search_path = wc, public, extensions as $$
declare u wc.profiles; dname text;
begin
  if trim(p_username) !~ '^[A-Za-z0-9_]{3,20}$' then raise exception 'USERNAME_INVALID'; end if;
  if p_pin !~ '^[0-9]{4,6}$' then raise exception 'PIN_INVALID'; end if;
  dname := regexp_replace(normalize(trim(coalesce(p_display_name,'')), nfkc),
                          '[​-‏‪-‮﻿]', '', 'g');
  if char_length(dname) not between 2 and 20 then raise exception 'DISPLAY_INVALID'; end if;
  if p_phone !~ '^05[0-9]{8}$' then raise exception 'PHONE_INVALID'; end if;

  if exists (select 1 from wc.profiles where lower(trim(username)) = lower(trim(p_username))) then
    raise exception 'USERNAME_TAKEN'; end if;
  if exists (select 1 from wc.profiles where phone = p_phone) then
    raise exception 'PHONE_TAKEN'; end if;

  insert into wc.profiles (username, pin_hash, display_name, phone)
  values (trim(p_username), crypt(p_pin, gen_salt('bf', 10)), dname, p_phone)
  returning * into u;
  -- انضمام تلقائي للتحدي العام
  insert into wc.memberships (user_id, challenge_id) values (u.id, wc.public_challenge_id());
  return json_build_object('token', u.token, 'username', u.username,
                           'display_name', u.display_name, 'is_admin', u.is_admin);
exception when unique_violation then
  raise exception 'USERNAME_TAKEN';
end $$;

-- الدخول — مع كبح القوة الغاشمة: 5 إخفاقات خلال 15 دقيقة = LOGIN_THROTTLED
create or replace function public.login_user(p_username text, p_pin text)
returns json language plpgsql security definer set search_path = wc, public, extensions as $$
declare u wc.profiles; uname text; fails int;
begin
  uname := lower(trim(p_username));
  delete from wc.login_attempts where attempted_at < now() - interval '1 day';

  select count(*) into fails from wc.login_attempts
  where username = uname and not success and attempted_at > now() - interval '15 minutes';
  if fails >= 5 then raise exception 'LOGIN_THROTTLED'; end if;

  select * into u from wc.profiles
  where lower(username) = uname and pin_hash = crypt(p_pin, pin_hash);

  insert into wc.login_attempts (username, success) values (uname, u.id is not null);

  if u.id is null then raise exception 'LOGIN_FAILED'; end if;
  if u.is_banned then raise exception 'AUTH_BANNED'; end if;
  return json_build_object('token', u.token, 'username', u.username,
                           'display_name', u.display_name, 'is_admin', u.is_admin);
end $$;

-- تغيير الرمز ذاتيًا + تدوير التوكن (يُخرج بقية الأجهزة)
create or replace function public.change_pin(p_token uuid, p_old_pin text, p_new_pin text)
returns json language plpgsql security definer set search_path = wc, public, extensions as $$
declare u wc.profiles; newtok uuid;
begin
  u := wc._auth(p_token);
  if p_new_pin !~ '^[0-9]{4,6}$' then raise exception 'PIN_INVALID'; end if;
  if u.pin_hash <> crypt(p_old_pin, u.pin_hash) then raise exception 'LOGIN_FAILED'; end if;
  newtok := gen_random_uuid();
  update wc.profiles set pin_hash = crypt(p_new_pin, gen_salt('bf', 10)), token = newtok
  where id = u.id;
  return json_build_object('token', newtok, 'username', u.username,
                           'display_name', u.display_name, 'is_admin', u.is_admin);
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
-- server_now: لمزامنة عدّادات الواجهة بساعة الخادم (تغيير ساعة الجهاز لا يؤثر)
-- live_h/live_a: النتيجة اللحظية أثناء اللعب (من المزامنة التلقائية)
drop function if exists public.get_matches(uuid);
create or replace function public.get_matches(p_token uuid)
returns table (
  id text, status text, stage text, kickoff_at timestamptz, locks_at timestamptz,
  result_h int, result_a int, qualified text,
  my_h int, my_a int, my_qualified text, predictors bigint, server_now timestamptz,
  live_h int, live_a int
) language plpgsql security definer set search_path = wc, public as $$
declare u wc.profiles;
begin
  u := wc._auth(p_token);
  return query
  select m.id, m.status, m.stage, m.kickoff_at, wc.lock_at(m),
         m.result_h, m.result_a, m.qualified,
         p.h, p.a, p.qualified,
         (select count(*) from wc.predictions x where x.match_id = m.id),
         now(), m.live_h, m.live_a
  from wc.matches m
  left join wc.predictions p on p.match_id = m.id and p.user_id = u.id
  order by m.kickoff_at;
end $$;

-- توقعات الأعضاء لمباراة — تنكشف فقط بعد القفل + وقت كل توقع (للمصداقية)
drop function if exists public.match_predictions(uuid, uuid, text);
create or replace function public.match_predictions(p_token uuid, p_challenge_id uuid, p_match_id text)
returns table (username text, h int, a int, qualified text, points int, predicted_at timestamptz)
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
  select pr.display_name,  -- مفتاح JSON يبقى username لتوافق الواجهة
         p.h, p.a, p.qualified,
         wc.match_points(p.h, p.a, p.qualified, m.result_h, m.result_a, m.qualified, m.stage),
         p.updated_at
  from wc.predictions p
  join wc.memberships mb on mb.user_id = p.user_id and mb.challenge_id = p_challenge_id
  join wc.profiles pr on pr.id = p.user_id
  where p.match_id = p_match_id
  order by 5 desc, p.updated_at asc, pr.display_name;
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
-- المنضم متأخرًا تُحسب له فقط المباريات التي انطلقت بعد انضمامه
-- التجميع بمعرّف العضو (اسم العرض يجوز تكراره) · «لعب» = المباريات المنتهية المحسوبة فقط
-- كسر التعادل: متوسط أوقات التوقعات الصحيحة — الأسبق أولًا
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
  select pr.display_name,
    coalesce(sum(wc.match_points(p.h, p.a, p.qualified, m.result_h, m.result_a, m.qualified, m.stage)), 0),
    count(*) filter (where p.h = m.result_h and p.a = m.result_a),
    count(*) filter (where sign(p.h - p.a) = sign(m.result_h - m.result_a)),
    (select count(*) from wc.predictions pp where pp.user_id = pr.id)  -- إجمالي توقعاته (عمود «توقعاته» في الواجهة)
  from wc.memberships mb
  join wc.profiles pr on pr.id = mb.user_id and not pr.is_banned
  left join wc.predictions p on p.user_id = mb.user_id
  left join wc.matches m on m.id = p.match_id
       and m.status = 'finished'
       and m.kickoff_at >= mb.joined_at
  where mb.challenge_id = p_challenge_id
  group by pr.id, pr.display_name
  order by 2 desc,
           avg(extract(epoch from p.updated_at)) filter (where p.h = m.result_h and p.a = m.result_a) asc nulls last,
           pr.display_name;
end $$;

-- ترتيبي في كل تحدياتي بنظرة واحدة (نفس منطق اللوحة وكسر تعادلها)
create or replace function public.my_ranks(p_token uuid)
returns table (challenge_id uuid, my_rank bigint, members bigint, my_points bigint)
language plpgsql security definer set search_path = wc, public as $$
declare u wc.profiles;
begin
  u := wc._auth(p_token);
  return query
  with scored as (
    select mb.challenge_id as cid, mb.user_id as uid,
      coalesce(sum(wc.match_points(p.h, p.a, p.qualified, m.result_h, m.result_a, m.qualified, m.stage)), 0) as pts,
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
end $$;

-- ───────────────────── لوحة الأدمن: المباريات ─────────────────────

-- اعتماد/تصحيح نتيجة — بحواجز: المباراة موجودة وبدأت، والمتأهل أحد طرفيها
create or replace function public.admin_set_result(
  p_token uuid, p_match_id text, p_h int, p_a int, p_qualified text default null
) returns json language plpgsql security definer set search_path = wc, public as $$
declare u wc.profiles; m wc.matches;
begin
  u := wc._auth_admin(p_token);
  select * into m from wc.matches where id = p_match_id;
  if m.id is null then raise exception 'MATCH_NOT_FOUND'; end if;
  if m.kickoff_at > now() then raise exception 'MATCH_NOT_STARTED'; end if;
  if p_h not between 0 and 30 or p_a not between 0 and 30 then raise exception 'RESULT_INVALID'; end if;
  if p_qualified is not null and p_qualified not in (m.team_a, m.team_b) then
    raise exception 'QUALIFIED_INVALID'; end if;
  update wc.matches set result_h = p_h, result_a = p_a,
                     qualified = p_qualified, status = 'finished'
  where id = p_match_id;
  insert into wc.audit_log (admin_id, action, details)
  values (u.id, 'set_result',
          json_build_object('match', p_match_id, 'h', p_h, 'a', p_a, 'qualified', p_qualified));
  return json_build_object('ok', true);
end $$;

-- تأجيل مباراة: يعيد فتح التوقعات ويصفّر أي نتيجة مخزنة (لا حالة هجينة)
create or replace function public.admin_reschedule(p_token uuid, p_match_id text, p_kickoff timestamptz)
returns json language plpgsql security definer set search_path = wc, public as $$
declare u wc.profiles;
begin
  u := wc._auth_admin(p_token);
  update wc.matches set kickoff_at = p_kickoff, status = 'scheduled',
                        result_h = null, result_a = null, qualified = null
  where id = p_match_id;
  if not found then raise exception 'MATCH_NOT_FOUND'; end if;
  insert into wc.audit_log (admin_id, action, details)
  values (u.id, 'reschedule', json_build_object('match', p_match_id, 'kickoff', p_kickoff));
  return json_build_object('ok', true);
end $$;

-- إلغاء مباراة (تُستبعد نقاطها تلقائيًا لأن اللوحات تحسب المنتهية فقط)
create or replace function public.admin_cancel_match(p_token uuid, p_match_id text)
returns json language plpgsql security definer set search_path = wc, public as $$
declare u wc.profiles;
begin
  u := wc._auth_admin(p_token);
  update wc.matches set status = 'cancelled' where id = p_match_id;
  if not found then raise exception 'MATCH_NOT_FOUND'; end if;
  insert into wc.audit_log (admin_id, action, details)
  values (u.id, 'cancel_match', json_build_object('match', p_match_id));
  return json_build_object('ok', true);
end $$;

-- إحصاءات مباراة — التوزيع لا يظهر قبل القفل حتى للأدمن (أدمن-لاعب)
create or replace function public.admin_match_stats(p_token uuid, p_match_id text)
returns json language plpgsql security definer set search_path = wc, public as $$
declare u wc.profiles; m wc.matches; total bigint; dist json; suspicious json; is_locked boolean;
begin
  u := wc._auth_admin(p_token);
  select * into m from wc.matches where id = p_match_id;
  if m.id is null then raise exception 'MATCH_NOT_FOUND'; end if;
  is_locked := now() >= wc.lock_at(m);
  select count(*) into total from wc.predictions where match_id = p_match_id;
  if is_locked then
    select coalesce(json_agg(t), '[]') into dist from (
      select h, a, count(*) as n from wc.predictions
      where match_id = p_match_id group by h, a order by n desc limit 10) t;
    select coalesce(json_agg(t), '[]') into suspicious from (
      select pr.display_name || ' (' || pr.username || ')' as username, p.updated_at
      from wc.predictions p
      join wc.profiles pr on pr.id = p.user_id
      where p.match_id = p_match_id
        and p.updated_at > wc.lock_at(m) - interval '60 seconds') t;
  else
    dist := '[]'; suspicious := '[]';
  end if;
  return json_build_object('total', total, 'locked', is_locked,
                           'distribution', dist, 'last_minute', suspicious);
end $$;

-- ───────────────────── لوحة الأدمن: الأعضاء ─────────────────────

create or replace function public.admin_overview(p_token uuid)
returns json language plpgsql security definer set search_path = wc, public as $$
declare u wc.profiles;
begin
  u := wc._auth_admin(p_token);
  return json_build_object(
    'users',        (select count(*) from wc.profiles),
    'challenges',   (select count(*) from wc.challenges where type = 'private'),
    'predictions',  (select count(*) from wc.predictions),
    'finished',     (select count(*) from wc.matches where status = 'finished'),
    'predictions_today', (select count(*) from wc.predictions where updated_at >= now() - interval '24 hours'),
    'active_24h',   (select count(distinct user_id) from wc.predictions where updated_at >= now() - interval '24 hours'),
    'no_phone',     (select count(*) from wc.profiles where phone is null),
    'banned',       (select count(*) from wc.profiles where is_banned),
    'top_challenges', (select coalesce(json_agg(x), '[]') from (
       select c.name, count(mb.user_id) as members from wc.challenges c
       join wc.memberships mb on mb.challenge_id = c.id
       where c.type = 'private' group by c.id, c.name order by 2 desc limit 3) x),
    'sync', (select json_build_object('enabled', enabled, 'last_run', last_run, 'last_status', last_status)
             from wc.sync_config where id)
  );
end $$;

-- قائمة الأعضاء مع بحث (الاسمان + الجوال + النشاط)
create or replace function public.admin_list_users(p_token uuid, p_query text default null)
returns table (username text, display_name text, phone text, is_admin boolean,
               is_banned boolean, created_at timestamptz, predictions bigint, points bigint)
language plpgsql security definer set search_path = wc, public as $$
declare u wc.profiles;
begin
  u := wc._auth_admin(p_token);
  return query
  select pr.username, pr.display_name, pr.phone, pr.is_admin, pr.is_banned, pr.created_at,
    (select count(*) from wc.predictions p where p.user_id = pr.id),
    coalesce((select sum(wc.match_points(p.h, p.a, p.qualified, m.result_h, m.result_a, m.qualified, m.stage))
       from wc.predictions p join wc.matches m on m.id = p.match_id and m.status = 'finished'
       where p.user_id = pr.id), 0)
  from wc.profiles pr
  where p_query is null or p_query = ''
     or pr.username ilike '%' || p_query || '%'
     or pr.display_name ilike '%' || p_query || '%'
     or coalesce(pr.phone, '') like '%' || p_query || '%'
  order by pr.created_at desc;
end $$;

-- سجل العضو الكامل: ملفه + توقعاته بطوابعها + تحدياته
create or replace function public.admin_user_detail(p_token uuid, p_username text)
returns json language plpgsql security definer set search_path = wc, public as $$
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
             wc.match_points(p.h, p.a, p.qualified, m.result_h, m.result_a, m.qualified, m.stage) as points
      from wc.predictions p join wc.matches m on m.id = p.match_id
      where p.user_id = t.id) x),
    'challenges', (select coalesce(json_agg(c.name), '[]')
      from wc.memberships mb join wc.challenges c on c.id = mb.challenge_id
      where mb.user_id = t.id)
  );
end $$;

-- تغيير اسم العرض (مطبَّع كالتسجيل)
create or replace function public.admin_rename_user(p_token uuid, p_username text, p_new_display text)
returns json language plpgsql security definer set search_path = wc, public as $$
declare u wc.profiles; dname text;
begin
  u := wc._auth_admin(p_token);
  dname := regexp_replace(normalize(trim(coalesce(p_new_display,'')), nfkc),
                          '[​-‏‪-‮﻿]', '', 'g');
  if char_length(dname) not between 2 and 20 then raise exception 'DISPLAY_INVALID'; end if;
  update wc.profiles set display_name = dname where lower(username) = lower(trim(p_username));
  if not found then raise exception 'USER_NOT_FOUND'; end if;
  insert into wc.audit_log (admin_id, action, details)
  values (u.id, 'rename', json_build_object('user', p_username, 'new_display', dname));
  return json_build_object('ok', true);
end $$;

-- تعبئة/تصحيح جوال عضو
create or replace function public.admin_set_phone(p_token uuid, p_username text, p_phone text)
returns json language plpgsql security definer set search_path = wc, public as $$
declare u wc.profiles;
begin
  u := wc._auth_admin(p_token);
  if p_phone is not null and p_phone !~ '^05[0-9]{8}$' then raise exception 'PHONE_INVALID'; end if;
  if p_phone is not null and exists (select 1 from wc.profiles
      where phone = p_phone and lower(username) <> lower(trim(p_username))) then
    raise exception 'PHONE_TAKEN'; end if;
  update wc.profiles set phone = p_phone where lower(username) = lower(trim(p_username));
  if not found then raise exception 'USER_NOT_FOUND'; end if;
  insert into wc.audit_log (admin_id, action, details)
  values (u.id, 'set_phone', json_build_object('user', p_username));
  return json_build_object('ok', true);
end $$;

-- إعادة تعيين الرمز (للمشرف يُفرض 6 أرقام) + تدوير التوكن
create or replace function public.admin_reset_pin(p_token uuid, p_username text, p_new_pin text)
returns json language plpgsql security definer set search_path = wc, public, extensions as $$
declare u wc.profiles; t wc.profiles;
begin
  u := wc._auth_admin(p_token);
  select * into t from wc.profiles where lower(username) = lower(trim(p_username));
  if t.id is null then raise exception 'USER_NOT_FOUND'; end if;
  if t.is_admin then
    if p_new_pin !~ '^[0-9]{6}$' then raise exception 'PIN_ADMIN_6'; end if;
  elsif p_new_pin !~ '^[0-9]{4,6}$' then raise exception 'PIN_INVALID'; end if;
  update wc.profiles
  set pin_hash = crypt(p_new_pin, gen_salt('bf', 10)), token = gen_random_uuid()
  where id = t.id;
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

-- ترقية/تنزيل مشرف (لا يستطيع تنزيل نفسه)
create or replace function public.admin_set_admin(p_token uuid, p_username text, p_is_admin boolean)
returns json language plpgsql security definer set search_path = wc, public as $$
declare u wc.profiles;
begin
  u := wc._auth_admin(p_token);
  if lower(trim(p_username)) = lower(u.username) and not p_is_admin then
    raise exception 'CANT_DEMOTE_SELF'; end if;
  update wc.profiles set is_admin = p_is_admin where lower(username) = lower(trim(p_username));
  if not found then raise exception 'USER_NOT_FOUND'; end if;
  insert into wc.audit_log (admin_id, action, details)
  values (u.id, case when p_is_admin then 'make_admin' else 'remove_admin' end,
          json_build_object('user', p_username));
  return json_build_object('ok', true);
end $$;

-- حذف توقع مشبوه
create or replace function public.admin_delete_prediction(p_token uuid, p_username text, p_match_id text)
returns json language plpgsql security definer set search_path = wc, public as $$
declare u wc.profiles; n int;
begin
  u := wc._auth_admin(p_token);
  delete from wc.predictions p using wc.profiles pr
  where pr.id = p.user_id and lower(pr.username) = lower(trim(p_username)) and p.match_id = p_match_id;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'PREDICTION_NOT_FOUND'; end if;
  insert into wc.audit_log (admin_id, action, details)
  values (u.id, 'delete_prediction', json_build_object('user', p_username, 'match', p_match_id));
  return json_build_object('ok', true);
end $$;

-- ───────────────────── لوحة الأدمن: التحديات والسجل ─────────────────────

-- تشمل التحدي العام (أولًا) ليدخله الأدمن كأي تحدٍّ
drop function if exists public.admin_list_challenges(uuid);
create or replace function public.admin_list_challenges(p_token uuid)
returns table (id uuid, name text, code text, owner_display text, owner_username text,
               members bigint, join_locked boolean, created_at timestamptz, type text)
language plpgsql security definer set search_path = wc, public as $$
declare u wc.profiles;
begin
  u := wc._auth_admin(p_token);
  return query
  select c.id, c.name, c.code, pr.display_name, pr.username,
    (select count(*) from wc.memberships mb where mb.challenge_id = c.id),
    c.join_locked, c.created_at, c.type
  from wc.challenges c
  left join wc.profiles pr on pr.id = c.owner_id
  order by (c.type = 'public') desc, 6 desc;
end $$;

-- لوحة أي تحدٍّ بعين الأدمن (بلا شرط عضوية) + الجوالات لتوزيع الجوائز
create or replace function public.admin_challenge_board(p_token uuid, p_challenge_id uuid)
returns json language plpgsql security definer set search_path = wc, public as $$
declare u wc.profiles; c wc.challenges;
begin
  u := wc._auth_admin(p_token);
  select * into c from wc.challenges where id = p_challenge_id;
  if c.id is null then raise exception 'CHALLENGE_NOT_FOUND'; end if;
  return json_build_object(
    'name', c.name, 'type', c.type, 'code', c.code, 'join_locked', c.join_locked,
    'owner', (select pr.display_name || ' (' || pr.username || ')' from wc.profiles pr where pr.id = c.owner_id),
    'created_at', c.created_at,
    'board', (select coalesce(json_agg(x), '[]') from (
      select pr.display_name, pr.username, pr.phone, mb.joined_at,
        coalesce(sum(wc.match_points(p.h, p.a, p.qualified, m.result_h, m.result_a, m.qualified, m.stage)), 0) as points,
        count(*) filter (where p.h = m.result_h and p.a = m.result_a) as exact_count,
        (select count(*) from wc.predictions pp where pp.user_id = pr.id) as total_predictions
      from wc.memberships mb
      join wc.profiles pr on pr.id = mb.user_id and not pr.is_banned
      left join wc.predictions p on p.user_id = mb.user_id
      left join wc.matches m on m.id = p.match_id
           and m.status = 'finished'
           and m.kickoff_at >= mb.joined_at
      where mb.challenge_id = c.id
      group by pr.id, pr.display_name, pr.username, pr.phone, mb.joined_at
      order by points desc,
        avg(extract(epoch from p.updated_at)) filter (where p.h = m.result_h and p.a = m.result_a) asc nulls last,
        pr.display_name) x)
  );
end $$;

-- الفائزون في مباراة (النتيجة بالضبط) بترتيب أسبقية التوقع + الجوالات
create or replace function public.admin_match_winners(p_token uuid, p_match_id text)
returns json language plpgsql security definer set search_path = wc, public as $$
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
               wc.match_points(p.h, p.a, p.qualified, m.result_h, m.result_a, m.qualified, m.stage) as points
        from wc.predictions p
        join wc.profiles pr on pr.id = p.user_id and not pr.is_banned
        where p.match_id = m.id
          and p.h = m.result_h and p.a = m.result_a
        order by p.updated_at asc) x)
    end
  );
end $$;

-- تشغيل المزامنة يدويًا (زر في نظرة الأدمن العامة)
create or replace function public.admin_sync_now(p_token uuid)
returns text language plpgsql security definer set search_path = wc, public as $$
declare u wc.profiles;
begin
  u := wc._auth_admin(p_token);
  return wc.sync_results(true);
end $$;

-- حذف تحدٍّ مخالف (التحدي العام محمي)
create or replace function public.admin_delete_challenge(p_token uuid, p_challenge_id uuid)
returns json language plpgsql security definer set search_path = wc, public as $$
declare u wc.profiles; cname text;
begin
  u := wc._auth_admin(p_token);
  if p_challenge_id = wc.public_challenge_id() then raise exception 'CANT_DELETE_PUBLIC'; end if;
  delete from wc.challenges where id = p_challenge_id and type = 'private' returning name into cname;
  if cname is null then raise exception 'CHALLENGE_NOT_FOUND'; end if;
  insert into wc.audit_log (admin_id, action, details)
  values (u.id, 'delete_challenge', json_build_object('challenge', cname));
  return json_build_object('ok', true);
end $$;

create or replace function public.admin_audit_log(p_token uuid, p_limit int default 50)
returns table (id bigint, admin_name text, action text, details jsonb, created_at timestamptz)
language plpgsql security definer set search_path = wc, public as $$
declare u wc.profiles;
begin
  u := wc._auth_admin(p_token);
  return query
  select a.id, coalesce(pr.display_name, 'النظام'), a.action, a.details, a.created_at
  from wc.audit_log a left join wc.profiles pr on pr.id = a.admin_id
  order by a.id desc limit least(coalesce(p_limit, 50), 200);
end $$;

-- ───────────── التحديث التلقائي للنتائج (pg_cron + http) ─────────────
-- كل دقيقتين أثناء نوافذ اللعب: جلب النتائج من football-data.org —
-- النهائية تُعتمد تلقائيًا (لا تلمس ما اعتمده الأدمن)، والجارية تظهر «مباشر»
-- ⚠️ المفتاح يُحفظ في wc.sync_config على القاعدة مباشرة — لا تضعه في هذا الملف (المستودع عام)

create extension if not exists http with schema extensions;

alter table wc.matches add column if not exists live_h int;
alter table wc.matches add column if not exists live_a int;

-- خريطة أكواد منتخباتنا ← أكواد football-data (تحقق 72/72 مباراة)
create table if not exists wc.team_map (
  code   text primary key,
  fd_tla text unique not null
);
insert into wc.team_map (code, fd_tla) values
  ('MX','MEX'),('ZA','RSA'),('KR','KOR'),('CZ','CZE'),('CA','CAN'),('BA','BIH'),
  ('US','USA'),('PY','PAR'),('QA','QAT'),('CH','SUI'),('BR','BRA'),('MA','MAR'),
  ('HT','HAI'),('SCO','SCO'),('AU','AUS'),('TR','TUR'),('DE','GER'),('CW','CUW'),
  ('NL','NED'),('JP','JPN'),('CI','CIV'),('EC','ECU'),('SE','SWE'),('TN','TUN'),
  ('ES','ESP'),('CV','CPV'),('BE','BEL'),('EG','EGY'),('SA','KSA'),('UY','URY'),
  ('IR','IRN'),('NZ','NZL'),('FR','FRA'),('SN','SEN'),('IQ','IRQ'),('NO','NOR'),
  ('AR','ARG'),('DZ','ALG'),('AT','AUT'),('JO','JOR'),('PT','POR'),('CD','COD'),
  ('ENG','ENG'),('HR','CRO'),('GH','GHA'),('PA','PAN'),('UZ','UZB'),('CO','COL')
on conflict (code) do update set fd_tla = excluded.fd_tla;

create table if not exists wc.sync_config (
  id          boolean primary key default true check (id),
  api_token   text not null,
  enabled     boolean not null default true,
  last_run    timestamptz,
  last_status text
);
alter table wc.sync_config enable row level security;
alter table wc.team_map    enable row level security;
-- التفعيل (مرة واحدة، بمفتاحك الحقيقي):
-- insert into wc.sync_config (id, api_token, enabled) values (true, 'YOUR_FOOTBALL_DATA_TOKEN', true)
--   on conflict (id) do update set api_token = excluded.api_token, enabled = true;

create or replace function wc.sync_results(p_force boolean default false)
returns text language plpgsql security definer
set search_path = wc, public, extensions
set statement_timeout = '25s'
as $$
declare
  cfg wc.sync_config; resp record; payload jsonb; x jsonb;
  home_code text; away_code text; m wc.matches;
  fh int; fa int; rh int; ra int;
  n_fin int := 0; n_live int := 0; msg text;
begin
  select * into cfg from wc.sync_config where id;
  if cfg.id is null or not cfg.enabled then return 'disabled'; end if;

  -- لا نسأل الـAPI إلا عند وجود مباريات في نافذة اللعب (توفير الحصة)
  if not p_force and not exists (
    select 1 from wc.matches
    where status = 'scheduled'
      and kickoff_at between now() - interval '4 hours' and now() + interval '10 minutes'
  ) then
    update wc.sync_config set last_run = now(), last_status = 'idle — لا مباريات في النافذة' where id;
    return 'idle';
  end if;

  -- المهلة الافتراضية لامتداد http قصيرة جدًا — تُضبط لكل جلسة
  perform http_set_curlopt('CURLOPT_TIMEOUT', '15');
  perform http_set_curlopt('CURLOPT_CONNECTTIMEOUT', '8');

  select status, content into resp from http((
    'GET',
    'https://api.football-data.org/v4/competitions/WC/matches?dateFrom='
      || to_char(now() - interval '1 day', 'YYYY-MM-DD')
      || '&dateTo=' || to_char(now() + interval '1 day', 'YYYY-MM-DD'),
    ARRAY[http_header('X-Auth-Token', cfg.api_token)],
    null, null
  )::http_request);

  if resp.status <> 200 then
    msg := 'HTTP ' || resp.status;
    update wc.sync_config set last_run = now(), last_status = msg where id;
    return msg;
  end if;

  payload := resp.content::jsonb;
  for x in select * from jsonb_array_elements(payload->'matches') loop
    select code into home_code from wc.team_map where fd_tla = x#>>'{homeTeam,tla}';
    select code into away_code from wc.team_map where fd_tla = x#>>'{awayTeam,tla}';
    if home_code is null or away_code is null then continue; end if;

    select * into m from wc.matches
    where kickoff_at = (x->>'utcDate')::timestamptz
      and ((team_a = home_code and team_b = away_code)
        or (team_a = away_code and team_b = home_code));
    if m.id is null then continue; end if;

    fh := (x#>>'{score,fullTime,home}')::int;
    fa := (x#>>'{score,fullTime,away}')::int;
    if m.team_a = home_code then rh := fh; ra := fa; else rh := fa; ra := fh; end if;

    case x->>'status'
      when 'FINISHED' then
        -- لا نلمس ما اعتمده/صححه الأدمن — التلقائي يعتمد المجدولة فقط
        if m.status = 'scheduled' and rh is not null and ra is not null then
          update wc.matches set result_h = rh, result_a = ra,
                                 status = 'finished', live_h = null, live_a = null
          where id = m.id;
          n_fin := n_fin + 1;
          insert into wc.audit_log (admin_id, action, details)
          values (null, 'auto_result',
                  jsonb_build_object('match', m.id, 'h', rh, 'a', ra, 'source', 'football-data.org'));
        end if;
      when 'IN_PLAY', 'PAUSED' then
        if m.status = 'scheduled' then
          update wc.matches set live_h = coalesce(rh, 0), live_a = coalesce(ra, 0) where id = m.id;
          n_live := n_live + 1;
        end if;
      else null;
    end case;
  end loop;

  msg := 'ok — اعتُمدت ' || n_fin || ' · مباشرة ' || n_live;
  update wc.sync_config set last_run = now(), last_status = msg where id;
  return msg;
exception when others then
  update wc.sync_config set last_run = now(), last_status = 'خطأ: ' || sqlerrm where id;
  return 'error: ' || sqlerrm;
end $$;

-- الجدولة (pg_cron مثبّت في المشروع): كل دقيقتين
do $job$ begin
  perform cron.unschedule('wc26-sync-results');
exception when others then null; end $job$;
select cron.schedule('wc26-sync-results', '*/2 * * * *', 'select wc.sync_results()');

-- ───────────────────── الصلاحيات ─────────────────────
-- سكيما wc مقفلة بالكامل (لا usage لـ anon) — الوصول فقط عبر دوال API أعلاه
-- ⚠️ لا تستخدم revoke/grant شاملة على public — تطبيق آخر يشارك المشروع
revoke all on all tables in schema wc from anon, authenticated;
revoke execute on all functions in schema wc from anon, authenticated, public;
revoke usage on schema wc from anon, authenticated, public;

grant execute on function
  public.register_user(text, text, text, text),
  public.login_user(text, text),
  public.change_pin(uuid, text, text),
  public.submit_prediction(uuid, text, int, int, text),
  public.get_matches(uuid),
  public.match_predictions(uuid, uuid, text),
  public.create_challenge(uuid, text, text),
  public.join_challenge(uuid, text),
  public.my_challenges(uuid),
  public.leaderboard(uuid, uuid),
  public.my_ranks(uuid),
  public.admin_set_result(uuid, text, int, int, text),
  public.admin_reschedule(uuid, text, timestamptz),
  public.admin_cancel_match(uuid, text),
  public.admin_match_stats(uuid, text),
  public.admin_overview(uuid),
  public.admin_list_users(uuid, text),
  public.admin_user_detail(uuid, text),
  public.admin_rename_user(uuid, text, text),
  public.admin_set_phone(uuid, text, text),
  public.admin_reset_pin(uuid, text, text),
  public.admin_ban_user(uuid, text, boolean),
  public.admin_set_admin(uuid, text, boolean),
  public.admin_delete_prediction(uuid, text, text),
  public.admin_list_challenges(uuid),
  public.admin_challenge_board(uuid, uuid),
  public.admin_match_winners(uuid, text),
  public.admin_sync_now(uuid),
  public.admin_delete_challenge(uuid, uuid),
  public.admin_audit_log(uuid, int)
to anon, authenticated;

-- ═══════════ المراحل 2+3+4: التشغيل اليومي + النزاهة + الإقصائيات ═══════════
-- (إلحاق آمن لإعادة التنفيذ — مطابق للمنشور في 2026-06-12)

alter table wc.team_map add column if not exists name_ar text;
update wc.team_map as t set name_ar = v.n from (values
  ('MX','المكسيك'),('ZA','جنوب أفريقيا'),('KR','كوريا الجنوبية'),('CZ','التشيك'),
  ('CA','كندا'),('BA','البوسنة'),('QA','قطر'),('CH','سويسرا'),('US','أمريكا'),
  ('PY','باراغواي'),('BR','البرازيل'),('MA','المغرب'),('HT','هايتي'),('SCO','إسكتلندا'),
  ('AU','أستراليا'),('TR','تركيا'),('DE','ألمانيا'),('CW','كوراساو'),('NL','هولندا'),
  ('JP','اليابان'),('CI','ساحل العاج'),('EC','الإكوادور'),('SE','السويد'),('TN','تونس'),
  ('ES','إسبانيا'),('CV','الرأس الأخضر'),('BE','بلجيكا'),('EG','مصر'),('SA','السعودية'),
  ('UY','أوروغواي'),('FR','فرنسا'),('SN','السنغال'),('IQ','العراق'),('NO','النرويج'),
  ('AR','الأرجنتين'),('DZ','الجزائر'),('AT','النمسا'),('JO','الأردن'),('PT','البرتغال'),
  ('CD','الكونغو'),('ENG','إنجلترا'),('HR','كرواتيا'),('GH','غانا'),('PA','بنما'),
  ('UZ','أوزبكستان'),('CO','كولومبيا'),('NZ','نيوزيلندا'),('IR','إيران')
) as v(c, n) where t.code = v.c;

create table if not exists wc.announcements (
  id bigint generated always as identity primary key,
  body text not null check (char_length(trim(body)) between 2 and 250),
  active boolean not null default true,
  created_by uuid references wc.profiles(id),
  created_at timestamptz not null default now()
);
alter table wc.announcements enable row level security;

-- ملاحظة: النسخ الكاملة للدوال التالية موجودة في هجرات قاعدة البيانات
-- (Supabase > Database > Migrations) وهي المصدر التنفيذي المطابق:
-- active_announcement · admin_set_announcement · admin_clear_announcement
-- admin_set_result v3 (التصحيح يُنشئ إعلانًا تلقائيًا بأسماء المنتخبات العربية)
-- wc._challenge_manager · challenge_set_lock · challenge_regen_code
-- challenge_kick · challenge_members (المالك أو المشرف)
-- day_stars (نجوم اليوم بتوقيت مكة) · admin_integrity_report
-- admin_add_match · wc.sync_results v3 (جلب ساعي + بذر تلقائي للإقصائيات
-- بخريطة مراحل FD: LAST_32→r32 · LAST_16→r16 · QUARTER_FINALS→qf ·
-- SEMI_FINALS→sf · THIRD_PLACE→tp · FINAL→f) مع عمود sync_config.last_fetch

grant execute on function
  public.active_announcement(uuid),
  public.admin_set_announcement(uuid, text),
  public.admin_clear_announcement(uuid),
  public.challenge_set_lock(uuid, uuid, boolean),
  public.challenge_regen_code(uuid, uuid),
  public.challenge_kick(uuid, uuid, text),
  public.challenge_members(uuid, uuid),
  public.day_stars(uuid, date),
  public.admin_integrity_report(uuid),
  public.admin_add_match(uuid, text, text, timestamptz, text, text)
to anon, authenticated;

-- ═══════════ نظام الجوائز: كوبونات المتاجر (2026-06-12) ═══════════
-- كل توقع صحيح = جائزة معلقة · العضو يختار متجرًا (لا يتكرر له أبدًا
-- عبر فهرس فريد جزئي على user_id+store_id) · الكوبون يظهر بعد الاختيار فقط

create table if not exists wc.stores (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (char_length(trim(name)) between 2 and 60),
  description   text,
  coupon_code   text not null,
  discount_text text not null,
  url           text,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

create table if not exists wc.prizes (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references wc.profiles(id) on delete cascade,
  match_id   text not null references wc.matches(id) on delete cascade,
  store_id   uuid references wc.stores(id) on delete restrict,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, match_id)
);
create unique index if not exists prizes_user_store_unique
  on wc.prizes (user_id, store_id) where store_id is not null;
create index if not exists prizes_user on wc.prizes (user_id);
alter table wc.stores enable row level security;
alter table wc.prizes enable row level security;

-- الدوال المنفّذة (نسخها الكاملة في هجرات قاعدة البيانات):
-- wc._grant_prizes(match) — تُستدعى من admin_set_result و sync_results
-- my_prizes · prize_options · claim_prize (للأعضاء)
-- admin_save_store · admin_toggle_store · admin_delete_store · admin_stores_stats

grant execute on function
  public.my_prizes(uuid),
  public.prize_options(uuid, bigint),
  public.claim_prize(uuid, bigint, uuid),
  public.admin_save_store(uuid, text, text, text, text, text, uuid),
  public.admin_toggle_store(uuid, uuid, boolean),
  public.admin_delete_store(uuid, uuid),
  public.admin_stores_stats(uuid)
to anon, authenticated;
