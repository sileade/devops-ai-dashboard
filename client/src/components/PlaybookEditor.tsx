import { useState, useCallback } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Trash2,
  GripVertical,
  Play,
  Save,
  Download,
  Upload,
  Copy,
  FileCode,
  Package,
  Server,
  Settings,
  Terminal,
  File,
  FolderOpen,
  Shield,
  Clock,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";

interface TaskField {
  name: string;
  label: string;
  type: "text" | "textarea" | "select" | "boolean";
  required?: boolean;
  placeholder?: string;
  options?: string[];
  default?: string | boolean;
}

// Ansible task templates
const taskTemplates: Record<string, {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  module: string;
  description: string;
  fields: TaskField[];
}> = {
  package: {
    name: "Install Package",
    icon: Package,
    color: "text-blue-500",
    module: "apt",
    description: "Install or remove packages",
    fields: [
      { name: "name", label: "Package Name", type: "text", required: true, placeholder: "nginx" },
      { name: "state", label: "State", type: "select", options: ["present", "absent", "latest"], default: "present" },
      { name: "update_cache", label: "Update Cache", type: "boolean", default: true },
    ],
  },
  yum: {
    name: "Install Package (YUM)",
    icon: Package,
    color: "text-orange-500",
    module: "yum",
    description: "Install packages on RHEL/CentOS",
    fields: [
      { name: "name", label: "Package Name", type: "text", required: true, placeholder: "httpd" },
      { name: "state", label: "State", type: "select", options: ["present", "absent", "latest"], default: "present" },
    ],
  },
  service: {
    name: "Manage Service",
    icon: Server,
    color: "text-green-500",
    module: "service",
    description: "Start, stop, or restart services",
    fields: [
      { name: "name", label: "Service Name", type: "text", required: true, placeholder: "nginx" },
      { name: "state", label: "State", type: "select", options: ["started", "stopped", "restarted", "reloaded"], default: "started" },
      { name: "enabled", label: "Enable on Boot", type: "boolean", default: true },
    ],
  },
  copy: {
    name: "Copy File",
    icon: File,
    color: "text-purple-500",
    module: "copy",
    description: "Copy files to remote hosts",
    fields: [
      { name: "src", label: "Source Path", type: "text", required: true, placeholder: "/local/path/file.conf" },
      { name: "dest", label: "Destination Path", type: "text", required: true, placeholder: "/etc/app/file.conf" },
      { name: "owner", label: "Owner", type: "text", placeholder: "root" },
      { name: "group", label: "Group", type: "text", placeholder: "root" },
      { name: "mode", label: "Mode", type: "text", placeholder: "0644" },
    ],
  },
  template: {
    name: "Template File",
    icon: FileCode,
    color: "text-yellow-500",
    module: "template",
    description: "Deploy Jinja2 templates",
    fields: [
      { name: "src", label: "Template Source", type: "text", required: true, placeholder: "templates/config.j2" },
      { name: "dest", label: "Destination Path", type: "text", required: true, placeholder: "/etc/app/config.conf" },
      { name: "owner", label: "Owner", type: "text", placeholder: "root" },
      { name: "group", label: "Group", type: "text", placeholder: "root" },
      { name: "mode", label: "Mode", type: "text", placeholder: "0644" },
    ],
  },
  command: {
    name: "Run Command",
    icon: Terminal,
    color: "text-red-500",
    module: "command",
    description: "Execute shell commands",
    fields: [
      { name: "cmd", label: "Command", type: "textarea", required: true, placeholder: "echo 'Hello World'" },
      { name: "chdir", label: "Working Directory", type: "text", placeholder: "/opt/app" },
      { name: "creates", label: "Creates (skip if exists)", type: "text", placeholder: "/opt/app/installed" },
    ],
  },
  shell: {
    name: "Run Shell",
    icon: Terminal,
    color: "text-orange-500",
    module: "shell",
    description: "Execute shell commands with pipes",
    fields: [
      { name: "cmd", label: "Shell Command", type: "textarea", required: true, placeholder: "cat /etc/passwd | grep root" },
      { name: "chdir", label: "Working Directory", type: "text", placeholder: "/opt/app" },
    ],
  },
  file: {
    name: "Manage File/Directory",
    icon: FolderOpen,
    color: "text-cyan-500",
    module: "file",
    description: "Create, delete, or modify files and directories",
    fields: [
      { name: "path", label: "Path", type: "text", required: true, placeholder: "/opt/app" },
      { name: "state", label: "State", type: "select", options: ["file", "directory", "link", "absent", "touch"], default: "directory" },
      { name: "owner", label: "Owner", type: "text", placeholder: "root" },
      { name: "group", label: "Group", type: "text", placeholder: "root" },
      { name: "mode", label: "Mode", type: "text", placeholder: "0755" },
    ],
  },
  user: {
    name: "Manage User",
    icon: Shield,
    color: "text-indigo-500",
    module: "user",
    description: "Create or manage user accounts",
    fields: [
      { name: "name", label: "Username", type: "text", required: true, placeholder: "appuser" },
      { name: "state", label: "State", type: "select", options: ["present", "absent"], default: "present" },
      { name: "groups", label: "Groups", type: "text", placeholder: "sudo,docker" },
      { name: "shell", label: "Shell", type: "text", placeholder: "/bin/bash" },
      { name: "home", label: "Home Directory", type: "text", placeholder: "/home/appuser" },
    ],
  },
  git: {
    name: "Git Clone/Pull",
    icon: FileCode,
    color: "text-gray-500",
    module: "git",
    description: "Clone or update Git repositories",
    fields: [
      { name: "repo", label: "Repository URL", type: "text", required: true, placeholder: "https://github.com/user/repo.git" },
      { name: "dest", label: "Destination Path", type: "text", required: true, placeholder: "/opt/app" },
      { name: "version", label: "Branch/Tag", type: "text", placeholder: "main" },
      { name: "force", label: "Force Update", type: "boolean", default: false },
    ],
  },
  docker_container: {
    name: "Docker Container",
    icon: Package,
    color: "text-blue-400",
    module: "docker_container",
    description: "Manage Docker containers",
    fields: [
      { name: "name", label: "Container Name", type: "text", required: true, placeholder: "my-app" },
      { name: "image", label: "Image", type: "text", required: true, placeholder: "nginx:latest" },
      { name: "state", label: "State", type: "select", options: ["started", "stopped", "absent", "present"], default: "started" },
      { name: "ports", label: "Ports (comma-separated)", type: "text", placeholder: "80:80,443:443" },
      { name: "env", label: "Environment Variables", type: "textarea", placeholder: "KEY=value\nKEY2=value2" },
    ],
  },
  wait_for: {
    name: "Wait For",
    icon: Clock,
    color: "text-amber-500",
    module: "wait_for",
    description: "Wait for a condition before continuing",
    fields: [
      { name: "host", label: "Host", type: "text", placeholder: "localhost" },
      { name: "port", label: "Port", type: "text", placeholder: "80" },
      { name: "state", label: "State", type: "select", options: ["started", "stopped", "present", "absent", "drained"], default: "started" },
      { name: "timeout", label: "Timeout (seconds)", type: "text", placeholder: "300" },
    ],
  },
};

interface Task {
  id: string;
  name: string;
  module: string;
  templateKey: string;
  params: Record<string, string | boolean>;
  when?: string;
  register?: string;
  become?: boolean;
  tags?: string[];
  notify?: string;
}

interface PlaybookData {
  name: string;
  hosts: string;
  become: boolean;
  gather_facts: boolean;
  vars: Record<string, string>;
  tasks: Task[];
  handlers: Task[];
}

interface PlaybookEditorProps {
  initialData?: PlaybookData;
  onSave?: (data: PlaybookData, yaml: string) => void;
  onRun?: (data: PlaybookData) => void;
}

export function PlaybookEditor({ initialData, onSave, onRun }: PlaybookEditorProps) {
  const [playbook, setPlaybook] = useState<PlaybookData>(
    initialData || {
      name: "New Playbook",
      hosts: "all",
      become: false,
      gather_facts: true,
      vars: {},
      tasks: [],
      handlers: [],
    }
  );

  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [showYamlPreview, setShowYamlPreview] = useState(false);
  const [newVarKey, setNewVarKey] = useState("");
  const [newVarValue, setNewVarValue] = useState("");
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  // Generate unique ID
  const generateId = () => Math.random().toString(36).substring(2, 9);

  // Convert playbook to YAML
  const generateYaml = useCallback((): string => {
    const yamlLines: string[] = [];
    yamlLines.push("---");
    yamlLines.push(`- name: ${playbook.name}`);
    yamlLines.push(`  hosts: ${playbook.hosts}`);
    if (playbook.become) yamlLines.push("  become: yes");
    yamlLines.push(`  gather_facts: ${playbook.gather_facts ? "yes" : "no"}`);

    if (Object.keys(playbook.vars).length > 0) {
      yamlLines.push("  vars:");
      Object.entries(playbook.vars).forEach(([key, value]) => {
        yamlLines.push(`    ${key}: "${value}"`);
      });
    }

    if (playbook.tasks.length > 0) {
      yamlLines.push("  tasks:");
      playbook.tasks.forEach((task) => {
        yamlLines.push(`    - name: ${task.name}`);
        if (task.become) yamlLines.push("      become: yes");
        
        // Module and params
        const moduleParams: string[] = [];
        Object.entries(task.params).forEach(([key, value]) => {
          if (value !== "" && value !== false) {
            if (typeof value === "boolean") {
              moduleParams.push(`${key}=${value ? "yes" : "no"}`);
            } else {
              moduleParams.push(`${key}=${value}`);
            }
          }
        });
        
        if (moduleParams.length === 1 && task.module === "command") {
          yamlLines.push(`      ${task.module}: ${task.params.cmd}`);
        } else {
          yamlLines.push(`      ${task.module}:`);
          Object.entries(task.params).forEach(([key, value]) => {
            if (value !== "" && value !== false) {
              if (typeof value === "boolean") {
                yamlLines.push(`        ${key}: ${value ? "yes" : "no"}`);
              } else if (key === "env" && typeof value === "string" && value.includes("\n")) {
                yamlLines.push(`        ${key}:`);
                value.split("\n").forEach((line) => {
                  const [envKey, envVal] = line.split("=");
                  if (envKey && envVal) {
                    yamlLines.push(`          ${envKey}: "${envVal}"`);
                  }
                });
              } else {
                yamlLines.push(`        ${key}: "${value}"`);
              }
            }
          });
        }

        if (task.when) yamlLines.push(`      when: ${task.when}`);
        if (task.register) yamlLines.push(`      register: ${task.register}`);
        if (task.tags && task.tags.length > 0) {
          yamlLines.push(`      tags: [${task.tags.join(", ")}]`);
        }
        if (task.notify) yamlLines.push(`      notify: ${task.notify}`);
      });
    }

    if (playbook.handlers.length > 0) {
      yamlLines.push("  handlers:");
      playbook.handlers.forEach((handler) => {
        yamlLines.push(`    - name: ${handler.name}`);
        yamlLines.push(`      ${handler.module}:`);
        Object.entries(handler.params).forEach(([key, value]) => {
          if (value !== "" && value !== false) {
            yamlLines.push(`        ${key}: "${value}"`);
          }
        });
      });
    }

    return yamlLines.join("\n");
  }, [playbook]);

  // Add new task
  const addTask = (templateKey: string) => {
    const template = taskTemplates[templateKey as keyof typeof taskTemplates];
    if (!template) return;

    const params: Record<string, string | boolean> = {};
    template.fields.forEach((field: TaskField) => {
      params[field.name] = field.default !== undefined ? field.default : "";
    });

    const newTask: Task = {
      id: generateId(),
      name: `${template.name}`,
      module: template.module,
      templateKey,
      params,
      become: false,
      tags: [],
    };

    setEditingTask(newTask);
    setSelectedTemplate(templateKey);
    setShowTaskDialog(true);
  };

  // Save task
  const saveTask = () => {
    if (!editingTask) return;

    setPlaybook((prev) => {
      const existingIndex = prev.tasks.findIndex((t) => t.id === editingTask.id);
      if (existingIndex >= 0) {
        const newTasks = [...prev.tasks];
        newTasks[existingIndex] = editingTask;
        return { ...prev, tasks: newTasks };
      }
      return { ...prev, tasks: [...prev.tasks, editingTask] };
    });

    setShowTaskDialog(false);
    setEditingTask(null);
    setSelectedTemplate(null);
    toast.success("Task saved");
  };

  // Delete task
  const deleteTask = (taskId: string) => {
    setPlaybook((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((t) => t.id !== taskId),
    }));
    toast.success("Task deleted");
  };

  // Move task
  const moveTask = (taskId: string, direction: "up" | "down") => {
    setPlaybook((prev) => {
      const index = prev.tasks.findIndex((t) => t.id === taskId);
      if (index < 0) return prev;
      if (direction === "up" && index === 0) return prev;
      if (direction === "down" && index === prev.tasks.length - 1) return prev;

      const newTasks = [...prev.tasks];
      const swapIndex = direction === "up" ? index - 1 : index + 1;
      [newTasks[index], newTasks[swapIndex]] = [newTasks[swapIndex], newTasks[index]];
      return { ...prev, tasks: newTasks };
    });
  };

  // Add variable
  const addVariable = () => {
    if (!newVarKey.trim()) return;
    setPlaybook((prev) => ({
      ...prev,
      vars: { ...prev.vars, [newVarKey]: newVarValue },
    }));
    setNewVarKey("");
    setNewVarValue("");
    toast.success("Variable added");
  };

  // Delete variable
  const deleteVariable = (key: string) => {
    setPlaybook((prev) => {
      const newVars = { ...prev.vars };
      delete newVars[key];
      return { ...prev, vars: newVars };
    });
  };

  // Handle save
  const handleSave = () => {
    const yaml = generateYaml();
    onSave?.(playbook, yaml);
    toast.success("Playbook saved");
  };

  // Handle run
  const handleRun = () => {
    onRun?.(playbook);
  };

  // Copy YAML to clipboard
  const copyYaml = () => {
    navigator.clipboard.writeText(generateYaml());
    toast.success("YAML copied to clipboard");
  };

  // Download YAML
  const downloadYaml = () => {
    const blob = new Blob([generateYaml()], { type: "text/yaml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${playbook.name.toLowerCase().replace(/\s+/g, "-")}.yml`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Playbook downloaded");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-4">
          <Input
            value={playbook.name}
            onChange={(e) => setPlaybook((prev) => ({ ...prev, name: e.target.value }))}
            className="text-lg font-semibold w-64"
            placeholder="Playbook Name"
          />
          <Badge variant="outline" className="text-xs">
            {playbook.tasks.length} tasks
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowYamlPreview(!showYamlPreview)}>
            <FileCode className="h-4 w-4 mr-2" />
            {showYamlPreview ? "Hide YAML" : "Show YAML"}
          </Button>
          <Button variant="outline" size="sm" onClick={copyYaml}>
            <Copy className="h-4 w-4 mr-2" />
            Copy
          </Button>
          <Button variant="outline" size="sm" onClick={downloadYaml}>
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
          <Button variant="outline" size="sm" onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
          <Button size="sm" onClick={handleRun} className="bg-green-600 hover:bg-green-700">
            <Play className="h-4 w-4 mr-2" />
            Run
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main Editor */}
        <div className="flex-1 overflow-auto p-4">
          <Tabs defaultValue="tasks" className="h-full">
            <TabsList className="mb-4">
              <TabsTrigger value="tasks">Tasks</TabsTrigger>
              <TabsTrigger value="variables">Variables</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="tasks" className="space-y-4">
              {/* Task Templates */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Wand2 className="h-4 w-4" />
                    Add Task
                  </CardTitle>
                  <CardDescription>Click a template to add a new task</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
                    {Object.entries(taskTemplates).map(([key, template]) => {
                      const Icon = template.icon;
                      return (
                        <Button
                          key={key}
                          variant="outline"
                          className="h-auto py-3 flex flex-col items-center gap-1 hover:bg-accent"
                          onClick={() => addTask(key)}
                        >
                          <Icon className={`h-5 w-5 ${template.color}`} />
                          <span className="text-xs text-center">{template.name}</span>
                        </Button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Tasks List */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Tasks ({playbook.tasks.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  {playbook.tasks.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No tasks yet. Click a template above to add your first task.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {playbook.tasks.map((task, index) => {
                        const template = taskTemplates[task.templateKey as keyof typeof taskTemplates];
                        const Icon = template?.icon || Settings;
                        return (
                          <div
                            key={task.id}
                            className="flex items-center gap-2 p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
                          >
                            <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                            <div className="flex items-center gap-2 flex-1">
                              <Icon className={`h-4 w-4 ${template?.color || "text-gray-500"}`} />
                              <div className="flex-1">
                                <div className="font-medium text-sm">{task.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {task.module} • {Object.entries(task.params).filter(([, v]) => v).length} params
                                  {task.when && " • conditional"}
                                  {task.become && " • sudo"}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => moveTask(task.id, "up")}
                                disabled={index === 0}
                              >
                                <ChevronUp className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => moveTask(task.id, "down")}
                                disabled={index === playbook.tasks.length - 1}
                              >
                                <ChevronDown className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => {
                                  setEditingTask(task);
                                  setSelectedTemplate(task.templateKey);
                                  setShowTaskDialog(true);
                                }}
                              >
                                <Settings className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-red-500 hover:text-red-600"
                                onClick={() => deleteTask(task.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="variables" className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Playbook Variables</CardTitle>
                  <CardDescription>Define variables that can be used in tasks</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Variable name"
                      value={newVarKey}
                      onChange={(e) => setNewVarKey(e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      placeholder="Value"
                      value={newVarValue}
                      onChange={(e) => setNewVarValue(e.target.value)}
                      className="flex-1"
                    />
                    <Button onClick={addVariable} disabled={!newVarKey.trim()}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  {Object.keys(playbook.vars).length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                      No variables defined
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {Object.entries(playbook.vars).map(([key, value]) => (
                        <div key={key} className="flex items-center gap-2 p-2 rounded border border-border">
                          <code className="text-sm font-mono flex-1">{key}</code>
                          <span className="text-muted-foreground">=</span>
                          <code className="text-sm font-mono flex-1 text-green-500">{value}</code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-500"
                            onClick={() => deleteVariable(key)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Playbook Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Target Hosts</Label>
                      <Input
                        value={playbook.hosts}
                        onChange={(e) => setPlaybook((prev) => ({ ...prev, hosts: e.target.value }))}
                        placeholder="all, web-servers, db-servers"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Become (sudo)</Label>
                      <p className="text-xs text-muted-foreground">Run tasks with elevated privileges</p>
                    </div>
                    <Switch
                      checked={playbook.become}
                      onCheckedChange={(checked) => setPlaybook((prev) => ({ ...prev, become: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Gather Facts</Label>
                      <p className="text-xs text-muted-foreground">Collect system information before running tasks</p>
                    </div>
                    <Switch
                      checked={playbook.gather_facts}
                      onCheckedChange={(checked) => setPlaybook((prev) => ({ ...prev, gather_facts: checked }))}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* YAML Preview */}
        {showYamlPreview && (
          <div className="w-96 border-l border-border bg-muted/30">
            <div className="p-3 border-b border-border flex items-center justify-between">
              <span className="text-sm font-medium">YAML Preview</span>
              <Button variant="ghost" size="sm" onClick={copyYaml}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
            <ScrollArea className="h-[calc(100vh-200px)]">
              <pre className="p-4 text-xs font-mono text-green-400 whitespace-pre-wrap">
                {generateYaml()}
              </pre>
            </ScrollArea>
          </div>
        )}
      </div>

      {/* Task Edit Dialog */}
      <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTask?.id && playbook.tasks.find((t) => t.id === editingTask.id)
                ? "Edit Task"
                : "Add Task"}
            </DialogTitle>
            <DialogDescription>
              {selectedTemplate && taskTemplates[selectedTemplate as keyof typeof taskTemplates]?.description}
            </DialogDescription>
          </DialogHeader>

          {editingTask && selectedTemplate && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Task Name</Label>
                <Input
                  value={editingTask.name}
                  onChange={(e) => setEditingTask({ ...editingTask, name: e.target.value })}
                  placeholder="Descriptive task name"
                />
              </div>

              <div className="space-y-3">
                <Label>Module Parameters</Label>
                {taskTemplates[selectedTemplate as keyof typeof taskTemplates]?.fields.map((field: TaskField) => (
                  <div key={field.name} className="space-y-1">
                    <Label className="text-xs">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </Label>
                    {field.type === "text" && (
                      <Input
                        value={(editingTask.params[field.name] as string) || ""}
                        onChange={(e) =>
                          setEditingTask({
                            ...editingTask,
                            params: { ...editingTask.params, [field.name]: e.target.value },
                          })
                        }
                        placeholder={field.placeholder}
                      />
                    )}
                    {field.type === "textarea" && (
                      <Textarea
                        value={(editingTask.params[field.name] as string) || ""}
                        onChange={(e) =>
                          setEditingTask({
                            ...editingTask,
                            params: { ...editingTask.params, [field.name]: e.target.value },
                          })
                        }
                        placeholder={field.placeholder}
                        rows={3}
                      />
                    )}
                    {field.type === "select" && field.options && (
                      <Select
                        value={(editingTask.params[field.name] as string) || field.default?.toString() || ""}
                        onValueChange={(value) =>
                          setEditingTask({
                            ...editingTask,
                            params: { ...editingTask.params, [field.name]: value },
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {field.options.map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {field.type === "boolean" && (
                      <Switch
                        checked={(editingTask.params[field.name] as boolean) || false}
                        onCheckedChange={(checked) =>
                          setEditingTask({
                            ...editingTask,
                            params: { ...editingTask.params, [field.name]: checked },
                          })
                        }
                      />
                    )}
                  </div>
                ))}
              </div>

              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="advanced">
                  <AccordionTrigger className="text-sm">Advanced Options</AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs">When (Conditional)</Label>
                      <Input
                        value={editingTask.when || ""}
                        onChange={(e) => setEditingTask({ ...editingTask, when: e.target.value })}
                        placeholder="ansible_os_family == 'Debian'"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Register Variable</Label>
                      <Input
                        value={editingTask.register || ""}
                        onChange={(e) => setEditingTask({ ...editingTask, register: e.target.value })}
                        placeholder="result"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Tags (comma-separated)</Label>
                      <Input
                        value={editingTask.tags?.join(", ") || ""}
                        onChange={(e) =>
                          setEditingTask({
                            ...editingTask,
                            tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean),
                          })
                        }
                        placeholder="deploy, config"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Notify Handler</Label>
                      <Input
                        value={editingTask.notify || ""}
                        onChange={(e) => setEditingTask({ ...editingTask, notify: e.target.value })}
                        placeholder="restart nginx"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Become (sudo)</Label>
                      <Switch
                        checked={editingTask.become || false}
                        onCheckedChange={(checked) => setEditingTask({ ...editingTask, become: checked })}
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTaskDialog(false)}>
              Cancel
            </Button>
            <Button onClick={saveTask}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Save Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default PlaybookEditor;
