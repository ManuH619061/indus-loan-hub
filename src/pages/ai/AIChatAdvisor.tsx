import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { 
  Send, Bot, Sparkles, Loader2, Menu, Download, PanelLeftClose, PanelLeft, 
  History, Brain, TrendingUp, Wallet, PiggyBank, BarChart3, Zap, MessageSquarePlus
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { useChatHistory } from "@/hooks/useChatHistory";
import { ChatHistorySidebar } from "@/components/ai/ChatHistorySidebar";
import { ChatMessageBubble } from "@/components/ai/ChatMessageBubble";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { motion, AnimatePresence } from "framer-motion";
import { Textarea } from "@/components/ui/textarea";

const initialQuickQuestions = [
  { text: "How much EMI do I need to pay next month?", icon: Wallet, category: "emi" },
  { text: "Which loan closes next and when?", icon: TrendingUp, category: "loan" },
  { text: "What's my highest expense category this month?", icon: BarChart3, category: "expense" },
  { text: "Compare my expenses: this month vs last month", icon: BarChart3, category: "expense" },
  { text: "If I prepay ₹5,000, which loan should I target?", icon: PiggyBank, category: "loan" },
  { text: "What's my total outstanding loan amount?", icon: Wallet, category: "loan" },
  { text: "What will be my cash flow for the next 3 months?", icon: TrendingUp, category: "cashflow" },
  { text: "Where am I overspending compared to my budget?", icon: BarChart3, category: "expense" },
];

const followUpQuestions: Record<string, { text: string; icon: any; category: string }[]> = {
  emi: [
    { text: "Show me next 3 months EMI breakdown", icon: BarChart3, category: "emi" },
    { text: "Which loan has the highest EMI?", icon: TrendingUp, category: "emi" },
    { text: "How much total interest will I pay?", icon: Wallet, category: "emi" },
  ],
  loan: [
    { text: "Which loan has the highest interest rate?", icon: TrendingUp, category: "loan" },
    { text: "How much can I save by closing this loan early?", icon: PiggyBank, category: "loan" },
    { text: "What if I add ₹3,000 extra every month?", icon: Zap, category: "loan" },
  ],
  expense: [
    { text: "Show me month-wise expense trend", icon: BarChart3, category: "expense" },
    { text: "Which category increased the most?", icon: TrendingUp, category: "expense" },
    { text: "How much am I over budget?", icon: Wallet, category: "expense" },
  ],
  cashflow: [
    { text: "Show 6 months cash flow projection", icon: BarChart3, category: "cashflow" },
    { text: "What's my savings potential?", icon: PiggyBank, category: "cashflow" },
    { text: "When will I be EMI-free?", icon: Zap, category: "cashflow" },
  ],
};

const featureCards = [
  { icon: Brain, title: "Smart Analysis", desc: "Deep insights from your data", gradient: "from-violet-500 to-purple-600" },
  { icon: TrendingUp, title: "Predictions", desc: "Future cash flow & trends", gradient: "from-blue-500 to-cyan-500" },
  { icon: PiggyBank, title: "Savings Tips", desc: "Optimize your finances", gradient: "from-emerald-500 to-green-500" },
  { icon: Zap, title: "Quick Actions", desc: "Instant recommendations", gradient: "from-amber-500 to-orange-500" },
];

export default function AIChatAdvisor() {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState(initialQuickQuestions.slice(0, 6));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(() => {
    return localStorage.getItem("ai-sidebar-collapsed") === "true";
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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

  useEffect(() => {
    localStorage.setItem("ai-sidebar-collapsed", String(desktopSidebarCollapsed));
  }, [desktopSidebarCollapsed]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
    }
  }, [input]);

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

      if (!currentConversationId) {
        currentConversationId = await createConversation(trimmedMessage);
        if (!currentConversationId) {
          toast({ title: "Error", description: "Failed to create conversation", variant: "destructive" });
          setIsLoading(false);
          return;
        }
      }

      const userMsg = await addMessage(currentConversationId, "user", trimmedMessage);
      if (userMsg) {
        setMessages(prev => [...prev, userMsg]);
      }

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

      if (assistantMessageId && assistantContent) {
        await finalizeMessage(assistantMessageId, assistantContent);
      }

    } catch (error) {
      console.error("Chat error:", error);
      toast({ title: "Error", description: "Failed to send message", variant: "destructive" });
    } finally {
      setIsLoading(false);
      textareaRef.current?.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
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
    <div className="flex h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)] bg-gradient-to-br from-background via-background to-muted/20">
      {/* Desktop Sidebar */}
      {!isMobile && (
        <motion.div 
          initial={false}
          animate={{ width: desktopSidebarCollapsed ? 0 : 288 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="border-r border-border flex-shrink-0 hidden md:block overflow-hidden"
        >
          <SidebarContent />
        </motion.div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Premium Header */}
        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="flex items-center gap-3 p-4 border-b bg-card/80 backdrop-blur-sm flex-shrink-0"
        >
          {isMobile ? (
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-80">
                <SidebarContent />
              </SheetContent>
            </Sheet>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-10 w-10"
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

          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl blur-lg opacity-40" />
              <div className="relative h-11 w-11 rounded-xl bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 flex items-center justify-center shadow-lg">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-bold text-lg bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                FinPath AI
              </h1>
              <p className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                {activeConversationId 
                  ? conversations.find(c => c.id === activeConversationId)?.title || "Active Chat"
                  : "Ready to help"
                }
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-10 w-10 hover:bg-primary/10"
                      onClick={handleNewChat}
                    >
                      <MessageSquarePlus className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>New chat</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-10 w-10 hover:bg-primary/10" 
                      onClick={downloadReport}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Download report</TooltipContent>
                </Tooltip>
              </>
            )}
            {conversations.length > 0 && desktopSidebarCollapsed && !isMobile && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-10 w-10 hover:bg-primary/10"
                    onClick={() => setDesktopSidebarCollapsed(false)}
                  >
                    <History className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>View history ({conversations.length})</TooltipContent>
              </Tooltip>
            )}
          </div>
        </motion.div>

        {/* Messages Area */}
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <AnimatePresence mode="wait">
            {isLoadingHistory ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center h-full gap-4"
              >
                <div className="relative">
                  <div className="h-16 w-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                  <Brain className="absolute inset-0 m-auto h-6 w-6 text-primary" />
                </div>
                <p className="text-muted-foreground text-sm">Loading conversation...</p>
              </motion.div>
            ) : messages.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center h-full text-center space-y-8 py-8"
              >
                {/* Animated Logo */}
                <motion.div 
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200 }}
                  className="relative"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-orange-500/30 rounded-3xl blur-2xl" />
                  <div className="relative h-24 w-24 rounded-3xl bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 flex items-center justify-center shadow-2xl">
                    <Bot className="h-12 w-12 text-white" />
                  </div>
                  <motion.div
                    className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Sparkles className="h-3 w-3 text-white" />
                  </motion.div>
                </motion.div>

                {/* Welcome Text */}
                <div className="space-y-3 max-w-lg">
                  <h2 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-foreground via-foreground to-muted-foreground bg-clip-text">
                    Hi! I'm your AI Financial Advisor
                  </h2>
                  <p className="text-muted-foreground text-sm md:text-base leading-relaxed">
                    I analyze your loans, EMIs, expenses, budgets, and income to provide 
                    personalized insights and actionable recommendations.
                  </p>
                </div>
                
                {/* Feature Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full max-w-2xl">
                  {featureCards.map((f, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 * i }}
                      className="group relative overflow-hidden rounded-2xl bg-card border border-border p-4 hover:shadow-lg transition-all duration-300"
                    >
                      <div className={`absolute inset-0 bg-gradient-to-br ${f.gradient} opacity-0 group-hover:opacity-5 transition-opacity`} />
                      <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${f.gradient} flex items-center justify-center mb-3 shadow-lg`}>
                        <f.icon className="h-5 w-5 text-white" />
                      </div>
                      <div className="text-sm font-semibold text-foreground">{f.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{f.desc}</div>
                    </motion.div>
                  ))}
                </div>

                {/* Quick Questions */}
                <div className="w-full max-w-2xl space-y-3">
                  <p className="text-sm font-medium text-muted-foreground">Try asking:</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {suggestedQuestions.slice(0, 6).map((q, i) => {
                      const Icon = q.icon;
                      return (
                        <motion.button
                          key={i}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.3 + i * 0.05 }}
                          onClick={() => handleQuickQuestion(q.text)}
                          disabled={isLoading}
                          className="group flex items-center gap-2 px-4 py-2.5 rounded-full bg-card border border-border hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 text-sm text-left disabled:opacity-50"
                        >
                          <Icon className="h-4 w-4 text-primary flex-shrink-0" />
                          <span className="text-foreground/80 group-hover:text-foreground truncate max-w-[200px]">
                            {q.text}
                          </span>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6 pb-4 max-w-4xl mx-auto"
              >
                {messages.map((msg, idx) => (
                  <motion.div
                    key={msg.id || idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <ChatMessageBubble
                      role={msg.role as "user" | "assistant"}
                      content={msg.content}
                      timestamp={msg.created_at}
                      isStreaming={isLoading && idx === messages.length - 1 && msg.role === "assistant"}
                    />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </ScrollArea>

        {/* Quick Questions (when in conversation) */}
        {messages.length > 0 && !isLoading && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-4 pb-2"
          >
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 max-w-4xl mx-auto">
              {suggestedQuestions.slice(0, 4).map((q, i) => {
                const Icon = q.icon;
                return (
                  <button
                    key={i}
                    onClick={() => handleQuickQuestion(q.text)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/50 hover:bg-muted border border-border/50 transition-colors text-xs whitespace-nowrap flex-shrink-0"
                  >
                    <Icon className="h-3 w-3 text-primary" />
                    <span className="text-muted-foreground">{q.text.slice(0, 40)}...</span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Input Area */}
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="p-4 bg-card/80 backdrop-blur-sm border-t border-border"
        >
          <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
            <div className="relative flex items-end gap-2">
              <div className="flex-1 relative">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about your finances..."
                  disabled={isLoading}
                  rows={1}
                  className="min-h-[52px] max-h-[120px] resize-none py-3.5 px-4 pr-12 text-sm rounded-2xl border-border bg-background focus-visible:ring-2 focus-visible:ring-primary/50 transition-all"
                />
                {isLoading && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                )}
              </div>
              <Button
                type="submit"
                disabled={!input.trim() || isLoading}
                size="icon"
                className="h-[52px] w-[52px] rounded-2xl bg-gradient-to-br from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/25 transition-all duration-200 disabled:opacity-50 disabled:shadow-none"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Press Enter to send, Shift+Enter for new line
            </p>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
