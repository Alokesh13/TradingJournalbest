// @ts-nocheck
import { useState, useEffect, useRef, useCallback } from "react";
import LandingPage from "./LandingPage";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, ScatterChart, Scatter, RadarChart,
  PolarGrid, PolarAngleAxis, Radar, Legend
} from "recharts";
import {
  LayoutDashboard, PlusCircle, BarChart2, Calendar,
  ChevronLeft, ChevronRight, Star, Upload, X, Edit2,
  Trash2, Sun, Moon, Download, LogOut, Menu, TrendingUp,
  TrendingDown, Activity, Target, Shield, Clock, Camera,
  Image as ImageIcon, Eye, EyeOff, Sparkles, CheckCircle,
  AlertCircle, Zap, Award, BookOpen, ArrowUpRight,
  ArrowDownRight, DollarSign, Percent, BarChart3, ChevronDown
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Trade {
  id: string;
  asset: string;
  timeframe: string;
  direction: "LONG" | "SHORT";
  tradeType: string;
  lotSize: string;
  ruleFollowed: "YES" | "NO";
  outcome: "Win" | "Loss" | "Breakeven";
  roi: string;
  pl: string;
  rating: number;
  startDate: string;
  endDate: string;
  notes: string;
  mistakes: string;
  lessons: string;
  emotion: string;
  screenshots: string[];
}

interface UserAccount {
  email: string;
  username: string;
  passHash: string;
  trades: Trade[];
  darkMode: boolean;
  profilePicture: string;
  preferredAssets: string[];
}

type Page = "dashboard" | "add" | "analytics" | "calendar";

// ─── Constants ────────────────────────────────────────────────────────────────
const ASSETS = [
  "XAUUSD", "XAGUSD", "EURUSD", "GBPUSD", "USDJPY", "USDCHF",
  "AUDUSD", "NZDUSD", "USDCAD", "EURGBP", "EURJPY", "GBPJPY",
  "BTCUSD", "ETHUSD", "BNBUSD", "SOLUSD", "XRPUSD",
  "US30", "SPX500", "NAS100", "UK100", "GER40",
  "USOIL", "UKOIL", "NATGAS"
];

const TIMEFRAMES = ["1m","2m","3m","5m","10m","15m","30m","1h","2h","4h","6h","8h","12h","1D","1W"];
const EMOTIONS = ["Calm","Focused","Confident","Anxious","Fearful","Greedy","Excited","Neutral","Frustrated","Revenge"];
const TRADE_TYPES = ["Market","Limit","Stop","Take Profit","Stop Loss","Breakout","Reversal","Scalp","Swing","Position"];

const NAV_ITEMS: { id: Page; label: string; icon: any }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "add",       label: "Log Trade",  icon: PlusCircle },
  { id: "analytics", label: "Analytics",  icon: BarChart2 },
  { id: "calendar",  label: "Calendar",   icon: Calendar },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function hashPass(p: string) {
  let h = 0;
  for (let i = 0; i < p.length; i++) h = (Math.imul(31, h) + p.charCodeAt(i)) | 0;
  return h.toString(36);
}

function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

function fmtEST(iso: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", month:"short", day:"numeric", year:"numeric", hour:"numeric", minute:"2-digit", hour12:true }) + " ET";
  } catch { return iso; }
}

function fmtDate(iso: string) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("en-US", { timeZone: "America/New_York", month:"short", day:"numeric", year:"numeric" }); }
  catch { return iso; }
}

function fmtMoney(n: number) {
  return (n >= 0 ? "+" : "") + n.toLocaleString("en-US", { style:"currency", currency:"USD", maximumFractionDigits:2 });
}

function toLocalDT(iso: string) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2,"0");
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch { return ""; }
}

function loadAccounts(): Record<string, UserAccount> {
  try { return JSON.parse(localStorage.getItem("tt_accounts") || "{}"); } catch { return {}; }
}

function saveAccounts(a: Record<string, UserAccount>) {
  localStorage.setItem("tt_accounts", JSON.stringify(a));
}

function loadSession(): string | null { return localStorage.getItem("tt_session"); }
function saveSession(e: string | null) {
  e ? localStorage.setItem("tt_session", e) : localStorage.removeItem("tt_session");
}

// ─── Pupil / EyeBall components ───────────────────────────────────────────────
function Pupil({ size=12, maxDistance=5, pupilColor="black", forceLookX, forceLookY }) {
  const [mx,setMx] = useState(0); const [my,setMy] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { setMx(e.clientX); setMy(e.clientY); };
    window.addEventListener("mousemove",h);
    return () => window.removeEventListener("mousemove",h);
  },[]);
  const pos = () => {
    if (!ref.current) return {x:0,y:0};
    if (forceLookX!==undefined && forceLookY!==undefined) return {x:forceLookX,y:forceLookY};
    const r = ref.current.getBoundingClientRect();
    const dx = mx-(r.left+r.width/2), dy = my-(r.top+r.height/2);
    const dist = Math.min(Math.sqrt(dx*dx+dy*dy),maxDistance);
    const ang = Math.atan2(dy,dx);
    return {x:Math.cos(ang)*dist,y:Math.sin(ang)*dist};
  };
  const p = pos();
  return <div ref={ref} className="rounded-full" style={{width:size,height:size,backgroundColor:pupilColor,transform:`translate(${p.x}px,${p.y}px)`,transition:"transform 0.1s ease-out"}} />;
}

function EyeBall({ size=48,pupilSize=16,maxDistance=10,eyeColor="white",pupilColor="black",isBlinking=false,forceLookX,forceLookY }) {
  const [mx,setMx] = useState(0); const [my,setMy] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { setMx(e.clientX); setMy(e.clientY); };
    window.addEventListener("mousemove",h);
    return () => window.removeEventListener("mousemove",h);
  },[]);
  const pos = () => {
    if (!ref.current) return {x:0,y:0};
    if (forceLookX!==undefined && forceLookY!==undefined) return {x:forceLookX,y:forceLookY};
    const r = ref.current.getBoundingClientRect();
    const dx = mx-(r.left+r.width/2), dy = my-(r.top+r.height/2);
    const dist = Math.min(Math.sqrt(dx*dx+dy*dy),maxDistance);
    const ang = Math.atan2(dy,dx);
    return {x:Math.cos(ang)*dist,y:Math.sin(ang)*dist};
  };
  const p = pos();
  return (
    <div ref={ref} className="rounded-full flex items-center justify-center transition-all duration-150"
      style={{width:size,height:isBlinking?2:size,backgroundColor:eyeColor,overflow:"hidden"}}>
      {!isBlinking && <div className="rounded-full" style={{width:pupilSize,height:pupilSize,backgroundColor:pupilColor,transform:`translate(${p.x}px,${p.y}px)`,transition:"transform 0.1s ease-out"}} />}
    </div>
  );
}

// ─── Animated Auth Page ───────────────────────────────────────────────────────
function AnimatedAuthPage({ onLogin, onBack }: { onLogin: (email: string) => void; onBack: () => void }) {
  const [mode, setMode] = useState<"login"|"signup">("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isLookingAtEachOther, setIsLookingAtEachOther] = useState(false);
  const [isPurpleBlinking, setIsPurpleBlinking] = useState(false);

  // Unlock scroll for auth page (full-page centered layout)
  useEffect(() => {
    document.body.classList.remove("dashboard");
    document.body.classList.add("landing");
    document.documentElement.style.overflow = "auto";
    document.documentElement.style.height = "auto";
    document.body.style.overflow = "auto";
    document.body.style.height = "auto";
    return () => {
      document.body.classList.remove("landing");
      document.documentElement.style.overflow = "";
      document.documentElement.style.height = "";
      document.body.style.overflow = "";
      document.body.style.height = "";
    };
  }, []);
  const [isBlackBlinking, setIsBlackBlinking] = useState(false);
  const [isPurplePeeking, setIsPurplePeeking] = useState(false);
  const [mx, setMx] = useState(0); const [my, setMy] = useState(0);
  const purpleRef = useRef(null); const blackRef = useRef(null);
  const yellowRef = useRef(null); const orangeRef = useRef(null);

  useEffect(() => { const h = (e) => { setMx(e.clientX); setMy(e.clientY); }; window.addEventListener("mousemove",h); return () => window.removeEventListener("mousemove",h); },[]);

  const scheduleBlink = (setter) => {
    const t = setTimeout(() => { setter(true); setTimeout(() => { setter(false); scheduleBlink(setter); }, 150); }, Math.random()*4000+3000);
    return t;
  };
  useEffect(() => { const t = scheduleBlink(setIsPurpleBlinking); return () => clearTimeout(t); },[]);
  useEffect(() => { const t = scheduleBlink(setIsBlackBlinking); return () => clearTimeout(t); },[]);
  useEffect(() => {
    if (isTyping) { setIsLookingAtEachOther(true); const t = setTimeout(() => setIsLookingAtEachOther(false), 800); return () => clearTimeout(t); }
    else setIsLookingAtEachOther(false);
  },[isTyping]);
  useEffect(() => {
    if (password.length > 0 && showPw) {
      const t = setTimeout(() => { setIsPurplePeeking(true); setTimeout(() => setIsPurplePeeking(false), 800); }, Math.random()*3000+2000);
      return () => clearTimeout(t);
    } else setIsPurplePeeking(false);
  },[password, showPw, isPurplePeeking]);

  const calcPos = (ref) => {
    if (!ref.current) return {faceX:0,faceY:0,bodySkew:0};
    const r = ref.current.getBoundingClientRect();
    const cx = r.left+r.width/2, cy = r.top+r.height/3;
    const dx = mx-cx, dy = my-cy;
    return { faceX: Math.max(-15,Math.min(15,dx/20)), faceY: Math.max(-10,Math.min(10,dy/30)), bodySkew: Math.max(-6,Math.min(6,-dx/120)) };
  };

  const pp = calcPos(purpleRef); const bp = calcPos(blackRef);
  const yp = calcPos(yellowRef); const op = calcPos(orangeRef);

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(""); setBusy(true);
    await new Promise(r => setTimeout(r,400));
    const accounts = loadAccounts();
    if (mode === "signup") {
      if (!username.trim()) { setError("Username required"); setBusy(false); return; }
      if (password.length < 6) { setError("Password must be at least 6 characters"); setBusy(false); return; }
      if (accounts[email]) { setError("Account already exists"); setBusy(false); return; }
      accounts[email] = { email, username: username.trim(), passHash: hashPass(password), trades: [], darkMode: true, profilePicture: "", preferredAssets: ["XAUUSD"] };
      saveAccounts(accounts); saveSession(email); onLogin(email);
    } else {
      const acc = accounts[email];
      if (!acc || acc.passHash !== hashPass(password)) { setError("Invalid email or password"); setBusy(false); return; }
      saveSession(email); onLogin(email);
    }
    setBusy(false);
  };

  const lookingAway = password.length > 0 && !showPw;

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-[#080b14]">
      {/* Left — Characters */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden"
        style={{background:"linear-gradient(135deg,#0d1117 0%,#0f1923 40%,#0a0d1a 100%)"}}>
        {/* Ambient blobs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-10 blur-3xl pointer-events-none" style={{background:"radial-gradient(circle,#7c3aed,transparent)"}} />
        <div className="absolute bottom-1/3 right-1/4 w-64 h-64 rounded-full opacity-10 blur-3xl pointer-events-none" style={{background:"radial-gradient(circle,#06b6d4,transparent)"}} />

        {/* Logo + Back button */}
        <div className="relative z-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{background:"linear-gradient(135deg,#7c3aed,#06b6d4)"}}>
              <TrendingUp size={20} className="text-white" />
            </div>
            <span className="text-white font-bold text-xl tracking-tight">TradeTracker</span>
          </div>
          <button onClick={onBack}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-white/40 hover:text-white/80 border border-white/8 hover:border-white/20 transition-all duration-200 text-sm group"
            style={{ background: "rgba(255,255,255,0.04)" }}>
            <ChevronLeft size={14} className="group-hover:-translate-x-0.5 transition-transform duration-200" />
            Back
          </button>
        </div>

        {/* Characters stage */}
        <div className="relative z-20 flex items-end justify-center" style={{height:420}}>
          <div className="relative" style={{width:520,height:400}}>
            {/* Purple */}
            <div ref={purpleRef} className="absolute bottom-0 transition-all duration-700 ease-in-out"
              style={{left:60,width:170,height:lookingAway?440:400,backgroundColor:"#6C3FF5",borderRadius:"10px 10px 0 0",zIndex:1,
                transform:lookingAway?`skewX(${(pp.bodySkew||0)-12}deg) translateX(40px)`:`skewX(${pp.bodySkew||0}deg)`,transformOrigin:"bottom center"}}>
              <div className="absolute flex gap-8 transition-all duration-700 ease-in-out"
                style={{left:lookingAway?55:45+(pp.faceX||0),top:lookingAway?65:40+(pp.faceY||0)}}>
                <EyeBall size={18} pupilSize={7} maxDistance={5} eyeColor="white" pupilColor="#1a0533" isBlinking={isPurpleBlinking}
                  forceLookX={lookingAway?undefined:isLookingAtEachOther?3:undefined} forceLookY={lookingAway?undefined:isLookingAtEachOther?4:undefined} />
                <EyeBall size={18} pupilSize={7} maxDistance={5} eyeColor="white" pupilColor="#1a0533" isBlinking={isPurpleBlinking}
                  forceLookX={lookingAway?undefined:isLookingAtEachOther?3:undefined} forceLookY={lookingAway?undefined:isLookingAtEachOther?4:undefined} />
              </div>
            </div>
            {/* Black */}
            <div ref={blackRef} className="absolute bottom-0 transition-all duration-700 ease-in-out"
              style={{left:220,width:115,height:305,backgroundColor:"#1e2030",borderRadius:"8px 8px 0 0",zIndex:2,
                transform:`skewX(${isLookingAtEachOther?(bp.bodySkew||0)*1.5+10:bp.bodySkew||0}deg)`,transformOrigin:"bottom center"}}>
              <div className="absolute flex gap-6 transition-all duration-700 ease-in-out"
                style={{left:isLookingAtEachOther?32:26+(bp.faceX||0),top:isLookingAtEachOther?12:32+(bp.faceY||0)}}>
                <EyeBall size={16} pupilSize={6} maxDistance={4} eyeColor="white" pupilColor="#1e2030" isBlinking={isBlackBlinking}
                  forceLookX={isLookingAtEachOther?0:undefined} forceLookY={isLookingAtEachOther?-4:undefined} />
                <EyeBall size={16} pupilSize={6} maxDistance={4} eyeColor="white" pupilColor="#1e2030" isBlinking={isBlackBlinking}
                  forceLookX={isLookingAtEachOther?0:undefined} forceLookY={isLookingAtEachOther?-4:undefined} />
              </div>
            </div>
            {/* Orange */}
            <div ref={orangeRef} className="absolute bottom-0 transition-all duration-700 ease-in-out"
              style={{left:0,width:230,height:195,zIndex:3,backgroundColor:"#f97316",borderRadius:"115px 115px 0 0",
                transform:`skewX(${op.bodySkew||0}deg)`,transformOrigin:"bottom center"}}>
              <div className="absolute flex gap-8 transition-all duration-200 ease-out"
                style={{left:80+(op.faceX||0),top:88+(op.faceY||0)}}>
                <Pupil size={12} maxDistance={5} pupilColor="#431407" />
                <Pupil size={12} maxDistance={5} pupilColor="#431407" />
              </div>
            </div>
            {/* Yellow */}
            <div ref={yellowRef} className="absolute bottom-0 transition-all duration-700 ease-in-out"
              style={{left:295,width:135,height:225,backgroundColor:"#eab308",borderRadius:"68px 68px 0 0",zIndex:4,
                transform:`skewX(${yp.bodySkew||0}deg)`,transformOrigin:"bottom center"}}>
              <div className="absolute flex gap-6 transition-all duration-200 ease-out"
                style={{left:50+(yp.faceX||0),top:38+(yp.faceY||0)}}>
                <Pupil size={12} maxDistance={5} pupilColor="#422006" />
                <Pupil size={12} maxDistance={5} pupilColor="#422006" />
              </div>
              <div className="absolute rounded-full transition-all duration-200 ease-out"
                style={{width:70,height:4,backgroundColor:"#422006",left:38+(yp.faceX||0),top:86+(yp.faceY||0)}} />
            </div>
          </div>
        </div>

        {/* Footer links */}
        <div className="relative z-20 flex items-center gap-8 text-sm text-white/30">
          <span className="hover:text-white/60 cursor-pointer transition-colors">Privacy</span>
          <span className="hover:text-white/60 cursor-pointer transition-colors">Terms</span>
          <span className="hover:text-white/60 cursor-pointer transition-colors">Support</span>
        </div>
      </div>

      {/* Right — Form */}
      <div className="flex items-center justify-center p-8" style={{background:"#080b14"}}>
        <div className="w-full max-w-md">
          {/* Mobile header with back button */}
          <div className="lg:hidden flex items-center justify-between mb-10">
            <button onClick={onBack}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-white/40 hover:text-white/80 border border-white/8 hover:border-white/20 transition-all duration-200 text-sm group"
              style={{ background: "rgba(255,255,255,0.04)" }}>
              <ChevronLeft size={14} className="group-hover:-translate-x-0.5 transition-transform duration-200" />
              Back
            </button>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{background:"linear-gradient(135deg,#7c3aed,#06b6d4)"}}>
                <TrendingUp size={16} className="text-white" />
              </div>
              <span className="text-white font-bold text-lg">TradeTracker</span>
            </div>
          </div>

          <div className="mb-8">
            <p className="text-xs font-semibold tracking-widest mb-2" style={{color:"#7c3aed"}}>SECURE ACCESS</p>
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold text-white">{mode==="login"?"Welcome back!":"Create account"}</h1>
              <button onClick={() => { setMode(m => m==="login"?"signup":"login"); setError(""); }}
                className="text-sm px-4 py-2 rounded-full border border-white/10 text-white/60 hover:text-white hover:border-white/30 transition-all">
                {mode==="login"?"Sign up":"Sign in"}
              </button>
            </div>
            <p className="text-white/40 text-sm mt-1">{mode==="login"?"Enter your credentials to access your journal.":"Start your private trading journal today."}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode==="signup" && (
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">Username</label>
                <input value={username} onChange={e=>setUsername(e.target.value)} placeholder="Your trading name"
                  className="w-full px-4 py-3 rounded-xl text-white placeholder-white/20 text-sm border border-white/10 outline-none focus:border-violet-500 transition-colors"
                  style={{background:"#0f1420"}} onFocus={()=>setIsTyping(true)} onBlur={()=>setIsTyping(false)} />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">Email</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="trader@example.com" required
                className="w-full px-4 py-3 rounded-xl text-white placeholder-white/20 text-sm border border-white/10 outline-none focus:border-violet-500 transition-colors"
                style={{background:"#0f1420"}} onFocus={()=>setIsTyping(true)} onBlur={()=>setIsTyping(false)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">Password</label>
              <div className="relative">
                <input type={showPw?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)}
                  placeholder={mode==="signup"?"Minimum 6 characters":"••••••••"} required
                  className="w-full px-4 py-3 pr-12 rounded-xl text-white placeholder-white/20 text-sm border border-white/10 outline-none focus:border-violet-500 transition-colors"
                  style={{background:"#0f1420"}} />
                <button type="button" onClick={()=>setShowPw(v=>!v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors">
                  {showPw ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 text-sm">
                <AlertCircle size={14}/>{error}
              </div>
            )}

            <button type="submit" disabled={busy}
              className="w-full py-3.5 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-50 mt-2"
              style={{background:"linear-gradient(135deg,#7c3aed,#06b6d4)"}}>
              {busy?"Signing in…":mode==="login"?"Log In":"Create Account"}
            </button>
          </form>

          <div className="mt-6 p-4 rounded-xl border border-white/5 text-xs text-white/30" style={{background:"#0a0d18"}}>
            <span className="text-white/50 font-medium">🔒 Security note: </span>
            Your journal is private to this browser. Passwords are hashed locally before storage. Use the export feature to back up your data across devices.
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Inline Editable ──────────────────────────────────────────────────────────
function InlineEdit({ value, onSave, type="text", options=null, dark=true }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);
  const inputRef = useRef(null);
  useEffect(() => { setVal(value); },[value]);
  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); },[editing]);

  const save = () => { setEditing(false); if (val !== value) onSave(val); };

  const base = dark
    ? "bg-[#1a1d2e] border-[#2a2d3e] text-white"
    : "bg-white border-gray-200 text-gray-900";

  if (!editing) return (
    <span onClick={()=>setEditing(true)} className={`cursor-pointer px-2 py-0.5 rounded hover:bg-white/10 transition-colors min-w-[40px] inline-block ${!dark?"hover:bg-gray-100 text-gray-900":""}`}>
      {value||<span className="opacity-30 italic text-xs">click to edit</span>}
    </span>
  );

  if (options) return (
    <select value={val} onChange={e=>setVal(e.target.value)} onBlur={save}
      className={`px-2 py-0.5 rounded border text-sm outline-none ${base}`} ref={inputRef}>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );

  return (
    <input ref={inputRef} value={val} onChange={e=>setVal(e.target.value)}
      onBlur={save} onKeyDown={e=>{ if(e.key==="Enter") save(); if(e.key==="Escape"){ setVal(value); setEditing(false); } }}
      className={`px-2 py-0.5 rounded border text-sm outline-none focus:border-violet-500 ${base}`}
      style={{minWidth:80}} type={type} />
  );
}

// ─── Star Rating ──────────────────────────────────────────────────────────────
function StarRating({ rating, onRate=null, size=16 }) {
  return (
    <span className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={size} fill={i<=rating?"#f59e0b":"none"} stroke={i<=rating?"#f59e0b":"#4b5563"}
          className={onRate?"cursor-pointer hover:scale-110 transition-transform":""} onClick={()=>onRate&&onRate(i)} />
      ))}
    </span>
  );
}

// ─── Stat Tile ────────────────────────────────────────────────────────────────
function StatTile({ label, value, sub="", color="#7c3aed", icon: Icon, dark=true }) {
  const bg = dark ? "#0f1117" : "#ffffff";
  const border = dark ? "#1e2130" : "#e5e7eb";
  const textMain = dark ? "#ffffff" : "#111827";
  const textSub = dark ? "#6b7280" : "#9ca3af";
  return (
    <div className="rounded-2xl p-5 flex flex-col gap-3 transition-all hover:scale-[1.01]"
      style={{background:bg, border:`1px solid ${border}`, boxShadow: dark?"0 0 0 0 transparent":"0 1px 3px rgba(0,0,0,0.08)"}}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest" style={{color:textSub}}>{label}</span>
        {Icon && <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{background:color+"22"}}><Icon size={15} style={{color}} /></div>}
      </div>
      <div className="text-2xl font-bold tracking-tight" style={{color:textMain}}>{value}</div>
      {sub && <div className="text-xs" style={{color:textSub}}>{sub}</div>}
    </div>
  );
}

// ─── Section Card ─────────────────────────────────────────────────────────────
function SectionCard({ title, subtitle="", children, dark=true, extra=null }) {
  const bg = dark ? "#0f1117" : "#ffffff";
  const border = dark ? "#1e2130" : "#e5e7eb";
  const textMain = dark ? "#ffffff" : "#111827";
  const textSub = dark ? "#6b7280" : "#9ca3af";
  return (
    <div className="rounded-2xl p-5" style={{background:bg,border:`1px solid ${border}`}}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-sm" style={{color:textMain}}>{title}</h3>
          {subtitle && <p className="text-xs mt-0.5" style={{color:textSub}}>{subtitle}</p>}
        </div>
        {extra}
      </div>
      {children}
    </div>
  );
}

// ─── Chart Tooltip ────────────────────────────────────────────────────────────
function DarkTooltip({ active, payload, label, prefix="$", dark=true }) {
  if (!active || !payload?.length) return null;
  const bg = dark ? "#1a1d2e" : "#ffffff";
  const border = dark ? "#2a2d3e" : "#e5e7eb";
  const textMain = dark ? "#ffffff" : "#111827";
  const textSub = dark ? "#9ca3af" : "#6b7280";
  return (
    <div className="rounded-xl px-3 py-2 text-xs shadow-xl" style={{background:bg,border:`1px solid ${border}`}}>
      {label && <div className="font-semibold mb-1" style={{color:textSub}}>{label}</div>}
      {payload.map((p,i) => (
        <div key={i} className="flex items-center gap-2" style={{color:textMain}}>
          <span className="w-2 h-2 rounded-full inline-block" style={{background:p.color||p.fill||"#7c3aed"}} />
          <span>{p.name||""}: <strong>{prefix}{typeof p.value==="number"?p.value.toFixed(2):p.value}</strong></span>
        </div>
      ))}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState<string|null>(loadSession);
  const [accounts, setAccounts] = useState<Record<string,UserAccount>>(loadAccounts);
  const [page, setPage] = useState<Page>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showLanding, setShowLanding] = useState(() => !loadSession());
  const [selectedTrade, setSelectedTrade] = useState<Trade|null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [filterAsset, setFilterAsset] = useState("All");
  const [filterOutcome, setFilterOutcome] = useState("All");
  const [filterDirection, setFilterDirection] = useState("All");
  const [calMonth, setCalMonth] = useState(new Date());
  const [statsView, setStatsView] = useState<"days"|"weeks"|"months">("days");

  const currentUser = session ? accounts[session] : null;
  const dm = currentUser?.darkMode ?? true;

  const mutate = useCallback((fn: (u: UserAccount) => void) => {
    if (!session) return;
    setAccounts(prev => {
      const next = { ...prev };
      next[session] = { ...next[session] };
      fn(next[session]);
      saveAccounts(next);
      return next;
    });
  }, [session]);

  const handleLogin = (email: string) => {
  const acc = loadAccounts();

  setAccounts(acc);

  setTimeout(() => {
    setSession(email);
    saveSession(email);
  }, 0);
};
  
  const handleLogout = () => { setSession(null); saveSession(null); setPage("dashboard"); };
  const toggleDark = () => mutate(u => { u.darkMode = !u.darkMode; });

  const trades = currentUser?.trades ?? [];

  // ─── Filters ───────────────────────────────────────────────────────────────
  const filtered = trades.filter(t =>
    (filterAsset==="All" || t.asset===filterAsset) &&
    (filterOutcome==="All" || t.outcome===filterOutcome) &&
    (filterDirection==="All" || t.direction===filterDirection)
  );

  // ─── Analytics ─────────────────────────────────────────────────────────────
  const wins = trades.filter(t=>t.outcome==="Win").length;
  const losses = trades.filter(t=>t.outcome==="Loss").length;
  const winRate = trades.length ? ((wins/trades.length)*100).toFixed(1) : "0.0";
  const totalPL = trades.reduce((s,t)=>s+parseFloat(t.pl||"0"),0);
  const avgROI = trades.length ? (trades.reduce((s,t)=>s+parseFloat(t.roi||"0"),0)/trades.length).toFixed(1) : "0.0";
  const bestTrade = trades.reduce((b,t)=>parseFloat(t.pl||"0")>parseFloat(b?.pl||"-99999")?t:b, null as Trade|null);
  const worstTrade = trades.reduce((b,t)=>parseFloat(t.pl||"0")<parseFloat(b?.pl||"99999")?t:b, null as Trade|null);

  // Daily P&L (sum per day)
  const dailyPLMap: Record<string,number> = {};
  trades.forEach(t => {
    const day = t.startDate ? new Date(t.startDate).toLocaleDateString("en-US",{timeZone:"America/New_York"}) : "Unknown";
    dailyPLMap[day] = (dailyPLMap[day]||0) + parseFloat(t.pl||"0");
  });

  // Equity curve
  const equityCurve = (() => {
    let running = 0;
    return [...trades].sort((a,b)=>new Date(a.startDate).getTime()-new Date(b.startDate).getTime()).map(t => {
      running += parseFloat(t.pl||"0");
      return { date: fmtDate(t.startDate), pl: parseFloat(t.pl||"0"), equity: running };
    });
  })();

  // Monthly P&L
  const monthlyMap: Record<string,number> = {};
  trades.forEach(t => {
    if (!t.startDate) return;
    const k = new Date(t.startDate).toLocaleDateString("en-US",{timeZone:"America/New_York",month:"short",year:"2-digit"});
    monthlyMap[k] = (monthlyMap[k]||0) + parseFloat(t.pl||"0");
  });
  const monthlyData = Object.entries(monthlyMap).map(([m,pl])=>({m,pl}));

  // Weekday P&L
  const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const weekdayMap: Record<string,{pl:number,count:number}> = {};
  days.forEach(d=>weekdayMap[d]={pl:0,count:0});
  trades.forEach(t => {
    if (!t.startDate) return;
    const d = days[new Date(t.startDate).getDay()];
    weekdayMap[d].pl += parseFloat(t.pl||"0");
    weekdayMap[d].count++;
  });
  const weekdayData = days.map(d=>({day:d,...weekdayMap[d]}));

  // Hour data
  const hourMap: Record<number,{pl:number,count:number}> = {};
  for(let h=0;h<24;h++) hourMap[h]={pl:0,count:0};
  trades.forEach(t => {
    if (!t.startDate) return;
    const h = new Date(t.startDate).getHours();
    hourMap[h].pl += parseFloat(t.pl||"0");
    hourMap[h].count++;
  });
  const hourData = Object.entries(hourMap).map(([h,v])=>({hour:`${h}:00`,...v}));

  // Asset data
  const assetMap: Record<string,{pl:number,count:number}> = {};
  trades.forEach(t => {
    if (!assetMap[t.asset]) assetMap[t.asset]={pl:0,count:0};
    assetMap[t.asset].pl += parseFloat(t.pl||"0");
    assetMap[t.asset].count++;
  });
  const assetData = Object.entries(assetMap).map(([asset,v])=>({asset,...v})).sort((a,b)=>b.pl-a.pl);

  // Outcome distribution
  const outcomeData = [
    {name:"Win",value:wins,color:"#10b981"},
    {name:"Loss",value:losses,color:"#ef4444"},
    {name:"Breakeven",value:trades.filter(t=>t.outcome==="Breakeven").length,color:"#6b7280"},
  ].filter(d=>d.value>0);

  // Direction data
  const dirData = [
    {dir:"LONG",pl:trades.filter(t=>t.direction==="LONG").reduce((s,t)=>s+parseFloat(t.pl||"0"),0),count:trades.filter(t=>t.direction==="LONG").length},
    {dir:"SHORT",pl:trades.filter(t=>t.direction==="SHORT").reduce((s,t)=>s+parseFloat(t.pl||"0"),0),count:trades.filter(t=>t.direction==="SHORT").length},
  ];

  // Statistics chart data (trades per hour for selected day/week/month)
  const statsData = hourData.map(h => ({ time:h.hour, value: h.pl, avg: h.count*10 }));

  // Calendar
  const calYear = calMonth.getFullYear(); const calMonthIdx = calMonth.getMonth();
  const daysInMonth = new Date(calYear,calMonthIdx+1,0).getDate();
  const firstDay = new Date(calYear,calMonthIdx,1).getDay();
  const calDayMap: Record<string,{pl:number,count:number}> = {};
  trades.forEach(t => {
    if (!t.startDate) return;
    const d = new Date(t.startDate);
    if (d.getFullYear()===calYear && d.getMonth()===calMonthIdx) {
      const k = d.getDate().toString();
      if (!calDayMap[k]) calDayMap[k]={pl:0,count:0};
      calDayMap[k].pl += parseFloat(t.pl||"0");
      calDayMap[k].count++;
    }
  });

  // ─── Form state ────────────────────────────────────────────────────────────
  const emptyForm = {
    asset:"XAUUSD", timeframe:"1m", direction:"LONG" as "LONG"|"SHORT",
    tradeType:"Market", lotSize:"", ruleFollowed:"YES" as "YES"|"NO",
    outcome:"Win" as "Win"|"Loss"|"Breakeven", roi:"", pl:"",
    rating:5, startDate: toLocalDT(new Date().toISOString()),
    endDate: toLocalDT(new Date().toISOString()),
    notes:"", mistakes:"", lessons:"", emotion:"Focused",
    screenshots:[] as string[]
  };
  const [form, setForm] = useState(emptyForm);
  const [formScreenshots, setFormScreenshots] = useState<string[]>([]);
  const screenshotInputRef = useRef<HTMLInputElement>(null);

  const setField = (k: string, v: any) => {
    setForm(prev => {
      const next = {...prev, [k]:v};
      // auto negative on loss
      if (k==="outcome") {
        if (v==="Loss") {
          if (next.pl && !next.pl.startsWith("-")) next.pl = "-"+next.pl;
          if (next.roi && !next.roi.startsWith("-")) next.roi = "-"+next.roi;
        } else if (v==="Win") {
          if (next.pl) next.pl = next.pl.replace(/^-+/,"");
          if (next.roi) next.roi = next.roi.replace(/^-+/,"");
        }
      }
      if (k==="pl" && prev.outcome==="Loss" && v && !v.startsWith("-")) next.pl = "-"+v;
      if (k==="roi" && prev.outcome==="Loss" && v && !v.startsWith("-")) next.roi = "-"+v;
      // auto-fill end date
      if (k==="startDate") next.endDate = v;
      return next;
    });
  };

  const handleScreenshotUpload = (e: React.ChangeEvent<HTMLInputElement>, isForm=true) => {
    const files = Array.from(e.target.files||[]);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        if (isForm) setFormScreenshots(prev => [...prev, dataUrl]);
        else if (selectedTrade) {
          mutate(u => {
            const idx = u.trades.findIndex(t=>t.id===selectedTrade.id);
            if (idx>=0) { u.trades[idx].screenshots = [...(u.trades[idx].screenshots||[]),dataUrl]; }
          });
          setSelectedTrade(prev => prev ? {...prev, screenshots:[...(prev.screenshots||[]),dataUrl]} : prev);
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.asset.trim()) return;
    const trade: Trade = { ...form, id: uid(), screenshots: formScreenshots };
    mutate(u => { u.trades.unshift(trade); });
    setForm(emptyForm);
    setFormScreenshots([]);
    setPage("dashboard");
  };

  const deleteTrade = (id: string) => {
    mutate(u => { u.trades = u.trades.filter(t=>t.id!==id); });
    setDetailOpen(false); setSelectedTrade(null);
  };

  const updateTrade = (id: string, field: string, value: any) => {
    mutate(u => {
      const idx = u.trades.findIndex(t=>t.id===id);
      if (idx>=0) {
        (u.trades[idx] as any)[field] = value;
        if (field==="outcome") {
          const pl = parseFloat(u.trades[idx].pl||"0");
          const roi = parseFloat(u.trades[idx].roi||"0");
          if (value==="Loss") { u.trades[idx].pl=Math.abs(pl)<0?pl.toString():(-Math.abs(pl)).toString(); u.trades[idx].roi=(-Math.abs(roi)).toString(); }
          if (value==="Win") { u.trades[idx].pl=Math.abs(pl).toString(); u.trades[idx].roi=Math.abs(roi).toString(); }
        }
        setSelectedTrade({...u.trades[idx]});
      }
    });
  };

  const exportData = () => {
    if (!currentUser) return;
    const blob = new Blob([JSON.stringify({accounts:{[session!]:currentUser}},null,2)],{type:"application/json"});
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `tradetracker-${session}-${Date.now()}.json`; a.click();
  };

  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        const importedAccounts = data.accounts || {};
        setAccounts(prev => { const next = {...prev,...importedAccounts}; saveAccounts(next); return next; });
      } catch {}
    };
    reader.readAsText(file); e.target.value="";
  };

  const profilePicRef = useRef<HTMLInputElement>(null);
  const handleProfilePic = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { mutate(u => { u.profilePicture = ev.target?.result as string; }); };
    reader.readAsDataURL(file); e.target.value="";
  };

  // ─── Theme ─────────────────────────────────────────────────────────────────
  const bg = dm ? "#070a10" : "#f1f5f9";
  const sidebarBg = dm ? "#0a0d16" : "#ffffff";
  const sidebarBorder = dm ? "#1a1d2e" : "#e2e8f0";
  const textMain = dm ? "#ffffff" : "#0f172a";
  const textSub = dm ? "#6b7280" : "#64748b";
  const cardBg = dm ? "#0f1117" : "#ffffff";
  const cardBorder = dm ? "#1e2130" : "#e2e8f0";
  const inputBg = dm ? "#0a0d18" : "#f8fafc";
  const inputBorder = dm ? "#1e2130" : "#cbd5e1";

  if (showLanding && !session) {
    return <LandingPage onEnter={() => setShowLanding(false)} />;
  }

 if (session && !currentUser) {
  return <div className="text-white p-10">Loading...</div>;
}

if (!session) {
  return (
    <AnimatedAuthPage
      onLogin={(email) => {
        handleLogin(email);
        setShowLanding(false);
      }}
      onBack={() => setShowLanding(true)}
    />
  );
}

  // ─── Common input style ────────────────────────────────────────────────────
  const inputCls = `w-full px-3 py-2.5 rounded-xl text-sm border outline-none transition-colors focus:border-violet-500`;
  const inputStyle = { background:inputBg, borderColor:inputBorder, color:textMain };
  const labelCls = `block text-xs font-semibold uppercase tracking-wider mb-1.5`;
  const labelStyle = { color: textSub };

  const assetList = [...new Set(["XAUUSD", ...ASSETS])];

  // ── Lock body scroll for dashboard (sidebar fixed, main scrolls) ──────────
  useEffect(() => {
    document.body.classList.remove("landing");
    document.body.classList.add("dashboard");
    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.height = "100%";
    document.body.style.overflow = "hidden";
    document.body.style.height = "100%";
    const root = document.getElementById("root");
    if (root) { root.style.height = "100%"; root.style.overflow = "hidden"; }
    return () => {
      document.body.classList.remove("dashboard");
      document.documentElement.style.overflow = "";
      document.documentElement.style.height = "";
      document.body.style.overflow = "";
      document.body.style.height = "";
      if (root) { root.style.height = ""; root.style.overflow = ""; }
    };
  }, []);

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden" style={{background:bg, fontFamily:"'Inter',system-ui,sans-serif"}}>

      {/* ── Sidebar ── */}
      <aside className="flex-shrink-0 flex flex-col transition-all duration-300 relative z-40 h-screen overflow-y-auto"
        style={{width:sidebarOpen?220:72, background:sidebarBg, borderRight:`1px solid ${sidebarBorder}`}}>

        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b" style={{borderColor:sidebarBorder}}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{background:"linear-gradient(135deg,#7c3aed,#06b6d4)"}}>
            <TrendingUp size={18} className="text-white" />
          </div>
          {sidebarOpen && <span className="font-bold text-sm tracking-tight" style={{color:textMain}}>TradeTracker</span>}
        </div>

        {/* Profile */}
        <div className={`flex ${sidebarOpen?"items-center gap-3":"flex-col items-center"} px-3 py-4 border-b`} style={{borderColor:sidebarBorder}}>
          <div className="relative flex-shrink-0">
            <div onClick={()=>profilePicRef.current?.click()}
              className="w-10 h-10 rounded-xl cursor-pointer overflow-hidden flex items-center justify-center text-sm font-bold text-white"
              style={{background:currentUser.profilePicture?"transparent":"linear-gradient(135deg,#7c3aed,#06b6d4)"}}>
              {currentUser.profilePicture ? <img src={currentUser.profilePicture} className="w-full h-full object-cover" /> : (currentUser.username?.[0]?.toUpperCase()||"T")}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2" style={{background:"#10b981",borderColor:sidebarBg}} />
            <input ref={profilePicRef} type="file" accept="image/*" className="hidden" onChange={handleProfilePic} />
          </div>
          {sidebarOpen && (
            <div className="overflow-hidden">
              <div className="text-sm font-semibold truncate" style={{color:textMain}}>{currentUser.username}</div>
              <div className="text-xs truncate" style={{color:textSub}}>{currentUser.email}</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-1">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon; const active = page===item.id;
            return (
              <button key={item.id} onClick={()=>setPage(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${sidebarOpen?"":"justify-center"}`}
                style={{background:active?(dm?"#1a1040":"#ede9fe"):""  , color:active?"#a78bfa":(dm?"#6b7280":"#64748b")}}>
                <Icon size={18} />
                {sidebarOpen && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Bottom controls */}
        <div className="px-2 py-3 space-y-1 border-t" style={{borderColor:sidebarBorder}}>
          <button onClick={toggleDark} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${sidebarOpen?"":"justify-center"}`} style={{color:textSub}}>
            {dm ? <Sun size={16}/> : <Moon size={16}/>}
            {sidebarOpen && <span>{dm?"Light Mode":"Dark Mode"}</span>}
          </button>
          <button onClick={exportData} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${sidebarOpen?"":"justify-center"}`} style={{color:textSub}}>
            <Download size={16}/>
            {sidebarOpen && <span>Export</span>}
          </button>
          <label className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all cursor-pointer ${sidebarOpen?"":"justify-center"}`} style={{color:textSub}}>
            <Upload size={16}/>{sidebarOpen && <span>Import</span>}
            <input type="file" accept=".json" className="hidden" onChange={importData} />
          </label>
          <button onClick={handleLogout} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${sidebarOpen?"":"justify-center"}`} style={{color:"#ef4444"}}>
            <LogOut size={16}/>{sidebarOpen && <span>Log Out</span>}
          </button>
          <button onClick={()=>setSidebarOpen(v=>!v)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${sidebarOpen?"":"justify-center"}`} style={{color:textSub}}>
            {sidebarOpen ? <ChevronLeft size={16}/> : <ChevronRight size={16}/>}
            {sidebarOpen && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 h-screen overflow-y-auto" style={{minWidth:0, overscrollBehavior:"contain", WebkitOverflowScrolling:"touch"}}>

        {/* ── DASHBOARD ── */}
        {page==="dashboard" && (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold" style={{color:textMain}}>Dashboard</h1>
                <p className="text-sm mt-0.5" style={{color:textSub}}>{new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</p>
              </div>
              <button onClick={()=>setPage("add")} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:scale-105" style={{background:"linear-gradient(135deg,#7c3aed,#06b6d4)"}}>
                <PlusCircle size={16}/> Log Trade
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatTile label="Total Trades" value={trades.length} sub="All recorded" icon={Activity} color="#7c3aed" dark={dm} />
              <StatTile label="Win Rate" value={`${winRate}%`} sub={`${wins}W / ${losses}L`} icon={Target} color="#10b981" dark={dm} />
              <StatTile label="Total P&L" value={fmtMoney(totalPL)} sub="Net profit/loss" icon={DollarSign} color={totalPL>=0?"#10b981":"#ef4444"} dark={dm} />
              <StatTile label="Avg ROI" value={`${avgROI}%`} sub="Per trade average" icon={Percent} color="#f59e0b" dark={dm} />
            </div>

            {/* Equity Curve + Outcome */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <SectionCard title="Equity Curve" subtitle="Running account balance" dark={dm}>
                  {equityCurve.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={equityCurve} margin={{left:0,right:0,top:5,bottom:0}}>
                        <defs>
                          <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#7c3aed" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={dm?"#1e2130":"#f1f5f9"} />
                        <XAxis dataKey="date" tick={{fontSize:10,fill:textSub}} />
                        <YAxis tick={{fontSize:10,fill:textSub}} />
                        <Tooltip content={<DarkTooltip dark={dm} />} />
                        <Area type="monotone" dataKey="equity" name="Equity" stroke="#7c3aed" fill="url(#eqGrad)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[200px] flex flex-col items-center justify-center text-center" style={{color:textSub}}>
                      <TrendingUp size={32} className="opacity-30 mb-2"/>
                      <p className="text-sm">No trades yet — log your first trade!</p>
                    </div>
                  )}
                </SectionCard>
              </div>
              <SectionCard title="Outcome Mix" subtitle="Win/Loss/Breakeven" dark={dm}>
                {outcomeData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={outcomeData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value">
                        {outcomeData.map((e,i)=><Cell key={i} fill={e.color}/>)}
                      </Pie>
                      <Tooltip formatter={(v,n)=>[v,n]} contentStyle={{background:dm?"#1a1d2e":"#fff",border:`1px solid ${cardBorder}`,borderRadius:12,fontSize:12,color:textMain}} />
                      <Legend iconSize={8} wrapperStyle={{fontSize:12,color:textSub}} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[200px] flex items-center justify-center" style={{color:textSub}}>
                    <p className="text-sm opacity-50">No data yet</p>
                  </div>
                )}
              </SectionCard>
            </div>

            {/* Statistics Chart */}
            <SectionCard title="Statistics" subtitle="P&L by time of day"
              dark={dm}
              extra={
                <div className="flex gap-1">
                  {(["days","weeks","months"] as const).map(v => (
                    <button key={v} onClick={()=>setStatsView(v)}
                      className="px-3 py-1 rounded-full text-xs font-medium transition-all capitalize"
                      style={{background:statsView===v?(dm?"#1a1040":"#ede9fe"):"transparent",color:statsView===v?"#a78bfa":textSub}}>
                      {v}
                    </button>
                  ))}
                </div>
              }>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={statsData} margin={{left:0,right:0,top:5,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke={dm?"#1e2130":"#f1f5f9"} />
                  <XAxis dataKey="time" tick={{fontSize:10,fill:textSub}} />
                  <YAxis tick={{fontSize:10,fill:textSub}} />
                  <Tooltip content={<DarkTooltip dark={dm} />} />
                  <Line type="monotone" dataKey="value" name="P&L" stroke="#7c3aed" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="avg" name="Avg" stroke="#f59e0b" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
                </LineChart>
              </ResponsiveContainer>
            </SectionCard>

            {/* Weekday + Direction */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SectionCard title="Weekday Performance" subtitle="Total P&L by day of week" dark={dm}>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={weekdayData} margin={{left:0,right:0,top:5,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke={dm?"#1e2130":"#f1f5f9"} />
                    <XAxis dataKey="day" tick={{fontSize:10,fill:textSub}} />
                    <YAxis tick={{fontSize:10,fill:textSub}} />
                    <Tooltip content={<DarkTooltip dark={dm} />} />
                    <Bar dataKey="pl" name="P&L" radius={[4,4,0,0]}>
                      {weekdayData.map((d,i)=><Cell key={i} fill={d.pl>=0?"#10b981":"#ef4444"}/>)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </SectionCard>
              <SectionCard title="LONG vs SHORT" subtitle="Performance by direction" dark={dm}>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={dirData} margin={{left:0,right:0,top:5,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke={dm?"#1e2130":"#f1f5f9"} />
                    <XAxis dataKey="dir" tick={{fontSize:11,fill:textSub}} />
                    <YAxis tick={{fontSize:10,fill:textSub}} />
                    <Tooltip content={<DarkTooltip dark={dm} />} />
                    <Bar dataKey="pl" name="P&L" radius={[6,6,0,0]}>
                      {dirData.map((d,i)=><Cell key={i} fill={d.pl>=0?"#7c3aed":"#ef4444"}/>)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </SectionCard>
            </div>

            {/* Journal Table */}
            <SectionCard title="Trade Journal" subtitle={`${filtered.length} trades`} dark={dm}
              extra={
                <div className="flex gap-2 flex-wrap">
                  {[
                    {label:"Asset",val:filterAsset,set:setFilterAsset,opts:["All",...[...new Set(trades.map(t=>t.asset))]]},
                    {label:"Outcome",val:filterOutcome,set:setFilterOutcome,opts:["All","Win","Loss","Breakeven"]},
                    {label:"Dir",val:filterDirection,set:setFilterDirection,opts:["All","LONG","SHORT"]},
                  ].map(f=>(
                    <select key={f.label} value={f.val} onChange={e=>f.set(e.target.value)}
                      className="px-3 py-1.5 rounded-xl text-xs border outline-none"
                      style={{background:inputBg,borderColor:inputBorder,color:textMain}}>
                      {f.opts.map(o=><option key={o} value={o}>{o}</option>)}
                    </select>
                  ))}
                </div>
              }>
              <div className="overflow-x-auto -mx-5 px-5">
                <table className="w-full text-xs min-w-[900px]">
                  <thead>
                    <tr style={{borderBottom:`1px solid ${cardBorder}`}}>
                      {["Date","Asset","TF","Dir","Type","Lot","Rule","Outcome","ROI","P&L","Daily P&L","⭐",""].map(h=>(
                        <th key={h} className="text-left py-2 px-2 font-semibold" style={{color:textSub}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr><td colSpan={13} className="py-10 text-center" style={{color:textSub}}>No trades yet. Click "Log Trade" to add your first.</td></tr>
                    ) : filtered.map(t => {
                      const dayKey = t.startDate ? new Date(t.startDate).toLocaleDateString("en-US",{timeZone:"America/New_York"}) : "";
                      const dayPL = dailyPLMap[dayKey]||0;
                      return (
                        <tr key={t.id} onClick={()=>{ setSelectedTrade(t); setDetailOpen(true); setEditMode(false); }}
                          className="cursor-pointer transition-colors hover:bg-white/5 rounded-xl"
                          style={{borderBottom:`1px solid ${cardBorder}22`}}>
                          <td className="py-2 px-2" style={{color:textSub}}>{fmtDate(t.startDate)}</td>
                          <td className="py-2 px-2 font-semibold" style={{color:textMain}}>{t.asset}</td>
                          <td className="py-2 px-2" style={{color:textSub}}>{t.timeframe}</td>
                          <td className="py-2 px-2">
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{background:t.direction==="LONG"?"#10b98122":"#ef444422",color:t.direction==="LONG"?"#10b981":"#ef4444"}}>{t.direction}</span>
                          </td>
                          <td className="py-2 px-2" style={{color:textSub}}>{t.tradeType}</td>
                          <td className="py-2 px-2" style={{color:textSub}}>{t.lotSize||"—"}</td>
                          <td className="py-2 px-2">
                            <span style={{color:t.ruleFollowed==="YES"?"#10b981":"#ef4444"}}>{t.ruleFollowed}</span>
                          </td>
                          <td className="py-2 px-2">
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                              style={{background:t.outcome==="Win"?"#10b98122":t.outcome==="Loss"?"#ef444422":"#6b728022",
                                color:t.outcome==="Win"?"#10b981":t.outcome==="Loss"?"#ef4444":"#9ca3af"}}>
                              {t.outcome}
                            </span>
                          </td>
                          <td className="py-2 px-2 font-mono" style={{color:parseFloat(t.roi||"0")>=0?"#10b981":"#ef4444"}}>{t.roi?`${t.roi}%`:"—"}</td>
                          <td className="py-2 px-2 font-mono font-bold" style={{color:parseFloat(t.pl||"0")>=0?"#10b981":"#ef4444"}}>
                            {t.pl ? fmtMoney(parseFloat(t.pl)) : "—"}
                          </td>
                          <td className="py-2 px-2 font-mono font-bold" style={{color:dayPL>=0?"#10b981":"#ef4444"}}>
                            {fmtMoney(dayPL)}
                          </td>
                          <td className="py-2 px-2"><StarRating rating={t.rating} size={12} /></td>
                          <td className="py-2 px-2">
                            <button onClick={e=>{e.stopPropagation();if(confirm("Delete this trade?"))deleteTrade(t.id);}} className="p-1 rounded hover:text-red-400 transition-colors" style={{color:textSub}}><Trash2 size={13}/></button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>
        )}

        {/* ── ADD TRADE ── */}
        {page==="add" && (
          <div className="p-6 max-w-3xl mx-auto">
            <div className="mb-6">
              <h1 className="text-2xl font-bold" style={{color:textMain}}>Log a Trade</h1>
              <p className="text-sm mt-1" style={{color:textSub}}>Record your trade details below</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="rounded-2xl p-5 space-y-4" style={{background:cardBg,border:`1px solid ${cardBorder}`}}>
                <h3 className="font-semibold text-sm" style={{color:textMain}}>Trade Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  {/* Asset with dropdown */}
                  <div>
                    <label className={labelCls} style={labelStyle}>Asset *</label>
                    <div className="relative">
                      <select value={form.asset} onChange={e=>setField("asset",e.target.value)}
                        className={inputCls} style={inputStyle}>
                        {assetList.map(a=><option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className={labelCls} style={labelStyle}>Timeframe</label>
                    <select value={form.timeframe} onChange={e=>setField("timeframe",e.target.value)} className={inputCls} style={inputStyle}>
                      {TIMEFRAMES.map(t=><option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls} style={labelStyle}>Direction</label>
                    <select value={form.direction} onChange={e=>setField("direction",e.target.value)} className={inputCls} style={inputStyle}>
                      <option value="LONG">LONG</option>
                      <option value="SHORT">SHORT</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls} style={labelStyle}>Outcome</label>
                    <select value={form.outcome} onChange={e=>setField("outcome",e.target.value)} className={inputCls} style={inputStyle}>
                      <option value="Win">Win</option>
                      <option value="Loss">Loss</option>
                      <option value="Breakeven">Breakeven</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls} style={labelStyle}>P&L ($)</label>
                    <input value={form.pl} onChange={e=>setField("pl",e.target.value)} placeholder="e.g. 250 or -150"
                      className={inputCls} style={inputStyle} />
                  </div>
                  <div>
                    <label className={labelCls} style={labelStyle}>ROI (%)</label>
                    <input value={form.roi} onChange={e=>setField("roi",e.target.value)} placeholder="e.g. 2.5"
                      className={inputCls} style={inputStyle} />
                  </div>
                  <div>
                    <label className={labelCls} style={labelStyle}>Lot Size</label>
                    <input value={form.lotSize} onChange={e=>setField("lotSize",e.target.value)} placeholder="e.g. 0.10"
                      className={inputCls} style={inputStyle} />
                  </div>
                  <div>
                    <label className={labelCls} style={labelStyle}>Trade Type</label>
                    <select value={form.tradeType} onChange={e=>setField("tradeType",e.target.value)} className={inputCls} style={inputStyle}>
                      {TRADE_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls} style={labelStyle}>Rule Followed</label>
                    <select value={form.ruleFollowed} onChange={e=>setField("ruleFollowed",e.target.value)} className={inputCls} style={inputStyle}>
                      <option value="YES">YES</option>
                      <option value="NO">NO</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls} style={labelStyle}>Emotion</label>
                    <select value={form.emotion} onChange={e=>setField("emotion",e.target.value)} className={inputCls} style={inputStyle}>
                      {EMOTIONS.map(e=><option key={e} value={e}>{e}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls} style={labelStyle}>Rating</label>
                    <select value={form.rating} onChange={e=>setField("rating",parseInt(e.target.value))} className={inputCls} style={inputStyle}>
                      {[1,2,3,4,5].map(r=><option key={r} value={r}>{r} Star{r>1?"s":""}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls} style={labelStyle}>Start Date & Time</label>
                    <input type="datetime-local" value={form.startDate} onChange={e=>setField("startDate",e.target.value)}
                      className={inputCls} style={inputStyle} />
                  </div>
                  <div>
                    <label className={labelCls} style={labelStyle}>End Date & Time</label>
                    <input type="datetime-local" value={form.endDate} onChange={e=>setField("endDate",e.target.value)}
                      className={inputCls} style={inputStyle} />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="rounded-2xl p-5 space-y-4" style={{background:cardBg,border:`1px solid ${cardBorder}`}}>
                <h3 className="font-semibold text-sm" style={{color:textMain}}>Journal Notes</h3>
                {[
                  {key:"notes",label:"Notes",placeholder:"Trade notes, observations, market conditions…"},
                  {key:"mistakes",label:"Mistakes",placeholder:"What went wrong? What would you do differently?"},
                  {key:"lessons",label:"Lessons Learned",placeholder:"Key takeaways from this trade…"},
                ].map(f=>(
                  <div key={f.key}>
                    <label className={labelCls} style={labelStyle}>{f.label}</label>
                    <textarea value={(form as any)[f.key]} onChange={e=>setField(f.key,e.target.value)}
                      placeholder={f.placeholder} rows={3}
                      className={`${inputCls} resize-none`} style={inputStyle} />
                  </div>
                ))}
              </div>

              {/* Screenshots */}
              <div className="rounded-2xl p-5 space-y-4" style={{background:cardBg,border:`1px solid ${cardBorder}`}}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm" style={{color:textMain}}>Screenshots</h3>
                  <button type="button" onClick={()=>screenshotInputRef.current?.click()}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:opacity-90"
                    style={{background:"linear-gradient(135deg,#7c3aed,#06b6d4)",color:"white"}}>
                    <Camera size={13}/> Upload Screenshot
                  </button>
                  <input ref={screenshotInputRef} type="file" accept="image/*" multiple className="hidden"
                    onChange={e=>handleScreenshotUpload(e,true)} />
                </div>
                {formScreenshots.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {formScreenshots.map((src,i)=>(
                      <div key={i} className="relative group rounded-xl overflow-hidden aspect-video" style={{background:inputBg}}>
                        <img src={src} className="w-full h-full object-cover" alt={`screenshot ${i+1}`} />
                        <button type="button" onClick={()=>setFormScreenshots(prev=>prev.filter((_,j)=>j!==i))}
                          className="absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{background:"#ef4444"}}><X size={10} className="text-white"/></button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div onClick={()=>screenshotInputRef.current?.click()}
                    className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors hover:border-violet-500"
                    style={{borderColor:inputBorder}}>
                    <ImageIcon size={28} className="mx-auto mb-2 opacity-30" style={{color:textSub}} />
                    <p className="text-sm" style={{color:textSub}}>Click to upload entry/exit chart screenshots</p>
                    <p className="text-xs mt-1 opacity-50" style={{color:textSub}}>PNG, JPG, WebP supported</p>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button type="submit" className="flex-1 py-3 rounded-xl font-semibold text-sm text-white transition-all hover:opacity-90"
                  style={{background:"linear-gradient(135deg,#7c3aed,#06b6d4)"}}>
                  Save Trade
                </button>
                <button type="button" onClick={()=>{ setForm(emptyForm); setFormScreenshots([]); setPage("dashboard"); }}
                  className="px-6 py-3 rounded-xl font-semibold text-sm border transition-all"
                  style={{borderColor:cardBorder,color:textSub,background:"transparent"}}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── ANALYTICS ── */}
        {page==="analytics" && (
          <div className="p-6 space-y-6">
            <div>
              <h1 className="text-2xl font-bold" style={{color:textMain}}>Analytics</h1>
              <p className="text-sm mt-0.5" style={{color:textSub}}>Deep performance insights from your trading history</p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatTile label="Best Trade" value={bestTrade?fmtMoney(parseFloat(bestTrade.pl||"0")):"—"} sub={bestTrade?.asset||""} icon={TrendingUp} color="#10b981" dark={dm} />
              <StatTile label="Worst Trade" value={worstTrade?fmtMoney(parseFloat(worstTrade.pl||"0")):"—"} sub={worstTrade?.asset||""} icon={TrendingDown} color="#ef4444" dark={dm} />
              <StatTile label="Profit Factor" value={losses>0?(Math.abs(trades.filter(t=>t.outcome==="Win").reduce((s,t)=>s+parseFloat(t.pl||"0"),0))/Math.abs(trades.filter(t=>t.outcome==="Loss").reduce((s,t)=>s+parseFloat(t.pl||"0"),0))).toFixed(2):"∞"} sub="Gross profit / loss" icon={BarChart3} color="#7c3aed" dark={dm} />
              <StatTile label="Avg Win / Avg Loss" value={wins>0&&losses>0?`${(trades.filter(t=>t.outcome==="Win").reduce((s,t)=>s+parseFloat(t.pl||"0"),0)/wins/Math.abs(trades.filter(t=>t.outcome==="Loss").reduce((s,t)=>s+parseFloat(t.pl||"0"),0)/losses)).toFixed(2)}x`:"—"} sub="Risk/reward ratio" icon={Award} color="#f59e0b" dark={dm} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SectionCard title="Monthly P&L" subtitle="Profit and loss by month" dark={dm}>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={monthlyData} margin={{left:0,right:0,top:5,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke={dm?"#1e2130":"#f1f5f9"} />
                    <XAxis dataKey="m" tick={{fontSize:10,fill:textSub}} />
                    <YAxis tick={{fontSize:10,fill:textSub}} />
                    <Tooltip content={<DarkTooltip dark={dm}/>} />
                    <Bar dataKey="pl" name="P&L" radius={[4,4,0,0]}>
                      {monthlyData.map((d,i)=><Cell key={i} fill={d.pl>=0?"#7c3aed":"#ef4444"}/>)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </SectionCard>
              <SectionCard title="Asset Performance" subtitle="P&L by trading pair" dark={dm}>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={assetData} layout="vertical" margin={{left:10,right:0,top:5,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke={dm?"#1e2130":"#f1f5f9"} />
                    <XAxis type="number" tick={{fontSize:10,fill:textSub}} />
                    <YAxis type="category" dataKey="asset" tick={{fontSize:10,fill:textSub}} width={60} />
                    <Tooltip content={<DarkTooltip dark={dm}/>} />
                    <Bar dataKey="pl" name="P&L" radius={[0,4,4,0]}>
                      {assetData.map((d,i)=><Cell key={i} fill={d.pl>=0?"#10b981":"#ef4444"}/>)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </SectionCard>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SectionCard title="Trading Hours" subtitle="EST — P&L by hour of day" dark={dm}>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={hourData} margin={{left:0,right:0,top:5,bottom:0}}>
                    <defs>
                      <linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={dm?"#1e2130":"#f1f5f9"} />
                    <XAxis dataKey="hour" tick={{fontSize:9,fill:textSub}} />
                    <YAxis tick={{fontSize:9,fill:textSub}} />
                    <Tooltip content={<DarkTooltip dark={dm}/>} />
                    <Area type="monotone" dataKey="pl" name="P&L" stroke="#06b6d4" fill="url(#hrGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </SectionCard>
              <SectionCard title="Weekday Performance" subtitle="P&L by day of week" dark={dm}>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={weekdayData} margin={{left:0,right:0,top:5,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke={dm?"#1e2130":"#f1f5f9"} />
                    <XAxis dataKey="day" tick={{fontSize:11,fill:textSub}} />
                    <YAxis tick={{fontSize:10,fill:textSub}} />
                    <Tooltip content={<DarkTooltip dark={dm}/>} />
                    <Bar dataKey="pl" name="P&L" radius={[6,6,0,0]}>
                      {weekdayData.map((d,i)=><Cell key={i} fill={d.pl>=0?"#10b981":"#ef4444"}/>)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </SectionCard>
            </div>

            <SectionCard title="Scatter — ROI vs P&L" subtitle="Each dot = one trade" dark={dm}>
              <ResponsiveContainer width="100%" height={200}>
                <ScatterChart margin={{left:0,right:0,top:5,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke={dm?"#1e2130":"#f1f5f9"} />
                  <XAxis dataKey="roi" name="ROI %" tick={{fontSize:10,fill:textSub}} />
                  <YAxis dataKey="pl" name="P&L $" tick={{fontSize:10,fill:textSub}} />
                  <Tooltip cursor={{strokeDasharray:"3 3"}} contentStyle={{background:dm?"#1a1d2e":"#fff",border:`1px solid ${cardBorder}`,borderRadius:12,fontSize:12,color:textMain}} />
                  <Scatter name="Trades" data={trades.map(t=>({roi:parseFloat(t.roi||"0"),pl:parseFloat(t.pl||"0"),outcome:t.outcome}))}
                    fill="#7c3aed">
                    {trades.map((t,i)=><Cell key={i} fill={t.outcome==="Win"?"#10b981":t.outcome==="Loss"?"#ef4444":"#6b7280"}/>)}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </SectionCard>
          </div>
        )}

        {/* ── CALENDAR ── */}
        {page==="calendar" && (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold" style={{color:textMain}}>Trading Calendar</h1>
                <p className="text-sm mt-0.5" style={{color:textSub}}>P&L and trade count by day</p>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={()=>setCalMonth(d=>new Date(d.getFullYear(),d.getMonth()-1,1))}
                  className="p-2 rounded-xl border transition-colors" style={{borderColor:cardBorder,color:textSub}}>
                  <ChevronLeft size={16}/>
                </button>
                <span className="text-sm font-semibold" style={{color:textMain}}>
                  {calMonth.toLocaleDateString("en-US",{month:"long",year:"numeric"})}
                </span>
                <button onClick={()=>setCalMonth(d=>new Date(d.getFullYear(),d.getMonth()+1,1))}
                  className="p-2 rounded-xl border transition-colors" style={{borderColor:cardBorder,color:textSub}}>
                  <ChevronRight size={16}/>
                </button>
              </div>
            </div>

            <div className="rounded-2xl p-5" style={{background:cardBg,border:`1px solid ${cardBorder}`}}>
              <div className="grid grid-cols-7 gap-1 mb-2">
                {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d=>(
                  <div key={d} className="text-center text-xs font-semibold py-2" style={{color:textSub}}>{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({length:firstDay}).map((_,i)=><div key={`e${i}`}/>)}
                {Array.from({length:daysInMonth}).map((_,i)=>{
                  const day = i+1; const k = day.toString();
                  const info = calDayMap[k];
                  const isToday = new Date().getDate()===day && new Date().getMonth()===calMonthIdx && new Date().getFullYear()===calYear;
                  return (
                    <div key={day} className="rounded-xl p-2 min-h-[60px] flex flex-col items-center justify-start text-center transition-all"
                      style={{background:info?(info.pl>=0?"#10b98115":"#ef444415"):(isToday?"#7c3aed15":dm?"#0a0d18":"#f8fafc"),
                        border:`1px solid ${info?(info.pl>=0?"#10b98133":"#ef444433"):(isToday?"#7c3aed44":cardBorder)}`}}>
                      <span className="text-xs font-bold" style={{color:isToday?"#7c3aed":textSub}}>{day}</span>
                      {info && (
                        <>
                          <span className="text-xs font-bold mt-1" style={{color:info.pl>=0?"#10b981":"#ef4444"}}>
                            {fmtMoney(info.pl)}
                          </span>
                          <span className="text-xs opacity-60" style={{color:textSub}}>{info.count}t</span>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Monthly summary */}
            <div className="grid grid-cols-3 gap-4">
              <StatTile label="Month Trades" value={Object.values(calDayMap).reduce((s,d)=>s+d.count,0)} icon={Activity} color="#7c3aed" dark={dm} />
              <StatTile label="Month P&L" value={fmtMoney(Object.values(calDayMap).reduce((s,d)=>s+d.pl,0))} icon={DollarSign} color="#10b981" dark={dm} />
              <StatTile label="Trading Days" value={Object.keys(calDayMap).length} icon={Calendar} color="#f59e0b" dark={dm} />
            </div>
          </div>
        )}
      </main>

      {/* ── Trade Detail Panel ── */}
      {detailOpen && selectedTrade && (
        <div className="fixed inset-0 z-50 flex items-start justify-end p-4 pointer-events-none">
          <div className="pointer-events-auto w-full max-w-md h-[calc(100vh-2rem)] flex flex-col rounded-2xl overflow-hidden shadow-2xl"
            style={{background:dm?"#0a0d16":"#ffffff",border:`1px solid ${dm?"#1a1d2e":"#e2e8f0"}`}}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{borderColor:dm?"#1a1d2e":"#e2e8f0"}}>
              <div>
                <p className="text-xs font-semibold tracking-widest" style={{color:"#7c3aed"}}>TRADE REVIEW</p>
                <h2 className="text-lg font-bold" style={{color:textMain}}>{selectedTrade.asset}</h2>
              </div>
              <div className="flex gap-2">
                <button onClick={()=>setEditMode(v=>!v)} className="p-2 rounded-xl border transition-colors" style={{borderColor:editMode?"#7c3aed":dm?"#1a1d2e":"#e2e8f0",color:editMode?"#7c3aed":textSub}}>
                  <Edit2 size={15}/>
                </button>
                <button onClick={()=>{if(confirm("Delete?"))deleteTrade(selectedTrade.id);}} className="p-2 rounded-xl border transition-colors" style={{borderColor:"#ef444433",color:"#ef4444"}}>
                  <Trash2 size={15}/>
                </button>
                <button onClick={()=>{setDetailOpen(false);setEditMode(false);}} className="p-2 rounded-xl border transition-colors" style={{borderColor:dm?"#1a1d2e":"#e2e8f0",color:textSub}}>
                  <X size={15}/>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {/* Fields */}
              {[
                {label:"ASSET",field:"asset",value:selectedTrade.asset,opts:ASSETS},
                {label:"OUTCOME",field:"outcome",value:selectedTrade.outcome,opts:["Win","Loss","Breakeven"]},
                {label:"DIRECTION",field:"direction",value:selectedTrade.direction,opts:["LONG","SHORT"]},
                {label:"P&L ($)",field:"pl",value:selectedTrade.pl?fmtMoney(parseFloat(selectedTrade.pl)):"—"},
                {label:"ROI (%)",field:"roi",value:selectedTrade.roi?`${selectedTrade.roi}%`:"—"},
                {label:"LOT SIZE",field:"lotSize",value:selectedTrade.lotSize||"—"},
                {label:"RULE FOLLOWED",field:"ruleFollowed",value:selectedTrade.ruleFollowed,opts:["YES","NO"]},
                {label:"EMOTION",field:"emotion",value:selectedTrade.emotion,opts:EMOTIONS},
                {label:"EXECUTION TIME (EST)",field:null,value:fmtEST(selectedTrade.startDate)},
              ].map(f=>(
                <div key={f.label} className="rounded-xl px-4 py-3" style={{background:dm?"#0f1117":"#f8fafc",border:`1px solid ${dm?"#1e2130":"#e2e8f0"}`}}>
                  <p className="text-xs font-semibold tracking-widest mb-1" style={{color:textSub}}>{f.label}</p>
                  {editMode && f.field ? (
                    <InlineEdit value={(selectedTrade as any)[f.field]} dark={dm}
                      options={f.opts}
                      onSave={v=>updateTrade(selectedTrade.id,f.field!,v)} />
                  ) : (
                    <p className="font-semibold text-sm" style={{color:f.label==="P&L ($)"?(parseFloat(selectedTrade.pl||"0")>=0?"#10b981":"#ef4444"):f.label==="ROI (%)"?(parseFloat(selectedTrade.roi||"0")>=0?"#10b981":"#ef4444"):textMain}}>
                      {f.value}
                    </p>
                  )}
                </div>
              ))}

              {/* Rating */}
              <div className="rounded-xl px-4 py-3" style={{background:dm?"#0f1117":"#f8fafc",border:`1px solid ${dm?"#1e2130":"#e2e8f0"}`}}>
                <p className="text-xs font-semibold tracking-widest mb-2" style={{color:textSub}}>RATING</p>
                <StarRating rating={selectedTrade.rating} size={18} onRate={editMode?r=>updateTrade(selectedTrade.id,"rating",r):null} />
              </div>

              {/* Text fields */}
              {[
                {label:"NOTES",field:"notes",placeholder:"No notes added."},
                {label:"MISTAKES",field:"mistakes",placeholder:"None logged."},
                {label:"LESSONS LEARNED",field:"lessons",placeholder:"None recorded."},
              ].map(f=>(
                <div key={f.label} className="rounded-xl px-4 py-3" style={{background:dm?"#0f1117":"#f8fafc",border:`1px solid ${dm?"#1e2130":"#e2e8f0"}`}}>
                  <p className="text-xs font-semibold tracking-widest mb-2" style={{color:textSub}}>{f.label}</p>
                  {editMode ? (
                    <textarea value={(selectedTrade as any)[f.field]||""} rows={3}
                      onChange={e=>updateTrade(selectedTrade.id,f.field,e.target.value)}
                      className="w-full rounded-lg px-3 py-2 text-sm border outline-none resize-none"
                      style={{background:dm?"#0a0d18":"#ffffff",borderColor:dm?"#1e2130":"#cbd5e1",color:textMain}} />
                  ) : (
                    <p className="text-sm" style={{color:(selectedTrade as any)[f.field]?textMain:textSub}}>
                      {(selectedTrade as any)[f.field]||f.placeholder}
                    </p>
                  )}
                </div>
              ))}

              {/* Screenshots */}
              <div className="rounded-xl px-4 py-3" style={{background:dm?"#0f1117":"#f8fafc",border:`1px solid ${dm?"#1e2130":"#e2e8f0"}`}}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold tracking-widest" style={{color:textSub}}>SCREENSHOTS</p>
                  <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all hover:opacity-90"
                    style={{background:"#7c3aed22",color:"#a78bfa"}}>
                    <Camera size={11}/> Add
                    <input type="file" accept="image/*" multiple className="hidden" onChange={e=>handleScreenshotUpload(e,false)} />
                  </label>
                </div>
                {(selectedTrade.screenshots||[]).length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {selectedTrade.screenshots.map((src,i)=>(
                      <div key={i} className="relative group rounded-xl overflow-hidden aspect-video">
                        <img src={src} className="w-full h-full object-cover" alt={`screenshot ${i+1}`} />
                        {editMode && (
                          <button onClick={()=>{
                            mutate(u=>{const idx=u.trades.findIndex(t=>t.id===selectedTrade.id);if(idx>=0){u.trades[idx].screenshots=u.trades[idx].screenshots.filter((_,j)=>j!==i);}});
                            setSelectedTrade(prev=>prev?{...prev,screenshots:prev.screenshots.filter((_,j)=>j!==i)}:prev);
                          }} className="absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{background:"#ef4444"}}>
                            <X size={10} className="text-white"/>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs" style={{color:textSub}}>No screenshots uploaded.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
