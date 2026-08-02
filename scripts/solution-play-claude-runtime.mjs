import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { stableJson } from './solution-play-claude-plugin.mjs';
import { writeClaudeMarketplace } from './solution-play-claude-marketplace.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const marketplaceProfilePath = path.join(repositoryRoot, 'data', 'claude', 'marketplace-fixture.v1.json');
const gitServerPath = path.join(repositoryRoot, 'scripts', 'solution-play-claude-git-server.mjs');
const maximumCommandOutputBytes = 1024 * 1024;
const channels = ['stable', 'latest'];
const playName = 'frootai-00-claude-plugin-fixture';
const foundationName = 'frootai-foundation';
const marketplaceBase = 'frootai-solution-plays';
const requiredClaudeVersion = '2.1.220';

function isInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative);
}

function physicalParent(candidate) {
  let current = path.resolve(candidate);
  const missing = [];
  while (!fs.existsSync(current)) {
    missing.unshift(path.basename(current));
    const parent = path.dirname(current);
    if (parent === current) throw new Error(`runtime path has no existing parent: ${candidate}`);
    current = parent;
  }
  const realParent = fs.realpathSync.native(current);
  return path.join(realParent, ...missing);
}

export function validateRuntimeRoots({ configRoot, outputRoot }) {
  const errors = [];
  for (const [name, value] of Object.entries({ configRoot, outputRoot })) {
    if (typeof value !== 'string' || value.trim() === '') {
      errors.push(`${name} must be a non-empty absolute path`);
      continue;
    }
    if (!path.isAbsolute(value)) errors.push(`${name} must be an absolute path`);
  }
  if (errors.length > 0) return { valid: false, errors };

  const config = physicalParent(configRoot);
  const output = physicalParent(outputRoot);
  const home = fs.realpathSync.native(os.homedir());
  const temporaryRoot = fs.realpathSync.native(os.tmpdir());
  if (config === home || !isInside(temporaryRoot, config)) errors.push('configRoot must be an isolated child of the operating-system temporary directory');
  if (output === repositoryRoot || isInside(repositoryRoot, output)) errors.push('outputRoot must not write into the repository');
  if (output === config || isInside(output, config) || isInside(config, output)) errors.push('configRoot and outputRoot must be separate trees');
  return { valid: errors.length === 0, errors };
}

export function runBoundedCommand(executable, args, { cwd = repositoryRoot, env = process.env, input, timeout = 120000 } = {}) {
  if (!Array.isArray(args) || args.some((argument) => typeof argument !== 'string')) throw new Error('command arguments must be a string array');
  if (input !== undefined && (typeof input !== 'string' || Buffer.byteLength(input) > maximumCommandOutputBytes)) throw new Error('command input must be a string no larger than one MiB');
  const result = spawnSync(executable, args, {
    cwd,
    env,
    input,
    encoding: 'utf8',
    shell: false,
    timeout,
    maxBuffer: maximumCommandOutputBytes,
    windowsHide: true,
  });
  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  if (Buffer.byteLength(stdout) + Buffer.byteLength(stderr) > maximumCommandOutputBytes) throw new Error('Claude command output exceeded the one MiB evidence limit');
  if (result.error) throw new Error(`Claude command failed to start: ${result.error.message}`);
  return { status: result.status, signal: result.signal, stdout, stderr };
}

function checked(executable, args, options = {}) {
  const result = runBoundedCommand(executable, args, options);
  if (result.status !== 0) throw new Error(`${path.basename(executable)} ${args.join(' ')} failed (${result.status}): ${(result.stderr || result.stdout).trim()}`);
  return result;
}

export function runtimeEnvironment(configRoot, source = process.env) {
  const env = {};
  const allowed = ['APPDATA', 'CI', 'ComSpec', 'HOME', 'LANG', 'LC_ALL', 'LOCALAPPDATA', 'NO_COLOR', 'NUMBER_OF_PROCESSORS', 'PATH', 'PATHEXT', 'SystemDrive', 'SystemRoot', 'TEMP', 'TERM', 'TMP', 'TMPDIR', 'USERPROFILE', 'WINDIR', 'XDG_CACHE_HOME', 'XDG_CONFIG_HOME'];
  for (const name of allowed) if (typeof source[name] === 'string') env[name] = source[name];
  return {
    ...env,
    CLAUDE_CONFIG_DIR: configRoot,
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
    GIT_TERMINAL_PROMPT: '0',
  };
}

export function resolveClaudeExecutable(requested) {
  if (requested) return requested;
  const require = createRequire(import.meta.url);
  const packageCandidates = [];
  try { packageCandidates.push(path.dirname(require.resolve('@anthropic-ai/claude-code/package.json'))); }
  catch {}
  packageCandidates.push(path.join(path.dirname(process.execPath), 'node_modules', '@anthropic-ai', 'claude-code'));
  for (const packageRoot of packageCandidates) {
    const manifestPath = path.join(packageRoot, 'package.json');
    if (!fs.existsSync(manifestPath)) continue;
    const manifest = readJson(manifestPath);
    const relativeBin = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin?.claude;
    if (typeof relativeBin !== 'string') continue;
    const executable = path.resolve(packageRoot, relativeBin);
    if (fs.existsSync(executable) && fs.lstatSync(executable).isFile()) return executable;
  }
  return 'claude';
}

function parseJson(result, label) {
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error(`${label} did not return JSON`);
  }
}

function readJson(filePath) {
  const stat = fs.lstatSync(filePath);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`runtime metadata must be a regular file: ${path.basename(filePath)}`);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function marketplaceName(channel) {
  return `${marketplaceBase}-${channel}`;
}

function pluginId(name, channel) {
  return `${name}@${marketplaceName(channel)}`;
}

function materializeMarketplaces(outputRoot) {
  const generatedRoot = path.join(outputRoot, 'generated');
  const servedRoot = path.join(outputRoot, 'served');
  const profile = readJson(marketplaceProfilePath);
  writeClaudeMarketplace(profile, generatedRoot);
  fs.mkdirSync(servedRoot, { mode: 0o700 });
  const commitShas = {};
  const gitEnvironment = {
    ...runtimeEnvironment(path.join(outputRoot, 'git-config-not-used')),
    GIT_AUTHOR_DATE: '2026-08-01T00:00:00Z',
    GIT_COMMITTER_DATE: '2026-08-01T00:00:00Z',
  };
  for (const channel of channels) {
    const source = path.join(generatedRoot, 'channels', channel);
    checked('git', ['init', '--quiet', '--initial-branch', channel], { cwd: source, env: gitEnvironment });
    checked('git', ['config', 'core.autocrlf', 'false'], { cwd: source, env: gitEnvironment });
    checked('git', ['config', 'user.name', 'FrootAI Runtime Validation'], { cwd: source, env: gitEnvironment });
    checked('git', ['config', 'user.email', 'runtime-validation@invalid.example'], { cwd: source, env: gitEnvironment });
    checked('git', ['add', '.'], { cwd: source, env: gitEnvironment });
    checked('git', ['commit', '--quiet', '-m', `test: materialize ${channel} marketplace`], { cwd: source, env: gitEnvironment });
    commitShas[channel] = checked('git', ['rev-parse', 'HEAD'], { cwd: source, env: gitEnvironment }).stdout.trim();
    checked('git', ['clone', '--quiet', '--bare', source, path.join(servedRoot, `${channel}.git`)], { cwd: outputRoot, env: gitEnvironment });
  }
  if (commitShas.stable === commitShas.latest) throw new Error('stable and latest marketplace commits must be distinct');
  return { generatedRoot, servedRoot, commitShas };
}

async function startGitServer(servedRoot, outputRoot) {
  const readyFile = path.join(outputRoot, 'git-server-ready.json');
  const child = spawn(process.execPath, [gitServerPath, '--root', servedRoot, '--ready-file', readyFile], {
    cwd: repositoryRoot,
    env: runtimeEnvironment(path.join(outputRoot, 'server-config-not-used')),
    shell: false,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    const ready = await new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      let settled = false;
      let timer;
      const fail = (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      };
      const succeed = (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      };
      timer = setTimeout(() => fail(new Error('local git server did not become ready')), 10000);
      child.once('error', fail);
      child.stderr.on('data', (chunk) => { stderr += chunk; });
      child.stdout.on('data', (chunk) => {
        stdout += chunk;
        if (Buffer.byteLength(stdout) > 4096) {
          fail(new Error('local git server emitted oversized readiness output'));
          return;
        }
        if (stdout.includes('\n')) {
          try {
            const value = JSON.parse(stdout);
            if (!Number.isInteger(value.port) || value.port < 1 || value.port > 65535 || !Number.isInteger(value.pid)) throw new Error('readiness record has invalid port or pid');
            succeed(value);
          } catch (error) {
            fail(new Error(`local git server returned invalid readiness JSON: ${error.message}`));
          }
        }
      });
      child.once('exit', (code) => {
        fail(new Error(`local git server exited ${code}: ${stderr}`));
      });
    });
    return { child, ready, readyFile };
  } catch (error) {
    child.kill('SIGKILL');
    throw error;
  }
}

async function stopGitServer(server) {
  if (!server || server.child.exitCode !== null) return;
  await new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(force);
      resolve();
    };
    const force = setTimeout(() => server.child.kill('SIGKILL'), 2000);
    force.unref();
    server.child.once('exit', finish);
    server.child.kill();
    if (server.child.exitCode !== null) finish();
  });
}

function assertOfficialValidation(claude, generatedRoot, env) {
  const evidence = {};
  for (const channel of channels) {
    const channelRoot = path.join(generatedRoot, 'channels', channel);
    const normal = runBoundedCommand(claude, ['plugin', 'validate', channelRoot], { env });
    if (normal.status !== 0 || !/Validation passed with warnings/.test(normal.stdout + normal.stderr)) throw new Error(`${channel} marketplace failed official validation`);
    const strict = runBoundedCommand(claude, ['plugin', 'validate', channelRoot, '--strict'], { env });
    const strictText = strict.stdout + strict.stderr;
    if (strict.status !== 1 || !/No version specified/.test(strictText) || !/strict treats warnings as errors/.test(strictText)) throw new Error(`${channel} strict validation did not fail only on the expected SHA-version advisory`);
    evidence[channel] = { passed: true, strict_sha_version_advisory: true };
  }
  return evidence;
}

function installedRecords(configRoot) {
  const document = readJson(path.join(configRoot, 'plugins', 'installed_plugins.json'));
  if (document.version !== 2 || !document.plugins || typeof document.plugins !== 'object') throw new Error('unsupported Claude installed plugin record');
  return document.plugins;
}

function assertInstalledState(configRoot, commitShas) {
  const records = installedRecords(configRoot);
  for (const channel of channels) {
    const play = records[pluginId(playName, channel)]?.[0];
    const foundation = records[pluginId(foundationName, channel)]?.[0];
    if (!play || !foundation) throw new Error(`installed records are incomplete for ${channel}`);
    if (play.gitCommitSha !== commitShas[channel] || foundation.gitCommitSha !== commitShas[channel]) throw new Error(`installed cache SHA differs from the ${channel} source commit`);
    if (play.auto === true || foundation.auto !== true) throw new Error(`foundation dependency installation flags are invalid for ${channel}`);
    for (const record of [play, foundation]) {
      const cacheRoot = fs.realpathSync.native(record.installPath);
      const config = fs.realpathSync.native(configRoot);
      if (!isInside(config, cacheRoot)) throw new Error(`installed cache escapes isolated Claude state for ${channel}`);
      if (record.version !== record.gitCommitSha.slice(0, 12)) throw new Error(`installed cache version is not derived from the ${channel} commit SHA`);
    }
  }
  return records;
}

function assertComponentInventory(claude, env) {
  const evidence = {};
  for (const channel of channels) {
    const id = pluginId(playName, channel);
    const details = checked(claude, ['plugin', 'details', id], { env });
    const text = details.stdout + details.stderr;
    for (const expected of ['implement-play', 'review-play', 'test-play', 'play-builder', 'play-reviewer', 'play-context']) {
      if (!text.includes(expected)) throw new Error(`${id} details omitted ${expected}`);
    }
    evidence[channel] = {
      skills: ['implement-play', 'review-play', 'test-play'],
      agents: ['play-builder', 'play-reviewer'],
      mcp_servers: ['play-context'],
    };
  }
  return evidence;
}

function assertEnableReload(claude, env) {
  const id = pluginId(playName, 'stable');
  checked(claude, ['plugin', 'enable', id, '--scope', 'user'], { env });
  let list = parseJson(checked(claude, ['plugin', 'list', '--json'], { env }), 'enabled plugin list');
  if (list.find((entry) => entry.id === id)?.enabled !== true) throw new Error('enabled plugin state was not visible after process reload');
  checked(claude, ['plugin', 'disable', id, '--scope', 'user'], { env });
  list = parseJson(checked(claude, ['plugin', 'list', '--json'], { env }), 'disabled plugin list');
  if (list.find((entry) => entry.id === id)?.enabled !== false) throw new Error('disabled plugin state was not visible after process reload');
  return { plugin: id, enabled_after_reload: true, disabled_after_reload: true };
}

function assertCachedSecurity(records, outputRoot, env) {
  const playRoot = records[pluginId(playName, 'stable')][0].installPath;
  const foundationRoot = records[pluginId(foundationName, 'stable')][0].installPath;
  const projectRoot = path.join(outputRoot, 'security-project');
  fs.mkdirSync(path.join(projectRoot, 'src'), { recursive: true });
  const hookEnvironment = { ...env, CLAUDE_PROJECT_DIR: projectRoot };
  const allowed = checked(process.execPath, [path.join(playRoot, 'scripts', 'play-guard.mjs')], {
    cwd: projectRoot,
    env: hookEnvironment,
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'npm test' } }),
  });
  if (allowed.stdout !== '') throw new Error('cached play guard did not silently allow the exact command allowlist');
  for (const [root, command, expected] of [[playRoot, 'npm publish', 'npm publish'], [foundationRoot, 'git push --force origin main', 'git push force']]) {
    const denied = checked(process.execPath, [path.join(root, 'scripts', root === playRoot ? 'play-guard.mjs' : 'foundation-guard.mjs')], {
      cwd: projectRoot,
      env: { ...hookEnvironment, CLAUDE_PLUGIN_ROOT: root },
      input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }),
    });
    if (!denied.stdout.includes(expected) || !denied.stdout.includes('deny')) throw new Error(`cached guard failed to deny ${expected}`);
  }
  const requests = [
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 't222', version: '1' } } },
    { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
    { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'get_play_context', arguments: { section: 'all' } } },
  ];
  const mcp = checked(process.execPath, [path.join(playRoot, 'servers', 'play-context.mjs')], {
    env: { ...env, FROOTAI_PLAY_ASSETS: path.join(playRoot, 'assets'), FROOTAI_MCP_RESULT_LIMIT: '4096' },
    input: `${requests.map(JSON.stringify).join('\n')}\n`,
  });
  const responses = mcp.stdout.trim().split(/\r?\n/).map((line) => JSON.parse(line));
  if (responses[1]?.result?.tools?.[0]?.name !== 'get_play_context' || responses[2]?.result?.isError !== false) throw new Error('cached MCP tool inventory or invocation failed');
  if (responses[2].result.content[0].text.length > 4096) throw new Error('cached MCP result exceeded its configured bound');
  return { allowed_command: 'npm test', denied_commands: ['npm publish', 'git push force'], mcp_tool: 'get_play_context', maximum_result_chars: 4096 };
}

function cleanupClaudeState(claude, env) {
  checked(claude, ['plugin', 'disable', '--all'], { env });
  for (const channel of channels) checked(claude, ['plugin', 'uninstall', pluginId(playName, channel), '--scope', 'user', '--prune', '--yes'], { env });
  checked(claude, ['plugin', 'prune', '--scope', 'user', '--yes'], { env });
  let remaining = parseJson(checked(claude, ['plugin', 'list', '--json'], { env }), 'post-prune plugin list');
  for (const entry of remaining) {
    if (!channels.some((channel) => entry.id === pluginId(foundationName, channel))) throw new Error(`unexpected plugin remained after prune: ${entry.id}`);
    checked(claude, ['plugin', 'uninstall', entry.id, '--scope', 'user'], { env });
  }
  remaining = parseJson(checked(claude, ['plugin', 'list', '--json'], { env }), 'post-uninstall plugin list');
  if (remaining.length !== 0) throw new Error('plugin uninstall and dependency prune left installed records');
  for (const channel of channels) checked(claude, ['plugin', 'marketplace', 'remove', marketplaceName(channel)], { env });
  const marketplaces = parseJson(checked(claude, ['plugin', 'marketplace', 'list', '--json'], { env }), 'post-removal marketplace list');
  if (marketplaces.length !== 0) throw new Error('marketplace removal left configured records');
}

export async function runClaudeRuntimeValidation({ claude, configRoot, outputRoot }) {
  const validation = validateRuntimeRoots({ configRoot, outputRoot });
  if (!validation.valid) throw new Error(`Claude runtime roots are unsafe: ${validation.errors.join('; ')}`);
  if (fs.existsSync(configRoot) || fs.existsSync(outputRoot)) throw new Error('Claude runtime roots must not already exist');
  fs.mkdirSync(configRoot, { recursive: false, mode: 0o700 });
  fs.mkdirSync(outputRoot, { recursive: false, mode: 0o700 });
  const env = runtimeEnvironment(configRoot);
  const claudeExecutable = resolveClaudeExecutable(claude);
  let server;
  try {
    const versionText = checked(claudeExecutable, ['--version'], { env }).stdout.trim();
    const version = versionText.match(/\d+\.\d+\.\d+/)?.[0];
    if (!version) throw new Error('Claude runtime version was not parseable');
    if (version !== requiredClaudeVersion) throw new Error(`Claude runtime version must be ${requiredClaudeVersion}; received ${version}`);
    const materialized = materializeMarketplaces(outputRoot);
    const officialValidation = assertOfficialValidation(claudeExecutable, materialized.generatedRoot, env);
    server = await startGitServer(materialized.servedRoot, outputRoot);
    for (const channel of channels) checked(claudeExecutable, ['plugin', 'marketplace', 'add', `http://127.0.0.1:${server.ready.port}/${channel}.git`, '--scope', 'user'], { env });
    const marketplaces = parseJson(checked(claudeExecutable, ['plugin', 'marketplace', 'list', '--json'], { env }), 'marketplace list');
    if (marketplaces.length !== 2 || !channels.every((channel) => marketplaces.some((entry) => entry.name === marketplaceName(channel)))) throw new Error('stable and latest marketplaces were not both configured');
    for (const channel of channels) checked(claudeExecutable, ['plugin', 'install', pluginId(playName, channel), '--scope', 'user'], { env });
    const records = assertInstalledState(configRoot, materialized.commitShas);
    const list = parseJson(checked(claudeExecutable, ['plugin', 'list', '--json'], { env }), 'installed plugin list');
    if (list.length !== 4 || list.some((entry) => entry.enabled !== false)) throw new Error('installed play and foundation plugins must remain disabled by default');
    const components = assertComponentInventory(claudeExecutable, env);
    const reload = assertEnableReload(claudeExecutable, env);

    await stopGitServer(server);
    server = null;
    fs.rmSync(materialized.generatedRoot, { recursive: true, force: true });
    fs.rmSync(materialized.servedRoot, { recursive: true, force: true });
    fs.rmSync(path.join(configRoot, 'plugins', 'marketplaces'), { recursive: true, force: true });
    const cachedList = parseJson(checked(claudeExecutable, ['plugin', 'list', '--json'], { env }), 'cache-only plugin list');
    if (cachedList.length !== 4) throw new Error('installed plugins did not survive source and marketplace clone deletion');
    const security = assertCachedSecurity(records, outputRoot, env);
    cleanupClaudeState(claudeExecutable, env);
    const receipt = {
      schema_version: '1.0.0',
      task: 'T222',
      status: 'passed',
      claude: { version, authenticated: false, official_validation: officialValidation },
      channels: Object.fromEntries(channels.map((channel) => [channel, { source_commit_sha: materialized.commitShas[channel], installed_cache_sha: records[pluginId(playName, channel)][0].gitCommitSha }])),
      dependency: { name: foundationName, auto_installed: true, disabled_by_default: true },
      components,
      reload,
      cache_isolation: { distinct_channel_shas: true, source_deleted_before_execution: true, marketplace_clones_deleted_before_execution: true },
      security,
      cleanup: { plugins: 0, marketplaces: 0, isolated_config_removed: true },
      claims: { publication: false, deployment: false, readiness_promotion: false },
    };
    fs.rmSync(configRoot, { recursive: true, force: true });
    fs.writeFileSync(path.join(outputRoot, 'claude-runtime-receipt.json'), stableJson(receipt), { encoding: 'utf8', flag: 'wx' });
    return receipt;
  } catch (error) {
    fs.rmSync(configRoot, { recursive: true, force: true });
    throw error;
  } finally {
    await stopGitServer(server);
  }
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const configRoot = argumentValue('--config');
  const outputRoot = argumentValue('--output');
  const claude = argumentValue('--claude');
  if (!configRoot || !outputRoot) {
    process.stderr.write('Usage: node scripts/solution-play-claude-runtime.mjs --config <temporary-directory> --output <temporary-directory> [--claude <executable>]\n');
    process.exitCode = 2;
  } else {
    try {
      const receipt = await runClaudeRuntimeValidation({ claude, configRoot: path.resolve(configRoot), outputRoot: path.resolve(outputRoot) });
      process.stdout.write(stableJson(receipt));
    } catch (error) {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    }
  }
}

export const runtimeLimits = Object.freeze({ maximumCommandOutputBytes });
