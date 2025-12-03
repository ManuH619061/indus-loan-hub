import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Edit2, Trash2, Loader2, FolderOpen, Tag } from "lucide-react";
import { toast } from "sonner";

interface ExpenseGroup {
  id: string;
  name: string;
  icon: string;
  color: string;
  display_order: number;
}

interface ExpenseSubgroup {
  id: string;
  group_id: string;
  name: string;
  icon: string;
  color: string;
  display_order: number;
  requires_location: boolean;
  requires_travel_mode: boolean;
}

interface CategoryManagerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCategoriesUpdated?: () => void;
}

export default function CategoryManagerSheet({ open, onOpenChange, onCategoriesUpdated }: CategoryManagerSheetProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<ExpenseGroup[]>([]);
  const [subgroups, setSubgroups] = useState<ExpenseSubgroup[]>([]);
  
  const [openGroupDialog, setOpenGroupDialog] = useState(false);
  const [openSubgroupDialog, setOpenSubgroupDialog] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ExpenseGroup | null>(null);
  const [editingSubgroup, setEditingSubgroup] = useState<ExpenseSubgroup | null>(null);

  const [groupForm, setGroupForm] = useState({
    name: "",
    icon: "📁",
    color: "#6366f1",
    display_order: 0,
  });

  const [subgroupForm, setSubgroupForm] = useState({
    group_id: "",
    name: "",
    icon: "🏷️",
    color: "",
    display_order: 0,
    requires_location: false,
    requires_travel_mode: false,
  });

  useEffect(() => {
    if (user && open) {
      fetchData();
    }
  }, [user, open]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: groupsData } = await supabase
        .from("expense_groups")
        .select("*")
        .eq("user_id", user.id)
        .order("display_order");

      const { data: subgroupsData } = await supabase
        .from("expense_subgroups")
        .select("*")
        .eq("user_id", user.id)
        .order("display_order");

      setGroups(groupsData || []);
      setSubgroups(subgroupsData || []);
    } catch (error) {
      toast.error("Failed to fetch categories");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenGroupDialog = (group?: ExpenseGroup) => {
    if (group) {
      setEditingGroup(group);
      setGroupForm({
        name: group.name,
        icon: group.icon,
        color: group.color,
        display_order: group.display_order,
      });
    } else {
      setEditingGroup(null);
      setGroupForm({
        name: "",
        icon: "📁",
        color: "#6366f1",
        display_order: groups.length,
      });
    }
    setOpenGroupDialog(true);
  };

  const handleSaveGroup = async () => {
    if (!user || !groupForm.name) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      const data = {
        user_id: user.id,
        ...groupForm,
      };

      if (editingGroup) {
        const { error } = await supabase
          .from("expense_groups")
          .update(data)
          .eq("id", editingGroup.id);

        if (error) throw error;
        toast.success("Group updated successfully");
      } else {
        const { error } = await supabase
          .from("expense_groups")
          .insert(data);

        if (error) throw error;
        toast.success("Group created successfully");
      }

      setOpenGroupDialog(false);
      fetchData();
      onCategoriesUpdated?.();
    } catch (error) {
      toast.error("Failed to save group");
    }
  };

  const handleDeleteGroup = async (group: ExpenseGroup) => {
    if (!confirm(`Delete "${group.name}"? This will also delete all subgroups.`)) return;

    try {
      const { error } = await supabase
        .from("expense_groups")
        .delete()
        .eq("id", group.id);

      if (error) throw error;
      toast.success("Group deleted successfully");
      fetchData();
      onCategoriesUpdated?.();
    } catch (error) {
      toast.error("Failed to delete group");
    }
  };

  const handleOpenSubgroupDialog = (subgroup?: ExpenseSubgroup) => {
    if (subgroup) {
      setEditingSubgroup(subgroup);
      setSubgroupForm({
        group_id: subgroup.group_id,
        name: subgroup.name,
        icon: subgroup.icon,
        color: subgroup.color || "",
        display_order: subgroup.display_order,
        requires_location: subgroup.requires_location,
        requires_travel_mode: subgroup.requires_travel_mode,
      });
    } else {
      setEditingSubgroup(null);
      setSubgroupForm({
        group_id: groups[0]?.id || "",
        name: "",
        icon: "🏷️",
        color: "",
        display_order: subgroups.length,
        requires_location: false,
        requires_travel_mode: false,
      });
    }
    setOpenSubgroupDialog(true);
  };

  const handleSaveSubgroup = async () => {
    if (!user || !subgroupForm.name || !subgroupForm.group_id) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      const data = {
        user_id: user.id,
        ...subgroupForm,
        color: subgroupForm.color || null,
      };

      if (editingSubgroup) {
        const { error } = await supabase
          .from("expense_subgroups")
          .update(data)
          .eq("id", editingSubgroup.id);

        if (error) throw error;
        toast.success("Subgroup updated successfully");
      } else {
        const { error } = await supabase
          .from("expense_subgroups")
          .insert(data);

        if (error) throw error;
        toast.success("Subgroup created successfully");
      }

      setOpenSubgroupDialog(false);
      fetchData();
      onCategoriesUpdated?.();
    } catch (error) {
      toast.error("Failed to save subgroup");
    }
  };

  const handleDeleteSubgroup = async (subgroup: ExpenseSubgroup) => {
    if (!confirm(`Delete "${subgroup.name}"?`)) return;

    try {
      const { error } = await supabase
        .from("expense_subgroups")
        .delete()
        .eq("id", subgroup.id);

      if (error) throw error;
      toast.success("Subgroup deleted successfully");
      fetchData();
      onCategoriesUpdated?.();
    } catch (error) {
      toast.error("Failed to delete subgroup");
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Category Manager</SheetTitle>
            <SheetDescription>Manage expense groups and subgroups</SheetDescription>
          </SheetHeader>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-6 py-6">
              {/* Groups Section */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FolderOpen className="h-4 w-4" />
                      Expense Groups
                    </CardTitle>
                    <Button size="sm" onClick={() => handleOpenGroupDialog()}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {groups.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No groups yet. Create your first expense group.
                    </p>
                  ) : (
                    groups.map((group) => (
                      <div
                        key={group.id}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{group.icon}</span>
                          <div>
                            <div className="font-medium">{group.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {subgroups.filter(s => s.group_id === group.id).length} subcategories
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <div
                            className="h-4 w-4 rounded-full border"
                            style={{ backgroundColor: group.color }}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleOpenGroupDialog(group)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleDeleteGroup(group)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Subgroups Section */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Tag className="h-4 w-4" />
                      Subcategories
                    </CardTitle>
                    <Button size="sm" onClick={() => handleOpenSubgroupDialog()} disabled={groups.length === 0}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {subgroups.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {groups.length === 0 
                        ? "Create a group first to add subcategories"
                        : "No subcategories yet. Add subcategories to organize expenses."}
                    </p>
                  ) : (
                    subgroups.map((subgroup) => {
                      const group = groups.find((g) => g.id === subgroup.group_id);
                      return (
                        <div
                          key={subgroup.id}
                          className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-xl">{subgroup.icon}</span>
                            <div>
                              <div className="font-medium">{subgroup.name}</div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {group?.icon} {group?.name}
                                </Badge>
                                {subgroup.requires_location && (
                                  <Badge variant="secondary" className="text-xs">📍</Badge>
                                )}
                                {subgroup.requires_travel_mode && (
                                  <Badge variant="secondary" className="text-xs">🚗</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleOpenSubgroupDialog(subgroup)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => handleDeleteSubgroup(subgroup)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Group Dialog */}
      <Dialog open={openGroupDialog} onOpenChange={setOpenGroupDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingGroup ? "Edit Group" : "Add New Group"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Group Name *</Label>
              <Input
                value={groupForm.name}
                onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                placeholder="e.g., Travel & Transport"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Icon (Emoji) *</Label>
                <Input
                  value={groupForm.icon}
                  onChange={(e) => setGroupForm({ ...groupForm, icon: e.target.value })}
                  placeholder="🚗"
                  maxLength={2}
                />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <Input
                  type="color"
                  value={groupForm.color}
                  onChange={(e) => setGroupForm({ ...groupForm, color: e.target.value })}
                  className="h-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Display Order</Label>
              <Input
                type="number"
                value={groupForm.display_order}
                onChange={(e) =>
                  setGroupForm({ ...groupForm, display_order: Number(e.target.value) })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenGroupDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveGroup}>Save Group</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Subgroup Dialog */}
      <Dialog open={openSubgroupDialog} onOpenChange={setOpenSubgroupDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSubgroup ? "Edit Subcategory" : "Add New Subcategory"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Parent Group *</Label>
              <Select
                value={subgroupForm.group_id}
                onValueChange={(value) => setSubgroupForm({ ...subgroupForm, group_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select group" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.icon} {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Subcategory Name *</Label>
              <Input
                value={subgroupForm.name}
                onChange={(e) => setSubgroupForm({ ...subgroupForm, name: e.target.value })}
                placeholder="e.g., Uber / Ola"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Icon (Emoji) *</Label>
                <Input
                  value={subgroupForm.icon}
                  onChange={(e) => setSubgroupForm({ ...subgroupForm, icon: e.target.value })}
                  placeholder="🚕"
                  maxLength={2}
                />
              </div>
              <div className="space-y-2">
                <Label>Display Order</Label>
                <Input
                  type="number"
                  value={subgroupForm.display_order}
                  onChange={(e) =>
                    setSubgroupForm({ ...subgroupForm, display_order: Number(e.target.value) })
                  }
                />
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="requires_location" className="cursor-pointer">
                  Requires Location (From/To)
                </Label>
                <Switch
                  id="requires_location"
                  checked={subgroupForm.requires_location}
                  onCheckedChange={(checked) =>
                    setSubgroupForm({ ...subgroupForm, requires_location: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="requires_travel_mode" className="cursor-pointer">
                  Requires Travel Mode/App
                </Label>
                <Switch
                  id="requires_travel_mode"
                  checked={subgroupForm.requires_travel_mode}
                  onCheckedChange={(checked) =>
                    setSubgroupForm({ ...subgroupForm, requires_travel_mode: checked })
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenSubgroupDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSubgroup}>Save Subcategory</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
