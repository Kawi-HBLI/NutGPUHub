// Writes a Markdown test summary for the GitHub Actions job page (evidence for check C-01).
// Usage: node scripts/ci-test-summary.mjs <vitest.json> <playwright.json> >> "$GITHUB_STEP_SUMMARY"
// A missing report means that step did not run; the summary says so instead of failing.
import { existsSync, readFileSync } from 'node:fs';
import { relative } from 'node:path';

const [vitestFile, playwrightFile] = process.argv.slice(2);
const read = file => (file && existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : undefined);

const rows = [];
const failures = [];
const totals = { passed: 0, failed: 0, skipped: 0 };

function addRow(suite, file, counts) {
  rows.push(`| ${suite} | \`${file}\` | ${counts.passed} | ${counts.failed} | ${counts.skipped} |`);
  for (const key of Object.keys(totals)) totals[key] += counts[key];
}

const vitest = read(vitestFile);
if (!vitest) rows.push('| Vitest | not run | | | |');
for (const result of vitest?.testResults ?? []) {
  const counts = { passed: 0, failed: 0, skipped: 0 };
  for (const test of result.assertionResults) {
    const key = test.status === 'passed' ? 'passed' : test.status === 'failed' ? 'failed' : 'skipped';
    counts[key] += 1;
    if (key === 'failed') failures.push(`Vitest: ${test.fullName}`);
  }
  addRow('Vitest', relative(process.cwd(), result.name).replaceAll('\\', '/'), counts);
}

const playwright = read(playwrightFile);
const specsOf = suite => [...(suite.specs ?? []), ...(suite.suites ?? []).flatMap(specsOf)];
if (!playwright) rows.push('| Playwright | not run | | | |');
for (const suite of playwright?.suites ?? []) {
  const counts = { passed: 0, failed: 0, skipped: 0 };
  for (const spec of specsOf(suite)) {
    for (const test of spec.tests) {
      const key = test.status === 'unexpected' ? 'failed' : test.status === 'skipped' ? 'skipped' : 'passed';
      counts[key] += 1;
      if (key === 'failed') failures.push(`Playwright: ${spec.title}`);
    }
  }
  addRow('Playwright', `e2e/${suite.file}`, counts);
}

const outcome = value => value || 'not run';
console.log([
  '## Test summary',
  '',
  `Commit: \`${process.env.GITHUB_SHA ?? 'local'}\``,
  '',
  '| Suite | File | Passed | Failed | Skipped |',
  '|---|---|---|---|---|',
  ...rows,
  '',
  `**Total:** ${totals.passed} passed, ${totals.failed} failed, ${totals.skipped} skipped.`,
  '',
  `- Process restart check (TC-PERSIST-01): ${outcome(process.env.RESTART_OUTCOME)}`,
  `- Production Docker image build: ${outcome(process.env.DOCKER_OUTCOME)}`,
  ...(failures.length ? ['', '### Failed tests', ...failures.map(name => `- ${name}`)] : []),
].join('\n'));
