// space.sampreethavvari.com: every page over https.
//
// Cloudflare serves the site's files straight from its edge without this
// Worker. It runs only for page addresses, the ones with no dot in them
// (run_worker_first in wrangler.toml), so a visit costs one or two Worker
// requests, far inside the free plan's daily limit. A visitor who typed
// http:// gets a permanent redirect to the same address on https before any
// page goes out; the Strict-Transport-Security header (public/_headers) then
// keeps their browser on https by itself.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.protocol === "http:") {
      url.protocol = "https:";
      return Response.redirect(url.toString(), 301);
    }
    return env.ASSETS.fetch(request);
  },
};
