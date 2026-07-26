const hostPattern = /^(?:\*\.)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

export function getAllowedDevOrigins(configuredOrigins = process.env.DEV_ALLOWED_ORIGINS) {
  const configured = (configuredOrigins ?? "")
    .split(",")
    .map((origin) => origin.trim().toLowerCase())
    .filter((origin) => hostPattern.test(origin));

  return Array.from(new Set(["127.0.0.1", "localhost", ...configured]));
}
