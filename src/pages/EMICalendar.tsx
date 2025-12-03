import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePreferences } from "@/contexts/PreferencesContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatINR } from "@/lib/currency";
import { ChevronLeft, ChevronRight, Calendar, ArrowLeft, List } from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  isToday,
  isBefore,
  differenceInDays,
} from "date-fns";
import { fetchLoansWithAmortization, LoanWithAmortization, AmortizationRow } from "@/lib/portfolio-stats";

interface EMIEvent {
  id: string;
  loanId: string;
  loanName: string;
  lenderName: string | null;
  amount: number;
  dueDate: Date;
  isPaid: boolean;
  periodNo: number;
}

type EMIStatus = "paid" | "overdue" | "due-soon" | "upcoming";

const getEMIStatus = (emi: EMIEvent, today: Date): EMIStatus => {
  if (emi.isPaid) return "paid";
  
  const daysUntilDue = differenceInDays(emi.dueDate, today);
  
  if (daysUntilDue < 0) return "overdue";
  if (daysUntilDue <= 7) return "due-soon";
  return "upcoming";
};

const getStatusColor = (status: EMIStatus): string => {
  switch (status) {
    case "paid":
      return "bg-green-500";
    case "overdue":
      return "bg-red-500";
    case "due-soon":
      return "bg-orange-500";
    case "upcoming":
      return "bg-blue-500";
  }
};

const getStatusBadgeVariant = (status: EMIStatus): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case "paid":
      return "secondary";
    case "overdue":
      return "destructive";
    case "due-soon":
      return "default";
    case "upcoming":
      return "outline";
  }
};

const getStatusLabel = (status: EMIStatus): string => {
  switch (status) {
    case "paid":
      return "Paid";
    case "overdue":
      return "Overdue";
    case "due-soon":
      return "Due Soon";
    case "upcoming":
      return "Upcoming";
  }
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function EMICalendar() {
  const { user } = useAuth();
  const { preferences } = usePreferences();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [emiEvents, setEmiEvents] = useState<EMIEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEMIs, setSelectedEMIs] = useState<EMIEvent[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  // Use preference for default view
  const [viewMode, setViewMode] = useState<"month" | "list">(
    (preferences.default_emi_calendar_view as "month" | "list") || "month"
  );

  useEffect(() => {
    if (user) {
      fetchEMIData();

      const channel = supabase
        .channel('emi-calendar-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'loans' }, () => fetchEMIData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'amortization_rows' }, () => fetchEMIData())
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchEMIData = async () => {
    try {
      if (!user) return;

      const loans = await fetchLoansWithAmortization(user.id);
      
      const events: EMIEvent[] = [];
      
      loans.forEach(loan => {
        loan.amortization_rows?.forEach(row => {
          events.push({
            id: row.id,
            loanId: loan.id,
            loanName: loan.loan_name,
            lenderName: loan.lenders?.name || null,
            amount: row.scheduled_emi,
            dueDate: new Date(row.due_on),
            isPaid: row.is_paid || false,
            periodNo: row.period_no,
          });
        });
      });

      setEmiEvents(events);
    } catch (error) {
      console.error("Error fetching EMI data:", error);
    } finally {
      setLoading(false);
    }
  };

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  const emisByDate = useMemo(() => {
    const map = new Map<string, EMIEvent[]>();
    
    emiEvents.forEach(emi => {
      const dateKey = format(emi.dueDate, "yyyy-MM-dd");
      const existing = map.get(dateKey) || [];
      existing.push(emi);
      map.set(dateKey, existing);
    });

    return map;
  }, [emiEvents]);

  const monthStats = useMemo(() => {
    const today = new Date();
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);

    const monthEMIs = emiEvents.filter(emi => 
      emi.dueDate >= monthStart && emi.dueDate <= monthEnd
    );

    const paid = monthEMIs.filter(e => e.isPaid);
    const overdue = monthEMIs.filter(e => !e.isPaid && isBefore(e.dueDate, today));
    const pending = monthEMIs.filter(e => !e.isPaid && !isBefore(e.dueDate, today));

    return {
      total: monthEMIs.length,
      totalAmount: monthEMIs.reduce((sum, e) => sum + e.amount, 0),
      paid: paid.length,
      paidAmount: paid.reduce((sum, e) => sum + e.amount, 0),
      overdue: overdue.length,
      overdueAmount: overdue.reduce((sum, e) => sum + e.amount, 0),
      pending: pending.length,
      pendingAmount: pending.reduce((sum, e) => sum + e.amount, 0),
    };
  }, [emiEvents, currentMonth]);

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const handleToday = () => setCurrentMonth(new Date());

  const handleDayClick = (day: Date) => {
    const dateKey = format(day, "yyyy-MM-dd");
    const dayEMIs = emisByDate.get(dateKey) || [];
    
    if (dayEMIs.length > 0) {
      setSelectedDate(day);
      setSelectedEMIs(dayEMIs);
      setDialogOpen(true);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-[600px]" />
      </div>
    );
  }

  const today = new Date();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Calendar className="h-8 w-8" />
              EMI Calendar
            </h1>
            <p className="text-muted-foreground">View all your EMI payments in a calendar format</p>
          </div>
        </div>
      </div>

      {/* Month Stats */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Total EMIs</p>
            <p className="text-xl font-bold">{monthStats.total}</p>
            <p className="text-sm text-muted-foreground">{formatINR(monthStats.totalAmount)}</p>
          </CardContent>
        </Card>
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="pt-4">
            <p className="text-xs text-green-600 dark:text-green-400">Paid</p>
            <p className="text-xl font-bold text-green-600 dark:text-green-400">{monthStats.paid}</p>
            <p className="text-sm text-green-600/80 dark:text-green-400/80">{formatINR(monthStats.paidAmount)}</p>
          </CardContent>
        </Card>
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="pt-4">
            <p className="text-xs text-red-600 dark:text-red-400">Overdue</p>
            <p className="text-xl font-bold text-red-600 dark:text-red-400">{monthStats.overdue}</p>
            <p className="text-sm text-red-600/80 dark:text-red-400/80">{formatINR(monthStats.overdueAmount)}</p>
          </CardContent>
        </Card>
        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardContent className="pt-4">
            <p className="text-xs text-blue-600 dark:text-blue-400">Pending</p>
            <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{monthStats.pending}</p>
            <p className="text-sm text-blue-600/80 dark:text-blue-400/80">{formatINR(monthStats.pendingAmount)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Calendar */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">
              {format(currentMonth, "MMMM yyyy")}
            </CardTitle>
            <div className="flex items-center gap-2">
              {/* View Mode Toggle */}
              <div className="flex border rounded-md">
                <Button 
                  variant={viewMode === "month" ? "default" : "ghost"} 
                  size="sm" 
                  onClick={() => setViewMode("month")}
                  className="rounded-r-none"
                >
                  <Calendar className="h-4 w-4" />
                </Button>
                <Button 
                  variant={viewMode === "list" ? "default" : "ghost"} 
                  size="sm" 
                  onClick={() => setViewMode("list")}
                  className="rounded-l-none"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
              <Button variant="outline" size="sm" onClick={handleToday}>
                Today
              </Button>
              <Button variant="outline" size="icon" onClick={handlePrevMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={handleNextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {viewMode === "list" ? (
            /* List View */
            <div className="space-y-2">
              {emiEvents
                .filter(emi => isSameMonth(emi.dueDate, currentMonth))
                .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
                .map(emi => {
                  const status = getEMIStatus(emi, today);
                  return (
                    <div
                      key={emi.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer"
                      onClick={() => {
                        setSelectedDate(emi.dueDate);
                        setSelectedEMIs([emi]);
                        setDialogOpen(true);
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(status)}`} />
                        <div>
                          <p className="font-medium">{emi.loanName}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(emi.dueDate, "dd MMM yyyy")} • EMI #{emi.periodNo}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatINR(emi.amount)}</p>
                        <Badge variant={getStatusBadgeVariant(status)} className="text-xs">
                          {getStatusLabel(status)}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              {emiEvents.filter(emi => isSameMonth(emi.dueDate, currentMonth)).length === 0 && (
                <p className="text-center text-muted-foreground py-8">No EMIs scheduled for this month</p>
              )}
            </div>
          ) : (
            <>
          {/* Legend */}
          <div className="flex flex-wrap gap-4 mb-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span>Paid</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span>Overdue</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500" />
              <span>Due Soon (7 days)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span>Upcoming</span>
            </div>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 mb-2">
            {WEEKDAYS.map(day => (
              <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map(day => {
              const dateKey = format(day, "yyyy-MM-dd");
              const dayEMIs = emisByDate.get(dateKey) || [];
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isDayToday = isToday(day);

              return (
                <div
                  key={dateKey}
                  className={`
                    min-h-[80px] md:min-h-[100px] p-1 border rounded-lg transition-colors cursor-pointer
                    ${isCurrentMonth ? "bg-background" : "bg-muted/30"}
                    ${isDayToday ? "border-primary border-2" : "border-border"}
                    ${dayEMIs.length > 0 ? "hover:bg-accent/50" : ""}
                  `}
                  onClick={() => handleDayClick(day)}
                >
                  <div className={`text-sm font-medium mb-1 ${!isCurrentMonth ? "text-muted-foreground" : ""}`}>
                    {format(day, "d")}
                  </div>
                  <div className="space-y-1">
                    {dayEMIs.slice(0, 3).map(emi => {
                      const status = getEMIStatus(emi, today);
                      return (
                        <div
                          key={emi.id}
                          className={`
                            text-xs px-1 py-0.5 rounded truncate text-white
                            ${getStatusColor(status)}
                          `}
                          title={`${emi.loanName} - ${formatINR(emi.amount)}`}
                        >
                          <span className="hidden md:inline">{emi.loanName.slice(0, 10)}</span>
                          <span className="md:hidden">{formatINR(emi.amount)}</span>
                        </div>
                      );
                    })}
                    {dayEMIs.length > 3 && (
                      <div className="text-xs text-muted-foreground px-1">
                        +{dayEMIs.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          </>
          )}
        </CardContent>
      </Card>

      {/* EMI Details Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              EMIs on {selectedDate && format(selectedDate, "MMMM d, yyyy")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {selectedEMIs.map(emi => {
              const status = getEMIStatus(emi, today);
              return (
                <Link
                  key={emi.id}
                  to={`/loans/${emi.loanId}`}
                  className="block p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                  onClick={() => setDialogOpen(false)}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{emi.loanName}</p>
                      {emi.lenderName && (
                        <p className="text-sm text-muted-foreground">{emi.lenderName}</p>
                      )}
                      <p className="text-xs text-muted-foreground">EMI #{emi.periodNo}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatINR(emi.amount)}</p>
                      <Badge variant={getStatusBadgeVariant(status)} className="mt-1">
                        {getStatusLabel(status)}
                      </Badge>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
