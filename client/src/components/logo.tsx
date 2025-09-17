import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useBranding } from "@/hooks/use-branding";

interface LogoProps {
  className?: string;
  showText?: boolean;
  textClassName?: string;
  titleClassName?: string;
  subtitleClassName?: string;
}

export function Logo({
  className,
  showText = true,
  textClassName,
  titleClassName,
  subtitleClassName,
}: LogoProps) {
  const { data } = useBranding();
  const logoUrl = useMemo(() => {
    const value = data?.data?.logoUrl;
    return typeof value === "string" && value.trim().length > 0 ? value : null;
  }, [data]);

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {logoUrl ? (
        <img
          src={logoUrl}
          alt="BH Auto Protect logo"
          className="h-12 w-auto object-contain"
          loading="lazy"
        />
      ) : (
        <svg
          viewBox="0 0 320 120"
          role="img"
          aria-labelledby="bh-logo-title bh-logo-desc"
          className="h-12 w-auto"
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
      {showText && (
        <div className={cn("flex flex-col leading-tight", textClassName)}>
          <span
            className={cn(
              "text-xl sm:text-2xl font-black tracking-tight text-slate-900",
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
