import { Router, type IRouter } from "express";
import { db, pharmaciesTable, subscriptionPaymentsTable } from "../db/index.js";
import { eq } from "drizzle-orm";
import { ProcessPaymentBody } from "../zod/schemas.js";
import { randomUUID } from "crypto";
import { requireApprovedPharmacy } from "../middlewares/require-approved-pharmacy.js";
import { logAudit } from "../lib/audit.js";

const router: IRouter = Router();

const PLANS = [
  { id: "free", name: "المجانية", price: 0, currency: "JOD", durationDays: 365,
    features: ["الوصول إلى الأدوية المتاحة", "إرسال واستقبال الطلبات", "ميزات الذكاء الاصطناعي الأساسية"] },
  { id: "monthly", name: "الشهرية", price: 25, currency: "JOD", durationDays: 30,
    features: ["جميع مميزات الخطة المجانية", "إشعارات متقدمة", "ميزات الذكاء الاصطناعي الكاملة", "الدعم الفني"] },
  { id: "yearly", name: "السنوية", price: 240, currency: "JOD", durationDays: 365,
    features: ["جميع مميزات الخطة الشهرية", "خصم 20%", "دعم ذو أولوية", "تقارير شهرية مفصلة"] },
];

const DEMO_PAYMENT_ENABLED = (process.env.DEMO_PAYMENT ?? "true") !== "false";

router.get("/subscriptions/status", requireApprovedPharmacy, async (req, res): Promise<void> => {
  const [pharmacy] = await db.select().from(pharmaciesTable).where(eq(pharmaciesTable.id, req.session.pharmacyId!));
  if (!pharmacy.isSubscribed) {
    res.json({ isSubscribed: false, plan: null, startDate: null, endDate: null, daysRemaining: null, demoMode: DEMO_PAYMENT_ENABLED }); return;
  }
  const now = new Date();
  const endDate = pharmacy.subscriptionEndDate;
  const daysRemaining = endDate ? Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : null;
  res.json({
    isSubscribed: pharmacy.isSubscribed, plan: pharmacy.subscriptionPlan ?? null,
    startDate: pharmacy.subscriptionStartDate ? pharmacy.subscriptionStartDate.toISOString() : null,
    endDate: endDate ? endDate.toISOString() : null, daysRemaining,
    demoMode: DEMO_PAYMENT_ENABLED,
  });
});

router.get("/subscriptions/plans", async (_req, res): Promise<void> => {
  res.json({ demoMode: DEMO_PAYMENT_ENABLED, plans: PLANS });
});

router.post("/subscriptions/payment", requireApprovedPharmacy, async (req, res): Promise<void> => {
  if (!DEMO_PAYMENT_ENABLED) {
    res.status(403).json({ error: "Real payments are not enabled yet. Subscriptions are in demo mode only." }); return;
  }

  const parsed = ProcessPaymentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { planId } = parsed.data;
  if (parsed.data.cardNumber || parsed.data.cvv || parsed.data.expiryMonth || parsed.data.expiryYear) {
    res.status(400).json({ error: "لا تُدخل بيانات بطاقة حقيقية — الدفع في وضع تجريبي ولا تُخزن تفاصيل البطاقات إطلاقاً" }); return;
  }
  const plan = PLANS.find(p => p.id === planId);
  if (!plan) { res.status(400).json({ error: "Invalid plan" }); return; }

  const now = new Date();
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + plan.durationDays);
  const transactionId = randomUUID();

  await db.insert(subscriptionPaymentsTable).values({
    pharmacyId: req.session.pharmacyId!, amount: plan.price, currency: plan.currency,
    paymentStatus: "completed", subscriptionPeriodStart: now, subscriptionPeriodEnd: endDate, transactionId,
  });
  await db.update(pharmaciesTable).set({
    isSubscribed: true, subscriptionPlan: planId, subscriptionStartDate: now,
    subscriptionEndDate: endDate, lastPaymentDate: now,
  }).where(eq(pharmaciesTable.id, req.session.pharmacyId!));

  await logAudit(db, {
    actorType: "pharmacy",
    actorId: req.session.pharmacyId!,
    action: "subscription.activated",
    targetType: "subscription",
    targetId: req.session.pharmacyId!,
    details: JSON.stringify({ plan: planId }),
  });

  res.json({ message: "تم تفعيل الاشتراك بنجاح", transactionId, plan: plan.name, expiresAt: endDate.toISOString() });
});

router.post("/subscriptions/cancel", requireApprovedPharmacy, async (req, res): Promise<void> => {
  await db.update(pharmaciesTable).set({
    isSubscribed: false, subscriptionPlan: null, subscriptionStartDate: null, subscriptionEndDate: null,
  }).where(eq(pharmaciesTable.id, req.session.pharmacyId!));
  await logAudit(db, {
    actorType: "pharmacy",
    actorId: req.session.pharmacyId!,
    action: "subscription.cancelled",
    targetType: "subscription",
    targetId: req.session.pharmacyId!,
  });
  res.json({ message: "تم إلغاء الاشتراك بنجاح" });
});

export default router;
