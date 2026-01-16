import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Download,
  Calendar,
  BarChart3,
  Shield,
  Activity,
  Rocket,
  Users,
  Sparkles,
  Loader2,
  Eye,
  FileDown,
  Clock,
} from "lucide-react";

export default function Reports() {
  const [selectedType, setSelectedType] = useState<string>("");
  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [includeCharts, setIncludeCharts] = useState(true);
  const [includeAI, setIncludeAI] = useState(true);
  const [generatedReport, setGeneratedReport] = useState<{
    id: string;
    title: string;
    htmlContent: string;
    summary: string;
    aiAnalysis?: string;
  } | null>(null);

  const { data: reportTypes } = trpc.reports.getTypes.useQuery();
  const { data: presets } = trpc.reports.getPresets.useQuery();
  const { data: teams } = trpc.teams.getUserTeams.useQuery();

  const generateMutation = trpc.reports.generate.useMutation({
    onSuccess: (data) => {
      setGeneratedReport(data);
      toast.success("Report generated successfully");
    },
    onError: (error) => {
      toast.error(`Failed to generate report: ${error.message}`);
    },
  });

  const handlePresetSelect = (presetName: string) => {
    setSelectedPreset(presetName);
    const preset = presets?.find((p) => p.name === presetName);
    if (preset) {
      setStartDate(preset.startDate.split("T")[0]);
      setEndDate(preset.endDate.split("T")[0]);
    }
  };

  const handleGenerate = () => {
    if (!selectedType) {
      toast.error("Please select a report type");
      return;
    }
    if (!startDate || !endDate) {
      toast.error("Please select a date range");
      return;
    }

    const selectedTypeInfo = reportTypes?.find((t) => t.type === selectedType);
    if (selectedTypeInfo?.requiresTeam && !selectedTeam) {
      toast.error("This report requires a team selection");
      return;
    }

    generateMutation.mutate({
      type: selectedType as any,
      teamId: selectedTeam ? parseInt(selectedTeam) : undefined,
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate).toISOString(),
      includeCharts,
      includeAIAnalysis: includeAI,
    });
  };

  const handleDownload = () => {
    if (!generatedReport) return;

    const blob = new Blob([generatedReport.htmlContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${generatedReport.title.replace(/\s+/g, "_")}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Report downloaded");
  };

  const handlePrint = () => {
    if (!generatedReport) return;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(generatedReport.htmlContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "team_analytics":
        return <Users className="h-5 w-5" />;
      case "audit_summary":
        return <FileText className="h-5 w-5" />;
      case "security_report":
        return <Shield className="h-5 w-5" />;
      case "deployment_report":
        return <Rocket className="h-5 w-5" />;
      case "activity_report":
        return <Activity className="h-5 w-5" />;
      default:
        return <FileText className="h-5 w-5" />;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Reports</h1>
            <p className="text-muted-foreground mt-1">
              Generate PDF reports with charts and AI analysis
            </p>
          </div>
          {generatedReport && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={handlePrint}>
                <Eye className="h-4 w-4 mr-2" />
                Preview & Print
              </Button>
              <Button onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                Download HTML
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Report Configuration */}
          <div className="lg:col-span-1 space-y-6">
            {/* Report Type Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Report Type
                </CardTitle>
                <CardDescription>Select the type of report to generate</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {reportTypes?.map((type) => (
                  <div
                    key={type.type}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      selectedType === type.type
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                    onClick={() => setSelectedType(type.type)}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`p-2 rounded-lg ${
                          selectedType === type.type ? "bg-primary text-primary-foreground" : "bg-muted"
                        }`}
                      >
                        {getTypeIcon(type.type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{type.name}</span>
                          {type.requiresTeam && (
                            <Badge variant="outline" className="text-xs">
                              Team Required
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{type.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Date Range */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Date Range
                </CardTitle>
                <CardDescription>Select the time period for the report</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Quick Select</Label>
                  <Select value={selectedPreset} onValueChange={handlePresetSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a preset..." />
                    </SelectTrigger>
                    <SelectContent>
                      {presets?.map((preset) => (
                        <SelectItem key={preset.name} value={preset.name}>
                          {preset.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Start Date</Label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full mt-1 px-3 py-2 border rounded-md bg-background"
                    />
                  </div>
                  <div>
                    <Label>End Date</Label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full mt-1 px-3 py-2 border rounded-md bg-background"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Options */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Options
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {reportTypes?.find((t) => t.type === selectedType)?.requiresTeam && (
                  <div>
                    <Label>Team</Label>
                    <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a team..." />
                      </SelectTrigger>
                      <SelectContent>
                        {teams?.map((team: { id: number; name: string }) => (
                          <SelectItem key={team.id} value={team.id.toString()}>
                            {team.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Include Charts</Label>
                    <p className="text-xs text-muted-foreground">Add visual charts to the report</p>
                  </div>
                  <Switch checked={includeCharts} onCheckedChange={setIncludeCharts} />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="flex items-center gap-2">
                      AI Analysis
                      <Sparkles className="h-3 w-3 text-yellow-500" />
                    </Label>
                    <p className="text-xs text-muted-foreground">Include AI-powered insights</p>
                  </div>
                  <Switch checked={includeAI} onCheckedChange={setIncludeAI} />
                </div>

                <Button
                  className="w-full"
                  onClick={handleGenerate}
                  disabled={generateMutation.isPending}
                >
                  {generateMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <FileDown className="h-4 w-4 mr-2" />
                      Generate Report
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Report Preview */}
          <div className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Report Preview
                </CardTitle>
                {generatedReport && (
                  <CardDescription className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Generated at {new Date().toLocaleString()}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                {generatedReport ? (
                  <Tabs defaultValue="preview" className="w-full">
                    <TabsList className="mb-4">
                      <TabsTrigger value="preview">Preview</TabsTrigger>
                      <TabsTrigger value="summary">Summary</TabsTrigger>
                      {generatedReport.aiAnalysis && <TabsTrigger value="ai">AI Analysis</TabsTrigger>}
                    </TabsList>

                    <TabsContent value="preview">
                      <div className="border rounded-lg overflow-hidden bg-white">
                        <iframe
                          srcDoc={generatedReport.htmlContent}
                          className="w-full h-[600px]"
                          title="Report Preview"
                        />
                      </div>
                    </TabsContent>

                    <TabsContent value="summary">
                      <div className="p-6 bg-muted/50 rounded-lg">
                        <h3 className="font-semibold text-lg mb-4">{generatedReport.title}</h3>
                        <p className="text-muted-foreground">{generatedReport.summary}</p>
                      </div>
                    </TabsContent>

                    {generatedReport.aiAnalysis && (
                      <TabsContent value="ai">
                        <div className="p-6 bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-lg border border-purple-500/20">
                          <div className="flex items-center gap-2 mb-4">
                            <Sparkles className="h-5 w-5 text-purple-500" />
                            <h3 className="font-semibold text-lg">AI Analysis & Recommendations</h3>
                          </div>
                          <p className="text-muted-foreground whitespace-pre-wrap">
                            {generatedReport.aiAnalysis}
                          </p>
                        </div>
                      </TabsContent>
                    )}
                  </Tabs>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[500px] text-muted-foreground">
                    <FileText className="h-16 w-16 mb-4 opacity-20" />
                    <p className="text-lg font-medium">No Report Generated</p>
                    <p className="text-sm">Select a report type and date range, then click Generate</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
