import { Router } from "express";
import { adminRouter } from "../modules/admin/admin.routes.js";
import { authRouter } from "../modules/auth/auth.routes.js";
import { pingRouter } from "../modules/ping/ping.routes.js";
import { profileRouter } from "../modules/profiles/profile.routes.js";

/** Everything under `/api/v1`. Feature routers are mounted here. */
export const apiRouter = Router();

apiRouter.use("/ping", pingRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/profiles", profileRouter);
apiRouter.use("/admin", adminRouter);
