import type { Locale } from "@/lib/i18n/config";
import { resolveSalePricing } from "@/lib/domain/pricing";

export interface LocalizedText { ar: string; en: string }
export interface Category { id: string; slug: string; name: LocalizedText; description: LocalizedText; accent: string }
export interface ProductVariant { id: string; sku: string; label: LocalizedText; price?: number; effectivePrice?: number; onSale?: boolean; discountPercentage?: number; stock: number; available: boolean }
export interface Product {
  id: string; sku: string; name: LocalizedText; description: LocalizedText;
  categorySlug: string; price: number; stock: number; featured: boolean; createdAt: string;
  effectivePrice?: number; onSale?: boolean; discountPercentage?: number; saleStartsAt?: string; saleEndsAt?: string; saleUpdatedAt?: string;
  variants: ProductVariant[]; images?: string[]; imageAlts?: LocalizedText[]; visual: { from: string; to: string; kind: "bottle" | "clipper" | "razor" | "comb" | "brush" | "jar"; image?: string };
}

export const demoCategories: Category[] = [
  { id: "c-tools", slug: "tools", name: { ar: "أدوات الحلاقة", en: "Barber tools" }, description: { ar: "أدوات دقيقة للعمل اليومي", en: "Precise tools for everyday work" }, accent: "#c8783e" },
  { id: "c-clippers", slug: "clippers", name: { ar: "ماكينات الحلاقة", en: "Clippers & trimmers" }, description: { ar: "أداء ثابت وقصّات أنظف", en: "Consistent power and cleaner cuts" }, accent: "#64748b" },
  { id: "c-styling", slug: "styling", name: { ar: "التصفيف", en: "Hair styling" }, description: { ar: "ثبات وملمس لكل تسريحة", en: "Hold and texture for every finish" }, accent: "#b08b57" },
  { id: "c-beard", slug: "beard-care", name: { ar: "العناية باللحية", en: "Beard care" }, description: { ar: "تنظيف وترطيب ولمسة مرتبة", en: "Clean, condition and finish" }, accent: "#66785f" },
  { id: "c-shaving", slug: "shaving", name: { ar: "منتجات الحلاقة", en: "Shaving essentials" }, description: { ar: "تحضير وحلاقة وعناية لاحقة", en: "Prep, shave and aftercare" }, accent: "#6f7d94" },
  { id: "c-salon", slug: "salon", name: { ar: "مستلزمات الصالون", en: "Shop essentials" }, description: { ar: "تفاصيل تنظّم مساحة العمل", en: "The details that keep work flowing" }, accent: "#8a6b61" },
];

export const demoProducts: Product[] = [
  { id: "p-clipper", sku: "JYS-CLP-101", name: { ar: "ماكينة فورج برو", en: "Forge Pro Clipper" }, description: { ar: "ماكينة قوية بهيكل متوازن ومحرك ثابت للقص المتواصل. مناسبة للتدريج والعمل اليومي.", en: "A balanced professional clipper with steady cutting power for fades and demanding daily work." }, categorySlug: "clippers", price: 289, stock: 9, featured: true, createdAt: "2026-06-18", variants: [{ id: "v-black", sku: "JYS-CLP-101-B", label: { ar: "أسود مطفي", en: "Matte black" }, stock: 6, available: true }, { id: "v-silver", sku: "JYS-CLP-101-S", label: { ar: "فضي", en: "Steel silver" }, stock: 3, available: true }], visual: { from: "#111827", to: "#475569", kind: "clipper", image: "/images/products/clipper.png" } },
  { id: "p-trimmer", sku: "JYS-TRM-206", name: { ar: "ماكينة تحديد لاين كرافت", en: "Linecraft Detail Trimmer" }, description: { ar: "شفرة دقيقة للتحديد والحواف مع قبضة مريحة وتحكم واضح.", en: "A close-cutting detail trimmer designed for crisp outlines and controlled finishing." }, categorySlug: "clippers", price: 215, stock: 4, featured: true, createdAt: "2026-07-02", variants: [], visual: { from: "#1f2937", to: "#9a704a", kind: "clipper" } },
  { id: "p-pomade", sku: "JYS-STY-310", name: { ar: "كلاي تثبيت مطفي", en: "Matte Clay Pomade" }, description: { ar: "تثبيت قوي بلمسة مطفية قابلة لإعادة التشكيل دون ملمس دهني.", en: "Strong, workable hold with a clean matte finish and no greasy residue." }, categorySlug: "styling", price: 42, stock: 28, featured: true, createdAt: "2026-05-21", variants: [{ id: "v-100", sku: "JYS-STY-310-100", label: { ar: "100 مل", en: "100 ml" }, stock: 18, available: true }, { id: "v-150", sku: "JYS-STY-310-150", label: { ar: "150 مل", en: "150 ml" }, price: 58, stock: 10, available: true }], visual: { from: "#302a25", to: "#b08b57", kind: "jar", image: "/images/products/styling-clay.png" } },
  { id: "p-gel", sku: "JYS-STY-315", name: { ar: "جل بريسيجن هولد", en: "Precision Hold Gel" }, description: { ar: "جل ثابت بلمعان متوازن لا يترك قشوراً ويُغسل بسهولة.", en: "Reliable definition with a balanced shine, flake-free finish and easy rinse." }, categorySlug: "styling", price: 28, stock: 40, featured: false, createdAt: "2026-03-11", variants: [], visual: { from: "#283d49", to: "#75a0a8", kind: "jar" } },
  { id: "p-oil", sku: "JYS-BRD-402", name: { ar: "زيت لحية بالأرز", en: "Cedar Beard Oil" }, description: { ar: "مزيج خفيف لتنعيم شعر اللحية وترطيب البشرة برائحة خشبية هادئة.", en: "A lightweight conditioning blend with a restrained cedar profile." }, categorySlug: "beard-care", price: 38, stock: 17, featured: true, createdAt: "2026-06-02", variants: [{ id: "v-30", sku: "JYS-BRD-402-30", label: { ar: "30 مل", en: "30 ml" }, stock: 12, available: true }, { id: "v-50", sku: "JYS-BRD-402-50", label: { ar: "50 مل", en: "50 ml" }, price: 52, stock: 5, available: true }], visual: { from: "#27332b", to: "#7c5c3d", kind: "bottle", image: "/images/products/beard-care.png" } },
  { id: "p-balm", sku: "JYS-BRD-418", name: { ar: "بلسم اللحية اليومي", en: "Daily Beard Balm" }, description: { ar: "ترطيب وتحكم خفيف للشعر المتطاير بملمس طبيعي.", en: "Everyday conditioning and light control for a natural, tidy beard." }, categorySlug: "beard-care", price: 34, stock: 0, featured: false, createdAt: "2026-02-18", variants: [], visual: { from: "#292b25", to: "#78836c", kind: "jar" } },
  { id: "p-razor", sku: "JYS-TOL-503", name: { ar: "موس حلاقة كلاسيكي", en: "Classic Shavette" }, description: { ar: "موس تحديد متوازن مع قفل آمن للشفرة وقبضة ثابتة.", en: "A balanced shavette with secure blade seating and confident handling." }, categorySlug: "tools", price: 46, stock: 13, featured: true, createdAt: "2026-06-27", variants: [{ id: "v-wood", sku: "JYS-TOL-503-W", label: { ar: "مقبض خشبي", en: "Walnut handle" }, price: 52, stock: 7, available: true }, { id: "v-black", sku: "JYS-TOL-503-B", label: { ar: "مقبض أسود", en: "Black handle" }, stock: 6, available: true }], visual: { from: "#20242a", to: "#895f3f", kind: "razor", image: "/images/products/shaving-set.png" } },
  { id: "p-comb", sku: "JYS-TOL-516", name: { ar: "طقم أمشاط كربون", en: "Carbon Cutting Comb Set" }, description: { ar: "أمشاط خفيفة مقاومة للحرارة والكهرباء الساكنة بثلاثة مقاسات.", en: "Three lightweight, heat-resistant and anti-static combs for cutting and finishing." }, categorySlug: "tools", price: 31, stock: 24, featured: false, createdAt: "2026-04-08", variants: [], visual: { from: "#1d2128", to: "#555d69", kind: "comb" } },
  { id: "p-foam", sku: "JYS-SHV-604", name: { ar: "رغوة حلاقة منعشة", en: "Cooling Shave Foam" }, description: { ar: "رغوة كثيفة تساعد على انزلاق الشفرة وتترك البشرة منتعشة.", en: "Dense cushioning foam for smooth razor glide and a clean cooling finish." }, categorySlug: "shaving", price: 26, stock: 35, featured: false, createdAt: "2026-01-16", variants: [], visual: { from: "#304654", to: "#7da6a8", kind: "bottle" } },
  { id: "p-aftershave", sku: "JYS-SHV-620", name: { ar: "تونك ما بعد الحلاقة", en: "Calm Aftershave Tonic" }, description: { ar: "تونك خفيف لتهدئة البشرة بعد الحلاقة برائحة نظيفة غير حادة.", en: "A light post-shave tonic that calms skin with a restrained clean scent." }, categorySlug: "shaving", price: 36, stock: 8, featured: true, createdAt: "2026-06-08", variants: [], visual: { from: "#273948", to: "#718ca0", kind: "bottle" } },
  { id: "p-brush", sku: "JYS-SAL-703", name: { ar: "فرشاة تنظيف الرقبة", en: "Soft Neck Duster" }, description: { ar: "شعيرات ناعمة وكثيفة لإزالة الشعر براحة بعد القص.", en: "Dense soft fibres lift loose hair comfortably after every cut." }, categorySlug: "salon", price: 39, stock: 15, featured: false, createdAt: "2026-05-04", variants: [], visual: { from: "#33312f", to: "#94735a", kind: "brush" } },
  { id: "p-spray", sku: "JYS-SAL-711", name: { ar: "بخاخ رذاذ مستمر", en: "Continuous Mist Bottle" }, description: { ar: "رذاذ متجانس بقبضة مريحة وتحكم سلس أثناء القص والتصفيف.", en: "A fine continuous mist with an easy grip for controlled prep and styling." }, categorySlug: "salon", price: 29, stock: 22, featured: false, createdAt: "2026-05-30", variants: [{ id: "v-black", sku: "JYS-SAL-711-B", label: { ar: "أسود", en: "Black" }, stock: 14, available: true }, { id: "v-amber", sku: "JYS-SAL-711-A", label: { ar: "كهرماني", en: "Amber" }, stock: 8, available: true }], visual: { from: "#242a2e", to: "#9b683e", kind: "bottle" } },
];

const demoSalePrices: Record<string, number> = { "p-clipper": 231.2, "p-pomade": 35.7, "p-oil": 32.3, "p-aftershave": 28.8 };
for (const product of demoProducts) {
  const effectivePrice = demoSalePrices[product.id];
  if (effectivePrice === undefined) continue;
  const pricing = resolveSalePricing({ normalPrice: product.price, isOnSale: true, salePrice: effectivePrice });
  product.effectivePrice = Number(pricing.effectivePrice);
  product.onSale = pricing.isOnSale;
  product.discountPercentage = pricing.discountPercentage;
  product.saleUpdatedAt = "2026-08-01T00:00:00.000Z";
  for (const variant of product.variants) {
    const normal = variant.price ?? product.price;
    const variantPricing = resolveSalePricing({ normalPrice: product.price, isOnSale: true, salePrice: effectivePrice }, normal);
    variant.effectivePrice = Number(variantPricing.effectivePrice);
    variant.onSale = variantPricing.isOnSale;
    variant.discountPercentage = variantPricing.discountPercentage;
  }
}

export const demoCities = [
  { id: "ramallah", ar: "رام الله والبيرة", en: "Ramallah & Al-Bireh", areas: [{ id: "center", ar: "وسط المدينة", en: "City centre" }, { id: "birzeit", ar: "بيرزيت", en: "Birzeit" }, { id: "beitunia", ar: "بيتونيا", en: "Beitunia" }] },
  { id: "jerusalem", ar: "القدس", en: "Jerusalem", areas: [{ id: "east", ar: "القدس الشرقية", en: "East Jerusalem" }, { id: "suburbs", ar: "الضواحي", en: "Suburbs" }] },
  { id: "nablus", ar: "نابلس", en: "Nablus", areas: [{ id: "center", ar: "المدينة", en: "City" }, { id: "rafidia", ar: "رفيديا", en: "Rafidia" }] },
  { id: "hebron", ar: "الخليل", en: "Hebron", areas: [{ id: "center", ar: "المدينة", en: "City" }, { id: "dura", ar: "دورا", en: "Dura" }] },
  { id: "jenin", ar: "جنين", en: "Jenin", areas: [{ id: "center", ar: "المدينة", en: "City" }] },
];

export function localize(value: LocalizedText, locale: Locale): string { return value[locale] || value.en || value.ar; }
