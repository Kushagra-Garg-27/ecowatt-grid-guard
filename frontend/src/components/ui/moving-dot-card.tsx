import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

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
}

export const MovingDotCard: React.FC<MovingDotCardProps> = ({
  target = 777000,
  duration = 2000,
  label = "Views",
  sublabel,
  formatter,
  className,
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

  return (
    <div
      className={cn(
        "relative rounded-[10px] w-[300px] h-[250px] p-[1px] select-none",
        "bg-[radial-gradient(230px_at_0_0,#fff,#0c0d0d)] shadow-2xl",
        className
      )}
      {...props}
    >
      <style>{`
        @keyframes moveDot {
          0%, 100% {
            top: 10%;
            right: 10%;
          }
          25% {
            top: 10%;
            right: calc(100% - 35px);
          }
          50% {
            top: calc(100% - 30px);
            right: calc(100% - 35px);
          }
          75% {
            top: calc(100% - 30px);
            right: 10%;
          }
        }
        .moving-dot-tracer {
          aspect-ratio: 1;
          z-index: 2;
          background-color: #fff;
          border-radius: 9999px;
          width: 5px;
          animation: 6s linear infinite moveDot;
          position: absolute;
          box-shadow: 0 0 10px #fff;
        }
      `}</style>

      {/* Animated Dot traversing the perimeter */}
      <div className="moving-dot-tracer" />

      {/* Inner Card Container */}
      <div className="relative z-[1] w-full h-full p-2.5 rounded-[9px] flex flex-col justify-center items-center gap-2 border border-[#202222] bg-[radial-gradient(280px_at_0_0,#444,#0c0d0d)] overflow-hidden">
        {/* Angled Light Ray Highlight */}
        <div
          className="absolute top-0 left-0 w-[220px] h-[45px] rounded-[100px] bg-[#c7c7c7] opacity-40 blur-[10px] shadow-[0_0_50px_#fff]"
          style={{
            transformOrigin: "10%",
            transform: "rotate(40deg)",
          }}
        />

        {/* Counter Display with Cyberpunk Gradient */}
        <div className="text-transparent bg-clip-text bg-[linear-gradient(45deg,#fff,#00aaff)] text-[3.25rem] font-bold font-mono tracking-tight leading-none tabular-nums z-[2]">
          {displayCount}
        </div>

        {/* Label */}
        <div className="text-[#cccccc] uppercase tracking-[1px] text-sm font-medium font-mono z-[2]">
          {label}
        </div>

        {sublabel && (
          <div className="text-[#71717a] text-[11px] font-mono tracking-wide -mt-1 z-[2]">
            {sublabel}
          </div>
        )}

        {/* Sci-Fi Decorative Grid Crosshairs */}
        <div className="absolute top-[10%] left-0 w-full h-[1px] bg-[linear-gradient(90deg,#888_30%,#1d1f1f_70%)] opacity-80" />
        <div className="absolute bottom-[10%] left-0 w-full h-[1px] bg-[#2c2c2c] opacity-80" />
        <div className="absolute top-0 left-[10%] w-[1px] h-full bg-[linear-gradient(#747474_30%,#222424_70%)] opacity-80" />
        <div className="absolute top-0 right-[10%] w-[1px] h-full bg-[#2c2c2c] opacity-80" />
      </div>
    </div>
  );
};

export const DotCard = MovingDotCard;

export default MovingDotCard;
