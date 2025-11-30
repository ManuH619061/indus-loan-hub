import { useState, useEffect } from "react";
import { format, isSameMonth, parseISO, startOfMonth } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatINR } from "@/lib/currency";
import { CalendarCheck, Loader2, CheckCircle2, Circle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface AmortizationRow {
  id: string;
  period_no: number;
  due_on: string;
  scheduled_emi: number;
  principal_component: number;
  interest_component: number;
  is_paid: boolean;
}

interface BulkEMIMarkerProps {
  loanId: string;
  loanName: string;
  amortization: AmortizationRow[];
  onUpdate: () => void;
}

export default function BulkEMIMarker({ loanId, loanName, amortization, onUpdate }: BulkEMIMarkerProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedPeriods, setSelectedPeriods] = useState<Set<number>>(new Set());
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());

  // Initialize selected periods from currently paid EMIs
  useEffect(() => {
    const paidPeriods = new Set(
      amortization.filter(row => row.is_paid).map(row => row.period_no)
    );
    setSelectedPeriods(paidPeriods);
  }, [amortization, open]);

  // Get dates that have EMIs
  const emiDates = amortization.map(row => ({
    date: parseISO(row.due_on),
    periodNo: row.period_no,
    isPaid: row.is_paid,
    isSelected: selectedPeriods.has(row.period_no),
    emi: row.scheduled_emi,
  }));

  const togglePeriod = (periodNo: number) => {
    const newSelected = new Set(selectedPeriods);
    if (newSelected.has(periodNo)) {
      newSelected.delete(periodNo);
    } else {
      newSelected.add(periodNo);
    }
    setSelectedPeriods(newSelected);
  };

  const selectAll = () => {
    setSelectedPeriods(new Set(amortization.map(row => row.period_no)));
  };

  const deselectAll = () => {
    setSelectedPeriods(new Set());
  };

  const selectUpToPeriod = (periodNo: number) => {
    const newSelected = new Set<number>();
    amortization.forEach(row => {
      if (row.period_no <= periodNo) {
        newSelected.add(row.period_no);
      }
    });
    setSelectedPeriods(newSelected);
  };

  // Calculate changes
  const currentlyPaid = new Set(amortization.filter(r => r.is_paid).map(r => r.period_no));
  const toMarkAsPaid = [...selectedPeriods].filter(p => !currentlyPaid.has(p));
  const toMarkAsUnpaid = [...currentlyPaid].filter(p => !selectedPeriods.has(p));
  const hasChanges = toMarkAsPaid.length > 0 || toMarkAsUnpaid.length > 0;

  const totalToAdd = toMarkAsPaid.reduce((sum, periodNo) => {
    const row = amortization.find(r => r.period_no === periodNo);
    return sum + (row?.scheduled_emi || 0);
  }, 0);

  const totalToRemove = toMarkAsUnpaid.reduce((sum, periodNo) => {
    const row = amortization.find(r => r.period_no === periodNo);
    return sum + (row?.scheduled_emi || 0);
  }, 0);

  const handleApplyChanges = async () => {
    setLoading(true);
    try {
      // Mark new periods as paid (create payments)
      if (toMarkAsPaid.length > 0) {
        const rowsToMark = amortization.filter(r => toMarkAsPaid.includes(r.period_no));
        
        const newPayments = rowsToMark.map(row => ({
          loan_id: loanId,
          paid_on: row.due_on,
          amount: row.scheduled_emi,
          payment_type: "EMI" as const,
          source: "OTHER" as const,
          reference: `Bulk mark - Period ${row.period_no}`,
          notes: "Bulk marked as paid via calendar view",
        }));

        const { error: paymentError } = await supabase
          .from("payments")
          .insert(newPayments);

        if (paymentError) throw paymentError;

        const { error: updateError } = await supabase
          .from("amortization_rows")
          .update({ is_paid: true })
          .in("id", rowsToMark.map(r => r.id));

        if (updateError) throw updateError;
      }

      // Mark periods as unpaid (remove payments)
      if (toMarkAsUnpaid.length > 0) {
        const rowsToUnmark = amortization.filter(r => toMarkAsUnpaid.includes(r.period_no));

        for (const row of rowsToUnmark) {
          await supabase
            .from("payments")
            .delete()
            .eq("loan_id", loanId)
            .eq("paid_on", row.due_on)
            .eq("payment_type", "EMI");
        }

        const { error: updateError } = await supabase
          .from("amortization_rows")
          .update({ is_paid: false })
          .in("id", rowsToUnmark.map(r => r.id));

        if (updateError) throw updateError;
      }

      toast({
        title: "EMIs Updated",
        description: `${toMarkAsPaid.length} marked as paid, ${toMarkAsUnpaid.length} marked as unpaid`,
      });

      onUpdate();
      setOpen(false);
    } catch (error: any) {
      console.error("Error updating EMIs:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  // Custom day content for the calendar
  const getDayContent = (day: Date) => {
    const emiDate = emiDates.find(e => 
      e.date.getDate() === day.getDate() && 
      isSameMonth(e.date, day)
    );
    
    if (!emiDate) return null;

    return (
      <div 
        className={cn(
          "relative w-full h-full flex items-center justify-center rounded-md cursor-pointer transition-colors",
          emiDate.isSelected 
            ? "bg-primary text-primary-foreground" 
            : "bg-muted hover:bg-muted/80"
        )}
        onClick={(e) => {
          e.stopPropagation();
          togglePeriod(emiDate.periodNo);
        }}
      >
        <span>{day.getDate()}</span>
        {emiDate.isSelected && (
          <CheckCircle2 className="absolute -top-1 -right-1 h-3 w-3 text-primary-foreground" />
        )}
      </div>
    );
  };

  const paidCount = selectedPeriods.size;
  const totalCount = amortization.length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <CalendarCheck className="h-4 w-4" />
          Bulk Mark EMIs
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5" />
            Bulk Mark EMIs as Paid
          </DialogTitle>
          <DialogDescription>
            Select which EMI periods to mark as paid for "{loanName}"
          </DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-6 py-4">
          {/* Calendar View */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-sm">Calendar View</h3>
              <Badge variant="outline">
                {paidCount} / {totalCount} paid
              </Badge>
            </div>
            <Calendar
              mode="single"
              month={calendarMonth}
              onMonthChange={setCalendarMonth}
              className="rounded-md border pointer-events-auto"
              modifiers={{
                emiDay: emiDates.map(e => e.date),
                paidDay: emiDates.filter(e => e.isSelected).map(e => e.date),
              }}
              modifiersClassNames={{
                emiDay: "font-bold",
                paidDay: "bg-primary/20",
              }}
              components={{
                DayContent: ({ date }) => {
                  const emiDate = emiDates.find(e => 
                    e.date.getDate() === date.getDate() && 
                    isSameMonth(e.date, date)
                  );
                  
                  if (emiDate) {
                    return (
                      <div 
                        className={cn(
                          "w-8 h-8 flex items-center justify-center rounded-full cursor-pointer transition-all",
                          emiDate.isSelected 
                            ? "bg-primary text-primary-foreground font-bold" 
                            : "bg-muted hover:bg-accent font-medium"
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePeriod(emiDate.periodNo);
                        }}
                      >
                        {date.getDate()}
                      </div>
                    );
                  }
                  
                  return <span className="text-muted-foreground">{date.getDate()}</span>;
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              Click on highlighted dates to toggle EMI payment status
            </p>
          </div>

          {/* List View */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-sm">EMI List</h3>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAll}>
                  Select All
                </Button>
                <Button variant="outline" size="sm" onClick={deselectAll}>
                  Clear
                </Button>
              </div>
            </div>
            <ScrollArea className="h-[300px] border rounded-lg">
              <div className="p-2 space-y-1">
                {amortization.map((row) => (
                  <div
                    key={row.id}
                    className={cn(
                      "flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors",
                      selectedPeriods.has(row.period_no)
                        ? "bg-primary/10 border border-primary/20"
                        : "hover:bg-muted"
                    )}
                    onClick={() => togglePeriod(row.period_no)}
                  >
                    <Checkbox
                      checked={selectedPeriods.has(row.period_no)}
                      onCheckedChange={() => togglePeriod(row.period_no)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">Period {row.period_no}</span>
                        {row.is_paid && (
                          <Badge variant="secondary" className="text-xs">Currently Paid</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Due: {format(parseISO(row.due_on), "dd MMM yyyy")}
                      </p>
                    </div>
                    <span className="font-medium text-sm">{formatINR(row.scheduled_emi)}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
            
            {/* Quick select buttons */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Quick select up to period:</p>
              <div className="flex flex-wrap gap-1">
                {[3, 6, 12, 24].filter(n => n <= totalCount).map(n => (
                  <Button
                    key={n}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => selectUpToPeriod(n)}
                  >
                    {n} months
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Changes Preview */}
        {hasChanges && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-primary mt-0.5" />
                <div className="flex-1 space-y-2">
                  <p className="font-medium text-sm">Changes to be applied:</p>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {toMarkAsPaid.length > 0 && (
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>{toMarkAsPaid.length} to mark as paid ({formatINR(totalToAdd)})</span>
                      </div>
                    )}
                    {toMarkAsUnpaid.length > 0 && (
                      <div className="flex items-center gap-2 text-amber-600">
                        <Circle className="h-4 w-4" />
                        <span>{toMarkAsUnpaid.length} to mark as unpaid ({formatINR(totalToRemove)})</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleApplyChanges} 
            disabled={!hasChanges || loading}
            className="gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <CalendarCheck className="h-4 w-4" />
                Apply Changes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
