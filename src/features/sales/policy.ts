export class SalePolicyError extends Error {
  constructor(
    readonly code:
      | "FORBIDDEN"
      | "NOT_FOUND"
      | "INVALID_TOTALS"
      | "REGISTER_CLOSED"
      | "INSUFFICIENT_STOCK"
      | "HELD_SALE",
    message: string,
  ) {
    super(message);
    this.name = "SalePolicyError";
  }
}
