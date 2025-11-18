import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { formatINR, formatPercent } from "@/lib/currency";
import { Search, Building2, Plus } from "lucide-react";
import { loanAppsLibrary, getCategoryLabel, getCategoryColor, LoanAppLibraryItem } from "@/lib/loan-apps-library";

export default function AllLoanAppsTab() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [loading, setLoading] = useState<string | null>(null);

  const categories = ["ALL", "BANK", "NBFC", "INSTANT_LOAN", "CREDIT_CARD", "BNPL", "SALARY_ADVANCE"];

  const filteredApps = loanAppsLibrary.filter((app) => {
    const matchesSearch = app.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "ALL" || app.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const groupedApps = categories
    .filter((cat) => cat !== "ALL")
    .reduce((acc, category) => {
      const apps = filteredApps.filter((app) => app.category === category);
      if (apps.length > 0) {
        acc[category] = apps;
      }
      return acc;
    }, {} as Record<string, LoanAppLibraryItem[]>);

  const handleUseLender = async (app: LoanAppLibraryItem) => {
    if (!user) return;
    
    setLoading(app.id);
    try {
      // Check if lender already exists
      const { data: existingLender } = await supabase
        .from("lenders")
        .select("id")
        .eq("user_id", user.id)
        .eq("name", app.name)
        .maybeSingle();

      let lenderId: string;

      if (existingLender) {
        lenderId = existingLender.id;
        toast({ title: "Lender already added", description: "Redirecting to add loan..." });
      } else {
        // Create new lender
        const lenderType = 
          app.category === "INSTANT_LOAN" ? "OTHER" as const :
          app.category === "SALARY_ADVANCE" ? "OTHER" as const :
          app.category === "CREDIT_CARD" ? "CARD" as const :
          app.category as "BANK" | "NBFC" | "OTHER";

        const { data: newLender, error } = await supabase
          .from("lenders")
          .insert([{
            user_id: user.id,
            name: app.name,
            type: lenderType,
            logo_url: app.logo_url,
            website: app.website,
            app_link: app.app_link,
            upi_vpa: app.upi_vpa,
            notes: app.description,
          }] as any)
          .select("id")
          .single();

        if (error) throw error;
        lenderId = newLender.id;
        toast({ title: "Lender added to your list!" });
      }

      // Navigate to add loan with pre-selected lender
      navigate(`/loans/new?lender=${lenderId}`);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search loan apps..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Categories</SelectItem>
            {categories.filter((c) => c !== "ALL").map((cat) => (
              <SelectItem key={cat} value={cat}>
                {getCategoryLabel(cat)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Grouped Cards */}
      {Object.entries(groupedApps).map(([category, apps]) => (
        <div key={category} className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Badge variant="outline" className={getCategoryColor(category)}>
              {getCategoryLabel(category)}
            </Badge>
            <span className="text-sm text-muted-foreground">({apps.length})</span>
          </h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {apps.map((app) => (
              <Card key={app.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-3">
                    {app.logo_url ? (
                      <img src={app.logo_url} alt={app.name} className="h-10 w-10 rounded object-contain bg-muted p-1" />
                    ) : (
                      <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-6 w-6 text-primary" />
                      </div>
                    )}
                    <div className="flex-1">
                      <CardTitle className="text-base">{app.name}</CardTitle>
                      <Badge variant="outline" className={`mt-1 text-xs ${getCategoryColor(app.category)}`}>
                        {getCategoryLabel(app.category)}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Interest Rate</span>
                      <span className="font-medium">
                        {formatPercent(app.typical_interest_min)} - {formatPercent(app.typical_interest_max)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Loan Range</span>
                      <span className="font-medium text-xs">
                        {formatINR(app.min_loan_amount)} - {formatINR(app.max_loan_amount)}
                      </span>
                    </div>
                  </div>
                  {app.badges.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {app.badges.map((badge, idx) => (
                        <Badge 
                          key={idx} 
                          variant="secondary" 
                          className={`text-xs ${
                            badge.includes("High Interest") ? "bg-destructive/10 text-destructive" :
                            badge.includes("Low Interest") || badge.includes("Trusted") ? "bg-success/10 text-success" :
                            ""
                          }`}
                        >
                          {badge}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <Button 
                    className="w-full" 
                    size="sm"
                    onClick={() => handleUseLender(app)}
                    disabled={loading === app.id}
                  >
                    {loading === app.id ? (
                      "Adding..."
                    ) : (
                      <>
                        <Plus className="h-3 w-3 mr-1" />
                        Use this Lender
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {filteredApps.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No loan apps found matching your search.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
