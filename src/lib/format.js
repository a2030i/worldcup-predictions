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
