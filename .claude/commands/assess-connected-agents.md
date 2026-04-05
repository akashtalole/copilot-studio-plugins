# Assess Connected Agents

Deep assessment of the multi-agent setup in a Copilot Studio agent directory. Evaluates connected agent descriptions, delegation clarity, orchestration boundaries, and whether the multi-agent architecture is correctly configured for generative orchestration.

## Usage

```
/assess-connected-agents <path-to-agent-directory>
```

---

## Instructions

The argument `$ARGUMENTS` is the path to a cloned Copilot Studio agent directory.

### Step 1 — Read Agent File and Detect Multi-Agent Setup

Use Glob to find all `*.mcs.yaml` / `*.mcs.yml` files in `$ARGUMENTS`. Read the `kind: Bot` file.

Extract:
- `name` — orchestrator agent name
- `description` — orchestrator description
- `instructions` — orchestrator instructions
- `connectedAgents` array — each with `name`, `description`, `endpoint`

Also scan all topic files (`kind: AdaptiveDialog` or `kind: Topic`) for any node types that invoke another agent (e.g., `kind: InvokeAgent`, `kind: RedirectToAgent`, or similar delegation patterns).

If `connectedAgents` is empty/absent AND no topic nodes invoke other agents:
- Report: "This is a single-agent setup. No connected agent assessment needed."
- Provide a brief note on when to consider moving to multi-agent.
- Exit.

---

### Step 2 — Rule-Based Checks (per connected agent)

| Check | Severity | Condition |
|---|---|---|
| Description missing | ERROR | `description` absent or empty |
| Description too short | WARNING | Description < 50 chars |
| No capabilities listed | WARNING | Description lacks: `handles`, `manages`, `responsible for`, `queries`, `requests`, `related to`, `including`, `specializes`, `covers`, `deals with` |
| No delegation boundaries | WARNING | Description lacks: `only`, `exclusively`, `all `, `any `, `when`, `for `, `such as`, `specifically` |
| Not referenced in orchestrator instructions | WARNING | Connected agent name not mentioned in orchestrator's `instructions` field |

**Orchestrator-level checks:**

| Check | Severity | Condition |
|---|---|---|
| Orchestrator instructions don't define delegation rules | ERROR | Orchestrator `instructions` present but contains no delegation logic (no "delegate to", "route to", "send to", "use [AgentName] when") |
| Connected agent not referenced in instructions | WARNING | A connected agent exists but the orchestrator instructions don't mention when to delegate to it |
| No fallback defined for delegation failures | WARNING | Orchestrator instructions don't define what to do if a connected agent cannot handle a request |

---

### Step 3 — Semantic Delegation Quality Analysis

**3a. Delegation Boundary Clarity (per agent pair)**
For each connected agent, evaluate:
- Is the scope of what to delegate **clearly defined**?
- Are there **gaps** — user intents that fall between agents with no clear owner?
- Are there **overlaps** — intents that could be delegated to multiple agents?
- Does the orchestrator instruction tell the agent **when NOT to delegate** (handle locally)?

Identify any gaps or overlaps explicitly.

**3b. Context Continuity Assessment**
For multi-agent setups, evaluate whether the orchestrator's instructions address:
- How to pass context (e.g., user name, session state) to connected agents
- What to do with the response from a connected agent before returning to the user
- Whether the handoff is seamless or requires the user to re-state information

**3c. Architecture Appropriateness (1–5)**
- 5: Multi-agent setup is justified; each agent has a clearly distinct, well-bounded scope; orchestrator has clear delegation rules; no coverage gaps
- 3: Setup is reasonable but has some boundary ambiguity or missing orchestration guidance
- 1: Multi-agent setup adds complexity without clear benefit; agents have overlapping scopes; orchestrator cannot delegate reliably

---

### Step 4 — Per-Connected-Agent Semantic Score (1–5)

**Capability Clarity (1–5)**
- 5: Description precisely lists what this agent handles — specific enough that the orchestrator can unambiguously decide when to delegate
- 3: General capabilities are described but not specific enough for reliable routing
- 1: Description doesn't help the orchestrator know when to use this agent

**Boundary Definition (1–5)**
- 5: Description explicitly defines what this agent handles AND what it doesn't (or what the orchestrator should keep locally)
- 3: Some boundary definition, but edge cases are unclear
- 1: No boundary definition — unclear when to delegate vs handle locally

---

### Step 5 — Suggested Improvements

For any connected agent scoring < 3 in Capability Clarity or Boundary Definition, generate a suggested improved description:

```yaml
# ConnectedAgent: <AgentName> — suggested improvement
connectedAgents:
  - name: <AgentName>
    description: >
      Handles all [domain] requests including [specific capabilities listed].
      Use when the user asks about [specific topics]. Do not delegate
      [exclusions] — handle those directly.
```

Also, if the orchestrator delegation instructions are missing or weak, suggest the specific text to add to the agent instructions.

---

### Step 6 — Multi-Agent Architecture Checklist

Run through this checklist and report pass/fail for each:

- [ ] Every connected agent has a clear, specific description (> 50 chars with capabilities)
- [ ] Orchestrator instructions explicitly state when to delegate to each agent
- [ ] Delegation boundaries are non-overlapping
- [ ] No coverage gaps (user intents with no clear agent owner)
- [ ] Fallback defined for when a connected agent cannot help
- [ ] Context passing is addressed (if relevant)
- [ ] Each connected agent has a distinct, justified scope (not just "everything else")

---

### Step 7 — Output Report

```
═══════════════════════════════════════════════════
  CONNECTED AGENTS ASSESSMENT
  Orchestrator: <name>  |  Connected agents: <N>
═══════════════════════════════════════════════════

ORCHESTRATOR DELEGATION RULES:
  ✅ / ⚠️ / ❌  <finding>

PER-AGENT RESULTS:

  ── [XX/10]  AgentName
    Rule findings:
      ✅ / ⚠️ / ❌  <message>
    Semantic scores:
      Capability Clarity  : ★★★★☆ (4/5)
      Boundary Definition : ★★☆☆☆ (2/5)
    [Suggested improvement if needed]

DELEGATION BOUNDARY ANALYSIS:
  ⚠️  Gap detected: No agent clearly handles queries about X
  ⚠️  Overlap: Both "AgentA" and "AgentB" could handle Y queries
  ✅  Boundaries are clearly defined

ARCHITECTURE CHECKLIST:
  ✅  Every agent has specific description
  ❌  Orchestrator instructions missing delegation rules
  ⚠️  No fallback for delegation failures
  ...

ARCHITECTURE SCORE: ★★★☆☆ (3/5)

SECTION SCORE: XX/10

TOP RECOMMENDATIONS:
  🔴 HIGH  <error + fix>
  🟡 MED   <warning + fix>
  🔵 INFO  Consider adding context-passing guidance to orchestrator instructions
```
