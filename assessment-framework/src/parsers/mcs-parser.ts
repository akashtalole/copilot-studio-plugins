import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { glob } from 'glob';
import type { AgentProject, McsBot, McsTopic, McsAction, McsResource } from '../types/mcs-schema';

const TOPIC_KINDS = new Set(['AdaptiveDialog', 'Topic']);
const ACTION_KINDS = new Set(['Action', 'ConnectorAction', 'FlowAction']);

export async function parseAgentProject(agentPath: string): Promise<AgentProject> {
  const rootPath = path.resolve(agentPath);

  if (!fs.existsSync(rootPath)) {
    throw new Error(`Path does not exist: ${rootPath}`);
  }
  if (!fs.statSync(rootPath).isDirectory()) {
    throw new Error(`Path is not a directory: ${rootPath}`);
  }

  const patterns = ['**/*.mcs.yaml', '**/*.mcs.yml'];
  const files: string[] = [];

  for (const pattern of patterns) {
    const found = await glob(pattern, {
      cwd: rootPath,
      absolute: true,
      ignore: ['**/node_modules/**'],
    });
    files.push(...found);
  }

  // De-duplicate (both patterns may match .mcs.yaml)
  const uniqueFiles = [...new Set(files)];

  const project: AgentProject = {
    rootPath,
    topics: [],
    actions: [],
    parseErrors: [],
  };

  for (const filePath of uniqueFiles) {
    let raw: unknown;
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      raw = yaml.load(content);
    } catch (err) {
      project.parseErrors.push({
        filePath,
        message: err instanceof Error ? err.message : String(err),
      });
      continue;
    }

    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      project.parseErrors.push({ filePath, message: 'File is empty, a scalar, or a list — expected a YAML mapping' });
      continue;
    }

    const doc = raw as Record<string, unknown>;
    const kind = doc['kind'] as string | undefined;

    if (!kind) {
      project.parseErrors.push({ filePath, message: 'Missing required "kind" field' });
      continue;
    }

    if (kind === 'Bot') {
      if (!project.bot) {
        project.bot = doc as unknown as McsBot;
      }
      // If multiple Bot files found, use the one closest to root
    } else if (TOPIC_KINDS.has(kind)) {
      project.topics.push({ filePath, topic: doc as unknown as McsTopic });
    } else if (ACTION_KINDS.has(kind)) {
      project.actions.push({ filePath, action: doc as unknown as McsAction });
    }
    // Other kinds (e.g., settings) are silently skipped
  }

  return project;
}

/** Serialise the project to a human-readable summary for passing to agents */
export function serializeProject(project: AgentProject): string {
  const lines: string[] = [];

  lines.push(`# Agent Project: ${project.bot?.name ?? 'Unknown'}`);
  lines.push(`Root: ${project.rootPath}`);
  lines.push('');

  if (project.bot) {
    lines.push('## Bot (agent.mcs.yaml)');
    lines.push('```yaml');
    lines.push(`name: ${project.bot.name}`);
    if (project.bot.description) lines.push(`description: ${project.bot.description}`);
    if (project.bot.instructions) {
      lines.push(`instructions: |`);
      project.bot.instructions.split('\n').forEach(l => lines.push(`  ${l}`));
    }
    if (project.bot.connectedAgents?.length) {
      lines.push(`connectedAgents:`);
      for (const ca of project.bot.connectedAgents) {
        lines.push(`  - name: ${ca.name}`);
        if (ca.description) lines.push(`    description: ${ca.description}`);
      }
    }
    lines.push('```');
    lines.push('');
  }

  if (project.topics.length) {
    lines.push(`## Topics (${project.topics.length} files)`);
    for (const { filePath, topic } of project.topics) {
      lines.push(`### ${topic.name ?? path.basename(filePath)}`);
      lines.push('```yaml');
      lines.push(yaml.dump(topic, { indent: 2, lineWidth: 120 }).trim());
      lines.push('```');
      lines.push('');
    }
  }

  if (project.actions.length) {
    lines.push(`## Actions / Tools (${project.actions.length} files)`);
    for (const { filePath, action } of project.actions) {
      lines.push(`### ${action.name ?? path.basename(filePath)}`);
      lines.push('```yaml');
      lines.push(yaml.dump(action, { indent: 2, lineWidth: 120 }).trim());
      lines.push('```');
      lines.push('');
    }
  }

  if (project.parseErrors.length) {
    lines.push(`## Parse Errors (${project.parseErrors.length})`);
    for (const e of project.parseErrors) {
      lines.push(`- ${path.relative(project.rootPath, e.filePath)}: ${e.message}`);
    }
  }

  return lines.join('\n');
}
