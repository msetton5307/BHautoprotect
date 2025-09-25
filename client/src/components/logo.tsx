import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useBranding } from "@/hooks/use-branding";

interface LogoProps {
  className?: string;
  showText?: boolean;
  textClassName?: string;
  titleClassName?: string;
  subtitleClassName?: string;
  variant?: "default" | "inverse";
  emblemWrapperClassName?: string;
  emblemClassName?: string;
}

export function Logo({
  className,
  showText = true,
  textClassName,
  titleClassName,
  subtitleClassName,
  variant = "default",
  emblemWrapperClassName,
  emblemClassName,
}: LogoProps) {
  const { data } = useBranding();
  const logoUrl = useMemo(() => {
    const value = data?.data?.logoUrl;
    return typeof value === "string" && value.trim().length > 0 ? value : null;
  }, [data]);

  const emblemClasses = cn(
    "h-16 w-auto sm:h-20",
    logoUrl && "object-contain",
    variant === "inverse" && "drop-shadow-[0_12px_28px_rgba(15,23,42,0.16)]",
    emblemClassName,
  );

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className={cn(
          "flex flex-shrink-0 items-center justify-center",
          variant === "inverse" &&
            "rounded-2xl bg-white/95 p-2 shadow-lg shadow-black/10 ring-1 ring-white/60 backdrop-blur",
          emblemWrapperClassName,
        )}
      >
        {logoUrl ? (
          <img
            src={logoUrl}
            alt="BH Auto Protect logo"
            className={emblemClasses}
            loading="lazy"
          />
        ) : (
          <svg
            viewBox="0 0 320 120"
            role="img"
            aria-labelledby="bh-logo-title bh-logo-desc"
            className={emblemClasses}
          >
          <title id="bh-logo-title">BH Auto Protect</title>
          <desc id="bh-logo-desc">Stylized car silhouette above a shield with a checkmark</desc>
          <defs>
            <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0F172A" />
              <stop offset="50%" stopColor="#1D4ED8" />
              <stop offset="100%" stopColor="#0F172A" />
            </linearGradient>
          </defs>
          <g fill="none" stroke="url(#logoGradient)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M30 66c20-22 60-40 110-40s86 16 120 40" />
            <path d="M36 58c12-16 48-30 104-30s96 14 116 30" opacity="0.65" />
          </g>
          <g transform="translate(210 50)">
            <path
              d="M36 4 18-4 0 4v30c0 16 8 30 18 38 10-8 18-22 18-38V4Z"
              fill="#0F172A"
              opacity="0.12"
            />
            <path
              d="M36 0 18-8 0 0v32c0 16 8 30 18 38 10-8 18-22 18-38V0Z"
              fill="#0B1F4E"
            />
            <path
              d="M9 16 18 26l15-18"
              stroke="#E0F2FE"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
          </svg>
        )}
      </div>
      {showText && (
        <div className={cn("flex flex-col leading-tight", textClassName)}>
          <span
            className={cn(
              "text-2xl sm:text-3xl font-black tracking-tight text-slate-900",
              titleClassName,
            )}
          >
            BH <span className="text-primary">AUTO</span> PROTECT
          </span>
          <span
            className={cn(
              "text-xs sm:text-sm uppercase tracking-[0.3em] text-slate-500",
              subtitleClassName,
            )}
          >
            Extended Car Warranties
          </span>
        </div>
      )}
    </div>
  );
}

export default Logo;
