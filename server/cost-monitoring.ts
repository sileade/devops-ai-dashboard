/**
 * Cloud Cost Monitoring Service
 * 
 * Provides integration with AWS Cost Explorer, GCP Billing API,
 * and Azure Cost Management for unified cost tracking and analysis.
 */

import { z } from 'zod';

// Cost Data Schemas
export const CloudProviderSchema = z.enum(['aws', 'gcp', 'azure']);
export type CloudProvider = z.infer<typeof CloudProviderSchema>;

export const CostGranularitySchema = z.enum(['daily', 'monthly', 'hourly']);
export type CostGranularity = z.infer<typeof CostGranularitySchema>;

export const CostMetricSchema = z.object({
  amount: z.number(),
  currency: z.string(),
  unit: z.string().optional(),
});

export const CostBreakdownItemSchema = z.object({
  name: z.string(),
  cost: z.number(),
  percentage: z.number(),
  trend: z.enum(['up', 'down', 'stable']).optional(),
  trendPercentage: z.number().optional(),
});

export const DailyCostSchema = z.object({
  date: z.string(),
  cost: z.number(),
  forecast: z.number().optional(),
});

export const CostSummarySchema = z.object({
  provider: CloudProviderSchema,
  period: z.object({
    start: z.string(),
    end: z.string(),
  }),
  totalCost: CostMetricSchema,
  previousPeriodCost: CostMetricSchema.optional(),
  forecast: CostMetricSchema.optional(),
  budget: z.object({
    limit: z.number(),
    used: z.number(),
    remaining: z.number(),
    percentUsed: z.number(),
  }).optional(),
  byService: z.array(CostBreakdownItemSchema),
  byRegion: z.array(CostBreakdownItemSchema).optional(),
  byTag: z.array(CostBreakdownItemSchema).optional(),
  dailyCosts: z.array(DailyCostSchema),
});

export type CostSummary = z.infer<typeof CostSummarySchema>;
export type CostBreakdownItem = z.infer<typeof CostBreakdownItemSchema>;
export type DailyCost = z.infer<typeof DailyCostSchema>;

// Cost Alert Schemas
export const CostAlertTypeSchema = z.enum([
  'budget_threshold',
  'anomaly_detected',
  'forecast_exceeded',
  'cost_spike',
]);

export const CostAlertSchema = z.object({
  id: z.string(),
  type: CostAlertTypeSchema,
  provider: CloudProviderSchema,
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  title: z.string(),
  message: z.string(),
  threshold: z.number().optional(),
  currentValue: z.number().optional(),
  createdAt: z.string(),
  acknowledged: z.boolean(),
});

export type CostAlert = z.infer<typeof CostAlertSchema>;

// Provider Configuration
export interface AWSCostConfig {
  accessKeyId: string;
  secretAccessKey: string;
  region?: string;
}

export interface GCPCostConfig {
  projectId: string;
  credentials: string; // JSON key file content
}

export interface AzureCostConfig {
  subscriptionId: string;
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

export type CloudCostConfig = {
  aws?: AWSCostConfig;
  gcp?: GCPCostConfig;
  azure?: AzureCostConfig;
};

/**
 * AWS Cost Explorer Client
 */
export class AWSCostClient {
  private config: AWSCostConfig;

  constructor(config: AWSCostConfig) {
    this.config = config;
  }

  async getCostAndUsage(
    startDate: string,
    endDate: string,
    granularity: CostGranularity = 'daily'
  ): Promise<CostSummary> {
    // In production, use AWS SDK
    // const client = new CostExplorerClient({ region: this.config.region });
    // const command = new GetCostAndUsageCommand({...});
    
    // Mock implementation for demo
    return this.getMockCostData('aws', startDate, endDate, granularity);
  }

  async getCostForecast(
    startDate: string,
    endDate: string
  ): Promise<{ amount: number; currency: string }> {
    // Mock forecast
    return { amount: 15000, currency: 'USD' };
  }

  private getMockCostData(
    provider: CloudProvider,
    startDate: string,
    endDate: string,
    _granularity: CostGranularity
  ): CostSummary {
    return generateMockCostSummary(provider, startDate, endDate);
  }
}

/**
 * GCP Billing Client
 */
export class GCPCostClient {
  private config: GCPCostConfig;

  constructor(config: GCPCostConfig) {
    this.config = config;
  }

  async getBillingData(
    startDate: string,
    endDate: string,
    granularity: CostGranularity = 'daily'
  ): Promise<CostSummary> {
    // In production, use Google Cloud Billing API
    // const billing = google.cloudbilling('v1');
    
    return generateMockCostSummary('gcp', startDate, endDate);
  }

  async getBudgets(): Promise<Array<{ name: string; amount: number; spent: number }>> {
    return [
      { name: 'Production Budget', amount: 10000, spent: 7500 },
      { name: 'Development Budget', amount: 5000, spent: 3200 },
    ];
  }
}

/**
 * Azure Cost Management Client
 */
export class AzureCostClient {
  private config: AzureCostConfig;

  constructor(config: AzureCostConfig) {
    this.config = config;
  }

  async getCostData(
    startDate: string,
    endDate: string,
    granularity: CostGranularity = 'daily'
  ): Promise<CostSummary> {
    // In production, use Azure Cost Management API
    // const client = new CostManagementClient(credential, subscriptionId);
    
    return generateMockCostSummary('azure', startDate, endDate);
  }

  async getBudgets(): Promise<Array<{ name: string; amount: number; spent: number }>> {
    return [
      { name: 'Azure Production', amount: 8000, spent: 6100 },
    ];
  }
}

/**
 * Unified Cost Monitoring Service
 */
export class CostMonitoringService {
  private awsClient?: AWSCostClient;
  private gcpClient?: GCPCostClient;
  private azureClient?: AzureCostClient;

  constructor(config: CloudCostConfig) {
    if (config.aws) {
      this.awsClient = new AWSCostClient(config.aws);
    }
    if (config.gcp) {
      this.gcpClient = new GCPCostClient(config.gcp);
    }
    if (config.azure) {
      this.azureClient = new AzureCostClient(config.azure);
    }
  }

  async getAllCosts(
    startDate: string,
    endDate: string,
    granularity: CostGranularity = 'daily'
  ): Promise<CostSummary[]> {
    const results: CostSummary[] = [];

    if (this.awsClient) {
      results.push(await this.awsClient.getCostAndUsage(startDate, endDate, granularity));
    }
    if (this.gcpClient) {
      results.push(await this.gcpClient.getBillingData(startDate, endDate, granularity));
    }
    if (this.azureClient) {
      results.push(await this.azureClient.getCostData(startDate, endDate, granularity));
    }

    return results;
  }

  async getTotalCost(startDate: string, endDate: string): Promise<{
    total: number;
    currency: string;
    byProvider: Array<{ provider: CloudProvider; cost: number }>;
  }> {
    const costs = await this.getAllCosts(startDate, endDate);
    
    const byProvider = costs.map(c => ({
      provider: c.provider,
      cost: c.totalCost.amount,
    }));

    return {
      total: byProvider.reduce((sum, p) => sum + p.cost, 0),
      currency: 'USD',
      byProvider,
    };
  }

  async getAlerts(): Promise<CostAlert[]> {
    // In production, check budgets and anomalies
    return getMockCostAlerts();
  }
}

/**
 * Generate mock cost summary for demo
 */
function generateMockCostSummary(
  provider: CloudProvider,
  startDate: string,
  endDate: string
): CostSummary {
  const providerData: Record<CloudProvider, {
    totalCost: number;
    services: Array<{ name: string; cost: number }>;
  }> = {
    aws: {
      totalCost: 12450.67,
      services: [
        { name: 'Amazon EC2', cost: 4500.23 },
        { name: 'Amazon RDS', cost: 2800.45 },
        { name: 'Amazon S3', cost: 1200.00 },
        { name: 'AWS Lambda', cost: 890.50 },
        { name: 'Amazon CloudFront', cost: 650.00 },
        { name: 'Amazon EKS', cost: 1500.00 },
        { name: 'Other', cost: 909.49 },
      ],
    },
    gcp: {
      totalCost: 8320.45,
      services: [
        { name: 'Compute Engine', cost: 3200.00 },
        { name: 'Cloud SQL', cost: 1800.00 },
        { name: 'Cloud Storage', cost: 950.00 },
        { name: 'BigQuery', cost: 1200.00 },
        { name: 'Cloud Run', cost: 520.45 },
        { name: 'Other', cost: 650.00 },
      ],
    },
    azure: {
      totalCost: 6890.23,
      services: [
        { name: 'Virtual Machines', cost: 2800.00 },
        { name: 'Azure SQL Database', cost: 1500.00 },
        { name: 'Storage Accounts', cost: 800.00 },
        { name: 'Azure Kubernetes Service', cost: 1200.00 },
        { name: 'App Service', cost: 390.23 },
        { name: 'Other', cost: 200.00 },
      ],
    },
  };

  const data = providerData[provider];
  const totalCost = data.totalCost;
  
  // Generate daily costs
  const start = new Date(startDate);
  const end = new Date(endDate);
  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const dailyAvg = totalCost / days;
  
  const dailyCosts: DailyCost[] = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(start);
    date.setDate(date.getDate() + i);
    const variation = (Math.random() - 0.5) * 0.3; // ±15% variation
    dailyCosts.push({
      date: date.toISOString().split('T')[0],
      cost: Math.round((dailyAvg * (1 + variation)) * 100) / 100,
      forecast: i > days - 7 ? Math.round((dailyAvg * 1.05) * 100) / 100 : undefined,
    });
  }

  // Calculate service breakdown with percentages
  const byService: CostBreakdownItem[] = data.services.map(s => ({
    name: s.name,
    cost: s.cost,
    percentage: Math.round((s.cost / totalCost) * 1000) / 10,
    trend: Math.random() > 0.5 ? 'up' : 'down',
    trendPercentage: Math.round(Math.random() * 20),
  }));

  return {
    provider,
    period: { start: startDate, end: endDate },
    totalCost: { amount: totalCost, currency: 'USD' },
    previousPeriodCost: { amount: totalCost * 0.92, currency: 'USD' },
    forecast: { amount: totalCost * 1.08, currency: 'USD' },
    budget: {
      limit: 15000,
      used: totalCost,
      remaining: 15000 - totalCost,
      percentUsed: Math.round((totalCost / 15000) * 100),
    },
    byService,
    byRegion: [
      { name: 'us-east-1', cost: totalCost * 0.45, percentage: 45 },
      { name: 'us-west-2', cost: totalCost * 0.30, percentage: 30 },
      { name: 'eu-west-1', cost: totalCost * 0.25, percentage: 25 },
    ],
    dailyCosts,
  };
}

/**
 * Get mock cost alerts
 */
function getMockCostAlerts(): CostAlert[] {
  return [
    {
      id: 'alert-1',
      type: 'budget_threshold',
      provider: 'aws',
      severity: 'high',
      title: 'AWS Budget 80% Threshold Reached',
      message: 'Your AWS spending has reached 83% of the monthly budget ($12,450 of $15,000).',
      threshold: 80,
      currentValue: 83,
      createdAt: new Date().toISOString(),
      acknowledged: false,
    },
    {
      id: 'alert-2',
      type: 'cost_spike',
      provider: 'gcp',
      severity: 'medium',
      title: 'GCP Compute Engine Cost Spike',
      message: 'Compute Engine costs increased by 35% compared to the previous week.',
      currentValue: 35,
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      acknowledged: false,
    },
    {
      id: 'alert-3',
      type: 'anomaly_detected',
      provider: 'azure',
      severity: 'low',
      title: 'Unusual Storage Activity Detected',
      message: 'Azure Storage costs show unusual pattern - 20% higher than predicted.',
      currentValue: 20,
      createdAt: new Date(Date.now() - 7200000).toISOString(),
      acknowledged: true,
    },
  ];
}

/**
 * AI-powered cost analysis and recommendations
 */
export interface CostRecommendation {
  id: string;
  provider: CloudProvider;
  category: 'rightsizing' | 'reserved_instances' | 'unused_resources' | 'optimization';
  title: string;
  description: string;
  potentialSavings: number;
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
}

export function getMockCostRecommendations(): CostRecommendation[] {
  return [
    {
      id: 'rec-1',
      provider: 'aws',
      category: 'rightsizing',
      title: 'Rightsize EC2 Instances',
      description: 'Analysis shows 5 EC2 instances are consistently underutilized (<20% CPU). Consider downsizing from m5.xlarge to m5.large.',
      potentialSavings: 450,
      effort: 'low',
      impact: 'medium',
    },
    {
      id: 'rec-2',
      provider: 'aws',
      category: 'reserved_instances',
      title: 'Purchase Reserved Instances',
      description: 'Based on usage patterns, purchasing 1-year reserved instances for 3 production EC2 instances could save 40%.',
      potentialSavings: 1800,
      effort: 'medium',
      impact: 'high',
    },
    {
      id: 'rec-3',
      provider: 'gcp',
      category: 'unused_resources',
      title: 'Delete Unused Persistent Disks',
      description: 'Found 8 unattached persistent disks totaling 2TB. Consider deleting if no longer needed.',
      potentialSavings: 160,
      effort: 'low',
      impact: 'low',
    },
    {
      id: 'rec-4',
      provider: 'azure',
      category: 'optimization',
      title: 'Enable Auto-Shutdown for Dev VMs',
      description: 'Development VMs run 24/7 but are only used during business hours. Enable auto-shutdown to save costs.',
      potentialSavings: 320,
      effort: 'low',
      impact: 'medium',
    },
  ];
}

export default {
  CostMonitoringService,
  AWSCostClient,
  GCPCostClient,
  AzureCostClient,
  getMockCostAlerts,
  getMockCostRecommendations,
};
