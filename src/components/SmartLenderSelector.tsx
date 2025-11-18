import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel, SelectSeparator } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Building2 } from "lucide-react";
import { loanAppsLibrary } from "@/lib/loan-apps-library";

interface SmartLenderSelectorProps {
  value: string;
  onChange: (value: string) => void;
  onAddCustom: () => void;
}

interface Lender {
  id: string;
  name: string;
  type: string;
  logo_url?: string;
}

export default function SmartLenderSelector({ value, onChange, onAddCustom }: SmartLenderSelectorProps) {
  const { user } = useAuth();
  const [myLenders, setMyLenders] = useState<Lender[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchMyLenders();
  }, [user]);

  const fetchMyLenders = async () => {
    try {
      // Fetch lenders with active loans
      const { data: loans } = await supabase
        .from("loans")
        .select("lender_id")
        .eq("user_id", user?.id)
        .eq("status", "ACTIVE");

      const lenderIds = [...new Set((loans || []).map((l) => l.lender_id).filter(Boolean))];

      if (lenderIds.length > 0) {
        const { data: lendersData } = await supabase
          .from("lenders")
          .select("*")
          .in("id", lenderIds);

        setMyLenders(lendersData || []);
      }

      // Also fetch all user's lenders
      const { data: allLenders } = await supabase
        .from("lenders")
        .select("*")
        .eq("user_id", user?.id)
        .order("name");

      // Merge and dedupe
      const allLendersList = allLenders || [];
      const combined = [...myLenders, ...allLendersList];
      const unique = Array.from(new Map(combined.map((l) => [l.id, l])).values());
      
      setMyLenders(unique);
    } catch (error) {
      console.error("Error fetching lenders:", error);
    } finally {
      setLoading(false);
    }
  };

  // Get popular loan apps (top 6)
  const popularApps = loanAppsLibrary.slice(0, 6);

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="flex-1">
        <SelectValue placeholder="Select or search lender" />
      </SelectTrigger>
      <SelectContent className="max-h-[400px]">
        {/* My Lenders Section */}
        {myLenders.length > 0 && (
          <>
            <SelectGroup>
              <SelectLabel className="text-xs font-semibold text-primary">MY LENDERS</SelectLabel>
              {myLenders.map((lender) => (
                <SelectItem key={lender.id} value={lender.id}>
                  <div className="flex items-center gap-2">
                    {lender.logo_url ? (
                      <img src={lender.logo_url} alt="" className="h-4 w-4 rounded object-contain" />
                    ) : (
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span>{lender.name}</span>
                    <span className="text-xs text-muted-foreground">({lender.type})</span>
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
            <SelectSeparator />
          </>
        )}

        {/* Popular Loan Apps Section */}
        <SelectGroup>
          <SelectLabel className="text-xs font-semibold text-success">POPULAR LOAN APPS</SelectLabel>
          {popularApps.map((app) => (
            <SelectItem key={`lib-${app.id}`} value={`library:${app.id}`}>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span>{app.name}</span>
                <span className="text-xs text-muted-foreground">({app.category})</span>
              </div>
            </SelectItem>
          ))}
        </SelectGroup>

        <SelectSeparator />

        {/* Add Custom Lender Option */}
        <SelectItem value="__add_custom__" onSelect={(e) => { e.preventDefault(); onAddCustom(); }}>
          <div className="flex items-center gap-2 text-primary font-medium">
            <Building2 className="h-4 w-4" />
            <span>+ Add Custom Lender...</span>
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
