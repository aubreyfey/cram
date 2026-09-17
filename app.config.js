// app.json is the source of truth; this only layers on settings that differ
// per hosting target. GitHub Pages serves the web build from a subpath
// (aubreyfey.github.io/cram), so the exporter needs to know the base URL and
// the legal links need the matching site URL. Neither applies in `expo start`.
module.exports = ({ config }) => {
  const base = process.env.WEB_BASE_URL;
  if (base) {
    config.experiments = { ...(config.experiments || {}), baseUrl: base };
  }
  if (process.env.SITE_URL) {
    config.extra = { ...(config.extra || {}), siteUrl: process.env.SITE_URL };
  }
  return config;
};
