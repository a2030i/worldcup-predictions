import React, { useState } from "react";
import { C } from "../theme";
import { register, login, saveSession } from "../lib/api";

const field = {
  width: "100%", padding: "13px 14px", borderRadius: 12, fontSize: 15,
  color: C.text, background: "rgba(255,255,255,0.06)",
  border: `1px solid ${C.line}`, outline: "none",
};

const Label = ({ children, hint }) => (
  <label style={{ color: C.muted, fontSize: 12.5, fontWeight: 700, display: "block", margin: "14px 0 6px" }}>
    {children} {hint && <span style={{ opacity: 0.7, fontWeight: 600 }}>— {hint}</span>}
  </label>
);

export default function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login"); // login | register
  const [username, setUsername] = useState("");      // اسم الدخول (إنجليزي/أرقام)
  const [displayName, setDisplayName] = useState(""); // الاسم الظاهر في المنافسة
  const [phone, setPhone] = useState("");             // 05xxxxxxxx
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const registering = mode === "register";

  const go = async () => {
    if (registering) {
      if (!/^[A-Za-z0-9_]{3,20}$/.test(username.trim())) { setErr("اسم الدخول: حروف إنجليزية وأرقام فقط (3–20 خانة)"); return; }
      if (displayName.trim().length < 2) { setErr("اكتب اسم العرض من حرفين على الأقل"); return; }
      if (!/^05\d{8}$/.test(phone)) { setErr("رقم الجوال يبدأ بـ 05 ويتكون من 10 أرقام"); return; }
    } else if (username.trim().length < 2) { setErr("اكتب اسم الدخول"); return; }
    if (!/^\d{4,6}$/.test(pin)) { setErr("الرمز السري: 4 إلى 6 أرقام"); return; }
    setBusy(true); setErr("");
    try {
      const res = registering
        ? await register(username.trim(), pin, displayName.trim(), phone)
        : await login(username.trim(), pin);
      const session = { token: res.token, username: res.username, displayName: res.display_name, isAdmin: res.is_admin };
      saveSession(session);
      onAuth(session);
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <div className="block" style={{ maxWidth: 380, margin: "8vh auto 0" }}>
      <div style={{ textAlign: "center", marginBottom: 22 }}>
        <div style={{ fontSize: 44 }}>⚽</div>
        <h1 style={{ color: C.text, fontSize: 26, fontWeight: 900, margin: "8px 0 4px" }}>تحدي توقعات كأس العالم</h1>
        <p style={{ color: C.muted, fontSize: 13, lineHeight: 1.8, margin: 0 }}>
          توقّع نتائج المباريات ونافس الجميع — بدون إيميل
        </p>
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 20, padding: 20 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
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

        <Label hint={registering ? "إنجليزي وأرقام، تدخل به من أي جهاز" : null}>اسم الدخول</Label>
        <input style={{ ...field, direction: "ltr", textAlign: registering ? "left" : "right" }}
          value={username} maxLength={20} autoCapitalize="none" autoCorrect="off"
          onChange={(e) => setUsername(registering ? e.target.value.replace(/[^A-Za-z0-9_]/g, "") : e.target.value)}
          placeholder={registering ? "abu_fahad7" : "اسم الدخول"} />

        {registering && (
          <>
            <Label hint="يظهر في لوحات الصدارة">اسم العرض</Label>
            <input style={field} value={displayName} maxLength={20}
              onChange={(e) => setDisplayName(e.target.value)} placeholder="مثال: أبو فهد" />

            <Label hint="للتواصل عند توزيع الجوائز 🏆">رقم الجوال</Label>
            <input style={{ ...field, direction: "ltr", textAlign: "left" }} value={phone}
              inputMode="numeric" maxLength={10}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} placeholder="05xxxxxxxx" />
          </>
        )}

        <Label hint={registering ? "احفظه، تحتاجه من أي جهاز آخر" : null}>رمز سري (4–6 أرقام)</Label>
        <input style={field} value={pin} inputMode="numeric" maxLength={6} type="password"
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} placeholder="••••"
          onKeyDown={(e) => e.key === "Enter" && go()} />

        {err && <div style={{ color: C.red, fontSize: 13, marginTop: 12, textAlign: "center" }}>{err}</div>}

        <button onClick={go} disabled={busy} style={{
          width: "100%", marginTop: 18, cursor: "pointer", fontFamily: "inherit",
          fontWeight: 900, fontSize: 16, padding: "13px 0", borderRadius: 14, border: "none",
          color: "#2A1B00", background: "linear-gradient(135deg,#F6C453,#E0962F)",
          opacity: busy ? 0.6 : 1,
        }}>{busy ? "لحظات..." : registering ? "🚀 انضم للتحدي" : "دخول"}</button>
      </div>
    </div>
  );
}
