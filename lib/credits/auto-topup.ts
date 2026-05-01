export const AUTO_TOPUP_CONFIG_KEY = "touricho_auto_topup_config_v1"
export const AUTO_TOPUP_THRESHOLD = 20

export type AutoTopupConfig = {
  enabled: boolean
  packageId: string
  threshold: number
}

export function parseAutoTopupConfig(raw: string | null): AutoTopupConfig | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<AutoTopupConfig>
    if (!parsed || typeof parsed !== "object") return null
    if (typeof parsed.enabled !== "boolean") return null
    if (typeof parsed.packageId !== "string") return null
    if (typeof parsed.threshold !== "number") return null
    if (!parsed.packageId.trim()) return null
    if (!Number.isFinite(parsed.threshold) || parsed.threshold <= 0) return null
    return {
      enabled: parsed.enabled,
      packageId: parsed.packageId,
      threshold: parsed.threshold,
    }
  } catch {
    return null
  }
}
