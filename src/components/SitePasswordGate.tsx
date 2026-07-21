import React, { useState, useEffect } from 'react';
import { Lock, Unlock, Eye, EyeOff, AlertCircle, KeyRound, CornerDownLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SitePasswordGateProps {
  onUnlock: () => void;
}

export function SitePasswordGate({ onUnlock }: SitePasswordGateProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const CORRECT_PASSWORD = '2133481';

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    if (password === CORRECT_PASSWORD) {
      setIsSuccess(true);
      setTimeout(() => {
        localStorage.setItem('site_unlocked', 'true');
        onUnlock();
      }, 800);
    } else {
      setIsShaking(true);
      setError('Incorrect password. Please try again.');
      setPassword('');
      setTimeout(() => setIsShaking(false), 500);
    }
  };

  const handleKeyPress = (num: string) => {
    setError(null);
    if (password.length < 16) {
      setPassword(prev => prev + num);
    }
  };

  const handleBackspace = () => {
    setError(null);
    setPassword(prev => prev.slice(0, -1));
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-[#050505] flex flex-col justify-center items-center p-4 sm:p-6 select-none overflow-y-auto">
      {/* Decorative Glow Effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-72 h-72 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-64 h-64 bg-amber-500/2 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-sm flex flex-col items-center text-center space-y-8 relative z-10 my-auto">
        
        {/* Animated Lock/Unlock Icon Header */}
        <div className="relative">
          <motion.div 
            animate={isSuccess ? { scale: [1, 1.1, 0.9, 1], rotate: [0, 5, -5, 0] } : {}}
            transition={{ duration: 0.5 }}
            className={`w-20 h-20 rounded-2xl flex items-center justify-center border transition-all duration-300 ${
              isSuccess 
                ? 'bg-emerald-500/10 border-emerald-500/30 shadow-lg shadow-emerald-500/10 text-emerald-400' 
                : 'bg-amber-500/10 border-amber-500/20 shadow-lg shadow-amber-500/5 text-amber-500'
            }`}
          >
            {isSuccess ? (
              <Unlock className="w-9 h-9" />
            ) : (
              <Lock className="w-9 h-9 animate-pulse" />
            )}
          </motion.div>
        </div>

        {/* Text Header */}
        <div className="space-y-2">
          <h2 className="font-display font-black text-2xl text-[#F5F5F5] tracking-tight">
            Enter Password
          </h2>
          <p className="text-xs text-zinc-400 font-medium max-w-xs leading-normal mx-auto">
            This private space requires a password to grant access to the movies and TV shows tracker.
          </p>
        </div>

        {/* Password Input Form */}
        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <motion.div 
            animate={isShaking ? { x: [-10, 10, -10, 10, -5, 5, 0] } : {}}
            transition={{ duration: 0.4 }}
            className="relative"
          >
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setError(null);
                setPassword(e.target.value.replace(/\D/g, '')); // Allow only numbers as passcode is digits
              }}
              placeholder="Enter numerical password"
              className={`w-full bg-zinc-900/60 border rounded-xl px-4 py-3.5 pr-24 text-center font-mono text-lg text-white placeholder:text-zinc-600 focus:outline-none transition-all ${
                error 
                  ? 'border-red-500/50 focus:border-red-500' 
                  : isSuccess 
                  ? 'border-emerald-500/50 text-emerald-400' 
                  : 'border-white/10 focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/25'
              }`}
              maxLength={12}
              autoFocus
            />

            {/* Visibility Toggle & Quick Submit buttons */}
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="p-1.5 text-zinc-500 hover:text-zinc-300 rounded-lg hover:bg-white/5 transition-all cursor-pointer"
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>

              <button
                type="submit"
                disabled={!password}
                className={`p-1.5 rounded-lg border transition-all cursor-pointer flex items-center justify-center ${
                  password 
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-500 hover:bg-amber-500 hover:text-black' 
                    : 'bg-zinc-800/20 border-white/5 text-zinc-600 cursor-not-allowed'
                }`}
              >
                <CornerDownLeft className="w-4 h-4" />
              </button>
            </div>
          </motion.div>

          {/* Error Message */}
          <div className="h-5 text-center flex items-center justify-center gap-1.5">
            <AnimatePresence mode="wait">
              {error && (
                <motion.p 
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="text-xs font-semibold text-red-500 flex items-center gap-1 justify-center"
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{error}</span>
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </form>

        {/* Numerical Onscreen Keypad */}
        <div className="grid grid-cols-3 gap-y-3.5 gap-x-5 w-full max-w-[280px] mx-auto pt-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleKeyPress(num)}
              className="w-16 h-16 rounded-full bg-zinc-900/40 hover:bg-zinc-850 active:scale-95 text-xl font-bold font-display text-zinc-100 flex items-center justify-center border border-white/5 transition-all shadow-sm cursor-pointer select-none"
            >
              {num}
            </button>
          ))}
          
          <button
            type="button"
            onClick={() => setPassword('')}
            className="w-16 h-16 rounded-full hover:bg-white/5 text-xs font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-300 flex items-center justify-center transition-all cursor-pointer"
          >
            Clear
          </button>

          <button
            type="button"
            onClick={() => handleKeyPress('0')}
            className="w-16 h-16 rounded-full bg-zinc-900/40 hover:bg-zinc-850 active:scale-95 text-xl font-bold font-display text-zinc-100 flex items-center justify-center border border-white/5 transition-all shadow-sm cursor-pointer select-none"
          >
            0
          </button>

          <button
            type="button"
            onClick={handleBackspace}
            className="w-16 h-16 rounded-full hover:bg-white/5 text-zinc-500 hover:text-zinc-300 flex items-center justify-center transition-all cursor-pointer"
            title="Delete last digit"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
              <line x1="18" y1="9" x2="12" y2="15" />
              <line x1="12" y1="9" x2="18" y2="15" />
            </svg>
          </button>
        </div>

        {/* Subtle Footer Information */}
        <p className="text-[10px] text-zinc-600 font-semibold max-w-[220px] leading-relaxed select-none pt-4 flex items-center gap-1 justify-center">
          <KeyRound className="w-3 h-3 text-zinc-700" />
          <span>Locked Area • 7-Digit Key Required</span>
        </p>

      </div>
    </div>
  );
}
