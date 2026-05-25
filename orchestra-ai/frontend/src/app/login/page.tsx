"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import { Sparkles, Mail, Lock, ArrowRight, ShieldCheck } from "lucide-react";
import { AuthError } from "@supabase/supabase-js";

export default function Login() {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [isLogin, setIsLogin] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const router = useRouter();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert("Verification link sent! Check your email protocol.");
      }
      router.push("/");
    } catch (err) {
      const authErr = err as AuthError;
      setError(authErr.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 font-sans overflow-hidden relative"
      style={{ backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
    >
      
      {/* Background Orbs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/10 rounded-full blur-[120px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <div 
          className="border rounded-[2.5rem] p-10 shadow-2xl"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-main)' }}
        >
          <div className="flex flex-col items-center mb-10">
            <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-6 shadow-2xl" style={{ backgroundColor: 'var(--bg-btn)', color: 'var(--text-btn)' }}>
               <Sparkles size={32} />
            </div>
            <h1 
              className="text-3xl font-black tracking-tight"
              style={{ color: 'var(--text-main)' }}
            >
              Orchestra AI
            </h1>
            <p 
              className="text-sm mt-2 font-medium opacity-40"
            >
              Neural Research Suite v2.0
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-6">
            <div className="space-y-2">
              <label 
                className="text-[10px] font-black uppercase tracking-[0.2em] ml-1 opacity-40"
              >
                Email Protocol
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 opacity-40" size={18} />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full border rounded-2xl py-4 pl-12 pr-4 outline-none transition-all placeholder:opacity-50"
                  style={{ 
                    backgroundColor: 'var(--bg-app)', 
                    borderColor: 'var(--border-main)',
                    color: 'var(--text-main)'
                  }}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label 
                className="text-[10px] font-black uppercase tracking-[0.2em] ml-1 opacity-40"
              >
                Access Cipher
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 opacity-40" size={18} />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full border rounded-2xl py-4 pl-12 pr-4 outline-none transition-all placeholder:opacity-50"
                  style={{ 
                    backgroundColor: 'var(--bg-app)', 
                    borderColor: 'var(--border-main)',
                    color: 'var(--text-main)'
                  }}
                  required
                />
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-xs text-red-400 bg-red-400/10 p-3 rounded-xl border border-red-400/20 text-center"
              >
                {error}
              </motion.div>
            )}

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-2xl font-black uppercase tracking-[0.2em] shadow-2xl shadow-blue-500/20 flex items-center justify-center gap-3 transition-all"
              style={{ backgroundColor: 'var(--bg-btn)', color: 'var(--text-btn)' }}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  {isLogin ? "Authenticate" : "Initialize Account"}
                  <ArrowRight size={18} />
                </>
              )}
            </motion.button>

            <div className="relative flex items-center gap-4 my-6">
               <div className="flex-1 h-[1px]" style={{ backgroundColor: 'var(--border-main)' }} />
               <span className="text-[10px] font-black opacity-40 uppercase tracking-widest">or Secure OAuth</span>
               <div className="flex-1 h-[1px]" style={{ backgroundColor: 'var(--border-main)' }} />
            </div>

            <button 
              type="button"
              onClick={handleGoogleLogin}
              className="w-full font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-3 group border"
              style={{ backgroundColor: 'var(--bg-app)', borderColor: 'var(--border-main)', color: 'var(--text-main)' }}
            >
              <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
              Continue with Google
            </button>
          </form>

          <div className="mt-8 pt-8 border-t flex flex-col items-center gap-4" style={{ borderColor: 'var(--border-main)' }}>
            <p className="opacity-60 text-sm">
              {isLogin ? "No access key?" : "Already indexed?"}
              <button 
                onClick={() => setIsLogin(!isLogin)}
                className="font-bold ml-2 hover:underline underline-offset-4"
                style={{ color: 'var(--text-main)' }}
              >
                {isLogin ? "Create Profile" : "Login Protocol"}
              </button>
            </p>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest opacity-40">
              <ShieldCheck size={12} /> Cloud Secure Auth
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
