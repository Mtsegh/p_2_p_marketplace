import { prisma } from "../../db/prisma.js";
import { env } from "../../config/env.js";

export interface EffectiveSettings {
  platformFeeBps: number;
  escrowWindowDays: number;
}

const DEFAULTS: EffectiveSettings = {
  platformFeeBps: env.PLATFORM_FEE_BPS,
  escrowWindowDays: env.ESCROW_WINDOW_DAYS,
};

/**
 * Reads editable settings from the database, falling back to environment
 * defaults for keys that have never been persisted. Used by payments/escrow so
 * admin edits take effect immediately.
 */
export async function getEffectiveSettings(): Promise<EffectiveSettings> {
  const rows = await prisma.platformSetting.findMany({
    where: { key: { in: ["platformFeeBps", "escrowWindowDays"] } },
  });

  const result = { ...DEFAULTS };

  for (const row of rows) {
    if (row.value !== null && typeof row.value === "object") {
      const value = (row.value as { value?: unknown }).value;
      if (typeof value === "number" && Number.isFinite(value)) {
        if (row.key === "platformFeeBps") result.platformFeeBps = value;
        if (row.key === "escrowWindowDays") result.escrowWindowDays = value;
      }
    }
  }

  return result;
}
