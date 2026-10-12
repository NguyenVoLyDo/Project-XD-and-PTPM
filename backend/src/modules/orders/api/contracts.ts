import { z } from "zod";

const uuid = z.uuid();
const vnd = z.int().nonnegative().safe();

export const shippingAddressSchema = z.strictObject({
  recipientName: z.string().min(1),
  phone: z.string().min(1),
  line1: z.string().min(1),
  wardCode: z.string().min(1),
  provinceCode: z.string().min(1),
});

export const checkoutRequestSchema = z.strictObject({
  cartId: uuid,
  shippingAddress: shippingAddressSchema,
  paymentMethod: z.enum(["COD", "ONLINE"]),
});

/** The controller supplies this from the Idempotency-Key header. */
export const checkoutIdempotencyKeySchema = z.string().trim().min(1);

export const checkoutQuoteSchema = z.strictObject({
  listingId: uuid,
  productId: uuid,
  supplierId: uuid,
  sellerId: uuid,
  productName: z.string().min(1),
  listingTitle: z.string().min(1),
  unitSalePrice: vnd,
  unitCostPrice: vnd,
  currency: z.literal("VND"),
  status: z.literal("ACTIVE"),
});

const fulfillmentOrderSchema = z.strictObject({
  fulfillmentOrderId: uuid,
  supplierId: uuid,
  sellerId: uuid,
  status: z.literal("PENDING_ACCEPTANCE"),
  amountToCollect: vnd,
});

const checkoutResponseBase = z.strictObject({
  orderId: uuid,
  orderNo: z.string().min(1),
  fulfillmentSummary: z.literal("UNFULFILLED"),
  currency: z.literal("VND"),
  totalPayable: vnd,
  fulfillmentOrders: z.array(fulfillmentOrderSchema).min(1),
});

export const checkoutResponseSchema = z.discriminatedUnion("paymentMethod", [
  checkoutResponseBase.extend({
    paymentMethod: z.literal("COD"),
    status: z.literal("CONFIRMED"),
    paymentStatus: z.literal("PENDING_COD"),
  }),
  checkoutResponseBase.extend({
    paymentMethod: z.literal("ONLINE"),
    status: z.literal("PENDING_PAYMENT"),
    paymentStatus: z.literal("PENDING"),
    paymentIntentId: uuid,
  }),
]);

export const ordersErrorSchema = z.strictObject({
  error: z.strictObject({
    code: z.string().min(1),
    message: z.string().min(1),
    details: z.array(
      z
        .object({
          field: z.string().optional(),
          code: z.string().optional(),
          message: z.string().optional(),
        })
        .catchall(z.unknown()),
    ),
  }),
});

export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;
export type CheckoutResponse = z.infer<typeof checkoutResponseSchema>;
