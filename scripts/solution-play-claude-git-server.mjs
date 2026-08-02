import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const maximumRequestBytes = 1024 * 1024;
const maximumResponseBytes = 4 * 1024 * 1024;
const repositoryPattern = /^\/(stable|latest)\.git(?:\/|$)/;

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function isLoopback(address) {
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}

function backendEnvironment() {
  const env = {};
  const allowed = ['APPDATA', 'ComSpec', 'HOME', 'LANG', 'LC_ALL', 'LOCALAPPDATA', 'PATH', 'PATHEXT', 'SystemDrive', 'SystemRoot', 'TEMP', 'TMP', 'TMPDIR', 'USERPROFILE', 'WINDIR'];
  for (const name of allowed) if (typeof process.env[name] === 'string') env[name] = process.env[name];
  return env;
}

function parseCgiResponse(bytes) {
  const separator = bytes.indexOf('\r\n\r\n');
  if (separator < 0) throw new Error('git http-backend returned malformed CGI headers');
  const headerLines = bytes.subarray(0, separator).toString('utf8').split('\r\n');
  const headers = {};
  let status = 200;
  for (const line of headerLines) {
    const index = line.indexOf(':');
    if (index < 1) throw new Error('git http-backend returned a malformed header');
    const name = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    if (name.toLowerCase() === 'status') status = Number.parseInt(value, 10);
    else headers[name] = value;
  }
  return { status, headers, body: bytes.subarray(separator + 4) };
}

export function createGitHttpServer(projectRoot) {
  const root = fs.realpathSync.native(projectRoot);
  return http.createServer((request, response) => {
    if (!isLoopback(request.socket.remoteAddress)) {
      response.writeHead(403).end();
      return;
    }
    const url = new URL(request.url, 'http://127.0.0.1');
    if (!['GET', 'POST'].includes(request.method) || !repositoryPattern.test(url.pathname)) {
      response.writeHead(404).end();
      return;
    }
    const length = Number.parseInt(request.headers['content-length'] ?? '0', 10);
    if (!Number.isSafeInteger(length) || length < 0 || length > maximumRequestBytes) {
      response.writeHead(413).end();
      return;
    }

    const backend = spawn('git', ['http-backend'], {
      env: {
        ...backendEnvironment(),
        GIT_PROJECT_ROOT: root,
        GIT_HTTP_EXPORT_ALL: '1',
        PATH_INFO: url.pathname,
        QUERY_STRING: url.searchParams.toString(),
        REQUEST_METHOD: request.method,
        CONTENT_TYPE: request.headers['content-type'] ?? '',
        CONTENT_LENGTH: String(length),
        REMOTE_ADDR: request.socket.remoteAddress,
      },
      shell: false,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const output = [];
    let outputBytes = 0;
    let failed = false;
    let requestBytes = 0;
    let backendExited = false;
    let forceTimer;
    const terminateBackend = () => {
      if (backendExited) return;
      backend.kill();
      forceTimer ??= setTimeout(() => backend.kill('SIGKILL'), 2000);
      forceTimer.unref();
    };
    request.on('data', (chunk) => {
      requestBytes += chunk.length;
      if (requestBytes > maximumRequestBytes && !response.headersSent) {
        failed = true;
        request.unpipe(backend.stdin);
        backend.stdin.on('error', () => {});
        backend.stdin.end();
        terminateBackend();
        response.writeHead(413).end();
      }
    });
    request.on('error', terminateBackend);
    response.on('error', terminateBackend);
    response.on('close', () => {
      if (!response.writableEnded) terminateBackend();
    });
    backend.stdout.on('data', (chunk) => {
      outputBytes += chunk.length;
      if (outputBytes > maximumResponseBytes) {
        failed = true;
        backend.kill();
      } else output.push(chunk);
    });
    backend.stderr.resume();
    backend.on('error', () => {
      if (!response.headersSent) response.writeHead(502).end();
    });
    backend.on('close', (code) => {
      backendExited = true;
      clearTimeout(forceTimer);
      if (response.headersSent) return;
      if (failed || code !== 0) {
        response.writeHead(failed ? 413 : 502).end();
        return;
      }
      try {
        const result = parseCgiResponse(Buffer.concat(output));
        response.writeHead(result.status, result.headers).end(result.body);
      } catch {
        response.writeHead(502).end();
      }
    });
    request.pipe(backend.stdin);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = argumentValue('--root');
  const readyFile = argumentValue('--ready-file');
  const port = Number.parseInt(argumentValue('--port') ?? '0', 10);
  if (!root || !readyFile || !Number.isInteger(port) || port < 0 || port > 65535) {
    process.stderr.write('Usage: node scripts/solution-play-claude-git-server.mjs --root <directory> --ready-file <file> [--port <number>]\n');
    process.exitCode = 2;
  } else {
    const server = createGitHttpServer(root);
    server.listen(port, '127.0.0.1', () => {
      const address = server.address();
      const ready = `${JSON.stringify({ port: address.port, pid: process.pid })}\n`;
      fs.writeFileSync(readyFile, ready, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
      process.stdout.write(ready);
    });
    for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
  }
}

export const gitServerLimits = Object.freeze({ maximumRequestBytes, maximumResponseBytes });
