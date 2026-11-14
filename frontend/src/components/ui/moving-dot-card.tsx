import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

export interface SciFiCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Additional classes applied to the inner card content wrapper */
  innerClassName?: string;
  /** Whether to render the moving tracer dot along the perimeter */
  dot?: boolean;
  /** Custom color for the tracer dot (defaults to accent color or white) */
  dotColor?: string;
  /** Animation duration for one perimeter loop (e.g., '6s', '8s') */
  dotDuration?: string;
  /** Whether to render the angled glass light ray in the top-left */
  glowRay?: boolean;
  /** Whether to render the sci-fi reticle crosshair lines */
  crosshairs?: boolean;
  /** Accent border gradient variant */
  accent?: "default" | "cyan" | "emerald" | "rose" | "amber";
  children?: React.ReactNode;
}

export const SciFiCard = React.forwardRef<HTMLDivElement, SciFiCardProps>(
  (
    {
      className,
      innerClassName,
      dot = true,
      dotColor,
      dotDuration = "7s",
      glowRay = true,
      crosshairs = true,
      accent = "default",
      children,
      style,
      ...props
    },
    ref
  ) => {
    const accentClass =
      accent === "emerald"
        ? "scifi-accent-emerald"
        : accent === "rose"
        ? "scifi-accent-rose"
        : accent === "cyan"
        ? "scifi-accent-cyan"
        : accent === "amber"
        ? "scifi-accent-amber"
        : "scifi-accent-default";

    const defaultDotColor =
      dotColor ||
      (accent === "emerald"
        ? "#10B981"
        : accent === "rose"
        ? "#F43F5E"
        : accent === "cyan"
        ? "#00AAFF"
        : accent === "amber"
        ? "#F59E0B"
        : "#FFFFFF");

    return (
      <div
        ref={ref}
        className={cn(
          "scifi-card-outer relative select-none rounded-[10px] p-[1px] transition-all duration-300",
          accentClass,
          className
        )}
        style={style}
        {...props}
      >
        {/* Animated Perimeter Tracer Dot */}
        {dot && (
          <div
            className="scifi-tracer-dot"
            style={{
              color: defaultDotColor,
              animationDuration: dotDuration,
            }}
          />
        )}

        {/* Inner Card Container */}
        <div
          className={cn(
            "scifi-card-inner relative z-[1] w-full h-full rounded-[9px] overflow-hidden",
            innerClassName
          )}
        >
          {/* Angled Light Ray Refraction Sheen */}
          {glowRay && <div className="scifi-ray" />}

          {/* Sci-Fi Decorative Grid Crosshairs */}
          {crosshairs && (
            <>
              <div className="scifi-reticle-top" />
              <div className="scifi-reticle-bottom" />
              <div className="scifi-reticle-left" />
              <div className="scifi-reticle-right" />
            </>
          )}

          {/* Card Content */}
          <div className="relative z-[2] w-full h-full">{children}</div>
        </div>
      </div>
    );
  }
);
SciFiCard.displayName = "SciFiCard";

export interface MovingDotCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Target count value to animate up to */
  target?: number;
  /** Duration of counter animation in milliseconds */
  duration?: number;
  /** Label underneath the count display */
  label?: string;
  /** Optional sublabel / subtitle */
  sublabel?: string;
  /** Optional custom formatter for the number */
  formatter?: (val: number) => string;
  /** Accent variant for the glow and text */
  accent?: "default" | "cyan" | "emerald" | "rose" | "amber";
  /** Optional children override */
  children?: React.ReactNode;
}

export const MovingDotCard: React.FC<MovingDotCardProps> = ({
  target = 777000,
  duration = 2000,
  label = "Views",
  sublabel,
  formatter,
  accent = "cyan",
  className,
  children,
  ...props
}) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let current = 0;
    const end = target;
    if (end <= 0) {
      setCount(0);
      return;
    }
    const step = Math.ceil(end / (duration / 50));
    const timer = setInterval(() => {
      current += step;
      if (current >= end) {
        current = end;
        clearInterval(timer);
      }
      setCount(current);
    }, 50);

    return () => clearInterval(timer);
  }, [target, duration]);

  const defaultFormat = (val: number) => {
    if (val < 1000) return `${val}`;
    if (val < 1000000) return `${Math.floor(val / 1000)}k`;
    return `${(val / 1000000).toFixed(1)}M`;
  };

  const displayCount = formatter ? formatter(count) : defaultFormat(count);

  const textGradient =
    accent === "emerald"
      ? "bg-[linear-gradient(45deg,#fff,#10b981)]"
      : accent === "rose"
      ? "bg-[linear-gradient(45deg,#fff,#f43f5e)]"
      : accent === "amber"
      ? "bg-[linear-gradient(45deg,#fff,#f59e0b)]"
      : "bg-[linear-gradient(45deg,#fff,#00aaff)]";

  if (children) {
    return (
      <SciFiCard accent={accent} className={className} {...props}>
        {children}
      </SciFiCard>
    );
  }

  return (
    <SciFiCard
      accent={accent}
      className={cn("w-[300px] h-[250px]", className)}
      innerClassName="flex flex-col justify-center items-center gap-2 p-4 text-center"
      {...props}
    >
      <div
        className={cn(
          "text-transparent bg-clip-text text-[3.25rem] font-bold font-mono tracking-tight leading-none tabular-nums",
          textGradient
        )}
      >
        {displayCount}
      </div>

      <div className="text-[#cccccc] uppercase tracking-[1px] text-sm font-medium font-mono">
        {label}
      </div>

      {sublabel && (
        <div className="text-[#71717a] text-[11px] font-mono tracking-wide -mt-1">
          {sublabel}
        </div>
      )}
    </SciFiCard>
  );
};

export const DotCard = MovingDotCard;

export default MovingDotCard;
