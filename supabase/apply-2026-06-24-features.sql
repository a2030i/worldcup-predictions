-- ════════════════════════════════════════════════════════════════════════
-- تحديث 2026-06-24 — توزيع توقعات الجمهور (يظهر بعد قفل المباراة فقط).
-- شغّل هذا الملف وحده في Supabase SQL Editor. آمن وإضافي وقابل لإعادة التشغيل.
-- ════════════════════════════════════════════════════════════════════════

-- ملخّص مجمّع لتوقعات الجمهور على مباراة — بلا كشف هوية، وبعد القفل فقط
create or replace function public.match_distribution(p_token uuid, p_match_id text)
returns json language plpgsql security definer set search_path = wc, public as $$
declare u wc.profiles; m wc.matches; tot int;
begin
  u := wc._auth(p_token);
  select * into m from wc.matches where id = p_match_id;
  if m.id is null then raise exception 'MATCH_NOT_FOUND'; end if;
  if now() < wc.lock_at(m) then raise exception 'STILL_OPEN'; end if;  -- لا كشف قبل القفل
  select count(*) into tot from wc.predictions where match_id = p_match_id;
  return json_build_object(
    'total', tot,
    'home', (select count(*) from wc.predictions where match_id = p_match_id and h > a),
    'draw', (select count(*) from wc.predictions where match_id = p_match_id and h = a),
    'away', (select count(*) from wc.predictions where match_id = p_match_id and h < a),
    'top',  coalesce((select json_agg(t) from (
              select h, a, count(*) as c from wc.predictions
              where match_id = p_match_id group by h, a
              order by c desc, h desc, a desc limit 3) t), '[]'::json)
  );
end $$;

grant execute on function public.match_distribution(uuid, text) to anon, authenticated;
