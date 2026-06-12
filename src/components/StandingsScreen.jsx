import React, { useMemo } from "react";
import { C } from "../theme";
import { NAMES, GROUPS, flag } from "../data/tournament";

const COLW = { p: 30, rec: 48, gd: 36, pts: 40 };
const Cell = ({ w, children, style }) => (
  <span style={{ width: w, textAlign: "center", flex: "0 0 auto", ...style }}>{children}</span>
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
  return (
    <>
      <p style={{ color: C.muted, fontSize: 12, textAlign: "center", margin: "0 0 4px", lineHeight: 1.8 }}>
        🟢 أول منتخبين يتأهلان مباشرة (+ أفضل ٨ من أصحاب المركز الثالث)<br />الترتيب يتحدّث تلقائيًا مع كل نتيجة معتمدة
      </p>
      {Object.keys(GROUPS).map((letter) => {
        const order = GROUPS[letter].slice().sort((a, b) =>
          (st[b].pts - st[a].pts) || ((st[b].gf - st[b].ga) - (st[a].gf - st[a].ga)) || (st[b].gf - st[a].gf));
        return (
          <section className="block" key={letter}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "22px 2px 10px" }}>
              <span style={{ background: "linear-gradient(135deg,#7C3AED,#4338CA)", color: "#fff", fontWeight: 800, fontSize: 15, padding: "8px 16px", borderRadius: 999 }}>المجموعة {letter}</span>
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
      })}
    </>
  );
}
