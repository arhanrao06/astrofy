// Prefix a root-relative path with Astro's configured `base` so that links and
// assets resolve correctly when the site is served from a subpath
// (e.g. https://arhanrao06.github.io/astrofy/). External URLs and already-
// prefixed paths are returned unchanged.
const base = import.meta.env.BASE_URL.replace(/\/$/, ""); // "/astrofy" (no trailing slash)

export default function withBase(path?: string): string | undefined {
  if (typeof path !== "string") return path;
  if (!path.startsWith("/")) return path; // external URL, mailto:, anchor, etc.
  if (base && path.startsWith(base + "/")) return path; // already prefixed
  return base + path;
}
