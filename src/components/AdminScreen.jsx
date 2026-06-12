import React, { useEffect, useState } from "react";
import { C } from "../theme";
import { NAMES, ALL_MATCHES } from "../data/tournament";
import { adminSetResult, adminOverview, adminMatchStats, adminResetPin, adminBan } from "../lib/api";

const field = {
  padding: "10px 12px", borderRadius: 10, fontSize: 14, color: C.text,
  background: "rgba(255,255,255,0.06)", border: `1px solid ${C.line}`, outline: "none", fontFamily: "inherit",
};
const gold = {
  cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 13,
  padding: "9px 14px", borderRadius: 10, border: "none", color: "#2A1B00",
  background: "linear-gradient(135deg,#F6C453,#E0962F)",
};

function Card({ title, children }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 18, padding: 16, marginBottom: 16 }}>
      <div style={{ color: C.gold, fontWeight: 800, fontSize: 14, marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  );
}

export default function AdminScreen({ matches, onChanged }) {
  const [ov, setOv] = useState(null);
  const [mid, setMid] = useState("");
  const [h, setH] = useState(""); const [a, setA] = useState("");
  const [stats, setStats] = useState(null);
  const [user, setUser] = useState(""); const [newPin, setNewPin] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => { adminOverview().then(setOv).catch(() => {}); }, []);

  const byId = Object.fromEntries((matches || []).map((r) => [r.id, r]));

  const setResult = async () => {
    if (!mid || h === "" || a === "") { setMsg("اختر المباراة وأدخل النتيجة"); return; }
    try {
      await adminSetResult(mid, Number(h), Number(a));
      setMsg("✅ اعتُمدت النتيجة — احتُسبت النقاط وتحدثت كل اللوحات");
      onChanged?.();
    } catch (e) { setMsg(e.message); }
  };

  const loadStats = async () => {
    if (!mid) return;
    try { setStats(await adminMatchStats(mid)); } catch (e) { setMsg(e.message); }
  };

  return (
    <div className="block">
      <Card title="📈 نظرة عامة على البطولة">
        {!ov ? <p style={{ color: C.muted, fontSize: 13 }}>جاري التحميل...</p> : (
          <div style={{ display: "flex", gap: 10, textAlign: "center" }}>
            {[["الأعضاء", ov.users], ["تحديات خاصة", ov.challenges], ["التوقعات", ov.predictions], ["مباريات منتهية", ov.finished]].map(([l, v]) => (
              <div key={l} style={{ flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: "10px 4px" }}>
                <div style={{ color: C.gold, fontWeight: 900, fontSize: 20 }}>{v}</div>
                <div style={{ color: C.muted, fontSize: 11 }}>{l}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="⚽ اعتماد / تصحيح نتيجة">
        <select value={mid} onChange={(e) => { setMid(e.target.value); setStats(null); }}
          style={{ ...field, width: "100%", background: "#171E40" }}>
          <option value="">اختر المباراة...</option>
          {ALL_MATCHES.map((m) => {
            const s = byId[m.id];
            const done = s?.status === "finished";
            return (
              <option key={m.id} value={m.id}>
                {done ? "✅ " : ""}{NAMES[m.a]} ضد {NAMES[m.b]} · {m.date}
                {done ? ` (${s.result_h}–${s.result_a})` : ""}
              </option>
            );
          })}
        </select>
        <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
          <input style={{ ...field, width: 70, textAlign: "center" }} inputMode="numeric" maxLength={2}
            value={h} onChange={(e) => setH(e.target.value.replace(/\D/g, ""))} placeholder="الأول" />
          <span style={{ color: C.muted, fontWeight: 800 }}>–</span>
          <input style={{ ...field, width: 70, textAlign: "center" }} inputMode="numeric" maxLength={2}
            value={a} onChange={(e) => setA(e.target.value.replace(/\D/g, ""))} placeholder="الثاني" />
          <button style={gold} onClick={setResult}>اعتماد</button>
          <button style={{ ...gold, background: "transparent", color: C.muted, border: `1px solid ${C.line}` }} onClick={loadStats}>📊 إحصاءات</button>
        </div>
        <p style={{ color: C.muted, fontSize: 11.5, margin: "10px 0 0", lineHeight: 1.7 }}>
          تصحيح نتيجة سابقة: اختر المباراة نفسها وأدخل النتيجة الصحيحة — النقاط تُعاد حسابها تلقائيًا في كل التحديات، ويُسجَّل التعديل في سجل التدقيق.
        </p>
        {stats && (
          <div style={{ marginTop: 12, fontSize: 13, color: C.text }}>
            <div>👥 إجمالي المتوقعين: <b style={{ color: C.gold }}>{stats.total}</b></div>
            {stats.distribution?.length > 0 && (
              <div style={{ marginTop: 6, color: C.muted }}>
                أكثر التوقعات: {stats.distribution.slice(0, 5).map((d) => `${d.h}–${d.a} (${d.n})`).join(" · ")}
              </div>
            )}
            {stats.last_minute?.length > 0 && (
              <div style={{ marginTop: 6, color: C.red }}>
                ⚠️ توقعات في آخر دقيقة قبل القفل: {stats.last_minute.map((s) => s.username).join("، ")}
              </div>
            )}
          </div>
        )}
      </Card>

      <Card title="👤 إدارة الأعضاء">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input style={{ ...field, flex: 1, minWidth: 120 }} value={user}
            onChange={(e) => setUser(e.target.value)} placeholder="اسم العضو" />
          <input style={{ ...field, width: 110 }} value={newPin} inputMode="numeric" maxLength={6}
            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))} placeholder="رمز جديد" />
          <button style={gold} onClick={async () => {
            try { await adminResetPin(user, newPin); setMsg(`✅ أُعيد تعيين رمز ${user} (تسجّل خروجه من كل أجهزته)`); }
            catch (e) { setMsg(e.message); }
          }}>إعادة تعيين الرمز</button>
          <button style={{ ...gold, background: "rgba(255,107,107,0.15)", color: C.red, border: `1px solid rgba(255,107,107,0.4)` }}
            onClick={async () => {
              try { await adminBan(user, true); setMsg(`✅ حُظر ${user}`); } catch (e) { setMsg(e.message); }
            }}>حظر</button>
          <button style={{ ...gold, background: "transparent", color: C.muted, border: `1px solid ${C.line}` }}
            onClick={async () => {
              try { await adminBan(user, false); setMsg(`✅ رُفع الحظر عن ${user}`); } catch (e) { setMsg(e.message); }
            }}>رفع الحظر</button>
        </div>
      </Card>

      {msg && <p style={{ color: msg.startsWith("✅") ? C.green : C.red, fontSize: 13, textAlign: "center", fontWeight: 700 }}>{msg}</p>}
    </div>
  );
}
