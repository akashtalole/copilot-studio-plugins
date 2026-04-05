/**
 * Assessment result types and the tool schema used to get structured
 * JSON output from each specialist Claude agent.
 */
import Anthropic from '@anthropic-ai/sdk';

export type Severity = 'error' | 'warning' | 'info';

export interface Finding {
  ruleId: string;
  severity: Severity;
  component: string;       // e.g. "topic:LeaveBalance", "action:GetOrder"
  message: string;
  semanticScore?: number;  // 1–5, present when LLM semantic evaluation was done
  suggestedRewrite?: string;
}

export interface SemanticDimension {
  name: string;   // e.g. "Persona Clarity", "Selection Precision"
  score: number;  // 1–5
  rationale: string;
}

export interface SectionResult {
  section: string;          // "instructions" | "topics" | "actions" | "connected_agents"
  score: number;
  maxScore: number;
  findings: Finding[];
  semanticDimensions: SemanticDimension[];
  recommendations: string[];
  /** Suggested rewrites keyed by component name */
  suggestedRewrites: Record<string, string>;
}

export interface AssessmentReport {
  agentName: string;
  agentPath: string;
  assessedAt: string;
  overallScore: number;
  rating: 'PASS' | 'NEEDS IMPROVEMENT' | 'POOR' | 'CRITICAL';
  sections: SectionResult[];
  parseErrors: string[];
  topRecommendations: Array<{ priority: 'HIGH' | 'MED' | 'INFO'; message: string }>;
}

// ─── Tool schema for structured agent output ──────────────────────────────────

/** The tool that each specialist agent must call to return its findings. */
export const ASSESSMENT_TOOL: Anthropic.Tool = {
  name: 'report_assessment',
  description: 'Report the structured assessment findings for this section. MUST be called once with the complete results.',
  input_schema: {
    type: 'object' as const,
    required: ['section', 'score', 'maxScore', 'findings', 'semanticDimensions', 'recommendations', 'suggestedRewrites'],
    properties: {
      section: {
        type: 'string',
        description: 'Section identifier: instructions | topics | actions | connected_agents'
      },
      score: {
        type: 'number',
        description: 'Points earned for this section'
      },
      maxScore: {
        type: 'number',
        description: 'Maximum possible points for this section'
      },
      findings: {
        type: 'array',
        description: 'All rule-based and semantic findings',
        items: {
          type: 'object',
          required: ['ruleId', 'severity', 'component', 'message'],
          properties: {
            ruleId: { type: 'string' },
            severity: { type: 'string', enum: ['error', 'warning', 'info'] },
            component: { type: 'string', description: 'Which component this finding applies to' },
            message: { type: 'string', description: 'Clear, actionable finding description' },
            semanticScore: { type: 'number', minimum: 1, maximum: 5 },
            suggestedRewrite: { type: 'string', description: 'Improved YAML snippet if applicable' }
          }
        }
      },
      semanticDimensions: {
        type: 'array',
        description: 'LLM semantic quality scores for this section',
        items: {
          type: 'object',
          required: ['name', 'score', 'rationale'],
          properties: {
            name: { type: 'string' },
            score: { type: 'number', minimum: 1, maximum: 5 },
            rationale: { type: 'string', description: 'One-sentence explanation for the score' }
          }
        }
      },
      recommendations: {
        type: 'array',
        description: 'Top actionable recommendations for this section',
        items: { type: 'string' }
      },
      suggestedRewrites: {
        type: 'object',
        description: 'Improved YAML snippets keyed by component name (only for items scoring < 3/5)',
        additionalProperties: { type: 'string' }
      }
    }
  }
};
