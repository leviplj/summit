import { devServerManager } from "~~/server/features/dev-server/manager";

export default defineEventHandler(async (event) => {
  const host = getHeader(event, "host") || "";

  if (!host.includes(".localhost")) {
    return;
  }

  const subdomain = host.split(".")[0];

  if (subdomain === "localhost" || subdomain === "www") {
    return;
  }

  // Subdomain is the session ID (or a short prefix of it)
  const port = devServerManager.getPortByPrefix(subdomain);

  if (!port) {
    throw createError({
      statusCode: 404,
      statusMessage: `No dev server running for session ${subdomain}`,
    });
  }

  const url = getRequestURL(event);
  const target = `http://127.0.0.1:${port}${url.pathname}${url.search}`;

  console.log(`[dev-server] Proxy ${subdomain} → :${port} ${url.pathname}`);

  return proxyRequest(event, target, {
    fetchOptions: {
      headers: {
        host: `127.0.0.1:${port}`,
      },
    },
  });
});
