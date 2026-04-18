import { TOUR_IMAGE_POLICY, isAcceptedTourImageType } from "@/lib/images/policy"

export interface TourImageCompressionStats {
  originalName: string
  originalType: string
  originalBytes: number
  compressedBytes: number
  width: number
  height: number
  quality: number
  outputType: string
  lowResolution: boolean
  aboveTargetSize: boolean
}

const QUALITY_STEPS = [0.82, 0.76, 0.72, 0.68, 0.64]
const DOWNSCALE_STEPS = [1, 0.9, 0.8]

function stripImageExtension(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "")
}

function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ""))
    reader.onerror = () => reject(new Error("Failed to read image preview."))
    reader.readAsDataURL(file)
  })
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("Failed to decode image."))
    img.src = dataUrl
  })
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Image compression failed."))
          return
        }
        resolve(blob)
      },
      type,
      quality,
    )
  })
}

function getTargetSize(width: number, height: number) {
  const maxDimension = Math.max(width, height)
  if (maxDimension <= TOUR_IMAGE_POLICY.maxDimensionPx) {
    return { width, height }
  }

  const ratio = TOUR_IMAGE_POLICY.maxDimensionPx / maxDimension
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  }
}

export async function compressTourImageForUpload(file: File): Promise<{ file: File; previewUrl: string; stats: TourImageCompressionStats }> {
  if (!isAcceptedTourImageType(file.type)) {
    throw new Error("Only JPG, PNG, or WebP files are allowed.")
  }

  if (file.size > TOUR_IMAGE_POLICY.maxRawUploadBytes) {
    throw new Error("Image is larger than 10MB.")
  }

  const dataUrl = await toDataUrl(file)
  const sourceImage = await loadImage(dataUrl)
  const target = getTargetSize(sourceImage.naturalWidth, sourceImage.naturalHeight)

  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")
  if (!ctx) {
    throw new Error("Unable to initialize image processing.")
  }

  let bestBlob: Blob | null = null
  let bestQuality = QUALITY_STEPS[0]
  let bestWidth = target.width
  let bestHeight = target.height

  for (const scale of DOWNSCALE_STEPS) {
    const width = Math.max(1, Math.round(target.width * scale))
    const height = Math.max(1, Math.round(target.height * scale))

    canvas.width = width
    canvas.height = height
    ctx.clearRect(0, 0, width, height)
    ctx.drawImage(sourceImage, 0, 0, width, height)

    for (const quality of QUALITY_STEPS) {
      const candidate = await toBlob(canvas, TOUR_IMAGE_POLICY.outputMimeType, quality)

      if (!bestBlob || candidate.size < bestBlob.size) {
        bestBlob = candidate
        bestQuality = quality
        bestWidth = width
        bestHeight = height
      }

      if (candidate.size <= TOUR_IMAGE_POLICY.targetBytesMax) {
        bestBlob = candidate
        bestQuality = quality
        bestWidth = width
        bestHeight = height
        break
      }
    }

    if (bestBlob && bestBlob.size <= TOUR_IMAGE_POLICY.targetBytesMax) break
  }

  if (!bestBlob) {
    throw new Error("Image compression failed.")
  }

  const outputName = `${stripImageExtension(file.name)}.webp`
  const compressedFile = new File([bestBlob], outputName, {
    type: TOUR_IMAGE_POLICY.outputMimeType,
    lastModified: Date.now(),
  })

  const previewUrl = await toDataUrl(compressedFile)
  const stats: TourImageCompressionStats = {
    originalName: file.name,
    originalType: file.type,
    originalBytes: file.size,
    compressedBytes: compressedFile.size,
    width: bestWidth,
    height: bestHeight,
    quality: bestQuality,
    outputType: TOUR_IMAGE_POLICY.outputMimeType,
    lowResolution: bestWidth < TOUR_IMAGE_POLICY.minRecommendedWidth || bestHeight < TOUR_IMAGE_POLICY.minRecommendedHeight,
    aboveTargetSize: compressedFile.size > TOUR_IMAGE_POLICY.targetBytesMax,
  }

  return {
    file: compressedFile,
    previewUrl,
    stats,
  }
}
