declare global {
  namespace Express {
    interface Request {
      /** Set by the request-id middleware. Always present for app requests. */
      id: string;
    }
  }
}

export {};
