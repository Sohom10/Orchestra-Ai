"use client";

import { motion, AnimatePresence, Variants } from "framer-motion";
import { 
  Send, 
  Bot, 
  User, 
  Plus, 
  Search, 
  LayoutGrid, 
  Clock, 
  Download, 
  Paperclip, 
  Mic, 
  Activity, 
  Database,
  ChevronRight,
  Sparkles,
  ArrowRight,
  Cloud,
  FileText,
  StopCircle,
  LogOut,
  Loader2,
  CheckCircle2,
  BookOpen,
  Edit2,
  Trash2,
  Check,
  X
} from "lucide-react";
import { useState, useRef, useEffect, useMemo } from "react";
import OrchestraOrb from "@/components/OrchestraOrb";
import SearchInterface from "@/components/SearchInterface";
import { useTheme } from "@/context/ThemeContext";
import { ThemeSelector } from "@/components/ThemeSelector";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Mermaid from "@/components/Mermaid";

import { TerminalStream, AgentThought } from "@/components/TerminalStream";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { ResearchDepth, ChatMessage, ResearchHistoryItem } from "@/types";
import { toast } from "sonner";

const getBackendUrl = () => typeof window !== 'undefined' ? `http://${window.location.hostname}:8000` : "http://127.0.0.1:8000";
const getWsUrl = () => typeof window !== 'undefined' ? `ws://${window.location.hostname}:8000` : "ws://127.0.0.1:8000";

// Reusable animated count-up hook & component
const AnimatedCounter = ({ value, duration = 1.5, decimals = 0, suffix = "" }: { value: number; duration?: number; decimals?: number; suffix?: string }) => {
  const [count, setCount] = useState(0);
  const prevValueRef = useRef(0);

  useEffect(() => {
    const start = prevValueRef.current;
    const end = value;
    if (start === end) {
      setCount(end);
      return;
    }

    const totalMiliseconds = duration * 1000;
    const intervalTime = 30;
    const totalSteps = totalMiliseconds / intervalTime;
    const increment = (end - start) / totalSteps;

    let currentStep = 0;
    const timer = setInterval(() => {
      currentStep++;
      setCount(() => {
        const next = start + (increment * currentStep);
        if (currentStep >= totalSteps) {
          clearInterval(timer);
          prevValueRef.current = end;
          return end;
        }
        return next;
      });
    }, intervalTime);

    return () => {
      clearInterval(timer);
      prevValueRef.current = end;
    };
  }, [value, duration]);

  return <>{count.toFixed(decimals)}{suffix}</>;
};

// Isolated telemetry child components for performant rendering
const ExposureTelemetry = ({ value }: { value: number }) => {
  return (
    <div className="p-4 bg-app border border-main" style={{ borderRadius: 'var(--radius-md)', borderColor: 'var(--border-main)' }}>
      <span className="text-[9px] uppercase tracking-widest text-muted font-bold block mb-1">Exposure Level</span>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-black font-mono text-main">
          <AnimatedCounter value={value} duration={1.5} decimals={1} suffix="%" />
        </span>
        <span className="text-[9px] text-amber-500 font-bold uppercase tracking-tight">Critical</span>
      </div>
      <div className="w-full h-1 bg-sidebar border border-main mt-3 overflow-hidden" style={{ borderRadius: 'var(--radius-full)', borderColor: 'var(--border-main)' }}>
        <motion.div 
          className="h-full bg-primary" 
          animate={{ width: `${value}%` }} 
          transition={{ type: "spring", stiffness: 80, damping: 15 }} 
        />
      </div>
    </div>
  );
};

const VolatilityTelemetry = ({ value }: { value: number }) => {
  return (
    <div className="p-4 bg-app border border-main" style={{ borderRadius: 'var(--radius-md)', borderColor: 'var(--border-main)' }}>
      <span className="text-[9px] uppercase tracking-widest text-muted font-bold block mb-1">Market Volatility</span>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-black font-mono text-main">
          +<AnimatedCounter value={value} duration={1.5} decimals={1} />
        </span>
        <span className="text-[9px] text-primary font-bold uppercase tracking-tight">Active</span>
      </div>
      <div className="w-full h-1 bg-sidebar border border-main mt-3 overflow-hidden" style={{ borderRadius: 'var(--radius-full)', borderColor: 'var(--border-main)' }}>
        <motion.div 
          className="h-full bg-primary" 
          animate={{ width: `${(value / 20) * 100}%` }} 
          transition={{ type: "spring", stiffness: 80, damping: 15 }} 
        />
      </div>
    </div>
  );
};

const ShenzhenTelemetry = ({ value }: { value: number }) => {
  return (
    <span className="text-xs text-red-500 font-bold font-mono">
      <AnimatedCounter value={value} duration={1.5} decimals={1} suffix="%" />
    </span>
  );
};

const NetworkHealthTelemetry = ({ value }: { value: number }) => {
  return (
    <span className="text-lg font-black font-mono text-primary animate-pulse">
      <AnimatedCounter value={value} duration={1.5} decimals={2} suffix="%" />
    </span>
  );
};

// Framer Motion entry animations config
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08
    }
  }
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 15 },
  show: { 
    opacity: 1, 
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 100,
      damping: 15
    }
  }
};

// ─── Dynamic Intelligence Topic Pool ──────────────────────────────────────────
const alertBadgeMap: Record<string, string> = {
  amber: 'border-amber-500/20 bg-amber-500/5 text-amber-500',
  red: 'border-red-500/20 bg-red-500/5 text-red-500',
  orange: 'border-orange-500/20 bg-orange-500/5 text-orange-500',
  blue: 'border-blue-500/20 bg-blue-500/5 text-blue-500',
  violet: 'border-violet-500/20 bg-violet-500/5 text-violet-500',
};
const alertDotMap: Record<string, string> = {
  amber: 'bg-amber-500', red: 'bg-red-500', orange: 'bg-orange-500',
  blue: 'bg-blue-500', violet: 'bg-violet-500',
};
const briefingBarMap: Record<string, string> = {
  amber: 'bg-amber-500', red: 'bg-red-500', primary: 'bg-[#06b6d4]', zinc: 'bg-zinc-600',
};
interface IntelBriefing { time: string; type: string; color: string; headline: string; body: string; query: string; }
interface IntelAsset { name: string; value: string; color: string; }
interface IntelTopic {
  id: string; category: string; title: string; alertLevel: string; alertColor: string;
  quote: string; body: string; tags: string[]; assets: IntelAsset[];
  briefings: IntelBriefing[]; inference: string; inferenceQuery: string; researchQuery: string;
}

const INTELLIGENCE_TOPICS: IntelTopic[] = [
  {
    id: 'semiconductor',
    category: 'Strategic Focus Arena',
    title: 'Global Semiconductor Supply Chain Vulnerability',
    alertLevel: 'HIGH ALERT', alertColor: 'amber',
    quote: '"The recent shifts in East Asian logistics corridors have created a 14% delta in standard transit times."',
    body: 'Control over the physical fabrication layer and deep lithography is the new geopolitics. Nations are no longer trading in raw reserves, but in strategic petaflops per square meter.',
    tags: ['TSMC N2 Yields', 'HBM4 Latency'],
    assets: [
      { name: 'SHENZHEN HUB', value: '-2.4%', color: 'text-red-500' },
      { name: 'HSINCHU PARK', value: '+0.8%', color: 'text-primary' },
      { name: 'AUSTIN SATELLITE', value: 'STABLE', color: 'text-muted' },
    ],
    briefings: [
      { time: '14:22 GMT', type: 'RISK DETECTED', color: 'amber', headline: 'Singapore congestion reaches 18-month high', body: 'Algorithmic traffic management delays autonomous freighter vessels.', query: 'Singapore port congestion semiconductor supply chain impact 2026' },
      { time: '11:05 GMT', type: 'UPDATE', color: 'primary', headline: 'Rare earth mining permits approved in Greenland', body: 'Nordic strategic shift expected by Q3. High competition projected.', query: 'Greenland rare earth mining semiconductor strategic implications 2026' },
      { time: '09:12 GMT', type: 'ARCHIVED', color: 'zinc', headline: 'Lithium prices stabilize globally', body: 'Supply chain equilibrium reached according to Q1 trade index.', query: 'Global lithium price stabilization supply chain 2026' },
    ],
    inference: '"Patterns suggest a pre-emptive accumulation of raw silicon by sovereign-backed entities. Recommend monitoring freight insurance premiums in the Malacca Strait over the next 72 hours."',
    inferenceQuery: 'Semiconductor supply chain sovereign accumulation Malacca Strait risk analysis 2026',
    researchQuery: 'Global Semiconductor Supply Chain Vulnerability geopolitics 2026',
  },
  {
    id: 'climate',
    category: 'Climate Intelligence Arena',
    title: 'Critical Infrastructure & Climate Systemic Risk',
    alertLevel: 'ELEVATED', alertColor: 'orange',
    quote: '"Cascading grid failures across three continents signal a structural fragility in baseload energy architecture unprecedented since 2003."',
    body: 'The acceleration of climate-driven infrastructure shocks is redefining energy security doctrine. Sovereign wealth funds are rotating into resilience assets at a pace not seen in modern commodity history.',
    tags: ['Grid Resilience Index', 'Carbon Credit Futures'],
    assets: [
      { name: 'TEXAS GRID', value: 'STRESS', color: 'text-amber-500' },
      { name: 'EUROPE CORRIDOR', value: '-1.2%', color: 'text-red-500' },
      { name: 'APAC RENEWABLES', value: '+3.1%', color: 'text-primary' },
    ],
    briefings: [
      { time: '16:45 GMT', type: 'RISK DETECTED', color: 'amber', headline: 'Arctic methane releases hit 40-year record', body: 'Permafrost degradation accelerating beyond 2025 IPCC projections.', query: 'Arctic methane permafrost climate tipping point risk 2026' },
      { time: '13:20 GMT', type: 'UPDATE', color: 'primary', headline: 'EU Carbon Border Adjustment enters enforcement phase', body: 'Industrial exporters face new compliance costs effective Q2.', query: 'EU Carbon Border Adjustment Mechanism industrial impact 2026' },
      { time: '10:00 GMT', type: 'ARCHIVED', color: 'zinc', headline: 'Solar capacity additions surpass coal globally', body: 'IEA confirms renewable inflection milestone reached in March.', query: 'Solar capacity surpasses coal global energy transition milestone 2026' },
    ],
    inference: '"Climate stress is increasingly correlated with political instability in G7 periphery nations. Energy security mandates will drive $2.4T in sovereign infrastructure investment through 2028."',
    inferenceQuery: 'Climate infrastructure risk sovereign investment geopolitical stability 2026 analysis',
    researchQuery: 'Critical Infrastructure Climate Systemic Risk energy security 2026',
  },
  {
    id: 'ai_race',
    category: 'Technology Intelligence Arena',
    title: 'AI Supremacy Race: Frontier Model Competition',
    alertLevel: 'CRITICAL', alertColor: 'red',
    quote: '"The compute arms race is not measured in parameters — it is measured in inference-time scaling efficiency and sovereign deployment capability."',
    body: 'Frontier AI model development has entered a phase of national strategic priority classification. Export controls on H100-class accelerators are reshaping the global AI capability distribution map in real time.',
    tags: ['GPU Compute Index', 'Model Benchmark Shift'],
    assets: [
      { name: 'US FRONTIER LABS', value: 'DOMINANT', color: 'text-primary' },
      { name: 'BEIJING AI CLUSTER', value: '+12.4%', color: 'text-amber-500' },
      { name: 'EU REGULATION', value: 'ACTIVE', color: 'text-muted' },
    ],
    briefings: [
      { time: '15:30 GMT', type: 'CRITICAL', color: 'red', headline: 'New frontier model surpasses human expert benchmarks', body: 'Multi-domain expert capability threshold breached in medical diagnostics.', query: 'AI frontier model human expert benchmark implications 2026' },
      { time: '12:15 GMT', type: 'UPDATE', color: 'primary', headline: 'NVIDIA expands advanced chip embargo to 12 new regions', body: 'Export controls tighten as strategic compute becomes new currency.', query: 'NVIDIA chip export controls AI compute geopolitics 2026' },
      { time: '08:40 GMT', type: 'ARCHIVED', color: 'zinc', headline: 'Open source model closes gap with proprietary systems', body: 'Llama-class models now within 8% of frontier performance on key tasks.', query: 'Open source AI vs proprietary frontier model performance gap 2026' },
    ],
    inference: '"Inference compute costs are declining 40% annually while model capability scales superlinearly. This asymmetry creates a 24-month window for strategic first-mover advantage in AI-native industries."',
    inferenceQuery: 'AI inference cost decline compute asymmetry strategic first-mover advantage 2026',
    researchQuery: 'AI Supremacy Race Frontier Model Competition geopolitics compute 2026',
  },
  {
    id: 'pharma',
    category: 'Biotech Intelligence Arena',
    title: 'Global Pharmaceutical Supply Chain Disruption',
    alertLevel: 'MODERATE', alertColor: 'blue',
    quote: '"90% of active pharmaceutical ingredients originate from a 200-mile radius. This geographic concentration is now classified as a strategic national security risk."',
    body: 'Post-pandemic reshoring mandates have collided with legacy procurement infrastructure. Hospital formulary managers are operating with 40% less buffer stock than 2019 baselines.',
    tags: ['API Concentration Index', 'GS1 Traceability'],
    assets: [
      { name: 'HYDERABAD CLUSTER', value: '-0.8%', color: 'text-amber-500' },
      { name: 'SWITZERLAND HUB', value: '+1.2%', color: 'text-primary' },
      { name: 'US FDA PIPELINE', value: 'NOMINAL', color: 'text-muted' },
    ],
    briefings: [
      { time: '14:05 GMT', type: 'RISK DETECTED', color: 'amber', headline: 'India imposes export restrictions on 12 critical APIs', body: 'Domestic stockpile prioritization triggers global hospital alert cascade.', query: 'India API export restrictions pharmaceutical supply chain impact 2026' },
      { time: '11:30 GMT', type: 'UPDATE', color: 'primary', headline: 'MRNA platform enables 48-hour vaccine reformulation', body: 'Moderna Kenya facility begins continental distribution testing.', query: 'MRNA rapid vaccine production Africa global health 2026' },
      { time: '09:45 GMT', type: 'ARCHIVED', color: 'zinc', headline: 'China biosimilar exports hit record volume', body: 'European pricing pressure intensifies on branded biologics.', query: 'China biosimilar exports European pharmaceutical pricing 2026' },
    ],
    inference: '"The window for pharmaceutical supply chain re-domestication is narrowing. Nations that fail to establish buffer API manufacturing capacity within 18 months face acute formulary exposure during the next systemic shock."',
    inferenceQuery: 'Pharmaceutical supply chain reshoring API manufacturing strategic resilience timeline 2026',
    researchQuery: 'Global Pharmaceutical Supply Chain Disruption API security 2026',
  },
  {
    id: 'space',
    category: 'Space Economy Intelligence Arena',
    title: 'Commercial Space Economy: Orbital Infrastructure Race',
    alertLevel: 'ACTIVE', alertColor: 'violet',
    quote: '"Low Earth Orbit is no longer the domain of national prestige projects — it is rapidly becoming the critical infrastructure layer for $6.7 trillion in terrestrial digital commerce."',
    body: 'The commercialization of LEO is accelerating beyond the capability of existing international space law frameworks. Spectrum allocation disputes and debris field management are creating novel geopolitical pressure vectors.',
    tags: ['Starlink Density Index', 'Launch Cadence Rate'],
    assets: [
      { name: 'CAPE CANAVERAL', value: '+24%', color: 'text-primary' },
      { name: 'BAIKONUR COMPLEX', value: 'REDUCED', color: 'text-red-500' },
      { name: 'VANDENBERG SFB', value: 'NOMINAL', color: 'text-muted' },
    ],
    briefings: [
      { time: '16:00 GMT', type: 'UPDATE', color: 'primary', headline: 'SpaceX achieves 14th consecutive Starship orbital insertion', body: 'Rapid reusability milestone enables 72-hour launch cadence target.', query: 'SpaceX Starship reusability commercial space economy 2026' },
      { time: '12:30 GMT', type: 'RISK DETECTED', color: 'amber', headline: 'Chinese Tiangong expansion threatens critical orbital slots', body: 'ITU arbitration requested as spectrum conflict escalates.', query: 'China Tiangong orbital slot spectrum conflict governance 2026' },
      { time: '10:15 GMT', type: 'ARCHIVED', color: 'zinc', headline: 'Moon Resource Treaty negotiations collapse in Vienna', body: 'Lunar rare earth access framework remains unresolved after 14 months.', query: 'Moon Resource Treaty lunar rare earth geopolitics 2026' },
    ],
    inference: '"Dual-use satellite constellations are blurring the line between commercial and military space assets. The absence of binding governance frameworks creates a first-mover capture dynamic that could destabilize orbital equilibrium by 2028."',
    inferenceQuery: 'Dual use satellite military commercial governance orbital stability first-mover 2028',
    researchQuery: 'Commercial Space Economy Orbital Infrastructure Race geopolitics 2026',
  },
  {
    id: 'energy',
    category: 'Energy Security Intelligence Arena',
    title: 'Energy Transition: Strategic Minerals Crisis',
    alertLevel: 'HIGH ALERT', alertColor: 'amber',
    quote: '"The energy transition has created a paradox: decarbonizing the grid requires materials whose extraction is controlled by the very authoritarian states climate policy seeks to counter."',
    body: 'Cobalt, lithium, nickel, and manganese supply chains are geographically concentrated in politically volatile regions. The battery supply chain bottleneck is now the primary constraint on the global electrification roadmap.',
    tags: ['Battery Critical Mineral Index', 'EV Penetration Rate'],
    assets: [
      { name: 'DRC COBALT FIELDS', value: 'VOLATILE', color: 'text-red-500' },
      { name: 'CHILE LITHIUM', value: '+3.4%', color: 'text-primary' },
      { name: 'INDONESIA NICKEL', value: '+1.8%', color: 'text-muted' },
    ],
    briefings: [
      { time: '15:10 GMT', type: 'RISK DETECTED', color: 'amber', headline: 'DRC mining suspension halts 18% of global cobalt output', body: 'Political instability forces Glencore emergency extraction protocols.', query: 'DRC Congo cobalt mining suspension supply chain disruption 2026' },
      { time: '12:00 GMT', type: 'UPDATE', color: 'primary', headline: 'Sodium-ion battery achieves commercial cost parity', body: 'CATL announces mass production ramp independent of lithium.', query: 'Sodium ion battery commercial parity CATL lithium alternative 2026' },
      { time: '09:30 GMT', type: 'ARCHIVED', color: 'zinc', headline: 'US Critical Minerals Alliance adds 6 new partner nations', body: 'Pentagon-backed supply chain diversification initiative expands.', query: 'US Critical Minerals Alliance strategic supply diversification 2026' },
    ],
    inference: '"Sodium-ion and solid-state battery commercialization timelines are the single most important variable in the critical minerals geopolitical equation. A 24-month acceleration would structurally devalue legacy mineral control leverage."',
    inferenceQuery: 'Battery technology solid state sodium ion critical minerals geopolitical leverage 2026',
    researchQuery: 'Energy Transition Strategic Minerals Crisis cobalt lithium geopolitics 2026',
  },
  {
    id: 'cyber',
    category: 'Cyber Security Intelligence Arena',
    title: 'Nation-State Cyber Operations: Infrastructure Targeting',
    alertLevel: 'CRITICAL', alertColor: 'red',
    quote: '"The attack surface of modern critical infrastructure has expanded by 340% since 2020. The average APT group dwell time before detection is now 287 days."',
    body: 'State-sponsored cyber operations have shifted from intelligence collection to pre-positioning for kinetic conflict support. Power grids, water treatment, and financial clearing systems are targeted in coordinated campaigns.',
    tags: ['APT Campaign Index', 'Zero-Day Broker Rate'],
    assets: [
      { name: 'EASTERN EUROPE', value: 'HIGH RISK', color: 'text-red-500' },
      { name: 'PACIFIC ASSETS', value: 'ELEVATED', color: 'text-amber-500' },
      { name: 'US CISA ALERTS', value: '+47%', color: 'text-muted' },
    ],
    briefings: [
      { time: '17:20 GMT', type: 'CRITICAL', color: 'red', headline: 'Volt Typhoon detected in US water utility SCADA systems', body: 'CISA confirms persistent access established across 8 municipalities.', query: 'Volt Typhoon water utility SCADA cyberattack infrastructure 2026' },
      { time: '13:45 GMT', type: 'UPDATE', color: 'primary', headline: 'NATO Cyber Command activates Article 5 digital contingency', body: 'Cross-border cyber defense protocol enters operational phase.', query: 'NATO Cyber Command Article 5 digital defense collective response 2026' },
      { time: '10:30 GMT', type: 'ARCHIVED', color: 'zinc', headline: 'Global ransomware payments hit $3.1B in Q1 2026', body: 'Healthcare sector accounts for 34% of total extortion volume.', query: 'Ransomware payments healthcare cybercrime Q1 2026 statistics' },
    ],
    inference: '"Pre-positioning malware in critical infrastructure control systems signals a strategic shift from intelligence gathering to deterrence leverage. The threshold for cyber-physical attacks has never been lower given current geopolitical temperatures."',
    inferenceQuery: 'Nation state cyber preposition critical infrastructure deterrence kinetic threshold 2026',
    researchQuery: 'Nation-State Cyber Operations Critical Infrastructure Targeting APT 2026',
  },
  {
    id: 'geopolitics',
    category: 'Geopolitical Intelligence Arena',
    title: 'Indo-Pacific Power Rebalancing: Trade & Security',
    alertLevel: 'ELEVATED', alertColor: 'orange',
    quote: '"The decoupling of G7 and China supply chains is not a future scenario — it is an ongoing structural transformation occurring at a speed that has outpaced policy frameworks designed to manage it."',
    body: 'The Indo-Pacific Economic Framework is emerging as the primary counter-architecture to Belt and Road dependency. Strategic port access, shipping lane control, and dual-use infrastructure financing are the new instruments of great power competition.',
    tags: ['QUAD Alignment Index', 'BRI Exposure Ratio'],
    assets: [
      { name: 'SOUTH CHINA SEA', value: 'CONTESTED', color: 'text-red-500' },
      { name: 'INDIA CORRIDOR', value: '+8.2%', color: 'text-primary' },
      { name: 'JAPAN-KOREA AXIS', value: 'STABLE', color: 'text-muted' },
    ],
    briefings: [
      { time: '14:55 GMT', type: 'RISK DETECTED', color: 'amber', headline: 'Taiwan Strait tension triggers insurance premium surge', body: "Lloyd's of London revises Pacific shipping war risk classifications.", query: 'Taiwan Strait military tension shipping insurance war risk 2026' },
      { time: '11:40 GMT', type: 'UPDATE', color: 'primary', headline: 'India-Middle East-Europe corridor breaks ground', body: 'IMEC first phase connects Mundra Port to Haifa via Saudi Arabia.', query: 'India Middle East Europe IMEC corridor geopolitics trade 2026' },
      { time: '09:20 GMT', type: 'ARCHIVED', color: 'zinc', headline: 'ASEAN trade bloc surpasses EU as China top partner', body: 'Regional supply chain restructuring accelerates decoupling dynamics.', query: 'ASEAN China trade EU decoupling FDI manufacturing shift 2026' },
    ],
    inference: '"The speed of supply chain restructuring is creating asymmetric opportunities in ASEAN manufacturing corridors. Vietnam, Indonesia, and India are absorbing displaced FDI at rates that are reshaping 20-year growth trajectories."',
    inferenceQuery: 'ASEAN FDI manufacturing Vietnam Indonesia India supply chain shift geopolitics 2026',
    researchQuery: 'Indo-Pacific Power Rebalancing Trade Security QUAD decoupling 2026',
  },
];

export default function Home() {
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [historyList, setHistoryList] = useState<ResearchHistoryItem[]>([]);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [researchDepth, setResearchDepth] = useState<ResearchDepth>('Deep');
  const [generateImages, setGenerateImages] = useState<boolean>(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState<string>("");
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Custom citation extraction utility
  const extractCitations = (text: string) => {
    if (!text) return [];
    // Matches markdown links like [Text](url)
    const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g;
    const citationsMap = new Map<string, { id: number; text: string; url: string }>();
    let match;
    let id = 1;
    while ((match = linkRegex.exec(text)) !== null) {
      const linkText = match[1];
      const url = match[2];
      if (!citationsMap.has(url)) {
        citationsMap.set(url, {
          id: id++,
          text: linkText,
          url: url
        });
      }
    }
    return Array.from(citationsMap.values());
  };
  
  // Recording State
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [voiceQuery, setVoiceQuery] = useState<string>("");
  const router = useRouter();

  // Real-time timers for the neural status board
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [stepElapsedSeconds, setStepElapsedSeconds] = useState<number>(0);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [layoutMode, setLayoutMode] = useState<'magazine' | 'focus'>('focus');
  const { theme } = useTheme();

  const [agentThoughts, setAgentThoughts] = useState<AgentThought[]>([]);

  // Real-time dynamic bento states
  const [bentoExposure, setBentoExposure] = useState<number>(68.4);
  const [bentoVolatility, setBentoVolatility] = useState<number>(12.4);
  const [bentoHealth, setBentoHealth] = useState<number>(99.8);
  const [bentoShenzhen, setBentoShenzhen] = useState<number>(-2.4);
  const [activeTopic, setActiveTopic] = useState<IntelTopic>(INTELLIGENCE_TOPICS[0]);

  // Randomize dashboard topic on client mount only – avoids SSR/client hydration mismatch
  useEffect(() => {
    setActiveTopic(INTELLIGENCE_TOPICS[Math.floor(Math.random() * INTELLIGENCE_TOPICS.length)]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (chatHistory.length === 0 && !isSearching) {
      interval = setInterval(() => {
        setBentoExposure(prev => {
          const next = parseFloat((prev + (Math.random() * 0.4 - 0.2)).toFixed(1));
          return next >= 60 && next <= 80 ? next : prev;
        });
        setBentoVolatility(prev => {
          const next = parseFloat((prev + (Math.random() * 0.2 - 0.1)).toFixed(1));
          return next >= 10 && next <= 15 ? next : prev;
        });
        setBentoHealth(prev => {
          const next = parseFloat((prev + (Math.random() * 0.04 - 0.02)).toFixed(2));
          return next <= 100 && next >= 99.5 ? next : prev;
        });
        setBentoShenzhen(prev => {
          const next = parseFloat((prev + (Math.random() * 0.2 - 0.1)).toFixed(1));
          return next >= -4 && next <= -1 ? next : prev;
        });
      }, 4000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [chatHistory.length, isSearching]);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
      } else {
        setUser(user);
        fetchHistory(user.id);
      }
    };
    checkUser();
  }, [router]);

  useEffect(() => {
    return () => {
      if (socketRef.current) socketRef.current.close();
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsExportDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [chatHistory, isSearching]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isSearching) {
      const startTime = Date.now();
      setElapsedSeconds(0);
      interval = setInterval(() => {
        setElapsedSeconds(parseFloat(((Date.now() - startTime) / 1000).toFixed(1)));
      }, 100);
    } else {
      setElapsedSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isSearching]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isSearching && activeAgent) {
      const startTime = Date.now();
      setStepElapsedSeconds(0);
      interval = setInterval(() => {
        setStepElapsedSeconds(parseFloat(((Date.now() - startTime) / 1000).toFixed(1)));
      }, 100);
    } else {
      setStepElapsedSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isSearching, activeAgent]);

  async function fetchHistory(userId: string) {
    setIsHistoryLoading(true);
    try {
      // 1. Fetch from Local Storage first for instant UI
      const localData = localStorage.getItem(`orchestra_history_${userId}`);
      if (localData) {
        setHistoryList(JSON.parse(localData));
      }

      // 2. Sync from Backend with Auth Token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        console.warn("No active session found for history sync.");
        return;
      }

      let response;
      let retries = 3;
      while (retries > 0) {
        try {
          response = await fetch(`${getBackendUrl()}/history?user_id=${userId}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (response.ok) break;
        } catch (e) {
          console.warn(`History fetch attempt failed. Retries left: ${retries-1}. Error:`, e instanceof Error ? e.message : e);
        }
        retries--;
        if (retries > 0) await new Promise(r => setTimeout(r, 1000));
      }

      if (!response || !response.ok) {
        console.warn("Failed to sync history from backend.");
        return;
      }

      
      let cloudData = await response.json();
      if (!Array.isArray(cloudData)) {
        console.warn("Backend returned non-array for history:", cloudData);
        cloudData = [];
      }
      
      const localDataStr = localStorage.getItem(`orchestra_history_${userId}`);
      const localItems = localDataStr ? JSON.parse(localDataStr) : [];
      
      // Merge logic: Prioritize cloud but keep local-only items that don't match cloud topics
      const cloudIds = new Set(cloudData.map((item: any) => item.id));
      const cloudTopics = new Set(cloudData.map((item: any) => item.topic));
      const localOnly = localItems.filter((item: any) => !cloudIds.has(item.id) && !cloudTopics.has(item.topic));
      
      const merged = [...cloudData, ...localOnly].sort((a: any, b: any) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      // Complete deduplication by topic to ensure clean UI
      const uniqueMerged: any[] = [];
      const seenTopics = new Set();
      for (const item of merged) {
        if (!seenTopics.has(item.topic)) {
          seenTopics.add(item.topic);
          uniqueMerged.push(item);
        }
      }

      setHistoryList(uniqueMerged);
      // Safely write to localStorage – guard against quota errors on large histories
      try {
        localStorage.setItem(`orchestra_history_${userId}`, JSON.stringify(uniqueMerged));
      } catch (e) {
        try {
          // Trim to most recent 15 items and retry
          const trimmed = merged.slice(0, 15);
          localStorage.setItem(`orchestra_history_${userId}`, JSON.stringify(trimmed));
        } catch {
          console.warn('localStorage quota exceeded – local history cache skipped.');
        }
      }

      // 4. Backfill: If we have local-only items, sync them to cloud in the background
      if (localOnly.length > 0) {
        console.log(`Backfilling ${localOnly.length} items to cloud via bulk upload...`);
        
        const payloadItems = localOnly.map((item: any) => ({
          user_id: userId,
          topic: item.topic || item.query,
          plan: item.plan || "",
          report: item.report || item.final_output,
          citations: item.citations || []
        }));

        fetch(`${getBackendUrl()}/history/bulk_upload`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ items: payloadItems })
        })
        .then(res => {
          if (!res.ok) throw new Error("Bulk upload returned non-200 status");
          console.log("Bulk backfill complete.");
        })
        .catch(err => console.warn("Bulk backfill failed:", err instanceof Error ? err.message : err));
      }
    } catch (err) {
      console.warn("History Sync Error:", err instanceof Error ? err.message : err);
    } finally {
      setIsHistoryLoading(false);
    }
  };


  const groupHistory = () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const groups: Record<string, ResearchHistoryItem[]> = {
      'Today': [],
      'Yesterday': [],
      'Previous 30 Days': [],
      'Older': []
    };

    historyList.slice(0, 15).forEach(item => {
      const date = new Date(item.created_at);
      const diffTime = Math.abs(today.getTime() - date.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (date.toDateString() === today.toDateString()) {
        groups['Today'].push(item);
      } else if (date.toDateString() === yesterday.toDateString()) {
        groups['Yesterday'].push(item);
      } else if (diffDays <= 30) {
        groups['Previous 30 Days'].push(item);
      } else {
        groups['Older'].push(item);
      }
    });

    return groups;
  };

  const socketRef = useRef<WebSocket | null>(null);

  const currentReportRef = useRef<string>("");

  const saveToLocalHistory = (userId: string, newItem: ResearchHistoryItem) => {
    try {
      const localKey = `orchestra_history_${userId}`;
      const localData = localStorage.getItem(localKey);
      let history = localData ? JSON.parse(localData) : [];
      
      // Add to top, deduplicate by topic, and limit to 50 items
      history = [newItem, ...history.filter((h: any) => h.topic !== newItem.topic)].slice(0, 50);
      localStorage.setItem(localKey, JSON.stringify(history));
      setHistoryList(history);
    } catch (e) {
      console.error("Local Save Error:", e);
    }
  };



  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Safety: ensure we have a session or user ID
    const currentSessionId = sessionId || `session_${Date.now()}`;
    if (!sessionId) setSessionId(currentSessionId);

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${getBackendUrl()}/upload?session_id=${currentSessionId}`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (response.ok && data.status === "Success") {
        toast.success(data.message || "Document indexed for research.");
      } else {
        toast.error(`Upload Failed: ${data.message || "Unknown error"}`);
      }
    } catch (err) {
      console.error("Upload Error:", err);
      toast.error("Network Error: Could not connect to the neural indexing service.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSearch = async (targetQuery: string, persona: string = "Standard") => {
    if (!targetQuery.trim() || !user || isSearching) return;
    
    if (socketRef.current) {
      socketRef.current.close();
    }

    setIsSearching(true);
    setAgentThoughts([]);
    // setQuery(""); // Will be handled by the child component
    currentReportRef.current = ""; // Reset ref
    
    const tempEntry: ChatMessage = {
      query: targetQuery,
      final_output: ""
    };
    
    const activeSessionId = sessionId || `session_${Date.now()}`;
    if (!sessionId) {
      setSessionId(activeSessionId);
      setChatHistory([tempEntry]);
    } else {
      setChatHistory(prev => [...prev, tempEntry]);
    }
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token;

      const socket = new WebSocket(`${getWsUrl()}/ws/research`);
      socketRef.current = socket;
      
        socket.onopen = () => {
          socket.send(JSON.stringify({
            query: targetQuery,
            user_id: user.id,
            depth: researchDepth === 'Fast' ? 1 : researchDepth === 'Deep' ? 3 : 5,
            generate_images: generateImages,
            session_id: activeSessionId,
            token: authToken,
            persona: persona
          }));
        };

      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === "node_start") {
          setActiveAgent(data.agent);
        } else if (data.type === "thought") {
          setAgentThoughts(prev => [...prev, {
            id: `thought_${Date.now()}_${Math.random()}`,
            agent: data.agent,
            content: data.content,
            timestamp: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' })
          }]);
        } else if (data.type === "complete") {
          setIsSearching(false);
          setActiveAgent(null);
          
          const finalReport = data.final_output || currentReportRef.current;
          
          setChatHistory(prev => {
            if (prev.length === 0) return prev;
            const updated = [...prev];
            const lastIndex = updated.length - 1;
            updated[lastIndex] = {
              ...updated[lastIndex],
              final_output: finalReport
            };
            // Cache full thread in localStorage
            localStorage.setItem(`orchestra_chat_history_${activeSessionId}`, JSON.stringify(updated));
            return updated;
          });

          if (user) {
            const originalTopic = historyList.find(h => h.id === activeSessionId)?.topic || targetQuery;
            const newItem: ResearchHistoryItem = {
              id: activeSessionId,
              user_id: user.id,
              topic: originalTopic,
              report: finalReport,
              depth: researchDepth,
              created_at: new Date().toISOString()
            };

            saveToLocalHistory(user.id, newItem);
          }
          
          socket.close();
          socketRef.current = null;
        } else if (data.type === "error") {
          console.error("WS Error:", data.message);
          setIsSearching(false);
          setActiveAgent(null);
          socket.close();
          socketRef.current = null;
        }
      };

      socket.onclose = () => {
        socketRef.current = null;
        setIsSearching(false);
      };

      socket.onerror = (err) => {
        console.error("Socket Error:", err);
        setIsSearching(false);
        socketRef.current = null;
      };

    } catch (err) {
      console.error("Search Error:", err);
      setIsSearching(false);
      socketRef.current = null;
    }
  };

  const loadHistoryItem = (item: ResearchHistoryItem) => {
    const cachedChat = localStorage.getItem(`orchestra_chat_history_${item.id}`);
    if (cachedChat) {
      setChatHistory(JSON.parse(cachedChat));
    } else {
      setChatHistory([{ 
        query: item.topic || item.query || "", 
        final_output: item.report || item.final_output || "" 
      }]);
    }
    setSessionId(item.id);
  };

  const handleRenameHistory = async (reportId: string, newTitle: string) => {
    if (!newTitle.trim() || !user) return;
    
    try {
      // 1. Update backend
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (token) {
        await fetch(`${getBackendUrl()}/history/rename`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            user_id: user.id,
            report_id: reportId,
            title: newTitle
          })
        });
      }
      
      // 2. Update local state
      setHistoryList(prev => prev.map(item => 
        item.id === reportId ? { ...item, topic: newTitle } : item
      ));

      // 3. Update localStorage history cache
      const localKey = `orchestra_history_${user.id}`;
      const localData = localStorage.getItem(localKey);
      if (localData) {
        const history = JSON.parse(localData);
        const updated = history.map((item: any) => 
          item.id === reportId ? { ...item, topic: newTitle } : item
        );
        localStorage.setItem(localKey, JSON.stringify(updated));
      }

      // 4. Update localStorage chat history if active session matches
      if (sessionId === reportId) {
        setChatHistory(prev => {
          if (prev.length === 0) return prev;
          const updated = [...prev];
          localStorage.setItem(`orchestra_chat_history_${reportId}`, JSON.stringify(updated));
          return updated;
        });
      }

      setEditingId(null);
    } catch (err) {
      console.error("Rename Error:", err);
    }
  };

  const handleDeleteHistory = async (reportId: string) => {
    if (!user) return;
    const confirmDelete = window.confirm("Are you sure you want to permanently delete this research report?");
    if (!confirmDelete) return;

    try {
      // 1. Update backend
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (token) {
        await fetch(`${getBackendUrl()}/history/delete`, {
          method: 'DELETE',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            user_id: user.id,
            report_id: reportId
          })
        });
      }
      
      // 2. Update local state
      setHistoryList(prev => prev.filter(item => item.id !== reportId));

      // 3. Update localStorage history cache
      const localKey = `orchestra_history_${user.id}`;
      const localData = localStorage.getItem(localKey);
      if (localData) {
        const history = JSON.parse(localData);
        const updated = history.filter((item: any) => item.id !== reportId);
        localStorage.setItem(localKey, JSON.stringify(updated));
      }

      // 4. Clear chat view if deleted session is the active one
      if (sessionId === reportId) {
        handleNewResearch();
      }

      // 5. Clean up localStorage chat thread cache
      localStorage.removeItem(`orchestra_chat_history_${reportId}`);
    } catch (err) {
      console.error("Delete Error:", err);
    }
  };

  const copyMarkdownToClipboard = async () => {
    if (chatHistory.length === 0) return;
    const lastItem = chatHistory[chatHistory.length - 1];
    try {
      await navigator.clipboard.writeText(lastItem.final_output);
      toast.success("Fidelity Markdown copied to clipboard!");
    } catch (err) {
      console.error("Clipboard copy failed:", err);
    }
    setIsExportDropdownOpen(false);
  };

  const downloadMarkdownFile = () => {
    if (chatHistory.length === 0) return;
    const lastItem = chatHistory[chatHistory.length - 1];
    const blob = new Blob([lastItem.final_output], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Orchestra_Report_${new Date().getTime()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    setIsExportDropdownOpen(false);
  };


  const recognitionRef = useRef<any>(null);

  const startRecording = async () => {
    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
          let finalTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            }
          }
          if (finalTranscript) {
            setVoiceQuery(prev => prev + ' ' + finalTranscript);
          }
        };

        recognition.start();
        recognitionRef.current = recognition;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const formData = new FormData();
        formData.append('file', audioBlob, 'recording.wav');

        try {
          const response = await fetch(`${getBackendUrl()}/stt`, {
            method: 'POST',
            body: formData,
          });
          const data = await response.json();
          if (data.text) {
            setVoiceQuery(data.text);
          }
        } catch (err) {
          console.error("STT Error:", err);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Mic Access Error:", err);
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const handleNewResearch = () => {
    setChatHistory([]);
    setVoiceQuery("");
    setIsSearching(false);
    setActiveAgent(null);
    setSessionId(null);
    setAgentThoughts([]);
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    // Randomize topic to refresh the dashboard if they are already on it
    setActiveTopic(INTELLIGENCE_TOPICS[Math.floor(Math.random() * INTELLIGENCE_TOPICS.length)]);
  };

  const handleCancelSearch = () => {
    setIsSearching(false);
    setActiveAgent(null);
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
  };

  const exportReport = async () => {
    if (chatHistory.length === 0 || isExporting) return;
    const lastItem = chatHistory[chatHistory.length - 1];
    setIsExporting(true);
    
    try {
      const response = await fetch(`${getBackendUrl()}/export/docx`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: lastItem.query,
          content: lastItem.final_output
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Orchestra_Research_${new Date().getTime()}.docx`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // Fallback to MD if backend fails
        const blob = new Blob([lastItem.final_output], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Orchestra_Report_${new Date().getTime()}.md`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("Export Error:", err);
      toast.error("Export Error: Could not generate document.");
    } finally {
      setIsExporting(false);
    }
  };

  const exportPdf = async () => {
    if (chatHistory.length === 0 || isExporting) return;
    const lastItem = chatHistory[chatHistory.length - 1];
    setIsExporting(true);
    
    try {
      const response = await fetch(`${getBackendUrl()}/export/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: lastItem.query,
          report_markdown: lastItem.final_output
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Orchestra_Research_${new Date().getTime()}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        toast.error("PDF Export failed.");
      }
    } catch (err) {
      console.error("Export Error:", err);
      // Fallback to MD if fetch fails completely
      const blob = new Blob([lastItem.final_output], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Orchestra_Report_${new Date().getTime()}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <main 
      className="flex h-screen overflow-hidden font-sans selection:bg-blue-500/30"
      style={{ backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
    >
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        onChange={handleFileUpload}
        accept=".txt,.pdf,.md"
      />
      {/* SIDEBAR */}
      <aside 
        className="w-64 border-r flex flex-col z-50"
        style={{ backgroundColor: 'var(--bg-sidebar)', borderColor: 'var(--border-main)' }}
      >
        <div className="p-5 flex-1 flex flex-col min-h-0">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 flex items-center justify-center border" style={{ backgroundColor: 'var(--bg-btn)', color: 'var(--text-btn)', borderColor: 'var(--border-main)', borderRadius: 'var(--radius-sm)' }}>
              <span className="font-black text-lg italic">O</span>
            </div>
            <div>
              <h1 className="text-[12px] font-black uppercase tracking-tighter leading-none">Orchestra AI</h1>
              <span className="text-[9px] font-bold opacity-50 uppercase tracking-widest">Cloud Suite</span>
            </div>
          </div>

          <motion.button 
            onClick={handleNewResearch}
            whileHover={{ scale: 1.02, boxShadow: '0 4px 20px rgba(6, 182, 212, 0.15)', borderColor: 'var(--primary)' }}
            whileTap={{ scale: 0.98 }}
            className="w-full py-3.5 flex items-center justify-center gap-2 font-black uppercase tracking-widest text-[10px] hover:bg-primary hover:text-on-primary mb-8 border transition-all duration-300"
            style={{ backgroundColor: 'var(--bg-btn)', color: 'var(--text-btn)', borderColor: 'var(--border-main)', borderRadius: 'var(--radius-md)' }}
          >
            <Plus size={16} /> New Research
          </motion.button>

          <nav className="space-y-1 flex-1 flex flex-col min-h-0">
            <motion.button 
              onClick={handleNewResearch} 
              whileHover={{ x: 4, scale: 1.01, borderColor: 'var(--primary)' }}
              className="w-full flex items-center gap-3 px-3 py-2.5 font-bold text-xs border mb-4 transition-all duration-300" 
              style={{ backgroundColor: 'var(--bg-app)', borderColor: 'var(--border-main)', borderRadius: 'var(--radius-sm)' }}
            >
              <LayoutGrid size={16} /> Research Desk
            </motion.button>
            
            <div className="px-4 pb-2">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Recent Research</span>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6">
              {isHistoryLoading && historyList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 opacity-40">
                  <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin mb-2" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Syncing Cloud...</span>
                </div>
              ) : historyList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 opacity-40">
                   <Cloud size={20} className="mb-2" />
                   <span className="text-[10px] font-bold uppercase tracking-widest text-center">Your cloud archive is empty</span>
                </div>
              ) : (
                Object.entries(groupHistory()).map(([group, items]) => (
                  items.length > 0 && (
                    <div key={group} className="space-y-1">
                      <h3 className="px-4 text-[9px] font-black uppercase tracking-widest opacity-30 mb-3">{group}</h3>
                      {items.map((item, idx) => (
                        <div key={idx} className="w-full">
                          {editingId === item.id ? (
                            <div className="w-full flex items-center gap-2 px-3 py-2 border border-primary/40 bg-black/10 dark:bg-white/5" style={{ borderRadius: 'var(--radius-sm)' }}>
                              <input
                                type="text"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleRenameHistory(item.id, editTitle);
                                  else if (e.key === 'Escape') setEditingId(null);
                                }}
                                className="flex-1 min-w-0 bg-transparent text-[11px] font-bold text-main outline-none border-none py-0.5"
                                autoFocus
                              />
                              <button 
                                onClick={() => handleRenameHistory(item.id, editTitle)}
                                className="p-1 hover:text-emerald-500 text-muted transition-colors"
                              >
                                <Check size={12} />
                              </button>
                              <button 
                                onClick={() => setEditingId(null)}
                                className="p-1 hover:text-red-500 text-muted transition-colors"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ) : (
                            <div className="relative w-full flex items-center group">
                              <motion.button 
                                onClick={() => loadHistoryItem(item)}
                                whileHover={{ x: 4, scale: 1.01, backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'var(--border-main)' }}
                                className={`w-full flex items-center gap-3 px-4 py-3 text-left border border-transparent transition-all duration-300 ${sessionId === item.id ? 'border-primary/20 bg-primary/5' : ''}`}
                                style={{ borderRadius: 'var(--radius-sm)' }}
                              >
                                <div className={`w-7 h-7 flex items-center justify-center bg-white/5 border border-main flex-shrink-0 transition-all ${sessionId === item.id ? 'text-primary border-primary/30' : 'text-primary opacity-60 group-hover:opacity-100'}`} style={{ borderRadius: 'var(--radius-sm)' }}>
                                  <FileText size={14} />
                                </div>
                                <span className="flex-1 min-w-0 truncate text-[11px] font-bold opacity-70 group-hover:opacity-100 transition-opacity group-hover:text-primary pr-12" style={{ color: 'var(--text-main)' }}>{item.topic || item.query}</span>
                              </motion.button>
                              
                              {/* Hover Action Buttons */}
                              <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-gradient-to-l from-sidebar via-sidebar/90 to-transparent pl-4 py-1.5 z-10">
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingId(item.id);
                                    setEditTitle(item.topic || item.query || "");
                                  }}
                                  className="p-1 hover:text-primary text-muted transition-colors"
                                  title="Rename"
                                >
                                  <Edit2 size={12} />
                                </button>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteHistory(item.id);
                                  }}
                                  className="p-1 hover:text-red-500 text-muted transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                ))
              )}
            </div>

          </nav>
        </div>

        <div className="p-5 border-t" style={{ borderColor: 'var(--border-main)' }}>
          <div className="space-y-4 mb-6">
            <div className="flex items-center justify-between px-1">
              <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Research Depth</span>
              <span className="text-[9px] font-bold text-primary uppercase">{researchDepth}</span>
            </div>
            <div className="flex gap-1 bg-black/5 dark:bg-white/5 p-1 border relative" style={{ borderColor: 'var(--border-main)', borderRadius: 'var(--radius-md)' }}>
              {(['Fast', 'Deep', 'Pro'] as const).map((depth) => (
                <button
                  key={depth}
                  onClick={() => setResearchDepth(depth)}
                  className="flex-1 py-2 text-[9px] font-black uppercase tracking-tighter relative z-10 transition-all cursor-pointer focus:outline-none"
                  style={{ borderRadius: 'var(--radius-sm)' }}
                >
                  {researchDepth === depth && (
                    <motion.div
                      layoutId="activeDepthPill"
                      className="absolute inset-0 bg-[#06b6d4]/20 border border-[#06b6d4]/40 dark:bg-primary/20 dark:border-primary/40 z-[-1]"
                      style={{ borderRadius: 'var(--radius-sm)' }}
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <span className={`transition-opacity duration-300 ${researchDepth === depth ? 'text-primary opacity-100 font-black' : 'opacity-40 hover:opacity-75'}`}>
                    {depth}
                  </span>
                </button>
              ))}
            </div>
            
            <div className="flex items-center justify-between px-1 mt-6">
              <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Auto-Generate Images</span>
              <button 
                onClick={() => setGenerateImages(!generateImages)}
                className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${generateImages ? 'bg-[#06b6d4] dark:bg-primary' : 'bg-gray-400 dark:bg-gray-600'}`}
              >
                <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${generateImages ? 'translate-x-4' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>
          
          <ThemeSelector />

          
          <button 
            onClick={handleLogout}
            className="w-full mt-4 flex items-center gap-2 px-3 py-2 text-xs font-bold text-red-500 hover:bg-red-500/10 transition-all border border-transparent hover:border-red-500/20"
            style={{ borderRadius: 'var(--radius-sm)' }}
          >
            <LogOut size={14} /> Logout Session
          </button>
        </div>
      </aside>

      {/* MAIN VIEW */}
      <section 
        className="flex-1 flex flex-col relative h-full overflow-hidden"
        style={{ backgroundColor: 'var(--bg-app)' }}
      >
        <header 
          className="h-16 flex items-center px-8 border-b sticky top-0 z-30 transition-all"
          style={{ backgroundColor: 'var(--bg-app)', borderColor: 'var(--border-main)' }}
        >
            <div className="flex-1 flex items-center gap-2 text-xs font-bold opacity-40">
              <Database size={14} className="text-primary" /> <span>{user?.email || "Research Session"}</span>
            </div>
            {chatHistory.length > 0 && (
              <button 
                onClick={() => setLayoutMode(prev => prev === 'magazine' ? 'focus' : 'magazine')}
                className="text-xs font-bold px-4 py-2 flex items-center gap-2 border transition-all mr-2 hover:bg-white/5"
                style={{ backgroundColor: 'var(--bg-sidebar)', borderColor: 'var(--border-main)', color: 'var(--text-main)', borderRadius: 'var(--radius-sm)' }}
              >
                {layoutMode === 'magazine' ? <LayoutGrid size={14} className="text-primary" /> : <BookOpen size={14} className="text-primary" />}
                <span>{layoutMode === 'magazine' ? 'View: Magazine' : 'View: Academic Focus'}</span>
              </button>
            )}
            <div className="relative" ref={dropdownRef}>
              <button 
                onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)} 
                disabled={chatHistory.length === 0 || isExporting} 
                className={`text-xs font-bold px-4 py-2 flex items-center gap-2 transition-all ${chatHistory.length === 0 || isExporting ? 'opacity-40' : 'active:scale-[0.98]'}`}
                style={chatHistory.length > 0 ? { backgroundColor: 'var(--bg-btn)', color: 'var(--text-btn)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-main)' } : { backgroundColor: 'var(--bg-sidebar)', color: 'var(--text-muted)', border: '1px solid var(--border-main)', borderRadius: 'var(--radius-sm)' }}
              >
                {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} 
                {isExporting ? 'Exporting...' : 'Export Results'}
              </button>

              <AnimatePresence>
                {isExportDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute right-0 mt-2 w-48 border z-50 shadow-2xl"
                    style={{ backgroundColor: 'var(--bg-sidebar)', borderColor: 'var(--border-main)', borderRadius: 'var(--radius-md)' }}
                  >
                    <div className="py-1">
                      <button
                        onClick={copyMarkdownToClipboard}
                        className="w-full px-4 py-2.5 text-left text-xs font-bold hover:bg-white/5 transition-colors flex items-center gap-2"
                        style={{ color: 'var(--text-main)' }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                        Copy Markdown
                      </button>
                      <button
                        onClick={downloadMarkdownFile}
                        className="w-full px-4 py-2.5 text-left text-xs font-bold hover:bg-white/5 transition-colors flex items-center gap-2 border-t"
                        style={{ color: 'var(--text-main)', borderColor: 'var(--border-main)' }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        Download Markdown (.md)
                      </button>
                      <button
                        onClick={async () => {
                          setIsExportDropdownOpen(false);
                          await exportReport();
                        }}
                        className="w-full px-4 py-2.5 text-left text-xs font-bold hover:bg-white/5 transition-colors flex items-center gap-2 border-t"
                        style={{ color: 'var(--text-main)', borderColor: 'var(--border-main)' }}
                      >
                        <FileText size={14} className="text-primary" />
                        Export Word (.docx)
                      </button>
                      <button
                        onClick={async () => {
                          setIsExportDropdownOpen(false);
                          await exportPdf();
                        }}
                        className="w-full px-4 py-2.5 text-left text-xs font-bold hover:bg-white/5 transition-colors flex items-center gap-2 border-t"
                        style={{ color: 'var(--text-main)', borderColor: 'var(--border-main)' }}
                      >
                        <Download size={14} className="text-red-500" />
                        Export PDF (.pdf)
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 pt-6 space-y-12 pb-72 custom-scrollbar">
          <div className="max-w-[1200px] mx-auto w-full space-y-12">
            {chatHistory.map((item, idx) => {
              let mdBlockIdx = 0;
              return (
              <div key={idx} className="space-y-6 animate-in fade-in duration-700">
                <div className="flex justify-end">
                  <div className="px-5 py-2.5 max-w-[70%] text-sm font-medium border" style={{ backgroundColor: 'var(--bg-sidebar)', color: 'var(--text-main)', borderColor: 'var(--border-main)', borderRadius: 'var(--radius-md)' }}>
                    {item.query}
                  </div>
                </div>
                <div className="w-full">
                  <div className="w-full">
                    <motion.div
                      className={`max-w-none leading-relaxed ${layoutMode === 'magazine' ? 'editorial-grid' : 'flex flex-col gap-6 max-w-3xl mx-auto'}`}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                    >
                      {item.final_output && (
                        <div 
                          className="flex flex-wrap items-center gap-4 text-[10px] font-bold uppercase tracking-widest opacity-60 pb-6 mb-8 border-b w-full"
                          style={{ gridColumn: 'span 12', borderColor: 'var(--border-main)' }}
                        >
                          <span className="flex items-center gap-1.5 text-primary">
                            <Clock size={12} /> {Math.max(1, Math.ceil(item.final_output.split(/\s+/).filter(Boolean).length / 225))} Min Read
                          </span>
                          <span className="opacity-30">•</span>
                          <span>{item.final_output.split(/\s+/).filter(Boolean).length.toLocaleString()} Words</span>
                          <span className="opacity-30">•</span>
                          <span className="px-2 py-0.5 text-[9px] border" style={{ borderColor: 'var(--border-main)', backgroundColor: 'var(--bg-sidebar)', color: 'var(--text-main)', borderRadius: 'var(--radius-sm)' }}>
                            {researchDepth} Synthesis
                          </span>
                          <span className="opacity-30">•</span>
                          <span className="text-emerald-500 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-emerald-500 inline-block" /> Fact-Checked & Verified
                          </span>
                        </div>
                      )}
                      {!item.final_output && isSearching && idx === chatHistory.length - 1 && (
                        <div className="flex items-center gap-3 p-6 mb-8 border border-main bg-sidebar" style={{ borderRadius: 'var(--radius-lg)' }}>
                           <div className="flex gap-1.5">
                             <motion.div className="w-1.5 h-1.5 rounded-full bg-primary" animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0 }} />
                             <motion.div className="w-1.5 h-1.5 rounded-full bg-primary" animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} />
                             <motion.div className="w-1.5 h-1.5 rounded-full bg-primary" animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} />
                           </div>
                           <span className="text-[10px] font-black tracking-[0.2em] uppercase text-primary">
                             {activeAgent ? `Agent ${activeAgent} is working...` : 'Neural Swarm Processing...'}
                           </span>
                        </div>
                      )}
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        components={{
                          p: ({node, children, ...props}: any) => {
                            const hasImage = node?.children?.some((child: any) => child.tagName === 'img');
                            const isOnlyImage = node?.children?.length === 1 && hasImage;
                            if (isOnlyImage) {
                                return <>{children}</>;
                            }
                            const pDelay = Math.min(mdBlockIdx++ * 0.055, 1.2);
                            return (
                              <motion.div
                                className="editorial-body mb-8"
                                style={{color: 'var(--text-main)'}}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: pDelay, duration: 0.45, ease: 'easeOut' }}
                              >{children}</motion.div>
                            );
                          },
                          img: ({node, src, alt, ...props}: any) => {
                            if (!src) return null;
                            let displaySrc = src;
                            if (src.includes("pollinations.ai")) {
                              const encodedUrl = encodeURIComponent(src);
                              const safeName = `legacy_${src.split('/').pop()?.split('?')[0] || 'img'}.jpg`;
                              displaySrc = `${getBackendUrl()}/static/images/${safeName}?legacy_url=${encodedUrl}`;
                            }
                            
                            let spanClass = "img-span-hero";
                            const match = src.match(/_([0-4])\.(?:jpg|png|webp|jpeg)/i);
                            if (match) {
                                const idx = parseInt(match[1]);
                                if (idx === 0) spanClass = "img-span-hero";
                                else if (idx === 1) spanClass = "img-span-sidebar-right";
                                else if (idx === 2) spanClass = "img-span-sidebar-left";
                                else if (idx === 3) spanClass = "img-span-mid";
                                else if (idx === 4) spanClass = "img-span-blueprint";
                            }

                            return (
                              <div 
                                className={`relative w-full aspect-video overflow-hidden mt-8 mb-10 group ${spanClass} transition-all-smooth hover:scale-[1.01] hover:z-10 cursor-pointer border`}
                                style={{ borderColor: 'var(--border-main)', backgroundColor: 'var(--bg-sidebar)', borderRadius: 'var(--radius-md)' }}
                                onClick={() => setLightboxSrc(displaySrc)}
                              >
                                <img 
                                  src={displaySrc}
                                  alt={alt || "Neural Context Image"} 
                                  className="w-full h-auto object-cover relative z-10 opacity-0 transition-opacity duration-700"
                                  loading="lazy"
                                  onLoad={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.style.opacity = '1';
                                      const container = target.parentElement;
                                      const fallback = container?.querySelector('.image-fallback');
                                      if (fallback) {
                                         (fallback as HTMLElement).style.opacity = '0';
                                         setTimeout(() => {
                                           (fallback as HTMLElement).style.display = 'none';
                                         }, 700);
                                      }
                                   }}
                                />
                                 <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 z-20 flex items-center justify-center pointer-events-none">
                                   <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 border p-3" style={{ backgroundColor: 'var(--bg-app)', borderColor: 'var(--border-main)', borderRadius: 'var(--radius-sm)' }}>
                                     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-primary" strokeWidth="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                                   </div>
                                 </div>
                                 {alt && (
                                   <div className="absolute bottom-0 left-0 right-0 p-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none border-t" style={{ backgroundColor: 'var(--bg-sidebar)', borderColor: 'var(--border-main)' }}>
                                     <p className="text-[11px] font-bold tracking-wide leading-relaxed font-sans" style={{ color: 'var(--text-main)' }}>{alt}</p>
                                   </div>
                                 )}
                                 <span className="image-fallback absolute inset-0 flex flex-col items-center justify-center p-12 text-center bg-[#080808] border overflow-hidden transition-opacity duration-700" style={{ borderColor: 'var(--border-main)', borderRadius: 'var(--radius-md)' }}>
                                   <span className="relative z-20 flex flex-col items-center max-w-lg">
                                      <span className="w-16 h-16 bg-primary/10 flex items-center justify-center mb-8 border border-primary/20" style={{ borderRadius: 'var(--radius-sm)' }}>
                                        <Activity size={32} className="text-primary animate-pulse" />
                                      </span>
                                      <span className="status-text block text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-6 opacity-70">Neural Synthesis Pipeline</span>
                                      <span className="text-[14px] font-mono leading-relaxed mb-8 block uppercase tracking-tight" style={{ color: 'var(--text-main)' }}>
                                        {alt || "Synthesizing descriptive visual intelligence from research context..."}
                                      </span>
                                      <span className="w-48 h-[2px] bg-white/5 overflow-hidden relative block" style={{ borderRadius: 'var(--radius-full)' }}>
                                        <span className="absolute inset-0 bg-primary/40 animate-pulse block" />
                                        <span className="h-full bg-primary block" style={{ width: '60%', animation: 'progressLoad 4s ease-in-out infinite', borderRadius: 'var(--radius-full)' }} />
                                      </span>
                                      <span className="mt-6 text-[9px] text-white/20 uppercase tracking-widest font-mono block">Deep Data Contextualization Active</span>
                                   </span>
                                   <span className="absolute top-0 left-0 w-full h-1 bg-primary/20 block" style={{ animation: 'scanline 3s linear infinite' }} />
                                 </span>
                              </div>
                            );
                          },
                          h1: ({node, ...props}: any) => { const d = Math.min(mdBlockIdx++ * 0.055, 1.2); return <motion.h1 className="editorial-h1 mb-12 font-mono uppercase tracking-tight" style={{ color: 'var(--text-main)' }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: d, duration: 0.5 }} {...props} />; },
                          h2: ({node, ...props}: any) => { const d = Math.min(mdBlockIdx++ * 0.055, 1.2); return <motion.h2 className="editorial-h2 font-mono uppercase" style={{ color: 'var(--text-main)' }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: d, duration: 0.5 }} {...props} />; },
                          h3: ({node, ...props}: any) => { const d = Math.min(mdBlockIdx++ * 0.055, 1.2); return <motion.h3 className="text-xl font-bold font-mono uppercase mt-12 mb-6 border-l-2 border-primary pl-4" style={{ color: 'var(--text-main)' }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: d, duration: 0.5 }} {...props} />; },
                          strong: ({node, ...props}: any) => <strong className="font-bold font-mono text-primary" {...props} />,
                          li: ({node, ...props}: any) => <li className="mb-2 font-mono text-xs" style={{ color: 'var(--text-main)' }} {...props} />,
                          ul: ({node, ...props}: any) => <ul className="list-disc pl-6 mb-8 border-l border-main" style={{ color: 'var(--text-main)', borderColor: 'var(--border-main)' }} {...props} />,
                          ol: ({node, ...props}: any) => <ol className="list-decimal pl-6 mb-8 border-l border-main" style={{ color: 'var(--text-main)', borderColor: 'var(--border-main)' }} {...props} />,
                          a: ({node, href, children, ...props}: any) => {
                            const text = String(children);
                            const isNumeric = /^\d+$/.test(text) || /^\[\d+\]$/.test(text);
                            if (isNumeric) {
                              return (
                                <sup className="px-0.5 font-bold font-mono">
                                  <a href={href} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline" {...props}>{text}</a>
                                </sup>
                              );
                            }
                            return (
                              <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-bold font-mono" {...props}>{children}</a>
                            );
                          },
                          code({ node, inline, className, children, ...props }: any) {
                            const content = String(children).trim();
                            const isMermaid = /mermaid/i.test(className || '') || /^\s*(graph|flowchart|sequenceDiagram|stateDiagram|pie|gantt|classDiagram|erDiagram|journey|gitGraph|mindmap|timeline)/i.test(content);
                            if (!inline && isMermaid) {
                              return <Mermaid chart={content} />;
                            }
                            return (
                              <code className={`${className} font-mono text-xs bg-sidebar border border-main px-1.5 py-0.5`} style={{ borderRadius: 'var(--radius-sm)' }} {...props}>
                                {children}
                              </code>
                            );
                          }
                        }}
                      >
                        {item.final_output || (isSearching && idx === chatHistory.length - 1 ? "" : "")}
                      </ReactMarkdown>

                      {item.final_output && (() => {
                        const citations = extractCitations(item.final_output);
                        if (citations.length === 0) return null;
                        return (
                          <div className="mt-12 pt-8 border-t border-main w-full" style={{ gridColumn: 'span 12' }}>
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] mb-4 text-muted">Sources & References</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {citations.map((cite) => (
                                <a 
                                  key={cite.id}
                                  href={cite.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-start gap-3 p-3 border border-main hover:border-primary transition-colors bg-sidebar text-xs group"
                                  style={{ borderRadius: 'var(--radius-md)' }}
                                >
                                  <span className="font-mono text-[9px] font-black px-1.5 py-0.5 bg-btn text-btn select-none group-hover:bg-primary group-hover:text-on-primary transition-colors" style={{ borderRadius: 'var(--radius-sm)' }}>
                                    {cite.id}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-bold truncate text-main group-hover:text-primary transition-colors uppercase font-mono">{cite.text}</p>
                                    <p className="text-[9px] text-muted truncate font-mono">{cite.url}</p>
                                  </div>
                                </a>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </motion.div>
                  </div>
                </div>
              </div>
              );
            })}

            <TerminalStream thoughts={agentThoughts} isSearching={isSearching} />

            {isSearching && !chatHistory[chatHistory.length - 1].final_output && (() => {
              const PIPELINE_STEPS = [
                { key: "architect", name: "Research Strategy & Outline", desc: "Formulating deep research pathways and section blueprints.", est: "4s" },
                { key: "researcher", name: "Web Discovery & Data Scraping", desc: "Accessing real-time search indexes and crawling authority sources.", est: "6s" },
                { key: "evidence", name: "Evidence Extraction & Fact Dissection", desc: "Parsing crawled resources to validate factual data and citations.", est: "5s" },
                { key: "critic", name: "Adversarial Critique & Verification", desc: "Cross-examining compiled data for gaps, contradictions, and depth.", est: "5s" },
                { key: "synthesizer", name: "Deep Narrative Synthesis", desc: "Weaving final editorial insights and Markdown reports.", est: "10s" },
                { key: "visualizer", name: "Visual Asset Synthesis & Delivery", desc: "Generating and cache-locking high-fidelity visual context cards.", est: "4s" }
              ];

              const activeIndex = activeAgent ? PIPELINE_STEPS.findIndex(s => s.key === activeAgent) : 0;

              return (
                <div className="max-w-3xl mx-auto w-full px-4 animate-in fade-in slide-in-from-bottom-8 duration-700">
                  <div
                    className="border p-6 relative"
                    style={{
                      backgroundColor: 'var(--bg-sidebar)',
                      borderColor: 'var(--border-main)',
                      borderRadius: 'var(--radius-lg)',
                    }}
                  >
                    {/* Header */}
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4 mb-6" style={{ borderColor: 'var(--border-main)' }}>
                      <div>
                        <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary mb-1">
                          <span className="w-1.5 h-1.5 bg-primary inline-block animate-pulse" />
                          Orchestra Research Engine Active
                        </span>
                        <h2 className="text-xl font-bold tracking-tight text-main m-0 uppercase font-mono">
                          Neural Pipeline
                        </h2>
                      </div>
                      <div className="border px-4 py-2 flex items-center gap-3 bg-app" style={{ borderColor: 'var(--border-main)' }}>
                        <Clock size={14} className="text-primary animate-pulse" />
                        <div>
                          <span className="block text-[8px] font-black uppercase tracking-widest text-muted">Total Elapsed</span>
                          <span className="font-mono text-sm font-bold text-primary">
                            {elapsedSeconds.toFixed(1)}s
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar (Brutalist Track) */}
                    <div className="h-1 bg-app border mb-6 relative overflow-hidden" style={{ borderColor: 'var(--border-main)' }}>
                      <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{
                          width: `${Math.round((activeIndex / PIPELINE_STEPS.length) * 100)}%`
                        }}
                      />
                    </div>

                    {/* Stepper Timeline */}
                    <div className="space-y-4">
                      {PIPELINE_STEPS.map((step, idx) => {
                        const isCompleted = idx < activeIndex;
                        const isActive = idx === activeIndex;

                        return (
                          <div key={step.key} className="flex gap-4 relative">
                            {/* Vertical Connector Line */}
                            {idx < PIPELINE_STEPS.length - 1 && (
                              <div 
                                className="absolute left-[11px] top-6 bottom-[-20px] w-0.5"
                                style={{ 
                                  backgroundColor: isCompleted ? 'var(--primary)' : 'var(--border-main)',
                                }} 
                              />
                            )}

                            {/* Status Indicator (Brutalist Square Boxes) */}
                            <div className="flex-shrink-0 z-10">
                              {isCompleted ? (
                                <div className="w-6 h-6 border flex items-center justify-center bg-app text-emerald-500 font-bold" style={{ borderColor: 'var(--border-main)', borderRadius: 'var(--radius-sm)' }}>
                                  ✓
                                </div>
                              ) : isActive ? (
                                <div className="w-6 h-6 border-2 flex items-center justify-center bg-app text-primary" style={{ borderColor: 'var(--primary)', borderRadius: 'var(--radius-sm)' }}>
                                  <Loader2 size={12} className="animate-spin" />
                                </div>
                              ) : (
                                <div className="w-6 h-6 border flex items-center justify-center bg-app text-muted font-mono text-[10px]" style={{ borderColor: 'var(--border-main)', borderRadius: 'var(--radius-sm)' }}>
                                  {idx + 1}
                                </div>
                              )}
                            </div>

                            {/* Step Text */}
                            <div className="flex-1 min-w-0 pt-0.5">
                              <div className="flex items-center justify-between gap-4 mb-1">
                                <h3 
                                  className="text-xs font-black uppercase tracking-wider font-mono m-0"
                                  style={{ color: isActive ? 'var(--primary)' : isCompleted ? 'var(--text-main)' : 'var(--text-muted)' }}
                                >
                                  {step.name}
                                </h3>
                                {isActive ? (
                                  <span className="font-mono text-[9px] font-bold text-primary bg-app border px-2 py-0.5" style={{ borderColor: 'var(--border-main)', borderRadius: 'var(--radius-sm)' }}>
                                    {stepElapsedSeconds.toFixed(1)}s / Est. {step.est}
                                  </span>
                                ) : isCompleted ? (
                                  <span className="text-[8px] font-black uppercase tracking-widest text-emerald-500 bg-app border px-2 py-0.5" style={{ borderColor: 'var(--border-main)', borderRadius: 'var(--radius-sm)' }}>
                                    Done
                                  </span>
                                ) : (
                                  <span className="text-[8px] font-black uppercase tracking-widest text-muted font-mono">
                                    Est. {step.est}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] leading-relaxed m-0 text-muted">
                                {step.desc}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}

            {!isSearching && chatHistory.length === 0 && (
              <motion.div 
                key={activeTopic.id}
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="w-full flex-grow flex flex-col p-2 lg:p-6 min-h-0 overflow-y-auto custom-scrollbar"
              >
                <div className="grid grid-cols-12 gap-6 w-full items-start">
                  
                  {/* Left Column (Bento Cards - Hero and sub widgets) */}
                  <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
                    
                    {/* Main Hero Card - Clickable → Research */}
                    <motion.div 
                      variants={cardVariants}
                      whileHover={{ 
                        y: -4, 
                        borderColor: 'var(--primary)',
                        boxShadow: '0 12px 30px -10px rgba(6, 182, 212, 0.12), 0 0 15px rgba(6, 182, 212, 0.04)'
                      }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      className="border p-6 lg:p-8 bg-sidebar relative overflow-hidden transition-all duration-300 cursor-pointer group"
                      style={{ borderColor: 'var(--border-main)', borderRadius: 'var(--radius-lg)' }}
                      onClick={() => handleSearch(activeTopic.researchQuery)}
                    >
                      {/* Research Now hover badge */}
                      <div className="absolute top-5 right-5 opacity-0 group-hover:opacity-100 transition-all duration-200 z-20">
                        <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-primary bg-primary/10 border border-primary/20 px-2 py-1" style={{ borderRadius: 'var(--radius-sm)' }}>
                          <ArrowRight size={9} /> Research Now
                        </span>
                      </div>
                      <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-bl-full pointer-events-none" />
                      
                      <div className="flex flex-wrap justify-between items-start gap-4 mb-8">
                        <div>
                          <span className="text-[10px] font-black tracking-[0.2em] text-primary uppercase">{activeTopic.category}</span>
                          <h2 className="text-2xl lg:text-3xl font-black uppercase font-mono mt-1 text-main tracking-tight leading-tight">
                            {activeTopic.title}
                          </h2>
                        </div>
                        <div className={`flex items-center gap-2 px-3 py-1.5 border text-[10px] font-black uppercase tracking-wider ${alertBadgeMap[activeTopic.alertColor] || alertBadgeMap.amber}`} style={{ borderRadius: 'var(--radius-sm)' }}>
                          <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${alertDotMap[activeTopic.alertColor] || 'bg-amber-500'}`} />
                          {activeTopic.alertLevel}
                        </div>
                      </div>

                      {/* 2-Column Core Interface */}
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center mb-8">
                        
                        {/* Interactive Orb Center (Kept completely intact) */}
                        <div className="col-span-12 md:col-span-5 flex flex-col items-center justify-center p-6 bg-app border border-main h-64 relative" style={{ borderRadius: 'var(--radius-lg)' }}>
                          {/* Corner highlights */}
                          <div className="absolute top-2 left-2 w-2 h-2 border-t border-l border-primary/40" />
                          <div className="absolute top-2 right-2 w-2 h-2 border-t border-r border-primary/40" />
                          <div className="absolute bottom-2 left-2 w-2 h-2 border-b border-l border-primary/40" />
                          <div className="absolute bottom-2 right-2 w-2 h-2 border-b border-r border-primary/40" />
                          
                          <div className="scale-[0.55] origin-center -my-8">
                            <OrchestraOrb agent={activeAgent} isSearching={isSearching} />
                          </div>
                          
                          <div className="text-center z-10">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">SYSTEM ACTIVE</h3>
                            <p className="text-[8px] font-mono opacity-50 uppercase tracking-widest text-muted">NEURAL ORBITAL CORE</p>
                          </div>
                        </div>

                        {/* Executive Context */}
                        <div className="col-span-12 md:col-span-7 space-y-4">
                          <p className="text-lg italic serif-text leading-relaxed opacity-90 border-l-2 border-primary pl-4" style={{ color: 'var(--text-main)' }}>
                            {activeTopic.quote}
                          </p>
                          <p className="text-xs leading-relaxed text-muted uppercase font-mono">
                            {activeTopic.body}
                          </p>
                          <div className="flex gap-2 flex-wrap">
                            {activeTopic.tags.map((tag, ti) => (
                              <span key={ti} className="text-[9px] font-bold px-2 py-1 bg-app border border-main uppercase tracking-tight" style={{ borderRadius: 'var(--radius-sm)' }}>{tag}</span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Dynamic Metrics row */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-main">
                        <ExposureTelemetry value={bentoExposure} />
                        <VolatilityTelemetry value={bentoVolatility} />

                        <div className="p-4 bg-app border border-main" style={{ borderRadius: 'var(--radius-md)', borderColor: 'var(--border-main)' }}>
                          <span className="text-[9px] uppercase tracking-widest text-muted font-bold block mb-1">Confidence Score</span>
                          <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-black font-mono text-main">HIGH</span>
                            <span className="text-[9px] text-emerald-500 font-bold uppercase tracking-tight">99.8% Match</span>
                          </div>
                          <div className="w-full h-1 bg-sidebar border border-main mt-3 overflow-hidden" style={{ borderRadius: 'var(--radius-full)', borderColor: 'var(--border-main)' }}>
                            <div className="h-full bg-emerald-500" style={{ width: '90%' }} />
                          </div>
                        </div>
                      </div>

                    </motion.div>

                    {/* Sub Bento cards - Regional Asset & AI Notes */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      
                      {/* Regional Asset Tracking */}
                      <motion.div 
                        variants={cardVariants}
                        whileHover={{ 
                          y: -4, 
                          borderColor: 'var(--primary)',
                          boxShadow: '0 12px 30px -10px rgba(6, 182, 212, 0.12), 0 0 15px rgba(6, 182, 212, 0.04)'
                        }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        className="bg-sidebar p-6 border border-main flex flex-col justify-between transition-all duration-300"
                        style={{ borderColor: 'var(--border-main)', borderRadius: 'var(--radius-lg)' }}
                      >
                        <div>
                          <h3 className="text-xs font-black uppercase tracking-widest text-primary mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-primary rounded-full inline-block" />
                            Regional Asset Tracking
                          </h3>
                          <div className="space-y-3">
                            {activeTopic.assets.map((asset, ai) => (
                              <div key={ai} className={`flex justify-between items-center pb-2 ${ai < activeTopic.assets.length - 1 ? 'border-b border-main' : ''}`} style={ai < activeTopic.assets.length - 1 ? { borderColor: 'var(--border-main)' } : {}}>
                                <span className="text-xs font-bold text-main font-mono">{asset.name}</span>
                                <span className={`text-xs font-bold font-mono ${asset.color}`}>{asset.value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-main text-[9px] text-muted font-mono uppercase tracking-tight" style={{ borderColor: 'var(--border-main)' }}>
                          Monitoring {activeTopic.assets.length} active strategic zones
                        </div>
                      </motion.div>

                      {/* AI Inference Notes - Clickable */}
                      <motion.div 
                        variants={cardVariants}
                        whileHover={{ 
                          y: -4, 
                          borderColor: 'var(--primary)',
                          boxShadow: '0 12px 30px -10px rgba(6, 182, 212, 0.12), 0 0 15px rgba(6, 182, 212, 0.04)'
                        }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        className="bg-sidebar p-6 border border-main flex flex-col justify-between transition-all duration-300 cursor-pointer group relative"
                        style={{ borderColor: 'var(--border-main)', borderRadius: 'var(--radius-lg)' }}
                        onClick={() => handleSearch(activeTopic.inferenceQuery)}
                      >
                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-200 z-20">
                          <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-primary bg-primary/10 border border-primary/20 px-2 py-1" style={{ borderRadius: 'var(--radius-sm)' }}>
                            <ArrowRight size={9} /> Research Now
                          </span>
                        </div>
                        <div>
                          <h3 className="text-xs font-black uppercase tracking-widest text-primary mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-primary rounded-full inline-block" />
                            AI Inference Notes
                          </h3>
                          <p className="serif-text text-xs italic text-muted leading-relaxed mb-4">
                            {activeTopic.inference}
                          </p>
                        </div>
                        <div className="text-[9px] text-muted font-mono uppercase tracking-tight">
                          Updated 3m ago via Autonomous Crawler
                        </div>
                      </motion.div>

                    </div>

                  </div>

                  {/* Right Column (Bento Cards - Briefing stream & Node Map) */}
                  <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
                    
                    {/* Briefing Stream */}
                    <motion.div 
                      variants={cardVariants}
                      whileHover={{ 
                        y: -4, 
                        borderColor: 'var(--primary)',
                        boxShadow: '0 12px 30px -10px rgba(6, 182, 212, 0.12), 0 0 15px rgba(6, 182, 212, 0.04)'
                      }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      className="bg-sidebar border border-main p-6 flex flex-col justify-between transition-all duration-300"
                      style={{ borderColor: 'var(--border-main)', borderRadius: 'var(--radius-lg)' }}
                    >
                      <div>
                        <h3 className="text-xs font-black uppercase tracking-widest text-main mb-6 font-mono">Briefing Stream</h3>
                        <div className="space-y-6">
                          {activeTopic.briefings.map((briefing, bi) => (
                            <motion.div 
                              key={bi}
                              className={`group cursor-pointer ${bi === 2 ? 'opacity-50' : ''}`}
                              whileHover={{ x: 4, scale: 1.01 }}
                              transition={{ type: "spring", stiffness: 300, damping: 20 }}
                              onClick={() => handleSearch(briefing.query)}
                            >
                              <div className="flex gap-3 items-start">
                                <div className={`w-1.5 h-10 ${briefingBarMap[briefing.color] || 'bg-zinc-600'} shrink-0`} style={{ borderRadius: 'var(--radius-full)' }} />
                                <div>
                                  <p className="text-[9px] font-bold text-muted uppercase font-mono">{briefing.time} • {briefing.type}</p>
                                  <h4 className="text-xs font-bold text-main group-hover:text-primary transition-colors uppercase font-mono mt-0.5">{briefing.headline}</h4>
                                  <p className="text-[10px] text-muted mt-1 leading-normal line-clamp-2">{briefing.body}</p>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                      <button className="w-full mt-8 py-2.5 border border-main text-[9px] font-bold uppercase tracking-wider hover:bg-app transition-colors" style={{ borderRadius: 'var(--radius-md)', borderColor: 'var(--border-main)' }}>
                        View All Briefings
                      </button>
                    </motion.div>

                    {/* Global Map Inset */}
                    <motion.div 
                      variants={cardVariants}
                      whileHover={{ 
                        y: -4, 
                        borderColor: 'var(--primary)',
                        boxShadow: '0 12px 30px -10px rgba(6, 182, 212, 0.12), 0 0 15px rgba(6, 182, 212, 0.04)'
                      }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      className="bg-sidebar border border-main overflow-hidden flex flex-col justify-between transition-all duration-300"
                      style={{ borderColor: 'var(--border-main)', borderRadius: 'var(--radius-lg)' }}
                    >
                      <div className="p-4 border-b border-main" style={{ borderColor: 'var(--border-main)' }}>
                        <h3 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-primary rounded-full inline-block animate-pulse" />
                          Global Node Distribution
                        </h3>
                      </div>
                      
                      {/* Schematic Map Visualizer */}
                      <div className="h-44 bg-app relative flex items-center justify-center overflow-hidden border-b border-main p-4" style={{ borderColor: 'var(--border-main)' }}>
                        {/* Map Dot grid */}
                        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]" />
                        
                        {/* Radar Sweep Line */}
                        <div 
                          className="absolute pointer-events-none"
                          style={{
                            background: 'conic-gradient(from 0deg, var(--primary) 0deg, transparent 180deg, transparent 360deg)',
                            borderRadius: '50%',
                            width: '160px',
                            height: '160px',
                            opacity: 0.15,
                            animation: 'radarSweep 6s linear infinite'
                          }}
                        />

                        {/* Schematic target designator */}
                        <div className="relative w-32 h-32 border border-primary/10 rounded-full flex items-center justify-center animate-pulse-soft">
                          <div className="absolute w-20 h-20 border border-primary/20 rounded-full" />
                          <div className="absolute w-8 h-8 border border-primary/30 rounded-full" />
                          
                          {/* Pulse Node */}
                          <div className="relative z-10 flex flex-col items-center">
                            <span className="w-3 h-3 bg-primary rounded-full animate-ping absolute" />
                            <span className="w-3 h-3 bg-primary rounded-full" />
                          </div>
                          
                          {/* Crosshair accents */}
                          <div className="absolute top-0 w-px h-full bg-primary/5" />
                          <div className="absolute left-0 h-px w-full bg-primary/5" />
                        </div>
                        
                        {/* Secondary Target 1 (Shenzhen Area) */}
                        <div className="absolute top-8 left-16 flex flex-col items-center">
                          <span className="w-2 h-2 bg-red-500 rounded-full animate-ping absolute opacity-70" style={{ animationDuration: '3s' }} />
                          <span className="w-2 h-2 bg-red-500 rounded-full opacity-80" />
                          <span className="text-[6px] font-mono text-muted uppercase mt-1 opacity-55">SZN-NODE</span>
                        </div>

                        {/* Secondary Target 2 (Hsinchu Area) */}
                        <div className="absolute bottom-8 right-16 flex flex-col items-center">
                          <span className="w-2 h-2 bg-primary rounded-full animate-ping absolute opacity-60" style={{ animationDuration: '4s' }} />
                          <span className="w-2 h-2 bg-primary rounded-full opacity-80" />
                          <span className="text-[6px] font-mono text-muted uppercase mt-1 opacity-55">HSC-NODE</span>
                        </div>

                        <div className="absolute bottom-2 left-3 bg-app/80 border border-main px-2 py-1 text-[8px] font-black uppercase tracking-widest text-amber-500" style={{ borderRadius: 'var(--radius-sm)', borderColor: 'var(--border-main)' }}>
                          Active Target
                        </div>

                        <style dangerouslySetInnerHTML={{__html: `
                          @keyframes radarSweep {
                            from { transform: rotate(0deg); }
                            to { transform: rotate(360deg); }
                          }
                        `}} />
                      </div>

                      <div className="p-4 bg-sidebar">
                        <div className="flex justify-between items-center">
                          <div>
                            <span className="text-[9px] font-bold text-muted uppercase font-mono block">Monitoring Nodes</span>
                            <span className="text-lg font-black font-mono text-main">
                              <AnimatedCounter value={1242} duration={2} />
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[9px] font-bold text-muted uppercase font-mono block">Network Health</span>
                            <NetworkHealthTelemetry value={bentoHealth} />
                          </div>
                        </div>
                      </div>
                    </motion.div>

                  </div>

                </div>
              </motion.div>
            )}
            <div className="h-4 w-full flex-shrink-0"></div>
          </div>
        </div>

        <div 
          className="absolute bottom-0 left-0 right-0 p-4 z-40"
          style={{ background: 'linear-gradient(to top, var(--bg-app) 0%, var(--bg-app) 60%, transparent 100%)' }}

        >
          <SearchInterface 
            onSearch={handleSearch}
            isSearching={isSearching}
            activeAgent={activeAgent}
            onCancel={handleCancelSearch}
            isRecording={isRecording}
            startRecording={startRecording}
            stopRecording={stopRecording}
            isUploading={isUploading}
            onFileUpload={() => fileInputRef.current?.click()}
            externalQuery={voiceQuery}
            isFollowUp={!!sessionId}
          />
        </div>
      </section>
      {lightboxSrc && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(8px)' }}
          onClick={() => setLightboxSrc(null)}
        >
          <div className="relative max-w-6xl max-h-[90vh] w-full" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <img 
              src={lightboxSrc} 
              alt="Research visual" 
              className="w-full h-auto max-h-[85vh] object-contain border border-main"
              style={{ borderRadius: 'var(--radius-md)' }}
            />
            <button
              onClick={() => setLightboxSrc(null)}
              className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center text-white border"
              style={{ backgroundColor: 'var(--bg-app)', borderColor: 'var(--border-main)', borderRadius: 'var(--radius-sm)' }}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
