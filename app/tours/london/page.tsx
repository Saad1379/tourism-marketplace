import { NoindexCityPage, buildNoindexCityMetadata } from "../_components/noindex-city-page"

export const metadata = buildNoindexCityMetadata("London", "london")

export default function LondonToursPage() {
  return <NoindexCityPage city="London" />
}
