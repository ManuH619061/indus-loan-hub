import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface OnboardingStatus {
  isLoading: boolean;
  isNewUser: boolean;
  hasLenders: boolean;
  hasLoans: boolean;
  hasBankAccounts: boolean;
  lenderCount: number;
  loanCount: number;
}

export function useOnboardingStatus() {
  const { user } = useAuth();
  const [status, setStatus] = useState<OnboardingStatus>({
    isLoading: true,
    isNewUser: false,
    hasLenders: false,
    hasLoans: false,
    hasBankAccounts: false,
    lenderCount: 0,
    loanCount: 0,
  });

  useEffect(() => {
    if (user) {
      checkOnboardingStatus();
    }
  }, [user]);

  const checkOnboardingStatus = async () => {
    if (!user) return;

    try {
      // Check lenders count
      const { count: lenderCount } = await supabase
        .from("lenders")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      // Check loans count
      const { count: loanCount } = await supabase
        .from("loans")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      // Check bank accounts count
      const { count: bankCount } = await supabase
        .from("bank_accounts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      const hasLenders = (lenderCount || 0) > 0;
      const hasLoans = (loanCount || 0) > 0;
      const hasBankAccounts = (bankCount || 0) > 0;
      const isNewUser = !hasLenders && !hasLoans;

      setStatus({
        isLoading: false,
        isNewUser,
        hasLenders,
        hasLoans,
        hasBankAccounts,
        lenderCount: lenderCount || 0,
        loanCount: loanCount || 0,
      });
    } catch (error) {
      console.error("Error checking onboarding status:", error);
      setStatus((prev) => ({ ...prev, isLoading: false }));
    }
  };

  const refreshStatus = () => {
    setStatus((prev) => ({ ...prev, isLoading: true }));
    checkOnboardingStatus();
  };

  return { ...status, refreshStatus };
}
