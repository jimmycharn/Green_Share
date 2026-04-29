// Empty PostCSS config — exists only to stop Vite/Vitest from walking up
// the directory tree and loading a parent-level postcss config that
// references plugins we don't have installed. Next.js doesn't require a
// PostCSS config by default.
module.exports = { plugins: [] };
