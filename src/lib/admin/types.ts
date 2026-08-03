export type AdminLocale = "ar" | "en";

export type AdminMetric = {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "success" | "warning" | "danger";
};

export type AdminDashboardData = {
  metrics: {
    totalSales: number;
    ordersToday: number;
    ordersWeek: number;
    ordersMonth: number;
    averageOrderValue: number;
    newOrders: number;
    lowStock: number;
    outOfStock: number;
  };
  salesSeries: Array<{ date: string; revenue: number; orders: number }>;
  statusSummary: Array<{ status: string; count: number }>;
  recentOrders: AdminOrderSummary[];
  stockAlerts: AdminInventoryRow[];
};

export type AdminProductSummary = {
  id: string;
  sku: string;
  nameAr: string;
  nameEn: string;
  price: number;
  effectivePrice: number;
  saleEnabled: boolean;
  salePrice: number | null;
  saleStartsAt: string | null;
  saleEndsAt: string | null;
  saleUpdatedAt: string | null;
  saleStatus: "DISABLED" | "INVALID" | "SCHEDULED" | "ACTIVE" | "EXPIRED";
  discountPercentage: number;
  stock: number;
  lowStockThreshold: number;
  status: string;
  available: boolean;
  active: boolean;
  featured: boolean;
  variationCount: number;
  archivedAt: string | null;
  categoryNameAr: string;
  categoryNameEn: string;
  primaryImageUrl: string | null;
  updatedAt: string;
};

export type AdminProductDetail = AdminProductSummary & {
  descriptionAr: string;
  descriptionEn: string;
  categoryId: string;
  images: Array<{
    id: string;
    storageKey: string;
    url: string;
    altAr: string;
    altEn: string;
    position: number;
    primary: boolean;
    mimeType: "image/jpeg" | "image/png" | "image/webp" | "image/avif";
    sizeBytes: number;
  }>;
  variants: Array<{
    id?: string;
    sku: string;
    labelAr: string;
    labelEn: string;
    priceOverride: number | null;
    stock: number;
    available: boolean;
    active: boolean;
  }>;
};

export type AdminCategory = {
  id: string;
  archivedAt: string | null;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  slug: string;
  active: boolean;
  displayOrder: number;
  productCount: number;
};

export type AdminInventoryRow = {
  id: string;
  productId: string;
  variantId: string | null;
  sku: string;
  nameAr: string;
  nameEn: string;
  variantAr: string | null;
  variantEn: string | null;
  stock: number;
  lowStockThreshold: number;
  active: boolean;
};

export type AdminInventoryAdjustment = {
  id: string;
  productId: string;
  variantId: string | null;
  productNameAr: string;
  productNameEn: string;
  sku: string;
  variantAr: string | null;
  variantEn: string | null;
  previousStock: number | null;
  quantityDelta: number;
  newStock: number | null;
  reason: string;
  admin: string;
  createdAt: string;
};

export type AdminOrderSummary = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string;
  status: string;
  paymentStatus: string;
  fulfillmentMethod: string;
  currency: string;
  total: number;
  createdAt: string;
};

export type AdminOrderDetail = AdminOrderSummary & {
  subtotal: number;
  cityNameAr: string | null;
  cityNameEn: string | null;
  areaNameAr: string | null;
  areaNameEn: string | null;
  address: string | null;
  locationDescription: string | null;
  notes: string | null;
  policyAcceptedAt: string;
  items: Array<{
    id: string;
    productId: string | null;
    sku: string;
    productNameAr: string;
    productNameEn: string;
    variantLabelAr: string | null;
    variantLabelEn: string | null;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
    imageUrl: string | null;
    imageAltAr: string;
    imageAltEn: string;
  }>;
  history: Array<{
    id: string;
    fromStatus: string | null;
    toStatus: string;
    changedBy: string;
    note: string | null;
    createdAt: string;
  }>;
};

export type AdminCustomer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string | null;
  orderCount: number;
  totalSpent: number;
  addressCount: number;
  joinedAt: string;
  lastOrderAt: string | null;
};

export type AdminCity = {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  active: boolean;
  displayOrder: number;
  areas: Array<{
    id: string;
    slug: string;
    nameAr: string;
    nameEn: string;
    active: boolean;
    displayOrder: number;
  }>;
};

export type AdminReportData = {
  from: string;
  to: string;
  status: string;
  categoryId: string;
  fulfillment: string;
  payment: string;
  paymentStatus: string;
  group: "day" | "week" | "month";
  metrics: {
    revenue: number;
    orderCount: number;
    averageOrderValue: number;
    fulfilledOrders: number;
    deliveredOrders: number;
    collectedOrders: number;
    cancelledOrders: number;
    deliveryOrders: number;
    pickupOrders: number;
    registeredCustomers: number;
    newCustomers: number;
    returningCustomers: number;
    abandonedCarts: number;
  };
  salesSeries: Array<{ period: string; revenue: number; orders: number }>;
  orders: Array<{
    orderNumber: string;
    createdAt: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    fulfillmentMethod: string;
    paymentMethod: string;
    paymentStatus: string;
    status: string;
    currency: string;
    subtotal: number;
    total: number;
    itemCount: number;
  }>;
  products: Array<{
    id: string;
    sku: string;
    nameAr: string;
    nameEn: string;
    units: number;
    revenue: number;
    views: number;
    wishlists: number;
    cartAdds: number;
    stock: number;
    lowStockThreshold: number;
    categoryAr: string;
    categoryEn: string;
    active: boolean;
    available: boolean;
    normalPrice: number;
    salePrice: number | null;
    effectivePrice: number;
    discountPercentage: number;
    saleStatus: "DISABLED" | "INVALID" | "SCHEDULED" | "ACTIVE" | "EXPIRED";
  }>;
  categories: Array<{
    id: string;
    nameAr: string;
    nameEn: string;
    units: number;
    revenue: number;
  }>;
  customers: Array<{
    id: string;
    name: string;
    email: string;
    phone: string;
    cityAr: string | null;
    cityEn: string | null;
    orderCount: number;
    spending: number;
    joinedAt: string;
    lastOrderAt: string | null;
  }>;
  insights: Array<{ key: string; titleAr: string; titleEn: string; detailAr: string; detailEn: string }>;
};

export type AdminContentPage = {
  id: string;
  key: string;
  slug: string;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  active: boolean;
  updatedAt: string;
};

export type AdminSetting = {
  key: string;
  valueAr: string;
  valueEn: string;
  description: string;
};

export type Paginated<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
};

export type AdminActor = {
  id: string;
  name: string;
  email: string;
  role: string;
};
