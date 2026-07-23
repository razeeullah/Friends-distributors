import type { ZodError } from "zod";

export function flattenFieldErrors(
  error: ZodError,
): Readonly<Record<string, readonly string[]>> {
  const fields: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const field = issue.path.join(".") || "form";
    fields[field] ??= [];
    fields[field].push(issue.message);
  }

  return fields;
}
