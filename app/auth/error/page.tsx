import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { TourichoLogo } from "@/components/brand/touricho-logo"

export const metadata = {
  title: "Authentication Error | Touricho",
  description: "An error occurred during authentication.",
}

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; error_description?: string }>
}) {
  const params = await searchParams
  const errorMessage = params.error_description || params.error || "An unexpected error occurred"

  return (
    <div className="flex min-h-screen items-center justify-center bg-[color:var(--landing-bg-soft)] px-5 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 flex justify-center" aria-label="Touricho home">
          <TourichoLogo size="lg" />
        </Link>

        <Card className="border-border bg-background shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
          <CardContent className="p-7 sm:p-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="h-8 w-8" strokeWidth={2} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Authentication Error
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Something went wrong during authentication
            </p>

            <div className="mt-6 rounded-xl border border-destructive/20 bg-destructive/5 p-3.5 text-left">
              <p className="text-xs text-destructive leading-relaxed">{errorMessage}</p>
            </div>

            <div className="mt-5 flex flex-col gap-2">
              <Button
                asChild
                className="w-full rounded-full font-semibold shadow-[0_5px_16px_rgba(229,141,77,0.28)]"
              >
                <Link href="/login">Try Again</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="w-full rounded-full bg-background border-border text-foreground font-semibold"
              >
                <Link href="/">Go to Homepage</Link>
              </Button>
            </div>

            <p className="mt-4 text-xs text-muted-foreground">
              Need help?{" "}
              <Link href="/contact" className="font-semibold text-primary hover:underline">
                Contact Support
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
