/**
 * AI Security Guardian Router (DevSecOps)
 * 
 * Provides continuous security monitoring, vulnerability scanning,
 * and automated remediation with compliance tracking.
 */

import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";

// Types
interface SecurityScan {
  id: number;
  scanType: "container" | "kubernetes" | "secrets" | "compliance" | "dependencies";
  target: string;
  status: "queued" | "running" | "completed" | "failed";
  findingsCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  findings: Vulnerability[];
  startedAt: Date;
  completedAt?: Date;
}

interface Vulnerability {
  id: number;
  cveId?: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  description: string;
  affectedPackage?: string;
  installedVersion?: string;
  fixedVersion?: string;
  remediation?: string;
  status: "open" | "acknowledged" | "fixed" | "ignored";
}

interface SecurityPolicy {
  id: number;
  name: string;
  description: string;
  policyType: string;
  rules: PolicyRule[];
  enabled: boolean;
  enforcementLevel: "audit" | "warn" | "block";
}

interface PolicyRule {
  id: string;
  condition: string;
  action: string;
  message: string;
}

interface ComplianceReport {
  id: number;
  framework: string;
  status: "compliant" | "non_compliant" | "partial";
  score: number;
  totalControls: number;
  passedControls: number;
  failedControls: number;
  findings: ComplianceFinding[];
  generatedAt: Date;
}

interface ComplianceFinding {
  controlId: string;
  controlName: string;
  status: "pass" | "fail" | "not_applicable";
  evidence?: string;
  remediation?: string;
}

// In-memory storage
const scans: Map<number, SecurityScan> = new Map();
const policies: Map<number, SecurityPolicy> = new Map();
const complianceReports: Map<number, ComplianceReport> = new Map();
let scanIdCounter = 1;
let policyIdCounter = 1;
let reportIdCounter = 1;

// Initialize default policies
const initializePolicies = () => {
  const defaultPolicies: Omit<SecurityPolicy, "id">[] = [
    {
      name: "No Root Containers",
      description: "Prevent containers from running as root user",
      policyType: "container",
      rules: [
        { id: "no-root-1", condition: "container.user == 'root'", action: "block", message: "Container must not run as root" }
      ],
      enabled: true,
      enforcementLevel: "warn"
    },
    {
      name: "No Privileged Containers",
      description: "Prevent privileged container execution",
      policyType: "container",
      rules: [
        { id: "no-priv-1", condition: "container.privileged == true", action: "block", message: "Privileged containers are not allowed" }
      ],
      enabled: true,
      enforcementLevel: "block"
    },
    {
      name: "Image Registry Whitelist",
      description: "Only allow images from approved registries",
      policyType: "image",
      rules: [
        { id: "registry-1", condition: "image.registry not in ['docker.io', 'gcr.io', 'ghcr.io']", action: "warn", message: "Image from unapproved registry" }
      ],
      enabled: true,
      enforcementLevel: "warn"
    },
    {
      name: "Resource Limits Required",
      description: "Ensure all pods have resource limits defined",
      policyType: "kubernetes",
      rules: [
        { id: "limits-1", condition: "pod.resources.limits == null", action: "warn", message: "Pod must have resource limits" }
      ],
      enabled: true,
      enforcementLevel: "audit"
    },
    {
      name: "No Latest Tag",
      description: "Prevent use of 'latest' tag for container images",
      policyType: "image",
      rules: [
        { id: "no-latest-1", condition: "image.tag == 'latest'", action: "warn", message: "Use specific version tags instead of 'latest'" }
      ],
      enabled: true,
      enforcementLevel: "warn"
    }
  ];

  defaultPolicies.forEach(p => {
    const id = policyIdCounter++;
    policies.set(id, { ...p, id });
  });
};

initializePolicies();

// Sample vulnerability database
const sampleVulnerabilities: Omit<Vulnerability, "id" | "status">[] = [
  {
    cveId: "CVE-2024-1234",
    severity: "critical",
    title: "Remote Code Execution in OpenSSL",
    description: "A buffer overflow vulnerability in OpenSSL allows remote attackers to execute arbitrary code.",
    affectedPackage: "openssl",
    installedVersion: "1.1.1k",
    fixedVersion: "1.1.1l",
    remediation: "Upgrade OpenSSL to version 1.1.1l or later"
  },
  {
    cveId: "CVE-2024-5678",
    severity: "high",
    title: "SQL Injection in PostgreSQL Driver",
    description: "Improper input validation allows SQL injection attacks.",
    affectedPackage: "pg",
    installedVersion: "8.7.1",
    fixedVersion: "8.7.3",
    remediation: "Upgrade pg package to version 8.7.3 or later"
  },
  {
    cveId: "CVE-2024-9012",
    severity: "medium",
    title: "Cross-Site Scripting in React",
    description: "XSS vulnerability in dangerouslySetInnerHTML usage.",
    affectedPackage: "react",
    installedVersion: "18.2.0",
    fixedVersion: "18.2.1",
    remediation: "Upgrade React and sanitize user input"
  },
  {
    cveId: "CVE-2024-3456",
    severity: "low",
    title: "Information Disclosure in Node.js",
    description: "Debug information exposed in error messages.",
    affectedPackage: "node",
    installedVersion: "18.0.0",
    fixedVersion: "18.1.0",
    remediation: "Disable debug mode in production"
  }
];

// AI Analysis Functions
async function analyzeSecurityFindings(findings: Vulnerability[]): Promise<string> {
  try {
    const summary = findings.map(f => 
      `- [${f.severity.toUpperCase()}] ${f.cveId || 'N/A'}: ${f.title} in ${f.affectedPackage}`
    ).join("\n");

    const prompt = `Analyze these security vulnerabilities and provide prioritized remediation plan:

${summary}

Provide:
1. Risk assessment summary
2. Prioritized remediation order
3. Quick wins vs long-term fixes
4. Potential attack vectors if not fixed`;

    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are a security expert specializing in DevSecOps and vulnerability management." },
        { role: "user", content: prompt }
      ]
    });

    return response.choices[0]?.message?.content || "Unable to analyze findings";
  } catch (error) {
    console.error("Security analysis error:", error);
    return "AI analysis unavailable";
  }
}

async function generateComplianceReport(framework: string): Promise<ComplianceReport> {
  // Simulate compliance check based on framework
  const controls: Record<string, { id: string; name: string }[]> = {
    "SOC2": [
      { id: "CC6.1", name: "Logical and Physical Access Controls" },
      { id: "CC6.2", name: "System Operations" },
      { id: "CC6.3", name: "Change Management" },
      { id: "CC7.1", name: "System Monitoring" },
      { id: "CC7.2", name: "Incident Response" }
    ],
    "HIPAA": [
      { id: "164.308", name: "Administrative Safeguards" },
      { id: "164.310", name: "Physical Safeguards" },
      { id: "164.312", name: "Technical Safeguards" },
      { id: "164.314", name: "Organizational Requirements" }
    ],
    "PCI-DSS": [
      { id: "1.1", name: "Install and maintain firewall" },
      { id: "2.1", name: "Change vendor defaults" },
      { id: "3.1", name: "Protect stored cardholder data" },
      { id: "6.1", name: "Develop secure systems" },
      { id: "10.1", name: "Track access to network resources" }
    ]
  };

  const frameworkControls = controls[framework] || controls["SOC2"];
  const findings: ComplianceFinding[] = frameworkControls.map(c => ({
    controlId: c.id,
    controlName: c.name,
    status: Math.random() > 0.3 ? "pass" : "fail" as "pass" | "fail",
    evidence: "Automated scan results",
    remediation: "Review and update configuration"
  }));

  const passed = findings.filter(f => f.status === "pass").length;
  const failed = findings.filter(f => f.status === "fail").length;
  const score = Math.round((passed / findings.length) * 100);

  return {
    id: reportIdCounter++,
    framework,
    status: score >= 90 ? "compliant" : score >= 70 ? "partial" : "non_compliant",
    score,
    totalControls: findings.length,
    passedControls: passed,
    failedControls: failed,
    findings,
    generatedAt: new Date()
  };
}

// Router
export const securityGuardianRouter = router({
  // Initiate security scan
  scan: publicProcedure
    .input(z.object({
      scanType: z.enum(["container", "kubernetes", "secrets", "compliance", "dependencies"]),
      target: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      const id = scanIdCounter++;
      
      const scan: SecurityScan = {
        id,
        scanType: input.scanType,
        target: input.target,
        status: "running",
        findingsCount: 0,
        criticalCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
        findings: [],
        startedAt: new Date(),
      };
      
      scans.set(id, scan);
      
      // Simulate scan execution
      setTimeout(async () => {
        // Generate random findings based on sample vulnerabilities
        const numFindings = Math.floor(Math.random() * 5) + 1;
        const findings: Vulnerability[] = [];
        
        for (let i = 0; i < numFindings; i++) {
          const sample = sampleVulnerabilities[Math.floor(Math.random() * sampleVulnerabilities.length)];
          findings.push({
            ...sample,
            id: i + 1,
            status: "open"
          });
        }
        
        scan.findings = findings;
        scan.findingsCount = findings.length;
        scan.criticalCount = findings.filter(f => f.severity === "critical").length;
        scan.highCount = findings.filter(f => f.severity === "high").length;
        scan.mediumCount = findings.filter(f => f.severity === "medium").length;
        scan.lowCount = findings.filter(f => f.severity === "low").length;
        scan.status = "completed";
        scan.completedAt = new Date();
      }, 3000);
      
      return scan;
    }),

  // Get scan results
  getScan: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => {
      const scan = scans.get(input.id);
      if (!scan) throw new Error("Scan not found");
      return scan;
    }),

  // List all scans
  listScans: publicProcedure
    .input(z.object({
      scanType: z.enum(["container", "kubernetes", "secrets", "compliance", "dependencies", "all"]).optional(),
      status: z.enum(["queued", "running", "completed", "failed", "all"]).optional(),
      limit: z.number().min(1).max(100).optional().default(20),
    }).optional())
    .query(({ input }) => {
      let result = Array.from(scans.values());
      
      if (input?.scanType && input.scanType !== "all") {
        result = result.filter(s => s.scanType === input.scanType);
      }
      if (input?.status && input.status !== "all") {
        result = result.filter(s => s.status === input.status);
      }
      
      return result
        .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
        .slice(0, input?.limit || 20);
    }),

  // Get all vulnerabilities
  getVulnerabilities: publicProcedure
    .input(z.object({
      severity: z.enum(["critical", "high", "medium", "low", "info", "all"]).optional(),
      status: z.enum(["open", "acknowledged", "fixed", "ignored", "all"]).optional(),
    }).optional())
    .query(({ input }) => {
      const allVulns: Vulnerability[] = [];
      
      for (const scan of scans.values()) {
        if (scan.status === "completed") {
          allVulns.push(...scan.findings);
        }
      }
      
      let result = allVulns;
      
      if (input?.severity && input.severity !== "all") {
        result = result.filter(v => v.severity === input.severity);
      }
      if (input?.status && input.status !== "all") {
        result = result.filter(v => v.status === input.status);
      }
      
      return result;
    }),

  // Update vulnerability status
  updateVulnerabilityStatus: publicProcedure
    .input(z.object({
      scanId: z.number(),
      vulnerabilityId: z.number(),
      status: z.enum(["open", "acknowledged", "fixed", "ignored"]),
    }))
    .mutation(({ input }) => {
      const scan = scans.get(input.scanId);
      if (!scan) throw new Error("Scan not found");
      
      const vuln = scan.findings.find(f => f.id === input.vulnerabilityId);
      if (!vuln) throw new Error("Vulnerability not found");
      
      vuln.status = input.status;
      return vuln;
    }),

  // Get AI analysis of findings
  analyzeFindings: publicProcedure
    .input(z.object({ scanId: z.number() }))
    .mutation(async ({ input }) => {
      const scan = scans.get(input.scanId);
      if (!scan) throw new Error("Scan not found");
      if (scan.status !== "completed") throw new Error("Scan not completed");
      
      const analysis = await analyzeSecurityFindings(scan.findings);
      return { scanId: input.scanId, analysis };
    }),

  // List security policies
  listPolicies: publicProcedure.query(() => {
    return Array.from(policies.values());
  }),

  // Get single policy
  getPolicy: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => {
      const policy = policies.get(input.id);
      if (!policy) throw new Error("Policy not found");
      return policy;
    }),

  // Create policy
  createPolicy: publicProcedure
    .input(z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      policyType: z.string(),
      rules: z.array(z.object({
        id: z.string(),
        condition: z.string(),
        action: z.string(),
        message: z.string(),
      })),
      enforcementLevel: z.enum(["audit", "warn", "block"]).optional(),
    }))
    .mutation(({ input }) => {
      const id = policyIdCounter++;
      const policy: SecurityPolicy = {
        id,
        name: input.name,
        description: input.description || "",
        policyType: input.policyType,
        rules: input.rules,
        enabled: true,
        enforcementLevel: input.enforcementLevel || "warn",
      };
      
      policies.set(id, policy);
      return policy;
    }),

  // Toggle policy
  togglePolicy: publicProcedure
    .input(z.object({
      id: z.number(),
      enabled: z.boolean(),
    }))
    .mutation(({ input }) => {
      const policy = policies.get(input.id);
      if (!policy) throw new Error("Policy not found");
      
      policy.enabled = input.enabled;
      return policy;
    }),

  // Check compliance
  checkCompliance: publicProcedure
    .input(z.object({
      framework: z.enum(["SOC2", "HIPAA", "PCI-DSS"]),
    }))
    .mutation(async ({ input }) => {
      const report = await generateComplianceReport(input.framework);
      complianceReports.set(report.id, report);
      return report;
    }),

  // List compliance reports
  listComplianceReports: publicProcedure.query(() => {
    return Array.from(complianceReports.values())
      .sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime());
  }),

  // Get security dashboard stats
  getStats: publicProcedure.query(() => {
    const allScans = Array.from(scans.values());
    const completedScans = allScans.filter(s => s.status === "completed");
    
    const totalVulns = completedScans.reduce((sum, s) => sum + s.findingsCount, 0);
    const criticalVulns = completedScans.reduce((sum, s) => sum + s.criticalCount, 0);
    const highVulns = completedScans.reduce((sum, s) => sum + s.highCount, 0);
    
    const openVulns = completedScans.reduce((sum, s) => 
      sum + s.findings.filter(f => f.status === "open").length, 0);
    
    return {
      totalScans: allScans.length,
      completedScans: completedScans.length,
      runningScans: allScans.filter(s => s.status === "running").length,
      totalVulnerabilities: totalVulns,
      criticalVulnerabilities: criticalVulns,
      highVulnerabilities: highVulns,
      openVulnerabilities: openVulns,
      activePolicies: Array.from(policies.values()).filter(p => p.enabled).length,
      totalPolicies: policies.size,
      complianceReportsCount: complianceReports.size,
    };
  }),
});
