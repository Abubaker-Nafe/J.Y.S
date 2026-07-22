import { Prisma, PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import {
  DEFAULT_SEED_CREDENTIALS,
  assertSafeSeedCredentials,
  existingSeedProductUpdate,
  existingSeedVariantUpdate,
} from "./seed-policy";

const prisma = new PrismaClient();

const ADMIN_ID = "seed_user_admin";
const CUSTOMER_ID = "seed_user_customer";

async function seedLocations() {
  const cities = [
    ["city_ramallah", "ramallah", "رام الله والبيرة", "Ramallah & Al-Bireh", "20.00"],
    ["city_jerusalem", "jerusalem", "القدس", "Jerusalem", "25.00"],
    ["city_nablus", "nablus", "نابلس", "Nablus", "25.00"],
    ["city_hebron", "hebron", "الخليل", "Hebron", "25.00"],
    ["city_bethlehem", "bethlehem", "بيت لحم", "Bethlehem", "25.00"],
    ["city_jenin", "jenin", "جنين", "Jenin", "30.00"],
  ] as const;
  for (const [id, slug, nameAr, nameEn, deliveryFee] of cities) {
    await prisma.city.upsert({
      where: { id },
      create: { id, slug, nameAr, nameEn, deliveryFee, displayOrder: cities.findIndex((c) => c[0] === id) },
      update: { slug, nameAr, nameEn, deliveryFee, isActive: true },
    });
  }

  const areas = [
    ["area_ramallah_centre", "city_ramallah", "centre", "وسط البلد", "City Centre", "15.00"],
    ["area_albireh", "city_ramallah", "al-bireh", "البيرة", "Al-Bireh", "15.00"],
    ["area_birzeit", "city_ramallah", "birzeit", "بيرزيت", "Birzeit", "20.00"],
    ["area_jerusalem_centre", "city_jerusalem", "centre", "وسط القدس", "Jerusalem Centre", null],
    ["area_nablus_centre", "city_nablus", "centre", "وسط نابلس", "Nablus Centre", "20.00"],
    ["area_rafidia", "city_nablus", "rafidia", "رفيديا", "Rafidia", "20.00"],
    ["area_hebron_centre", "city_hebron", "centre", "وسط الخليل", "Hebron Centre", "20.00"],
    ["area_bethlehem_centre", "city_bethlehem", "centre", "وسط بيت لحم", "Bethlehem Centre", "20.00"],
  ] as const;
  for (const [id, cityId, slug, nameAr, nameEn, deliveryFee] of areas) {
    await prisma.area.upsert({
      where: { id },
      create: { id, cityId, slug, nameAr, nameEn, deliveryFee, displayOrder: areas.findIndex((a) => a[0] === id) },
      update: { cityId, slug, nameAr, nameEn, deliveryFee, isActive: true },
    });
  }
}

async function seedUsers() {
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? DEFAULT_SEED_CREDENTIALS.adminEmail).trim().toLowerCase();
  const customerEmail = (process.env.SEED_CUSTOMER_EMAIL ?? DEFAULT_SEED_CREDENTIALS.customerEmail).trim().toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? DEFAULT_SEED_CREDENTIALS.adminPassword;
  const customerPassword = process.env.SEED_CUSTOMER_PASSWORD ?? DEFAULT_SEED_CREDENTIALS.customerPassword;
  if (adminPassword.length < 10 || customerPassword.length < 10) {
    throw new Error("Seed passwords must contain at least 10 characters");
  }
  assertSafeSeedCredentials({
    nodeEnv: process.env.NODE_ENV,
    appUrl: process.env.APP_URL,
    adminEmail,
    adminPassword,
    customerEmail,
    customerPassword,
  });

  await prisma.user.upsert({
    where: { id: ADMIN_ID },
    create: {
      id: ADMIN_ID,
      email: adminEmail,
      name: "JYS Administrator",
      phone: "+970591000001",
      passwordHash: await hash(adminPassword, 12),
      role: "ADMIN",
    },
    // A repeat seed must never rotate credentials, elevate a role, or
    // reactivate an account that an operator intentionally changed.
    update: {},
  });

  await prisma.user.upsert({
    where: { id: CUSTOMER_ID },
    create: {
      id: CUSTOMER_ID,
      email: customerEmail,
      name: "Ahmad Khalil",
      phone: "+970599123456",
      passwordHash: await hash(customerPassword, 12),
      role: "CUSTOMER",
    },
    update: {},
  });
  await prisma.customerProfile.upsert({
    where: { userId: CUSTOMER_ID },
    create: { id: "seed_profile_customer", userId: CUSTOMER_ID, preferredLocale: "ar" },
    update: { preferredLocale: "ar" },
  });
  await prisma.address.upsert({
    where: { id: "seed_address_customer" },
    create: {
      id: "seed_address_customer",
      userId: CUSTOMER_ID,
      label: "المنزل",
      recipientName: "Ahmad Khalil",
      phone: "+970599123456",
      cityId: "city_ramallah",
      areaId: "area_albireh",
      addressLine: "شارع الإرسال، بناية 12",
      locationDetails: "الطابق الثاني بجانب الصيدلية",
    },
    update: { isActive: true },
  });
  await prisma.customerProfile.update({
    where: { userId: CUSTOMER_ID },
    data: { defaultAddressId: "seed_address_customer" },
  });

  return { adminEmail, customerEmail };
}

async function seedCatalog() {
  const categories = [
    ["category_clippers", "clippers-trimmers", "ماكينات الحلاقة والتشذيب", "Clippers & Trimmers"],
    ["category_styling", "hair-styling", "تصفيف الشعر", "Hair Styling"],
    ["category_shaving", "shaving", "الحلاقة", "Shaving"],
    ["category_beard", "beard-care", "العناية باللحية", "Beard Care"],
    ["category_accessories", "barber-accessories", "إكسسوارات الحلاقة", "Barber Accessories"],
  ] as const;
  for (const [id, slug, nameAr, nameEn] of categories) {
    await prisma.category.upsert({
      where: { id },
      create: {
        id,
        slug,
        nameAr,
        nameEn,
        descriptionAr: `منتجات ${nameAr} المختارة للاستخدام المهني والمنزلي.`,
        descriptionEn: `Selected ${nameEn.toLowerCase()} for professional and home use.`,
        displayOrder: categories.findIndex((category) => category[0] === id),
      },
      update: { slug, nameAr, nameEn, isActive: true, archivedAt: null },
    });
  }

  type SeedVariant = readonly [
    id: string,
    sku: string,
    labelAr: string,
    labelEn: string,
    priceOverride: string | null,
    stockQuantity: number,
    attributes: Prisma.InputJsonObject,
  ];
  type SeedProduct = {
    id: string;
    categoryId: string;
    slug: string;
    sku: string;
    nameAr: string;
    nameEn: string;
    descriptionAr: string;
    descriptionEn: string;
    price: string;
    stockQuantity: number;
    lowStockThreshold: number;
    isFeatured: boolean;
    image: string;
    variants: SeedVariant[];
  };
  const products: SeedProduct[] = [
    {
      id: "product_precision_clipper",
      categoryId: "category_clippers",
      slug: "precision-pro-clipper",
      sku: "JYS-CLP-001",
      nameAr: "ماكينة حلاقة برو الدقيقة",
      nameEn: "Precision Pro Clipper",
      descriptionAr: "ماكينة حلاقة قوية للاستخدام اليومي مع شفرات دقيقة وملحقات متعددة.",
      descriptionEn: "A dependable daily-use clipper with precision blades and multiple guides.",
      price: "189.00",
      stockQuantity: 0,
      lowStockThreshold: 4,
      isFeatured: true,
      image: "/images/products/clipper.png",
      variants: [
        ["variant_clipper_black", "JYS-CLP-001-BLK", "أسود", "Black", "189.00", 14, { color: "black" }],
        ["variant_clipper_silver", "JYS-CLP-001-SLV", "فضي", "Silver", "199.00", 7, { color: "silver" }],
      ],
    },
    {
      id: "product_styling_clay",
      categoryId: "category_styling",
      slug: "matte-styling-clay",
      sku: "JYS-STY-001",
      nameAr: "طين تصفيف مطفي",
      nameEn: "Matte Styling Clay",
      descriptionAr: "ثبات مرن ولمسة مطفية دون مظهر دهني، مناسب للاستخدام اليومي.",
      descriptionEn: "Flexible hold and a natural matte finish without greasy residue.",
      price: "39.00",
      stockQuantity: 36,
      lowStockThreshold: 8,
      isFeatured: true,
      image: "/images/products/styling-clay.png",
      variants: [],
    },
    {
      id: "product_beard_oil",
      categoryId: "category_beard",
      slug: "nourishing-beard-oil",
      sku: "JYS-BRD-001",
      nameAr: "زيت مغذٍ للحية",
      nameEn: "Nourishing Beard Oil",
      descriptionAr: "زيت خفيف لترطيب اللحية والبشرة ومنحها مظهراً مرتباً.",
      descriptionEn: "Lightweight oil that softens facial hair and hydrates the skin beneath.",
      price: "49.00",
      stockQuantity: 0,
      lowStockThreshold: 6,
      isFeatured: true,
      image: "/images/products/beard-care.png",
      variants: [
        ["variant_beard_classic", "JYS-BRD-001-CLS", "رائحة كلاسيكية 30 مل", "Classic 30 ml", null, 18, { scent: "classic", size: "30ml" }],
        ["variant_beard_citrus", "JYS-BRD-001-CIT", "حمضيات 30 مل", "Citrus 30 ml", "52.00", 3, { scent: "citrus", size: "30ml" }],
      ],
    },
    {
      id: "product_shaving_set",
      categoryId: "category_shaving",
      slug: "complete-shaving-set",
      sku: "JYS-SHV-001",
      nameAr: "طقم حلاقة متكامل",
      nameEn: "Complete Shaving Set",
      descriptionAr: "مجموعة عملية تتضمن فرشاة ووعاء حلاقة وحامل مرتب.",
      descriptionEn: "A practical set with a shaving brush, bowl, and tidy stand.",
      price: "89.00",
      stockQuantity: 12,
      lowStockThreshold: 4,
      isFeatured: true,
      image: "/images/products/shaving-set.png",
      variants: [],
    },
    {
      id: "product_carbon_comb",
      categoryId: "category_accessories",
      slug: "carbon-cutting-comb",
      sku: "JYS-ACC-001",
      nameAr: "مشط قص كربوني",
      nameEn: "Carbon Cutting Comb",
      descriptionAr: "مشط خفيف مقاوم للحرارة والكهرباء الساكنة لقص دقيق.",
      descriptionEn: "A light, heat-resistant and anti-static comb for controlled cutting.",
      price: "18.00",
      stockQuantity: 48,
      lowStockThreshold: 10,
      isFeatured: false,
      image: "/images/products/clipper.png",
      variants: [],
    },
    {
      id: "product_razor_pack",
      categoryId: "category_shaving",
      slug: "professional-razor-blades",
      sku: "JYS-SHV-002",
      nameAr: "شفرات حلاقة احترافية",
      nameEn: "Professional Razor Blades",
      descriptionAr: "شفرات حادة معبأة بأمان للاستخدام المهني.",
      descriptionEn: "Sharp, safely packed razor blades intended for professional use.",
      price: "22.00",
      stockQuantity: 0,
      lowStockThreshold: 10,
      isFeatured: false,
      image: "/images/products/shaving-set.png",
      variants: [
        ["variant_razor_10", "JYS-SHV-002-10", "عبوة 10", "Pack of 10", null, 28, { quantity: "10" }],
        ["variant_razor_50", "JYS-SHV-002-50", "عبوة 50", "Pack of 50", "78.00", 9, { quantity: "50" }],
      ],
    },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { id: product.id },
      create: {
        id: product.id,
        categoryId: product.categoryId,
        slug: product.slug,
        sku: product.sku,
        nameAr: product.nameAr,
        nameEn: product.nameEn,
        descriptionAr: product.descriptionAr,
        descriptionEn: product.descriptionEn,
        price: product.price,
        stockQuantity: product.stockQuantity,
        lowStockThreshold: product.lowStockThreshold,
        status: "ACTIVE",
        isFeatured: product.isFeatured,
      },
      // Stock and lifecycle state are operational data. A repeat seed may
      // refresh sample metadata, but must not undo orders or admin actions.
      update: existingSeedProductUpdate(product),
    });
    await prisma.productImage.upsert({
      where: { storageKey: `seed-${product.id}.png` },
      create: {
        id: `image_${product.id}`,
        productId: product.id,
        url: product.image,
        storageKey: `seed-${product.id}.png`,
        altAr: product.nameAr,
        altEn: product.nameEn,
        mimeType: "image/png",
        sizeBytes: 1,
        isPrimary: true,
      },
      update: { url: product.image, altAr: product.nameAr, altEn: product.nameEn, isPrimary: true },
    });
    for (const variant of product.variants) {
      const [id, sku, labelAr, labelEn, priceOverride, stockQuantity, attributes] = variant;
      await prisma.productVariant.upsert({
        where: { id },
        create: {
          id,
          productId: product.id,
          sku,
          labelAr,
          labelEn,
          priceOverride,
          stockQuantity,
          attributes,
        },
        update: existingSeedVariantUpdate({ sku, labelAr, labelEn, priceOverride, attributes }),
      });
    }
  }

  await prisma.wishlistItem.upsert({
    where: { userId_productId: { userId: CUSTOMER_ID, productId: "product_precision_clipper" } },
    create: { id: "seed_wishlist_clipper", userId: CUSTOMER_ID, productId: "product_precision_clipper" },
    update: {},
  });
}

async function seedSettingsAndContent() {
  const settings: Array<[string, Prisma.InputJsonValue, string, boolean]> = [
    ["store.profile", { nameAr: "JYS لمستلزمات الحلاقة", nameEn: "JYS Barber Supplies", phone: "+970 59 100 0001", email: "hello@jys.local" }, "Store identity and contacts", true],
    ["store.location", { addressAr: "رام الله، فلسطين", addressEn: "Ramallah, Palestine", mapUrl: "" }, "Pickup location", true],
    ["store.openingHours", { ar: "السبت–الخميس، 9:00–18:00", en: "Saturday–Thursday, 09:00–18:00" }, "Pickup opening hours", true],
    ["commerce.currency", { code: "ILS", symbolAr: "₪", symbolEn: "₪" }, "Configured store currency", true],
    ["inventory.defaultLowStockThreshold", 5, "Default low-stock warning", false],
    ["homepage.promotion", { titleAr: "أدوات يعتمد عليها المحترفون", titleEn: "Tools professionals depend on", bodyAr: "تشكيلة عملية لصالونك وروتينك اليومي.", bodyEn: "A practical range for your shop and daily routine.", imageUrl: "/images/jys-hero.png" }, "Homepage hero", true],
  ];
  for (const [key, value, description, isPublic] of settings) {
    await prisma.siteSetting.upsert({
      where: { key },
      create: { key, value, description, isPublic, updatedById: ADMIN_ID },
      update: { value, description, isPublic, updatedById: ADMIN_ID },
    });
  }

  const pages = [
    ["TERMS", "terms", "الشروط والأحكام", "Terms & Conditions", "بإتمام الطلب، يؤكد العميل صحة المنتجات والكميات والأسعار وطريقة الاستلام. الدفع نقداً فقط.", "By placing an order, the customer confirms the products, quantities, prices, and fulfillment details. Cash is the only payment method."],
    ["PRIVACY", "privacy", "سياسة الخصوصية", "Privacy Policy", "نستخدم بياناتك لتنفيذ الطلبات وإدارة حسابك فقط، ولا نبيع بيانات العملاء.", "We use your data to fulfil orders and manage your account. We do not sell customer data."],
    ["NO_RETURN", "no-returns", "سياسة عدم الإرجاع", "No-return Policy", "لا نقبل إرجاع المنتجات. يرجى التحقق من تفاصيل الطلب قبل التأكيد.", "Returns are not accepted. Please verify every order detail before confirmation."],
    ["WARRANTY", "warranty", "سياسة الضمان", "Warranty Policy", "لا تقدم JYS ضماناً إضافياً إلا إذا ذُكر صراحةً لمنتج محدد.", "JYS provides no additional warranty unless one is explicitly stated for an individual product."],
    ["DELIVERY", "delivery", "معلومات التوصيل", "Delivery Information", "التوصيل خارجي والدفع نقداً عند الاستلام. تختلف الرسوم حسب المدينة والمنطقة.", "Delivery is handled externally and paid in cash on arrival. Fees vary by city and area."],
    ["PICKUP", "pickup", "الاستلام من المتجر", "In-store Pickup", "الاستلام من موقع JYS خلال ساعات الدوام والدفع نقداً عند الاستلام.", "Collect from JYS during opening hours and pay cash at collection."],
  ] as const;
  // Homepage promotion is a SiteSetting edited under Admin -> Settings. The
  // legacy enum member remains migration-compatible but is not seeded as a
  // second, competing content source.
  for (const [type, slug, titleAr, titleEn, bodyAr, bodyEn] of pages) {
    await prisma.contentPage.upsert({
      where: { type },
      create: { type, slug, titleAr, titleEn, bodyAr, bodyEn, publishedAt: new Date("2026-07-01T09:00:00.000Z") },
      update: { slug, titleAr, titleEn, bodyAr, bodyEn, isPublished: true },
    });
  }
}

async function seedOrders() {
  const orders = [
    {
      id: "seed_order_delivered",
      orderNumber: "JYS-20260701-0001",
      fulfillmentMethod: "DELIVERY" as const,
      paymentMethod: "CASH_ON_DELIVERY" as const,
      paymentStatus: "PAID" as const,
      status: "DELIVERED" as const,
      subtotal: "78.00",
      deliveryFee: "15.00",
      total: "93.00",
      cityId: "city_ramallah",
      areaId: "area_albireh",
      cityNameAr: "رام الله والبيرة",
      cityNameEn: "Ramallah & Al-Bireh",
      areaNameAr: "البيرة",
      areaNameEn: "Al-Bireh",
      addressLine: "شارع الإرسال، بناية 12",
      inventoryDeductedAt: new Date("2026-07-01T11:00:00.000Z"),
      completedAt: new Date("2026-07-03T15:00:00.000Z"),
      createdAt: new Date("2026-07-01T10:00:00.000Z"),
      item: { productId: "product_styling_clay", sku: "JYS-STY-001", nameAr: "طين تصفيف مطفي", nameEn: "Matte Styling Clay", unitPrice: "39.00", quantity: 2 },
    },
    {
      id: "seed_order_pickup",
      orderNumber: "JYS-20260712-0002",
      fulfillmentMethod: "PICKUP" as const,
      paymentMethod: "CASH_ON_PICKUP" as const,
      paymentStatus: "PENDING" as const,
      status: "READY_FOR_PICKUP" as const,
      subtotal: "89.00",
      deliveryFee: "0.00",
      total: "89.00",
      cityId: null,
      areaId: null,
      cityNameAr: null,
      cityNameEn: null,
      areaNameAr: null,
      areaNameEn: null,
      addressLine: null,
      inventoryDeductedAt: new Date("2026-07-12T13:00:00.000Z"),
      completedAt: null,
      createdAt: new Date("2026-07-12T12:00:00.000Z"),
      item: { productId: "product_shaving_set", sku: "JYS-SHV-001", nameAr: "طقم حلاقة متكامل", nameEn: "Complete Shaving Set", unitPrice: "89.00", quantity: 1 },
    },
    {
      id: "seed_order_new",
      orderNumber: "JYS-20260718-0003",
      fulfillmentMethod: "DELIVERY" as const,
      paymentMethod: "CASH_ON_DELIVERY" as const,
      paymentStatus: "PENDING" as const,
      status: "NEW" as const,
      subtotal: "49.00",
      deliveryFee: "20.00",
      total: "69.00",
      cityId: "city_nablus",
      areaId: "area_rafidia",
      cityNameAr: "نابلس",
      cityNameEn: "Nablus",
      areaNameAr: "رفيديا",
      areaNameEn: "Rafidia",
      addressLine: "شارع رفيديا الرئيسي",
      inventoryDeductedAt: null,
      completedAt: null,
      createdAt: new Date("2026-07-18T10:00:00.000Z"),
      item: { productId: "product_beard_oil", variantId: "variant_beard_classic", sku: "JYS-BRD-001-CLS", nameAr: "زيت مغذٍ للحية", nameEn: "Nourishing Beard Oil", labelAr: "رائحة كلاسيكية 30 مل", labelEn: "Classic 30 ml", unitPrice: "49.00", quantity: 1 },
    },
  ];

  for (const order of orders) {
    await prisma.order.upsert({
      where: { id: order.id },
      create: {
        id: order.id,
        orderNumber: order.orderNumber,
        userId: CUSTOMER_ID,
        fulfillmentMethod: order.fulfillmentMethod,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        status: order.status,
        currency: "ILS",
        subtotal: order.subtotal,
        deliveryFee: order.deliveryFee,
        total: order.total,
        customerName: "Ahmad Khalil",
        customerEmail: process.env.SEED_CUSTOMER_EMAIL ?? "customer@jys.local",
        customerPhone: "+970599123456",
        cityId: order.cityId,
        areaId: order.areaId,
        cityNameAr: order.cityNameAr,
        cityNameEn: order.cityNameEn,
        areaNameAr: order.areaNameAr,
        areaNameEn: order.areaNameEn,
        addressLine: order.addressLine,
        policyAcceptedAt: order.createdAt,
        inventoryDeductedAt: order.inventoryDeductedAt,
        confirmedAt: order.inventoryDeductedAt,
        completedAt: order.completedAt,
        createdAt: order.createdAt,
        items: {
          create: {
            id: `${order.id}_item`,
            productId: order.item.productId,
            variantId: "variantId" in order.item ? order.item.variantId : null,
            skuSnapshot: order.item.sku,
            productNameAr: order.item.nameAr,
            productNameEn: order.item.nameEn,
            variantLabelAr: "labelAr" in order.item ? order.item.labelAr : null,
            variantLabelEn: "labelEn" in order.item ? order.item.labelEn : null,
            unitPrice: order.item.unitPrice,
            quantity: order.item.quantity,
            lineTotal: new Prisma.Decimal(order.item.unitPrice).mul(order.item.quantity),
          },
        },
        statusHistory: {
          create: {
            id: `${order.id}_history`,
            toStatus: order.status,
            changedById: order.status === "NEW" ? null : ADMIN_ID,
            createdAt: order.createdAt,
          },
        },
      },
      // Once created, an order and its snapshots are operational history.
      // Repeat seeds must not rewind status/payment or rewrite used orders.
      update: {},
    });
  }

  await prisma.auditLog.upsert({
    where: { id: "seed_audit_login" },
    create: {
      id: "seed_audit_login",
      actorId: ADMIN_ID,
      action: "SEED_COMPLETED",
      entityType: "System",
      metadata: { source: "prisma/seed.ts" },
    },
    update: {},
  });
}

async function seedAnalyticsAndInventoryLedger() {
  const adjustments = [
    ["seed_adjust_styling_initial", "product_styling_clay", null, null, "INITIAL_STOCK", 38, "Initial sample stock"],
    ["seed_adjust_styling_order", "product_styling_clay", null, "seed_order_delivered", "ORDER_DEDUCTION", -2, "Seed delivered order"],
    ["seed_adjust_shaving_initial", "product_shaving_set", null, null, "INITIAL_STOCK", 13, "Initial sample stock"],
    ["seed_adjust_shaving_order", "product_shaving_set", null, "seed_order_pickup", "ORDER_DEDUCTION", -1, "Seed pickup order"],
    ["seed_adjust_clipper_black", "product_precision_clipper", "variant_clipper_black", null, "INITIAL_STOCK", 14, "Initial sample stock"],
    ["seed_adjust_clipper_silver", "product_precision_clipper", "variant_clipper_silver", null, "INITIAL_STOCK", 7, "Initial sample stock"],
    ["seed_adjust_beard_classic", "product_beard_oil", "variant_beard_classic", null, "INITIAL_STOCK", 18, "Initial sample stock"],
    ["seed_adjust_beard_citrus", "product_beard_oil", "variant_beard_citrus", null, "INITIAL_STOCK", 3, "Initial sample stock"],
  ] as const;
  for (const [id, productId, variantId, orderId, type, quantityDelta, reason] of adjustments) {
    await prisma.inventoryAdjustment.upsert({
      where: { id },
      create: {
        id,
        productId,
        variantId,
        orderId,
        type,
        quantityDelta,
        reason,
        createdById: ADMIN_ID,
      },
      // Ledger entries are immutable after their deterministic first insert.
      update: {},
    });
  }

  const views = [
    ["seed_view_1", "product_precision_clipper", "sample-browser-a", "2026-07-17T10:00:00.000Z"],
    ["seed_view_2", "product_precision_clipper", "sample-browser-b", "2026-07-18T10:00:00.000Z"],
    ["seed_view_3", "product_styling_clay", "sample-browser-a", "2026-07-18T11:00:00.000Z"],
    ["seed_view_4", "product_beard_oil", "sample-browser-c", "2026-07-18T12:00:00.000Z"],
  ] as const;
  for (const [id, productId, fingerprint, viewedAt] of views) {
    await prisma.productView.upsert({
      where: { id },
      create: { id, productId, fingerprint, viewedAt: new Date(viewedAt) },
      update: { productId, fingerprint, viewedAt: new Date(viewedAt) },
    });
  }
}

async function main() {
  await seedLocations();
  const credentials = await seedUsers();
  await seedCatalog();
  await seedSettingsAndContent();
  await seedOrders();
  await seedAnalyticsAndInventoryLedger();
  console.info("JYS development seed completed", credentials);
  console.info("Development passwords come from SEED_ADMIN_PASSWORD and SEED_CUSTOMER_PASSWORD.");
}

main()
  .catch((error: unknown) => {
    console.error("JYS seed failed", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
