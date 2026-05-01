import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Footer } from "@/components/footer"
import { Navbar } from "@/components/navbar"
import { STATIC_BLOG_POSTS } from "@/lib/blog/static-posts"
import { createServiceRoleClient } from "@/lib/supabase/server"

type BlogCardItem = {
  title: string
  slug: string
  excerpt: string
  publishedAt: string
  readTimeMinutes: number
}

type DbBlogPostRow = {
  title: string
  slug: string
  meta_description: string | null
  content_html: string
  published_at: string | null
  updated_at: string | null
}

const BLOG_CANONICAL_URL = "https://www.touricho.com/blog"

export const metadata: Metadata = {
  title: "Paris Travel Guide & Walking Tour Tips | Touricho Blog",
  description: "Tips for visiting Paris, walking tour guides, and local insights from Touricho.",
  alternates: { canonical: BLOG_CANONICAL_URL },
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}

function truncateWordSafe(value: string, maxLength: number): string {
  const text = value.trim()
  if (text.length <= maxLength) return text
  const preview = text.slice(0, maxLength + 1)
  const cut = preview.lastIndexOf(" ")
  if (cut > Math.floor(maxLength * 0.6)) {
    return `${preview.slice(0, cut).trim()}...`
  }
  return `${text.slice(0, maxLength).trim()}...`
}

function estimateReadTimeMinutes(content: string): number {
  const words = content.split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Recently"
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

function toTimestamp(value: string): number {
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
}

function mapStaticPosts(): BlogCardItem[] {
  return STATIC_BLOG_POSTS.map((post) => {
    const plainText = [
      ...post.paragraphs,
      ...post.sections.flatMap((section) => [section.heading, ...section.paragraphs]),
      post.cta,
    ].join(" ")

    return {
      title: post.title,
      slug: post.slug,
      excerpt: truncateWordSafe(post.metaDescription, 180),
      publishedAt: post.datePublished,
      readTimeMinutes: estimateReadTimeMinutes(plainText),
    }
  })
}

async function getPublishedDbPosts(): Promise<BlogCardItem[]> {
  try {
    const supabase = createServiceRoleClient()
    const { data, error } = await supabase
      .from("blog_posts")
      .select("title, slug, meta_description, content_html, published_at, updated_at")
      .eq("status", "published")

    if (error) {
      console.error("[blog-index] Failed to load blog posts:", error)
      return []
    }

    const rows = (Array.isArray(data) ? data : []) as DbBlogPostRow[]
    return rows
      .filter((row) => typeof row.slug === "string" && row.slug.trim().length > 0)
      .map((row) => {
        const cleanContent = stripHtml(row.content_html || "")
        const excerpt = (row.meta_description || "").trim() || truncateWordSafe(cleanContent, 180)
        const publishedAt = row.published_at || row.updated_at || new Date().toISOString()

        return {
          title: row.title,
          slug: row.slug,
          excerpt,
          publishedAt,
          readTimeMinutes: estimateReadTimeMinutes(cleanContent),
        }
      })
  } catch (error) {
    console.error("[blog-index] Unexpected blog load failure:", error)
    return []
  }
}

export default async function BlogIndexPage() {
  const [dbPosts, staticPosts] = await Promise.all([getPublishedDbPosts(), Promise.resolve(mapStaticPosts())])

  const bySlug = new Map<string, BlogCardItem>()
  for (const post of dbPosts) {
    bySlug.set(post.slug, post)
  }
  for (const post of staticPosts) {
    if (!bySlug.has(post.slug)) {
      bySlug.set(post.slug, post)
    }
  }

  const posts = Array.from(bySlug.values()).sort((a, b) => toTimestamp(b.publishedAt) - toTimestamp(a.publishedAt))

  return (
    <div className="public-template-page landing-template">
      <Navbar variant="landingTemplate" />
      <main className="public-template-main flex-1">
        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <header className="mb-10 max-w-3xl space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight text-[color:var(--landing-ink)] sm:text-4xl">
              Touricho Blog
            </h1>
            <p className="text-base text-[color:var(--landing-muted)] sm:text-lg">
              Tips for visiting Paris, walking tour guides, and local insights from Touricho.
            </p>
          </header>

          {posts.length > 0 ? (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <article
                  key={post.slug}
                  className="flex h-full flex-col rounded-2xl border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)] p-6 shadow-[var(--landing-shadow-sm)]"
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--landing-muted)]">
                    {formatDate(post.publishedAt)} · {post.readTimeMinutes} min read
                  </p>
                  <h2 className="mt-3 text-xl font-semibold leading-tight text-[color:var(--landing-ink)]">
                    <Link href={`/blog/${post.slug}`} className="transition-colors hover:text-[color:var(--landing-accent)]">
                      {post.title}
                    </Link>
                  </h2>
                  <p className="mt-3 flex-1 text-sm leading-6 text-[color:var(--landing-muted)]">{post.excerpt}</p>
                  <Link
                    href={`/blog/${post.slug}`}
                    className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-[color:var(--landing-accent)] hover:underline"
                  >
                    Read article <ArrowRight className="h-4 w-4" />
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)] p-6">
              <p className="text-sm text-[color:var(--landing-muted)]">No posts published yet.</p>
            </div>
          )}
        </section>
      </main>
      <Footer variant="landingTemplate" />
    </div>
  )
}
