import React, { useEffect, useState } from "react";
import { C } from "../theme";
import { NAMES, ALL_MATCHES } from "../data/tournament";
import { myChallenges, createChallenge, joinChallenge, leaderboard, matchPredictions } from "../lib/api";

const btn = (primary) => ({
  cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 13.5,
  padding: "10px 16px", borderRadius: 12,
  border: primary ? "none" : `1px solid ${C.line}`,
  color: primary ? "#2A1B00" : C.muted,
  background: primary ? "linear-gradient(135deg,#F6C453,#E0962F)" : "transparent",
});

const field = {
  flex: 1, padding: "11px 12px", borderRadius: 12, fontSize: 14, color: C.text,
  background: "rgba(255,255,255,0.06)", border: `1px solid ${C.line}`, outline: "none",
};

export default function ChallengesScreen({ matches }) {
  const [list, setList] = useState(null);
  const [open, setOpen] = useState(null);   // التحدي المفتوح حاليًا
  const [newName, setNewName] = useState("");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");

  const refresh = () => myChallenges().then(setList).catch((e) => setMsg(e.message));
  useEffect(() => { refresh(); }, []);

  const doCreate = async () => {
    if (newName.trim().length < 2) { setMsg("اكتب اسمًا للتحدي"); return; }
    try {
      const c = await createChallenge(newName.trim());
      setMsg(`✅ أُنشئ التحدي — كود الانضمام: ${c.code}`);
      setNewName(""); refresh();
    } catch (e) { setMsg(e.message); }
  };

  const doJoin = async () => {
    try {
      const c = await joinChallenge(code);
      setMsg(`✅ انضممت إلى «${c.name}»`);
      setCode(""); refresh();
    } catch (e) { setMsg(e.message); }
  };

  if (open) return <ChallengeView ch={open} matches={matches} onBack={() => setOpen(null)} />;

  return (
    <div className="block">
      <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 18, padding: 16, marginBottom: 18 }}>
        <div style={{ color: C.gold, fontWeight: 800, fontSize: 14, marginBottom: 10 }}>➕ أنشئ تحديًا خاصًا</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input style={field} value={newName} maxLength={40} placeholder="مثال: تحدي الديوانية"
            onChange={(e) => setNewName(e.target.value)} />
          <button style={btn(true)} onClick={doCreate}>إنشاء</button>
        </div>
        <div style={{ color: C.gold, fontWeight: 800, fontSize: 14, margin: "16px 0 10px" }}>🎟️ ادخل بكود تحدٍّ</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input style={{ ...field, letterSpacing: 3, textAlign: "center" }} value={code} maxLength={6}
            placeholder="ABC123" onChange={(e) => setCode(e.target.value.toUpperCase())} />
          <button style={btn(true)} onClick={doJoin}>انضمام</button>
        </div>
        {msg && <div style={{ color: msg.startsWith("✅") ? C.green : C.red, fontSize: 13, marginTop: 12, textAlign: "center", fontWeight: 700 }}>{msg}</div>}
      </div>

      {!list && <p style={{ color: C.muted, textAlign: "center" }}>جاري التحميل...</p>}
      {list?.map((ch) => (
        <button key={ch.id} onClick={() => setOpen(ch)} style={{
          width: "100%", textAlign: "right", cursor: "pointer", fontFamily: "inherit",
          background: C.card, border: `1px solid ${ch.type === "public" ? "rgba(246,196,83,0.35)" : C.line}`,
          borderRadius: 16, padding: "14px 16px", marginBottom: 10,
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <span style={{ fontSize: 24 }}>{ch.type === "public" ? "🌍" : "⚔️"}</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", color: C.text, fontWeight: 800, fontSize: 15 }}>{ch.name}</span>
            <span style={{ display: "block", color: C.muted, fontSize: 12, marginTop: 2 }}>
              👥 {ch.members} عضو
              {ch.is_owner && ch.code && <> · الكود: <b style={{ color: C.gold, letterSpacing: 2 }}>{ch.code}</b></>}
            </span>
          </span>
          <span style={{ color: C.gold, fontSize: 18 }}>‹</span>
        </button>
      ))}
    </div>
  );
}

/* داخل التحدي: لوحة الصدارة + توقعات الأعضاء للمباريات المقفلة */
function ChallengeView({ ch, matches, onBack }) {
  const [board, setBoard] = useState(null);
  const [matchId, setMatchId] = useState("");
  const [preds, setPreds] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => { leaderboard(ch.id).then(setBoard).catch((e) => setErr(e.message)); }, [ch.id]);

  // المباريات المقفلة فقط (توقعات الأعضاء تنكشف بعد القفل)
  const lockedMatches = ALL_MATCHES.filter((m) => {
    const s = (matches || []).find((x) => x.id === m.id);
    return s && (s.status === "finished" || new Date(s.locks_at) <= new Date());
  });

  const loadPreds = async (id) => {
    setMatchId(id); setPreds(null);
    if (!id) return;
    try { setPreds(await matchPredictions(ch.id, id)); } catch (e) { setErr(e.message); }
  };

  const medal = (i) => ["🥇", "🥈", "🥉"][i] || `${i + 1}`;

  return (
    <div className="block">
      <button onClick={onBack} style={btn(false)}>← رجوع</button>
      <h2 style={{ color: C.text, fontWeight: 900, fontSize: 20, margin: "14px 0 4px" }}>
        {ch.type === "public" ? "🌍" : "⚔️"} {ch.name}
      </h2>
      {ch.is_owner && ch.code && (
        <p style={{ color: C.muted, fontSize: 13, margin: "0 0 14px" }}>
          شارك الكود مع من تريد: <b style={{ color: C.gold, letterSpacing: 3, fontSize: 15 }}>{ch.code}</b>
        </p>
      )}

      <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 18, padding: "8px 14px", marginTop: 8 }}>
        <div style={{ display: "flex", color: C.muted, fontSize: 11.5, fontWeight: 700, padding: "8px 2px", borderBottom: `1px solid ${C.line}` }}>
          <span style={{ width: 34 }}>#</span>
          <span style={{ flex: 1 }}>العضو</span>
          <span style={{ width: 44, textAlign: "center" }}>🎯 دقيقة</span>
          <span style={{ width: 40, textAlign: "center" }}>لعب</span>
          <span style={{ width: 48, textAlign: "center" }}>نقاط</span>
        </div>
        {!board && !err && <p style={{ color: C.muted, fontSize: 13, textAlign: "center" }}>جاري التحميل...</p>}
        {board?.map((r, i) => (
          <div key={r.username} style={{
            display: "flex", alignItems: "center", padding: "10px 2px", fontSize: 14,
            borderBottom: i === board.length - 1 ? "none" : `1px solid ${C.line}`,
            background: i === 0 ? C.goldSoft : "transparent", borderRadius: i === 0 ? 8 : 0,
          }}>
            <span style={{ width: 34, fontSize: i < 3 ? 17 : 13, color: C.muted }}>{medal(i)}</span>
            <span style={{ flex: 1, color: C.text, fontWeight: 700 }}>{r.username}</span>
            <span style={{ width: 44, textAlign: "center", color: C.green, fontSize: 13 }}>{r.exact_count}</span>
            <span style={{ width: 40, textAlign: "center", color: C.muted, fontSize: 13 }}>{r.played}</span>
            <span style={{ width: 48, textAlign: "center", color: C.gold, fontWeight: 900, fontSize: 16 }}>{r.points}</span>
          </div>
        ))}
        {board?.length === 0 && <p style={{ color: C.muted, fontSize: 13, textAlign: "center" }}>لا أعضاء بعد</p>}
      </div>

      <div style={{ marginTop: 20 }}>
        <div style={{ color: C.gold, fontWeight: 800, fontSize: 14, marginBottom: 8 }}>👀 توقعات الأعضاء (بعد قفل المباراة)</div>
        <select value={matchId} onChange={(e) => loadPreds(e.target.value)} style={{
          width: "100%", padding: "11px 12px", borderRadius: 12, fontSize: 14, fontFamily: "inherit",
          color: C.text, background: "#171E40", border: `1px solid ${C.line}`, outline: "none",
        }}>
          <option value="">اختر مباراة مقفلة...</option>
          {lockedMatches.map((m) => (
            <option key={m.id} value={m.id}>{NAMES[m.a]} ضد {NAMES[m.b]} · {m.date}</option>
          ))}
        </select>
        {preds && (
          <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: "6px 14px", marginTop: 10 }}>
            {preds.length === 0 && <p style={{ color: C.muted, fontSize: 13, textAlign: "center" }}>لا توقعات لهذه المباراة في هذا التحدي</p>}
            {preds.map((p, i) => (
              <div key={p.username} style={{ display: "flex", padding: "9px 0", fontSize: 13.5, borderBottom: i === preds.length - 1 ? "none" : `1px solid ${C.line}` }}>
                <span style={{ flex: 1, color: C.text, fontWeight: 700 }}>{p.username}</span>
                <span style={{ color: C.muted }}>{p.h}–{p.a}</span>
                <span style={{ width: 56, textAlign: "left", color: p.points > 0 ? C.gold : C.muted, fontWeight: 800 }}>
                  {p.points > 0 ? `+${p.points}` : "—"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      {err && <p style={{ color: C.red, fontSize: 13, textAlign: "center", marginTop: 10 }}>{err}</p>}
    </div>
  );
}
