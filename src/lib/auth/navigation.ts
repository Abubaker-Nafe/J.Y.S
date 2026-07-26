import type { Locale } from "@/lib/i18n/config";

type AuthRole = string | undefined;

function isAdminDestination(locale: Locale, destination: string) {
  const adminPath = `/${locale}/admin`;
  return (
    destination === adminPath
    || destination.startsWith(`${adminPath}/`)
    || destination.startsWith(`${adminPath}?`)
    || destination.startsWith(`${adminPath}#`)
  );
}

export function postAuthDestination(
  locale: Locale,
  role: AuthRole,
  requestedDestination?: string,
) {
  const localeRoot = `/${locale}`;
  const isLocalDestination = requestedDestination === localeRoot
    || requestedDestination?.startsWith(`${localeRoot}/`);

  if (isLocalDestination && requestedDestination) {
    if (role !== "ADMIN" && isAdminDestination(locale, requestedDestination)) {
      return `${localeRoot}/profile`;
    }
    return requestedDestination;
  }

  return role === "ADMIN" ? `${localeRoot}/admin` : `${localeRoot}/profile`;
}
