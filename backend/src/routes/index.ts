import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import adminRouter from "./admin.js";
import medicinesRouter from "./medicines.js";
import requestsRouter from "./requests.js";
import subscriptionsRouter from "./subscriptions.js";
import notificationsRouter from "./notifications.js";
import aiRouter from "./ai.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(adminRouter);
router.use(medicinesRouter);
router.use(requestsRouter);
router.use(subscriptionsRouter);
router.use(notificationsRouter);
router.use(aiRouter);

export default router;
