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
  variantName: string;
  sku: string;
  qrValue: string;
  purchasePricePaise: number;
  sellingPricePaise: number;
  stockQuantity: number;
  lowStockThreshold: number;
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
