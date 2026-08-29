const GITHUB_REPOSITORY_URL = /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/?$/;

export function parseGitHubRepositoryUrl(value: string | null | undefined): { url: string; fullName: string } | null {
  const match = GITHUB_REPOSITORY_URL.exec(String(value || "").trim());
  if (!match) return null;
  const repository = match[2].replace(/\.git$/i, "");
  if (!repository) return null;
  return {
    url: `https://github.com/${match[1]}/${repository}`,
    fullName: `${match[1]}/${repository}`,
  };
}