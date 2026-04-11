// Community pulse widget module.
// Loaded by each content page as a <script defer> tag.
// Hydrates every <h2> on the page with a stance widget, unless the page
// opts out via <body data-community-pulse="off-sections">.

/**
 * Convert a heading text into an anchor ID slug.
 * Stable across runs for the same input.
 */
export function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')      // strip punctuation
    .replace(/[\s_-]+/g, '-')      // collapse whitespace and hyphens
    .replace(/^-+|-+$/g, '');      // trim leading and trailing hyphens
}
