"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Banknote,
  CreditCard,
  Landmark,
  Maximize2,
  Minus,
  Package,
  PauseCircle,
  Plus,
  Printer,
  Search,
  Smartphone,
  Trash2,
  UserPlus,
  WalletCards,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  checkoutSaleAction,
  holdSaleAction,
  quickCreateCustomerAction,
} from "@/features/sales/actions";

type Product = {
  id: string;
  name: string;
  sku: string;
  categoryId: string;
  sellingPrice: string;
  barcodes: string[];
};
type Line = Product & {
  quantity: string;
  unitPrice: string;
  discount: string;
  discountType: "FIXED" | "PERCENTAGE";
  overrideReason: string;
};
type Props = {
  data: {
    categories: { id: string; name: string }[];
    customers: { id: string; name: string; phone: string | null }[];
    heldSales: unknown[];
    registerSession: { id: string; register: { name: string } } | null;
    products: Product[];
  };
  canDiscount: boolean;
  canOverridePrice: boolean;
  canCreateCustomer: boolean;
};
const number = (value: string) => Number.parseFloat(value) || 0;
const pkr = (value: number) =>
  new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR" }).format(
    value,
  );

const productSurfaces = [
  "from-slate-100 via-stone-50 to-slate-200",
  "from-amber-100 via-orange-50 to-stone-200",
  "from-zinc-200 via-slate-100 to-zinc-300",
  "from-orange-100 via-amber-50 to-stone-100",
  "from-stone-100 via-zinc-50 to-slate-200",
  "from-slate-200 via-zinc-100 to-stone-300",
];

const paymentOptions = [
  { value: "CASH", label: "Cash", icon: Banknote },
  { value: "CARD", label: "Card", icon: CreditCard },
  { value: "BANK_TRANSFER", label: "Bank", icon: Landmark },
  { value: "MOBILE_WALLET", label: "Wallet", icon: Smartphone },
  { value: "CREDIT", label: "Credit", icon: WalletCards },
] as const;

export function PosTerminal({
  data,
  canDiscount,
  canOverridePrice,
  canCreateCustomer,
}: Props) {
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [cart, setCart] = useState<Line[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [notes, setNotes] = useState("");
  const [cartDiscount, setCartDiscount] = useState("0");
  const [cartDiscountType, setCartDiscountType] = useState<
    "FIXED" | "PERCENTAGE"
  >("FIXED");
  const [method, setMethod] = useState<
    "CASH" | "CARD" | "BANK_TRANSFER" | "MOBILE_WALLET" | "CREDIT"
  >("CASH");
  const [cashReceived, setCashReceived] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const products = useMemo(
    () =>
      data.products.filter(
        (product) =>
          (category === "all" || product.categoryId === category) &&
          `${product.name} ${product.sku} ${product.barcodes.join(" ")}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [category, data.products, query],
  );
  const subtotal = cart.reduce(
    (sum, line) => sum + number(line.quantity) * number(line.unitPrice),
    0,
  );
  const itemDiscount = cart.reduce((sum, line) => {
    const base = number(line.quantity) * number(line.unitPrice);
    return (
      sum +
      (line.discountType === "PERCENTAGE"
        ? (base * number(line.discount)) / 100
        : number(line.discount))
    );
  }, 0);
  const cartDiscountAmount =
    cartDiscountType === "PERCENTAGE"
      ? ((subtotal - itemDiscount) * number(cartDiscount)) / 100
      : number(cartDiscount);
  const total = Math.max(0, subtotal - itemDiscount - cartDiscountAmount);
  const tendered = method === "CASH" ? number(cashReceived) || total : total;

  function add(product: Product) {
    setCart((current) => {
      const existing = current.find((line) => line.id === product.id);
      return existing
        ? current.map((line) =>
            line.id === product.id
              ? { ...line, quantity: String(number(line.quantity) + 1) }
              : line,
          )
        : [
            ...current,
            {
              ...product,
              quantity: "1",
              unitPrice: product.sellingPrice,
              discount: "0",
              discountType: "FIXED",
              overrideReason: "",
            },
          ];
    });
  }
  function update(id: string, changes: Partial<Line>) {
    setCart((current) =>
      current.map((line) => (line.id === id ? { ...line, ...changes } : line)),
    );
  }
  function clear() {
    setCart([]);
    setMessage("");
  }
  function saleInput(withPayments: boolean) {
    return {
      lines: cart.map((line) => ({
        productVariantId: line.id,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        ...(number(line.unitPrice) !== number(line.sellingPrice)
          ? { priceOverrideReason: line.overrideReason }
          : {}),
        ...(number(line.discount) > 0
          ? { discount: { type: line.discountType, value: line.discount } }
          : {}),
      })),
      ...(customerId ? { customerId } : {}),
      ...(notes ? { notes } : {}),
      ...(number(cartDiscount) > 0
        ? { cartDiscount: { type: cartDiscountType, value: cartDiscount } }
        : {}),
      ...(withPayments
        ? {
            payments: [{ paymentMethod: method, amount: String(tendered) }],
            checkoutRequestId: crypto.randomUUID(),
          }
        : {}),
    };
  }
  function checkout() {
    setMessage("");
    startTransition(async () => {
      const result = await checkoutSaleAction(
        saleInput(true) as Parameters<typeof checkoutSaleAction>[0],
      );
      setMessage(result.message);
      if (result.success) {
        setCart([]);
        setCashReceived("");
      }
    });
  }
  function hold() {
    setMessage("");
    startTransition(async () => {
      const result = await holdSaleAction(saleInput(false));
      setMessage(result.message);
      if (result.success) setCart([]);
    });
  }
  async function addCustomer() {
    const name = window.prompt("Customer name");
    if (!name) return;
    const result = await quickCreateCustomerAction({ name });
    setMessage(result.message);
    if (result.customer) setCustomerId(result.customer.id);
  }
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (!event.altKey) return;
      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key.toLowerCase() === "c" && cart.length) {
        event.preventDefault();
        checkout();
      }
      if (event.key.toLowerCase() === "h" && cart.length) {
        event.preventDefault();
        hold();
      }
      if (event.key.toLowerCase() === "x") {
        event.preventDefault();
        clear();
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  });

  return (
    <div className="grid min-h-[calc(100vh-9.5rem)] gap-5 xl:grid-cols-[minmax(0,1fr)_30rem]">
      <section className="min-w-0 space-y-4">
        <div className="bg-card rounded-2xl border p-3 shadow-sm">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="text-muted-foreground absolute top-3 left-3.5 size-4" />
              <Input
                ref={searchRef}
                className="bg-muted/60 h-11 border-0 pl-10 shadow-none focus-visible:ring-1"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search products by name, SKU, or barcode…"
                aria-label="Search products"
              />
              <kbd className="text-muted-foreground bg-background absolute top-3 right-3 hidden rounded border px-1.5 py-0.5 text-[10px] font-medium sm:block">
                Alt + S
              </kbd>
            </div>
            <Button
              variant="outline"
              className="h-11 rounded-xl px-3"
              onClick={() => document.documentElement.requestFullscreen?.()}
            >
              <Maximize2 className="size-4" />
              <span className="hidden sm:inline">Full screen</span>
            </Button>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            <Button
              size="sm"
              variant={category === "all" ? "default" : "outline"}
              className="h-10 shrink-0 rounded-xl px-4"
              onClick={() => setCategory("all")}
            >
              <Package className="size-4" /> All products
            </Button>
            {data.categories.map((item) => (
              <Button
                key={item.id}
                size="sm"
                variant={category === item.id ? "default" : "outline"}
                className="h-10 shrink-0 rounded-xl px-4"
                onClick={() => setCategory(item.id)}
              >
                {item.name}
              </Button>
            ))}
          </div>
        </div>
        <div className="bg-card rounded-2xl border p-3 shadow-sm">
          <div className="mb-3 flex items-center justify-between px-1">
            <div>
              <h2 className="font-semibold">Products</h2>
              <p className="text-muted-foreground text-xs">
                Tap a product to add it to the current sale
              </p>
            </div>
            <span className="text-muted-foreground text-xs">
              {products.length} item{products.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
            {products.map((product, index) => (
              <article
                key={product.id}
                className="group bg-background overflow-hidden rounded-xl border transition-shadow hover:shadow-md"
              >
                <button
                  type="button"
                  onClick={() => add(product)}
                  className="block w-full text-left"
                  aria-label={`Add ${product.name} to cart`}
                >
                  <div
                    className={`relative aspect-[1.38] overflow-hidden bg-gradient-to-br ${productSurfaces[index % productSurfaces.length]}`}
                  >
                    <div className="absolute inset-0 [background-image:linear-gradient(135deg,transparent_25%,rgba(255,255,255,.8)_25%,rgba(255,255,255,.8)_50%,transparent_50%,transparent_75%,rgba(255,255,255,.8)_75%)] [background-size:28px_28px] opacity-35" />
                    <span className="bg-background/90 absolute bottom-2 left-2 rounded-md px-2 py-1 text-[10px] font-medium shadow-sm">
                      {product.sku}
                    </span>
                  </div>
                </button>
                <div className="p-3">
                  <p className="truncate text-sm font-semibold">
                    {product.name}
                  </p>
                  <p className="mt-1 text-xs font-medium text-emerald-600">
                    Available
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="text-sm font-bold">
                      {pkr(number(product.sellingPrice))}
                    </span>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="outline"
                      className="border-primary text-primary hover:bg-primary hover:text-primary-foreground rounded-lg"
                      onClick={() => add(product)}
                      aria-label={`Add ${product.name} to cart`}
                    >
                      <Plus />
                    </Button>
                  </div>
                </div>
              </article>
            ))}
            {products.length === 0 ? (
              <div className="text-muted-foreground col-span-full rounded-xl border border-dashed p-12 text-center text-sm">
                No matching products found. Try a different search or category.
              </div>
            ) : null}
          </div>
        </div>
      </section>
      <aside className="bg-card flex min-h-[42rem] flex-col overflow-hidden rounded-2xl border shadow-sm xl:sticky xl:top-5 xl:max-h-[calc(100vh-7rem)]">
        <div className="border-b p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Current customer</h2>
              <p className="text-muted-foreground text-xs">
                {data.registerSession
                  ? data.registerSession.register.name
                  : "No open register"}
              </p>
            </div>
            {canCreateCustomer ? (
              <Button
                size="sm"
                variant="outline"
                className="rounded-lg"
                onClick={addCustomer}
              >
                <UserPlus className="size-4" /> New
              </Button>
            ) : null}
          </div>
          <select
            className="bg-background h-10 w-full rounded-lg border px-3 text-sm"
            value={customerId}
            onChange={(event) => setCustomerId(event.target.value)}
            aria-label="Customer"
          >
            <option value="">Walk-in customer</option>
            {data.customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
                {customer.phone ? ` — ${customer.phone}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold">Cart items ({cart.length})</h3>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive h-auto px-1"
            disabled={!cart.length}
            onClick={clear}
          >
            Clear cart
          </Button>
        </div>
        <div className="min-h-32 flex-1 space-y-3 overflow-auto p-4">
          {cart.length === 0 ? (
            <div className="text-muted-foreground flex h-40 flex-col items-center justify-center gap-2 text-center text-sm">
              <Package className="size-8 opacity-35" />
              <p>Your cart is empty.</p>
              <p className="text-xs">
                Select products from the catalog to start a sale.
              </p>
            </div>
          ) : (
            cart.map((line) => (
              <div
                key={line.id}
                className="bg-background rounded-xl border p-3"
              >
                <div className="flex justify-between gap-2">
                  <div className="min-w-0">
                    <span className="block truncate text-sm font-semibold">
                      {line.name}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {line.sku}
                    </span>
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove ${line.name}`}
                    onClick={() =>
                      setCart((current) =>
                        current.filter((item) => item.id !== line.id),
                      )
                    }
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <div className="bg-muted/30 flex items-center rounded-lg border">
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      onClick={() =>
                        update(line.id, {
                          quantity: String(
                            Math.max(0.0001, number(line.quantity) - 1),
                          ),
                        })
                      }
                    >
                      <Minus />
                    </Button>
                    <Input
                      className="h-7 w-14 border-0 bg-transparent px-0 text-center shadow-none focus-visible:ring-0"
                      value={line.quantity}
                      onChange={(event) =>
                        update(line.id, { quantity: event.target.value })
                      }
                      aria-label={`Quantity for ${line.name}`}
                    />
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      onClick={() =>
                        update(line.id, {
                          quantity: String(number(line.quantity) + 1),
                        })
                      }
                    >
                      <Plus />
                    </Button>
                  </div>
                  <Input
                    className="h-8 w-24 text-right text-sm"
                    disabled={!canOverridePrice}
                    value={line.unitPrice}
                    onChange={(event) =>
                      update(line.id, { unitPrice: event.target.value })
                    }
                    aria-label={`Price for ${line.name}`}
                  />
                </div>
                {canDiscount ? (
                  <div className="mt-3 flex gap-1">
                    <select
                      className="bg-background rounded-md border px-2 text-xs"
                      value={line.discountType}
                      onChange={(event) =>
                        update(line.id, {
                          discountType: event.target.value as
                            "FIXED" | "PERCENTAGE",
                        })
                      }
                    >
                      <option value="FIXED">PKR</option>
                      <option value="PERCENTAGE">%</option>
                    </select>
                    <Input
                      className="h-8"
                      value={line.discount}
                      onChange={(event) =>
                        update(line.id, { discount: event.target.value })
                      }
                      aria-label={`Discount for ${line.name}`}
                    />
                  </div>
                ) : null}
                {number(line.unitPrice) !== number(line.sellingPrice) ? (
                  <Input
                    className="mt-3 h-8"
                    value={line.overrideReason}
                    onChange={(event) =>
                      update(line.id, { overrideReason: event.target.value })
                    }
                    placeholder="Price override reason"
                    aria-label={`Override reason for ${line.name}`}
                  />
                ) : null}
              </div>
            ))
          )}
        </div>
        <div className="bg-muted/20 space-y-3 border-t p-4">
          <Input
            className="bg-background h-9"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Sale notes"
          />
          {canDiscount ? (
            <div className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-sm">Discount</span>
              <select
                className="bg-background h-9 rounded-md border px-2 text-xs"
                value={cartDiscountType}
                onChange={(event) =>
                  setCartDiscountType(
                    event.target.value as "FIXED" | "PERCENTAGE",
                  )
                }
                aria-label="Cart discount type"
              >
                <option value="FIXED">Cart PKR</option>
                <option value="PERCENTAGE">Cart %</option>
              </select>
              <Input
                className="bg-background h-9"
                value={cartDiscount}
                onChange={(event) => setCartDiscount(event.target.value)}
                aria-label="Cart discount"
              />
            </div>
          ) : null}
          <div className="space-y-1.5 border-y py-3 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{pkr(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Discount</span>
              <span>-{pkr(itemDiscount + cartDiscountAmount)}</span>
            </div>
            <div className="mt-1 flex justify-between text-lg font-bold">
              <span>Grand total</span>
              <span>{pkr(total)}</span>
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium">Payment method</p>
            <div className="grid grid-cols-5 gap-1.5">
              {paymentOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <Button
                    key={option.value}
                    type="button"
                    size="sm"
                    variant={method === option.value ? "default" : "outline"}
                    className="h-14 flex-col gap-1 rounded-lg px-1 text-[10px]"
                    onClick={() => setMethod(option.value)}
                    aria-pressed={method === option.value}
                  >
                    <Icon className="size-4" />
                    {option.label}
                  </Button>
                );
              })}
            </div>
          </div>
          {method === "CASH" ? (
            <Input
              className="bg-background h-10"
              value={cashReceived}
              onChange={(event) => setCashReceived(event.target.value)}
              placeholder={`Cash received — change ${pkr(Math.max(0, tendered - total))}`}
            />
          ) : null}
          {message ? (
            <p role="status" className="text-sm">
              {message}
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="rounded-xl"
              disabled={!cart.length || pending}
              onClick={hold}
            >
              <PauseCircle className="size-4" /> Hold
            </Button>
            <Button
              variant="outline"
              className="rounded-xl"
              disabled={!cart.length || pending}
              onClick={clear}
            >
              <Trash2 className="size-4" /> Clear
            </Button>
          </div>
          <Button
            className="shadow-primary/20 h-12 w-full rounded-xl text-base shadow-md"
            size="lg"
            disabled={!cart.length || pending || !data.registerSession}
            onClick={checkout}
          >
            {pending ? "Processing…" : "Complete sale"}
          </Button>
          <Button
            variant="ghost"
            className="h-8 w-full text-xs"
            onClick={() => window.print()}
          >
            <Printer /> Print receipt
          </Button>
        </div>
      </aside>
    </div>
  );
}
