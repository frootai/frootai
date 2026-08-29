export function shouldRead(relativePath: string): boolean {
  const value = relativePath.replace(/\\/g, "/");
  if (/(^|\/)\.(env|npmrc|pypirc|netrc)(\.|$)/i.test(value)) return false;
  return /(^|\/)(package\.json|pyproject\.toml|requirements[^/]*\.txt|fai-manifest\.json|readme[^/]*|host\.json|dockerfile|docker-compose[^/]*)$/i.test(value)
    || /(^|\/)(infra|evaluation|config)\/[^/]+\.(json|ya?ml|toml|bicep|tf)$/i.test(value);
}
