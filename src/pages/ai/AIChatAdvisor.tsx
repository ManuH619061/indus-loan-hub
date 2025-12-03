import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ArrowLeft, Send, Bot, Sparkles, Loader2, Menu, Download, PanelLeftClose, PanelLeft, History } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { useChatHistory } from "@/hooks/useChatHistory";
import { ChatHistorySidebar } from "@/components/ai/ChatHistorySidebar";
import { ChatMessageBubble } from "@/components/ai/ChatMessageBubble";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>(initialQuickQuestions.slice(0, 6));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(() => {
    // Remember user's preference
    return localStorage.getItem("ai-sidebar-collapsed") === "true";
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const {
    conversations,
    activeConversationId,
    messages,
    setMessages,
    isLoadingHistory,
    createConversation,
    addMessage,
    finalizeMessage,
    selectConversation,
    startNewChat,
    deleteConversation,
    renameConversation,
    deleteAllConversations,
  } = useChatHistory();

  // Save sidebar preference
  useEffect(() => {
    localStorage.setItem("ai-sidebar-collapsed", String(desktopSidebarCollapsed));
  }, [desktopSidebarCollapsed]);

  // Auto-scroll on new messages
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

    const trimmedMessage = messageText.trim();
    setInput("");
    setIsLoading(true);

    let assistantContent = "";
    let currentConversationId = activeConversationId;
    let assistantMessageId: string | null = null;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Please sign in to use the AI advisor", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      // Create conversation if needed
      if (!currentConversationId) {
        currentConversationId = await createConversation(trimmedMessage);
        if (!currentConversationId) {
          toast({ title: "Error", description: "Failed to create conversation", variant: "destructive" });
          setIsLoading(false);
          return;
        }
      }

      // Add user message to DB and state
      const userMsg = await addMessage(currentConversationId, "user", trimmedMessage);
      if (userMsg) {
        setMessages(prev => [...prev, userMsg]);
      }

      // Create placeholder for assistant response
      const assistantMsgPlaceholder = await addMessage(currentConversationId, "assistant", "");
      if (assistantMsgPlaceholder) {
        assistantMessageId = assistantMsgPlaceholder.id || null;
        setMessages(prev => [...prev, { ...assistantMsgPlaceholder, content: "" }]);
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
            message: trimmedMessage,
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
                  updated[updated.length - 1] = { ...updated[updated.length - 1], content: assistantContent };
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

      // Process remaining buffer
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
                  updated[updated.length - 1] = { ...updated[updated.length - 1], content: assistantContent };
                }
                return updated;
              });
            }
          } catch { /* ignore */ }
        }
      }

      // Finalize assistant message in DB
      if (assistantMessageId && assistantContent) {
        await finalizeMessage(assistantMessageId, assistantContent);
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

  const handleNewChat = () => {
    startNewChat();
    setSidebarOpen(false);
  };

  const handleSelectConversation = async (id: string) => {
    await selectConversation(id);
    setSidebarOpen(false);
  };

  // Download chat as text report
  const downloadReport = () => {
    if (messages.length === 0) return;
    
    const date = new Date().toLocaleDateString('en-IN', { 
      day: '2-digit', month: 'short', year: 'numeric' 
    });
    
    let report = `AI Financial Report - ${date}\n`;
    report += "=".repeat(50) + "\n\n";
    
    messages.forEach(msg => {
      const label = msg.role === "user" ? "You" : "AI Advisor";
      report += `[${label}]\n`;
      const cleanContent = msg.content
        .replace(/```chart[\s\S]*?```/g, '[Chart]')
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/#{1,3}\s/g, '');
      report += cleanContent + "\n\n";
    });
    
    const blob = new Blob([report], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `AI-Report-${date.replace(/\s/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({ title: "Report downloaded" });
  };

  // Sidebar content
  const SidebarContent = () => (
    <ChatHistorySidebar
      conversations={conversations}
      activeConversationId={activeConversationId}
      onSelectConversation={handleSelectConversation}
      onNewChat={handleNewChat}
      onDeleteConversation={deleteConversation}
      onRenameConversation={renameConversation}
      onDeleteAllChats={deleteAllConversations}
      onClose={() => setSidebarOpen(false)}
      isMobile={isMobile}
    />
  );

  return (
    <div className="flex h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)]">
      {/* Desktop Sidebar - Collapsible */}
      {!isMobile && (
        <div 
          className={`border-r border-border flex-shrink-0 hidden md:block transition-all duration-300 ease-in-out ${
            desktopSidebarCollapsed ? "w-0 overflow-hidden" : "w-72"
          }`}
        >
          <SidebarContent />
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2 p-3 border-b bg-card flex-shrink-0">
          {/* Mobile: Menu button */}
          {isMobile ? (
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-80">
                <SidebarContent />
              </SheetContent>
            </Sheet>
          ) : (
            /* Desktop: Toggle sidebar button */
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-9 w-9"
                  onClick={() => setDesktopSidebarCollapsed(!desktopSidebarCollapsed)}
                >
                  {desktopSidebarCollapsed ? (
                    <PanelLeft className="h-5 w-5" />
                  ) : (
                    <PanelLeftClose className="h-5 w-5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {desktopSidebarCollapsed ? "Show history" : "Hide history"}
              </TooltipContent>
            </Tooltip>
          )}

          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-md flex-shrink-0">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-semibold text-base truncate">FinPath AI</h1>
              <p className="text-xs text-muted-foreground truncate">
                {activeConversationId 
                  ? conversations.find(c => c.id === activeConversationId)?.title || "Chat"
                  : "New Chat"
                }
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            {conversations.length > 0 && desktopSidebarCollapsed && !isMobile && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-9 w-9"
                    onClick={() => setDesktopSidebarCollapsed(false)}
                  >
                    <History className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>View history ({conversations.length})</TooltipContent>
              </Tooltip>
            )}
            {messages.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9" onClick={downloadReport}>
                    <Download className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Download report</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {/* Messages Area */}
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          {isLoadingHistory ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-6 py-8">
              <div className="h-20 w-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                <Bot className="h-10 w-10 text-primary" />
              </div>
              <div className="space-y-2 max-w-lg">
                <h2 className="text-xl font-semibold">Hi! I'm FinPath AI</h2>
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
                <ChatMessageBubble
                  key={msg.id || index}
                  role={msg.role}
                  content={msg.content || (isLoading && index === messages.length - 1 ? "" : "")}
                  timestamp={msg.created_at}
                  isStreaming={isLoading && index === messages.length - 1 && msg.role === "assistant"}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Follow-up suggestions */}
        {messages.length > 0 && !isLoading && (
          <div className="px-4 py-2 border-t border-border/50 bg-background/80">
            <div className="flex flex-wrap gap-2 max-w-4xl mx-auto">
              {suggestedQuestions.slice(0, 3).map((q, i) => (
                <Button
                  key={i}
                  variant="ghost"
                  size="sm"
                  className="text-xs h-auto py-1.5 px-3 text-muted-foreground hover:text-foreground"
                  onClick={() => handleQuickQuestion(q)}
                >
                  {q}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="p-3 border-t bg-card flex-shrink-0">
          <form onSubmit={handleSubmit} className="flex gap-2 max-w-4xl mx-auto">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your loans, EMIs, expenses, budget..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button type="submit" disabled={isLoading || !input.trim()} size="icon">
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
