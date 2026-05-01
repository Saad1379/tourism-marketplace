import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"
import { TOUR_IMAGE_POLICY, isAcceptedTourImageType } from "@/lib/images/policy"
import { uploadToCloudinary } from "@/lib/cloudinary"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    
    // Use anon client to verify user is logged in
    const anonClient = await createClient()
    const {
      data: { user },
    } = await anonClient.auth.getUser()

    if (!user) {
      console.error("[v0] Image upload: No authenticated user")
      return NextResponse.json({ error: "Unauthorized: Not logged in" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      console.error("[v0] Image upload: No file in FormData")
      return NextResponse.json({ error: "Bad request: No file provided" }, { status: 400 })
    }

    // Validate file type
    if (!isAcceptedTourImageType(file.type)) {
      console.error("[v0] Image upload: Invalid file type:", file.type)
      return NextResponse.json(
        {
          error: `Bad request: Invalid file type. Allowed: ${TOUR_IMAGE_POLICY.acceptedMimeTypes.join(", ")}`,
          code: "INVALID_IMAGE_TYPE",
          allowed_types: TOUR_IMAGE_POLICY.acceptedMimeTypes,
        },
        { status: 400 }
      )
    }

    // Validate file size (max 10MB before compression)
    if (file.size > TOUR_IMAGE_POLICY.maxRawUploadBytes) {
      console.error("[v0] Image upload: File too large:", file.size)
      return NextResponse.json(
        {
          error: "Bad request: File size exceeds 10MB limit",
          code: "IMAGE_TOO_LARGE",
          max_bytes: TOUR_IMAGE_POLICY.maxRawUploadBytes,
        },
        { status: 400 },
      )
    }

    // Use anon client to verify tour exists and ownership
    console.log("[v0] Image upload: Verifying tour", id, "for user", user.id)
    const { data: tour, error: tourError } = await anonClient
      .from("tours")
      .select("id, guide_id, photos")
      .eq("id", id)
      .single()

    if (tourError) {
      console.error("[v0] Image upload: Error fetching tour:", tourError.message, tourError.code)
      return NextResponse.json({ error: "Server error: Failed to fetch tour" }, { status: 500 })
    }

    if (!tour) {
      console.error("[v0] Image upload: Tour not found:", id)
      return NextResponse.json({ error: "Not found: Tour does not exist" }, { status: 404 })
    }

    if (tour.guide_id !== user.id) {
      console.error("[v0] Image upload: Ownership mismatch. Tour guide:", tour.guide_id, "User:", user.id)
      return NextResponse.json(
        { error: "Forbidden: You can only upload images to your own tours" },
        { status: 403 }
      )
    }

    // Limit number of photos per tour
    const currentPhotos = tour.photos || []
    if (currentPhotos.length >= TOUR_IMAGE_POLICY.maxImagesPerTour) {
      console.warn("[v0] Image upload: Photo limit reached for tour", id)
      return NextResponse.json(
        {
          error: `Bad request: Maximum ${TOUR_IMAGE_POLICY.maxImagesPerTour} photos per tour`,
          code: "PHOTO_LIMIT_REACHED",
          max_images: TOUR_IMAGE_POLICY.maxImagesPerTour,
        },
        { status: 400 },
      )
    }

    // Upload file to Cloudinary
    console.log("[v0] Image upload: Uploading file to Cloudinary:", file.name)
    
    // Convert File to Buffer for the utility
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    const uploadResult = await uploadToCloudinary(buffer, {
      folder: `tours/${id}`,
      // We don't specify a publicId here to let Cloudinary generate a unique one
      // but we could use `${Date.now()}-${file.name.split('.')[0]}`
    })

    const publicUrl = uploadResult.url
    console.log("[v0] Image upload: File uploaded to Cloudinary, URL:", publicUrl)

    // Use service role client to update tour (bypasses RLS for storage-related updates)
    const serviceClient = createServiceRoleClient()
    const updatedPhotos = [...currentPhotos, publicUrl]

    console.log("[v0] Image upload: Updating tour photos array, new length:", updatedPhotos.length)
    const { error: updateError } = await serviceClient
      .from("tours")
      .update({ photos: updatedPhotos })
      .eq("id", id)

    if (updateError) {
      console.error("[v0] Image upload: Failed to update tour photos:", updateError.message, updateError.code)
      // Note: We might want to delete the Cloudinary image here if the DB update fails,
      // but the user only asked for storage replacement.
      return NextResponse.json(
        { error: `Server error: Failed to update tour - ${updateError.message}` },
        { status: 500 }
      )
    }

    console.log("[v0] Image upload: Successfully uploaded image for tour", id)
    return NextResponse.json({ url: publicUrl, tour_id: id }, { status: 200 })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error"
    console.error("[v0] Image upload: Unexpected server error:", errorMsg, error)
    return NextResponse.json(
      { error: `Server error: ${errorMsg}` },
      { status: 500 }
    )
  }
}
