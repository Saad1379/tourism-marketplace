export const TOUR_IMAGE_POLICY = {
  maxImagesPerTour: 6,
  acceptedMimeTypes: ["image/jpeg", "image/png", "image/webp"] as const,
  maxRawUploadBytes: 10 * 1024 * 1024, // 10 MB
  outputMimeType: "image/webp" as const,
  maxDimensionPx: 1920,
  minRecommendedWidth: 1200,
  minRecommendedHeight: 800,
  targetBytesMin: 250 * 1024, // 250 KB
  targetBytesMax: 450 * 1024, // 450 KB
  qualityProfile: "balanced" as const,
}

export type TourImageMimeType = (typeof TOUR_IMAGE_POLICY.acceptedMimeTypes)[number]

export function isAcceptedTourImageType(type: string): type is TourImageMimeType {
  return TOUR_IMAGE_POLICY.acceptedMimeTypes.includes(type as TourImageMimeType)
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function medianBytes(values: number[]): number | null {
  if (!Array.isArray(values) || values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[middle - 1] + sorted[middle]) / 2)
  }
  return sorted[middle]
}
