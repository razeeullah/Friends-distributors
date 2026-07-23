"use server";
import { revalidatePath } from "next/cache";
import { getRequestMetadata } from "@/features/auth/request-metadata";
import { requirePermission } from "@/features/auth/session";
import {
  businessSettingsSchema,
  createBranchSchema,
  type BusinessSettingsInput,
} from "@/features/settings/schemas";
import {
  createBusinessLocation,
  saveBusinessSettings,
} from "@/features/settings/services";
export async function saveBusinessSettingsAction(input: BusinessSettingsInput) {
  const parsed = businessSettingsSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, message: "Check the settings fields." };
  const context = await requirePermission("settings.manage");
  try {
    await saveBusinessSettings(
      context,
      parsed.data,
      await getRequestMetadata(),
    );
    revalidatePath("/settings");
    return { success: true, message: "Settings saved." };
  } catch {
    return { success: false, message: "Settings could not be saved." };
  }
}

export async function createBranchAction(input: unknown) {
  const parsed = createBranchSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, message: "Check the branch name and code." };
  const context = await requirePermission("settings.manage");
  try {
    await createBusinessLocation(
      context,
      parsed.data,
      await getRequestMetadata(),
    );
    revalidatePath("/settings");
    return { success: true, message: "Branch created." };
  } catch {
    return {
      success: false,
      message: "Branch could not be created. The code may already be in use.",
    };
  }
}
