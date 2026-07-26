export function resolveApplicationOrigin(
  requestUrl: string,
  source: NodeJS.ProcessEnv = process.env,
) {
  const configured = source.APP_URL;
  if (source.NODE_ENV === "production") {
    if (!configured) throw new Error("APP_URL is required in production");
    return new URL(configured).origin;
  }

  try {
    const requestOrigin = new URL(requestUrl);
    if (requestOrigin.protocol === "http:" || requestOrigin.protocol === "https:") {
      return requestOrigin.origin;
    }
  } catch {
    // Fall through to the configured local origin.
  }

  return configured ? new URL(configured).origin : "http://localhost:3000";
}
