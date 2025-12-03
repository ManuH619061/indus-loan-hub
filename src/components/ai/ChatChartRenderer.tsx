import { BarChart, Bar, PieChart, Pie, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, LabelList } from "recharts";
import { Card } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(217, 91%, 60%)",
  "hsl(142, 71%, 45%)",
  "hsl(47, 100%, 50%)",
];

interface ChartData {
  type: "bar" | "pie" | "line";
  title: string;
  data: Array<{ name: string; value: number; [key: string]: any }>;
  xKey?: string;
  yKey?: string;
  unit?: string;
}

interface ChatChartRendererProps {
  chartData: ChartData;
}

// Format currency in Indian format
const formatCurrency = (value: number) => {
  if (value >= 10000000) {
    return `₹${(value / 10000000).toFixed(2)}Cr`;
  }
  if (value >= 100000) {
    return `₹${(value / 100000).toFixed(2)}L`;
  }
  if (value >= 1000) {
    return `₹${(value / 1000).toFixed(1)}K`;
  }
  return `₹${value.toLocaleString("en-IN")}`;
};

// Format full currency with Indian number format
const formatFullCurrency = (value: number) => {
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
};

// Custom tooltip with professional styling
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover/95 backdrop-blur-sm border border-border rounded-lg shadow-xl p-3 min-w-[150px]">
        <p className="text-sm font-semibold text-foreground mb-2 border-b border-border pb-1.5">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center justify-between gap-4 py-0.5">
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-xs text-muted-foreground">{entry.name || 'Amount'}</span>
            </div>
            <span className="text-sm font-semibold text-foreground">
              {formatFullCurrency(entry.value)}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// Custom pie chart tooltip
const PieTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-popover/95 backdrop-blur-sm border border-border rounded-lg shadow-xl p-3">
        <div className="flex items-center gap-2 mb-1">
          <div 
            className="w-3 h-3 rounded-full" 
            style={{ backgroundColor: data.payload.fill }}
          />
          <span className="text-sm font-semibold text-foreground">{data.name}</span>
        </div>
        <p className="text-lg font-bold text-foreground">{formatFullCurrency(data.value)}</p>
        <p className="text-xs text-muted-foreground">{((data.percent || 0) * 100).toFixed(1)}% of total</p>
      </div>
    );
  }
  return null;
};

// Custom legend
const CustomLegend = ({ payload }: any) => {
  if (!payload) return null;
  return (
    <div className="flex flex-wrap justify-center gap-3 mt-3 pt-2 border-t border-border/50">
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-1.5">
          <div 
            className="w-2.5 h-2.5 rounded-full" 
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-xs text-muted-foreground">{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

export function ChatChartRenderer({ chartData }: ChatChartRendererProps) {
  const { type, title, data, xKey = "name", yKey = "value" } = chartData;

  if (!data || data.length === 0) return null;

  // Calculate total for pie chart
  const total = data.reduce((sum, item) => sum + (item[yKey] || 0), 0);

  return (
    <Card className="p-4 my-4 bg-card border-border shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="h-4 w-4 text-primary" />
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      </div>
      
      <div className={`w-full ${type === "pie" ? "h-[280px]" : "h-[240px]"}`}>
        <ResponsiveContainer width="100%" height="100%">
          {type === "bar" ? (
            <BarChart data={data} margin={{ top: 20, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} vertical={false} />
              <XAxis 
                dataKey={xKey} 
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} 
                axisLine={{ stroke: "hsl(var(--border))" }}
                tickLine={false}
                interval={0}
                angle={-20}
                textAnchor="end"
                height={50}
              />
              <YAxis 
                tickFormatter={formatCurrency} 
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                width={55}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }} />
              <Bar dataKey={yKey} radius={[6, 6, 0, 0]} maxBarSize={50}>
                <LabelList 
                  dataKey={yKey} 
                  position="top" 
                  formatter={formatCurrency}
                  style={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                />
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          ) : type === "pie" ? (
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="45%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={3}
                dataKey={yKey}
                nameKey={xKey}
                label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                labelLine={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1 }}
              >
                {data.map((_, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={COLORS[index % COLORS.length]} 
                    stroke="hsl(var(--background))"
                    strokeWidth={2}
                  />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip />} />
              <Legend content={<CustomLegend />} />
            </PieChart>
          ) : (
            <LineChart data={data} margin={{ top: 20, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} vertical={false} />
              <XAxis 
                dataKey={xKey} 
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={{ stroke: "hsl(var(--border))" }}
                tickLine={false}
              />
              <YAxis 
                tickFormatter={formatCurrency} 
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                width={55}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line 
                type="monotone" 
                dataKey={yKey} 
                stroke="hsl(var(--primary))" 
                strokeWidth={2.5}
                dot={{ fill: "hsl(var(--primary))", strokeWidth: 0, r: 4 }}
                activeDot={{ r: 6, fill: "hsl(var(--primary))", stroke: "hsl(var(--background))", strokeWidth: 2 }}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
      
      {/* Total display for pie chart */}
      {type === "pie" && (
        <div className="text-center mt-2 pt-2 border-t border-border/50">
          <span className="text-xs text-muted-foreground">Total: </span>
          <span className="text-sm font-semibold text-foreground">{formatFullCurrency(total)}</span>
        </div>
      )}
    </Card>
  );
}

// Parse chart blocks from markdown content
export function parseChartBlocks(content: string): { text: string; charts: ChartData[] } {
  const chartRegex = /```chart\n([\s\S]*?)```/g;
  const charts: ChartData[] = [];
  let text = content;

  let match;
  while ((match = chartRegex.exec(content)) !== null) {
    try {
      const chartData = JSON.parse(match[1]);
      if (chartData.type && chartData.data) {
        charts.push(chartData);
      }
    } catch (e) {
      console.error("Failed to parse chart data:", e);
    }
    text = text.replace(match[0], `[CHART_${charts.length - 1}]`);
  }

  return { text, charts };
}
