import type { CartItem, DiscountType, PosProduct } from "@/features/point-of-sale/types";

export const formatPkr = (amountPaise: number) =>
  `Rs ${(amountPaise / 100).toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const formatDateTime = (isoDate: string) =>
  new Intl.DateTimeFormat("en-PK", { dateStyle: "medium", timeStyle: "short" }).format(new Date(isoDate));

export function getCartTotals({ cart, products, discountValue, discountType, taxRate }: { cart: CartItem[]; products: readonly PosProduct[]; discountValue: number; discountType: DiscountType; taxRate: number }) {
  const subtotalPaise = cart.reduce((sum, item) => sum + item.quantitySqFt * item.unitPricePaise, 0);
  const requestedDiscount = discountType === "PERCENTAGE"
    ? Math.round((subtotalPaise * Math.max(0, discountValue)) / 100)
    : Math.round(Math.max(0, discountValue) * 100);
  const discountPaise = Math.min(subtotalPaise, requestedDiscount);
  const taxablePaise = subtotalPaise - discountPaise;
  const taxPaise = Math.round((taxablePaise * taxRate) / 100);
  const totalQuantitySqFt = cart.reduce((sum, item) => sum + item.quantitySqFt, 0);
  return { subtotalPaise, discountPaise, taxPaise, grandTotalPaise: taxablePaise + taxPaise, totalQuantitySqFt, products };
}
