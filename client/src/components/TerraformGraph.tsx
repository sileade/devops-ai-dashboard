import { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Download, 
  RefreshCw,
  Info,
  X
} from 'lucide-react';

// Types matching server/terraform.ts
interface GraphNode {
  id: string;
  label: string;
  type: string;
  provider: string;
  mode: 'managed' | 'data';
  attributes: Record<string, any>;
  group: string;
  // D3 simulation properties
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  type: 'dependency' | 'reference';
}

interface TerraformGraphData {
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

// Resource type icons
const RESOURCE_ICONS: Record<string, string> = {
  'aws_instance': '🖥️',
  'aws_vpc': '🌐',
  'aws_subnet': '📡',
  'aws_security_group': '🔒',
  'aws_s3_bucket': '🪣',
  'aws_rds_instance': '🗄️',
  'aws_lambda_function': 'λ',
  'aws_iam_role': '👤',
  'aws_eks_cluster': '☸️',
  'aws_alb': '⚖️',
  'google_compute_instance': '🖥️',
  'google_container_cluster': '☸️',
  'azurerm_virtual_machine': '🖥️',
  'azurerm_kubernetes_cluster': '☸️',
  'kubernetes_deployment': '🚀',
  'kubernetes_service': '🔌',
  'kubernetes_namespace': '📁',
  'docker_container': '🐳',
  'docker_image': '📦',
  'default': '📦',
};

// Provider colors
const PROVIDER_COLORS: Record<string, string> = {
  'aws': '#FF9900',
  'google': '#4285F4',
  'azurerm': '#0078D4',
  'kubernetes': '#326CE5',
  'docker': '#2496ED',
  'helm': '#0F1689',
  'default': '#6B7280',
};

interface TerraformGraphProps {
  data: TerraformGraphData;
  onNodeClick?: (node: GraphNode) => void;
  className?: string;
}

export function TerraformGraph({ data, onNodeClick, className }: TerraformGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [zoom, setZoom] = useState(1);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  const getIcon = (type: string) => RESOURCE_ICONS[type] || RESOURCE_ICONS['default'];
  const getColor = (provider: string) => PROVIDER_COLORS[provider] || PROVIDER_COLORS['default'];

  // Initialize D3 visualization
  useEffect(() => {
    if (!svgRef.current || !containerRef.current || !data.nodes.length) return;

    const svg = d3.select(svgRef.current);
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight || 600;

    // Clear previous content
    svg.selectAll('*').remove();

    // Create zoom behavior
    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        g.attr('transform', event.transform.toString());
        setZoom(event.transform.k);
      });

    zoomBehaviorRef.current = zoomBehavior;
    svg.call(zoomBehavior);

    // Create main group for zoom/pan
    const g = svg.append('g');

    // Define arrow markers
    svg.append('defs').append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 25)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .append('path')
      .attr('d', 'M 0,-5 L 10,0 L 0,5')
      .attr('fill', '#6B7280');

    // Create links
    const link = g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(data.links)
      .enter()
      .append('line')
      .attr('stroke', '#6B7280')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', 1.5)
      .attr('marker-end', 'url(#arrowhead)');

    // Create node groups
    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(data.nodes)
      .enter()
      .append('g')
      .attr('class', 'node')
      .style('cursor', 'pointer')
      .call(d3.drag<SVGGElement, GraphNode>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended)
      )
      .on('click', (event: MouseEvent, d: GraphNode) => {
        event.stopPropagation();
        setSelectedNode(d);
        onNodeClick?.(d);
      });

    // Add circles to nodes
    node.append('circle')
      .attr('r', 20)
      .attr('fill', (d: GraphNode) => getColor(d.provider))
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .attr('opacity', 0.9);

    // Add icons to nodes
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('font-size', '16px')
      .text((d: GraphNode) => getIcon(d.type));

    // Add labels below nodes
    node.append('text')
      .attr('dy', 35)
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('fill', '#E5E7EB')
      .text((d: GraphNode) => d.label.length > 15 ? d.label.slice(0, 15) + '...' : d.label);

    // Add mode indicator (data source vs managed)
    node.filter((d: GraphNode) => d.mode === 'data')
      .append('circle')
      .attr('r', 6)
      .attr('cx', 14)
      .attr('cy', -14)
      .attr('fill', '#10B981')
      .attr('stroke', '#fff')
      .attr('stroke-width', 1);

    // Create simulation
    const simulation = d3.forceSimulation<GraphNode>(data.nodes)
      .force('link', d3.forceLink<GraphNode, GraphLink>(data.links)
        .id((d: GraphNode) => d.id)
        .distance(100)
      )
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(40));

    simulationRef.current = simulation;

    simulation.on('tick', () => {
      link
        .attr('x1', (d: GraphLink) => ((d.source as GraphNode).x || 0))
        .attr('y1', (d: GraphLink) => ((d.source as GraphNode).y || 0))
        .attr('x2', (d: GraphLink) => ((d.target as GraphNode).x || 0))
        .attr('y2', (d: GraphLink) => ((d.target as GraphNode).y || 0));

      node.attr('transform', (d: GraphNode) => `translate(${d.x || 0},${d.y || 0})`);
    });

    function dragstarted(event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    // Click on background to deselect
    svg.on('click', () => setSelectedNode(null));

    return () => {
      simulation.stop();
    };
  }, [data, onNodeClick]);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    if (svgRef.current && zoomBehaviorRef.current) {
      d3.select(svgRef.current)
        .transition()
        .duration(300)
        .call(zoomBehaviorRef.current.scaleBy, 1.3);
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    if (svgRef.current && zoomBehaviorRef.current) {
      d3.select(svgRef.current)
        .transition()
        .duration(300)
        .call(zoomBehaviorRef.current.scaleBy, 0.7);
    }
  }, []);

  const handleFitView = useCallback(() => {
    if (svgRef.current && zoomBehaviorRef.current && containerRef.current) {
      const svg = d3.select(svgRef.current);
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight || 600;
      
      svg.transition()
        .duration(500)
        .call(
          zoomBehaviorRef.current.transform,
          d3.zoomIdentity.translate(width / 2, height / 2).scale(0.8)
        );
    }
  }, []);

  const handleExportSVG = useCallback(() => {
    if (!svgRef.current) return;
    
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'terraform-graph.svg';
    link.click();
    
    URL.revokeObjectURL(url);
  }, []);

  const handleResetSimulation = useCallback(() => {
    if (simulationRef.current) {
      simulationRef.current.alpha(1).restart();
    }
  }, []);

  return (
    <div className={`relative ${className}`}>
      {/* Controls */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
        <Button variant="outline" size="icon" onClick={handleZoomIn} title="Zoom In">
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={handleZoomOut} title="Zoom Out">
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={handleFitView} title="Fit View">
          <Maximize2 className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={handleExportSVG} title="Export SVG">
          <Download className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={handleResetSimulation} title="Reset Layout">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Zoom indicator */}
      <div className="absolute top-4 right-4 z-10 bg-background/80 px-2 py-1 rounded text-xs">
        {Math.round(zoom * 100)}%
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-10 bg-background/90 p-3 rounded-lg border">
        <div className="text-xs font-medium mb-2">Providers</div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(PROVIDER_COLORS).filter(([k]) => k !== 'default').map(([provider, color]) => (
            <div key={provider} className="flex items-center gap-1">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: color }}
              />
              <span className="text-xs">{provider}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Data Source</span>
          </div>
        </div>
      </div>

      {/* Metadata */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex gap-2">
        <Badge variant="outline">
          {data.metadata.resourceCount} resources
        </Badge>
        <Badge variant="outline">
          {data.links.length} dependencies
        </Badge>
        {data.metadata.terraformVersion && (
          <Badge variant="outline">
            TF v{data.metadata.terraformVersion}
          </Badge>
        )}
      </div>

      {/* Graph container */}
      <div ref={containerRef} className="w-full h-[600px] bg-background/50 rounded-lg border">
        <svg
          ref={svgRef}
          className="w-full h-full"
          style={{ background: 'transparent' }}
        />
      </div>

      {/* Selected node details */}
      {selectedNode && (
        <Card className="absolute bottom-4 right-4 z-10 w-80 max-h-[300px] overflow-auto">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <span>{getIcon(selectedNode.type)}</span>
                {selectedNode.label}
              </CardTitle>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6"
                onClick={() => setSelectedNode(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type:</span>
                <span className="font-mono">{selectedNode.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Provider:</span>
                <Badge 
                  variant="outline" 
                  style={{ borderColor: getColor(selectedNode.provider) }}
                >
                  {selectedNode.provider}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mode:</span>
                <Badge variant={selectedNode.mode === 'data' ? 'secondary' : 'default'}>
                  {selectedNode.mode}
                </Badge>
              </div>
              {Object.keys(selectedNode.attributes).length > 0 && (
                <div className="mt-2">
                  <div className="text-muted-foreground mb-1 flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    Attributes:
                  </div>
                  <pre className="bg-muted p-2 rounded text-[10px] overflow-auto max-h-[100px]">
                    {JSON.stringify(selectedNode.attributes, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default TerraformGraph;
