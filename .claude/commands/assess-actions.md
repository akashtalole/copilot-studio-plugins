# Assess Actions / Tools

Deep assessment of all tools and connector actions in a Copilot Studio agent directory, using rule-based checks and semantic reasoning to evaluate whether the generative orchestrator can reliably select and use each tool.

## Usage

```
/assess-actions <path-to-agent-directory>
```

---

## Instructions

The argument `$ARGUMENTS` is the path to a cloned Copilot Studio agent directory.

### Step 1 — Read All Action Files

Use Glob to find all `*.mcs.yaml` / `*.mcs.yml` files in `$ARGUMENTS`. Read every file with `kind: Action`, `ConnectorAction`, or `FlowAction`.

For each action, extract:
- `name`
- `description`
- `inputs` / `parameters` array (each with `name`, `description`, `type`, `required`)
- `outputs` array if present

Also read the `kind: Bot` agent file — extract the `instructions` field to check for tool references and alignment.

---

### Step 2 — Rule-Based Checks (per action)

| Check | Severity | Condition |
|---|---|---|
| Description missing | ERROR | `description` absent or empty |
| Description too brief | ERROR | Description < 30 chars |
| Description short | WARNING | Description 30–59 chars |
| No "when to use" guidance | WARNING | Description (lowercase) lacks: `use when`, `use this`, `call when`, `invoke when`, `to get`, `to retrieve`, `retrieves`, `returns`, `fetches`, `when the user`, `when user`, `to find` |
| No return value described | WARNING | Description (lowercase) lacks: `returns`, `retrieves`, `gets`, `fetches`, `provides`, `gives`, `outputs`, `result`, `list of`, `details of` |
| Input params undocumented | WARNING | `inputs` has entries but none have a `description` field |
| Specific param undocumented | INFO | Individual input is missing `description` |
| Not referenced in agent instructions | INFO | Tool name does not appear in the agent's `instructions` field (in brackets `[ToolName]` or plain text) |

---

### Step 3 — Cross-Tool Semantic Differentiation Analysis

Given the **full set of all actions**, analyse:

**3a. Tool Selection Ambiguity**
For each pair of tools, evaluate: "Could the orchestrator confuse when to use Tool A vs Tool B?"

Flag pairs where:
- Descriptions overlap (similar verbs: "gets", "retrieves" + similar nouns)
- The "when to use" conditions are not clearly differentiated
- A user query could plausibly trigger either tool

**3b. Coverage vs Agent Instructions Alignment**
Cross-check: Does every tool referenced in the agent's `instructions` field actually exist as an action? If the instructions say "use [GetLeaveBalance]" but that action doesn't exist (or is named differently), flag it.

Also: Are there actions that are never mentioned in the agent instructions? These are orphaned tools the orchestrator may never invoke.

**3c. Tool Set Score (1–5)**
- 5: Every tool is clearly differentiated; descriptions precisely define when to invoke; all tools are referenced in instructions
- 3: Most tools are clear but 1–2 have ambiguous descriptions or missing use conditions
- 1: Multiple tools with overlapping or missing descriptions; orchestrator cannot reliably select tools

---

### Step 4 — Per-Action Semantic Quality Score (1–5 each)

**Selection Precision (1–5)**
- 5: Description makes it unambiguous when the orchestrator should invoke this tool (clear trigger condition + return value)
- 3: General purpose is clear but ambiguous in edge cases
- 1: Description does not give enough context for reliable selection

**Parameter Guidance (1–5)**
- 5: Every input parameter has a description; required fields are marked; data types are specified
- 3: Some parameters documented
- 1: No parameter documentation at all

---

### Step 5 — Suggested Rewrites

For any action scoring < 3 in Selection Precision, generate an improved description following this pattern:

> "[Returns/Retrieves/Gets] [what it returns]. Use [when/this when] [specific user intent or condition]. [Optional: Do NOT use when X.]"

Example:
```yaml
# Action: GetOrderHistory — suggested improvement
description: >
  Retrieves the complete order history for a customer including order IDs,
  dates, items, and statuses. Use when the user asks about past orders,
  previous purchases, or order history. Returns a list of orders sorted
  by date descending.
```

---

### Step 6 — Output Report

```
═══════════════════════════════════════════════════
  TOOLS / ACTIONS ASSESSMENT  (<N> tools found)
  Agent path: <path>
═══════════════════════════════════════════════════

PER-TOOL RESULTS:

  ── [XX/10]  ToolName
    Rule findings:
      ✅ / ⚠️ / ❌  <message>
    Semantic scores:
      Selection Precision : ★★★★☆ (4/5)
      Parameter Guidance  : ★★★☆☆ (3/5)
    [Suggested rewrite if needed]

CROSS-TOOL ANALYSIS:
  ⚠️  Selection ambiguity: "GetOrders" vs "GetOrderHistory" — overlapping descriptions
  ⚠️  Orphaned tool: "UpdateUser" not referenced in agent instructions
  ⚠️  Missing tool: Instructions reference [GetLeave] but no such action found
  ✅  All tools are clearly differentiated

TOOL SET SCORE: ★★★☆☆ (3/5) — <summary>

SECTION SCORE: XX/30

TOP RECOMMENDATIONS:
  🔴 HIGH  <error + fix>
  🟡 MED   <warning + fix>
```
