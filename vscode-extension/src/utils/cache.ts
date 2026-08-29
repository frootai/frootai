import * as fs from "fs";
import * as path from "path";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

let _cacheDir: string | null = null;

export function setCacheDir(dir: string): void {
  _cacheDir = dir;
}

export function getCacheDir(): string | null {
  return _cacheDir;
}

function getCachePath(repoPath: string): string | null {
  if (!_cacheDir) {
    return null;
  }
  return path.join(_cacheDir, "downloads", repoPath.replace(/\//g, "__"));
}

function readFromCache(repoPath: string): string | null {
  const cachePath = getCachePath(repoPath);
  if (!cachePath) {
    return null;
  }
  try {
    if (fs.existsSync(cachePath)) {
      const stats = fs.statSync(cachePath);
      const ageMs = Date.now() - stats.mtimeMs;
      if (ageMs < CACHE_TTL_MS) {
        return fs.readFileSync(cachePath, "utf-8");
      }
    }
  } catch {
    /* cache miss is fine */
  }
  return null;
}

function writeToCache(repoPath: string, content: string): void {
  const cachePath = getCachePath(repoPath);
  if (!cachePath) {
    return;
  }
  try {
    const dir = path.dirname(cachePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(cachePath, content, "utf-8");
  } catch {
    /* cache write failure is non-critical */
  }
}

export async function downloadFromGitHub(
  repoPath: string
): Promise<string | null> {
  const cached = readFromCache(repoPath);
  if (cached) {
    return cached;
  }

  const url = `https://raw.githubusercontent.com/frootai/frootai/main/${repoPath}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "FrootAI-VSCode" },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const text = await res.text();
    writeToCache(repoPath, text);
    return text;
  } catch {
    return null;
  }
}
