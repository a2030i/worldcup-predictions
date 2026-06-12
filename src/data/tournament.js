const NAMES = {
  MX: "المكسيك", ZA: "جنوب أفريقيا", KR: "كوريا الجنوبية", CZ: "التشيك",
  CA: "كندا", BA: "البوسنة", QA: "قطر", CH: "سويسرا",
  US: "أمريكا", PY: "باراغواي", BR: "البرازيل", MA: "المغرب",
  HT: "هايتي", SCO: "إسكتلندا", AU: "أستراليا", TR: "تركيا",
  DE: "ألمانيا", CW: "كوراساو", NL: "هولندا", JP: "اليابان",
  CI: "ساحل العاج", EC: "الإكوادور", SE: "السويد", TN: "تونس",
  ES: "إسبانيا", CV: "الرأس الأخضر", BE: "بلجيكا", EG: "مصر",
  SA: "السعودية", UY: "أوروغواي", FR: "فرنسا", SN: "السنغال",
  IQ: "العراق", NO: "النرويج", AR: "الأرجنتين", DZ: "الجزائر",
  AT: "النمسا", JO: "الأردن", PT: "البرتغال", CD: "الكونغو",
  ENG: "إنجلترا", HR: "كرواتيا", GH: "غانا", PA: "بنما",
  UZ: "أوزبكستان", CO: "كولومبيا", NZ: "نيوزيلندا", IR: "إيران",
};
const ARAB = ["SA", "EG", "MA", "QA", "IQ", "TN", "DZ", "JO"];
const BROADCASTER = "beIN SPORTS";
const GROUPS = {
  A: ["MX", "ZA", "KR", "CZ"], B: ["CA", "BA", "QA", "CH"],
  C: ["BR", "MA", "HT", "SCO"], D: ["US", "PY", "AU", "TR"],
  E: ["DE", "CW", "CI", "EC"], F: ["NL", "JP", "SE", "TN"],
  G: ["BE", "EG", "IR", "NZ"], H: ["ES", "CV", "SA", "UY"],
  I: ["FR", "SN", "IQ", "NO"], J: ["AR", "DZ", "AT", "JO"],
  K: ["PT", "CD", "UZ", "CO"], L: ["ENG", "HR", "GH", "PA"],
};
const groupOf = (code) => Object.keys(GROUPS).find((g) => GROUPS[g].includes(code)) || "";

// p: "ص"|"م" · c: المدينة
const SCHEDULE = [
  { dow: "الخميس", date: "11 يونيو", iso: "2026-06-11", matches: [
    { t: "10:00", p: "م", a: "MX", b: "ZA", c: "مكسيكو سيتي", r: { h: 2, a: 0 } },
  ]},
  { dow: "الجمعة", date: "12 يونيو", iso: "2026-06-12", matches: [
    { t: "5:00",  p: "ص", a: "KR", b: "CZ", c: "غوادالاهارا" },
    { t: "10:00", p: "م", a: "CA", b: "BA", c: "تورنتو" },
  ]},
  { dow: "السبت", date: "13 يونيو", iso: "2026-06-13", matches: [
    { t: "4:00",  p: "ص", a: "US", b: "PY", c: "لوس أنجلوس" },
    { t: "10:00", p: "م", a: "QA", b: "CH", c: "سان فرانسيسكو" },
  ]},
  { dow: "الأحد", date: "14 يونيو", iso: "2026-06-14", matches: [
    { t: "1:00",  p: "ص", a: "BR",  b: "MA",  c: "نيويورك" },
    { t: "4:00",  p: "ص", a: "HT",  b: "SCO", c: "بوسطن" },
    { t: "7:00",  p: "ص", a: "AU",  b: "TR",  c: "فانكوفر" },
    { t: "8:00",  p: "م", a: "DE",  b: "CW",  c: "هيوستن" },
    { t: "11:00", p: "م", a: "NL",  b: "JP",  c: "دالاس" },
  ]},
  { dow: "الإثنين", date: "15 يونيو", iso: "2026-06-15", matches: [
    { t: "2:00",  p: "ص", a: "CI", b: "EC", c: "فيلادلفيا" },
    { t: "5:00",  p: "ص", a: "SE", b: "TN", c: "مونتيري" },
    { t: "7:00",  p: "م", a: "ES", b: "CV", c: "أتلانتا" },
    { t: "10:00", p: "م", a: "BE", b: "EG", c: "سياتل" },
  ]},
  { dow: "الثلاثاء", date: "16 يونيو", iso: "2026-06-16", matches: [
    { t: "1:00",  p: "ص", a: "SA", b: "UY", c: "ميامي" },
    { t: "4:00",  p: "ص", a: "IR", b: "NZ", c: "لوس أنجلوس" },
    { t: "10:00", p: "م", a: "FR", b: "SN", c: "نيويورك" },
  ]},
  { dow: "الأربعاء", date: "17 يونيو", iso: "2026-06-17", matches: [
    { t: "1:00",  p: "ص", a: "IQ",  b: "NO", c: "بوسطن" },
    { t: "4:00",  p: "ص", a: "AR",  b: "DZ", c: "كانساس سيتي" },
    { t: "7:00",  p: "ص", a: "AT",  b: "JO", c: "سان فرانسيسكو" },
    { t: "8:00",  p: "م", a: "PT",  b: "CD", c: "هيوستن" },
    { t: "11:00", p: "م", a: "ENG", b: "HR", c: "دالاس" },
  ]},
  { dow: "الخميس", date: "18 يونيو", iso: "2026-06-18", matches: [
    { t: "2:00",  p: "ص", a: "GH", b: "PA", c: "تورنتو" },
    { t: "5:00",  p: "ص", a: "UZ", b: "CO", c: "مكسيكو سيتي" },
    { t: "7:00",  p: "م", a: "CZ", b: "ZA", c: "أتلانتا" },
    { t: "10:00", p: "م", a: "CH", b: "BA", c: "لوس أنجلوس" },
  ]},
  { dow: "الجمعة", date: "19 يونيو", iso: "2026-06-19", matches: [
    { t: "1:00",  p: "ص", a: "CA", b: "QA", c: "فانكوفر" },
    { t: "4:00",  p: "ص", a: "MX", b: "KR", c: "غوادالاهارا" },
    { t: "10:00", p: "م", a: "US", b: "AU", c: "سياتل" },
  ]},
  { dow: "السبت", date: "20 يونيو", iso: "2026-06-20", matches: [
    { t: "1:00",  p: "ص", a: "SCO", b: "MA", c: "بوسطن" },
    { t: "3:30",  p: "ص", a: "BR",  b: "HT", c: "فيلادلفيا" },
    { t: "6:00",  p: "ص", a: "TR",  b: "PY", c: "سان فرانسيسكو" },
    { t: "8:00",  p: "م", a: "NL",  b: "SE", c: "هيوستن" },
    { t: "11:00", p: "م", a: "DE",  b: "CI", c: "تورنتو" },
  ]},
  { dow: "الأحد", date: "21 يونيو", iso: "2026-06-21", matches: [
    { t: "3:00",  p: "ص", a: "EC", b: "CW", c: "كانساس سيتي" },
    { t: "7:00",  p: "ص", a: "TN", b: "JP", c: "مونتيري" },
    { t: "7:00",  p: "م", a: "ES", b: "SA", c: "أتلانتا" },
    { t: "10:00", p: "م", a: "BE", b: "IR", c: "لوس أنجلوس" },
  ]},
  { dow: "الإثنين", date: "22 يونيو", iso: "2026-06-22", matches: [
    { t: "1:00", p: "ص", a: "UY", b: "CV", c: "ميامي" },
    { t: "4:00", p: "ص", a: "NZ", b: "EG", c: "فانكوفر" },
    { t: "8:00", p: "م", a: "AR", b: "AT", c: "دالاس" },
  ]},
  { dow: "الثلاثاء", date: "23 يونيو", iso: "2026-06-23", matches: [
    { t: "12:00", p: "ص", a: "FR",  b: "IQ", c: "فيلادلفيا" },
    { t: "3:00",  p: "ص", a: "NO",  b: "SN", c: "نيويورك" },
    { t: "6:00",  p: "ص", a: "JO",  b: "DZ", c: "سان فرانسيسكو" },
    { t: "8:00",  p: "م", a: "PT",  b: "UZ", c: "هيوستن" },
    { t: "11:00", p: "م", a: "ENG", b: "GH", c: "بوسطن" },
  ]},
  { dow: "الأربعاء", date: "24 يونيو", iso: "2026-06-24", matches: [
    { t: "2:00",  p: "ص", a: "PA", b: "HR", c: "تورنتو" },
    { t: "5:00",  p: "ص", a: "CO", b: "CD", c: "غوادالاهارا" },
    { t: "10:00", p: "م", a: "CH", b: "CA", c: "فانكوفر" },
    { t: "10:00", p: "م", a: "BA", b: "QA", c: "سياتل" },
  ]},
  { dow: "الخميس", date: "25 يونيو", iso: "2026-06-25", matches: [
    { t: "1:00",  p: "ص", a: "MA",  b: "HT", c: "أتلانتا" },
    { t: "1:00",  p: "ص", a: "SCO", b: "BR", c: "ميامي" },
    { t: "4:00",  p: "ص", a: "CZ",  b: "MX", c: "مكسيكو سيتي" },
    { t: "4:00",  p: "ص", a: "ZA",  b: "KR", c: "مونتيري" },
    { t: "11:00", p: "م", a: "EC",  b: "DE", c: "نيويورك" },
    { t: "11:00", p: "م", a: "CW",  b: "CI", c: "فيلادلفيا" },
  ]},
  { dow: "الجمعة", date: "26 يونيو", iso: "2026-06-26", matches: [
    { t: "2:00",  p: "ص", a: "TN", b: "NL", c: "كانساس سيتي" },
    { t: "2:00",  p: "ص", a: "JP", b: "SE", c: "دالاس" },
    { t: "5:00",  p: "ص", a: "TR", b: "US", c: "لوس أنجلوس" },
    { t: "5:00",  p: "ص", a: "PY", b: "AU", c: "سان فرانسيسكو" },
    { t: "10:00", p: "م", a: "SN", b: "IQ", c: "تورنتو" },
    { t: "10:00", p: "م", a: "NO", b: "FR", c: "بوسطن" },
  ]},
  { dow: "السبت", date: "27 يونيو", iso: "2026-06-27", matches: [
    { t: "3:00", p: "ص", a: "UY", b: "ES", c: "غوادالاهارا" },
    { t: "3:00", p: "ص", a: "CV", b: "SA", c: "هيوستن" },
    { t: "6:00", p: "ص", a: "NZ", b: "BE", c: "فانكوفر" },
    { t: "6:00", p: "ص", a: "EG", b: "IR", c: "سياتل" },
  ]},
  { dow: "الأحد", date: "28 يونيو", iso: "2026-06-28", matches: [
    { t: "12:00", p: "ص", a: "PA",  b: "ENG", c: "نيويورك" },
    { t: "12:00", p: "ص", a: "HR",  b: "GH",  c: "فيلادلفيا" },
    { t: "2:30",  p: "ص", a: "CO",  b: "PT",  c: "ميامي" },
    { t: "2:30",  p: "ص", a: "CD",  b: "UZ",  c: "أتلانتا" },
    { t: "5:00",  p: "ص", a: "JO",  b: "AR",  c: "دالاس" },
    { t: "5:00",  p: "ص", a: "DZ",  b: "AT",  c: "كانساس سيتي" },
  ]},
];

const SPECIAL = {
  SCO: String.fromCodePoint(0x1F3F4,0xE0067,0xE0062,0xE0073,0xE0063,0xE0074,0xE007F),
  ENG: String.fromCodePoint(0x1F3F4,0xE0067,0xE0062,0xE0065,0xE006E,0xE0067,0xE007F),
};
const flag = (cc) =>
  SPECIAL[cc] || cc.toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));

const todayISO = () => {
  const d = new Date(); const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

function buildStats() {
  const st = {};
  Object.values(GROUPS).flat().forEach((t) => (st[t] = { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }));
  SCHEDULE.forEach((day) => day.matches.forEach((m) => {
    if (!m.r || m.r.live) return;
    const { h, a } = m.r, A = st[m.a], B = st[m.b];
    A.p++; B.p++; A.gf += h; A.ga += a; B.gf += a; B.ga += h;
    if (h > a) { A.w++; A.pts += 3; B.l++; }
    else if (h < a) { B.w++; B.pts += 3; A.l++; }
    else { A.d++; B.d++; A.pts++; B.pts++; }
  }));
  return st;
}

// معرّف موحّد للمباراة — يُستخدم في قاعدة البيانات والتوقعات
const matchId = (iso, a, b) => `${iso}_${a}_${b}`;

// تحويل وقت العرض (12 ساعة بتوقيت السعودية) إلى ISO timestamp
function kickoffISO(iso, t, p) {
  let [h, m] = t.split(":").map(Number);
  if (p === "ص" && h === 12) h = 0;
  if (p === "م" && h !== 12) h += 12;
  const pad = (n) => String(n).padStart(2, "0");
  return `${iso}T${pad(h)}:${pad(m)}:00+03:00`;
}

// قائمة مسطّحة بكل المباريات مع المعرف ووقت الانطلاق
const ALL_MATCHES = SCHEDULE.flatMap((day) =>
  day.matches.map((m) => ({
    ...m, dow: day.dow, date: day.date, iso: day.iso,
    id: matchId(day.iso, m.a, m.b),
    kickoff: kickoffISO(day.iso, m.t, m.p),
  }))
);

export { NAMES, ARAB, BROADCASTER, GROUPS, groupOf, SCHEDULE, SPECIAL, flag, todayISO, buildStats, matchId, kickoffISO, ALL_MATCHES };
