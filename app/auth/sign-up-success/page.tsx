import Link from "next/link"
import { Mail, CheckCircle2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { TipWalkLogo } from "@/components/brand/tipwalk-logo"

export const metadata = {
  title: "Check Your Email | TipWalk",
  description: "Please check your email to confirm your account.",
}

export default function SignUpSuccessPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <Link href="/" className="mb-8 flex justify-center" aria-label="TipWalk home">
          <TipWalkLogo size="lg" />
        </Link>

        <Card className="border-border bg-background">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary/15">
              <CheckCircle2 className="h-8 w-8 text-secondary" />
            </div>
            <CardTitle className="text-2xl font-bold text-foreground">Check your email</CardTitle>
            <CardDescription className="text-muted-foreground">We've sent you a confirmation link</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-lg bg-muted p-4">
              <div className="flex items-start gap-3">
                <Mail className="mt-0.5 h-5 w-5 text-muted-foreground" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Confirm your email address</p>
                  <p className="text-sm text-muted-foreground">
                    Click the link in the email we sent you to verify your account and get started.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-center text-sm text-muted-foreground">
                Didn't receive the email? Check your spam folder or try again.
              </p>
              <div className="flex flex-col gap-2">
                <Button asChild variant="outline" className="w-full bg-background border-border text-foreground/80">
                  <Link href="/login">Back to Sign In</Link>
                </Button>
                <Button asChild variant="ghost" className="w-full text-muted-foreground hover:text-foreground">
                  <Link href="/">Go to Homepage</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
