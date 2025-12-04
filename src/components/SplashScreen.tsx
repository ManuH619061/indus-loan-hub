import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import finpathLogo from "@/assets/finpath-logo.png";

interface SplashScreenProps {
  onComplete: () => void;
  minDuration?: number;
}

export function SplashScreen({ onComplete, minDuration = 1500 }: SplashScreenProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Check system preference
    const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
    setIsDark(darkQuery.matches || document.documentElement.classList.contains("dark"));

    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    darkQuery.addEventListener("change", handler);
    return () => darkQuery.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onComplete, 500);
    }, minDuration);

    return () => clearTimeout(timer);
  }, [minDuration, onComplete]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className={`fixed inset-0 z-[100] flex flex-col items-center justify-center ${
            isDark 
              ? "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" 
              : "bg-gradient-to-br from-slate-50 via-white to-slate-100"
          }`}
        >
          {/* Animated background elements */}
          <div className="absolute inset-0 overflow-hidden">
            <motion.div
              className={`absolute -top-40 -right-40 h-80 w-80 rounded-full blur-3xl ${
                isDark ? "bg-amber-500/10" : "bg-amber-400/20"
              }`}
              animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
              transition={{ duration: 3, repeat: Infinity }}
            />
            <motion.div
              className={`absolute -bottom-40 -left-40 h-80 w-80 rounded-full blur-3xl ${
                isDark ? "bg-blue-500/10" : "bg-blue-400/20"
              }`}
              animate={{ scale: [1.2, 1, 1.2], opacity: [0.5, 0.3, 0.5] }}
              transition={{ duration: 3, repeat: Infinity }}
            />
          </div>

          {/* Logo */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="relative"
          >
            <motion.div
              className={`absolute inset-0 rounded-3xl blur-xl ${
                isDark ? "bg-amber-400/20" : "bg-amber-500/30"
              }`}
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <img
              src={finpathLogo}
              alt="FinPath"
              className="relative h-28 w-28 rounded-2xl shadow-2xl"
            />
          </motion.div>

          {/* App name */}
          <motion.h1
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className={`mt-6 text-3xl font-bold ${isDark ? "text-white" : "text-slate-900"}`}
          >
            FinPath
          </motion.h1>

          {/* Tagline */}
          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className={`mt-2 text-sm ${isDark ? "text-slate-400" : "text-slate-600"}`}
          >
            Your financial journey, simplified
          </motion.p>

          {/* Loading indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="mt-8 flex items-center gap-1"
          >
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className={`h-2 w-2 rounded-full ${isDark ? "bg-amber-400" : "bg-amber-500"}`}
                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                transition={{
                  duration: 0.8,
                  repeat: Infinity,
                  delay: i * 0.2,
                }}
              />
            ))}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
