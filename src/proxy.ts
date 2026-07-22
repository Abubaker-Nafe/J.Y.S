import { NextRequest, NextResponse } from "next/server";

const locales = ["ar", "en"] as const;
const publicFile = /\.[^/]+$/;

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/_next") || pathname.startsWith("/api") || publicFile.test(pathname)) {
    return NextResponse.next();
  }

  const pathLocale = locales.find((locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`));
  if (!pathLocale) {
    const remembered = request.cookies.get("JYS_LOCALE")?.value;
    const locale = remembered === "ar" ? "ar" : "en";
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(url);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-jys-locale", pathLocale);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  if (request.cookies.get("JYS_LOCALE")?.value !== pathLocale) {
    response.cookies.set("JYS_LOCALE", pathLocale, {
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }
  return response;
}

export const config = {
  // Keep framework traffic out of the locale proxy entirely. In particular,
  // proxying the development WebSocket prevents the client bundle hydrating.
  matcher: ["/((?!api|_next|favicon.ico|.*\\..*).*)"],
};
