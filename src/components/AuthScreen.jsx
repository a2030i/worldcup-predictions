import React, { useState } from "react";
import { C } from "../theme";
import { register, login, saveSession } from "../lib/api";

const field = {
  width: "100%", padding: "13px 14px", borderRadius: 12, fontSize: 15,
  color: C.text, background: "rgba(255,255,255,0.06)",
  border: `1px solid ${C.line}`, outline: "none",
};

export default function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login"); // login | register
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const go = async () => {
    if (username.trim().length < 2) { setErr("اكتب اسمًا من حرفين على الأقل"); return; }
    if (!/^\d{4,6}$/.test(pin)) { setErr("الرمز السري: 4 إلى 6 أرقام"); return; }
    setBusy(true); setErr("");
    try {
      const fn = mode === "register" ? register : login;
      const res = await fn(username.trim(), pin);
      const session = { token: res.token, username: res.username, isAdmin: res.is_admin };
      saveSession(session);
      onAuth(session);
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <div className="block" style={{ maxWidth: 380, margin: "10vh auto 0" }}>
      <div style={{ textAlign: "center", marginBottom: 22 }}>
        <div style={{ fontSize: 44 }}>⚽</div>
        <h1 style={{ color: C.text, fontSize: 26, fontWeight: 900, margin: "8px 0 4px" }}>تحدي توقعات كأس العالم</h1>
        <p style={{ color: C.muted, fontSize: 13, lineHeight: 1.8, margin: 0 }}>
          توقّع نتائج المباريات ونافس الجميع — بدون إيميل ولا جوال
        </p>
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 20, padding: 20 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {[["login", "تسجيل دخول"], ["register", "عضو جديد"]].map(([m, label]) => (
            <button key={m} onClick={() => { setMode(m); setErr(""); }} style={{
              flex: 1, cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 14,
              padding: "10px 0", borderRadius: 12,
              border: `1px solid ${mode === m ? C.gold : C.line}`,
              background: mode === m ? C.goldSoft : "transparent",
              color: mode === m ? C.gold : C.muted,
            }}>{label}</button>
          ))}
        </div>

        <label style={{ color: C.muted, fontSize: 12.5, fontWeight: 700, display: "block", marginBottom: 6 }}>اسمك في المنافسة</label>
        <input style={field} value={username} maxLength={20}
          onChange={(e) => setUsername(e.target.value)} placeholder="مثال: أبو فهد" />

        <label style={{ color: C.muted, fontSize: 12.5, fontWeight: 700, display: "block", margin: "14px 0 6px" }}>
          رمز سري (4–6 أرقام) {mode === "register" && <span style={{ opacity: 0.7 }}>— احفظه، تحتاجه من أي جهاز آخر</span>}
        </label>
        <input style={field} value={pin} inputMode="numeric" maxLength={6} type="password"
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} placeholder="••••"
          onKeyDown={(e) => e.key === "Enter" && go()} />

        {err && <div style={{ color: C.red, fontSize: 13, marginTop: 12, textAlign: "center" }}>{err}</div>}

        <button onClick={go} disabled={busy} style={{
          width: "100%", marginTop: 18, cursor: "pointer", fontFamily: "inherit",
          fontWeight: 900, fontSize: 16, padding: "13px 0", borderRadius: 14, border: "none",
          color: "#2A1B00", background: "linear-gradient(135deg,#F6C453,#E0962F)",
          opacity: busy ? 0.6 : 1,
        }}>{busy ? "لحظات..." : mode === "register" ? "🚀 انضم للتحدي" : "دخول"}</button>
      </div>
    </div>
  );
}
