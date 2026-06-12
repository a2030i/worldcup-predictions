// طبقة الاتصال — كل العمليات عبر دوال RPC (لا وصول مباشر للجداول)
// الجلسة: { token, username, isAdmin } تُحفظ على الجهاز فلا يسجل دخول كل مرة
import { supabase } from "./supabase";

const KEY = "wc26_session";
export const getSession = () => {
  try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; }
};
export const saveSession = (s) => localStorage.setItem(KEY, JSON.stringify(s));
export const clearSession = () => localStorage.removeItem(KEY);

// رسائل الأخطاء القادمة من قاعدة البيانات بالعربي
const ERRORS = {
  USERNAME_TAKEN: "اسم الدخول محجوز، جرّب اسمًا آخر",
  USERNAME_INVALID: "اسم الدخول: حروف إنجليزية وأرقام فقط (3–20 خانة)",
  DISPLAY_TAKEN: "اسم العرض محجوز، اختر اسمًا آخر",
  DISPLAY_INVALID: "اسم العرض: من حرفين إلى 20 حرفًا",
  PHONE_TAKEN: "هذا الجوال مسجّل بحساب آخر",
  PHONE_INVALID: "رقم الجوال يبدأ بـ 05 ويتكون من 10 أرقام",
  LOGIN_FAILED: "الاسم أو الرمز غير صحيح",
  PIN_INVALID: "الرمز يجب أن يكون 4 إلى 6 أرقام",
  AUTH_BANNED: "تم إيقاف هذا الحساب",
  AUTH_INVALID: "انتهت الجلسة، سجّل دخولك من جديد",
  PREDICTIONS_LOCKED: "أُقفلت التوقعات لهذه المباراة 🔒",
  MATCH_NOT_OPEN: "هذه المباراة غير متاحة للتوقع",
  CODE_NOT_FOUND: "الكود غير صحيح",
  JOIN_LOCKED: "أقفل صاحب التحدي باب الانضمام",
  CHALLENGE_FULL: "اكتمل عدد أعضاء هذا التحدي",
  STILL_OPEN: "تظهر توقعات الأعضاء بعد قفل المباراة",
  NOT_A_MEMBER: "لست عضوًا في هذا التحدي",
};

async function rpc(fn, args) {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    const code = Object.keys(ERRORS).find((k) => error.message.includes(k));
    throw new Error(code ? ERRORS[code] : "حدث خطأ غير متوقع، حاول مرة أخرى");
  }
  return data;
}

const tok = () => getSession()?.token;

// ── الحساب ──
export const register = (username, pin, displayName, phone) =>
  rpc("register_user", { p_username: username, p_pin: pin, p_display_name: displayName, p_phone: phone });
export const login    = (username, pin) => rpc("login_user", { p_username: username, p_pin: pin });

// ── المباريات والتوقعات ──
export const getMatches = () => rpc("get_matches", { p_token: tok() });
export const submitPrediction = (matchId, h, a, qualified = null) =>
  rpc("submit_prediction", { p_token: tok(), p_match_id: matchId, p_h: h, p_a: a, p_qualified: qualified });
export const matchPredictions = (challengeId, matchId) =>
  rpc("match_predictions", { p_token: tok(), p_challenge_id: challengeId, p_match_id: matchId });

// ── التحديات ──
export const PUBLIC_CHALLENGE_ID = "00000000-0000-0000-0000-000000000001";
export const myChallenges   = () => rpc("my_challenges", { p_token: tok() });
export const createChallenge = (name) => rpc("create_challenge", { p_token: tok(), p_name: name });
export const joinChallenge   = (code) => rpc("join_challenge", { p_token: tok(), p_code: code });
export const leaderboard     = (challengeId) => rpc("leaderboard", { p_token: tok(), p_challenge_id: challengeId });

// ── الأدمن ──
export const adminSetResult  = (matchId, h, a, qualified = null) =>
  rpc("admin_set_result", { p_token: tok(), p_match_id: matchId, p_h: h, p_a: a, p_qualified: qualified });
export const adminOverview   = () => rpc("admin_overview", { p_token: tok() });
export const adminMatchStats = (matchId) => rpc("admin_match_stats", { p_token: tok(), p_match_id: matchId });
export const adminResetPin   = (username, pin) => rpc("admin_reset_pin", { p_token: tok(), p_username: username, p_new_pin: pin });
export const adminBan        = (username, banned) => rpc("admin_ban_user", { p_token: tok(), p_username: username, p_banned: banned });
