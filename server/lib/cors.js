// The web build calls this API from the browser, cross-origin. Native apps
// never send a preflight, so this costs them nothing. Wide open is right:
// the app key header is the gate, not the origin - anyone can read it out
// of the web bundle anyway, and the per-IP limits are what actually hold.
//
//   if (cors(req, res)) return;   // at the top of every handler
//
// Returns true when the request was a preflight and has been answered.
export function cors(req, res, methods = 'POST, OPTIONS') {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-cram-key, x-cram-admin, x-cram-tier');
  res.setHeader('Access-Control-Allow-Methods', methods);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}
