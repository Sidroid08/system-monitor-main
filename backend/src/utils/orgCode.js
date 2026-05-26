export function generateOrgCode(name) {
  const base = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 12);

  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${base || 'ORG'}-${suffix}`;
}
