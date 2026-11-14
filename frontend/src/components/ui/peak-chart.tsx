import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { TrendingDown, TrendingUp, Minus, Zap, Clock, Info } from 'lucide-react';

export interface PeakChartDataPoint {
  label: string;
  value: number;
  secondaryValue?: number; // e.g. baseline demand
  threshold?: number;
  timestamp?: string;
  unit?: string;
}

export interface PeakChartPeriodData {
  period: string;
  data: PeakChartDataPoint[];
  peakValue?: number;
  baselinePeakValue?: number;
  caption?: string;
  updatedText?: string;
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    value: string;
    label?: string;
  };
}

export interface PeakChartProps {
  /** Title of the card (default: "Peak Energy Demand") */
  title?: string;
  /** Primary headline metric value (e.g. 6.79 or "6.79") */
  value?: string | number;
  /** Metric unit (default: "kW") */
  unit?: string;
  /** Subtitle / Caption explaining the metric */
  caption?: string;
  /** Timestamp or simulation status label */
  updatedText?: string;
  /** Trend badge indicating shaving / reduction direction */
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    value: string | number;
    label?: string;
  };
  /** Available periods for selection (default: ['Weekly', 'Monthly', 'Yearly']) */
  periods?: string[];
  /** Controlled active period */
  period?: string;
  /** Uncontrolled default period */
  defaultPeriod?: string;
  /** Callback fired when user selects a period */
  onPeriodChange?: (period: string) => void;
  /** Primary time-series data points */
  data?: PeakChartDataPoint[];
  /** Optional mapping of period names to specific dataset objects */
  periodDataMap?: Record<string, PeakChartPeriodData>;
  /** Primary line accent color (hex or CSS color) */
  accentColor?: string;
  /** Secondary baseline line color (hex or CSS color) */
  secondaryColor?: string;
  /** Target demand line threshold (kW) */
  targetKw?: number;
  /** Contract demand threshold (kW) */
  thresholdKw?: number;
  /** Additional CSS class names */
  className?: string;
  /** Fallback notice if historical data is limited */
  dataLimitationNotice?: string;
}

// Built-in fallback demo dataset (reusable out-of-the-box when no external data is supplied)
const DEFAULT_DEMO_DATA: Record<string, PeakChartDataPoint[]> = {
  Weekly: [
    { label: 'Mon', value: 5.8, secondaryValue: 7.2 },
    { label: 'Tue', value: 6.2, secondaryValue: 7.8 },
    { label: 'Wed', value: 6.5, secondaryValue: 8.1 },
    { label: 'Thu', value: 6.79, secondaryValue: 8.6 },
    { label: 'Fri', value: 6.4, secondaryValue: 8.2 },
    { label: 'Sat', value: 4.5, secondaryValue: 5.6 },
    { label: 'Sun', value: 4.1, secondaryValue: 4.9 },
  ],
  Monthly: [
    { label: 'W1', value: 6.4, secondaryValue: 7.9 },
    { label: 'W2', value: 6.79, secondaryValue: 8.6 },
    { label: 'W3', value: 6.5, secondaryValue: 8.2 },
    { label: 'W4', value: 6.3, secondaryValue: 7.7 },
  ],
  Yearly: [
    { label: 'Q1', value: 6.6, secondaryValue: 8.2 },
    { label: 'Q2', value: 6.79, secondaryValue: 8.6 },
    { label: 'Q3', value: 6.5, secondaryValue: 8.4 },
    { label: 'Q4', value: 6.1, secondaryValue: 7.5 },
  ],
};

export const PeakChart: React.FC<PeakChartProps> = ({
  title = 'Peak Energy Demand',
  value,
  unit = 'kW',
  caption = 'Baseline versus optimized demand',
  updatedText,
  trend,
  periods = ['Weekly', 'Monthly', 'Yearly'],
  period: controlledPeriod,
  defaultPeriod,
  onPeriodChange,
  data: directData,
  periodDataMap,
  accentColor = '#06b6d4', // Cyan accent matching EcoWatt design
  secondaryColor = '#64748b', // Slate for baseline
  targetKw,
  thresholdKw,
  className = '',
  dataLimitationNotice,
}) => {
  // Support both controlled and uncontrolled period state
  const [internalPeriod, setInternalPeriod] = useState<string>(
    defaultPeriod || periods[0] || 'Weekly'
  );
  const activePeriod = controlledPeriod !== undefined ? controlledPeriod : internalPeriod;

  // Reduced motion preference detection
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(false);
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      setPrefersReducedMotion(mediaQuery.matches);
      const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
      mediaQuery.addEventListener?.('change', listener);
      return () => mediaQuery.removeEventListener?.('change', listener);
    }
  }, []);

  // Viewport intersection observer for draw-in animation trigger
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasEnteredViewport, setHasEnteredViewport] = useState<boolean>(false);

  useEffect(() => {
    if (!containerRef.current) return;
    if (typeof IntersectionObserver === 'undefined') {
      setHasEnteredViewport(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          setHasEnteredViewport(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Active dataset resolution (prioritizes periodDataMap, then directData, then demo data)
  const activeData: PeakChartDataPoint[] = useMemo(() => {
    if (periodDataMap && periodDataMap[activePeriod]) {
      return periodDataMap[activePeriod].data;
    }
    if (directData && directData.length > 0) {
      return directData;
    }
    return DEFAULT_DEMO_DATA[activePeriod] || DEFAULT_DEMO_DATA['Weekly'] || [];
  }, [periodDataMap, activePeriod, directData]);

  // Derived peak value from active dataset
  const calculatedPeak = useMemo(() => {
    if (activeData.length === 0) return 0;
    return Math.max(...activeData.map((d) => d.value));
  }, [activeData]);

  const targetNumericValue = useMemo(() => {
    if (value !== undefined) {
      const parsed = typeof value === 'number' ? value : parseFloat(value.toString());
      return isNaN(parsed) ? calculatedPeak : parsed;
    }
    return calculatedPeak;
  }, [value, calculatedPeak]);

  // Headline metric count-up animation
  const [displayValue, setDisplayValue] = useState<number>(() =>
    prefersReducedMotion ? targetNumericValue : 0
  );

  useEffect(() => {
    if (prefersReducedMotion || !hasEnteredViewport) {
      setDisplayValue(targetNumericValue);
      return;
    }

    let animationFrameId: number;
    const duration = 1200; // ms
    const startTime = performance.now();
    const startValue = 0;

    const animateCount = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1.0);
      // Ease out cubic: 1 - pow(1 - progress, 3)
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const currentVal = startValue + (targetNumericValue - startValue) * easeProgress;
      setDisplayValue(currentVal);

      if (progress < 1.0) {
        animationFrameId = requestAnimationFrame(animateCount);
      } else {
        setDisplayValue(targetNumericValue);
      }
    };

    animationFrameId = requestAnimationFrame(animateCount);
    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [targetNumericValue, hasEnteredViewport, prefersReducedMotion]);

  // Handle user switching periods
  const handlePeriodChange = useCallback(
    (p: string) => {
      setInternalPeriod(p);
      onPeriodChange?.(p);
    },
    [onPeriodChange]
  );

  // Chart SVG Coordinates & Geometry computation
  const svgWidth = 600;
  const svgHeight = 220;
  const padding = { top: 25, right: 30, bottom: 35, left: 35 };
  const graphWidth = svgWidth - padding.left - padding.right;
  const graphHeight = svgHeight - padding.top - padding.bottom;

  // Determine Y-axis domain
  const { minY, maxY, peakPoint, svgPoints, secondarySvgPoints } = useMemo(() => {
    if (activeData.length === 0) {
      return { minY: 0, maxY: 10, peakPoint: null, svgPoints: [], secondarySvgPoints: [] };
    }

    let min = Infinity;
    let max = -Infinity;

    activeData.forEach((d) => {
      if (d.value < min) min = d.value;
      if (d.value > max) max = d.value;
      if (d.secondaryValue !== undefined) {
        if (d.secondaryValue < min) min = d.secondaryValue;
        if (d.secondaryValue > max) max = d.secondaryValue;
      }
    });

    if (thresholdKw !== undefined && thresholdKw > max) max = thresholdKw;
    if (targetKw !== undefined && targetKw > max) max = targetKw;

    // Add breathing room
    const paddingY = (max - min) * 0.15 || 1.0;
    const finalMin = Math.max(0, Math.floor((min - paddingY) * 10) / 10);
    const finalMax = Math.ceil((max + paddingY) * 10) / 10;
    const rangeY = finalMax - finalMin || 1;

    // Map data to SVG points
    let maxVal = -Infinity;
    let peakIndex = 0;

    const points = activeData.map((d, i) => {
      const x = padding.left + (i / Math.max(1, activeData.length - 1)) * graphWidth;
      const y = padding.top + graphHeight - ((d.value - finalMin) / rangeY) * graphHeight;
      if (d.value > maxVal) {
        maxVal = d.value;
        peakIndex = i;
      }
      return { x, y, data: d, index: i };
    });

    const secPoints = activeData
      .filter((d) => d.secondaryValue !== undefined)
      .map((d, i) => {
        const x = padding.left + (i / Math.max(1, activeData.length - 1)) * graphWidth;
        const y =
          padding.top +
          graphHeight -
          (((d.secondaryValue as number) - finalMin) / rangeY) * graphHeight;
        return { x, y, data: d, index: i };
      });

    const peakPt = points[peakIndex] || null;

    return {
      minY: finalMin,
      maxY: finalMax,
      peakPoint: peakPt,
      svgPoints: points,
      secondarySvgPoints: secPoints,
    };
  }, [activeData, graphWidth, graphHeight, padding, thresholdKw, targetKw]);

  // Construct smooth SVG path string using cubic splines
  const createSmoothPath = (pts: { x: number; y: number }[]) => {
    if (pts.length === 0) return '';
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
    if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;

    let path = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i === 0 ? 0 : i - 1];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return path;
  };

  const linePathD = useMemo(() => createSmoothPath(svgPoints), [svgPoints]);
  const secLinePathD = useMemo(
    () => createSmoothPath(secondarySvgPoints),
    [secondarySvgPoints]
  );

  const areaPathD = useMemo(() => {
    if (svgPoints.length === 0) return '';
    const first = svgPoints[0];
    const last = svgPoints[svgPoints.length - 1];
    const baselineY = padding.top + graphHeight;
    return `${linePathD} L ${last.x} ${baselineY} L ${first.x} ${baselineY} Z`;
  }, [svgPoints, linePathD, padding, graphHeight]);

  // Interactive Hover Inspection State
  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    y: number;
    data: PeakChartDataPoint;
  } | null>(null);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * svgWidth;

    if (svgPoints.length === 0) return;

    // Find closest point by X coordinate
    let closest = svgPoints[0];
    let minDist = Math.abs(mouseX - closest.x);

    for (let i = 1; i < svgPoints.length; i++) {
      const dist = Math.abs(mouseX - svgPoints[i].x);
      if (dist < minDist) {
        minDist = dist;
        closest = svgPoints[i];
      }
    }

    setHoveredPoint(closest);
  };

  const handleMouseLeave = () => {
    setHoveredPoint(null);
  };

  // Determine trend badge details
  const activeTrend = useMemo(() => {
    if (trend) return trend;
    if (periodDataMap && periodDataMap[activePeriod]?.trend) {
      return periodDataMap[activePeriod].trend;
    }
    // Calculate difference if secondary (baseline) value exists
    if (peakPoint && peakPoint.data.secondaryValue !== undefined) {
      const base = peakPoint.data.secondaryValue;
      const opt = peakPoint.data.value;
      const diff = opt - base;
      const pct = (diff / base) * 100;
      return {
        direction: diff <= 0 ? ('down' as const) : ('up' as const),
        value: `${Math.abs(pct).toFixed(1)}% ${diff <= 0 ? 'Shaved' : 'Rise'}`,
        label: 'Peak Reduction',
      };
    }
    return {
      direction: 'down' as const,
      value: '-21.0% Shaved',
      label: 'Closed-Loop Peak Shaving',
    };
  }, [trend, periodDataMap, activePeriod, peakPoint]);

  // Active caption text
  const activeCaption =
    periodDataMap?.[activePeriod]?.caption ||
    caption ||
    'Baseline versus optimized demand';

  // Active status text
  const activeUpdatedText =
    periodDataMap?.[activePeriod]?.updatedText ||
    updatedText ||
    'Simulated 24-Hour Cycle • Real-time Closed Loop';

  return (
    <div
      ref={containerRef}
      className={`scifi-card-outer scifi-accent-cyan ${className}`}
    >
      <div className="scifi-tracer-dot" style={{ color: '#00AAFF', animationDuration: '10s' }} />
      <div className="scifi-card-inner p-4 text-[#FAFAFA]">
        <div className="scifi-ray" />
        <div className="scifi-reticle-top" />
        <div className="scifi-reticle-bottom" />
        <div className="scifi-reticle-left" />
        <div className="scifi-reticle-right" />
        <div className="relative z-[2]">
      {/* Header: Title, Period Controls, and Real-time Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-1 rounded bg-[#18181B] text-cyan-400 border border-[#27272A]">
              <Zap className="h-3.5 w-3.5" />
            </span>
            <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#FAFAFA]">{title}</h3>
          </div>
          <p className="text-[11px] font-mono text-[#71717A] mt-0.5">{activeCaption}</p>
        </div>

        {/* Period Selector Tabs (Controlled & Uncontrolled) */}
        {periods && periods.length > 0 && (
          <div
            role="tablist"
            aria-label="Period Selection"
            className="inline-flex self-start sm:self-auto bg-[#09090B] p-0.5 rounded border border-[#27272A] text-[11px] font-mono"
          >
            {periods.map((p) => {
              const isSelected = activePeriod === p;
              return (
                <button
                  key={p}
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => handlePeriodChange(p)}
                  className={`px-2.5 py-1 rounded font-medium transition cursor-pointer capitalize ${
                    isSelected
                      ? 'bg-[#18181B] text-[#FAFAFA] border border-[#27272A] shadow-xs'
                      : 'text-[#71717A] hover:text-[#A1A1AA] hover:bg-[#121215] border border-transparent'
                  }`}
                >
                  {p}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Metric Display & Trend Pill */}
      <div className="flex flex-wrap items-baseline justify-between gap-3 mb-3">
        <div className="flex items-baseline space-x-2">
          <span className="font-mono tabular-nums text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-[linear-gradient(45deg,#fff,#00aaff)]">
            {displayValue.toFixed(2)}
          </span>
          <span className="text-xs font-mono font-semibold text-cyan-400">{unit}</span>
          <span className="text-[10px] font-mono text-[#71717A] ml-1">
            [PEAK ACTIVE DEMAND]
          </span>
        </div>

        {/* Dynamic Trend Indicator */}
        {activeTrend && (
          <div
            className={`inline-flex items-center space-x-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-medium border ${
              activeTrend.direction === 'down'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : activeTrend.direction === 'up'
                ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                : 'bg-[#18181B] text-[#A1A1AA] border-[#27272A]'
            }`}
          >
            {activeTrend.direction === 'down' && <TrendingDown className="h-3 w-3" />}
            {activeTrend.direction === 'up' && <TrendingUp className="h-3 w-3" />}
            {activeTrend.direction === 'neutral' && <Minus className="h-3 w-3" />}
            <span className="tabular-nums">{activeTrend.value}</span>
            {activeTrend.label && (
              <span className="hidden md:inline text-[10px] text-[#71717A] font-normal">
                &bull; {activeTrend.label}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Data Limitation Notice (Shown when selecting multi-week views if historical backend dataset is pending) */}
      {dataLimitationNotice && (
        <div className="mb-3 px-3 py-1.5 rounded bg-[#121215] border border-[#27272A] text-[11px] font-mono text-[#A1A1AA] flex items-center space-x-2">
          <Info className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
          <span>{dataLimitationNotice}</span>
        </div>
      )}

      {/* Responsive SVG Chart Canvas */}
      <div className="relative w-full h-48 sm:h-56">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-full overflow-visible select-none"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            {/* Primary Gradient Fill */}
            <linearGradient id="peakAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accentColor} stopOpacity={0.25} />
              <stop offset="85%" stopColor={accentColor} stopOpacity={0.02} />
              <stop offset="100%" stopColor={accentColor} stopOpacity={0.0} />
            </linearGradient>

            {/* Subtle Line Filter */}
            <filter id="peakGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Grid lines */}
          <line
            x1={padding.left}
            y1={padding.top + graphHeight}
            x2={svgWidth - padding.right}
            y2={padding.top + graphHeight}
            stroke="#27272A"
            strokeWidth="1"
          />
          <line
            x1={padding.left}
            y1={padding.top + graphHeight / 2}
            x2={svgWidth - padding.right}
            y2={padding.top + graphHeight / 2}
            stroke="#27272A"
            strokeDasharray="2 3"
            strokeWidth="1"
          />
          <line
            x1={padding.left}
            y1={padding.top}
            x2={svgWidth - padding.right}
            y2={padding.top}
            stroke="#27272A"
            strokeDasharray="2 3"
            strokeWidth="1"
          />

          {/* Target & Threshold Reference Lines (If provided) */}
          {thresholdKw !== undefined && (
            <g>
              <line
                x1={padding.left}
                y1={padding.top + graphHeight - ((thresholdKw - minY) / (maxY - minY || 1)) * graphHeight}
                x2={svgWidth - padding.right}
                y2={padding.top + graphHeight - ((thresholdKw - minY) / (maxY - minY || 1)) * graphHeight}
                stroke="#F43F5E"
                strokeDasharray="3 3"
                strokeWidth="1"
                opacity={0.8}
              />
              <text
                x={svgWidth - padding.right}
                y={padding.top + graphHeight - ((thresholdKw - minY) / (maxY - minY || 1)) * graphHeight - 4}
                textAnchor="end"
                fill="#F43F5E"
                fontSize="9"
                fontFamily="monospace"
                fontWeight="600"
              >
                LIMIT {thresholdKw.toFixed(2)}kW
              </text>
            </g>
          )}

          {targetKw !== undefined && (
            <g>
              <line
                x1={padding.left}
                y1={padding.top + graphHeight - ((targetKw - minY) / (maxY - minY || 1)) * graphHeight}
                x2={svgWidth - padding.right}
                y2={padding.top + graphHeight - ((targetKw - minY) / (maxY - minY || 1)) * graphHeight}
                stroke="#06B6D4"
                strokeDasharray="2 2"
                strokeWidth="1"
                opacity={0.8}
              />
              <text
                x={padding.left + 5}
                y={padding.top + graphHeight - ((targetKw - minY) / (maxY - minY || 1)) * graphHeight - 4}
                fill="#06B6D4"
                fontSize="9"
                fontFamily="monospace"
                fontWeight="600"
              >
                TARGET {targetKw.toFixed(2)}kW
              </text>
            </g>
          )}

          {/* Area Fill */}
          <path
            d={areaPathD}
            fill="url(#peakAreaGrad)"
            className={prefersReducedMotion ? '' : 'transition-opacity duration-1000'}
            opacity={hasEnteredViewport ? 1 : 0}
          />

          {/* Secondary Baseline Curve (Dashed line) */}
          {secLinePathD && (
            <path
              d={secLinePathD}
              fill="none"
              stroke="#52525B"
              strokeWidth="1.2"
              strokeDasharray="3 3"
              opacity={0.7}
            />
          )}

          {/* Primary Animated Active Curve */}
          {linePathD && (
            <path
              d={linePathD}
              fill="none"
              stroke={accentColor}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#peakGlow)"
              style={{
                strokeDasharray: prefersReducedMotion ? 'none' : 1500,
                strokeDashoffset: prefersReducedMotion || hasEnteredViewport ? 0 : 1500,
                transition: prefersReducedMotion ? 'none' : 'stroke-dashoffset 1.4s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            />
          )}

          {/* Pulsing Dot on the Peak Value */}
          {peakPoint && (
            <g transform={`translate(${peakPoint.x}, ${peakPoint.y})`}>
              <circle
                cx="0"
                cy="0"
                r="6"
                fill={accentColor}
                opacity={0.4}
                className={prefersReducedMotion ? '' : 'animate-ping origin-center'}
                style={{ transformOrigin: '0 0' }}
              />
              <circle
                cx="0"
                cy="0"
                r="3"
                fill="#FFFFFF"
                stroke={accentColor}
                strokeWidth="2"
              />

              {/* Peak Badge Label */}
              <g transform="translate(0, -12)">
                <rect
                  x="-36"
                  y="-12"
                  width="72"
                  height="14"
                  rx="2"
                  fill="#09090B"
                  stroke={accentColor}
                  strokeWidth="1"
                />
                <text
                  x="0"
                  y="-2"
                  textAnchor="middle"
                  fill="#FAFAFA"
                  fontSize="8.5"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  PEAK {peakPoint.data.value.toFixed(2)} kW
                </text>
              </g>
            </g>
          )}

          {/* Hover Crosshair & Data Readout */}
          {hoveredPoint && (
            <g>
              <line
                x1={hoveredPoint.x}
                y1={padding.top}
                x2={hoveredPoint.x}
                y2={padding.top + graphHeight}
                stroke="#71717A"
                strokeDasharray="2 2"
                strokeWidth="1"
                opacity={0.7}
              />
              <circle
                cx={hoveredPoint.x}
                cy={hoveredPoint.y}
                r="4"
                fill="#FFFFFF"
                stroke={accentColor}
                strokeWidth="2"
              />
            </g>
          )}

          {/* X-Axis Labels */}
          {svgPoints.map((pt, i) => {
            const step = Math.max(1, Math.floor(svgPoints.length / 7));
            if (i % step !== 0 && i !== svgPoints.length - 1) return null;
            return (
              <text
                key={i}
                x={pt.x}
                y={padding.top + graphHeight + 16}
                textAnchor="middle"
                fill="#71717A"
                fontSize="9"
                fontFamily="monospace"
                fontWeight="500"
              >
                {pt.data.label}
              </text>
            );
          })}
        </svg>

        {/* Floating Tooltip Readout Overlay */}
        {hoveredPoint && (
          <div
            className="pointer-events-none absolute z-20 rounded bg-[#0F0F12] border border-[#27272A] px-2.5 py-1.5 font-mono text-xs shadow-xl backdrop-blur"
            style={{
              left: `${Math.min(
                Math.max(10, (hoveredPoint.x / svgWidth) * 100),
                80
              )}%`,
              top: `${Math.min(
                Math.max(10, (hoveredPoint.y / svgHeight) * 100),
                65
              )}%`,
              transform: 'translate(-50%, -110%)',
            }}
          >
            <div className="text-[11px] text-[#A1A1AA] border-b border-[#27272A] pb-1 mb-1 font-semibold">
              {hoveredPoint.data.timestamp || hoveredPoint.data.label}
            </div>
            <div className="space-y-0.5 text-[11px] tabular-nums">
              <div className="flex items-center justify-between space-x-3">
                <span className="text-[#71717A]">Active Demand:</span>
                <span className="font-bold text-cyan-400">
                  {hoveredPoint.data.value.toFixed(2)} kW
                </span>
              </div>
              {hoveredPoint.data.secondaryValue !== undefined && (
                <div className="flex items-center justify-between space-x-3">
                  <span className="text-[#71717A]">Baseline:</span>
                  <span className="text-[#A1A1AA]">
                    {hoveredPoint.data.secondaryValue.toFixed(2)} kW
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer: Timestamp & Simulation Status */}
      <div className="mt-2 pt-2.5 border-t border-[#27272A] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 text-[10px] font-mono text-[#71717A]">
        <div className="flex items-center space-x-1.5">
          <Clock className="h-3 w-3 text-[#52525B]" />
          <span>{activeUpdatedText}</span>
        </div>
        <div className="flex items-center space-x-3 text-[#A1A1AA]">
          <div className="flex items-center space-x-1.5">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: accentColor }}
            />
            <span>OPTIMIZED DEMAND</span>
          </div>
          {secondarySvgPoints.length > 0 && (
            <div className="flex items-center space-x-1.5">
              <span
                className="h-1.5 w-1.5 rounded-full bg-[#52525B]"
              />
              <span>BASELINE DEMAND</span>
            </div>
          )}
        </div>
      </div>
        </div>
      </div>
    </div>
  );
};

export default PeakChart;

