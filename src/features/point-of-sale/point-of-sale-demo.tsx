"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import {
  ArrowLeftRight,
  ArrowRight,
  Banknote,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  Filter,
  Info,
  Landmark,
  LoaderCircle,
  MessageCircle,
  Minus,
  PackagePlus,
  PauseCircle,
  Plus,
  Printer,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  Smartphone,
  Store,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { POS_CATEGORIES, POS_CUSTOMERS, POS_PRODUCTS } from "@/features/point-of-sale/mock-data";
import { formatDateTime, formatPkr, getCartTotals } from "@/features/point-of-sale/calculations";
import type { CartItem, CompletedInvoice, DiscountType, HeldInvoice, PaymentMethod, PosCustomer, PosProduct, TileCategory } from "@/features/point-of-sale/types";

const STORAGE_KEY = "tiles-shop-demo-pos-v1";
const TAX_RATE = 18;
const PAGE_SIZE = 8;

const customerSchema = z.object({
  name: z.string().trim().min(2, "Enter the customer's name."),
  phone: z.string().trim().min(7, "Enter a valid phone number."),
  email: z.string().trim().email("Enter a valid email.").or(z.literal("")),
  address: z.string().trim().optional(),
  gstNumber: z.string().trim().optional(),
});
type CustomerForm = z.infer<typeof customerSchema>;

const paymentMethods: readonly { value: PaymentMethod; label: string; icon: typeof Banknote }[] = [
  { value: "CASH", label: "Cash", icon: Banknote },
  { value: "MOBILE_WALLET", label: "UPI", icon: Smartphone },
  { value: "CARD", label: "Card", icon: CreditCard },
  { value: "BANK_TRANSFER", label: "Bank Transfer", icon: Landmark },
  { value: "WALLET", label: "Wallet", icon: WalletCards },
];

const categoryIcons: Record<TileCategory, typeof Store> = {
  "All Products": Store,
  "Wall Tiles": PackagePlus,
  "Floor Tiles": Store,
  Porcelain: PackagePlus,
  Marble: CircleDollarSign,
  Mosaic: PackagePlus,
  Sanitary: Store,
  Adhesives: PackagePlus,
  Tools: SlidersHorizontal,
};

function initialCart(): CartItem[] {
  return [
    { productId: "marble-white", quantitySqFt: 50, unitPricePaise: 12050 },
    { productId: "wood-brown", quantitySqFt: 30, unitPricePaise: 9875 },
    { productId: "outdoor-grey", quantitySqFt: 20, unitPricePaise: 7500 },
  ];
}

function Modal({ title, children, onClose, className = "max-w-lg" }: Readonly<{ title: string; children: React.ReactNode; onClose: () => void; className?: string }>) {
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-4 backdrop-blur-[1px]" role="presentation" onMouseDown={onClose}>
      <section aria-modal="true" aria-labelledby="pos-dialog-title" role="dialog" className={`max-h-[90dvh] w-full overflow-y-auto rounded-2xl border bg-card p-5 shadow-2xl ${className}`} onMouseDown={(event) => event.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 id="pos-dialog-title" className="text-lg font-semibold">{title}</h2>
          <Button ref={closeButton} type="button" variant="ghost" size="icon-sm" aria-label={`Close ${title}`} onClick={onClose}><X /></Button>
        </div>
        {children}
      </section>
    </div>
  );
}

function TileSurface({ product, small = false }: Readonly<{ product: PosProduct; small?: boolean }>) {
  return <div aria-hidden="true" className={`${product.imageClass} relative overflow-hidden rounded-lg border border-black/5 ${small ? "size-12 shrink-0" : "aspect-[1.08] w-full"}`}><span className="absolute inset-0 bg-white/5" /></div>;
}

function ProductCard({ product, inCart, onAdd, onView }: Readonly<{ product: PosProduct; inCart: boolean; onAdd: () => void; onView: () => void }>) {
  return (
    <article className="group rounded-xl border bg-card p-2.5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md">
      <button type="button" className="block w-full text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" onClick={onView} aria-label={`View ${product.name}`}>
        <div className="relative"><TileSurface product={product} /><span className="absolute bottom-2 left-2 rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 shadow-sm">{product.dimensions}</span></div>
        <h3 className="mt-2 truncate text-sm font-semibold">{product.name}</h3>
      </button>
      <div className="mt-1 flex items-center justify-between gap-2 text-[11px]"><span className="truncate text-muted-foreground">{product.finish}</span><span className="shrink-0 font-medium text-emerald-600">In Stock</span></div>
      <div className="mt-3 flex items-center justify-between gap-2"><p className="text-sm font-bold">{formatPkr(product.pricePaise)} <span className="text-[11px] font-medium text-muted-foreground">/ sq.ft</span></p><Button type="button" size="icon-sm" variant="outline" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground" onClick={onAdd} aria-label={`Add ${product.name} to cart`}><Plus /></Button></div>
      {inCart ? <p className="mt-1 text-right text-[10px] font-medium text-primary">In current cart</p> : null}
    </article>
  );
}

function NewCustomerDialog({ onClose, onCreate }: Readonly<{ onClose: () => void; onCreate: (customer: PosCustomer) => void }>) {
  const form = useForm<CustomerForm>({ resolver: zodResolver(customerSchema), defaultValues: { name: "", phone: "", email: "", address: "", gstNumber: "" } });
  return <Modal title="Add new customer" onClose={onClose}>
    <form className="space-y-4" onSubmit={form.handleSubmit((values) => onCreate({ id: `customer-${crypto.randomUUID()}`, name: values.name, phone: values.phone, ...(values.email ? { email: values.email } : {}), ...(values.address ? { address: values.address } : {}), ...(values.gstNumber ? { gstNumber: values.gstNumber } : {}), type: "RETAIL" }))}>
      <Field label="Customer name" error={form.formState.errors.name?.message}><Input autoFocus {...form.register("name")} /></Field>
      <Field label="Phone number" error={form.formState.errors.phone?.message}><Input inputMode="tel" {...form.register("phone")} /></Field>
      <Field label="Email" error={form.formState.errors.email?.message}><Input type="email" {...form.register("email")} /></Field>
      <Field label="Address"><Input {...form.register("address")} /></Field>
      <Field label="GST number"><Input {...form.register("gstNumber")} /></Field>
      <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit"><UserRound /> Add customer</Button></div>
    </form>
  </Modal>;
}

function Field({ label, error, children }: Readonly<{ label: string; error?: string | undefined; children: React.ReactNode }>) {
  return <label className="block space-y-1.5 text-sm font-medium"><span>{label}</span>{children}{error ? <span className="block text-xs font-normal text-destructive">{error}</span> : null}</label>;
}

export function PointOfSaleDemo() {
  const searchRef = useRef<HTMLInputElement>(null);
  const [products] = useState<readonly PosProduct[]>(POS_PRODUCTS);
  const [customers, setCustomers] = useState<PosCustomer[]>(() => [...POS_CUSTOMERS]);
  const [cart, setCart] = useState<CartItem[]>(initialCart);
  const [heldInvoices, setHeldInvoices] = useState<HeldInvoice[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("walk-in");
  const [selectedCategory, setSelectedCategory] = useState<TileCategory>("All Products");
  const [searchQuery, setSearchQuery] = useState("");
  const [brand, setBrand] = useState("All Brands");
  const [size, setSize] = useState("All Sizes");
  const [finish, setFinish] = useState("All Finishes");
  const [stockStatus, setStockStatus] = useState("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [discountValue, setDiscountValue] = useState(5);
  const [discountType, setDiscountType] = useState<DiscountType>("PERCENTAGE");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [currentPage, setCurrentPage] = useState(1);
  const [hydrated, setHydrated] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<"filters" | "customer" | "clear" | "hold" | "return" | "whatsapp" | "print" | "success" | "product" | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<PosProduct | null>(null);
  const [holdNote, setHoldNote] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const [returnQuantity, setReturnQuantity] = useState(1);
  const [completedInvoice, setCompletedInvoice] = useState<CompletedInvoice | null>(null);

  useEffect(() => {
    const restoreFrame = window.requestAnimationFrame(() => {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as Partial<{ cart: CartItem[]; heldInvoices: HeldInvoice[]; customers: PosCustomer[]; selectedCustomerId: string; discountValue: number; discountType: DiscountType; paymentMethod: PaymentMethod }>;
          if (Array.isArray(parsed.cart)) setCart(parsed.cart);
          if (Array.isArray(parsed.heldInvoices)) setHeldInvoices(parsed.heldInvoices);
          if (Array.isArray(parsed.customers)) setCustomers(parsed.customers);
          if (typeof parsed.selectedCustomerId === "string") setSelectedCustomerId(parsed.selectedCustomerId);
          if (typeof parsed.discountValue === "number") setDiscountValue(parsed.discountValue);
          if (parsed.discountType === "FIXED" || parsed.discountType === "PERCENTAGE") setDiscountType(parsed.discountType);
          if (paymentMethods.some((method) => method.value === parsed.paymentMethod)) setPaymentMethod(parsed.paymentMethod as PaymentMethod);
        }
      } catch { toast.error("Saved POS draft could not be restored."); }
      setHydrated(true);
    });
    return () => window.cancelAnimationFrame(restoreFrame);
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ cart, heldInvoices, customers, selectedCustomerId, discountValue, discountType, paymentMethod }));
  }, [cart, customers, discountType, discountValue, heldInvoices, hydrated, paymentMethod, selectedCustomerId]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, []);

  const brands = useMemo(() => ["All Brands", ...Array.from(new Set(products.map((product) => product.brand)))], [products]);
  const sizes = useMemo(() => ["All Sizes", ...Array.from(new Set(products.map((product) => product.dimensions)))], [products]);
  const finishes = useMemo(() => ["All Finishes", ...Array.from(new Set(products.map((product) => product.finish)))], [products]);
  const filteredProducts = useMemo(() => products.filter((product) => {
    const haystack = `${product.name} ${product.sku} ${product.brand} ${product.finish} ${product.category} ${product.dimensions}`.toLowerCase();
    const price = product.pricePaise / 100;
    return (selectedCategory === "All Products" || product.category === selectedCategory) &&
      haystack.includes(searchQuery.toLowerCase()) &&
      (brand === "All Brands" || product.brand === brand) && (size === "All Sizes" || product.dimensions === size) &&
      (finish === "All Finishes" || product.finish === finish) && (stockStatus === "all" || (stockStatus === "low" && product.status === "LOW_STOCK") || (stockStatus === "in" && product.status === "IN_STOCK")) &&
      (!minPrice || price >= Number(minPrice)) && (!maxPrice || price <= Number(maxPrice));
  }), [brand, finish, maxPrice, minPrice, products, searchQuery, selectedCategory, size, stockStatus]);
  const visibleProducts = filteredProducts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const pageCount = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId) ?? customers[0]!;
  const totals = getCartTotals({ cart, products, discountValue, discountType, taxRate: TAX_RATE });
  const cartWithProducts = cart.flatMap((item) => { const product = products.find((candidate) => candidate.id === item.productId); return product ? [{ item, product }] : []; });

  function setPage(page: number) { setCurrentPage(Math.min(Math.max(1, page), pageCount)); }
  function addProduct(product: PosProduct) { updateQuantity(product.id, (cart.find((item) => item.productId === product.id)?.quantitySqFt ?? 0) + 1, product.pricePaise); toast.success(`${product.name} added to cart.`); }
  function updateQuantity(productId: string, quantitySqFt: number, unitPricePaise?: number) {
    const product = products.find((candidate) => candidate.id === productId);
    if (!product) return;
    if (quantitySqFt > product.stockSqFt) { toast.warning(`Only ${product.stockSqFt} sq.ft is currently available.`); return; }
    setCart((current) => quantitySqFt <= 0 ? current.filter((item) => item.productId !== productId) : current.some((item) => item.productId === productId)
      ? current.map((item) => item.productId === productId ? { ...item, quantitySqFt } : item)
      : [...current, { productId, quantitySqFt, unitPricePaise: unitPricePaise ?? product.pricePaise }]);
  }
  function clearFilters() { setBrand("All Brands"); setSize("All Sizes"); setFinish("All Finishes"); setStockStatus("all"); setMinPrice(""); setMaxPrice(""); setSearchQuery(""); setSelectedCategory("All Products"); setPage(1); }
  function completeSale() {
    if (!cart.length) { toast.error("Add items before completing the sale."); return; }
    if (discountValue < 0 || !Number.isFinite(discountValue)) { toast.error("Enter a valid discount."); return; }
    startTransition(() => {
      window.setTimeout(() => {
      const invoice: CompletedInvoice = { invoiceNumber: `INV-${new Date().toISOString().slice(2, 10).replaceAll("-", "")}-${String(Math.floor(Math.random() * 900 + 100))}`, createdAt: new Date().toISOString(), customerId: selectedCustomer.id, items: cart, subtotalPaise: totals.subtotalPaise, discountPaise: totals.discountPaise, discountType, taxRate: TAX_RATE, taxPaise: totals.taxPaise, grandTotalPaise: totals.grandTotalPaise, paymentMethod };
      setCompletedInvoice(invoice); setDialog("success"); toast.success("Sale completed successfully.");
      }, 550);
    });
  }
  function saveHold() {
    if (!cart.length) { toast.error("Add items before holding an invoice."); return; }
    const invoice: HeldInvoice = { id: crypto.randomUUID(), reference: `HOLD-${Date.now().toString().slice(-6)}`, note: holdNote.trim(), items: cart, customerId: selectedCustomer.id, createdAt: new Date().toISOString() };
    setHeldInvoices((current) => [invoice, ...current]); setCart([]); setHoldNote(""); setDialog(null); toast.success(`${invoice.reference} saved to held invoices.`);
  }
  function createCustomer(customer: PosCustomer) { setCustomers((current) => [...current, customer]); setSelectedCustomerId(customer.id); setDialog(null); toast.success(`${customer.name} was added and selected.`); }
  function startNewSale() { setCart([]); setDiscountValue(0); setSelectedCustomerId("walk-in"); setCompletedInvoice(null); setDialog(null); }
  function openWhatsApp() {
    if (!selectedCustomer.phone) { toast.error("Select a customer with a phone number first."); return; }
    setDialog("whatsapp");
  }
  const whatsAppUrl = `https://wa.me/${selectedCustomer.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Hello ${selectedCustomer.name}, your Tiles Shop invoice ${completedInvoice?.invoiceNumber ?? "draft"} is ${formatPkr(completedInvoice?.grandTotalPaise ?? totals.grandTotalPaise)}. Thank you!`)}`;

  return <div className="mx-auto max-w-[1600px] space-y-4 pb-4">
    <section className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-bold tracking-tight">Point of Sale</h1><p className="mt-1 text-sm text-muted-foreground">Create invoices, manage payments and complete sales</p></div><div className="flex items-center gap-2"><Button variant="outline" size="sm" className="hidden sm:flex"><Store /> Main Branch <ChevronDown /></Button><Button variant="outline" size="sm" className="hidden md:flex"><CalendarDays /> 18 May 2024 - 24 May 2024 <ChevronDown /></Button><Button variant="outline" size="icon-sm" aria-label="Cart items"><ShoppingCart /><span className="sr-only">{cart.length} cart items</span></Button></div></section>
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_26rem] xl:grid-cols-[minmax(0,1fr)_28rem] 2xl:grid-cols-[minmax(0,1fr)_30rem]">
      <section className="min-w-0 space-y-3">
        <nav aria-label="Product categories" className="flex gap-2 overflow-x-auto rounded-xl border bg-card p-2 shadow-sm">{POS_CATEGORIES.map((category) => { const Icon = categoryIcons[category]; const active = selectedCategory === category; return <button key={category} type="button" onClick={() => { setSelectedCategory(category); setPage(1); }} className={`flex h-10 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition ${active ? "border-primary bg-primary/10 text-primary" : "border-transparent bg-muted/45 text-muted-foreground hover:border-border hover:bg-card"}`}><Icon className="size-4" />{category}</button>; })}</nav>
        <div className="rounded-xl border bg-card p-3 shadow-sm"><div className="grid gap-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(8rem,.7fr))_auto]"><div className="relative"><Search className="absolute top-3 left-3 size-4 text-muted-foreground" /><Input ref={searchRef} value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setPage(1); }} className="h-10 pl-9 pr-12" placeholder="Search tiles by name, code or barcode..." aria-label="Search catalog" /><kbd className="absolute top-2.5 right-2 rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">⌘K</kbd></div><Select value={brand} onChange={setBrand} options={brands} label="Brand" /><Select value={size} onChange={setSize} options={sizes} label="Size" /><Select value={finish} onChange={setFinish} options={finishes} label="Finish" /><Button type="button" variant="outline" className="h-10" onClick={() => setDialog("filters")}><SlidersHorizontal /> Filters</Button></div></div>
        {visibleProducts.length ? <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{visibleProducts.map((product) => <ProductCard key={product.id} product={product} inCart={cart.some((item) => item.productId === product.id)} onAdd={() => addProduct(product)} onView={() => { setSelectedProduct(product); setDialog("product"); }} />)}</div> : <div className="grid min-h-72 place-items-center rounded-xl border border-dashed bg-card p-6 text-center"><div><PackagePlus className="mx-auto size-8 text-muted-foreground" /><h2 className="mt-3 font-semibold">No matching tiles found</h2><p className="mt-1 text-sm text-muted-foreground">Try clearing the search or filters.</p><Button className="mt-4" variant="outline" onClick={clearFilters}>Clear filters</Button></div></div>}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 text-xs text-muted-foreground"><span>Showing {filteredProducts.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0} to {Math.min(currentPage * PAGE_SIZE, filteredProducts.length)} of {filteredProducts.length || 120} products</span><div className="flex gap-1"><Button size="icon-xs" variant="outline" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} aria-label="Previous page"><ChevronLeft /></Button>{Array.from({ length: Math.min(5, pageCount) }, (_, index) => index + 1).map((page) => <Button key={page} size="icon-xs" variant={page === currentPage ? "default" : "outline"} onClick={() => setPage(page)}>{page}</Button>)}<Button size="icon-xs" variant="outline" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)} aria-label="Next page"><ChevronRight /></Button></div></div>
      </section>
      <CheckoutPanel cart={cartWithProducts} customers={customers} selectedCustomer={selectedCustomer} onCustomer={setSelectedCustomerId} onNewCustomer={() => setDialog("customer")} onRemove={(id) => updateQuantity(id, 0)} onQuantity={updateQuantity} onClear={() => setDialog("clear")} discountValue={discountValue} onDiscount={setDiscountValue} discountType={discountType} onDiscountType={setDiscountType} paymentMethod={paymentMethod} onPaymentMethod={setPaymentMethod} totals={totals} pending={isPending} onComplete={completeSale} onHold={() => setDialog("hold")} onReturn={() => setDialog("return")} onWhatsApp={openWhatsApp} onPrint={() => setDialog("print")} />
    </div>
    <p className="text-center text-xs text-muted-foreground">Mock catalogue and invoices are saved only in this browser for the UI demonstration.</p>
    {dialog === "customer" ? <NewCustomerDialog onClose={() => setDialog(null)} onCreate={createCustomer} /> : null}
    {dialog === "clear" ? <ConfirmDialog title="Clear cart?" body="All current cart items will be removed." confirm="Clear cart" destructive onClose={() => setDialog(null)} onConfirm={() => { setCart([]); setDialog(null); toast.success("Cart cleared."); }} /> : null}
    {dialog === "hold" ? <Modal title="Hold invoice" onClose={() => setDialog(null)}><p className="text-sm text-muted-foreground">Save this cart so it can be resumed by a cashier later.</p><Field label="Note"><Input value={holdNote} onChange={(event) => setHoldNote(event.target.value)} placeholder="e.g. Waiting for customer approval" /></Field><div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button><Button onClick={saveHold}><PackagePlus /> Save & hold</Button></div></Modal> : null}
    {dialog === "filters" ? <Modal title="Advanced filters" onClose={() => setDialog(null)}><div className="grid gap-4 sm:grid-cols-2"><Field label="Minimum price"><Input inputMode="decimal" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} placeholder="Rs 0" /></Field><Field label="Maximum price"><Input inputMode="decimal" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} placeholder="Rs 200" /></Field><Field label="Stock status"><select value={stockStatus} onChange={(event) => setStockStatus(event.target.value)} className="h-9 w-full rounded-md border bg-background px-3 text-sm"><option value="all">All stock</option><option value="in">In stock</option><option value="low">Low stock</option></select></Field><Field label="Category"><select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value as TileCategory)} className="h-9 w-full rounded-md border bg-background px-3 text-sm">{POS_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></Field></div><div className="mt-5 flex justify-between"><Button variant="ghost" onClick={clearFilters}>Clear filters</Button><Button onClick={() => { setPage(1); setDialog(null); }}><Filter /> Apply filters</Button></div></Modal> : null}
    {dialog === "product" && selectedProduct ? <ProductDetailsDialog product={selectedProduct} onClose={() => setDialog(null)} onAdd={() => { addProduct(selectedProduct); setDialog(null); }} /> : null}
    {dialog === "return" ? <ReturnDialog products={products} onClose={() => setDialog(null)} reason={returnReason} setReason={setReturnReason} quantity={returnQuantity} setQuantity={setReturnQuantity} onConfirm={() => { if (!returnReason.trim()) { toast.error("A return reason is required."); return; } setDialog(null); toast.success(`Mock return for ${returnQuantity} sq.ft recorded.`); }} /> : null}
    {dialog === "whatsapp" ? <WhatsAppDialog customer={selectedCustomer} url={whatsAppUrl} total={formatPkr(completedInvoice?.grandTotalPaise ?? totals.grandTotalPaise)} onClose={() => setDialog(null)} /> : null}
    {dialog === "print" ? <PrintInvoiceDialog customer={selectedCustomer} cart={cartWithProducts} totals={totals} paymentMethod={paymentMethod} onClose={() => setDialog(null)} /> : null}
    {dialog === "success" && completedInvoice ? <InvoiceSuccessDialog invoice={completedInvoice} onClose={() => setDialog(null)} onPrint={() => setDialog("print")} onNewSale={startNewSale} /> : null}
  </div>;
}

function Select({ value, onChange, options, label }: Readonly<{ value: string; onChange: (value: string) => void; options: readonly string[]; label: string }>) { return <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="h-10 min-w-0 rounded-md border bg-background px-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring"><>{options.map((option) => <option key={option}>{option}</option>)}</></select>; }

function CheckoutPanel({
  cart,
  customers,
  selectedCustomer,
  onCustomer,
  onNewCustomer,
  onRemove,
  onQuantity,
  onClear,
  discountValue,
  onDiscount,
  discountType,
  onDiscountType,
  paymentMethod,
  onPaymentMethod,
  totals,
  pending,
  onComplete,
  onHold,
  onReturn,
  onWhatsApp,
  onPrint,
}: Readonly<{
  cart: { item: CartItem; product: PosProduct }[];
  customers: PosCustomer[];
  selectedCustomer: PosCustomer;
  onCustomer: (id: string) => void;
  onNewCustomer: () => void;
  onRemove: (id: string) => void;
  onQuantity: (id: string, quantity: number) => void;
  onClear: () => void;
  discountValue: number;
  onDiscount: (value: number) => void;
  discountType: DiscountType;
  onDiscountType: (value: DiscountType) => void;
  paymentMethod: PaymentMethod;
  onPaymentMethod: (value: PaymentMethod) => void;
  totals: ReturnType<typeof getCartTotals>;
  pending: boolean;
  onComplete: () => void;
  onHold: () => void;
  onReturn: () => void;
  onWhatsApp: () => void;
  onPrint: () => void;
}>) {
  return (
    <aside className="sticky top-20 space-y-3">
      <section className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
        <div className="border-b p-3.5">
          <h2 className="text-sm font-semibold text-foreground">Current Customer</h2>
          <div className="mt-2 flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <UserRound className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground" />
              <select
                aria-label="Current customer"
                value={selectedCustomer.id}
                onChange={(event) => onCustomer(event.target.value)}
                className="h-10 w-full appearance-none rounded-xl border border-input bg-background pl-9 pr-8 text-sm font-medium outline-none focus:ring-2 focus:ring-ring"
              >
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                    {customer.phone ? ` · ${customer.phone}` : ""}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-3 right-3 size-4 text-muted-foreground" />
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-10 shrink-0 rounded-xl border-blue-200 bg-blue-50/50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-400 font-semibold"
              onClick={onNewCustomer}
            >
              <Plus className="size-4" /> New
            </Button>
          </div>
        </div>

        <div className="max-h-[38dvh] overflow-y-auto p-3.5">
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">
              Cart Items ({cart.length})
            </h2>
            <Button
              variant="ghost"
              size="xs"
              className="text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/30"
              onClick={onClear}
              disabled={!cart.length}
            >
              Clear Cart
            </Button>
          </div>
          {cart.length ? (
            <div className="space-y-2.5">
              {cart.map(({ item, product }) => (
                <CartRow
                  key={product.id}
                  product={product}
                  item={item}
                  onQuantity={onQuantity}
                  onRemove={onRemove}
                />
              ))}
            </div>
          ) : (
            <div className="grid min-h-36 place-items-center rounded-xl border border-dashed border-border/80 p-4 text-center">
              <div>
                <ShoppingCart className="mx-auto size-7 text-muted-foreground/60" />
                <p className="mt-2 text-sm font-medium text-foreground">Your cart is empty</p>
                <p className="text-xs text-muted-foreground">Select tiles from the catalogue to add them.</p>
              </div>
            </div>
          )}
        </div>

        <CartSummary
          totals={totals}
          discountValue={discountValue}
          onDiscount={onDiscount}
          discountType={discountType}
          onDiscountType={onDiscountType}
        />

        <div className="border-t p-3.5 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Payment Method</h2>
          <div className="grid grid-cols-5 gap-1.5">
            {paymentMethods.map((method) => {
              const Icon = method.icon;
              const selected = paymentMethod === method.value;
              return (
                <button
                  key={method.value}
                  type="button"
                  onClick={() => onPaymentMethod(method.value)}
                  className={`flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl border px-1 py-1.5 text-[10px] font-semibold transition ${
                    selected
                      ? "border-blue-600 bg-blue-50/70 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-500 shadow-xs"
                      : "border-border/80 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  }`}
                >
                  <Icon className="size-4" />
                  <span className="truncate max-w-full">{method.label}</span>
                </button>
              );
            })}
          </div>

          <Button
            type="button"
            size="lg"
            className="h-12 w-full justify-between rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-base shadow-md transition"
            disabled={!cart.length || pending}
            onClick={onComplete}
          >
            <span className="flex items-center gap-2">
              {pending ? <LoaderCircle className="animate-spin size-5" /> : null}
              {pending ? "Completing sale..." : "Complete Sale"}
            </span>
            <span className="grid size-7 place-items-center rounded-lg bg-white/20 text-white">
              <ArrowRight className="size-4" />
            </span>
          </Button>
        </div>
      </section>

      <div className="grid grid-cols-4 gap-2">
        <InvoiceAction
          icon={PauseCircle}
          label="Hold Invoice"
          sublabel="Save & Hold"
          onClick={onHold}
          disabled={!cart.length}
          tone="blue"
        />
        <InvoiceAction
          icon={ArrowLeftRight}
          label="Return Invoice"
          sublabel="Create Return"
          onClick={onReturn}
          tone="red"
        />
        <InvoiceAction
          icon={MessageCircle}
          label="WhatsApp Invoice"
          sublabel="Send on WhatsApp"
          onClick={onWhatsApp}
          tone="green"
        />
        <InvoiceAction
          icon={Printer}
          label="Print Invoice"
          sublabel="Print / PDF"
          onClick={onPrint}
          tone="purple"
        />
      </div>
    </aside>
  );
}

function CartRow({ product, item, onQuantity, onRemove }: Readonly<{ product: PosProduct; item: CartItem; onQuantity: (id: string, quantity: number) => void; onRemove: (id: string) => void }>) {
  return (
    <div className="rounded-xl border border-border/80 bg-card p-2.5 shadow-xs transition hover:border-border">
      <div className="flex items-start gap-2.5">
        <TileSurface product={product} small />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-1.5">
            <div>
              <h4 className="truncate text-xs font-semibold text-foreground">{product.name}</h4>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {product.dimensions} <span className="px-1">•</span> {product.finish}
              </p>
              <p className="mt-1 text-[11px] font-medium text-emerald-600">In Stock</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-xs font-semibold text-foreground">{formatPkr(item.unitPricePaise)}</span>
              <button
                type="button"
                onClick={() => onRemove(product.id)}
                className="text-muted-foreground hover:text-destructive p-0.5 rounded transition"
                aria-label={`Remove ${product.name}`}
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>

          <div className="mt-2.5 flex items-center justify-between gap-2 border-t pt-2">
            <div className="flex items-center gap-1.5">
              <div className="flex items-center rounded-lg border border-input bg-background shadow-xs">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Decrease ${product.name} quantity`}
                  onClick={() => onQuantity(product.id, item.quantitySqFt - 1)}
                  className="h-7 w-7 rounded-l-lg"
                >
                  <Minus className="size-3" />
                </Button>
                <output
                  className="min-w-8 text-center text-xs font-bold text-foreground"
                  aria-label={`${product.name} quantity`}
                >
                  {item.quantitySqFt}
                </output>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Increase ${product.name} quantity`}
                  onClick={() => onQuantity(product.id, item.quantitySqFt + 1)}
                  className="h-7 w-7 rounded-r-lg"
                >
                  <Plus className="size-3" />
                </Button>
              </div>
              <span className="text-xs font-medium text-muted-foreground">sq.ft</span>
            </div>
            <span className="text-xs font-bold text-foreground">
              {formatPkr(item.quantitySqFt * item.unitPricePaise)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CartSummary({ totals, discountValue, onDiscount, discountType, onDiscountType }: Readonly<{ totals: ReturnType<typeof getCartTotals>; discountValue: number; onDiscount: (value: number) => void; discountType: DiscountType; onDiscountType: (value: DiscountType) => void }>) {
  return (
    <div className="space-y-2.5 border-t px-3.5 py-3 text-sm">
      <div className="flex items-center justify-between text-muted-foreground">
        <span>Subtotal ({totals.totalQuantitySqFt.toFixed(2)} sq.ft)</span>
        <span className="font-semibold text-foreground">{formatPkr(totals.subtotalPaise)}</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-muted-foreground">
          Discount <Info className="size-3.5 text-muted-foreground/70" />
        </span>
        <div className="flex items-center gap-1.5">
          <Input
            aria-label="Discount value"
            type="number"
            min="0"
            value={discountValue}
            onChange={(event) => onDiscount(Number(event.target.value))}
            className="h-8 w-18 text-right text-xs font-semibold"
          />
          <select
            aria-label="Discount type"
            value={discountType}
            onChange={(event) => onDiscountType(event.target.value as DiscountType)}
            className="h-8 rounded-md border border-input bg-background px-1 text-xs font-medium"
          >
            <option value="PERCENTAGE">%</option>
            <option value="FIXED">Rs</option>
          </select>
          <span className="w-20 text-right text-xs font-bold text-emerald-600">
            - {formatPkr(totals.discountPaise)}
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="flex items-center gap-1">
          Tax (18% GST) <Info className="size-3.5 text-muted-foreground/70" />
        </span>
        <span className="font-semibold text-foreground">{formatPkr(totals.taxPaise)}</span>
      </div>
      <div className="flex items-center justify-between border-t pt-2.5 mt-1">
        <span className="text-base font-bold text-foreground">Grand Total</span>
        <strong className="text-xl font-extrabold tracking-tight text-foreground">
          {formatPkr(totals.grandTotalPaise)}
        </strong>
      </div>
    </div>
  );
}

function InvoiceAction({
  icon: Icon,
  label,
  sublabel,
  onClick,
  tone = "blue",
  disabled = false,
}: Readonly<{
  icon: typeof Printer;
  label: string;
  sublabel: string;
  onClick: () => void;
  tone?: "blue" | "red" | "green" | "purple";
  disabled?: boolean;
}>) {
  const tones = {
    blue: "text-blue-600 bg-blue-50/40 border-blue-200/80 hover:bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900/40 dark:text-blue-400",
    red: "text-rose-600 bg-rose-50/40 border-rose-200/80 hover:bg-rose-50 dark:bg-rose-950/20 dark:border-rose-900/40 dark:text-rose-400",
    green: "text-emerald-600 bg-emerald-50/40 border-emerald-200/80 hover:bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-900/40 dark:text-emerald-400",
    purple: "text-indigo-600 bg-indigo-50/40 border-indigo-200/80 hover:bg-indigo-50 dark:bg-indigo-950/20 dark:border-indigo-900/40 dark:text-indigo-400",
  };
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex min-h-[4.25rem] flex-col items-center justify-center rounded-xl border p-1.5 text-center transition disabled:opacity-50 ${tones[tone]}`}
    >
      <Icon className="size-4 shrink-0" />
      <span className="mt-1 text-[10px] font-bold tracking-tight">{label}</span>
      <span className="text-[9px] opacity-75 font-normal">{sublabel}</span>
    </button>
  );
}

function ConfirmDialog({ title, body, confirm, destructive, onClose, onConfirm }: Readonly<{ title: string; body: string; confirm: string; destructive?: boolean; onClose: () => void; onConfirm: () => void }>) { return <Modal title={title} onClose={onClose}><p className="text-sm text-muted-foreground">{body}</p><div className="mt-6 flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button variant={destructive ? "destructive" : "default"} onClick={onConfirm}>{confirm}</Button></div></Modal>; }

function ProductDetailsDialog({ product, onClose, onAdd }: Readonly<{ product: PosProduct; onClose: () => void; onAdd: () => void }>) { return <Modal title={product.name} onClose={onClose} className="max-w-xl"><div className="grid gap-5 sm:grid-cols-[1fr_1.1fr]"><TileSurface product={product} /><div className="space-y-3"><div><p className="text-sm text-muted-foreground">{product.sku} · {product.brand}</p><p className="mt-1 text-lg font-bold">{formatPkr(product.pricePaise)} <span className="text-sm font-medium text-muted-foreground">per sq.ft</span></p></div><dl className="grid grid-cols-2 gap-3 rounded-lg bg-muted/50 p-3 text-sm"><div><dt className="text-xs text-muted-foreground">Size</dt><dd className="font-medium">{product.dimensions}</dd></div><div><dt className="text-xs text-muted-foreground">Finish</dt><dd className="font-medium">{product.finish}</dd></div><div><dt className="text-xs text-muted-foreground">Available stock</dt><dd className="font-medium text-emerald-600">{product.stockSqFt} sq.ft</dd></div><div><dt className="text-xs text-muted-foreground">Category</dt><dd className="font-medium">{product.category}</dd></div></dl><Button className="w-full" onClick={onAdd}><Plus /> Add to cart</Button></div></div></Modal>; }

function ReturnDialog({ products, reason, setReason, quantity, setQuantity, onClose, onConfirm }: Readonly<{ products: readonly PosProduct[]; reason: string; setReason: (value: string) => void; quantity: number; setQuantity: (value: number) => void; onClose: () => void; onConfirm: () => void }>) { const product = products[0]!; return <Modal title="Return invoice" onClose={onClose}><p className="text-sm text-muted-foreground">Search invoice by number, phone, or customer. A recent mock invoice is shown below.</p><div className="mt-4 rounded-lg border p-3"><p className="text-xs font-medium text-primary">INV-240524-1865 · R.K. Traders</p><div className="mt-3 flex items-center gap-3"><TileSurface product={product} small /><div className="flex-1"><p className="text-sm font-semibold">{product.name}</p><p className="text-xs text-muted-foreground">Eligible for return · {formatPkr(product.pricePaise)} / sq.ft</p></div><Input className="w-20" type="number" min="1" value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value)))} aria-label="Return quantity" /></div></div><Field label="Return reason"><Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="e.g. wrong finish supplied" /></Field><div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={onConfirm}><ArrowLeftRight /> Confirm return</Button></div></Modal>; }

function WhatsAppDialog({ customer, url, total, onClose }: Readonly<{ customer: PosCustomer; url: string; total: string; onClose: () => void }>) { return <Modal title="Send invoice on WhatsApp" onClose={onClose}><div className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-950"><MessageCircle className="mb-2 size-5 text-emerald-600" /><p className="font-semibold">Invoice preview for {customer.name}</p><p className="mt-1">Your Tiles Shop invoice total is {total}. Thank you for your business!</p></div><p className="mt-4 text-sm text-muted-foreground">The message will open in WhatsApp for your review. It will not be sent automatically.</p><div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => window.open(url, "_blank", "noopener,noreferrer")}><MessageCircle /> Open WhatsApp</Button></div></Modal>; }

function PrintInvoiceDialog({ customer, cart, totals, paymentMethod, onClose }: Readonly<{ customer: PosCustomer; cart: { item: CartItem; product: PosProduct }[]; totals: ReturnType<typeof getCartTotals>; paymentMethod: PaymentMethod; onClose: () => void }>) { return <Modal title="Invoice preview" onClose={onClose} className="max-w-2xl"><div id="pos-invoice-print" className="rounded-lg border bg-white p-6 text-slate-900"><div className="flex justify-between border-b pb-4"><div><p className="text-lg font-bold text-blue-600">TILES SHOP</p><p className="text-xs text-slate-500">ERP + POS SYSTEM · Main Branch</p></div><div className="text-right text-xs"><p className="font-semibold">DRAFT INVOICE</p><p>{formatDateTime(new Date().toISOString())}</p></div></div><div className="my-4 text-sm"><p className="font-semibold">{customer.name}</p><p className="text-slate-500">{customer.phone || "Walk-in customer"}</p></div><table className="w-full border-collapse text-left text-xs"><thead className="border-y text-slate-500"><tr><th className="py-2">Item</th><th>Qty</th><th>Unit price</th><th className="text-right">Total</th></tr></thead><tbody>{cart.map(({ item, product }) => <tr key={product.id} className="border-b"><td className="py-2 font-medium">{product.name}</td><td>{item.quantitySqFt} sq.ft</td><td>{formatPkr(item.unitPricePaise)}</td><td className="text-right">{formatPkr(item.quantitySqFt * item.unitPricePaise)}</td></tr>)}</tbody></table><div className="ml-auto mt-4 max-w-xs space-y-1 text-sm"><p className="flex justify-between"><span>Subtotal</span><span>{formatPkr(totals.subtotalPaise)}</span></p><p className="flex justify-between"><span>Discount</span><span>- {formatPkr(totals.discountPaise)}</span></p><p className="flex justify-between"><span>GST</span><span>{formatPkr(totals.taxPaise)}</span></p><p className="flex justify-between border-t pt-2 text-base font-bold"><span>Grand total</span><span>{formatPkr(totals.grandTotalPaise)}</span></p><p className="text-right text-xs text-slate-500">Paid via {paymentMethod.replaceAll("_", " ")}</p></div><p className="mt-6 text-center text-xs text-slate-500">Thank you for your business!</p></div><div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Close</Button><Button onClick={() => window.print()}><Printer /> Print / Save PDF</Button></div></Modal>; }

function InvoiceSuccessDialog({ invoice, onClose, onPrint, onNewSale }: Readonly<{ invoice: CompletedInvoice; onClose: () => void; onPrint: () => void; onNewSale: () => void }>) { return <Modal title="Sale completed" onClose={onClose}><div className="text-center"><CheckCircle2 className="mx-auto size-12 text-emerald-500" /><h3 className="mt-3 text-xl font-bold">Payment recorded</h3><p className="mt-1 text-sm text-muted-foreground">{invoice.invoiceNumber} · {formatDateTime(invoice.createdAt)}</p><p className="mt-4 text-3xl font-bold">{formatPkr(invoice.grandTotalPaise)}</p><p className="mt-1 text-sm text-muted-foreground">Paid via {invoice.paymentMethod.replaceAll("_", " ")}</p></div><div className="mt-6 grid gap-2 sm:grid-cols-2"><Button variant="outline" onClick={onPrint}><Printer /> Print invoice</Button><Button variant="outline" onClick={onPrint}><ArrowRight /> Download PDF</Button><Button className="sm:col-span-2" onClick={onNewSale}><Plus /> Start new sale</Button></div></Modal>; }
