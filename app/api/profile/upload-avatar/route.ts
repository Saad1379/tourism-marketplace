import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    const anonClient = await createClient()
    const {
      data: { user },
    } = await anonClient.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Validate file type
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"]
    if (!file.type.startsWith("image/") || !validTypes.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type. Please upload an image." }, { status: 400 })
    }

    // Validate file size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large. Max size 2MB." }, { status: 400 })
    }

    const serviceClient = createServiceRoleClient()
    const bucketName = "avatars"

    // Ensure bucket exists (using service role)
    const { data: buckets } = await serviceClient.storage.listBuckets()
    if (!buckets?.find(b => b.id === bucketName)) {
      await serviceClient.storage.createBucket(bucketName, {
        public: true,
        fileSizeLimit: 2 * 1024 * 1024,
        allowedMimeTypes: validTypes
      })
    }

    // Setup file name
    const fileExt = file.name.split(".").pop() || "jpg"
    const fileName = `${user.id}/${Date.now()}.${fileExt}`
    
    // Upload using anonClient (if RLS allows) or serviceClient
    // Usually RLS for storage is tricky, so service role is safer for the upload part 
    // if we want to ensure it works regardless of specific bucket policies.
    const { data: uploadData, error: uploadError } = await serviceClient.storage
      .from(bucketName)
      .upload(fileName, file, { 
        upsert: true,
        contentType: file.type
      })

    if (uploadError) {
      console.error("[v0] Avatar upload error:", uploadError)
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    // Get public URL
    const { data: { publicUrl } } = serviceClient.storage
      .from(bucketName)
      .getPublicUrl(fileName)

    return NextResponse.json({ url: publicUrl })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error"
    console.error("[v0] Avatar upload unexpected error:", error)
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}
