/**
 * Terraform State Parser and Visualization Service
 * 
 * Parses Terraform state files and generates graph data for D3.js visualization.
 */

import { z } from 'zod';

// Terraform State Schemas
export const TerraformResourceSchema = z.object({
  mode: z.enum(['managed', 'data']),
  type: z.string(),
  name: z.string(),
  provider: z.string(),
  instances: z.array(z.object({
    attributes: z.record(z.string(), z.any()).optional(),
    dependencies: z.array(z.string()).optional(),
    private: z.string().optional(),
  })).optional(),
});

export const TerraformStateSchema = z.object({
  version: z.number(),
  terraform_version: z.string().optional(),
  serial: z.number().optional(),
  lineage: z.string().optional(),
  outputs: z.record(z.string(), z.object({
    value: z.any(),
    type: z.any(),
    sensitive: z.boolean().optional(),
  })).optional(),
  resources: z.array(TerraformResourceSchema).optional(),
});

export type TerraformState = z.infer<typeof TerraformStateSchema>;
export type TerraformResource = z.infer<typeof TerraformResourceSchema>;

// Graph Node for visualization
export interface GraphNode {
  id: string;
  label: string;
  type: string;
  provider: string;
  mode: 'managed' | 'data';
  attributes: Record<string, any>;
  group: string;
}

// Graph Link for visualization
export interface GraphLink {
  source: string;
  target: string;
  type: 'dependency' | 'reference';
}

// Graph data for D3.js
export interface TerraformGraph {
  nodes: GraphNode[];
  links: GraphLink[];
  metadata: {
    version: number;
    terraformVersion?: string;
    serial?: number;
    resourceCount: number;
    providerCount: number;
  };
}

// Resource type icons mapping
export const RESOURCE_ICONS: Record<string, string> = {
  // AWS
  'aws_instance': '🖥️',
  'aws_vpc': '🌐',
  'aws_subnet': '📡',
  'aws_security_group': '🔒',
  'aws_s3_bucket': '🪣',
  'aws_rds_instance': '🗄️',
  'aws_lambda_function': 'λ',
  'aws_iam_role': '👤',
  'aws_iam_policy': '📜',
  'aws_route53_zone': '🌍',
  'aws_cloudfront_distribution': '☁️',
  'aws_elasticache_cluster': '⚡',
  'aws_eks_cluster': '☸️',
  'aws_ecs_cluster': '🐳',
  'aws_alb': '⚖️',
  'aws_autoscaling_group': '📈',
  
  // GCP
  'google_compute_instance': '🖥️',
  'google_compute_network': '🌐',
  'google_storage_bucket': '🪣',
  'google_sql_database_instance': '🗄️',
  'google_container_cluster': '☸️',
  'google_cloud_run_service': '🏃',
  
  // Azure
  'azurerm_virtual_machine': '🖥️',
  'azurerm_virtual_network': '🌐',
  'azurerm_storage_account': '🪣',
  'azurerm_sql_database': '🗄️',
  'azurerm_kubernetes_cluster': '☸️',
  'azurerm_app_service': '🌐',
  
  // Kubernetes
  'kubernetes_deployment': '🚀',
  'kubernetes_service': '🔌',
  'kubernetes_namespace': '📁',
  'kubernetes_config_map': '⚙️',
  'kubernetes_secret': '🔐',
  'kubernetes_ingress': '🚪',
  'kubernetes_persistent_volume_claim': '💾',
  
  // Docker
  'docker_container': '🐳',
  'docker_image': '📦',
  'docker_network': '🌐',
  'docker_volume': '💾',
  
  // Default
  'default': '📦',
};

// Provider colors for grouping
export const PROVIDER_COLORS: Record<string, string> = {
  'aws': '#FF9900',
  'google': '#4285F4',
  'azurerm': '#0078D4',
  'kubernetes': '#326CE5',
  'docker': '#2496ED',
  'helm': '#0F1689',
  'null': '#6B7280',
  'random': '#10B981',
  'local': '#8B5CF6',
  'tls': '#EF4444',
  'default': '#6B7280',
};

/**
 * Parse Terraform state JSON and extract resources
 */
export function parseTerraformState(stateJson: string): TerraformState {
  try {
    const parsed = JSON.parse(stateJson);
    return TerraformStateSchema.parse(parsed);
  } catch (error) {
    throw new Error(`Failed to parse Terraform state: ${error}`);
  }
}

/**
 * Get resource identifier from resource
 */
function getResourceId(resource: TerraformResource): string {
  return `${resource.type}.${resource.name}`;
}

/**
 * Extract provider name from provider string
 */
function extractProviderName(provider: string): string {
  // provider format: provider["registry.terraform.io/hashicorp/aws"]
  const match = provider.match(/provider\["[^"]*\/([^"]+)"\]/);
  return match ? match[1] : provider.replace('provider["', '').replace('"]', '');
}

/**
 * Get icon for resource type
 */
export function getResourceIcon(resourceType: string): string {
  return RESOURCE_ICONS[resourceType] || RESOURCE_ICONS['default'];
}

/**
 * Get color for provider
 */
export function getProviderColor(provider: string): string {
  const providerName = extractProviderName(provider);
  return PROVIDER_COLORS[providerName] || PROVIDER_COLORS['default'];
}

/**
 * Convert Terraform state to D3.js graph format
 */
export function stateToGraph(state: TerraformState): TerraformGraph {
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  const providers = new Set<string>();

  if (!state.resources) {
    return {
      nodes: [],
      links: [],
      metadata: {
        version: state.version,
        terraformVersion: state.terraform_version,
        serial: state.serial,
        resourceCount: 0,
        providerCount: 0,
      },
    };
  }

  // Create nodes from resources
  for (const resource of state.resources) {
    const id = getResourceId(resource);
    const providerName = extractProviderName(resource.provider);
    providers.add(providerName);

    const attributes = resource.instances?.[0]?.attributes || {};

    nodes.push({
      id,
      label: resource.name,
      type: resource.type,
      provider: providerName,
      mode: resource.mode,
      attributes,
      group: providerName,
    });

    // Create links from dependencies
    const dependencies = resource.instances?.[0]?.dependencies || [];
    for (const dep of dependencies) {
      links.push({
        source: dep,
        target: id,
        type: 'dependency',
      });
    }
  }

  // Filter out links to non-existent nodes
  const nodeIds = new Set(nodes.map(n => n.id));
  const validLinks = links.filter(l => nodeIds.has(l.source) && nodeIds.has(l.target));

  return {
    nodes,
    links: validLinks,
    metadata: {
      version: state.version,
      terraformVersion: state.terraform_version,
      serial: state.serial,
      resourceCount: nodes.length,
      providerCount: providers.size,
    },
  };
}

/**
 * Compare two Terraform states and generate diff
 */
export interface StateDiff {
  added: GraphNode[];
  removed: GraphNode[];
  modified: Array<{
    id: string;
    before: Record<string, any>;
    after: Record<string, any>;
    changes: string[];
  }>;
}

export function compareStates(oldState: TerraformState, newState: TerraformState): StateDiff {
  const oldGraph = stateToGraph(oldState);
  const newGraph = stateToGraph(newState);

  const oldNodeMap = new Map(oldGraph.nodes.map(n => [n.id, n]));
  const newNodeMap = new Map(newGraph.nodes.map(n => [n.id, n]));

  const added: GraphNode[] = [];
  const removed: GraphNode[] = [];
  const modified: StateDiff['modified'] = [];

  // Find added and modified
  for (const [id, node] of Array.from(newNodeMap.entries())) {
    const oldNode = oldNodeMap.get(id);
    if (!oldNode) {
      added.push(node);
    } else {
      // Check for modifications
      const changes: string[] = [];
      const oldAttrs = oldNode.attributes;
      const newAttrs = node.attributes;

      for (const key of Array.from(new Set([...Object.keys(oldAttrs), ...Object.keys(newAttrs)]))) {
        if (JSON.stringify(oldAttrs[key]) !== JSON.stringify(newAttrs[key])) {
          changes.push(key);
        }
      }

      if (changes.length > 0) {
        modified.push({
          id,
          before: oldAttrs,
          after: newAttrs,
          changes,
        });
      }
    }
  }

  // Find removed
  for (const [id, node] of Array.from(oldNodeMap.entries())) {
    if (!newNodeMap.has(id)) {
      removed.push(node);
    }
  }

  return { added, removed, modified };
}

/**
 * Generate Mermaid diagram from Terraform graph
 */
export function graphToMermaid(graph: TerraformGraph): string {
  const lines: string[] = ['graph TD'];

  // Add nodes with styling
  for (const node of graph.nodes) {
    const icon = getResourceIcon(node.type);
    const label = `${icon} ${node.label}`;
    lines.push(`    ${node.id.replace(/\./g, '_')}["${label}"]`);
  }

  // Add links
  for (const link of graph.links) {
    const source = link.source.replace(/\./g, '_');
    const target = link.target.replace(/\./g, '_');
    lines.push(`    ${source} --> ${target}`);
  }

  // Add styling by provider
  const providerNodes = new Map<string, string[]>();
  for (const node of graph.nodes) {
    const nodes = providerNodes.get(node.provider) || [];
    nodes.push(node.id.replace(/\./g, '_'));
    providerNodes.set(node.provider, nodes);
  }

  for (const [provider, nodeIds] of Array.from(providerNodes.entries())) {
    const color = getProviderColor(provider);
    lines.push(`    style ${nodeIds.join(',')} fill:${color}20,stroke:${color}`);
  }

  return lines.join('\n');
}

/**
 * Get resource statistics from graph
 */
export interface ResourceStats {
  byType: Record<string, number>;
  byProvider: Record<string, number>;
  byMode: Record<string, number>;
  totalResources: number;
  totalDependencies: number;
}

export function getResourceStats(graph: TerraformGraph): ResourceStats {
  const byType: Record<string, number> = {};
  const byProvider: Record<string, number> = {};
  const byMode: Record<string, number> = {};

  for (const node of graph.nodes) {
    byType[node.type] = (byType[node.type] || 0) + 1;
    byProvider[node.provider] = (byProvider[node.provider] || 0) + 1;
    byMode[node.mode] = (byMode[node.mode] || 0) + 1;
  }

  return {
    byType,
    byProvider,
    byMode,
    totalResources: graph.nodes.length,
    totalDependencies: graph.links.length,
  };
}

/**
 * Mock Terraform state for demo/testing
 */
export function getMockTerraformState(): TerraformState {
  return {
    version: 4,
    terraform_version: '1.6.0',
    serial: 42,
    lineage: 'demo-lineage-123',
    outputs: {
      vpc_id: { value: 'vpc-12345', type: 'string' },
      public_ip: { value: '54.123.45.67', type: 'string' },
    },
    resources: [
      {
        mode: 'managed',
        type: 'aws_vpc',
        name: 'main',
        provider: 'provider["registry.terraform.io/hashicorp/aws"]',
        instances: [{
          attributes: {
            id: 'vpc-12345',
            cidr_block: '10.0.0.0/16',
            tags: { Name: 'main-vpc' },
          },
          dependencies: [],
        }],
      },
      {
        mode: 'managed',
        type: 'aws_subnet',
        name: 'public_a',
        provider: 'provider["registry.terraform.io/hashicorp/aws"]',
        instances: [{
          attributes: {
            id: 'subnet-pub-a',
            vpc_id: 'vpc-12345',
            cidr_block: '10.0.1.0/24',
            availability_zone: 'us-east-1a',
          },
          dependencies: ['aws_vpc.main'],
        }],
      },
      {
        mode: 'managed',
        type: 'aws_subnet',
        name: 'public_b',
        provider: 'provider["registry.terraform.io/hashicorp/aws"]',
        instances: [{
          attributes: {
            id: 'subnet-pub-b',
            vpc_id: 'vpc-12345',
            cidr_block: '10.0.2.0/24',
            availability_zone: 'us-east-1b',
          },
          dependencies: ['aws_vpc.main'],
        }],
      },
      {
        mode: 'managed',
        type: 'aws_security_group',
        name: 'web',
        provider: 'provider["registry.terraform.io/hashicorp/aws"]',
        instances: [{
          attributes: {
            id: 'sg-web-123',
            vpc_id: 'vpc-12345',
            name: 'web-sg',
            ingress: [{ from_port: 80, to_port: 80, protocol: 'tcp' }],
          },
          dependencies: ['aws_vpc.main'],
        }],
      },
      {
        mode: 'managed',
        type: 'aws_instance',
        name: 'web_server',
        provider: 'provider["registry.terraform.io/hashicorp/aws"]',
        instances: [{
          attributes: {
            id: 'i-web-123',
            instance_type: 't3.medium',
            ami: 'ami-12345',
            subnet_id: 'subnet-pub-a',
            vpc_security_group_ids: ['sg-web-123'],
          },
          dependencies: ['aws_subnet.public_a', 'aws_security_group.web'],
        }],
      },
      {
        mode: 'managed',
        type: 'aws_rds_instance',
        name: 'database',
        provider: 'provider["registry.terraform.io/hashicorp/aws"]',
        instances: [{
          attributes: {
            id: 'db-main-123',
            engine: 'postgres',
            engine_version: '15.4',
            instance_class: 'db.t3.medium',
            allocated_storage: 100,
          },
          dependencies: ['aws_subnet.public_a', 'aws_subnet.public_b', 'aws_security_group.web'],
        }],
      },
      {
        mode: 'managed',
        type: 'aws_s3_bucket',
        name: 'assets',
        provider: 'provider["registry.terraform.io/hashicorp/aws"]',
        instances: [{
          attributes: {
            id: 'my-app-assets-bucket',
            bucket: 'my-app-assets-bucket',
            acl: 'private',
          },
          dependencies: [],
        }],
      },
      {
        mode: 'managed',
        type: 'kubernetes_deployment',
        name: 'api',
        provider: 'provider["registry.terraform.io/hashicorp/kubernetes"]',
        instances: [{
          attributes: {
            id: 'default/api-deployment',
            replicas: 3,
            image: 'my-api:latest',
          },
          dependencies: ['aws_instance.web_server'],
        }],
      },
      {
        mode: 'managed',
        type: 'kubernetes_service',
        name: 'api',
        provider: 'provider["registry.terraform.io/hashicorp/kubernetes"]',
        instances: [{
          attributes: {
            id: 'default/api-service',
            type: 'LoadBalancer',
            port: 80,
          },
          dependencies: ['kubernetes_deployment.api'],
        }],
      },
      {
        mode: 'data',
        type: 'aws_ami',
        name: 'ubuntu',
        provider: 'provider["registry.terraform.io/hashicorp/aws"]',
        instances: [{
          attributes: {
            id: 'ami-ubuntu-123',
            name: 'ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*',
          },
          dependencies: [],
        }],
      },
    ],
  };
}

export default {
  parseTerraformState,
  stateToGraph,
  compareStates,
  graphToMermaid,
  getResourceStats,
  getResourceIcon,
  getProviderColor,
  getMockTerraformState,
  RESOURCE_ICONS,
  PROVIDER_COLORS,
};
