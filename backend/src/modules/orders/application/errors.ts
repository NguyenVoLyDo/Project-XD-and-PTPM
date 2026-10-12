import { HttpException } from "@nestjs/common";

/** Detail object of the common error envelope; extra item-level keys allowed. */
export interface OrdersErrorDetail {
  readonly field?: string;
  readonly code?: string;
  readonly message?: string;
  readonly [key: string]: unknown;
}

/** Throws the common v1 error envelope `{error:{code,message,details}}`. */
export function failOrders(
  status: number,
  code: string,
  message: string,
  details: readonly OrdersErrorDetail[] = [],
): never {
  throw new HttpException({ error: { code, message, details } }, status);
}
