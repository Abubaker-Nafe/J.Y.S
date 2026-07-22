"use client";

import {
  BarChart3,
  Boxes,
  ClipboardList,
  FileText,
  FolderTree,
  Gauge,
  Globe2,
  Languages,
  LogOut,
  MapPinned,
  Menu,
  PackagePlus,
  Settings,
  ShoppingBag,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { adminMessages } from "@/lib/admin/i18n";
import type { AdminActor, AdminLocale } from "@/lib/admin/types";
import { useStore } from "@/components/storefront/store-provider";
import styles from "./admin.module.css";

const navItems = [
  ["dashboard", "", Gauge],
  ["products", "/products", ShoppingBag],
  ["newProduct", "/products/new", PackagePlus],
  ["categories", "/categories", FolderTree],
  ["inventory", "/inventory", Boxes],
  ["orders", "/orders", ClipboardList],
  ["customers", "/customers", Users],
  ["locations", "/locations", MapPinned],
  ["reports", "/reports", BarChart3],
  ["content", "/content", FileText],
  ["settings", "/settings", Settings],
] as const;

const mobileMediaQuery = "(max-width: 800px)";
function subscribeToMobileViewport(callback: () => void) {
  const media = window.matchMedia(mobileMediaQuery);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
function getMobileViewportSnapshot() { return window.matchMedia(mobileMediaQuery).matches; }
function getServerViewportSnapshot() { return false; }

function isActive(pathname: string, href: string) {
  if (href.endsWith("/admin")) return pathname === href;
  if (href.endsWith("/products")) return pathname === href || /\/products\/[\w-]+$/.test(pathname);
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({ locale, actor, children }: { locale: AdminLocale; actor: AdminActor; children: ReactNode }) {
  const messages = adminMessages[locale];
  const pathname = usePathname();
  const router = useRouter();
  const { clearCustomerSession } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState(false);
  const isMobile = useSyncExternalStore(subscribeToMobileViewport, getMobileViewportSnapshot, getServerViewportSnapshot);
  const menuId = useId();
  const drawerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const adminBase = `/${locale}/admin`;
  const otherLocale = locale === "ar" ? "en" : "ar";
  const switchedPath = pathname.replace(/^\/(ar|en)(?=\/|$)/, `/${otherLocale}`);
  const drawerOpen = isMobile && menuOpen;
  const drawerHidden = isMobile && !drawerOpen;

  useEffect(() => {
    if (!drawerOpen) return;
    const drawer = drawerRef.current;
    const menuButton = menuButtonRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () => Array.from(drawer?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? []);
    const focusFrame = window.requestAnimationFrame(() => focusable()[0]?.focus());
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMenuOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      const first = items[0];
      const last = items.at(-1);
      if (!first || !last) return;
      if (!drawer?.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      if (window.matchMedia(mobileMediaQuery).matches) menuButton?.focus();
    };
  }, [drawerOpen]);

  useEffect(() => {
    if (isMobile || !menuOpen) return;
    const frame = window.requestAnimationFrame(() => setMenuOpen(false));
    return () => window.cancelAnimationFrame(frame);
  }, [isMobile, menuOpen]);

  async function logOut() {
    setLoggingOut(true);
    setLogoutError(false);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Logout failed");
      clearCustomerSession();
      router.replace(`/${locale}/login`);
      router.refresh();
    } catch {
      setLoggingOut(false);
      setLogoutError(true);
    }
  }

  return (
    <div className={styles.root} dir={locale === "ar" ? "rtl" : "ltr"}>
      <a className={styles.skipLink} href="#admin-main">
        {locale === "ar" ? "انتقل إلى المحتوى" : "Skip to content"}
      </a>
      <div className={styles.layout}>
        {drawerOpen ? (
          <button className={styles.mobileBackdrop} type="button" aria-label={messages.closeMenu} onClick={() => setMenuOpen(false)} />
        ) : null}
        <aside ref={drawerRef} id={menuId} className={`${styles.sidebar} ${drawerOpen ? styles.sidebarOpen : ""}`} aria-label={messages.navigation} role={drawerOpen ? "dialog" : undefined} aria-modal={drawerOpen || undefined} aria-hidden={drawerHidden || undefined} inert={drawerHidden ? true : undefined}>
          <div className={styles.brand}>
            <span className={styles.brandMark} aria-hidden="true">JYS</span>
            <span>
              <strong>{messages.brand}</strong>
              <small>{messages.section}</small>
            </span>
            <button className={`${styles.buttonSecondary} ${styles.iconButton} ${styles.mobileClose}`} type="button" aria-label={messages.closeMenu} onClick={() => setMenuOpen(false)}>
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <nav className={styles.nav}>
            {navItems.map(([key, suffix, Icon]) => {
              const href = `${adminBase}${suffix}`;
              const active = isActive(pathname, href);
              return (
                <Link key={key} href={href} onClick={() => setMenuOpen(false)} className={`${styles.navLink} ${active ? styles.navLinkActive : ""}`} aria-current={active ? "page" : undefined}>
                  <Icon aria-hidden="true" />
                  <span>{messages[key]}</span>
                </Link>
              );
            })}
          </nav>
          <div className={styles.sidebarFooter}>
            <Link className={styles.navLink} href={`/${locale}`} onClick={() => setMenuOpen(false)}>
              <Globe2 aria-hidden="true" />
              <span>{messages.storefront}</span>
            </Link>
            <button className={`${styles.navLink} ${styles.navButton}`} type="button" disabled={loggingOut} onClick={() => void logOut()}>
              <LogOut aria-hidden="true" />
              <span>{loggingOut ? (locale === "ar" ? "جارٍ تسجيل الخروج…" : "Signing out…") : (locale === "ar" ? "تسجيل الخروج" : "Sign out")}</span>
            </button>
            {logoutError ? <p className={styles.sidebarError} role="alert">{locale === "ar" ? "تعذر تسجيل الخروج. حاول مجددًا." : "Could not sign out. Try again."}</p> : null}
          </div>
        </aside>
        <div className={styles.contentColumn} inert={drawerOpen ? true : undefined} aria-hidden={drawerOpen || undefined}>
          <header className={styles.topbar}>
            <button ref={menuButtonRef} className={`${styles.buttonSecondary} ${styles.iconButton} ${styles.mobileMenuButton}`} type="button" aria-controls={menuId} aria-expanded={drawerOpen} aria-label={messages.openMenu} onClick={(event) => { event.currentTarget.blur(); setMenuOpen(true); }}>
              <Menu size={19} aria-hidden="true" />
            </button>
            <Link className={styles.localeLink} href={switchedPath} lang={otherLocale} hrefLang={otherLocale}>
              <Languages size={17} aria-hidden="true" />
              {locale === "ar" ? "English" : "العربية"}
            </Link>
            <div className={styles.actor}>
              <strong>{actor.name}</strong>
              <span>{actor.email}</span>
            </div>
          </header>
          <main id="admin-main" className={styles.main} tabIndex={-1}>{children}</main>
        </div>
      </div>
    </div>
  );
}
