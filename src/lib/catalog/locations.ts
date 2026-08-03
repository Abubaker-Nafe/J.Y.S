import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { demoCities } from "@/lib/demo/catalog";
import type { Locale } from "@/lib/i18n/config";

export interface StorefrontArea { id: string; name: string }
export interface StorefrontCity { id: string; name: string; areas: StorefrontArea[] }
export interface StorefrontLocations { cities: StorefrontCity[]; source: "database" | "demo" | "unavailable" }

export const getStorefrontLocations = cache(async (locale: Locale): Promise<StorefrontLocations> => {
  if (!process.env.DATABASE_URL) {
    if (process.env.NODE_ENV === "production") return { cities: [], source: "unavailable" };
    return { source: "demo", cities: demoCities.map((city) => ({ id: city.id, name: city[locale], areas: city.areas.map((area) => ({ id: area.id, name: area[locale] })) })) };
  }
  try {
    const cities = await db.city.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
      select: {
        id: true,
        nameAr: true,
        nameEn: true,
        areas: {
          where: { isActive: true },
          orderBy: { displayOrder: "asc" },
          select: { id: true, nameAr: true, nameEn: true },
        },
      },
    });
    return { source: "database", cities: cities.map((city) => ({ id: city.id, name: locale === "ar" ? city.nameAr : city.nameEn, areas: city.areas.map((area) => ({ id: area.id, name: locale === "ar" ? area.nameAr : area.nameEn })) })) };
  } catch (error) {
    console.error("Storefront locations query failed", error);
    return { cities: [], source: "unavailable" };
  }
});
