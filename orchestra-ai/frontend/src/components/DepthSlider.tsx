"use client";

import { motion } from "framer-motion";

interface DepthSliderProps {
  depth: number;
  setDepth: (depth: number) => void;
}

export default function DepthSlider({ depth, setDepth }: DepthSliderProps) {
  const levels = [
    { value: 1, label: "Fast", desc: "Pulse Check" },
    { value: 2, label: "Deep", desc: "Standard" },
    { value: 3, label: "Pro", desc: "Exhaustive" },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Research Depth</span>
        <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400">{levels.find(l => l.value === depth)?.label}</span>
      </div>
      
      <div className="flex gap-2">
        {levels.map((level) => (
          <button
            key={level.value}
            onClick={() => setDepth(level.value)}
            className={`
              flex-1 py-2 px-1 rounded-lg border transition-all
              ${depth === level.value 
                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 shadow-sm' 
                : 'bg-transparent border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-500 hover:border-zinc-300 dark:hover:border-zinc-700'
              }
            `}
          >
            <div className="text-[10px] font-bold">{level.label}</div>
            <div className="text-[8px] opacity-60 leading-tight uppercase tracking-tighter">{level.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
