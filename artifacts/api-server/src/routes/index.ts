import { Router, type IRouter } from "express";
import healthRouter from "./health";
import amazonscopeRouter from "./amazonscope";

const router: IRouter = Router();

router.use(healthRouter);
router.use(amazonscopeRouter);

export default router;
