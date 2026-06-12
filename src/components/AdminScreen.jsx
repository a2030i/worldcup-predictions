import React, { useEffect, useState } from "react";
import { C } from "../theme";
import { NAMES, ALL_MATCHES } from "../data/tournament";
import {
  adminSetResult, adminOverview, adminMatchStats, adminResetPin, adminBan,
  adminReschedule, adminCancelMatch, adminListUsers, adminUserDetail, adminRename,
  adminSetPhone, adminSetAdmin, adminDeletePrediction, adminListChallenges,
  adminChallengeBoard, adminMatchWinners, adminDeleteChallenge, adminAuditLog, adminSyncNow,
  adminSetAnnouncement, adminClearAnnouncement, adminIntegrityReport, adminAddMatch, dayStars,
} from "../lib/api";
import { digitsOnly, countWord, downloadCSV, STAGE_NAMES, ksaParts, stagePoints } from "../lib/format";
import { SearchIcon, UsersIcon, ListIcon, ChartIcon, TrophyIcon, BallIcon, AlertIcon, RefreshIcon, BackIcon, ClockIcon } from "../icons.jsx";

const ClockIconSmall = () => <ClockIcon size={14} />;

const field = {
  padding: "10px 12px", borderRadius: 10, fontSize: 14, color: C.text,
  background: "rgba(255,255,255,0.06)", border: `1px solid ${C.line}`, outline: "none", fontFamily: "inherit",
};
const gold = {
  cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 13,
  padding: "10px 14px", borderRadius: 10, border: "none", color: "#2A1B00",
  background: "linear-gradient(135deg,#F6C453,#E0962F)",
};
const ghost = { ...gold, background: "transparent", color: C.muted, border: `1px solid ${C.line}` };
const danger = { ...gold, background: "rgba(255,107,107,0.14)", color: C.red, border: "1px solid rgba(255,107,107,0.4)" };

const Card = ({ title, children }) => (
  <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 18, padding: 16, marginBottom: 16 }}>
    {title && <div style={{ color: C.gold, fontWeight: 800, fontSize: 14, marginBottom: 12 }}>{title}</div>}
    {children}
  </div>
);

// زر بتأكيد مزدوج للعمليات الخطرة
function ConfirmButton({ label, confirmLabel = "متأكد؟ اضغط مجددًا", onConfirm, style = danger }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button style={style} onClick={() => { if (armed) { setArmed(false); onConfirm(); } else setArmed(true); }}>
      {armed ? confirmLabel : label}
    </button>
  );
}

const fmtTime = (ts) => new Date(ts).toLocaleString("ar-SA", {
  month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
});

/* ───────────── 1) نظرة عامة ───────────── */
function OverviewTab() {
  const [ov, setOv] = useState(null);
  const [err, setErr] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const load = () => adminOverview().then(setOv).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);
  if (err) return <p style={{ color: C.red, fontSize: 13, textAlign: "center" }}>{err}</p>;
  if (!ov) return <p style={{ color: C.muted, fontSize: 13, textAlign: "center" }}>جاري التحميل...</p>;
  const stats = [
    ["الأعضاء", ov.users], ["نشطون آخر 24س", ov.active_24h],
    ["توقعات آخر 24س", ov.predictions_today], ["إجمالي التوقعات", ov.predictions],
    ["مباريات منتهية", ov.finished], ["تحديات خاصة", ov.challenges],
    ["بدون جوال", ov.no_phone], ["محظورون", ov.banned],
  ];
  return (
    <>
      <Card>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(105px, 1fr))", gap: 10, textAlign: "center" }}>
          {stats.map(([l, v]) => (
            <div key={l} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: "12px 4px" }}>
              <div className="num" style={{ color: l === "بدون جوال" && v > 0 ? C.red : C.gold, fontWeight: 900, fontSize: 20 }}>{v}</div>
              <div style={{ color: C.muted, fontSize: 11 }}>{l}</div>
            </div>
          ))}
        </div>
      </Card>
      <Card title="التحديث التلقائي للنتائج">
        <div style={{ fontSize: 12.5, color: C.text, lineHeight: 2 }}>
          الحالة: <b style={{ color: ov.sync?.enabled ? C.green : C.red }}>{ov.sync?.enabled ? "مفعّل" : "متوقف"}</b>
          {ov.sync?.last_run && <> · آخر تشغيل: <span className="num" dir="ltr" style={{ color: C.muted }}>{fmtTime(ov.sync.last_run)}</span></>}
          <br />
          <span style={{ color: C.muted }}>{ov.sync?.last_status || "—"}</span>
        </div>
        <button style={{ ...ghost, marginTop: 8, display: "inline-flex", alignItems: "center", gap: 6 }} disabled={syncing}
          onClick={async () => {
            setSyncing(true); setSyncMsg("");
            try { setSyncMsg(await adminSyncNow()); load(); } catch (e) { setSyncMsg(e.message); }
            setSyncing(false);
          }}>
          <RefreshIcon size={14} /> {syncing ? "جاري المزامنة..." : "تشغيل المزامنة الآن"}
        </button>
        {syncMsg && <div style={{ color: C.gold, fontSize: 12, marginTop: 8 }}>{syncMsg}</div>}
      </Card>
      <Card title="إعلان للأعضاء (يظهر أعلى المنصة للجميع)">
        <AnnounceComposer />
      </Card>
      {ov.top_challenges?.length > 0 && (
        <Card title="أكبر التحديات الخاصة">
          {ov.top_challenges.map((c) => (
            <div key={c.name} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", fontSize: 13.5, color: C.text }}>
              <span>{c.name}</span>
              <span style={{ color: C.muted }}>{countWord(Number(c.members), "عضو واحد", "عضوان", "أعضاء")}</span>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}

function AnnounceComposer() {
  const [body, setBody] = useState("");
  const [msg, setMsg] = useState("");
  return (
    <>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={250} rows={2}
        placeholder="مثال: جائزة اليوم لأدق متوقع — لا تنسوا مباراة الليلة!"
        style={{ ...field, width: "100%", resize: "vertical", lineHeight: 1.8 }} />
      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        <button style={gold} onClick={async () => {
          try { await adminSetAnnouncement(body); setMsg("نُشر الإعلان ✓"); setBody(""); } catch (e) { setMsg(e.message); }
        }}>نشر الإعلان</button>
        <button style={ghost} onClick={async () => {
          try { await adminClearAnnouncement(); setMsg("أُزيل الإعلان الحالي ✓"); } catch (e) { setMsg(e.message); }
        }}>إزالة الإعلان الحالي</button>
      </div>
      <p style={{ color: C.muted, fontSize: 11, margin: "8px 0 0" }}>
        تصحيح أي نتيجة معتمدة يُنشئ إعلانًا تلقائيًا للأعضاء بالشفافية الكاملة.
      </p>
      {msg && <p style={{ color: msg.includes("✓") ? C.green : C.red, fontSize: 12.5, margin: "6px 0 0", fontWeight: 700 }}>{msg}</p>}
    </>
  );
}

/* ───────────── لوحة اليوم: مباريات اليوم بحالتها + نجوم آخر يوم ───────────── */
function TodayTab({ matches }) {
  const [stars, setStars] = useState(null);
  useEffect(() => { dayStars().then(setStars).catch(() => {}); }, []);
  const todayIso = ksaParts(new Date().toISOString()).iso;
  const todays = (matches || []).filter((r) => ksaParts(r.kickoff_at).iso === todayIso);
  return (
    <>
      <Card title={`مباريات اليوم (${todays.length})`}>
        {todays.length === 0 && <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>لا مباريات اليوم</p>}
        {todays.map((r) => {
          const [, a, b] = r.id.split("_");
          const k = ksaParts(r.kickoff_at);
          const live = r.status === "scheduled" && r.live_h != null;
          return (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 0", fontSize: 13, borderBottom: `1px solid ${C.line}`, flexWrap: "wrap" }}>
              <span className="num" style={{ color: C.gold, fontWeight: 800, width: 64 }}>{k.t} {k.p}</span>
              <span style={{ flex: 1, minWidth: 120, color: C.text, fontWeight: 700 }}>{NAMES[a]} × {NAMES[b]}</span>
              {r.status === "finished" && <span className="num" style={{ color: C.green, fontWeight: 800 }}>انتهت {r.result_h}–{r.result_a}</span>}
              {live && <span className="num" style={{ color: C.red, fontWeight: 800, animation: "pulse 1.6s infinite" }}>مباشر {r.live_h}–{r.live_a}</span>}
              {r.status === "scheduled" && !live && <span style={{ color: C.muted }}>قادمة</span>}
              {r.status === "cancelled" && <span style={{ color: C.red }}>ملغاة</span>}
              <span style={{ color: C.muted, fontSize: 11.5, display: "inline-flex", alignItems: "center", gap: 4 }}>
                <UsersIcon size={12} /> {r.predictors}
              </span>
            </div>
          );
        })}
      </Card>
      {stars?.stars?.length > 0 && (
        <Card title={`نجوم آخر يوم مكتمل (${stars.date})`}>
          {stars.stars.map((s, i) => (
            <div key={`${s.display_name}-${i}`} style={{ display: "flex", gap: 8, padding: "6px 0", fontSize: 13, color: C.text }}>
              <span className="num" style={{ width: 20, color: C.muted }}>{i + 1}</span>
              <span style={{ flex: 1, fontWeight: 700 }}>{s.display_name}</span>
              <span className="num" style={{ color: C.green }}>{s.exact_count} إصابة</span>
              <span className="num" style={{ color: C.gold, fontWeight: 900 }}>{s.points} نقطة</span>
            </div>
          ))}
          <button style={{ ...ghost, marginTop: 8 }} onClick={() =>
            downloadCSV(`نجوم-${stars.date}.csv`, ["المركز", "العضو", "الإصابات", "النقاط"],
              stars.stars.map((s, i) => [i + 1, s.display_name, s.exact_count, s.points]))
          }>تصدير CSV</button>
        </Card>
      )}
    </>
  );
}

/* ───────────── 2) المباريات ───────────── */
function MatchesTab({ matches, onChanged }) {
  const [mid, setMid] = useState("");
  const [h, setH] = useState(""); const [a, setA] = useState("");
  const [qualified, setQualified] = useState("");
  const [newKickoff, setNewKickoff] = useState("");
  const [stats, setStats] = useState(null);
  const [winners, setWinners] = useState(null);
  const [msg, setMsg] = useState("");

  const byId = Object.fromEntries((matches || []).map((r) => [r.id, r]));
  const sel = ALL_MATCHES.find((m) => m.id === mid);
  const isKnockout = sel && sel.stage && sel.stage !== "group";

  const run = async (fn, okMsg) => {
    try { await fn(); setMsg(okMsg); onChanged?.(); } catch (e) { setMsg(e.message); }
  };

  return (
    <>
      <Card title="اعتماد / تصحيح نتيجة">
        <select value={mid} onChange={(e) => { setMid(e.target.value); setStats(null); setMsg(""); }}
          style={{ ...field, width: "100%", background: "#171E40" }}>
          <option value="">اختر المباراة...</option>
          {ALL_MATCHES.map((m) => {
            const s = byId[m.id];
            const tag = s?.status === "finished" ? `✓ (${s.result_h}–${s.result_a}) ` : s?.status === "cancelled" ? "ملغاة · " : "";
            return <option key={m.id} value={m.id}>{tag}{NAMES[m.a]} ضد {NAMES[m.b]} · {m.date}</option>;
          })}
        </select>
        <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input style={{ ...field, width: 64, textAlign: "center" }} inputMode="numeric" maxLength={2}
            value={h} onChange={(e) => setH(digitsOnly(e.target.value))} placeholder={sel ? NAMES[sel.a] : "الأول"} />
          <span style={{ color: C.muted, fontWeight: 800 }}>–</span>
          <input style={{ ...field, width: 64, textAlign: "center" }} inputMode="numeric" maxLength={2}
            value={a} onChange={(e) => setA(digitsOnly(e.target.value))} placeholder={sel ? NAMES[sel.b] : "الثاني"} />
          {isKnockout && (
            <select value={qualified} onChange={(e) => setQualified(e.target.value)} style={{ ...field, background: "#171E40" }}>
              <option value="">المتأهل (للإقصائيات)...</option>
              <option value={sel.a}>{NAMES[sel.a]}</option>
              <option value={sel.b}>{NAMES[sel.b]}</option>
            </select>
          )}
          <button style={gold} onClick={() => {
            if (!mid || h === "" || a === "") { setMsg("اختر المباراة وأدخل النتيجة"); return; }
            run(() => adminSetResult(mid, Number(h), Number(a), qualified || null),
              "اعتُمدت النتيجة ✓ — احتُسبت النقاط وتحدثت كل اللوحات");
          }}>اعتماد</button>
          <button style={ghost} onClick={async () => {
            if (!mid) return;
            try { setStats(await adminMatchStats(mid)); } catch (e) { setMsg(e.message); }
          }}>الإحصاءات</button>
          <button style={ghost} onClick={async () => {
            if (!mid) return;
            try { setWinners(await adminMatchWinners(mid)); } catch (e) { setMsg(e.message); }
          }}>الفائزون</button>
        </div>
        <p style={{ color: C.muted, fontSize: 11.5, margin: "10px 0 0", lineHeight: 1.7 }}>
          تصحيح نتيجة سابقة: اختر المباراة نفسها وأدخل النتيجة الصحيحة — النقاط تُعاد حسابها تلقائيًا في كل التحديات، ويُسجَّل التعديل في سجل العمليات.
        </p>
        {stats && (
          <div style={{ marginTop: 12, fontSize: 13, color: C.text }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <UsersIcon size={14} /> إجمالي المتوقعين: <b className="num" style={{ color: C.gold }}>{stats.total}</b>
              {!stats.locked && <span style={{ color: C.muted, fontSize: 11.5 }}>(التوزيع يظهر بعد القفل)</span>}
            </div>
            {stats.distribution?.length > 0 && (
              <div style={{ marginTop: 6, color: C.muted }}>
                أكثر التوقعات: {stats.distribution.slice(0, 5).map((d) => `${d.h}–${d.a} (${d.n})`).join(" · ")}
              </div>
            )}
            {stats.last_minute?.length > 0 && (
              <div style={{ marginTop: 6, color: C.red, display: "flex", alignItems: "center", gap: 6 }}>
                <AlertIcon size={14} /> توقعات في آخر دقيقة قبل القفل: {stats.last_minute.map((s) => s.username).join("، ")}
              </div>
            )}
          </div>
        )}
        {winners && (
          <div style={{ marginTop: 12, background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: "10px 12px" }}>
            <div style={{ color: C.gold, fontWeight: 800, fontSize: 13, marginBottom: 6 }}>
              الفائزون بالتوقع الصحيح
              {winners.status === "finished"
                ? <span className="num" style={{ color: C.muted, fontWeight: 600 }}> — النتيجة {winners.result_h}–{winners.result_a} · أصاب {winners.winners.length} من {winners.total_predictors} متوقعًا</span>
                : <span style={{ color: C.muted, fontWeight: 600 }}> — تظهر بعد انتهاء المباراة</span>}
            </div>
            {winners.status === "finished" && winners.winners.length === 0 &&
              <p style={{ color: C.muted, fontSize: 12.5, margin: 0 }}>لا أحد أصاب النتيجة بالضبط في هذه المباراة</p>}
            {winners.winners.map((w, i) => (
              <div key={`${w.username}-${i}`} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", fontSize: 12.5, borderBottom: i === winners.winners.length - 1 ? "none" : `1px solid ${C.line}` }}>
                <span className="num" style={{ width: 20, color: C.muted }}>{i + 1}</span>
                <span style={{ flex: 1, color: C.text, fontWeight: 700, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {w.display_name} <span dir="ltr" style={{ color: C.muted, fontWeight: 600, fontSize: 11 }}>@{w.username}</span>
                </span>
                <span dir="ltr" className="num" style={{ color: w.phone ? C.muted : C.red, fontSize: 11.5 }}>{w.phone || "بدون جوال"}</span>
                <span className="num" dir="ltr" style={{ color: C.muted, fontSize: 10.5 }}>
                  {new Date(w.predicted_at).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
                <span className="num" style={{ color: C.gold, fontWeight: 800 }}>+{w.points}</span>
              </div>
            ))}
            {winners.winners.length > 1 && (
              <p style={{ color: C.muted, fontSize: 10.5, margin: "6px 0 0", opacity: 0.8 }}>مرتبون بأسبقية وقت التوقع — الأقدم أولًا</p>
            )}
            {winners.winners.length > 0 && (
              <button style={{ ...ghost, marginTop: 8, fontSize: 12 }} onClick={() =>
                downloadCSV(`فائزون-${winners.match_id}.csv`,
                  ["المركز", "اسم العرض", "اسم الدخول", "الجوال", "وقت التوقع", "النقاط"],
                  winners.winners.map((w, i) => [i + 1, w.display_name, w.username, w.phone || "", w.predicted_at, w.points]))
              }>تصدير الفائزين CSV</button>
            )}
          </div>
        )}
      </Card>

      <Card title="إضافة مباراة (الأدوار الإقصائية)">
        <p style={{ color: C.muted, fontSize: 11.5, margin: "0 0 10px", lineHeight: 1.7 }}>
          المزامنة التلقائية تضيف مباريات الأدوار الإقصائية وحدها فور معرفة المتأهلين — هذا النموذج للاحتياط اليدوي.
        </p>
        <AddMatchForm onAdded={(t) => { setMsg(t); onChanged?.(); }} onErr={setMsg} />
      </Card>

      <Card title="تأجيل / إلغاء مباراة">
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input type="datetime-local" value={newKickoff} onChange={(e) => setNewKickoff(e.target.value)}
            style={{ ...field, colorScheme: "dark" }} />
          <button style={ghost} onClick={() => {
            if (!mid || !newKickoff) { setMsg("اختر المباراة والوقت الجديد (بتوقيت السعودية)"); return; }
            run(() => adminReschedule(mid, `${newKickoff}:00+03:00`),
              "عُدّل الموعد ✓ — أُعيد فتح التوقعات وصُفّرت النتيجة");
          }}>تأجيل للموعد الجديد</button>
          <ConfirmButton label="إلغاء المباراة" onConfirm={() => {
            if (!mid) { setMsg("اختر المباراة أولًا"); return; }
            run(() => adminCancelMatch(mid), "أُلغيت المباراة ✓ — استُبعدت نقاطها من كل اللوحات");
          }} />
        </div>
        <p style={{ color: C.muted, fontSize: 11.5, margin: "10px 0 0" }}>الوقت المدخل يُفسَّر بتوقيت السعودية (UTC+3).</p>
      </Card>
      {msg && <p style={{ color: msg.includes("✓") ? C.green : C.red, fontSize: 13, textAlign: "center", fontWeight: 700 }}>{msg}</p>}
    </>
  );
}

function AddMatchForm({ onAdded, onErr }) {
  const [ta, setTa] = useState(""); const [tb, setTb] = useState("");
  const [kick, setKick] = useState(""); const [stage, setStage] = useState("r32");
  const [city, setCity] = useState("");
  const teamSel = { ...field, background: "#171E40", minWidth: 130, flex: 1 };
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <select value={ta} onChange={(e) => setTa(e.target.value)} style={teamSel}>
        <option value="">المنتخب الأول...</option>
        {Object.entries(NAMES).map(([c, n]) => <option key={c} value={c}>{n}</option>)}
      </select>
      <select value={tb} onChange={(e) => setTb(e.target.value)} style={teamSel}>
        <option value="">المنتخب الثاني...</option>
        {Object.entries(NAMES).map(([c, n]) => <option key={c} value={c}>{n}</option>)}
      </select>
      <select value={stage} onChange={(e) => setStage(e.target.value)} style={{ ...field, background: "#171E40" }}>
        {Object.entries(STAGE_NAMES).filter(([s]) => s !== "group").map(([s, n]) => (
          <option key={s} value={s}>{n} ({stagePoints(s)} نقاط)</option>
        ))}
      </select>
      <input type="datetime-local" value={kick} onChange={(e) => setKick(e.target.value)} style={{ ...field, colorScheme: "dark" }} />
      <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="المدينة (اختياري)" style={{ ...field, width: 130 }} />
      <button style={gold} onClick={async () => {
        if (!ta || !tb || !kick) { onErr("اختر المنتخبين والوقت"); return; }
        try {
          await adminAddMatch(ta, tb, `${kick}:00+03:00`, stage, city || null);
          onAdded("أُضيفت المباراة ✓ — ستظهر للأعضاء فورًا للتوقع");
        } catch (e) { onErr(e.message); }
      }}>إضافة</button>
    </div>
  );
}

/* ───────────── 3) الأعضاء ───────────── */
function UserActions({ u, onDone, setMsg }) {
  const [detail, setDetail] = useState(null);
  const [newDisplay, setNewDisplay] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newPin, setNewPin] = useState("");

  const run = async (fn, okMsg) => {
    try { await fn(); setMsg(okMsg); onDone(); } catch (e) { setMsg(e.message); }
  };

  return (
    <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: 12, marginTop: 10 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        <input style={{ ...field, flex: 1, minWidth: 110 }} value={newDisplay} maxLength={20}
          onChange={(e) => setNewDisplay(e.target.value)} placeholder="اسم عرض جديد" />
        <button style={ghost} onClick={() => {
          if (newDisplay.trim().length < 2) { setMsg("اكتب الاسم الجديد"); return; }
          run(() => adminRename(u.username, newDisplay.trim()), `غُيّر اسم العرض ✓`);
        }}>تغيير الاسم</button>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        <input dir="ltr" style={{ ...field, flex: 1, minWidth: 110, textAlign: "left" }} value={newPhone} maxLength={10}
          inputMode="numeric" onChange={(e) => setNewPhone(digitsOnly(e.target.value))} placeholder="05xxxxxxxx" />
        <button style={ghost} onClick={() => {
          if (!/^05\d{8}$/.test(newPhone)) { setMsg("الجوال: 05 ثم 8 أرقام"); return; }
          run(() => adminSetPhone(u.username, newPhone), `سُجّل الجوال ✓`);
        }}>حفظ الجوال</button>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        <input style={{ ...field, flex: 1, minWidth: 110 }} value={newPin} maxLength={6}
          inputMode="numeric" onChange={(e) => setNewPin(digitsOnly(e.target.value))}
          placeholder={u.is_admin ? "رمز جديد (6 أرقام)" : "رمز جديد (4–6)"} />
        <button style={ghost} onClick={() => {
          run(() => adminResetPin(u.username, newPin), `أُعيد تعيين الرمز ✓ (خرج من كل أجهزته)`);
        }}>إعادة تعيين الرمز</button>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {u.is_banned
          ? <button style={ghost} onClick={() => run(() => adminBan(u.username, false), `رُفع الحظر ✓`)}>رفع الحظر</button>
          : <ConfirmButton label="حظر العضو" onConfirm={() => run(() => adminBan(u.username, true), `حُظر العضو ✓`)} />}
        {u.is_admin
          ? <ConfirmButton label="سحب صلاحية الإدارة" style={ghost}
              onConfirm={() => run(() => adminSetAdmin(u.username, false), `سُحبت الصلاحية ✓`)} />
          : <ConfirmButton label="ترقية لمشرف" style={ghost} confirmLabel="سيتحكم بكل شيء — متأكد؟"
              onConfirm={() => run(() => adminSetAdmin(u.username, true), `رُقّي لمشرف ✓`)} />}
        <button style={ghost} onClick={async () => {
          try { setDetail(detail ? null : await adminUserDetail(u.username)); } catch (e) { setMsg(e.message); }
        }}>{detail ? "إخفاء التوقعات" : "كل توقعاته"}</button>
      </div>

      {detail && (
        <div style={{ marginTop: 10, borderTop: `1px solid ${C.line}`, paddingTop: 8 }}>
          {detail.predictions.length === 0 && <p style={{ color: C.muted, fontSize: 12.5, margin: 0 }}>لا توقعات بعد</p>}
          {detail.predictions.map((p) => {
            const m = ALL_MATCHES.find((x) => x.id === p.match_id);
            return (
              <div key={p.match_id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", fontSize: 12.5, borderBottom: `1px solid ${C.line}` }}>
                <span style={{ flex: 1, color: C.text, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {m ? `${NAMES[m.a]} ضد ${NAMES[m.b]}` : p.match_id}
                </span>
                <span className="num" style={{ color: C.gold, fontWeight: 800 }}>{p.h}–{p.a}</span>
                {p.last_minute && <span title="سُجّل في آخر دقيقة قبل القفل"><AlertIcon size={13} style={{ color: C.red }} /></span>}
                <span className="num" style={{ color: C.muted, fontSize: 11 }}>{fmtTime(p.updated_at)}</span>
                <ConfirmButton label="حذف" confirmLabel="تأكيد" style={{ ...danger, padding: "5px 9px", fontSize: 11 }}
                  onConfirm={() => run(() => adminDeletePrediction(u.username, p.match_id), `حُذف التوقع ✓`)} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function UsersTab() {
  const [q, setQ] = useState("");
  const [users, setUsers] = useState(null);
  const [openUser, setOpenUser] = useState(null);
  const [msg, setMsg] = useState("");

  const load = () => adminListUsers(q).then(setUsers).catch((e) => setMsg(e.message));
  useEffect(() => { load(); }, []);

  return (
    <>
      <Card>
        <div style={{ display: "flex", gap: 8 }}>
          <input style={{ ...field, flex: 1, minWidth: 0 }} value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()} placeholder="ابحث بالاسم أو الجوال..." />
          <button style={gold} onClick={load}><SearchIcon size={14} /></button>
          {users?.length > 0 && (
            <button style={ghost} onClick={() =>
              downloadCSV("الأعضاء.csv",
                ["اسم العرض", "اسم الدخول", "الجوال", "التوقعات", "النقاط", "مشرف", "محظور", "تاريخ التسجيل"],
                users.map((u) => [u.display_name, u.username, u.phone || "", u.predictions, u.points,
                  u.is_admin ? "نعم" : "", u.is_banned ? "نعم" : "", u.created_at]))
            }>CSV</button>
          )}
        </div>
      </Card>
      {!users && <p style={{ color: C.muted, fontSize: 13, textAlign: "center" }}>جاري التحميل...</p>}
      {users?.map((u) => (
        <div key={u.username} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: "12px 14px", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
            onClick={() => setOpenUser(openUser === u.username ? null : u.username)}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: C.text, fontWeight: 800, fontSize: 14.5, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                {u.display_name}
                <span dir="ltr" style={{ color: C.muted, fontWeight: 600, fontSize: 12 }}>@{u.username}</span>
                {u.is_admin && <span style={{ fontSize: 10.5, color: C.gold, background: C.goldSoft, padding: "2px 8px", borderRadius: 999, fontWeight: 800 }}>مشرف</span>}
                {u.is_banned && <span style={{ fontSize: 10.5, color: C.red, background: "rgba(255,107,107,0.12)", padding: "2px 8px", borderRadius: 999, fontWeight: 800 }}>محظور</span>}
              </div>
              <div style={{ color: C.muted, fontSize: 12, marginTop: 3, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <span dir="ltr">{u.phone || <span style={{ color: C.red }}>بدون جوال</span>}</span>
                <span className="num">{countWord(Number(u.predictions), "توقع واحد", "توقعان", "توقعات")}</span>
                <span className="num" style={{ color: C.gold }}>{u.points} نقطة</span>
              </div>
            </div>
            <span style={{ color: C.muted, fontSize: 17 }}>{openUser === u.username ? "▾" : "‹"}</span>
          </div>
          {openUser === u.username && <UserActions u={u} onDone={load} setMsg={setMsg} />}
        </div>
      ))}
      {users?.length === 0 && <p style={{ color: C.muted, fontSize: 13, textAlign: "center" }}>لا نتائج</p>}
      {msg && <p style={{ color: msg.includes("✓") ? C.green : C.red, fontSize: 13, textAlign: "center", fontWeight: 700 }}>{msg}</p>}
    </>
  );
}

/* ───────────── 4) التحديات ───────────── */
function AdminChallengeView({ id, onBack }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => { adminChallengeBoard(id).then(setData).catch((e) => setErr(e.message)); }, [id]);
  if (err) return <p style={{ color: C.red, fontSize: 13, textAlign: "center" }}>{err}</p>;
  if (!data) return <p style={{ color: C.muted, fontSize: 13, textAlign: "center" }}>جاري التحميل...</p>;
  return (
    <>
      <button onClick={onBack} style={{ ...ghost, display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
        <BackIcon size={14} /> رجوع للتحديات
      </button>
      <Card title={data.name}>
        <div style={{ color: C.muted, fontSize: 12, marginBottom: 10, lineHeight: 1.9 }}>
          {data.type === "private" && <>المنشئ: {data.owner || "—"} · الكود: <b dir="ltr" style={{ color: C.gold }}>{data.code}</b> · </>}
          {countWord(data.board.length, "عضو واحد", "عضوان", "أعضاء")}
          {data.join_locked && <span style={{ color: C.red }}> · الانضمام مقفل</span>}
        </div>
        <div style={{ display: "flex", color: C.muted, fontSize: 10.5, fontWeight: 700, padding: "6px 0", borderBottom: `1px solid ${C.line}` }}>
          <span style={{ width: 24 }}>#</span>
          <span style={{ flex: 1 }}>العضو</span>
          <span style={{ width: 84, textAlign: "center" }}>الجوال</span>
          <span style={{ width: 40, textAlign: "center" }}>توقع</span>
          <span style={{ width: 36, textAlign: "center" }}>أصاب</span>
          <span style={{ width: 38, textAlign: "center" }}>نقاط</span>
        </div>
        <button style={{ ...ghost, margin: "10px 0", fontSize: 12 }} onClick={() =>
          downloadCSV(`لوحة-${data.name}.csv`,
            ["المركز", "اسم العرض", "اسم الدخول", "الجوال", "إجمالي التوقعات", "الصحيحة", "النقاط"],
            data.board.map((r, i) => [i + 1, r.display_name, r.username, r.phone || "", r.total_predictions, r.exact_count, r.points]))
        }>تصدير اللوحة CSV (للجوائز)</button>
        {data.board.map((r, i) => (
          <div key={`${r.username}-${i}`} style={{ display: "flex", alignItems: "center", padding: "8px 0", fontSize: 12.5, borderBottom: i === data.board.length - 1 ? "none" : `1px solid ${C.line}`, background: i === 0 ? C.goldSoft : "transparent", borderRadius: i === 0 ? 6 : 0 }}>
            <span className="num" style={{ width: 24, color: Number(r.rank) === 1 ? C.gold : C.muted, fontWeight: Number(r.rank) <= 3 ? 900 : 600 }}>{r.rank}</span>
            <span style={{ flex: 1, minWidth: 0, color: C.text, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {r.display_name} <span dir="ltr" style={{ color: C.muted, fontWeight: 600, fontSize: 10.5 }}>@{r.username}</span>
            </span>
            <span dir="ltr" className="num" style={{ width: 84, textAlign: "center", color: r.phone ? C.muted : C.red, fontSize: 10.5 }}>{r.phone || "بدون جوال"}</span>
            <span className="num" style={{ width: 40, textAlign: "center", color: C.muted }}>{r.total_predictions}</span>
            <span className="num" style={{ width: 36, textAlign: "center", color: C.green }}>{r.exact_count}</span>
            <span className="num" style={{ width: 38, textAlign: "center", color: C.gold, fontWeight: 900, fontSize: 14 }}>{r.points}</span>
          </div>
        ))}
      </Card>
    </>
  );
}

function ChallengesTab() {
  const [list, setList] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [msg, setMsg] = useState("");
  const load = () => adminListChallenges().then(setList).catch((e) => setMsg(e.message));
  useEffect(() => { load(); }, []);

  if (openId) return <AdminChallengeView id={openId} onBack={() => setOpenId(null)} />;

  return (
    <>
      {!list && <p style={{ color: C.muted, fontSize: 13, textAlign: "center" }}>جاري التحميل...</p>}
      {list?.map((c) => (
        <div key={c.id} style={{ background: C.card, border: `1px solid ${c.type === "public" ? "rgba(246,196,83,0.35)" : C.line}`, borderRadius: 14, padding: "12px 14px", marginBottom: 10, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 140, cursor: "pointer" }} onClick={() => setOpenId(c.id)}>
            <div style={{ color: C.text, fontWeight: 800, fontSize: 14.5 }}>
              {c.name}
              {c.type === "public" && <span style={{ fontSize: 10.5, color: C.gold, background: C.goldSoft, padding: "2px 8px", borderRadius: 999, fontWeight: 800, marginRight: 6 }}>عام</span>}
            </div>
            <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>
              {c.type === "private" && <>المنشئ: {c.owner_display || "—"} · </>}
              {countWord(Number(c.members), "عضو واحد", "عضوان", "أعضاء")}
              {c.code && <> · الكود: <b dir="ltr" style={{ color: C.gold }}>{c.code}</b></>}
            </div>
          </div>
          <button style={ghost} onClick={() => setOpenId(c.id)}>اللوحة والأعضاء</button>
          {c.type === "private" && (
            <ConfirmButton label="حذف" onConfirm={async () => {
              try { await adminDeleteChallenge(c.id); setMsg("حُذف التحدي ✓"); load(); } catch (e) { setMsg(e.message); }
            }} />
          )}
        </div>
      ))}
      {msg && <p style={{ color: msg.includes("✓") ? C.green : C.red, fontSize: 13, textAlign: "center", fontWeight: 700 }}>{msg}</p>}
    </>
  );
}

/* ───────────── 5) سجل العمليات ───────────── */
const ACTION_LABELS = {
  set_result: "اعتماد نتيجة", reschedule: "تأجيل مباراة", cancel_match: "إلغاء مباراة",
  reset_pin: "إعادة تعيين رمز", ban: "حظر", unban: "رفع حظر", rename: "تغيير اسم عرض",
  set_phone: "تسجيل جوال", delete_prediction: "حذف توقع", delete_challenge: "حذف تحدٍّ",
  make_admin: "ترقية مشرف", remove_admin: "سحب إشراف",
};

function IntegrityCard() {
  const [rep, setRep] = useState(null);
  const [busy, setBusy] = useState(false);
  const Section = ({ title, items, render }) => (
    <div style={{ marginTop: 8 }}>
      <div style={{ color: C.text, fontWeight: 800, fontSize: 12.5 }}>{title}</div>
      {items.length === 0
        ? <p style={{ color: C.green, fontSize: 12, margin: "4px 0" }}>لا شيء مريب ✓</p>
        : items.map((x, i) => <div key={i} style={{ color: C.muted, fontSize: 12, padding: "3px 0" }}>{render(x)}</div>)}
    </div>
  );
  return (
    <Card title="فحص النزاهة">
      <button style={ghost} disabled={busy} onClick={async () => {
        setBusy(true);
        try { setRep(await adminIntegrityReport()); } catch (e) { setRep({ err: e.message }); }
        setBusy(false);
      }}>{busy ? "جاري الفحص..." : "فحص الآن"}</button>
      {rep?.err && <p style={{ color: C.red, fontSize: 12.5 }}>{rep.err}</p>}
      {rep && !rep.err && (
        <>
          <Section title="حسابات سُجّلت متقاربة زمنيًا (أقل من 5 دقائق)" items={rep.close_registrations}
            render={(x) => `${x.user1} و ${x.user2} — بفارق ${x.minutes_apart} دقيقة`} />
          <Section title="توقعات متطابقة منهجيًا (80%+ من 5 مباريات مشتركة فأكثر)" items={rep.identical_predictions}
            render={(x) => `${x.user1} و ${x.user2} — تطابق ${x.same} من ${x.common}`} />
          <Section title="معتادو آخر دقيقة قبل القفل (3 مرات فأكثر)" items={rep.last_minute_users}
            render={(x) => `${x.member} — ${x.times} مرة`} />
        </>
      )}
    </Card>
  );
}

function AuditTab() {
  const [log, setLog] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => { adminAuditLog(100).then(setLog).catch((e) => setErr(e.message)); }, []);
  if (err) return <p style={{ color: C.red, fontSize: 13, textAlign: "center" }}>{err}</p>;
  if (!log) return <p style={{ color: C.muted, fontSize: 13, textAlign: "center" }}>جاري التحميل...</p>;
  return (
    <>
    <IntegrityCard />
    <Card title="آخر 100 عملية إدارية">
      {log.length === 0 && <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>لا عمليات بعد</p>}
      {log.map((e) => (
        <div key={e.id} style={{ padding: "8px 0", borderBottom: `1px solid ${C.line}`, fontSize: 12.5 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <span style={{ color: C.text, fontWeight: 700 }}>{ACTION_LABELS[e.action] || e.action}</span>
            <span className="num" style={{ color: C.muted, fontSize: 11 }}>{fmtTime(e.created_at)}</span>
          </div>
          <div style={{ color: C.muted, marginTop: 2 }}>
            بواسطة {e.admin_name}
            {e.details && <span dir="ltr" style={{ opacity: 0.75 }}> · {Object.entries(e.details).map(([k, v]) => `${k}: ${v}`).join(" · ")}</span>}
          </div>
        </div>
      ))}
    </Card>
    </>
  );
}

/* ───────────── الإطار ───────────── */
export default function AdminScreen({ matches, onChanged }) {
  const [tab, setTab] = useState("today");
  const tabs = [
    ["today", "اليوم", <ClockIconSmall key="i" />],
    ["overview", "نظرة عامة", <ChartIcon size={14} key="i" />],
    ["matches", "المباريات", <BallIcon size={14} key="i" />],
    ["users", "الأعضاء", <UsersIcon size={14} key="i" />],
    ["challenges", "التحديات", <TrophyIcon size={14} key="i" />],
    ["audit", "السجل", <ListIcon size={14} key="i" />],
  ];
  return (
    <div className="block">
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap", justifyContent: "center" }}>
        {tabs.map(([id, label, icon]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            border: `1px solid ${tab === id ? C.gold : C.line}`, cursor: "pointer",
            background: tab === id ? C.goldSoft : "transparent", color: tab === id ? C.gold : C.muted,
            fontFamily: "inherit", fontWeight: 700, fontSize: 12.5, padding: "8px 13px", borderRadius: 999,
            display: "inline-flex", alignItems: "center", gap: 6,
          }}>{icon}{label}</button>
        ))}
      </div>
      {tab === "today" && <TodayTab matches={matches} />}
      {tab === "overview" && <OverviewTab />}
      {tab === "matches" && <MatchesTab matches={matches} onChanged={onChanged} />}
      {tab === "users" && <UsersTab />}
      {tab === "challenges" && <ChallengesTab />}
      {tab === "audit" && <AuditTab />}
    </div>
  );
}
