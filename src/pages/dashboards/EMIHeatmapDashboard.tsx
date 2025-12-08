import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Calendar,
  Download,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { formatINR } from "@/lib/currency";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, startOfYear, endOfYear, eachMonthOfInterval, isWithinInterval, isBefore } from "date-fns";
import { cn } from "@/lib/utils";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { motion } from "framer-motion";
import {
  fetchLoansWithAmortization,
  type LoanWithAmortization
} from "@/lib/portfolio-stats";

interface EMIDay {
  date: Date;
  count: number;
  amount: number;
  status: 'none' | 'paid' | 'due' | 'overdue';
  emis: { loanName: string; amount: number; status: string }[];
}

interface MonthlyVolume {
  month: string;
  count: number;
  amount: number;
  paid: number;
  unpaid: number;
}

export default function EMIHeatmapDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loans, setLoans] = useState<LoanWithAmortization[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [heatmapData, setHeatmapData] = useState<EMIDay[]>([]);
  const [monthlyVolume, setMonthlyVolume] = useState<MonthlyVolume[]>([]);
  const [stats, setStats] = useState({
    totalDue: 0,
    totalPaid: 0,
    totalOverdue: 0,
    upcomingCount: 0,
  });

  useEffect(() => {
    if (user) fetchData();
  }, [user, currentDate, selectedYear]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const loansData = await fetchLoansWithAmortization(user.id);
      setLoans(loansData);

      const today = new Date();
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

      // Build heatmap data
      const heatmap: EMIDay[] = days.map(date => {
        const dayEmis: EMIDay['emis'] = [];
        let dayAmount = 0;
        let dayStatus: EMIDay['status'] = 'none';

        loansData.forEach(loan => {
          loan.amortization_rows?.forEach(row => {
            const dueDate = new Date(row.due_on);
            if (format(dueDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')) {
              dayEmis.push({
                loanName: loan.loan_name,
                amount: row.scheduled_emi,
                status: row.is_paid ? 'paid' : isBefore(dueDate, today) ? 'overdue' : 'due',
              });
              dayAmount += row.scheduled_emi;
              
              if (row.is_paid) {
                dayStatus = dayStatus === 'none' ? 'paid' : dayStatus;
              } else if (isBefore(dueDate, today)) {
                dayStatus = 'overdue';
              } else {
                dayStatus = dayStatus !== 'overdue' ? 'due' : dayStatus;
              }
            }
          });
        });

        return {
          date,
          count: dayEmis.length,
          amount: dayAmount,
          status: dayStatus,
          emis: dayEmis,
        };
      });
      setHeatmapData(heatmap);

      // Calculate stats
      let totalDue = 0, totalPaid = 0, totalOverdue = 0, upcomingCount = 0;
      heatmap.forEach(day => {
        day.emis.forEach(emi => {
          if (emi.status === 'paid') totalPaid += emi.amount;
          else if (emi.status === 'overdue') totalOverdue += emi.amount;
          else {
            totalDue += emi.amount;
            upcomingCount++;
          }
        });
      });
      setStats({ totalDue, totalPaid, totalOverdue, upcomingCount });

      // Build yearly volume data
      const yearStart = startOfYear(new Date(parseInt(selectedYear), 0, 1));
      const yearEnd = endOfYear(yearStart);
      const months = eachMonthOfInterval({ start: yearStart, end: yearEnd });

      const volume: MonthlyVolume[] = months.map(month => {
        const mStart = startOfMonth(month);
        const mEnd = endOfMonth(month);
        let count = 0, amount = 0, paid = 0, unpaid = 0;

        loansData.forEach(loan => {
          loan.amortization_rows?.forEach(row => {
            const dueDate = new Date(row.due_on);
            if (isWithinInterval(dueDate, { start: mStart, end: mEnd })) {
              count++;
              amount += row.scheduled_emi;
              if (row.is_paid) paid += row.scheduled_emi;
              else unpaid += row.scheduled_emi;
            }
          });
        });

        return {
          month: format(month, 'MMM'),
          count,
          amount,
          paid,
          unpaid,
        };
      });
      setMonthlyVolume(volume);
    } catch (error) {
      console.error("Error fetching EMI data:", error);
    } finally {
      setLoading(false);
    }
  };

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const firstDayOfMonth = getDay(startOfMonth(currentDate));

  const goToPreviousMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const goToNextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  const getStatusColor = (status: EMIDay['status'], count: number) => {
    if (status === 'none' || count === 0) return 'bg-muted/30';
    if (status === 'paid') return 'bg-green-500';
    if (status === 'overdue') return 'bg-red-500';
    return 'bg-amber-500';
  };

  if (loading) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">EMI Heatmap</h1>
          <p className="text-muted-foreground text-sm">Visual calendar of your EMI schedule</p>
        </div>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">This Month Due</p>
            <p className="text-xl font-bold text-amber-500">{formatINR(stats.totalDue)}</p>
            <p className="text-xs text-muted-foreground">{stats.upcomingCount} EMIs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Paid</p>
            <p className="text-xl font-bold text-green-500">{formatINR(stats.totalPaid)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Overdue</p>
            <p className="text-xl font-bold text-destructive">{formatINR(stats.totalOverdue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Active Loans</p>
            <p className="text-xl font-bold">{loans.filter(l => l.status === 'ACTIVE').length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Calendar Heatmap */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {format(currentDate, 'MMMM yyyy')}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={goToPreviousMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={goToNextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Week day headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {weekDays.map(day => (
              <div key={day} className="text-center text-xs text-muted-foreground font-medium py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty cells for days before month starts */}
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}

            {/* Day cells */}
            {heatmapData.map((day, idx) => (
              <motion.div
                key={format(day.date, 'yyyy-MM-dd')}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.01 }}
                className={cn(
                  "aspect-square rounded-lg flex flex-col items-center justify-center relative cursor-pointer transition-transform hover:scale-105",
                  getStatusColor(day.status, day.count)
                )}
                onClick={() => day.count > 0 && navigate('/emi-calendar')}
              >
                <span className={cn(
                  "text-sm font-medium",
                  day.status !== 'none' && day.count > 0 ? "text-white" : "text-foreground"
                )}>
                  {format(day.date, 'd')}
                </span>
                {day.count > 0 && (
                  <span className="text-[10px] text-white/80">
                    {day.count} EMI
                  </span>
                )}
              </motion.div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-green-500" />
              <span className="text-xs text-muted-foreground">Paid</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-amber-500" />
              <span className="text-xs text-muted-foreground">Due</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-red-500" />
              <span className="text-xs text-muted-foreground">Overdue</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Yearly Payment Curve */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Yearly Payment Curve</CardTitle>
              <CardDescription>EMI volume trend for {selectedYear}</CardDescription>
            </div>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2023, 2024, 2025, 2026].map(year => (
                  <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyVolume}>
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#888', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#888', fontSize: 12 }} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip 
                  formatter={(value: number) => formatINR(value)}
                  contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                />
                <Bar dataKey="paid" name="Paid" fill="#22c55e" stackId="a" radius={[0, 0, 0, 0]} />
                <Bar dataKey="unpaid" name="Unpaid" fill="hsl(var(--muted))" stackId="a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* EMI Volume Trend */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            EMI Volume Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyVolume}>
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#888', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#888', fontSize: 12 }} />
                <Tooltip />
                <Area 
                  type="monotone" 
                  dataKey="count" 
                  name="EMI Count"
                  stroke="hsl(var(--primary))" 
                  fill="hsl(var(--primary))" 
                  fillOpacity={0.2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
