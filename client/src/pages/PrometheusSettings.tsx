import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  Activity, 
  Settings, 
  BarChart3, 
  CheckCircle, 
  XCircle, 
  Plus,
  Trash2,
  RefreshCw,
  ExternalLink,
  Database,
  LineChart,
} from "lucide-react";

export default function PrometheusSettings() {
  const [newQuery, setNewQuery] = useState({
    name: "",
    query: "",
    description: "",
  });

  const { data: config, refetch: refetchConfig } = trpc.prometheus.getConfig.useQuery();
  const { data: savedQueries, refetch: refetchQueries } = trpc.prometheus.getSavedQueries.useQuery();
  const { data: dashboards, refetch: refetchDashboards } = trpc.prometheus.getDashboards.useQuery();

  const saveConfigMutation = trpc.prometheus.saveConfig.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Prometheus configuration saved");
        refetchConfig();
      } else {
        toast.error(result.error || "Failed to save configuration");
      }
    },
  });

  const testConnectionMutation = trpc.prometheus.testPrometheus.useMutation({
    onSuccess: (result: any) => {
      if (result.success) {
        toast.success(`Connected to Prometheus ${result.version}`);
      } else {
        toast.error(result.error || "Connection failed");
      }
    },
  });

  const saveQueryMutation = trpc.prometheus.saveMetricQuery.useMutation({
    onSuccess: (result: any) => {
      if (result.success) {
        toast.success("Query saved");
        setNewQuery({ name: "", query: "", description: "" });
        refetchQueries();
      } else {
        toast.error(result.error || "Failed to save query");
      }
    },
  });

  const deleteQueryMutation = trpc.prometheus.deleteMetricQuery.useMutation({
    onSuccess: () => {
      toast.success("Query deleted");
      refetchQueries();
    },
  });

  const [formConfig, setFormConfig] = useState({
    prometheusUrl: config?.prometheusUrl || "",
    grafanaUrl: config?.grafanaUrl || "",
    grafanaApiKey: "",
    enabled: config?.isEnabled || false,
    scrapeInterval: config?.scrapeInterval || 15,
  });

  // Update form when config loads
  if (config && !formConfig.prometheusUrl && config.prometheusUrl) {
    setFormConfig({
      prometheusUrl: config.prometheusUrl,
      grafanaUrl: config.grafanaUrl || "",
      grafanaApiKey: "",
      enabled: config.isEnabled,
      scrapeInterval: config.scrapeInterval,
    });
  }

  const handleSaveConfig = () => {
    saveConfigMutation.mutate(formConfig);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Prometheus & Grafana</h1>
        <p className="text-muted-foreground mt-1">
          Configure Prometheus and Grafana integration for advanced monitoring
        </p>
      </div>

      <Tabs defaultValue="config">
        <TabsList>
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="queries">Saved Queries</TabsTrigger>
          <TabsTrigger value="dashboards">Grafana Dashboards</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Prometheus Settings
                  </CardTitle>
                  <CardDescription>
                    Connect to your Prometheus server for metrics collection
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="enabled">Enable Integration</Label>
                  <Switch
                    id="enabled"
                    checked={formConfig.enabled}
                    onCheckedChange={(checked) => setFormConfig({ ...formConfig, enabled: checked })}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="prometheusUrl">Prometheus URL</Label>
                  <Input
                    id="prometheusUrl"
                    placeholder="http://prometheus:9090"
                    value={formConfig.prometheusUrl}
                    onChange={(e) => setFormConfig({ ...formConfig, prometheusUrl: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="scrapeInterval">Scrape Interval (seconds)</Label>
                  <Input
                    id="scrapeInterval"
                    type="number"
                    placeholder="15"
                    value={formConfig.scrapeInterval}
                    onChange={(e) => setFormConfig({ ...formConfig, scrapeInterval: parseInt(e.target.value) || 15 })}
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={handleSaveConfig} disabled={saveConfigMutation.isPending}>
                  {saveConfigMutation.isPending ? "Saving..." : "Save Configuration"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => testConnectionMutation.mutate()}
                  disabled={testConnectionMutation.isPending}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Test Connection
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Grafana Settings
              </CardTitle>
              <CardDescription>
                Connect to Grafana for dashboard visualization
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="grafanaUrl">Grafana URL</Label>
                  <Input
                    id="grafanaUrl"
                    placeholder="http://grafana:3000"
                    value={formConfig.grafanaUrl}
                    onChange={(e) => setFormConfig({ ...formConfig, grafanaUrl: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="grafanaApiKey">Grafana API Key</Label>
                  <Input
                    id="grafanaApiKey"
                    type="password"
                    placeholder="••••••••"
                    value={formConfig.grafanaApiKey}
                    onChange={(e) => setFormConfig({ ...formConfig, grafanaApiKey: e.target.value })}
                  />
                </div>
              </div>
              {formConfig.grafanaUrl && (
                <Button variant="outline" asChild>
                  <a href={formConfig.grafanaUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open Grafana
                  </a>
                </Button>
              )}
            </CardContent>
          </Card>

          {config && (
            <Card>
              <CardHeader>
                <CardTitle>Connection Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    {config.isEnabled ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-gray-500" />
                    )}
                    <span>Prometheus: {config.isEnabled ? "Connected" : "Disabled"}</span>
                  </div>
                  {config.updatedAt && (
                    <span className="text-sm text-muted-foreground">
                      Last sync: {new Date(config.updatedAt).toLocaleString()}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="queries" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Add PromQL Query
              </CardTitle>
              <CardDescription>
                Save frequently used Prometheus queries for quick access
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="queryName">Query Name</Label>
                  <Input
                    id="queryName"
                    placeholder="CPU Usage"
                    value={newQuery.name}
                    onChange={(e) => setNewQuery({ ...newQuery, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="queryDesc">Description</Label>
                  <Input
                    id="queryDesc"
                    placeholder="Average CPU usage across all nodes"
                    value={newQuery.description}
                    onChange={(e) => setNewQuery({ ...newQuery, description: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="query">PromQL Query</Label>
                <Input
                  id="query"
                  placeholder="avg(rate(node_cpu_seconds_total{mode!='idle'}[5m])) * 100"
                  value={newQuery.query}
                  onChange={(e) => setNewQuery({ ...newQuery, query: e.target.value })}
                  className="font-mono"
                />
              </div>
              <Button
                onClick={() => saveQueryMutation.mutate(newQuery)}
                disabled={saveQueryMutation.isPending || !newQuery.name || !newQuery.query}
              >
                <Plus className="h-4 w-4 mr-2" />
                Save Query
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Saved Queries</CardTitle>
            </CardHeader>
            <CardContent>
              {savedQueries && savedQueries.length > 0 ? (
                <div className="space-y-2">
                  {savedQueries.map((query) => (
                    <div key={query.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <LineChart className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{query.name}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{query.description}</p>
                        <code className="text-xs bg-muted px-2 py-1 rounded mt-2 block">
                          {query.query}
                        </code>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteQueryMutation.mutate({ id: query.id })}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  No saved queries yet. Add a query above.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dashboards" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Grafana Dashboards
              </CardTitle>
              <CardDescription>
                Linked Grafana dashboards for this project
              </CardDescription>
            </CardHeader>
            <CardContent>
              {dashboards && dashboards.success && dashboards.dashboards && dashboards.dashboards.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {dashboards.dashboards.map((dashboard: any) => (
                    <Card key={dashboard.id}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">{dashboard.title}</CardTitle>
                        <CardDescription>{dashboard.tags?.join(', ') || 'No tags'}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <Badge variant="secondary">{dashboard.uid}</Badge>
                          {dashboard.url && (
                            <Button variant="outline" size="sm" asChild>
                              <a href={dashboard.url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3 w-3 mr-1" />
                                Open
                              </a>
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    No dashboards linked yet. Connect Grafana and import dashboards.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
