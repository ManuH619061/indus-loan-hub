import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Edit } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface BankRule {
  id: string;
  rule_name: string;
  bank_account_id: string | null;
  priority: number;
  is_active: boolean;
  condition_type: string;
  condition_field: string;
  condition_value: string;
  action_type: string;
  action_category: string | null;
  action_subcategory: string | null;
}

export default function BankRules() {
  const [rules, setRules] = useState<BankRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<BankRule | null>(null);
  const { toast } = useToast();

  // Form state
  const [ruleName, setRuleName] = useState("");
  const [priority, setPriority] = useState(0);
  const [conditionType, setConditionType] = useState("CONTAINS");
  const [conditionField, setConditionField] = useState("NARRATION");
  const [conditionValue, setConditionValue] = useState("");
  const [actionType, setActionType] = useState("CATEGORIZE");
  const [actionCategory, setActionCategory] = useState("");
  const [actionSubcategory, setActionSubcategory] = useState("");

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("bank_rules")
        .select("*")
        .eq("user_id", user.id)
        .order("priority", { ascending: true });

      if (error) throw error;
      setRules(data || []);
    } catch (error) {
      console.error("Error fetching rules:", error);
      toast({ title: "Error loading rules", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRule = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const ruleData = {
        user_id: user.id,
        rule_name: ruleName,
        priority,
        condition_type: conditionType,
        condition_field: conditionField,
        condition_value: conditionValue,
        action_type: actionType,
        action_category: actionCategory || null,
        action_subcategory: actionSubcategory || null,
        is_active: true,
      };

      if (editingRule) {
        const { error } = await supabase
          .from("bank_rules")
          .update(ruleData)
          .eq("id", editingRule.id);
        if (error) throw error;
        toast({ title: "Rule updated successfully" });
      } else {
        const { error } = await supabase.from("bank_rules").insert(ruleData);
        if (error) throw error;
        toast({ title: "Rule created successfully" });
      }

      resetForm();
      setIsDialogOpen(false);
      fetchRules();
    } catch (error) {
      console.error("Error saving rule:", error);
      toast({ title: "Error saving rule", variant: "destructive" });
    }
  };

  const handleDeleteRule = async (id: string) => {
    try {
      const { error } = await supabase.from("bank_rules").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Rule deleted successfully" });
      fetchRules();
    } catch (error) {
      console.error("Error deleting rule:", error);
      toast({ title: "Error deleting rule", variant: "destructive" });
    }
  };

  const handleToggleRule = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from("bank_rules")
        .update({ is_active: isActive })
        .eq("id", id);
      if (error) throw error;
      toast({ title: `Rule ${isActive ? "enabled" : "disabled"}` });
      fetchRules();
    } catch (error) {
      console.error("Error toggling rule:", error);
      toast({ title: "Error updating rule", variant: "destructive" });
    }
  };

  const resetForm = () => {
    setRuleName("");
    setPriority(0);
    setConditionType("CONTAINS");
    setConditionField("NARRATION");
    setConditionValue("");
    setActionType("CATEGORIZE");
    setActionCategory("");
    setActionSubcategory("");
    setEditingRule(null);
  };

  const handleEditRule = (rule: BankRule) => {
    setEditingRule(rule);
    setRuleName(rule.rule_name);
    setPriority(rule.priority);
    setConditionType(rule.condition_type);
    setConditionField(rule.condition_field);
    setConditionValue(rule.condition_value);
    setActionType(rule.action_type);
    setActionCategory(rule.action_category || "");
    setActionSubcategory(rule.action_subcategory || "");
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Bank Rules Automation</h1>
          <p className="text-muted-foreground mt-1">Create rules to automatically categorize and match transactions</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Add Rule
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingRule ? "Edit Rule" : "Create New Rule"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Rule Name</Label>
                <Input
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  placeholder="e.g., Categorize Swiggy as Food"
                />
              </div>

              <div className="space-y-2">
                <Label>Priority (lower runs first)</Label>
                <Input
                  type="number"
                  value={priority}
                  onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
                />
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">Condition</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label>Field</Label>
                    <Select value={conditionField} onValueChange={setConditionField}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NARRATION">Narration</SelectItem>
                        <SelectItem value="REFERENCE">Reference</SelectItem>
                        <SelectItem value="DEBIT">Debit Amount</SelectItem>
                        <SelectItem value="CREDIT">Credit Amount</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Condition</Label>
                    <Select value={conditionType} onValueChange={setConditionType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CONTAINS">Contains</SelectItem>
                        <SelectItem value="STARTS_WITH">Starts With</SelectItem>
                        <SelectItem value="ENDS_WITH">Ends With</SelectItem>
                        <SelectItem value="EQUALS">Equals</SelectItem>
                        <SelectItem value="REGEX">Regex Match</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Value</Label>
                    <Input
                      value={conditionValue}
                      onChange={(e) => setConditionValue(e.target.value)}
                      placeholder="e.g., SWIGGY"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">Action</h3>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Action Type</Label>
                    <Select value={actionType} onValueChange={setActionType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CATEGORIZE">Categorize</SelectItem>
                        <SelectItem value="MARK_EMI">Mark as EMI</SelectItem>
                        <SelectItem value="MARK_TRANSFER">Mark as Transfer</SelectItem>
                        <SelectItem value="MARK_INCOME">Mark as Income</SelectItem>
                        <SelectItem value="MARK_EXPENSE">Mark as Expense</SelectItem>
                        <SelectItem value="EXCLUDE">Exclude from Reconciliation</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {actionType === "CATEGORIZE" && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Category</Label>
                        <Input
                          value={actionCategory}
                          onChange={(e) => setActionCategory(e.target.value)}
                          placeholder="e.g., Expense"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Subcategory</Label>
                        <Input
                          value={actionSubcategory}
                          onChange={(e) => setActionSubcategory(e.target.value)}
                          placeholder="e.g., Food & Dining"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveRule}>
                  {editingRule ? "Update Rule" : "Create Rule"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-center py-12">Loading rules...</div>
      ) : rules.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <h3 className="text-lg font-semibold mb-2">No rules created</h3>
            <p className="text-muted-foreground mb-4">Create automation rules to streamline your reconciliation</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <Card key={rule.id}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <Switch
                      checked={rule.is_active}
                      onCheckedChange={(checked) => handleToggleRule(rule.id, checked)}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{rule.rule_name}</h3>
                        <Badge variant="outline">Priority: {rule.priority}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        If <span className="font-medium">{rule.condition_field}</span>{" "}
                        <span className="font-medium">{rule.condition_type.toLowerCase()}</span>{" "}
                        "<span className="font-medium">{rule.condition_value}</span>"
                        {" → "}
                        <span className="font-medium">{rule.action_type.replace("_", " ")}</span>
                        {rule.action_category && ` (${rule.action_category}${rule.action_subcategory ? ` - ${rule.action_subcategory}` : ""})`}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="icon" variant="ghost" onClick={() => handleEditRule(rule)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => handleDeleteRule(rule.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
