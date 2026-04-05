# Assess Agent Instructions

Deep assessment of the `instructions` and `description` fields in a Copilot Studio agent's `kind: Bot` document, using both rule-based checks and semantic reasoning.

## Usage

```
/assess-instructions <path-to-agent-directory>
```

---

## Instructions

The argument `$ARGUMENTS` is the path to a cloned Copilot Studio agent directory.

### Step 1 — Read Agent File

Use Glob to find `*.mcs.yaml` / `*.mcs.yml` files in `$ARGUMENTS`. Read the file with `kind: Bot`. Extract:
- `name`
- `description`
- `instructions`
- `connectedAgents[].name` (to cross-check tool references)

Also read all `kind: Action`, `ConnectorAction`, and `FlowAction` files. Collect their `name` values as the **actual tool list**.

Also read all `kind: AdaptiveDialog` or `kind: Topic` files. Collect their `name` (or filename) as the **actual topic list**.

---

### Step 2 — Rule-Based Checks

Apply each rule and record findings:

**Description field:**
| Check | Severity | Condition |
|---|---|---|
| Description missing | WARNING | `description` absent or empty |
| Description too short | WARNING | Description < 50 chars |

**Instructions field:**
| Check | Severity | Condition |
|---|---|---|
| Instructions missing | ERROR | `instructions` absent or empty — if missing, stop and report immediately |
| Instructions too long (critical) | ERROR | Length > 8,000 chars |
| Instructions too long | WARNING | Length > 4,000 chars |
| Instructions too short | WARNING | Length < 200 chars |
| No Markdown formatting | WARNING | No `# `, `## `, `**`, `- `, `* ` found |
| No persona defined | WARNING | None of these (case-insensitive): `you are`, `your role`, `act as`, `you help`, `you assist`, `as an`, `as a ` |
| No fallback behaviour | WARNING | None of these (case-insensitive): `if not found`, `if you don't`, `if unable`, `cannot find`, `if no `, `otherwise`, `if the answer`, `i'm unable`, `i cannot` |
| Citation override attempt | WARNING | Any of: `do not cite`, `don't cite`, `no citations`, `without citations`, `suppress citation`, `hide citation`, `don't show sources`, `no sources` |
| Tool name mismatch | WARNING | Any `[Name]` in instructions where `Name` does not exactly match any actual tool/action name (case-sensitive). Report mismatched name + closest match from actual list. |

---

### Step 3 — Semantic Scoring

After the rule checks, reason semantically about the instructions quality. Score each dimension 1–5:

**1. Persona Clarity (1–5)**
- 5: Agent has a clear, specific persona with defined scope (e.g., "You are an HR assistant for Contoso employees that helps with leave, payroll, and policies")
- 3: Some persona but vague or overly broad
- 1: No persona or completely generic ("You are an AI assistant")

**2. Tool Guidance Quality (1–5)**
- 5: Every tool has a clear explanation of when to use it; tool names match exactly
- 3: Some tools covered, guidance is partial
- 1: No tool guidance, or tools mentioned but without use conditions

**3. Operational Completeness (1–5)**
- 5: Instructions cover: persona, scope, tool usage, edge cases, fallback behaviour, tone
- 3: Covers some areas but missing important sections
- 1: Minimal instructions that would not support reliable generative operation

**4. Generative Orchestration Readiness (1–5)**
- 5: Instructions give the agent enough context to autonomously route and respond without additional human guidance
- 3: Agent could function but may make unpredictable routing decisions
- 1: Instructions are insufficient for generative orchestration

For any dimension scored < 3, provide a **specific suggestion** for improvement.

---

### Step 4 — Suggested Rewrite (if score < 3 in any dimension)

If the instructions have significant gaps, produce a **suggested instructions template** with the specific missing sections filled in, keeping the existing good parts intact. Format it as a code block the developer can copy.

---

### Step 5 — Output Report

```
═══════════════════════════════════════════════════
  AGENT INSTRUCTIONS ASSESSMENT
  Agent: <name>  |  Path: <path>
═══════════════════════════════════════════════════

RULE-BASED FINDINGS:
  ✅ / ⚠️ / ❌  <message>
  ...

SEMANTIC SCORES:
  Persona Clarity          : ★★★★☆ (4/5)  — <one-line reason>
  Tool Guidance Quality    : ★★☆☆☆ (2/5)  — <one-line reason>
  Operational Completeness : ★★★☆☆ (3/5)  — <one-line reason>
  Generative Readiness     : ★★★★☆ (4/5)  — <one-line reason>

SECTION SCORE: XX/10

TOP ISSUES:
  🔴  <most critical issue + fix>
  🟡  <warning + fix>

SUGGESTED IMPROVEMENTS:
  <specific, actionable suggestions>

[SUGGESTED REWRITE — if applicable]
\`\`\`yaml
instructions: |
  # <Agent Name>
  ...improved instructions...
\`\`\`
```
