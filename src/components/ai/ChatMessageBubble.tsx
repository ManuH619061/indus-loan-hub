import { Bot, User, FileText, BarChart3, Lightbulb, TrendingUp, AlertTriangle, CheckCircle2, Target, Zap, Eye, CreditCard, CalendarClock } from "lucide-react";
import { format } from "date-fns";
import ReactMarkdown from "react-markdown";
import { ChatChartRenderer, parseChartBlocks } from "./ChatChartRenderer";
import { ChatStyledTable, StatusBadge } from "./ChatStyledTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

interface ChatMessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
  isStreaming?: boolean;
}

// Helper to detect and style section headers
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

// Detect if text is a status/badge
const detectBadgeType = (text: string): "success" | "warning" | "danger" | "default" | null => {
  const lower = text.toLowerCase().trim();
  if (/^(paid|safe|good|low|✓|completed|on track)$/i.test(lower)) return "success";
  if (/^(overdue|high|critical|risk|danger|urgent|!)$/i.test(lower)) return "danger";
  if (/^(pending|due|medium|warning|caution|soon)$/i.test(lower)) return "warning";
  if (/^(active|normal|regular)$/i.test(lower)) return "default";
  return null;
};

// Render badge based on type
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

// Quick action buttons
const QuickActionButtons = () => (
  <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border/50">
    <span className="text-xs text-muted-foreground mr-1 w-full mb-1">🔗 Quick Actions:</span>
    <Button asChild variant="outline" size="sm" className="h-8 text-xs gap-1.5">
      <Link to="/loans">
        <Eye className="h-3.5 w-3.5" /> View Loans
      </Link>
    </Button>
    <Button asChild variant="outline" size="sm" className="h-8 text-xs gap-1.5">
      <Link to="/payments">
        <CreditCard className="h-3.5 w-3.5" /> Make Payment
      </Link>
    </Button>
    <Button asChild variant="outline" size="sm" className="h-8 text-xs gap-1.5">
      <Link to="/loan-comparison">
        <Target className="h-3.5 w-3.5" /> Compare Loans
      </Link>
    </Button>
    <Button asChild variant="outline" size="sm" className="h-8 text-xs gap-1.5">
      <Link to="/emi-calendar">
        <CalendarClock className="h-3.5 w-3.5" /> EMI Calendar
      </Link>
    </Button>
  </div>
);

export function ChatMessageBubble({ role, content, timestamp, isStreaming }: ChatMessageBubbleProps) {
  const isUser = role === "user";

  if (isUser) {
    return (
      <div className="flex gap-3 justify-end">
        <div className="flex flex-col items-end max-w-[85%] md:max-w-[70%]">
          <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-3 shadow-sm">
            <p className="text-sm whitespace-pre-wrap">{content}</p>
          </div>
          {timestamp && (
            <span className="text-xs text-muted-foreground mt-1 mr-1">
              {format(new Date(timestamp), "h:mm a")}
            </span>
          )}
        </div>
        <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
          <User className="h-4 w-4 text-secondary-foreground" />
        </div>
      </div>
    );
  }

  // Assistant message with rich formatting
  const { text, charts } = parseChartBlocks(content);
  
  // Check if response has recommendations (to show quick actions)
  const hasRecommendations = text.toLowerCase().includes("recommend") || 
                            text.toLowerCase().includes("action") ||
                            text.toLowerCase().includes("✅");

  const renderContent = () => {
    if (!content && isStreaming) {
      return (
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
          <span className="text-sm text-muted-foreground">Analyzing your financial data...</span>
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
                  <thead className="bg-primary/10 dark:bg-primary/20">{children}</thead>
                ),
                th: ({ children }) => (
                  <th className="px-4 py-3 text-left text-xs font-bold text-primary uppercase tracking-wider border-b-2 border-primary/30 whitespace-nowrap">
                    {children}
                  </th>
                ),
                tbody: ({ children }) => (
                  <tbody className="divide-y divide-border/50">{children}</tbody>
                ),
                tr: ({ children, node }) => {
                  // Check if this is a total row
                  const isTotal = node?.children?.some((child: any) => {
                    const text = child?.children?.[0]?.value || '';
                    return text.toLowerCase().includes('total');
                  });
                  return (
                    <tr className={`
                      ${isTotal 
                        ? 'bg-muted/80 font-semibold border-t-2 border-border' 
                        : 'odd:bg-background even:bg-muted/30 hover:bg-accent/50'
                      } transition-colors
                    `}>
                      {children}
                    </tr>
                  );
                },
                td: ({ children }) => {
                  const cellText = String(children);
                  const trimmedText = cellText.trim();
                  
                  // Check for currency amounts (right-align)
                  const isAmount = /₹|^\d[\d,]*(\.\d+)?$/.test(trimmedText);
                  
                  // Check for percentage
                  const isPercent = /%/.test(trimmedText);
                  
                  // Check for badge/status
                  const badgeType = detectBadgeType(trimmedText);
                  
                  // High interest detection (>20%)
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
                    <h1 className="text-xl font-bold mt-6 mb-3 text-foreground border-b border-border pb-2 flex items-center gap-2">
                      {icon && <span className="text-primary">{icon}</span>}
                      {children}
                    </h1>
                  );
                },
                h2: ({ children }) => {
                  const text = String(children);
                  const icon = getSectionIcon(text);
                  return (
                    <h2 className="text-lg font-semibold mt-5 mb-3 text-foreground flex items-center gap-2 bg-muted/50 -mx-4 px-4 py-2 rounded-lg">
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
                  <ul className="my-3 ml-4 space-y-2">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="my-3 ml-4 list-decimal space-y-2">{children}</ol>
                ),
                li: ({ children }) => (
                  <li className="text-sm leading-relaxed text-foreground/90 pl-1 relative">
                    <span className="absolute -left-4 text-primary">•</span>
                    {children}
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
                  <blockquote className="border-l-4 border-primary/50 pl-4 my-3 italic text-foreground/80 bg-muted/30 py-2 pr-3 rounded-r-lg">
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
            <ChatChartRenderer key={`chart-${chartIndex}`} chartData={charts[chartIndex]} />
          );
        }
      }
    }

    return elements;
  };

  return (
    <div className="flex gap-3 justify-start">
      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center flex-shrink-0 shadow-md">
        <Bot className="h-4 w-4 text-primary-foreground" />
      </div>
      <div className="flex flex-col max-w-[90%] md:max-w-[80%]">
        <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            {renderContent()}
            {hasRecommendations && !isStreaming && content && <QuickActionButtons />}
          </div>
        </div>
        {timestamp && (
          <span className="text-xs text-muted-foreground mt-1 ml-1">
            {format(new Date(timestamp), "h:mm a")}
          </span>
        )}
      </div>
    </div>
  );
}
