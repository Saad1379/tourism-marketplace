import { LoadingSpinner } from "@/components/loading-spinner"

export default function Loading() {
  return (
    <div className="h-svh overflow-hidden bg-background px-4 py-10 sm:px-6 lg:px-10 xl:px-16">
      <div className="mx-auto w-full max-w-sm space-y-6">
        <LoadingSpinner label="Loading sign in..." />
        <div className="h-10 w-36 animate-pulse rounded bg-muted" />
        <div className="space-y-4 rounded-xl border border-border p-5">
          <div className="h-7 w-40 animate-pulse rounded bg-muted" />
          <div className="h-10 w-full animate-pulse rounded bg-muted" />
          <div className="h-10 w-full animate-pulse rounded bg-muted" />
          <div className="h-10 w-full animate-pulse rounded bg-muted" />
        </div>
      </div>
    </div>
  )
}
