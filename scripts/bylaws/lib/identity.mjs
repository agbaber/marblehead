function slug(s) {
  return s.toLowerCase()
          .replace(/&/g, ' ')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
}

export function toIdentity(sponsor, map = {}) {
  const name = map[sponsor] || sponsor;
  return { name, email: `${slug(name)}@marblehead.town` };
}
