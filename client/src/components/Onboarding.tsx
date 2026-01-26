import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  Box,
  Layers,
  Terminal,
  FileCode,
  Bot,
  ArrowRight,
  CheckCircle2,
  Rocket,
  Settings,
  Shield,
} from "lucide-react";

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  features: string[];
}

const onboardingSteps: OnboardingStep[] = [
  {
    id: "welcome",
    title: "Welcome to DevOps AI Dashboard",
    description: "Your unified platform for managing infrastructure with AI-powered automation",
    icon: Rocket,
    features: [
      "Manage Docker, Kubernetes, Podman from one place",
      "Automate with Ansible and Terraform",
      "Get AI-powered recommendations",
      "Monitor and scale your infrastructure",
    ],
  },
  {
    id: "docker",
    title: "Docker Management",
    description: "Full container lifecycle management with visual tools",
    icon: Box,
    features: [
      "Create containers with step-by-step wizard",
      "Monitor resource usage in real-time",
      "View logs and execute commands",
      "Manage images, networks, and volumes",
    ],
  },
  {
    id: "kubernetes",
    title: "Kubernetes Orchestration",
    description: "Manage your clusters with intuitive visual interface",
    icon: Layers,
    features: [
      "Deploy applications with visual wizard",
      "Monitor pods, deployments, and services",
      "Scale workloads with one click",
      "Built-in kubectl terminal",
    ],
  },
  {
    id: "ansible",
    title: "Ansible Automation",
    description: "Create and manage playbooks visually",
    icon: Terminal,
    features: [
      "Visual playbook editor with drag-and-drop",
      "Pre-built task templates",
      "Inventory management",
      "Execution history and logs",
    ],
  },
  {
    id: "terraform",
    title: "Terraform Infrastructure",
    description: "Build infrastructure as code visually",
    icon: FileCode,
    features: [
      "Visual resource builder",
      "Multi-cloud support (AWS, GCP, Azure)",
      "State visualization and management",
      "Plan and apply from UI",
    ],
  },
  {
    id: "ai",
    title: "AI Assistant",
    description: "Get intelligent help for your DevOps tasks",
    icon: Bot,
    features: [
      "Natural language commands",
      "Troubleshooting recommendations",
      "Auto-scaling predictions",
      "Knowledge base integration",
    ],
  },
];

interface OnboardingProps {
  onComplete?: () => void;
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    // Check if user has completed onboarding
    const hasCompletedOnboarding = localStorage.getItem("devops-onboarding-completed");
    if (!hasCompletedOnboarding) {
      setIsOpen(true);
    }
  }, []);

  const handleNext = () => {
    if (currentStep < onboardingSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = () => {
    localStorage.setItem("devops-onboarding-completed", "true");
    setIsOpen(false);
    onComplete?.();
  };

  const progress = ((currentStep + 1) / onboardingSteps.length) * 100;
  const step = onboardingSteps[currentStep];
  const Icon = step.icon;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">
              Step {currentStep + 1} of {onboardingSteps.length}
            </span>
            <Button variant="ghost" size="sm" onClick={handleSkip}>
              Skip tour
            </Button>
          </div>
          <Progress value={progress} className="h-1 mb-4" />
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 rounded-lg bg-primary/10">
              <Icon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl">{step.title}</DialogTitle>
              <DialogDescription>{step.description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {step.features.map((feature, index) => (
            <div key={index} className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
              <span className="text-sm">{feature}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex gap-1">
            {onboardingSteps.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentStep(index)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentStep
                    ? "bg-primary"
                    : index < currentStep
                    ? "bg-primary/50"
                    : "bg-muted"
                }`}
              />
            ))}
          </div>
          <Button onClick={handleNext}>
            {currentStep === onboardingSteps.length - 1 ? (
              <>
                Get Started
                <Rocket className="h-4 w-4 ml-2" />
              </>
            ) : (
              <>
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function resetOnboarding() {
  localStorage.removeItem("devops-onboarding-completed");
}

export default Onboarding;
