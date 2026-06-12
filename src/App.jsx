import React, { useEffect, useState } from "react";
import { C } from "./theme";
import { getSession, clearSession, getMatches } from "./lib/api";
import { CalendarIcon, ChartIcon, TrophyIcon, ShieldIcon, AlertIcon } from "./icons.jsx";
import AuthScreen from "./components/AuthScreen.jsx";
import ScheduleScreen from "./components/ScheduleScreen.jsx";
import StandingsScreen from "./components/StandingsScreen.jsx";
import ChallengesScreen from "./components/ChallengesScreen.jsx";
import AdminScreen from "./components/AdminScreen.jsx";

const Tab = ({ on, onClick, icon, children }) => (
  <button onClick={onClick} style={{
    border: `1px solid ${on ? C.gold : C.line}`, cursor: "pointer",
    background: on ? C.goldSoft : "transparent", color: on ? C.gold : C.muted,
    fontFamily: "inherit", fontWeight: 700, fontSize: 13.5,
    padding: "10px 16px", borderRadius: 999,
    display: "inline-flex", alignItems: "center", gap: 7, transition: "all .15s ease",
  }}>{icon}{children}</button>
);

export default function App() {
  const [session, setSession] = useState(getSession());
  const [tab, setTab] = useState("schedule");
  const [matches, setMatches] = useState(null); // حالة المباريات من الخادم (توقعي + النتائج)
  const [offline, setOffline] = useState(false);
  // فارق ساعة الخادم عن الجهاز — يُزامن العدّادات فلا يؤثر تغيير ساعة الجهاز
  const [clockOffset, setClockOffset] = useState(0);

  const refresh = () => {
    if (!session) return;
    getMatches()
      .then((d) => {
        setMatches(d); setOffline(false);
        if (d?.[0]?.server_now) setClockOffset(new Date(d[0].server_now).getTime() - Date.now());
      })
      .catch((e) => {
        if (e.message.includes("الجلسة")) { clearSession(); setSession(null); }
        else setOffline(true); // خطأ شبكة: أبقِ آخر بيانات واعرض تنبيهًا
      });
  };
  useEffect(refresh, [session]);
  // تحديث دوري — النتائج واللوحات تتجدد دون إعادة تحميل الصفحة
  // أثناء مباراة حية: كل 20 ثانية ليصل الهدف بأسرع ما يمكن
  const hasLive = (matches || []).some((x) => x.live_h != null && x.status === "scheduled");
  useEffect(() => {
    if (!session) return;
    const t = setInterval(refresh, hasLive ? 20_000 : 60_000);
    return () => clearInterval(t);
  }, [session, hasLive]);

  if (!session) return <Shell><AuthScreen onAuth={setSession} /></Shell>;

  return (
    <Shell>
      <header style={{ textAlign: "center", marginBottom: 16 }}>
        <div style={{ color: C.muted, fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }}>
          مونديال 2026 · أمريكا، كندا والمكسيك
        </div>
        <h1 style={{ color: C.text, fontSize: 28, fontWeight: 900, margin: "4px 0 2px" }}>تحدي التوقعات</h1>
        <div style={{ width: 64, height: 3, borderRadius: 2, margin: "6px auto 10px",
          background: "linear-gradient(90deg,#D7263D 0% 33%,#F6C453 33% 66%,#1B9E4B 66% 100%)" }} />
        <div style={{ color: C.muted, fontSize: 12.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <span>أهلاً <b style={{ color: C.gold }}>{session.displayName || session.username}</b></span>
          <button onClick={() => { clearSession(); setSession(null); }}
            style={{ background: "transparent", border: `1px solid ${C.line}`, color: C.muted,
              cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700,
              padding: "7px 12px", borderRadius: 999 }}>
            خروج
          </button>
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          <Tab on={tab === "schedule"} onClick={() => setTab("schedule")} icon={<CalendarIcon />}>المباريات</Tab>
          <Tab on={tab === "standings"} onClick={() => setTab("standings")} icon={<ChartIcon />}>الترتيب</Tab>
          <Tab on={tab === "challenges"} onClick={() => setTab("challenges")} icon={<TrophyIcon />}>تحدياتي</Tab>
          {session.isAdmin && <Tab on={tab === "admin"} onClick={() => setTab("admin")} icon={<ShieldIcon />}>الإدارة</Tab>}
        </div>
      </header>

      {offline && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          background: "rgba(255,107,107,0.12)", border: "1px solid rgba(255,107,107,0.35)",
          color: C.red, fontSize: 12.5, fontWeight: 700, borderRadius: 12, padding: "9px 12px", marginBottom: 14 }}>
          <AlertIcon size={15} /> تعذر تحديث البيانات — تحقق من اتصالك بالإنترنت
        </div>
      )}

      {tab === "schedule" && <ScheduleScreen matches={matches} onChanged={refresh} clockOffset={clockOffset} />}
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
      position: "relative",
    }}>
      <div style={{ position: "absolute", top: 0, right: 0, left: 0, height: 3,
        background: "linear-gradient(90deg,#D7263D 0% 33%,#F6C453 33% 66%,#1B9E4B 66% 100%)" }} />
      <style>{`
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        .wrap { max-width: 520px; margin: 0 auto; }
        .block { animation: rise .45s ease both; }
        .num { font-variant-numeric: tabular-nums; }
        input, select { font-family: inherit; }
        input::placeholder { color: #6E74A8; }
        input:focus, select:focus { border-color: rgba(246,196,83,0.55) !important; }
        button { transition: opacity .15s ease, transform .1s ease; }
        button:active { transform: scale(0.98); }
        @keyframes rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.25} }
        @keyframes goalpop {
          0% { transform: scale(0.4); opacity: 0; }
          45% { transform: scale(1.18); opacity: 1; }
          70% { transform: scale(0.96); }
          100% { transform: scale(1); }
        }
        @keyframes scoreflash {
          0% { transform: scale(1.6); color: #FFFFFF; text-shadow: 0 0 14px rgba(246,196,83,0.9); }
          100% { transform: scale(1); }
        }
        @media (prefers-reduced-motion: reduce) { .block { animation: none } }
      `}</style>
      <div className="wrap">
        {children}
        <p style={{ color: "#6E74A8", fontSize: 10, textAlign: "center", marginTop: 34, opacity: 0.75, lineHeight: 1.8 }}>
          منصة مجتمعية مستقلة للتوقعات بين الأصدقاء — غير تابعة للاتحاد الدولي لكرة القدم (FIFA) وغير مرتبطة به ولا معتمدة منه.
        </p>
      </div>
    </div>
  );
}
