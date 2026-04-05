# Assess Topics

Deep assessment of all topics in a Copilot Studio agent directory, using rule-based checks, cross-topic semantic routing analysis, and LLM-powered quality scoring with rewrite suggestions.

## Usage

```
/assess-topics <path-to-agent-directory>
```

---

## Instructions

The argument `$ARGUMENTS` is the path to a cloned Copilot Studio agent directory.

### Step 1 — Read All Topic Files

Use Glob to find all `*.mcs.yaml` / `*.mcs.yml` files in `$ARGUMENTS`. Read every file with `kind: AdaptiveDialog` or `kind: Topic`.

For each topic, extract:
- **Name**: `name` field, or filename without extension if `name` absent
- **Description**: root-level `description` field, or `beginDialog.description`
- **Trigger type**: determine from `beginDialog.kind`:
  - `OnRecognizedIntent` → classic mode (check `triggerQueries`)
  - `OnConversationStart`, `OnUnknownIntent`, `OnRedirect` → system trigger (skip trigger checks)
  - Anything else or absent → likely generative mode (check for description-based trigger)
  - OR from `trigger.type` if using Topic schema: `AgentChooses` = generative, `UserTypesAMessage` = classic
- **Trigger description**: `beginDialog.description` or `trigger.description`
- **Trigger phrases**: `beginDialog.triggerQueries` or `trigger.phrases`

Build the full topic list before assessing any individual topic (needed for cross-topic checks).

---

### Step 2 — Rule-Based Checks (per topic)

Apply these checks to each topic:

| Check | Severity | Condition |
|---|---|---|
| Topic name has period | ERROR | Name contains `.` — breaks solution export |
| Description missing | ERROR | Description absent or empty |
| Description too vague | ERROR | Description < 20 chars |
| Description too short | WARNING | Description 20–49 chars |
| No trigger defined | WARNING | No trigger/beginDialog (unless system topic: Greeting, Goodbye, Escalate, Error, Fallback, OnUnknownIntent) |
| [Generative] Trigger description missing | ERROR | Generative topic, no trigger description |
| [Generative] Trigger description too short | WARNING | Trigger description < 30 chars |
| [Classic] Too few trigger phrases | WARNING | < 3 trigger phrases |
| [Classic] Duplicate phrases | WARNING | Duplicate phrases (case-insensitive) |
| [Classic] Unvaried phrases | WARNING | > 60% start with same first word |
| No example queries | WARNING | Description lacks: `e.g.`, `example`, `such as`, `for example`, `when user asks`, `queries about`, `questions about`, `like ` |

---

### Step 3 — Cross-Topic Semantic Routing Analysis

This is the key LLM-powered check. Given the **full list of all topics and their descriptions**, analyse the routing quality of the entire topic set:

**3a. Routing Disambiguation Test**
For each topic, ask yourself: "If a generative orchestrator sees this description alongside all other topics, would it reliably route to the correct one?"

Identify pairs of topics where routing ambiguity is likely:
- Descriptions that overlap in meaning
- Topics that could be triggered by the same user query
- Vague descriptions that might match too many intents

Report any identified ambiguity pairs with explanation.

**3b. Coverage Gaps**
Based on the agent's topic set, identify any common user intents that no topic clearly covers. These are routing dead zones where the agent would likely fall through to the fallback.

**3c. Topic Set Score (1–5)**
- 5: Every topic is clearly distinguishable; no routing ambiguity; full coverage of apparent agent scope
- 3: Minor ambiguities exist; some topics could be confused
- 1: Multiple routing conflicts; significant coverage gaps

---

### Step 4 — Per-Topic Semantic Quality Score (1–5 each)

For each topic, score:

**Description Specificity (1–5)**
- 5: Precisely describes the user intent it handles, including scope and boundaries
- 3: General idea is clear but lacks precision
- 1: Too vague to be useful for routing

**Example Coverage (1–5)**
- 5: Includes at least 2–3 example user queries, covering different phrasings
- 3: Has one example or implies examples
- 1: No examples whatsoever

**Trigger Quality (1–5)** (generative: trigger description; classic: phrase variety)
- Generative: 5 = trigger description perfectly constrains when to invoke; 1 = no or meaningless trigger description
- Classic: 5 = 5+ varied phrases covering multiple phrasings; 1 = 1–2 very similar phrases

---

### Step 5 — Suggested Rewrites

For any topic scoring < 3 in Specificity or Trigger Quality, generate a **suggested improved description** and/or trigger description as a YAML snippet. Keep the topic's existing intent, just improve the wording.

Format:
```yaml
# Topic: <TopicName>  — suggested improvements
description: >
  <improved description with examples>
# [if generative]
beginDialog:
  description: "Use this topic when <specific condition>"
```

---

### Step 6 — Output Report

```
═══════════════════════════════════════════════════
  TOPICS ASSESSMENT  (<N> topics found)
  Agent path: <path>
═══════════════════════════════════════════════════

PER-TOPIC RESULTS:

  ── [XX/10]  TopicName  (generative / classic)
    Rule findings:
      ✅ / ⚠️ / ❌  <message>
    Semantic scores:
      Specificity    : ★★★★☆ (4/5)
      Example Coverage: ★★☆☆☆ (2/5)
      Trigger Quality : ★★★☆☆ (3/5)
    [Suggested rewrite if needed]

  ── [XX/10]  AnotherTopic  ...

CROSS-TOPIC ROUTING ANALYSIS:
  ⚠️  Routing ambiguity: "TopicA" vs "TopicB" — both handle X queries
  ⚠️  Coverage gap: No topic handles queries about Y
  ✅  No routing conflicts detected

TOPIC SET SCORE: ★★★☆☆ (3/5) — <summary>

SECTION SCORE: XX/40

TOP RECOMMENDATIONS:
  🔴 HIGH  <error finding + fix>
  🟡 MED   <warning + fix>
```
