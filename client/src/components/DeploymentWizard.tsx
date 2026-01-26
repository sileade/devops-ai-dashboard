import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import {
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Check,
  Package,
  Network,
  HardDrive,
  Settings,
  Play,
  Copy,
  Cpu,
  MemoryStick,
  Globe,
  Shield,
} from "lucide-react";
import { toast } from "sonner";

interface ContainerSpec {
  name: string;
  image: string;
  tag: string;
  ports: { containerPort: number; protocol: string }[];
  env: { name: string; value: string }[];
  resources: {
    requests: { cpu: string; memory: string };
    limits: { cpu: string; memory: string };
  };
  command: string[];
  args: string[];
}

interface DeploymentConfig {
  name: string;
  namespace: string;
  replicas: number;
  labels: { key: string; value: string }[];
  containers: ContainerSpec[];
  serviceType: "ClusterIP" | "NodePort" | "LoadBalancer" | "None";
  servicePort: number;
  targetPort: number;
  nodePort?: number;
  strategy: "RollingUpdate" | "Recreate";
  maxSurge: string;
  maxUnavailable: string;
  minReadySeconds: number;
  revisionHistoryLimit: number;
}

interface DeploymentWizardProps {
  onComplete?: (config: DeploymentConfig, yaml: string) => void;
  onCancel?: () => void;
}

const steps = [
  { id: 1, title: "Basic", icon: Package, description: "Deployment basics" },
  { id: 2, title: "Container", icon: Package, description: "Container configuration" },
  { id: 3, title: "Resources", icon: Cpu, description: "CPU & Memory limits" },
  { id: 4, title: "Networking", icon: Globe, description: "Service & ports" },
  { id: 5, title: "Strategy", icon: Settings, description: "Update strategy" },
  { id: 6, title: "Review", icon: Check, description: "Review & deploy" },
];

const namespaces = ["default", "kube-system", "production", "staging", "development"];

export function DeploymentWizard({ onComplete, onCancel }: DeploymentWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [config, setConfig] = useState<DeploymentConfig>({
    name: "",
    namespace: "default",
    replicas: 1,
    labels: [{ key: "app", value: "" }],
    containers: [
      {
        name: "",
        image: "",
        tag: "latest",
        ports: [],
        env: [],
        resources: {
          requests: { cpu: "100m", memory: "128Mi" },
          limits: { cpu: "500m", memory: "512Mi" },
        },
        command: [],
        args: [],
      },
    ],
    serviceType: "ClusterIP",
    servicePort: 80,
    targetPort: 80,
    strategy: "RollingUpdate",
    maxSurge: "25%",
    maxUnavailable: "25%",
    minReadySeconds: 0,
    revisionHistoryLimit: 10,
  });

  const generateId = () => Math.random().toString(36).substring(2, 9);

  // Update container
  const updateContainer = (index: number, updates: Partial<ContainerSpec>) => {
    setConfig((prev) => ({
      ...prev,
      containers: prev.containers.map((c, i) =>
        i === index ? { ...c, ...updates } : c
      ),
    }));
  };

  // Add port to container
  const addPort = (containerIndex: number) => {
    const container = config.containers[containerIndex];
    updateContainer(containerIndex, {
      ports: [...container.ports, { containerPort: 80, protocol: "TCP" }],
    });
  };

  // Remove port from container
  const removePort = (containerIndex: number, portIndex: number) => {
    const container = config.containers[containerIndex];
    updateContainer(containerIndex, {
      ports: container.ports.filter((_, i) => i !== portIndex),
    });
  };

  // Add env var to container
  const addEnvVar = (containerIndex: number) => {
    const container = config.containers[containerIndex];
    updateContainer(containerIndex, {
      env: [...container.env, { name: "", value: "" }],
    });
  };

  // Remove env var from container
  const removeEnvVar = (containerIndex: number, envIndex: number) => {
    const container = config.containers[containerIndex];
    updateContainer(containerIndex, {
      env: container.env.filter((_, i) => i !== envIndex),
    });
  };

  // Generate YAML
  const generateYAML = (): string => {
    const container = config.containers[0];
    
    let yaml = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${config.name}
  namespace: ${config.namespace}
  labels:
${config.labels.map((l) => `    ${l.key}: ${l.value || config.name}`).join("\n")}
spec:
  replicas: ${config.replicas}
  selector:
    matchLabels:
      app: ${config.name}
  strategy:
    type: ${config.strategy}
${config.strategy === "RollingUpdate" ? `    rollingUpdate:
      maxSurge: ${config.maxSurge}
      maxUnavailable: ${config.maxUnavailable}` : ""}
  minReadySeconds: ${config.minReadySeconds}
  revisionHistoryLimit: ${config.revisionHistoryLimit}
  template:
    metadata:
      labels:
        app: ${config.name}
    spec:
      containers:
      - name: ${container.name || config.name}
        image: ${container.image}:${container.tag}
        resources:
          requests:
            cpu: ${container.resources.requests.cpu}
            memory: ${container.resources.requests.memory}
          limits:
            cpu: ${container.resources.limits.cpu}
            memory: ${container.resources.limits.memory}`;

    if (container.ports.length > 0) {
      yaml += `
        ports:
${container.ports.map((p) => `        - containerPort: ${p.containerPort}
          protocol: ${p.protocol}`).join("\n")}`;
    }

    if (container.env.length > 0) {
      yaml += `
        env:
${container.env.filter((e) => e.name).map((e) => `        - name: ${e.name}
          value: "${e.value}"`).join("\n")}`;
    }

    // Add Service if needed
    if (config.serviceType !== "None") {
      yaml += `
---
apiVersion: v1
kind: Service
metadata:
  name: ${config.name}-service
  namespace: ${config.namespace}
spec:
  type: ${config.serviceType}
  selector:
    app: ${config.name}
  ports:
  - port: ${config.servicePort}
    targetPort: ${config.targetPort}
    protocol: TCP`;
      
      if (config.serviceType === "NodePort" && config.nodePort) {
        yaml += `
    nodePort: ${config.nodePort}`;
      }
    }

    return yaml;
  };

  // Validation
  const canProceed = (): boolean => {
    switch (currentStep) {
      case 1:
        return !!config.name;
      case 2:
        return !!config.containers[0].image;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    const yaml = generateYAML();
    onComplete?.(config, yaml);
    toast.success("Deployment configuration created");
  };

  const copyYAML = () => {
    navigator.clipboard.writeText(generateYAML());
    toast.success("YAML copied to clipboard");
  };

  const container = config.containers[0];

  return (
    <div className="flex flex-col h-full">
      {/* Progress Steps */}
      <div className="px-6 py-4 border-b border-border">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id;

            return (
              <div key={step.id} className="flex items-center">
                <div
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : isCompleted
                      ? "bg-green-500/10 text-green-500"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                  <span className="text-sm font-medium hidden md:inline">{step.title}</span>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`w-8 h-0.5 mx-2 ${
                      isCompleted ? "bg-green-500" : "bg-border"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <ScrollArea className="flex-1 p-6">
        {/* Step 1: Basic Info */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">Deployment Basics</h3>
              <p className="text-sm text-muted-foreground">
                Configure the basic settings for your Kubernetes deployment.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Deployment Name *</Label>
                <Input
                  value={config.name}
                  onChange={(e) => setConfig((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="my-app"
                />
              </div>
              <div className="space-y-2">
                <Label>Namespace</Label>
                <Select
                  value={config.namespace}
                  onValueChange={(v) => setConfig((prev) => ({ ...prev, namespace: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {namespaces.map((ns) => (
                      <SelectItem key={ns} value={ns}>
                        {ns}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4">
              <Label>Replicas: {config.replicas}</Label>
              <Slider
                value={[config.replicas]}
                onValueChange={([v]) => setConfig((prev) => ({ ...prev, replicas: v }))}
                min={1}
                max={10}
                step={1}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Number of pod replicas to maintain
              </p>
            </div>

            <div className="space-y-2">
              <Label>Labels</Label>
              {config.labels.map((label, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={label.key}
                    onChange={(e) => {
                      const newLabels = [...config.labels];
                      newLabels[index].key = e.target.value;
                      setConfig((prev) => ({ ...prev, labels: newLabels }));
                    }}
                    placeholder="key"
                    className="flex-1"
                  />
                  <Input
                    value={label.value}
                    onChange={(e) => {
                      const newLabels = [...config.labels];
                      newLabels[index].value = e.target.value;
                      setConfig((prev) => ({ ...prev, labels: newLabels }));
                    }}
                    placeholder="value"
                    className="flex-1"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Container */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">Container Configuration</h3>
              <p className="text-sm text-muted-foreground">
                Configure the container image and settings.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Container Name</Label>
                <Input
                  value={container.name}
                  onChange={(e) => updateContainer(0, { name: e.target.value })}
                  placeholder="main"
                />
              </div>
              <div className="space-y-2">
                <Label>Image *</Label>
                <Input
                  value={container.image}
                  onChange={(e) => updateContainer(0, { image: e.target.value })}
                  placeholder="nginx"
                />
              </div>
              <div className="space-y-2">
                <Label>Tag</Label>
                <Input
                  value={container.tag}
                  onChange={(e) => updateContainer(0, { tag: e.target.value })}
                  placeholder="latest"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label>Container Ports</Label>
              {container.ports.map((port, index) => (
                <div key={index} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                  <div className="flex-1 grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Port</Label>
                      <Input
                        type="number"
                        value={port.containerPort}
                        onChange={(e) => {
                          const newPorts = [...container.ports];
                          newPorts[index].containerPort = parseInt(e.target.value) || 80;
                          updateContainer(0, { ports: newPorts });
                        }}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Protocol</Label>
                      <Select
                        value={port.protocol}
                        onValueChange={(v) => {
                          const newPorts = [...container.ports];
                          newPorts[index].protocol = v;
                          updateContainer(0, { ports: newPorts });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="TCP">TCP</SelectItem>
                          <SelectItem value="UDP">UDP</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-500"
                    onClick={() => removePort(0, index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" onClick={() => addPort(0)} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add Port
              </Button>
            </div>

            <div className="space-y-3">
              <Label>Environment Variables</Label>
              {container.env.map((env, index) => (
                <div key={index} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                  <div className="flex-1 grid grid-cols-2 gap-3">
                    <Input
                      value={env.name}
                      onChange={(e) => {
                        const newEnv = [...container.env];
                        newEnv[index].name = e.target.value;
                        updateContainer(0, { env: newEnv });
                      }}
                      placeholder="NAME"
                    />
                    <Input
                      value={env.value}
                      onChange={(e) => {
                        const newEnv = [...container.env];
                        newEnv[index].value = e.target.value;
                        updateContainer(0, { env: newEnv });
                      }}
                      placeholder="value"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-500"
                    onClick={() => removeEnvVar(0, index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" onClick={() => addEnvVar(0)} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add Environment Variable
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Resources */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">Resource Limits</h3>
              <p className="text-sm text-muted-foreground">
                Configure CPU and memory requests and limits for the container.
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Cpu className="h-4 w-4" />
                  CPU Resources
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Request</Label>
                  <Input
                    value={container.resources.requests.cpu}
                    onChange={(e) =>
                      updateContainer(0, {
                        resources: {
                          ...container.resources,
                          requests: { ...container.resources.requests, cpu: e.target.value },
                        },
                      })
                    }
                    placeholder="100m"
                  />
                  <p className="text-xs text-muted-foreground">Minimum CPU guaranteed</p>
                </div>
                <div className="space-y-2">
                  <Label>Limit</Label>
                  <Input
                    value={container.resources.limits.cpu}
                    onChange={(e) =>
                      updateContainer(0, {
                        resources: {
                          ...container.resources,
                          limits: { ...container.resources.limits, cpu: e.target.value },
                        },
                      })
                    }
                    placeholder="500m"
                  />
                  <p className="text-xs text-muted-foreground">Maximum CPU allowed</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <MemoryStick className="h-4 w-4" />
                  Memory Resources
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Request</Label>
                  <Input
                    value={container.resources.requests.memory}
                    onChange={(e) =>
                      updateContainer(0, {
                        resources: {
                          ...container.resources,
                          requests: { ...container.resources.requests, memory: e.target.value },
                        },
                      })
                    }
                    placeholder="128Mi"
                  />
                  <p className="text-xs text-muted-foreground">Minimum memory guaranteed</p>
                </div>
                <div className="space-y-2">
                  <Label>Limit</Label>
                  <Input
                    value={container.resources.limits.memory}
                    onChange={(e) =>
                      updateContainer(0, {
                        resources: {
                          ...container.resources,
                          limits: { ...container.resources.limits, memory: e.target.value },
                        },
                      })
                    }
                    placeholder="512Mi"
                  />
                  <p className="text-xs text-muted-foreground">Maximum memory allowed</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 4: Networking */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">Service Configuration</h3>
              <p className="text-sm text-muted-foreground">
                Configure how your deployment is exposed.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Service Type</Label>
              <Select
                value={config.serviceType}
                onValueChange={(v: DeploymentConfig["serviceType"]) =>
                  setConfig((prev) => ({ ...prev, serviceType: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ClusterIP">ClusterIP (Internal only)</SelectItem>
                  <SelectItem value="NodePort">NodePort (External via node port)</SelectItem>
                  <SelectItem value="LoadBalancer">LoadBalancer (Cloud LB)</SelectItem>
                  <SelectItem value="None">None (No service)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {config.serviceType !== "None" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Service Port</Label>
                  <Input
                    type="number"
                    value={config.servicePort}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, servicePort: parseInt(e.target.value) || 80 }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">Port exposed by the service</p>
                </div>
                <div className="space-y-2">
                  <Label>Target Port</Label>
                  <Input
                    type="number"
                    value={config.targetPort}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, targetPort: parseInt(e.target.value) || 80 }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">Port on the container</p>
                </div>
                {config.serviceType === "NodePort" && (
                  <div className="space-y-2">
                    <Label>Node Port (optional)</Label>
                    <Input
                      type="number"
                      value={config.nodePort || ""}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          nodePort: parseInt(e.target.value) || undefined,
                        }))
                      }
                      placeholder="30000-32767"
                    />
                    <p className="text-xs text-muted-foreground">Leave empty for auto-assign</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 5: Strategy */}
        {currentStep === 5 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">Update Strategy</h3>
              <p className="text-sm text-muted-foreground">
                Configure how updates are rolled out.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Strategy Type</Label>
              <Select
                value={config.strategy}
                onValueChange={(v: DeploymentConfig["strategy"]) =>
                  setConfig((prev) => ({ ...prev, strategy: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RollingUpdate">Rolling Update</SelectItem>
                  <SelectItem value="Recreate">Recreate</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {config.strategy === "RollingUpdate" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Max Surge</Label>
                  <Input
                    value={config.maxSurge}
                    onChange={(e) => setConfig((prev) => ({ ...prev, maxSurge: e.target.value }))}
                    placeholder="25%"
                  />
                  <p className="text-xs text-muted-foreground">
                    Max pods above desired during update
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Max Unavailable</Label>
                  <Input
                    value={config.maxUnavailable}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, maxUnavailable: e.target.value }))
                    }
                    placeholder="25%"
                  />
                  <p className="text-xs text-muted-foreground">
                    Max unavailable pods during update
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Min Ready Seconds</Label>
                <Input
                  type="number"
                  value={config.minReadySeconds}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, minReadySeconds: parseInt(e.target.value) || 0 }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Seconds before pod is considered ready
                </p>
              </div>
              <div className="space-y-2">
                <Label>Revision History Limit</Label>
                <Input
                  type="number"
                  value={config.revisionHistoryLimit}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      revisionHistoryLimit: parseInt(e.target.value) || 10,
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Number of old ReplicaSets to retain
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 6: Review */}
        {currentStep === 6 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">Review Configuration</h3>
              <p className="text-sm text-muted-foreground">
                Review your deployment configuration before creating.
              </p>
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Deployment Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Name:</span>
                    <span className="ml-2 font-medium">{config.name}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Namespace:</span>
                    <span className="ml-2">{config.namespace}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Replicas:</span>
                    <span className="ml-2">{config.replicas}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Strategy:</span>
                    <span className="ml-2">{config.strategy}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Image:</span>
                    <span className="ml-2 font-medium">
                      {container.image}:{container.tag}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Service:</span>
                    <span className="ml-2">{config.serviceType}</span>
                  </div>
                </div>

                <div>
                  <span className="text-sm text-muted-foreground">Resources:</span>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="outline">
                      CPU: {container.resources.requests.cpu} - {container.resources.limits.cpu}
                    </Badge>
                    <Badge variant="outline">
                      Memory: {container.resources.requests.memory} -{" "}
                      {container.resources.limits.memory}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Generated YAML</CardTitle>
                  <Button variant="ghost" size="sm" onClick={copyYAML}>
                    <Copy className="h-4 w-4 mr-1" />
                    Copy
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <pre className="p-4 rounded-lg bg-black/90 text-green-400 text-xs font-mono whitespace-pre">
                    {generateYAML()}
                  </pre>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        )}
      </ScrollArea>

      {/* Footer Navigation */}
      <div className="px-6 py-4 border-t border-border flex items-center justify-between">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <div className="flex items-center gap-2">
          {currentStep > 1 && (
            <Button variant="outline" onClick={handleBack}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          )}
          {currentStep < steps.length ? (
            <Button onClick={handleNext} disabled={!canProceed()}>
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleComplete} className="bg-green-600 hover:bg-green-700">
              <Play className="h-4 w-4 mr-1" />
              Create Deployment
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default DeploymentWizard;
