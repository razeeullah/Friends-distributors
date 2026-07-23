import { z } from "zod";
export const businessSettingsSchema = z.object({
  name: z.string().trim().min(2).max(160),
  legalName: z.string().trim().max(200).optional(),
  address: z.string().trim().max(400).optional(),
  phone: z.string().trim().max(32).optional(),
  email: z.email().optional(),
  taxRegistrationNumber: z.string().trim().max(80).optional(),
  currencyCode: z.literal("PKR"),
  timezone: z.literal("Asia/Karachi"),
  locale: z.literal("en-PK"),
  defaultLocationId: z.uuid().optional(),
  defaultRegisterId: z.uuid().optional(),
  receiptFooter: z.string().trim().max(500).optional(),
  cashierDiscountLimitPercent: z.coerce.number().min(0).max(100),
  allowNegativeInventory: z.boolean(),
  allowPriceOverride: z.boolean(),
  requireCustomerForCredit: z.boolean(),
  autoPrintReceipt: z.boolean(),
  taxInclusive: z.boolean(),
  acceptedPaymentMethods: z
    .array(z.enum(["CASH", "CARD", "BANK_TRANSFER", "MOBILE_WALLET", "CREDIT"]))
    .min(1),
  whatsappNumber: z.string().trim().max(32).optional(),
  whatsappMessageTemplate: z.string().trim().max(1000).optional(),
  whatsappProvider: z.enum(["NONE", "TWILIO", "META"]),
  notificationPreferences: z.object({
    lowStockAlerts: z.boolean(),
    newOrders: z.boolean(),
    paymentReminders: z.boolean(),
    salesReports: z.boolean(),
    customerNotifications: z.boolean(),
    systemUpdates: z.boolean(),
  }),
  themeMode: z.enum(["light", "dark"]),
  accentColor: z.enum(["blue", "green", "violet", "orange", "red", "teal"]),
});

export const createBranchSchema = z.object({
  name: z.string().trim().min(2).max(160),
  code: z
    .string()
    .trim()
    .min(2)
    .max(32)
    .regex(/^[A-Za-z0-9_-]+$/),
  phone: z.string().trim().max(32).optional(),
});
export type BusinessSettingsInput = z.infer<typeof businessSettingsSchema>;
