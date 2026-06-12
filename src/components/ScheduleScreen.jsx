import React, { useEffect, useMemo, useState } from "react";
import { C } from "../theme";
import { NAMES, ARAB, SCHEDULE, flag, todayISO, matchId } from "../data/tournament";
import { submitPrediction } from "../lib/api";

/* عدّاد حي حتى لحظة قفل التوقعات (قبل الانطلاق بـ 5 ثوانٍ)
   ملاحظة: هذا للعرض فقط — القفل الحقيقي يفرضه الخادم بوقته هو */
function useCountdown(locksAt) {
  const [left, setLeft] = useState(() => new Date(locksAt) - Date.now());
  useEffect(() => {
    const t = setInterval(() => setLeft(new Date(locksAt) - Date.now()), 1000);
    return () => clearInterval(t);
  }, [locksAt]);
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
  color: C.text, background: "rgba(255,255,255,0.06)",
  border: `1px solid ${C.line}`, borderRadius: 10, padding: "8px 0", outline: "none",
};

/* خانة التوقع داخل بطاقة المباراة */
function PredictionBox({ m, state, onChanged }) {
  const [h, setH] = useState(state?.my_h ?? "");
  const [a, setA] = useState(state?.my_a ?? "");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const locksAt = state?.locks_at || new Date(new Date(m.kickoff).getTime() - 5000).toISOString();
  const left = useCountdown(locksAt);
  const finished = state?.status === "finished";
  const locked = finished || left <= 0;
  const saved = state?.my_h != null;

  // نتيجة منتهية + كان عندي توقع → اعرض نقاطي عليها
  if (finished) {
    if (!saved) return <Note muted>لم تتوقع هذه المباراة</Note>;
    const exact = state.my_h === state.result_h && state.my_a === state.result_a;
    const dir = Math.sign(state.my_h - state.my_a) === Math.sign(state.result_h - state.result_a);
    const diff = dir && (state.my_h - state.my_a) === (state.result_h - state.result_a);
    const pts = exact ? 5 : diff ? 3 : dir ? 1 : 0;
    return (
      <Note gold={pts > 0}>
        توقعت {state.my_h}–{state.my_a} → {pts > 0 ? `+${pts} نقاط ${exact ? "🎯 نتيجة دقيقة!" : ""}` : "بدون نقاط"}
      </Note>
    );
  }

  if (locked)
    return <Note muted>🔒 أُقفلت التوقعات{saved ? ` · توقعك: ${state.my_h}–${state.my_a}` : " — فاتك التوقع"}</Note>;

  const save = async () => {
    if (h === "" || a === "") { setMsg("أدخل النتيجة كاملة"); return; }
    setBusy(true); setMsg("");
    try {
      await submitPrediction(m.id, Number(h), Number(a));
      setMsg("✅ تم حفظ توقعك");
      onChanged?.();
    } catch (e) { setMsg(e.message); }
    setBusy(false);
  };

  const urgent = left < 60_000;
  return (
    <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 12, background: "rgba(246,196,83,0.05)", border: `1px solid rgba(246,196,83,0.18)` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center" }}>
        <span style={{ color: C.muted, fontSize: 12, fontWeight: 700 }}>{NAMES[m.a]}</span>
        <input inputMode="numeric" maxLength={2} value={h}
          onChange={(e) => setH(e.target.value.replace(/\D/g, ""))} style={numStyle} aria-label={`أهداف ${NAMES[m.a]}`} />
        <span style={{ color: C.muted, fontWeight: 800 }}>–</span>
        <input inputMode="numeric" maxLength={2} value={a}
          onChange={(e) => setA(e.target.value.replace(/\D/g, ""))} style={numStyle} aria-label={`أهداف ${NAMES[m.b]}`} />
        <span style={{ color: C.muted, fontSize: 12, fontWeight: 700 }}>{NAMES[m.b]}</span>
        <button onClick={save} disabled={busy} style={{
          cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 13,
          padding: "9px 14px", borderRadius: 10, border: "none", color: "#2A1B00",
          background: "linear-gradient(135deg,#F6C453,#E0962F)", opacity: busy ? 0.6 : 1,
        }}>{saved ? "تعديل" : "توقّع"}</button>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11.5 }}>
        <span style={{ color: urgent ? C.red : C.muted, fontWeight: urgent ? 800 : 600, animation: urgent ? "pulse 1.2s infinite" : "none" }}>
          ⏳ يُقفل التوقع بعد {fmtLeft(left)}
        </span>
        {state?.predictors > 0 && <span style={{ color: C.muted }}>👥 {state.predictors} متوقّع</span>}
      </div>
      {msg && <div style={{ color: msg.startsWith("✅") ? C.green : C.red, fontSize: 12, marginTop: 6, textAlign: "center" }}>{msg}</div>}
    </div>
  );
}

const Note = ({ children, muted, gold }) => (
  <div style={{
    marginTop: 10, padding: "8px 12px", borderRadius: 10, fontSize: 12.5, fontWeight: 700,
    color: gold ? C.gold : muted ? C.muted : C.text,
    background: gold ? C.goldSoft : "rgba(255,255,255,0.04)",
    border: `1px solid ${gold ? "rgba(246,196,83,0.3)" : C.line}`, textAlign: "center",
  }}>{children}</div>
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

function MatchRow({ m, state, last, onChanged }) {
  const hl = m.a === "SA" || m.b === "SA";
  const fin = state?.status === "finished";
  return (
    <div style={{
      padding: "14px 4px", borderBottom: last ? "none" : `1px solid ${C.line}`,
      background: hl ? "rgba(246,196,83,0.055)" : "transparent", borderRadius: hl ? 12 : 0,
    }}>
      <div style={{ display: "flex", alignItems: "stretch", gap: 12 }}>
        <div style={{
          flex: "0 0 70px", display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", whiteSpace: "nowrap", background: C.goldSoft, borderRadius: 12,
          border: "1px solid rgba(246,196,83,0.25)", padding: "8px 6px",
        }}>
          <span style={{ color: C.gold, fontSize: 18, fontWeight: 800, lineHeight: 1 }}>{m.t}</span>
          <span style={{ color: C.gold, fontSize: 11, opacity: 0.8, marginTop: 3 }}>{m.p === "م" ? "مساءً" : "صباحاً"}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: 6 }}>
          <Team code={m.a} goals={fin ? state.result_h : null} lead={fin && state.result_h > state.result_a} />
          <div style={{ height: 1, background: C.line, width: "100%" }} />
          <Team code={m.b} goals={fin ? state.result_a : null} lead={fin && state.result_a > state.result_h} />
          {fin && <span style={{ alignSelf: "flex-start", marginTop: 3, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, color: C.green, background: "rgba(139,228,155,0.12)" }}>انتهت</span>}
        </div>
      </div>
      <PredictionBox m={m} state={state} onChanged={onChanged} />
    </div>
  );
}

export default function ScheduleScreen({ matches, onChanged }) {
  const [arabOnly, setArabOnly] = useState(false);
  const today = todayISO();
  // فهرس حالة الخادم لكل مباراة (توقعي، النتيجة، لحظة القفل...)
  const byId = useMemo(() => Object.fromEntries((matches || []).map((r) => [r.id, r])), [matches]);

  const days = SCHEDULE
    .map((d) => ({
      ...d,
      matches: d.matches
        .map((m) => ({ ...m, id: matchId(d.iso, m.a, m.b) }))
        .filter((m) => !arabOnly || ARAB.includes(m.a) || ARAB.includes(m.b)),
    }))
    .filter((d) => d.matches.length > 0);

  return (
    <>
      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 4 }}>
        {[["الكل", false], ["🟢 المنتخبات العربية", true]].map(([label, v]) => (
          <button key={label} onClick={() => setArabOnly(v)} style={{
            border: `1px solid ${arabOnly === v ? C.gold : C.line}`, cursor: "pointer",
            background: arabOnly === v ? C.goldSoft : "transparent", color: arabOnly === v ? C.gold : C.muted,
            fontFamily: "inherit", fontWeight: 700, fontSize: 13, padding: "7px 16px", borderRadius: 999,
          }}>{label}</button>
        ))}
      </div>

      {days.map((day) => {
        const isToday = day.iso === today;
        return (
          <section className="block" key={day.iso}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "22px 2px 10px" }}>
              <span style={{
                background: isToday ? "linear-gradient(135deg,#F6C453,#E0962F)" : "linear-gradient(135deg,#7C3AED,#4338CA)",
                color: isToday ? "#2A1B00" : "#fff", fontWeight: 800, fontSize: 15, padding: "8px 16px", borderRadius: 999,
              }}>{day.dow} · {day.date}</span>
              {isToday && <span style={{ color: C.gold, fontSize: 12, fontWeight: 800 }}>اليوم</span>}
              <span style={{ flex: 1, height: 1, background: C.line }} />
              <span style={{ color: C.muted, fontSize: 13 }}>{day.matches.length} {day.matches.length === 1 ? "مباراة" : "مباريات"}</span>
            </div>
            <div style={{ background: C.card, borderRadius: 18, padding: "4px 14px", border: isToday ? "1px solid rgba(246,196,83,0.4)" : `1px solid ${C.line}` }}>
              {day.matches.map((m, i) => (
                <MatchRow key={m.id} m={m} state={byId[m.id]} last={i === day.matches.length - 1} onChanged={onChanged} />
              ))}
            </div>
          </section>
        );
      })}
      <p style={{ color: C.muted, fontSize: 11.5, textAlign: "center", marginTop: 26, opacity: 0.72, lineHeight: 1.8 }}>
        المواعيد بتوقيت المملكة (مكة) · التوقعات تُقفل قبل الانطلاق بـ 5 ثوانٍ · النقاط: دقيقة 5 · فارق 3 · اتجاه 1
      </p>
    </>
  );
}
