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
  AlertCircle,
  Info,
  Copy,
} from "lucide-react";
import { toast } from "sonner";

interface PortMapping {
  id: string;
  hostPort: string;
  containerPort: string;
  protocol: "tcp" | "udp";
}

interface VolumeMount {
  id: string;
  hostPath: string;
  containerPath: string;
  readOnly: boolean;
}

interface EnvVariable {
  id: string;
  key: string;
  value: string;
}

interface ContainerConfig {
  name: string;
  image: string;
  tag: string;
  ports: PortMapping[];
  volumes: VolumeMount[];
  envVars: EnvVariable[];
  network: string;
  restartPolicy: "no" | "always" | "on-failure" | "unless-stopped";
  command: string;
  workdir: string;
  user: string;
  privileged: boolean;
  autoRemove: boolean;
  cpuLimit: string;
  memoryLimit: string;
}

interface ContainerWizardProps {
  onComplete?: (config: ContainerConfig, command: string) => void;
  onCancel?: () => void;
}

const steps = [
  { id: 1, title: "Image", icon: Package, description: "Select container image" },
  { id: 2, title: "Ports", icon: Network, description: "Configure port mappings" },
  { id: 3, title: "Volumes", icon: HardDrive, description: "Mount volumes" },
  { id: 4, title: "Environment", icon: Settings, description: "Set environment variables" },
  { id: 5, title: "Advanced", icon: Settings, description: "Advanced options" },
  { id: 6, title: "Review", icon: Check, description: "Review and create" },
];

const popularImages = [
  { name: "nginx", desc: "Web server", tag: "latest" },
  { name: "postgres", desc: "PostgreSQL database", tag: "15" },
  { name: "redis", desc: "In-memory data store", tag: "7" },
  { name: "mysql", desc: "MySQL database", tag: "8" },
  { name: "mongo", desc: "MongoDB database", tag: "6" },
  { name: "node", desc: "Node.js runtime", tag: "20" },
  { name: "python", desc: "Python runtime", tag: "3.11" },
  { name: "ubuntu", desc: "Ubuntu base image", tag: "22.04" },
];

export function ContainerWizard({ onComplete, onCancel }: ContainerWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [config, setConfig] = useState<ContainerConfig>({
    name: "",
    image: "",
    tag: "latest",
    ports: [],
    volumes: [],
    envVars: [],
    network: "bridge",
    restartPolicy: "no",
    command: "",
    workdir: "",
    user: "",
    privileged: false,
    autoRemove: false,
    cpuLimit: "",
    memoryLimit: "",
  });

  const generateId = () => Math.random().toString(36).substring(2, 9);

  // Port management
  const addPort = () => {
    setConfig((prev) => ({
      ...prev,
      ports: [...prev.ports, { id: generateId(), hostPort: "", containerPort: "", protocol: "tcp" }],
    }));
  };

  const removePort = (id: string) => {
    setConfig((prev) => ({
      ...prev,
      ports: prev.ports.filter((p) => p.id !== id),
    }));
  };

  const updatePort = (id: string, field: keyof PortMapping, value: string) => {
    setConfig((prev) => ({
      ...prev,
      ports: prev.ports.map((p) => (p.id === id ? { ...p, [field]: value } : p)),
    }));
  };

  // Volume management
  const addVolume = () => {
    setConfig((prev) => ({
      ...prev,
      volumes: [...prev.volumes, { id: generateId(), hostPath: "", containerPath: "", readOnly: false }],
    }));
  };

  const removeVolume = (id: string) => {
    setConfig((prev) => ({
      ...prev,
      volumes: prev.volumes.filter((v) => v.id !== id),
    }));
  };

  const updateVolume = (id: string, field: keyof VolumeMount, value: string | boolean) => {
    setConfig((prev) => ({
      ...prev,
      volumes: prev.volumes.map((v) => (v.id === id ? { ...v, [field]: value } : v)),
    }));
  };

  // Environment variable management
  const addEnvVar = () => {
    setConfig((prev) => ({
      ...prev,
      envVars: [...prev.envVars, { id: generateId(), key: "", value: "" }],
    }));
  };

  const removeEnvVar = (id: string) => {
    setConfig((prev) => ({
      ...prev,
      envVars: prev.envVars.filter((e) => e.id !== id),
    }));
  };

  const updateEnvVar = (id: string, field: keyof EnvVariable, value: string) => {
    setConfig((prev) => ({
      ...prev,
      envVars: prev.envVars.map((e) => (e.id === id ? { ...e, [field]: value } : e)),
    }));
  };

  // Generate Docker command
  const generateCommand = (): string => {
    const parts = ["docker run"];

    if (config.name) parts.push(`--name ${config.name}`);
    if (config.autoRemove) parts.push("--rm");
    if (config.privileged) parts.push("--privileged");
    if (config.restartPolicy !== "no") parts.push(`--restart ${config.restartPolicy}`);
    if (config.network !== "bridge") parts.push(`--network ${config.network}`);
    if (config.workdir) parts.push(`-w ${config.workdir}`);
    if (config.user) parts.push(`-u ${config.user}`);
    if (config.cpuLimit) parts.push(`--cpus ${config.cpuLimit}`);
    if (config.memoryLimit) parts.push(`-m ${config.memoryLimit}`);

    config.ports.forEach((p) => {
      if (p.hostPort && p.containerPort) {
        parts.push(`-p ${p.hostPort}:${p.containerPort}${p.protocol === "udp" ? "/udp" : ""}`);
      }
    });

    config.volumes.forEach((v) => {
      if (v.hostPath && v.containerPath) {
        parts.push(`-v ${v.hostPath}:${v.containerPath}${v.readOnly ? ":ro" : ""}`);
      }
    });

    config.envVars.forEach((e) => {
      if (e.key) {
        parts.push(`-e ${e.key}=${e.value}`);
      }
    });

    parts.push("-d");
    parts.push(`${config.image}:${config.tag}`);

    if (config.command) parts.push(config.command);

    return parts.join(" \\\n  ");
  };

  // Validation
  const canProceed = (): boolean => {
    switch (currentStep) {
      case 1:
        return !!config.image;
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
    const command = generateCommand();
    onComplete?.(config, command);
    toast.success("Container configuration created");
  };

  const copyCommand = () => {
    navigator.clipboard.writeText(generateCommand());
    toast.success("Command copied to clipboard");
  };

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
        {/* Step 1: Image Selection */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">Select Container Image</h3>
              <p className="text-sm text-muted-foreground">
                Choose a Docker image to run. You can select from popular images or enter a custom image name.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Image Name</Label>
                <Input
                  value={config.image}
                  onChange={(e) => setConfig((prev) => ({ ...prev, image: e.target.value }))}
                  placeholder="nginx, postgres, my-app..."
                />
              </div>
              <div className="space-y-2">
                <Label>Tag</Label>
                <Input
                  value={config.tag}
                  onChange={(e) => setConfig((prev) => ({ ...prev, tag: e.target.value }))}
                  placeholder="latest"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Container Name (optional)</Label>
              <Input
                value={config.name}
                onChange={(e) => setConfig((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="my-container"
              />
            </div>

            <div>
              <Label className="mb-3 block">Popular Images</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {popularImages.map((img) => (
                  <Card
                    key={img.name}
                    className={`cursor-pointer transition-colors hover:border-primary/50 ${
                      config.image === img.name ? "border-primary bg-primary/5" : ""
                    }`}
                    onClick={() => setConfig((prev) => ({ ...prev, image: img.name, tag: img.tag }))}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-blue-500" />
                        <div>
                          <p className="font-medium text-sm">{img.name}</p>
                          <p className="text-xs text-muted-foreground">{img.desc}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Port Mappings */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">Configure Port Mappings</h3>
              <p className="text-sm text-muted-foreground">
                Map container ports to host ports to expose services.
              </p>
            </div>

            <div className="space-y-3">
              {config.ports.map((port) => (
                <div key={port.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                  <div className="flex-1 grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">Host Port</Label>
                      <Input
                        value={port.hostPort}
                        onChange={(e) => updatePort(port.id, "hostPort", e.target.value)}
                        placeholder="8080"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Container Port</Label>
                      <Input
                        value={port.containerPort}
                        onChange={(e) => updatePort(port.id, "containerPort", e.target.value)}
                        placeholder="80"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Protocol</Label>
                      <Select
                        value={port.protocol}
                        onValueChange={(v) => updatePort(port.id, "protocol", v)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="tcp">TCP</SelectItem>
                          <SelectItem value="udp">UDP</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-500"
                    onClick={() => removePort(port.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              <Button variant="outline" onClick={addPort} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add Port Mapping
              </Button>
            </div>

            {config.ports.length === 0 && (
              <div className="flex items-center gap-2 p-4 rounded-lg bg-muted/50">
                <Info className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  No ports configured. The container will not be accessible from outside.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Volume Mounts */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">Mount Volumes</h3>
              <p className="text-sm text-muted-foreground">
                Mount host directories or named volumes into the container.
              </p>
            </div>

            <div className="space-y-3">
              {config.volumes.map((volume) => (
                <div key={volume.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                  <div className="flex-1 grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">Host Path / Volume</Label>
                      <Input
                        value={volume.hostPath}
                        onChange={(e) => updateVolume(volume.id, "hostPath", e.target.value)}
                        placeholder="/host/path or volume-name"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Container Path</Label>
                      <Input
                        value={volume.containerPath}
                        onChange={(e) => updateVolume(volume.id, "containerPath", e.target.value)}
                        placeholder="/container/path"
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={volume.readOnly}
                          onCheckedChange={(v) => updateVolume(volume.id, "readOnly", v)}
                        />
                        <Label className="text-xs">Read-only</Label>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-500"
                    onClick={() => removeVolume(volume.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              <Button variant="outline" onClick={addVolume} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add Volume Mount
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Environment Variables */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">Environment Variables</h3>
              <p className="text-sm text-muted-foreground">
                Set environment variables for the container.
              </p>
            </div>

            <div className="space-y-3">
              {config.envVars.map((env) => (
                <div key={env.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                  <div className="flex-1 grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Variable Name</Label>
                      <Input
                        value={env.key}
                        onChange={(e) => updateEnvVar(env.id, "key", e.target.value)}
                        placeholder="DATABASE_URL"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Value</Label>
                      <Input
                        value={env.value}
                        onChange={(e) => updateEnvVar(env.id, "value", e.target.value)}
                        placeholder="postgres://..."
                      />
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-500"
                    onClick={() => removeEnvVar(env.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              <Button variant="outline" onClick={addEnvVar} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add Environment Variable
              </Button>
            </div>
          </div>
        )}

        {/* Step 5: Advanced Options */}
        {currentStep === 5 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">Advanced Options</h3>
              <p className="text-sm text-muted-foreground">
                Configure advanced container settings.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Network</Label>
                <Select
                  value={config.network}
                  onValueChange={(v) => setConfig((prev) => ({ ...prev, network: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bridge">bridge</SelectItem>
                    <SelectItem value="host">host</SelectItem>
                    <SelectItem value="none">none</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Restart Policy</Label>
                <Select
                  value={config.restartPolicy}
                  onValueChange={(v: ContainerConfig["restartPolicy"]) =>
                    setConfig((prev) => ({ ...prev, restartPolicy: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">No</SelectItem>
                    <SelectItem value="always">Always</SelectItem>
                    <SelectItem value="on-failure">On Failure</SelectItem>
                    <SelectItem value="unless-stopped">Unless Stopped</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Working Directory</Label>
                <Input
                  value={config.workdir}
                  onChange={(e) => setConfig((prev) => ({ ...prev, workdir: e.target.value }))}
                  placeholder="/app"
                />
              </div>

              <div className="space-y-2">
                <Label>User</Label>
                <Input
                  value={config.user}
                  onChange={(e) => setConfig((prev) => ({ ...prev, user: e.target.value }))}
                  placeholder="1000:1000"
                />
              </div>

              <div className="space-y-2">
                <Label>CPU Limit</Label>
                <Input
                  value={config.cpuLimit}
                  onChange={(e) => setConfig((prev) => ({ ...prev, cpuLimit: e.target.value }))}
                  placeholder="1.5"
                />
              </div>

              <div className="space-y-2">
                <Label>Memory Limit</Label>
                <Input
                  value={config.memoryLimit}
                  onChange={(e) => setConfig((prev) => ({ ...prev, memoryLimit: e.target.value }))}
                  placeholder="512m"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Command</Label>
              <Input
                value={config.command}
                onChange={(e) => setConfig((prev) => ({ ...prev, command: e.target.value }))}
                placeholder="Override default command..."
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Privileged Mode</Label>
                  <p className="text-xs text-muted-foreground">
                    Give extended privileges to the container
                  </p>
                </div>
                <Switch
                  checked={config.privileged}
                  onCheckedChange={(v) => setConfig((prev) => ({ ...prev, privileged: v }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto Remove</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically remove container when it exits
                  </p>
                </div>
                <Switch
                  checked={config.autoRemove}
                  onCheckedChange={(v) => setConfig((prev) => ({ ...prev, autoRemove: v }))}
                />
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
                Review your container configuration before creating.
              </p>
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Container Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Image:</span>
                    <span className="ml-2 font-medium">{config.image}:{config.tag}</span>
                  </div>
                  {config.name && (
                    <div>
                      <span className="text-muted-foreground">Name:</span>
                      <span className="ml-2 font-medium">{config.name}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Network:</span>
                    <span className="ml-2">{config.network}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Restart:</span>
                    <span className="ml-2">{config.restartPolicy}</span>
                  </div>
                </div>

                {config.ports.length > 0 && (
                  <div>
                    <span className="text-sm text-muted-foreground">Ports:</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {config.ports.map((p) => (
                        <Badge key={p.id} variant="outline">
                          {p.hostPort}:{p.containerPort}/{p.protocol}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {config.volumes.length > 0 && (
                  <div>
                    <span className="text-sm text-muted-foreground">Volumes:</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {config.volumes.map((v) => (
                        <Badge key={v.id} variant="outline">
                          {v.hostPath}:{v.containerPath}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {config.envVars.length > 0 && (
                  <div>
                    <span className="text-sm text-muted-foreground">Environment:</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {config.envVars.map((e) => (
                        <Badge key={e.id} variant="outline">
                          {e.key}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Docker Command</CardTitle>
                  <Button variant="ghost" size="sm" onClick={copyCommand}>
                    <Copy className="h-4 w-4 mr-1" />
                    Copy
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <pre className="p-4 rounded-lg bg-black/90 text-green-400 text-xs font-mono overflow-x-auto">
                  {generateCommand()}
                </pre>
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
              Create Container
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ContainerWizard;
