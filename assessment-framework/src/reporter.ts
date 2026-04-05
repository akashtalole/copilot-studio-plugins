import chalk from 'chalk';
import type { AssessmentReport, SectionResult, Finding } from './types/assessment';

export type OutputFormat = 'console' | 'json' | 'markdown';

export function formatReport(report: AssessmentReport, format: OutputFormat): string {
  switch (format) {
    case 'json': return JSON.stringify(report, null, 2);
    case 'markdown': return formatMarkdown(report);
    default: return formatConsole(report);
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function icon(severity: Finding['severity']): string {
  return { error: '❌', warning: '⚠️ ', info: '✅' }[severity];
}

function ratingLabel(report: AssessmentReport): string {
  const score = `${report.overallScore}/100`;
  switch (report.rating) {
    case 'PASS':             return chalk.green.bold(`${score}  [PASS]`);
    case 'NEEDS IMPROVEMENT':return chalk.yellow.bold(`${score}  [NEEDS IMPROVEMENT]`);
    case 'POOR':             return chalk.red.bold(`${score}  [POOR]`);
    case 'CRITICAL':         return chalk.red.bold(`${score}  [CRITICAL]`);
  }
}

const SECTION_LABELS: Record<string, string> = {
  instructions:     'A. AGENT INSTRUCTIONS',
  topics:           'B. TOPICS',
  actions:          'C. TOOLS / ACTIONS',
  connected_agents: 'D. CONNECTED AGENTS',
};

// ── Console formatter ────────────────────────────────────────────────────────

function formatConsole(r: AssessmentReport): string {
  const lines: string[] = [];
  const bar = chalk.cyan('═'.repeat(52));

  lines.push(bar);
  lines.push(chalk.cyan.bold('  COPILOT STUDIO AGENT ASSESSMENT REPORT'));
  lines.push(bar);
  lines.push(`  Agent  : ${chalk.bold(r.agentName)}`);
  lines.push(`  Path   : ${r.agentPath}`);
  lines.push(`  Date   : ${new Date(r.assessedAt).toLocaleDateString()}`);
  lines.push('');
  lines.push(`  OVERALL SCORE: ${ratingLabel(r)}`);
  lines.push(bar);
  lines.push('');

  // Per-section
  for (const section of r.sections) {
    const label = SECTION_LABELS[section.section] ?? section.section.toUpperCase();
    lines.push(chalk.bold(`── ${label} ${'─'.repeat(Math.max(0, 40 - label.length))} ${section.score}/${section.maxScore}`));
    lines.push('');

    if (section.findings.length === 0) {
      lines.push('  ' + chalk.green('✅  No issues found'));
    } else {
      for (const f of section.findings) {
        const comp = chalk.italic(f.component);
        lines.push(`  ${icon(f.severity)} [${comp}] ${f.message}`);
        if (f.semanticScore !== undefined) {
          lines.push(chalk.dim(`       Semantic: ${f.semanticScore}/5`));
        }
        if (f.suggestedRewrite) {
          lines.push(chalk.dim(`       Suggested rewrite: ${f.suggestedRewrite.slice(0, 120)}${f.suggestedRewrite.length > 120 ? '…' : ''}`));
        }
      }
    }

    // Semantic dimensions
    if (section.semanticDimensions.length > 0) {
      lines.push('');
      lines.push(chalk.dim('  Semantic scores:'));
      for (const d of section.semanticDimensions) {
        const stars = '★'.repeat(d.score) + '☆'.repeat(5 - d.score);
        lines.push(chalk.dim(`    ${d.name.padEnd(28)} ${stars} (${d.score}/5) — ${d.rationale}`));
      }
    }

    // Suggested rewrites
    const rewrites = Object.entries(section.suggestedRewrites);
    if (rewrites.length > 0) {
      lines.push('');
      lines.push(chalk.dim('  Suggested rewrites:'));
      for (const [component, rewrite] of rewrites) {
        lines.push(chalk.dim(`  ↳ ${component}:`));
        rewrite.split('\n').forEach(l => lines.push(chalk.dim(`      ${l}`)));
      }
    }

    lines.push('');
  }

  // Summary table
  lines.push(chalk.bold('── SUMMARY ' + '─'.repeat(41)));
  lines.push('');
  lines.push('  ' + ['Section'.padEnd(28), 'Score'.padEnd(10), 'ERR'.padEnd(6), 'WARN'].join(' | '));
  lines.push('  ' + ['-'.repeat(28), '-'.repeat(10), '-'.repeat(6), '-'.repeat(6)].join('-+-'));

  let totalErr = 0, totalWarn = 0;
  for (const s of r.sections) {
    const label = SECTION_LABELS[s.section] ?? s.section;
    const err = s.findings.filter(f => f.severity === 'error').length;
    const warn = s.findings.filter(f => f.severity === 'warning').length;
    totalErr += err; totalWarn += warn;
    lines.push('  ' + [
      label.padEnd(28),
      `${s.score}/${s.maxScore}`.padEnd(10),
      String(err).padEnd(6),
      String(warn),
    ].join(' | '));
  }
  lines.push('  ' + ['─'.repeat(28), '─'.repeat(10), '─'.repeat(6), '─'.repeat(6)].join('─+─'));
  lines.push('  ' + [
    chalk.bold('TOTAL'.padEnd(28)),
    chalk.bold(`${r.overallScore}/100`.padEnd(10)),
    chalk.bold(String(totalErr).padEnd(6)),
    chalk.bold(String(totalWarn)),
  ].join(' | '));
  lines.push('');

  // Parse errors
  if (r.parseErrors.length > 0) {
    lines.push(chalk.yellow('⚠️  Parse errors:'));
    r.parseErrors.forEach(e => lines.push(chalk.yellow(`   • ${e}`)));
    lines.push('');
  }

  // Top recommendations
  lines.push(chalk.bold('── TOP RECOMMENDATIONS ' + '─'.repeat(29)));
  lines.push('');
  for (const rec of r.topRecommendations) {
    const prefix = rec.priority === 'HIGH' ? chalk.red('🔴 HIGH')
                 : rec.priority === 'MED'  ? chalk.yellow('🟡 MED ')
                 : chalk.blue('🔵 INFO');
    lines.push(`  ${prefix}  ${rec.message}`);
  }

  return lines.join('\n');
}

// ── Markdown formatter ───────────────────────────────────────────────────────

function formatMarkdown(r: AssessmentReport): string {
  const lines: string[] = [];

  lines.push(`# Copilot Studio Agent Assessment: ${r.agentName}`);
  lines.push('');
  lines.push(`**Overall Score:** ${r.overallScore}/100 — **${r.rating}**  `);
  lines.push(`**Path:** \`${r.agentPath}\`  `);
  lines.push(`**Assessed:** ${new Date(r.assessedAt).toLocaleString()}`);
  lines.push('');

  // Summary table
  lines.push('## Summary');
  lines.push('');
  lines.push('| Section | Score | Errors | Warnings |');
  lines.push('|---------|-------|--------|----------|');
  for (const s of r.sections) {
    const label = SECTION_LABELS[s.section] ?? s.section;
    const err = s.findings.filter(f => f.severity === 'error').length;
    const warn = s.findings.filter(f => f.severity === 'warning').length;
    lines.push(`| ${label} | ${s.score}/${s.maxScore} | ${err} | ${warn} |`);
  }
  lines.push(`| **TOTAL** | **${r.overallScore}/100** | | |`);
  lines.push('');

  // Per-section details
  for (const s of r.sections) {
    const label = SECTION_LABELS[s.section] ?? s.section;
    lines.push(`## ${label} (${s.score}/${s.maxScore})`);
    lines.push('');

    for (const f of s.findings) {
      const em = { error: '❌', warning: '⚠️', info: '✅' }[f.severity];
      lines.push(`- ${em} **[${f.component}]** ${f.message}`);
      if (f.semanticScore !== undefined) lines.push(`  - Semantic score: ${f.semanticScore}/5`);
      if (f.suggestedRewrite) lines.push(`  - *Suggested:* ${f.suggestedRewrite}`);
    }

    if (s.semanticDimensions.length > 0) {
      lines.push('');
      lines.push('**Semantic Scores:**');
      lines.push('');
      lines.push('| Dimension | Score | Rationale |');
      lines.push('|-----------|-------|-----------|');
      for (const d of s.semanticDimensions) {
        lines.push(`| ${d.name} | ${d.score}/5 | ${d.rationale} |`);
      }
    }

    const rewrites = Object.entries(s.suggestedRewrites);
    if (rewrites.length > 0) {
      lines.push('');
      lines.push('**Suggested Rewrites:**');
      for (const [component, rewrite] of rewrites) {
        lines.push('');
        lines.push(`*${component}:*`);
        lines.push('```yaml');
        lines.push(rewrite);
        lines.push('```');
      }
    }

    lines.push('');
  }

  // Recommendations
  lines.push('## Top Recommendations');
  lines.push('');
  for (const rec of r.topRecommendations) {
    const prefix = rec.priority === 'HIGH' ? '🔴 **HIGH**'
                 : rec.priority === 'MED'  ? '🟡 **MED**'
                 : '🔵 **INFO**';
    lines.push(`- ${prefix} ${rec.message}`);
  }

  if (r.parseErrors.length > 0) {
    lines.push('');
    lines.push('## Parse Errors');
    lines.push('');
    r.parseErrors.forEach(e => lines.push(`- \`${e}\``));
  }

  return lines.join('\n');
}
