"use client"

import { useRef, useState } from "react"
import Image from "next/image"
import { ImagePlus, Trash2, Loader2, GripVertical, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const MAX_IMAGES = 5

interface CarImageUploaderProps {
  /** Existing image URLs (from DB or after upload). */
  images: string[]
  onChange: (images: string[]) => void
  /**
   * If carId is provided the component uploads immediately via
   * POST /api/cars/[carId]/upload-image.
   * If carId is absent (create flow) it stores File objects as object URLs
   * and calls onPendingFiles with the raw Files for the parent to upload
   * after the car record is created.
   */
  carId?: string
  onPendingFiles?: (files: File[]) => void
  disabled?: boolean
}

export function CarImageUploader({
  images,
  onChange,
  carId,
  onPendingFiles,
  disabled,
}: CarImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  // objectURL → File map for the create flow
  const [fileMap, setFileMap] = useState<Map<string, File>>(new Map())

  const canAdd = images.length < MAX_IMAGES && !disabled

  // ── Handle file selection ──────────────────────────────────────
  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return

    const remaining = MAX_IMAGES - images.length
    const toProcess = Array.from(files).slice(0, remaining)

    if (carId) {
      // Edit flow: upload immediately
      setUploading(true)
      const newUrls: string[] = []
      for (const file of toProcess) {
        try {
          const fd = new FormData()
          fd.append("file", file)
          const res = await fetch(`/api/cars/${carId}/upload-image`, {
            method: "POST",
            body: fd,
          })
          if (!res.ok) {
            const err = await res.json()
            console.warn("[v0] Upload failed:", err.error)
            continue
          }
          const { url } = await res.json()
          newUrls.push(url)
        } catch (e) {
          console.error("[v0] Upload error:", e)
        }
      }
      if (newUrls.length > 0) onChange([...images, ...newUrls])
      setUploading(false)
    } else {
      // Create flow: store as object URLs + track pending files
      const newUrls: string[] = []
      const newMap = new Map(fileMap)
      const newFiles: File[] = []
      for (const file of toProcess) {
        const objUrl = URL.createObjectURL(file)
        newUrls.push(objUrl)
        newMap.set(objUrl, file)
        newFiles.push(file)
      }
      setFileMap(newMap)
      const updatedPending = [...pendingFiles, ...newFiles]
      setPendingFiles(updatedPending)
      onChange([...images, ...newUrls])
      onPendingFiles?.(updatedPending)
    }

    // Reset input
    if (inputRef.current) inputRef.current.value = ""
  }

  // ── Remove ─────────────────────────────────────────────────────
  async function handleRemove(url: string) {
    if (carId && !url.startsWith("blob:")) {
      // Server delete
      setRemoving(url)
      try {
        await fetch(`/api/cars/${carId}/upload-image`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        })
      } catch (e) {
        console.error("[v0] Remove error:", e)
      } finally {
        setRemoving(null)
      }
    } else {
      // Create flow — revoke object URL and remove from pending
      URL.revokeObjectURL(url)
      const file = fileMap.get(url)
      const newMap = new Map(fileMap)
      newMap.delete(url)
      setFileMap(newMap)
      if (file) {
        const newPending = pendingFiles.filter((f) => f !== file)
        setPendingFiles(newPending)
        onPendingFiles?.(newPending)
      }
    }
    onChange(images.filter((u) => u !== url))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {images.length}/{MAX_IMAGES} photos
          {images.length === 0 && (
            <span className="ml-1 text-amber-600 dark:text-amber-400">— add at least 1</span>
          )}
        </p>
        {canAdd && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 bg-transparent"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ImagePlus className="h-3.5 w-3.5" />
            )}
            {uploading ? "Uploading…" : "Add photos"}
          </Button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {/* Image grid */}
      {images.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {images.map((url, idx) => {
            const isRemoving = removing === url
            return (
              <div
                key={url}
                className={cn(
                  "relative group aspect-[4/3] rounded-xl overflow-hidden bg-muted border-2 transition-all",
                  idx === 0 ? "border-primary/50" : "border-border/40",
                )}
              >
                <Image
                  src={url}
                  alt={`Car photo ${idx + 1}`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 50vw, 33vw"
                  unoptimized={url.startsWith("blob:")}
                />

                {/* Featured badge on first image */}
                {idx === 0 && (
                  <div className="absolute top-1.5 left-1.5 flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                    <Star className="h-2.5 w-2.5 fill-current" />
                    Featured
                  </div>
                )}

                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => handleRemove(url)}
                  disabled={isRemoving || disabled}
                  className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                >
                  {isRemoving ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                </button>

                {/* Drag handle hint */}
                <div className="absolute bottom-1.5 left-1.5 opacity-0 group-hover:opacity-60 transition-opacity">
                  <GripVertical className="h-3.5 w-3.5 text-white drop-shadow" />
                </div>
              </div>
            )
          })}

          {/* Add placeholder */}
          {canAdd && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="aspect-[4/3] rounded-xl border-2 border-dashed border-border/50 flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:border-primary/40 hover:text-primary transition-all group"
            >
              <ImagePlus className="h-6 w-6 group-hover:scale-110 transition-transform" />
              <span className="text-xs">Add photo</span>
            </button>
          )}
        </div>
      ) : (
        /* Empty drop zone */
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={!canAdd || uploading}
          className="w-full aspect-[21/9] rounded-xl border-2 border-dashed border-border/50 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary/40 hover:text-primary transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ImagePlus className="h-10 w-10 group-hover:scale-110 transition-transform" />
          <p className="text-sm font-medium">Click to upload car photos</p>
          <p className="text-xs">Up to {MAX_IMAGES} photos · JPG, PNG, WebP</p>
        </button>
      )}
    </div>
  )
}
