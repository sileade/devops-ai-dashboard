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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Trash2,
  Copy,
  Cloud,
  Server,
  Database,
  Network,
  Shield,
  HardDrive,
  Globe,
  Key,
  Settings,
  Package,
} from "lucide-react";
import { toast } from "sonner";

interface TerraformResource {
  id: string;
  type: string;
  name: string;
  provider: string;
  config: Record<string, string>;
}

interface TerraformVariable {
  name: string;
  type: string;
  default: string;
  description: string;
}

interface TerraformOutput {
  name: string;
  value: string;
  description: string;
}

interface TerraformBuilderProps {
  onComplete?: (hcl: string) => void;
  onCancel?: () => void;
}

const providers = [
  { id: "aws", name: "AWS", icon: Cloud, color: "text-orange-500" },
  { id: "gcp", name: "Google Cloud", icon: Cloud, color: "text-blue-500" },
  { id: "azure", name: "Azure", icon: Cloud, color: "text-cyan-500" },
  { id: "kubernetes", name: "Kubernetes", icon: Package, color: "text-purple-500" },
  { id: "docker", name: "Docker", icon: Package, color: "text-blue-400" },
];

const resourceTemplates: Record<string, { type: string; name: string; icon: React.ElementType; fields: { key: string; label: string; placeholder: string }[] }[]> = {
  aws: [
    {
      type: "aws_instance",
      name: "EC2 Instance",
      icon: Server,
      fields: [
        { key: "ami", label: "AMI ID", placeholder: "ami-0c55b159cbfafe1f0" },
        { key: "instance_type", label: "Instance Type", placeholder: "t2.micro" },
        { key: "tags.Name", label: "Name Tag", placeholder: "my-instance" },
      ],
    },
    {
      type: "aws_s3_bucket",
      name: "S3 Bucket",
      icon: HardDrive,
      fields: [
        { key: "bucket", label: "Bucket Name", placeholder: "my-bucket" },
        { key: "acl", label: "ACL", placeholder: "private" },
      ],
    },
    {
      type: "aws_vpc",
      name: "VPC",
      icon: Network,
      fields: [
        { key: "cidr_block", label: "CIDR Block", placeholder: "10.0.0.0/16" },
        { key: "tags.Name", label: "Name Tag", placeholder: "my-vpc" },
      ],
    },
    {
      type: "aws_security_group",
      name: "Security Group",
      icon: Shield,
      fields: [
        { key: "name", label: "Name", placeholder: "my-sg" },
        { key: "description", label: "Description", placeholder: "Security group for..." },
        { key: "vpc_id", label: "VPC ID", placeholder: "vpc-xxx" },
      ],
    },
    {
      type: "aws_db_instance",
      name: "RDS Database",
      icon: Database,
      fields: [
        { key: "identifier", label: "Identifier", placeholder: "my-db" },
        { key: "engine", label: "Engine", placeholder: "mysql" },
        { key: "instance_class", label: "Instance Class", placeholder: "db.t2.micro" },
        { key: "allocated_storage", label: "Storage (GB)", placeholder: "20" },
      ],
    },
  ],
  gcp: [
    {
      type: "google_compute_instance",
      name: "Compute Instance",
      icon: Server,
      fields: [
        { key: "name", label: "Name", placeholder: "my-instance" },
        { key: "machine_type", label: "Machine Type", placeholder: "e2-micro" },
        { key: "zone", label: "Zone", placeholder: "us-central1-a" },
      ],
    },
    {
      type: "google_storage_bucket",
      name: "Cloud Storage",
      icon: HardDrive,
      fields: [
        { key: "name", label: "Bucket Name", placeholder: "my-bucket" },
        { key: "location", label: "Location", placeholder: "US" },
      ],
    },
    {
      type: "google_sql_database_instance",
      name: "Cloud SQL",
      icon: Database,
      fields: [
        { key: "name", label: "Name", placeholder: "my-db" },
        { key: "database_version", label: "Version", placeholder: "MYSQL_8_0" },
        { key: "region", label: "Region", placeholder: "us-central1" },
      ],
    },
  ],
  azure: [
    {
      type: "azurerm_virtual_machine",
      name: "Virtual Machine",
      icon: Server,
      fields: [
        { key: "name", label: "Name", placeholder: "my-vm" },
        { key: "location", label: "Location", placeholder: "East US" },
        { key: "vm_size", label: "VM Size", placeholder: "Standard_DS1_v2" },
      ],
    },
    {
      type: "azurerm_storage_account",
      name: "Storage Account",
      icon: HardDrive,
      fields: [
        { key: "name", label: "Name", placeholder: "mystorageaccount" },
        { key: "account_tier", label: "Tier", placeholder: "Standard" },
        { key: "account_replication_type", label: "Replication", placeholder: "LRS" },
      ],
    },
  ],
  kubernetes: [
    {
      type: "kubernetes_deployment",
      name: "Deployment",
      icon: Package,
      fields: [
        { key: "metadata.name", label: "Name", placeholder: "my-deployment" },
        { key: "spec.replicas", label: "Replicas", placeholder: "3" },
        { key: "spec.template.spec.containers.0.image", label: "Image", placeholder: "nginx:latest" },
      ],
    },
    {
      type: "kubernetes_service",
      name: "Service",
      icon: Network,
      fields: [
        { key: "metadata.name", label: "Name", placeholder: "my-service" },
        { key: "spec.type", label: "Type", placeholder: "ClusterIP" },
        { key: "spec.ports.0.port", label: "Port", placeholder: "80" },
      ],
    },
  ],
  docker: [
    {
      type: "docker_container",
      name: "Container",
      icon: Package,
      fields: [
        { key: "name", label: "Name", placeholder: "my-container" },
        { key: "image", label: "Image", placeholder: "nginx:latest" },
        { key: "ports.0.internal", label: "Internal Port", placeholder: "80" },
        { key: "ports.0.external", label: "External Port", placeholder: "8080" },
      ],
    },
    {
      type: "docker_image",
      name: "Image",
      icon: HardDrive,
      fields: [
        { key: "name", label: "Image Name", placeholder: "nginx:latest" },
      ],
    },
  ],
};

export function TerraformBuilder({ onComplete, onCancel }: TerraformBuilderProps) {
  const [selectedProvider, setSelectedProvider] = useState("aws");
  const [resources, setResources] = useState<TerraformResource[]>([]);
  const [variables, setVariables] = useState<TerraformVariable[]>([]);
  const [outputs, setOutputs] = useState<TerraformOutput[]>([]);

  const generateId = () => Math.random().toString(36).substring(2, 9);

  // Add resource
  const addResource = (template: typeof resourceTemplates.aws[0]) => {
    const newResource: TerraformResource = {
      id: generateId(),
      type: template.type,
      name: template.type.split("_").slice(1).join("_"),
      provider: selectedProvider,
      config: template.fields.reduce((acc, field) => ({ ...acc, [field.key]: "" }), {}),
    };
    setResources([...resources, newResource]);
    toast.success(`Added ${template.name}`);
  };

  // Update resource
  const updateResource = (id: string, updates: Partial<TerraformResource>) => {
    setResources(resources.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  };

  // Update resource config
  const updateResourceConfig = (id: string, key: string, value: string) => {
    setResources(
      resources.map((r) =>
        r.id === id ? { ...r, config: { ...r.config, [key]: value } } : r
      )
    );
  };

  // Remove resource
  const removeResource = (id: string) => {
    setResources(resources.filter((r) => r.id !== id));
    toast.success("Resource removed");
  };

  // Add variable
  const addVariable = () => {
    setVariables([
      ...variables,
      { name: "", type: "string", default: "", description: "" },
    ]);
  };

  // Update variable
  const updateVariable = (index: number, updates: Partial<TerraformVariable>) => {
    setVariables(variables.map((v, i) => (i === index ? { ...v, ...updates } : v)));
  };

  // Remove variable
  const removeVariable = (index: number) => {
    setVariables(variables.filter((_, i) => i !== index));
  };

  // Add output
  const addOutput = () => {
    setOutputs([...outputs, { name: "", value: "", description: "" }]);
  };

  // Update output
  const updateOutput = (index: number, updates: Partial<TerraformOutput>) => {
    setOutputs(outputs.map((o, i) => (i === index ? { ...o, ...updates } : o)));
  };

  // Remove output
  const removeOutput = (index: number) => {
    setOutputs(outputs.filter((_, i) => i !== index));
  };

  // Generate HCL
  const generateHCL = (): string => {
    let hcl = `# Generated by DevOps AI Dashboard
# Terraform Configuration

terraform {
  required_providers {
`;

    // Add providers
    const usedProviders = Array.from(new Set(resources.map((r) => r.provider)));
    usedProviders.forEach((p) => {
      const providerConfig: Record<string, { source: string; version: string }> = {
        aws: { source: "hashicorp/aws", version: "~> 5.0" },
        gcp: { source: "hashicorp/google", version: "~> 5.0" },
        azure: { source: "hashicorp/azurerm", version: "~> 3.0" },
        kubernetes: { source: "hashicorp/kubernetes", version: "~> 2.0" },
        docker: { source: "kreuzwerker/docker", version: "~> 3.0" },
      };
      const config = providerConfig[p];
      if (config) {
        hcl += `    ${p} = {
      source  = "${config.source}"
      version = "${config.version}"
    }
`;
      }
    });

    hcl += `  }
}

`;

    // Add provider configurations
    usedProviders.forEach((p) => {
      if (p === "aws") {
        hcl += `provider "aws" {
  region = var.aws_region
}

`;
      } else if (p === "gcp") {
        hcl += `provider "google" {
  project = var.gcp_project
  region  = var.gcp_region
}

`;
      } else if (p === "azure") {
        hcl += `provider "azurerm" {
  features {}
}

`;
      } else if (p === "kubernetes") {
        hcl += `provider "kubernetes" {
  config_path = "~/.kube/config"
}

`;
      } else if (p === "docker") {
        hcl += `provider "docker" {}

`;
      }
    });

    // Add variables
    variables.forEach((v) => {
      if (v.name) {
        hcl += `variable "${v.name}" {
  type        = ${v.type}
  default     = ${v.type === "string" ? `"${v.default}"` : v.default || '""'}
  description = "${v.description}"
}

`;
      }
    });

    // Add default region variables if AWS is used
    if (usedProviders.includes("aws")) {
      hcl += `variable "aws_region" {
  type        = string
  default     = "us-east-1"
  description = "AWS region"
}

`;
    }

    if (usedProviders.includes("gcp")) {
      hcl += `variable "gcp_project" {
  type        = string
  description = "GCP project ID"
}

variable "gcp_region" {
  type        = string
  default     = "us-central1"
  description = "GCP region"
}

`;
    }

    // Add resources
    resources.forEach((r) => {
      hcl += `resource "${r.type}" "${r.name}" {
`;
      Object.entries(r.config).forEach(([key, value]) => {
        if (value) {
          if (key.includes(".")) {
            // Handle nested keys
            const parts = key.split(".");
            if (parts[0] === "tags") {
              hcl += `  tags = {
    ${parts[1]} = "${value}"
  }
`;
            } else {
              hcl += `  ${key.replace(/\./g, "_")} = "${value}"
`;
            }
          } else {
            // Check if value is a number
            const isNumber = !isNaN(Number(value)) && value !== "";
            hcl += `  ${key} = ${isNumber ? value : `"${value}"`}
`;
          }
        }
      });
      hcl += `}

`;
    });

    // Add outputs
    outputs.forEach((o) => {
      if (o.name && o.value) {
        hcl += `output "${o.name}" {
  value       = ${o.value}
  description = "${o.description}"
}

`;
      }
    });

    return hcl;
  };

  const copyHCL = () => {
    navigator.clipboard.writeText(generateHCL());
    toast.success("HCL copied to clipboard");
  };

  const handleComplete = () => {
    onComplete?.(generateHCL());
    toast.success("Terraform configuration created");
  };

  const templates = resourceTemplates[selectedProvider] || [];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border">
        <h2 className="text-xl font-semibold">Terraform Configuration Builder</h2>
        <p className="text-sm text-muted-foreground">
          Visually build your infrastructure as code
        </p>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Resource Templates */}
        <div className="w-72 border-r border-border p-4 overflow-y-auto">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">
            Provider
          </Label>
          <div className="grid grid-cols-2 gap-2 mt-2 mb-4">
            {providers.map((provider) => {
              const Icon = provider.icon;
              return (
                <Button
                  key={provider.id}
                  variant={selectedProvider === provider.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedProvider(provider.id)}
                  className="justify-start"
                >
                  <Icon className={`h-4 w-4 mr-1 ${provider.color}`} />
                  {provider.name}
                </Button>
              );
            })}
          </div>

          <Label className="text-xs text-muted-foreground uppercase tracking-wider">
            Resources
          </Label>
          <div className="space-y-2 mt-2">
            {templates.map((template) => {
              const Icon = template.icon;
              return (
                <Button
                  key={template.type}
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => addResource(template)}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {template.name}
                  <Plus className="h-3 w-3 ml-auto" />
                </Button>
              );
            })}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <Tabs defaultValue="resources" className="flex-1 flex flex-col">
            <div className="px-4 border-b border-border">
              <TabsList>
                <TabsTrigger value="resources">
                  Resources ({resources.length})
                </TabsTrigger>
                <TabsTrigger value="variables">
                  Variables ({variables.length})
                </TabsTrigger>
                <TabsTrigger value="outputs">
                  Outputs ({outputs.length})
                </TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="flex-1">
              <TabsContent value="resources" className="p-4 space-y-4 m-0">
                {resources.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No resources added yet</p>
                    <p className="text-sm">Select a resource type from the left panel</p>
                  </div>
                ) : (
                  resources.map((resource) => {
                    const template = templates.find((t) => t.type === resource.type);
                    const Icon = template?.icon || Package;
                    return (
                      <Card key={resource.id}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Icon className="h-5 w-5" />
                              <div>
                                <CardTitle className="text-base">{resource.type}</CardTitle>
                                <CardDescription>{template?.name}</CardDescription>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-red-500"
                              onClick={() => removeResource(resource.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="space-y-2">
                            <Label>Resource Name</Label>
                            <Input
                              value={resource.name}
                              onChange={(e) =>
                                updateResource(resource.id, { name: e.target.value })
                              }
                              placeholder="resource_name"
                            />
                          </div>
                          {template?.fields.map((field) => (
                            <div key={field.key} className="space-y-2">
                              <Label>{field.label}</Label>
                              <Input
                                value={resource.config[field.key] || ""}
                                onChange={(e) =>
                                  updateResourceConfig(resource.id, field.key, e.target.value)
                                }
                                placeholder={field.placeholder}
                              />
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </TabsContent>

              <TabsContent value="variables" className="p-4 space-y-4 m-0">
                {variables.map((variable, index) => (
                  <Card key={index}>
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Variable {index + 1}</Label>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500"
                          onClick={() => removeVariable(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label className="text-xs">Name</Label>
                          <Input
                            value={variable.name}
                            onChange={(e) => updateVariable(index, { name: e.target.value })}
                            placeholder="variable_name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Type</Label>
                          <Select
                            value={variable.type}
                            onValueChange={(v) => updateVariable(index, { type: v })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="string">string</SelectItem>
                              <SelectItem value="number">number</SelectItem>
                              <SelectItem value="bool">bool</SelectItem>
                              <SelectItem value="list(string)">list(string)</SelectItem>
                              <SelectItem value="map(string)">map(string)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Default Value</Label>
                        <Input
                          value={variable.default}
                          onChange={(e) => updateVariable(index, { default: e.target.value })}
                          placeholder="default value"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Description</Label>
                        <Input
                          value={variable.description}
                          onChange={(e) =>
                            updateVariable(index, { description: e.target.value })
                          }
                          placeholder="Variable description"
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
                <Button variant="outline" onClick={addVariable} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Variable
                </Button>
              </TabsContent>

              <TabsContent value="outputs" className="p-4 space-y-4 m-0">
                {outputs.map((output, index) => (
                  <Card key={index}>
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Output {index + 1}</Label>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500"
                          onClick={() => removeOutput(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Name</Label>
                        <Input
                          value={output.name}
                          onChange={(e) => updateOutput(index, { name: e.target.value })}
                          placeholder="output_name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Value</Label>
                        <Input
                          value={output.value}
                          onChange={(e) => updateOutput(index, { value: e.target.value })}
                          placeholder="aws_instance.main.public_ip"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Description</Label>
                        <Input
                          value={output.description}
                          onChange={(e) =>
                            updateOutput(index, { description: e.target.value })
                          }
                          placeholder="Output description"
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
                <Button variant="outline" onClick={addOutput} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Output
                </Button>
              </TabsContent>

              <TabsContent value="preview" className="p-4 m-0">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Generated HCL</CardTitle>
                      <Button variant="ghost" size="sm" onClick={copyHCL}>
                        <Copy className="h-4 w-4 mr-1" />
                        Copy
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-96">
                      <pre className="p-4 rounded-lg bg-black/90 text-green-400 text-xs font-mono whitespace-pre">
                        {generateHCL()}
                      </pre>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-border flex items-center justify-between">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            {resources.length} resources
          </Badge>
          <Button onClick={handleComplete} disabled={resources.length === 0}>
            Generate Configuration
          </Button>
        </div>
      </div>
    </div>
  );
}

export default TerraformBuilder;
