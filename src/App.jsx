import React, { useEffect, useState } from "react";
import { C } from "./theme";
import { getSession, clearSession, getMatches } from "./lib/api";
import AuthScreen from "./components/AuthScreen.jsx";
import ScheduleScreen from "./components/ScheduleScreen.jsx";
import StandingsScreen from "./components/StandingsScreen.jsx";
import ChallengesScreen from "./components/ChallengesScreen.jsx";
import AdminScreen from "./components/AdminScreen.jsx";

const Tab = ({ on, onClick, children }) => (
  <button onClick={onClick} style={{
    border: `1px solid ${on ? C.gold : C.line}`, cursor: "pointer",
    background: on ? C.goldSoft : "transparent", color: on ? C.gold : C.muted,
    fontFamily: "inherit", fontWeight: 700, fontSize: 13.5,
    padding: "8px 16px", borderRadius: 999,
  }}>{children}</button>
);

export default function App() {
  const [session, setSession] = useState(getSession());
  const [tab, setTab] = useState("schedule");
  const [matches, setMatches] = useState(null); // حالة المباريات من الخادم (توقعي + النتائج)

  const refresh = () => {
    if (!session) return;
    getMatches().then(setMatches).catch((e) => {
      if (e.message.includes("الجلسة")) { clearSession(); setSession(null); }
    });
  };
  useEffect(refresh, [session]);

  if (!session) return <Shell><AuthScreen onAuth={setSession} /></Shell>;

  return (
    <Shell>
      <header style={{ textAlign: "center", marginBottom: 16 }}>
        <div style={{ color: C.gold, fontSize: 13, fontWeight: 700, letterSpacing: 1 }}>🏆 كأس العالم 2026</div>
        <h1 style={{ color: C.text, fontSize: 28, fontWeight: 900, margin: "4px 0 6px" }}>تحدي التوقعات</h1>
        <div style={{ color: C.muted, fontSize: 12.5 }}>
          أهلاً <b style={{ color: C.gold }}>{session.displayName || session.username}</b>
          {" · "}
          <button onClick={() => { clearSession(); setSession(null); }}
            style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, textDecoration: "underline" }}>
            تسجيل خروج
          </button>
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          <Tab on={tab === "schedule"} onClick={() => setTab("schedule")}>📅 المباريات</Tab>
          <Tab on={tab === "standings"} onClick={() => setTab("standings")}>📊 الترتيب</Tab>
          <Tab on={tab === "challenges"} onClick={() => setTab("challenges")}>⚔️ تحدياتي</Tab>
          {session.isAdmin && <Tab on={tab === "admin"} onClick={() => setTab("admin")}>🛠 الأدمن</Tab>}
        </div>
      </header>

      {tab === "schedule" && <ScheduleScreen matches={matches} onChanged={refresh} />}
      {tab === "standings" && <StandingsScreen matches={matches} />}
      {tab === "challenges" && <ChallengesScreen matches={matches} />}
      {tab === "admin" && session.isAdmin && <AdminScreen matches={matches} onChanged={refresh} />}
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div dir="rtl" style={{
      minHeight: "100vh",
      background: "linear-gradient(165deg,#0A1033 0%,#140A3D 55%,#1E0B47 100%)",
      fontFamily: "'Cairo', 'Segoe UI', Tahoma, sans-serif", padding: "26px 16px 50px",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@500;600;700;800;900&display=swap');
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        .wrap { max-width: 520px; margin: 0 auto; }
        .block { animation: rise .45s ease both; }
        input { font-family: inherit; }
        input::placeholder { color: #6E74A8; }
        @keyframes rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.25} }
        @media (prefers-reduced-motion: reduce) { .block { animation: none } }
      `}</style>
      <div className="wrap">{children}</div>
    </div>
  );
}
