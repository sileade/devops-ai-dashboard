import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Shield, ShieldAlert, ShieldCheck, Scan, AlertTriangle, CheckCircle, FileWarning, Lock, Eye } from "lucide-react";
import { toast } from "sonner";

export default function SecurityGuardian() {
  const [scanDialogOpen, setScanDialogOpen] = useState(false);
  const [complianceDialogOpen, setComplianceDialogOpen] = useState(false);
  const [scanTarget, setScanTarget] = useState({ type: "container" as const, target: "" });
  const [selectedFramework, setSelectedFramework] = useState<"SOC2" | "HIPAA" | "PCI-DSS">("SOC2");

  // Queries
  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ["security-stats"],
    queryFn: () => trpc.securityGuardian.getStats.query(),
  });

  const { data: scans, refetch: refetchScans } = useQuery({
    queryKey: ["security-scans"],
    queryFn: () => trpc.securityGuardian.listScans.query(),
  });

  const { data: vulnerabilities } = useQuery({
    queryKey: ["vulnerabilities"],
    queryFn: () => trpc.securityGuardian.getVulnerabilities.query(),
  });

  const { data: policies, refetch: refetchPolicies } = useQuery({
    queryKey: ["security-policies"],
    queryFn: () => trpc.securityGuardian.listPolicies.query(),
  });

  const { data: complianceReports } = useQuery({
    queryKey: ["compliance-reports"],
    queryFn: () => trpc.securityGuardian.listComplianceReports.query(),
  });

  // Mutations
  const startScanMutation = useMutation({
    mutationFn: (data: { scanType: "container" | "kubernetes" | "secrets" | "compliance" | "dependencies"; target: string }) =>
      trpc.securityGuardian.scan.mutate(data),
    onSuccess: () => {
      toast.success("Security scan started");
      setScanDialogOpen(false);
      refetchScans();
      refetchStats();
    },
  });

  const checkComplianceMutation = useMutation({
    mutationFn: (framework: "SOC2" | "HIPAA" | "PCI-DSS") =>
      trpc.securityGuardian.checkCompliance.mutate({ framework }),
    onSuccess: () => {
      toast.success("Compliance check completed");
      setComplianceDialogOpen(false);
    },
  });

  const togglePolicyMutation = useMutation({
    mutationFn: (data: { id: number; enabled: boolean }) =>
      trpc.securityGuardian.togglePolicy.mutate(data),
    onSuccess: () => {
      toast.success("Policy updated");
      refetchPolicies();
    },
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "bg-red-600 text-white";
      case "high": return "bg-orange-500 text-white";
      case "medium": return "bg-yellow-500";
      case "low": return "bg-blue-500 text-white";
      case "info": return "bg-gray-500 text-white";
      default: return "bg-gray-500";
    }
  };

  const getComplianceColor = (status: string) => {
    switch (status) {
      case "compliant": return "text-green-500";
      case "partial": return "text-yellow-500";
      case "non_compliant": return "text-red-500";
      default: return "text-gray-500";
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">AI Security Guardian</h1>
            <p className="text-muted-foreground">
              DevSecOps: Continuous security monitoring and automated remediation
            </p>
          </div>
          <div className="flex gap-2">
            <Dialog open={complianceDialogOpen} onOpenChange={setComplianceDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <FileWarning className="mr-2 h-4 w-4" />
                  Compliance Check
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Run Compliance Check</DialogTitle>
                  <DialogDescription>
                    Check your infrastructure against compliance frameworks
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Framework</Label>
                    <Select value={selectedFramework} onValueChange={(v) => setSelectedFramework(v as typeof selectedFramework)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SOC2">SOC 2</SelectItem>
                        <SelectItem value="HIPAA">HIPAA</SelectItem>
                        <SelectItem value="PCI-DSS">PCI-DSS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setComplianceDialogOpen(false)}>Cancel</Button>
                  <Button onClick={() => checkComplianceMutation.mutate(selectedFramework)}>
                    Run Check
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={scanDialogOpen} onOpenChange={setScanDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Scan className="mr-2 h-4 w-4" />
                  New Scan
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Start Security Scan</DialogTitle>
                  <DialogDescription>
                    Scan your infrastructure for vulnerabilities
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Scan Type</Label>
                    <Select
                      value={scanTarget.type}
                      onValueChange={(v) => setScanTarget({ ...scanTarget, type: v as typeof scanTarget.type })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="container">Container Image</SelectItem>
                        <SelectItem value="kubernetes">Kubernetes Cluster</SelectItem>
                        <SelectItem value="secrets">Secrets Detection</SelectItem>
                        <SelectItem value="dependencies">Dependencies</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Target</Label>
                    <Input
                      value={scanTarget.target}
                      onChange={(e) => setScanTarget({ ...scanTarget, target: e.target.value })}
                      placeholder="e.g., nginx:latest or production-cluster"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setScanDialogOpen(false)}>Cancel</Button>
                  <Button onClick={() => startScanMutation.mutate({ scanType: scanTarget.type, target: scanTarget.target })}>
                    Start Scan
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-red-500" />
                Critical
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">{stats?.criticalVulnerabilities || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                High
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-500">{stats?.highVulnerabilities || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Vulnerabilities</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalVulnerabilities || 0}</div>
              <p className="text-xs text-muted-foreground">{stats?.openVulnerabilities || 0} open</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Active Policies</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.activePolicies || 0}</div>
              <p className="text-xs text-muted-foreground">of {stats?.totalPolicies || 0} total</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Scans</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.completedScans || 0}</div>
              <p className="text-xs text-muted-foreground">{stats?.runningScans || 0} running</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="vulnerabilities">
          <TabsList>
            <TabsTrigger value="vulnerabilities">Vulnerabilities</TabsTrigger>
            <TabsTrigger value="scans">Scans</TabsTrigger>
            <TabsTrigger value="policies">Policies</TabsTrigger>
            <TabsTrigger value="compliance">Compliance</TabsTrigger>
          </TabsList>

          <TabsContent value="vulnerabilities" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Detected Vulnerabilities</CardTitle>
                <CardDescription>Security issues found in your infrastructure</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3">
                    {vulnerabilities?.map((vuln, i) => (
                      <div key={i} className="p-4 border rounded-lg">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Badge className={getSeverityColor(vuln.severity)}>
                                {vuln.severity.toUpperCase()}
                              </Badge>
                              {vuln.cveId && (
                                <Badge variant="outline">{vuln.cveId}</Badge>
                              )}
                            </div>
                            <h4 className="font-medium mt-2">{vuln.title}</h4>
                            <p className="text-sm text-muted-foreground mt-1">{vuln.description}</p>
                            {vuln.affectedPackage && (
                              <div className="mt-2 text-sm">
                                <span className="text-muted-foreground">Package: </span>
                                <code className="bg-muted px-1 rounded">{vuln.affectedPackage}</code>
                                {vuln.installedVersion && (
                                  <span className="text-muted-foreground"> v{vuln.installedVersion}</span>
                                )}
                                {vuln.fixedVersion && (
                                  <span className="text-green-600"> → v{vuln.fixedVersion}</span>
                                )}
                              </div>
                            )}
                          </div>
                          <Badge variant={vuln.status === "open" ? "destructive" : "secondary"}>
                            {vuln.status}
                          </Badge>
                        </div>
                        {vuln.remediation && (
                          <div className="mt-3 p-2 bg-accent rounded text-sm">
                            <strong>Remediation:</strong> {vuln.remediation}
                          </div>
                        )}
                      </div>
                    ))}
                    {(!vulnerabilities || vulnerabilities.length === 0) && (
                      <div className="text-center py-8 text-muted-foreground">
                        <ShieldCheck className="h-12 w-12 mx-auto mb-4 text-green-500" />
                        <p>No vulnerabilities detected</p>
                        <p className="text-sm">Run a security scan to check your infrastructure</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="scans" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Security Scans</CardTitle>
                <CardDescription>Recent and ongoing security scans</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3">
                    {scans?.map((scan) => (
                      <div key={scan.id} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{scan.scanType}</Badge>
                              <span className="font-medium">{scan.target}</span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              Started: {new Date(scan.startedAt).toLocaleString()}
                            </p>
                          </div>
                          <Badge variant={scan.status === "completed" ? "default" : scan.status === "running" ? "secondary" : "destructive"}>
                            {scan.status}
                          </Badge>
                        </div>
                        {scan.status === "completed" && (
                          <div className="mt-3 flex gap-4 text-sm">
                            <span className="text-red-500">Critical: {scan.criticalCount}</span>
                            <span className="text-orange-500">High: {scan.highCount}</span>
                            <span className="text-yellow-600">Medium: {scan.mediumCount}</span>
                            <span className="text-blue-500">Low: {scan.lowCount}</span>
                          </div>
                        )}
                        {scan.status === "running" && (
                          <Progress value={50} className="mt-3" />
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="policies" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Security Policies</CardTitle>
                <CardDescription>Configure security rules and enforcement</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3">
                    {policies?.map((policy) => (
                      <div key={policy.id} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Lock className="h-4 w-4" />
                              <h4 className="font-medium">{policy.name}</h4>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{policy.description}</p>
                            <div className="mt-2 flex gap-2">
                              <Badge variant="outline">{policy.policyType}</Badge>
                              <Badge variant={
                                policy.enforcementLevel === "block" ? "destructive" :
                                policy.enforcementLevel === "warn" ? "secondary" : "outline"
                              }>
                                {policy.enforcementLevel}
                              </Badge>
                            </div>
                          </div>
                          <Switch
                            checked={policy.enabled}
                            onCheckedChange={(enabled) => togglePolicyMutation.mutate({ id: policy.id, enabled })}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="compliance" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Compliance Reports</CardTitle>
                <CardDescription>Framework compliance status</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-4">
                    {complianceReports?.map((report) => (
                      <div key={report.id} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <Shield className={`h-8 w-8 ${getComplianceColor(report.status)}`} />
                            <div>
                              <h4 className="font-semibold">{report.framework}</h4>
                              <p className="text-sm text-muted-foreground">
                                {new Date(report.generatedAt).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`text-2xl font-bold ${getComplianceColor(report.status)}`}>
                              {report.score}%
                            </div>
                            <Badge variant={
                              report.status === "compliant" ? "default" :
                              report.status === "partial" ? "secondary" : "destructive"
                            }>
                              {report.status.replace("_", " ")}
                            </Badge>
                          </div>
                        </div>
                        <Progress value={report.score} className="mb-2" />
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span className="text-green-500">{report.passedControls} passed</span>
                          <span className="text-red-500">{report.failedControls} failed</span>
                          <span>{report.totalControls} total controls</span>
                        </div>
                      </div>
                    ))}
                    {(!complianceReports || complianceReports.length === 0) && (
                      <div className="text-center py-8 text-muted-foreground">
                        <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No compliance reports yet</p>
                        <p className="text-sm">Run a compliance check to assess your infrastructure</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
