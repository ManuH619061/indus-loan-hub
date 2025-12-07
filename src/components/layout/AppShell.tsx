import { useState, useCallback, useEffect, useRef, ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useDisplayMode } from "@/hooks/useDisplayMode";
import { cn } from "@/lib/utils";
import { AppHeader } from "./AppHeader";
import { AppSidebar } from "./AppSidebar";
import { BottomNavBar } from "@/components/mobile/BottomNavBar";
import { FloatingActionButton } from "@/components/mobile/FloatingActionButton";

interface AppShellProps {
  children: ReactNode;
}

// Hook for swipe-to-open gesture
function useSwipeToOpen(onOpen: () => void, edgeThreshold = 30, minSwipeDistance = 50) {
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      const touch = e.touches[0];
      if (touch.clientX <= edgeThreshold) {
        touchStartX.current = touch.clientX;
        touchStartY.current = touch.clientY;
      }
    },
    [edgeThreshold]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (touchStartX.current === null || touchStartY.current === null) return;
      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStartX.current;
      const deltaY = Math.abs(touch.clientY - touchStartY.current);
      if (deltaX > minSwipeDistance && deltaX > deltaY * 2) {
        onOpen();
        touchStartX.current = null;
        touchStartY.current = null;
      }
    },
    [minSwipeDistance, onOpen]
  );

  const handleTouchEnd = useCallback(() => {
    touchStartX.current = null;
    touchStartY.current = null;
  }, []);

  useEffect(() => {
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    if (!isMobile) return;
    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: true });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);
}

// Pages where FAB should be hidden (e.g., AI chat with its own input)
const HIDE_FAB_PATHS = ["/ai/chat"];

export function AppShell({ children }: AppShellProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { isMobileLayout } = useDisplayMode();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Enable swipe-from-left-edge to open sidebar on mobile
  const openSidebar = useCallback(() => setSidebarOpen(true), []);
  useSwipeToOpen(openSidebar);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const handleMenuToggle = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleCollapseToggle = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const showFab = isMobileLayout && !HIDE_FAB_PATHS.includes(location.pathname);

  return (
    <div
      className={cn(
        "min-h-screen bg-background overflow-x-hidden",
        isMobileLayout && "mobile-view pb-16"
      )}
    >
      {/* Header */}
      <AppHeader
        user={user}
        onSignOut={handleSignOut}
        onMenuToggle={handleMenuToggle}
        isSidebarOpen={sidebarOpen}
      />

      {/* Sidebar */}
      <AppSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isCollapsed={sidebarCollapsed}
        onCollapseToggle={handleCollapseToggle}
      />

      {/* Main Content */}
      <main
        className={cn(
          "pt-14 md:pt-16 transition-all duration-300",
          isMobileLayout ? "ml-0" : sidebarCollapsed ? "md:ml-16" : "md:ml-60"
        )}
      >
        <div className="min-h-[calc(100vh-3.5rem)] md:min-h-[calc(100vh-4rem)]">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      {isMobileLayout && <BottomNavBar />}

      {/* Floating Action Button */}
      {showFab && <FloatingActionButton />}
    </div>
  );
}
