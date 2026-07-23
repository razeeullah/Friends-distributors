import { z } from "zod";
export const categoryInputSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).optional(),
  parentId: z.uuid().optional(),
  imageUrl: z.url().max(2048).optional(),
  displayOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});
export type CategoryInput = z.infer<typeof categoryInputSchema>;
