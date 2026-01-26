import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Box,
  Layers,
  Terminal,
  FileCode,
  Bot,
  Plus,
  Play,
  Search,
  Settings,
  HelpCircle,
  Zap,
  Server,
  Database,
  Network,
  Shield,
  Activity,
  BarChart3,
} from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  category: string;
  action: () => void;
}

export interface QuickActionsProps {
  isOpen?: boolean;
  onClose?: () => void;
  onOpenContainerWizard?: () => void;
  onOpenDeploymentWizard?: () => void;
  onOpenPlaybookEditor?: () => void;
  onOpenTerraformBuilder?: () => void;
}

export function QuickActions({
  isOpen: externalIsOpen,
  onClose,
  onOpenContainerWizard,
  onOpenDeploymentWizard,
  onOpenPlaybookEditor,
  onOpenTerraformBuilder,
}: QuickActionsProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  
  // Use external control if provided
  const open = externalIsOpen !== undefined ? externalIsOpen : internalOpen;
  const setOpen = (value: boolean) => {
    if (externalIsOpen !== undefined) {
      if (!value && onClose) onClose();
    } else {
      setInternalOpen(value);
    }
  };
  const [, setLocation] = useLocation();

  // Listen for keyboard shortcut (only when not externally controlled)
  useEffect(() => {
    if (externalIsOpen !== undefined) return; // Skip if externally controlled
    
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setInternalOpen(prev => !prev);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [externalIsOpen]);

  const quickActions: QuickAction[] = [
    // Create Actions
    {
      id: "new-container",
      title: "Create Container",
      description: "Launch a new Docker container with wizard",
      icon: Box,
      category: "Create",
      action: () => {
        setOpen(false);
        if (onOpenContainerWizard) {
          onOpenContainerWizard();
        } else {
          setLocation("/docker");
          toast.info("Navigate to Docker page and click 'New Container'");
        }
      },
    },
    {
      id: "new-deployment",
      title: "Create Deployment",
      description: "Deploy application to Kubernetes",
      icon: Layers,
      category: "Create",
      action: () => {
        setOpen(false);
        if (onOpenDeploymentWizard) {
          onOpenDeploymentWizard();
        } else {
          setLocation("/kubernetes");
          toast.info("Navigate to Kubernetes page and click 'New Deployment'");
        }
      },
    },
    {
      id: "new-playbook",
      title: "Create Playbook",
      description: "Build Ansible playbook visually",
      icon: Terminal,
      category: "Create",
      action: () => {
        setOpen(false);
        if (onOpenPlaybookEditor) {
          onOpenPlaybookEditor();
        } else {
          setLocation("/ansible");
          toast.info("Navigate to Ansible page and click 'New Playbook'");
        }
      },
    },
    {
      id: "new-terraform",
      title: "Create Terraform Config",
      description: "Build infrastructure as code",
      icon: FileCode,
      category: "Create",
      action: () => {
        setOpen(false);
        if (onOpenTerraformBuilder) {
          onOpenTerraformBuilder();
        } else {
          setLocation("/terraform");
          toast.info("Navigate to Terraform page and click 'New Config'");
        }
      },
    },

    // Navigation
    {
      id: "nav-dashboard",
      title: "Dashboard",
      description: "View system overview",
      icon: BarChart3,
      category: "Navigate",
      action: () => {
        setOpen(false);
        setLocation("/");
      },
    },
    {
      id: "nav-docker",
      title: "Docker",
      description: "Manage containers and images",
      icon: Box,
      category: "Navigate",
      action: () => {
        setOpen(false);
        setLocation("/docker");
      },
    },
    {
      id: "nav-kubernetes",
      title: "Kubernetes",
      description: "Manage cluster resources",
      icon: Layers,
      category: "Navigate",
      action: () => {
        setOpen(false);
        setLocation("/kubernetes");
      },
    },
    {
      id: "nav-ansible",
      title: "Ansible",
      description: "Automation playbooks",
      icon: Terminal,
      category: "Navigate",
      action: () => {
        setOpen(false);
        setLocation("/ansible");
      },
    },
    {
      id: "nav-terraform",
      title: "Terraform",
      description: "Infrastructure as code",
      icon: FileCode,
      category: "Navigate",
      action: () => {
        setOpen(false);
        setLocation("/terraform");
      },
    },
    {
      id: "nav-ai",
      title: "AI Assistant",
      description: "Get help from AI",
      icon: Bot,
      category: "Navigate",
      action: () => {
        setOpen(false);
        setLocation("/ai-assistant");
      },
    },

    // Quick Actions
    {
      id: "action-refresh",
      title: "Refresh All",
      description: "Refresh all infrastructure data",
      icon: Activity,
      category: "Actions",
      action: () => {
        setOpen(false);
        toast.success("Refreshing infrastructure data...");
      },
    },
    {
      id: "action-scaling",
      title: "Auto-Scaling",
      description: "Configure auto-scaling rules",
      icon: Zap,
      category: "Actions",
      action: () => {
        setOpen(false);
        setLocation("/auto-scaling");
      },
    },
    {
      id: "action-monitoring",
      title: "Monitoring",
      description: "View metrics and alerts",
      icon: Activity,
      category: "Actions",
      action: () => {
        setOpen(false);
        setLocation("/monitoring");
      },
    },

    // Help
    {
      id: "help-docs",
      title: "Documentation",
      description: "View documentation",
      icon: HelpCircle,
      category: "Help",
      action: () => {
        setOpen(false);
        toast.info("Opening documentation...");
      },
    },
    {
      id: "help-settings",
      title: "Settings",
      description: "Configure application settings",
      icon: Settings,
      category: "Help",
      action: () => {
        setOpen(false);
        setLocation("/settings");
      },
    },
  ];

  const categories = Array.from(new Set(quickActions.map((a) => a.category)));

  return (
    <>
      <Button
        variant="outline"
        className="relative h-9 w-full justify-start text-sm text-muted-foreground sm:pr-12 md:w-40 lg:w-64"
        onClick={() => setOpen(true)}
      >
        <Search className="mr-2 h-4 w-4" />
        <span className="hidden lg:inline-flex">Quick actions...</span>
        <span className="inline-flex lg:hidden">Search...</span>
        <kbd className="pointer-events-none absolute right-1.5 top-1.5 hidden h-6 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          {categories.map((category, index) => (
            <div key={category}>
              {index > 0 && <CommandSeparator />}
              <CommandGroup heading={category}>
                {quickActions
                  .filter((action) => action.category === category)
                  .map((action) => {
                    const Icon = action.icon;
                    return (
                      <CommandItem
                        key={action.id}
                        onSelect={action.action}
                        className="cursor-pointer"
                      >
                        <Icon className="mr-2 h-4 w-4" />
                        <div className="flex flex-col">
                          <span>{action.title}</span>
                          <span className="text-xs text-muted-foreground">
                            {action.description}
                          </span>
                        </div>
                      </CommandItem>
                    );
                  })}
              </CommandGroup>
            </div>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}

export default QuickActions;
