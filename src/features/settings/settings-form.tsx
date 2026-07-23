"use client";

import { useState, useTransition } from "react";
import {
  Building2,
  Check,
  CircleDollarSign,
  FileText,
  MapPin,
  Printer,
  Plus,
  Send,
  Settings2,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  createBranchAction,
  saveBusinessSettingsAction,
} from "@/features/settings/actions";

type SettingsData = Awaited<
  ReturnType<typeof import("@/features/settings/services").getBusinessSettings>
>;
type ToggleKey =
  | "allowNegativeInventory"
  | "allowPriceOverride"
  | "requireCustomerForCredit"
  | "autoPrintReceipt"
  | "taxInclusive";

const readString = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;
const readBoolean = (value: unknown, fallback = false) =>
  typeof value === "boolean" ? value : fallback;
const readRecord = (value: unknown) =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const paymentOptions = [
  "CASH",
  "CARD",
  "BANK_TRANSFER",
  "MOBILE_WALLET",
  "CREDIT",
] as const;
type NotificationKey =
  | "lowStockAlerts"
  | "newOrders"
  | "paymentReminders"
  | "salesReports"
  | "customerNotifications"
  | "systemUpdates";
const accentColors = {
  blue: "#2563eb",
  green: "#16a34a",
  violet: "#7c3aed",
  orange: "#f97316",
  red: "#dc2626",
  teal: "#0d9488",
} as const;

export function SettingsForm({ data }: { data: SettingsData }) {
  const pos = (data.settings.pos ?? {}) as Record<string, unknown>;
  const profile = (data.settings.profile ?? {}) as Record<string, unknown>;
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [name, setName] = useState(data.business.name);
  const [legalName, setLegalName] = useState(data.business.legalName ?? "");
  const [email, setEmail] = useState(readString(profile.email));
  const [phone, setPhone] = useState(readString(profile.phone));
  const [address, setAddress] = useState(readString(profile.address));
  const [taxNumber, setTaxNumber] = useState(
    data.business.taxRegistrationNumber ?? "",
  );
  const [footer, setFooter] = useState(readString(pos.receiptFooter));
  const [discount, setDiscount] = useState(
    String(pos.cashierDiscountLimitPercent ?? 10),
  );
  const [defaultLocationId, setDefaultLocationId] = useState(
    readString(pos.defaultLocationId),
  );
  const [defaultRegisterId, setDefaultRegisterId] = useState(
    readString(pos.defaultRegisterId),
  );
  const [toggles, setToggles] = useState<Record<ToggleKey, boolean>>({
    allowNegativeInventory: readBoolean(pos.allowNegativeInventory),
    allowPriceOverride: readBoolean(pos.allowPriceOverride),
    requireCustomerForCredit: readBoolean(pos.requireCustomerForCredit),
    autoPrintReceipt: readBoolean(pos.autoPrintReceipt),
    taxInclusive: readBoolean(pos.taxInclusive),
  });
  const savedPayments: (typeof paymentOptions)[number][] = Array.isArray(
    pos.acceptedPaymentMethods,
  )
    ? pos.acceptedPaymentMethods.filter(
        (method): method is (typeof paymentOptions)[number] =>
          typeof method === "string" &&
          paymentOptions.includes(method as (typeof paymentOptions)[number]),
      )
    : ["CASH", "CARD", "BANK_TRANSFER", "MOBILE_WALLET", "CREDIT"];
  const notificationPreferences = readRecord(pos.notificationPreferences);
  const [acceptedPaymentMethods, setAcceptedPaymentMethods] = useState<
    (typeof paymentOptions)[number][]
  >(savedPayments.length ? savedPayments : ["CASH"]);
  const [whatsappNumber, setWhatsappNumber] = useState(
    readString(pos.whatsappNumber, "+9233232222"),
  );
  const [whatsappMessageTemplate, setWhatsappMessageTemplate] = useState(
    readString(
      pos.whatsappMessageTemplate,
      "Hello {customerName}, thank you for shopping with {businessName}. Your receipt {receiptNumber} total is {total}.",
    ),
  );
  const [whatsappProvider, setWhatsappProvider] = useState<
    "NONE" | "TWILIO" | "META"
  >(
    pos.whatsappProvider === "TWILIO" || pos.whatsappProvider === "META"
      ? pos.whatsappProvider
      : "NONE",
  );
  const [notifications, setNotifications] = useState<
    Record<NotificationKey, boolean>
  >({
    lowStockAlerts: readBoolean(notificationPreferences.lowStockAlerts, true),
    newOrders: readBoolean(notificationPreferences.newOrders, true),
    paymentReminders: readBoolean(
      notificationPreferences.paymentReminders,
      true,
    ),
    salesReports: readBoolean(notificationPreferences.salesReports, true),
    customerNotifications: readBoolean(
      notificationPreferences.customerNotifications,
      true,
    ),
    systemUpdates: readBoolean(notificationPreferences.systemUpdates),
  });
  const [themeMode, setThemeMode] = useState<"light" | "dark">(
    pos.themeMode === "dark" ? "dark" : "light",
  );
  const [accentColor, setAccentColor] = useState<keyof typeof accentColors>(
    typeof pos.accentColor === "string" && pos.accentColor in accentColors
      ? (pos.accentColor as keyof typeof accentColors)
      : "blue",
  );
  const [addingBranch, setAddingBranch] = useState(false);
  const [branchName, setBranchName] = useState("");
  const [branchCode, setBranchCode] = useState("");
  const [branchPhone, setBranchPhone] = useState("");

  function save() {
    setMessage("");
    startTransition(async () => {
      const result = await saveBusinessSettingsAction({
        name,
        legalName: legalName || undefined,
        address,
        phone,
        email: email || undefined,
        taxRegistrationNumber: taxNumber || undefined,
        currencyCode: "PKR",
        timezone: "Asia/Karachi",
        locale: "en-PK",
        defaultLocationId: defaultLocationId || undefined,
        defaultRegisterId: defaultRegisterId || undefined,
        receiptFooter: footer || undefined,
        cashierDiscountLimitPercent: Number(discount),
        ...toggles,
        acceptedPaymentMethods,
        whatsappNumber: whatsappNumber || undefined,
        whatsappMessageTemplate: whatsappMessageTemplate || undefined,
        whatsappProvider,
        notificationPreferences: notifications,
        themeMode,
        accentColor,
      });
      setMessage(result.message);
    });
  }
  function togglePayment(method: (typeof paymentOptions)[number]) {
    setAcceptedPaymentMethods((current) => {
      if (current.includes(method)) {
        if (current.length === 1) {
          setMessage("At least one payment method must remain enabled.");
          return current;
        }
        return current.filter((item) => item !== method);
      }
      return [...current, method];
    });
  }
  function createBranch() {
    startTransition(async () => {
      const result = await createBranchAction({
        name: branchName,
        code: branchCode,
        phone: branchPhone || undefined,
      });
      setMessage(result.message);
      if (result.success) {
        setBranchName("");
        setBranchCode("");
        setBranchPhone("");
        setAddingBranch(false);
      }
    });
  }
  function openWhatsAppTestChat() {
    const phone = whatsappNumber.replace(/\D/g, "");
    const message = whatsappMessageTemplate
      .replaceAll("{customerName}", "Customer")
      .replaceAll("{businessName}", name || "Retail POS")
      .replaceAll("{receiptNumber}", "INV-0001")
      .replaceAll("{total}", "PKR 0.00");
    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-4 xl:grid-cols-[1fr_1.05fr]">
        <SettingsCard
          icon={<Building2 />}
          title="Company profile"
          description="Information printed on receipts and reports."
        >
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Company name">
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            <Field label="Legal name">
              <Input
                value={legalName}
                onChange={(event) => setLegalName(event.target.value)}
              />
            </Field>
            <Field label="Business email">
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>
            <Field label="Phone number">
              <Input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </Field>
            <Field label="Business address" className="md:col-span-2">
              <Input
                value={address}
                onChange={(event) => setAddress(event.target.value)}
              />
            </Field>
          </div>
        </SettingsCard>
        <SettingsCard
          icon={<MapPin />}
          title="Branches & registers"
          description="Active branches and POS defaults."
        >
          <div className="mb-3 flex justify-end">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setAddingBranch((current) => !current)}
            >
              <Plus /> Add branch
            </Button>
          </div>
          {addingBranch ? (
            <div className="bg-muted/20 mb-3 grid gap-2 rounded-lg border p-3 sm:grid-cols-3">
              <Input
                value={branchName}
                onChange={(event) => setBranchName(event.target.value)}
                placeholder="Branch name"
              />
              <Input
                value={branchCode}
                onChange={(event) =>
                  setBranchCode(event.target.value.toUpperCase())
                }
                placeholder="Code, e.g. KHI"
              />
              <div className="flex gap-2">
                <Input
                  value={branchPhone}
                  onChange={(event) => setBranchPhone(event.target.value)}
                  placeholder="Phone (optional)"
                />
                <Button type="button" disabled={pending} onClick={createBranch}>
                  Add
                </Button>
              </div>
            </div>
          ) : null}
          <div className="space-y-2">
            {data.locations.map((location) => (
              <div
                key={location.id}
                className="flex items-center justify-between rounded-lg border px-3 py-2"
              >
                <span>
                  <span className="block text-sm font-medium">
                    {location.name}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {location.code}
                    {location.phone ? ` · ${location.phone}` : ""}
                  </span>
                </span>
                <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
                  {location.isActive ? "Active" : "Inactive"}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Field label="Default location">
              <select
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                value={defaultLocationId}
                onChange={(event) => {
                  setDefaultLocationId(event.target.value);
                  setDefaultRegisterId("");
                }}
              >
                <option value="">No default</option>
                {data.locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Default register">
              <select
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                value={defaultRegisterId}
                onChange={(event) => setDefaultRegisterId(event.target.value)}
              >
                <option value="">No default</option>
                {data.registers
                  .filter(
                    (register) =>
                      !defaultLocationId ||
                      register.locationId === defaultLocationId,
                  )
                  .map((register) => (
                    <option key={register.id} value={register.id}>
                      {register.name}
                    </option>
                  ))}
              </select>
            </Field>
          </div>
        </SettingsCard>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <SettingsCard
          icon={<CircleDollarSign />}
          title="Tax & pricing"
          description="PKR, Asia/Karachi, and en-PK are enforced business defaults."
        >
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Tax registration number">
              <Input
                value={taxNumber}
                onChange={(event) => setTaxNumber(event.target.value)}
              />
            </Field>
            <Field label="Maximum cashier discount (%)">
              <Input
                inputMode="decimal"
                value={discount}
                onChange={(event) => setDiscount(event.target.value)}
              />
            </Field>
          </div>
          <div className="mt-3 divide-y rounded-lg border px-3">
            <SettingToggle
              checked={toggles.taxInclusive}
              onToggle={() =>
                setToggles((current) => ({
                  ...current,
                  taxInclusive: !current.taxInclusive,
                }))
              }
              label="Tax-inclusive pricing"
              description="Prices entered at POS already include applicable tax."
            />
            <SettingToggle
              checked={toggles.allowPriceOverride}
              onToggle={() =>
                setToggles((current) => ({
                  ...current,
                  allowPriceOverride: !current.allowPriceOverride,
                }))
              }
              label="Allow price override"
              description="Authorized staff may override an item price with a reason."
            />
          </div>
        </SettingsCard>
        <SettingsCard
          icon={<Settings2 />}
          title="POS & inventory controls"
          description="Checkout behavior and stock safeguards."
        >
          <div className="divide-y rounded-lg border px-3">
            <SettingToggle
              checked={toggles.allowNegativeInventory}
              onToggle={() =>
                setToggles((current) => ({
                  ...current,
                  allowNegativeInventory: !current.allowNegativeInventory,
                }))
              }
              label="Allow negative inventory"
              description="Only use when your stock policy permits sales below zero."
            />
            <SettingToggle
              checked={toggles.requireCustomerForCredit}
              onToggle={() =>
                setToggles((current) => ({
                  ...current,
                  requireCustomerForCredit: !current.requireCustomerForCredit,
                }))
              }
              label="Require customer for credit sales"
              description="Prevent credit payments without a recorded customer."
            />
            <SettingToggle
              checked={toggles.autoPrintReceipt}
              onToggle={() =>
                setToggles((current) => ({
                  ...current,
                  autoPrintReceipt: !current.autoPrintReceipt,
                }))
              }
              label="Auto-print receipt"
              description="Open printing automatically after a completed sale."
            />
          </div>
        </SettingsCard>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <SettingsCard
          icon={<CircleDollarSign />}
          title="Payment methods"
          description="Choose the methods available at POS checkout."
        >
          <div className="grid gap-x-8 md:grid-cols-2">
            {paymentOptions.map((method) => (
              <SettingToggle
                key={method}
                checked={acceptedPaymentMethods.includes(method)}
                onToggle={() => togglePayment(method)}
                label={method.replaceAll("_", " ")}
                description="Available for new sales."
              />
            ))}
          </div>
        </SettingsCard>
        <SettingsCard
          icon={<Send />}
          title="WhatsApp integration"
          description="Use a simple wa.me message link or save provider metadata for a future API integration."
        >
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="WhatsApp number">
              <Input
                value={whatsappNumber}
                onChange={(event) => setWhatsappNumber(event.target.value)}
                placeholder="+92 300 1234567"
              />
            </Field>
            <Field label="Business API provider">
              <select
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                value={whatsappProvider}
                onChange={(event) =>
                  setWhatsappProvider(
                    event.target.value as "NONE" | "TWILIO" | "META",
                  )
                }
              >
                <option value="NONE">Not configured</option>
                <option value="TWILIO">Twilio</option>
                <option value="META">Meta WhatsApp Cloud API</option>
              </select>
            </Field>
          </div>
          <Field label="Message template" className="mt-3">
            <textarea
              value={whatsappMessageTemplate}
              onChange={(event) =>
                setWhatsappMessageTemplate(event.target.value)
              }
              className="border-input bg-background min-h-20 w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Hello {customerName}…"
            />
          </Field>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-muted-foreground text-xs">
              Supported placeholders: {"{customerName}"}, {"{businessName}"},{" "}
              {"{receiptNumber}"}, {"{total}"}.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={openWhatsAppTestChat}
            >
              <Send /> Open test chat
            </Button>
          </div>
        </SettingsCard>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <SettingsCard
          icon={<Settings2 />}
          title="Notification preferences"
          description="Choose which operational notices are enabled."
        >
          <div className="grid gap-x-8 md:grid-cols-2">
            <SettingToggle
              checked={notifications.lowStockAlerts}
              onToggle={() =>
                setNotifications((current) => ({
                  ...current,
                  lowStockAlerts: !current.lowStockAlerts,
                }))
              }
              label="Low stock alerts"
              description="Stock needs replenishment."
            />
            <SettingToggle
              checked={notifications.salesReports}
              onToggle={() =>
                setNotifications((current) => ({
                  ...current,
                  salesReports: !current.salesReports,
                }))
              }
              label="Sales reports"
              description="Sales reporting reminders."
            />
            <SettingToggle
              checked={notifications.newOrders}
              onToggle={() =>
                setNotifications((current) => ({
                  ...current,
                  newOrders: !current.newOrders,
                }))
              }
              label="New orders"
              description="New purchase and order activity."
            />
            <SettingToggle
              checked={notifications.customerNotifications}
              onToggle={() =>
                setNotifications((current) => ({
                  ...current,
                  customerNotifications: !current.customerNotifications,
                }))
              }
              label="Customer notifications"
              description="Customer message workflow."
            />
            <SettingToggle
              checked={notifications.paymentReminders}
              onToggle={() =>
                setNotifications((current) => ({
                  ...current,
                  paymentReminders: !current.paymentReminders,
                }))
              }
              label="Payment reminders"
              description="Credit and payable follow-up."
            />
            <SettingToggle
              checked={notifications.systemUpdates}
              onToggle={() =>
                setNotifications((current) => ({
                  ...current,
                  systemUpdates: !current.systemUpdates,
                }))
              }
              label="System updates"
              description="Operational update notices."
            />
          </div>
        </SettingsCard>
        <SettingsCard
          icon={<Settings2 />}
          title="Theme & accent color"
          description="Light or dark presentation for the POS workspace."
        >
          <div className="grid gap-4 md:grid-cols-[12rem_1fr]">
            <div>
              <p className="mb-2 text-sm font-medium">Theme mode</p>
              <label className="flex items-center gap-2 py-1 text-sm">
                <input
                  type="radio"
                  checked={themeMode === "light"}
                  onChange={() => setThemeMode("light")}
                />{" "}
                Light mode
              </label>
              <label className="flex items-center gap-2 py-1 text-sm">
                <input
                  type="radio"
                  checked={themeMode === "dark"}
                  onChange={() => setThemeMode("dark")}
                />{" "}
                Dark mode
              </label>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Accent color</p>
              <div className="flex flex-wrap gap-3">
                {Object.entries(accentColors).map(([name, color]) => (
                  <button
                    key={name}
                    type="button"
                    aria-label={`${name} accent`}
                    aria-pressed={accentColor === name}
                    onClick={() =>
                      setAccentColor(name as keyof typeof accentColors)
                    }
                    className={`flex size-9 items-center justify-center rounded-full border-2 ${accentColor === name ? "border-foreground" : "border-transparent"}`}
                    style={{ backgroundColor: color }}
                  >
                    {accentColor === name ? (
                      <Check className="size-4 text-white" />
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </SettingsCard>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <SettingsCard
          icon={<Printer />}
          title="Invoice printing"
          description="Receipt footer and print presentation."
        >
          <Field label="Receipt footer">
            <Input
              value={footer}
              onChange={(event) => setFooter(event.target.value)}
              placeholder="Thank you for your business!"
            />
          </Field>
          <p className="text-muted-foreground mt-3 text-xs">
            Receipt numbering is controlled by the audited number sequences
            below.
          </p>
        </SettingsCard>
        <SettingsCard
          icon={<FileText />}
          title="Number sequences"
          description="Read-only identifiers used for business documents."
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {data.sequences.map((sequence) => (
              <div
                key={sequence.key}
                className="bg-muted/20 rounded-lg border px-3 py-2"
              >
                <p className="text-xs font-medium">
                  {sequence.key.replaceAll("_", " ")}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {sequence.prefix} · {sequence.padding} digits
                </p>
              </div>
            ))}
          </div>
        </SettingsCard>
      </section>

      <SettingsCard
        icon={<ShieldCheck />}
        title="Security & regional defaults"
        description="Core security controls are configured through the environment for safe deployment."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <Info label="Currency" value="PKR" />
          <Info label="Timezone" value="Asia/Karachi" />
          <Info label="Locale" value="en-PK" />
        </div>
      </SettingsCard>
      <div className="bg-card/95 sticky bottom-4 z-10 flex flex-col gap-3 rounded-2xl border p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <p role="status" className="text-sm">
          {message || "Changes are audited and applied to future POS activity."}
        </p>
        <Button disabled={pending} onClick={save} className="min-w-36">
          {pending ? (
            "Saving…"
          ) : (
            <>
              <Check /> Save changes
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function SettingsCard({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardContent className="p-4">
        <div className="mb-4 flex items-start gap-3">
          <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600">
            {icon}
          </div>
          <div>
            <h2 className="font-semibold">{title}</h2>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {description}
            </p>
          </div>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}
function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block text-sm font-medium ${className}`}>
      <span className="mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/20 rounded-lg border p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function SettingToggle({
  label,
  description,
  checked,
  onToggle,
}: {
  label: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between gap-4 rounded-lg px-1 py-2 text-left"
    >
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="text-muted-foreground block text-xs">
          {description}
        </span>
      </span>
      <span
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? "bg-primary" : "bg-muted-foreground/30"}`}
        aria-pressed={checked}
      >
        <span
          className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`}
        />
      </span>
    </button>
  );
}
