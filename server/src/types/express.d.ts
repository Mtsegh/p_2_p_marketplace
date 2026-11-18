import type { AccessTokenClaims } from "../modules/auth/tokens.js";

declare global {
  namespace Express {
    interface Request {
      /** Set by the request-id middleware. Always present for app requests. */
      id: string;
      /** Set by `requireAuth` after the access token and denylist check. */
      auth?: AccessTokenClaims;
    }
  }
}

export {};
