import { v2 as cloudinary } from "cloudinary"

// ── Configuration ──────────────────────────────────────────────────
// Called lazily so the module is safe to import without env vars at
// build time (e.g. during static analysis).
let configured = false

function ensureConfigured() {
  if (configured) return
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in your .env file.",
    )
  }

  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret })
  configured = true
}

// ── Types ──────────────────────────────────────────────────────────

export interface CloudinaryUploadOptions {
  /** Destination folder inside your Cloudinary account (e.g. "cars", "tours/123"). */
  folder?: string
  /**
   * Explicit public_id. When omitted Cloudinary auto-generates one.
   * Do NOT include the folder prefix — set `folder` separately.
   */
  publicId?: string
  /** Maximum width (px). Larger images are downscaled. Default: 1920. */
  maxWidth?: number
  /** Maximum height (px). Larger images are downscaled. Default: 1080. */
  maxHeight?: number
  /**
   * Transformation applied on delivery.
   * Defaults to auto-format + auto-quality (best compression without visible loss).
   */
  transformation?: object[]
}

export interface CloudinaryUploadResult {
  /** Fully-qualified HTTPS URL of the uploaded asset. */
  url: string
  /** Cloudinary public_id (use for deletions or transformations). */
  publicId: string
  /** Width in pixels of the stored version. */
  width: number
  /** Height in pixels of the stored version. */
  height: number
  /** Byte size of the stored version. */
  bytes: number
  /** MIME type (e.g. "image/webp"). */
  format: string
  /** The raw Cloudinary response (for advanced use). */
  raw: Record<string, unknown>
}

export type CloudinaryResourceType = "image" | "video" | "raw" | "auto"

// ── Core upload function ───────────────────────────────────────────

/**
 * Upload a file to Cloudinary from a URL, base-64 data URI, or a
 * server-side `Buffer` (converted to a data URI internally).
 *
 * **Server-only** — never call this from client components.
 *
 * @example
 * // From a URL
 * const result = await uploadToCloudinary("https://example.com/photo.jpg", { folder: "cars" })
 *
 * @example
 * // From a Next.js route handler (multipart/form-data)
 * const file = formData.get("file") as File
 * const bytes = await file.arrayBuffer()
 * const dataUri = `data:${file.type};base64,${Buffer.from(bytes).toString("base64")}`
 * const result = await uploadToCloudinary(dataUri, { folder: "cars", publicId: carId })
 */
export async function uploadToCloudinary(
  source: string | Buffer,
  options: CloudinaryUploadOptions = {},
): Promise<CloudinaryUploadResult> {
  ensureConfigured()

  const { folder = "touricho", publicId, maxWidth = 1920, maxHeight = 1080, transformation } = options

  // Convert Buffer → base-64 data URI
  const src =
    Buffer.isBuffer(source)
      ? `data:image/jpeg;base64,${source.toString("base64")}`
      : source

  const uploadOptions: Record<string, unknown> = {
    folder,
    overwrite: true,
    // Limit storage dimensions server-side
    transformation: transformation ?? [
      { width: maxWidth, height: maxHeight, crop: "limit" },
      { fetch_format: "auto", quality: "auto" },
    ],
  }
  if (publicId) uploadOptions.public_id = publicId

  const result = await cloudinary.uploader.upload(src, uploadOptions)

  return {
    url: result.secure_url,
    publicId: result.public_id,
    width: result.width,
    height: result.height,
    bytes: result.bytes,
    format: result.format,
    raw: result as unknown as Record<string, unknown>,
  }
}

// ── Delete ─────────────────────────────────────────────────────────

/**
 * Delete an asset by its `publicId`.
 *
 * @example
 * await deleteFromCloudinary("cars/my-public-id")
 */
export async function deleteFromCloudinary(
  publicId: string,
  resourceType: CloudinaryResourceType = "image",
): Promise<void> {
  ensureConfigured()
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType })
}

// ── URL helpers ────────────────────────────────────────────────────

/**
 * Build an optimised delivery URL for an existing Cloudinary asset.
 * Applies auto-format and auto-quality by default.
 *
 * @example
 * const src = getCloudinaryUrl("cars/my-photo", { width: 800, crop: "fill" })
 */
export function getCloudinaryUrl(
  publicId: string,
  options: {
    width?: number
    height?: number
    crop?: string
    gravity?: string
    quality?: string | number
    fetchFormat?: string
  } = {},
): string {
  ensureConfigured()

  const {
    width,
    height,
    crop = "limit",
    gravity,
    quality = "auto",
    fetchFormat = "auto",
  } = options

  return cloudinary.url(publicId, {
    secure: true,
    fetch_format: fetchFormat,
    quality,
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
    ...(width || height ? { crop } : {}),
    ...(gravity ? { gravity } : {}),
  })
}

/**
 * Extract the Cloudinary `public_id` from a full Cloudinary URL.
 * Returns `null` if the URL is not a Cloudinary URL.
 *
 * @example
 * getPublicIdFromUrl("https://res.cloudinary.com/dfmvjqbai/image/upload/v1234/cars/my-photo.webp")
 * // → "cars/my-photo"
 */
export function getPublicIdFromUrl(url: string): string | null {
  try {
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-z0-9]+)?$/)
    return match ? match[1] : null
  } catch {
    return null
  }
}

// ── Re-export the configured cloudinary instance for advanced use ──
export { cloudinary }
