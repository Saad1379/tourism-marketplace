import type { Metadata } from "next"
import TourQrReviewClient from "./tour-qr-review-client"

type PageProps = {
  params: Promise<{ token: string }>
}

export const metadata: Metadata = {
  title: "Leave a Tour Review | Touricho",
  description: "Share your experience with your local guide on Touricho.",
  robots: { index: false, follow: false },
}

export default async function TourQrReviewPage({ params }: PageProps) {
  const { token } = await params
  return <TourQrReviewClient token={token} />
}
