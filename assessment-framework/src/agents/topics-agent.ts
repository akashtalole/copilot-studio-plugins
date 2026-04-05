import Anthropic from '@anthropic-ai/sdk';
import * as yaml from 'js-yaml';
import type { AgentProject } from '../types/mcs-schema';
import { ASSESSMENT_TOOL, type SectionResult } from '../types/assessment';

const SYSTEM_PROMPT = `You are a specialist assessor for Microsoft Copilot Studio topic routing quality.
Your role is to assess all TOPICS in a Copilot Studio agent for generative orchestration best practices.

## YAML Schema Notes
Topics may use two schemas:
- Schema A (kind: AdaptiveDialog): trigger config in beginDialog
  - Classic mode: beginDialog.kind == 'OnRecognizedIntent' with triggerQueries[]
  - Generative mode: other beginDialog.kind (e.g. OnChosenByAgent) with description
- Schema B (kind: Topic): trigger config in trigger.type
  - Classic: trigger.type == 'UserTypesAMessage' with phrases[]
  - Generative: trigger.type == 'AgentChooses' with description
- System topics (skip trigger rules): OnConversationStart, OnUnknownIntent, OnRedirect, Greeting, Goodbye, Escalate

## Rule-Based Checks (per topic)

TOPIC-001 [ERROR -3]: description absent or empty
TOPIC-002 [ERROR -3]: description present but < 20 characters
TOPIC-003 [WARNING -1]: description 20–49 characters
TOPIC-004 [WARNING -1]: description has no example queries (none of: "e.g.", "example", "such as", "for example", "when user asks", "like ", "queries about", "questions about")
TOPIC-005 [ERROR -3]: topic name contains "." (prevents solution export)
TOPIC-006 [WARNING -1]: no trigger or beginDialog found (non-system topic)
TOPIC-007 [ERROR -3]: generative-mode topic has no trigger description
TOPIC-008 [WARNING -1]: generative trigger description < 30 characters
TOPIC-009 [WARNING -1]: classic mode with < 3 trigger phrases
TOPIC-010 [WARNING -1]: duplicate trigger phrases (case-insensitive)
TOPIC-011 [WARNING -1]: > 60% of classic phrases start with the same word
TOPIC-012 [WARNING -1]: topic description has high Jaccard word-similarity (> 0.65) with another topic

Jaccard similarity: split descriptions into word sets, compute |intersection| / |union|. Only flag the second topic in a pair.

Per-topic scoring: start at 10, apply penalties, minimum 0.
Section score: sum of all per-topic scores / (topicCount × 10) × 40.
Report raw sum as "score", (topicCount × 10) as "maxScore".

## Semantic Routing Evaluation (per topic, score each 1–5)

For EACH topic, evaluate these dimensions and embed them in the finding component field:

Specificity (1–5): Could an LLM router distinguish this topic from a generic "help me" request?
  1 = So vague any request matches; 3 = Domain clear but intent boundary fuzzy; 5 = Precise, never false-positives

Clarity (1–5): Is it immediately obvious what user utterances activate this topic vs adjacent topics?
  1 = Multiple topics could match the same utterance; 5 = Zero ambiguity

Uniqueness vs Other Topics (1–5): Given all other topics, would an LLM reliably choose THIS topic?
  1 = Another topic is nearly identical in scope; 5 = Clearly distinguished from all peers

For any dimension < 3, generate a suggestedRewrite in the finding using this pattern:
"[What this handles]. Use when [specific condition], e.g. '[example utterance 1]' or '[example utterance 2]'. NOT for [disambiguation note]."

## Cross-Topic Routing Analysis
After per-topic checks, identify topic pairs where routing ambiguity is likely (Jaccard > 0.5 OR Uniqueness < 3).
Report these as TOPIC-012 warnings on the second topic in the pair.

## Mandatory Output
Call report_assessment with section = "topics".
For per-topic semantic scores, encode in the component field:
  "TopicName [Spec:N Clarity:N Unique:N]"`;

export async function runTopicsAgent(
  client: Anthropic,
  project: AgentProject,
  model: string
): Promise<SectionResult> {
  const topicsYaml = project.topics
    .map(({ topic }) => yaml.dump(topic, { indent: 2, lineWidth: 120 }))
    .join('\n---\n');

  const userContent = `## Assess These Topics

Total topics: ${project.topics.length}

${project.topics.length === 0 ? 'NO TOPICS FOUND — return score 0, maxScore 0, with an info finding.' : topicsYaml}

Apply all rule-based checks and semantic scoring, then call report_assessment.`;

  const response = await client.messages.create({
    model,
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    tools: [ASSESSMENT_TOOL],
    tool_choice: { type: 'any' },
    messages: [{ role: 'user', content: userContent }],
  });

  return extractResult(response, 'topics', project.topics.length * 10);
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
