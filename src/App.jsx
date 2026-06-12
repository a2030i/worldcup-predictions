import React, { useEffect, useState } from "react";
import { C } from "./theme";
import { getSession, clearSession, getMatches, activeAnnouncement, myPrizes } from "./lib/api";
import { CalendarIcon, ChartIcon, TrophyIcon, ShieldIcon, AlertIcon, GiftIcon } from "./icons.jsx";
import AuthScreen from "./components/AuthScreen.jsx";
import ScheduleScreen from "./components/ScheduleScreen.jsx";
import StandingsScreen from "./components/StandingsScreen.jsx";
import ChallengesScreen from "./components/ChallengesScreen.jsx";
import PrizesScreen from "./components/PrizesScreen.jsx";
import AdminScreen from "./components/AdminScreen.jsx";

const Tab = ({ on, onClick, icon, children }) => (
  <button onClick={onClick} style={{
    border: `1px solid ${on ? C.blue : C.line}`, cursor: "pointer",
    background: on ? C.blue : C.card, color: on ? "#FFFFFF" : C.muted,
    fontFamily: "inherit", fontWeight: 700, fontSize: 13.5,
    padding: "10px 16px", borderRadius: 999,
    display: "inline-flex", alignItems: "center", gap: 7, transition: "all .15s ease",
  }}>{icon}{children}</button>
);

const countPrizeWord = (n) =>
  n === 1 ? "جائزة" : n === 2 ? "جائزتان" : n <= 10 ? `${n} جوائز` : `${n} جائزة`;

// شريط ألوان 26 الخمسة — توقيع الهوية
const Strip26 = ({ width = 96, height = 4, margin = "6px auto 10px" }) => (
  <div style={{ display: "flex", gap: 3, width, margin, justifyContent: "center" }}>
    {["#E0432F", "#2B6BE4", "#FFD23F", "#19C39C", "#7C3AED"].map((c) => (
      <span key={c} style={{ flex: 1, height, borderRadius: 999, background: c }} />
    ))}
  </div>
);

export default function App() {
  const [session, setSession] = useState(getSession());
  const [tab, setTab] = useState("schedule");
  const [matches, setMatches] = useState(null); // حالة المباريات من الخادم (توقعي + النتائج)
  const [offline, setOffline] = useState(false);
  const [announce, setAnnounce] = useState(null); // إعلان الإدارة للأعضاء
  const [pendingPrizes, setPendingPrizes] = useState(0); // جوائز بانتظار الاختيار
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
    activeAnnouncement().then(setAnnounce).catch(() => {});
    myPrizes().then((d) => setPendingPrizes(d?.pending?.length || 0)).catch(() => {});
  };
  const dismissedAnnounce = Number(localStorage.getItem("wc26_announce_seen") || 0);
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
        <Strip26 />
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
          <Tab on={tab === "prizes"} onClick={() => setTab("prizes")} icon={<GiftIcon />}>
            جوائزي
            {pendingPrizes > 0 && (
              <span className="num" style={{ background: "#E0432F", color: "#FFFFFF", fontSize: 10.5, fontWeight: 900,
                minWidth: 17, height: 17, borderRadius: 999, display: "inline-flex",
                alignItems: "center", justifyContent: "center", padding: "0 4px" }}>{pendingPrizes}</span>
            )}
          </Tab>
          {session.isAdmin && <Tab on={tab === "admin"} onClick={() => setTab("admin")} icon={<ShieldIcon />}>الإدارة</Tab>}
        </div>
      </header>

      {pendingPrizes > 0 && tab !== "prizes" && (
        <button onClick={() => setTab("prizes")} style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          background: "rgba(224,67,47,0.08)", border: "2px solid rgba(224,67,47,0.45)",
          color: "#C2331F", fontSize: 13, fontWeight: 800, borderRadius: 12, padding: "10px 12px",
          marginBottom: 14, cursor: "pointer", fontFamily: "inherit" }}>
          <GiftIcon size={16} /> مبروك! {countPrizeWord(pendingPrizes)} بانتظار اختيارك — اضغط للاستلام
        </button>
      )}

      {offline && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          background: "rgba(255,107,107,0.12)", border: "1px solid rgba(255,107,107,0.35)",
          color: C.red, fontSize: 12.5, fontWeight: 700, borderRadius: 12, padding: "9px 12px", marginBottom: 14 }}>
          <AlertIcon size={15} /> تعذر تحديث البيانات — تحقق من اتصالك بالإنترنت
        </div>
      )}

      {announce && announce.id > dismissedAnnounce && (
        <div style={{ display: "flex", alignItems: "center", gap: 10,
          background: C.goldSoft, border: "1px solid rgba(184,119,26,0.35)",
          color: C.gold, fontSize: 13, fontWeight: 700, borderRadius: 12, padding: "10px 14px", marginBottom: 14 }}>
          <span style={{ flex: 1, lineHeight: 1.7 }}>{announce.body}</span>
          <button onClick={() => { localStorage.setItem("wc26_announce_seen", String(announce.id)); setAnnounce(null); }}
            aria-label="إغلاق الإعلان"
            style={{ background: "transparent", border: "none", color: C.gold, cursor: "pointer", fontSize: 16, fontWeight: 900, padding: 4 }}>
            ✕
          </button>
        </div>
      )}

      {tab === "schedule" && <ScheduleScreen matches={matches} onChanged={refresh} clockOffset={clockOffset} />}
      {tab === "standings" && <StandingsScreen matches={matches} />}
      {tab === "challenges" && <ChallengesScreen matches={matches} />}
      {tab === "prizes" && <PrizesScreen onChanged={refresh} />}
      {tab === "admin" && session.isAdmin && <AdminScreen matches={matches} onChanged={refresh} />}
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div dir="rtl" style={{
      minHeight: "100vh",
      background: C.bg,
      fontFamily: "'Cairo', 'Segoe UI', Tahoma, sans-serif", padding: "26px 16px 50px",
      position: "relative", overflow: "hidden",
    }}>
      {/* كتل 26 الهندسية — توقيع الهوية خلف الهيدر */}
      <div aria-hidden="true" style={{ position: "absolute", top: 0, right: 0, left: 0, height: 190, pointerEvents: "none" }}>
        <span style={{ position: "absolute", top: -70, right: -55, width: 185, height: 185, borderRadius: "0 0 0 185px", background: C.coral }} />
        <span style={{ position: "absolute", top: -45, left: -60, width: 175, height: 150, borderRadius: "0 0 175px 0", background: C.blue }} />
        <span style={{ position: "absolute", top: 78, left: 42, width: 46, height: 46, borderRadius: "50%", background: C.yellow }} />
        <span style={{ position: "absolute", top: 96, right: -16, width: 60, height: 60, borderRadius: "60px 0 0 60px", background: C.teal }} />
      </div>
      <style>{`
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        .wrap { max-width: 520px; margin: 0 auto; position: relative; }
        .block { animation: rise .45s ease both; }
        .num { font-variant-numeric: tabular-nums; }
        input, select { font-family: inherit; }
        input::placeholder { color: #A59B82; }
        input:focus, select:focus { border-color: #2B6BE4 !important; }
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
          0% { transform: scale(1.6); color: #E0432F; text-shadow: 0 0 14px rgba(224,67,47,0.55); }
          100% { transform: scale(1); }
        }
        @keyframes scorebounce {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.55); color: #E0432F; text-shadow: 0 0 16px rgba(224,67,47,0.6); }
        }
        @keyframes goalshout {
          0% { transform: scale(0.2) rotate(-10deg); opacity: 0; }
          18% { transform: scale(1.15) rotate(2deg); opacity: 1; }
          30% { transform: scale(0.98) rotate(0deg); }
          80% { transform: scale(1.02); opacity: 1; }
          100% { transform: scale(1.1); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) { .block { animation: none } }
      `}</style>
      <div className="wrap">
        {children}
        <p style={{ color: "#A59B82", fontSize: 10, textAlign: "center", marginTop: 34, opacity: 0.75, lineHeight: 1.8 }}>
          منصة مجتمعية مستقلة للتوقعات بين الأصدقاء — غير تابعة للاتحاد الدولي لكرة القدم (FIFA) وغير مرتبطة به ولا معتمدة منه.
        </p>
      </div>
    </div>
  );
}
