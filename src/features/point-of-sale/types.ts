export type TileCategory =
  | "All Products"
  | "Wall Tiles"
  | "Floor Tiles"
  | "Porcelain"
  | "Marble"
  | "Mosaic"
  | "Sanitary"
  | "Adhesives"
  | "Tools";

export type PaymentMethod =
  | "CASH"
  | "MOBILE_WALLET"
  | "CARD"
  | "BANK_TRANSFER"
  | "WALLET";
export type DiscountType = "PERCENTAGE" | "FIXED";

export interface PosProduct {
  id: string;
  sku: string;
  name: string;
  category: Exclude<TileCategory, "All Products">;
  brand: string;
  dimensions: string;
  finish: string;
  imageClass: string;
  pricePaise: number;
  stockSqFt: number;
  status: "IN_STOCK" | "LOW_STOCK";
}

export interface CartItem {
  productId: string;
  quantitySqFt: number;
  unitPricePaise: number;
}

export interface PosCustomer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  gstNumber?: string;
  outstandingPaise?: number;
  type: "WALK_IN" | "RETAIL" | "TRADE";
}

export interface HeldInvoice {
  id: string;
  reference: string;
  note: string;
  items: CartItem[];
  customerId: string;
  createdAt: string;
}

export interface CompletedInvoice {
  invoiceNumber: string;
  createdAt: string;
  customerId: string;
  items: CartItem[];
  subtotalPaise: number;
  discountPaise: number;
  discountType: DiscountType;
  taxRate: number;
  taxPaise: number;
  grandTotalPaise: number;
  paymentMethod: PaymentMethod;
}
