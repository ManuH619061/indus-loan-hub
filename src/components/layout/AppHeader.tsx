import { useState } from "react";
import { Link } from "react-router-dom";
import { Search, Bell, HelpCircle, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import finpathLogo from "@/assets/finpath-logo.png";

interface AppHeaderProps {
  user: any;
  onSignOut: () => void;
  onMenuToggle: () => void;
  isSidebarOpen: boolean;
}

export function AppHeader({ user, onSignOut, onMenuToggle, isSidebarOpen }: AppHeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || "User";
  const userEmail = user?.email || "";
  const userInitials = userName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Basic search - can be enhanced later
    if (searchQuery.trim()) {
      console.log("Searching for:", searchQuery);
    }
  };

  return (
    <header className="h-14 md:h-16 bg-primary text-primary-foreground fixed top-0 left-0 right-0 z-50 safe-top">
      <div className="h-full flex items-center px-3 md:px-4 gap-2 md:gap-4">
        {/* Menu Toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-primary-foreground hover:bg-primary-foreground/10 md:hidden"
          onClick={onMenuToggle}
        >
          {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>

        {/* Logo & App Name */}
        <Link to="/dashboard" className="flex items-center gap-2 flex-shrink-0">
          <img src={finpathLogo} alt="FinPath Tracker" className="h-8 w-8 rounded-lg" />
          <span className="font-semibold text-base hidden sm:inline">FinPath Tracker</span>
        </Link>

        {/* Search - Desktop */}
        <div className="hidden md:flex flex-1 max-w-xl mx-4">
          <form onSubmit={handleSearch} className="w-full relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary-foreground/60" />
            <Input
              type="search"
              placeholder="Search loans, lenders, payments, expenses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/60 focus:bg-primary-foreground/15 focus:border-primary-foreground/30"
            />
          </form>
        </div>

        {/* Search - Mobile Icon */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-primary-foreground hover:bg-primary-foreground/10 md:hidden ml-auto"
          onClick={() => setSearchOpen(!searchOpen)}
        >
          <Search className="h-5 w-5" />
        </Button>

        {/* Right Actions */}
        <div className="flex items-center gap-1 md:gap-2 ml-auto md:ml-0">
          {/* Notifications */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-primary-foreground hover:bg-primary-foreground/10 relative"
              >
                <Bell className="h-5 w-5" />
                <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-[10px] bg-destructive text-destructive-foreground">
                  3
                </Badge>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0">
              <div className="p-3 border-b">
                <h4 className="font-semibold">Notifications</h4>
              </div>
              <div className="max-h-64 overflow-y-auto">
                <div className="p-3 border-b hover:bg-muted/50 cursor-pointer">
                  <p className="text-sm font-medium">EMI Due Tomorrow</p>
                  <p className="text-xs text-muted-foreground">HDFC Home Loan - ₹45,000</p>
                </div>
                <div className="p-3 border-b hover:bg-muted/50 cursor-pointer">
                  <p className="text-sm font-medium">Budget Alert</p>
                  <p className="text-xs text-muted-foreground">Shopping exceeded 80% of limit</p>
                </div>
                <div className="p-3 hover:bg-muted/50 cursor-pointer">
                  <p className="text-sm font-medium">Payment Successful</p>
                  <p className="text-xs text-muted-foreground">Car Loan EMI - ₹22,500</p>
                </div>
              </div>
              <div className="p-2 border-t">
                <Button variant="ghost" className="w-full text-sm h-8">
                  View all notifications
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Help */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-primary-foreground hover:bg-primary-foreground/10 hidden sm:flex"
              >
                <HelpCircle className="h-5 w-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-0">
              <div className="p-3 border-b">
                <h4 className="font-semibold">Tips & Support</h4>
              </div>
              <div className="p-2">
                <Button variant="ghost" className="w-full justify-start h-9 text-sm">
                  Getting Started Guide
                </Button>
                <Button variant="ghost" className="w-full justify-start h-9 text-sm">
                  Keyboard Shortcuts
                </Button>
                <Button variant="ghost" className="w-full justify-start h-9 text-sm">
                  Contact Support
                </Button>
                <Button variant="ghost" className="w-full justify-start h-9 text-sm">
                  What's New
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-9 px-2 text-primary-foreground hover:bg-primary-foreground/10 gap-2"
              >
                <Avatar className="h-7 w-7 border border-primary-foreground/30">
                  <AvatarImage
                    src={user?.user_metadata?.avatar_url || user?.user_metadata?.picture}
                    alt={userName}
                  />
                  <AvatarFallback className="bg-primary-foreground/20 text-primary-foreground text-xs">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden lg:inline text-sm font-medium max-w-24 truncate">
                  {userName.split(" ")[0]}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-3 py-2">
                <p className="font-medium text-sm">{userName}</p>
                <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/settings" className="cursor-pointer">
                  Profile & Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onSignOut} className="text-destructive cursor-pointer">
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Mobile Search Overlay */}
      {searchOpen && (
        <div className="absolute top-full left-0 right-0 bg-card border-b p-3 md:hidden">
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search loans, lenders, payments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10"
              autoFocus
            />
          </form>
        </div>
      )}
    </header>
  );
}
