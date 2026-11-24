import { Router } from "express";
import { adminRouter } from "../modules/admin/admin.routes.js";
import { authRouter } from "../modules/auth/auth.routes.js";
import { dealRouter } from "../modules/deals/deal.routes.js";
import { disputeRouter } from "../modules/disputes/dispute.routes.js";
import { reportRouter } from "../modules/reports/report.routes.js";
import { reviewRouter } from "../modules/reviews/review.routes.js";
import { listingRouter } from "../modules/listings/listing.routes.js";
import { paymentRouter } from "../modules/payments/payment.routes.js";
import { pingRouter } from "../modules/ping/ping.routes.js";
import { profileRouter } from "../modules/profiles/profile.routes.js";

/** Everything under `/api/v1`. Feature routers are mounted here. */
export const apiRouter = Router();

apiRouter.use("/ping", pingRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/deals", dealRouter);
apiRouter.use("/disputes", disputeRouter);
apiRouter.use("/reviews", reviewRouter);
apiRouter.use("/reports", reportRouter);
apiRouter.use("/listings", listingRouter);
apiRouter.use("/payments", paymentRouter);
apiRouter.use("/profiles", profileRouter);
apiRouter.use("/admin", adminRouter);
