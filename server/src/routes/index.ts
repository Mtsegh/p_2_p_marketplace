import { Router } from "express";
import { pingRouter } from "../modules/ping/ping.routes.js";

/** Everything under `/api/v1`. Feature routers are mounted here. */
export const apiRouter = Router();

apiRouter.use("/ping", pingRouter);
