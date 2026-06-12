// يولّد supabase/seed.sql من بيانات الجدول — أعد تشغيله عند أي تعديل على الجدول:
//   node scripts/generate-seed.mjs
import { ALL_MATCHES } from "../src/data/tournament.js";
import { writeFileSync } from "node:fs";

const esc = (s) => String(s).replace(/'/g, "''");
const rows = ALL_MATCHES.map((m) =>
  `('${m.id}', '${m.a}', '${m.b}', '${m.kickoff}'::timestamptz, 'group', '${esc(m.c)}')`
).join(",\n  ");

const sql = `-- بذرة البيانات: التحدي العام + مباريات دور المجموعات (مولّد تلقائيًا)
insert into challenges (id, type, name, code, scope)
values ('00000000-0000-0000-0000-000000000001', 'public', 'التحدي العام', null, 'all')
on conflict (id) do nothing;

insert into matches (id, team_a, team_b, kickoff_at, stage, city) values
  ${rows}
on conflict (id) do update set kickoff_at = excluded.kickoff_at, city = excluded.city;
`;
writeFileSync(new URL("../supabase/seed.sql", import.meta.url), sql);
console.log(`seed.sql generated: ${ALL_MATCHES.length} matches`);
