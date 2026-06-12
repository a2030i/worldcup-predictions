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

// توقيت مكة لعرض المباريات المضافة ديناميكيًا (الأدوار الإقصائية)
const KSA_DOW = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const KSA_MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
export function ksaParts(iso) {
  const d = new Date(iso);
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Riyadh", year: "numeric", month: "numeric", day: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true, weekday: "short",
  }).formatToParts(d).reduce((o, x) => ((o[x.type] = x.value), o), {});
  const dowIdx = new Date(`${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}T12:00:00Z`).getUTCDay();
  return {
    iso: `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`,
    dow: KSA_DOW[dowIdx],
    date: `${Number(p.day)} ${KSA_MONTHS[Number(p.month) - 1]}`,
    t: `${p.hour}:${p.minute}`,
    p: p.dayPeriod === "pm" ? "م" : "ص",
  };
}
