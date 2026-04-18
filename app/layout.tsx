import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter, Playfair_Display } from "next/font/google"
import "./globals.css"
import { ClientLayout } from "./client-layout"
import { BRAND_NAME, BRAND_SITE_URL, toCanonicalUrl, withBrandSuffix } from "@/lib/seo/brand"
import { CONSENT_DENIED_REGIONS } from "@/lib/analytics/consent-regions"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair" })
const SITE_URL = BRAND_SITE_URL
const GOOGLE_SITE_VERIFICATION = process.env.GOOGLE_SITE_VERIFICATION?.trim()
const META_PIXEL_ID = "1573217977123283"
const IS_PRODUCTION = process.env.NODE_ENV === "production"

const organizationJsonLd: Record<string, unknown> = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: BRAND_NAME,
  url: BRAND_SITE_URL,
  description:
    `${BRAND_NAME} is a marketplace connecting travellers with local guides for free walking tours. Book free, tip your guide at the end.`,
  foundingLocation: "Paris, France",
  areaServed: "Paris",
}

export const metadata: Metadata = {
  title: {
    default: withBrandSuffix("Free Walking Tours Worldwide | Book Local Guides"),
    template: `%s | ${BRAND_NAME}`,
  },
  description:
    `Discover the world with passionate local guides. Book free walking tours in 350+ cities worldwide. Experience authentic culture, history, and hidden gems with ${BRAND_NAME}.`,
  keywords: [
    "free walking tours",
    "free walking tours worldwide",
    "tip based walking tours",
    "local guides",
    "book a local guide",
    "city walking tours",
    "guided city tours",
    "cultural walking tours",
    "historical walking tours",
    "sightseeing tours",
    "budget travel tours",
    "walking tours Europe",
    "walking tour app",
    "best walking tours",
    "free tours near me",
  ],
  authors: [{ name: BRAND_NAME }],
  creator: BRAND_NAME,
  publisher: BRAND_NAME,
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: toCanonicalUrl("/"),
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: BRAND_NAME,
    title: withBrandSuffix("Free Walking Tours Worldwide"),
    description:
      "Discover the world with passionate local guides. Book free walking tours in 350+ cities worldwide.",
    images: [
      {
        url: "/adventure-travel-walking.jpg",
        width: 1200,
        height: 630,
        alt: `${BRAND_NAME} - Free Walking Tours`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: withBrandSuffix("Free Walking Tours Worldwide"),
    description:
      "Discover the world with passionate local guides. Book free walking tours in 350+ cities worldwide.",
    images: ["/adventure-travel-walking.jpg"],
    creator: "@tipwalk",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      {
        url: "/favicon.ico",
      },
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-icon.png",
  },
  verification: GOOGLE_SITE_VERIFICATION
    ? {
        google: GOOGLE_SITE_VERIFICATION,
      }
    : undefined,
  category: "travel",
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f4ef" },
    { media: "(prefers-color-scheme: dark)", color: "#3b475a" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const consentDeniedRegionsJson = JSON.stringify(CONSENT_DENIED_REGIONS)

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          id="gtm-consent-default"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('consent', 'default', {
                analytics_storage: 'granted',
                ad_storage: 'granted',
                ad_user_data: 'granted',
                ad_personalization: 'granted',
                wait_for_update: 500
              });
              gtag('consent', 'default', {
                analytics_storage: 'denied',
                ad_storage: 'denied',
                ad_user_data: 'denied',
                ad_personalization: 'denied',
                region: ${consentDeniedRegionsJson},
                wait_for_update: 500
              });
            `,
          }}
        />
        {IS_PRODUCTION ? (
          <script
            id="meta-pixel-bootstrap"
            dangerouslySetInnerHTML={{
              __html: `
                (function (w, d, s, src) {
                  if (w.__tipwalkLoadMetaPixel) return;
                  w.__tipwalkMetaPixelId = '${META_PIXEL_ID}';
                  w.__tipwalkLoadMetaPixel = function () {
                    if (w.__tipwalkMetaPixelLoaded) return;
                    w.__tipwalkMetaPixelLoaded = true;
                    if (w.fbq) return;
                    var n = w.fbq = function () {
                      if (n.callMethod) {
                        n.callMethod.apply(n, arguments);
                      } else {
                        n.queue.push(arguments);
                      }
                    };
                    if (!w._fbq) w._fbq = n;
                    n.push = n;
                    n.loaded = true;
                    n.version = '2.0';
                    n.queue = [];
                    var t = d.createElement(s);
                    t.async = true;
                    t.src = src;
                    var first = d.getElementsByTagName(s)[0];
                    if (first && first.parentNode) {
                      first.parentNode.insertBefore(t, first);
                    } else {
                      d.head.appendChild(t);
                    }
                  };
                })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
              `,
            }}
          />
        ) : null}
        {/* JSON-LD structured data for organization */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationJsonLd),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: BRAND_NAME,
              url: SITE_URL,
              potentialAction: {
                "@type": "SearchAction",
                target: {
                  "@type": "EntryPoint",
                  urlTemplate: `${SITE_URL}/tours?q={search_term_string}`,
                },
                "query-input": "required name=search_term_string",
              },
            }),
          }}
        />
      </head>
      <body
        className={`${inter.className} ${playfair.className} font-sans antialiased`}
      >
        {IS_PRODUCTION ? (
          <noscript>
            <img
              height="1"
              width="1"
              style={{ display: "none" }}
              src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
              alt=""
            />
          </noscript>
        ) : null}
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  )
}
