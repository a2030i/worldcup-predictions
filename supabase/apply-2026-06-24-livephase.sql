-- ════════════════════════════════════════════════════════════════════════
-- تحديث 2026-06-24 — أطوار المباراة الحية (أشواط إضافية / ركلات ترجيح).
-- شغّل هذا الملف وحده في Supabase SQL Editor. آمن وإضافي وقابل لإعادة التشغيل.
-- يضيف عمود طور المباراة الحي، ودالة للأدمن لضبطه، ويُرجعه get_matches.
-- ════════════════════════════════════════════════════════════════════════

-- نضمن وجود عمود الجوكر (للأمان إن لم يُشغّل ملف الجوكر بعد) + عمود الطور الحي
alter table wc.predictions add column if not exists joker boolean not null default false;
alter table wc.matches     add column if not exists live_phase text;  -- null | 'ET' | 'PENS'

-- ضبط طور المباراة الحي (للأدمن): أشواط إضافية / ركلات ترجيح / إلغاء
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

-- get_matches يُرجع أيضًا الطور الحي (live_phase)
drop function if exists public.get_matches(uuid);
create or replace function public.get_matches(p_token uuid)
returns table (
  id text, status text, stage text, kickoff_at timestamptz, locks_at timestamptz,
  result_h int, result_a int, qualified text,
  my_h int, my_a int, my_qualified text, predictors bigint, server_now timestamptz,
  live_h int, live_a int, team_a text, team_b text, my_joker boolean, live_phase text
) language plpgsql security definer set search_path = wc, public as $$
declare u wc.profiles;
begin
  u := wc._auth(p_token);
  return query
  select m.id, m.status, m.stage, m.kickoff_at, wc.lock_at(m),
         m.result_h, m.result_a, m.qualified,
         p.h, p.a, p.qualified,
         (select count(*) from wc.predictions x where x.match_id = m.id),
         now(), m.live_h, m.live_a, m.team_a, m.team_b, coalesce(p.joker, false), m.live_phase
  from wc.matches m
  left join wc.predictions p on p.match_id = m.id and p.user_id = u.id
  order by m.kickoff_at;
end $$;
grant execute on function public.get_matches(uuid) to anon, authenticated;
