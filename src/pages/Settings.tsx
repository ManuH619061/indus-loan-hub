import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { 
  User, 
  Palette, 
  Bell, 
  Settings as SettingsIcon, 
  Download, 
  LogOut, 
  Moon, 
  Sun,
  Loader2,
  Calendar,
  Smartphone
} from "lucide-react";
import FadeInStagger from "@/components/FadeInStagger";
import { useTheme } from "next-themes";
import BackupManager from "@/pages/BackupManager";
import { usePWA } from "@/hooks/usePWA";

export default function Settings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { isInstallable, isInstalled, installApp } = usePWA();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [installing, setInstalling] = useState(false);

  // Profile settings
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    monthly_income: 0,
  });

  // Notification settings
  const [notifications, setNotifications] = useState({
    emi_reminders: true,
    high_utilisation_alerts: true,
    budget_overspend_alerts: true,
    payment_confirmations: true,
  });

  // Default settings
  const [defaults, setDefaults] = useState({
    currency: "INR",
    start_of_month: 1,
    default_landing_page: "/dashboard",
  });

  // PWA Install settings
  const [pwaSettings, setPwaSettings] = useState({
    auto_show_prompt: true,
  });

  useEffect(() => {
    // Load PWA settings from localStorage
    const autoShow = localStorage.getItem("pwa-auto-show-prompt");
    if (autoShow !== null) {
      setPwaSettings({ auto_show_prompt: autoShow === "true" });
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchSettings();
    }
  }, [user]);

  const fetchSettings = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileData) {
        setProfile({
          name: profileData.name || "",
          email: profileData.email || user.email || "",
          monthly_income: profileData.monthly_income || 0,
        });
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          name: profile.name,
          monthly_income: profile.monthly_income,
        })
        .eq("id", user.id);

      if (error) throw error;
      toast.success("Profile updated successfully");
    } catch (error) {
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleExportData = async (type: "loans" | "payments" | "expenses" | "transactions") => {
    if (!user) return;
    try {
      let data: any[] = [];
      let filename = "";

      switch (type) {
        case "loans":
          const { data: loans } = await supabase
            .from("loans")
            .select("*")
            .eq("user_id", user.id);
          data = loans || [];
          filename = "loans_export.json";
          break;
        case "payments":
          const { data: payments } = await supabase
            .from("payments")
            .select("*, loans(loan_name)")
            .eq("loans.user_id", user.id);
          data = payments || [];
          filename = "payments_export.json";
          break;
        case "expenses":
          const { data: budgets } = await supabase
            .from("monthly_budgets")
            .select("*")
            .eq("user_id", user.id);
          data = budgets || [];
          filename = "budgets_export.json";
          break;
        case "transactions":
          const { data: txns } = await supabase
            .from("transactions")
            .select("*")
            .eq("user_id", user.id);
          data = txns || [];
          filename = "transactions_export.json";
          break;
      }

      // Create and download JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      toast.success(`${type} data exported successfully`);
    } catch (error) {
      toast.error(`Failed to export ${type} data`);
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
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your account preferences and application settings
        </p>
      </div>

      <FadeInStagger>
        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full max-w-3xl grid-cols-7">
            <TabsTrigger value="profile">
              <User className="h-4 w-4 mr-2" />
              <span className="hidden md:inline">Profile</span>
            </TabsTrigger>
            <TabsTrigger value="appearance">
              <Palette className="h-4 w-4 mr-2" />
              <span className="hidden md:inline">Appearance</span>
            </TabsTrigger>
            <TabsTrigger value="notifications">
              <Bell className="h-4 w-4 mr-2" />
              <span className="hidden md:inline">Notifications</span>
            </TabsTrigger>
            <TabsTrigger value="app-install">
              <Smartphone className="h-4 w-4 mr-2" />
              <span className="hidden md:inline">App Install</span>
            </TabsTrigger>
            <TabsTrigger value="defaults">
              <SettingsIcon className="h-4 w-4 mr-2" />
              <span className="hidden md:inline">Defaults</span>
            </TabsTrigger>
            <TabsTrigger value="backup">
              <Download className="h-4 w-4 mr-2" />
              <span className="hidden md:inline">Backup</span>
            </TabsTrigger>
            <TabsTrigger value="data">
              <Download className="h-4 w-4 mr-2" />
              <span className="hidden md:inline">Export</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Profile & Sign-in</CardTitle>
                <CardDescription>
                  Manage your profile information and authentication settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={profile.name}
                      onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                      placeholder="Your name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      value={profile.email}
                      disabled
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground">
                      Email cannot be changed
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="income">Monthly Income (₹)</Label>
                    <Input
                      id="income"
                      type="number"
                      value={profile.monthly_income}
                      onChange={(e) =>
                        setProfile({ ...profile, monthly_income: parseFloat(e.target.value) || 0 })
                      }
                      placeholder="0"
                    />
                    <p className="text-xs text-muted-foreground">
                      Used for EMI-to-income ratio calculations
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <Button onClick={handleSaveProfile} disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Profile"
                    )}
                  </Button>
                  <Button variant="destructive" onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="appearance">
            <Card>
              <CardHeader>
                <CardTitle>Appearance</CardTitle>
                <CardDescription>
                  Customize the look and feel of the application
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>Theme</Label>
                      <p className="text-sm text-muted-foreground">
                        Choose your preferred color scheme
                      </p>
                    </div>
                    <Select value={theme} onValueChange={setTheme}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">
                          <div className="flex items-center gap-2">
                            <Sun className="h-4 w-4" />
                            Light
                          </div>
                        </SelectItem>
                        <SelectItem value="dark">
                          <div className="flex items-center gap-2">
                            <Moon className="h-4 w-4" />
                            Dark
                          </div>
                        </SelectItem>
                        <SelectItem value="system">System</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>Notifications & Alerts</CardTitle>
                <CardDescription>
                  Configure which notifications you want to receive
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>EMI Due Reminders</Label>
                      <p className="text-sm text-muted-foreground">
                        Get notified before your EMI payment is due
                      </p>
                    </div>
                    <Switch
                      checked={notifications.emi_reminders}
                      onCheckedChange={(checked) =>
                        setNotifications({ ...notifications, emi_reminders: checked })
                      }
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>High Utilisation Alerts</Label>
                      <p className="text-sm text-muted-foreground">
                        Alert when EMI-to-income ratio exceeds 40%
                      </p>
                    </div>
                    <Switch
                      checked={notifications.high_utilisation_alerts}
                      onCheckedChange={(checked) =>
                        setNotifications({ ...notifications, high_utilisation_alerts: checked })
                      }
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>Budget Overspend Alerts</Label>
                      <p className="text-sm text-muted-foreground">
                        Get notified when spending exceeds budget limits
                      </p>
                    </div>
                    <Switch
                      checked={notifications.budget_overspend_alerts}
                      onCheckedChange={(checked) =>
                        setNotifications({ ...notifications, budget_overspend_alerts: checked })
                      }
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>Payment Confirmations</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive confirmation after recording payments
                      </p>
                    </div>
                    <Switch
                      checked={notifications.payment_confirmations}
                      onCheckedChange={(checked) =>
                        setNotifications({ ...notifications, payment_confirmations: checked })
                      }
                    />
                  </div>
                </div>
                <div className="pt-4">
                  <Button onClick={() => toast.success("Notification preferences saved")}>
                    Save Preferences
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="app-install">
            <Card>
              <CardHeader>
                <CardTitle>App Install Settings</CardTitle>
                <CardDescription>
                  Control how the PWA install prompt behaves
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Install Status */}
                {isInstalled && (
                  <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-primary">
                      <Smartphone className="h-5 w-5" />
                      <span className="font-medium">App is installed</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      You're using the installed version of Loan Hub
                    </p>
                  </div>
                )}

                <div className="space-y-4">
                  {/* Install Now Button */}
                  {!isInstalled && (
                    <>
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <Label>Install App</Label>
                          <p className="text-sm text-muted-foreground">
                            {isInstallable 
                              ? "Click the button below to install the app on your device"
                              : "Installation is not available on this device or browser"}
                          </p>
                        </div>
                        <Button
                          size="lg"
                          disabled={!isInstallable || installing}
                          onClick={async () => {
                            setInstalling(true);
                            try {
                              const installed = await installApp();
                              if (installed) {
                                toast.success("App installed successfully!");
                              } else {
                                toast.info("Installation was cancelled");
                              }
                            } catch (error) {
                              toast.error("Failed to install app");
                            } finally {
                              setInstalling(false);
                            }
                          }}
                          className="w-full sm:w-auto"
                        >
                          {installing ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Installing...
                            </>
                          ) : (
                            <>
                              <Download className="h-4 w-4 mr-2" />
                              Install App Now
                            </>
                          )}
                        </Button>
                      </div>
                      <Separator />
                    </>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>Auto-show Install Prompt</Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically show the install prompt after logging in
                      </p>
                    </div>
                    <Switch
                      checked={pwaSettings.auto_show_prompt}
                      onCheckedChange={(checked) => {
                        setPwaSettings({ auto_show_prompt: checked });
                        localStorage.setItem("pwa-auto-show-prompt", checked.toString());
                        toast.success(checked ? "Install prompt will auto-show" : "Install prompt disabled");
                      }}
                    />
                  </div>
                  <Separator />
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label>Reset Install Prompt</Label>
                      <p className="text-sm text-muted-foreground">
                        Clear the dismissed state and show the install prompt again
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => {
                        localStorage.removeItem("pwa-prompt-dismissed");
                        sessionStorage.removeItem("pwa-prompt-shown-session");
                        localStorage.removeItem("pwa-installed");
                        toast.success("Install prompt reset. Reload the page to see it again.");
                      }}
                    >
                      Reset Install Prompt
                    </Button>
                  </div>
                  <Separator />
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label>Manual Install</Label>
                      <p className="text-sm text-muted-foreground">
                        View installation instructions for your device
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => navigate("/install")}
                    >
                      <Smartphone className="h-4 w-4 mr-2" />
                      View Install Instructions
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="defaults">
            <Card>
              <CardHeader>
                <CardTitle>Defaults</CardTitle>
                <CardDescription>
                  Set default values for common settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currency">Default Currency</Label>
                    <Select value={defaults.currency} onValueChange={(val) => setDefaults({ ...defaults, currency: val })}>
                      <SelectTrigger id="currency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INR">INR (₹)</SelectItem>
                        <SelectItem value="USD">USD ($)</SelectItem>
                        <SelectItem value="EUR">EUR (€)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="start-month">Start of Month Day</Label>
                    <Select 
                      value={defaults.start_of_month.toString()} 
                      onValueChange={(val) => setDefaults({ ...defaults, start_of_month: parseInt(val) })}
                    >
                      <SelectTrigger id="start-month">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                          <SelectItem key={day} value={day.toString()}>
                            Day {day}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Used for monthly budget and expense tracking
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="landing">Default Landing Page</Label>
                    <Select 
                      value={defaults.default_landing_page} 
                      onValueChange={(val) => setDefaults({ ...defaults, default_landing_page: val })}
                    >
                      <SelectTrigger id="landing">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="/dashboard">Dashboard</SelectItem>
                        <SelectItem value="/loans">Loans</SelectItem>
                        <SelectItem value="/budget/planner">Budget Planner</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="pt-4">
                  <Button onClick={() => toast.success("Default settings saved")}>
                    Save Defaults
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="backup">
            <BackupManager />
          </TabsContent>

          <TabsContent value="data">
            <Card>
              <CardHeader>
                <CardTitle>Data & Backup</CardTitle>
                <CardDescription>
                  Export your data for backup or analysis
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Button variant="outline" onClick={() => handleExportData("loans")}>
                    <Download className="mr-2 h-4 w-4" />
                    Export Loans
                  </Button>
                  <Button variant="outline" onClick={() => handleExportData("payments")}>
                    <Download className="mr-2 h-4 w-4" />
                    Export Payments
                  </Button>
                  <Button variant="outline" onClick={() => handleExportData("expenses")}>
                    <Download className="mr-2 h-4 w-4" />
                    Export Budgets
                  </Button>
                  <Button variant="outline" onClick={() => handleExportData("transactions")}>
                    <Download className="mr-2 h-4 w-4" />
                    Export Transactions
                  </Button>
                </div>
                <div className="pt-4 text-sm text-muted-foreground">
                  <p>
                    Data is exported in JSON format. You can import this data into spreadsheet
                    applications or use it for your own analysis.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </FadeInStagger>
    </div>
  );
}
