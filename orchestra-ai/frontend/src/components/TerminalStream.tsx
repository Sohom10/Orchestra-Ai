'use client'

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface AgentThought {
  id: string;
  agent: string;
  content: string;
  timestamp: string;
}

interface TerminalStreamProps {
  thoughts: AgentThought[];
  isSearching: boolean;
}

export function TerminalStream({ thoughts, isSearching }: TerminalStreamProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [thoughts]);

  if (thoughts.length === 0 && !isSearching) return null;

  return (
    <div className="w-full max-w-[1200px] mx-auto mt-8 mb-4 border overflow-hidden relative shadow-2xl" 
      style={{ 
        borderColor: 'var(--border-main)', 
        borderRadius: 'var(--radius-lg)', 
        backgroundColor: 'var(--surface-container-low)',
        height: '300px'
      }}
    >
      <div className="flex items-center px-4 py-2 border-b bg-black/20" style={{ borderColor: 'var(--border-main)' }}>
        <div className="flex gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <div className="w-3 h-3 rounded-full bg-amber-500"></div>
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
        </div>
        <span className="ml-4 text-xs font-mono font-bold tracking-widest text-primary uppercase">Neural Matrix Terminal</span>
      </div>
      
      <div 
        ref={containerRef}
        className="p-4 h-[260px] overflow-y-auto font-mono text-xs flex flex-col gap-3 custom-scrollbar"
        style={{ color: 'var(--text-main)' }}
      >
        <AnimatePresence initial={false}>
          {thoughts.map((thought) => (
            <motion.div
              key={thought.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex flex-col gap-1 border-l-2 pl-3 py-1"
              style={{ borderColor: 'var(--primary)' }}
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted">{thought.timestamp}</span>
                <span className="font-bold text-primary">[{thought.agent.toUpperCase()}]</span>
              </div>
              <div className="whitespace-pre-wrap opacity-80 pl-2 border-l border-white/5">{thought.content}</div>
            </motion.div>
          ))}
          {isSearching && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 mt-2 text-primary"
            >
              <span className="w-2 h-4 bg-primary animate-pulse"></span>
              <span className="opacity-50">Awaiting stream...</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
