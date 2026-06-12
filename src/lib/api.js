// طبقة الاتصال — كل العمليات عبر دوال RPC (لا وصول مباشر للجداول)
// الجلسة: { token, username, displayName, isAdmin } تُحفظ على الجهاز فلا يسجل دخول كل مرة
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
  DISPLAY_INVALID: "اسم العرض: من حرفين إلى 20 حرفًا",
  PHONE_TAKEN: "هذا الجوال مسجّل بحساب آخر",
  PHONE_INVALID: "رقم الجوال يبدأ بـ 05 ويتكون من 10 أرقام",
  LOGIN_THROTTLED: "محاولات كثيرة خاطئة — انتظر 15 دقيقة ثم حاول مجددًا",
  LOGIN_FAILED: "الاسم أو الرمز غير صحيح",
  PIN_ADMIN_6: "رمز المشرف يجب أن يكون 6 أرقام",
  PIN_INVALID: "الرمز يجب أن يكون 4 إلى 6 أرقام",
  MATCH_NOT_STARTED: "المباراة لم تبدأ بعد — لا يمكن اعتماد نتيجتها",
  RESULT_INVALID: "النتيجة غير منطقية",
  QUALIFIED_INVALID: "المتأهل يجب أن يكون أحد طرفي المباراة",
  AUTH_BANNED: "تم إيقاف هذا الحساب",
  AUTH_INVALID: "انتهت الجلسة، سجّل دخولك من جديد",
  AUTH_NOT_ADMIN: "هذه العملية للمشرفين فقط",
  PREDICTIONS_LOCKED: "أُقفلت التوقعات لهذه المباراة",
  MATCH_NOT_OPEN: "هذه المباراة غير متاحة للتوقع",
  MATCH_NOT_FOUND: "المباراة غير موجودة",
  CODE_NOT_FOUND: "الكود غير صحيح",
  JOIN_LOCKED: "أقفل صاحب التحدي باب الانضمام",
  CHALLENGE_FULL: "اكتمل عدد أعضاء هذا التحدي",
  STILL_OPEN: "تظهر توقعات الأعضاء بعد قفل المباراة",
  NOT_A_MEMBER: "لست عضوًا في هذا التحدي",
  USER_NOT_FOUND: "لا يوجد عضو بهذا الاسم",
  PREDICTION_NOT_FOUND: "لا يوجد توقع لهذا العضو على هذه المباراة",
  CHALLENGE_NOT_FOUND: "التحدي غير موجود",
  CANT_DELETE_PUBLIC: "لا يمكن حذف التحدي العام",
  CANT_DEMOTE_SELF: "لا يمكنك إزالة صلاحيتك عن نفسك",
};

async function rpc(fn, args) {
  let data, error;
  try {
    ({ data, error } = await supabase.rpc(fn, args));
  } catch {
    throw new Error("تعذر الاتصال — تحقق من الإنترنت وحاول مجددًا");
  }
  if (error) {
    const code = Object.keys(ERRORS).find((k) => error.message.includes(k));
    if (code) throw new Error(ERRORS[code]);
    if (/fetch|network|Failed/i.test(error.message))
      throw new Error("تعذر الاتصال — تحقق من الإنترنت وحاول مجددًا");
    throw new Error("حدث خطأ غير متوقع، حاول مرة أخرى");
  }
  return data;
}

const tok = () => getSession()?.token;

// ── الحساب ──
export const register = (username, pin, displayName, phone) =>
  rpc("register_user", { p_username: username, p_pin: pin, p_display_name: displayName, p_phone: phone });
export const login    = (username, pin) => rpc("login_user", { p_username: username, p_pin: pin });
export const changePin = (oldPin, newPin) =>
  rpc("change_pin", { p_token: tok(), p_old_pin: oldPin, p_new_pin: newPin });

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
export const myRanks         = () => rpc("my_ranks", { p_token: tok() });

// ── الأدمن: المباريات ──
export const adminSetResult  = (matchId, h, a, qualified = null) =>
  rpc("admin_set_result", { p_token: tok(), p_match_id: matchId, p_h: h, p_a: a, p_qualified: qualified });
export const adminReschedule = (matchId, kickoffISO) =>
  rpc("admin_reschedule", { p_token: tok(), p_match_id: matchId, p_kickoff: kickoffISO });
export const adminCancelMatch = (matchId) =>
  rpc("admin_cancel_match", { p_token: tok(), p_match_id: matchId });
export const adminMatchStats = (matchId) => rpc("admin_match_stats", { p_token: tok(), p_match_id: matchId });

// ── الأدمن: الأعضاء ──
export const adminOverview   = () => rpc("admin_overview", { p_token: tok() });
export const adminListUsers  = (q) => rpc("admin_list_users", { p_token: tok(), p_query: q || null });
export const adminUserDetail = (username) => rpc("admin_user_detail", { p_token: tok(), p_username: username });
export const adminRename     = (username, display) =>
  rpc("admin_rename_user", { p_token: tok(), p_username: username, p_new_display: display });
export const adminSetPhone   = (username, phone) =>
  rpc("admin_set_phone", { p_token: tok(), p_username: username, p_phone: phone });
export const adminResetPin   = (username, pin) => rpc("admin_reset_pin", { p_token: tok(), p_username: username, p_new_pin: pin });
export const adminBan        = (username, banned) => rpc("admin_ban_user", { p_token: tok(), p_username: username, p_banned: banned });
export const adminSetAdmin   = (username, isAdmin) =>
  rpc("admin_set_admin", { p_token: tok(), p_username: username, p_is_admin: isAdmin });
export const adminDeletePrediction = (username, matchId) =>
  rpc("admin_delete_prediction", { p_token: tok(), p_username: username, p_match_id: matchId });

// ── الأدمن: التحديات والسجل ──
export const adminListChallenges  = () => rpc("admin_list_challenges", { p_token: tok() });
export const adminChallengeBoard  = (id) => rpc("admin_challenge_board", { p_token: tok(), p_challenge_id: id });
export const adminMatchWinners    = (matchId) => rpc("admin_match_winners", { p_token: tok(), p_match_id: matchId });
export const adminDeleteChallenge = (id) => rpc("admin_delete_challenge", { p_token: tok(), p_challenge_id: id });
export const adminAuditLog        = (limit = 100) => rpc("admin_audit_log", { p_token: tok(), p_limit: limit });
export const adminSyncNow         = () => rpc("admin_sync_now", { p_token: tok() });
