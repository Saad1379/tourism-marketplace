"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { FileText, RefreshCw, Sparkles } from "lucide-react"

type BlogPostRow = {
  id: string
  title: string
  slug: string
  status: string
  meta_description: string | null
  content_html: string
  content_markdown: string | null
  hero_image_url: string | null
  hero_image_alt: string | null
  infographic_image_url: string | null
  keywords: string[] | null
  meta_keywords: string | null
  language_code: string | null
  published_at: string | null
  created_at: string | null
  updated_at: string | null
  source_payload: Record<string, unknown> | null
}

type BlogEditorState = {
  title: string
  slug: string
  meta_description: string
  hero_image_url: string
  hero_image_alt: string
  infographic_image_url: string
  keywordsCsv: string
  meta_keywords: string
  content_markdown: string
  content_html: string
}

type GeneratorFormState = {
  topic: string
  primaryKeyword: string
  secondaryKeywords: string
  longTailQuestions: string
  customInstructions: string
  applyToDaily: boolean
}

type GeneratorResultState = {
  id: string | null
  slug: string
  status: string
  wordCount: number
  errorMessage?: string
  detectedPhrases?: string[]
}

const BANNED_PHRASE_NOTE = "Banned generic phrases detected — regenerate."

const STATUS_FILTERS = [
  { label: "Ready for approval", value: "ready_for_approval" },
  { label: "Generation failed", value: "generation_failed" },
  { label: "Regeneration requested", value: "regeneration_requested" },
  { label: "Rejected", value: "rejected" },
  { label: "Published", value: "published" },
]

const STATUS_LABELS: Record<string, string> = {
  ready_for_approval: "ready_for_approval",
  generation_failed: "generation_failed",
  regeneration_requested: "regeneration_requested",
  rejected: "rejected",
  published: "published",
}

function toLocalDate(value: string | null): string {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString()
}

function estimateWordCount(markdown: string): number {
  const words = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/\[[^\]]+\]\(([^)]+)\)/g, " ")
    .replace(/<[^>]+>/g, " ")
    .split(/\s+/)
    .filter(Boolean)

  return words.length
}

function getRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function getBannedPhraseFailureMeta(post: BlogPostRow | null): { isBannedPhraseFailure: boolean; note: string } {
  const payload = getRecord(post?.source_payload)
  if (!payload) return { isBannedPhraseFailure: false, note: "" }

  const quality = getRecord(payload.quality)
  const banned = getRecord(quality?.banned_generic_phrases)
  const directNote = readString(payload.failure_note)
  const qualityNote = readString(banned?.note)
  const note = directNote || qualityNote
  const matches = Array.isArray(banned?.matches) ? banned.matches : []
  const status = readString(banned?.status)

  const isBannedPhraseFailure =
    post?.status === "generation_failed" &&
    (note.toLowerCase().includes("banned generic phrases detected") ||
      status === "failed" ||
      matches.length > 0)

  return { isBannedPhraseFailure, note }
}

function getStatusBadgeVariant(status: string): "default" | "secondary" {
  return status === "ready_for_approval" ? "default" : "secondary"
}

function createInitialEditorState(post: BlogPostRow | null): BlogEditorState {
  const keywordsCsv = Array.isArray(post?.keywords) ? post.keywords.join(", ") : ""

  return {
    title: post?.title || "",
    slug: post?.slug || "",
    meta_description: post?.meta_description || "",
    hero_image_url: post?.hero_image_url || "",
    hero_image_alt: post?.hero_image_alt || "",
    infographic_image_url: post?.infographic_image_url || "",
    keywordsCsv,
    meta_keywords: post?.meta_keywords || "",
    content_markdown: post?.content_markdown || "",
    content_html: post?.content_html || "",
  }
}

function createKeywordsCsv(keywords: string[] | null): string {
  return Array.isArray(keywords) ? keywords.join(", ") : ""
}

function isEditorDirty(editor: BlogEditorState, post: BlogPostRow | null): boolean {
  if (!post) return false

  return (
    editor.title !== (post.title || "") ||
    editor.slug !== (post.slug || "") ||
    editor.meta_description !== (post.meta_description || "") ||
    editor.hero_image_url !== (post.hero_image_url || "") ||
    editor.hero_image_alt !== (post.hero_image_alt || "") ||
    editor.infographic_image_url !== (post.infographic_image_url || "") ||
    editor.keywordsCsv !== createKeywordsCsv(post.keywords) ||
    editor.meta_keywords !== (post.meta_keywords || "") ||
    editor.content_markdown !== (post.content_markdown || "") ||
    editor.content_html !== (post.content_html || "")
  )
}

function createDefaultGeneratorFormState(): GeneratorFormState {
  return {
    topic: "",
    primaryKeyword: "",
    secondaryKeywords: "",
    longTailQuestions: "",
    customInstructions: "",
    applyToDaily: false,
  }
}

function mapSettingsToForm(settings: Record<string, unknown> | null): GeneratorFormState {
  const base = createDefaultGeneratorFormState()
  if (!settings) return base

  const secondaryKeywords = Array.isArray(settings.secondaryKeywords)
    ? settings.secondaryKeywords.map((entry) => String(entry ?? "").trim()).filter(Boolean).join(", ")
    : ""
  const longTailQuestions = Array.isArray(settings.longTailQuestions)
    ? settings.longTailQuestions.map((entry) => String(entry ?? "").trim()).filter(Boolean).join("\n")
    : ""

  return {
    topic: typeof settings.topic === "string" ? settings.topic : base.topic,
    primaryKeyword: typeof settings.primaryKeyword === "string" ? settings.primaryKeyword : base.primaryKeyword,
    secondaryKeywords,
    longTailQuestions,
    customInstructions: typeof settings.customInstructions === "string" ? settings.customInstructions : base.customInstructions,
    applyToDaily: Boolean(settings.applyToDaily),
  }
}

export default function AdminBlogPage() {
  const { toast } = useToast()
  const [posts, setPosts] = useState<BlogPostRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("ready_for_approval")
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null)
  const [editor, setEditor] = useState<BlogEditorState>(createInitialEditorState(null))
  const [saving, setSaving] = useState(false)
  const [acting, setActing] = useState<null | "approve_publish" | "request_regeneration" | "reject">(null)
  const [reason, setReason] = useState("")
  const [generator, setGenerator] = useState<GeneratorFormState>(createDefaultGeneratorFormState())
  const [generatorLoading, setGeneratorLoading] = useState(true)
  const [generatorSaving, setGeneratorSaving] = useState(false)
  const [generatorRunning, setGeneratorRunning] = useState(false)
  const [generatorResult, setGeneratorResult] = useState<GeneratorResultState | null>(null)

  const selectedPost = useMemo(
    () => posts.find((post) => post.id === selectedPostId) || null,
    [posts, selectedPostId],
  )
  const selectedFailureMeta = useMemo(() => getBannedPhraseFailureMeta(selectedPost), [selectedPost])
  const hasUnsavedChanges = useMemo(() => isEditorDirty(editor, selectedPost), [editor, selectedPost])

  const fetchPosts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ status: statusFilter, limit: "50" })
      if (search.trim()) {
        params.set("search", search.trim())
      }

      const response = await fetch(`/api/admin/blog-posts?${params.toString()}`)
      const payload = await response.json()
      if (!response.ok || payload.error) {
        throw new Error(payload.error || "Failed to load blog queue")
      }

      const rows = Array.isArray(payload.posts) ? (payload.posts as BlogPostRow[]) : []
      setPosts(rows)
      setTotal(Number(payload.total || 0))

      if (rows.length === 0) {
        setSelectedPostId(null)
        setEditor(createInitialEditorState(null))
        return
      }

      const keepSelected = Boolean(selectedPostId) && rows.some((row) => row.id === selectedPostId)
      const nextSelected = keepSelected && selectedPostId ? selectedPostId : rows[0].id
      setSelectedPostId(nextSelected)

      const selected = rows.find((row) => row.id === nextSelected) || null
      setEditor(createInitialEditorState(selected))
    } catch (error) {
      toast({
        title: "Failed to load blog queue",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, toast])

  const fetchGeneratorSettings = useCallback(async () => {
    setGeneratorLoading(true)
    try {
      const response = await fetch("/api/admin/blog-generator")
      const payload = await response.json()
      if (!response.ok || payload.error) {
        throw new Error(payload.error || "Failed to load generator settings")
      }

      const settings =
        payload.settings && typeof payload.settings === "object" ? (payload.settings as Record<string, unknown>) : null
      setGenerator(mapSettingsToForm(settings))
    } catch (error) {
      toast({
        title: "Failed to load generator settings",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setGeneratorLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchPosts()
    fetchGeneratorSettings()
  }, [fetchGeneratorSettings, fetchPosts])

  useEffect(() => {
    setEditor(createInitialEditorState(selectedPost))
    setReason("")
  }, [selectedPost])

  const persistDraft = useCallback(
    async ({ showToast = true }: { showToast?: boolean } = {}) => {
      if (!selectedPost) return null

      setSaving(true)
      try {
        const markdownChanged = editor.content_markdown !== (selectedPost.content_markdown || "")
        const htmlChanged = editor.content_html !== (selectedPost.content_html || "")
        const patchPayload: Record<string, unknown> = {
          title: editor.title,
          slug: editor.slug,
          meta_description: editor.meta_description,
          hero_image_url: editor.hero_image_url,
          hero_image_alt: editor.hero_image_alt,
          infographic_image_url: editor.infographic_image_url,
          keywords: editor.keywordsCsv,
          meta_keywords: editor.meta_keywords,
          content_markdown: editor.content_markdown,
        }

        // If markdown changed but HTML was untouched, let the API regenerate HTML from markdown.
        if (!(markdownChanged && !htmlChanged)) {
          patchPayload.content_html = editor.content_html
        }

        const response = await fetch(`/api/admin/blog-posts/${selectedPost.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patchPayload),
        })

        const payload = await response.json()
        if (!response.ok || payload.error) {
          const slugSuggestion =
            typeof payload.slugSuggestion === "string" && payload.slugSuggestion
              ? ` Suggested slug: ${payload.slugSuggestion}`
              : ""
          throw new Error(`${payload.error || "Failed to save blog draft"}${slugSuggestion}`)
        }

        const updatedPost =
          payload.post && typeof payload.post === "object" ? (payload.post as BlogPostRow) : null

        if (updatedPost?.id) {
          setPosts((prev) => prev.map((post) => (post.id === updatedPost.id ? updatedPost : post)))
          setSelectedPostId(updatedPost.id)
          setEditor(createInitialEditorState(updatedPost))
        }

        if (showToast) {
          toast({ title: "Draft saved" })
        }

        return updatedPost
      } catch (error) {
        if (showToast) {
          toast({
            title: "Save failed",
            description: error instanceof Error ? error.message : "Unknown error",
            variant: "destructive",
          })
        }
        throw error
      } finally {
        setSaving(false)
      }
    },
    [editor, selectedPost, toast],
  )

  const handleSave = async () => {
    if (!selectedPost) return

    try {
      await persistDraft({ showToast: true })
    } catch {
      // Toast already shown in persistDraft.
    }
  }

  const runAction = async (action: "approve_publish" | "request_regeneration" | "reject") => {
    if (!selectedPost) return

    setActing(action)
    try {
      if (action === "approve_publish") {
        await persistDraft({ showToast: false })
      }

      const response = await fetch(`/api/admin/blog-posts/${selectedPost.id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          reason,
        }),
      })

      const payload = await response.json()
      if (!response.ok || payload.error) {
        throw new Error(payload.error || `Failed to run ${action}`)
      }

      toast({
        title:
          action === "approve_publish"
            ? "Post published"
            : action === "request_regeneration"
              ? "Regeneration requested"
              : "Draft rejected",
      })
      setReason("")
      await fetchPosts()
    } catch (error) {
      toast({
        title: "Action failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setActing(null)
    }
  }

  const wordCount = estimateWordCount(editor.content_markdown || editor.content_html)

  const handleGeneratorSave = async () => {
    setGeneratorSaving(true)
    try {
      const response = await fetch("/api/admin/blog-generator", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: generator.topic,
          primaryKeyword: generator.primaryKeyword,
          secondaryKeywords: generator.secondaryKeywords,
          longTailQuestions: generator.longTailQuestions,
          customInstructions: generator.customInstructions,
          applyToDaily: generator.applyToDaily,
          mediaPolicy: "tour_hero_ai_infographic",
        }),
      })

      const payload = await response.json()
      if (!response.ok || payload.error) {
        throw new Error(payload.error || "Failed to save generator settings")
      }

      toast({ title: "Generator settings saved" })
      const settings =
        payload.settings && typeof payload.settings === "object" ? (payload.settings as Record<string, unknown>) : null
      setGenerator(mapSettingsToForm(settings))
    } catch (error) {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setGeneratorSaving(false)
    }
  }

  const handleGenerateNow = async () => {
    setGeneratorRunning(true)
    setGeneratorResult(null)
    try {
      const response = await fetch("/api/admin/blog-generator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: generator.topic,
          primaryKeyword: generator.primaryKeyword,
          secondaryKeywords: generator.secondaryKeywords,
          longTailQuestions: generator.longTailQuestions,
          customInstructions: generator.customInstructions,
          applyToDaily: generator.applyToDaily,
          mediaPolicy: "tour_hero_ai_infographic",
          persistSettings: true,
        }),
      })

      const payload = await response.json()
      if (!response.ok || payload.error) {
        const detectedPhrases = Array.isArray(payload?.qualityGate?.detectedPhrases)
          ? payload.qualityGate.detectedPhrases
              .map((entry: unknown) => String(entry ?? "").trim())
              .filter(Boolean)
          : []
        const failedDraft =
          payload?.failedDraft && typeof payload.failedDraft === "object"
            ? (payload.failedDraft as Record<string, unknown>)
            : null
        const details = payload.details || payload.error || "Failed to generate draft"
        setGeneratorResult({
          id: typeof failedDraft?.id === "string" ? failedDraft.id : null,
          slug: typeof failedDraft?.slug === "string" ? failedDraft.slug : "",
          status: typeof failedDraft?.status === "string" ? failedDraft.status : "generation_failed",
          wordCount: Number(failedDraft?.wordCount || 0),
          errorMessage: details,
          detectedPhrases:
            detectedPhrases.length > 0
              ? detectedPhrases
              : Array.isArray(failedDraft?.detectedPhrases)
                ? failedDraft.detectedPhrases.map((entry) => String(entry ?? "").trim()).filter(Boolean)
                : [],
        })
        throw new Error(details)
      }

      const draft = payload.draft || {}
      setGeneratorResult({
        id: typeof draft.id === "string" ? draft.id : null,
        slug: typeof draft.slug === "string" ? draft.slug : "",
        status: typeof draft.status === "string" ? draft.status : "ready_for_approval",
        wordCount: Number(draft.wordCount || 0),
        errorMessage: "",
        detectedPhrases: [],
      })
      toast({ title: "Draft generated", description: "New draft is ready in the approval queue." })
      await fetchPosts()
    } catch (error) {
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setGeneratorRunning(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Blog Approval Queue</h1>
          <p className="text-sm text-muted-foreground">{total} post(s) in the selected status.</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchPosts}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Generator Controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {generatorLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-28 w-full" />
            </div>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Topic</label>
                  <Input
                    value={generator.topic}
                    onChange={(event) => setGenerator((state) => ({ ...state, topic: event.target.value }))}
                    placeholder="Example: how much to tourichoing tour guide paris"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Primary keyword</label>
                  <Input
                    value={generator.primaryKeyword}
                    onChange={(event) => setGenerator((state) => ({ ...state, primaryKeyword: event.target.value }))}
                    placeholder="Primary SEO keyword"
                  />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Secondary keywords (CSV)</label>
                  <Textarea
                    value={generator.secondaryKeywords}
                    onChange={(event) => setGenerator((state) => ({ ...state, secondaryKeywords: event.target.value }))}
                    rows={3}
                    placeholder="keyword 1, keyword 2, keyword 3, keyword 4, keyword 5"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Long-tail questions (one per line)
                  </label>
                  <Textarea
                    value={generator.longTailQuestions}
                    onChange={(event) => setGenerator((state) => ({ ...state, longTailQuestions: event.target.value }))}
                    rows={3}
                    placeholder={"Question 1?\nQuestion 2?\nQuestion 3?"}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Custom instructions</label>
                <Textarea
                  value={generator.customInstructions}
                  onChange={(event) => setGenerator((state) => ({ ...state, customInstructions: event.target.value }))}
                  rows={4}
                  placeholder="Add writing guidance, structure constraints, or internal-link direction."
                />
              </div>

              <div className="flex items-center justify-between gap-3 rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">Apply these settings to daily 08:00 generation</p>
                  <p className="text-xs text-muted-foreground">
                    When enabled, cron uses this keyword pack and instruction block.
                  </p>
                </div>
                <Switch
                  checked={generator.applyToDaily}
                  onCheckedChange={(checked) => setGenerator((state) => ({ ...state, applyToDaily: Boolean(checked) }))}
                />
              </div>

              {generatorResult ? (
                <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">Last manual generation</p>
                  <p>
                    id: <span className="font-mono">{generatorResult.id || "-"}</span> •
                  </p>
                  <p>
                    status: <span className="font-mono">{generatorResult.status}</span> • slug:{" "}
                    <span className="font-mono">/{generatorResult.slug}</span> • words:{" "}
                    <span className="font-mono">{generatorResult.wordCount}</span>
                  </p>
                  {generatorResult.errorMessage ? (
                    <p className="mt-2 text-rose-700">gate error: {generatorResult.errorMessage}</p>
                  ) : null}
                  {Array.isArray(generatorResult.detectedPhrases) && generatorResult.detectedPhrases.length > 0 ? (
                    <p className="mt-1">
                      detected phrases: <span className="font-mono">{generatorResult.detectedPhrases.join(", ")}</span>
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={handleGeneratorSave}
                  disabled={generatorSaving || generatorRunning}
                >
                  {generatorSaving ? "Saving..." : "Save Settings"}
                </Button>
                <Button
                  onClick={handleGenerateNow}
                  disabled={generatorSaving || generatorRunning}
                  className="bg-primary text-primary-foreground"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  {generatorRunning ? "Generating..." : "Generate Draft Now"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_240px]">
            <Input
              placeholder="Search by title or slug"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Drafts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-20 w-full" />
                ))}
              </div>
            ) : posts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No drafts found for this status.</p>
            ) : (
              posts.map((post) => {
                const isSelected = post.id === selectedPostId
                const failureMeta = getBannedPhraseFailureMeta(post)
                return (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => setSelectedPostId(post.id)}
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${
                      isSelected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={getStatusBadgeVariant(post.status)}>{STATUS_LABELS[post.status] || post.status}</Badge>
                        {failureMeta.isBannedPhraseFailure ? (
                          <Badge variant="outline" className="border-amber-300 text-amber-700">
                            Banned phrases
                          </Badge>
                        ) : null}
                      </div>
                      <span className="text-xs text-muted-foreground">{toLocalDate(post.updated_at)}</span>
                    </div>
                    <p className="line-clamp-2 text-sm font-medium">{post.title}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">/{post.slug}</p>
                  </button>
                )
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Review & Edit</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedPost ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                <FileText className="mx-auto mb-2 h-5 w-5" />
                Select a draft to review.
              </div>
            ) : (
              <>
                {selectedFailureMeta.isBannedPhraseFailure ? (
                  <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    <span className="font-medium">Quality gate:</span>{" "}
                    {selectedFailureMeta.note || BANNED_PHRASE_NOTE}
                  </div>
                ) : null}

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Title</label>
                    <Input
                      value={editor.title}
                      onChange={(event) => setEditor((state) => ({ ...state, title: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Slug</label>
                    <Input
                      value={editor.slug}
                      onChange={(event) => setEditor((state) => ({ ...state, slug: event.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Meta description</label>
                  <Textarea
                    value={editor.meta_description}
                    onChange={(event) => setEditor((state) => ({ ...state, meta_description: event.target.value }))}
                    rows={3}
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Hero image URL</label>
                    <Input
                      value={editor.hero_image_url}
                      onChange={(event) => setEditor((state) => ({ ...state, hero_image_url: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Hero image alt</label>
                    <Input
                      value={editor.hero_image_alt}
                      onChange={(event) => setEditor((state) => ({ ...state, hero_image_alt: event.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Infographic image URL</label>
                  <Input
                    value={editor.infographic_image_url}
                    onChange={(event) =>
                      setEditor((state) => ({ ...state, infographic_image_url: event.target.value }))
                    }
                  />
                </div>

                {(editor.hero_image_url || editor.infographic_image_url) && (
                  <div className="grid gap-3 md:grid-cols-2">
                    {editor.hero_image_url ? (
                      <div className="overflow-hidden rounded-lg border">
                        <img
                          src={editor.hero_image_url}
                          alt={editor.hero_image_alt || "Hero preview"}
                          className="h-44 w-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    ) : null}
                    {editor.infographic_image_url ? (
                      <div className="overflow-hidden rounded-lg border">
                        <img
                          src={editor.infographic_image_url}
                          alt="Infographic preview"
                          className="h-44 w-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    ) : null}
                  </div>
                )}

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Keywords (CSV)</label>
                    <Textarea
                      value={editor.keywordsCsv}
                      onChange={(event) => setEditor((state) => ({ ...state, keywordsCsv: event.target.value }))}
                      rows={3}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Meta keywords</label>
                    <Textarea
                      value={editor.meta_keywords}
                      onChange={(event) => setEditor((state) => ({ ...state, meta_keywords: event.target.value }))}
                      rows={3}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-xs font-medium text-muted-foreground">Markdown content</label>
                    <span className="text-xs text-muted-foreground">{wordCount} words</span>
                  </div>
                  <Textarea
                    value={editor.content_markdown}
                    onChange={(event) => setEditor((state) => ({ ...state, content_markdown: event.target.value }))}
                    rows={14}
                    className="font-mono text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">HTML content</label>
                  <Textarea
                    value={editor.content_html}
                    onChange={(event) => setEditor((state) => ({ ...state, content_html: event.target.value }))}
                    rows={10}
                    className="font-mono text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Review note (optional)</label>
                  <Textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={2} />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <p className="text-xs text-muted-foreground">
                    {hasUnsavedChanges
                      ? "Unsaved changes. Approve & Publish will save first, or click Save Draft."
                      : "All changes saved."}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button onClick={handleSave} disabled={saving || acting !== null}>
                      {saving ? "Saving..." : "Save Draft"}
                    </Button>
                    <Button
                      onClick={() => runAction("approve_publish")}
                      disabled={saving || acting !== null}
                      className="bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      {acting === "approve_publish" ? "Publishing..." : "Approve & Publish"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => runAction("request_regeneration")}
                      disabled={saving || acting !== null}
                    >
                      {acting === "request_regeneration" ? "Updating..." : "Request Regeneration"}
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => runAction("reject")}
                      disabled={saving || acting !== null}
                    >
                      {acting === "reject" ? "Rejecting..." : "Reject"}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
