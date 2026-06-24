-- ════════════════════════════════════════════════════════════════════════
-- تحديث 2026-06-14 — شغّل هذا الملف وحده في Supabase SQL Editor.
-- (لا تشغّل schema.sql كاملًا: بعض دواله أقدم من قاعدتك الحيّة فيرفضها Postgres.)
-- آمن وقابل لإعادة التشغيل: لا يحذف بيانات، ولا يمسّ التطبيق المجاور.
-- يحتوي فقط تعديلات: النقاط الجديدة + خانات الأدوار الإقصائية.
-- ════════════════════════════════════════════════════════════════════════

-- ① النقاط الجديدة: كل المباريات نقطتان · نصف النهائي 3 · النهائي 4
-- (يعيد بناء كل اللوحات فورًا لأن النقاط محسوبة لا مخزّنة)
create or replace function wc.match_points(
  ph int, pa int, pq text, rh int, ra int, rq text, stage text
) returns int language sql immutable as $$
  select case
    when rh is null or ra is null then 0
    when ph = rh and pa = ra then
      case stage when 'sf' then 3 when 'f' then 4 else 2 end
    else 0
  end
$$;

-- ② خانات الأدوار الإقصائية: السماح بأن يكون المنتخب فارغًا (بانتظار التأهل)
alter table wc.matches alter column team_a drop not null;
alter table wc.matches alter column team_b drop not null;

-- ③ منع التوقع على خانة لم يكتمل طرفاها بعد
create or replace function public.submit_prediction(
  p_token uuid, p_match_id text, p_h int, p_a int, p_qualified text default null
) returns json language plpgsql security definer set search_path = wc, public as $$
declare u wc.profiles; m wc.matches;
begin
  u := wc._auth(p_token);
  select * into m from wc.matches where id = p_match_id;
  if m.id is null then raise exception 'MATCH_NOT_FOUND'; end if;
  -- خانة إقصائية لم يكتمل طرفاها بعد: لا تُفتح للتوقع حتى يُعرف المنتخبان
  if m.team_a is null or m.team_b is null then raise exception 'MATCH_NOT_OPEN'; end if;
  if m.status <> 'scheduled' then raise exception 'MATCH_NOT_OPEN'; end if;
  if now() >= wc.lock_at(m) then raise exception 'PREDICTIONS_LOCKED'; end if;

  insert into wc.predictions (user_id, match_id, h, a, qualified)
  values (u.id, p_match_id, p_h, p_a, p_qualified)
  on conflict (user_id, match_id)
  do update set h = excluded.h, a = excluded.a,
                qualified = excluded.qualified, updated_at = now();
  return json_build_object('ok', true, 'locked_at', wc.lock_at(m));
end $$;

-- ④ get_matches يُرجع المنتخبين (لتعرف الواجهة الطرفين دون قراءتهما من المعرّف)
drop function if exists public.get_matches(uuid);
create or replace function public.get_matches(p_token uuid)
returns table (
  id text, status text, stage text, kickoff_at timestamptz, locks_at timestamptz,
  result_h int, result_a int, qualified text,
  my_h int, my_a int, my_qualified text, predictors bigint, server_now timestamptz,
  live_h int, live_a int, team_a text, team_b text
) language plpgsql security definer set search_path = wc, public as $$
declare u wc.profiles;
begin
  u := wc._auth(p_token);
  return query
  select m.id, m.status, m.stage, m.kickoff_at, wc.lock_at(m),
         m.result_h, m.result_a, m.qualified,
         p.h, p.a, p.qualified,
         (select count(*) from wc.predictions x where x.match_id = m.id),
         now(), m.live_h, m.live_a, m.team_a, m.team_b
  from wc.matches m
  left join wc.predictions p on p.match_id = m.id and p.user_id = u.id
  order by m.kickoff_at;
end $$;
grant execute on function public.get_matches(uuid) to anon, authenticated;

-- ⑤ إنشاء/تحديث خانة إقصائية بمعرّف ثابت (المنتخبان اختياريان = بانتظار التأهل)
create or replace function public.admin_upsert_match(
  p_token uuid, p_id text, p_stage text, p_kickoff timestamptz,
  p_team_a text default null, p_team_b text default null, p_city text default null
) returns json language plpgsql security definer set search_path = wc, public as $$
declare u wc.profiles; a text; b text;
begin
  u := wc._auth_admin(p_token);
  if p_stage not in ('r32','r16','qf','sf','tp','f') then raise exception 'STAGE_INVALID'; end if;
  if coalesce(trim(p_id), '') = '' then raise exception 'MATCH_NOT_FOUND'; end if;
  a := nullif(trim(p_team_a), ''); b := nullif(trim(p_team_b), '');
  if a is not null and not exists (select 1 from wc.team_map where code = a) then raise exception 'TEAM_INVALID'; end if;
  if b is not null and not exists (select 1 from wc.team_map where code = b) then raise exception 'TEAM_INVALID'; end if;
  if a is not null and a = b then raise exception 'TEAM_INVALID'; end if;
  insert into wc.matches (id, team_a, team_b, kickoff_at, stage, city, status)
  values (p_id, a, b, p_kickoff, p_stage, p_city, 'scheduled')
  on conflict (id) do update set
    team_a = excluded.team_a, team_b = excluded.team_b,
    kickoff_at = excluded.kickoff_at, stage = excluded.stage,
    city = coalesce(excluded.city, wc.matches.city)
  where wc.matches.status <> 'finished';
  insert into wc.audit_log (admin_id, action, details)
  values (u.id, 'upsert_match',
          json_build_object('id', p_id, 'a', a, 'b', b, 'stage', p_stage));
  return json_build_object('ok', true);
end $$;

grant execute on function
  public.admin_upsert_match(uuid, text, text, timestamptz, text, text, text)
to anon, authenticated;
