# سياق المشروع: DoseWise

> ملف سياق للجلسات والأدوات الذكية — حدّثي قسم "الحالة الحالية" بعد كل سبرنت.

## أنا
دانا، طالبة CS بجامعة اليرموك ومؤسسة فريق NOVA AI. أعمل على مشروع B2B.

## المشروع
**DoseWise** — منصة B2B لتبادل مخزون الأدوية بين الصيدليات الأردنية.
الصيدلية A عندك فائض دواء قرب ينتهي؟ الصيدلية B ناقصها؟ المنصة تربطهن
بطلبات تبادل موثقة (كميات، أسعار JOD، صلاحيات، إشعارات، حالات).

## التقنيات (Monorepo بـ pnpm workspaces)
- **backend/**: Node.js + Express 5 + TypeScript + Drizzle ORM + PostgreSQL 17
  - Session auth (express-session + bcryptjs)، Zod v4 للتحقق (`zod/v4`)
  - اختبارات: Vitest + Supertest (41 اختبار Integration تشتغل على DB حقيقي)
- **frontend/**: React 19 + TypeScript + Vite + Tailwind + TanStack Query + Wouter
  - واجهة عربية RTL
- **CI**: GitHub Actions (.github/workflows/ci.yml) — typecheck → db:push → tests → build

## بنية الباكند المهمة
- `src/routes/` — auth, medicines, requests, subscriptions, notifications, admin, ai, health
- `src/db/schema/` — pharmacies, medicines, requests, notifications, subscriptions, admins
- `src/lib/request-state.ts` — State Machine لحالات الطلب (pgEnum في schema)
- `src/lib/rate-limit.ts` — CORS allowlist + rate limiters
- `src/zod/schemas.ts` — كل الـ validation (باسورد 12+، هاتف أردني، ...)
- `src/test/` — ملفات الاختبار لكل مجال + setup.ts يحمّل .env

## قرارات هندسية مقفلة (لا تناقشها، طبّق عليها)
1. الأمان بطبقات: Zod ← State Machine ← DB Constraint ← Row Lock
2. القبول ذري: accept = transaction واحدة (خصم مخزون شرطي WHERE quantity >= N)
3. كل send يتطلب هيدر Idempotency-Key (unique index requester+key)
4. الأسعار numeric(10,2) — ترجع string بالـ JSON، الفرونت يستخدم formatPrice()
5. لا أسرار بالكود — Fail Fast بدون env كامل؛ .env مش مرفوع
6. الدفع Demo صراحة (DEMO_PAYMENT flag) — أي بيانات بطاقة ترفض 400
7. حالة الطلب عبر pgEnum: pending→accepted/completed | pending→rejected/cancelled
   - accepted ما بينلغى ولا ينرفض بعد القبول

## الوثيقة المرجعية
SRS كامل بمتطلبات ID وأولويات P0-P3 ومعايير قبول (DoseWise_SRS_v1.0_AR.docx).
التنفيذ requirement-by-requirement مع اختبارات آلية كمعيار قبول.

## الحالة الحالية (منجز) — آخر تحديث: سبرنت 11
P0 شبه كاملة: مصادقة محصنة، دورة تبادل كاملة ذرية، أمان API (CORS/CSRF/RateLimit)،
أسعار decimal، تسجيل متحقق (باسورد 12+ وهاتف أردني)، دفع Demo موسوم بـ Banner،
CI أخضر، 41 اختبار.

## المتبقي
- AI Safety (AI-001/002): رفض الأسئلة الطبية بالدردشة + Feature Flag
- إعادة تسمية "AI" إلى "تحليلات" وحذف confidence الوهمية (ANA-001)
- تصحيح التوقع: SUM(quantity) بدل COUNT (ANA-002)
- Audit Log للأدمن (ADM-007)، Migrations versioned (MAINT-003)، Pagination (PERF-003)
- جولة مراجعة شاشات الفرونت الشاملة

## النشر المخطط
Render (web service) + Neon Postgres. TLS تلقائي. env vars سحابية.

## أسلوبي المطلوب منك (لو بتستخدمي الملف مع مساعد ذكي)
اشرح قبل ما تكتب (ليش/شو المشكلة/الحل)، اعطني كود كامل جاهز،
وثّلي commit بـ conventional commits، ولا تنتقل لشي جديد قبل تأكيدي.
