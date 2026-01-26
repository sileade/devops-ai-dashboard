import { useLocation, Link } from "wouter";
import { ChevronRight, Home } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ReactNode;
}

// Route to breadcrumb mapping
const routeLabels: Record<string, string> = {
  "": "Dashboard",
  docker: "Docker",
  kubernetes: "Kubernetes",
  podman: "Podman",
  ansible: "Ansible",
  terraform: "Terraform",
  "ai-assistant": "AI Assistant",
  "auto-scaling": "Auto Scaling",
  monitoring: "Monitoring",
  notifications: "Notifications",
  settings: "Settings",
  topology: "Topology",
  logs: "Logs",
  applications: "Applications",
};

interface BreadcrumbProps {
  customItems?: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ customItems, className = "" }: BreadcrumbProps) {
  const [location] = useLocation();

  // Generate breadcrumb items from current path
  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    if (customItems) {
      return customItems;
    }

    const pathSegments = location.split("/").filter(Boolean);
    const items: BreadcrumbItem[] = [
      {
        label: "Home",
        href: "/",
        icon: <Home className="h-4 w-4" />,
      },
    ];

    let currentPath = "";
    pathSegments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      const label = routeLabels[segment] || formatSegment(segment);
      const isLast = index === pathSegments.length - 1;

      items.push({
        label,
        href: isLast ? undefined : currentPath,
      });
    });

    return items;
  };

  // Format segment to readable label
  const formatSegment = (segment: string): string => {
    return segment
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const breadcrumbs = generateBreadcrumbs();

  // Don't show breadcrumb on home page
  if (location === "/" && !customItems) {
    return null;
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center text-sm text-muted-foreground ${className}`}
    >
      <ol className="flex items-center space-x-1">
        {breadcrumbs.map((item, index) => {
          const isLast = index === breadcrumbs.length - 1;

          return (
            <li key={index} className="flex items-center">
              {index > 0 && (
                <ChevronRight className="h-4 w-4 mx-1 text-muted-foreground/50" />
              )}
              {item.href ? (
                <Link
                  href={item.href}
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              ) : (
                <span
                  className={`flex items-center gap-1 ${
                    isLast ? "text-foreground font-medium" : ""
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// Compact breadcrumb for mobile
export function BreadcrumbCompact({ className = "" }: { className?: string }) {
  const [location] = useLocation();

  if (location === "/") {
    return null;
  }

  const pathSegments = location.split("/").filter(Boolean);
  const currentPage = pathSegments[pathSegments.length - 1];
  const label = routeLabels[currentPage] || formatSegmentCompact(currentPage);
  const parentPath = pathSegments.length > 1 
    ? "/" + pathSegments.slice(0, -1).join("/")
    : "/";

  function formatSegmentCompact(segment: string): string {
    return segment
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center text-sm ${className}`}
    >
      <Link
        href={parentPath}
        className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronRight className="h-4 w-4 rotate-180" />
        <span>Back</span>
      </Link>
      <ChevronRight className="h-4 w-4 mx-1 text-muted-foreground/50" />
      <span className="font-medium">{label}</span>
    </nav>
  );
}

export default Breadcrumb;
