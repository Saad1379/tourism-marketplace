import fs from "node:fs"
import path from "node:path"

function readFile(relativePath) {
  const filePath = path.join(process.cwd(), relativePath)
  return fs.readFileSync(filePath, "utf8")
}

function requireSnippet(source, snippet, label) {
  if (!source.includes(snippet)) {
    throw new Error(`Ranking guard failed: missing ${label}\nExpected snippet: ${snippet}`)
  }
}

try {
  const queriesSource = readFile("lib/supabase/queries.ts")
  const rankingSqlSource = readFile("migrations/026_fix_ranked_tours_duplicates.sql")

  requireSnippet(
    queriesSource,
    "const proTarget = Math.round(pageLimit * 0.58)",
    "frontend pool target (pro 58%)",
  )
  requireSnippet(
    queriesSource,
    "const freeTarget = Math.round(pageLimit * 0.27)",
    "frontend pool target (free 27%)",
  )
  requireSnippet(
    queriesSource,
    "const newTarget = pageLimit - proTarget - freeTarget",
    "frontend pool target (newcomer 15%)",
  )
  requireSnippet(
    queriesSource,
    "if (guideCount < 2 && !insertedTours.has(item.tour_id))",
    "anti-monopoly cap (max 2 tours per guide)",
  )

  requireSnippet(rankingSqlSource, "weight_relevance numeric := 0.45;", "DB relevance weight (45%)")
  requireSnippet(rankingSqlSource, "weight_rating numeric := 0.30;", "DB rating weight (30%)")
  requireSnippet(rankingSqlSource, "weight_reviews numeric := 0.10;", "DB reviews weight (10%)")
  requireSnippet(rankingSqlSource, "weight_reliability numeric := 0.10;", "DB reliability weight (10%)")
  requireSnippet(rankingSqlSource, "weight_freshness numeric := 0.05;", "DB freshness weight (5%)")

  requireSnippet(rankingSqlSource, "* st.availability_mult", "availability multiplier")
  requireSnippet(rankingSqlSource, "* st.plan_mult", "pro plan multiplier")
  requireSnippet(rankingSqlSource, "* st.boost_mult", "paid boost multiplier")
  requireSnippet(rankingSqlSource, "* st.newcomer_mult", "newcomer lift multiplier")
  requireSnippet(rankingSqlSource, "* st.free_protection_mult", "free-plan protection multiplier")

  console.log("Ranking guard passed. Marketplace ranking constants and pool mix remain locked.")
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
