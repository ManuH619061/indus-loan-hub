import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Send, Bot, User, Sparkles, Loader2, ExternalLink } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import { useIsMobile } from "@/hooks/use-mobile";
import { ChatChartRenderer, parseChartBlocks } from "@/components/ai/ChatChartRenderer";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const initialQuickQuestions = [
  "How much EMI do I need to pay next month?",
  "Which loan closes next and when?",
  "What's my highest expense category this month?",
  "Compare my expenses: this month vs last month",
  "If I prepay ₹5,000, which loan should I target?",
  "What's my total outstanding loan amount?",
  "What will be my cash flow for the next 3 months?",
  "Where am I overspending compared to my budget?",
];

const followUpQuestions: Record<string, string[]> = {
  emi: [
    "Show me next 3 months EMI breakdown",
    "Which loan has the highest EMI?",
    "How much total interest will I pay?",
  ],
  loan: [
    "Which loan has the highest interest rate?",
    "How much can I save by closing this loan early?",
    "What if I add ₹3,000 extra every month?",
  ],
  expense: [
    "Show me month-wise expense trend",
    "Which category increased the most?",
    "How much am I over budget?",
  ],
  cashflow: [
    "Show 6 months cash flow projection",
    "What's my savings potential?",
    "When will I be EMI-free?",
  ],
};

export default function AIChatAdvisor() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>(initialQuickQuestions.slice(0, 6));
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Update suggested questions based on conversation context
  useEffect(() => {
    if (messages.length === 0) {
      setSuggestedQuestions(initialQuickQuestions.slice(0, 6));
      return;
    }

    const lastUserMsg = [...messages].reverse().find(m => m.role === "user")?.content.toLowerCase() || "";
    
    if (lastUserMsg.includes("emi") || lastUserMsg.includes("payment")) {
      setSuggestedQuestions([...followUpQuestions.emi, ...initialQuickQuestions.slice(0, 3)]);
    } else if (lastUserMsg.includes("loan") || lastUserMsg.includes("close") || lastUserMsg.includes("prepay")) {
      setSuggestedQuestions([...followUpQuestions.loan, ...initialQuickQuestions.slice(0, 3)]);
    } else if (lastUserMsg.includes("expense") || lastUserMsg.includes("spending") || lastUserMsg.includes("category")) {
      setSuggestedQuestions([...followUpQuestions.expense, ...initialQuickQuestions.slice(0, 3)]);
    } else if (lastUserMsg.includes("cash") || lastUserMsg.includes("flow") || lastUserMsg.includes("savings")) {
      setSuggestedQuestions([...followUpQuestions.cashflow, ...initialQuickQuestions.slice(0, 3)]);
    } else {
      setSuggestedQuestions(initialQuickQuestions.slice(0, 6));
    }
  }, [messages]);

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: messageText.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    let assistantContent = "";

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Please sign in to use the AI advisor", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat-advisor`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            message: messageText.trim(),
            conversationHistory: messages.slice(-10),
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 429) {
          toast({ title: "Rate limit exceeded", description: "Please wait a moment and try again.", variant: "destructive" });
        } else if (response.status === 402) {
          toast({ title: "AI credits exhausted", description: "Please add credits to continue using AI features.", variant: "destructive" });
        } else {
          toast({ title: "Error", description: errorData.error || "Failed to get AI response", variant: "destructive" });
        }
        setIsLoading(false);
        return;
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      setMessages(prev => [...prev, { role: "assistant", content: "" }]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              setMessages(prev => {
                const updated = [...prev];
                if (updated.length > 0 && updated[updated.length - 1].role === "assistant") {
                  updated[updated.length - 1] = { role: "assistant", content: assistantContent };
                }
                return updated;
              });
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      if (buffer.trim()) {
        for (let raw of buffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (raw.startsWith(":") || raw.trim() === "") continue;
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              setMessages(prev => {
                const updated = [...prev];
                if (updated.length > 0 && updated[updated.length - 1].role === "assistant") {
                  updated[updated.length - 1] = { role: "assistant", content: assistantContent };
                }
                return updated;
              });
            }
          } catch { /* ignore */ }
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      toast({ title: "Error", description: "Failed to send message", variant: "destructive" });
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleQuickQuestion = (question: string) => {
    sendMessage(question);
  };

  const QuickLinks = () => (
    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border/50">
      <span className="text-xs text-muted-foreground mr-1">Quick links:</span>
      <Link to="/loans" className="text-xs text-primary hover:underline flex items-center gap-1">
        Loans <ExternalLink className="h-3 w-3" />
      </Link>
      <Link to="/emi-calendar" className="text-xs text-primary hover:underline flex items-center gap-1">
        EMI Calendar <ExternalLink className="h-3 w-3" />
      </Link>
      <Link to="/expenses" className="text-xs text-primary hover:underline flex items-center gap-1">
        Expenses <ExternalLink className="h-3 w-3" />
      </Link>
      <Link to="/budget" className="text-xs text-primary hover:underline flex items-center gap-1">
        Budget <ExternalLink className="h-3 w-3" />
      </Link>
      <Link to="/banking" className="text-xs text-primary hover:underline flex items-center gap-1">
        Banking <ExternalLink className="h-3 w-3" />
      </Link>
    </div>
  );

  const AssistantMessage = ({ content, showQuickLinks }: { content: string; showQuickLinks?: boolean }) => {
    const { text, charts } = parseChartBlocks(content);
    
    // Replace chart placeholders with actual charts
    const renderContent = () => {
      const parts = text.split(/\[CHART_(\d+)\]/g);
      const elements: React.ReactNode[] = [];
      
      for (let i = 0; i < parts.length; i++) {
        if (i % 2 === 0) {
          // Text part
          if (parts[i]) {
            elements.push(
              <ReactMarkdown
                key={`text-${i}`}
                components={{
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-3">
                      <table className="min-w-full text-sm border-collapse border border-border rounded-lg">
                        {children}
                      </table>
                    </div>
                  ),
                  thead: ({ children }) => (
                    <thead className="bg-muted/50">{children}</thead>
                  ),
                  th: ({ children }) => (
                    <th className="px-3 py-2 text-left font-medium border-b border-border">{children}</th>
                  ),
                  td: ({ children }) => (
                    <td className="px-3 py-2 border-b border-border/50">{children}</td>
                  ),
                  h1: ({ children }) => (
                    <h1 className="text-lg font-bold mt-4 mb-2 text-foreground">{children}</h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-base font-semibold mt-3 mb-2 text-foreground">{children}</h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-sm font-semibold mt-2 mb-1 text-foreground">{children}</h3>
                  ),
                  p: ({ children }) => (
                    <p className="my-2 text-sm leading-relaxed">{children}</p>
                  ),
                  ul: ({ children }) => (
                    <ul className="my-2 ml-4 list-disc space-y-1">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="my-2 ml-4 list-decimal space-y-1">{children}</ol>
                  ),
                  li: ({ children }) => (
                    <li className="text-sm">{children}</li>
                  ),
                  strong: ({ children }) => (
                    <strong className="font-semibold text-foreground">{children}</strong>
                  ),
                  code: ({ children, className }) => {
                    // Don't render chart code blocks
                    if (className?.includes('language-chart')) return null;
                    return (
                      <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>
                    );
                  },
                  pre: ({ children }) => {
                    // Skip pre blocks that contain chart data
                    return <>{children}</>;
                  },
                }}
              >
                {parts[i]}
              </ReactMarkdown>
            );
          }
        } else {
          // Chart index
          const chartIndex = parseInt(parts[i], 10);
          if (charts[chartIndex]) {
            elements.push(
              <ChatChartRenderer key={`chart-${chartIndex}`} chartData={charts[chartIndex]} />
            );
          }
        }
      }
      
      return elements;
    };

    return (
      <div className="prose prose-sm dark:prose-invert max-w-none">
        {renderContent()}
        {showQuickLinks && <QuickLinks />}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b bg-card flex-shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="md:hidden"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3 flex-1">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-semibold text-lg">AI Financial Advisor</h1>
            <p className="text-xs text-muted-foreground">Smart insights from your financial data</p>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-6 py-8">
            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <Bot className="h-10 w-10 text-primary" />
            </div>
            <div className="space-y-2 max-w-lg">
              <h2 className="text-xl font-semibold">Hi! I'm your Smart Financial Advisor</h2>
              <p className="text-muted-foreground text-sm">
                I analyze your loans, EMIs, expenses, budgets, bank accounts, and income to give you 
                personalized insights with detailed breakdowns and actionable recommendations.
              </p>
            </div>
            
            {/* Feature Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full max-w-2xl">
              {[
                { icon: "📊", title: "EMI Analysis", desc: "Monthly projections" },
                { icon: "💰", title: "Cash Flow", desc: "Income vs expenses" },
                { icon: "🎯", title: "Prepayment", desc: "Optimal strategies" },
                { icon: "📈", title: "Trends", desc: "Spending patterns" },
              ].map((f, i) => (
                <Card key={i} className="p-3 text-center bg-muted/50">
                  <div className="text-2xl mb-1">{f.icon}</div>
                  <div className="text-sm font-medium">{f.title}</div>
                  <div className="text-xs text-muted-foreground">{f.desc}</div>
                </Card>
              ))}
            </div>
            
            {/* Quick Questions */}
            <div className="w-full max-w-2xl space-y-3">
              <p className="text-xs text-muted-foreground font-medium">Try asking:</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {suggestedQuestions.slice(0, isMobile ? 4 : 6).map((question, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    className="text-xs h-auto py-2 px-3 whitespace-normal text-left max-w-[200px]"
                    onClick={() => handleQuickQuestion(question)}
                  >
                    {question}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 pb-4 max-w-4xl mx-auto">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center flex-shrink-0 mt-1">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                )}
                <Card
                  className={`p-4 ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground max-w-[85%] md:max-w-[60%]"
                      : "bg-card border max-w-[95%] md:max-w-[85%]"
                  }`}
                >
                {msg.role === "assistant" ? (
                    <AssistantMessage 
                      content={msg.content || (isLoading && index === messages.length - 1 ? "Analyzing your data..." : "")} 
                      showQuickLinks={msg.content && index === messages.length - 1 && !isLoading}
                    />
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  )}
                </Card>
                {msg.role === "user" && (
                  <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 mt-1">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex gap-3 justify-start">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center flex-shrink-0">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <Card className="p-4 bg-card border">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">Analyzing your financial data...</span>
                  </div>
                </Card>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Quick Questions (when chat has messages) */}
      {messages.length > 0 && (
        <div className="px-4 pb-2 flex-shrink-0 border-t bg-background/95 backdrop-blur pt-2">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {suggestedQuestions.map((question, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                className="text-xs whitespace-nowrap flex-shrink-0 h-8"
                onClick={() => handleQuickQuestion(question)}
                disabled={isLoading}
              >
                {question}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 border-t bg-card flex-shrink-0">
        <form onSubmit={handleSubmit} className="flex gap-2 max-w-4xl mx-auto">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your loans, EMIs, expenses, cash flow..."
            className="flex-1"
            disabled={isLoading}
          />
          <Button type="submit" disabled={!input.trim() || isLoading} size="icon">
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
