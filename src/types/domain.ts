export type PaymentMethod = 'CASH' | 'UPI' | 'CARD' | 'CREDIT' | 'OTHER';

export type DashboardSummary = {
  todayRevenuePaise: number;
  todaySales: number;
  totalVariants: number;
  lowStock: number;
  outOfStock: number;
  draftItems: number;
};

export type InventoryVariant = {
  id: string;
  productId: string;
  productName: string;
  productCategory: string;
  productBrand: string | null;
  variantName: string;
  sku: string;
  qrValue: string;
  purchasePricePaise: number;
  sellingPricePaise: number;
  stockQuantity: number;
  lowStockThreshold: number;
};

export type PaginatedResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type SaleLine = {
  id: string;
  productName: string;
  variantName: string;
  quantity: number;
  unitPricePaise: number;
  lineTotalPaise: number;
};

export type DraftSale = {
  id: string;
  items: SaleLine[];
  totalPaise: number;
  itemCount: number;
};

export type RepairStatus = 'RECEIVED' | 'IN_REPAIR' | 'READY' | 'DELIVERED';

export type RepairJob = {
  id: string;
  customerName: string;
  phone: string;
  alternatePhone: string | null;
  deviceName: string;
  issue: string;
  accessoriesReceived: string | null;
  conditionNotes: string | null;
  estimatedCostPaise: number;
  advancePaise: number;
  status: RepairStatus;
  receivedAt: string;
  promisedDate: string | null;
  notes: string | null;
};
