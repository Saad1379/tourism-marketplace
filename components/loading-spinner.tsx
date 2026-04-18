import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

type LoadingSpinnerProps = {
  label?: string
  center?: boolean
  className?: string
  spinnerClassName?: string
}

export function LoadingSpinner({
  label = "Loading...",
  center = false,
  className,
  spinnerClassName,
}: LoadingSpinnerProps = {}) {
  const content = (
    <div className="flex flex-col items-center justify-center gap-3">
      <Spinner className={cn("h-9 w-9 text-primary", spinnerClassName)} />
      {label ? <p className="text-sm text-muted-foreground">{label}</p> : null}
    </div>
  )

  if (center) {
    return <div className={cn("flex min-h-[40vh] items-center justify-center", className)}>{content}</div>
  }

  return (
    <div className={cn("flex flex-col items-center justify-center", className)}>{content}</div>
  )
}
