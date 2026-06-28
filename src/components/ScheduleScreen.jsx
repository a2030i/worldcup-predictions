import React, { useEffect, useMemo, useRef, useState } from "react";
import { C } from "../theme";
import { NAMES, ARAB, SCHEDULE, flag, matchId, kickoffISO } from "../data/tournament";
import { submitPrediction, getSession, matchDistribution, setJoker } from "../lib/api";
import { digitsOnly, countWord, STAGE_POINTS, STAGE_NAMES, stagePoints, liveMinuteLabel,
  tzParts, getTZ, setTZ, MECCA_TZ, deviceTZ, tzDiffersFromMecca, tzLabel } from "../lib/format";
import { generateShareCard, shareBlob } from "../lib/shareCard";
import { LockIcon, ClockIcon, UsersIcon, PinIcon, TrophyIcon, ShareIcon } from "../icons.jsx";

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
// سلسلة الإصابات: أطول/أحدث تتابع لتوقعات صحيحة (تُحسب من المباريات المنتهية المتوقَّعة)
function streakStats(matches) {
  const preds = (matches || [])
    .filter((m) => m.status === "finished" && m.my_h != null)
    .sort((a, b) => new Date(a.kickoff_at) - new Date(b.kickoff_at));
  let best = 0, run = 0;
  preds.forEach((m) => {
    if (m.my_h === m.result_h && m.my_a === m.result_a) { run++; best = Math.max(best, run); } else run = 0;
  });
  let cur = 0;
  for (let i = preds.length - 1; i >= 0; i--) {
    const m = preds[i];
    if (m.my_h === m.result_h && m.my_a === m.result_a) cur++; else break;
  }
  return { cur, best };
}

function ProgressStrip({ matches }) {
  if (!matches?.length) return null;
  let achieved = 0, lost = 0, remaining = 0;
  matches.forEach((m) => {
    if (m.status === "cancelled") return;
    const pts = stagePoints(m.stage);
    if (m.status === "finished") { if (isExact(m)) achieved += pts * (m.my_joker ? 2 : 1); else lost += pts; }
    else remaining += pts;
  });
  const total = achieved + lost + remaining;
  if (!total) return null;
  const { cur, best } = streakStats(matches);
  const pct = (v) => `${(v / total) * 100}%`;
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: "12px 14px", margin: "12px 0 4px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
        <span style={{ color: C.text, fontWeight: 800, fontSize: 13, display: "inline-flex", alignItems: "center", gap: 8 }}>
          رحلتك نحو النهائي
          {cur >= 2 && (
            <span className="num" title="توقعات صحيحة متتالية" style={{ color: "#C2331F", background: "rgba(224,67,47,0.12)",
              border: "1px solid rgba(224,67,47,0.3)", fontWeight: 900, fontSize: 11.5, padding: "2px 9px", borderRadius: 999 }}>
              🔥 {cur} متتالية
            </span>
          )}
        </span>
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
        {best >= 2 && <span style={{ color: "#C2331F", fontWeight: 800 }}>أطول سلسلة إصابات: {best} 🔥 · </span>}
        النهائي وحده يساوي 4 نقاط — لا أحد محسوم قبل النهاية
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
            • <b style={{ color: "#7C3AED" }}>الجوكر 🃏</b>: لك <b style={{ color: C.text }}>جوكر واحد كل يوم</b> — فعّله على توقع مباراة قبل قفلها فتتضاعف نقاطها (×2) إن أصبت النتيجة.<br />
            • عند تساوي النقاط: <b style={{ color: C.text }}>الأسبق في تسجيل توقعاته الصحيحة يتقدم</b> — حتى لو بفارق ثوانٍ، وأوقات الجميع معروضة بعد القفل للمصداقية.
          </div>
        </div>
      )}
    </div>
  );
}

/* مشاركة التوقع: اختيار الشكل ← معاينة ← مشاركة/تنزيل */
function SharePanel({ m, state, pts, onClose }) {
  const [fmt, setFmt] = useState(null);       // square | story
  const [preview, setPreview] = useState(null); // { url, blob }
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const make = async (f) => {
    setFmt(f); setBusy(true); setErr("");
    try {
      const blob = await generateShareCard({
        format: f,
        teamA: NAMES[m.a] || m.a, teamB: NAMES[m.b] || m.b,
        h: state.my_h, a: state.my_a,
        displayName: getSession()?.displayName || getSession()?.username || "",
        kickoff: state?.kickoff_at || m.kickoff,
        points: countWord(pts, "نقطة واحدة", "نقطتين", "نقاط"),
      });
      setPreview((p) => { if (p) URL.revokeObjectURL(p.url); return { url: URL.createObjectURL(blob), blob }; });
    } catch (e) { setErr("تعذر إنشاء البطاقة"); }
    setBusy(false);
  };

  const fmtBtn = (f, label) => (
    <button onClick={() => make(f)} style={{
      cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 12.5,
      padding: "8px 14px", borderRadius: 10,
      border: `1px solid ${fmt === f ? "#2B6BE4" : C.line}`,
      background: fmt === f ? "#2B6BE4" : C.card, color: fmt === f ? "#FFFFFF" : C.muted,
    }}>{label}</button>
  );

  return (
    <div style={{ marginTop: 10, padding: "12px", borderRadius: 12, background: C.card, border: `1px solid ${C.line}`, textAlign: "center" }}>
      <div style={{ color: C.text, fontWeight: 800, fontSize: 13, marginBottom: 8 }}>اختر شكل البطاقة</div>
      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
        {fmtBtn("square", "مربع (بوست)")}
        {fmtBtn("story", "طولي (ستوري)")}
      </div>
      {busy && <p style={{ color: C.muted, fontSize: 12, margin: "10px 0 0" }}>جاري تجهيز البطاقة...</p>}
      {err && <p style={{ color: C.red, fontSize: 12, margin: "10px 0 0" }}>{err}</p>}
      {preview && !busy && (
        <>
          <img src={preview.url} alt="بطاقة توقعي" style={{
            width: fmt === "story" ? 150 : 210, borderRadius: 12, marginTop: 12,
            border: `1px solid ${C.line}`, display: "inline-block" }} />
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 10 }}>
            <button onClick={() => shareBlob(preview.blob)} style={{
              cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 13,
              padding: "10px 18px", borderRadius: 10, border: "none",
              color: "#FFFFFF", background: "#E0432F",
              display: "inline-flex", alignItems: "center", gap: 6,
            }}><ShareIcon size={14} /> مشاركة / حفظ</button>
            <button onClick={onClose} style={{
              cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 13,
              padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.line}`,
              color: C.muted, background: "transparent",
            }}>إغلاق</button>
          </div>
        </>
      )}
    </div>
  );
}

/* خانة التوقع داخل بطاقة المباراة */
function PredictionBox({ m, state, onChanged, clockOffset }) {
  const [h, setH] = useState(state?.my_h ?? "");
  const [a, setA] = useState(state?.my_a ?? "");
  const [q, setQ] = useState(state?.my_qualified ?? ""); // المتأهل بالترجيح (إقصائيات عند التعادل)
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false); // التوقع المحفوظ لا يُعدَّل إلا بزر «تعديل»
  const [sharing, setSharing] = useState(false); // لوحة مشاركة التوقع

  // توقع الخادم قد يصل بعد أول عرض (جلسة عائدة) — زامن الخانات ما لم يكن العضو يحرر
  useEffect(() => {
    if (!editing) { setH(state?.my_h ?? ""); setA(state?.my_a ?? ""); setQ(state?.my_qualified ?? ""); }
  }, [state?.my_h, state?.my_a, state?.my_qualified]);

  const locksAt = state?.locks_at || new Date(new Date(m.kickoff).getTime() - 5000).toISOString();
  const left = useCountdown(locksAt, clockOffset);
  const finished = state?.status === "finished";
  const locked = finished || left <= 0;
  const saved = state?.my_h != null;
  const pts = stagePoints(state?.stage || m.stage);
  const isKnockout = (state?.stage || m.stage) !== "group"; // إقصائيات: التعادل يذهب للترجيح

  // خانة إقصائية لم يكتمل طرفاها بعد — لا تُفتح للتوقع حتى يُعرف المنتخبان
  if (!m.a || !m.b)
    return (
      <Note muted><ClockIcon size={13} /> تُفتح التوقعات فور تحديد المنتخبين</Note>
    );

  // نتيجة منتهية + كان عندي توقع → اعرض نقاطي عليها
  if (finished) {
    if (!saved) return <Note muted>لم تتوقع هذه المباراة</Note>;
    const exact = isExact(state);
    const jk = state.my_joker;
    const earned = pts * (jk ? 2 : 1);
    return (
      <Note gold={exact}>
        <span style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
            <MyPick m={m} h={state.my_h} a={state.my_a} />
            {jk && <JokerChip />}
          </span>
          <span>{exact
            ? `توقع صحيح ✓ — كسبت ${countWord(earned, "نقطة", "نقطتين", "نقاط")}${jk ? " (مضاعفة بالجوكر)" : ""}`
            : "لم يطابق النتيجة — بدون نقاط"}</span>
          {isKnockout && (state.my_qualified || state.qualified) && (
            <span style={{ fontSize: 11.5, color: C.muted }}>
              {state.my_qualified && <>توقّعت تأهل <b>{NAMES[state.my_qualified] || state.my_qualified}</b></>}
              {state.qualified && <> · المتأهل فعلًا: <b style={{ color: C.green }}>{NAMES[state.qualified] || state.qualified}</b></>}
            </span>
          )}
        </span>
      </Note>
    );
  }

  if (locked)
    return (
      <Note muted>
        {saved ? (
          <span style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><LockIcon size={13} /> أُقفلت التوقعات — توقعك:</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
              <MyPick m={m} h={state.my_h} a={state.my_a} />
              {state.my_joker && <JokerChip />}
            </span>
            {isKnockout && state.my_qualified && (
              <span style={{ fontSize: 11.5, color: "#7C3AED", fontWeight: 700 }}>🎟️ توقّعت تأهل {NAMES[state.my_qualified] || state.my_qualified} (ترجيح)</span>
            )}
          </span>
        ) : (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><LockIcon size={13} /> أُقفلت التوقعات — فاتك التوقع</span>
        )}
      </Note>
    );

  const save = async () => {
    if (busy) return;
    if (h === "" || a === "") { setMsg("أدخل النتيجة كاملة"); return; }
    const needsQualifier = isKnockout && Number(h) === Number(a); // تعادل في إقصائي → لازم متأهل
    if (needsQualifier && !q) { setMsg("اختر المنتخب المتأهل بركلات الترجيح"); return; }
    setBusy(true); setMsg("");
    try {
      await submitPrediction(m.id, Number(h), Number(a), needsQualifier ? q : null);
      setMsg("تم حفظ توقعك ✓");
      setEditing(false);
      onChanged?.();
    } catch (e) { setMsg(e.message); }
    setBusy(false);
  };

  const toggleJoker = async () => {
    if (busy) return;
    setBusy(true); setMsg("");
    try { await setJoker(m.id, !state.my_joker); onChanged?.(); }
    catch (e) { setMsg(e.message); }
    setBusy(false);
  };

  const readOnly = saved && !editing; // المحفوظ يُعرض مقفولًا حتى يضغط «تعديل التوقع»
  const jk = state?.my_joker;
  const urgent = left < 60_000;
  return (
    <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 12, background: "rgba(239,159,39,0.07)", border: `1px solid rgba(184,119,26,0.28)` }}>
      <div style={{ textAlign: "center", color: C.muted, fontSize: 11.5, fontWeight: 700, marginBottom: 8 }}>
        أصِب النتيجة بالضبط واكسب <b style={{ color: C.gold }}>{countWord(pts, "نقطة واحدة", "نقطتين", "نقاط")}</b>
        <span style={{ opacity: 0.75 }}> — أي نتيجة أخرى بدون نقاط</span>
      </div>
      {isKnockout && !readOnly && (
        <div style={{ textAlign: "center", color: "#7C3AED", fontSize: 10.5, fontWeight: 700, margin: "-4px 0 8px" }}>
          النتيجة النهائية تشمل الأشواط الإضافية · والتعادل يعني ركلات ترجيح
        </div>
      )}
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
      {isKnockout && !readOnly && h !== "" && a !== "" && Number(h) === Number(a) && (
        <QualifierSelector m={m} value={q} onPick={setQ} />
      )}
      {readOnly && isKnockout && state.my_qualified && (
        <div style={{ marginTop: 10, textAlign: "center", color: "#7C3AED", fontSize: 12, fontWeight: 800,
          background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.3)", borderRadius: 10, padding: "8px 10px" }}>
          🎟️ توقّعت تأهل {NAMES[state.my_qualified] || state.my_qualified} بالترجيح
        </div>
      )}
      {readOnly ? (
        <>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button onClick={() => { setEditing(true); setMsg(""); setSharing(false); }} style={{
              flex: 1, cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 14,
              padding: "11px 0", borderRadius: 10, color: C.gold, background: "transparent",
              border: "1px solid rgba(184,119,26,0.45)",
            }}>تعديل التوقع</button>
            <button onClick={() => setSharing(!sharing)} style={{
              flex: 1, cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 14,
              padding: "11px 0", borderRadius: 10, color: "#FFFFFF", background: "#2B6BE4",
              border: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}><ShareIcon size={15} /> شارك توقعك</button>
          </div>
          <button onClick={toggleJoker} disabled={busy} title="جوكر واحد كل يوم — يضاعف نقاط هذا التوقع إن صحّ" style={{
            width: "100%", marginTop: 8, cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 13,
            padding: "10px 0", borderRadius: 10, opacity: busy ? 0.6 : 1,
            color: jk ? "#FFFFFF" : "#7C3AED", background: jk ? "#7C3AED" : "rgba(124,58,237,0.1)",
            border: `1px solid ${jk ? "#7C3AED" : "rgba(124,58,237,0.4)"}`,
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}>🃏 {jk ? "الجوكر مُفعّل ×2 — اضغط للإلغاء" : "فعّل الجوكر (نقاط مضاعفة)"}</button>
        </>
      ) : (
        <button onClick={save} disabled={busy} style={{
          width: "100%", marginTop: 10, cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 14,
          padding: "11px 0", borderRadius: 10, border: "none", color: "#FFFFFF",
          background: "#E0432F", opacity: busy ? 0.6 : 1,
        }}>{busy ? "لحظات..." : saved ? "حفظ التعديل" : "أرسل توقعك"}</button>
      )}
      {sharing && readOnly && <SharePanel m={m} state={state} pts={pts} onClose={() => setSharing(false)} />}
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

/* عرض توقعي بأسماء المنتخبين — كل رقم ملتصق بمنتخبه فلا يلتبس من سجّل ماذا */
function MyPick({ m, h, a }) {
  const cell = (code, goals) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{ fontSize: 15, lineHeight: 1 }}>{flag(code)}</span>
      <span style={{ fontWeight: 700 }}>{NAMES[code] || code}</span>
      <b className="num" style={{ fontSize: 15 }}>{goals}</b>
    </span>
  );
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
      {cell(m.a, h)}
      <span style={{ opacity: 0.45 }}>·</span>
      {cell(m.b, a)}
    </span>
  );
}

const JokerChip = () => (
  <span className="num" style={{ color: "#7C3AED", background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.35)",
    fontWeight: 900, fontSize: 11, padding: "2px 8px", borderRadius: 999, whiteSpace: "nowrap" }}>🃏 جوكر ×2</span>
);

/* اختيار المتأهل بركلات الترجيح — يظهر في الإقصائيات عند توقّع تعادل */
function QualifierSelector({ m, value, onPick }) {
  const opt = (code) => (
    <button type="button" onClick={() => onPick(code)} style={{
      flex: 1, cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 13,
      padding: "9px 6px", borderRadius: 10,
      border: `1px solid ${value === code ? "#7C3AED" : C.line}`,
      background: value === code ? "rgba(124,58,237,0.14)" : C.card,
      color: value === code ? "#7C3AED" : C.muted,
      display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
    }}>{flag(code)} {NAMES[code] || code}</button>
  );
  return (
    <div style={{ marginTop: 10, padding: "9px 10px", borderRadius: 10, background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.3)" }}>
      <div style={{ textAlign: "center", color: "#7C3AED", fontSize: 11.5, fontWeight: 800, marginBottom: 7 }}>
        🎟️ تعادل → ركلات ترجيح: من يتأهل؟
      </div>
      <div style={{ display: "flex", gap: 8 }}>{opt(m.a)}{opt(m.b)}</div>
    </div>
  );
}

function Team({ code, goals, lead, flash }) {
  const tbd = !code; // خانة إقصائية لم يتحدد طرفها بعد
  const strong = code === "SA" || lead;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <span style={{ fontSize: 22, lineHeight: 1, opacity: tbd ? 0.4 : 1 }}>{tbd ? "🏳️" : flag(code)}</span>
        <span style={{ color: tbd ? C.muted : strong ? C.gold : C.text, fontSize: 16, fontWeight: tbd ? 600 : strong ? 800 : 600, fontStyle: tbd ? "italic" : "normal" }}>{tbd ? "يُحدَّد لاحقًا" : NAMES[code] || code}</span>
      </div>
      {goals != null && (
        <span key={goals} className="num" style={{ color: lead ? C.gold : C.text, fontWeight: 800, fontSize: 17, minWidth: 22,
          textAlign: "center", display: "inline-block",
          animation: flash ? "scorebounce 0.9s ease-in-out infinite" : "none" }}>{goals}</span>
      )}
    </div>
  );
}

/* توزيع توقعات الجمهور — يظهر بعد القفل فقط (يُحمَّل عند الطلب) */
function Distribution({ m }) {
  const [open, setOpen] = useState(false);
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (d || busy) return;
    setBusy(true); setErr("");
    try { setD(await matchDistribution(m.id)); } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  const total = d?.total || 0;
  const segs = d ? [
    { label: `فوز ${NAMES[m.a] || m.a}`, count: d.home, color: "#2B6BE4" },
    { label: "تعادل", count: d.draw, color: "#B8771A" },
    { label: `فوز ${NAMES[m.b] || m.b}`, count: d.away, color: "#19C39C" },
  ].map((s) => ({ ...s, p: total ? Math.round((s.count / total) * 100) : 0 })) : [];

  return (
    <div style={{ marginTop: 8 }}>
      <button onClick={toggle} style={{
        width: "100%", cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 12,
        padding: "8px 12px", borderRadius: 10, border: `1px solid ${C.line}`, background: C.card, color: C.muted,
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
      }}><UsersIcon size={13} /> توزيع توقعات الجمهور {open ? "▴" : "▾"}</button>
      {open && (
        <div style={{ marginTop: 8, padding: "10px 12px", borderRadius: 10, background: "#F3EFE4", border: `1px solid ${C.line}` }}>
          {busy && <p style={{ color: C.muted, fontSize: 12, textAlign: "center", margin: 0 }}>جاري التحميل...</p>}
          {err && <p style={{ color: C.red, fontSize: 12, textAlign: "center", margin: 0 }}>{err}</p>}
          {d && total === 0 && <p style={{ color: C.muted, fontSize: 12, textAlign: "center", margin: 0 }}>لا توقعات على هذه المباراة</p>}
          {d && total > 0 && (
            <>
              <div style={{ display: "flex", height: 10, borderRadius: 999, overflow: "hidden", background: "#E8E2D2" }}>
                {segs.map((s) => s.count > 0 && <span key={s.label} style={{ width: `${s.p}%`, background: s.color }} />)}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, gap: 6, flexWrap: "wrap", fontSize: 11, fontWeight: 700 }}>
                {segs.map((s) => (
                  <span key={s.label} className="num" style={{ color: s.color }}>{s.label}: {s.p}%</span>
                ))}
              </div>
              {d.top?.length > 0 && (
                <div style={{ color: C.muted, fontSize: 11.5, marginTop: 8, lineHeight: 1.8 }}>
                  أكثر النتائج توقعًا:{" "}
                  {d.top.map((t, i) => (
                    <span key={i} className="num" style={{ fontWeight: 800, color: C.text }}>
                      <span dir="ltr">{t.h}–{t.a}</span> ({t.c}){i < d.top.length - 1 ? " · " : ""}
                    </span>
                  ))}
                </div>
              )}
              <div style={{ color: C.muted, fontSize: 10.5, marginTop: 6, textAlign: "center", opacity: 0.85 }}>
                بناءً على {countWord(total, "توقع واحد", "توقعان", "توقعات")}
              </div>
            </>
          )}
        </div>
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

  // مؤقّت دقيقة المباراة الحية (يُعاد الحساب كل 20 ثانية أثناء البث)
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => setTick((n) => n + 1), 20_000);
    return () => clearInterval(t);
  }, [live]);
  const minuteLabel = live ? liveMinuteLabel(state?.kickoff_at || m.kickoff, clockOffset) : null;

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
                border: "1px solid rgba(255,107,107,0.35)" }}>
                <span style={{ animation: "pulse 1.6s infinite" }}>●</span> مباشر{minuteLabel ? ` · ${minuteLabel}` : ""}
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
      {m.a && m.b && (fin || (state?.locks_at && new Date(state.locks_at) <= new Date(Date.now() + clockOffset))) && (
        <Distribution m={m} />
      )}
    </div>
  );
}

export default function ScheduleScreen({ matches, onChanged, clockOffset = 0 }) {
  const [arabOnly, setArabOnly] = useState(false);
  const [tz, setTzState] = useState(getTZ());        // منطقة العرض المختارة
  const showTzToggle = useMemo(() => tzDiffersFromMecca(), []);
  // فهرس حالة الخادم لكل مباراة (توقعي، النتيجة، لحظة القفل...)
  const byId = useMemo(() => Object.fromEntries((matches || []).map((r) => [r.id, r])), [matches]);

  // كل المباريات بوقتها المطلق: الثابتة (مجموعات) + الديناميكية (إقصائيات من الخادم)
  const allMatches = useMemo(() => {
    const list = SCHEDULE.flatMap((d) =>
      d.matches.map((m) => ({ id: matchId(d.iso, m.a, m.b), a: m.a, b: m.b, c: m.c, stage: "group",
        kickoff: kickoffISO(d.iso, m.t, m.p) })));
    const staticIds = new Set(list.map((m) => m.id));
    (matches || []).filter((r) => !staticIds.has(r.id) && r.status !== "cancelled").forEach((r) => {
      // المنتخبات من الخادم مباشرة (قد تكون null = خانة إقصائية بانتظار التأهل).
      // التراجع لتفكيك المعرّف القديم {iso}_{a}_{b} فقط إن لم يُرجِع الخادمُ الحقلين بعد.
      const [, sa, sb] = r.id.split("_");
      const a = "team_a" in r ? r.team_a : sa;
      const b = "team_b" in r ? r.team_b : sb;
      list.push({ id: r.id, a, b, stage: r.stage || "group", kickoff: r.kickoff_at });
    });
    return list;
  }, [matches]);

  // التجميع باليوم في المنطقة المختارة — تبديل التوقيت يعيد ترتيب الأيام كاملة
  const today = tzParts(new Date(Date.now() + clockOffset).toISOString(), tz).iso;
  const days = useMemo(() => {
    const byDay = {};
    allMatches.forEach((m) => {
      if (arabOnly && !ARAB.includes(m.a) && !ARAB.includes(m.b)) return;
      const k = tzParts(m.kickoff, tz);
      const key = k.iso;
      byDay[key] ||= { iso: k.iso, dow: k.dow, date: k.date, stage: m.stage, matches: [] };
      if (m.stage !== "group") byDay[key].stage = m.stage;
      byDay[key].matches.push({ ...m, t: k.t, p: k.p });
    });
    const out = Object.values(byDay);
    out.forEach((d) => d.matches.sort((x, y) => new Date(x.kickoff) - new Date(y.kickoff)));
    return out.sort((x, y) => (x.iso < y.iso ? -1 : 1));
  }, [allMatches, arabOnly, tz]);

  const pickTz = (t) => { setTZ(t); setTzState(t); };

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
      {showTzToggle && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, margin: "10px 0 2px" }}>
          <span style={{ color: C.muted, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}>
            <ClockIcon size={13} /> التوقيت:
          </span>
          {[[MECCA_TZ, "مكة"], [deviceTZ(), `بلدك (${tzLabel(deviceTZ())})`]].map(([t, label]) => (
            <button key={t} onClick={() => pickTz(t)} style={{
              border: `1px solid ${tz === t ? C.blue : C.line}`, cursor: "pointer",
              background: tz === t ? C.blue : C.card, color: tz === t ? "#FFFFFF" : C.muted,
              fontFamily: "inherit", fontWeight: 700, fontSize: 12, padding: "7px 14px", borderRadius: 999,
            }}>{label}</button>
          ))}
        </div>
      )}
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
                  {STAGE_NAMES[day.stage]} · {countWord(STAGE_POINTS[day.stage], "نقطة", "نقطتان", "نقاط")}
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
        المواعيد بتوقيت {tz === MECCA_TZ ? "مكة المكرمة" : tzLabel(tz)} · التوقع الصحيح = النتيجة بالضبط · التوقعات تُقفل عند انطلاق المباراة
      </p>
    </>
  );
}
