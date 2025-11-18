import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Plus, Pencil, Trash2, Clock } from "lucide-react";

const ActivityLog = () => {
  const { data: activities, isLoading } = useQuery({
    queryKey: ["activity-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data;
    },
  });

  const getActionIcon = (action: string) => {
    switch (action) {
      case "CREATE":
        return <Plus className="h-3 w-3" />;
      case "UPDATE":
        return <Pencil className="h-3 w-3" />;
      case "DELETE":
        return <Trash2 className="h-3 w-3" />;
      default:
        return <FileText className="h-3 w-3" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "CREATE":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "UPDATE":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "DELETE":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getEntityLabel = (entityType: string) => {
    const labels: Record<string, string> = {
      loans: "Loan",
      payments: "Payment",
      lenders: "Lender",
      transactions: "Transaction",
      monthly_budgets: "Budget",
      bank_accounts: "Bank Account",
    };
    return labels[entityType] || entityType;
  };

  const filterByAction = (action: string | null) => {
    if (!activities) return [];
    if (!action) return activities;
    return activities.filter((a) => a.action_type === action);
  };

  const ActivityItem = ({ activity }: { activity: any }) => (
    <div className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
      <div className={`p-1.5 rounded-full ${getActionColor(activity.action_type)}`}>
        {getActionIcon(activity.action_type)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs">
            {getEntityLabel(activity.entity_type)}
          </Badge>
          <Badge className={`text-xs ${getActionColor(activity.action_type)}`}>
            {activity.action_type}
          </Badge>
        </div>
        <p className="text-sm font-medium mt-1 truncate">{activity.entity_name}</p>
        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
          <Clock className="h-3 w-3" />
          {format(new Date(activity.created_at), "MMM dd, yyyy HH:mm:ss")}
        </div>
      </div>
    </div>
  );

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Activity Log</CardTitle>
          <CardDescription>
            Complete audit trail of all create, update, and delete actions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-4">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="CREATE">Created</TabsTrigger>
              <TabsTrigger value="UPDATE">Updated</TabsTrigger>
              <TabsTrigger value="DELETE">Deleted</TabsTrigger>
            </TabsList>

            <TabsContent value="all">
              <ScrollArea className="h-[600px] pr-4">
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading...</div>
                ) : activities && activities.length > 0 ? (
                  <div className="space-y-2">
                    {activities.map((activity) => (
                      <ActivityItem key={activity.id} activity={activity} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">No activities yet</div>
                )}
              </ScrollArea>
            </TabsContent>

            {["CREATE", "UPDATE", "DELETE"].map((action) => (
              <TabsContent key={action} value={action}>
                <ScrollArea className="h-[600px] pr-4">
                  {filterByAction(action).length > 0 ? (
                    <div className="space-y-2">
                      {filterByAction(action).map((activity) => (
                        <ActivityItem key={activity.id} activity={activity} />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No {action.toLowerCase()}d activities
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default ActivityLog;