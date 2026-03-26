# Copilot Studio Plugins

A collection of Claude Code skills and tools for Microsoft Copilot Studio (MCS) agent development.

---

## Plugins

### `/assess-mcs-agent` — Agent Assessment Skill

Assesses a cloned Copilot Studio agent against **generative orchestration best practices**.
Reads all `.mcs.yaml` files and produces a scored report with actionable recommendations.

#### What it assesses

| Component | What is checked |
|-----------|----------------|
| **Agent Instructions** | Presence, length, Markdown formatting, persona definition, fallback behaviour, tool name accuracy, citation-override attempts |
| **Topics** | Description quality, trigger configuration (generative & classic), example queries, uniqueness across topics, topic name validity |
| **Tools / Actions** | Description clarity, "when to use" guidance, return value documentation, parameter descriptions |
| **Connected Agents** | Description completeness, capability listing, delegation boundaries |

Supports both **single-agent** and **multi-agent** setups with connected agents.

#### How to use

1. **Clone your Copilot Studio agent** using the [VS Code extension](https://learn.microsoft.com/en-us/microsoft-copilot-studio/visual-studio-code-extension-overview):
   ```
   # In VS Code, open Command Palette → "Copilot Studio: Clone Agent"
   # This produces a directory of .mcs.yaml files
   ```

2. **Open the agent directory** in a project with Claude Code.

3. **Run the skill** in Claude Code:
   ```
   /assess-mcs-agent ./path/to/your-agent
   ```

#### Output example

```
═══════════════════════════════════════════════════
  COPILOT STUDIO AGENT ASSESSMENT REPORT
═══════════════════════════════════════════════════
  Agent  : HR Assistant
  Path   : ./hr-assistant
  Date   : 2026-03-26

  OVERALL SCORE: 84/100  [PASS]
═══════════════════════════════════════════════════

── A. AGENT INSTRUCTIONS ──────────────────── 9/10
  ✅ Instructions present (1,240 chars)
  ✅ Markdown formatting detected
  ✅ Persona defined ("You are an HR assistant...")
  ✅ Fallback behaviour defined
  ⚠️  Tool reference [GetLeave] not found — did you mean [GetLeaveBalance]?

── B. TOPICS (3 topics) ─────────────────── 34/40
  [10/10]  LeaveBalance
    ✅ Description specific and includes examples
    ✅ Classic trigger with 6 varied phrases

  [10/10]  SubmitLeaveRequest
    ✅ Clear trigger with example queries

  [7/10]   HRPolicyLookup
    ⚠️  Description lacks example queries
    ✅ Classic trigger with 7 varied phrases

── TOP RECOMMENDATIONS ─────────────────────────
  🟡 MED   Fix tool reference: [GetLeave] → [GetLeaveBalance]
  🔵 INFO  Add example queries to HRPolicyLookup description
```

#### Sample agents

The `sample-agents/` directory contains ready-to-test examples:

| Agent | Description | Purpose |
|-------|-------------|---------|
| `hr-assistant/` | Well-structured HR agent | Tests a near-perfect score |
| `flawed-agent/` | Agent with deliberate issues | Tests all ERROR and WARNING rules |
| `multi-agent-orchestrator/` | Multi-agent setup with connected agents | Tests connected-agent assessment |

Test the skill:
```
/assess-mcs-agent ./sample-agents/hr-assistant
/assess-mcs-agent ./sample-agents/flawed-agent
/assess-mcs-agent ./sample-agents/multi-agent-orchestrator
```

---

## Prerequisites

- [Claude Code](https://claude.ai/code) installed
- Open this repository in Claude Code — the `.claude/commands/` directory is automatically available as slash commands

---

## YAML Schema Reference

The skill handles both YAML schemas produced by the Copilot Studio VS Code extension:

**Topic (AdaptiveDialog schema)**:
```yaml
kind: AdaptiveDialog
name: TopicName
description: "What this topic handles and when to invoke it"
beginDialog:
  kind: OnRecognizedIntent      # classic mode — with triggerQueries
  triggerQueries:
    - trigger phrase 1
    - trigger phrase 2
```

**Action schema**:
```yaml
kind: ConnectorAction           # or Action, FlowAction
name: ActionName
description: "What this action returns and when to use it"
inputs:
  - name: paramName
    description: "What this parameter is for"
```

**Connected agents (in agent.mcs.yaml)**:
```yaml
kind: Bot
connectedAgents:
  - name: SpecialistAgent
    description: "What this agent handles and when to delegate to it"
```

---

## References

- [Generative orchestration guidance](https://learn.microsoft.com/en-us/microsoft-copilot-studio/guidance/generative-orchestration)
- [Configure high-quality instructions](https://learn.microsoft.com/en-us/microsoft-copilot-studio/guidance/generative-mode-guidance)
- [VS Code extension — edit agent components](https://learn.microsoft.com/en-us/microsoft-copilot-studio/visual-studio-code-extension-edit-agent-components)
- [Multi-agent patterns](https://microsoft.github.io/agent-academy/operative/03-multi-agent/)
- [Skills for Copilot Studio](https://github.com/microsoft/skills-for-copilot-studio)
