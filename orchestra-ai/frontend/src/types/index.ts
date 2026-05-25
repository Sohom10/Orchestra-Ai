import { User } from "@supabase/supabase-js";

export type Theme = 'light' | 'dark';
export type ResearchDepth = 'Fast' | 'Deep' | 'Pro';

export interface AgentState {
  architect: boolean;
  researcher: boolean;
  critic: boolean;
  synthesizer: boolean;
}

export interface ChatMessage {
  query: string;
  final_output: string;
  created_at?: string;
}

export interface ResearchHistoryItem {
  id: string;
  user_id: string;
  query?: string;
  topic?: string;
  final_output?: string;
  report?: string;
  plan?: string;
  citations?: string[];
  depth: ResearchDepth;
  created_at: string;
}

export interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}
