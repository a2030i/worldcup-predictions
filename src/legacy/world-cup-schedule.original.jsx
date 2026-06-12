import React, { useState } from "react";

// ──────────────────────────────────────────────────────────────
//  كأس العالم 2026 — مباريات + ترتيب + بطاقة مشاركة (واتساب/سناب)
//  الأوقات بتوقيت السعودية (مكة) · الترتيب يُحسب تلقائياً من النتائج
//  r: نتيجة { h: الأول, a: الثاني } · tv: قناة (افتراضي beIN SPORTS)
// ──────────────────────────────────────────────────────────────
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

const C = {
  text: "#F4F6FF", muted: "#A6ABD6", gold: "#F6C453",
  goldSoft: "rgba(246,196,83,0.12)", line: "rgba(255,255,255,0.08)",
  card: "rgba(255,255,255,0.045)", green: "#8BE49B",
};

/* ───────────── توليد بطاقة المشاركة (Canvas) ───────────── */
function roundRect(x, X, Y, W, H, r) {
  x.beginPath(); x.moveTo(X + r, Y);
  x.arcTo(X + W, Y, X + W, Y + H, r); x.arcTo(X + W, Y + H, X, Y + H, r);
  x.arcTo(X, Y + H, X, Y, r); x.arcTo(X, Y, X + W, Y, r); x.closePath();
}
function shareImageURL(m, story) {
  const W = 1080, H = story ? 1920 : 1080;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const x = cv.getContext("2d");
  const EM = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  const F = "'Cairo','Segoe UI',Tahoma,sans-serif";

  const g = x.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#0A1033"); g.addColorStop(0.55, "#140A3D"); g.addColorStop(1, "#1E0B47");
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  const rg = x.createRadialGradient(W / 2, H * 0.18, 60, W / 2, H * 0.18, W * 0.75);
  rg.addColorStop(0, "rgba(124,58,237,0.4)"); rg.addColorStop(1, "rgba(124,58,237,0)");
  x.fillStyle = rg; x.fillRect(0, 0, W, H);
  x.save(); x.globalAlpha = 0.05; x.fillStyle = "#fff";
  x.textAlign = "center"; x.textBaseline = "middle";
  x.font = `900 ${story ? 520 : 430}px ${F}`; x.fillText("2026", W / 2, H * 0.5); x.restore();

  x.textAlign = "center"; x.textBaseline = "middle"; x.direction = "rtl";
  const cy = story
    ? { eb: 230, ti: 330, ln: 400, gr: 470, fl: 790, nm: 970, bx: 1150, bh: 470, ft: 1760 }
    : { eb: 120, ti: 196, ln: 248, gr: 302, fl: 450, nm: 600, bx: 700, bh: 300, ft: 1030 };
  const off = story ? 252 : 232;

  x.fillStyle = C.gold; x.font = `700 ${story ? 40 : 34}px ${F}`;
  x.fillText("🏆 كأس العالم 2026", W / 2, cy.eb);
  x.fillStyle = "#F4F6FF"; x.font = `900 ${story ? 72 : 56}px ${F}`;
  x.fillText("دور المجموعات", W / 2, cy.ti);
  x.fillStyle = C.gold; x.fillRect(W / 2 - 90, cy.ln, 180, 4);
  x.fillStyle = C.muted; x.font = `700 ${story ? 36 : 30}px ${F}`;
  x.fillText("المجموعة " + groupOf(m.a), W / 2, cy.gr);

  const r = m.r;
  x.font = `${story ? 168 : 138}px ${EM}`;
  x.fillText(flag(m.a), W / 2 + off, cy.fl);
  x.fillText(flag(m.b), W / 2 - off, cy.fl);
  if (r) {
    x.fillStyle = "#fff"; x.font = `900 ${story ? 110 : 90}px ${F}`;
    x.fillText(`${r.h} - ${r.a}`, W / 2, cy.fl);
  } else {
    x.fillStyle = C.gold; x.font = `800 ${story ? 54 : 46}px ${F}`;
    x.fillText("ضد", W / 2, cy.fl);
  }
  x.font = `800 ${story ? 52 : 44}px ${F}`;
  x.fillStyle = r && r.h > r.a ? C.gold : "#F4F6FF"; x.fillText(NAMES[m.a], W / 2 + off, cy.nm);
  x.fillStyle = r && r.a > r.h ? C.gold : "#F4F6FF"; x.fillText(NAMES[m.b], W / 2 - off, cy.nm);

  const bx = 110, bw = W - 2 * bx;
  x.fillStyle = "#F3EFE4"; roundRect(x, bx, cy.bx, bw, cy.bh, 28); x.fill();
  x.strokeStyle = "rgba(255,255,255,0.10)"; x.lineWidth = 2; roundRect(x, bx, cy.bx, bw, cy.bh, 28); x.stroke();
  const rows = [
    "📅  " + m.dow + " · " + m.date,
    "⏰  " + m.t + " " + (m.p === "م" ? "مساءً" : "صباحاً") + " (توقيت السعودية)",
    "📍  " + m.c,
    "📺  " + (m.tv || BROADCASTER),
  ];
  x.fillStyle = "#EAECFF"; x.font = `600 ${story ? 40 : 33}px ${F}`;
  const step = cy.bh / 4;
  rows.forEach((t, i) => x.fillText(t, W / 2, cy.bx + step / 2 + i * step));

  x.fillStyle = "#7E84B8"; x.font = `600 ${story ? 30 : 25}px ${F}`;
  x.fillText("كأس العالم 2026 · بتوقيت السعودية 🇸🇦", W / 2, cy.ft);
  return cv.toDataURL("image/png");
}
async function tryNativeShare(url) {
  try {
    const blob = await (await fetch(url)).blob();
    const file = new File([blob], "match.png", { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], text: "كأس العالم 2026 ⚽" });
      return true;
    }
  } catch (e) {}
  return false;
}

/* ───────────── المباريات ───────────── */
const ShareIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#F6C453" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 16V4M12 4l-4 4M12 4l4 4" /><path d="M5 14v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5" />
  </svg>
);

function Team({ code, goals, lead }) {
  const strong = code === "SA" || lead;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <span style={{ fontSize: 22, lineHeight: 1 }}>{flag(code)}</span>
        <span style={{ color: strong ? C.gold : C.text, fontSize: 16, fontWeight: strong ? 800 : 600 }}>{NAMES[code] || code}</span>
      </div>
      {goals != null && <span style={{ color: lead ? C.gold : C.text, fontWeight: 800, fontSize: 17, minWidth: 22, textAlign: "center" }}>{goals}</span>}
    </div>
  );
}

function MatchRow({ m, dow, date, last, onShare }) {
  const hl = m.a === "SA" || m.b === "SA";
  const r = m.r;
  return (
    <div style={{
      display: "flex", alignItems: "stretch", gap: 12, padding: "14px 4px",
      borderBottom: last ? "none" : `1px solid ${C.line}`,
      background: hl ? "rgba(246,196,83,0.055)" : "transparent", borderRadius: hl ? 12 : 0,
    }}>
      <div style={{
        flex: "0 0 70px", display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", whiteSpace: "nowrap", background: C.goldSoft, borderRadius: 12,
        border: "1px solid rgba(246,196,83,0.25)", padding: "8px 6px",
      }}>
        <span style={{ color: C.gold, fontSize: 18, fontWeight: 800, lineHeight: 1 }}>{m.t}</span>
        <span style={{ color: C.gold, fontSize: 11, opacity: 0.8, marginTop: 3 }}>{m.p === "م" ? "مساءً" : "صباحاً"}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: 6 }}>
        <Team code={m.a} goals={r ? r.h : null} lead={r ? r.h > r.a : false} />
        <div style={{ height: 1, background: C.line, width: "100%" }} />
        <Team code={m.b} goals={r ? r.a : null} lead={r ? r.a > r.h : false} />
        {r && (
          <span style={{
            alignSelf: "flex-start", marginTop: 3, fontSize: 11, fontWeight: 700, padding: "2px 8px",
            borderRadius: 999, color: r.live ? "#FF6B6B" : C.green,
            background: r.live ? "rgba(255,107,107,0.12)" : "rgba(139,228,155,0.12)",
          }}>{r.live ? "🔴 مباشر" : "انتهت"}</span>
        )}
      </div>
      <button onClick={() => onShare({ ...m, dow, date })} aria-label="مشاركة" style={{
        flex: "0 0 38px", width: 38, alignSelf: "center", height: 38, borderRadius: 12, cursor: "pointer",
        background: "rgba(246,196,83,0.10)", border: "1px solid rgba(246,196,83,0.3)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}><ShareIcon /></button>
    </div>
  );
}

function DayBlock({ day, today, onShare }) {
  const n = day.matches.length, isToday = day.iso === today;
  return (
    <section className="block">
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "22px 2px 10px" }}>
        <span style={{
          background: isToday ? "linear-gradient(135deg,#F6C453,#E0962F)" : "linear-gradient(135deg,#7C3AED,#4338CA)",
          color: isToday ? "#2A1B00" : "#fff", fontWeight: 800, fontSize: 15, padding: "8px 16px", borderRadius: 999,
          boxShadow: isToday ? "0 4px 18px rgba(246,196,83,0.45)" : "0 4px 14px rgba(99,60,217,0.35)",
        }}>{isToday && <span className="dot" />}{day.dow} · {day.date}</span>
        {isToday && <span style={{ color: C.gold, fontSize: 12, fontWeight: 800 }}>اليوم</span>}
        <span style={{ flex: 1, height: 1, background: C.line }} />
        <span style={{ color: C.muted, fontSize: 13 }}>{n} {n === 1 ? "مباراة" : "مباريات"}</span>
      </div>
      <div style={{
        background: C.card, borderRadius: 18, padding: "4px 14px",
        border: isToday ? "1px solid rgba(246,196,83,0.4)" : `1px solid ${C.line}`,
      }}>
        {day.matches.map((m, idx) => (
          <MatchRow key={idx} m={m} dow={day.dow} date={day.date} last={idx === n - 1} onShare={onShare} />
        ))}
      </div>
    </section>
  );
}

/* ───────────── الترتيب ───────────── */
const COLW = { p: 30, rec: 48, gd: 36, pts: 40 };
const Cell = ({ w, children, style }) => <span style={{ width: w, textAlign: "center", flex: "0 0 auto", ...style }}>{children}</span>;

function GroupCard({ letter, st }) {
  const order = GROUPS[letter].slice().sort((a, b) =>
    (st[b].pts - st[a].pts) || ((st[b].gf - st[b].ga) - (st[a].gf - st[a].ga)) || (st[b].gf - st[a].gf));
  return (
    <section className="block">
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "22px 2px 10px" }}>
        <span style={{ background: "linear-gradient(135deg,#7C3AED,#4338CA)", color: "#fff", fontWeight: 800, fontSize: 15, padding: "8px 16px", borderRadius: 999 }}>المجموعة {letter}</span>
        <span style={{ flex: 1, height: 1, background: C.line }} />
      </div>
      <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 18, padding: "6px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 2px", color: C.muted, fontSize: 11.5, fontWeight: 700, borderBottom: `1px solid ${C.line}` }}>
          <span style={{ width: 18, flex: "0 0 auto" }}></span>
          <span style={{ flex: 1 }}>الفريق</span>
          <Cell w={COLW.p}>لعب</Cell><Cell w={COLW.rec}>ف-ت-خ</Cell><Cell w={COLW.gd}>±</Cell><Cell w={COLW.pts}>نقاط</Cell>
        </div>
        {order.map((code, i) => {
          const s = st[code], gd = s.gf - s.ga, top = i < 2, ksa = code === "SA";
          return (
            <div key={code} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "9px 2px",
              borderBottom: i === 3 ? "none" : `1px solid ${C.line}`,
              background: top ? "rgba(139,228,155,0.06)" : "transparent",
              borderRight: top ? `2px solid ${C.green}` : "2px solid transparent", borderRadius: top ? 6 : 0,
            }}>
              <span style={{ width: 18, flex: "0 0 auto", textAlign: "center", color: C.muted, fontSize: 12.5 }}>{i + 1}</span>
              <span style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <span style={{ fontSize: 19 }}>{flag(code)}</span>
                <span style={{ color: ksa ? C.gold : C.text, fontWeight: ksa ? 800 : 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{NAMES[code]}</span>
              </span>
              <Cell w={COLW.p} style={{ color: C.muted, fontSize: 13 }}>{s.p}</Cell>
              <Cell w={COLW.rec} style={{ color: C.text, fontSize: 13 }}>{s.w}-{s.d}-{s.l}</Cell>
              <Cell w={COLW.gd} style={{ color: gd > 0 ? C.green : gd < 0 ? "#FF8585" : C.muted, fontSize: 13 }}>{gd > 0 ? `+${gd}` : gd}</Cell>
              <Cell w={COLW.pts} style={{ color: C.gold, fontWeight: 800, fontSize: 15 }}>{s.pts}</Cell>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const Tab = ({ on, onClick, children }) => (
  <button onClick={onClick} style={{
    border: `1px solid ${on ? C.gold : C.line}`, cursor: "pointer", background: on ? C.goldSoft : "transparent",
    color: on ? C.gold : C.muted, fontFamily: "inherit", fontWeight: 700, fontSize: 13.5, padding: "8px 18px", borderRadius: 999,
  }}>{children}</button>
);

/* ───────────── نوافذ المشاركة ───────────── */
function Backdrop({ onClose, children }) {
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(5,7,20,0.78)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50,
    }}>{children}</div>
  );
}

function ShareChooser({ m, onPick, onClose }) {
  const big = (label, sub, emoji, story) => (
    <button onClick={() => onPick(story)} style={{
      flex: 1, cursor: "pointer", color: C.text, fontFamily: "inherit", padding: "16px 10px",
      borderRadius: 16, border: `1px solid ${C.line}`, background: "#F3EFE4",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
    }}>
      <span style={{ fontSize: 30 }}>{emoji}</span>
      <span style={{ fontWeight: 800, fontSize: 15 }}>{label}</span>
      <span style={{ color: C.muted, fontSize: 12 }}>{sub}</span>
    </button>
  );
  return (
    <Backdrop onClose={onClose}>
      <div onClick={(e) => e.stopPropagation()} dir="rtl" style={{ width: "100%", maxWidth: 360, background: "#FFFFFF", border: `1px solid ${C.line}`, borderRadius: 22, padding: 20 }}>
        <div style={{ color: C.gold, fontSize: 13, fontWeight: 700, textAlign: "center" }}>مشاركة البطاقة</div>
        <div style={{ color: C.text, fontSize: 16, fontWeight: 800, textAlign: "center", margin: "6px 0 16px" }}>{NAMES[m.a]} ضد {NAMES[m.b]}</div>
        <div style={{ display: "flex", gap: 12 }}>
          {big("واتساب", "صورة مربعة", "🟢", false)}
          {big("سناب شات", "صورة طولية", "👻", true)}
        </div>
        <button onClick={onClose} style={{ width: "100%", marginTop: 14, cursor: "pointer", color: C.muted, background: "transparent", border: "none", fontFamily: "inherit", fontSize: 13 }}>إلغاء</button>
      </div>
    </Backdrop>
  );
}

function ImageModal({ data, onClose }) {
  const [msg, setMsg] = useState("");
  return (
    <Backdrop onClose={onClose}>
      <div onClick={(e) => e.stopPropagation()} dir="rtl" style={{ width: "100%", maxWidth: data.story ? 300 : 380, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <img src={data.url} alt="بطاقة المباراة" style={{ width: "100%", borderRadius: 16, border: `1px solid ${C.line}`, boxShadow: "0 12px 40px rgba(0,0,0,0.5)" }} />
        <div style={{ color: C.muted, fontSize: 12.5, textAlign: "center", lineHeight: 1.7 }}>👆 اضغط مطوّلاً على الصورة للحفظ في الاستوديو، ثم انشرها</div>
        <div style={{ display: "flex", gap: 10, width: "100%" }}>
          <button onClick={async () => { const ok = await tryNativeShare(data.url); if (!ok) setMsg("اضغط مطوّلاً على الصورة للحفظ 👆"); }} style={{
            flex: 1, cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 14, padding: "12px", borderRadius: 14,
            color: "#FFFFFF", background: "#E0432F", border: "none",
          }}>📲 مشاركة</button>
          <button onClick={onClose} style={{ flex: "0 0 90px", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 14, padding: "12px", borderRadius: 14, color: C.muted, background: "transparent", border: `1px solid ${C.line}` }}>إغلاق</button>
        </div>
        {msg && <div style={{ color: C.gold, fontSize: 12 }}>{msg}</div>}
      </div>
    </Backdrop>
  );
}

export default function App() {
  const [tab, setTab] = useState("schedule");
  const [arabOnly, setArabOnly] = useState(false);
  const [shareFor, setShareFor] = useState(null);
  const [img, setImg] = useState(null);
  const today = todayISO();
  const stats = buildStats();

  const days = SCHEDULE
    .map((d) => ({ ...d, matches: arabOnly ? d.matches.filter((m) => ARAB.includes(m.a) || ARAB.includes(m.b)) : d.matches }))
    .filter((d) => d.matches.length > 0);

  const pick = (story) => { const url = shareImageURL(shareFor, story); setShareFor(null); setImg({ url, story }); };

  return (
    <div dir="rtl" style={{
      minHeight: "100vh", background: "linear-gradient(165deg,#0A1033 0%,#140A3D 55%,#1E0B47 100%)",
      fontFamily: "'Cairo', 'Segoe UI', Tahoma, sans-serif", padding: "26px 16px 50px",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@500;600;700;800;900&display=swap');
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        .wrap { max-width: 520px; margin: 0 auto; }
        .block { animation: rise .45s ease both; }
        .dot { display:inline-block; width:7px; height:7px; border-radius:50%; background:#B4140E; margin-left:7px; vertical-align:middle; animation:pulse 1.4s infinite; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.25} }
        @keyframes rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) { .block{animation:none} .dot{animation:none} }
      `}</style>

      <div className="wrap">
        <header style={{ textAlign: "center", marginBottom: 16 }}>
          <div style={{ color: C.gold, fontSize: 13, fontWeight: 700, letterSpacing: 1 }}>🏆 كأس العالم 2026</div>
          <h1 style={{ color: C.text, fontSize: 30, fontWeight: 900, margin: "4px 0 8px" }}>دور المجموعات</h1>
          <span style={{ display: "inline-block", color: C.muted, fontSize: 13, border: `1px solid ${C.line}`, borderRadius: 999, padding: "5px 14px" }}>بتوقيت السعودية 🇸🇦</span>
          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
            <Tab on={tab === "schedule"} onClick={() => setTab("schedule")}>📅 المباريات</Tab>
            <Tab on={tab === "standings"} onClick={() => setTab("standings")}>📊 الترتيب</Tab>
          </div>
          {tab === "schedule" && (
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 10 }}>
              <Tab on={!arabOnly} onClick={() => setArabOnly(false)}>الكل</Tab>
              <Tab on={arabOnly} onClick={() => setArabOnly(true)}>🟢 المنتخبات العربية</Tab>
            </div>
          )}
        </header>

        {tab === "schedule" ? (
          <>
            {days.map((day, i) => <DayBlock key={i} day={day} today={today} onShare={setShareFor} />)}
            <p style={{ color: C.muted, fontSize: 11.5, textAlign: "center", marginTop: 26, opacity: 0.72, lineHeight: 1.8 }}>
              المواعيد بتوقيت المملكة (مكة) · 📤 زر المشاركة يصنع بطاقة جاهزة لواتساب/سناب
            </p>
          </>
        ) : (
          <>
            <p style={{ color: C.muted, fontSize: 12, textAlign: "center", margin: "0 0 4px", lineHeight: 1.8 }}>
              🟢 أول منتخبين يتأهلان مباشرة (+ أفضل ٨ من أصحاب المركز الثالث)<br/>الترتيب يتحدّث تلقائياً مع كل نتيجة — حتى الآن لُعبت مباراة الافتتاح فقط
            </p>
            {Object.keys(GROUPS).map((g) => <GroupCard key={g} letter={g} st={stats} />)}
          </>
        )}
      </div>

      {shareFor && <ShareChooser m={shareFor} onPick={pick} onClose={() => setShareFor(null)} />}
      {img && <ImageModal data={img} onClose={() => setImg(null)} />}
    </div>
  );
}
