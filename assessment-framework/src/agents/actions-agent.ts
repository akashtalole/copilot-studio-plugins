import Anthropic from '@anthropic-ai/sdk';
import * as yaml from 'js-yaml';
import type { AgentProject } from '../types/mcs-schema';
import { ASSESSMENT_TOOL, type SectionResult } from '../types/assessment';

const SYSTEM_PROMPT = `You are a specialist assessor for Microsoft Copilot Studio tool/action quality.
Your role is to assess all ACTIONS (tools) in a Copilot Studio agent for generative orchestration best practices.

Action kinds to assess: Action, ConnectorAction, FlowAction.

## Rule-Based Checks (per action)

ACT-001 [ERROR -3]: description absent or empty
ACT-002 [ERROR -3]: description present but < 30 characters
ACT-003 [WARNING -1]: description 30–59 characters
ACT-004 [WARNING -1]: no "when to use" guidance — description (lowercase) lacks all of:
  "use when", "use this", "call when", "invoke when", "to get", "to retrieve",
  "retrieves", "returns", "fetches", "when the user", "when user", "to find"
ACT-005 [WARNING -1]: no return value described — description (lowercase) lacks all of:
  "returns", "retrieves", "gets", "fetches", "provides", "gives", "outputs", "result", "list of"
ACT-006 [WARNING -1]: inputs/parameters array present but no entries have a description field
ACT-007 [INFO]: a specific input parameter is missing its description field
ACT-008 [INFO]: action not referenced anywhere in bot instructions field (potential orphan)

Per-action scoring: start at 10, apply penalties, minimum 0.
Section score: sum of all per-action scores / (actionCount × 10) × 30.
Report raw sum as "score", (actionCount × 10) as "maxScore".

## Semantic Precision Evaluation (per action, score each 1–5)

For EACH action, evaluate:

Precision (1–5): Would the generative orchestrator reliably invoke THIS action (vs doing nothing or another action)?
  1 = Description so vague any "get data" intent triggers it
  3 = Domain correct but exact trigger conditions unclear
  5 = Unambiguous — clear precondition, return value, and unique trigger signal

Differentiation (1–5): Given all other actions, is there zero ambiguity about which to call for a given intent?
  1 = Another action handles the same domain with similar description
  3 = Some overlap but usually distinguishable
  5 = No other action could be confused for this one

For any dimension < 3, generate a suggestedRewrite following this canonical pattern:
"[Returns/Does X]. Use when [specific trigger condition, e.g. user asks about Y].
[If overlapping peers exist: Do NOT use for Z — use [OtherActionName] instead.]"

## Cross-Action Differentiation Analysis
Identify pairs of actions that could both plausibly be called for the same user message.
Flag these as ACT-OVERLAP warnings referencing both action names.

## Mandatory Output
Call report_assessment with section = "actions".
Encode per-action semantic scores in component field: "ActionName [Precision:N Diff:N]"`;

export async function runActionsAgent(
  client: Anthropic,
  project: AgentProject,
  model: string
): Promise<SectionResult> {
  const actionsYaml = project.actions
    .map(({ action }) => yaml.dump(action, { indent: 2, lineWidth: 120 }))
    .join('\n---\n');

  const botInstructions = project.bot?.instructions ?? '(none)';

  const userContent = `## Assess These Actions/Tools

Total actions: ${project.actions.length}
Bot instructions (for cross-reference):
${botInstructions}

${project.actions.length === 0 ? 'NO ACTIONS FOUND — return score 0, maxScore 0, with an info finding.' : actionsYaml}

Apply all rule-based checks and semantic scoring, then call report_assessment.`;

  const response = await client.messages.create({
    model,
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    tools: [ASSESSMENT_TOOL],
    tool_choice: { type: 'any' },
    messages: [{ role: 'user', content: userContent }],
  });

  return extractResult(response, 'actions', project.actions.length * 10);
}

function extractResult(
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
  return {
    section,
    score: 0,
    maxScore: defaultMax,
    findings: [{ ruleId: 'SYS-001', severity: 'error', component: section, message: 'Assessment agent did not return structured results' }],
    semanticDimensions: [],
    recommendations: ['Re-run the assessment'],
    suggestedRewrites: {},
  };
}
