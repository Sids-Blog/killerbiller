import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Package,
  Receipt,
  CreditCard,
  Users,
  Settings,
  Home,
  X,
  LayoutDashboard,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Billing", href: "/billing", icon: Receipt },
  { name: "Orders", href: "/orders", icon: ShoppingCart },
  { name: "Inventory", href: "/inventory", icon: Package },
  { name: "Payments", href: "/payments", icon: CreditCard },
  { name: "Customers", href: "/customers", icon: Users },
  { name: "Damaged Stock", href: "/damaged-stock", icon: Trash2 },
  { name: "Admin", href: "/admin", icon: Home },
  // Add more items as needed
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
