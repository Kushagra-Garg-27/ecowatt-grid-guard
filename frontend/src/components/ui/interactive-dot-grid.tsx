import React, { useEffect, useRef } from 'react';

export interface InteractiveDotGridProps {
  /** Distance between dots in pixels */
  spacing?: number;
  /** Base resting radius of dots in pixels */
  baseRadius?: number;
  /** Max radius of dots when cursor is directly over them */
  maxRadius?: number;
  /** Maximum distance of cursor influence in pixels */
  activeRadius?: number;
  /** Max repulsion distance in pixels */
  maxDisplacement?: number;
  /** Canvas background color */
  backgroundColor?: string;
  className?: string;
}

export const InteractiveDotGrid: React.FC<InteractiveDotGridProps> = ({
  spacing = 26,
  baseRadius = 1.3,
  maxRadius = 3.6,
  activeRadius = 140,
  maxDisplacement = 10,
  backgroundColor = '#ffffff',
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef({
    x: -2000,
    y: -2000,
    targetX: -2000,
    targetY: -2000,
    isHovering: false,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = 0;
    let height = 0;

    interface DotNode {
      originX: number;
      originY: number;
      currentX: number;
      currentY: number;
      vx: number;
      vy: number;
    }

    let dots: DotNode[] = [];

    const initDots = () => {
      dots = [];
      const cols = Math.ceil(width / spacing) + 2;
      const rows = Math.ceil(height / spacing) + 2;

      for (let c = -1; c <= cols; c++) {
        for (let r = -1; r <= rows; r++) {
          const ox = c * spacing;
          const oy = r * spacing;
          dots.push({
            originX: ox,
            originY: oy,
            currentX: ox,
            currentY: oy,
            vx: 0,
            vy: 0,
          });
        }
      }
    };

    // Handles HiDPI / Retina sharpness & window resize
    const resizeCanvas = () => {
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      width = window.innerWidth;
      height = window.innerHeight;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.resetTransform();
      ctx.scale(dpr, dpr);
      initDots();
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current.targetX = e.clientX;
      mouseRef.current.targetY = e.clientY;
      mouseRef.current.isHovering = true;
    };

    const onMouseLeave = () => {
      mouseRef.current.targetX = -2000;
      mouseRef.current.targetY = -2000;
      mouseRef.current.isHovering = false;
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    document.addEventListener('mouseleave', onMouseLeave);

    // Spring constants for tactile organic rebound
    const springK = 0.08;
    const damping = 0.82;
    const influenceSq = activeRadius * activeRadius;

    // Render loop
    const render = () => {
      // Smooth cursor lerp
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.18;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.18;

      ctx.clearRect(0, 0, width, height);

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      // Fast single-path batch for stationary resting dots
      ctx.beginPath();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';

      const activeDots: { x: number; y: number; radius: number; alpha: number }[] = [];

      for (let i = 0; i < dots.length; i++) {
        const dot = dots[i];

        const dx = dot.originX - mx;
        const dy = dot.originY - my;
        const distSq = dx * dx + dy * dy;

        let targetX = dot.originX;
        let targetY = dot.originY;
        let radius = baseRadius;
        let alpha = 0.22;

        const isNearCursor = distSq < influenceSq;

        if (isNearCursor) {
          const dist = Math.sqrt(distSq);
          const force = 1 - dist / activeRadius;
          const repulsion = force * force * maxDisplacement;

          if (dist > 0.001) {
            targetX = dot.originX + (dx / dist) * repulsion;
            targetY = dot.originY + (dy / dist) * repulsion;
          }

          radius = baseRadius + (maxRadius - baseRadius) * force;
          alpha = 0.22 + 0.73 * force; // Scales up to ~0.95 deep black
        }

        // Spring acceleration
        const ax = (targetX - dot.currentX) * springK;
        const ay = (targetY - dot.currentY) * springK;

        dot.vx = (dot.vx + ax) * damping;
        dot.vy = (dot.vy + ay) * damping;

        dot.currentX += dot.vx;
        dot.currentY += dot.vy;

        const isDisplaced =
          Math.abs(dot.currentX - dot.originX) > 0.15 ||
          Math.abs(dot.currentY - dot.originY) > 0.15 ||
          Math.abs(dot.vx) > 0.1 ||
          Math.abs(dot.vy) > 0.1;

        if (isNearCursor || isDisplaced) {
          activeDots.push({
            x: dot.currentX,
            y: dot.currentY,
            radius,
            alpha,
          });
        } else {
          // Batch resting dot
          ctx.moveTo(dot.originX + baseRadius, dot.originY);
          ctx.arc(dot.originX, dot.originY, baseRadius, 0, Math.PI * 2);
        }
      }

      // Draw all resting dots at once (massive GPU performance optimization)
      ctx.fill();

      // Draw active/moving dots with individual alphas and radii
      for (let j = 0; j < activeDots.length; j++) {
        const ad = activeDots[j];
        ctx.beginPath();
        ctx.arc(ad.x, ad.y, ad.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 0, 0, ${ad.alpha.toFixed(3)})`;
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseleave', onMouseLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, [spacing, baseRadius, maxRadius, activeRadius, maxDisplacement, backgroundColor]);

  return (
    <div
      className={`fixed inset-0 pointer-events-none z-0 overflow-hidden ${className}`}
      style={{ backgroundColor }}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
};

export default InteractiveDotGrid;
