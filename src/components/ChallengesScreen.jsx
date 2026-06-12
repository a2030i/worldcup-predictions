import React, { useEffect, useState } from "react";
import { C } from "../theme";
import { NAMES, ALL_MATCHES } from "../data/tournament";
import {
  myChallenges, createChallenge, joinChallenge, leaderboard, matchPredictions, myRanks,
  challengeSetLock, challengeRegenCode, challengeKick, challengeMembers,
} from "../lib/api";
import { countWord } from "../lib/format";
import { PlusIcon, TicketIcon, UsersIcon, TrophyIcon, BallIcon, CopyIcon, ShareIcon, BackIcon, EyeIcon } from "../icons.jsx";

const btn = (primary) => ({
  cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 13.5,
  padding: "11px 16px", borderRadius: 12,
  border: primary ? "none" : `1px solid ${C.line}`,
  color: primary ? "#2A1B00" : C.muted,
  background: primary ? "linear-gradient(135deg,#F6C453,#E0962F)" : "transparent",
  display: "inline-flex", alignItems: "center", gap: 6,
});

const field = {
  flex: 1, minWidth: 0, padding: "11px 12px", borderRadius: 12, fontSize: 14, color: C.text,
  background: "rgba(255,255,255,0.06)", border: `1px solid ${C.line}`, outline: "none",
};

const SectionTitle = ({ icon, children }) => (
  <div style={{ color: C.gold, fontWeight: 800, fontSize: 14, display: "flex", alignItems: "center", gap: 7 }}>
    {icon}{children}
  </div>
);

export default function ChallengesScreen({ matches }) {
  const [list, setList] = useState(null);
  const [ranks, setRanks] = useState({});   // ترتيبي في كل تحدٍّ: { challenge_id: {rank, members, points} }
  const [open, setOpen] = useState(null);   // التحدي المفتوح حاليًا
  const [newName, setNewName] = useState("");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    myChallenges().then(setList).catch((e) => setMsg(e.message));
    myRanks()
      .then((rows) => setRanks(Object.fromEntries(rows.map((r) => [r.challenge_id, r]))))
      .catch(() => {});
  };
  useEffect(() => { refresh(); }, []);

  const doCreate = async () => {
    if (busy) return;
    if (newName.trim().length < 2) { setMsg("اكتب اسمًا للتحدي"); return; }
    setBusy(true);
    try {
      const c = await createChallenge(newName.trim());
      setMsg(`أُنشئ التحدي ✓ — كود الانضمام: ${c.code}`);
      setNewName(""); refresh();
    } catch (e) { setMsg(e.message); }
    setBusy(false);
  };

  const doJoin = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const c = await joinChallenge(code);
      setMsg(`انضممت إلى «${c.name}» ✓`);
      setCode(""); refresh();
    } catch (e) { setMsg(e.message); }
    setBusy(false);
  };

  if (open) return <ChallengeView ch={open} matches={matches} onBack={() => setOpen(null)} />;

  return (
    <div className="block">
      <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 18, padding: 16, marginBottom: 18 }}>
        <SectionTitle icon={<PlusIcon size={15} />}>تحدٍّ خاص جديد</SectionTitle>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <input style={field} value={newName} maxLength={40} placeholder="مثال: تحدي الديوانية"
            onChange={(e) => setNewName(e.target.value)} />
          <button style={btn(true)} onClick={doCreate} disabled={busy}>إنشاء</button>
        </div>
        <div style={{ marginTop: 16 }}>
          <SectionTitle icon={<TicketIcon size={15} />}>الانضمام بكود</SectionTitle>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <input dir="ltr" style={{ ...field, letterSpacing: 3, textAlign: "center" }} value={code} maxLength={6}
            placeholder="ABC123" autoCapitalize="characters"
            onChange={(e) => setCode(e.target.value.toUpperCase())} />
          <button style={btn(true)} onClick={doJoin} disabled={busy}>انضمام</button>
        </div>
        {msg && <div style={{ color: msg.includes("✓") ? C.green : C.red, fontSize: 13, marginTop: 12, textAlign: "center", fontWeight: 700 }}>{msg}</div>}
      </div>

      {!list && <p style={{ color: C.muted, textAlign: "center" }}>جاري التحميل...</p>}
      {list?.map((ch) => (
        <button key={ch.id} onClick={() => setOpen(ch)} style={{
          width: "100%", textAlign: "right", cursor: "pointer", fontFamily: "inherit",
          background: C.card, border: `1px solid ${ch.type === "public" ? "rgba(246,196,83,0.35)" : C.line}`,
          borderRadius: 16, padding: "14px 16px", marginBottom: 10,
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <span style={{
            width: 42, height: 42, borderRadius: 12, display: "inline-flex", alignItems: "center",
            justifyContent: "center", flexShrink: 0,
            background: ch.type === "public" ? C.goldSoft : "rgba(255,255,255,0.06)",
            color: ch.type === "public" ? C.gold : C.muted,
          }}>
            {ch.type === "public" ? <BallIcon size={22} /> : <TrophyIcon size={22} />}
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", color: C.text, fontWeight: 800, fontSize: 15 }}>{ch.name}</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: C.muted, fontSize: 12, marginTop: 2, flexWrap: "wrap" }}>
              <UsersIcon size={12} /> {countWord(Number(ch.members), "عضو واحد", "عضوان", "أعضاء")}
              {ch.is_owner && ch.code && <> · الكود: <b dir="ltr" style={{ color: C.gold, letterSpacing: 2 }}>{ch.code}</b></>}
            </span>
          </span>
          {ranks[ch.id] && (
            <span style={{ textAlign: "center", flexShrink: 0 }}>
              <span className="num" style={{ display: "block", color: Number(ranks[ch.id].my_rank) === 1 ? C.gold : C.text, fontWeight: 900, fontSize: 15 }}>
                {Number(ranks[ch.id].my_rank) === 1 ? `الأول من ${ranks[ch.id].members}` : `${ranks[ch.id].my_rank} من ${ranks[ch.id].members}`}
              </span>
              <span className="num" style={{ display: "block", color: C.muted, fontSize: 10.5 }}>{ranks[ch.id].my_points} نقطة</span>
            </span>
          )}
          <span style={{ color: C.gold, fontSize: 18 }}>‹</span>
        </button>
      ))}
    </div>
  );
}

/* إدارة المالك: قفل الانضمام · تجديد الكود · طرد عضو */
function OwnerTools({ ch, code, onCode }) {
  const [members, setMembers] = useState(null);
  const [locked, setLocked] = useState(!!ch.join_locked);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [confirmKick, setConfirmKick] = useState(null);
  const [confirmRegen, setConfirmRegen] = useState(false);

  const loadMembers = () => challengeMembers(ch.id).then(setMembers).catch((e) => setMsg(e.message));

  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: "10px 14px", margin: "4px 0 14px" }}>
      <button onClick={() => { setOpen(!open); if (!open && !members) loadMembers(); }}
        style={{ width: "100%", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit",
          color: C.gold, fontWeight: 800, fontSize: 13, display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
        <span>إدارة التحدي (أنت المنشئ)</span><span style={{ color: C.muted }}>{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button style={btn(false)} onClick={async () => {
              try { const r = await challengeSetLock(ch.id, !locked); setLocked(r.locked); setMsg(r.locked ? "أُقفل باب الانضمام ✓" : "فُتح باب الانضمام ✓"); }
              catch (e) { setMsg(e.message); }
            }}>{locked ? "فتح باب الانضمام" : "قفل باب الانضمام"}</button>
            <button style={{ ...btn(false), color: confirmRegen ? C.red : undefined }} onClick={async () => {
              if (!confirmRegen) { setConfirmRegen(true); setTimeout(() => setConfirmRegen(false), 3000); return; }
              setConfirmRegen(false);
              try { const r = await challengeRegenCode(ch.id); onCode(r.code); setMsg("جُدّد الكود ✓ — الكود القديم أصبح لاغيًا"); }
              catch (e) { setMsg(e.message); }
            }}>{confirmRegen ? "الكود القديم سيبطل — تأكيد؟" : "تجديد الكود"}</button>
          </div>
          {members && (
            <div style={{ marginTop: 10, borderTop: `1px solid ${C.line}`, paddingTop: 6 }}>
              {members.map((mb) => (
                <div key={mb.username} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", fontSize: 12.5 }}>
                  <span style={{ flex: 1, color: C.text, fontWeight: 700, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {mb.display_name} {mb.is_owner && <span style={{ color: C.gold, fontSize: 10.5 }}>(المنشئ)</span>}
                  </span>
                  {!mb.is_owner && (
                    <button style={{ ...btn(false), padding: "5px 10px", fontSize: 11,
                      color: confirmKick === mb.username ? "#2A1B00" : C.red,
                      background: confirmKick === mb.username ? "linear-gradient(135deg,#FF8B8B,#E05555)" : "transparent",
                      borderColor: "rgba(255,107,107,0.4)" }}
                      onClick={async () => {
                        if (confirmKick !== mb.username) { setConfirmKick(mb.username); setTimeout(() => setConfirmKick(null), 3000); return; }
                        setConfirmKick(null);
                        try { await challengeKick(ch.id, mb.username); setMsg(`طُرد ${mb.display_name} ✓`); loadMembers(); }
                        catch (e) { setMsg(e.message); }
                      }}>{confirmKick === mb.username ? "تأكيد الطرد" : "طرد"}</button>
                  )}
                </div>
              ))}
            </div>
          )}
          {msg && <p style={{ color: msg.includes("✓") ? C.green : C.red, fontSize: 12, margin: "8px 0 2px", textAlign: "center", fontWeight: 700 }}>{msg}</p>}
        </div>
      )}
    </div>
  );
}

/* داخل التحدي: لوحة الصدارة + توقعات الأعضاء للمباريات المقفلة */
function ChallengeView({ ch, matches, onBack }) {
  const [board, setBoard] = useState(null);
  const [matchId, setMatchId] = useState("");
  const [preds, setPreds] = useState(null);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  const [code, setCode] = useState(ch.code); // قد يتجدد من أدوات المالك

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

  const copyCode = async () => {
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { /* المتصفحات القديمة */ }
  };
  const shareWhatsApp = () => {
    const text = `تعال نافسنا في توقعات المونديال! ادخل «${ch.name}» بالكود ${code}\nhttps://a2030i.github.io/worldcup-predictions/`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  // التلوين بالمركز الحقيقي (المتعادلون يتشاركونه) لا بموضع الصف
  const rankStyle = (rank) => ({
    width: 26, height: 26, borderRadius: 999, display: "inline-flex", alignItems: "center",
    justifyContent: "center", fontSize: 12.5, fontWeight: 900, flexShrink: 0,
    color: rank === 1 ? "#2A1B00" : rank === 2 ? "#1A2040" : rank === 3 ? "#2A1505" : C.muted,
    background: rank === 1 ? "linear-gradient(135deg,#F6C453,#E0962F)"
      : rank === 2 ? "linear-gradient(135deg,#D7DCEE,#9BA3C4)"
      : rank === 3 ? "linear-gradient(135deg,#E2A06A,#B06A35)" : "rgba(255,255,255,0.05)",
  });

  return (
    <div className="block">
      <button onClick={onBack} style={btn(false)}><BackIcon size={15} /> رجوع</button>
      <h2 style={{ color: C.text, fontWeight: 900, fontSize: 20, margin: "14px 0 4px", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: C.gold }}>{ch.type === "public" ? <BallIcon size={20} /> : <TrophyIcon size={20} />}</span>
        {ch.name}
      </h2>
      {ch.is_owner && code && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", margin: "6px 0 14px" }}>
          <span style={{ color: C.muted, fontSize: 13 }}>
            كود الانضمام: <b dir="ltr" style={{ color: C.gold, letterSpacing: 3, fontSize: 15 }}>{code}</b>
          </span>
          <button onClick={copyCode} style={{ ...btn(false), padding: "7px 12px", fontSize: 12 }}>
            <CopyIcon size={13} /> {copied ? "نُسخ ✓" : "نسخ"}
          </button>
          <button onClick={shareWhatsApp} style={{ ...btn(false), padding: "7px 12px", fontSize: 12, color: "#4FCB6B", borderColor: "rgba(79,203,107,0.4)" }}>
            <ShareIcon size={13} /> مشاركة واتساب
          </button>
        </div>
      )}
      {ch.is_owner && ch.type === "private" && <OwnerTools ch={ch} code={code} onCode={setCode} />}

      <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 18, padding: "8px 14px", marginTop: 8 }}>
        <div style={{ display: "flex", color: C.muted, fontSize: 11, fontWeight: 700, padding: "8px 2px", borderBottom: `1px solid ${C.line}` }}>
          <span style={{ width: 34 }}>#</span>
          <span style={{ flex: 1 }}>العضو</span>
          <span style={{ width: 52, textAlign: "center" }}>توقعاته</span>
          <span style={{ width: 50, textAlign: "center" }}>الصحيحة</span>
          <span style={{ width: 44, textAlign: "center" }}>النقاط</span>
        </div>
        {!board && !err && <p style={{ color: C.muted, fontSize: 13, textAlign: "center" }}>جاري التحميل...</p>}
        {board?.map((r, i) => (
          <div key={`${r.username}-${i}`} style={{
            display: "flex", alignItems: "center", padding: "10px 2px", fontSize: 14,
            borderBottom: i === board.length - 1 ? "none" : `1px solid ${C.line}`,
            background: i === 0 ? C.goldSoft : "transparent", borderRadius: i === 0 ? 8 : 0,
          }}>
            <span style={{ width: 34 }}><span style={rankStyle(Number(r.rank))}>{r.rank}</span></span>
            <span style={{ flex: 1, color: C.text, fontWeight: 700, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.username}</span>
            <span className="num" style={{ width: 52, textAlign: "center", color: C.muted, fontSize: 13 }}>{r.played}</span>
            <span className="num" style={{ width: 50, textAlign: "center", color: C.green, fontSize: 13 }}>{r.exact_count}</span>
            <span className="num" style={{ width: 44, textAlign: "center", color: C.gold, fontWeight: 900, fontSize: 16 }}>{r.points}</span>
          </div>
        ))}
        {board?.length === 0 && <p style={{ color: C.muted, fontSize: 13, textAlign: "center" }}>لا أعضاء بعد</p>}
      </div>

      <div style={{ marginTop: 20 }}>
        <SectionTitle icon={<EyeIcon size={15} />}>توقعات الأعضاء — تنكشف بعد قفل المباراة</SectionTitle>
        <select value={matchId} onChange={(e) => loadPreds(e.target.value)} style={{
          width: "100%", padding: "11px 12px", borderRadius: 12, fontSize: 14, fontFamily: "inherit",
          color: C.text, background: "#171E40", border: `1px solid ${C.line}`, outline: "none", marginTop: 10,
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
              <div key={`${p.username}-${i}`} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 0", fontSize: 13.5, borderBottom: i === preds.length - 1 ? "none" : `1px solid ${C.line}` }}>
                <span style={{ flex: 1, color: C.text, fontWeight: 700, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.username}</span>
                <span className="num" dir="ltr" style={{ color: C.muted, fontSize: 10.5, opacity: 0.8 }}>
                  {new Date(p.predicted_at).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
                <span className="num" style={{ color: C.muted }}>{p.h}–{p.a}</span>
                <span className="num" style={{ width: 50, textAlign: "left", color: p.points > 0 ? C.gold : C.muted, fontWeight: 800 }}>
                  {p.points > 0 ? `+${p.points}` : "—"}
                </span>
              </div>
            ))}
            {preds.length > 1 && (
              <p style={{ color: C.muted, fontSize: 10.5, textAlign: "center", margin: "8px 0 4px", opacity: 0.8 }}>
                وقت كل توقع معروض للمصداقية — عند تساوي النقاط يتقدم الأسبق توقعًا
              </p>
            )}
          </div>
        )}
      </div>
      {err && <p style={{ color: C.red, fontSize: 13, textAlign: "center", marginTop: 10 }}>{err}</p>}
    </div>
  );
}
