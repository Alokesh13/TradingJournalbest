import { ChangeEvent, FormEvent, ReactNode, useEffect, useMemo, useState, useRef } from "react";
import Login from "./components/Login";
import { supabase } from "./lib/supabase";

type AuthMode = "login" | "signup";
type View = "dashboard" | "add" | "analytics";
type Direction = "LONG" | "SHORT";
type TradeType = "Exit" | "Stop Loss" | "Take Profit";
type Outcome = "Win" | "Loss" | "Breakeven";
type ScreenshotCategory = "entry" | "exit" | "review";

type Trade = {
  id: string;
  startDate: string;
  endDate: string;
  asset: string;
  timeframe: string;
  direction: Direction;
  type: TradeType;
  lotSize: number | null; // Changed to null by default
  ruleFollowed: boolean;
  outcome: Outcome;
  roi: number;
  pnl: number;
  rating: number;
  entryPrice: number;
  exitPrice: number;
  riskReward: number;
  strategy: string;
  notes: string;
  emotion: string;
  mistakes: string;
  lessons: string;
  screenshots: Record<ScreenshotCategory, string[]>;
};

type UserAccount = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  salt: string;
  trades: Trade[];
  legacyPassword?: string;
};

type AuthFormState = {
  name: string;
  email: string;
  password: string;
};

type TradeFormState = {
  startDate: string;
  endDate: string;
  asset: string;
  timeframe: string;
  direction: Direction;
  type: TradeType;
  lotSize: string;
  ruleFollowed: boolean;
  outcome: Outcome;
  roi: string;
  pnl: string;
  rating: number;
  strategy: string;
  notes: string;
  emotion: string;
  mistakes: string;
  lessons: string;
  screenshots: Record<ScreenshotCategory, string[]>;
};

type Filters = {
  asset: string;
  strategy: string;
  outcome: string;
  direction: string;
  startDate: string;
  endDate: string;
};

type TradeAnalytics = {
  totalTrades: number;
  totalPnL: number;
  winRate: number;
  averageROI: number;
  bestTrade: Trade | null;
  worstTrade: Trade | null;
  profitByMonth: { month: string; value: number }[];
  winRateByStrategy: { strategy: string; winRate: number; total: number }[];
  outcomeBreakdown: { label: Outcome; value: number; color: string }[];
  equityCurve: { label: string; value: number }[];
  hourlyPerformance: { hour: string; value: number }[];
  weekdayPerformance: { day: string; value: number; count: number }[];
  expectancy: number;
  drawdownCurve: { label: string; value: number }[];
  profitByAsset: { asset: string; value: number }[];
  durationVsPnL: { duration: number; pnl: number; asset: string; outcome: Outcome }[];
};

const USERS_STORAGE = "tradetracker-users";
const SESSION_STORAGE = "tradetracker-session";
const EST_TIMEZONE = "America/New_York";

const timeframeOptions = ["1m", "5m", "15m", "1h", "4h", "1D"];
const strategyOptions = ["London Breakout", "VWAP Reclaim", "Range Fade", "Trend Continuation", "Liquidity Sweep"];
const emotionOptions = ["Calm", "Confident", "FOMO", "Hesitant", "Focused", "Overtrading"];
const assetsPreset = ["XAUUSD", "BTCUSD", "EURUSD", "NAS100", "SPX500"];

function createId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readLocalStorage(key: string) {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(key);
}

function emptyTradeForm(): TradeFormState {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const localDate = new Date(now.getTime() - offset * 60_000);
  const dateStr = localDate.toISOString().slice(0, 16);

  return {
    startDate: dateStr,
    endDate: dateStr,
    asset: "XAUUSD",
    timeframe: "1m", // Default 1 minute
    direction: "LONG",
    type: "Take Profit",
    lotSize: "", // Blank by default
    ruleFollowed: true,
    outcome: "Win",
    roi: "",
    pnl: "",
    rating: 4,
    strategy: "",
    notes: "",
    emotion: "Focused",
    mistakes: "",
    lessons: "",
    screenshots: {
      entry: [],
      exit: [],
      review: [],
    },
  };
}

function sampleTrades(): Trade[] {
  return [];
}

function loadUsers(): UserAccount[] {
  const stored = readLocalStorage(USERS_STORAGE);

  if (!stored) {
    return [];
  }

  try {
    const parsed = JSON.parse(stored) as Array<
      Partial<UserAccount> & {
        password?: string;
        trades?: Trade[];
      }
    >;

    return parsed.map((user) => ({
      id: user.id ?? createId(),
      name: user.name ?? "Trader",
      email: user.email ?? "",
      passwordHash: user.passwordHash ?? "",
      salt: user.salt ?? "",
      trades: user.trades ?? [],
      legacyPassword: user.password,
    }));
  } catch {
    return [];
  }
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatEST(dateString: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: EST_TIMEZONE,
    ...options,
  }).format(new Date(dateString));
}

function formatESTRange(startDate: string, endDate: string) {
  const startLabel = formatEST(startDate, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const endLabel = formatEST(endDate, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  if (startLabel === endLabel) {
    return `${startLabel} ${formatEST(startDate, { hour: "numeric", minute: "2-digit", hour12: true })} -> ${formatEST(endDate, {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })} ET`;
  }

  return `${formatEST(startDate, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })} -> ${formatEST(endDate, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })} ET`;
}

function sumProfit(trades: Trade[]) {
  return trades.reduce((total, trade) => total + trade.pnl, 0);
}

function countWins(trades: Trade[]) {
  return trades.filter((trade) => trade.outcome === "Win").length;
}

function getOutcomeClass(outcome: Outcome) {
  if (outcome === "Win") {
    return "bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-300/20";
  }

  if (outcome === "Loss") {
    return "bg-rose-400/15 text-rose-200 ring-1 ring-rose-300/20";
  }

  return "bg-slate-300/10 text-slate-200 ring-1 ring-white/10";
}

function getDirectionClass(direction: Direction) {
  return direction === "LONG"
    ? "bg-sky-400/15 text-sky-200 ring-1 ring-sky-300/20"
    : "bg-amber-300/15 text-amber-100 ring-1 ring-amber-200/20";
}

function toDataUrls(files: FileList | null) {
  if (!files || files.length === 0) {
    return Promise.resolve([] as string[]);
  }

  return Promise.all(
    Array.from(files).map(
      (file) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error(`Unable to read file: ${file.name}`));
          reader.readAsDataURL(file);
        }),
    ),
  );
}

function getESTHour(dateString: string) {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: EST_TIMEZONE,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date(dateString)),
  );
}

function getESTDate(dateString: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: EST_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(dateString));
}

function buildTradeAnalytics(trades: Trade[]): TradeAnalytics {
  const totalTrades = trades.length;
  const totalPnL = sumProfit(trades);
  const wins = countWins(trades);
  const winRate = totalTrades === 0 ? 0 : (wins / totalTrades) * 100;
  const averageROI = totalTrades === 0 ? 0 : trades.reduce((total, trade) => total + trade.roi, 0) / totalTrades;
  const bestTrade = [...trades].sort((a, b) => b.pnl - a.pnl)[0] ?? null;
  const worstTrade = [...trades].sort((a, b) => a.pnl - b.pnl)[0] ?? null;

  const profitByMonth = Object.entries(
    trades.reduce<Record<string, number>>((accumulator, trade) => {
      const month = formatEST(trade.startDate, { month: "short", year: "numeric" });
      accumulator[month] = (accumulator[month] ?? 0) + trade.pnl;
      return accumulator;
    }, {}),
  ).map(([month, value]) => ({ month, value }));

  const winRateByStrategy = Object.entries(
    trades.reduce<Record<string, { total: number; wins: number }>>((accumulator, trade) => {
      const current = accumulator[trade.strategy] ?? { total: 0, wins: 0 };
      current.total += 1;
      current.wins += trade.outcome === "Win" ? 1 : 0;
      accumulator[trade.strategy] = current;
      return accumulator;
    }, {}),
  )
    .map(([strategy, value]) => ({
      strategy,
      total: value.total,
      winRate: value.total === 0 ? 0 : Math.round((value.wins / value.total) * 100),
    }))
    .sort((a, b) => b.winRate - a.winRate);

  const outcomeBreakdown: { label: Outcome; value: number; color: string }[] = [
    { label: "Win", value: trades.filter((trade) => trade.outcome === "Win").length, color: "#34d399" },
    { label: "Loss", value: trades.filter((trade) => trade.outcome === "Loss").length, color: "#fb7185" },
    { label: "Breakeven", value: trades.filter((trade) => trade.outcome === "Breakeven").length, color: "#94a3b8" },
  ];

  const sortedTrades = [...trades].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  
  let runningTotal = 0;
  let peakValue = 0;
  const equityCurve = [];
  const drawdownCurve = [];

  for (const trade of sortedTrades) {
    runningTotal += trade.pnl;
    if (runningTotal > peakValue) peakValue = runningTotal;
    
    const drawdown = peakValue === 0 ? 0 : runningTotal - peakValue;

    equityCurve.push({
      label: formatEST(trade.startDate, { month: "short", day: "numeric" }),
      value: runningTotal,
    });
    
    drawdownCurve.push({
      label: formatEST(trade.startDate, { month: "short", day: "numeric" }),
      value: drawdown,
    });
  }

  const profitByAsset = Object.entries(
    trades.reduce<Record<string, number>>((acc, t) => {
      acc[t.asset] = (acc[t.asset] ?? 0) + t.pnl;
      return acc;
    }, {})
  ).map(([asset, value]) => ({ asset, value }))
   .sort((a, b) => b.value - a.value);

  const durationVsPnL = trades.map((t) => {
    const start = new Date(t.startDate).getTime();
    const end = new Date(t.endDate).getTime();
    const duration = Math.max(0, (end - start) / 60000); // minutes
    return {
      duration,
      pnl: t.pnl,
      asset: t.asset,
      outcome: t.outcome
    };
  });

  const hourlyMap = Array.from({ length: 24 }, (_, index) => ({
    hour: `${String(index).padStart(2, "0")}:00`,
    value: 0,
  }));

  trades.forEach((trade) => {
    hourlyMap[getESTHour(trade.startDate)].value += trade.pnl;
  });

  return {
    totalTrades,
    totalPnL,
    winRate,
    averageROI,
    bestTrade,
    worstTrade,
    profitByMonth,
    winRateByStrategy,
    outcomeBreakdown,
    equityCurve,
    hourlyPerformance: hourlyMap,
    weekdayPerformance: calculateWeekdayPerformance(trades),
    expectancy: calculateExpectancy(trades),
    drawdownCurve,
    profitByAsset,
    durationVsPnL,
  };
}

function calculateWeekdayPerformance(trades: Trade[]) {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const map = days.map((day) => ({ day, value: 0, count: 0 }));

  trades.forEach((trade) => {
    // Use startDate for the day of the week
    const date = new Date(trade.startDate);
    // Adjust to EST for correct day bucket
    const estDate = new Date(date.toLocaleString("en-US", { timeZone: EST_TIMEZONE }));
    const dayIndex = estDate.getDay();
    map[dayIndex].value += trade.pnl;
    map[dayIndex].count += 1;
  });

  // Filter out Sunday/Saturday if no trades, but typically keep Mon-Fri
  return map.filter((d) => d.count > 0 || (d.day !== "Sunday" && d.day !== "Saturday"));
}

function calculateExpectancy(trades: Trade[]) {
  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl <= 0);

  if (wins.length === 0 && losses.length === 0) return 0;

  const avgWin = wins.length > 0 ? wins.reduce((sum, t) => sum + t.pnl, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0)) / losses.length : 0;
  const winRate = wins.length / trades.length;
  const lossRate = losses.length / trades.length;

  return winRate * avgWin - lossRate * avgLoss;
}

function arrayBufferToHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function generateSalt() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return arrayBufferToHex(bytes.buffer);
}

async function hashPassword(password: string, salt: string) {
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode(salt),
      iterations: 120000,
      hash: "SHA-256",
    },
    keyMaterial,
    256,
  );

  return arrayBufferToHex(bits);
}

async function createPasswordRecord(password: string) {
  const salt = generateSalt();
  const passwordHash = await hashPassword(password, salt);
  return { salt, passwordHash };
}

function downloadBlob(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function iconifyEditDeleteButtons() {
  const buttons = Array.from(document.querySelectorAll("button"));

  buttons.forEach((button) => {
    const label = button.textContent?.trim();
    if ((label !== "Edit" && label !== "Delete") || button.dataset.iconified === "true") {
      return;
    }

    const isEdit = label === "Edit";
    button.dataset.iconified = "true";
    button.setAttribute("aria-label", isEdit ? "Edit trade" : "Delete trade");
    button.setAttribute("title", isEdit ? "Edit trade" : "Delete trade");
    button.classList.add("inline-flex", "items-center", "justify-center", "p-2");
    button.innerHTML = isEdit
      ? '<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 20h4l10-10-4-4L4 16v4z"></path><path d="M13 7l4 4"></path></svg>'
      : '<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 7h16"></path><path d="M9 7V5h6v2"></path><path d="M7 7l1 13h8l1-13"></path><path d="M10 11v6M14 11v6"></path></svg>';
  });
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1 text-amber-300">
      {Array.from({ length: 5 }, (_, index) => (
        <svg
          key={index}
          viewBox="0 0 20 20"
          fill={index < rating ? "currentColor" : "none"}
          className={`h-4 w-4 ${index < rating ? "text-amber-300" : "text-slate-600"}`}
          stroke="currentColor"
          strokeWidth="1.25"
        >
          <path d="M10 1.8l2.52 5.11 5.64.82-4.08 3.97.96 5.61L10 14.64 4.96 17.3l.96-5.61L1.84 7.73l5.64-.82L10 1.8z" />
        </svg>
      ))}
    </div>
  );
}

function SectionCard({
  title,
  eyebrow,
  action,
  children,
  className = "",
}: {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,19,29,0.92),rgba(8,11,17,0.96))] p-5 shadow-[0_26px_80px_rgba(0,0,0,0.42)] md:p-6 ${className}`}>
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          {eyebrow ? <p className="text-[11px] uppercase tracking-[0.34em] text-cyan-200/65">{eyebrow}</p> : null}
          <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-white">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function StatTile({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  accent: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm">
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accent}`} />
      <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">{label}</p>
      <p className="mt-4 font-display text-3xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm text-slate-300">{hint}</p>
    </div>
  );
}

function InlineEdit({
  value,
  onSave,
  type = "text",
  options,
  formatType = "none",
}: {
  value: string | number;
  onSave: (val: string) => void;
  type?: "text" | "number" | "select" | "textarea" | "datetime-local" | "date";
  options?: string[];
  formatType?: "currency" | "percent" | "none";
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value));

  const handleBlur = () => {
    setIsEditing(false);
    if (editValue !== String(value)) {
      onSave(editValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && type !== "textarea") {
      handleBlur();
    }
    if (e.key === "Escape") {
      setEditValue(String(value));
      setIsEditing(false);
    }
  };

  if (isEditing) {
    if (type === "select" && options) {
      return (
        <select
          autoFocus
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleBlur}
          className="w-full bg-slate-900 text-white border border-cyan-500 rounded px-1 outline-none text-right"
        >
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    }

    if (type === "textarea") {
      return (
        <textarea
          autoFocus
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="w-full bg-slate-900 text-white border border-cyan-500 rounded p-2 outline-none min-h-[100px] text-left"
        />
      );
    }

    return (
      <input
        autoFocus
        type={type}
        step="any"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="w-full bg-slate-900 text-white border border-cyan-500 rounded px-1 outline-none text-right"
      />
    );
  }

  let displayValue = String(value);
  if (formatType === "currency") {
    displayValue = formatCurrency(Number(value) || 0);
  } else if (formatType === "percent") {
    displayValue = formatPercent(Number(value) || 0);
  } else if (type === "datetime-local" || type === "date") {
    displayValue = new Date(String(value)).toLocaleString("en-US", { 
      timeZone: EST_TIMEZONE,
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    }) + " ET";
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      className="cursor-pointer hover:bg-white/5 rounded px-1 -mx-1 transition min-h-[1.5em] flex items-center justify-end"
      title="Click to edit"
    >
      {displayValue}
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-2 text-sm text-slate-300">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/60"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

import {
  Area,
  AreaChart,
  Cell,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
} from "recharts";

function MiniLineChart({ data }: { data: { label: string; value: number }[] }) {
  const [activePoint, setActivePoint] = useState<{ label: string; value: number } | null>(null);

  if (data.length === 0) {
    return (
      <div className="flex h-52 items-center justify-center rounded-[24px] border border-dashed border-white/10 text-sm text-slate-500">
        Add trades to build your equity curve.
      </div>
    );
  }

  const lastValue = data[data.length - 1]?.value ?? 0;
  const minValue = Math.min(...data.map((d) => d.value), 0);
  const maxValue = Math.max(...data.map((d) => d.value), 0);

  // Handle touch events
  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    const chartContainer = e.currentTarget.querySelector('.recharts-wrapper');
    if (!chartContainer) return;

    const rect = chartContainer.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    
    // Calculate which data point is closest
    const chartWidth = rect.width;
    const index = Math.round((x / chartWidth) * (data.length - 1));
    const clampedIndex = Math.max(0, Math.min(index, data.length - 1));
    
    setActivePoint(data[clampedIndex]);
  };

  const handleTouchEnd = () => {
    // Keep the point visible for a moment, then clear
    setTimeout(() => setActivePoint(null), 3000);
  };

  const handleClick = (e: any) => {
    if (e && e.activeLabel && e.activePayload && e.activePayload.length > 0) {
      setActivePoint({
        label: e.activeLabel,
        value: e.activePayload[0].value
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.26em] text-slate-400">
            Equity curve
          </p>
          <p className="mt-2 font-display text-3xl text-white">
            {formatCurrency(activePoint ? activePoint.value : lastValue)}
          </p>
          {activePoint && (
            <p className="mt-1 text-sm text-cyan-300">
              {activePoint.label}
            </p>
          )}
        </div>
        <p className="text-sm text-slate-300">
          Running account balance based on recorded trades
        </p>
      </div>
      
      <div 
        className="relative h-64 overflow-hidden rounded-[24px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.1),transparent_50%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] p-4 pt-6"
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchStart={handleTouchMove}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart 
            data={data}
            onClick={handleClick}
            margin={{ top: 20, right: 20, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="label"
              hide={true}
            />
            <YAxis hide={true} domain={[minValue, maxValue]} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="rounded-xl border border-white/10 bg-slate-900/95 p-3 shadow-xl backdrop-blur-md">
                      <p className="text-xs font-medium text-slate-400 mb-1">
                        {label}
                      </p>
                      <p className="font-display text-lg font-semibold text-white">
                        {formatCurrency(payload[0].value as number)}
                      </p>
                      <p className="text-xs text-cyan-300 mt-1">
                        Tap to lock value
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#22d3ee"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#colorValue)"
              activeDot={{
                r: 8,
                fill: "#f59e0b",
                stroke: "#0f172a",
                strokeWidth: 3,
                onClick: (e: any) => {
                  if (e && e.payload) {
                    setActivePoint({ label: e.payload.label, value: e.payload.value });
                  }
                }
              }}
              dot={(props: any) => {
                const isActive = activePoint && activePoint.label === props.payload.label;
                if (isActive) {
                  return (
                    <circle 
                      cx={props.cx} 
                      cy={props.cy} 
                      r={8} 
                      fill="#f59e0b" 
                      stroke="#0f172a" 
                      strokeWidth={3}
                    />
                  );
                }
                return null;
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
        
        <div className="absolute bottom-2 left-4 right-4 flex justify-between items-center">
          <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500 opacity-60">
            {data[0]?.label}
          </span>
          <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500 opacity-60">
            {data[data.length - 1]?.label}
          </span>
        </div>
      </div>
    </div>
  );
}

function MonthlyBarsChart({ data }: { data: { month: string; value: number }[] }) {
  if (data.length === 0) {
    return <div className="flex h-52 items-center justify-center rounded-[24px] border border-dashed border-white/10 text-sm text-slate-500">Monthly performance will appear after your first trade.</div>;
  }

  const maxValue = Math.max(...data.map((item) => Math.abs(item.value)), 1);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.26em] text-slate-400">Profit by month</p>
        <p className="mt-2 text-sm text-slate-300">Stacked monthly performance in USD</p>
      </div>
      <div className="grid gap-4">
        {data.map((item) => (
          <div key={item.month} className="space-y-2">
            <div className="flex items-center justify-between text-sm text-slate-300">
              <span>{item.month}</span>
              <span className={item.value >= 0 ? "text-emerald-300" : "text-rose-300"}>{formatCurrency(item.value)}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-white/[0.05]">
              <div
                className={`h-full rounded-full ${item.value >= 0 ? "bg-[linear-gradient(90deg,#34d399,#22d3ee)]" : "bg-[linear-gradient(90deg,#fb7185,#f97316)]"}`}
                style={{ width: `${(Math.abs(item.value) / maxValue) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StrategyBars({ data }: { data: { strategy: string; winRate: number; total: number }[] }) {
  if (data.length === 0) {
    return <div className="flex h-52 items-center justify-center rounded-[24px] border border-dashed border-white/10 text-sm text-slate-500">Strategy win rate appears once you have logged setups.</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.26em] text-slate-400">Win rate by strategy</p>
        <p className="mt-2 text-sm text-slate-300">See which setups actually pay you</p>
      </div>
      <div className="space-y-3">
        {data.map((item) => (
          <div key={item.strategy} className="rounded-[22px] border border-white/10 bg-white/[0.035] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-white">{item.strategy}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-500">{item.total} trades</p>
              </div>
              <p className="font-display text-2xl text-white">{item.winRate}%</p>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.05]">
              <div className="h-full rounded-full bg-[linear-gradient(90deg,#f59e0b,#22d3ee,#34d399)]" style={{ width: `${item.winRate}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OutcomeRing({ data }: { data: { label: Outcome; value: number; color: string }[] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    return <div className="flex h-52 items-center justify-center rounded-[24px] border border-dashed border-white/10 text-sm text-slate-500">Outcome breakdown appears after trades are added.</div>;
  }

  let start = 0;
  const gradientStops = data
    .map((item) => {
      const percentage = (item.value / total) * 100;
      const segment = `${item.color} ${start}% ${start + percentage}%`;
      start += percentage;
      return segment;
    })
    .join(", ");

  return (
    <div className="grid gap-4 md:grid-cols-[220px_1fr] md:items-center">
      <div className="flex justify-center">
        <div
          className="relative h-44 w-44 rounded-full"
          style={{ background: `conic-gradient(${gradientStops})` }}
        >
          <div className="absolute inset-5 rounded-full border border-white/10 bg-slate-950/95" />
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-[11px] uppercase tracking-[0.28em] text-slate-400">Outcomes</span>
            <span className="mt-2 font-display text-3xl text-white">{total}</span>
            <span className="text-sm text-slate-300">closed trades</span>
          </div>
        </div>
      </div>
      <div className="space-y-3">
        {data.map((item) => (
          <div key={item.label} className="flex items-center justify-between rounded-[20px] border border-white/10 bg-white/[0.035] px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-sm text-white">{item.label}</span>
            </div>
            <div className="text-right">
              <p className="font-medium text-white">{item.value}</p>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{Math.round((item.value / total) * 100)}%</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HourPerformanceChart({ data }: { data: { hour: string; value: number }[] }) {
  const relevant = data.filter((item) => item.value !== 0);

  if (relevant.length === 0) {
    return <div className="flex h-52 items-center justify-center rounded-[24px] border border-dashed border-white/10 text-sm text-slate-500">Time-of-day performance will populate after trades are recorded.</div>;
  }

  const maxValue = Math.max(...relevant.map((item) => Math.abs(item.value)), 1);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.26em] text-slate-400">Performance by EST hour</p>
        <p className="mt-2 text-sm text-slate-300">Shows where your edge appears during the trading day</p>
      </div>
      <div className="space-y-3">
        {relevant.map((item) => (
          <div key={item.hour} className="grid grid-cols-[58px_1fr_78px] items-center gap-3 text-sm">
            <span className="text-slate-400">{item.hour}</span>
            <div className="h-3 overflow-hidden rounded-full bg-white/[0.05]">
              <div
                className={`h-full rounded-full ${item.value >= 0 ? "bg-[linear-gradient(90deg,#22d3ee,#34d399)]" : "bg-[linear-gradient(90deg,#fb7185,#f97316)]"}`}
                style={{ width: `${(Math.abs(item.value) / maxValue) * 100}%` }}
              />
            </div>
            <span className={item.value >= 0 ? "text-emerald-300" : "text-rose-300"}>{formatCurrency(item.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function WeekdayPerformanceChart({ data }: { data: { day: string; value: number; count: number }[] }) {
  const relevant = data.filter((d) => d.count > 0);
  if (relevant.length === 0) {
    return <div className="flex h-52 items-center justify-center rounded-[24px] border border-dashed border-white/10 text-sm text-slate-500">Weekday performance appears after logging trades.</div>;
  }

  const maxValue = Math.max(...relevant.map((d) => Math.abs(d.value)), 1);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.26em] text-slate-400">Profit by Day</p>
        <p className="mt-2 text-sm text-slate-300">Which days yield the best results</p>
      </div>
      <div className="grid grid-cols-5 items-end gap-2 h-40">
        {relevant.map((d) => {
           const height = Math.abs(d.value) / maxValue * 100;
           return (
            <div key={d.day} className="flex flex-col items-center justify-end h-full w-full group relative">
              <div className="absolute bottom-full mb-2 hidden whitespace-nowrap rounded bg-slate-800 px-2 py-1 text-xs text-white group-hover:block z-10">
                {d.day}: {formatCurrency(d.value)} ({d.count} trades)
              </div>
              <div
                className={`w-full rounded-t-md transition-all duration-500 ${d.value >= 0 ? "bg-emerald-400/80 hover:bg-emerald-400" : "bg-rose-400/80 hover:bg-rose-400"}`}
                style={{ height: `${Math.max(height, 5)}%` }}
              />
              <span className="mt-2 text-[10px] uppercase tracking-wider text-slate-500">{d.day.substring(0, 3)}</span>
            </div>
           );
        })}
      </div>
    </div>
  );
}

function DrawdownChart({ data }: { data: { label: string; value: number }[] }) {
  if (data.length === 0) return null;
  const minValue = Math.min(...data.map(d => d.value), 0);

  return (
    <div className="h-64 relative overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.02]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorDrawdown" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#fb7185" stopOpacity={0.4}/>
              <stop offset="95%" stopColor="#fb7185" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <XAxis dataKey="label" hide />
          <YAxis hide domain={[minValue * 1.1, 0]} />
          <Tooltip 
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="rounded-xl border border-white/10 bg-slate-900/95 p-3 shadow-xl backdrop-blur-md">
                    <p className="text-[10px] uppercase tracking-widest text-slate-500">{label}</p>
                    <p className="text-lg font-semibold text-rose-300">{formatCurrency(payload[0].value as number)}</p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Area type="monotone" dataKey="value" stroke="#fb7185" strokeWidth={2} fill="url(#colorDrawdown)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function AssetProfitChart({ data }: { data: { asset: string; value: number }[] }) {
  if (data.length === 0) return null;
  const maxValue = Math.max(...data.map(d => Math.abs(d.value)), 1);

  return (
    <div className="space-y-4 h-64 overflow-y-auto pr-2 custom-scrollbar">
      {data.map((item) => (
        <div key={item.asset} className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-slate-300 font-medium">{item.asset}</span>
            <span className={item.value >= 0 ? "text-emerald-400" : "text-rose-400"}>{formatCurrency(item.value)}</span>
          </div>
          <div className="h-2 w-full bg-white/[0.05] rounded-full overflow-hidden">
             <div 
               className={`h-full rounded-full ${item.value >= 0 ? "bg-emerald-400" : "bg-rose-400"}`}
               style={{ width: `${(Math.abs(item.value) / maxValue) * 100}%` }}
             />
          </div>
        </div>
      ))}
    </div>
  );
}

function DurationScatterChart({ data }: { data: { duration: number; pnl: number; asset: string; outcome: Outcome }[] }) {
  if (data.length === 0) return null;

  return (
    <div className="h-64 relative overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.02] p-4">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
          <XAxis 
            type="number" 
            dataKey="duration" 
            name="Duration" 
            unit="m" 
            stroke="#94a3b8" 
            fontSize={10} 
            tickLine={false}
            axisLine={false}
          />
          <YAxis 
            type="number" 
            dataKey="pnl" 
            name="P/L" 
            unit="$" 
            stroke="#94a3b8" 
            fontSize={10} 
            tickLine={false}
            axisLine={false}
          />
          <ZAxis type="number" range={[50, 400]} />
          <Tooltip 
            cursor={{ strokeDasharray: '3 3' }} 
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const item = payload[0].payload;
                return (
                  <div className="rounded-xl border border-white/10 bg-slate-900/95 p-3 shadow-xl backdrop-blur-md text-xs">
                    <p className="font-bold text-white mb-1">{item.asset}</p>
                    <p className="text-slate-400">Duration: {Math.round(item.duration)}m</p>
                    <p className={item.pnl >= 0 ? "text-emerald-400" : "text-rose-400"}>P/L: {formatCurrency(item.pnl)}</p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Scatter name="Trades" data={data}>
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.outcome === 'Win' ? '#34d399' : entry.outcome === 'Loss' ? '#fb7185' : '#94a3b8'} 
                fillOpacity={0.6}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

function TradingCalendar({ trades }: { trades: Trade[] }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    
    return { daysInMonth, startingDay, year, month };
  };
  
  const { daysInMonth, startingDay, year, month } = getDaysInMonth(currentMonth);
  
  const getDayData = (day: number) => {
    const dateStr = new Date(year, month, day).toDateString();
    const dayTrades = trades.filter(t => new Date(t.startDate).toDateString() === dateStr);
    const totalPnl = dayTrades.reduce((sum, t) => sum + t.pnl, 0);
    return { count: dayTrades.length, pnl: totalPnl };
  };
  
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  
  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));
  
  const days = [];
  for (let i = 0; i < startingDay; i++) {
    days.push(<div key={`empty-${i}`} className="h-20 rounded-[12px] bg-white/[0.02]" />);
  }
  
  for (let day = 1; day <= daysInMonth; day++) {
    const { count, pnl } = getDayData(day);
    const hasTrades = count > 0;
    
    days.push(
      <div 
        key={day} 
        className={`h-20 rounded-[12px] border p-2 transition ${
          hasTrades 
            ? pnl >= 0 
              ? "border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20" 
              : "border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20"
            : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04]"
        }`}
      >
        <div className="flex justify-between items-start">
          <span className="text-sm font-medium text-slate-300">{day}</span>
          {hasTrades && (
            <span className={`text-xs font-bold ${pnl >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
              {count}
            </span>
          )}
        </div>
        {hasTrades && (
          <div className="mt-2">
            <p className={`text-xs font-semibold ${pnl >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
              {formatCurrency(pnl)}
            </p>
          </div>
        )}
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.26em] text-slate-400">Trading Calendar</p>
          <p className="mt-2 text-sm text-slate-300">Daily trade count and P&L</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-2 rounded-full hover:bg-white/10 text-slate-300">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <span className="text-white font-medium min-w-[140px] text-center">
            {monthNames[month]} {year}
          </span>
          <button onClick={nextMonth} className="p-2 rounded-full hover:bg-white/10 text-slate-300">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-7 gap-2">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
          <div key={d} className="text-center text-xs uppercase tracking-wider text-slate-500 py-2">{d}</div>
        ))}
        {days}
      </div>
      
      <div className="flex items-center gap-4 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-emerald-500/30 border border-emerald-500/30" />
          <span>Profitable day</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-rose-500/30 border border-rose-500/30" />
          <span>Loss day</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-white/[0.02] border border-white/5" />
          <span>No trades</span>
        </div>
      </div>
    </div>
  );
}

function AdvancedMetrics({ trades }: { trades: Trade[] }) {
  if (trades.length === 0) return null;
  
  const wins = trades.filter(t => t.pnl > 0);
  const losses = trades.filter(t => t.pnl <= 0);
  
  const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((s, t) => s + t.pnl, 0) / losses.length : 0;
  
  // Profit Factor
  const grossProfit = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const profitFactor = grossLoss === 0 ? grossProfit : grossProfit / grossLoss;
  
  // Sharpe-like ratio (simplified)
  const returns = trades.map(t => t.pnl);
  const avgReturn = returns.reduce((s, r) => s + r, 0) / returns.length;
  const stdDev = Math.sqrt(returns.reduce((s, r) => s + Math.pow(r - avgReturn, 2), 0) / returns.length);
  const sharpeRatio = stdDev === 0 ? 0 : avgReturn / stdDev;
  
  // Consecutive wins/losses
  let maxConsecutiveWins = 0;
  let maxConsecutiveLosses = 0;
  let currentWins = 0;
  let currentLosses = 0;
  
  const sortedTrades = [...trades].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  sortedTrades.forEach(t => {
    if (t.pnl > 0) {
      currentWins++;
      currentLosses = 0;
      maxConsecutiveWins = Math.max(maxConsecutiveWins, currentWins);
    } else {
      currentLosses++;
      currentWins = 0;
      maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentLosses);
    }
  });
  
  // Largest drawdown calculation
  let peak = 0;
  let maxDrawdown = 0;
  let runningTotal = 0;
  sortedTrades.forEach(t => {
    runningTotal += t.pnl;
    if (runningTotal > peak) peak = runningTotal;
    const drawdown = peak - runningTotal;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  });
  
  const metrics = [
    { label: "Avg Win", value: formatCurrency(avgWin), color: "text-emerald-300" },
    { label: "Avg Loss", value: formatCurrency(avgLoss), color: "text-rose-300" },
    { label: "Profit Factor", value: profitFactor.toFixed(2), color: profitFactor >= 1.5 ? "text-emerald-300" : profitFactor >= 1 ? "text-amber-300" : "text-rose-300" },
    { label: "Sharpe Ratio", value: sharpeRatio.toFixed(2), color: sharpeRatio >= 1 ? "text-emerald-300" : sharpeRatio >= 0 ? "text-amber-300" : "text-rose-300" },
    { label: "Max Consecutive Wins", value: maxConsecutiveWins, color: "text-emerald-300" },
    { label: "Max Consecutive Losses", value: maxConsecutiveLosses, color: "text-rose-300" },
    { label: "Max Drawdown", value: formatCurrency(-maxDrawdown), color: "text-rose-300" },
    { label: "Risk/Reward", value: avgLoss !== 0 ? Math.abs(avgWin / avgLoss).toFixed(2) : "0.00", color: "text-cyan-300" },
  ];
  
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {metrics.map((m, i) => (
        <div key={i} className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{m.label}</p>
          <p className={`mt-2 font-display text-xl font-semibold ${m.color}`}>{m.value}</p>
        </div>
      ))}
    </div>
  );
}

function App() {

const [session, setSession] = useState(null);

useEffect(() => {
  supabase.auth.getSession().then(({ data }) => {
    setSession(data.session);
  });

  const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
    setSession(session);
  });

  return () => {
    listener.subscription.unsubscribe();
  };
}, []);

  useEffect(() => {
    iconifyEditDeleteButtons();
  });

  const [users, setUsers] = useState<UserAccount[]>(() => loadUsers());
  const [sessionUserId, setSessionUserId] = useState<string | null>(() => readLocalStorage(SESSION_STORAGE));
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authForm, setAuthForm] = useState<AuthFormState>({ name: "", email: "", password: "" });
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [view, setView] = useState<View>("dashboard");
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);
  const [tradeForm, setTradeForm] = useState<TradeFormState>(emptyTradeForm);
  const [filters, setFilters] = useState<Filters>({
    asset: "All assets",
    strategy: "All strategies",
    outcome: "All outcomes",
    direction: "All directions",
    startDate: "",
    endDate: "",
  });
  const [tradeError, setTradeError] = useState("");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem(USERS_STORAGE, JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    if (sessionUserId) {
      localStorage.setItem(SESSION_STORAGE, sessionUserId);
      return;
    }

    localStorage.removeItem(SESSION_STORAGE);
  }, [sessionUserId]);

  const currentUser = useMemo(() => users.find((user) => user.id === sessionUserId) ?? null, [users, sessionUserId]);

  useEffect(() => {
    if (sessionUserId && !currentUser) {
      setSessionUserId(null);
    }
  }, [sessionUserId, currentUser]);

  const trades = currentUser?.trades ?? [];
  const selectedTrade = trades.find((trade) => trade.id === selectedTradeId) ?? null;

  const filterOptions = useMemo(
    () => ({
      assets: ["All assets", ...new Set([...assetsPreset, ...trades.map((trade) => trade.asset)])],
      strategies: ["All strategies", ...new Set([...strategyOptions, ...trades.map((trade) => trade.strategy)])],
    }),
    [trades],
  );

  const filteredTrades = useMemo(
    () =>
      trades.filter((trade) => {
        const tradeTime = new Date(trade.startDate).getTime();
        const matchesAsset = filters.asset === "All assets" || trade.asset === filters.asset;
        const matchesStrategy = filters.strategy === "All strategies" || trade.strategy === filters.strategy;
        const matchesOutcome = filters.outcome === "All outcomes" || trade.outcome === filters.outcome;
        const matchesDirection = filters.direction === "All directions" || trade.direction === filters.direction;
        const matchesStart = !filters.startDate || tradeTime >= new Date(filters.startDate).getTime();
        const matchesEnd = !filters.endDate || tradeTime <= new Date(filters.endDate).getTime() + 86_399_999;

        return matchesAsset && matchesStrategy && matchesOutcome && matchesDirection && matchesStart && matchesEnd;
      }),
    [filters, trades],
  );

  const journalRows = useMemo(() => {
    const sorted = [...filteredTrades].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    let runningTotal = 0;

    // Calculate daily totals map
    const dailyTotalsMap: Record<string, number> = {};
    sorted.forEach((trade) => {
      const day = getESTDate(trade.startDate);
      dailyTotalsMap[day] = (dailyTotalsMap[day] ?? 0) + trade.pnl;
    });

    return sorted
      .map((trade) => {
        runningTotal += trade.pnl;
        return {
          trade,
          runningTotal,
          dailyTotal: dailyTotalsMap[getESTDate(trade.startDate)] || 0,
        };
      })
      .reverse();
  }, [filteredTrades, getESTDate]);

  const allAnalytics = useMemo(() => buildTradeAnalytics(trades), [trades]);
  const filteredAnalytics = useMemo(() => buildTradeAnalytics(filteredTrades), [filteredTrades]);



  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  setAuthError("");
  setAuthBusy(true);

  const email = authForm.email.trim();
  const password = authForm.password.trim();

  try {
    if (authMode === "signup") {

      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;

    } else {

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      setView("dashboard");
    }

  } catch (err: any) {
    setAuthError(err.message);
  }

  setAuthBusy(false);
}

  function handleLogout() {
    setSessionUserId(null);
    setSelectedTradeId(null);
    setView("dashboard");
  }

  async function handleScreenshotUpload(category: ScreenshotCategory, event: ChangeEvent<HTMLInputElement>) {
    const images = await toDataUrls(event.target.files);
    setTradeForm((previousState) => ({
      ...previousState,
      screenshots: {
        ...previousState.screenshots,
        [category]: [...previousState.screenshots[category], ...images],
      },
    }));

    event.target.value = "";
  }

  function removeScreenshot(category: ScreenshotCategory, index: number) {
    setTradeForm((previousState) => ({
      ...previousState,
      screenshots: {
        ...previousState.screenshots,
        [category]: previousState.screenshots[category].filter((_, currentIndex) => currentIndex !== index),
      },
    }));
  }

  function handleTradeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTradeError("");

 if (!session) {
  return <Login />;
}

    const lotSize = Number(tradeForm.lotSize);
    const pnl = Number(tradeForm.pnl);
    const roi = Number(tradeForm.roi);

    if (Number.isNaN(lotSize) || lotSize <= 0) {
      setTradeError("Enter a valid lot size.");
      return;
    }

    if (Number.isNaN(pnl)) {
      setTradeError("Enter a valid P&L value.");
      return;
    }

    if (Number.isNaN(roi)) {
      setTradeError("Enter a valid ROI value.");
      return;
    }

    if (new Date(tradeForm.endDate).getTime() < new Date(tradeForm.startDate).getTime()) {
      setTradeError("End time must be after start time.");
      return;
    }

    const newTrade: Trade = {
      id: createId(),
      startDate: tradeForm.startDate,
      endDate: tradeForm.endDate,
      asset: tradeForm.asset.trim().toUpperCase(),
      timeframe: tradeForm.timeframe,
      direction: tradeForm.direction,
      type: tradeForm.type,
      lotSize,
      ruleFollowed: tradeForm.ruleFollowed,
      outcome: tradeForm.outcome,
      roi: Number(roi.toFixed(2)),
      pnl: pnl,
      rating: tradeForm.rating,
      entryPrice: 0,
      exitPrice: 0,
      riskReward: 0,
      strategy: "",
      notes: tradeForm.notes.trim(),
      emotion: tradeForm.emotion,
      mistakes: tradeForm.mistakes.trim(),
      lessons: tradeForm.lessons.trim(),
      screenshots: tradeForm.screenshots,
    };

    setUsers((previousUsers) =>
      previousUsers.map((user) => (user.id === currentUser.id ? { ...user, trades: [newTrade, ...user.trades] } : user)),
    );
    setTradeForm(emptyTradeForm());
    setView("dashboard");
    setSelectedTradeId(newTrade.id);
  }

  function openTradeDetail(tradeId: string) {
    setSelectedTradeId(tradeId);
    // No longer changing view to 'detail', we'll show it in the right sidebar
  }

  function closeTradeDetail() {
    setSelectedTradeId(null);
  }

  function exportTradesCsv() {
    if (!currentUser) {
      return;
    }

    const header = [
      "Date EST",
      "Asset",
      "Timeframe",
      "Direction",
      "Type",
      "Lot Size",
      "Rule Followed",
      "Outcome",
      "ROI %",
      "P/L USD",
      "Strategy",
      "Emotion",
      "Entry Price",
      "Exit Price",
      "Risk Reward",
      "Notes",
      "Mistakes",
      "Lessons",
    ];

    const rows = trades.map((trade) => [
      formatESTRange(trade.startDate, trade.endDate),
      trade.asset,
      trade.timeframe,
      trade.direction,
      trade.type,
      String(trade.lotSize),
      trade.ruleFollowed ? "YES" : "NO",
      trade.outcome,
      String(trade.roi),
      String(trade.pnl),
      trade.strategy,
      trade.emotion,
      String(trade.entryPrice),
      String(trade.exitPrice),
      String(trade.riskReward),
      trade.notes,
      trade.mistakes,
      trade.lessons,
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).split('"').join('""')}"`).join(","))
      .join("\n");

    downloadBlob(`tradetracker-${currentUser.email}-trades.csv`, csv, "text/csv;charset=utf-8");
  }

  function exportBackupJson() {
    if (!currentUser) {
      return;
    }

    const backup = {
      exportedAt: new Date().toISOString(),
      timezone: "EST/EDT display via America/New_York",
      account: {
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
      },
      trades: currentUser.trades,
    };

    downloadBlob(
      `tradetracker-${currentUser.email}-backup.json`,
      JSON.stringify(backup, null, 2),
      "application/json;charset=utf-8",
    );
  }

  function exportToHTML() {
    if (!currentUser) return;
    
    const tradeRows = [...trades].sort((a,b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()).map(t => {
      const dirClass = t.direction === 'LONG' ? 'bg-sky-400/10 text-sky-300 border border-sky-400/20' : 'bg-amber-400/10 text-amber-300 border border-amber-400/20';
      const outClass = t.outcome === 'Win' ? 'bg-emerald-400/10 text-emerald-300 border border-emerald-400/20' : t.outcome === 'Loss' ? 'bg-rose-400/10 text-rose-300 border border-rose-400/20' : 'bg-gray-400/10 text-gray-300 border border-gray-400/20';
      const pnlClass = t.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400';
      const sign = t.pnl >= 0 ? '+' : '';
      
      return `
        <tr class="hover:bg-white/[0.02] transition-colors">
          <td class="p-4 text-gray-300">${new Date(t.startDate).toLocaleString()}</td>
          <td class="p-4 font-medium text-white">${t.asset}</td>
          <td class="p-4">
            <span class="px-2 py-1 rounded-full text-xs ${dirClass}">${t.direction}</span>
          </td>
          <td class="p-4 text-gray-300">${t.lotSize}</td>
          <td class="p-4">
            <span class="px-2 py-1 rounded-full text-xs ${outClass}">${t.outcome}</span>
          </td>
          <td class="p-4 font-semibold ${pnlClass}">
            ${sign}$${t.pnl.toFixed(2)}
          </td>
        </tr>
      `;
    }).join('');

    const htmlContent = `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TradeTracker - ${currentUser.name}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            gray: { 800: '#1f2937', 900: '#111827', 950: '#030712' }
          }
        }
      }
    }
  </script>
  <style>
    body { background-color: #05070b; color: #f3f4f6; font-family: system-ui, -apple-system, sans-serif; }
  </style>
</head>
<body class="p-8 bg-gradient-to-b from-[#0a0f18] to-[#05070b] min-h-screen">
  <div class="max-w-6xl mx-auto space-y-8">
    <header class="flex justify-between items-end border-b border-white/10 pb-6">
      <div>
        <p class="text-xs uppercase tracking-widest text-cyan-400 font-semibold mb-2">TradeTracker Export</p>
        <h1 class="text-4xl font-bold text-white">${currentUser.name}'s Journal</h1>
      </div>
      <div class="text-right">
        <p class="text-sm text-gray-400">Exported on</p>
        <p class="text-white font-medium">${new Date().toLocaleDateString()}</p>
      </div>
    </header>

    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm">
        <p class="text-xs uppercase tracking-widest text-gray-400 mb-2">Total Trades</p>
        <p class="text-3xl font-semibold text-white">${allAnalytics.totalTrades}</p>
      </div>
      <div class="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm">
        <p class="text-xs uppercase tracking-widest text-gray-400 mb-2">Win Rate</p>
        <p class="text-3xl font-semibold text-white">${allAnalytics.winRate.toFixed(1)}%</p>
      </div>
      <div class="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm">
        <p class="text-xs uppercase tracking-widest text-gray-400 mb-2">Total P/L</p>
        <p class="text-3xl font-semibold ${allAnalytics.totalPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}">
          ${allAnalytics.totalPnL >= 0 ? '+' : ''}$${allAnalytics.totalPnL.toFixed(2)}
        </p>
      </div>
      <div class="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm">
        <p class="text-xs uppercase tracking-widest text-gray-400 mb-2">Avg ROI</p>
        <p class="text-3xl font-semibold text-white">${allAnalytics.averageROI.toFixed(2)}%</p>
      </div>
    </div>

    <div class="bg-[#070c13] border border-white/10 rounded-[28px] overflow-hidden shadow-2xl">
      <div class="p-6 border-b border-white/10 bg-white/[0.02]">
        <h2 class="text-xl font-semibold text-white">Trade History</h2>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm whitespace-nowrap">
          <thead class="bg-white/[0.03] text-xs uppercase tracking-widest text-gray-400">
            <tr>
              <th class="p-4 font-medium">Date</th>
              <th class="p-4 font-medium">Asset</th>
              <th class="p-4 font-medium">Direction</th>
              <th class="p-4 font-medium">Lot Size</th>
              <th class="p-4 font-medium">Outcome</th>
              <th class="p-4 font-medium">P/L</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/5">
            ${tradeRows}
          </tbody>
        </table>
      </div>
    </div>
  </div>
</body>
</html>`;
    
    downloadBlob(
      `tradetracker-${currentUser.name.replace(/\s+/g, '-').toLowerCase()}-journal.html`,
      htmlContent,
      "text/html;charset=utf-8"
    );
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const backup = JSON.parse(content);
        
        // Basic validation
        if (!backup.account || !Array.isArray(backup.trades)) {
          alert("Invalid backup file format.");
          return;
        }

        if (backup.account.email !== currentUser?.email) {
            const confirmImport = window.confirm(
                `This backup belongs to ${backup.account.email}. Do you want to overwrite your current data?`
            );
            if (!confirmImport) return;
        } else {
             const confirmImport = window.confirm(
                `Importing data will overwrite your current trades. Continue?`
            );
            if (!confirmImport) return;
        }

        // Update user data
        const importedUser: UserAccount = {
             ...currentUser!,
             trades: backup.trades,
        };

        setUsers((prev) => prev.map(u => u.id === currentUser!.id ? importedUser : u));
        setView("dashboard");
        alert("Data imported successfully.");

      } catch (err) {
        console.error(err);
        alert("Failed to parse backup file.");
      }
    };
    reader.readAsText(file);
    // Reset input
    if (fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  }

  const liveMetrics = {
    roi: Number(tradeForm.roi) || 0,
    pnl: Number(tradeForm.pnl) || 0,
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_32%),radial-gradient(circle_at_top_right,rgba(245,158,11,0.12),transparent_28%),linear-gradient(180deg,#06080d,#0a0f18_45%,#06080d)] px-4 py-8 text-white sm:px-6 lg:px-8">
        <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="relative overflow-hidden rounded-[36px] border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.94),rgba(8,12,19,0.92))] p-8 shadow-[0_30px_90px_rgba(0,0,0,0.45)] lg:p-10">
            <div className="absolute -left-16 top-10 h-44 w-44 rounded-full bg-cyan-400/20 blur-3xl" />
            <div className="absolute right-0 top-0 h-52 w-52 rounded-full bg-amber-400/12 blur-3xl" />
            <p className="relative text-[11px] uppercase tracking-[0.34em] text-cyan-200/75">TradeTracker</p>
            <h1 className="relative mt-4 max-w-xl font-display text-5xl font-semibold leading-[1.02] tracking-tight text-white md:text-6xl">
              Record every trade like a desk-ready journal.
            </h1>
            <p className="relative mt-5 max-w-xl text-lg leading-8 text-slate-300">
              A colorful trading dashboard for reviewing execution, screenshots, discipline, and performance in one place. Every trade is displayed in EST and your session stays active on this device.
            </p>

            <div className="relative mt-8 grid gap-4 sm:grid-cols-3">
              <StatTile label="Journal" value="Private" hint="Stored per account on this browser" accent="from-cyan-400 via-sky-400 to-cyan-300" />
              <StatTile label="Performance" value="4 charts" hint="Equity, monthly P/L, outcomes, strategy edge" accent="from-amber-400 via-orange-400 to-rose-400" />
              <StatTile label="Security" value="PBKDF2" hint="Passwords are hashed locally before storage" accent="from-emerald-400 via-cyan-400 to-sky-400" />
            </div>

            <div className="relative mt-8 rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.26em] text-slate-400">What you get</p>
                  <p className="mt-2 font-display text-2xl text-white">Trading journal, analytics, screenshots, and exports</p>
                </div>
                <div className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-4 py-2 text-xs uppercase tracking-[0.24em] text-emerald-200">
                  Stay Logged In
                </div>
              </div>
              <div className="mt-5 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">Notion-style trade table with running P/L and trade ratings.</div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">Add multiple entry, exit, and review screenshots to each trade.</div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">Built-in CSV and JSON downloads for extracting your trading data.</div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">EST formatting across dashboard, analytics, and trade detail pages.</div>
              </div>
            </div>
          </div>

          <div className="rounded-[36px] border border-white/10 bg-[linear-gradient(180deg,rgba(14,17,28,0.96),rgba(6,9,15,0.96))] p-8 shadow-[0_30px_90px_rgba(0,0,0,0.5)] lg:p-10">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.34em] text-slate-400">Secure Access</p>
                <h2 className="mt-2 font-display text-3xl font-semibold text-white">{authMode === "login" ? "Welcome back" : "Create your journal"}</h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAuthMode((previousMode) => (previousMode === "login" ? "signup" : "login"));
                  setAuthError("");
                }}
                className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-200 transition hover:bg-white/[0.08]"
              >
                {authMode === "login" ? "Create account" : "I have an account"}
              </button>
            </div>

            <form onSubmit={(event) => void handleAuthSubmit(event)} className="mt-8 space-y-4">
              {authMode === "signup" ? (
                <label className="block space-y-2 text-sm text-slate-300">
                  <span>Full name</span>
                  <input
                    value={authForm.name}
                    onChange={(event) => setAuthForm((previousState) => ({ ...previousState, name: event.target.value }))}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none transition focus:border-cyan-300/60"
                    placeholder="Alex Morgan"
                  />
                </label>
              ) : null}

              <label className="block space-y-2 text-sm text-slate-300">
                <span>Email</span>
                <input
                  type="email"
                  value={authForm.email}
                  onChange={(event) => setAuthForm((previousState) => ({ ...previousState, email: event.target.value }))}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none transition focus:border-cyan-300/60"
                  placeholder="trader@desk.com"
                />
              </label>

              <label className="block space-y-2 text-sm text-slate-300">
                <span>Password</span>
                <input
                  type="password"
                  value={authForm.password}
                  onChange={(event) => setAuthForm((previousState) => ({ ...previousState, password: event.target.value }))}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none transition focus:border-cyan-300/60"
                  placeholder="Minimum 6 characters"
                />
              </label>

              {authError ? <p className="rounded-2xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{authError}</p> : null}

              <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
                <p className="font-medium text-white">Security note</p>
                <p className="mt-2 leading-7">
                  This version keeps your journal on the current browser and keeps you signed in until you log out. Passwords are hashed locally, but true multi-device sync requires a backend service.
                </p>
              </div>

              <button
                type="submit"
                disabled={authBusy}
                className="w-full rounded-2xl bg-[linear-gradient(135deg,#22d3ee,#f59e0b)] px-6 py-3 font-medium text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {authBusy ? "Securing account..." : authMode === "login" ? "Log In" : "Create Account"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  function updateTrade(tradeId: string, updates: Partial<Trade>) {
    if (!currentUser) return;
    setUsers((previousUsers) =>
      previousUsers.map((user) => {
        if (user.id !== currentUser.id) return user;
        return {
          ...user,
          trades: user.trades.map((trade) =>
            trade.id === tradeId ? { ...trade, ...updates } : trade
          ),
        };
      })
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.1),transparent_25%),radial-gradient(circle_at_top_right,rgba(245,158,11,0.12),transparent_26%),radial-gradient(circle_at_bottom,rgba(16,185,129,0.08),transparent_28%),linear-gradient(180deg,#05070b,#09111b_40%,#06080d)] text-white">
      <div className="mx-auto max-w-[1800px] px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
        <div className="flex flex-col gap-6 xl:flex-row h-full">
          <aside className={`transition-all duration-300 xl:sticky xl:top-6 xl:h-[calc(100vh-3rem)] rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,14,22,0.96),rgba(6,9,14,0.98))] shadow-[0_30px_80px_rgba(0,0,0,0.44)] flex flex-col shrink-0 ${isSidebarCollapsed ? "w-full xl:w-24 p-4" : "w-full xl:w-80 p-6"}`}>
            <div className="flex items-center justify-between mb-6">
              {!isSidebarCollapsed && (
                 <p className="text-[11px] uppercase tracking-[0.34em] text-cyan-200/80 whitespace-nowrap overflow-hidden">TradeTracker</p>
              )}
              <button
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="p-2 rounded-full hover:bg-white/5 text-slate-400 transition"
              >
                {isSidebarCollapsed ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 19l9-9-9-9m-9 18l9-9-9-9" /></svg>
                ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
                )}
              </button>
            </div>

            {!isSidebarCollapsed && (
              <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(34,211,238,0.14),rgba(245,158,11,0.12))] p-5 mb-6">
                <h1 className="font-display text-2xl font-semibold text-white truncate">{currentUser.name}</h1>
                <p className="mt-1 text-xs text-slate-300 truncate">{currentUser.email}</p>
              </div>
            )}

            <nav className="space-y-2 flex-1">
              {([
                ["dashboard", "Dashboard", "M3 3h18v18H3zM3 9h18M9 21V9"],
                ["add", "Add Trade", "M12 5v14M5 12h14"],
                ["analytics", "Analytics", "M3 3v18h18M18 17l-5-5-5 5-5-5"],
              ] as [View, string, string][]).map(([targetView, label, path]) => {
                const active = view === targetView;
                return (
                  <button
                    key={targetView}
                    type="button"
                    onClick={() => setView(targetView)}
                    title={isSidebarCollapsed ? label : ""}
                    className={`w-full rounded-[24px] border transition flex items-center ${
                      active
                        ? "border-cyan-300/20 bg-[linear-gradient(135deg,rgba(34,211,238,0.16),rgba(245,158,11,0.12))]"
                        : "border-white/5 bg-white/[0.02] hover:bg-white/[0.05]"
                    } ${isSidebarCollapsed ? "justify-center p-4" : "px-4 py-4 text-left gap-3"}`}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6 shrink-0 text-white">
                        <path strokeLinecap="round" strokeLinejoin="round" d={path} />
                    </svg>
                    {!isSidebarCollapsed && (
                        <div>
                            <p className="font-medium text-white text-sm">{label}</p>
                        </div>
                    )}
                  </button>
                );
              })}
            </nav>

            <div className={`mt-6 grid gap-2 ${isSidebarCollapsed ? "justify-center" : ""}`}>
               {!isSidebarCollapsed ? (
                <button
                    type="button"
                    onClick={() => setView("add")}
                    className="rounded-2xl bg-[linear-gradient(135deg,#22d3ee,#38bdf8)] px-4 py-3 font-medium text-slate-950 transition hover:brightness-110 mb-2"
                >
                    Log New Trade
                </button>
               ) : (
                 <button
                    type="button"
                    onClick={() => setView("add")}
                    title="Log New Trade"
                    className="rounded-full bg-[linear-gradient(135deg,#22d3ee,#38bdf8)] p-3 text-slate-950 transition hover:brightness-110 mb-2"
                >
                   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" /></svg>
                </button>
               )}

              <div className={`flex ${isSidebarCollapsed ? "flex-col gap-2 items-center" : "flex-row justify-between gap-2"}`}>
                  <button
                    type="button"
                    onClick={exportBackupJson}
                    title="Download Backup"
                    className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  </button>
                  <label
                    title="Import Backup"
                    className="cursor-pointer rounded-xl border border-white/10 bg-white/[0.04] p-3 text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
                  >
                     <input
                        type="file"
                        accept=".json"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                     />
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                  </label>
                  <button
                    type="button"
                    onClick={handleLogout}
                    title="Log Out"
                    className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-rose-300 transition hover:bg-rose-500/20 hover:text-rose-200"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                  </button>
              </div>
            </div>
          </aside>

          <main className="flex-1 space-y-6 overflow-hidden">

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatTile label="Total Trades" value={String(allAnalytics.totalTrades)} hint="All recorded executions in your journal" accent="from-cyan-400 via-sky-400 to-cyan-200" />
              <StatTile label="Win Rate" value={`${allAnalytics.winRate.toFixed(1)}%`} hint="Percentage of all trades closing positive" accent="from-emerald-400 via-cyan-300 to-sky-300" />
              <StatTile label="Total P/L" value={formatCurrency(allAnalytics.totalPnL)} hint="Lifetime net profit and loss" accent="from-amber-400 via-orange-400 to-rose-400" />
              <StatTile label="Average ROI" value={formatPercent(allAnalytics.averageROI)} hint="Average percentage return per trade" accent="from-fuchsia-400 via-cyan-300 to-emerald-300" />
            </div>

            {view === "dashboard" ? (
              <>
                <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                  <SectionCard title="Performance Curve" eyebrow="Account momentum">
                    <MiniLineChart data={filteredAnalytics.equityCurve} />
                  </SectionCard>
                  <SectionCard title="Outcome Mix" eyebrow="Current filters">
                    <OutcomeRing data={filteredAnalytics.outcomeBreakdown} />
                  </SectionCard>
                </div>

                <div className="grid gap-6 xl:grid-cols-3">
                  <SectionCard title="Monthly Performance" eyebrow="Color-coded P/L">
                    <MonthlyBarsChart data={filteredAnalytics.profitByMonth} />
                  </SectionCard>
                  <SectionCard title="Time-of-Day Edge" eyebrow="EST analysis">
                    <HourPerformanceChart data={filteredAnalytics.hourlyPerformance} />
                  </SectionCard>
                  <SectionCard title="Strategy Scoreboard" eyebrow="Setup quality">
                    <StrategyBars data={filteredAnalytics.winRateByStrategy.slice(0, 5)} />
                  </SectionCard>
                </div>

                <SectionCard title="Trading Calendar" eyebrow="Monthly activity view">
                  <TradingCalendar trades={filteredTrades} />
                </SectionCard>

                <SectionCard title="Advanced Performance Metrics" eyebrow="Deep analytics">
                  <AdvancedMetrics trades={filteredTrades} />
                </SectionCard>

                <SectionCard
                  title="Trade Journal"
                  eyebrow="Notion-style database"
                  action={
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={exportTradesCsv} className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-100 transition hover:bg-white/[0.08]">
                        CSV
                      </button>
                      <button type="button" onClick={exportToHTML} className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-100 transition hover:bg-white/[0.08]">
                        HTML Page
                      </button>
                      <button type="button" onClick={exportBackupJson} className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-100 transition hover:bg-cyan-400/15">
                        Backup Data
                      </button>
                    </div>
                  }
                >
                  <div className="grid gap-4 rounded-[28px] border border-white/10 bg-white/[0.03] p-4 lg:grid-cols-6">
                    <SelectField label="Asset" value={filters.asset} options={filterOptions.assets} onChange={(value) => setFilters((previousState) => ({ ...previousState, asset: value }))} />
                    <SelectField label="Strategy" value={filters.strategy} options={filterOptions.strategies} onChange={(value) => setFilters((previousState) => ({ ...previousState, strategy: value }))} />
                    <SelectField label="Outcome" value={filters.outcome} options={["All outcomes", "Win", "Loss", "Breakeven"]} onChange={(value) => setFilters((previousState) => ({ ...previousState, outcome: value }))} />
                    <SelectField label="Direction" value={filters.direction} options={["All directions", "LONG", "SHORT"]} onChange={(value) => setFilters((previousState) => ({ ...previousState, direction: value }))} />
                    <label className="space-y-2 text-sm text-slate-300">
                      <span>Start date</span>
                      <input type="date" value={filters.startDate} onChange={(event) => setFilters((previousState) => ({ ...previousState, startDate: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/60" />
                    </label>
                    <label className="space-y-2 text-sm text-slate-300">
                      <span>End date</span>
                      <input type="date" value={filters.endDate} onChange={(event) => setFilters((previousState) => ({ ...previousState, endDate: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/60" />
                    </label>
                  </div>

                  <div className="mt-6 overflow-hidden rounded-[28px] border border-white/10 bg-[#070c13]">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[1350px] border-collapse text-left">
                        <thead className="bg-white/[0.03] text-[11px] uppercase tracking-[0.24em] text-slate-400">
                          <tr>
                            <th className="px-4 py-4 font-medium">Date EST</th>
                            <th className="px-4 py-4 font-medium">Asset</th>
                            <th className="px-4 py-4 font-medium">Timeframe</th>
                            <th className="px-4 py-4 font-medium">Direction</th>
                            <th className="px-4 py-4 font-medium">Type</th>
                            <th className="px-4 py-4 font-medium">Lot Size</th>
                            <th className="px-4 py-4 font-medium">Rule Followed</th>
                            <th className="px-4 py-4 font-medium">Outcome</th>
                            <th className="px-4 py-4 font-medium">ROI</th>
                            <th className="px-4 py-4 font-medium">P/L</th>
                            <th className="px-4 py-4 font-medium">Daily Total P/L</th>
                            <th className="px-4 py-4 font-medium">Rating</th>
                          </tr>
                        </thead>
                        <tbody>
                          {journalRows.length === 0 ? (
                            <tr>
                              <td colSpan={12} className="px-4 py-14 text-center text-sm text-slate-500">
                                No trades match the current filters.
                              </td>
                            </tr>
                          ) : (
                            journalRows.map(({ trade, dailyTotal }) => (
                              <tr
                                key={trade.id}
                                onClick={() => openTradeDetail(trade.id)}
                                className="cursor-pointer border-t border-white/6 text-sm text-slate-200 transition hover:bg-white/[0.04]"
                              >
                                <td className="px-4 py-4 align-top text-slate-300">{formatESTRange(trade.startDate, trade.endDate)}</td>
                                <td className="px-4 py-4 align-top font-medium text-white">{trade.asset}</td>
                                <td className="px-4 py-4 align-top text-slate-300">{trade.timeframe}</td>
                                <td className="px-4 py-4 align-top"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getDirectionClass(trade.direction)}`}>{trade.direction}</span></td>
                                <td className="px-4 py-4 align-top text-slate-300">{trade.type}</td>
                                <td className="px-4 py-4 align-top text-slate-300">{trade.lotSize || "-"}</td>
                                <td className="px-4 py-4 align-top text-slate-300">{trade.ruleFollowed ? "YES" : "NO"}</td>
                                <td className="px-4 py-4 align-top"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getOutcomeClass(trade.outcome)}`}>{trade.outcome}</span></td>
                                <td className={`px-4 py-4 align-top ${trade.roi >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{formatPercent(trade.roi)}</td>
                                <td className={`px-4 py-4 align-top ${trade.pnl >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{formatCurrency(trade.pnl)}</td>
                                <td className={`px-4 py-4 align-top ${dailyTotal >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{formatCurrency(dailyTotal)}</td>
                                <td className="px-4 py-4 align-top"><StarRating rating={trade.rating} /></td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </SectionCard>
              </>
            ) : null}

            {view === "add" ? (
              <SectionCard title="Log a Trade" eyebrow="Execution journal entry">
                <form onSubmit={handleTradeSubmit} className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <label className="space-y-2 text-sm text-slate-300">
                      <span>Start date and time</span>
                      <input type="datetime-local" value={tradeForm.startDate} onChange={(event) => setTradeForm((previousState) => ({ ...previousState, startDate: event.target.value, endDate: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/60" />
                    </label>
                    <label className="space-y-2 text-sm text-slate-300">
                      <span>End date and time</span>
                      <input type="datetime-local" value={tradeForm.endDate} onChange={(event) => setTradeForm((previousState) => ({ ...previousState, endDate: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/60" />
                    </label>
                    <label className="space-y-2 text-sm text-slate-300">
                      <span>Asset</span>
                      <input list="asset-options" value={tradeForm.asset} onChange={(event) => setTradeForm((previousState) => ({ ...previousState, asset: event.target.value.toUpperCase() }))} className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/60" placeholder="XAUUSD" />
                      <datalist id="asset-options">
                        {assetsPreset.map((asset) => (
                          <option key={asset} value={asset} />
                        ))}
                      </datalist>
                    </label>
                    <SelectField label="Execution timeframe" value={tradeForm.timeframe} options={timeframeOptions} onChange={(value) => setTradeForm((previousState) => ({ ...previousState, timeframe: value }))} />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <SelectField label="Direction" value={tradeForm.direction} options={["LONG", "SHORT"]} onChange={(value) => setTradeForm((previousState) => ({ ...previousState, direction: value as Direction }))} />
                    <SelectField label="Type" value={tradeForm.type} options={["Exit", "Stop Loss", "Take Profit"]} onChange={(value) => setTradeForm((previousState) => ({ ...previousState, type: value as TradeType }))} />
                    <label className="space-y-2 text-sm text-slate-300">
                      <span>Lot size</span>
                      <input type="number" step="0.01" value={tradeForm.lotSize} onChange={(event) => setTradeForm((previousState) => ({ ...previousState, lotSize: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/60" />
                    </label>
                    <label className="space-y-2 text-sm text-slate-300">
                      <span>P&L ($)</span>
                      <input 
                        type="number" 
                        step="0.01" 
                        value={tradeForm.pnl} 
                        onChange={(event) => setTradeForm((previousState) => ({ ...previousState, pnl: event.target.value }))} 
                        className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/60" 
                        placeholder="Enter P&L amount"
                      />
                    </label>
                    <label className="space-y-2 text-sm text-slate-300">
                      <span>ROI (%)</span>
                      <input 
                        type="number" 
                        step="0.01" 
                        value={tradeForm.roi} 
                        onChange={(event) => setTradeForm((previousState) => ({ ...previousState, roi: event.target.value }))} 
                        className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/60" 
                        placeholder="Enter ROI manually"
                      />
                    </label>
                    <SelectField label="Outcome" value={tradeForm.outcome} options={["Win", "Loss", "Breakeven"]} onChange={(value) => {
                      const outcome = value as Outcome;
                      const currentPnl = Number(tradeForm.pnl) || 0;
                      const currentRoi = Number(tradeForm.roi) || 0;
                      // Auto-convert P&L to negative when outcome is Loss
                      const newPnl = outcome === "Loss" && currentPnl > 0 
                        ? String(-Math.abs(currentPnl)) 
                        : outcome === "Win" && currentPnl < 0 
                          ? String(Math.abs(currentPnl))
                          : tradeForm.pnl;
                      // Auto-convert ROI to negative when outcome is Loss
                      const newRoi = outcome === "Loss" && currentRoi > 0 
                        ? String(-Math.abs(currentRoi)) 
                        : outcome === "Win" && currentRoi < 0 
                          ? String(Math.abs(currentRoi))
                          : tradeForm.roi;

                      setTradeForm((previousState) => ({ ...previousState, outcome, pnl: newPnl, roi: newRoi }));
                    }} />
                    <SelectField label="Emotion during trade" value={tradeForm.emotion} options={emotionOptions} onChange={(value) => setTradeForm((previousState) => ({ ...previousState, emotion: value }))} />
                    <label className="space-y-2 text-sm text-slate-300">
                      <span>Rule followed</span>
                      <select value={tradeForm.ruleFollowed ? "YES" : "NO"} onChange={(event) => setTradeForm((previousState) => ({ ...previousState, ruleFollowed: event.target.value === "YES" }))} className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/60">
                        <option value="YES">YES</option>
                        <option value="NO">NO</option>
                      </select>
                    </label>
                    <label className="space-y-2 text-sm text-slate-300">
                      <span>Rating</span>
                      <input type="range" min="1" max="5" value={tradeForm.rating} onChange={(event) => setTradeForm((previousState) => ({ ...previousState, rating: Number(event.target.value) }))} className="w-full accent-cyan-300" />
                      <StarRating rating={tradeForm.rating} />
                    </label>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-3">
                    <label className="space-y-2 text-sm text-slate-300 lg:col-span-2">
                      <span>Notes about the trade</span>
                      <textarea value={tradeForm.notes} onChange={(event) => setTradeForm((previousState) => ({ ...previousState, notes: event.target.value }))} className="min-h-36 w-full rounded-[24px] border border-white/10 bg-slate-950/80 px-4 py-3 text-sm leading-7 text-white outline-none transition focus:border-cyan-300/60" />
                    </label>
                    <div className="grid gap-4">
                      <label className="space-y-2 text-sm text-slate-300">
                        <span>Mistakes</span>
                        <textarea value={tradeForm.mistakes} onChange={(event) => setTradeForm((previousState) => ({ ...previousState, mistakes: event.target.value }))} className="min-h-28 w-full rounded-[24px] border border-white/10 bg-slate-950/80 px-4 py-3 text-sm leading-7 text-white outline-none transition focus:border-cyan-300/60" />
                      </label>
                      <label className="space-y-2 text-sm text-slate-300">
                        <span>Lessons learned</span>
                        <textarea value={tradeForm.lessons} onChange={(event) => setTradeForm((previousState) => ({ ...previousState, lessons: event.target.value }))} className="min-h-28 w-full rounded-[24px] border border-white/10 bg-slate-950/80 px-4 py-3 text-sm leading-7 text-white outline-none transition focus:border-cyan-300/60" />
                      </label>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-3">
                    {([
                      ["entry", "Entry chart screenshots"],
                      ["exit", "Exit chart screenshots"],
                      ["review", "Trade review screenshots"],
                    ] as [ScreenshotCategory, string][]).map(([category, label]) => (
                      <div key={category} className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="font-medium text-white">{label}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-500">Multiple images supported</p>
                          </div>
                          <label className="inline-flex cursor-pointer rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs uppercase tracking-[0.22em] text-slate-200 transition hover:bg-white/[0.08]">
                            Upload
                            <input type="file" accept="image/*" multiple className="hidden" onChange={(event) => void handleScreenshotUpload(category, event)} />
                          </label>
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          {tradeForm.screenshots[category].length === 0 ? (
                            <div className="rounded-[20px] border border-dashed border-white/10 bg-black/20 px-4 py-10 text-center text-sm text-slate-500 sm:col-span-2">
                              No screenshots uploaded yet.
                            </div>
                          ) : (
                            tradeForm.screenshots[category].map((image, imageIndex) => (
                              <div key={`${category}-${imageIndex}`} className="group relative overflow-hidden rounded-[20px] border border-white/10 bg-slate-950/60">
                                <img src={image} alt={`${label} ${imageIndex + 1}`} className="h-36 w-full object-cover" />
                                <button type="button" onClick={() => removeScreenshot(category, imageIndex)} className="absolute right-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs text-white opacity-0 transition group-hover:opacity-100">
                                  Remove
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {tradeError ? <p className="rounded-2xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{tradeError}</p> : null}

                  <div className="flex flex-col gap-4 rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(34,211,238,0.12),rgba(245,158,11,0.12),rgba(16,185,129,0.08))] p-5 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="font-display text-2xl font-semibold text-white">Trade Summary</p>
                      <p className="mt-2 text-sm text-slate-200">
                        You entered: {formatPercent(liveMetrics.roi)} ROI and {formatCurrency(liveMetrics.pnl)} P/L.
                      </p>
                      <p className="mt-2 text-xs uppercase tracking-[0.24em] text-slate-400">Displayed in EST on the dashboard after save</p>
                    </div>
                    <button type="submit" className="rounded-2xl bg-[linear-gradient(135deg,#22d3ee,#f59e0b)] px-6 py-3 font-medium text-slate-950 transition hover:brightness-110">
                      Save Trade to Journal
                    </button>
                  </div>
                </form>
              </SectionCard>
            ) : null}

            {view === "analytics" ? (
              <>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <StatTile label="Filtered Trades" value={String(filteredAnalytics.totalTrades)} hint="Respects current dashboard filters" accent="from-cyan-400 via-sky-400 to-cyan-200" />
                  <StatTile label="Filtered Win Rate" value={`${filteredAnalytics.winRate.toFixed(1)}%`} hint="Win ratio for visible trades" accent="from-emerald-400 via-cyan-300 to-sky-300" />
                  <StatTile label="Filtered P/L" value={formatCurrency(filteredAnalytics.totalPnL)} hint="Net result of filtered trades" accent="from-amber-400 via-orange-400 to-rose-400" />
                  <StatTile label="Avg ROI" value={formatPercent(filteredAnalytics.averageROI)} hint="Average return in the filtered set" accent="from-fuchsia-400 via-cyan-300 to-emerald-300" />
                  <StatTile label="Best Trade" value={filteredAnalytics.bestTrade ? filteredAnalytics.bestTrade.asset : "N/A"} hint={filteredAnalytics.bestTrade ? formatCurrency(filteredAnalytics.bestTrade.pnl) : "No trade found"} accent="from-emerald-400 via-lime-300 to-cyan-300" />
                  <StatTile label="Worst Trade" value={filteredAnalytics.worstTrade ? filteredAnalytics.worstTrade.asset : "N/A"} hint={filteredAnalytics.worstTrade ? formatCurrency(filteredAnalytics.worstTrade.pnl) : "No trade found"} accent="from-rose-400 via-orange-400 to-amber-300" />
                  <StatTile label="Expectancy" value={formatCurrency(filteredAnalytics.expectancy)} hint="Avg profit per trade" accent="from-indigo-400 via-purple-400 to-pink-400" />
                  <StatTile label="Avg Win/Loss" value={filteredAnalytics.totalTrades > 0 ? (filteredAnalytics.winRate / (100 - filteredAnalytics.winRate)).toFixed(2) : "0.00"} hint="Win/Loss Ratio estimate" accent="from-teal-400 via-emerald-400 to-cyan-400" />
                </div>

                <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                  <SectionCard title="Equity Curve" eyebrow="Cumulative performance">
                    <MiniLineChart data={filteredAnalytics.equityCurve} />
                  </SectionCard>
                  <SectionCard title="Outcome Distribution" eyebrow="Wins, losses, breakeven">
                    <OutcomeRing data={filteredAnalytics.outcomeBreakdown} />
                  </SectionCard>
                </div>

                <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
                  <SectionCard title="Profit by Month" eyebrow="Monthly curve">
                    <MonthlyBarsChart data={filteredAnalytics.profitByMonth} />
                  </SectionCard>
                  <SectionCard title="Win Rate by Strategy" eyebrow="Setup quality">
                    <StrategyBars data={filteredAnalytics.winRateByStrategy} />
                  </SectionCard>
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                    <SectionCard title="Performance by EST Hour" eyebrow="Market timing">
                        <HourPerformanceChart data={filteredAnalytics.hourlyPerformance} />
                    </SectionCard>
                    <SectionCard title="Weekday Performance" eyebrow="Best trading days">
                        <WeekdayPerformanceChart data={filteredAnalytics.weekdayPerformance} />
                   </SectionCard>
                </div>

                <div className="grid gap-6 xl:grid-cols-3">
                  <SectionCard title="Drawdown Analysis" eyebrow="Risk & Pain period">
                    <DrawdownChart data={filteredAnalytics.drawdownCurve} />
                  </SectionCard>
                  <SectionCard title="Profit by Asset" eyebrow="Market edge">
                    <AssetProfitChart data={filteredAnalytics.profitByAsset} />
                  </SectionCard>
                  <SectionCard title="Hold Time vs P/L" eyebrow="Efficiency scatter">
                    <DurationScatterChart data={filteredAnalytics.durationVsPnL} />
                  </SectionCard>
                </div>
              </>
            ) : null}
          </main>

          {selectedTradeId && (
            <aside className="w-full xl:w-[600px] border-l border-white/10 bg-slate-900/60 p-6 overflow-y-auto max-h-screen xl:sticky xl:top-0">
               {selectedTrade ? (
                <div className="space-y-6">
                   <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.34em] text-cyan-200/80">Trade Review</p>
                        <h2 className="mt-2 font-display text-2xl font-semibold text-white">{selectedTrade.asset}</h2>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (!currentUser) return;
                            const shouldDelete = window.confirm("Delete this trade permanently?");
                            if (!shouldDelete) return;
                            setUsers((previousUsers) =>
                              previousUsers.map((user) =>
                                user.id === currentUser.id
                                  ? { ...user, trades: user.trades.filter((t) => t.id !== selectedTrade.id) }
                                  : user
                              )
                            );
                            setSelectedTradeId(null);
                          }}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-rose-400/30 bg-rose-400/10 text-rose-200 transition hover:bg-rose-400/20"
                          title="Delete trade"
                        >
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <path d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13M10 11v6M14 11v6" />
                          </svg>
                        </button>
                        <button onClick={closeTradeDetail} className="p-2 rounded-full hover:bg-white/10 text-slate-400">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6"><path d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                   </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                       <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Asset</p>
                       <InlineEdit value={selectedTrade.asset} onSave={(val) => updateTrade(selectedTrade.id, { asset: val.toUpperCase() })} />
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                       <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Outcome</p>
                       <InlineEdit type="select" options={["Win", "Loss", "Breakeven"]} value={selectedTrade.outcome} onSave={(val) => {
                          const outcome = val as Outcome;
                          const currentPnl = selectedTrade.pnl;
                          const currentRoi = selectedTrade.roi;
                          let newPnl = currentPnl;
                          let newRoi = currentRoi;
                          if (outcome === "Loss" && currentPnl > 0) newPnl = -Math.abs(currentPnl);
                          if (outcome === "Win" && currentPnl < 0) newPnl = Math.abs(currentPnl);
                          if (outcome === "Loss" && currentRoi > 0) newRoi = -Math.abs(currentRoi);
                          if (outcome === "Win" && currentRoi < 0) newRoi = Math.abs(currentRoi);
                          updateTrade(selectedTrade.id, { outcome, pnl: newPnl, roi: newRoi });
                       }} />
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                       <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">P&L ($)</p>
                       <InlineEdit type="number" formatType="currency" value={selectedTrade.pnl} onSave={(val) => updateTrade(selectedTrade.id, { pnl: Number(val) })} />
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                       <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">ROI (%)</p>
                       <InlineEdit type="number" formatType="percent" value={selectedTrade.roi} onSave={(val) => updateTrade(selectedTrade.id, { roi: Number(val) })} />
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                       <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Lot Size</p>
                       <InlineEdit type="number" value={selectedTrade.lotSize || 0} onSave={(val) => updateTrade(selectedTrade.id, { lotSize: Number(val) })} />
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                       <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Direction</p>
                       <InlineEdit type="select" options={["LONG", "SHORT"]} value={selectedTrade.direction} onSave={(val) => updateTrade(selectedTrade.id, { direction: val as Direction })} />
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                       <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Entry Price</p>
                       <InlineEdit type="number" value={selectedTrade.entryPrice || 0} onSave={(val) => updateTrade(selectedTrade.id, { entryPrice: Number(val) })} />
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                       <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Exit Price</p>
                       <InlineEdit type="number" value={selectedTrade.exitPrice || 0} onSave={(val) => updateTrade(selectedTrade.id, { exitPrice: Number(val) })} />
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:col-span-2">
                       <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Execution Time (EST)</p>
                       <InlineEdit type="datetime-local" value={selectedTrade.startDate} onSave={(val) => updateTrade(selectedTrade.id, { startDate: val, endDate: val })} />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Emotion</p>
                      <InlineEdit type="select" options={emotionOptions} value={selectedTrade.emotion} onSave={(val) => updateTrade(selectedTrade.id, { emotion: val })} />
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Rating</p>
                      <InlineEdit type="select" options={["1", "2", "3", "4", "5"]} value={String(selectedTrade.rating)} onSave={(val) => updateTrade(selectedTrade.id, { rating: Number(val) })} />
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Notes</p>
                      <InlineEdit type="textarea" value={selectedTrade.notes || "Add notes..."} onSave={(val) => updateTrade(selectedTrade.id, { notes: val })} />
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Mistakes</p>
                      <InlineEdit type="textarea" value={selectedTrade.mistakes || "Log mistakes..."} onSave={(val) => updateTrade(selectedTrade.id, { mistakes: val })} />
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Lessons Learned</p>
                      <InlineEdit type="textarea" value={selectedTrade.lessons || "Key takeaways..."} onSave={(val) => updateTrade(selectedTrade.id, { lessons: val })} />
                    </div>
                  </div>

                  <div className="space-y-4">
                      {([
                        ["entry", "Entry charts"],
                        ["exit", "Exit charts"],
                        ["review", "Review screenshots"],
                      ] as [ScreenshotCategory, string][]).map(([category, title]) => (
                        <div key={category} className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="font-medium text-white">{title}</p>
                              <p className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-500">{selectedTrade.screenshots[category].length} images</p>
                            </div>
                            <label className="inline-flex cursor-pointer rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs uppercase tracking-[0.22em] text-slate-200 transition hover:bg-white/[0.08]">
                              Add Image
                              <input type="file" accept="image/*" multiple className="hidden" onChange={async (e) => {
                                const urls = await toDataUrls(e.target.files);
                                updateTrade(selectedTrade.id, { 
                                  screenshots: { 
                                    ...selectedTrade.screenshots, 
                                    [category]: [...selectedTrade.screenshots[category], ...urls] 
                                  } 
                                });
                              }} />
                            </label>
                          </div>
                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            {selectedTrade.screenshots[category].length === 0 ? (
                              <div className="rounded-[20px] border border-dashed border-white/10 bg-black/20 px-4 py-8 text-center text-sm text-slate-500 sm:col-span-2">
                                No images.
                              </div>
                            ) : (
                              selectedTrade.screenshots[category].map((image, index) => (
                                <div key={`${category}-${index}`} className="group relative overflow-hidden rounded-[20px] border border-white/10 bg-slate-950/60">
                                  <img src={image} alt={`${title} ${index + 1}`} className="h-32 w-full object-cover" />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                                    <button 
                                      onClick={() => {
                                        updateTrade(selectedTrade.id, {
                                          screenshots: {
                                            ...selectedTrade.screenshots,
                                            [category]: selectedTrade.screenshots[category].filter((_, i) => i !== index)
                                          }
                                        });
                                      }}
                                      className="p-2 bg-rose-500 rounded-full text-white"
                                      title="Remove"
                                    >
                                       <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 002 2h8a2 2 0 002-2l1-12M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" /></svg>
                                    </button>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
               ) : null}
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}

export { App };
