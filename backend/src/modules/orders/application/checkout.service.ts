import { createHash } from "node:crypto";
import { Inject, Injectable, Optional } from "@nestjs/common";
import {
  checkoutIdempotencyKeySchema,
  checkoutRequestSchema,
  type CheckoutRequest,
  type CheckoutResponse,
} from "../api/contracts";
import { failOrders } from "./errors";
import {
  ORDERS_CHECKOUT_EXECUTOR,
  ORDERS_CURRENT_ACTOR,
  ORDERS_IDEMPOTENCY,
  type CheckoutExecutionContext,
  type CheckoutExecutorPort,
  type CurrentActorPort,
  type IdempotencyPort,
} from "./ports";

/**
 * Deterministically serializes JSON with recursively sorted object keys.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  const pairs = sortedKeys.map(
    (key) => `${JSON.stringify(key)}:${canonicalJson(obj[key])}`,
  );
  return `{${pairs.join(",")}}`;
}

/**
 * Computes a deterministic SHA-256 hash of the canonicalized CheckoutRequest.
 */
export function computeCheckoutRequestHash(request: CheckoutRequest): string {
  const canonical = canonicalJson(request);
  return createHash("sha256").update(canonical).digest("hex");
}

/**
 * Workflow 4 — Handles checkout request entry, validates DTO, and enforces idempotency.
 *
 * Rules:
 * 1. Requires authenticated CurrentActor with activeRole === "CUSTOMER" and activeProfileId === null.
 * 2. Requires non-empty trimmed Idempotency-Key header.
 * 3. Validates request body with strict CheckoutRequest schema.
 * 4. Checks idempotency store scoped to (customerId, key) BEFORE reading Cart or executing:
 *    - Same key + matching requestHash -> returns stored response immediately (replay).
 *    - Same key + mismatching requestHash -> throws 409 IDEMPOTENCY_KEY_REUSED.
 * 5. If new key -> delegates execution to CheckoutExecutorPort.
 */
@Injectable()
export class CheckoutService {
  constructor(
    @Inject(ORDERS_CURRENT_ACTOR)
    private readonly currentActor: CurrentActorPort,
    @Inject(ORDERS_IDEMPOTENCY)
    private readonly idempotency: IdempotencyPort,
    @Optional()
    @Inject(ORDERS_CHECKOUT_EXECUTOR)
    private readonly executor?: CheckoutExecutorPort,
  ) {}

  async checkout(
    idempotencyKeyRaw: unknown,
    bodyRaw: unknown,
  ): Promise<CheckoutResponse> {
    const customerId = await this.requireCustomerId();
    const key = this.validateIdempotencyKey(idempotencyKeyRaw);
    const request = this.validateRequestBody(bodyRaw);
    const requestHash = computeCheckoutRequestHash(request);

    // Check replay before reading current Cart or executing side-effects
    const existing = await this.idempotency.find(customerId, key);
    if (existing) {
      if (existing.requestHash === requestHash) {
        return existing.response;
      }
      failOrders(
        409,
        "IDEMPOTENCY_KEY_REUSED",
        "Idempotency-Key đã được sử dụng với nội dung khác",
        [{ field: "Idempotency-Key", code: "IDEMPOTENCY_KEY_REUSED" }],
      );
    }

    if (!this.executor) {
      failOrders(
        500,
        "CHECKOUT_EXECUTOR_UNAVAILABLE",
        "Trình xử lý checkout chưa được cấu hình",
      );
    }

    const context: CheckoutExecutionContext = {
      customerId,
      key,
      requestHash,
      request,
    };

    return this.executor.execute(context);
  }

  private async requireCustomerId(): Promise<string> {
    const actor = await this.currentActor.getCurrentActor();
    if (!actor) {
      failOrders(401, "UNAUTHORIZED", "Vui lòng đăng nhập", []);
    }
    if (actor.activeRole !== "CUSTOMER" || actor.activeProfileId !== null) {
      failOrders(403, "FORBIDDEN", "Chỉ Customer được thực hiện checkout", []);
    }
    return actor.userId;
  }

  private validateIdempotencyKey(keyRaw: unknown): string {
    const parsed = checkoutIdempotencyKeySchema.safeParse(keyRaw);
    if (!parsed.success) {
      failOrders(400, "INVALID_REQUEST", "Thiếu Idempotency-Key", [
        {
          field: "Idempotency-Key",
          code: "REQUIRED",
          message: "Idempotency-Key là bắt buộc",
        },
      ]);
    }
    return parsed.data;
  }

  private validateRequestBody(bodyRaw: unknown): CheckoutRequest {
    const parsed = checkoutRequestSchema.safeParse(bodyRaw);
    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => {
        const field = issue.path.length ? issue.path.join(".") : undefined;
        return {
          ...(field ? { field } : {}),
          code:
            issue.code === "unrecognized_keys"
              ? "UNRECOGNIZED_FIELD"
              : "INVALID_FIELD",
          message: issue.message,
        };
      });
      failOrders(
        400,
        "INVALID_REQUEST",
        "Dữ liệu checkout không hợp lệ",
        details,
      );
    }
    return parsed.data;
  }
}
