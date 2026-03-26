# Copilot Studio Agent Assessment

Assess a Microsoft Copilot Studio (MCS) agent against generative orchestration best practices.

## Usage

```
/assess-mcs-agent <path-to-agent-directory>
```

**Example:** `/assess-mcs-agent ./my-hr-agent`

The path should point to a directory cloned via the Copilot Studio VS Code extension, containing `.mcs.yaml` / `.mcs.yml` files.

---

## Instructions

When this skill is invoked with `$ARGUMENTS` as the agent directory path:

### Step 1 — Discover Files

Use the Glob tool to find all YAML files in the provided path:
- Pattern: `**/*.mcs.yaml` and `**/*.mcs.yml`
- Exclude: `node_modules/`

List the discovered files to the user, then read each one.

### Step 2 — Parse and Classify

Read every discovered YAML file. Classify each by its `kind` field:

| kind value | What it represents |
|---|---|
| `Bot` | Main agent configuration (agent.mcs.yaml) |
| `AdaptiveDialog` | A topic (uses `beginDialog` for trigger config) |
| `Topic` | A topic (alternate schema — uses `trigger` field) |
| `Action` | A tool/connector action |
| `ConnectorAction` | A connector-based tool |
| `FlowAction` | A Power Automate flow action |

Collect these groups:
- **bot** — the single `kind: Bot` document (expect one; warn if multiple or none)
- **topics** — all `AdaptiveDialog` or `Topic` documents
- **actions** — all `Action`, `ConnectorAction`, or `FlowAction` documents

Note any files that could not be parsed (invalid YAML, unexpected structure) and list them as parse errors in the report.

### Step 3 — Run Assessment Rules

Apply all rules below. For each finding, record:
- **Severity**: `ERROR` (critical, -3 pts) | `WARNING` (should fix, -1 pt) | `INFO` (suggestion, 0 pts)
- **Message**: Clear, actionable description

---

## Assessment Rules

### A. Agent Instructions (Bot document)

Assess the `instructions` field of the `kind: Bot` document.

| Rule | Severity | Condition |
|------|----------|-----------|
| Instructions missing | ERROR | `instructions` field absent or empty |
| Instructions too long (critical) | ERROR | `instructions` length > 8000 characters |
| Instructions too long | WARNING | `instructions` length > 4000 characters |
| Instructions too short | WARNING | `instructions` length < 200 characters |
| No Markdown formatting | WARNING | No headings (`# ` or `## `), no bold (`**`), no bullet lists (`- ` or `* `) found |
| No persona/role defined | WARNING | None of these phrases found (case-insensitive): `you are`, `your role`, `act as`, `you help`, `you assist`, `as an assistant`, `as a ` |
| No fallback behavior | WARNING | None of these phrases found (case-insensitive): `if not found`, `if you don't`, `if unable`, `cannot find`, `if no `, `otherwise`, `if the answer` |
| Citation override attempt | WARNING | Any of these found (case-insensitive): `do not cite`, `don't cite`, `no citations`, `without citations`, `suppress citation`, `hide citation`, `don't show sources` |
| Tool name mismatch | WARNING | Any `[ToolName]` or `[TopicName]` reference in instructions where the name (case-sensitive) does not match any actual action/topic name found in the agent files. Report the mismatched name and suggest the closest match. |

Also assess the `description` field:

| Rule | Severity | Condition |
|------|----------|-----------|
| Agent description missing | INFO | `description` field absent or empty |
| Agent description too short | WARNING | `description` present but < 50 characters |

**Scoring:** Start at 10/10. Each ERROR: -3. Each WARNING: -1. Minimum 0.

---

### B. Topics

Assess each topic individually. Topics may use **two possible YAML schemas**:

**Schema A — `kind: AdaptiveDialog`** (VS Code extension format):
```yaml
kind: AdaptiveDialog
beginDialog:
  kind: OnRecognizedIntent    # classic mode
  description: "..."          # generative mode description
  triggerQueries:             # classic mode phrases
    - "phrase 1"
```

**Schema B — `kind: Topic`** (alternative format):
```yaml
kind: Topic
name: TopicName
description: "..."
trigger:
  type: AgentChooses          # generative mode
  description: "..."
  phrases:                    # classic mode
    - "phrase 1"
```

**Trigger type detection:**
- **Generative mode** (`AgentChooses`): Schema A → `beginDialog.kind` is NOT `OnRecognizedIntent` (look for description-based trigger), OR Schema B → `trigger.type == 'AgentChooses'`
- **Classic mode**: Schema A → `beginDialog.kind == 'OnRecognizedIntent'` with `triggerQueries`, OR Schema B → `trigger.type == 'UserTypesAMessage'` with `phrases`
- **Special triggers** (do not flag as missing trigger): `OnConversationStart`, `OnUnknownIntent`, `OnRedirect` — these are system triggers and don't need descriptions

**Topic name:** Use `name` field if present; otherwise use the YAML filename without extension.

Apply these rules per topic:

| Rule | Severity | Condition |
|------|----------|-----------|
| Topic description missing | ERROR | `description` field absent or empty (both root-level and `beginDialog.description` if applicable) |
| Topic description too vague | ERROR | Description present but < 20 characters |
| Topic description too short | WARNING | Description present but 20–49 characters |
| No example queries | WARNING | Description doesn't contain any of: `e.g.`, `example`, `such as`, `for example`, `when user asks`, `like `, `queries about`, `questions about` |
| Topic name has period | ERROR | Topic name contains `.` (prevents solution export) |
| No trigger defined | WARNING | No trigger/beginDialog found (unless topic is a system topic like Greeting, Goodbye, Escalate, Error, or Fallback) |
| [Generative] Trigger description missing | ERROR | Generative-mode topic has no trigger description |
| [Generative] Trigger description too short | WARNING | Trigger description < 30 characters |
| [Classic] Too few trigger phrases | WARNING | < 3 trigger phrases |
| [Classic] Duplicate trigger phrases | WARNING | Duplicate phrases found (case-insensitive) |
| [Classic] Unvaried trigger phrases | WARNING | > 60% of phrases start with the same word |
| Similar to another topic | WARNING | This topic's description has Jaccard word-similarity > 0.65 with another topic's description (report both topic names) |

**Jaccard similarity**: Split descriptions into word sets, compute `|intersection| / |union|`. Only flag the second topic in the pair to avoid duplicate warnings.

**Scoring per topic:** Start at 10/10. Each ERROR: -3. Each WARNING: -1. Minimum 0.

**Section total:** Sum of all topic scores / (topics × 10) × 40 points.

---

### C. Tools / Actions

Assess each action (`kind: Action`, `ConnectorAction`, or `FlowAction`).

| Rule | Severity | Condition |
|------|----------|-----------|
| Action description missing | ERROR | `description` field absent or empty |
| Action description too brief | ERROR | Description present but < 30 characters |
| Action description short | WARNING | Description 30–59 characters |
| No "when to use" guidance | WARNING | Description (lowercase) contains none of: `use when`, `use this`, `call when`, `invoke when`, `to get`, `to retrieve`, `retrieves`, `returns`, `fetches`, `when the user`, `when user` |
| No return value described | WARNING | Description (lowercase) contains none of: `returns`, `retrieves`, `gets`, `fetches`, `provides`, `gives`, `outputs`, `result` |
| Input parameters undocumented | WARNING | `inputs` / `parameters` array has entries, but none have a `description` field |
| Individual param undocumented | INFO | Specific input parameter is missing its `description` field |

**Scoring per action:** Start at 10/10. Each ERROR: -3. Each WARNING: -1. Minimum 0.

**Section total:** Sum of all action scores / (actions × 10) × 30 points.

---

### D. Connected Agents

Connected agents appear as a `connectedAgents` array in the `kind: Bot` document, OR as references in topic nodes that invoke another agent. Check the bot document's `connectedAgents` field.

| Rule | Severity | Condition |
|------|----------|-----------|
| Description missing | ERROR | Connected agent has no `description` |
| Description too short | WARNING | Description present but < 50 characters |
| No capabilities listed | WARNING | Description (lowercase) doesn't include any of: `handles`, `manages`, `responsible for`, `queries`, `requests about`, `related to`, `including`, `specializes in` |
| No delegation boundaries | WARNING | Description (lowercase) doesn't include any of: `only`, `exclusively`, `all `, `any `, `when`, `for `, `such as` |

**Scoring:** Start at 10/10 for the section. Each ERROR across all connected agents: -3. Each WARNING: -1. Minimum 0.

If no connected agents are configured, award full 10/10 with note: "No connected agents configured (single-agent setup)."

---

### E. Parse Errors

For each file that could not be parsed: -2 points from overall score (max -10).

---

## Step 4 — Compute Overall Score

```
Overall = Agent Instructions (out of 10)
        + Topics section (normalized to 40)
        + Actions section (normalized to 30)
        + Connected Agents (out of 10)
        + Parse error penalty (max -10)
```

If a category has **no items** (e.g., no actions, no topics), exclude it from scoring and renormalize the remaining categories to sum to 100:
- No topics: redistribute 40 pts proportionally to actions (30→52) and agent (10→17) and connected agents (10→17), rounding to sum to 100.
- No actions: redistribute 30 pts similarly.
- If both absent: agent instructions = 70, connected agents = 30.

**Rating:**
- 80–100 → **PASS** ✅
- 60–79 → **NEEDS IMPROVEMENT** ⚠️
- 0–59 → **POOR** ❌

---

## Step 5 — Output the Report

Format the report as follows. Use markdown headers and emoji for readability.

---

```
═══════════════════════════════════════════════════
  COPILOT STUDIO AGENT ASSESSMENT REPORT
═══════════════════════════════════════════════════
  Agent  : <agent name from bot.name, or directory name>
  Path   : <resolved path>
  Date   : <today's date>

  OVERALL SCORE: XX/100  [PASS / NEEDS IMPROVEMENT / POOR]
═══════════════════════════════════════════════════

── A. AGENT INSTRUCTIONS ──────────────────── XX/10

  ✅ / ⚠️ / ❌  <finding message>
  ...

── B. TOPICS (<N> topics) ─────────────────── XX/40

  [XX/10]  TopicName
    ✅ / ⚠️ / ❌  <finding>
    ...

  [XX/10]  AnotherTopic
    ...

── C. TOOLS / ACTIONS (<N> tools) ─────────── XX/30

  [XX/10]  ToolName
    ✅ / ⚠️ / ❌  <finding>
    ...

── D. CONNECTED AGENTS (<N> agents) ─────────  XX/10

  [XX/10]  AgentName
    ✅ / ⚠️ / ❌  <finding>

── SUMMARY TABLE ────────────────────────────────

  | Section                    | Score  | ERRORs | WARNINGs |
  |----------------------------|--------|--------|----------|
  | A. Agent Instructions      | XX/10  |   N    |    N     |
  | B. Topics (N topics)       | XX/40  |   N    |    N     |
  | C. Tools/Actions (N tools) | XX/30  |   N    |    N     |
  | D. Connected Agents (N)    | XX/10  |   N    |    N     |
  | **TOTAL**                  | **XX/100** |  N  |   N   |

── TOP RECOMMENDATIONS ─────────────────────────

  🔴 HIGH  [ErrorMessage]  →  [How to fix]
  🔴 HIGH  ...
  🟡 MED   [WarningMessage]  →  [How to fix]
  🟡 MED   ...
  🔵 INFO  [InfoMessage]
```

---

### Recommendations Priority

List up to 10 recommendations, sorted:
1. ERRORs first (prefix `🔴 HIGH`)
2. WARNINGs second (prefix `🟡 MED`)
3. INFOs last (prefix `🔵 INFO`)

For each recommendation include:
- Which component has the issue (agent name, topic name, action name)
- What the problem is
- A concrete suggestion for how to fix it (1 sentence)

---

### Best Practice Reference Card

At the end of the report, append this reference for the developer:

```
── BEST PRACTICE QUICK REFERENCE ────────────────

Agent Instructions:
  • Use Markdown (#, ##, **, -) to structure instructions
  • Define persona: "You are an X that helps Y with Z"
  • Name tools exactly as configured: [ExactToolName]
  • Include fallback: "If information is not found, tell the user..."
  • Keep under 4000 chars for best performance

Topic Descriptions (critical for generative routing):
  • Be specific: describe WHEN to invoke, not just what it is
  • Include examples: "e.g., when user asks 'what is my leave balance?'"
  • Avoid near-identical descriptions across topics
  • For generative mode: fill in the trigger description field

Tool/Action Descriptions:
  • Format: "[What it returns] when [when to use it]"
  • Example: "Returns employee leave balance. Use when user asks about
    remaining leave days or leave status."
  • Document all input parameters

Connected Agent Descriptions:
  • List specific capabilities: "Handles all inventory queries including
    stock levels, reorder requests, and warehouse locations"
  • Define boundaries: "Use only for inventory-related requests"

Multi-Agent Setup:
  • Orchestrator agent: clear instructions on what to delegate vs handle locally
  • Child/connected agents: focused scope, well-defined boundaries
  • Test handoff flows: ensure context passes correctly between agents

References:
  • https://learn.microsoft.com/en-us/microsoft-copilot-studio/guidance/generative-orchestration
  • https://learn.microsoft.com/en-us/microsoft-copilot-studio/guidance/generative-mode-guidance
  • https://microsoft.github.io/agent-academy/operative/03-multi-agent/
```
