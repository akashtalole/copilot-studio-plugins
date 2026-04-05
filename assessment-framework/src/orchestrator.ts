import Anthropic from '@anthropic-ai/sdk';
import type { AgentProject } from './types/mcs-schema';
import type { AssessmentReport, SectionResult } from './types/assessment';
import { runInstructionsAgent } from './agents/instructions-agent';
import { runTopicsAgent } from './agents/topics-agent';
import { runActionsAgent } from './agents/actions-agent';
import { runConnectedAgentsAgent } from './agents/connected-agents-agent';

export interface OrchestratorOptions {
  model?: string;
}

/** Section weights contributing to the 100-point overall score */
const SECTION_WEIGHTS: Record<string, number> = {
  instructions: 10,
  topics: 40,
  actions: 30,
  connected_agents: 10,
};

/** Fallback section result when an agent call fails */
function fallbackSection(section: string, defaultMax: number): SectionResult {
  return {
    section,
    score: 0,
    maxScore: defaultMax,
    findings: [{
      ruleId: 'SYS-ERR',
      severity: 'error',
      component: section,
      message: `Assessment agent for "${section}" failed. Re-run to retry.`,
    }],
    semanticDimensions: [],
    recommendations: [`Re-run the assessment — the ${section} agent encountered an error`],
    suggestedRewrites: {},
  };
}

export async function runOrchestrator(
  project: AgentProject,
  options: OrchestratorOptions = {}
): Promise<AssessmentReport> {
  const model = options.model ?? 'claude-opus-4-6';
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env

  const agentName = project.bot?.name
    ?? project.rootPath.split('/').pop()
    ?? 'Unknown Agent';

  // Default maxScores for fallbacks (if Promise.allSettled rejects)
  const defaultMaxScores = [10, project.topics.length * 10, project.actions.length * 10, 10];

  // Launch all 4 specialists in parallel — use allSettled so one failure
  // doesn't abort the entire assessment
  const settled = await Promise.allSettled([
    runInstructionsAgent(client, project, model),
    runTopicsAgent(client, project, model),
    runActionsAgent(client, project, model),
    runConnectedAgentsAgent(client, project, model),
  ]);

  const sectionNames = ['instructions', 'topics', 'actions', 'connected_agents'];

  const sections: SectionResult[] = settled.map((result, i) =>
    result.status === 'fulfilled'
      ? result.value
      : fallbackSection(sectionNames[i], defaultMaxScores[i])
  );

  // ── Score normalization ────────────────────────────────────────────────────
  // Active sections: those with maxScore > 0
  const activeSections = sections.filter(s => s.maxScore > 0);
  const inactiveWeight = sections
    .filter(s => s.maxScore === 0)
    .reduce((sum, s) => sum + (SECTION_WEIGHTS[s.section] ?? 0), 0);

  const activeBaseWeight = activeSections
    .reduce((sum, s) => sum + (SECTION_WEIGHTS[s.section] ?? 0), 0);

  // Build normalized weight for each active section
  const normalizedWeight = new Map<string, number>();
  for (const s of activeSections) {
    const base = SECTION_WEIGHTS[s.section] ?? 0;
    const adjusted = activeBaseWeight > 0
      ? base + (inactiveWeight * base) / activeBaseWeight
      : 100 / activeSections.length;
    normalizedWeight.set(s.section, adjusted);
  }

  let overallScore = 0;
  for (const s of activeSections) {
    const w = normalizedWeight.get(s.section) ?? 0;
    overallScore += (s.score / s.maxScore) * w;
  }

  // Parse error penalty: -2 per error, max -10
  const parsePenalty = Math.min(project.parseErrors.length * 2, 10);
  overallScore = Math.max(0, Math.round(overallScore - parsePenalty));

  // ── Rating ─────────────────────────────────────────────────────────────────
  const rating: AssessmentReport['rating'] =
    overallScore >= 80 ? 'PASS'
    : overallScore >= 60 ? 'NEEDS IMPROVEMENT'
    : overallScore >= 40 ? 'POOR'
    : 'CRITICAL';

  // ── Top recommendations (errors first, then warnings) ──────────────────────
  const allFindings = sections.flatMap(s => s.findings);
  const topRecommendations: AssessmentReport['topRecommendations'] = [
    ...allFindings.filter(f => f.severity === 'error').slice(0, 5).map(f => ({
      priority: 'HIGH' as const,
      message: `[${f.component}] ${f.message}${f.suggestedRewrite ? ` → ${f.suggestedRewrite}` : ''}`,
    })),
    ...allFindings.filter(f => f.severity === 'warning').slice(0, 5).map(f => ({
      priority: 'MED' as const,
      message: `[${f.component}] ${f.message}`,
    })),
    ...allFindings.filter(f => f.severity === 'info').slice(0, 2).map(f => ({
      priority: 'INFO' as const,
      message: `[${f.component}] ${f.message}`,
    })),
  ];

  return {
    agentName,
    agentPath: project.rootPath,
    assessedAt: new Date().toISOString(),
    overallScore,
    rating,
    sections,
    parseErrors: project.parseErrors.map(e => `${e.filePath}: ${e.message}`),
    topRecommendations,
  };
}
