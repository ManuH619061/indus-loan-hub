import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, HelpCircle, Menu, X, Keyboard, History, Settings, Download, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import finpathLogo from "@/assets/finpath-logo.png";
import { GlobalSearchDialog } from "@/components/header/GlobalSearchDialog";
import { NotificationsDropdown } from "@/components/header/NotificationsDropdown";
import { QuickActionsMenu } from "@/components/header/QuickActionsMenu";
import { KeyboardShortcutsDialog } from "@/components/header/KeyboardShortcutsDialog";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useRecentPages } from "@/hooks/useRecentPages";

interface AppHeaderProps {
  user: any;
  onSignOut: () => void;
  onMenuToggle: () => void;
  isSidebarOpen: boolean;
}

export function AppHeader({ user, onSignOut, onMenuToggle, isSidebarOpen }: AppHeaderProps) {
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { recentPages } = useRecentPages();

  const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || "User";
  const userEmail = user?.email || "";
  const userInitials = userName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onOpenSearch: () => setSearchOpen(true),
    onOpenQuickActions: () => setQuickActionsOpen(true),
    onOpenNotifications: () => setNotificationsOpen(true),
    onOpenShortcutsHelp: () => setShortcutsOpen(true),
  });

  const handleSearchClick = () => {
    setSearchOpen(true);
  };

  return (
    <>
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

          {/* Search - Desktop (opens dialog) */}
          <div className="hidden md:flex flex-1 max-w-xl mx-4">
            <button
              onClick={handleSearchClick}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md bg-primary-foreground/10 border border-primary-foreground/20 text-primary-foreground/60 hover:bg-primary-foreground/15 hover:border-primary-foreground/30 transition-colors text-left"
            >
              <Search className="h-4 w-4" />
              <span className="flex-1 text-sm">Search loans, lenders, payments...</span>
              <kbd className="hidden lg:inline-flex h-5 items-center gap-1 rounded border border-primary-foreground/30 bg-primary-foreground/10 px-1.5 font-mono text-[10px]">
                /
              </kbd>
            </button>
          </div>

          {/* Search - Mobile Icon */}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-primary-foreground hover:bg-primary-foreground/10 md:hidden ml-auto"
            onClick={handleSearchClick}
          >
            <Search className="h-5 w-5" />
          </Button>

          {/* Right Actions */}
          <div className="flex items-center gap-1 md:gap-2 ml-auto md:ml-0">
            {/* Quick Actions */}
            <QuickActionsMenu />

            {/* Notifications */}
            <NotificationsDropdown />

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
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start h-9 text-sm"
                    onClick={() => setShortcutsOpen(true)}
                  >
                    <Keyboard className="h-4 w-4 mr-2" />
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
              <DropdownMenuContent align="end" className="w-64">
                <div className="px-3 py-2">
                  <p className="font-medium text-sm">{userName}</p>
                  <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
                </div>
                <DropdownMenuSeparator />
                
                {/* Recent Pages */}
                {recentPages.length > 0 && (
                  <>
                    <DropdownMenuLabel className="text-xs text-muted-foreground font-normal flex items-center gap-1">
                      <History className="h-3 w-3" />
                      Recent Pages
                    </DropdownMenuLabel>
                    {recentPages.slice(0, 3).map((page) => (
                      <DropdownMenuItem
                        key={page.path}
                        onClick={() => navigate(page.path)}
                        className="cursor-pointer text-sm py-1"
                      >
                        {page.title}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                  </>
                )}

                <DropdownMenuItem asChild>
                  <Link to="/settings" className="cursor-pointer">
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/settings?tab=backup" className="cursor-pointer">
                    <Download className="h-4 w-4 mr-2" />
                    Backup & Export
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setShortcutsOpen(true)}
                  className="cursor-pointer"
                >
                  <Keyboard className="h-4 w-4 mr-2" />
                  Keyboard Shortcuts
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={onSignOut} 
                  className="text-destructive cursor-pointer"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Global Search Dialog */}
      <GlobalSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />

      {/* Keyboard Shortcuts Dialog */}
      <KeyboardShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </>
  );
}
