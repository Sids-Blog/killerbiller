import { ReactNode, useState } from "react";
import { Sidebar } from "@/components/organisms/Sidebar";
import { Button } from "@/components/ui/button";
import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: ReactNode;
}

export const AppLayout = ({ children }: AppLayoutProps) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const isMobile = useIsMobile();

  const toggleSidebar = () => {
    if (isMobile) {
      setIsMobileMenuOpen(!isMobileMenuOpen);
    } else {
      setIsSidebarCollapsed(!isSidebarCollapsed);
    }
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        isMobile={isMobile}
        isOpen={isMobileMenuOpen}
        isCollapsed={isSidebarCollapsed}
        onClose={closeMobileMenu}
      />
      <div
        className={cn(
          "flex-1 flex flex-col transition-all duration-300 ease-in-out",
          !isMobile && (isSidebarCollapsed ? "ml-20" : "ml-64")
        )}
      >
        <header className="sticky top-0 z-10 flex items-center justify-between h-16 px-4 bg-background/80 backdrop-blur-sm border-b border-border">
          <div className="flex items-center space-x-4 align-middle justify-center">
            <img
              src="/logo.svg"
              alt="Enterprises Logo"
              className="h-8 w-auto"
            />
            <h1 className="text-lg font-semibold text-foreground">
            KillerBiller
          </h1>
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={toggleSidebar}
          >
            <Menu className="h-6 w-6" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="hidden md:flex"
            onClick={toggleSidebar}
          >
            {isSidebarCollapsed ? (
              <PanelLeftOpen className="h-6 w-6" />
            ) : (
              <PanelLeftClose className="h-6 w-6" />
            )}
          </Button>
        </header>
        <main className="flex-1 overflow-auto">
          <div className="container mx-auto p-4 sm:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
