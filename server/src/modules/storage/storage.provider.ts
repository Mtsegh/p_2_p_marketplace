import { env } from "../../config/env.js";
import { s3Provider } from "./s3.provider.js";
import { memoryProvider } from "./memory.provider.js";
import type { StorageProvider } from "./storage.types.js";

/**
 * Single place that decides how object storage behaves. The rest of the code
 * imports `storageProvider` and never checks which one is active.
 */
export const storageProvider: StorageProvider = (() => {
  switch (env.STORAGE_PROVIDER) {
    case "s3":
      return s3Provider;
    case "memory":
      return memoryProvider;
  }
})();
