import React, { useEffect, useMemo, useRef, useState } from "react";
import { C } from "../theme";
import { NAMES, ARAB, SCHEDULE, flag, todayISO, matchId, kickoffISO } from "../data/tournament";
import { submitPrediction } from "../lib/api";
import { digitsOnly, countWord, STAGE_POINTS, STAGE_NAMES, stagePoints, ksaParts } from "../lib/format";
import { LockIcon, ClockIcon, UsersIcon, PinIcon, TrophyIcon } from "../icons.jsx";

const KSA_GREEN = "#1B9E4B";

/* عدّاد حي حتى لحظة قفل التوقعات — مُزامَن مع ساعة الخادم عبر clockOffset
   فتغيير ساعة الجهاز لا يغيّر الوقت المعروض (والقفل الفعلي في الخادم أصلًا) */
function useCountdown(locksAt, clockOffset = 0) {
  const calc = () => new Date(locksAt) - (Date.now() + clockOffset);
  const [left, setLeft] = useState(calc);
  useEffect(() => {
    const t = setInterval(() => setLeft(calc()), 1000);
    return () => clearInterval(t);
  }, [locksAt, clockOffset]);
  return left;
}

function fmtLeft(ms) {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600),
        m = Math.floor((s % 3600) / 60), ss = s % 60;
  if (d > 0) return `${d} يوم و ${h} ساعة`;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  return `${m}:${String(ss).padStart(2, "0")}`;
}

const numStyle = {
  width: 46, textAlign: "center", fontSize: 18, fontWeight: 800,
  color: C.text, background: "#FFFFFF",
  border: `1px solid ${C.line}`, borderRadius: 10, padding: "9px 0", outline: "none",
  fontVariantNumeric: "tabular-nums",
};

const isExact = (st) => st?.my_h != null && st.my_h === st.result_h && st.my_a === st.result_a;

/* ───── شريط الحماس: حققت / فاتك / متبقي حتى النهائي ───── */
function ProgressStrip({ matches }) {
  if (!matches?.length) return null;
  let achieved = 0, lost = 0, remaining = 0;
  matches.forEach((m) => {
    if (m.status === "cancelled") return;
    const pts = stagePoints(m.stage);
    if (m.status === "finished") { if (isExact(m)) achieved += pts; else lost += pts; }
    else remaining += pts;
  });
  const total = achieved + lost + remaining;
  if (!total) return null;
  const pct = (v) => `${(v / total) * 100}%`;
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: "12px 14px", margin: "12px 0 4px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ color: C.text, fontWeight: 800, fontSize: 13 }}>رحلتك نحو النهائي</span>
        <span className="num" style={{ color: C.gold, fontWeight: 900, fontSize: 15 }}>{achieved} <span style={{ fontSize: 11, fontWeight: 700 }}>نقطة</span></span>
      </div>
      <div style={{ display: "flex", height: 8, borderRadius: 999, overflow: "hidden", background: "#F3EFE4" }}>
        {achieved > 0 && <span style={{ width: pct(achieved), background: "#EF9F27" }} />}
        {lost > 0 && <span style={{ width: pct(lost), background: "rgba(255,107,107,0.45)" }} />}
        {remaining > 0 && <span style={{ width: pct(remaining), background: "rgba(43,180,93,0.4)" }} />}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11, fontWeight: 700, flexWrap: "wrap", gap: 6 }}>
        <span style={{ color: C.gold }}>حققت {countWord(achieved, "نقطة واحدة", "نقطتين", "نقاط")}</span>
        <span style={{ color: "#FF9B9B" }}>فاتك {countWord(lost, "نقطة واحدة", "نقطتين", "نقاط")}</span>
        <span style={{ color: KSA_GREEN }}>متبقٍ {countWord(remaining, "نقطة واحدة", "نقطتين", "نقاط")} متاحة</span>
      </div>
      <div style={{ color: C.muted, fontSize: 10.5, marginTop: 6, textAlign: "center", opacity: 0.85 }}>
        النهائي وحده يساوي 20 نقطة — لا أحد محسوم قبل النهاية
      </div>
    </div>
  );
}

/* ───── شرح النقاط — واضح لكل الأعضاء ───── */
function RulesCard() {
  const [open, setOpen] = useState(false);
  const order = ["group", "r32", "r16", "qf", "sf", "f"];
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, margin: "8px 0 4px", overflow: "hidden" }}>
      <button onClick={() => setOpen(!open)} style={{
        width: "100%", background: "transparent", border: "none", cursor: "pointer",
        fontFamily: "inherit", color: C.gold, fontWeight: 800, fontSize: 13,
        padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><TrophyIcon size={15} /> كيف تُحسب النقاط؟</span>
        <span style={{ color: C.muted }}>{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div style={{ padding: "0 14px 14px", fontSize: 12.5, color: C.text, lineHeight: 2 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(95px, 1fr))", gap: 8, marginBottom: 10 }}>
            {order.map((s) => (
              <div key={s} style={{ background: "#F3EFE4", borderRadius: 10, padding: "8px 4px", textAlign: "center" }}>
                <div className="num" style={{ color: C.gold, fontWeight: 900, fontSize: 17 }}>{STAGE_POINTS[s]}</div>
                <div style={{ color: C.muted, fontSize: 10.5 }}>{STAGE_NAMES[s]}</div>
              </div>
            ))}
          </div>
          <div style={{ color: C.muted, fontSize: 12, lineHeight: 1.9 }}>
            • التوقع الصحيح = <b style={{ color: C.text }}>النتيجة بالضبط</b> (توقعت 2–1 وانتهت 2–1) — وتأخذ نقاط مرحلتها كاملة، وأي نتيجة أخرى صفر.<br />
            • التوقعات <b style={{ color: C.text }}>تُقفل عند انطلاق المباراة بتوقيت مكة</b> — وبعد القفل لا يمكن التعديل أبدًا، وتغيير ساعة جهازك لا يفيد.<br />
            • يمكنك تعديل توقعك بحرية قبل انطلاق المباراة، ويُسجَّل وقت آخر تعديل.<br />
            • عند تساوي النقاط: <b style={{ color: C.text }}>الأسبق في تسجيل توقعاته الصحيحة يتقدم</b> — حتى لو بفارق ثوانٍ، وأوقات الجميع معروضة بعد القفل للمصداقية.
          </div>
        </div>
      )}
    </div>
  );
}

/* خانة التوقع داخل بطاقة المباراة */
function PredictionBox({ m, state, onChanged, clockOffset }) {
  const [h, setH] = useState(state?.my_h ?? "");
  const [a, setA] = useState(state?.my_a ?? "");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false); // التوقع المحفوظ لا يُعدَّل إلا بزر «تعديل»

  const locksAt = state?.locks_at || new Date(new Date(m.kickoff).getTime() - 5000).toISOString();
  const left = useCountdown(locksAt, clockOffset);
  const finished = state?.status === "finished";
  const locked = finished || left <= 0;
  const saved = state?.my_h != null;
  const pts = stagePoints(state?.stage || m.stage);

  // نتيجة منتهية + كان عندي توقع → اعرض نقاطي عليها
  if (finished) {
    if (!saved) return <Note muted>لم تتوقع هذه المباراة</Note>;
    const exact = isExact(state);
    return (
      <Note gold={exact}>
        توقعت {state.my_h}–{state.my_a} · {exact ? `+${pts} ${pts >= 3 ? "نقاط" : "نقطة"} — توقع صحيح!` : "بدون نقاط"}
      </Note>
    );
  }

  if (locked)
    return (
      <Note muted>
        <LockIcon size={13} /> أُقفلت التوقعات{saved ? ` · توقعك: ${state.my_h}–${state.my_a}` : " — فاتك التوقع"}
      </Note>
    );

  const save = async () => {
    if (busy) return;
    if (h === "" || a === "") { setMsg("أدخل النتيجة كاملة"); return; }
    setBusy(true); setMsg("");
    try {
      await submitPrediction(m.id, Number(h), Number(a));
      setMsg("تم حفظ توقعك ✓");
      setEditing(false);
      onChanged?.();
    } catch (e) { setMsg(e.message); }
    setBusy(false);
  };

  const readOnly = saved && !editing; // المحفوظ يُعرض مقفولًا حتى يضغط «تعديل التوقع»
  const urgent = left < 60_000;
  return (
    <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 12, background: "rgba(239,159,39,0.07)", border: `1px solid rgba(184,119,26,0.28)` }}>
      <div style={{ textAlign: "center", color: C.muted, fontSize: 11.5, fontWeight: 700, marginBottom: 8 }}>
        أصِب النتيجة بالضبط واكسب <b style={{ color: C.gold }}>{countWord(pts, "نقطة واحدة", "نقطتين", "نقاط")}</b>
        <span style={{ opacity: 0.75 }}> — أي نتيجة أخرى بدون نقاط</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
        <span style={{ flex: 1, minWidth: 0, color: C.muted, fontSize: 12, fontWeight: 700, textAlign: "left",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{NAMES[m.a]}</span>
        <input inputMode="numeric" maxLength={2} value={h} disabled={readOnly}
          onChange={(e) => setH(digitsOnly(e.target.value))}
          style={{ ...numStyle, opacity: readOnly ? 0.65 : 1 }} aria-label={`أهداف ${NAMES[m.a]}`} />
        <span style={{ color: C.muted, fontWeight: 800 }}>–</span>
        <input inputMode="numeric" maxLength={2} value={a} disabled={readOnly}
          onChange={(e) => setA(digitsOnly(e.target.value))}
          style={{ ...numStyle, opacity: readOnly ? 0.65 : 1 }} aria-label={`أهداف ${NAMES[m.b]}`} />
        <span style={{ flex: 1, minWidth: 0, color: C.muted, fontSize: 12, fontWeight: 700, textAlign: "right",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{NAMES[m.b]}</span>
      </div>
      {readOnly ? (
        <button onClick={() => { setEditing(true); setMsg(""); }} style={{
          width: "100%", marginTop: 10, cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 14,
          padding: "11px 0", borderRadius: 10, color: C.gold, background: "transparent",
          border: "1px solid rgba(184,119,26,0.45)",
        }}>تعديل التوقع</button>
      ) : (
        <button onClick={save} disabled={busy} style={{
          width: "100%", marginTop: 10, cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 14,
          padding: "11px 0", borderRadius: 10, border: "none", color: "#FFFFFF",
          background: "#E0432F", opacity: busy ? 0.6 : 1,
        }}>{busy ? "لحظات..." : saved ? "حفظ التعديل" : "أرسل توقعك"}</button>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, fontSize: 11.5 }}>
        <span className="num" style={{ color: urgent ? C.red : C.muted, fontWeight: urgent ? 800 : 600,
          animation: urgent ? "pulse 1.2s infinite" : "none", display: "inline-flex", alignItems: "center", gap: 5 }}>
          <ClockIcon size={13} /> يُقفل بعد {fmtLeft(left)}
        </span>
        {state?.predictors > 0 && (
          <span style={{ color: C.muted, display: "inline-flex", alignItems: "center", gap: 5 }}>
            <UsersIcon size={13} /> {countWord(state.predictors, "متوقّع واحد", "متوقّعان", "متوقّعين")}
          </span>
        )}
      </div>
      {msg && <div style={{ color: msg.includes("✓") ? C.green : C.red, fontSize: 12, marginTop: 6, textAlign: "center" }}>{msg}</div>}
    </div>
  );
}

const Note = ({ children, muted, gold }) => (
  <div style={{
    marginTop: 10, padding: "8px 12px", borderRadius: 10, fontSize: 12.5, fontWeight: 700,
    color: gold ? C.gold : muted ? C.muted : C.text,
    background: gold ? C.goldSoft : "#F3EFE4",
    border: `1px solid ${gold ? "rgba(184,119,26,0.35)" : C.line}`, textAlign: "center",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
  }}>{children}</div>
);

function Team({ code, goals, lead, flash }) {
  const strong = code === "SA" || lead;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <span style={{ fontSize: 22, lineHeight: 1 }}>{flag(code)}</span>
        <span style={{ color: strong ? C.gold : C.text, fontSize: 16, fontWeight: strong ? 800 : 600 }}>{NAMES[code] || code}</span>
      </div>
      {goals != null && (
        <span key={goals} className="num" style={{ color: lead ? C.gold : C.text, fontWeight: 800, fontSize: 17, minWidth: 22,
          textAlign: "center", display: "inline-block",
          animation: flash ? "scorebounce 0.9s ease-in-out infinite" : "none" }}>{goals}</span>
      )}
    </div>
  );
}

function MatchRow({ m, state, last, onChanged, clockOffset }) {
  const ksa = m.a === "SA" || m.b === "SA";
  const fin = state?.status === "finished";
  const live = !fin && state?.live_h != null; // نتيجة لحظية من المزامنة التلقائية
  const gA = fin ? state.result_h : live ? state.live_h : null;
  const gB = fin ? state.result_a : live ? state.live_a : null;
  const ksaWon = fin && ksa &&
    ((m.a === "SA" && state.result_h > state.result_a) || (m.b === "SA" && state.result_a > state.result_h));

  // كشف الهدف: ارتفاع النتيجة الحية بين تحديثين ← احتفال 12 ثانية + قوووول 4 ثوانٍ
  const [goal, setGoal] = useState(null);   // 'a' | 'b' | 'both'
  const [shout, setShout] = useState(false); // «قوووول!» عبر الشاشة
  const prevLive = useRef({ h: state?.live_h, a: state?.live_a });
  useEffect(() => {
    const ph = prevLive.current.h, pa = prevLive.current.a;
    const nh = state?.live_h, na = state?.live_a;
    if (nh != null && ph != null && (nh > ph || na > pa)) {
      setGoal(nh > ph && na > pa ? "both" : nh > ph ? "a" : "b");
      setShout(true);
      const t1 = setTimeout(() => setGoal(null), 12_000);
      const t2 = setTimeout(() => setShout(false), 4_000);
      prevLive.current = { h: nh, a: na };
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
    prevLive.current = { h: nh, a: na };
  }, [state?.live_h, state?.live_a]);
  return (
    <div id={`match-${m.id}`} style={{
      padding: "14px 6px", borderBottom: last ? "none" : `1px solid ${C.line}`,
      background: ksa ? "rgba(43,180,93,0.07)" : "transparent", borderRadius: ksa ? 12 : 0,
      borderRight: ksa ? `3px solid ${KSA_GREEN}` : "3px solid transparent",
      scrollMarginTop: 10,
    }}>
      {ksa && (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 8,
          background: "rgba(43,180,93,0.14)", border: `1px solid rgba(43,180,93,0.35)`,
          color: KSA_GREEN, fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 999 }}>
          {flag("SA")} مباراة الأخضر
        </div>
      )}
      <div style={{ display: "flex", alignItems: "stretch", gap: 12 }}>
        <div style={{
          flex: "0 0 74px", display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", background: C.goldSoft, borderRadius: 12,
          border: "1px solid rgba(184,119,26,0.3)", padding: "8px 4px", gap: 2,
        }}>
          <span className="num" style={{ color: C.gold, fontSize: 18, fontWeight: 800, lineHeight: 1 }}>{m.t}</span>
          <span style={{ color: C.gold, fontSize: 11, opacity: 0.8 }}>{m.p === "م" ? "مساءً" : "صباحاً"}</span>
          {m.c && (
            <span style={{ color: C.muted, fontSize: 9.5, textAlign: "center", lineHeight: 1.4,
              display: "inline-flex", alignItems: "center", gap: 3, marginTop: 2 }}>
              <PinIcon size={10} />{m.c}
            </span>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: 6 }}>
          <Team code={m.a} goals={gA} lead={gA != null && gA > gB} flash={live && (goal === "a" || goal === "both")} />
          <div style={{ height: 1, background: C.line, width: "100%" }} />
          <Team code={m.b} goals={gB} lead={gB != null && gB > gA} flash={live && (goal === "b" || goal === "both")} />
          {shout && (
            <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center",
              justifyContent: "center", pointerEvents: "none", background: "rgba(10,16,51,0.45)" }}>
              <div style={{ textAlign: "center", animation: "goalshout 4s ease forwards" }}>
                <div style={{ fontSize: "clamp(52px, 17vw, 110px)", fontWeight: 900, lineHeight: 1,
                  color: "#FFD23F",

                  textShadow: "0 0 50px rgba(184,119,26,0.4)", letterSpacing: "-2px" }}>
                  قوووول!
                </div>
                <div style={{ color: "#fff", fontSize: "clamp(16px, 5vw, 26px)", fontWeight: 800, marginTop: 8,
                  textShadow: "0 2px 16px rgba(0,0,0,0.6)" }}>
                  {goal === "a" ? NAMES[m.a] : goal === "b" ? NAMES[m.b] : ""} {gA}–{gB}
                </div>
              </div>
            </div>
          )}
          {fin && (
            <span style={{ alignSelf: "flex-start", marginTop: 3, fontSize: 11, fontWeight: 700, padding: "2px 8px",
              borderRadius: 999, color: ksaWon ? KSA_GREEN : C.green,
              background: ksaWon ? "rgba(43,180,93,0.16)" : "rgba(139,228,155,0.12)" }}>
              {ksaWon ? "فاز الأخضر!" : "انتهت"}
            </span>
          )}
          {live && (
            <span style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 10px",
                borderRadius: 999, color: C.red, background: "rgba(255,107,107,0.13)",
                border: "1px solid rgba(255,107,107,0.35)", animation: "pulse 1.6s infinite" }}>
                ● مباشر الآن
              </span>
              {goal && (
                <span style={{ fontSize: 12, fontWeight: 900, padding: "3px 12px", borderRadius: 999,
                  color: "#FFFFFF", background: "#E0432F",
                  boxShadow: "0 0 16px rgba(224,67,47,0.55)", animation: "goalpop .9s ease" }}>
                  هدف{goal === "a" ? ` لـ${NAMES[m.a]}` : goal === "b" ? ` لـ${NAMES[m.b]}` : ""}!
                </span>
              )}
            </span>
          )}
        </div>
      </div>
      <PredictionBox m={m} state={state} onChanged={onChanged} clockOffset={clockOffset} />
    </div>
  );
}

export default function ScheduleScreen({ matches, onChanged, clockOffset = 0 }) {
  const [arabOnly, setArabOnly] = useState(false);
  const today = todayISO();
  // فهرس حالة الخادم لكل مباراة (توقعي، النتيجة، لحظة القفل...)
  const byId = useMemo(() => Object.fromEntries((matches || []).map((r) => [r.id, r])), [matches]);

  const staticDays = SCHEDULE.map((d) => ({
    ...d,
    matches: d.matches.map((m) => ({ ...m, id: matchId(d.iso, m.a, m.b), kickoff: kickoffISO(d.iso, m.t, m.p) })),
  }));

  // مباريات الأدوار الإقصائية تُضاف في الخادم تلقائيًا — نبنيها هنا ديناميكيًا
  const staticIds = useMemo(() => new Set(staticDays.flatMap((d) => d.matches.map((m) => m.id))), []);
  const dynamicDays = useMemo(() => {
    const extra = (matches || []).filter((r) => !staticIds.has(r.id) && r.status !== "cancelled");
    const byDay = {};
    extra.forEach((r) => {
      const [, a, b] = r.id.split("_");
      const k = ksaParts(r.kickoff_at);
      byDay[k.iso] ||= { iso: k.iso, dow: k.dow, date: k.date, stage: r.stage, matches: [] };
      byDay[k.iso].matches.push({ id: r.id, a, b, t: k.t, p: k.p, kickoff: r.kickoff_at, stage: r.stage });
    });
    Object.values(byDay).forEach((d) => d.matches.sort((x, y) => new Date(x.kickoff) - new Date(y.kickoff)));
    return Object.values(byDay).sort((x, y) => (x.iso < y.iso ? -1 : 1));
  }, [matches]);

  const days = [...staticDays, ...dynamicDays]
    .map((d) => ({
      ...d,
      matches: d.matches.filter((m) => !arabOnly || ARAB.includes(m.a) || ARAB.includes(m.b)),
    }))
    .filter((d) => d.matches.length > 0);

  // قفزة تلقائية للمباراة الحية، وإلا القادمة الأقرب — مرة واحدة بعد وصول البيانات
  // (إن كانت كل المباريات منتهية تبقى الصفحة من أعلاها)
  const didScroll = useRef(false);
  useEffect(() => {
    if (didScroll.current || !matches?.length) return;
    const target = matches.find((r) => r.status === "scheduled"); // مرتبة بوقت الانطلاق: الحية أولًا ثم القادمة
    if (!target || matches[0]?.id === target.id) { didScroll.current = true; return; }
    didScroll.current = true;
    setTimeout(() => {
      document.getElementById(`match-${target.id}`)?.scrollIntoView({ block: "start", behavior: "instant" });
    }, 120);
  }, [matches]);

  return (
    <>
      <ProgressStrip matches={matches} />
      <RulesCard />
      <div style={{ display: "flex", justifyContent: "center", gap: 8, margin: "10px 0 4px" }}>
        {[["كل المباريات", false], ["المنتخبات العربية", true]].map(([label, v]) => (
          <button key={label} onClick={() => setArabOnly(v)} style={{
            border: `1px solid ${arabOnly === v ? C.gold : C.line}`, cursor: "pointer",
            background: arabOnly === v ? C.goldSoft : "transparent", color: arabOnly === v ? C.gold : C.muted,
            fontFamily: "inherit", fontWeight: 700, fontSize: 13, padding: "9px 16px", borderRadius: 999,
          }}>{label}</button>
        ))}
      </div>

      {days.map((day) => {
        const isToday = day.iso === today;
        const hasKsa = day.matches.some((m) => m.a === "SA" || m.b === "SA");
        return (
          <section className="block" key={`${day.iso}${day.stage || ""}`}
            id={`day-${day.iso}${day.stage ? `-${day.stage}` : ""}`} style={{ scrollMarginTop: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "22px 2px 10px" }}>
              <span style={{
                background: isToday ? "#2B6BE4" : hasKsa ? "rgba(43,180,93,0.16)" : "#F3EFE4",
                color: isToday ? "#FFFFFF" : hasKsa ? KSA_GREEN : C.muted,
                border: isToday ? "none" : `1px solid ${hasKsa ? "rgba(43,180,93,0.4)" : C.line}`,
                fontWeight: 800, fontSize: 14, padding: "8px 16px", borderRadius: 999,
              }}>{day.dow} · {day.date}</span>
              {day.stage && day.stage !== "group" && (
                <span style={{ color: "#B68CFF", fontSize: 11.5, fontWeight: 800, background: "rgba(124,58,237,0.14)",
                  border: "1px solid rgba(124,58,237,0.4)", padding: "4px 10px", borderRadius: 999 }}>
                  {STAGE_NAMES[day.stage]} · {STAGE_POINTS[day.stage]} نقاط
                </span>
              )}
              {isToday && <span style={{ color: C.gold, fontSize: 12, fontWeight: 800 }}>اليوم</span>}
              <span style={{ flex: 1, height: 1, background: C.line }} />
              <span style={{ color: C.muted, fontSize: 13 }}>
                {countWord(day.matches.length, "مباراة واحدة", "مباراتان", "مباريات")}
              </span>
            </div>
            <div style={{ background: C.card, borderRadius: 18, padding: "4px 14px", border: isToday ? "1px solid rgba(184,119,26,0.4)" : `1px solid ${C.line}` }}>
              {day.matches.map((m, i) => (
                <MatchRow key={m.id} m={{ ...m, stage: byId[m.id]?.stage || m.stage }} state={byId[m.id]}
                  last={i === day.matches.length - 1} onChanged={onChanged} clockOffset={clockOffset} />
              ))}
            </div>
          </section>
        );
      })}
      <p style={{ color: C.muted, fontSize: 11.5, textAlign: "center", marginTop: 26, opacity: 0.72, lineHeight: 1.8 }}>
        المواعيد بتوقيت مكة المكرمة · التوقع الصحيح = النتيجة بالضبط · التوقعات تُقفل عند انطلاق المباراة
      </p>
    </>
  );
}
