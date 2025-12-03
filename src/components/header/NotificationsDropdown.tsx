import { useNavigate } from "react-router-dom";
import { Bell, AlertTriangle, Clock, TrendingUp, Wallet, Landmark, RefreshCw, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useNotifications, Notification } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";

const TYPE_ICONS: Record<string, any> = {
  emi_upcoming: Clock,
  emi_overdue: AlertTriangle,
  high_interest: TrendingUp,
  budget_exceeded: Wallet,
  low_balance: Landmark,
};

const SEVERITY_STYLES = {
  critical: "bg-destructive/10 text-destructive border-destructive/20",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  info: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800",
};

export function NotificationsDropdown() {
  const navigate = useNavigate();
  const { 
    notifications, 
    unreadCount, 
    isLoading, 
    refetch, 
    markAsRead, 
    markAllAsRead
  } = useNotifications();

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }
    if (notification.route) {
      navigate(notification.route);
    }
  };

  // Only show unread notifications in dropdown
  const unreadNotifications = notifications.filter(n => !n.isRead);
  const groupedNotifications = groupByTime(unreadNotifications);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-primary-foreground hover:bg-primary-foreground/10 relative"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 min-w-5 p-0 flex items-center justify-center text-[10px] bg-destructive text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 sm:w-96 p-0">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b">
          <h4 className="font-semibold">Notifications</h4>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 px-2 text-xs"
                onClick={() => markAllAsRead()}
              >
                <CheckCheck className="h-3 w-3 mr-1" />
                Mark all read
              </Button>
            )}
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 px-2 text-xs"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className={cn("h-3 w-3", isLoading && "animate-spin")} />
            </Button>
          </div>
        </div>

        {/* Notifications List */}
        <ScrollArea className="max-h-80">
          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              Loading notifications...
            </div>
          ) : unreadNotifications.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No new notifications</p>
              <p className="text-xs text-muted-foreground mt-1">
                You're all caught up!
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {Object.entries(groupedNotifications).map(([timeGroup, items]) => (
                <div key={timeGroup}>
                  <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50">
                    {timeGroup}
                  </div>
                  {items.map((notification) => {
                    const Icon = TYPE_ICONS[notification.type] || Bell;
                    return (
                      <button
                        key={notification.id}
                        onClick={() => handleNotificationClick(notification)}
                        className={cn(
                          "w-full text-left p-3 hover:bg-muted/50 transition-colors flex gap-3",
                          !notification.isRead && "bg-primary/5"
                        )}
                      >
                        <div className={cn(
                          "h-8 w-8 rounded-full flex items-center justify-center shrink-0 border",
                          SEVERITY_STYLES[notification.severity]
                        )}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={cn(
                              "text-sm",
                              !notification.isRead && "font-semibold"
                            )}>
                              {notification.title}
                            </p>
                            {!notification.isRead && (
                              <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {notification.message}
                          </p>
                          <p className="text-xs text-muted-foreground/70 mt-1">
                            {formatDistanceToNow(notification.createdAt, { addSuffix: true })}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        {unreadNotifications.length > 0 && (
          <div className="p-2 border-t">
            <Button 
              variant="ghost" 
              className="w-full text-sm h-8"
              onClick={() => navigate("/settings?tab=notifications")}
            >
              Settings
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function groupByTime(notifications: Notification[]): Record<string, Notification[]> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  const groups: Record<string, Notification[]> = {
    "Today": [],
    "This Week": [],
    "Older": [],
  };

  notifications.forEach(notification => {
    const date = notification.createdAt;
    if (date >= today) {
      groups["Today"].push(notification);
    } else if (date >= thisWeek) {
      groups["This Week"].push(notification);
    } else {
      groups["Older"].push(notification);
    }
  });

  // Remove empty groups
  Object.keys(groups).forEach(key => {
    if (groups[key].length === 0) {
      delete groups[key];
    }
  });

  return groups;
}
