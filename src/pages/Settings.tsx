import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
  Smartphone,
  Monitor,
  Layout,
  Shield,
  Key,
  Upload,
  MapPin,
  Phone,
  Mail,
  IndianRupee,
  Target,
  TrendingUp,
  Clock,
  Calendar,
  Database,
  FileText,
  Wallet,
  CreditCard,
  BarChart3,
  MessageSquare,
  Cloud,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Check
} from "lucide-react";
import FadeInStagger from "@/components/FadeInStagger";
import { useTheme } from "next-themes";
import BackupManager from "@/pages/BackupManager";
import { usePWA } from "@/hooks/usePWA";
import { useUserSettings } from "@/hooks/useUserSettings";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

const TIMEZONES = [
  { value: "Asia/Kolkata", label: "India (IST)" },
  { value: "America/New_York", label: "New York (EST)" },
  { value: "America/Los_Angeles", label: "Los Angeles (PST)" },
  { value: "Europe/London", label: "London (GMT)" },
  { value: "Europe/Paris", label: "Paris (CET)" },
  { value: "Asia/Dubai", label: "Dubai (GST)" },
  { value: "Asia/Singapore", label: "Singapore (SGT)" },
  { value: "Australia/Sydney", label: "Sydney (AEDT)" },
];

const ACCENT_COLORS = [
  { value: "blue", label: "Blue", color: "hsl(216, 92%, 53%)", hsl: "216 92% 53%" },
  { value: "indigo", label: "Indigo", color: "hsl(234, 89%, 63%)", hsl: "234 89% 63%" },
  { value: "purple", label: "Purple", color: "hsl(262, 83%, 58%)", hsl: "262 83% 58%" },
  { value: "pink", label: "Pink", color: "hsl(330, 81%, 60%)", hsl: "330 81% 60%" },
  { value: "red", label: "Red", color: "hsl(0, 84%, 60%)", hsl: "0 84% 60%" },
  { value: "orange", label: "Orange", color: "hsl(25, 95%, 53%)", hsl: "25 95% 53%" },
  { value: "amber", label: "Amber", color: "hsl(38, 92%, 50%)", hsl: "38 92% 50%" },
  { value: "green", label: "Green", color: "hsl(142, 71%, 45%)", hsl: "142 71% 45%" },
  { value: "teal", label: "Teal", color: "hsl(177, 55%, 50%)", hsl: "177 55% 50%" },
  { value: "cyan", label: "Cyan", color: "hsl(189, 94%, 43%)", hsl: "189 94% 43%" },
];

export default function Settings() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { isInstallable, isInstalled, installApp } = usePWA();
  const {
    loading,
    saving,
    profile,
    preferences,
    notifications,
    aiSettings,
    setProfile,
    setPreferences,
    setNotifications,
    setAISettings,
    saveProfile,
    savePreferences,
    saveNotifications,
    saveAISettings,
  } = useUserSettings();

  const [installing, setInstalling] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<{ id: string; bank_name: string; account_number_masked: string }[]>([]);
  const [activeTab, setActiveTab] = useState("profile");

  // PWA Install settings
  const [pwaSettings, setPwaSettings] = useState({
    auto_show_prompt: true,
  });

  useEffect(() => {
    const autoShow = localStorage.getItem("pwa-auto-show-prompt");
    if (autoShow !== null) {
      setPwaSettings({ auto_show_prompt: autoShow === "true" });
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchBankAccounts();
    }
  }, [user]);

  const fetchBankAccounts = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from("bank_accounts")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true);
      if (data) {
        setBankAccounts(data.map((acc: any) => ({
          id: acc.id,
          bank_name: acc.bank_name,
          account_number_masked: acc.account_number_masked
        })));
      }
    } catch (error) {
      console.error("Error fetching bank accounts:", error);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const handleExportData = async (type: string) => {
    if (!user) return;
    try {
      let data: any[] = [];
      let filename = "";

      const tableMap: Record<string, string> = {
        loans: "loans",
        payments: "payments",
        expenses: "monthly_expenses",
        transactions: "transactions",
        budgets: "monthly_budgets",
        lenders: "lenders",
      };

      const tableName = tableMap[type] as keyof typeof tableMap;
      if (!tableName) return;

      const { data: result } = await (supabase
        .from(tableName as any)
        .select("*")
        .eq("user_id", user.id) as any);

      data = result || [];
      filename = `${type}_export_${new Date().toISOString().split('T')[0]}.csv`;

      // Convert to CSV
      if (data.length > 0) {
        const headers = Object.keys(data[0]);
        const csvContent = [
          headers.join(","),
          ...data.map(row => headers.map(h => JSON.stringify(row[h] ?? "")).join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`${type} exported successfully`);
      } else {
        toast.info(`No ${type} data to export`);
      }
    } catch (error) {
      toast.error(`Failed to export ${type}`);
    }
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email?.slice(0, 2).toUpperCase() || 'U';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const tabItems = [
    { value: "profile", icon: User, label: "Profile" },
    { value: "display", icon: Layout, label: "Display" },
    { value: "appearance", icon: Palette, label: "Appearance" },
    { value: "notifications", icon: Bell, label: "Notifications" },
    { value: "app-install", icon: Smartphone, label: "App Install" },
    { value: "defaults", icon: SettingsIcon, label: "Defaults" },
    { value: "backup", icon: Cloud, label: "Backup" },
    { value: "export", icon: Download, label: "Export" },
  ];

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold">Settings Centre</h1>
        <p className="text-muted-foreground mt-2">
          Manage your account, preferences, and application settings
        </p>
      </div>

      <FadeInStagger>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          {/* Mobile-friendly scrollable tabs */}
          <ScrollArea className="w-full">
            <TabsList className="inline-flex h-auto p-1 w-max min-w-full md:grid md:w-full md:max-w-4xl md:grid-cols-8 gap-1">
              {tabItems.map(({ value, icon: Icon, label }) => (
                <TabsTrigger 
                  key={value} 
                  value={value}
                  className="flex items-center gap-2 px-3 py-2 whitespace-nowrap"
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
            <ScrollBar orientation="horizontal" className="md:hidden" />
          </ScrollArea>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Profile Information
                </CardTitle>
                <CardDescription>
                  Manage your personal information and financial profile
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Avatar Section */}
                <div className="flex items-center gap-4">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={profile?.avatar_url || undefined} />
                    <AvatarFallback className="text-lg bg-primary text-primary-foreground">
                      {getInitials(profile?.name || null, profile?.email || '')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-2">
                    <Label>Profile Photo</Label>
                    <p className="text-sm text-muted-foreground">
                      Avatar based on your initials
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      value={profile?.name || ""}
                      onChange={(e) => setProfile(prev => prev ? { ...prev, name: e.target.value } : null)}
                      placeholder="Your name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Input
                        id="email"
                        value={profile?.email || ""}
                        disabled
                        className="bg-muted pr-10"
                      />
                      <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    </div>
                    <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone (optional)</Label>
                    <div className="relative">
                      <Input
                        id="phone"
                        value={profile?.phone || ""}
                        onChange={(e) => setProfile(prev => prev ? { ...prev, phone: e.target.value } : null)}
                        placeholder="+91 98765 43210"
                      />
                      <Phone className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">City / Location</Label>
                    <div className="relative">
                      <Input
                        id="city"
                        value={profile?.city || ""}
                        onChange={(e) => setProfile(prev => prev ? { ...prev, city: e.target.value } : null)}
                        placeholder="Mumbai"
                      />
                      <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="timezone">Time Zone</Label>
                    <Select 
                      value={profile?.timezone || "Asia/Kolkata"} 
                      onValueChange={(val) => setProfile(prev => prev ? { ...prev, timezone: val } : null)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIMEZONES.map(tz => (
                          <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                {/* Financial Profile */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <IndianRupee className="h-5 w-5" />
                    Financial Profile
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="income">Monthly Income (₹)</Label>
                      <Input
                        id="income"
                        type="number"
                        value={profile?.monthly_income || 0}
                        onChange={(e) => setProfile(prev => prev ? { ...prev, monthly_income: parseFloat(e.target.value) || 0 } : null)}
                        placeholder="0"
                      />
                      <p className="text-xs text-muted-foreground">Used for DTI ratio calculations</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fixed_bills">Fixed Monthly Commitments (₹)</Label>
                      <Input
                        id="fixed_bills"
                        type="number"
                        value={profile?.fixed_bills || 0}
                        onChange={(e) => setProfile(prev => prev ? { ...prev, fixed_bills: parseFloat(e.target.value) || 0 } : null)}
                        placeholder="0"
                      />
                      <p className="text-xs text-muted-foreground">Rent, utilities, subscriptions, etc.</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="savings_target">Savings Target per Month (₹)</Label>
                      <Input
                        id="savings_target"
                        type="number"
                        value={profile?.savings_target || 0}
                        onChange={(e) => setProfile(prev => prev ? { ...prev, savings_target: parseFloat(e.target.value) || 0 } : null)}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Risk Profile</Label>
                      <Select 
                        value={profile?.risk_profile || "balanced"} 
                        onValueChange={(val) => setProfile(prev => prev ? { ...prev, risk_profile: val } : null)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="conservative">
                            <div className="flex items-center gap-2">
                              <Shield className="h-4 w-4 text-blue-500" />
                              Conservative
                            </div>
                          </SelectItem>
                          <SelectItem value="balanced">
                            <div className="flex items-center gap-2">
                              <Target className="h-4 w-4 text-green-500" />
                              Balanced
                            </div>
                          </SelectItem>
                          <SelectItem value="aggressive">
                            <div className="flex items-center gap-2">
                              <TrendingUp className="h-4 w-4 text-orange-500" />
                              Aggressive
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">Used by AI for personalized advice</p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Sign-in & Security */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Sign-in & Security
                  </h3>
                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-primary/10">
                        {user?.app_metadata?.provider === 'google' ? (
                          <Mail className="h-5 w-5 text-primary" />
                        ) : (
                          <Key className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">Login Method</p>
                        <p className="text-sm text-muted-foreground">
                          {user?.app_metadata?.provider === 'google' ? 'Google Account' : 'Email & Password'}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Active
                    </Badge>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
                  <Button onClick={() => saveProfile(profile || {})} disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save Profile
                  </Button>
                  <Button variant="destructive" onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Display Tab */}
          <TabsContent value="display" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layout className="h-5 w-5" />
                  Layout & Behaviour
                </CardTitle>
                <CardDescription>
                  Control how the app displays on different devices
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>Default Home Screen</Label>
                      <p className="text-sm text-muted-foreground">
                        Page to show when you open the app
                      </p>
                    </div>
                    <Select 
                      value={preferences.default_home_tab} 
                      onValueChange={(val) => setPreferences(prev => ({ ...prev, default_home_tab: val }))}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="/dashboard">Dashboard</SelectItem>
                        <SelectItem value="/banking">Bank Manager</SelectItem>
                        <SelectItem value="/loans">Loan Manager</SelectItem>
                        <SelectItem value="/budget/planner">Budget Manager</SelectItem>
                        <SelectItem value="/ai/chat">AI Advice</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>Layout Mode</Label>
                      <p className="text-sm text-muted-foreground">
                        Force a specific layout style
                      </p>
                    </div>
                    <Select 
                      value={preferences.layout_mode} 
                      onValueChange={(val) => {
                        setPreferences(prev => ({ ...prev, layout_mode: val }));
                        // Also update display mode for backward compatibility
                        saveProfile({ display_mode: val });
                      }}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">
                          <div className="flex items-center gap-2">
                            <SettingsIcon className="h-4 w-4" />
                            Auto (Responsive)
                          </div>
                        </SelectItem>
                        <SelectItem value="mobile">
                          <div className="flex items-center gap-2">
                            <Smartphone className="h-4 w-4" />
                            Mobile Compact
                          </div>
                        </SelectItem>
                        <SelectItem value="desktop">
                          <div className="flex items-center gap-2">
                            <Monitor className="h-4 w-4" />
                            Desktop Wide
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>Sidebar Behaviour</Label>
                      <p className="text-sm text-muted-foreground">
                        How the sidebar behaves on different screens
                      </p>
                    </div>
                    <Select 
                      value={preferences.sidebar_behavior} 
                      onValueChange={(val) => setPreferences(prev => ({ ...prev, sidebar_behavior: val }))}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Auto collapse on mobile</SelectItem>
                        <SelectItem value="expanded">Always expanded</SelectItem>
                        <SelectItem value="collapsed">Start collapsed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>Default Date Filter</Label>
                      <p className="text-sm text-muted-foreground">
                        Default date range for data pages
                      </p>
                    </div>
                    <Select 
                      value={preferences.default_date_range} 
                      onValueChange={(val) => setPreferences(prev => ({ ...prev, default_date_range: val }))}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="current_month">Current Month</SelectItem>
                        <SelectItem value="last_30_days">Last 30 Days</SelectItem>
                        <SelectItem value="last_90_days">Last 90 Days</SelectItem>
                        <SelectItem value="this_year">This Year</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="pt-4">
                  <Button onClick={() => savePreferences(preferences)} disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save Display Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Appearance Tab */}
          <TabsContent value="appearance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Theme & Visual Style
                </CardTitle>
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
                        <SelectItem value="system">
                          <div className="flex items-center gap-2">
                            <SettingsIcon className="h-4 w-4" />
                            System
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <div className="space-y-1">
                      <Label>Accent Color</Label>
                      <p className="text-sm text-muted-foreground">
                        Choose your preferred primary color for the app
                      </p>
                    </div>
                    <div className="grid grid-cols-5 gap-3 sm:grid-cols-10">
                      {ACCENT_COLORS.map(color => (
                        <button
                          key={color.value}
                          onClick={() => setPreferences(prev => ({ ...prev, accent_color: color.value }))}
                          className={`group relative w-10 h-10 rounded-full transition-all duration-200 ${
                            preferences.accent_color === color.value 
                              ? 'ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110' 
                              : 'hover:scale-110 hover:ring-2 hover:ring-offset-2 hover:ring-offset-background hover:ring-muted-foreground/50'
                          }`}
                          style={{ backgroundColor: color.color }}
                          title={color.label}
                        >
                          {preferences.accent_color === color.value && (
                            <span className="absolute inset-0 flex items-center justify-center">
                              <Check className="h-5 w-5 text-white drop-shadow-md" />
                            </span>
                          )}
                          <span className="sr-only">{color.label}</span>
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Palette className="h-4 w-4" />
                      <span>Selected: <span className="font-medium text-foreground">{ACCENT_COLORS.find(c => c.value === preferences.accent_color)?.label || 'Blue'}</span></span>
                    </div>
                  </div>

                  <Separator />

                  {/* Live Preview Section */}
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <Label className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        Live Preview
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        See how your accent color looks across UI elements
                      </p>
                    </div>
                    
                    <div className="p-4 rounded-xl border bg-card/50 space-y-5">
                      {/* Buttons Preview */}
                      <div className="space-y-2">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Buttons</span>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm">Primary</Button>
                          <Button size="sm" variant="secondary">Secondary</Button>
                          <Button size="sm" variant="outline">Outline</Button>
                          <Button size="sm" variant="ghost">Ghost</Button>
                        </div>
                      </div>

                      {/* Cards Preview */}
                      <div className="space-y-2">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Cards & Stats</span>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          <div className="p-3 rounded-lg border bg-card">
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <Wallet className="h-4 w-4 text-primary" />
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Balance</p>
                                <p className="font-semibold">₹1,25,000</p>
                              </div>
                            </div>
                          </div>
                          <div className="p-3 rounded-lg border bg-card">
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <TrendingUp className="h-4 w-4 text-primary" />
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Savings</p>
                                <p className="font-semibold">75%</p>
                              </div>
                            </div>
                          </div>
                          <div className="p-3 rounded-lg border bg-card">
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <CreditCard className="h-4 w-4 text-primary" />
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Loans</p>
                                <p className="font-semibold">5 Active</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Badges Preview */}
                      <div className="space-y-2">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Badges</span>
                        <div className="flex flex-wrap gap-2">
                          <Badge>Default</Badge>
                          <Badge variant="secondary">Secondary</Badge>
                          <Badge variant="outline">Outline</Badge>
                        </div>
                      </div>

                      {/* Progress Preview */}
                      <div className="space-y-2">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Progress</span>
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-sm">
                            <span>EMI Progress</span>
                            <span className="font-medium">75%</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: '75%' }} />
                          </div>
                        </div>
                      </div>

                      {/* Interactive Elements */}
                      <div className="space-y-2">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Interactive</span>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <Switch defaultChecked />
                            <span className="text-sm">On</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch />
                            <span className="text-sm">Off</span>
                          </div>
                        </div>
                      </div>

                      {/* Font Size Preview */}
                      <div className="space-y-2">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Typography Preview</span>
                        <div 
                          className="p-4 rounded-lg border bg-background space-y-3"
                          style={{
                            fontSize: preferences.font_size === 'small' ? '14px' : preferences.font_size === 'large' ? '18px' : '16px'
                          }}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="text-xs">
                              {preferences.font_size === 'small' ? '14px' : preferences.font_size === 'large' ? '18px' : '16px'} base
                            </Badge>
                          </div>
                          <h3 
                            className="font-bold text-foreground"
                            style={{ fontSize: preferences.font_size === 'small' ? '1.25em' : preferences.font_size === 'large' ? '1.5em' : '1.375em' }}
                          >
                            Monthly Financial Summary
                          </h3>
                          <p className="text-muted-foreground leading-relaxed" style={{ fontSize: '1em' }}>
                            Your total outstanding balance is ₹4,50,000 across 5 active loans. 
                            Next EMI of ₹25,000 is due on December 15th.
                          </p>
                          <div className="flex gap-4 text-sm">
                            <span className="text-primary font-medium">↑ 12% savings this month</span>
                            <span className="text-muted-foreground">•</span>
                            <span className="text-green-600 font-medium">On track</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>Font Size</Label>
                      <p className="text-sm text-muted-foreground">
                        Adjust base text size
                      </p>
                    </div>
                    <Select 
                      value={preferences.font_size} 
                      onValueChange={(val) => setPreferences(prev => ({ ...prev, font_size: val }))}
                    >
                      <SelectTrigger className="w-[150px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="small">Small</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="large">Large</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>Density</Label>
                      <p className="text-sm text-muted-foreground">
                        Card and table spacing
                      </p>
                    </div>
                    <Select 
                      value={preferences.density} 
                      onValueChange={(val) => setPreferences(prev => ({ ...prev, density: val }))}
                    >
                      <SelectTrigger className="w-[150px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="comfortable">Comfortable</SelectItem>
                        <SelectItem value="compact">Compact</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>Show Tooltips</Label>
                      <p className="text-sm text-muted-foreground">
                        Show helpful hints on hover
                      </p>
                    </div>
                    <Switch
                      checked={preferences.show_tooltips}
                      onCheckedChange={(checked) => setPreferences(prev => ({ ...prev, show_tooltips: checked }))}
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <Button onClick={() => savePreferences(preferences)} disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save Appearance
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Loan & EMI Alerts
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Email EMI Reminder</Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified before your EMI is due
                    </p>
                  </div>
                  <Switch
                    checked={notifications.email_emi_reminder}
                    onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, email_emi_reminder: checked }))}
                  />
                </div>
                {notifications.email_emi_reminder && (
                  <div className="flex items-center justify-between pl-4 border-l-2 border-primary/20">
                    <Label className="text-sm">Remind days before</Label>
                    <Select 
                      value={notifications.email_emi_reminder_days.toString()} 
                      onValueChange={(val) => setNotifications(prev => ({ ...prev, email_emi_reminder_days: parseInt(val) }))}
                    >
                      <SelectTrigger className="w-[100px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 day</SelectItem>
                        <SelectItem value="3">3 days</SelectItem>
                        <SelectItem value="7">7 days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>In-App "EMIs Due This Week"</Label>
                    <p className="text-sm text-muted-foreground">
                      Show upcoming EMIs on dashboard
                    </p>
                  </div>
                  <Switch
                    checked={notifications.inapp_emi_due_week}
                    onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, inapp_emi_due_week: checked }))}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5" />
                  Bank & Cash Alerts
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Low Balance Alert</Label>
                    <p className="text-sm text-muted-foreground">
                      Alert when account balance drops below threshold
                    </p>
                  </div>
                  <Switch
                    checked={notifications.low_balance_alert}
                    onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, low_balance_alert: checked }))}
                  />
                </div>
                {notifications.low_balance_alert && (
                  <div className="flex items-center justify-between pl-4 border-l-2 border-primary/20">
                    <Label className="text-sm">Threshold (₹)</Label>
                    <Input
                      type="number"
                      className="w-[120px]"
                      value={notifications.low_balance_threshold}
                      onChange={(e) => setNotifications(prev => ({ ...prev, low_balance_threshold: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Budget & Expense Alerts
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Budget Overspend Alert</Label>
                    <p className="text-sm text-muted-foreground">
                      Notify when expenses exceed budget
                    </p>
                  </div>
                  <Switch
                    checked={notifications.budget_overspend_alert}
                    onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, budget_overspend_alert: checked }))}
                  />
                </div>
                {notifications.budget_overspend_alert && (
                  <div className="flex items-center justify-between pl-4 border-l-2 border-primary/20">
                    <Label className="text-sm">Alert at % of budget</Label>
                    <Select 
                      value={notifications.budget_overspend_percent.toString()} 
                      onValueChange={(val) => setNotifications(prev => ({ ...prev, budget_overspend_percent: parseInt(val) }))}
                    >
                      <SelectTrigger className="w-[100px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="80">80%</SelectItem>
                        <SelectItem value="90">90%</SelectItem>
                        <SelectItem value="100">100%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>High Utilisation Alert</Label>
                    <p className="text-sm text-muted-foreground">
                      Alert when EMI-to-income ratio exceeds 40%
                    </p>
                  </div>
                  <Switch
                    checked={notifications.high_utilisation_alerts}
                    onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, high_utilisation_alerts: checked }))}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  AI Reports
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Monthly AI Summary (Email)</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive monthly financial summary via email
                    </p>
                  </div>
                  <Switch
                    checked={notifications.monthly_ai_summary}
                    onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, monthly_ai_summary: checked }))}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>In-App AI Insights</Label>
                    <p className="text-sm text-muted-foreground">
                      Show AI insights on dashboard
                    </p>
                  </div>
                  <Switch
                    checked={notifications.inapp_ai_summary}
                    onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, inapp_ai_summary: checked }))}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="pt-2">
              <Button onClick={() => saveNotifications(notifications)} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save Notification Settings
              </Button>
            </div>
          </TabsContent>

          {/* App Install Tab */}
          <TabsContent value="app-install" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5" />
                  Install App
                </CardTitle>
                <CardDescription>
                  Install Loan Tracker as an app on your phone or desktop for faster access
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {isInstalled ? (
                  <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-6 w-6 text-primary" />
                      <div>
                        <p className="font-semibold text-primary">App Installed</p>
                        <p className="text-sm text-muted-foreground">
                          You're using the installed version of Loan Tracker
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                      <p className="text-sm">
                        Install the app on your device for the best experience with offline access and faster loading.
                      </p>
                      <Button
                        size="lg"
                        disabled={installing}
                        onClick={async () => {
                          setInstalling(true);
                          try {
                            if (isInstallable) {
                              const installed = await installApp();
                              if (installed) {
                                toast.success("App installed successfully!");
                              } else {
                                toast.info("Installation was cancelled");
                              }
                            } else {
                              navigate("/install");
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
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4 mr-2" />
                        )}
                        Install on This Device
                      </Button>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <Card className="bg-muted/30">
                        <CardContent className="pt-4">
                          <h4 className="font-semibold flex items-center gap-2 mb-2">
                            <Smartphone className="h-4 w-4" />
                            Android
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            Tap the browser menu (⋮) and select "Add to Home Screen" or "Install App"
                          </p>
                        </CardContent>
                      </Card>
                      <Card className="bg-muted/30">
                        <CardContent className="pt-4">
                          <h4 className="font-semibold flex items-center gap-2 mb-2">
                            <Monitor className="h-4 w-4" />
                            Desktop
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            Click the install icon in the address bar or use browser menu → "Install"
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                  </>
                )}

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>Auto-show Install Prompt</Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically show install prompt after login
                      </p>
                    </div>
                    <Switch
                      checked={pwaSettings.auto_show_prompt}
                      onCheckedChange={(checked) => {
                        setPwaSettings({ auto_show_prompt: checked });
                        localStorage.setItem("pwa-auto-show-prompt", checked.toString());
                        toast.success(checked ? "Install prompt enabled" : "Install prompt disabled");
                      }}
                    />
                  </div>

                  <Button
                    variant="outline"
                    onClick={() => {
                      localStorage.removeItem("pwa-prompt-dismissed");
                      sessionStorage.removeItem("pwa-prompt-shown-session");
                      toast.success("Install prompt reset. Reload to see it again.");
                    }}
                  >
                    Reset Install Prompt
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Defaults Tab */}
          <TabsContent value="defaults" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <SettingsIcon className="h-5 w-5" />
                  App-Wide Defaults
                </CardTitle>
                <CardDescription>
                  Set default values used throughout the application
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Default Bank Account for EMI</Label>
                    <Select 
                      value={preferences.default_bank_account_emi || "none"} 
                      onValueChange={(val) => setPreferences(prev => ({ ...prev, default_bank_account_emi: val === "none" ? null : val }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {bankAccounts.map(acc => (
                          <SelectItem key={acc.id} value={acc.id}>
                            {acc.bank_name} - {acc.account_number_masked}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Default Bank Account for Expenses</Label>
                    <Select 
                      value={preferences.default_bank_account_expense || "none"} 
                      onValueChange={(val) => setPreferences(prev => ({ ...prev, default_bank_account_expense: val === "none" ? null : val }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {bankAccounts.map(acc => (
                          <SelectItem key={acc.id} value={acc.id}>
                            {acc.bank_name} - {acc.account_number_masked}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>EMI Calendar View</Label>
                    <Select 
                      value={preferences.default_emi_calendar_view} 
                      onValueChange={(val) => setPreferences(prev => ({ ...prev, default_emi_calendar_view: val }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="month">Month View</SelectItem>
                        <SelectItem value="list">List View</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>BRS Default Date Range</Label>
                    <Select 
                      value={preferences.default_brs_date_range} 
                      onValueChange={(val) => setPreferences(prev => ({ ...prev, default_brs_date_range: val }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="current_month">Current Month</SelectItem>
                        <SelectItem value="last_7_days">Last 7 Days</SelectItem>
                        <SelectItem value="last_30_days">Last 30 Days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Currency Symbol</Label>
                    <Select 
                      value={preferences.currency_symbol} 
                      onValueChange={(val) => setPreferences(prev => ({ ...prev, currency_symbol: val }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="₹">₹ (INR)</SelectItem>
                        <SelectItem value="$">$ (USD)</SelectItem>
                        <SelectItem value="€">€ (EUR)</SelectItem>
                        <SelectItem value="£">£ (GBP)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Start of Month Day</Label>
                    <Select 
                      value={preferences.start_of_month.toString()} 
                      onValueChange={(val) => setPreferences(prev => ({ ...prev, start_of_month: parseInt(val) }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                          <SelectItem key={day} value={day.toString()}>Day {day}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Used for monthly budget tracking
                    </p>
                  </div>
                </div>

                <div className="pt-4">
                  <Button onClick={() => savePreferences(preferences)} disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save Defaults
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Backup Tab */}
          <TabsContent value="backup">
            <BackupManager />
          </TabsContent>

          {/* Export Tab */}
          <TabsContent value="export" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  Export Your Data
                </CardTitle>
                <CardDescription>
                  Download your data as CSV files for backup or analysis
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {[
                    { type: "loans", label: "Loans & Lenders", icon: CreditCard },
                    { type: "payments", label: "EMI Payments", icon: Wallet },
                    { type: "transactions", label: "Bank Transactions", icon: Database },
                    { type: "expenses", label: "Monthly Expenses", icon: FileText },
                    { type: "budgets", label: "Budgets", icon: BarChart3 },
                  ].map(({ type, label, icon: Icon }) => (
                    <Card key={type} className="bg-muted/30 hover:bg-muted/50 transition-colors">
                      <CardContent className="pt-4">
                        <Button
                          variant="ghost"
                          className="w-full h-auto py-4 flex flex-col gap-2"
                          onClick={() => handleExportData(type)}
                        >
                          <Icon className="h-8 w-8 text-primary" />
                          <span className="font-medium">{label}</span>
                          <span className="text-xs text-muted-foreground">Export as CSV</span>
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="pt-4 p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">
                    <AlertCircle className="inline h-4 w-4 mr-1" />
                    Exports contain only your personal data. CSV files can be opened in Excel, Google Sheets, or any spreadsheet application.
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
