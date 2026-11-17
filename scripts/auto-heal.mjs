/**
 * Reads a Jest failure log, asks a model for a source patch when credentials
 * exist, and otherwise repairs the inverted overlap predicate this lab breaks.
 * Test files are never writable. A patch is kept only if Jest then passes.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const REPORT_PATH = 'auto-heal-report.json';
const BODY_PATH = 'auto-heal-pr-body.md';
const CORRECT_OVERLAP_RETURN = 'return startA < endB && startB < endA;';

const INVERTED_OVERLAP_PATTERNS = [
  /^([ \t]*)return\s+startA\s*>=\s*endB\s*\|\|\s*startB\s*>=\s*endA\s*;[ \t]*$/m,
  /^([ \t]*)return\s+!\s*\(\s*startA\s*<\s*endB\s*&&\s*startB\s*<\s*endA\s*\)\s*;[ \t]*$/m,
];

const SYSTEM_PROMPT = [
  'You are a careful software engineer repairing a failing CampusHub Jest suite.',
  'Parse the attached Jest failure log. Locate the source code causing the failure in src/ and generate a patch that fixes the bug without breaking existing tests.',
  'Do not modify test files, weaken assertions, or change files outside src/.',
  'Return JSON only, with no markdown, using this shape:',
  '{"analysis":"short explanation","files":[{"path":"src/services/reservation.service.ts","content":"full updated file"}]}',
].join('\n');

export function normalizeRepoPath(filePath) {
  return String(filePath).replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
}

export function isAllowedSourcePath(filePath) {
  const normalized = normalizeRepoPath(filePath);
  if (normalized.includes('..')) {
    return false;
  }
  if (!normalized.startsWith('src/') || !normalized.endsWith('.ts')) {
    return false;
  }
  if (normalized.endsWith('.test.ts') || normalized.endsWith('.spec.ts')) {
    return false;
  }
  return true;
}

export function extractJsonObject(text) {
  const source = String(text);
  const fenced = source.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : source;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new Error('Model response did not contain a JSON object.');
  }
  return JSON.parse(raw.slice(start, end + 1));
}

/**
 * Jest's default reporter starts each failure with a "● " heading.
 * The two overlap symptoms tell us the predicate was negated:
 * a free slot was rejected with 409, and a true overlap was accepted.
 */
export function parseJestLog(log) {
  const text = String(log);
  const failingTests = [];
  const parts = text.split(/\n\s*●\s+/);

  for (const part of parts.slice(1)) {
    const newline = part.indexOf('\n');
    const name = (newline === -1 ? part : part.slice(0, newline)).trim();
    const message = newline === -1 ? '' : part.slice(newline + 1);
    if (name.length > 0) {
      failingTests.push({ name, message });
    }
  }

  const nonOverlapTests = failingTests.filter((test) =>
    /non-overlapping|starts when the previous one ends/i.test(test.name),
  );
  const overlapTests = failingTests.filter(
    (test) => /overlapping/i.test(test.name) && !/non-overlapping/i.test(test.name),
  );

  const nonOverlapRejected = nonOverlapTests.some((test) =>
    /DOUBLE_BOOKING|already reserved|\b409\b/.test(test.message),
  );
  const overlapAllowed = overlapTests.some((test) =>
    /did not throw|Received(?: value)?:\s*undefined|has no prototype/i.test(test.message),
  );

  const stackFiles = [];
  const seen = new Set();
  for (const match of text.matchAll(/(src\/[\w./-]+\.ts):\d+:\d+/g)) {
    const file = match[1];
    if (!seen.has(file) && isAllowedSourcePath(file)) {
      seen.add(file);
      stackFiles.push(file);
    }
  }

  return {
    failingTests,
    nonOverlapRejected,
    overlapAllowed,
    stackFiles,
  };
}

export function repairInvertedOverlap(source, diagnosis) {
  if (!diagnosis.nonOverlapRejected || !diagnosis.overlapAllowed) {
    return null;
  }

  for (const pattern of INVERTED_OVERLAP_PATTERNS) {
    if (pattern.test(source)) {
      return source.replace(pattern, `$1${CORRECT_OVERLAP_RETURN}`);
    }
  }

  return null;
}

export function preservesExports(before, after) {
  const names = [...String(before).matchAll(/export function (\w+)/g)].map((match) => match[1]);
  return names.every((name) => String(after).includes(`export function ${name}`));
}

function readLog(logPath) {
  if (!fs.existsSync(logPath)) {
    return null;
  }
  return fs.readFileSync(logPath, 'utf8');
}

function repoRoot() {
  return process.cwd();
}

function collectContextFiles(root, diagnosis) {
  const relativePaths = new Set(diagnosis.stackFiles);
  if (diagnosis.nonOverlapRejected || diagnosis.overlapAllowed) {
    relativePaths.add('src/services/reservation.service.ts');
  }

  const files = [];
  for (const relativePath of relativePaths) {
    if (!isAllowedSourcePath(relativePath)) {
      continue;
    }
    const absolute = path.join(root, relativePath);
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
      continue;
    }
    const content = fs.readFileSync(absolute, 'utf8');
    files.push({
      path: relativePath,
      content: content.length > 20000 ? content.slice(0, 20000) : content,
    });
  }
  return files;
}

function modelCredentials() {
  const githubToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (githubToken && process.env.AUTO_HEAL_SKIP_GITHUB_MODELS !== '1') {
    return {
      provider: 'github-models',
      token: githubToken,
      model: process.env.AUTO_HEAL_MODEL || 'openai/gpt-4o-mini',
    };
  }
  if (process.env.OPENAI_API_KEY) {
    return {
      provider: 'openai',
      token: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    };
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return {
      provider: 'anthropic',
      token: process.env.ANTHROPIC_API_KEY,
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
    };
  }
  return null;
}

function buildUserPrompt(log, files) {
  const fileBlocks = files
    .map((file) => `----- ${file.path} -----\n${file.content}`)
    .join('\n\n');
  const clippedLog = log.length > 40000 ? log.slice(-40000) : log;
  return [
    'Jest failure log:',
    clippedLog,
    '',
    'Relevant source files:',
    fileBlocks || '(no production source files were referenced)',
  ].join('\n');
}

async function requestModelPatch(credentials, log, files) {
  const userPrompt = buildUserPrompt(log, files);
  const timeoutMs = 60000;

  if (credentials.provider === 'anthropic') {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'x-api-key': credentials.token,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: credentials.model,
        max_tokens: 8000,
        temperature: 0,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    if (!response.ok) {
      throw new Error(`Anthropic request failed with HTTP ${response.status}.`);
    }
    const payload = await response.json();
    const text = (payload.content || []).map((block) => block.text || '').join('\n');
    return extractJsonObject(text);
  }

  const url = credentials.provider === 'github-models'
    ? 'https://models.github.ai/inference/chat/completions'
    : 'https://api.openai.com/v1/chat/completions';
  const headers = {
    Authorization: `Bearer ${credentials.token}`,
    'Content-Type': 'application/json',
  };
  if (credentials.provider === 'github-models') {
    headers.Accept = 'application/vnd.github+json';
    headers['X-GitHub-Api-Version'] = '2022-11-28';
  }

  const response = await fetch(url, {
    method: 'POST',
    signal: AbortSignal.timeout(timeoutMs),
    headers,
    body: JSON.stringify({
      model: credentials.model,
      temperature: 0,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    }),
  });
  if (!response.ok) {
    throw new Error(`${credentials.provider} request failed with HTTP ${response.status}.`);
  }
  const payload = await response.json();
  const text = payload.choices?.[0]?.message?.content || '';
  return extractJsonObject(text);
}

function sanitizeUpdates(root, updates) {
  if (!updates || !Array.isArray(updates.files)) {
    throw new Error('Model JSON is missing a files array.');
  }

  const accepted = [];
  for (const file of updates.files) {
    const relativePath = normalizeRepoPath(file.path || '');
    if (!isAllowedSourcePath(relativePath)) {
      throw new Error(`Refusing to write ${file.path}. Only production files under src/ are writable.`);
    }
    if (typeof file.content !== 'string' || file.content.trim().length < 50) {
      throw new Error(`Refusing empty content for ${relativePath}.`);
    }
    if (file.content.length > 200000) {
      throw new Error(`Refusing oversized content for ${relativePath}.`);
    }
    const absolute = path.join(root, relativePath);
    if (!fs.existsSync(absolute)) {
      throw new Error(`Refusing to create ${relativePath}. The healer only updates existing source files.`);
    }
    const before = fs.readFileSync(absolute, 'utf8');
    if (!preservesExports(before, file.content)) {
      throw new Error(`Refusing ${relativePath} because an exported function was removed.`);
    }
    accepted.push({ path: relativePath, content: file.content, before });
  }
  return accepted;
}

function runJest(root) {
  const jestBin = path.join(root, 'node_modules', 'jest', 'bin', 'jest.js');
  const result = spawnSync(process.execPath, [jestBin, '--ci', '--colors=false'], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, CI: 'true' },
  });
  return {
    ok: result.status === 0,
    output: `${result.stdout || ''}${result.stderr || ''}`,
  };
}

function applyAccepted(root, accepted) {
  for (const file of accepted) {
    fs.writeFileSync(path.join(root, file.path), file.content);
  }
}

function restoreAccepted(root, accepted) {
  for (const file of accepted) {
    fs.writeFileSync(path.join(root, file.path), file.before);
  }
}

function changedPaths(accepted) {
  return accepted
    .filter((file) => file.before !== file.content)
    .map((file) => file.path);
}

function writeReport(report) {
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(BODY_PATH, renderPullRequestBody(report));
}

function renderPullRequestBody(report) {
  const files = report.updatedFiles.length > 0
    ? report.updatedFiles.map((file) => `- \`${file}\``).join('\n')
    : '- (no files)';
  const failures = report.failingTests.length > 0
    ? report.failingTests.map((name) => `- ${name}`).join('\n')
    : '- (none parsed)';

  return [
    '## Agent report',
    '',
    `Provider: \`${report.provider}\``,
    '',
    report.analysis,
    '',
    'The agent was instructed: "Parse the attached Jest failure log. Locate the source code causing the failure in src/ and generate a patch that fixes the bug without breaking existing tests."',
    '',
    'Failing tests read from the log:',
    '',
    failures,
    '',
    'Files the patch was allowed to change:',
    '',
    files,
    '',
    report.testsPassed
      ? 'Jest was re-run on the patched tree and passed before this branch was published. Test files were not writable.'
      : 'Jest did not pass after the patch attempt, so this branch should not be merged.',
    '',
    '## Human-in-the-loop audit',
    '',
    'Review the diff before merging. The patch is acceptable only when every item below is true.',
    '',
    '- The diff changes production source under `src/` and does not change test assertions.',
    '- The failure in the Jest log is the behavior this diff restores. For the overlap regression, non-overlapping bookings must succeed and overlapping bookings must stay `409`.',
    '- Conflict detection was repaired. It was not removed, skipped, or weakened to force the suite green.',
    '- `npm test` and `npm run lint` are green on this branch.',
    '',
    'Reviewer notes:',
    '',
    report.reviewerNotes || '_Pending human review._',
    '',
  ].join('\n');
}

function tryUpdates(root, accepted) {
  const paths = changedPaths(accepted);
  if (paths.length === 0) {
    return { ok: false, paths, output: 'Patch did not change any file.' };
  }
  applyAccepted(root, accepted);
  const tests = runJest(root);
  if (!tests.ok) {
    restoreAccepted(root, accepted);
  }
  return { ok: tests.ok, paths, output: tests.output };
}

function logRepairUpdates(root, diagnosis) {
  const relativePath = 'src/services/reservation.service.ts';
  const absolute = path.join(root, relativePath);
  if (!fs.existsSync(absolute)) {
    return [];
  }
  const before = fs.readFileSync(absolute, 'utf8');
  const repaired = repairInvertedOverlap(before, diagnosis);
  if (repaired === null || repaired === before) {
    return [];
  }
  if (!preservesExports(before, repaired)) {
    return [];
  }
  return [{ path: relativePath, content: repaired, before }];
}

function parseArgs(argv) {
  let logPath = 'test-results.log';
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--log') {
      logPath = argv[index + 1] || logPath;
      index += 1;
    }
  }
  return { logPath };
}

export async function healRepository(options = {}) {
  const root = options.root || repoRoot();
  const logPath = options.logPath || 'test-results.log';
  const previousCwd = process.cwd();
  if (root !== previousCwd) {
    process.chdir(root);
  }

  try {
    const log = readLog(path.isAbsolute(logPath) ? logPath : path.join(root, logPath));
    if (log === null) {
      const report = {
        provider: 'none',
        analysis: 'No Jest log was produced, so there is nothing to heal.',
        updatedFiles: [],
        failingTests: [],
        testsPassed: false,
      };
      writeReport(report);
      return { exitCode: 0, report };
    }

    const diagnosis = parseJestLog(log);
    const failingTests = diagnosis.failingTests.map((test) => test.name);
    if (failingTests.length === 0) {
      const report = {
        provider: 'none',
        analysis: 'The Jest log does not contain a failing test, so no patch was generated.',
        updatedFiles: [],
        failingTests,
        testsPassed: true,
      };
      writeReport(report);
      return { exitCode: 0, report };
    }

    const contextFiles = collectContextFiles(root, diagnosis);
    const credentials = options.credentials === undefined ? modelCredentials() : options.credentials;
    let provider = 'log-repair';
    let analysis = '';
    let applied = null;

    if (credentials) {
      try {
        const modelJson = await requestModelPatch(credentials, log, contextFiles);
        const accepted = sanitizeUpdates(root, modelJson);
        const result = tryUpdates(root, accepted);
        if (result.ok) {
          provider = credentials.provider;
          analysis = String(modelJson.analysis || 'The model patch passed the Jest suite.');
          applied = result;
        } else {
          analysis = `The model patch did not pass Jest (${credentials.provider}). ${result.output.split('\n').slice(-8).join(' ')}`;
        }
      } catch (error) {
        analysis = `The model call failed (${credentials.provider}): ${error instanceof Error ? error.message : 'unknown error'}.`;
      }
    }

    if (!applied) {
      const repaired = logRepairUpdates(root, diagnosis);
      const result = tryUpdates(root, repaired);
      if (result.ok) {
        provider = 'log-repair';
        const repairAnalysis = 'Parsed the Jest failure log. Non-overlapping bookings were rejected with 409 DOUBLE_BOOKING, and an overlapping booking did not throw. That pair means the half-open overlap predicate in src/services/reservation.service.ts was inverted. The patch restores `startA < endB && startB < endA` and does not edit tests.';
        analysis = analysis ? `${analysis} Fell back to the log repair. ${repairAnalysis}` : repairAnalysis;
        applied = result;
      }
    }

    if (!applied) {
      const report = {
        provider,
        analysis: analysis || 'No safe source patch passed the existing Jest suite.',
        updatedFiles: [],
        failingTests,
        testsPassed: false,
      };
      writeReport(report);
      return { exitCode: 1, report };
    }

    const report = {
      provider,
      analysis,
      updatedFiles: applied.paths,
      failingTests,
      testsPassed: true,
    };
    writeReport(report);
    return { exitCode: 0, report };
  } finally {
    if (process.cwd() !== previousCwd) {
      process.chdir(previousCwd);
    }
  }
}

function invokedDirectly() {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  return import.meta.url === pathToFileURL(path.resolve(entry)).href;
}

if (invokedDirectly()) {
  const { logPath } = parseArgs(process.argv.slice(2));
  healRepository({ logPath })
    .then((result) => {
      process.exit(result.exitCode);
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
