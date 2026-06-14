import React, { useEffect, useMemo, useState } from "react";
import { C } from "../theme";
import { NAMES, GROUPS, flag } from "../data/tournament";
import { dayStars } from "../lib/api";
import { countWord } from "../lib/format";
import { generatePrizeCard, shareBlob, PRIZES } from "../lib/shareCard";
import { TrophyIcon, ShareIcon } from "../icons.jsx";

/* جوائز التحدي النقدية + بطاقة طولية للمشاركة على سناب/ستوري */
function PrizeBanner() {
  const [open, setOpen] = useState(false);   // لوحة المشاركة
  const [preview, setPreview] = useState(null); // { url, blob }
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const make = async () => {
    if (busy) return;
    setOpen(true); setBusy(true); setErr("");
    try {
      const blob = await generatePrizeCard();
      setPreview((p) => { if (p) URL.revokeObjectURL(p.url); return { url: URL.createObjectURL(blob), blob }; });
    } catch { setErr("تعذر إنشاء البطاقة"); }
    setBusy(false);
  };

  return (
    <div className="block" style={{ background: C.card, border: "1px solid rgba(224,67,47,0.4)", borderRadius: 18, padding: "16px 16px 14px", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ color: "#E0432F" }}><TrophyIcon size={18} /></span>
        <span style={{ color: C.text, fontWeight: 900, fontSize: 15.5 }}>جوائز التحدي</span>
        <span className="num" style={{ marginInlineStart: "auto", color: "#FFFFFF", background: "#E0432F",
          fontWeight: 900, fontSize: 13, padding: "5px 12px", borderRadius: 999 }}>{PRIZES.total} ريال</span>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {PRIZES.places.map((p) => (
          <div key={p.rank} style={{ flex: 1, background: "#F3EFE4", border: `1px solid ${C.line}`, borderRadius: 14, padding: "11px 8px", textAlign: "center" }}>
            <span className="num" style={{ width: 26, height: 26, borderRadius: 999, display: "inline-flex", alignItems: "center",
              justifyContent: "center", fontWeight: 900, fontSize: 13, color: "#1A2040", background: p.color }}>{p.rank}</span>
            <div style={{ color: C.muted, fontSize: 11.5, fontWeight: 700, margin: "6px 0 2px" }}>{p.label}</div>
            <div className="num" style={{ color: C.gold, fontWeight: 900, fontSize: 16 }}>{p.amount} ريال</div>
          </div>
        ))}
      </div>
      <button onClick={make} style={{
        width: "100%", marginTop: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 13.5,
        padding: "11px 0", borderRadius: 12, border: "none", color: "#FFFFFF", background: "#E0432F",
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
      }}><ShareIcon size={15} /> شارك جوائز التحدي على سناب</button>

      {open && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.line}`, textAlign: "center" }}>
          {busy && <p style={{ color: C.muted, fontSize: 12.5, margin: 0 }}>جاري تجهيز البطاقة...</p>}
          {err && <p style={{ color: C.red, fontSize: 12.5, margin: 0 }}>{err}</p>}
          {preview && !busy && (
            <>
              <img src={preview.url} alt="بطاقة جوائز التحدي" style={{ width: 165, borderRadius: 14,
                border: `1px solid ${C.line}`, display: "inline-block" }} />
              <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 10 }}>
                <button onClick={() => shareBlob(preview.blob, "جوائز-التحدي.png")} style={{
                  cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 13, padding: "10px 18px",
                  borderRadius: 10, border: "none", color: "#FFFFFF", background: "#E0432F",
                  display: "inline-flex", alignItems: "center", gap: 6 }}><ShareIcon size={14} /> مشاركة / حفظ</button>
                <button onClick={() => setOpen(false)} style={{
                  cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 13, padding: "10px 14px",
                  borderRadius: 10, border: `1px solid ${C.line}`, color: C.muted, background: "transparent" }}>إغلاق</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* نجوم آخر يوم لُعبت فيه مباريات — لجوائز اليوم وروح المنافسة */
function DayStars() {
  const [data, setData] = useState(null);
  useEffect(() => { dayStars().then(setData).catch(() => {}); }, []);
  if (!data?.stars?.length) return null;
  const d = new Date(`${data.date}T12:00:00+03:00`);
  const label = d.toLocaleDateString("ar-SA", { weekday: "long", day: "numeric", month: "long" });
  const medals = ["#EF9F27", "#C9CCDA", "#D8915A"];
  return (
    <div className="block" style={{ background: C.card, border: "1px solid rgba(184,119,26,0.35)", borderRadius: 16, padding: "12px 14px", marginBottom: 16 }}>
      <div style={{ color: C.gold, fontWeight: 800, fontSize: 13.5, display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
        <TrophyIcon size={15} /> نجوم يوم {label}
      </div>
      {data.stars.slice(0, 3).map((s, i) => (
        <div key={`${s.display_name}-${i}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", fontSize: 13.5 }}>
          <span className="num" style={{ width: 24, height: 24, borderRadius: 999, display: "inline-flex", alignItems: "center",
            justifyContent: "center", fontWeight: 900, fontSize: 12, color: "#1A2040", background: medals[i] }}>{i + 1}</span>
          <span style={{ flex: 1, color: C.text, fontWeight: 700, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.display_name}</span>
          <span style={{ color: C.muted, fontSize: 11.5 }}>{countWord(Number(s.exact_count), "إصابة واحدة", "إصابتان", "إصابات")}</span>
          <span className="num" style={{ color: C.gold, fontWeight: 900 }}>{s.points} نقطة</span>
        </div>
      ))}
    </div>
  );
}

const COLW = { p: 30, rec: 48, gd: 36, pts: 40 };
const Cell = ({ w, children, style }) => (
  <span className="num" style={{ width: w, textAlign: "center", flex: "0 0 auto", ...style }}>{children}</span>
);

// الترتيب يُبنى من النتائج المعتمدة في قاعدة البيانات (لا من ملف ثابت)
function buildStats(matches) {
  const st = {};
  Object.values(GROUPS).flat().forEach((t) => (st[t] = { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }));
  (matches || []).forEach((m) => {
    if (m.status !== "finished") return;
    const [a, b] = m.id.split("_").slice(1);
    const A = st[a], B = st[b];
    if (!A || !B) return;
    const h = m.result_h, g = m.result_a;
    A.p++; B.p++; A.gf += h; A.ga += g; B.gf += g; B.ga += h;
    if (h > g) { A.w++; A.pts += 3; B.l++; }
    else if (h < g) { B.w++; B.pts += 3; A.l++; }
    else { A.d++; B.d++; A.pts++; B.pts++; }
  });
  return st;
}

export default function StandingsScreen({ matches }) {
  const st = useMemo(() => buildStats(matches), [matches]);

  // قبل وصول بيانات الخادم لا نعرض أصفارًا مضللة
  if (matches === null) {
    return <p style={{ color: C.muted, fontSize: 13, textAlign: "center", marginTop: 30 }}>جاري تحميل الترتيب...</p>;
  }

  return (
    <>
      <PrizeBanner />
      <DayStars />
      <p style={{ color: C.muted, fontSize: 12, textAlign: "center", margin: "0 0 4px", lineHeight: 1.8 }}>
        <span style={{ color: C.green }}>●</span> أول منتخبين يتأهلان مباشرة (+ أفضل 8 من أصحاب المركز الثالث)
        <br />ترتيب استرشادي يتحدّث تلقائيًا مع كل نتيجة معتمدة
      </p>
      {Object.keys(GROUPS).map((letter) => {
        const order = GROUPS[letter].slice().sort((a, b) =>
          (st[b].pts - st[a].pts) || ((st[b].gf - st[b].ga) - (st[a].gf - st[a].ga)) || (st[b].gf - st[a].gf));
        const hasKsa = GROUPS[letter].includes("SA");
        return (
          <section className="block" key={letter}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "22px 2px 10px" }}>
              <span style={{
                background: hasKsa ? "rgba(43,180,93,0.16)" : C.goldSoft,
                color: hasKsa ? "#2BB45D" : C.gold,
                border: `1px solid ${hasKsa ? "rgba(43,180,93,0.4)" : "rgba(184,119,26,0.35)"}`,
                fontWeight: 800, fontSize: 14, padding: "8px 16px", borderRadius: 999,
              }}>المجموعة {letter}</span>
              <span style={{ flex: 1, height: 1, background: C.line }} />
            </div>
            <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 18, padding: "6px 12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 2px", color: C.muted, fontSize: 11.5, fontWeight: 700, borderBottom: `1px solid ${C.line}` }}>
                <span style={{ width: 18, flex: "0 0 auto" }} />
                <span style={{ flex: 1 }}>الفريق</span>
                <Cell w={COLW.p}>لعب</Cell><Cell w={COLW.rec}>ف-ت-خ</Cell><Cell w={COLW.gd}>±</Cell><Cell w={COLW.pts}>نقاط</Cell>
              </div>
              {order.map((code, i) => {
                const s = st[code], gd = s.gf - s.ga, top = i < 2, ksa = code === "SA";
                return (
                  <div key={code} style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "9px 2px",
                    borderBottom: i === 3 ? "none" : `1px solid ${C.line}`,
                    background: top ? "rgba(22,143,91,0.06)" : "transparent",
                    borderRight: top ? `2px solid ${C.green}` : "2px solid transparent", borderRadius: top ? 6 : 0,
                  }}>
                    <span className="num" style={{ width: 18, flex: "0 0 auto", textAlign: "center", color: C.muted, fontSize: 12.5 }}>{i + 1}</span>
                    <span style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                      <span style={{ fontSize: 19 }}>{flag(code)}</span>
                      <span style={{ color: ksa ? C.gold : C.text, fontWeight: ksa ? 800 : 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{NAMES[code]}</span>
                    </span>
                    <Cell w={COLW.p} style={{ color: C.muted, fontSize: 13 }}>{s.p}</Cell>
                    {/* القيمة LTR بترتيب خ-ت-ف: تحت رأس «ف-ت-خ» العربي يقع الفوز يمينًا كما يُقرأ */}
                    <Cell w={COLW.rec} style={{ color: C.text, fontSize: 13 }}>
                      <span dir="ltr">{s.l}-{s.d}-{s.w}</span>
                    </Cell>
                    <Cell w={COLW.gd} style={{ color: gd > 0 ? C.green : gd < 0 ? "#C24736" : C.muted, fontSize: 13 }}>
                      <span dir="ltr">{gd > 0 ? `+${gd}` : gd}</span>
                    </Cell>
                    <Cell w={COLW.pts} style={{ color: C.gold, fontWeight: 800, fontSize: 15 }}>{s.pts}</Cell>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </>
  );
}
