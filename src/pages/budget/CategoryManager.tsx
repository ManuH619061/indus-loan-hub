import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Edit2, Trash2, Loader2, FolderOpen, Tag } from "lucide-react";
import { toast } from "sonner";
import FadeInStagger from "@/components/FadeInStagger";

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

export default function CategoryManager() {
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
    if (user) {
      fetchData();
    }
  }, [user]);

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
        color: subgroup.color,
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
    } catch (error) {
      toast.error("Failed to delete subgroup");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Category Manager</h1>
          <p className="text-muted-foreground">Manage expense groups and subgroups</p>
        </div>
      </div>

      <FadeInStagger>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FolderOpen className="h-5 w-5" />
                  Expense Groups
                </CardTitle>
                <CardDescription>Top-level expense categories</CardDescription>
              </div>
              <Button onClick={() => handleOpenGroupDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Add Group
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Icon</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((group) => (
                  <TableRow key={group.id}>
                    <TableCell className="text-2xl">{group.icon}</TableCell>
                    <TableCell className="font-medium">{group.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-6 w-6 rounded border"
                          style={{ backgroundColor: group.color }}
                        />
                        <span className="text-sm text-muted-foreground">{group.color}</span>
                      </div>
                    </TableCell>
                    <TableCell>{group.display_order}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenGroupDialog(group)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteGroup(group)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Tag className="h-5 w-5" />
                  Expense Subgroups
                </CardTitle>
                <CardDescription>Detailed expense categories within groups</CardDescription>
              </div>
              <Button onClick={() => handleOpenSubgroupDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Add Subgroup
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Icon</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Group</TableHead>
                  <TableHead>Special Fields</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subgroups.map((subgroup) => {
                  const group = groups.find((g) => g.id === subgroup.group_id);
                  return (
                    <TableRow key={subgroup.id}>
                      <TableCell className="text-2xl">{subgroup.icon}</TableCell>
                      <TableCell className="font-medium">{subgroup.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {group?.icon} {group?.name}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {subgroup.requires_location && (
                            <Badge variant="secondary" className="text-xs">
                              Location
                            </Badge>
                          )}
                          {subgroup.requires_travel_mode && (
                            <Badge variant="secondary" className="text-xs">
                              Travel Mode
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenSubgroupDialog(subgroup)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteSubgroup(subgroup)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </FadeInStagger>

      {/* Group Dialog */}
      <Dialog open={openGroupDialog} onOpenChange={setOpenGroupDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingGroup ? "Edit Group" : "Add New Group"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Group Name*</Label>
              <Input
                value={groupForm.name}
                onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                placeholder="e.g., Travel & Transport"
              />
            </div>
            <div>
              <Label>Icon (Emoji)*</Label>
              <Input
                value={groupForm.icon}
                onChange={(e) => setGroupForm({ ...groupForm, icon: e.target.value })}
                placeholder="🚗"
                maxLength={2}
              />
            </div>
            <div>
              <Label>Color</Label>
              <Input
                type="color"
                value={groupForm.color}
                onChange={(e) => setGroupForm({ ...groupForm, color: e.target.value })}
              />
            </div>
            <div>
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
              {editingSubgroup ? "Edit Subgroup" : "Add New Subgroup"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Parent Group*</Label>
              <select
                className="w-full p-2 border rounded"
                value={subgroupForm.group_id}
                onChange={(e) => setSubgroupForm({ ...subgroupForm, group_id: e.target.value })}
              >
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.icon} {group.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Subgroup Name*</Label>
              <Input
                value={subgroupForm.name}
                onChange={(e) => setSubgroupForm({ ...subgroupForm, name: e.target.value })}
                placeholder="e.g., Uber / Ola"
              />
            </div>
            <div>
              <Label>Icon (Emoji)*</Label>
              <Input
                value={subgroupForm.icon}
                onChange={(e) => setSubgroupForm({ ...subgroupForm, icon: e.target.value })}
                placeholder="🚕"
                maxLength={2}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Requires Location Fields</Label>
              <Switch
                checked={subgroupForm.requires_location}
                onCheckedChange={(checked) =>
                  setSubgroupForm({ ...subgroupForm, requires_location: checked })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Requires Travel Mode Field</Label>
              <Switch
                checked={subgroupForm.requires_travel_mode}
                onCheckedChange={(checked) =>
                  setSubgroupForm({ ...subgroupForm, requires_travel_mode: checked })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenSubgroupDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSubgroup}>Save Subgroup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
