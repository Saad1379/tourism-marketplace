import Link from "next/link"
import { Mail, CheckCircle2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { TourichoLogo } from "@/components/brand/touricho-logo"

export const metadata = {
  title: "Check Your Email | Touricho",
  description: "Please check your email to confirm your account.",
}

export default function SignUpSuccessPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[color:var(--landing-bg-soft)] px-5 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 flex justify-center" aria-label="Touricho home">
          <TourichoLogo size="lg" />
        </Link>

        <Card className="border-border bg-background shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
          <CardContent className="p-7 sm:p-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="h-8 w-8" strokeWidth={2.5} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Check your email</h1>
            <p className="mt-1 text-sm text-muted-foreground">We've sent you a confirmation link</p>

            <div className="mt-6 flex items-start gap-3 rounded-xl bg-[color:var(--landing-bg-soft)] p-4 text-left">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Confirm your email address
                </p>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  Click the link in the email we just sent you to verify your account and get started.
                </p>
              </div>
            </div>

            <p className="mt-5 text-xs text-muted-foreground">
              Didn't receive the email? Check your spam folder.
            </p>

            <div className="mt-4 flex flex-col gap-2">
              <Button
                asChild
                variant="outline"
                className="w-full rounded-full bg-background border-border text-foreground font-semibold"
              >
                <Link href="/login">Back to Sign In</Link>
              </Button>
              <Button asChild variant="ghost" className="w-full text-muted-foreground hover:text-foreground">
                <Link href="/">Go to Homepage</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
