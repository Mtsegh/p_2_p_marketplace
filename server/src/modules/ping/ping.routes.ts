import { Router } from "express";
import { ping } from "./ping.controller.js";

export const pingRouter = Router();

pingRouter.get("/", ping);
