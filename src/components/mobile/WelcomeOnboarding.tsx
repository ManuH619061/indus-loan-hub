import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { 
  Wallet, TrendingUp, Sparkles, ChevronRight, 
  Check, PiggyBank, BarChart3, Shield 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import finpathLogo from "@/assets/finpath-logo.png";

interface WelcomeOnboardingProps {
  onComplete: () => void;
}

const SLIDES = [
  {
    id: "welcome",
    icon: null,
    useLogo: true,
    title: "Welcome to FinPath",
    subtitle: "Your personal finance companion",
    description: "Take control of your loans, expenses, and financial future with AI-powered insights.",
    gradient: "from-primary/20 to-primary/5",
    features: [
      { icon: Shield, text: "Secure & Private" },
      { icon: Sparkles, text: "AI-Powered" },
      { icon: PiggyBank, text: "Save More" },
    ],
  },
  {
    id: "loans",
    icon: Wallet,
    title: "Track Your Loans",
    subtitle: "Every EMI, every payment",
    description: "Add all your loans in one place. Get complete visibility on EMIs, interest, and payoff timelines.",
    gradient: "from-blue-500/20 to-blue-500/5",
    features: [
      { icon: Check, text: "Multiple lenders" },
      { icon: Check, text: "EMI calendar" },
      { icon: Check, text: "Payment history" },
    ],
  },
  {
    id: "budget",
    icon: TrendingUp,
    title: "Plan Your Budget",
    subtitle: "Spend smarter, save more",
    description: "Set budgets, track expenses, and get alerts when you're overspending in any category.",
    gradient: "from-emerald-500/20 to-emerald-500/5",
    features: [
      { icon: Check, text: "Expense tracking" },
      { icon: Check, text: "Budget limits" },
      { icon: Check, text: "Smart categories" },
    ],
  },
  {
    id: "insights",
    icon: BarChart3,
    title: "Smart Insights",
    subtitle: "AI-powered recommendations",
    description: "Get personalized advice on debt payoff strategies, savings opportunities, and financial health.",
    gradient: "from-amber-500/20 to-amber-500/5",
    features: [
      { icon: Check, text: "Debt optimizer" },
      { icon: Check, text: "Cash flow forecast" },
      { icon: Check, text: "AI advisor chat" },
    ],
  },
];

export function WelcomeOnboarding({ onComplete }: WelcomeOnboardingProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const navigate = useNavigate();

  const handleNext = () => {
    if (currentSlide < SLIDES.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = () => {
    localStorage.setItem("finpath-onboarding-complete", "true");
    onComplete();
  };

  const handleSkip = () => {
    localStorage.setItem("finpath-onboarding-complete", "true");
    onComplete();
  };

  const slide = SLIDES[currentSlide];
  const Icon = slide.icon;
  const isLastSlide = currentSlide === SLIDES.length - 1;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-background flex flex-col"
    >
      {/* Skip Button */}
      <div className="flex justify-end p-4 safe-top">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSkip}
          className="text-muted-foreground"
        >
          Skip
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={slide.id}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center text-center max-w-sm"
          >
            {/* Icon/Logo */}
            <div className={cn(
              "w-32 h-32 rounded-3xl flex items-center justify-center mb-8 bg-gradient-to-br",
              slide.gradient
            )}>
              {slide.useLogo ? (
                <img src={finpathLogo} alt="FinPath" className="w-20 h-20 rounded-2xl" />
              ) : Icon ? (
                <Icon className="w-16 h-16 text-foreground/80" />
              ) : null}
            </div>

            {/* Title */}
            <h1 className="text-3xl font-bold mb-2">{slide.title}</h1>
            <p className="text-lg text-primary font-medium mb-4">{slide.subtitle}</p>
            <p className="text-muted-foreground text-sm leading-relaxed mb-8">
              {slide.description}
            </p>

            {/* Features */}
            <div className="flex flex-wrap justify-center gap-3">
              {slide.features.map((feature, index) => {
                const FeatureIcon = feature.icon;
                return (
                  <div
                    key={index}
                    className="flex items-center gap-2 px-3 py-2 rounded-full bg-muted/50 text-sm"
                  >
                    <FeatureIcon className="h-4 w-4 text-primary" />
                    <span>{feature.text}</span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom Navigation */}
      <div className="p-6 safe-bottom space-y-4">
        {/* Dots */}
        <div className="flex justify-center gap-2">
          {SLIDES.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={cn(
                "w-2 h-2 rounded-full transition-all duration-300",
                index === currentSlide 
                  ? "w-8 bg-primary" 
                  : "bg-muted-foreground/30"
              )}
            />
          ))}
        </div>

        {/* Action Button */}
        <Button
          onClick={handleNext}
          className="w-full h-14 text-base font-semibold rounded-2xl bg-gradient-to-r from-primary to-primary/80"
        >
          {isLastSlide ? (
            <>
              Get Started
              <Sparkles className="ml-2 h-5 w-5" />
            </>
          ) : (
            <>
              Continue
              <ChevronRight className="ml-2 h-5 w-5" />
            </>
          )}
        </Button>
      </div>
    </motion.div>
  );
}
