import Anthropic from '@anthropic-ai/sdk';
import * as yaml from 'js-yaml';
import type { AgentProject } from '../types/mcs-schema';
import { ASSESSMENT_TOOL, type SectionResult } from '../types/assessment';

const SYSTEM_PROMPT = `You are a specialist assessor for Microsoft Copilot Studio multi-agent orchestration quality.
Your role is to assess the CONNECTED AGENTS configuration of an orchestrator Copilot Studio agent.

## No Connected Agents
If connectedAgents array is empty or absent, return:
  score: 10, maxScore: 10
  One info finding: "No connected agents configured (single-agent setup). Score: 10/10."
  No semantic dimensions required.

## Rule-Based Checks (per connected agent)

CA-001 [ERROR -3]: description missing or empty
CA-002 [WARNING -1]: description < 50 characters
CA-003 [WARNING -1]: no capabilities listed — description (lowercase) lacks all of:
  "handles", "manages", "responsible for", "queries", "requests", "related to",
  "including", "specializes", "covers", "deals with"
CA-004 [WARNING -1]: no delegation boundaries — description (lowercase) lacks all of:
  "only", "exclusively", "all ", "any ", "when", "for ", "such as", "specifically"

Orchestrator-level checks (on the Bot document instructions):
CA-ORG-001 [ERROR -3]: orchestrator instructions present but contain no delegation logic
  (none of: "delegate to", "route to", "send to", "use [", "forward to", "escalate to")
CA-ORG-002 [WARNING -1]: a connected agent exists but its name is not mentioned
  anywhere in the orchestrator instructions
CA-ORG-003 [WARNING -1]: orchestrator instructions don't define fallback for delegation failures
  (none of: "if the agent cannot", "if unable to", "if not handled", "falls back", "cannot resolve")

Section scoring: start at 10, apply all penalties across all agents and orchestrator checks, minimum 0.
Report raw score as "score", 10 as "maxScore".

## Semantic Delegation Evaluation (per connected agent, score each 1–5)

Capability Clarity (1–5): Does the orchestrator have enough info to correctly delegate a valid request?
  1 = Only agent name given, no capability clues
  3 = Domain mentioned but specific capabilities unclear
  5 = 3+ specific capability areas named with example request types

Boundary Clarity (1–5): Does the orchestrator know what this agent CANNOT or SHOULD NOT handle?
  1 = No boundaries whatsoever
  3 = Implicit boundaries only
  5 = Explicit "not for X" or "use [Agent] only for Y" stated

For any dimension < 3, generate a suggestedRewrite:
"Handles [capability 1], [capability 2], and [capability 3]. Use when the user asks about
[example domain A] or [example domain B]. NOT for [explicit out-of-scope] — use [other agent/team] for that."

## Coverage Gap Check
Based on the orchestrator instructions, identify any delegation paths described that no connected
agent description adequately covers. Report these as CA-GAP warnings.

## Mandatory Output
Call report_assessment with section = "connected_agents".
Encode semantic scores: "AgentName [CapClarity:N BoundClarity:N]"`;

export async function runConnectedAgentsAgent(
  client: Anthropic,
  project: AgentProject,
  model: string
): Promise<SectionResult> {
  const connectedAgents = project.bot?.connectedAgents ?? [];
  const connectedYaml = connectedAgents.length > 0
    ? yaml.dump({ connectedAgents }, { indent: 2, lineWidth: 120 })
    : '(none)';

  const userContent = `## Assess Connected Agents Configuration

Orchestrator: ${project.bot?.name ?? 'Unknown'}

Orchestrator instructions:
${project.bot?.instructions ?? '(none)'}

Connected agents (${connectedAgents.length}):
${connectedYaml}

Apply all rule-based checks and semantic evaluation, then call report_assessment.`;

  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools: [ASSESSMENT_TOOL],
    tool_choice: { type: 'any' },
    messages: [{ role: 'user', content: userContent }],
  });

  return extractResult(response, 'connected_agents', 10);
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
