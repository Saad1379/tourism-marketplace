import Image from "next/image";
import { cn } from "@/lib/utils";

type TourichoLogoSize = "sm" | "md" | "lg";

interface TourichoLogoProps {
  size?: TourichoLogoSize;
  className?: string;
  /** @deprecated – no longer used, kept for API compatibility */
  markClassName?: string;
  /** @deprecated – no longer used, kept for API compatibility */
  textClassName?: string;
  /** @deprecated – no longer used, kept for API compatibility */
  withWordmark?: boolean;
}

/**
 * Tailwind responsive height classes per size.
 * Mobile (default) → Desktop (lg:)
 *  sm : 28px  → 36px
 *  md : 32px  → 44px   ← used in the navbar
 *  lg : 40px  → 56px
 */
const sizeClasses: Record<TourichoLogoSize, string> = {
  sm: "h-7 lg:h-9",
  md: "h-8 lg:h-11",
  lg: "h-10 lg:h-14",
};

export function TourichoLogo({ size = "md", className }: TourichoLogoProps) {
  const imgClass = cn("w-auto object-contain", sizeClasses[size]);

  return (
    <span className={cn("inline-flex items-center", className)}>
      {/* Light theme logo */}
      <Image
        src="/logo.png"
        alt="Touricho"
        width={240}
        height={56}
        priority
        className={cn(imgClass, "block dark:hidden")}
      />
      {/* Dark theme logo */}
      <Image
        src="/logo-white.png"
        alt="Touricho"
        width={240}
        height={56}
        priority
        className={cn(imgClass, "hidden dark:block")}
      />
    </span>
  );
}
