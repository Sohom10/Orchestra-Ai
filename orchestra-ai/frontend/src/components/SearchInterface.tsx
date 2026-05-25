"use client";

import { 
  Send, 
  Paperclip, 
  Mic, 
  StopCircle,
  Activity,
  Database
} from "lucide-react";
import { useState, useRef, useEffect, memo } from "react";
import { motion } from "framer-motion";

interface SearchInterfaceProps {
  onSearch: (query: string, persona: string) => void;
  isSearching: boolean;
  activeAgent?: string | null;
  isRecording: boolean;
  startRecording: () => void;
  stopRecording: () => void;
  isUploading: boolean;
  onFileUpload: () => void;
  onCancel?: () => void;
  externalQuery?: string;
  isFollowUp?: boolean;
}

const SearchInterface = memo(({ 
  onSearch, 
  isSearching, 
  activeAgent,
  isRecording, 
  startRecording, 
  stopRecording, 
  isUploading, 
  onFileUpload,
  onCancel,
  externalQuery,
  isFollowUp
}: SearchInterfaceProps) => {
  const [query, setQuery] = useState("");
  const [persona, setPersona] = useState("Standard");
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync external query (from voice) if it changes
  useEffect(() => {
    if (externalQuery) {
      setQuery(externalQuery);
    }
  }, [externalQuery]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 192) + 'px';
    }
  }, [query]);

  const handleSubmit = () => {
    if (query.trim() && !isSearching) {
      onSearch(query, persona);
      setQuery("");
    }
  };

  const handleSuggestionClick = (suggestionText: string) => {
    if (!isSearching) {
      onSearch(suggestionText, persona);
      setQuery("");
    }
  };

  return (
    <div className="max-w-3xl mx-auto w-full">
      <form 
        onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} 
        className={`flex flex-col gap-2 border ${isSearching ? 'opacity-50 pointer-events-none' : ''} p-3 transition-all duration-300`} 
        style={{ 
          backgroundColor: 'var(--bg-sidebar)', 
          borderColor: isFocused ? 'var(--primary)' : 'var(--border-main)', 
          borderRadius: 'var(--radius-lg)', 
          boxShadow: isFocused 
            ? '0 10px 30px -10px rgba(6, 182, 212, 0.15), 0 0 15px rgba(6, 182, 212, 0.05)' 
            : '0 10px 30px -10px rgba(0,0,0,0.3)' 
        }}
      >
        <div className="flex items-end gap-3 px-2">
          <button 
            type="button"
            onClick={() => !isUploading && onFileUpload()}
            className={`mb-2 p-2 transition-all border border-transparent hover:border-main ${isUploading ? 'bg-primary/10 text-primary' : 'opacity-40 hover:bg-black/5 dark:hover:bg-white/5 hover:opacity-100'}`}
            disabled={isUploading}
            style={{ borderRadius: 'var(--radius-sm)' }}
          >
            {isUploading ? <Activity size={20} className="animate-spin" /> : <Paperclip size={20} />}
          </button>
          <textarea 
            id="search-query-input"
            name="searchQuery"
            ref={textareaRef} 
            value={query} 
            onChange={(e) => setQuery(e.target.value)} 
            onKeyDown={(e) => { if ((e.key === "Enter" || e.keyCode === 13) && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} 
            placeholder={isRecording ? "Listening to voice..." : isFollowUp ? "Ask a follow-up question..." : "Describe your research objective..."} 
            className="flex-1 max-h-48 min-h-[48px] py-3 px-1 bg-transparent border-none focus:ring-0 text-sm font-medium resize-none custom-scrollbar" 
            rows={1} 
            disabled={isSearching} 
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            style={{ color: 'var(--text-main)' }}
          />

          <div className="flex items-center gap-2 mb-1.5">
            <select
              id="persona-select"
              name="persona"
              value={persona}
              onChange={(e) => setPersona(e.target.value)}
              disabled={isSearching}
              className="text-[10px] uppercase font-bold tracking-wider bg-transparent border-none outline-none focus:ring-0 cursor-pointer"
              style={{ color: 'var(--text-muted)' }}
            >
              <option value="Standard">Standard</option>
              <option value="Visionary">Visionary</option>
              <option value="Skeptic">Skeptic</option>
            </select>
            <div className="relative flex items-center justify-center">
              {isRecording && (
                <>
                  <motion.div 
                    className="absolute inset-0 bg-red-500 rounded-full"
                    initial={{ scale: 1, opacity: 0.6 }}
                    animate={{ scale: 2.2, opacity: 0 }}
                    transition={{ repeat: Infinity, duration: 2, ease: "easeOut" }}
                  />
                  <motion.div 
                    className="absolute inset-0 bg-red-500 rounded-full"
                    initial={{ scale: 1, opacity: 0.6 }}
                    animate={{ scale: 1.8, opacity: 0 }}
                    transition={{ repeat: Infinity, duration: 2, ease: "easeOut", delay: 0.6 }}
                  />
                  <motion.div 
                    className="absolute inset-0 bg-red-500 rounded-full"
                    initial={{ scale: 1, opacity: 0.6 }}
                    animate={{ scale: 1.4, opacity: 0 }}
                    transition={{ repeat: Infinity, duration: 2, ease: "easeOut", delay: 1.2 }}
                  />
                </>
              )}
              <button 
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                className={`relative z-10 p-2 transition-all border ${isRecording ? 'bg-red-500 text-white border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]' : 'opacity-40 hover:bg-black/5 dark:hover:bg-white/5 border-transparent hover:border-main'}`}
                style={{ borderRadius: 'var(--radius-full)' }}
                title={isRecording ? "Stop recording" : "Record research directive"}
              >
                {isRecording ? <StopCircle size={20} /> : <Mic size={20} />}
              </button>
            </div>
            {isSearching ? (
              <div 
                className="p-2.5 border transition-all flex items-center gap-3"
                style={{ backgroundColor: 'var(--bg-sidebar)', color: 'var(--text-muted)', borderColor: 'var(--border-main)', borderRadius: 'var(--radius-md)' }}
              >
                <div className="flex items-center gap-3 pr-1">
                   <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                   {activeAgent && (
                     <span className="text-[10px] font-black uppercase tracking-widest text-white/90 animate-pulse whitespace-nowrap">
                       {activeAgent}...
                     </span>
                   )}
                   <button 
                     type="button"
                     onClick={(e) => { e.stopPropagation(); onCancel?.(); }}
                     className="text-[9px] font-bold text-white/50 hover:text-white uppercase tracking-tighter border-l border-white/20 pl-3 ml-1 cursor-pointer z-50"
                   >
                     Stop
                   </button>
                </div>
              </div>
            ) : (
              <button 
                type="button"
                onClick={handleSubmit} 
                disabled={!query.trim()} 
                className="p-2.5 border transition-all flex items-center gap-3 active:scale-[0.98]"
                style={query.trim() ? { backgroundColor: 'var(--bg-btn)', color: 'var(--text-btn)', borderColor: 'var(--border-main)', borderRadius: 'var(--radius-md)' } : { backgroundColor: 'var(--bg-sidebar)', color: 'var(--text-muted)', borderColor: 'var(--border-main)', borderRadius: 'var(--radius-md)' }}
              >
                <Send size={20} />
              </button>
            )}
          </div>
        </div>
      </form>
      <div className="flex items-center justify-center gap-6 mt-3 text-[8px] font-black uppercase tracking-[0.2em] opacity-60" style={{ color: 'var(--text-main)' }}>
          {isRecording ? (
            <span className="flex items-center gap-1.5 animate-pulse text-red-500 font-black"><Mic size={10} /> Neural Voice Active</span>
          ) : (
            <span className="flex items-center gap-1.5"><Activity size={10} className="text-primary" /> Neural Engine Active</span>
          )}
          <span className="flex items-center gap-1.5"><Database size={10} className="text-indigo-500" /> Cloud Sync Enabled</span>
      </div>
      {!isSearching && (
        <div className="flex flex-wrap justify-center gap-3 mt-4">
          {[
            "Analyze Taiwan Strait cargo density",
            "Identify emerging risk in cobalt mining",
            "Synthesize Q4 energy forecasts"
          ].map((suggestion, sIdx) => (
            <motion.button
              key={sIdx}
              type="button"
              onClick={() => handleSuggestionClick(suggestion)}
              whileHover={{ 
                y: -3, 
                scale: 1.03,
                borderColor: 'var(--primary)',
                color: 'var(--text-main)',
                backgroundColor: 'rgba(255,255,255,0.03)'
              }}
              whileTap={{ scale: 0.97 }}
              className="text-[9px] uppercase tracking-wider font-bold py-2 px-4 border border-main bg-sidebar transition-all duration-300 shadow-sm cursor-pointer"
              style={{ borderRadius: 'var(--radius-full)', color: 'var(--text-muted)', borderColor: 'var(--border-main)' }}
            >
              "{suggestion}"
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
});

SearchInterface.displayName = "SearchInterface";

export default SearchInterface;
