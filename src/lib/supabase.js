import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) {
  // إعداد ناقص وقت البناء — نتجنّب رمي استثناء يُفرّغ الصفحة، ونعرض رسالة واضحة بدلها
  console.error("⚠️ أضف VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY في ملف .env قبل البناء");
  if (typeof document !== "undefined") {
    const show = () => {
      document.body.innerHTML =
        '<div dir="rtl" style="font-family:Cairo,Tahoma,sans-serif;min-height:100vh;display:flex;' +
        'align-items:center;justify-content:center;background:#F7F4ED;color:#1B1B20;padding:24px;text-align:center;line-height:2">' +
        '<div><div style="font-size:18px;font-weight:900;margin-bottom:8px">تعذّر تشغيل التطبيق</div>' +
        '<div style="font-size:13px;color:#6E6857">لم تُضبط مفاتيح Supabase وقت البناء. يلزم وجود ملف <b>.env</b> ' +
        'يحوي <code>VITE_SUPABASE_URL</code> و<code>VITE_SUPABASE_ANON_KEY</code> قبل تنفيذ البناء والنشر.</div></div></div>';
    };
    if (document.body) show(); else document.addEventListener("DOMContentLoaded", show);
  }
}
// قيم بديلة تمنع createClient من رمي استثناء عند نقص الإعداد (تظهر الرسالة أعلاه بدل الشاشة البيضاء)
export const supabase = createClient(url || "https://placeholder.supabase.co", key || "placeholder-anon-key");
