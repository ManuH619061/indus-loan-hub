import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, Smartphone, Share, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export const PWAInstallPrompt = () => {
  const { user } = useAuth();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [hasShownOnce, setHasShownOnce] = useState(false);

  useEffect(() => {
    // Check if already installed
    const isStandaloneMode = window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(isStandaloneMode);

    // Check if iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    // Check if already shown in this session
    const shownInSession = sessionStorage.getItem("pwa-prompt-shown-session");
    if (shownInSession) {
      setHasShownOnce(true);
      return;
    }

    // Check if dismissed recently (within 7 days)
    const dismissedAt = localStorage.getItem("pwa-prompt-dismissed");
    if (dismissedAt) {
      const dismissedTime = parseInt(dismissedAt, 10);
      const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 7) {
        return;
      }
    }

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  // Show prompt after user logs in (only once per session)
  useEffect(() => {
    if (user && !isStandalone && !hasShownOnce && (deferredPrompt || isIOS)) {
      const timer = setTimeout(() => {
        setShowPrompt(true);
        setHasShownOnce(true);
        sessionStorage.setItem("pwa-prompt-shown-session", "true");
      }, 3000); // 3 seconds after login

      return () => clearTimeout(timer);
    }
  }, [user, isStandalone, hasShownOnce, deferredPrompt, isIOS]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === "accepted") {
      setShowPrompt(false);
      localStorage.setItem("pwa-installed", "true");
    }
    
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem("pwa-prompt-dismissed", Date.now().toString());
  };

  // Don't render if already installed or not logged in
  if (isStandalone || !user) return null;

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed bottom-4 left-4 right-4 z-[100] md:left-auto md:right-4 md:max-w-md safe-bottom"
        >
          <div className="bg-card border-2 border-primary/20 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-sm">
            {/* Header with gradient */}
            <div className="bg-gradient-to-r from-primary to-primary/80 p-4 text-primary-foreground">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Install Loan Hub</h3>
                    <p className="text-primary-foreground/90 text-sm">Add to your home screen</p>
                  </div>
                </div>
                <button
                  onClick={handleDismiss}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-colors touch-target"
                  aria-label="Dismiss"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              <div className="space-y-2.5">
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Check className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-foreground">Quick access from home screen</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Check className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-foreground">Works offline - manage loans anytime</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Check className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-foreground">Full screen experience like a native app</span>
                </div>
              </div>

              {isIOS ? (
                <div className="bg-muted/50 rounded-xl p-4 space-y-2 border border-border">
                  <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Smartphone className="w-4 h-4" />
                    To install on iOS:
                  </p>
                  <div className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <Share className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <p>1. Tap the <strong>Share</strong> button (at the bottom)</p>
                      <p className="mt-1">2. Scroll and tap <strong>"Add to Home Screen"</strong></p>
                      <p className="mt-1">3. Tap <strong>"Add"</strong> to install</p>
                    </div>
                  </div>
                </div>
              ) : (
                <Button
                  onClick={handleInstall}
                  className="w-full bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground font-medium h-12 touch-target"
                  size="lg"
                >
                  <Download className="w-5 h-5 mr-2" />
                  Install App Now
                </Button>
              )}

              <button
                onClick={handleDismiss}
                className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors py-2 touch-target"
              >
                Maybe later
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
