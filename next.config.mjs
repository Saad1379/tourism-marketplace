import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DEFAULT_SUPABASE_HOST = "zloanpafmahxchqooqrg.supabase.co"

function getSupabaseHost() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) return DEFAULT_SUPABASE_HOST

  try {
    return new URL(url).hostname
  } catch {
    return DEFAULT_SUPABASE_HOST
  }
}

const supabaseHost = getSupabaseHost()

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  async redirects() {
    return [
      {
        source: "/blog/free-walking-tour-montmartre-paris",
        destination: "/blog/free-walking-tour-montmartre-paris-13",
        permanent: true,
      },
    ]
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: supabaseHost,
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
    ],
    deviceSizes: [360, 414, 640, 750, 828, 1080, 1200, 1600, 1920],
    imageSizes: [32, 48, 64, 96, 128, 256, 384, 512, 768],
  },
  turbopack: {
    root: __dirname,
  },
}

export default nextConfig
