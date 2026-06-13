// أدوات تنسيق مشتركة

// تطبيع الأرقام العربية المشرقية والفارسية إلى لاتينية
// (كيبوردات أندرويد العربية تُخرج ٣ — وبدون التطبيع تُحذف فتبدو الحقول معطلة)
export const toEnDigits = (s = "") =>
  String(s)
    .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
    .replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d));

export const digitsOnly = (s) => toEnDigits(s).replace(/\D/g, "");

// المعدود العربي: countWord(5, "عضو واحد", "عضوان", "أعضاء") → "5 أعضاء"
export const countWord = (n, one, two, few) =>
  n === 1 ? one : n === 2 ? two : n >= 3 && n <= 10 ? `${n} ${few}` : `${n} ${one.split(" ")[0]}`;

// نظام النقاط المعتمد: التوقع الصحيح = النتيجة بالضبط، والنقاط حسب المرحلة
export const STAGE_POINTS = { group: 2, r32: 4, r16: 6, qf: 8, sf: 10, tp: 10, f: 20 };
export const STAGE_NAMES = {
  group: "دور المجموعات", r32: "دور الـ32", r16: "دور الـ16",
  qf: "ربع النهائي", sf: "نصف النهائي", tp: "المركز الثالث", f: "النهائي",
};
export const stagePoints = (stage) => STAGE_POINTS[stage] ?? 2;

// تنزيل CSV بترميز يفتح سليمًا في Excel بالعربية (BOM + UTF-8)
export function downloadCSV(filename, headers, rows) {
  const esc = (v) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = "﻿" + [headers, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ─── التوقيت: مكة افتراضيًا، مع خيار توقيت دولة العضو ───
const AR_DOW = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const AR_MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

const TZ_KEY = "wc26_tz";
export const MECCA_TZ = "Asia/Riyadh";
// منطقة الجهاز المكتشفة (لعضو خارج السعودية)
export function deviceTZ() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || MECCA_TZ; } catch { return MECCA_TZ; }
}
// التفضيل المحفوظ: "Asia/Riyadh" (مكة) أو منطقة جهاز العضو
export const getTZ = () => localStorage.getItem(TZ_KEY) || MECCA_TZ;
export const setTZ = (tz) => localStorage.setItem(TZ_KEY, tz);
// هل توقيت الجهاز يختلف فعلًا عن مكة؟ (نُظهر الخيار فقط حينها)
export function tzDiffersFromMecca() {
  const dev = deviceTZ();
  if (dev === MECCA_TZ) return false;
  const now = new Date();
  const off = (z) => new Intl.DateTimeFormat("en-US", { timeZone: z, hour: "2-digit", hour12: false }).format(now);
  return off(dev) !== off(MECCA_TZ);
}
// اسم عربي مختصر للمنطقة (آخر جزء من المعرّف)
export const tzLabel = (tz) => (tz === MECCA_TZ ? "مكة" : (tz.split("/").pop() || tz).replace(/_/g, " "));

// أجزاء التاريخ والوقت في منطقة محددة (افتراضيًا التفضيل المحفوظ)
export function tzParts(iso, tz = getTZ()) {
  const d = new Date(iso);
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, year: "numeric", month: "numeric", day: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true, weekday: "short",
  }).formatToParts(d).reduce((o, x) => ((o[x.type] = x.value), o), {});
  const dowIdx = new Date(`${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}T12:00:00Z`).getUTCDay();
  return {
    iso: `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`,
    dow: AR_DOW[dowIdx],
    date: `${Number(p.day)} ${AR_MONTHS[Number(p.month) - 1]}`,
    t: `${p.hour}:${p.minute}`,
    p: p.dayPeriod === "pm" ? "م" : "ص",
  };
}
// توافق خلفي: ksaParts تبقى لكنها تتبع التفضيل المحفوظ الآن
export const ksaParts = (iso) => tzParts(iso);
