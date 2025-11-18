import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Home, TrendingUp, Wallet, CreditCard, FileText, Settings, BarChart3 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  const quickLinks = [
    { to: "/dashboard", icon: Home, label: "Dashboard", description: "View your financial overview" },
    { to: "/loans", icon: TrendingUp, label: "Loans", description: "Manage your loans" },
    { to: "/lenders", icon: Wallet, label: "Lenders", description: "View all lenders" },
    { to: "/payments", icon: CreditCard, label: "Payments", description: "Track payments" },
    { to: "/budget-planner", icon: BarChart3, label: "Budget", description: "Plan your budget" },
    { to: "/activity-log", icon: FileText, label: "Activity Log", description: "View recent activity" },
  ];

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="mb-2 text-6xl font-bold text-primary">404</h1>
          <p className="text-2xl font-semibold mb-2">Oops! Page not found</p>
          <p className="text-muted-foreground mb-6">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <Button asChild size="lg">
            <Link to="/dashboard">
              <Home className="mr-2 h-4 w-4" />
              Return to Dashboard
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Quick Links</CardTitle>
            <CardDescription>Navigate to commonly used pages</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {quickLinks.map((link) => (
                <Link key={link.to} to={link.to}>
                  <Card className="transition-all hover:shadow-md hover:border-primary cursor-pointer h-full">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <link.icon className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold mb-1">{link.label}</h3>
                          <p className="text-sm text-muted-foreground">{link.description}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default NotFound;
