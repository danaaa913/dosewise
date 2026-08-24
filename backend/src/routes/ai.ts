import { Router, type IRouter } from "express";
import { db, medicinesTable, requestsTable } from "../db/index.js";
import { sql, eq, and, gte, ne } from "drizzle-orm";
import { AiChatBody } from "../zod/schemas.js";

const router: IRouter = Router();

function requirePharmacy(req: any, res: any, next: any) {
  if (!req.session.pharmacyId) { res.status(401).json({ error: "Authentication required" }); return; }
  next();
}

router.get("/ai/medicines", requirePharmacy, async (req, res): Promise<void> => {
  const pharmacyId = req.session.pharmacyId!;
  const scope = typeof req.query.scope === "string" ? req.query.scope : "mine";

  if (scope === "market") {
    const rows = await db.select({ name: medicinesTable.name }).from(medicinesTable)
      .groupBy(medicinesTable.name).orderBy(medicinesTable.name);
    res.json({ medicines: rows.map(r => r.name) }); return;
  }

  const rows = await db.select({ name: medicinesTable.name }).from(medicinesTable)
    .where(eq(medicinesTable.pharmacyId, pharmacyId))
    .groupBy(medicinesTable.name).orderBy(medicinesTable.name);
  res.json({ medicines: rows.map(r => r.name) });
});

router.get("/ai/recommendations", requirePharmacy, async (req, res): Promise<void> => {
  const pharmacyId = req.session.pharmacyId!;

  const topRequested = await db
    .select({ name: medicinesTable.name, requestCount: sql<number>`COUNT(${requestsTable.id})::int` })
    .from(requestsTable).innerJoin(medicinesTable, eq(requestsTable.medicineId, medicinesTable.id))
    .groupBy(medicinesTable.name).orderBy(sql`COUNT(${requestsTable.id}) DESC`).limit(10);

  const myMeds = await db.select({ name: medicinesTable.name, quantity: medicinesTable.quantity })
    .from(medicinesTable).where(eq(medicinesTable.pharmacyId, pharmacyId));
  const myMedNames = new Set(myMeds.map(m => m.name));

  const recommendations: Array<{ medicine: string; reason: string; confidence: number }> = [];

  for (const t of topRequested) {
    if (recommendations.length >= 5) break;
    if (myMedNames.has(t.name)) continue;
    const conf = Math.min(0.95, 0.55 + t.requestCount * 0.08);
    recommendations.push({ medicine: t.name, reason: `طُلب ${t.requestCount} مرة على المنصة ولا يتوفر في صيدليتك`, confidence: Math.round(conf * 100) / 100 });
  }

  if (recommendations.length < 5) {
    const lowStock = myMeds.filter(m => m.quantity <= 30).sort((a, b) => a.quantity - b.quantity).slice(0, 5 - recommendations.length);
    for (const m of lowStock) {
      recommendations.push({ medicine: m.name, reason: `المخزون منخفض (${m.quantity} وحدة فقط) — يُنصح بإعادة التوريد قريباً`, confidence: 0.85 });
    }
  }

  if (recommendations.length === 0) {
    const popular = await db
      .select({ name: medicinesTable.name, stockedBy: sql<number>`COUNT(DISTINCT ${medicinesTable.pharmacyId})::int` })
      .from(medicinesTable).groupBy(medicinesTable.name).orderBy(sql`COUNT(DISTINCT ${medicinesTable.pharmacyId}) DESC`).limit(5);
    for (const p of popular) {
      if (myMedNames.has(p.name)) continue;
      recommendations.push({ medicine: p.name, reason: `متوفر لدى ${p.stockedBy} صيدلية على المنصة — أساسي في السوق الأردني`, confidence: 0.7 });
      if (recommendations.length >= 5) break;
    }
  }

  res.json({ recommendations });
});

router.get("/ai/medicine-suggestions", requirePharmacy, async (_req, res): Promise<void> => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

  const recent = await db
    .select({ name: medicinesTable.name, count: sql<number>`COUNT(${requestsTable.id})::int` })
    .from(requestsTable).innerJoin(medicinesTable, eq(requestsTable.medicineId, medicinesTable.id))
    .where(gte(requestsTable.requestDate, thirtyDaysAgo))
    .groupBy(medicinesTable.name).orderBy(sql`COUNT(${requestsTable.id}) DESC`).limit(5);

  const previous = await db
    .select({ name: medicinesTable.name, count: sql<number>`COUNT(${requestsTable.id})::int` })
    .from(requestsTable).innerJoin(medicinesTable, eq(requestsTable.medicineId, medicinesTable.id))
    .where(and(gte(requestsTable.requestDate, sixtyDaysAgo), sql`${requestsTable.requestDate} < ${thirtyDaysAgo}`))
    .groupBy(medicinesTable.name);

  const prevMap = new Map(previous.map(p => [p.name, p.count]));
  let suggestions = recent.map(r => ({
    name: r.name,
    trend: r.count > (prevMap.get(r.name) ?? 0) ? "صاعد" : "ثابت",
    estimatedDemand: Math.max(15, r.count * 4),
  }));

  if (suggestions.length === 0) {
    const lowStock = await db
      .select({ name: medicinesTable.name, totalQuantity: sql<number>`SUM(${medicinesTable.quantity})::int`, stockedBy: sql<number>`COUNT(DISTINCT ${medicinesTable.pharmacyId})::int` })
      .from(medicinesTable).where(eq(medicinesTable.isAvailable, true))
      .groupBy(medicinesTable.name).orderBy(sql`SUM(${medicinesTable.quantity}) ASC`).limit(5);
    suggestions = lowStock.map(l => ({ name: l.name, trend: l.totalQuantity < 50 ? "صاعد" : "ثابت", estimatedDemand: Math.max(20, l.stockedBy * 25) }));
  }

  res.json({ suggestions });
});

router.get("/ai/price-optimization", requirePharmacy, async (req, res): Promise<void> => {
  const pharmacyId = req.session.pharmacyId!;
  const focusMedicine = typeof req.query.medicine === "string" && req.query.medicine.trim() !== "" ? req.query.medicine : null;

  const myMeds = await db.select({ id: medicinesTable.id, name: medicinesTable.name, price: medicinesTable.price })
    .from(medicinesTable).where(eq(medicinesTable.pharmacyId, pharmacyId));
  const target = focusMedicine ? myMeds.filter(m => m.name === focusMedicine) : myMeds.slice(0, 5);

  const optimizations: Array<{ medicine: string; currentPrice: number; suggestedPrice: number; reason: string }> = [];

  for (const med of target) {
    const [agg] = await db
      .select({ avg: sql<number>`AVG(${medicinesTable.price})::float8`, n: sql<number>`COUNT(*)::int` })
      .from(medicinesTable).where(and(eq(medicinesTable.name, med.name), ne(medicinesTable.pharmacyId, pharmacyId)));

    const currentPrice = Number(med.price);
    if (!agg || agg.n === 0) { optimizations.push({ medicine: med.name, currentPrice, suggestedPrice: currentPrice, reason: "لا توجد أسعار مقارنة لهذا الدواء حالياً على المنصة" }); continue; }

    const avg = Number(agg.avg);
    if (!Number.isFinite(avg) || avg <= 0) { optimizations.push({ medicine: med.name, currentPrice, suggestedPrice: currentPrice, reason: "بيانات الأسعار المقارنة غير كافية لإصدار توصية موثوقة" }); continue; }

    const diffPct = ((currentPrice - avg) / avg) * 100;
    let suggestedPrice = Math.round(currentPrice * 100) / 100, reason = "";
    if (diffPct > 10) { suggestedPrice = Math.round(avg * 1.05 * 100) / 100; reason = `سعرك أعلى من متوسط السوق (${avg.toFixed(2)} JOD) بنسبة ${diffPct.toFixed(0)}% — يُقترح تخفيضه قليلاً لزيادة المبيعات`; }
    else if (diffPct < -10) { suggestedPrice = Math.round(avg * 0.95 * 100) / 100; reason = `سعرك أقل من متوسط السوق (${avg.toFixed(2)} JOD) بنسبة ${Math.abs(diffPct).toFixed(0)}% — يمكنك رفعه قليلاً لتحسين الهامش`; }
    else { reason = `سعرك متوافق مع متوسط السوق (${avg.toFixed(2)} JOD) — استمر`; }
    optimizations.push({ medicine: med.name, currentPrice, suggestedPrice, reason });
  }

  if (optimizations.length === 0 && focusMedicine) {
    const [agg] = await db.select({ avg: sql<number>`AVG(${medicinesTable.price})::float8`, n: sql<number>`COUNT(*)::int` }).from(medicinesTable).where(eq(medicinesTable.name, focusMedicine));
    if (agg && agg.n > 0) { const marketAvg = Number(agg.avg); optimizations.push({ medicine: focusMedicine, currentPrice: marketAvg, suggestedPrice: marketAvg, reason: `لا تمتلك هذا الدواء — متوسط السعر على المنصة هو ${marketAvg.toFixed(2)} JOD لدى ${agg.n} صيدلية` }); }
  }
  res.json({ optimizations });
});

router.get("/ai/demand-forecast", requirePharmacy, async (req, res): Promise<void> => {
  const focusMedicine = typeof req.query.medicine === "string" && req.query.medicine.trim() !== "" ? req.query.medicine : null;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      name: medicinesTable.name,
      recentCount: sql<number>`SUM(CASE WHEN ${requestsTable.requestDate} >= ${thirtyDaysAgo} THEN 1 ELSE 0 END)::int`,
      previousCount: sql<number>`SUM(CASE WHEN ${requestsTable.requestDate} >= ${sixtyDaysAgo} AND ${requestsTable.requestDate} < ${thirtyDaysAgo} THEN 1 ELSE 0 END)::int`,
    })
    .from(requestsTable).innerJoin(medicinesTable, eq(requestsTable.medicineId, medicinesTable.id))
    .where(gte(requestsTable.requestDate, sixtyDaysAgo)).groupBy(medicinesTable.name);

  let working = rows;
  if (focusMedicine) { working = rows.filter(r => r.name === focusMedicine); if (working.length === 0) working = [{ name: focusMedicine, recentCount: 0, previousCount: 0 }]; }
  working.sort((a, b) => b.recentCount - a.recentCount);
  working = working.slice(0, focusMedicine ? 1 : 5);

  const forecasts = working.map(r => {
    const growth = r.previousCount === 0 ? (r.recentCount > 0 ? 1.5 : 1) : r.recentCount / r.previousCount;
    const projected = Math.max(1, Math.round(r.recentCount * growth) || (r.recentCount > 0 ? r.recentCount : 2));
    const trend = r.recentCount > r.previousCount ? "صاعد" : r.recentCount < r.previousCount ? "هابط" : "ثابت";
    return { medicine: r.name, nextMonthDemand: projected * 5, trend, seasonality: r.recentCount > 0 ? `بناءً على ${r.recentCount} طلب في آخر 30 يوماً` : "لا توجد بيانات طلب كافية لهذا الدواء بعد" };
  });
  res.json({ forecasts });
});

const CHAT_RESPONSES: Record<string, string> = {
  default: "شكراً لسؤالك! أنصحك بمراقبة مستويات المخزون بانتظام وتحليل البيانات الموسمية لتحسين إدارة صيدليتك.",
  مخزون: "لإدارة المخزون بفعالية، تأكد من تتبع تواريخ انتهاء الصلاحية وطلب الكميات المناسبة بناءً على الطلب المتوقع.",
  سعر: "لتحسين الأسعار، ادرس أسعار المنافسين وكلفة التشغيل، وحاول تقديم خصومات للكميات الكبيرة.",
  طلب: "لزيادة الطلب على أدويتك، تأكد من توفر الأدوية الأساسية دائماً وتحديث قائمة الأدوية المتاحة بانتظام.",
  اشتراك: "خطة الاشتراك السنوية توفر لك أفضل قيمة مقابل المال مع توفير 20% مقارنة بالخطة الشهرية.",
  انتهاء: "للتعامل مع الأدوية القاربة على انتهاء صلاحيتها، يمكنك عرضها بسعر مخفض على المنصة لتبادلها مع صيدليات أخرى.",
};
const CHAT_SUGGESTIONS = ["كيف أحسن إدارة مخزوني؟", "ما هي أفضل استراتيجية للتسعير؟", "كيف أزيد الطلب على أدويتي؟", "ما هي مزايا خطة الاشتراك السنوية؟"];

router.post("/ai/chat", requirePharmacy, async (req, res): Promise<void> => {
  const parsed = AiChatBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { message } = parsed.data;
  const lowerMsg = message.toLowerCase();
  let response = CHAT_RESPONSES.default;
  for (const [key, val] of Object.entries(CHAT_RESPONSES)) {
    if (key !== "default" && lowerMsg.includes(key)) { response = val; break; }
  }
  res.json({ response, suggestions: CHAT_SUGGESTIONS });
});

export default router;
