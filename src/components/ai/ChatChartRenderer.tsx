import { BarChart, Bar, PieChart, Pie, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { Card } from "@/components/ui/card";

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

const formatCurrency = (value: number) => {
  if (value >= 100000) {
    return `₹${(value / 100000).toFixed(1)}L`;
  }
  if (value >= 1000) {
    return `₹${(value / 1000).toFixed(1)}K`;
  }
  return `₹${value.toLocaleString("en-IN")}`;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover border border-border rounded-lg shadow-lg p-3">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: ₹{entry.value?.toLocaleString("en-IN")}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export function ChatChartRenderer({ chartData }: ChatChartRendererProps) {
  const { type, title, data, xKey = "name", yKey = "value" } = chartData;

  if (!data || data.length === 0) return null;

  return (
    <Card className="p-4 my-3 bg-card/50">
      <h4 className="text-sm font-semibold mb-3 text-foreground">{title}</h4>
      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          {type === "bar" ? (
            <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis 
                dataKey={xKey} 
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} 
                axisLine={{ stroke: "hsl(var(--border))" }}
              />
              <YAxis 
                tickFormatter={formatCurrency} 
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={{ stroke: "hsl(var(--border))" }}
                width={50}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey={yKey} radius={[4, 4, 0, 0]}>
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
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                paddingAngle={2}
                dataKey={yKey}
                nameKey={xKey}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          ) : (
            <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis 
                dataKey={xKey} 
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={{ stroke: "hsl(var(--border))" }}
              />
              <YAxis 
                tickFormatter={formatCurrency} 
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={{ stroke: "hsl(var(--border))" }}
                width={50}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line 
                type="monotone" 
                dataKey={yKey} 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                dot={{ fill: "hsl(var(--primary))", strokeWidth: 2 }}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
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
