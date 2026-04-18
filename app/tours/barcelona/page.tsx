import { NoindexCityPage, buildNoindexCityMetadata } from "../_components/noindex-city-page"

export const metadata = buildNoindexCityMetadata("Barcelona", "barcelona")

export default function BarcelonaToursPage() {
  return <NoindexCityPage city="Barcelona" />
}
