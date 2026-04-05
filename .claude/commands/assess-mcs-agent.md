# Copilot Studio Agent Assessment (Full Framework)

Comprehensive assessment of a Microsoft Copilot Studio agent against generative orchestration best practices. Orchestrates four specialist assessments in sequence, applies both rule-based and semantic scoring, and produces a consolidated report with prioritised recommendations.

## Usage

```
/assess-mcs-agent <path-to-agent-directory>
```

**Individual area assessments** (can be run standalone):
```
/assess-instructions       <path>   — agent instructions + description only
/assess-topics             <path>   — all topics with routing analysis
/assess-actions            <path>   — all tools/actions with selection analysis
/assess-connected-agents   <path>   — multi-agent setup and delegation quality
```

**Agent SDK parallel orchestrator** (requires ANTHROPIC_API_KEY):
```
cd assessment-framework && npm run assess -- --path <path>
```

---

## Instructions

The argument `$ARGUMENTS` is the path to a cloned Copilot Studio agent directory (output of the Copilot Studio VS Code extension).

---

### Step 1 — Discovery

Use Glob to find all `.mcs.yaml` and `.mcs.yml` files under `$ARGUMENTS`. Read every one. Print a file inventory:
```
Files discovered:
  agent.mcs.yaml          [Bot]
  topics/LeaveBalance.mcs.yaml  [AdaptiveDialog]
  ...
```

If no files are found, stop: "No .mcs.yaml files found. Ensure the path points to a Copilot Studio agent cloned via the VS Code extension."

If no `kind: Bot` file is found, continue but flag it as a critical error in the report.

---

### Step 2 — Run All Four Assessments

Run each assessment area **in full**, applying both rule-based checks AND semantic scoring. Each section follows its specialist assessment logic (see individual skill files for full rule sets and scoring criteria).

**A. Agent Instructions** — follow the full logic from `assess-instructions.md`:
- Rule-based checks for presence, length, markdown, persona, fallback, tool refs, citation override
- Semantic scores: Persona Clarity, Tool Guidance Quality, Operational Completeness, Generative Readiness (each 1–5)
- Suggested rewrites for failing sections

**B. Topics** — follow the full logic from `assess-topics.md`:
- Rule-based checks per topic (description, trigger, phrases, name validity)
- Cross-topic routing disambiguation analysis
- Semantic scores per topic: Specificity, Example Coverage, Trigger Quality (each 1–5)
- Topic Set routing score (1–5)
- Suggested improved descriptions for poorly scored topics

**C. Tools / Actions** — follow the full logic from `assess-actions.md`:
- Rule-based checks per action (description presence, length, when-to-use, params)
- Cross-tool selection ambiguity analysis
- Instructions alignment check (orphaned/missing tools)
- Semantic scores per action: Selection Precision, Parameter Guidance (each 1–5)
- Suggested improved descriptions

**D. Connected Agents** — follow the full logic from `assess-connected-agents.md`:
- Rule-based checks per connected agent and orchestrator delegation rules
- Delegation boundary gap/overlap analysis
- Architecture checklist
- Semantic scores: Capability Clarity, Boundary Definition (each 1–5)
- Suggested improvements to descriptions and orchestrator instructions

---

### Step 3 — Scoring

**Per-item score:** Start at 10. Each `error` finding: -3. Each `warning` finding: -1. Minimum 0.

**Section scores (normalized to weights):**
- A. Agent Instructions: max 10 pts
- B. Topics: `sum(topic scores) / (N × 10) × 40` pts
- C. Actions: `sum(action scores) / (N × 10) × 30` pts
- D. Connected Agents: max 10 pts (full 10 if no connected agents — single-agent setup is valid)

**Semantic bonus/penalty:** The average semantic score across all dimensions in a section adjusts the section total by ±10%:
- Average semantic > 4: +5% to section score
- Average semantic 3–4: no change
- Average semantic < 3: -5% to section score

**Overall score:** Sum of all section scores, clamped to 0–100.

**Rating:**
- 80–100 → **PASS** ✅
- 60–79 → **NEEDS IMPROVEMENT** ⚠️
- 40–59 → **POOR** ❌
- 0–39  → **CRITICAL** 🚨

---

### Step 4 — Consolidated Report

```
╔═══════════════════════════════════════════════════╗
║   COPILOT STUDIO AGENT ASSESSMENT REPORT          ║
╠═══════════════════════════════════════════════════╣
║  Agent  : <name>                                  ║
║  Path   : <resolved path>                         ║
║  Date   : <today>                                 ║
║  Files  : <N> .mcs.yaml files parsed              ║
╠═══════════════════════════════════════════════════╣
║  OVERALL SCORE:  XX/100  [RATING]                 ║
╚═══════════════════════════════════════════════════╝

── A. AGENT INSTRUCTIONS ─────────────────── XX/10 ─

  Rule findings:
    ✅ Instructions present (N chars)
    ✅ Markdown formatting detected
    ❌ Instructions missing persona definition
    ⚠️  Tool reference [GetLeave] not found (closest: GetLeaveBalance)

  Semantic scores:
    Persona Clarity          : ★★☆☆☆ (2/5)
    Tool Guidance Quality    : ★★★★☆ (4/5)
    Operational Completeness : ★★★☆☆ (3/5)
    Generative Readiness     : ★★★☆☆ (3/5)

── B. TOPICS ─────────────────────────────── XX/40 ─

  [XX/10]  LeaveBalance  (classic, 6 phrases)
    ✅ Clear description with examples
    ✅ Varied trigger phrases
    Specificity ★★★★★ | Examples ★★★★☆ | Trigger ★★★★★

  [XX/10]  General  (generative)
    ❌ Description missing trigger description
    ❌ Description too vague: "Helps users"
    Specificity ★☆☆☆☆ | Examples ★☆☆☆☆ | Trigger ★☆☆☆☆

  Cross-topic routing:
    ⚠️  "General" vs "Greeting" — routing ambiguity detected
    ✅  No coverage gaps identified

── C. TOOLS / ACTIONS ───────────────────── XX/30 ─

  [XX/10]  GetLeaveBalance
    ✅ Clear description with return value and when-to-use
    ✅ All input parameters documented
    Selection Precision ★★★★★ | Param Guidance ★★★★★

  [XX/10]  UpdateOrder
    ❌ Description missing
    Selection Precision ★☆☆☆☆ | Param Guidance ★★★☆☆

  Cross-tool:
    ⚠️  "GetOrder" and "GetOrderHistory" have overlapping descriptions
    ⚠️  "UpdateOrder" not referenced in agent instructions

── D. CONNECTED AGENTS ──────────────────── XX/10 ─

  [XX/10]  InventoryAgent
    ⚠️  Description doesn't define delegation boundaries
    Capability Clarity ★★★☆☆ | Boundary Definition ★★☆☆☆

  Architecture checklist:
    ✅  Agent has specific description
    ❌  Orchestrator instructions missing delegation rules
    ⚠️  No fallback for delegation failures

── SUMMARY ─────────────────────────────────────────

  | Section                    | Score   | ERR | WARN | Semantic |
  |----------------------------|---------|-----|------|----------|
  | A. Agent Instructions      |  7/10   |  1  |  2   |  3.0/5   |
  | B. Topics (N)              | 26/40   |  2  |  4   |  2.8/5   |
  | C. Tools/Actions (N)       | 18/30   |  1  |  3   |  3.2/5   |
  | D. Connected Agents (N)    |  6/10   |  1  |  2   |  2.5/5   |
  | **TOTAL**                  | **57/100** | 5 | 11  |  2.9/5   |

── PRIORITISED RECOMMENDATIONS ─────────────────────

  🔴 HIGH  [Topic: General] Description is too vague for generative routing
           → Rewrite to: "Handles general greetings and agent capability queries,
             e.g. 'what can you help me with?' or 'hello'. Do not use for
             domain-specific queries."

  🔴 HIGH  [Topic: General] Missing trigger description for generative mode
           → Add: beginDialog.description: "Use when user sends a greeting or
             asks what the agent can do"

  🔴 HIGH  [Action: UpdateOrder] Description is completely missing
           → Add: "Updates the status or details of an existing order. Use when
             the user wants to modify or cancel an order. Returns updated order."

  🔴 HIGH  [Connected: InventoryAgent] Orchestrator instructions don't define
           when to delegate to this agent
           → Add delegation rules to agent instructions

  🟡 MED   [Instructions] Fix tool reference: [GetLeave] → [GetLeaveBalance]

  🟡 MED   [Instructions] Add persona definition ("You are a...")

  🟡 MED   [Action: GetOrder] Description overlaps with GetOrderHistory
           → Clarify which to use for which scenario

  🔵 INFO  [Instructions] Add fallback behaviour for unresolvable requests

── SUGGESTED REWRITES ──────────────────────────────

  [Only shown for items scoring < 3/5 in any semantic dimension]

  Topic "General":
  \`\`\`yaml
  description: >
    Handles general conversational interactions including greetings, capability
    enquiries, and off-topic questions. Use when the user says hello, asks what
    the agent can help with, or sends a message that doesn't match any specific
    topic, e.g. "hi", "what can you do?", "help me".
  beginDialog:
    description: "Use when the user sends a greeting or asks about agent capabilities"
  \`\`\`

  Action "UpdateOrder":
  \`\`\`yaml
  description: >
    Updates the status or details of an existing customer order. Use when a user
    wants to modify, cancel, or update an order. Requires the order ID and the
    new status or changes to apply. Returns the updated order details.
  \`\`\`

── BEST PRACTICE QUICK REFERENCE ───────────────────

Agent Instructions:
  • Use Markdown (# headings, ** bold, - bullets) to structure guidance
  • Define persona: "You are an X that helps Y with Z"
  • Reference tools exactly: [ExactToolName]
  • Cover fallback: "If information is not found, tell the user..."
  • Keep under 4,000 chars for best performance

Topics (generative orchestration):
  • Description must tell the router WHEN to invoke, not just what it is
  • Include examples: "e.g., 'what is my balance?', 'how many days do I have?'"
  • Avoid near-identical descriptions across topics
  • Generative topics: always fill in trigger description

Tools / Actions:
  • Pattern: "Returns [X]. Use when user asks about [Y]."
  • Document all input parameters with descriptions
  • Differentiate from similar tools in the description

Connected Agents:
  • List specific capabilities: "Handles A, B, and C"
  • Define scope: "Use only for X — do not delegate Y"
  • Orchestrator instructions must explicitly state delegation rules

References:
  • https://learn.microsoft.com/en-us/microsoft-copilot-studio/guidance/generative-orchestration
  • https://learn.microsoft.com/en-us/microsoft-copilot-studio/guidance/generative-mode-guidance
  • https://microsoft.github.io/agent-academy/operative/03-multi-agent/
  • https://github.com/microsoft/skills-for-copilot-studio
```
