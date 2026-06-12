# ⚽ تحدي توقعات كأس العالم 2026

منصة عربية لتوقع نتائج المباريات والمنافسة في تحديات عامة وخاصة — React + Supabase.

- توقّع النتيجة، والتوقعات **تُقفل قبل الانطلاق بـ 5 ثوانٍ** (يفرضها الخادم).
- **تحدٍّ عام** يضم الجميع تلقائيًا + **تحديات خاصة** بكود من 6 خانات.
- نقاط: دقيقة **5** · فارق صحيح **3** · اتجاه صحيح **1**.
- لوحة أدمن: اعتماد وتصحيح النتائج، إحصاءات، إدارة الأعضاء.
- تسجيل بالاسم ورمز سري فقط — بدون إيميل أو جوال.

## التشغيل لأول مرة (15 دقيقة تقريبًا)

### 1) قاعدة البيانات — Supabase
1. أنشئ مشروعًا مجانيًا في supabase.com
2. من **SQL Editor**: الصق محتوى `supabase/schema.sql` كاملًا ونفّذه، ثم الصق `supabase/seed.sql` ونفّذه.
3. من **Project Settings ⟵ API** انسخ: `Project URL` و `anon public key`.

### 2) التشغيل محليًا
```bash
npm install
cp .env.example .env     # ثم ضع فيه قيمتي Supabase
npm run dev
```

### 3) تعيين نفسك أدمن
سجّل حسابك من التطبيق أولًا، ثم في SQL Editor:
```sql
update profiles set is_admin = true where username = 'اسمك';
```
سجّل خروجًا ثم دخولًا ليظهر تبويب الأدمن.

### 4) الرفع على GitHub
```bash
git remote add origin https://github.com/USERNAME/worldcup-predictions.git
git push -u origin main
```
(المستودع المحلي جاهز بأول commit — فقط أنشئ مستودعًا فارغًا على GitHub وبدّل USERNAME.)

### 5) النشر على Vercel
1. vercel.com ⟵ **Add New Project** ⟵ اختر المستودع (يكتشف Vite تلقائيًا).
2. في **Environment Variables** أضف:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. **Deploy** — وكل `git push` لاحقًا ينشر تلقائيًا.

## الإكمال مع Claude Code
افتح مجلد المشروع وشغّل `claude` — ملف `CLAUDE.md` يشرح له المعمارية والقواعد وخارطة الطريق، والتحليل الكامل في `docs/تحليل-النظام.md`.

## تعديل جدول المباريات
عدّل `src/data/tournament.js` ثم:
```bash
npm run seed
```
والصق `supabase/seed.sql` الجديد في SQL Editor (آمن لإعادة التنفيذ).
