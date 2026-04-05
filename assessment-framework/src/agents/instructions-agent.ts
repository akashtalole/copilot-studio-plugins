import Anthropic from '@anthropic-ai/sdk';
import type { AgentProject } from '../types/mcs-schema';
import { ASSESSMENT_TOOL, type SectionResult } from '../types/assessment';

const SYSTEM_PROMPT = `You are a specialist assessor for Microsoft Copilot Studio agent instructions.
Your role is to assess the quality of a Copilot Studio agent's "instructions" and "description" fields
against best practices for generative orchestration.

## Rule-Based Checks to Apply

ERRORS (severity: "error", cost -3 pts each):
- Instructions field missing or empty
- Instructions length > 8000 characters
- Instructions cite-suppression attempt (contains "do not cite", "don't cite", "no citations", etc.)

WARNINGS (severity: "warning", cost -1 pt each):
- Agent description missing or < 50 chars
- Instructions length > 4000 characters
- Instructions length < 200 characters
- No Markdown formatting found (no "# ", "## ", "**", "- ", "* ")
- No persona defined (none of: "you are", "your role", "act as", "you help", "you assist")
- No fallback behaviour (none of: "if not found", "if unable", "cannot find", "otherwise", "if the answer")
- Tool name [ToolName] referenced but not found in actual action list (case-sensitive match)

INFO (severity: "info", cost 0 pts):
- Tool name referenced with wrong casing

## Semantic Scoring Dimensions (each 1–5)

1. "Persona Clarity" — How clearly is the agent's role, scope and audience defined?
   5=very specific and bounded; 1=no persona or completely generic

2. "Tool Guidance Quality" — How precisely are tools referenced with when-to-use conditions?
   5=every tool has clear invocation conditions, exact names; 1=no tool guidance

3. "Operational Completeness" — Do instructions cover persona, scope, tools, tone, edge cases, fallback?
   5=comprehensive; 1=minimal

4. "Generative Readiness" — Can an LLM autonomously route and respond based on these instructions alone?
   5=fully self-contained; 1=agent would behave unpredictably

## Scoring
Start at 10. Each error: -3. Each warning: -1. Minimum 0.

## Your Task
Analyse the provided agent YAML content. Apply all rule-based checks and all semantic scoring dimensions.
For any semantic dimension < 3, include a suggested rewrite in "suggestedRewrites" keyed by "instructions".
Then call report_assessment with the complete structured results.`;

export async function runInstructionsAgent(
  client: Anthropic,
  project: AgentProject,
  model: string
): Promise<SectionResult> {
  const allToolNames = project.actions.map(a => a.action.name).filter(Boolean);
  const allTopicNames = project.topics
    .map(t => t.topic.name ?? '')
    .filter(Boolean);

  const userContent = `## Agent to Assess

Name: ${project.bot?.name ?? 'Unknown'}

Agent instructions field:
\`\`\`
${project.bot?.instructions ?? '(MISSING)'}
\`\`\`

Agent description field:
\`\`\`
${project.bot?.description ?? '(MISSING)'}
\`\`\`

Actual action/tool names in this agent: ${allToolNames.length ? allToolNames.join(', ') : '(none)'}
Actual topic names in this agent: ${allTopicNames.length ? allTopicNames.join(', ') : '(none)'}

Apply all rule-based checks and semantic scoring, then call report_assessment.`;

  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools: [ASSESSMENT_TOOL],
    tool_choice: { type: 'any' },
    messages: [{ role: 'user', content: userContent }],
  });

  return extractSectionResult(response, 'instructions', 10);
}

function extractSectionResult(
  response: Anthropic.Message,
  section: string,
  defaultMax: number
): SectionResult {
  for (const block of response.content) {
    if (block.type === 'tool_use' && block.name === 'report_assessment') {
      const input = block.input as Partial<SectionResult>;
      return {
        section: input.section ?? section,
        score: input.score ?? 0,
        maxScore: input.maxScore ?? defaultMax,
        findings: input.findings ?? [],
        semanticDimensions: input.semanticDimensions ?? [],
        recommendations: input.recommendations ?? [],
        suggestedRewrites: input.suggestedRewrites ?? {},
      };
    }
  }
  // Fallback if tool not called
  return {
    section,
    score: 0,
    maxScore: defaultMax,
    findings: [{ ruleId: 'AGENT_NO_RESPONSE', severity: 'error', component: section, message: 'Assessment agent did not return results' }],
    semanticDimensions: [],
    recommendations: ['Re-run the assessment'],
    suggestedRewrites: {},
  };
}
