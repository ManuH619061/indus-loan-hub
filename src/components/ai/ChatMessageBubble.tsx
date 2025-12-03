import { Bot, User, FileText, BarChart3, Lightbulb, TrendingUp, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import ReactMarkdown from "react-markdown";
import { ChatChartRenderer, parseChartBlocks } from "./ChatChartRenderer";
import { ChatStyledTable } from "./ChatStyledTable";
import { Badge } from "@/components/ui/badge";

interface ChatMessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
  isStreaming?: boolean;
}

// Helper to detect and style section headers
const getSectionIcon = (text: string) => {
  const lower = text.toLowerCase();
  if (lower.includes("summary") || lower.includes("overview")) return <FileText className="h-4 w-4" />;
  if (lower.includes("chart") || lower.includes("breakdown") || lower.includes("visual")) return <BarChart3 className="h-4 w-4" />;
  if (lower.includes("recommendation") || lower.includes("suggestion") || lower.includes("action")) return <Lightbulb className="h-4 w-4" />;
  if (lower.includes("analysis") || lower.includes("insight")) return <TrendingUp className="h-4 w-4" />;
  if (lower.includes("warning") || lower.includes("risk") || lower.includes("caution")) return <AlertTriangle className="h-4 w-4" />;
  return null;
};

// Format currency values in text
const formatCurrencyInText = (text: string) => {
  // Match ₹ followed by numbers with commas
  return text.replace(/₹\s?([\d,]+(?:\.\d{2})?)/g, (match, num) => {
    return `₹${num}`;
  });
};

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

  const renderContent = () => {
    if (!content && isStreaming) {
      return (
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
          <span className="text-sm text-muted-foreground">AI is thinking...</span>
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
                tr: ({ children }) => (
                  <tr className="odd:bg-background even:bg-muted/40 hover:bg-accent/50 transition-colors">
                    {children}
                  </tr>
                ),
                td: ({ children }) => {
                  const cellText = String(children);
                  const isAmount = cellText.includes("₹") || /^[\d,]+(\.\d+)?$/.test(cellText.trim());
                  // Detect status/priority badges
                  const lowerText = cellText.toLowerCase();
                  const isHighRisk = lowerText.includes("high") || lowerText.includes("overdue") || lowerText.includes("risk");
                  const isCaution = lowerText.includes("medium") || lowerText.includes("caution") || lowerText.includes("warning");
                  const isSafe = lowerText.includes("low") || lowerText.includes("safe") || lowerText.includes("good") || lowerText.includes("paid");
                  
                  let colorClass = "text-foreground";
                  if (isHighRisk) colorClass = "text-destructive font-semibold";
                  else if (isCaution) colorClass = "text-amber-600 dark:text-amber-400 font-semibold";
                  else if (isSafe) colorClass = "text-emerald-600 dark:text-emerald-400 font-semibold";
                  
                  return (
                    <td className={`px-4 py-3 text-sm whitespace-nowrap ${isAmount ? "text-right font-semibold tabular-nums" : "text-left"} ${colorClass}`}>
                      {children}
                    </td>
                  );
                },
                h1: ({ children }) => {
                  const icon = getSectionIcon(String(children));
                  return (
                    <h1 className="text-xl font-bold mt-6 mb-3 text-foreground border-b border-border pb-2 flex items-center gap-2">
                      {icon && <span className="text-primary">{icon}</span>}
                      {children}
                    </h1>
                  );
                },
                h2: ({ children }) => {
                  const icon = getSectionIcon(String(children));
                  return (
                    <h2 className="text-lg font-semibold mt-5 mb-2 text-foreground flex items-center gap-2">
                      {icon && <span className="text-primary">{icon}</span>}
                      {children}
                    </h2>
                  );
                },
                h3: ({ children }) => {
                  const icon = getSectionIcon(String(children));
                  return (
                    <h3 className="text-base font-semibold mt-4 mb-2 text-foreground flex items-center gap-2">
                      {icon && <span className="text-primary">{icon}</span>}
                      {children}
                    </h3>
                  );
                },
                p: ({ children }) => (
                  <p className="my-2 text-sm leading-relaxed text-foreground/90">{children}</p>
                ),
                ul: ({ children }) => (
                  <ul className="my-3 ml-4 space-y-2">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="my-3 ml-4 list-decimal space-y-2">{children}</ol>
                ),
                li: ({ children }) => (
                  <li className="text-sm leading-relaxed text-foreground/90 pl-1">
                    <span className="relative -left-1">{children}</span>
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
                  <blockquote className="border-l-4 border-primary/50 pl-4 my-3 italic text-foreground/80">
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
