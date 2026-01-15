/**
 * AI-Powered Auto-Scaler
 * Analyzes metrics patterns and makes intelligent scaling decisions
 */

import { invokeLLM } from "../_core/llm";

export interface MetricDataPoint {
  timestamp: number;
  value: number;
}

export interface ScalingAnalysis {
  shouldScale: boolean;
  direction: "up" | "down" | "none";
  confidence: number; // 0-100
  recommendedReplicas: number;
  reasoning: string;
  pattern: string | null;
  predictedLoad: number | null;
  timeToThreshold: number | null; // minutes until threshold breach
}

export interface ScalingContext {
  resourceName: string;
  resourceType: string;
  namespace?: string;
  currentReplicas: number;
  minReplicas: number;
  maxReplicas: number;
  scaleUpThreshold: number;
  scaleDownThreshold: number;
  currentMetricValue: number;
  metricType: string;
  metricsHistory: MetricDataPoint[];
  lastScaledAt?: Date;
  cooldownSeconds: number;
}

/**
 * Analyze metrics and determine if scaling is needed
 */
export async function analyzeMetricsForScaling(
  context: ScalingContext
): Promise<ScalingAnalysis> {
  // First, do basic threshold analysis
  const basicAnalysis = performBasicAnalysis(context);
  
  // If we have enough history, use AI for deeper analysis
  if (context.metricsHistory.length >= 10) {
    try {
      const aiAnalysis = await performAIAnalysis(context, basicAnalysis);
      return aiAnalysis;
    } catch (error) {
      console.error("[AI-Autoscaler] AI analysis failed, using basic analysis:", error);
      return basicAnalysis;
    }
  }
  
  return basicAnalysis;
}

/**
 * Perform basic threshold-based analysis
 */
function performBasicAnalysis(context: ScalingContext): ScalingAnalysis {
  const { currentMetricValue, scaleUpThreshold, scaleDownThreshold, currentReplicas, minReplicas, maxReplicas } = context;
  
  // Check cooldown
  if (context.lastScaledAt) {
    const timeSinceLastScale = (Date.now() - context.lastScaledAt.getTime()) / 1000;
    if (timeSinceLastScale < context.cooldownSeconds) {
      return {
        shouldScale: false,
        direction: "none",
        confidence: 100,
        recommendedReplicas: currentReplicas,
        reasoning: `Cooldown active. ${Math.ceil(context.cooldownSeconds - timeSinceLastScale)} seconds remaining.`,
        pattern: null,
        predictedLoad: null,
        timeToThreshold: null,
      };
    }
  }
  
  // Scale up check
  if (currentMetricValue >= scaleUpThreshold && currentReplicas < maxReplicas) {
    return {
      shouldScale: true,
      direction: "up",
      confidence: 85,
      recommendedReplicas: Math.min(currentReplicas + 1, maxReplicas),
      reasoning: `${context.metricType.toUpperCase()} usage (${currentMetricValue}%) exceeds scale-up threshold (${scaleUpThreshold}%).`,
      pattern: "threshold_breach",
      predictedLoad: null,
      timeToThreshold: null,
    };
  }
  
  // Scale down check
  if (currentMetricValue <= scaleDownThreshold && currentReplicas > minReplicas) {
    return {
      shouldScale: true,
      direction: "down",
      confidence: 80,
      recommendedReplicas: Math.max(currentReplicas - 1, minReplicas),
      reasoning: `${context.metricType.toUpperCase()} usage (${currentMetricValue}%) is below scale-down threshold (${scaleDownThreshold}%).`,
      pattern: "low_utilization",
      predictedLoad: null,
      timeToThreshold: null,
    };
  }
  
  return {
    shouldScale: false,
    direction: "none",
    confidence: 90,
    recommendedReplicas: currentReplicas,
    reasoning: `${context.metricType.toUpperCase()} usage (${currentMetricValue}%) is within acceptable range (${scaleDownThreshold}%-${scaleUpThreshold}%).`,
    pattern: null,
    predictedLoad: null,
    timeToThreshold: null,
  };
}

/**
 * Perform AI-powered analysis with pattern detection and prediction
 */
async function performAIAnalysis(
  context: ScalingContext,
  basicAnalysis: ScalingAnalysis
): Promise<ScalingAnalysis> {
  // Prepare metrics summary for AI
  const recentMetrics = context.metricsHistory.slice(-30);
  const avgValue = recentMetrics.reduce((sum, m) => sum + m.value, 0) / recentMetrics.length;
  const maxValue = Math.max(...recentMetrics.map(m => m.value));
  const minValue = Math.min(...recentMetrics.map(m => m.value));
  const trend = calculateTrend(recentMetrics);
  
  const prompt = `You are an AI DevOps assistant analyzing resource metrics for auto-scaling decisions.

CONTEXT:
- Resource: ${context.resourceName} (${context.resourceType})
- Namespace: ${context.namespace || "default"}
- Current replicas: ${context.currentReplicas}
- Min/Max replicas: ${context.minReplicas}/${context.maxReplicas}
- Metric type: ${context.metricType}
- Current value: ${context.currentMetricValue}%
- Scale-up threshold: ${context.scaleUpThreshold}%
- Scale-down threshold: ${context.scaleDownThreshold}%

METRICS HISTORY (last ${recentMetrics.length} data points):
- Average: ${avgValue.toFixed(1)}%
- Max: ${maxValue.toFixed(1)}%
- Min: ${minValue.toFixed(1)}%
- Trend: ${trend > 0 ? "increasing" : trend < 0 ? "decreasing" : "stable"} (${(trend * 100).toFixed(2)}% per interval)

BASIC ANALYSIS RESULT:
${basicAnalysis.reasoning}

Analyze the metrics and provide a scaling recommendation. Consider:
1. Is there a pattern (daily cycle, gradual increase, spikes)?
2. Should we scale proactively before hitting thresholds?
3. What's the optimal number of replicas?
4. How confident are you in this recommendation?

Respond in JSON format:
{
  "shouldScale": boolean,
  "direction": "up" | "down" | "none",
  "confidence": number (0-100),
  "recommendedReplicas": number,
  "reasoning": "brief explanation",
  "pattern": "detected pattern or null",
  "predictedLoad": number or null (predicted metric value in 15 min),
  "timeToThreshold": number or null (minutes until threshold breach)
}`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: "You are an expert DevOps AI that analyzes metrics and makes intelligent auto-scaling decisions. Always respond with valid JSON." },
      { role: "user", content: prompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "scaling_analysis",
        strict: true,
        schema: {
          type: "object",
          properties: {
            shouldScale: { type: "boolean" },
            direction: { type: "string", enum: ["up", "down", "none"] },
            confidence: { type: "integer", minimum: 0, maximum: 100 },
            recommendedReplicas: { type: "integer", minimum: 0 },
            reasoning: { type: "string" },
            pattern: { type: ["string", "null"] },
            predictedLoad: { type: ["integer", "null"] },
            timeToThreshold: { type: ["integer", "null"] },
          },
          required: ["shouldScale", "direction", "confidence", "recommendedReplicas", "reasoning", "pattern", "predictedLoad", "timeToThreshold"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0]?.message?.content;
  if (!content || typeof content !== 'string') {
    throw new Error("Empty or invalid AI response");
  }

  const aiResult = JSON.parse(content) as ScalingAnalysis;
  
  // Validate and clamp values
  aiResult.recommendedReplicas = Math.max(
    context.minReplicas,
    Math.min(context.maxReplicas, aiResult.recommendedReplicas)
  );
  aiResult.confidence = Math.max(0, Math.min(100, aiResult.confidence));
  
  return aiResult;
}

/**
 * Calculate trend from metrics history
 */
function calculateTrend(metrics: MetricDataPoint[]): number {
  if (metrics.length < 2) return 0;
  
  // Simple linear regression slope
  const n = metrics.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += metrics[i].value;
    sumXY += i * metrics[i].value;
    sumX2 += i * i;
  }
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  return slope;
}

/**
 * Generate AI explanation for a scaling action
 */
export async function generateScalingExplanation(
  action: "scale_up" | "scale_down",
  context: ScalingContext,
  analysis: ScalingAnalysis
): Promise<string> {
  const prompt = `Generate a brief, clear explanation for the following auto-scaling action:

ACTION: ${action === "scale_up" ? "Scaling UP" : "Scaling DOWN"}
RESOURCE: ${context.resourceName} (${context.resourceType})
REPLICAS: ${context.currentReplicas} → ${analysis.recommendedReplicas}
TRIGGER: ${context.metricType} at ${context.currentMetricValue}%
THRESHOLD: ${action === "scale_up" ? context.scaleUpThreshold : context.scaleDownThreshold}%
AI CONFIDENCE: ${analysis.confidence}%
PATTERN DETECTED: ${analysis.pattern || "None"}

Write a 2-3 sentence explanation suitable for a DevOps dashboard notification.`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are a DevOps AI assistant. Write clear, concise explanations for auto-scaling actions." },
        { role: "user", content: prompt },
      ],
    });

    const content = response.choices[0]?.message?.content;
    return typeof content === 'string' ? content : analysis.reasoning;
  } catch (error) {
    return analysis.reasoning;
  }
}


/**
 * Predict future load based on historical patterns
 */
export async function predictFutureLoad(
  metricsHistory: MetricDataPoint[],
  hoursAhead: number = 1
): Promise<{ predictedValue: number; confidence: number; pattern: string }> {
  if (metricsHistory.length < 24) {
    // Not enough data for prediction
    const avgValue = metricsHistory.reduce((sum, m) => sum + m.value, 0) / metricsHistory.length;
    return {
      predictedValue: Math.round(avgValue),
      confidence: 30,
      pattern: "insufficient_data",
    };
  }

  // Calculate hourly averages for pattern detection
  const hourlyAverages: number[] = [];
  const pointsPerHour = Math.floor(metricsHistory.length / 24);
  
  for (let i = 0; i < 24; i++) {
    const start = i * pointsPerHour;
    const end = start + pointsPerHour;
    const hourData = metricsHistory.slice(start, end);
    if (hourData.length > 0) {
      hourlyAverages.push(hourData.reduce((sum, m) => sum + m.value, 0) / hourData.length);
    }
  }

  // Simple prediction based on trend and time-of-day pattern
  const currentHour = new Date().getHours();
  const targetHour = (currentHour + hoursAhead) % 24;
  
  const trend = calculateTrend(metricsHistory.slice(-12));
  const baseValue = hourlyAverages[targetHour] || metricsHistory[metricsHistory.length - 1].value;
  const predictedValue = Math.round(baseValue + trend * hoursAhead * 12);
  
  // Detect pattern
  let pattern = "stable";
  const variance = calculateVariance(hourlyAverages);
  if (variance > 200) {
    pattern = "high_variance";
  } else if (trend > 1) {
    pattern = "increasing";
  } else if (trend < -1) {
    pattern = "decreasing";
  } else if (hourlyAverages.some((v, i) => Math.abs(v - hourlyAverages[(i + 12) % 24]) < 5)) {
    pattern = "daily_cycle";
  }

  return {
    predictedValue: Math.max(0, Math.min(100, predictedValue)),
    confidence: Math.min(85, 50 + metricsHistory.length / 10),
    pattern,
  };
}

function calculateVariance(values: number[]): number {
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  return values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
}
