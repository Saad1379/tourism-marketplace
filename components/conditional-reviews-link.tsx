"use client"

import Link from "next/link"
import { useReviewLinkVisibility } from "@/hooks/use-review-link-visibility"

interface ConditionalReviewsLinkProps {
  className: string
}

export function ConditionalReviewsLink({ className }: ConditionalReviewsLinkProps) {
  const showReviewLinks = useReviewLinkVisibility()

  if (!showReviewLinks) return null

  return (
    <li>
      <Link href="/reviews" className={className}>
        Reviews
      </Link>
    </li>
  )
}
