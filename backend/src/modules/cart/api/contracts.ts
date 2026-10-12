import { z } from "zod";

const uuid = z.uuid();
const vnd = z.int().nonnegative().safe();

export const putCartItemBodySchema = z.strictObject({
  quantity: z.int().positive().safe(),
});

export const cartViewSchema = z.strictObject({
  cartId: uuid,
  items: z.array(
    z.strictObject({
      listingId: uuid,
      quantity: z.int().positive().safe(),
      title: z.string(),
      unitSalePrice: vnd,
      currency: z.literal("VND"),
      availability: z.enum(["AVAILABLE", "OUT_OF_STOCK", "UNAVAILABLE"]),
    }),
  ),
  estimatedMerchandiseTotal: vnd,
  currency: z.literal("VND"),
});

export const cartErrorSchema = z.strictObject({
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

export type CartView = z.infer<typeof cartViewSchema>;
