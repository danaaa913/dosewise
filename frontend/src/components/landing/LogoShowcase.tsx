import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/Logo";

export function LogoShowcase({ alt }: { alt: string }) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const motion = useRef({ reduced: false, fine: false });
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const mqReduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mqFine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const sync = () => {
      motion.current.reduced = mqReduced.matches;
      motion.current.fine = mqFine.matches;
      if (motion.current.reduced) setTilt({ x: 0, y: 0 });
    };
    sync();
    mqReduced.addEventListener("change", sync);
    mqFine.addEventListener("change", sync);
    return () => {
      mqReduced.removeEventListener("change", sync);
      mqFine.removeEventListener("change", sync);
      cancelAnimationFrame(frame.current);
    };
  }, []);

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!motion.current.fine || motion.current.reduced) return;
    const el = sceneRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() =>
      setTilt({ x: ny * -8, y: nx * 8 })
    );
  }

  function onMouseLeave() {
    cancelAnimationFrame(frame.current);
    setTilt({ x: 0, y: 0 });
  }

  return (
    <div
      ref={sceneRef}
      role="img"
      aria-label={alt}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      className="relative mx-auto aspect-square w-full max-w-sm select-none [perspective:1100px] lg:max-w-md"
    >
      <div
        aria-hidden="true"
        className="absolute inset-10 rounded-full bg-[#3f8b8e]/15 blur-3xl"
      />

      <div
        className="absolute inset-0 flex items-center justify-center transition-transform duration-300 ease-out will-change-transform [transform-style:preserve-3d]"
        style={{ transform: `rotateX(${8 + tilt.x}deg) rotateY(${tilt.y}deg)` }}
      >
        <div
          aria-hidden="true"
          className="dw-orbit absolute size-[88%] rounded-full border border-[#2a5f66]/25"
        />
        <div
          aria-hidden="true"
          className="dw-orbit-rev absolute size-[66%] rounded-full border-2 border-[#3f8b8e]/20"
        />

        <div className="dw-float relative flex items-center justify-center">
          <Logo size={180} className="drop-shadow-xl" />
          <span
            aria-hidden="true"
            className="absolute start-2 top-6 size-3 rounded-full bg-[#3f8b8e]/60"
            style={{ transform: "translateZ(55px)" }}
          />
          <span
            aria-hidden="true"
            className="absolute bottom-8 end-2 size-2.5 rounded-full bg-[#1b3a5f]/40"
            style={{ transform: "translateZ(75px)" }}
          />
          <span
            aria-hidden="true"
            className="absolute -end-4 top-1/2 h-5 w-9 rounded-full border-2 border-[#2a5f66]/50 bg-white/90 shadow-sm"
            style={{ transform: "translateZ(40px) rotate(-18deg)" }}
          />
        </div>

        <div
          aria-hidden="true"
          className="absolute bottom-[10%] h-6 w-44 rounded-full bg-[#1b3a5f]/15 blur-md"
        />
      </div>
    </div>
  );
}
