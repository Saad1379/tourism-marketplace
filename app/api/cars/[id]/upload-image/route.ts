import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { uploadToCloudinary, getPublicIdFromUrl, deleteFromCloudinary } from "@/lib/cloudinary"

const MAX_IMAGES = 5
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB per file

/**
 * POST /api/cars/[id]/upload-image
 * Seller-only: upload one image to Cloudinary and append its URL to the car.
 *
 * Body: multipart/form-data  { file: File }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: carId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Ownership check
    const { data: car } = await supabase
      .from("cars")
      .select("seller_id, images")
      .eq("id", carId)
      .single()

    if (!car) return NextResponse.json({ error: "Car not found" }, { status: 404 })
    if (car.seller_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const currentImages: string[] = Array.isArray(car.images) ? car.images : []
    if (currentImages.length >= MAX_IMAGES) {
      return NextResponse.json(
        { error: `Maximum ${MAX_IMAGES} images allowed` },
        { status: 400 },
      )
    }

    // Parse multipart
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 400 })
    }

    // Convert File → base64 data URI
    const arrayBuffer = await file.arrayBuffer()
    const dataUri = `data:${file.type};base64,${Buffer.from(arrayBuffer).toString("base64")}`

    // Upload to Cloudinary
    const result = await uploadToCloudinary(dataUri, {
      folder: `touricho/cars/${carId}`,
      maxWidth: 1920,
      maxHeight: 1080,
    })

    // Append URL to car.images
    const updatedImages = [...currentImages, result.url]
    await supabase
      .from("cars")
      .update({ images: updatedImages })
      .eq("id", carId)

    return NextResponse.json({ url: result.url, publicId: result.publicId }, { status: 201 })
  } catch (error) {
    console.error("[v0] Car image upload error:", error)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}

/**
 * DELETE /api/cars/[id]/upload-image
 * Seller-only: remove one image URL from the car and delete it from Cloudinary.
 *
 * Body: { url: string }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: carId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: car } = await supabase
      .from("cars")
      .select("seller_id, images")
      .eq("id", carId)
      .single()

    if (!car) return NextResponse.json({ error: "Car not found" }, { status: 404 })
    if (car.seller_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { url } = await request.json()
    if (!url) return NextResponse.json({ error: "url is required" }, { status: 400 })

    // Remove from DB first
    const updatedImages = (car.images ?? []).filter((u: string) => u !== url)
    await supabase.from("cars").update({ images: updatedImages }).eq("id", carId)

    // Best-effort delete from Cloudinary
    const publicId = getPublicIdFromUrl(url)
    if (publicId) {
      await deleteFromCloudinary(publicId).catch((e) =>
        console.warn("[v0] Cloudinary delete warning:", e),
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Car image delete error:", error)
    return NextResponse.json({ error: "Delete failed" }, { status: 500 })
  }
}
