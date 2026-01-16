import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import {
  LayoutDashboard,
  LogOut,
  PanelLeft,
  Container,
  Box,
  Network,
  GitBranch,
  Server,
  FileCode,
  Layers,
  Bot,
  ScrollText,
  Bell,
  Settings,
  ChevronDown,
  Folder,
  Scale,
  Calendar,
  FlaskConical,
  Globe,
  Mail,
  Activity,
  Rocket,
  Bird,
  MessageSquare,
  ArrowLeftRight,
  Users,
  FileText,
  FileBarChart,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

type MenuItem = {
  icon: React.ElementType;
  label: string;
  path: string;
  children?: MenuItem[];
};

const menuItems: MenuItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Folder, label: "Applications", path: "/applications" },
  {
    icon: Container,
    label: "Containers",
    path: "/containers",
    children: [
      { icon: Container, label: "Docker", path: "/containers/docker" },
      { icon: Box, label: "Podman", path: "/containers/podman" },
    ],
  },
  { icon: Network, label: "Kubernetes", path: "/kubernetes" },
  {
    icon: Server,
    label: "Infrastructure",
    path: "/infrastructure",
    children: [
      { icon: FileCode, label: "Ansible", path: "/infrastructure/ansible" },
      { icon: Layers, label: "Terraform", path: "/infrastructure/terraform" },
    ],
  },
  { icon: Bot, label: "AI Assistant", path: "/ai-assistant" },
  { icon: ScrollText, label: "Logs", path: "/logs" },
  { icon: Bell, label: "Notifications", path: "/notifications" },
  {
    icon: Scale,
    label: "Scaling",
    path: "/scaling",
    children: [
      { icon: Scale, label: "Auto-Scaling", path: "/autoscaling" },
      { icon: Calendar, label: "Scheduled", path: "/scheduled-scaling" },
      { icon: FlaskConical, label: "A/B Testing", path: "/ab-testing" },
    ],
  },
  { icon: GitBranch, label: "Topology", path: "/topology" },
  { icon: Globe, label: "Clusters", path: "/clusters" },
  { icon: Rocket, label: "GitOps", path: "/gitops" },
  { icon: Bird, label: "Canary Deployments", path: "/canary" },
  { icon: ArrowLeftRight, label: "Blue-Green", path: "/bluegreen" },
  { icon: GitBranch, label: "ArgoCD", path: "/argocd" },
  { icon: MessageSquare, label: "Chat Bot", path: "/chatbot" },
  { icon: Users, label: "Teams", path: "/teams" },
  { icon: FileText, label: "Audit Log", path: "/audit-log" },
  { icon: FileBarChart, label: "Reports", path: "/reports" },
  {
    icon: Settings,
    label: "Settings",
    path: "/settings",
    children: [
      { icon: Settings, label: "General", path: "/settings" },
      { icon: Bell, label: "Alert Thresholds", path: "/settings/alerts" },
      { icon: Mail, label: "Email", path: "/settings/email" },
      { icon: Activity, label: "Prometheus", path: "/settings/prometheus" },
    ],
  },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  // TEMPORARILY DISABLED: Authentication check
  // TODO: Re-enable authentication before production
  // if (!user) {
  //   return (
  //     <div className="flex items-center justify-center min-h-screen bg-background">
  //       ...
  //     </div>
  //   );
  // }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [openMenus, setOpenMenus] = useState<string[]>([]);
  const isMobile = useIsMobile();

  const activeMenuItem = menuItems.find(
    (item) =>
      item.path === location ||
      item.children?.some((child) => child.path === location)
  );

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft =
        sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  const toggleMenu = (path: string) => {
    setOpenMenus((prev) =>
      prev.includes(path)
        ? prev.filter((p) => p !== path)
        : [...prev, path]
    );
  };

  const renderMenuItem = (item: MenuItem, depth = 0) => {
    const isActive =
      location === item.path ||
      item.children?.some((child) => location === child.path);
    const hasChildren = item.children && item.children.length > 0;
    const isOpen = openMenus.includes(item.path);

    if (hasChildren) {
      return (
        <Collapsible
          key={item.path}
          open={isOpen}
          onOpenChange={() => toggleMenu(item.path)}
        >
          <SidebarMenuItem>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton
                isActive={isActive}
                tooltip={item.label}
                className="h-10 transition-all font-normal justify-between"
              >
                <div className="flex items-center gap-2">
                  <item.icon
                    className={`h-4 w-4 ${isActive ? "text-primary" : ""}`}
                  />
                  <span>{item.label}</span>
                </div>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenu className="pl-4 mt-1">
                {item.children?.map((child) => renderMenuItem(child, depth + 1))}
              </SidebarMenu>
            </CollapsibleContent>
          </SidebarMenuItem>
        </Collapsible>
      );
    }

    return (
      <SidebarMenuItem key={item.path}>
        <SidebarMenuButton
          isActive={location === item.path}
          onClick={() => setLocation(item.path)}
          tooltip={item.label}
          className="h-10 transition-all font-normal"
        >
          <item.icon
            className={`h-4 w-4 ${location === item.path ? "text-primary" : ""}`}
          />
          <span>{item.label}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center border-b border-border/50">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-7 w-7 rounded-lg bg-primary/20 flex items-center justify-center">
                    <Server className="h-4 w-4 text-primary" />
                  </div>
                  <span className="font-semibold tracking-tight truncate text-sm">
                    DevOps AI
                  </span>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 py-2">
            <SidebarMenu className="px-2 py-1 space-y-0.5">
              {menuItems.map((item) => renderMenuItem(item))}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3 border-t border-border/50">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarFallback className="text-xs font-medium bg-primary/20 text-primary">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">
                      {user?.name || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
                      {user?.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={() => setLocation("/settings")}
                  className="cursor-pointer"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <span className="tracking-tight text-foreground">
                    {activeMenuItem?.label ?? "Menu"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </>
  );
}
