#!/usr/bin/env node

import { createSign } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

const DEFAULT_SITE_URL = "sc-domain:tipwalk.com"
const DEFAULT_REPORT_DIR = "docs/reports"
const PRIMARY_WINDOW_DAYS = 90
const RECENT_WINDOW_DAYS = 28

function base64url(value) {
  const source = Buffer.isBuffer(value) ? value : Buffer.from(typeof value === "string" ? value : JSON.stringify(value))
  return source
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
}

function toIsoDate(value) {
  return value.toISOString().slice(0, 10)
}

function formatPct(value) {
  return `${(Number(value || 0) * 100).toFixed(2)}%`
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(Number(value || 0))
}

function parseDateStrict(value) {
  if (!value) return null
  const parsed = new Date(`${value}T00:00:00Z`)
  if (!Number.isFinite(parsed.getTime())) return null
  return parsed
}

function daysBetween(start, end) {
  return Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
}

async function getAccessToken(serviceAccount) {
  const now = Math.floor(Date.now() / 1000)
  const claims = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/webmasters.readonly",
    aud: serviceAccount.token_uri || "https://oauth2.googleapis.com/token",
    iat: now - 60,
    exp: now + 3600,
  }

  const unsigned = `${base64url({ alg: "RS256", typ: "JWT" })}.${base64url(claims)}`
  const signer = createSign("RSA-SHA256")
  signer.update(unsigned)
  signer.end()
  const signature = signer.sign(serviceAccount.private_key)
  const assertion = `${unsigned}.${base64url(signature)}`

  const response = await fetch(serviceAccount.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  })

  if (!response.ok) {
    throw new Error(`Failed to exchange token (${response.status}): ${await response.text()}`)
  }

  const payload = await response.json()
  return payload.access_token
}

async function querySearchConsole({ token, siteUrl, startDate, endDate, dimensions, filters = [], rowLimit = 25000 }) {
  const endpoint = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`
  const body = {
    startDate,
    endDate,
    dimensions,
    rowLimit,
    dataState: "final",
  }

  if (filters.length > 0) {
    body.dimensionFilterGroups = [{ filters }]
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(`Search Analytics query failed (${response.status}): ${await response.text()}`)
  }

  const payload = await response.json()
  return payload.rows || []
}

function summarizeRows(rows) {
  return rows.reduce(
    (acc, row) => {
      acc.clicks += Number(row.clicks || 0)
      acc.impressions += Number(row.impressions || 0)
      return acc
    },
    { clicks: 0, impressions: 0 },
  )
}

function topRows(rows, limit = 15) {
  return rows
    .slice()
    .sort((a, b) => Number(b.impressions || 0) - Number(a.impressions || 0))
    .slice(0, limit)
}

function buildMarkdownReport({ siteUrl, windows, summary, datasets, shouldFailOnZeroRows }) {
  const topPagesAll = topRows(datasets.pages_90_all, 10)
  const topQueriesAll = topRows(datasets.queries_90_all, 10)
  const topPagesTours = topRows(datasets.pages_90_tours, 10)
  const topQueriesTours = topRows(datasets.queries_90_tours, 10)

  const primaryToursTotals = summarizeRows(datasets.pages_90_tours)
  const recentToursTotals = summarizeRows(datasets.pages_28_tours)

  const lines = []
  lines.push("# GSC Weekly Tours Report")
  lines.push(`Generated: ${new Date().toISOString()}`)
  lines.push(`Property: \`${siteUrl}\``)
  lines.push("")
  lines.push("## Windows")
  lines.push(`- Primary (90d): ${windows.d90.startDate} -> ${windows.d90.endDate}`)
  lines.push(`- Recent (28d): ${windows.d28.startDate} -> ${windows.d28.endDate}`)
  lines.push("")
  lines.push("## Tours Health")
  lines.push(`- tours pages rows (90d): **${summary.pages_90_tours}**`)
  lines.push(`- tours queries rows (90d): **${summary.queries_90_tours}**`)
  lines.push(`- tours pages rows (28d): **${summary.pages_28_tours}**`)
  lines.push(`- tours queries rows (28d): **${summary.queries_28_tours}**`)
  lines.push(`- tours clicks/impressions (90d): **${formatNumber(primaryToursTotals.clicks)} / ${formatNumber(primaryToursTotals.impressions)}**`)
  lines.push(`- tours clicks/impressions (28d): **${formatNumber(recentToursTotals.clicks)} / ${formatNumber(recentToursTotals.impressions)}**`)
  lines.push("")

  if (topPagesTours.length === 0) {
    lines.push("## Tours Top Pages (90d)")
    lines.push("- No rows returned for `/tours/*`.")
  } else {
    lines.push("## Tours Top Pages (90d)")
    lines.push("| Page | Clicks | Impressions | CTR | Position |")
    lines.push("| --- | ---: | ---: | ---: | ---: |")
    for (const row of topPagesTours) {
      lines.push(`| ${row.keys?.[0] || "-"} | ${formatNumber(row.clicks)} | ${formatNumber(row.impressions)} | ${formatPct(row.ctr)} | ${Number(row.position || 0).toFixed(2)} |`)
    }
  }
  lines.push("")

  if (topQueriesTours.length === 0) {
    lines.push("## Tours Top Queries (90d)")
    lines.push("- No rows returned for `/tours/*`.")
  } else {
    lines.push("## Tours Top Queries (90d)")
    lines.push("| Query | Clicks | Impressions | CTR | Position |")
    lines.push("| --- | ---: | ---: | ---: | ---: |")
    for (const row of topQueriesTours) {
      lines.push(`| ${row.keys?.[0] || "-"} | ${formatNumber(row.clicks)} | ${formatNumber(row.impressions)} | ${formatPct(row.ctr)} | ${Number(row.position || 0).toFixed(2)} |`)
    }
  }
  lines.push("")

  lines.push("## Control (All Pages)")
  lines.push("### Top Pages (90d)")
  if (topPagesAll.length === 0) {
    lines.push("- No rows returned.")
  } else {
    for (const row of topPagesAll) {
      lines.push(`- ${row.keys?.[0] || "-"} -> ${formatNumber(row.clicks)} clicks, ${formatNumber(row.impressions)} impressions, CTR ${formatPct(row.ctr)}, pos ${Number(row.position || 0).toFixed(2)}`)
    }
  }
  lines.push("")
  lines.push("### Top Queries (90d)")
  if (topQueriesAll.length === 0) {
    lines.push("- No rows returned.")
  } else {
    for (const row of topQueriesAll) {
      lines.push(`- ${row.keys?.[0] || "-"} -> ${formatNumber(row.clicks)} clicks, ${formatNumber(row.impressions)} impressions, CTR ${formatPct(row.ctr)}, pos ${Number(row.position || 0).toFixed(2)}`)
    }
  }
  lines.push("")
  lines.push("## Alert Status")
  if (shouldFailOnZeroRows && summary.pages_90_tours === 0 && summary.queries_90_tours === 0) {
    lines.push("- **FAIL**: tours rows are still zero after the configured grace window.")
  } else {
    lines.push("- PASS")
  }

  return lines.join("\n")
}

async function main() {
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (!keyPath) {
    throw new Error("Missing GOOGLE_APPLICATION_CREDENTIALS")
  }

  const siteUrl = process.env.GSC_SITE_URL || DEFAULT_SITE_URL
  const reportDir = process.env.GSC_REPORT_DIR || DEFAULT_REPORT_DIR
  const graceDays = Number(process.env.GSC_ZERO_ROWS_GRACE_DAYS || 21)
  const indexationStart = parseDateStrict(process.env.GSC_INDEXATION_START_DATE || "")
  const now = new Date()

  const shouldFailOnZeroRows = Boolean(
    indexationStart && daysBetween(indexationStart, now) >= Math.max(graceDays, 1),
  )

  const serviceAccount = JSON.parse(await readFile(keyPath, "utf8"))
  const token = await getAccessToken(serviceAccount)

  const end = new Date()
  end.setUTCDate(end.getUTCDate() - 1)

  const d90Start = new Date(end)
  d90Start.setUTCDate(d90Start.getUTCDate() - (PRIMARY_WINDOW_DAYS - 1))

  const d28Start = new Date(end)
  d28Start.setUTCDate(d28Start.getUTCDate() - (RECENT_WINDOW_DAYS - 1))

  const windows = {
    d90: { startDate: toIsoDate(d90Start), endDate: toIsoDate(end) },
    d28: { startDate: toIsoDate(d28Start), endDate: toIsoDate(end) },
  }

  const toursFilter = [{ dimension: "page", operator: "contains", expression: "/tours/" }]
  const parisFilter = [{ dimension: "page", operator: "contains", expression: "/tours/paris" }]

  const datasets = {}
  datasets.pages_90_all = await querySearchConsole({ token, siteUrl, ...windows.d90, dimensions: ["page"] })
  datasets.queries_90_all = await querySearchConsole({ token, siteUrl, ...windows.d90, dimensions: ["query"] })

  datasets.pages_90_tours = await querySearchConsole({ token, siteUrl, ...windows.d90, dimensions: ["page"], filters: toursFilter })
  datasets.pages_28_tours = await querySearchConsole({ token, siteUrl, ...windows.d28, dimensions: ["page"], filters: toursFilter })
  datasets.queries_90_tours = await querySearchConsole({ token, siteUrl, ...windows.d90, dimensions: ["query"], filters: toursFilter })
  datasets.queries_28_tours = await querySearchConsole({ token, siteUrl, ...windows.d28, dimensions: ["query"], filters: toursFilter })
  datasets.pairs_90_tours = await querySearchConsole({ token, siteUrl, ...windows.d90, dimensions: ["query", "page"], filters: toursFilter })
  datasets.device_90_tours = await querySearchConsole({ token, siteUrl, ...windows.d90, dimensions: ["device"], filters: toursFilter })
  datasets.country_90_tours = await querySearchConsole({ token, siteUrl, ...windows.d90, dimensions: ["country"], filters: toursFilter })

  datasets.pages_90_paris = await querySearchConsole({ token, siteUrl, ...windows.d90, dimensions: ["page"], filters: parisFilter })
  datasets.queries_90_paris = await querySearchConsole({ token, siteUrl, ...windows.d90, dimensions: ["query"], filters: parisFilter })
  datasets.pairs_90_paris = await querySearchConsole({ token, siteUrl, ...windows.d90, dimensions: ["query", "page"], filters: parisFilter })
  datasets.device_90_paris = await querySearchConsole({ token, siteUrl, ...windows.d90, dimensions: ["device"], filters: parisFilter })
  datasets.country_90_paris = await querySearchConsole({ token, siteUrl, ...windows.d90, dimensions: ["country"], filters: parisFilter })

  const summary = Object.fromEntries(Object.entries(datasets).map(([key, rows]) => [key, rows.length]))

  const payload = {
    generatedAt: new Date().toISOString(),
    siteUrl,
    windows,
    summary,
    alertConfig: {
      indexationStartDate: process.env.GSC_INDEXATION_START_DATE || null,
      zeroRowsGraceDays: graceDays,
      shouldFailOnZeroRows,
    },
    datasets,
  }

  const dayStamp = toIsoDate(new Date())
  const jsonPath = path.join(reportDir, `gsc-tours-report-${dayStamp}.json`)
  const mdPath = path.join(reportDir, `gsc-tours-report-${dayStamp}.md`)

  await mkdir(reportDir, { recursive: true })
  await writeFile(jsonPath, JSON.stringify(payload, null, 2))
  await writeFile(
    mdPath,
    buildMarkdownReport({
      siteUrl,
      windows,
      summary,
      datasets,
      shouldFailOnZeroRows,
    }),
  )

  console.log(
    JSON.stringify(
      {
        ok: true,
        siteUrl,
        summary,
        output: { jsonPath, mdPath },
      },
      null,
      2,
    ),
  )

  if (shouldFailOnZeroRows && summary.pages_90_tours === 0 && summary.queries_90_tours === 0) {
    process.exitCode = 2
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
