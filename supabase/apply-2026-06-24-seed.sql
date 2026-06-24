-- ════════════════════════════════════════════════════════════════════════
-- تحديث 2026-06-24 — البذر التلقائي المبكر لمباريات الأدوار الإقصائية.
-- شغّل هذا الملف وحده في Supabase SQL Editor (لا تشغّل schema.sql كاملًا).
-- يعمل كل 30 دقيقة: يجلب مباريات الإقصائيات القادمة من football-data.org،
-- ويُنشئها تلقائيًا فور تأكُّد طرفيها (لا ينتظر يوم المباراة)، فتظهر للأعضاء
-- مبكرًا وتُفتح توقعاتها. لا يلمس النتائج (تتكفّل بها المزامنة)، ولا يُنشئ مكررًا.
-- آمن وقابل لإعادة التشغيل.
-- ════════════════════════════════════════════════════════════════════════

-- حالة منفصلة للبذر (لا تُزاحم حالة المزامنة)
alter table wc.sync_config add column if not exists last_seed_run    timestamptz;
alter table wc.sync_config add column if not exists last_seed_status text;

create or replace function wc.seed_knockouts()
returns text language plpgsql security definer
set search_path = wc, public, extensions
set statement_timeout = '25s'
as $$
declare
  cfg wc.sync_config; resp record; payload jsonb; x jsonb;
  home_code text; away_code text; st text; fd_stage text;
  k timestamptz; iso text; new_id text; m wc.matches;
  n_new int := 0; n_upd int := 0; msg text;
begin
  select * into cfg from wc.sync_config where id;
  if cfg.id is null or not cfg.enabled then return 'disabled'; end if;

  -- توفير حصة الـAPI: نتوقف فور اكتمال كل الإقصائيات (32 مباراة: 16+8+4+2+1+1)
  if (select count(*) from wc.matches where stage in ('r32','r16','qf','sf','tp','f')) >= 32 then
    update wc.sync_config set last_seed_run = now(), last_seed_status = 'مكتمل — كل الإقصائيات مبذورة' where id;
    return 'complete';
  end if;

  perform http_set_curlopt('CURLOPT_TIMEOUT', '15');
  perform http_set_curlopt('CURLOPT_CONNECTTIMEOUT', '8');

  -- نطاق واسع (21 يومًا) لالتقاط مباريات الإقصائيات القادمة فور تثبيت طرفيها
  select status, content into resp from http((
    'GET',
    'https://api.football-data.org/v4/competitions/WC/matches?dateFrom='
      || to_char(now(), 'YYYY-MM-DD')
      || '&dateTo=' || to_char(now() + interval '21 days', 'YYYY-MM-DD'),
    ARRAY[http_header('X-Auth-Token', cfg.api_token)],
    null, null
  )::http_request);

  if resp.status <> 200 then
    msg := 'HTTP ' || resp.status;
    update wc.sync_config set last_seed_run = now(), last_seed_status = 'seed: ' || msg where id;
    return msg;
  end if;

  payload := resp.content::jsonb;
  for x in select * from jsonb_array_elements(payload->'matches') loop
    fd_stage := x->>'stage';
    st := case fd_stage
            when 'LAST_32' then 'r32' when 'LAST_16' then 'r16'
            when 'QUARTER_FINALS' then 'qf' when 'SEMI_FINALS' then 'sf'
            when 'THIRD_PLACE' then 'tp' when 'FINAL' then 'f' else null end;
    if st is null then continue; end if;   -- المجموعات تتكفّل بها sync_results

    select code into home_code from wc.team_map where fd_tla = x#>>'{homeTeam,tla}';
    select code into away_code from wc.team_map where fd_tla = x#>>'{awayTeam,tla}';
    if home_code is null or away_code is null then continue; end if;  -- لم يُعرف الطرفان بعد

    k := (x->>'utcDate')::timestamptz;

    -- موجودة مسبقًا (بنفس الموعد والطرفين، أيًّا كان معرّفها)؟ حدّث المرحلة فقط، ولا تُكرّر
    select * into m from wc.matches
    where kickoff_at = k
      and ((team_a = home_code and team_b = away_code)
        or (team_a = away_code and team_b = home_code));
    if m.id is not null then
      if m.status = 'scheduled' and m.stage is distinct from st then
        update wc.matches set stage = st where id = m.id;
        n_upd := n_upd + 1;
      end if;
      continue;
    end if;

    -- جديدة: أنشئها بمعرّف بنمط المشروع {تاريخ مكة}_{المضيف}_{الضيف}
    iso := to_char(k at time zone 'Asia/Riyadh', 'YYYY-MM-DD');
    new_id := iso || '_' || home_code || '_' || away_code;
    insert into wc.matches (id, team_a, team_b, kickoff_at, stage, status)
    values (new_id, home_code, away_code, k, st, 'scheduled')
    on conflict (id) do nothing;
    if found then
      n_new := n_new + 1;
      insert into wc.audit_log (admin_id, action, details)
      values (null, 'seed_knockout',
              jsonb_build_object('id', new_id, 'a', home_code, 'b', away_code, 'stage', st));
    end if;
  end loop;

  msg := 'seed ok — جديدة ' || n_new || ' · محدّثة ' || n_upd;
  update wc.sync_config set last_seed_run = now(), last_seed_status = msg where id;
  return msg;
exception when others then
  update wc.sync_config set last_seed_run = now(), last_seed_status = 'seed error: ' || sqlerrm where id;
  return 'error: ' || sqlerrm;
end $$;

-- الجدولة: كل 30 دقيقة (pg_cron مثبّت في المشروع)
do $job$ begin
  perform cron.unschedule('wc26-seed-knockouts');
exception when others then null; end $job$;
select cron.schedule('wc26-seed-knockouts', '*/30 * * * *', 'select wc.seed_knockouts()');

-- تشغيل فوري أول مرة (لن يُنشئ شيئًا حتى يتأكد طرفا أي مباراة إقصائية لدى المزوّد)
select wc.seed_knockouts();
