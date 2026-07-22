import "server-only";

import { cache } from "react";
import type { ContentPageType } from "@prisma/client";
import { db } from "@/lib/db";
import type { Locale } from "./config";
import { translate } from "./dictionaries";

export interface PublicBusinessSettings { name: string; phone?: string; email?: string; location?: string; mapUrl?: string; openingHours?: string; currency: string }
export interface HomepageContent { title: string; body: string; imageUrl: string }
export interface PublicContent { title: string; body: string; source: "database" | "fallback" | "unavailable" }

type JsonMap = Record<string, unknown>;
function asMap(value: unknown): JsonMap { return typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonMap : {}; }
function asString(value: unknown) { return typeof value === "string" ? value : undefined; }

const getPublicSettingsRows = cache(async () => {
  if (!process.env.DATABASE_URL) return null;
  try { return await db.siteSetting.findMany({ where: { isPublic: true } }); } catch (error) { console.error("Public settings query failed", error); return undefined; }
});

export async function getPublicBusinessSettings(locale: Locale): Promise<PublicBusinessSettings | null> {
  const rows = await getPublicSettingsRows();
  if (rows === undefined || (rows === null && process.env.NODE_ENV === "production")) return null;
  if (rows === null) return { name: locale === "ar" ? "JYS لمستلزمات الحلاقة" : "JYS Barber Supplies", phone: "+970 59 100 0001", email: "hello@jys.local", location: locale === "ar" ? "رام الله، فلسطين" : "Ramallah, Palestine", openingHours: locale === "ar" ? "السبت–الخميس، 9:00–18:00" : "Saturday–Thursday, 09:00–18:00", currency: "ILS" };
  const values = Object.fromEntries(rows.map((row) => [row.key, row.value])); const profile = asMap(values["store.profile"]); const location = asMap(values["store.location"]); const hours = asMap(values["store.openingHours"]); const currency = asMap(values["commerce.currency"]);
  const name = asString(profile[locale === "ar" ? "nameAr" : "nameEn"]); const address = asString(location[locale === "ar" ? "addressAr" : "addressEn"]); const openingHours = asString(hours[locale]); const currencyCode = asString(currency.code);
  if (!name || !address || !openingHours || !currencyCode) return null;
  return { name, phone: asString(profile.phone), email: asString(profile.email), location: address, mapUrl: asString(location.mapUrl), openingHours, currency: currencyCode };
}

export async function getHomepageContent(locale: Locale): Promise<HomepageContent | null> {
  const rows = await getPublicSettingsRows();
  if (rows === undefined || (rows === null && process.env.NODE_ENV === "production")) return null;
  if (rows === null) return { title: translate(locale, "home.title"), body: translate(locale, "home.subtitle"), imageUrl: "/images/jys-hero.png" };
  const row = rows.find((item) => item.key === "homepage.promotion"); if (!row) return null; const promotion = asMap(row.value);
  const title = asString(promotion[locale === "ar" ? "titleAr" : "titleEn"]); const body = asString(promotion[locale === "ar" ? "bodyAr" : "bodyEn"]); if (!title || !body) return null;
  return { title, body, imageUrl: asString(promotion.imageUrl) ?? "/images/jys-hero.png" };
}

const policyKeys: Record<Exclude<ContentPageType, "HOMEPAGE">, { title: string; body: string }> = {
  TERMS: { title: "policy.terms", body: "policy.termsBody" }, PRIVACY: { title: "policy.privacy", body: "policy.privacyBody" }, NO_RETURN: { title: "policy.returns", body: "policy.returnsBody" }, WARRANTY: { title: "policy.warranty", body: "policy.warrantyBody" }, DELIVERY: { title: "policy.delivery", body: "policy.deliveryBody" }, PICKUP: { title: "policy.pickup", body: "policy.pickupBody" },
};

export async function getPolicyContent(type: Exclude<ContentPageType, "HOMEPAGE">, locale: Locale): Promise<PublicContent> {
  if (process.env.DATABASE_URL) {
    try { const page = await db.contentPage.findFirst({ where: { type, isPublished: true } }); if (page) return { title: locale === "ar" ? page.titleAr || page.titleEn : page.titleEn || page.titleAr, body: locale === "ar" ? page.bodyAr || page.bodyEn : page.bodyEn || page.bodyAr, source: "database" }; return { title: translate(locale, policyKeys[type].title), body: "", source: "unavailable" }; } catch (error) { console.error(`Public content query failed: ${type}`, error); return { title: translate(locale, policyKeys[type].title), body: "", source: "unavailable" }; }
  }
  if (process.env.NODE_ENV === "production") return { title: translate(locale, policyKeys[type].title), body: "", source: "unavailable" };
  return { title: translate(locale, policyKeys[type].title), body: translate(locale, policyKeys[type].body), source: "fallback" };
}
