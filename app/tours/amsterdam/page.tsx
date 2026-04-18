import { NoindexCityPage, buildNoindexCityMetadata } from "../_components/noindex-city-page"

export const metadata = buildNoindexCityMetadata("Amsterdam", "amsterdam")

export default function AmsterdamToursPage() {
  return <NoindexCityPage city="Amsterdam" />
}
