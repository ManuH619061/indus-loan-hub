import { Bot, User, FileText, BarChart3, Lightbulb, TrendingUp, AlertTriangle, CheckCircle2, Target, Zap, Eye, CreditCard, CalendarClock, Copy, Check } from "lucide-react";
import { format } from "date-fns";
import ReactMarkdown from "react-markdown";
import { ChatChartRenderer, parseChartBlocks } from "./ChatChartRenderer";
import { ChatStyledTable, StatusBadge } from "./ChatStyledTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useState } from "react";
import { toast } from "sonner";

interface ChatMessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
  isStreaming?: boolean;
}

const getSectionIcon = (text: string) => {
  const lower = text.toLowerCase();
  if (lower.includes("summary") || lower.includes("overview") || lower.includes("📋")) return <FileText className="h-4 w-4" />;
  if (lower.includes("chart") || lower.includes("breakdown") || lower.includes("visual") || lower.includes("📊")) return <BarChart3 className="h-4 w-4" />;
  if (lower.includes("recommendation") || lower.includes("action") || lower.includes("✅")) return <CheckCircle2 className="h-4 w-4" />;
  if (lower.includes("analysis") || lower.includes("insight") || lower.includes("💡")) return <Lightbulb className="h-4 w-4" />;
  if (lower.includes("warning") || lower.includes("risk") || lower.includes("caution") || lower.includes("⚠")) return <AlertTriangle className="h-4 w-4" />;
  if (lower.includes("quick") || lower.includes("link") || lower.includes("🔗")) return <Zap className="h-4 w-4" />;
  return null;
};

const detectBadgeType = (text: string): "success" | "warning" | "danger" | "default" | null => {
  const lower = text.toLowerCase().trim();
  if (/^(paid|safe|good|low|✓|completed|on track)$/i.test(lower)) return "success";
  if (/^(overdue|high|critical|risk|danger|urgent|!)$/i.test(lower)) return "danger";
  if (/^(pending|due|medium|warning|caution|soon)$/i.test(lower)) return "warning";
  if (/^(active|normal|regular)$/i.test(lower)) return "default";
  return null;
};

const renderBadge = (text: string, type: "success" | "warning" | "danger" | "default") => {
  const classes = {
    success: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    warning: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
    danger: "bg-destructive/15 text-destructive border-destructive/30",
    default: "bg-muted text-muted-foreground border-border",
  };
  return (
    <Badge className={`${classes[type]} text-xs font-medium`}>
      {text}
    </Badge>
  );
};

const QuickActionButtons = () => (
  <motion.div 
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-border/50"
  >
    <span className="text-xs text-muted-foreground w-full mb-2 flex items-center gap-1.5">
      <Zap className="h-3.5 w-3.5 text-primary" />
      Quick Actions
    </span>
    <Button asChild variant="outline" size="sm" className="h-9 text-xs gap-2 rounded-xl hover:bg-primary/5 hover:border-primary/50 transition-all">
      <Link to="/loans">
        <Eye className="h-3.5 w-3.5" /> View Loans
      </Link>
    </Button>
    <Button asChild variant="outline" size="sm" className="h-9 text-xs gap-2 rounded-xl hover:bg-primary/5 hover:border-primary/50 transition-all">
      <Link to="/payments">
        <CreditCard className="h-3.5 w-3.5" /> Make Payment
      </Link>
    </Button>
    <Button asChild variant="outline" size="sm" className="h-9 text-xs gap-2 rounded-xl hover:bg-primary/5 hover:border-primary/50 transition-all">
      <Link to="/loan-comparison">
        <Target className="h-3.5 w-3.5" /> Compare Loans
      </Link>
    </Button>
    <Button asChild variant="outline" size="sm" className="h-9 text-xs gap-2 rounded-xl hover:bg-primary/5 hover:border-primary/50 transition-all">
      <Link to="/emi-calendar">
        <CalendarClock className="h-3.5 w-3.5" /> EMI Calendar
      </Link>
    </Button>
  </motion.div>
);

export function ChatMessageBubble({ role, content, timestamp, isStreaming }: ChatMessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isUser = role === "user";

  const handleCopy = async () => {
    const cleanContent = content
      .replace(/```chart[\s\S]*?```/g, '')
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/#{1,3}\s/g, '');
    
    await navigator.clipboard.writeText(cleanContent);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  if (isUser) {
    return (
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex gap-3 justify-end"
      >
        <div className="flex flex-col items-end max-w-[85%] md:max-w-[70%]">
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary/60 rounded-2xl rounded-tr-sm blur-sm opacity-50" />
            <div className="relative bg-gradient-to-br from-primary to-primary/90 text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-3 shadow-lg">
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{content}</p>
            </div>
          </div>
          {timestamp && (
            <span className="text-[10px] text-muted-foreground mt-1.5 mr-1 opacity-70">
              {format(new Date(timestamp), "h:mm a")}
            </span>
          )}
        </div>
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-secondary to-muted flex items-center justify-center flex-shrink-0 shadow-sm">
          <User className="h-4 w-4 text-secondary-foreground" />
        </div>
      </motion.div>
    );
  }

  const { text, charts } = parseChartBlocks(content);
  
  const hasRecommendations = text.toLowerCase().includes("recommend") || 
                            text.toLowerCase().includes("action") ||
                            text.toLowerCase().includes("✅");

  const renderContent = () => {
    if (!content && isStreaming) {
      return (
        <div className="flex items-center gap-3 py-2">
          <div className="flex gap-1.5">
            <motion.span 
              className="w-2.5 h-2.5 bg-gradient-to-br from-primary to-orange-500 rounded-full"
              animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 0.8, repeat: Infinity, delay: 0 }}
            />
            <motion.span 
              className="w-2.5 h-2.5 bg-gradient-to-br from-primary to-orange-500 rounded-full"
              animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 0.8, repeat: Infinity, delay: 0.2 }}
            />
            <motion.span 
              className="w-2.5 h-2.5 bg-gradient-to-br from-primary to-orange-500 rounded-full"
              animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 0.8, repeat: Infinity, delay: 0.4 }}
            />
          </div>
          <span className="text-sm text-muted-foreground italic">Analyzing your financial data...</span>
        </div>
      );
    }

    const parts = text.split(/\[CHART_(\d+)\]/g);
    const elements: React.ReactNode[] = [];

    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 0) {
        if (parts[i]) {
          elements.push(
            <ReactMarkdown
              key={`text-${i}`}
              components={{
                table: ({ children }) => (
                  <ChatStyledTable>{children}</ChatStyledTable>
                ),
                thead: ({ children }) => (
                  <thead className="bg-gradient-to-r from-primary/10 to-primary/5">{children}</thead>
                ),
                th: ({ children }) => (
                  <th className="px-4 py-3 text-left text-xs font-bold text-primary uppercase tracking-wider border-b-2 border-primary/20 whitespace-nowrap">
                    {children}
                  </th>
                ),
                tbody: ({ children }) => (
                  <tbody className="divide-y divide-border/30">{children}</tbody>
                ),
                tr: ({ children, node }) => {
                  const isTotal = node?.children?.some((child: any) => {
                    const text = child?.children?.[0]?.value || '';
                    return text.toLowerCase().includes('total');
                  });
                  return (
                    <tr className={`
                      ${isTotal 
                        ? 'bg-muted/80 font-semibold border-t-2 border-border' 
                        : 'odd:bg-background even:bg-muted/20 hover:bg-primary/5'
                      } transition-colors
                    `}>
                      {children}
                    </tr>
                  );
                },
                td: ({ children }) => {
                  const cellText = String(children);
                  const trimmedText = cellText.trim();
                  
                  const isAmount = /₹|^\d[\d,]*(\.\d+)?$/.test(trimmedText);
                  const isPercent = /%/.test(trimmedText);
                  const badgeType = detectBadgeType(trimmedText);
                  
                  const percentMatch = trimmedText.match(/(\d+(?:\.\d+)?)\s*%/);
                  const isHighInterest = percentMatch && parseFloat(percentMatch[1]) > 20;
                  
                  let colorClass = "text-foreground";
                  if (isHighInterest) colorClass = "text-destructive font-semibold";
                  
                  return (
                    <td className={`px-4 py-3 text-sm whitespace-nowrap ${isAmount || isPercent ? "text-right tabular-nums font-medium" : "text-left"} ${colorClass}`}>
                      {badgeType ? renderBadge(trimmedText, badgeType) : children}
                    </td>
                  );
                },
                h1: ({ children }) => {
                  const text = String(children);
                  const icon = getSectionIcon(text);
                  return (
                    <h1 className="text-xl font-bold mt-6 mb-3 text-foreground border-b border-border/50 pb-2 flex items-center gap-2">
                      {icon && <span className="text-primary">{icon}</span>}
                      {children}
                    </h1>
                  );
                },
                h2: ({ children }) => {
                  const text = String(children);
                  const icon = getSectionIcon(text);
                  return (
                    <h2 className="text-lg font-semibold mt-5 mb-3 text-foreground flex items-center gap-2 bg-gradient-to-r from-muted/80 to-transparent -mx-4 px-4 py-2.5 rounded-xl">
                      {icon && <span className="text-primary">{icon}</span>}
                      {children}
                    </h2>
                  );
                },
                h3: ({ children }) => {
                  const text = String(children);
                  const icon = getSectionIcon(text);
                  return (
                    <h3 className="text-base font-semibold mt-4 mb-2 text-foreground flex items-center gap-2">
                      {icon && <span className="text-primary">{icon}</span>}
                      {children}
                    </h3>
                  );
                },
                p: ({ children }) => (
                  <p className="my-2.5 text-sm leading-relaxed text-foreground/90">{children}</p>
                ),
                ul: ({ children }) => (
                  <ul className="my-3 ml-1 space-y-2">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="my-3 ml-4 list-decimal space-y-2">{children}</ol>
                ),
                li: ({ children }) => (
                  <li className="text-sm leading-relaxed text-foreground/90 pl-4 relative flex items-start gap-2">
                    <span className="absolute left-0 top-1.5 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                    <span>{children}</span>
                  </li>
                ),
                strong: ({ children }) => (
                  <strong className="font-semibold text-foreground">{children}</strong>
                ),
                em: ({ children }) => (
                  <em className="italic text-foreground/80">{children}</em>
                ),
                code: ({ children, className }) => {
                  if (className?.includes("language-chart")) return null;
                  return (
                    <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground">{children}</code>
                  );
                },
                pre: ({ children }) => <>{children}</>,
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-primary/50 pl-4 my-3 italic text-foreground/80 bg-primary/5 py-2 pr-3 rounded-r-xl">
                    {children}
                  </blockquote>
                ),
              }}
            >
              {parts[i]}
            </ReactMarkdown>
          );
        }
      } else {
        const chartIndex = parseInt(parts[i], 10);
        if (charts[chartIndex]) {
          elements.push(
            <motion.div 
              key={`chart-${chartIndex}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              <ChatChartRenderer chartData={charts[chartIndex]} />
            </motion.div>
          );
        }
      }
    }

    return elements;
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex gap-3 justify-start group"
    >
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-400/40 to-orange-500/40 rounded-xl blur-md" />
        <div className="relative h-9 w-9 rounded-xl bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 flex items-center justify-center flex-shrink-0 shadow-lg">
          <Bot className="h-4 w-4 text-white" />
        </div>
      </div>
      <div className="flex flex-col max-w-[90%] md:max-w-[80%]">
        <div className="relative">
          <div className="bg-card border border-border/50 rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              {renderContent()}
              {hasRecommendations && !isStreaming && content && <QuickActionButtons />}
            </div>
            
            {/* Copy button */}
            {content && !isStreaming && (
              <button
                onClick={handleCopy}
                className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>
        </div>
        {timestamp && (
          <span className="text-[10px] text-muted-foreground mt-1.5 ml-1 opacity-70">
            {format(new Date(timestamp), "h:mm a")}
          </span>
        )}
      </div>
    </motion.div>
  );
}
