import { NoindexCityPage, buildNoindexCityMetadata } from "../_components/noindex-city-page"

export const metadata = buildNoindexCityMetadata("Rome", "rome")

export default function RomeToursPage() {
  return <NoindexCityPage city="Rome" />
}
