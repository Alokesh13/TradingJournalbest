// @ts-nocheck
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, useScroll, useTransform, useInView, AnimatePresence } from "framer-motion";

interface LandingPageProps {
  onEnter: () => void;
}

// ── Animated Candlestick Chart ────────────────────────────────────────────────
function CandlestickChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>();
  const progressRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener("resize", resize);

    // Generate realistic XAUUSD-style candles
    const candles: { o: number; h: number; l: number; c: number; vol: number }[] = [];
    let price = 2048;
    for (let i = 0; i < 48; i++) {
      const open = price;
      const move = (Math.random() - 0.48) * 12;
      const close = open + move;
      const high = Math.max(open, close) + Math.random() * 6;
      const low = Math.min(open, close) - Math.random() * 6;
      candles.push({ o: open, h: high, l: low, c: close, vol: Math.random() });
      price = close;
    }

    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    const PAD = { top: 20, bottom: 40, left: 8, right: 8 };
    const chartH = H - PAD.top - PAD.bottom;
    const chartW = W - PAD.left - PAD.right;
    const candleW = (chartW / candles.length) * 0.6;
    const gap = (chartW / candles.length) * 0.4;

    const allPrices = candles.flatMap(c => [c.h, c.l]);
    const minP = Math.min(...allPrices) - 3;
    const maxP = Math.max(...allPrices) + 3;
    const priceRange = maxP - minP;

    const toY = (p: number) => PAD.top + chartH - ((p - minP) / priceRange) * chartH;
    const toX = (i: number) => PAD.left + i * (candleW + gap) + gap / 2;

    // Draw grid
    const drawGrid = () => {
      const levels = 5;
      ctx.strokeStyle = "rgba(99,102,241,0.06)";
      ctx.lineWidth = 0.5;
      for (let i = 0; i <= levels; i++) {
        const y = PAD.top + (chartH / levels) * i;
        ctx.beginPath();
        ctx.moveTo(PAD.left, y);
        ctx.lineTo(W - PAD.right, y);
        ctx.stroke();
        // Price label
        const price = maxP - ((maxP - minP) / levels) * i;
        ctx.fillStyle = "rgba(255,255,255,0.15)";
        ctx.font = "9px monospace";
        ctx.textAlign = "right";
        ctx.fillText(price.toFixed(0), W - 2, y + 3);
      }
    };

    // Animate candles appearing one by one
    const totalDuration = 3500;
    let startTime: number;

    const draw = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / totalDuration, 1);
      const visibleCount = Math.max(2, Math.floor(progress * candles.length));

      ctx.clearRect(0, 0, W, H);
      drawGrid();

      // Draw volume bars at bottom
      for (let i = 0; i < visibleCount; i++) {
        const c = candles[i];
        const x = toX(i);
        const isGreen = c.c >= c.o;
        const volH = c.vol * 25;
        ctx.fillStyle = isGreen ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)";
        ctx.fillRect(x, H - PAD.bottom - volH, candleW, volH);
      }

      // Draw candles
      for (let i = 0; i < visibleCount; i++) {
        const c = candles[i];
        const x = toX(i);
        const isGreen = c.c >= c.o;
        const isFading = i === visibleCount - 1 && progress < 1;

        const alpha = isFading ? 0.4 + 0.6 * ((progress * candles.length) % 1) : 1;
        const green = `rgba(16,185,129,${alpha})`;
        const red = `rgba(239,68,68,${alpha})`;
        const color = isGreen ? green : red;

        // Wick
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + candleW / 2, toY(c.h));
        ctx.lineTo(x + candleW / 2, toY(c.l));
        ctx.stroke();

        // Body
        const bodyTop = toY(Math.max(c.o, c.c));
        const bodyBot = toY(Math.min(c.o, c.c));
        const bodyH = Math.max(1.5, bodyBot - bodyTop);

        // Glow for last candle
        if (isFading) {
          ctx.shadowColor = isGreen ? "#10b981" : "#ef4444";
          ctx.shadowBlur = 8;
        }

        ctx.fillStyle = color;
        ctx.fillRect(x, bodyTop, candleW, bodyH);
        ctx.shadowBlur = 0;
      }

      // Draw price line (trailing)
      if (visibleCount >= 2) {
        const lastCandle = candles[visibleCount - 1];
        const lineY = toY(lastCandle.c);
        ctx.strokeStyle = lastCandle.c >= lastCandle.o ? "rgba(16,185,129,0.5)" : "rgba(239,68,68,0.5)";
        ctx.lineWidth = 0.8;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(PAD.left, lineY);
        ctx.lineTo(W - PAD.right, lineY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Current price badge
        const priceLabel = lastCandle.c.toFixed(2);
        const badgeW = 58;
        const isGreenC = lastCandle.c >= lastCandle.o;
        ctx.fillStyle = isGreenC ? "#10b981" : "#ef4444";
        ctx.beginPath();
        ctx.roundRect(W - PAD.right - badgeW, lineY - 9, badgeW, 18, 4);
        ctx.fill();
        ctx.fillStyle = "white";
        ctx.font = "bold 9px monospace";
        ctx.textAlign = "center";
        ctx.fillText(priceLabel, W - PAD.right - badgeW / 2, lineY + 3.5);
      }

      // Time labels at bottom
      const labelInterval = Math.floor(candles.length / 6);
      for (let i = 0; i < visibleCount; i += labelInterval) {
        const hour = 7 + Math.floor((i / candles.length) * 16);
        const label = `${hour}:00`;
        ctx.fillStyle = "rgba(255,255,255,0.2)";
        ctx.font = "8px monospace";
        ctx.textAlign = "center";
        ctx.fillText(label, toX(i) + candleW / 2, H - 6);
      }

      if (progress < 1) {
        animRef.current = requestAnimationFrame(draw);
      } else {
        // Loop after a pause
        setTimeout(() => {
          startTime = 0;
          progressRef.current = 0;
          animRef.current = requestAnimationFrame(draw);
        }, 2000);
      }
    };

    animRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animRef.current!);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-white/8"
      style={{ background: "rgba(8,10,20,0.95)", boxShadow: "0 0 60px rgba(99,102,241,0.08)" }}>
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
          </div>
          <span className="text-white/60 text-xs font-mono font-medium">XAUUSD · M5 · Live</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-emerald-400 text-xs font-mono font-bold">+$342.00</span>
          <span className="text-white/30 text-xs font-mono">▲ 0.68%</span>
        </div>
      </div>
      <canvas ref={canvasRef} className="w-full" style={{ height: "220px", display: "block" }} />
    </div>
  );
}

// Lock/unlock body scroll for landing vs dashboard
function useLandingScroll() {
  useEffect(() => {
    // Landing page: allow natural full-page scroll
    document.body.classList.remove("dashboard");
    document.body.classList.add("landing");
    document.documentElement.style.overflow = "auto";
    document.documentElement.style.height = "auto";
    document.body.style.overflow = "auto";
    document.body.style.height = "auto";
    return () => {
      // Cleanup when leaving landing page
      document.body.classList.remove("landing");
      document.documentElement.style.overflow = "";
      document.documentElement.style.height = "";
      document.body.style.overflow = "";
      document.body.style.height = "";
    };
  }, []);
}

// ── Hooks ─────────────────────────────────────────────────────────────────────
function useCounter(target: number, duration = 2000, active = false) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active) return;
    let st: number;
    const tick = (ts: number) => {
      if (!st) st = ts;
      const p = Math.min((ts - st) / duration, 1);
      setVal(Math.floor((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [active, target, duration]);
  return val;
}

// ── Particle Canvas ───────────────────────────────────────────────────────────
function ParticleField() {
  const ref = useRef<HTMLCanvasElement>(null);
  const mouse = useRef({ x: -999, y: -999 });

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    let raf: number;

    const resize = () => {
      c.width = c.offsetWidth;
      c.height = c.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const onMove = (e: MouseEvent) => {
      const r = c.getBoundingClientRect();
      mouse.current = { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    window.addEventListener("mousemove", onMove);

    const N = 90;
    const pts = Array.from({ length: N }, () => ({
      x: Math.random() * c.width,
      y: Math.random() * c.height,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      r: Math.random() * 1.2 + 0.4,
      hue: [260, 195, 160, 280, 220][Math.floor(Math.random() * 5)],
    }));

    const draw = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      const mx = mouse.current.x, my = mouse.current.y;

      pts.forEach(p => {
        // mouse repulsion
        const dx = p.x - mx, dy = p.y - my;
        const dist = Math.hypot(dx, dy);
        if (dist < 120) {
          p.vx += (dx / dist) * 0.04;
          p.vy += (dy / dist) * 0.04;
        }
        p.vx *= 0.98; p.vy *= 0.98;
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = c.width;
        if (p.x > c.width) p.x = 0;
        if (p.y < 0) p.y = c.height;
        if (p.y > c.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue},80%,72%,0.55)`;
        ctx.fill();
      });

      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
          if (d < 110) {
            ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.strokeStyle = `hsla(255,70%,70%,${0.12 * (1 - d / 110)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
    };
  }, []);

  return <canvas ref={ref} className="absolute inset-0 w-full h-full pointer-events-none" />;
}

// ── Animated Equity Curve ─────────────────────────────────────────────────────
function EquityCurve({ active }: { active: boolean }) {
  const [prog, setProg] = useState(0);
  useEffect(() => {
    if (!active) return;
    let s: number;
    const tick = (ts: number) => {
      if (!s) s = ts;
      const p = Math.min((ts - s) / 2200, 1);
      setProg(p);
      if (p < 1) requestAnimationFrame(tick);
    };
    const t = setTimeout(() => requestAnimationFrame(tick), 300);
    return () => clearTimeout(t);
  }, [active]);

  const raw = [18, 32, 24, 48, 38, 55, 44, 68, 58, 72, 62, 80, 74, 85, 78, 92, 86, 95];
  const total = raw.length - 1;
  const visible = Math.max(2, Math.floor(prog * total));
  const pts = raw.slice(0, visible + 1).map((v, i) => ({
    x: (i / total) * 100,
    y: 100 - v,
  }));
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const area = `${path} L${pts[pts.length - 1].x},100 L0,100 Z`;

  return (
    <div className="relative w-full h-32">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
        <defs>
          <linearGradient id="eg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <path d={area} fill="url(#eg)" />
        <path d={path} fill="none" stroke="#818cf8" strokeWidth="0.9" filter="url(#glow)" />
        {pts.length > 0 && (
          <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y}
            r="1.8" fill="#a5b4fc" filter="url(#glow)" />
        )}
      </svg>
    </div>
  );
}

// ── Dashboard Preview Card ────────────────────────────────────────────────────
function DashboardPreview({ active }: { active: boolean }) {
  const rows = [
    { asset: "XAUUSD", dir: "LONG", outcome: "Win", pl: "+$342", roi: "+2.8%" },
    { asset: "EURUSD", dir: "SHORT", outcome: "Loss", pl: "-$128", roi: "-1.1%" },
    { asset: "BTCUSD", dir: "LONG", outcome: "Win", pl: "+$891", roi: "+5.2%" },
    { asset: "NAS100", dir: "SHORT", outcome: "Win", pl: "+$214", roi: "+1.9%" },
  ];
  const stats = [
    { label: "Win Rate", value: "68%", color: "#10b981" },
    { label: "Total P&L", value: "+$4,821", color: "#6366f1" },
    { label: "Trades", value: "47", color: "#f59e0b" },
    { label: "Avg ROI", value: "+3.2%", color: "#06b6d4" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 60, rotateX: 15 }}
      animate={active ? { opacity: 1, y: 0, rotateX: 0 } : {}}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
      style={{ perspective: 1200 }}
      className="w-full max-w-3xl mx-auto"
    >
      <div className="relative rounded-2xl overflow-hidden border border-white/10"
        style={{
          background: "linear-gradient(135deg, rgba(15,15,30,0.95) 0%, rgba(10,10,22,0.98) 100%)",
          boxShadow: "0 0 0 1px rgba(99,102,241,0.15), 0 40px 80px rgba(0,0,0,0.6), 0 0 60px rgba(99,102,241,0.08)",
        }}>

        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
          <div className="w-3 h-3 rounded-full bg-red-500/70" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
          <div className="w-3 h-3 rounded-full bg-green-500/70" />
          <span className="ml-3 text-xs text-white/30 font-mono">TradeMirror — Dashboard</span>
        </div>

        <div className="p-5 space-y-4">
          {/* Stat tiles */}
          <div className="grid grid-cols-4 gap-3">
            {stats.map((s, i) => (
              <motion.div key={s.label}
                initial={{ opacity: 0, y: 20 }}
                animate={active ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.3 + i * 0.08, duration: 0.5 }}
                className="rounded-xl p-3 border border-white/5"
                style={{ background: "rgba(255,255,255,0.03)" }}>
                <p className="text-[10px] text-white/40 uppercase tracking-widest mb-1">{s.label}</p>
                <p className="text-base font-bold" style={{ color: s.color }}>{s.value}</p>
              </motion.div>
            ))}
          </div>

          {/* Chart */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={active ? { opacity: 1 } : {}}
            transition={{ delay: 0.6 }}
            className="rounded-xl p-4 border border-white/5"
            style={{ background: "rgba(255,255,255,0.02)" }}>
            <p className="text-xs text-white/40 mb-3 tracking-widest uppercase">Equity Curve</p>
            <EquityCurve active={active} />
          </motion.div>

          {/* Trade rows */}
          <div className="space-y-1.5">
            {rows.map((r, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={active ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.7 + i * 0.07, duration: 0.4 }}
                className="flex items-center justify-between px-3 py-2 rounded-lg border border-white/5 text-xs"
                style={{ background: "rgba(255,255,255,0.02)" }}>
                <span className="text-white/70 font-mono w-16">{r.asset}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${r.dir === "LONG" ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"}`}>
                  {r.dir}
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${r.outcome === "Win" ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"}`}>
                  {r.outcome}
                </span>
                <span className={`font-mono font-bold ${r.pl.startsWith("+") ? "text-emerald-400" : "text-rose-400"}`}>{r.pl}</span>
                <span className={`font-mono ${r.roi.startsWith("+") ? "text-emerald-400/70" : "text-rose-400/70"}`}>{r.roi}</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Glow reflection */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "linear-gradient(180deg, rgba(99,102,241,0.04) 0%, transparent 60%)" }} />
      </div>
    </motion.div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ children, className = "", delay = 0 }: { children: any; className?: string; delay?: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div ref={ref}
      initial={{ opacity: 0, y: 50 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay }}
      className={className}>
      {children}
    </motion.div>
  );
}

// ── Feature Card ──────────────────────────────────────────────────────────────
function FeatureCard({ icon, title, desc, color, delay }: any) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative rounded-2xl p-6 border cursor-default transition-all duration-300"
      style={{
        background: hovered
          ? `linear-gradient(135deg, rgba(${color},0.08) 0%, rgba(15,15,28,0.95) 100%)`
          : "rgba(255,255,255,0.02)",
        borderColor: hovered ? `rgba(${color},0.3)` : "rgba(255,255,255,0.06)",
        boxShadow: hovered ? `0 0 30px rgba(${color},0.1), 0 20px 40px rgba(0,0,0,0.3)` : "none",
        transform: hovered ? "translateY(-4px)" : "none",
      }}>
      <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 text-xl"
        style={{ background: `rgba(${color},0.12)`, border: `1px solid rgba(${color},0.2)` }}>
        {icon}
      </div>
      <h3 className="text-white font-semibold text-base mb-2 tracking-tight">{title}</h3>
      <p className="text-white/50 text-sm leading-relaxed">{desc}</p>
      {hovered && (
        <div className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{ background: `radial-gradient(circle at 30% 30%, rgba(${color},0.06), transparent 70%)` }} />
      )}
    </motion.div>
  );
}

// ── Calculator Card ───────────────────────────────────────────────────────────
function CalculatorCard() {
  const [balance, setBalance] = useState("10000");
  const [risk, setRisk] = useState("1");
  const [stopPips, setStopPips] = useState("50");
  const [displayInLots, setDisplayInLots] = useState(true);
  const [asset, setAsset] = useState("XAUUSD");

  const bal = parseFloat(balance) || 0;
  const rp = parseFloat(risk) || 0;
  const pips = parseFloat(stopPips) || 0;

  // Pip value varies by instrument
  const pipValues: Record<string, { pipValue: number; unit: string; hint: string }> = {
    XAUUSD: { pipValue: 0.10, unit: "oz", hint: "1 pip = $0.10 price movement in Gold" },
    EURUSD: { pipValue: 10, unit: "units", hint: "1 pip = $10 per standard lot" },
    GBPUSD: { pipValue: 10, unit: "units", hint: "1 pip = $10 per standard lot" },
    USDJPY: { pipValue: 9.1, unit: "units", hint: "1 pip ≈ $9.10 per standard lot" },
    BTCUSD: { pipValue: 1, unit: "BTC", hint: "1 pip = $1 price movement" },
    US30:   { pipValue: 1, unit: "units", hint: "1 pip = $1 per contract" },
  };
  const pv = pipValues[asset] || pipValues["EURUSD"];

  const riskAmt = bal * (rp / 100);
  const pipVal = pv.pipValue;
  const tradeSize = pips > 0 ? riskAmt / (pips * pipVal) : 0;
  const lots = tradeSize / 100000;
  const isValid = bal > 0 && rp > 0 && pips > 0;

  const inputClass = `w-full border rounded-xl px-4 py-3.5 text-white text-sm font-mono
    placeholder-white/20 focus:outline-none transition-all duration-200`;
  const inputStyle = {
    background: "rgba(255,255,255,0.04)",
    borderColor: "rgba(255,255,255,0.1)",
  };
  const inputFocusStyle = { borderColor: "rgba(245,158,11,0.5)", background: "rgba(245,158,11,0.04)" };

  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <motion.div ref={ref}
      initial={{ opacity: 0, y: 60 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="relative rounded-2xl overflow-hidden"
      style={{
        background: "linear-gradient(160deg, #0f1118 0%, #0a0d18 100%)",
        boxShadow: "0 0 0 1px rgba(245,158,11,0.12), 0 40px 80px rgba(0,0,0,0.6), 0 0 60px rgba(245,158,11,0.04)",
      }}>

      {/* Glow orb */}
      <div className="absolute top-0 right-0 w-64 h-64 pointer-events-none"
        style={{ background: "radial-gradient(circle at 80% 20%, rgba(245,158,11,0.07), transparent 70%)" }} />

      {/* Header */}
      <div className="px-7 pt-7 pb-5 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.2), rgba(239,68,68,0.15))", border: "1px solid rgba(245,158,11,0.25)" }}>
              <span className="text-base">🎯</span>
            </div>
            <div>
              <h3 className="text-white font-bold text-base tracking-tight">Position Size & Risk Management</h3>
              <p className="text-white/35 text-xs mt-0.5">Live calculation · Updates instantly</p>
            </div>
          </div>
          {/* Asset selector */}
          <select value={asset} onChange={e => setAsset(e.target.value)}
            className="text-xs font-mono text-white/60 rounded-lg px-2 py-1.5 focus:outline-none border border-white/8 cursor-pointer"
            style={{ background: "rgba(255,255,255,0.05)" }}>
            {Object.keys(pipValues).map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      <div className="p-7 space-y-5">
        {/* Account Balance */}
        <div>
          <label className="flex items-center gap-1.5 text-[11px] text-white/40 uppercase tracking-widest mb-2.5 font-semibold">
            <span className="text-amber-400">$</span> Account Balance (USD)
          </label>
          <input value={balance} onChange={e => setBalance(e.target.value)}
            className={inputClass} style={inputStyle}
            placeholder="10000" type="number" min="0" />
        </div>

        {/* Risk % */}
        <div>
          <label className="flex items-center gap-1.5 text-[11px] text-white/40 uppercase tracking-widest mb-2.5 font-semibold">
            <span className="text-amber-400">△</span> Risk Per Trade (%)
          </label>
          <input value={risk} onChange={e => setRisk(e.target.value)}
            className={inputClass} style={inputStyle}
            placeholder="1" type="number" min="0.1" max="100" step="0.1" />
        </div>

        {/* Stop Loss Pips */}
        <div>
          <label className="flex items-center gap-1.5 text-[11px] text-white/40 uppercase tracking-widest mb-2.5 font-semibold">
            <span className="text-amber-400">◎</span> Stop Loss (Pips)
          </label>
          <input value={stopPips} onChange={e => setStopPips(e.target.value)}
            className={inputClass} style={inputStyle}
            placeholder="50" type="number" min="1" step="1" />
          <p className="text-white/25 text-[11px] mt-1.5 font-mono">{pv.hint}</p>
        </div>

        {/* Display toggle */}
        <div className="flex items-center gap-3">
          <button onClick={() => setDisplayInLots(v => !v)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-200"
            style={{
              background: displayInLots ? "rgba(245,158,11,0.12)" : "rgba(255,255,255,0.04)",
              borderColor: displayInLots ? "rgba(245,158,11,0.35)" : "rgba(255,255,255,0.1)",
            }}>
            <div className="relative w-8 h-4 rounded-full transition-all duration-300"
              style={{ background: displayInLots ? "#f59e0b" : "rgba(255,255,255,0.15)" }}>
              <div className="absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all duration-300"
                style={{ left: displayInLots ? "17px" : "2px" }} />
            </div>
            <span className="text-xs text-white/60 font-medium">Display in Lots</span>
            <span className="text-[10px] text-white/30">(1 lot = 100,000 units)</span>
          </button>
        </div>

        {/* Results */}
        <div className="space-y-3 pt-1">
          {/* Risk Amount */}
          <div className="flex items-center justify-between px-5 py-4 rounded-xl border border-white/6"
            style={{ background: "rgba(255,255,255,0.02)" }}>
            <div>
              <p className="text-white/50 text-sm">Risk Amount</p>
            </div>
            <motion.p
              key={riskAmt.toFixed(2)}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-lg font-bold font-mono"
              style={{ color: "#f59e0b" }}>
              {isValid ? `$${riskAmt.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "$0.00"}
            </motion.p>
          </div>

          {/* Trade Size — hero result */}
          <div className="flex items-center justify-between px-5 py-5 rounded-xl border"
            style={{
              background: "linear-gradient(135deg, rgba(245,158,11,0.08), rgba(239,68,68,0.05))",
              borderColor: "rgba(245,158,11,0.2)",
              boxShadow: "0 0 30px rgba(245,158,11,0.06)",
            }}>
            <div>
              <p className="text-white/50 text-xs uppercase tracking-widest font-semibold mb-0.5">Trade Size</p>
            </div>
            <div className="text-right">
              <motion.div
                key={`${tradeSize.toFixed(2)}-${displayInLots}`}
                initial={{ y: -8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className="flex items-baseline gap-2">
                {isValid ? (
                  <>
                    <span className="text-3xl font-black font-mono text-amber-400">
                      {displayInLots ? lots.toFixed(2) : Math.round(tradeSize).toLocaleString()}
                    </span>
                    <span className="text-sm font-bold text-amber-400/60">
                      {displayInLots ? "lots" : "units"}
                    </span>
                  </>
                ) : (
                  <span className="text-2xl font-black font-mono text-white/20">—</span>
                )}
              </motion.div>
              {isValid && displayInLots && (
                <p className="text-white/35 text-[11px] mt-0.5 font-mono text-right">
                  = {Math.round(tradeSize).toLocaleString()} units
                </p>
              )}
            </div>
          </div>

          {/* Risk warning */}
          {isValid && rp > 2 && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-2.5 p-3.5 rounded-xl border border-amber-500/20"
              style={{ background: "rgba(245,158,11,0.06)" }}>
              <span className="text-amber-400 text-sm mt-0.5 flex-shrink-0">⚠</span>
              <p className="text-xs text-amber-400/75 leading-relaxed">
                Risking <strong>{rp}%</strong> per trade. Professional traders typically risk 0.5–2% per trade to protect their capital.
              </p>
            </motion.div>
          )}
          {!isValid && (
            <p className="text-center text-xs text-white/20 py-1 font-mono">
              Enter your account details above to calculate position size
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Ticker ────────────────────────────────────────────────────────────────────
function Ticker() {
  const items = [
    { pair: "XAUUSD", v: "+$342", c: "text-emerald-400" },
    { pair: "EURUSD", v: "-$128", c: "text-rose-400" },
    { pair: "BTCUSD", v: "+$1,240", c: "text-emerald-400" },
    { pair: "NAS100", v: "+$567", c: "text-emerald-400" },
    { pair: "GBPUSD", v: "-$89", c: "text-rose-400" },
    { pair: "USDJPY", v: "+$213", c: "text-emerald-400" },
    { pair: "US30",   v: "+$445", c: "text-emerald-400" },
    { pair: "ETHUSD", v: "-$321", c: "text-rose-400" },
  ];
  const doubled = [...items, ...items];

  return (
    <div className="overflow-hidden py-3 border-y border-white/5 relative">
      <div className="absolute left-0 top-0 bottom-0 w-20 z-10 pointer-events-none"
        style={{ background: "linear-gradient(to right, #060810, transparent)" }} />
      <div className="absolute right-0 top-0 bottom-0 w-20 z-10 pointer-events-none"
        style={{ background: "linear-gradient(to left, #060810, transparent)" }} />
      <motion.div
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
        className="flex gap-8 w-max">
        {doubled.map((item, i) => (
          <div key={i} className="flex items-center gap-2 whitespace-nowrap">
            <span className="text-xs font-mono text-white/50">{item.pair}</span>
            <span className={`text-xs font-mono font-bold ${item.c}`}>{item.v}</span>
            <span className="text-white/10 text-xs">·</span>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

// ── Floating Orbs ─────────────────────────────────────────────────────────────
function FloatingOrbs() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[
        { w: 700, h: 700, top: "-15%", left: "-10%", c1: "#6366f133", c2: "#818cf822", dur: 20 },
        { w: 500, h: 500, top: "50%", right: "-12%", c1: "#06b6d422", c2: "#10b98122", dur: 26 },
        { w: 450, h: 450, bottom: "-5%", left: "25%", c1: "#f59e0b18", c2: "#ef444418", dur: 22 },
      ].map((o, i) => (
        <motion.div key={i}
          className="absolute rounded-full"
          style={{
            width: o.w, height: o.h,
            top: o.top, left: o.left, right: o.right, bottom: o.bottom,
            background: `radial-gradient(circle, ${o.c1}, ${o.c2}, transparent 70%)`,
            filter: "blur(2px)",
          }}
          animate={{ scale: [1, 1.08, 1], rotate: [0, 8, 0], x: [0, 20, 0], y: [0, -15, 0] }}
          transition={{ duration: o.dur, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

// ── Testimonial Card ──────────────────────────────────────────────────────────
function TestimonialCard({ quote, name, role, stars, delay }: any) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay }}
      className="rounded-2xl p-6 border border-white/8 flex flex-col gap-4"
      style={{ background: "rgba(255,255,255,0.025)" }}>
      <div className="flex gap-1">
        {Array.from({ length: stars }).map((_, i) => (
          <span key={i} className="text-amber-400 text-sm">★</span>
        ))}
      </div>
      <p className="text-white/65 text-sm leading-relaxed italic">"{quote}"</p>
      <div>
        <p className="text-white font-semibold text-sm">{name}</p>
        <p className="text-white/35 text-xs mt-0.5">{role}</p>
      </div>
    </motion.div>
  );
}

// ── Stats Section ─────────────────────────────────────────────────────────────
function StatsSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const trades = useCounter(50000, 2000, inView);
  const traders = useCounter(2400, 2000, inView);
  const winRate = useCounter(68, 1500, inView);
  const rating = useCounter(49, 1200, inView);

  return (
    <div ref={ref} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[
        { val: trades.toLocaleString() + "+", label: "Trades Logged", color: "#6366f1" },
        { val: traders.toLocaleString() + "+", label: "Active Traders", color: "#10b981" },
        { val: winRate + "%", label: "Avg Win Rate", color: "#f59e0b" },
        { val: (rating / 10).toFixed(1) + "★", label: "User Rating", color: "#06b6d4" },
      ].map((s, i) => (
        <motion.div key={s.label}
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: i * 0.1, duration: 0.6 }}
          className="rounded-2xl p-6 text-center border border-white/6"
          style={{ background: "rgba(255,255,255,0.02)" }}>
          <p className="text-3xl lg:text-4xl font-bold mb-1" style={{ color: s.color }}>{s.val}</p>
          <p className="text-white/40 text-sm">{s.label}</p>
        </motion.div>
      ))}
    </div>
  );
}

// ── Main Landing Page ─────────────────────────────────────────────────────────
export default function LandingPage({ onEnter }: LandingPageProps) {
  const [scrolled, setScrolled] = useState(false);
  const [heroActive, setHeroActive] = useState(false);
  const { scrollYProgress } = useScroll();
  const heroRef = useRef(null);
  const heroInView = useInView(heroRef, { once: true });

  // ── SCROLL FIX: unlock body scroll for landing page ──────────────────────
  useLandingScroll();

  useEffect(() => {
    const t = setTimeout(() => setHeroActive(true), 400);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Parallax for hero
  const heroY = useTransform(scrollYProgress, [0, 0.3], [0, -80]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.25], [1, 0]);

  const features = [
    { icon: "📋", title: "Trade Checklist", desc: "Enforce discipline with a pre-trade checklist. Never enter a trade without confirming your setup rules first.", color: "99,102,241", delay: 0 },
    { icon: "📊", title: "Advanced Analytics", desc: "Track win rate, profit factor, Sharpe ratio, drawdown, and 12+ performance metrics across all your trades.", color: "16,185,129", delay: 0.08 },
    { icon: "🎯", title: "Position Calculator", desc: "Calculate optimal lot sizes based on account balance, risk percentage, entry, and stop loss in real-time.", color: "245,158,11", delay: 0.16 },
    { icon: "📸", title: "Screenshot Journal", desc: "Attach entry and exit chart screenshots to every trade. Build a visual library of your best and worst setups.", color: "6,182,212", delay: 0.24 },
    { icon: "📅", title: "Calendar Heatmap", desc: "See your P&L distribution across every day of the month. Identify your strongest and weakest trading days.", color: "239,68,68", delay: 0.32 },
    { icon: "🔐", title: "Private & Secure", desc: "Your journal is fully private. Data is encrypted locally with PBKDF2 hashing. Nobody else can see your trades.", color: "168,85,247", delay: 0.4 },
  ];

  return (
    <div className="min-h-screen text-white" style={{ background: "#060810", fontFamily: "'Inter', sans-serif" }}>

      {/* ── Fixed Navbar ──────────────────────────────────────────────────────── */}
      <motion.header
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style={{
          background: scrolled ? "rgba(6,8,16,0.92)" : "transparent",
          backdropFilter: scrolled ? "blur(20px)" : "none",
          borderBottom: scrolled ? "1px solid rgba(255,255,255,0.06)" : "1px solid transparent",
        }}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
              style={{ background: "linear-gradient(135deg, #6366f1, #818cf8)", boxShadow: "0 0 20px rgba(99,102,241,0.4)" }}>
              M
            </div>
            <span className="text-white font-bold text-lg tracking-tight">TradeMirror</span>
          </div>

          <nav className="hidden md:flex items-center gap-8">
            {["Features", "Calculator", "Pricing"].map(link => (
              <a key={link} href={`#${link.toLowerCase()}`}
                className="text-sm text-white/50 hover:text-white transition-colors duration-200 tracking-wide">
                {link}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <motion.button onClick={onEnter} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              className="text-sm text-white/60 hover:text-white transition-colors px-4 py-2">
              Sign In
            </motion.button>
            <motion.button onClick={onEnter} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              className="text-sm font-semibold px-5 py-2 rounded-xl transition-all duration-200"
              style={{
                background: "linear-gradient(135deg, #6366f1, #818cf8)",
                boxShadow: "0 0 20px rgba(99,102,241,0.35)",
              }}>
              Start Free
            </motion.button>
          </div>
        </div>
      </motion.header>

      {/* ── Hero ──────────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden pt-16">
        <FloatingOrbs />
        <ParticleField />

        {/* Grid overlay */}
        <div className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(rgba(99,102,241,0.04) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(99,102,241,0.04) 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }} />
        {/* Vignette */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 80% 80% at 50% 50%, transparent 40%, #060810 100%)" }} />

        <motion.div ref={heroRef} style={{ y: heroY, opacity: heroOpacity }}
          className="relative z-10 max-w-5xl mx-auto px-6 text-center">

          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-indigo-500/25 mb-8"
            style={{ background: "rgba(99,102,241,0.08)" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-indigo-300 font-medium tracking-widest uppercase">
              Professional Trading Journal
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="text-5xl md:text-7xl lg:text-8xl font-black mb-6 leading-[1.05] tracking-tight">
            <span className="text-white">Trade with</span>
            <br />
            <span style={{
              background: "linear-gradient(135deg, #818cf8 0%, #6366f1 40%, #06b6d4 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>
              discipline.
            </span>
          </motion.h1>

          {/* Sub */}
          <motion.p
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.35 }}
            className="text-lg md:text-xl text-white/45 max-w-2xl mx-auto mb-10 leading-relaxed">
            Journal every trade, enforce your checklist, track analytics, and improve your execution —
            all in one premium platform built for serious traders.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <motion.button onClick={onEnter} whileHover={{ scale: 1.03, boxShadow: "0 0 40px rgba(99,102,241,0.5)" }}
              whileTap={{ scale: 0.97 }}
              className="px-8 py-4 rounded-2xl text-base font-bold text-white relative overflow-hidden group"
              style={{
                background: "linear-gradient(135deg, #6366f1 0%, #818cf8 50%, #6366f1 100%)",
                backgroundSize: "200% 100%",
                boxShadow: "0 0 30px rgba(99,102,241,0.4), 0 4px 20px rgba(0,0,0,0.3)",
              }}>
              <span className="relative z-10">Start Journaling Trades →</span>
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ background: "linear-gradient(135deg, #818cf8, #6366f1)" }} />
            </motion.button>

            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              className="px-8 py-4 rounded-2xl text-base font-semibold text-white/70 border border-white/10 hover:border-white/20 hover:text-white transition-all duration-200"
              style={{ background: "rgba(255,255,255,0.03)" }}>
              See Features ↓
            </motion.button>
          </motion.div>

          {/* Dashboard preview */}
          <DashboardPreview active={heroActive} />

          {/* Candlestick chart below hero */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="mt-8 w-full max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-white/40 text-xs font-mono tracking-wide">Live Market Preview</span>
              </div>
              <div className="flex items-center gap-3">
                {["M1","M5","M15","H1"].map((tf, i) => (
                  <span key={tf} className={`text-xs font-mono cursor-pointer transition-colors ${i === 1 ? "text-indigo-400 font-bold" : "text-white/25 hover:text-white/50"}`}>{tf}</span>
                ))}
              </div>
            </div>
            <CandlestickChart />
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ delay: 1.8 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
          <span className="text-xs text-white/25 tracking-widest uppercase">Scroll</span>
          <motion.div animate={{ y: [0, 6, 0] }} transition={{ duration: 1.5, repeat: Infinity }}
            className="w-px h-8 bg-gradient-to-b from-white/30 to-transparent" />
        </motion.div>
      </section>

      {/* ── Ticker ────────────────────────────────────────────────────────────── */}
      <Ticker />

      {/* ── Stats ─────────────────────────────────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <StatsSection />
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────────────────── */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <Section className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/8 mb-6"
              style={{ background: "rgba(255,255,255,0.03)" }}>
              <span className="text-xs text-white/40 tracking-widest uppercase">Features</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-4">
              Everything you need to{" "}
              <span style={{
                background: "linear-gradient(135deg, #818cf8, #06b6d4)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>
                improve
              </span>
            </h2>
            <p className="text-white/40 text-lg max-w-xl mx-auto">
              A complete trading toolkit designed to build discipline and consistency in your execution.
            </p>
          </Section>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map(f => (
              <FeatureCard key={f.title} {...f} />
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────────────── */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(99,102,241,0.06), transparent)" }} />
        <div className="max-w-6xl mx-auto relative">
          <Section className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-4">
              Built for the way{" "}
              <span style={{
                background: "linear-gradient(135deg, #10b981, #06b6d4)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>
                pros trade
              </span>
            </h2>
            <p className="text-white/40 text-lg">Three simple steps to transform your trading performance.</p>
          </Section>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { step: "01", title: "Set Your Rules", desc: "Define your trading checklist — your personal rules for entering a trade. Never break discipline again.", icon: "📋", color: "#6366f1" },
              { step: "02", title: "Log Every Trade", desc: "Record your trades in seconds — asset, direction, P&L, emotion, screenshots, and notes all in one place.", icon: "✍️", color: "#10b981" },
              { step: "03", title: "Analyse & Improve", desc: "Review your analytics dashboard weekly. Spot patterns, identify weaknesses, and grow consistently.", icon: "📈", color: "#f59e0b" },
            ].map((item, i) => (
              <Section key={item.step} delay={i * 0.12}
                className="relative rounded-2xl p-8 border border-white/8"
                style={{ background: "rgba(255,255,255,0.02)" } as any}>
                <div className="text-5xl mb-6">{item.icon}</div>
                <div className="text-xs font-mono mb-3 tracking-widest" style={{ color: item.color }}>{item.step}</div>
                <h3 className="text-white font-bold text-xl mb-3">{item.title}</h3>
                <p className="text-white/45 text-sm leading-relaxed">{item.desc}</p>
                <div className="absolute top-6 right-6 text-4xl font-black opacity-5 text-white">{item.step}</div>
              </Section>
            ))}
          </div>
        </div>
      </section>

      {/* ── Calculator ────────────────────────────────────────────────────────── */}
      <section id="calculator" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <Section className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/8 mb-6"
              style={{ background: "rgba(255,255,255,0.03)" }}>
              <span className="text-xs text-white/40 tracking-widest uppercase">Free Tool</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-4">
              Position Sizing{" "}
              <span style={{
                background: "linear-gradient(135deg, #f59e0b, #ef4444)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>
                Calculator
              </span>
            </h2>
            <p className="text-white/40 text-lg max-w-lg mx-auto">
              Try it live. Calculate your exact position size based on risk management rules.
            </p>
          </Section>
          <CalculatorCard />
        </div>
      </section>

      {/* ── Testimonials ──────────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <Section className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-4">
              Traders who{" "}
              <span style={{
                background: "linear-gradient(135deg, #f59e0b, #06b6d4)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>
                improved
              </span>
            </h2>
          </Section>
          <div className="grid md:grid-cols-3 gap-5">
            <TestimonialCard delay={0}
              quote="TradeMirror completely changed how I approach risk. The checklist forces me to slow down and actually follow my strategy. My win rate went from 52% to 71% in 3 months."
              name="Marcus T." role="Forex Trader · 4 years" stars={5} />
            <TestimonialCard delay={0.1}
              quote="The analytics are insane. I discovered I was profitable on Tuesdays and Wednesdays but always lost on Fridays. I just stopped trading Fridays. Completely fixed my drawdown."
              name="Priya S." role="Indices Trader · London" stars={5} />
            <TestimonialCard delay={0.2}
              quote="Position sizing calculator alone is worth it. I was over-leveraging on gold trades. Now I never risk more than 1.5% and my equity curve is finally smooth."
              name="David R." role="XAUUSD Specialist" stars={5} />
          </div>
        </div>
      </section>

      {/* ── Pricing ───────────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 70% 50% at 50% 50%, rgba(99,102,241,0.05), transparent)" }} />
        <div className="max-w-5xl mx-auto relative">
          <Section className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-4">Simple pricing</h2>
            <p className="text-white/40 text-lg">Start free. Upgrade when you're ready to go deeper.</p>
          </Section>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                name: "Free", price: "$0", period: "forever",
                color: "#10b981", popular: false,
                features: ["Up to 20 trades/month", "Basic journal", "EST timestamps", "JSON export", "Position calculator"],
              },
              {
                name: "Pro", price: "$19", period: "/month",
                color: "#6366f1", popular: true,
                features: ["Unlimited trades", "All 8+ charts", "Screenshot uploads", "Calendar heatmap", "Trade checklist", "Priority support", "Data portability"],
              },
              {
                name: "Elite", price: "$49", period: "/month",
                color: "#f59e0b", popular: false,
                features: ["Everything in Pro", "Multi-account", "AI pattern insights", "Sharpe ratio calc", "Custom API access", "1-on-1 onboarding"],
              },
            ].map((plan, i) => (
              <Section key={plan.name} delay={i * 0.1}
                className={`relative rounded-2xl p-7 border ${plan.popular ? "border-indigo-500/40" : "border-white/8"}`}
                style={{
                  background: plan.popular
                    ? "linear-gradient(135deg, rgba(99,102,241,0.1), rgba(10,10,22,0.98))"
                    : "rgba(255,255,255,0.02)",
                  boxShadow: plan.popular ? "0 0 40px rgba(99,102,241,0.15), 0 0 0 1px rgba(99,102,241,0.2)" : "none",
                } as any}>
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-4 py-1 rounded-full text-xs font-bold text-white"
                      style={{ background: "linear-gradient(135deg, #6366f1, #818cf8)" }}>
                      Most Popular
                    </span>
                  </div>
                )}
                <div className="mb-6">
                  <p className="text-white/50 text-sm mb-2">{plan.name}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black text-white">{plan.price}</span>
                    <span className="text-white/40 text-sm">{plan.period}</span>
                  </div>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-white/60">
                      <span className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 text-[10px]"
                        style={{ background: `rgba(${plan.color === "#10b981" ? "16,185,129" : plan.color === "#6366f1" ? "99,102,241" : "245,158,11"},0.15)`, color: plan.color }}>
                        ✓
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                <motion.button onClick={onEnter} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  className="w-full py-3 rounded-xl text-sm font-bold transition-all duration-200"
                  style={plan.popular ? {
                    background: "linear-gradient(135deg, #6366f1, #818cf8)",
                    color: "white",
                    boxShadow: "0 0 20px rgba(99,102,241,0.3)",
                  } : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  {plan.name === "Free" ? "Get Started Free" : `Get ${plan.name}`}
                </motion.button>
              </Section>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────────────────────────────── */}
      <section className="py-32 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <Section>
            <div className="relative rounded-3xl p-16 border border-indigo-500/20 overflow-hidden"
              style={{
                background: "linear-gradient(135deg, rgba(99,102,241,0.08), rgba(6,8,16,0.95))",
                boxShadow: "0 0 80px rgba(99,102,241,0.1)",
              }}>
              <div className="absolute inset-0 pointer-events-none"
                style={{ background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(99,102,241,0.12), transparent)" }} />
              <div className="relative z-10">
                <div className="text-5xl mb-6">🪞</div>
                <h2 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight">
                  Reflect. Improve.{" "}
                  <span style={{
                    background: "linear-gradient(135deg, #818cf8, #06b6d4)",
                    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                  }}>
                    Win.
                  </span>
                </h2>
                <p className="text-white/45 text-lg mb-10 max-w-lg mx-auto leading-relaxed">
                  Join traders who use TradeMirror to enforce discipline, understand their edge, and grow their accounts systematically.
                </p>
                <motion.button onClick={onEnter} whileHover={{ scale: 1.03, boxShadow: "0 0 50px rgba(99,102,241,0.5)" }}
                  whileTap={{ scale: 0.97 }}
                  className="px-10 py-5 rounded-2xl text-base font-bold text-white"
                  style={{
                    background: "linear-gradient(135deg, #6366f1, #818cf8)",
                    boxShadow: "0 0 30px rgba(99,102,241,0.4)",
                  }}>
                  Start Journaling Trades — Free →
                </motion.button>
                <p className="text-white/25 text-xs mt-5">No credit card required · 2 minute setup</p>
              </div>
            </div>
          </Section>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold"
              style={{ background: "linear-gradient(135deg, #6366f1, #818cf8)" }}>M</div>
            <span className="text-white/50 text-sm">TradeMirror</span>
            <span className="text-white/20 text-sm ml-2">© 2026</span>
          </div>
          <div className="flex items-center gap-6">
            {["Privacy Policy", "Terms of Service", "Contact"].map(l => (
              <a key={l} href="#" className="text-xs text-white/30 hover:text-white/60 transition-colors">{l}</a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
