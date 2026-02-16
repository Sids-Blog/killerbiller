import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Package,
  Receipt,
  CreditCard,
  Users,
  Home,
  X,
  LayoutDashboard,
  ShoppingCart,
  Trash2,
  LogOut,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

const allNavigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard, roles: ['admin', 'manager'] },
  { name: "Billing", href: "/billing", icon: Receipt, roles: ['admin', 'manager'] },
  { name: "Orders", href: "/orders", icon: ShoppingCart, roles: ['admin', 'manager', 'staff'] },
  { name: "Inventory", href: "/inventory", icon: Package, roles: ['admin', 'manager'] },
  { name: "Payments", href: "/payments", icon: CreditCard, roles: ['admin', 'manager'] },
  { name: "Customers", href: "/customers", icon: Users, roles: ['admin', 'manager'] },
  { name: "Damaged Stock", href: "/damaged-stock", icon: Trash2, roles: ['admin', 'manager'] },
  { name: "Financial Analytics", href: "/financial-analytics", icon: TrendingUp, roles: ['admin', 'manager'] },
  { name: "Admin", href: "/admin", icon: Home, roles: ['admin'] },
];

interface SidebarProps {
  isMobile: boolean;
  isOpen: boolean;
  isCollapsed: boolean;
  onClose: () => void;
}

export const Sidebar = ({
  isMobile,
  isOpen,
  isCollapsed,
  onClose,
}: SidebarProps) => {
  const location = useLocation();
  const { role } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Debug: Log the current role and navigation
  console.log('Sidebar - Current role:', role);
  console.log('Sidebar - All navigation items:', allNavigation);

  // If no role is assigned, show all navigation items (fallback)
  let navigation = role ? allNavigation.filter(item => item.roles.includes(role)) : allNavigation;

  // Fallback: if no navigation items are found, show at least basic items
  if (navigation.length === 0) {
    console.warn('No navigation items found for role:', role, 'showing fallback navigation');
    navigation = [
      { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ['admin', 'manager'] },
      { name: "Orders", href: "/orders", icon: ShoppingCart, roles: ['admin', 'manager', 'staff'] },
      { name: "Customers", href: "/customers", icon: Users, roles: ['admin', 'manager'] },
    ];
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({ title: "Logged out", description: "You have been successfully logged out." });
    navigate('/auth');
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div
        className={cn(
          "p-4 flex items-center",
          isCollapsed ? "justify-center" : "justify-between"
        )}
      >
        <div
          className={cn(
            "flex items-center gap-2",
            isCollapsed && "justify-center"
          )}
        >
          <Home className="w-6 h-6 text-primary" />
          {!isCollapsed && (
            <div>
              <h1 className="text-xl font-bold text-primary">KillerBiller</h1>
              <p className="text-sm text-muted-foreground">
                Billing & Inventory
              </p>
            </div>
          )}
        </div>
        {isMobile && (
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-6 w-6" />
          </Button>
        )}
      </div>

      <nav
        className={cn(
          "px-4 space-y-1 flex-1",
          isCollapsed && "px-2 text-center"
        )}
      >
        <TooltipProvider>
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;

            return (
              <Tooltip key={item.name} delayDuration={0}>
                <TooltipTrigger asChild>
                  <Link
                    to={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted",
                      isCollapsed && "justify-center"
                    )}
                    onClick={isMobile ? onClose : undefined}
                  >
                    <Icon className="w-5 h-5" />
                    <span className={cn(isCollapsed && "hidden")}>
                      {item.name}
                    </span>
                  </Link>
                </TooltipTrigger>
                {isCollapsed && (
                  <TooltipContent side="right">{item.name}</TooltipContent>
                )}
              </Tooltip>
            );
          })}
        </TooltipProvider>
      </nav>

      <div className="p-4 border-t border-border">
        <TooltipProvider>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  "w-full flex items-center gap-3 text-muted-foreground hover:text-foreground",
                  isCollapsed && "justify-center"
                )}
                onClick={handleLogout}
              >
                <LogOut className="w-5 h-5" />
                <span className={cn(isCollapsed && "hidden")}>Logout</span>
              </Button>
            </TooltipTrigger>
            {isCollapsed && (
              <TooltipContent side="right">Logout</TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <>
        <div
          className={cn(
            "fixed inset-0 bg-background/80 backdrop-blur-sm z-40 transition-opacity",
            isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
          onClick={onClose}
        />
        <aside
          className={cn(
            "fixed top-0 left-0 h-full w-64 bg-card border-r border-border z-50 transform transition-transform",
            isOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <SidebarContent />
        </aside>
      </>
    );
  }

  return (
    <aside
      className={cn(
        "fixed top-0 left-0 h-full bg-card border-r border-border z-20 transition-all duration-300 ease-in-out",
        isCollapsed ? "w-20" : "w-64"
      )}
    >
      <SidebarContent />
    </aside>
  );
};