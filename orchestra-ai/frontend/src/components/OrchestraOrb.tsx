"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, memo } from "react";

interface OrbProps {
  agent: string | null;
  isSearching: boolean;
}

interface Particle {
  id: number;
  size: number;
  duration: number;
  delay: number;
  radius: number;
  angle: number;
  direction: number;
  tiltX: number;
  tiltY: number;
  isAnomaly: boolean;
}

const OrchestraOrb = memo(function OrchestraOrb({ agent, isSearching }: OrbProps) {
  const [colorIndex, setColorIndex] = useState<number>(0);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [mounted, setMounted] = useState<boolean>(false);
  
  const colors = [
    "#3b82f6", // Royal Blue
    "#6366f1", // Indigo
    "#8b5cf6", // Violet
    "#10b981", // Emerald
    "#0ea5e9", // Sky Blue
    "#2dd4bf", // Teal
  ];
  
  const agentConfigs: Record<string, { color: string, glow: string }> = {
    architect: { color: "#3b82f6", glow: "rgba(59, 130, 246, 0.5)" }, 
    researcher: { color: "#8b5cf6", glow: "rgba(139, 92, 246, 0.5)" }, 
    critic: { color: "#6366f1", glow: "rgba(99, 102, 241, 0.5)" }, 
    synthesizer: { color: "#10b981", glow: "rgba(16, 185, 129, 0.5)" }, 
    default: { color: colors[colorIndex], glow: `${colors[colorIndex]}44` },
  };


  useEffect(() => {
    const generatedParticles: Particle[] = Array.from({ length: 20 }).map((_, i) => ({
      id: i,
      size: (Math.random() * 3 + 2) * 1.5,
      duration: Math.random() * 6 + 4,
      delay: Math.random() * 2,
      radius: 50 + Math.random() * 40,
      angle: (i / 20) * 360,
      direction: Math.random() > 0.5 ? 1 : -1,
      tiltX: Math.random() * 60 - 30,
      tiltY: Math.random() * 60 - 30,
      isAnomaly: Math.random() > 0.75,
    }));
    setParticles(generatedParticles);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!agent) {
      const interval = setInterval(() => {
        setColorIndex((prev) => (prev + 1) % colors.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [agent]);

  if (!mounted) return null;

  const config = agent ? (agentConfigs[agent] || agentConfigs.default) : agentConfigs.default;

  return (
    <div className="relative w-64 h-64 flex items-center justify-center scale-110 lg:scale-125">
      {/* Outer Atmospheric Glow */}
      <motion.div
        animate={{
          scale: isSearching ? [1, 1.2, 1] : [1, 1.1, 1],
          opacity: isSearching ? [0.1, 0.3, 0.1] : [0.05, 0.15, 0.05],
          backgroundColor: config.color,
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
          backgroundColor: { duration: 0.8 }
        }}
        className="absolute inset-0 rounded-full blur-[100px]"
      />

      {/* Cinematic 3D Orbital System with Fading Ghost Trails */}
      <div className="absolute inset-0 flex items-center justify-center [perspective:1000px] [transform-style:preserve-3d]">
        {particles.map((p) => (
          <motion.div
            key={p.id}
            initial={{ rotateX: p.tiltX, rotateY: p.tiltY }}
            animate={{
              rotateZ: p.direction > 0 ? [p.angle, p.angle + 360] : [p.angle, p.angle - 360],
            }}
            transition={{
              duration: isSearching ? p.duration * 0.5 : p.duration,
              repeat: Infinity,
              ease: "linear",
            }}
            className="absolute"
            style={{ 
              width: p.radius * 2, 
              height: p.radius * 2,
              transformStyle: "preserve-3d"
            }}
          >
            {/* Lead Particle */}
            <motion.div
              animate={{
                scale: isSearching ? [1, 1.2, 1] : 1,
                backgroundColor: p.isAnomaly ? colors[(colorIndex + 2) % colors.length] : config.color,
                boxShadow: `0 0 15px ${p.isAnomaly ? colors[(colorIndex + 2) % colors.length] : config.color}`,
              }}
              className="absolute left-1/2 -translate-x-1/2 -top-1 rounded-full z-30"
              style={{ width: p.size, height: p.size }}
            />
            
            {/* Fading Ghost Trail (Chain of 5 dots) */}
            {[...Array(5)].map((_, index) => (
              <motion.div
                key={index}
                className="absolute left-1/2 -translate-x-1/2 -top-1 rounded-full"
                style={{ 
                  width: p.size * (1 - (index + 1) * 0.08), 
                  height: p.size * (1 - (index + 1) * 0.08),
                  backgroundColor: p.isAnomaly ? colors[(colorIndex + 2) % colors.length] : config.color,
                  opacity: 0.4 / (index + 1),
                  transformOrigin: `50% ${p.radius + 4}px`,
                  rotate: `${p.direction > 0 ? '-' : ''}${(index + 1) * 4}deg` 
                }}
              />
            ))}
          </motion.div>
        ))}
      </div>

      {/* Main Glass Core */}
      <motion.div
        animate={{
          scale: isSearching ? [1, 1.05, 1] : [1, 1.02, 1],
          boxShadow: isSearching 
        ? [`0 0 40px ${config.glow}`, `0 0 80px ${config.glow}`, `0 0 40px ${config.glow}`]
        : [`0 0 20px ${config.glow}`, `0 0 40px ${config.glow}`, `0 0 20px ${config.glow}`],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="relative w-32 h-32 rounded-full border border-white/30 dark:border-white/10 backdrop-blur-3xl flex items-center justify-center overflow-hidden z-20 shadow-inner"
        style={{ 
          background: `radial-gradient(circle at 30% 30%, rgba(255,255,255,1), ${config.color}66)`,
          transition: "background 0.5s ease-in-out, border-color 0.5s ease-in-out"
        }}
      >
        {/* Pulsing Core */}
        <motion.div 
          animate={{
            scale: isSearching ? [1, 1.4, 1] : [1, 1.2, 1],
            opacity: isSearching ? [0.8, 1, 0.8] : [0.5, 0.8, 0.5],
            backgroundColor: config.color,
          }}
          transition={{
            scale: { duration: 2, repeat: Infinity },
            opacity: { duration: 2, repeat: Infinity },
            backgroundColor: { duration: 0.8, ease: "easeInOut" },
            ease: "easeInOut",
          }}
          className="w-16 h-16 rounded-full blur-2xl shadow-[0_0_50px_rgba(255,255,255,0.4)]" 
        />
        
        {/* Glass Highlight */}
        <div className="absolute top-4 left-6 w-16 h-8 bg-white/40 rounded-full blur-md rotate-[-35deg]" />
      </motion.div>

      {/* Status Indicators */}
      <AnimatePresence mode="wait">
        {isSearching && agent && (
          <motion.div
            key={agent}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="absolute -bottom-16 flex flex-col items-center gap-1.5"
          >
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Processing Node</span>
            </div>
            <span 
              className="text-sm font-black transition-colors duration-700 uppercase tracking-tight"
              style={{ color: config.color }}
            >
              {agent}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export default OrchestraOrb;
