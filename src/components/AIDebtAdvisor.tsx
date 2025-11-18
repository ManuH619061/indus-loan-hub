import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Brain, Loader2, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface AIDebtAdvisorProps {
  loans: any[];
  monthlyIncome?: number;
  goals?: any[];
}

export default function AIDebtAdvisor({ loans, monthlyIncome, goals }: AIDebtAdvisorProps) {
  const { toast } = useToast();
  const [advice, setAdvice] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const getAIAdvice = async () => {
    if (loans.length === 0) {
      toast({
        title: "No loans found",
        description: "Add some loans first to get AI advice",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("debt-advisor", {
        body: {
          loans: loans.map(loan => ({
            loan_name: loan.loan_name,
            outstanding: loan.outstanding,
            interest_rate_apy: loan.interest_rate_apy,
            emi_amount: loan.emi_amount,
            rate_type: loan.rate_type,
          })),
          monthlyIncome,
          goals: goals?.map(g => ({
            goal_type: g.goal_type,
            notes: g.notes,
          })),
        },
      });

      if (error) throw error;

      if (data.error) {
        toast({
          title: "Error",
          description: data.error,
          variant: "destructive",
        });
        return;
      }

      setAdvice(data.advice);
    } catch (error: any) {
      console.error("Error getting AI advice:", error);
      toast({
        title: "Failed to get AI advice",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-background">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-6 w-6 text-primary" />
          AI Debt Advisor
        </CardTitle>
        <CardDescription>
          Get personalized debt payoff strategies powered by AI
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!advice && (
          <div className="text-center py-8">
            <Sparkles className="h-12 w-12 mx-auto text-primary mb-4" />
            <p className="text-muted-foreground mb-4">
              Get AI-powered recommendations on:
            </p>
            <ul className="text-sm text-muted-foreground space-y-2 mb-6">
              <li>✓ Which loans to prioritize</li>
              <li>✓ Optimal monthly payment plan</li>
              <li>✓ Timeline to become debt-free</li>
              <li>✓ Avalanche vs Snowball strategy</li>
              <li>✓ Budget optimization tips</li>
            </ul>
            <Button
              onClick={getAIAdvice}
              disabled={loading}
              size="lg"
              className="gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing your debt...
                </>
              ) : (
                <>
                  <Brain className="h-4 w-4" />
                  Get AI Advice
                </>
              )}
            </Button>
          </div>
        )}

        {advice && (
          <div className="space-y-4">
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown
                components={{
                  h1: ({ children }) => <h1 className="text-2xl font-bold mb-4">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-xl font-semibold mb-3 mt-6">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-lg font-semibold mb-2 mt-4">{children}</h3>,
                  ul: ({ children }) => <ul className="list-disc pl-5 space-y-2 mb-4">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal pl-5 space-y-2 mb-4">{children}</ol>,
                  li: ({ children }) => <li className="text-foreground">{children}</li>,
                  p: ({ children }) => <p className="mb-4 text-foreground">{children}</p>,
                  strong: ({ children }) => <strong className="font-semibold text-primary">{children}</strong>,
                }}
              >
                {advice}
              </ReactMarkdown>
            </div>
            <div className="flex gap-2">
              <Button onClick={getAIAdvice} disabled={loading} variant="outline" className="gap-2">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Refreshing...
                  </>
                ) : (
                  <>
                    <Brain className="h-4 w-4" />
                    Get New Advice
                  </>
                )}
              </Button>
              <Button onClick={() => setAdvice("")} variant="ghost">
                Clear
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
