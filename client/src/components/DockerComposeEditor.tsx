import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Plus,
  Trash2,
  Copy,
  Download,
  Box,
  Network,
  HardDrive,
  Settings,
  Link,
  ChevronDown,
  ChevronUp,
  Play,
  FileCode,
} from "lucide-react";
import { toast } from "sonner";
import YAML from "yaml";

// Types
interface PortMapping {
  host: string;
  container: string;
  protocol: "tcp" | "udp";
}

interface VolumeMount {
  source: string;
  target: string;
  type: "bind" | "volume";
  readOnly: boolean;
}

interface EnvVar {
  key: string;
  value: string;
}

interface HealthCheck {
  test: string;
  interval: string;
  timeout: string;
  retries: number;
  startPeriod: string;
}

interface Service {
  id: string;
  name: string;
  image: string;
  build?: {
    context: string;
    dockerfile: string;
  };
  ports: PortMapping[];
  volumes: VolumeMount[];
  environment: EnvVar[];
  dependsOn: string[];
  networks: string[];
  restart: "no" | "always" | "on-failure" | "unless-stopped";
  command?: string;
  healthCheck?: HealthCheck;
  replicas: number;
  expanded: boolean;
}

interface NetworkConfig {
  name: string;
  driver: "bridge" | "host" | "overlay" | "none";
  external: boolean;
}

interface VolumeConfig {
  name: string;
  driver: "local" | "nfs";
  external: boolean;
}

interface DockerComposeEditorProps {
  onComplete?: (yaml: string) => void;
  onCancel?: () => void;
  initialYaml?: string;
}

const defaultService: Omit<Service, "id" | "name"> = {
  image: "",
  ports: [],
  volumes: [],
  environment: [],
  dependsOn: [],
  networks: ["default"],
  restart: "unless-stopped",
  replicas: 1,
  expanded: true,
};

export function DockerComposeEditor({
  onComplete,
  onCancel,
  initialYaml,
}: DockerComposeEditorProps) {
  const [projectName, setProjectName] = useState("my-app");
  const [services, setServices] = useState<Service[]>([
    {
      ...defaultService,
      id: "1",
      name: "web",
      image: "nginx:latest",
      ports: [{ host: "80", container: "80", protocol: "tcp" }],
    },
  ]);
  const [networks, setNetworks] = useState<NetworkConfig[]>([
    { name: "default", driver: "bridge", external: false },
  ]);
  const [volumes, setVolumes] = useState<VolumeConfig[]>([]);
  const [activeTab, setActiveTab] = useState("services");
  const [showYaml, setShowYaml] = useState(false);

  // Service management
  const addService = () => {
    const newService: Service = {
      ...defaultService,
      id: Date.now().toString(),
      name: `service-${services.length + 1}`,
    };
    setServices([...services, newService]);
  };

  const removeService = (id: string) => {
    setServices(services.filter((s) => s.id !== id));
  };

  const updateService = (id: string, updates: Partial<Service>) => {
    setServices(
      services.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
  };

  const toggleServiceExpanded = (id: string) => {
    setServices(
      services.map((s) =>
        s.id === id ? { ...s, expanded: !s.expanded } : s
      )
    );
  };

  // Port management
  const addPort = (serviceId: string) => {
    const service = services.find((s) => s.id === serviceId);
    if (service) {
      updateService(serviceId, {
        ports: [...service.ports, { host: "", container: "", protocol: "tcp" }],
      });
    }
  };

  const removePort = (serviceId: string, index: number) => {
    const service = services.find((s) => s.id === serviceId);
    if (service) {
      updateService(serviceId, {
        ports: service.ports.filter((_, i) => i !== index),
      });
    }
  };

  const updatePort = (
    serviceId: string,
    index: number,
    updates: Partial<PortMapping>
  ) => {
    const service = services.find((s) => s.id === serviceId);
    if (service) {
      const newPorts = [...service.ports];
      newPorts[index] = { ...newPorts[index], ...updates };
      updateService(serviceId, { ports: newPorts });
    }
  };

  // Volume management for service
  const addVolumeMount = (serviceId: string) => {
    const service = services.find((s) => s.id === serviceId);
    if (service) {
      updateService(serviceId, {
        volumes: [
          ...service.volumes,
          { source: "", target: "", type: "bind", readOnly: false },
        ],
      });
    }
  };

  const removeVolumeMount = (serviceId: string, index: number) => {
    const service = services.find((s) => s.id === serviceId);
    if (service) {
      updateService(serviceId, {
        volumes: service.volumes.filter((_, i) => i !== index),
      });
    }
  };

  const updateVolumeMount = (
    serviceId: string,
    index: number,
    updates: Partial<VolumeMount>
  ) => {
    const service = services.find((s) => s.id === serviceId);
    if (service) {
      const newVolumes = [...service.volumes];
      newVolumes[index] = { ...newVolumes[index], ...updates };
      updateService(serviceId, { volumes: newVolumes });
    }
  };

  // Environment variable management
  const addEnvVar = (serviceId: string) => {
    const service = services.find((s) => s.id === serviceId);
    if (service) {
      updateService(serviceId, {
        environment: [...service.environment, { key: "", value: "" }],
      });
    }
  };

  const removeEnvVar = (serviceId: string, index: number) => {
    const service = services.find((s) => s.id === serviceId);
    if (service) {
      updateService(serviceId, {
        environment: service.environment.filter((_, i) => i !== index),
      });
    }
  };

  const updateEnvVar = (
    serviceId: string,
    index: number,
    updates: Partial<EnvVar>
  ) => {
    const service = services.find((s) => s.id === serviceId);
    if (service) {
      const newEnv = [...service.environment];
      newEnv[index] = { ...newEnv[index], ...updates };
      updateService(serviceId, { environment: newEnv });
    }
  };

  // Network management
  const addNetwork = () => {
    setNetworks([
      ...networks,
      { name: `network-${networks.length + 1}`, driver: "bridge", external: false },
    ]);
  };

  const removeNetwork = (index: number) => {
    setNetworks(networks.filter((_, i) => i !== index));
  };

  // Volume management
  const addVolume = () => {
    setVolumes([
      ...volumes,
      { name: `volume-${volumes.length + 1}`, driver: "local", external: false },
    ]);
  };

  const removeVolume = (index: number) => {
    setVolumes(volumes.filter((_, i) => i !== index));
  };

  // Generate YAML
  const generateYaml = useCallback(() => {
    const compose: Record<string, unknown> = {
      version: "3.8",
      name: projectName,
      services: {},
      networks: {},
      volumes: {},
    };

    // Add services
    services.forEach((service) => {
      const svc: Record<string, unknown> = {
        image: service.image,
        restart: service.restart,
      };

      if (service.build?.context) {
        svc.build = service.build;
      }

      if (service.ports.length > 0) {
        svc.ports = service.ports
          .filter((p) => p.host && p.container)
          .map((p) => `${p.host}:${p.container}/${p.protocol}`);
      }

      if (service.volumes.length > 0) {
        svc.volumes = service.volumes
          .filter((v) => v.source && v.target)
          .map((v) => {
            const suffix = v.readOnly ? ":ro" : "";
            return `${v.source}:${v.target}${suffix}`;
          });
      }

      if (service.environment.length > 0) {
        svc.environment = service.environment
          .filter((e) => e.key)
          .reduce((acc, e) => {
            acc[e.key] = e.value;
            return acc;
          }, {} as Record<string, string>);
      }

      if (service.dependsOn.length > 0) {
        svc.depends_on = service.dependsOn;
      }

      if (service.networks.length > 0 && service.networks[0] !== "default") {
        svc.networks = service.networks;
      }

      if (service.command) {
        svc.command = service.command;
      }

      if (service.replicas > 1) {
        svc.deploy = {
          replicas: service.replicas,
        };
      }

      (compose.services as Record<string, unknown>)[service.name] = svc;
    });

    // Add networks
    networks.forEach((network) => {
      if (network.name !== "default") {
        (compose.networks as Record<string, unknown>)[network.name] = {
          driver: network.driver,
          external: network.external,
        };
      }
    });

    // Add volumes
    volumes.forEach((volume) => {
      (compose.volumes as Record<string, unknown>)[volume.name] = {
        driver: volume.driver,
        external: volume.external,
      };
    });

    // Clean up empty sections
    if (Object.keys(compose.networks as object).length === 0) {
      delete compose.networks;
    }
    if (Object.keys(compose.volumes as object).length === 0) {
      delete compose.volumes;
    }

    return YAML.stringify(compose, { indent: 2 });
  }, [projectName, services, networks, volumes]);

  const handleCopyYaml = () => {
    navigator.clipboard.writeText(generateYaml());
    toast.success("YAML copied to clipboard!");
  };

  const handleDownloadYaml = () => {
    const blob = new Blob([generateYaml()], { type: "text/yaml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "docker-compose.yml";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("docker-compose.yml downloaded!");
  };

  const handleComplete = () => {
    onComplete?.(generateYaml());
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <FileCode className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Docker Compose Editor</h2>
            <p className="text-sm text-muted-foreground">
              Build multi-container applications visually
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowYaml(!showYaml)}>
            <FileCode className="h-4 w-4 mr-2" />
            {showYaml ? "Hide YAML" : "Show YAML"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopyYaml}>
            <Copy className="h-4 w-4 mr-2" />
            Copy
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadYaml}>
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor Panel */}
        <div className={`flex-1 flex flex-col ${showYaml ? "w-1/2" : "w-full"}`}>
          {/* Project Name */}
          <div className="p-4 border-b">
            <Label htmlFor="projectName">Project Name</Label>
            <Input
              id="projectName"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="my-app"
              className="mt-1"
            />
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <TabsList className="mx-4 mt-4">
              <TabsTrigger value="services" className="flex items-center gap-2">
                <Box className="h-4 w-4" />
                Services ({services.length})
              </TabsTrigger>
              <TabsTrigger value="networks" className="flex items-center gap-2">
                <Network className="h-4 w-4" />
                Networks ({networks.length})
              </TabsTrigger>
              <TabsTrigger value="volumes" className="flex items-center gap-2">
                <HardDrive className="h-4 w-4" />
                Volumes ({volumes.length})
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 p-4">
              {/* Services Tab */}
              <TabsContent value="services" className="mt-0 space-y-4">
                {services.map((service) => (
                  <Card key={service.id} className="overflow-hidden">
                    <CardHeader
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => toggleServiceExpanded(service.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Box className="h-5 w-5 text-blue-500" />
                          <div>
                            <CardTitle className="text-base">{service.name}</CardTitle>
                            <CardDescription>{service.image || "No image set"}</CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {service.dependsOn.length > 0 && (
                            <Badge variant="outline">
                              <Link className="h-3 w-3 mr-1" />
                              {service.dependsOn.length} deps
                            </Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeService(service.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                          {service.expanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </div>
                      </div>
                    </CardHeader>

                    {service.expanded && (
                      <CardContent className="space-y-4">
                        {/* Basic Info */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Service Name</Label>
                            <Input
                              value={service.name}
                              onChange={(e) =>
                                updateService(service.id, { name: e.target.value })
                              }
                              placeholder="web"
                            />
                          </div>
                          <div>
                            <Label>Image</Label>
                            <Input
                              value={service.image}
                              onChange={(e) =>
                                updateService(service.id, { image: e.target.value })
                              }
                              placeholder="nginx:latest"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Restart Policy</Label>
                            <Select
                              value={service.restart}
                              onValueChange={(value: Service["restart"]) =>
                                updateService(service.id, { restart: value })
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
                          <div>
                            <Label>Replicas</Label>
                            <Input
                              type="number"
                              min={1}
                              value={service.replicas}
                              onChange={(e) =>
                                updateService(service.id, {
                                  replicas: parseInt(e.target.value) || 1,
                                })
                              }
                            />
                          </div>
                        </div>

                        <div>
                          <Label>Command (optional)</Label>
                          <Input
                            value={service.command || ""}
                            onChange={(e) =>
                              updateService(service.id, { command: e.target.value })
                            }
                            placeholder="npm start"
                          />
                        </div>

                        <Separator />

                        {/* Ports */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <Label>Port Mappings</Label>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => addPort(service.id)}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Add Port
                            </Button>
                          </div>
                          {service.ports.map((port, index) => (
                            <div key={index} className="flex items-center gap-2 mb-2">
                              <Input
                                value={port.host}
                                onChange={(e) =>
                                  updatePort(service.id, index, { host: e.target.value })
                                }
                                placeholder="Host"
                                className="w-24"
                              />
                              <span>:</span>
                              <Input
                                value={port.container}
                                onChange={(e) =>
                                  updatePort(service.id, index, {
                                    container: e.target.value,
                                  })
                                }
                                placeholder="Container"
                                className="w-24"
                              />
                              <Select
                                value={port.protocol}
                                onValueChange={(value: "tcp" | "udp") =>
                                  updatePort(service.id, index, { protocol: value })
                                }
                              >
                                <SelectTrigger className="w-20">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="tcp">TCP</SelectItem>
                                  <SelectItem value="udp">UDP</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removePort(service.id, index)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          ))}
                        </div>

                        <Separator />

                        {/* Volumes */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <Label>Volume Mounts</Label>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => addVolumeMount(service.id)}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Add Volume
                            </Button>
                          </div>
                          {service.volumes.map((volume, index) => (
                            <div key={index} className="flex items-center gap-2 mb-2">
                              <Input
                                value={volume.source}
                                onChange={(e) =>
                                  updateVolumeMount(service.id, index, {
                                    source: e.target.value,
                                  })
                                }
                                placeholder="Source"
                                className="flex-1"
                              />
                              <span>:</span>
                              <Input
                                value={volume.target}
                                onChange={(e) =>
                                  updateVolumeMount(service.id, index, {
                                    target: e.target.value,
                                  })
                                }
                                placeholder="Target"
                                className="flex-1"
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeVolumeMount(service.id, index)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          ))}
                        </div>

                        <Separator />

                        {/* Environment Variables */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <Label>Environment Variables</Label>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => addEnvVar(service.id)}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Add Variable
                            </Button>
                          </div>
                          {service.environment.map((env, index) => (
                            <div key={index} className="flex items-center gap-2 mb-2">
                              <Input
                                value={env.key}
                                onChange={(e) =>
                                  updateEnvVar(service.id, index, { key: e.target.value })
                                }
                                placeholder="KEY"
                                className="w-40"
                              />
                              <span>=</span>
                              <Input
                                value={env.value}
                                onChange={(e) =>
                                  updateEnvVar(service.id, index, { value: e.target.value })
                                }
                                placeholder="value"
                                className="flex-1"
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeEnvVar(service.id, index)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          ))}
                        </div>

                        <Separator />

                        {/* Dependencies */}
                        <div>
                          <Label>Depends On</Label>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {services
                              .filter((s) => s.id !== service.id)
                              .map((s) => (
                                <Badge
                                  key={s.id}
                                  variant={
                                    service.dependsOn.includes(s.name)
                                      ? "default"
                                      : "outline"
                                  }
                                  className="cursor-pointer"
                                  onClick={() => {
                                    const deps = service.dependsOn.includes(s.name)
                                      ? service.dependsOn.filter((d) => d !== s.name)
                                      : [...service.dependsOn, s.name];
                                    updateService(service.id, { dependsOn: deps });
                                  }}
                                >
                                  {s.name}
                                </Badge>
                              ))}
                          </div>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                ))}

                <Button variant="outline" className="w-full" onClick={addService}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Service
                </Button>
              </TabsContent>

              {/* Networks Tab */}
              <TabsContent value="networks" className="mt-0 space-y-4">
                {networks.map((network, index) => (
                  <Card key={index}>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <Label>Network Name</Label>
                          <Input
                            value={network.name}
                            onChange={(e) => {
                              const newNetworks = [...networks];
                              newNetworks[index].name = e.target.value;
                              setNetworks(newNetworks);
                            }}
                            placeholder="my-network"
                          />
                        </div>
                        <div className="w-32">
                          <Label>Driver</Label>
                          <Select
                            value={network.driver}
                            onValueChange={(value: NetworkConfig["driver"]) => {
                              const newNetworks = [...networks];
                              newNetworks[index].driver = value;
                              setNetworks(newNetworks);
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="bridge">Bridge</SelectItem>
                              <SelectItem value="host">Host</SelectItem>
                              <SelectItem value="overlay">Overlay</SelectItem>
                              <SelectItem value="none">None</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeNetwork(index)}
                          disabled={network.name === "default"}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                <Button variant="outline" className="w-full" onClick={addNetwork}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Network
                </Button>
              </TabsContent>

              {/* Volumes Tab */}
              <TabsContent value="volumes" className="mt-0 space-y-4">
                {volumes.map((volume, index) => (
                  <Card key={index}>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <Label>Volume Name</Label>
                          <Input
                            value={volume.name}
                            onChange={(e) => {
                              const newVolumes = [...volumes];
                              newVolumes[index].name = e.target.value;
                              setVolumes(newVolumes);
                            }}
                            placeholder="my-volume"
                          />
                        </div>
                        <div className="w-32">
                          <Label>Driver</Label>
                          <Select
                            value={volume.driver}
                            onValueChange={(value: VolumeConfig["driver"]) => {
                              const newVolumes = [...volumes];
                              newVolumes[index].driver = value;
                              setVolumes(newVolumes);
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="local">Local</SelectItem>
                              <SelectItem value="nfs">NFS</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeVolume(index)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                <Button variant="outline" className="w-full" onClick={addVolume}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Volume
                </Button>
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </div>

        {/* YAML Preview Panel */}
        {showYaml && (
          <div className="w-1/2 border-l flex flex-col">
            <div className="p-3 border-b bg-muted/50">
              <h3 className="font-medium">docker-compose.yml</h3>
            </div>
            <ScrollArea className="flex-1">
              <pre className="p-4 text-sm font-mono whitespace-pre-wrap">
                {generateYaml()}
              </pre>
            </ScrollArea>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between p-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleDownloadYaml}>
            <Download className="h-4 w-4 mr-2" />
            Download YAML
          </Button>
          <Button onClick={handleComplete}>
            <Play className="h-4 w-4 mr-2" />
            Create Stack
          </Button>
        </div>
      </div>
    </div>
  );
}

export default DockerComposeEditor;
