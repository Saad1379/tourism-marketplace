import { cn } from "@/lib/utils"

type TipWalkLogoSize = "sm" | "md" | "lg"

interface TipWalkLogoProps {
  size?: TipWalkLogoSize
  className?: string
  markClassName?: string
  textClassName?: string
  withWordmark?: boolean
}

const sizeMap: Record<TipWalkLogoSize, { mark: string; icon: string; text: string }> = {
  sm: { mark: "h-8 w-8 rounded-lg", icon: "h-4 w-4", text: "text-lg" },
  md: { mark: "h-9 w-9 rounded-xl", icon: "h-[18px] w-[18px]", text: "text-xl" },
  lg: { mark: "h-10 w-10 rounded-xl", icon: "h-5 w-5", text: "text-2xl" },
}

export function TipWalkLogo({
  size = "md",
  className,
  markClassName,
  textClassName,
  withWordmark = true,
}: TipWalkLogoProps) {
  const config = sizeMap[size]

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "inline-flex items-center justify-center bg-primary text-white shadow-[0_6px_14px_rgba(224,92,58,0.24)]",
          config.mark,
          markClassName,
        )}
      >
        <svg
          viewBox="0 0 28 28"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={config.icon}
          aria-hidden="true"
        >
          <path
            d="M14 4.75a5.25 5.25 0 0 0-5.25 5.25c0 4.02 3.95 7.58 5.25 8.68 1.3-1.1 5.25-4.66 5.25-8.68A5.25 5.25 0 0 0 14 4.75Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="14" cy="10" r="2" stroke="currentColor" strokeWidth="2" />
          <path d="M7.25 21.25c1.8-1.55 3.74-2.33 5.8-2.33" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M15.05 18.92c2.07 0 4 .78 5.8 2.33" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </span>
      {withWordmark ? (
        <span className={cn("font-serif font-semibold tracking-tight text-foreground leading-none", config.text, textClassName)}>
          <span>Tip</span>
          <span className="italic text-[color:var(--landing-accent-strong)] dark:text-[color:var(--landing-accent)]">Walk</span>
        </span>
      ) : null}
    </span>
  )
}
