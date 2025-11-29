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
            Loan Hub is already installed on your device. You can access it from your home screen.
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
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-500 to-teal-500 pt-12 pb-20 px-4">
        <div className="max-w-md mx-auto text-center text-white">
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <img 
              src="/pwa-192x192.png" 
              alt="Loan Hub" 
              className="w-20 h-20 rounded-2xl shadow-lg mx-auto mb-4"
            />
          </motion.div>
          <motion.h1
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-2xl font-bold mb-2"
          >
            Install Loan Hub
          </motion.h1>
          <motion.p
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-white/80"
          >
            Add to your home screen for the best experience
          </motion.p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-md mx-auto px-4 -mt-10">
        {/* Features Card */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="bg-card border border-border rounded-2xl shadow-xl p-6 mb-6"
        >
          <h2 className="font-semibold text-foreground mb-4">Why install?</h2>
          <div className="grid grid-cols-2 gap-4">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 + index * 0.1 }}
                className="flex flex-col items-center text-center p-3 rounded-xl bg-muted/50"
              >
                <div className="w-10 h-10 bg-emerald-500/10 rounded-full flex items-center justify-center mb-2">
                  <feature.icon className="w-5 h-5 text-emerald-500" />
                </div>
                <span className="text-sm font-medium text-foreground">{feature.title}</span>
                <span className="text-xs text-muted-foreground">{feature.description}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Install Instructions */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="bg-card border border-border rounded-2xl shadow-xl p-6"
        >
          {deferredPrompt ? (
            <div className="space-y-4">
              <h2 className="font-semibold text-foreground">Ready to install</h2>
              <Button
                onClick={handleInstall}
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-medium h-12"
              >
                <Download className="w-5 h-5 mr-2" />
                Install App
              </Button>
            </div>
          ) : isIOS ? (
            <div className="space-y-4">
              <h2 className="font-semibold text-foreground">Install on iOS</h2>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-xl">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-primary">1</span>
                  </div>
                  <div>
                    <p className="text-sm text-foreground font-medium flex items-center gap-2">
                      Tap the Share button <Share className="w-4 h-4 text-blue-500" />
                    </p>
                    <p className="text-xs text-muted-foreground">At the bottom of Safari</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-xl">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-primary">2</span>
                  </div>
                  <div>
                    <p className="text-sm text-foreground font-medium flex items-center gap-2">
                      Tap "Add to Home Screen" <Plus className="w-4 h-4" />
                    </p>
                    <p className="text-xs text-muted-foreground">Scroll down in the menu</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-xl">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-primary">3</span>
                  </div>
                  <div>
                    <p className="text-sm text-foreground font-medium">Tap "Add"</p>
                    <p className="text-xs text-muted-foreground">In the top right corner</p>
                  </div>
                </div>
              </div>
            </div>
          ) : isAndroid ? (
            <div className="space-y-4">
              <h2 className="font-semibold text-foreground">Install on Android</h2>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-xl">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-primary">1</span>
                  </div>
                  <div>
                    <p className="text-sm text-foreground font-medium flex items-center gap-2">
                      Tap the menu button <MoreVertical className="w-4 h-4" />
                    </p>
                    <p className="text-xs text-muted-foreground">Three dots in top right</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-xl">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-primary">2</span>
                  </div>
                  <div>
                    <p className="text-sm text-foreground font-medium flex items-center gap-2">
                      Tap "Install app" or "Add to Home screen"
                    </p>
                    <p className="text-xs text-muted-foreground">In the menu options</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-xl">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-primary">3</span>
                  </div>
                  <div>
                    <p className="text-sm text-foreground font-medium">Confirm installation</p>
                    <p className="text-xs text-muted-foreground">Tap "Install" in the popup</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <h2 className="font-semibold text-foreground">Install from browser</h2>
              <p className="text-sm text-muted-foreground">
                Look for the install icon in your browser's address bar or menu to add this app to your device.
              </p>
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-border">
            <Button
              variant="ghost"
              onClick={() => navigate("/auth")}
              className="w-full text-muted-foreground"
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
