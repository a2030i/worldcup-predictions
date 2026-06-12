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
