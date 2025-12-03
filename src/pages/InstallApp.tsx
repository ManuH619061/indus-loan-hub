import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Download, 
  Smartphone, 
  Share, 
  MoreVertical, 
  Plus, 
  CheckCircle2,
  Wifi,
  Bell,
  Zap,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const InstallApp = () => {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);

  useEffect(() => {
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    setIsInstalled(isStandalone);

    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isAndroidDevice = /Android/.test(navigator.userAgent);
    setIsIOS(isIOSDevice);
    setIsAndroid(isAndroidDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === "accepted") {
      setInstallSuccess(true);
      setTimeout(() => navigate("/dashboard"), 2000);
    }
    
    setDeferredPrompt(null);
  };

  const features = [
    { icon: Zap, title: "Quick Access", description: "Launch instantly from home screen" },
    { icon: Wifi, title: "Works Offline", description: "Access your data without internet" },
    { icon: Bell, title: "Notifications", description: "Get payment reminders" },
    { icon: Smartphone, title: "Native Feel", description: "Full screen app experience" },
  ];

  // Home screen preview component
  const HomeScreenPreview = () => (
    <div className="relative bg-gradient-to-b from-primary/5 to-background rounded-2xl p-8 border border-border/50">
      <div className="text-center mb-6">
        <h3 className="text-sm font-semibold text-foreground mb-1">Preview on Home Screen</h3>
        <p className="text-xs text-muted-foreground">This is how it will appear on your device</p>
      </div>
      
      {/* Mock home screen with app icon */}
      <div className="max-w-[280px] mx-auto">
        <div className="bg-gradient-to-br from-muted/30 to-muted/60 rounded-3xl p-6 shadow-inner border border-border/30">
          {/* Time and status bar */}
          <div className="flex justify-between items-center mb-8 text-xs text-muted-foreground">
            <span>9:41</span>
            <div className="flex gap-1">
              <div className="w-4 h-3 bg-muted-foreground/40 rounded-sm"></div>
              <div className="w-2 h-3 bg-muted-foreground/60 rounded-sm"></div>
              <div className="w-2 h-3 bg-muted-foreground/80 rounded-sm"></div>
            </div>
          </div>
          
          {/* App icons grid */}
          <div className="grid grid-cols-4 gap-4">
            {/* Dummy icons */}
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex flex-col items-center gap-1 opacity-40">
                <div className="w-14 h-14 bg-muted-foreground/20 rounded-2xl"></div>
                <div className="w-10 h-2 bg-muted-foreground/20 rounded"></div>
              </div>
            ))}
            
            {/* Highlighted app icon */}
            <motion.div 
              className="flex flex-col items-center gap-1 col-span-1"
              animate={{ 
                scale: [1, 1.05, 1],
              }}
              transition={{ 
                duration: 2, 
                repeat: Infinity,
                repeatDelay: 1
              }}
            >
                <div className="relative">
                <div className="w-14 h-14 bg-gradient-to-br from-primary to-primary/80 rounded-2xl shadow-lg flex items-center justify-center border-2 border-primary/20 overflow-hidden">
                  <img 
                    src="/pwa-192x192.png" 
                    alt="FinPath Tracker" 
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center animate-pulse">
                  <CheckCircle2 className="w-3 h-3 text-white" />
                </div>
              </div>
              <div className="text-[10px] font-medium text-foreground text-center leading-tight">
                FinPath
              </div>
            </motion.div>
            
            {/* More dummy icons */}
            {[1, 2, 3].map((i) => (
              <div key={`b-${i}`} className="flex flex-col items-center gap-1 opacity-40">
                <div className="w-14 h-14 bg-muted-foreground/20 rounded-2xl"></div>
                <div className="w-10 h-2 bg-muted-foreground/20 rounded"></div>
              </div>
            ))}
          </div>
          
          {/* Dock */}
          <div className="mt-8 pt-6 border-t border-border/30">
            <div className="flex justify-center gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={`dock-${i}`} className="w-14 h-14 bg-muted-foreground/20 rounded-2xl opacity-40"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-4 text-center text-xs text-muted-foreground">
        Tap the icon to launch the app full-screen
      </div>
    </div>
  );

  if (isInstalled) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center max-w-md"
        >
          <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Already Installed!</h1>
          <p className="text-muted-foreground mb-6">
            FinPath Tracker is already installed on your device. You can access it from your home screen.
          </p>
          <Button onClick={() => navigate("/dashboard")} className="gap-2">
            Go to Dashboard <ArrowRight className="w-4 h-4" />
          </Button>
        </motion.div>
      </div>
    );
  }

  if (installSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center max-w-md"
        >
          <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Installation Complete!</h1>
          <p className="text-muted-foreground">
            Redirecting to your dashboard...
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20 overflow-x-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary via-primary to-primary/90 pt-16 pb-24 px-4 safe-top">
        <div className="max-w-lg mx-auto text-center text-primary-foreground">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, type: "spring" }}
            className="mb-6"
          >
            <div className="w-24 h-24 bg-white/20 backdrop-blur-sm rounded-3xl shadow-2xl mx-auto p-4 border border-white/20">
              <img 
                src="/pwa-192x192.png" 
                alt="FinPath Tracker" 
                className="w-full h-full object-contain rounded-2xl"
              />
            </div>
          </motion.div>
          <motion.h1
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-3xl font-bold mb-3"
          >
            Install FinPath Tracker
          </motion.h1>
          <motion.p
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-primary-foreground/90 text-base"
          >
            Get the full app experience on your device
          </motion.p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 -mt-16 pb-8 relative z-10">
        {/* Home Screen Preview */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mb-5"
        >
          <HomeScreenPreview />
        </motion.div>

        {/* Features Card */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="bg-card border border-border rounded-2xl shadow-xl p-5 md:p-6 mb-5"
        >
          <h2 className="font-semibold text-foreground mb-4 text-base">Why install?</h2>
          <div className="grid grid-cols-2 gap-3 md:gap-4">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.7 + index * 0.1 }}
                className="flex flex-col items-center text-center p-4 rounded-xl bg-muted/50 hover:bg-muted/70 transition-colors"
              >
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-3">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <span className="text-sm font-medium text-foreground mb-1">{feature.title}</span>
                <span className="text-xs text-muted-foreground leading-tight">{feature.description}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Install Instructions */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 1.0 }}
          className="bg-card border border-border rounded-2xl shadow-xl p-5 md:p-6"
        >
          {deferredPrompt ? (
            <div className="space-y-4">
              <h2 className="font-semibold text-foreground text-base">Ready to install</h2>
              <Button
                onClick={handleInstall}
                className="w-full bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground font-medium h-12 text-base touch-target"
                size="lg"
              >
                <Download className="w-5 h-5 mr-2" />
                Install App Now
              </Button>
            </div>
          ) : isIOS ? (
            <div className="space-y-4">
              <h2 className="font-semibold text-foreground text-base mb-3">Install on iOS</h2>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-xl border border-border/50">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-primary">1</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-foreground font-medium flex items-center gap-2 mb-1">
                      Tap the Share button <Share className="w-4 h-4 text-blue-500" />
                    </p>
                    <p className="text-xs text-muted-foreground">Located at the bottom of Safari</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-xl border border-border/50">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-primary">2</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-foreground font-medium flex items-center gap-2 mb-1">
                      Tap "Add to Home Screen" <Plus className="w-4 h-4 text-primary" />
                    </p>
                    <p className="text-xs text-muted-foreground">Scroll down to find this option</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-xl border border-border/50">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-primary">3</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-foreground font-medium mb-1">Tap "Add"</p>
                    <p className="text-xs text-muted-foreground">In the top right corner</p>
                  </div>
                </div>
              </div>
            </div>
          ) : isAndroid ? (
            <div className="space-y-4">
              <h2 className="font-semibold text-foreground text-base mb-3">Install on Android</h2>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-xl border border-border/50">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-primary">1</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-foreground font-medium flex items-center gap-2 mb-1">
                      Tap the menu button <MoreVertical className="w-4 h-4" />
                    </p>
                    <p className="text-xs text-muted-foreground">Three dots in top right corner</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-xl border border-border/50">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-primary">2</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-foreground font-medium mb-1">
                      Tap "Install app" or "Add to Home screen"
                    </p>
                    <p className="text-xs text-muted-foreground">Look for the install option</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-xl border border-border/50">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-primary">3</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-foreground font-medium mb-1">Confirm installation</p>
                    <p className="text-xs text-muted-foreground">Tap "Install" in the popup</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <h2 className="font-semibold text-foreground text-base">Install from browser</h2>
              <p className="text-sm text-muted-foreground">
                Look for the install icon in your browser's address bar or menu to add this app to your device.
              </p>
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-border">
            <Button
              variant="ghost"
              onClick={() => navigate("/dashboard")}
              className="w-full text-muted-foreground h-11 touch-target"
            >
              Continue in browser instead
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default InstallApp;
