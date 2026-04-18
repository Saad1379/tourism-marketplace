import { Button } from "@/components/ui/button"
import { AlertCircle, Home, Search } from "lucide-react"
import Link from "next/link"

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/10 px-4">
      <div className="max-w-md w-full text-center">
        <div className="flex justify-center mb-6">
          <div className="rounded-full bg-secondary/15 p-4">
            <AlertCircle className="h-8 w-8 text-secondary" />
          </div>
        </div>

        <h1 className="text-5xl font-bold text-foreground mb-2">404</h1>
        <h2 className="text-2xl font-semibold text-foreground/90 mb-4">Page Not Found</h2>

        <p className="text-muted-foreground mb-8">
          The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
        </p>

        <div className="flex flex-col gap-3">
          <Button asChild className="gap-2">
            <Link href="/">
              <Home className="h-4 w-4" />
              Go Home
            </Link>
          </Button>
          <Button variant="outline" asChild className="gap-2 bg-background">
            <Link href="/tours">
              <Search className="h-4 w-4" />
              Browse Tours
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
