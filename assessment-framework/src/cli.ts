#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { parseAgentProject } from './parsers/mcs-parser';
import { runOrchestrator } from './orchestrator';
import { formatReport, type OutputFormat } from './reporter';

const program = new Command();

program
  .name('mcs-assess-sdk')
  .description('Assess a Copilot Studio agent using 4 parallel Claude specialist agents (requires ANTHROPIC_API_KEY)')
  .version('1.0.0')
  .requiredOption('--path <agentPath>', 'Path to the cloned agent directory containing .mcs.yaml files')
  .option('--format <fmt>', 'Output format: console | json | markdown', 'console')
  .option('--output <file>', 'Write report to a file instead of stdout')
  .option('--model <model>', 'Claude model to use for assessments', 'claude-opus-4-6')
  .option('--fail-below <score>', 'Exit code 1 if overall score is below this threshold (for CI gates)', parseInt)
  .action(async (options: {
    path: string;
    format: string;
    output?: string;
    model: string;
    failBelow?: number;
  }) => {
    // ── Validate env ───────────────────────────────────────────────────────
    if (!process.env['ANTHROPIC_API_KEY']) {
      console.error(chalk.red('Error: ANTHROPIC_API_KEY environment variable is not set.'));
      console.error(chalk.dim('Set it with: export ANTHROPIC_API_KEY=sk-ant-...'));
      process.exit(1);
    }

    const validFormats: OutputFormat[] = ['console', 'json', 'markdown'];
    if (!validFormats.includes(options.format as OutputFormat)) {
      console.error(chalk.red(`Error: --format must be one of: ${validFormats.join(', ')}`));
      process.exit(1);
    }

    const agentPath = path.resolve(options.path);
    if (!fs.existsSync(agentPath)) {
      console.error(chalk.red(`Error: Path does not exist: ${agentPath}`));
      process.exit(1);
    }
    if (!fs.statSync(agentPath).isDirectory()) {
      console.error(chalk.red(`Error: Path is not a directory: ${agentPath}`));
      process.exit(1);
    }

    // ── Parse ──────────────────────────────────────────────────────────────
    if (options.format === 'console') {
      console.log(chalk.dim(`Parsing: ${agentPath}`));
    }

    let project;
    try {
      project = await parseAgentProject(agentPath);
    } catch (err) {
      console.error(chalk.red('Parse error:'), err instanceof Error ? err.message : String(err));
      process.exit(1);
    }

    if (options.format === 'console') {
      const botLabel = project.bot ? `Bot: ${project.bot.name}` : 'No Bot document!';
      console.log(chalk.dim(
        `Found: ${botLabel} | ${project.topics.length} topics | ` +
        `${project.actions.length} actions | ` +
        `${project.bot?.connectedAgents?.length ?? 0} connected agents`
      ));
      if (project.parseErrors.length > 0) {
        console.log(chalk.yellow(`  ⚠️  ${project.parseErrors.length} parse error(s)`));
      }
      console.log(chalk.dim('Running 4 parallel assessments via Claude Agent SDK...\n'));
    }

    // ── Assess ─────────────────────────────────────────────────────────────
    let report;
    try {
      report = await runOrchestrator(project, { model: options.model });
    } catch (err) {
      console.error(chalk.red('Assessment failed:'), err instanceof Error ? err.message : String(err));
      process.exit(1);
    }

    // ── Output ─────────────────────────────────────────────────────────────
    const output = formatReport(report, options.format as OutputFormat);

    if (options.output) {
      const outputPath = path.resolve(options.output);
      fs.writeFileSync(outputPath, output, 'utf8');
      if (options.format === 'console') {
        console.log(chalk.green(`Report written to: ${outputPath}`));
      }
    } else {
      console.log(output);
    }

    // ── CI exit code ───────────────────────────────────────────────────────
    if (options.failBelow !== undefined && report.overallScore < options.failBelow) {
      if (options.format === 'console') {
        console.error(chalk.red(`\nFailed: score ${report.overallScore} is below threshold ${options.failBelow}`));
      }
      process.exit(1);
    }
  });

program.parseAsync(process.argv).catch(err => {
  console.error(chalk.red('Fatal error:'), err instanceof Error ? err.message : String(err));
  process.exit(1);
});
