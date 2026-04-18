import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { withBrandSuffix } from "@/lib/seo/brand"
import { getSiteUrl } from "@/lib/site-url"
import { createServiceRoleClient } from "@/lib/supabase/server"

export const revalidate = 300
export const dynamicParams = true

type PageProps = {
  params: Promise<{ slug: string }>
}

type BlogPostRow = {
  title: string
  slug: string
  meta_description: string | null
  content_html: string | null
  content_markdown: string | null
  hero_image_url: string | null
  hero_image_alt: string | null
  infographic_image_url: string | null
  keywords: string[] | null
  faq_schema: unknown
  language_code: string | null
  published_at: string | null
  updated_at: string | null
}

type FaqItem = {
  question: string
  answer: string
}

type BlogAuthor = {
  name: string
  href: string
  label: string
}

const PRIORITY_POST_AUTHOR_BY_SLUG: Record<string, BlogAuthor> = {
  "how-much-to-tip-tour-guide-paris": {
    name: "Pierre Gendrin",
    href: "/guides/pierre-gendrin",
    label: "Local guide, Montmartre resident for 8 years",
  },
  "best-time-to-visit-montmartre": {
    name: "Pierre Gendrin",
    href: "/guides/pierre-gendrin",
    label: "Local guide, Montmartre resident for 8 years",
  },
}

const BEST_TIME_MONTMARTRE_FALLBACK_FAQ: FaqItem[] = [
  {
    question: "What is the best time of day to visit Montmartre?",
    answer:
      "Early morning before 9am is ideal. The steps of the Sacre-Coeur are peaceful, cafes are just opening, and you can explore the streets without crowds. This is when Montmartre feels most like a genuine Parisian neighbourhood.",
  },
  {
    question: "Is Montmartre crowded in the morning?",
    answer:
      "No. Mornings before 9am are the quietest time in Montmartre. The streets are calm, the Sacre-Coeur steps are almost empty, and you can visit the vineyard and Moulin Rouge exterior without the usual bustle.",
  },
  {
    question: "What is the best day to visit Montmartre?",
    answer:
      "Weekdays are best for a relaxed visit. On weekdays the streets are less crowded, artists at Place du Tertre are more approachable, and you can explore at your own pace. Weekends bring more visitors, especially on Sunday afternoons.",
  },
  {
    question: "What time does Montmartre get crowded?",
    answer:
      "Montmartre gets crowded from around 10am onwards, with peak crowds between noon and 4pm. Cruise ship passengers often arrive mid-morning, and the Place du Tertre and Sacre-Coeur steps can become very busy. Plan to arrive before 9am or after 5pm.",
  },
  {
    question: "Is Montmartre better in the morning or afternoon?",
    answer:
      "Morning is significantly better. Before 9am you get soft light on the Sacre-Coeur, quiet cobblestone streets, and a genuine neighbourhood atmosphere. Afternoons, especially in summer, bring tour groups and souvenir sellers that change the character of the area.",
  },
]

async function getBlogPostBySlug(slug: string): Promise<BlogPostRow | null> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from("blog_posts")
    .select(
      "title, slug, meta_description, content_html, content_markdown, hero_image_url, hero_image_alt, infographic_image_url, keywords, faq_schema, language_code, published_at, updated_at",
    )
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle()

  if (error && error.code !== "PGRST116") {
    throw new Error(`Failed to load blog post: ${error.message}`)
  }

  return (data as BlogPostRow | null) ?? null
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}

function buildDescription(post: BlogPostRow): string {
  const fromMeta = (post.meta_description || "").trim()
  if (fromMeta) return fromMeta

  const fromHtml = stripHtml(post.content_html || "")
  if (fromHtml) return fromHtml.slice(0, 160)

  const fromMarkdown = stripMarkdown(post.content_markdown || "")
  if (fromMarkdown) return fromMarkdown.slice(0, 160)

  return "TipWalk blog article."
}

function sanitizeHtml(input: string): string {
  return input
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, "")
}

function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/[#>*_~|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function convertInlineMarkdown(text: string): string {
  const escaped = escapeHtml(text)
  return escaped
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]*)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
}

function markdownToHtml(markdown: string): string {
  const lines = markdown.split(/\r?\n/).map((line) => line.trim())
  const parts: string[] = []
  let inUnorderedList = false
  let inOrderedList = false

  const closeLists = () => {
    if (inUnorderedList) {
      parts.push("</ul>")
      inUnorderedList = false
    }
    if (inOrderedList) {
      parts.push("</ol>")
      inOrderedList = false
    }
  }

  for (const line of lines) {
    if (!line) {
      closeLists()
      continue
    }

    if (/^#{1,3}\s+/.test(line)) {
      closeLists()
      const level = Math.min(3, Math.max(1, line.match(/^#+/)?.[0].length || 1))
      const text = line.replace(/^#{1,3}\s+/, "")
      parts.push(`<h${level}>${convertInlineMarkdown(text)}</h${level}>`)
      continue
    }

    if (/^- /.test(line)) {
      if (inOrderedList) {
        parts.push("</ol>")
        inOrderedList = false
      }
      if (!inUnorderedList) {
        parts.push("<ul>")
        inUnorderedList = true
      }
      parts.push(`<li>${convertInlineMarkdown(line.replace(/^- /, ""))}</li>`)
      continue
    }

    if (/^\d+\.\s+/.test(line)) {
      if (inUnorderedList) {
        parts.push("</ul>")
        inUnorderedList = false
      }
      if (!inOrderedList) {
        parts.push("<ol>")
        inOrderedList = true
      }
      parts.push(`<li>${convertInlineMarkdown(line.replace(/^\d+\.\s+/, ""))}</li>`)
      continue
    }

    closeLists()
    parts.push(`<p>${convertInlineMarkdown(line)}</p>`)
  }

  closeLists()
  return parts.join("\n")
}

function resolvePostBodyHtml(post: BlogPostRow): string {
  const html = (post.content_html || "").trim()
  if (html) return sanitizeHtml(html)

  const markdown = (post.content_markdown || "").trim()
  if (!markdown) return ""
  return sanitizeHtml(markdownToHtml(markdown))
}

function normalizeFaqSchema(value: unknown): FaqItem[] {
  if (!Array.isArray(value)) return []
  const output: FaqItem[] = []

  for (const item of value as Array<Record<string, unknown>>) {
    const question = typeof item?.question === "string" ? item.question.trim() : ""
    const answer = typeof item?.answer === "string" ? item.answer.trim() : ""
    if (!question || !answer) continue
    output.push({ question, answer })
  }

  return output
}

function resolveFaqItems(post: BlogPostRow): FaqItem[] {
  const dynamicFaqItems = normalizeFaqSchema(post.faq_schema)
  if (dynamicFaqItems.length > 0) return dynamicFaqItems
  if (post.slug === "best-time-to-visit-montmartre") return BEST_TIME_MONTMARTRE_FALLBACK_FAQ
  return []
}

function normalizeSeoTitle(value: string): string {
  const trimmed = String(value || "").trim()
  if (!trimmed) return "TipWalk Article"
  return trimmed.replace(/(\s*\|\s*TipWalk)+\s*$/i, "").trim() || trimmed
}

function resolvePriorityAuthor(slug: string): BlogAuthor | null {
  return PRIORITY_POST_AUTHOR_BY_SLUG[slug] || null
}

function formatPublishedDate(input: string | null): string | null {
  if (!input) return null
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const post = await getBlogPostBySlug(slug)

  if (!post) {
    return {
      title: { absolute: "Article Not Found | TipWalk" },
      robots: { index: false, follow: false },
    }
  }

  const siteUrl = getSiteUrl()
  const canonicalUrl = `${siteUrl}/blog/${post.slug}`
  const description = buildDescription(post)
  const normalizedTitle = normalizeSeoTitle(post.title)
  const validInfographic = post.infographic_image_url?.startsWith("https://") ? post.infographic_image_url : null
  const ogImage = post.hero_image_url || validInfographic || undefined

  return {
    title: { absolute: withBrandSuffix(normalizedTitle) },
    description,
    alternates: { canonical: canonicalUrl },
    keywords: post.keywords || undefined,
    robots: { index: true, follow: true },
    openGraph: {
      title: withBrandSuffix(normalizedTitle),
      description,
      type: "article",
      url: canonicalUrl,
      locale: post.language_code || "en",
      images: ogImage ? [{ url: ogImage, alt: post.hero_image_alt || normalizedTitle }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: withBrandSuffix(normalizedTitle),
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  }
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params
  const post = await getBlogPostBySlug(slug)
  if (!post) notFound()

  const siteUrl = getSiteUrl()
  const canonicalUrl = `${siteUrl}/blog/${post.slug}`
  const normalizedTitle = normalizeSeoTitle(post.title)
  const publishedDate = formatPublishedDate(post.published_at || post.updated_at)
  const faqItems = resolveFaqItems(post)
  const priorityAuthor = resolvePriorityAuthor(post.slug)
  const hasValidInfographic = post.infographic_image_url?.startsWith("https://")
  const infographicUrl = hasValidInfographic ? post.infographic_image_url : null
  const postBodyHtml = resolvePostBodyHtml(post)

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: normalizedTitle,
    datePublished: post.published_at || undefined,
    dateModified: post.updated_at || undefined,
    inLanguage: post.language_code || "en",
    mainEntityOfPage: canonicalUrl,
    image: [post.hero_image_url, infographicUrl].filter(Boolean),
    author: priorityAuthor
      ? {
          "@type": "Person",
          name: priorityAuthor.name,
          url: `${siteUrl}${priorityAuthor.href}`,
        }
      : undefined,
    publisher: {
      "@type": "Organization",
      name: "TipWalk",
      url: siteUrl,
    },
  }

  const faqJsonLd = faqItems.length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqItems.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: { "@type": "Answer", text: faq.answer },
        })),
      }
    : null

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      {faqJsonLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} /> : null}

      <article className="space-y-8">
        <header className="space-y-4">
          <h1 className="text-balance text-3xl font-semibold leading-tight text-[color:var(--landing-ink)] sm:text-4xl">
            {normalizedTitle}
          </h1>
          {publishedDate ? (
            <p className="text-sm text-[color:var(--landing-ink-muted)]">Published on {publishedDate}</p>
          ) : null}
          {priorityAuthor ? (
            <p className="text-sm text-[color:var(--landing-ink-muted)]">
              By{" "}
              <Link href={priorityAuthor.href} className="font-medium text-[color:var(--landing-primary)] underline">
                {priorityAuthor.name}
              </Link>{" "}
              — {priorityAuthor.label}
            </p>
          ) : null}
        </header>

        {post.hero_image_url ? (
          <img
            src={post.hero_image_url}
            alt={post.hero_image_alt || normalizedTitle}
            className="h-auto w-full rounded-2xl border border-[color:var(--landing-border)] object-cover"
            loading="eager"
          />
        ) : null}

        <div
          className="space-y-4 text-base leading-7 text-[color:var(--landing-ink)] [&_a]:text-[color:var(--landing-primary)] [&_a]:underline [&_h2]:mt-8 [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:mt-6 [&_h3]:text-xl [&_h3]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:my-4"
          dangerouslySetInnerHTML={{ __html: postBodyHtml }}
        />

        {hasValidInfographic ? (
          <img
            src={infographicUrl || ""}
            alt="Infographic"
            className="h-auto w-full rounded-2xl border border-[color:var(--landing-border)] object-cover"
            loading="lazy"
          />
        ) : null}
      </article>
    </main>
  )
}
