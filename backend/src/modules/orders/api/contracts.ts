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

export const customerOrderItemViewSchema = z.strictObject({
  orderItemId: uuid,
  fulfillmentOrderId: uuid,
  lineIndex: z.number().int().nonnegative(),
  listingId: uuid,
  productId: uuid,
  productName: z.string().min(1),
  listingTitle: z.string().min(1),
  quantity: z.number().int().positive(),
  unitSalePrice: vnd,
  lineSaleTotal: vnd,
  currency: z.literal("VND"),
});

export const customerFulfillmentOrderViewSchema = z.strictObject({
  fulfillmentOrderId: uuid,
  supplierId: uuid,
  sellerId: uuid,
  status: z.enum([
    "PENDING_ACCEPTANCE",
    "ACCEPTED",
    "PACKING",
    "READY_TO_SHIP",
    "SHIPPED",
    "IN_TRANSIT",
    "DELIVERED",
    "DELIVERY_FAILED",
    "RETURN_REQUESTED",
    "RETURNING",
    "RETURNED",
    "REFUNDED",
    "REJECTED",
    "CANCELED",
  ]),
  amountToCollect: vnd,
  trackingNo: z.string().optional(),
  carrierCode: z.string().optional(),
});

export const customerOrderDetailSchema = z.strictObject({
  orderId: uuid,
  orderNo: z.string().min(1),
  status: z.enum([
    "DRAFT",
    "PENDING_PAYMENT",
    "CONFIRMED",
    "PAYMENT_FAILED",
    "PROCESSING",
    "CANCELED",
    "CLOSED",
  ]),
  fulfillmentSummary: z.enum([
    "UNFULFILLED",
    "PARTIALLY_CANCELED",
    "PARTIALLY_FULFILLED",
    "PARTIALLY_COMPLETED",
    "FULFILLED",
    "RETURN_IN_PROGRESS",
    "COMPLETED",
    "CANCELED",
  ]),
  paymentMethod: z.enum(["COD", "ONLINE"]),
  paymentStatus: z.enum([
    "PENDING",
    "PENDING_COD",
    "PAID",
    "FAILED",
    "COLLECTED",
    "VOIDED",
    "REFUND_PENDING",
    "PARTIALLY_REFUNDED",
    "REFUNDED",
  ]),
  currency: z.literal("VND"),
  grandTotal: vnd,
  totalPayable: vnd,
  shippingAddress: shippingAddressSchema,
  paymentIntentId: uuid.optional(),
  createdAt: z.string().min(1),
  updatedAt: z.string().optional(),
  items: z.array(customerOrderItemViewSchema),
  fulfillmentOrders: z.array(customerFulfillmentOrderViewSchema),
});

export const customerOrderSummarySchema = z.strictObject({
  orderId: uuid,
  orderNo: z.string().min(1),
  status: z.enum([
    "DRAFT",
    "PENDING_PAYMENT",
    "CONFIRMED",
    "PAYMENT_FAILED",
    "PROCESSING",
    "CANCELED",
    "CLOSED",
  ]),
  fulfillmentSummary: z.enum([
    "UNFULFILLED",
    "PARTIALLY_CANCELED",
    "PARTIALLY_FULFILLED",
    "PARTIALLY_COMPLETED",
    "FULFILLED",
    "RETURN_IN_PROGRESS",
    "COMPLETED",
    "CANCELED",
  ]),
  paymentMethod: z.enum(["COD", "ONLINE"]),
  paymentStatus: z.enum([
    "PENDING",
    "PENDING_COD",
    "PAID",
    "FAILED",
    "COLLECTED",
    "VOIDED",
    "REFUND_PENDING",
    "PARTIALLY_REFUNDED",
    "REFUNDED",
  ]),
  currency: z.literal("VND"),
  grandTotal: vnd,
  totalPayable: vnd,
  itemCount: z.number().int().nonnegative(),
  createdAt: z.string().min(1),
});

export const paginationMetaSchema = z.strictObject({
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});

export const customerOrderListResponseSchema = z.strictObject({
  items: z.array(customerOrderSummarySchema),
  pagination: paginationMetaSchema,
});

export type CustomerOrderItemView = z.infer<
  typeof customerOrderItemViewSchema
>;
export type CustomerFulfillmentOrderView = z.infer<
  typeof customerFulfillmentOrderViewSchema
>;
export type CustomerOrderDetailResponse = z.infer<
  typeof customerOrderDetailSchema
>;
export type CustomerOrderSummary = z.infer<
  typeof customerOrderSummarySchema
>;
export type PaginationMeta = z.infer<typeof paginationMetaSchema>;
export type CustomerOrderListResponse = z.infer<
  typeof customerOrderListResponseSchema
>;
