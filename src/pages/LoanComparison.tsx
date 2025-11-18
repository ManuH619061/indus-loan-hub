import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { ResponsiveChartLegacy } from "@/components/ui/responsive-chart";
import MultiLenderSelector from "@/components/MultiLenderSelector";
import FadeInStagger from "@/components/FadeInStagger";
import { calculateReducingEMI, calculateTotalInterest } from "@/lib/emi-calculator";
import { formatINR, formatPercent } from "@/lib/currency";
import { getCategoryLabel, getCategoryColor } from "@/lib/loan-apps-library";
import type { LoanAppLibraryItem } from "@/lib/loan-apps-library";

export default function LoanComparison() {
  const [selectedApps, setSelectedApps] = useState<LoanAppLibraryItem[]>([]);
  const [loanAmount, setLoanAmount] = useState<number>(100000);
  const [tenureMonths, setTenureMonths] = useState<number>(12);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const comparisonData = useMemo(() => {
    return selectedApps.map((app) => {
      const avgInterest = (app.typical_interest_min + app.typical_interest_max) / 2;
      const emi = calculateReducingEMI(loanAmount, avgInterest, tenureMonths);
      const totalInterest = calculateTotalInterest(loanAmount, emi, tenureMonths);
      const totalCost = loanAmount + totalInterest;

      return {
        id: app.id,
        name: app.name,
        category: app.category,
        logo_url: app.logo_url,
        minInterest: app.typical_interest_min,
        maxInterest: app.typical_interest_max,
        avgInterest,
        emi,
        totalInterest,
        totalCost,
      };
    });
  }, [selectedApps, loanAmount, tenureMonths]);

  const chartData = comparisonData.map((data) => ({
    name: data.name,
    EMI: data.emi,
    "Total Interest": data.totalInterest,
    "Total Cost": data.totalCost,
  }));

  const filteredComparison =
    categoryFilter === "all"
      ? comparisonData
      : comparisonData.filter((d) => d.category === categoryFilter);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold">Loan Comparison Tool</h1>
        <p className="text-muted-foreground mt-2">
          Compare interest rates, EMIs, and total costs across lenders
        </p>
      </div>

      <FadeInStagger>
        <Card>
          <CardHeader>
            <CardTitle>Comparison Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="loanAmount">Loan Amount (₹)</Label>
                <Input
                  id="loanAmount"
                  type="number"
                  value={loanAmount}
                  onChange={(e) => setLoanAmount(Number(e.target.value))}
                  min={1000}
                  step={1000}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tenure">Tenure (Months)</Label>
                <Input
                  id="tenure"
                  type="number"
                  value={tenureMonths}
                  onChange={(e) => setTenureMonths(Number(e.target.value))}
                  min={1}
                  max={360}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category Filter</Label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="BANK">Banks</SelectItem>
                    <SelectItem value="NBFC">NBFCs</SelectItem>
                    <SelectItem value="INSTANT_LOAN">Instant Loans</SelectItem>
                    <SelectItem value="CREDIT_CARD">Credit Cards</SelectItem>
                    <SelectItem value="BNPL">Buy Now Pay Later</SelectItem>
                    <SelectItem value="SALARY_ADVANCE">Salary Advance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <MultiLenderSelector
              selectedApps={selectedApps}
              onSelectionChange={setSelectedApps}
              maxSelection={4}
            />
          </CardContent>
        </Card>

        {filteredComparison.length > 0 && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Visual Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveChartLegacy height={300} minHeight={250}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "6px",
                      }}
                      formatter={(value: number) => formatINR(value)}
                    />
                    <Legend />
                    <Bar dataKey="EMI" fill="hsl(var(--primary))" />
                    <Bar dataKey="Total Interest" fill="hsl(var(--destructive))" />
                    <Bar dataKey="Total Cost" fill="hsl(var(--warning))" />
                  </BarChart>
                </ResponsiveChartLegacy>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              {filteredComparison.map((data) => (
                <Card key={data.id}>
                  <CardHeader>
                    <div className="flex items-start gap-3">
                      {data.logo_url ? (
                        <img
                          src={data.logo_url}
                          alt={data.name}
                          className="w-12 h-12 rounded-lg object-contain"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center text-lg font-semibold">
                          {data.name.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1">
                        <CardTitle className="text-lg">{data.name}</CardTitle>
                        <Badge
                          variant="outline"
                          className={`mt-1 ${getCategoryColor(data.category)}`}
                        >
                          {getCategoryLabel(data.category)}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Interest Range</span>
                      <span className="font-semibold">
                        {formatPercent(data.minInterest, 2)} - {formatPercent(data.maxInterest, 2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Avg. Interest</span>
                      <span className="font-semibold">{formatPercent(data.avgInterest, 2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Monthly EMI</span>
                      <span className="font-semibold text-primary">{formatINR(data.emi)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Interest</span>
                      <span className="font-semibold text-destructive">
                        {formatINR(data.totalInterest)}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2 border-t">
                      <span className="font-medium">Total Cost</span>
                      <span className="font-bold text-lg">{formatINR(data.totalCost)}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}

        {selectedApps.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Select lenders above to start comparing loan offers
            </CardContent>
          </Card>
        )}
      </FadeInStagger>
    </div>
  );
}
