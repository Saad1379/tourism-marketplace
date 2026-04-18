import { NoindexCityPage, buildNoindexCityMetadata } from "../_components/noindex-city-page"

export const metadata = buildNoindexCityMetadata("Prague", "prague")

export default function PragueToursPage() {
  return <NoindexCityPage city="Prague" />
}
