import { z } from "zod";
import { idSchema, palestinianPhoneSchema } from "./common";

export const addCartItemSchema = z
  .object({
    productId: idSchema,
    variantId: idSchema.nullish(),
    quantity: z.number().int().min(1).max(99),
  })
  .strict();

export const updateCartItemSchema = z
  .object({ quantity: z.number().int().min(1).max(99) })
  .strict();

export const wishlistMutationSchema = z.object({ productId: idSchema }).strict();

const checkoutBase = {
  name: z.string().trim().min(2).max(100),
  phone: palestinianPhoneSchema,
  notes: z.string().trim().max(1_000).nullish(),
  acceptPolicies: z.literal(true, {
    error: "You must accept the terms and policies",
  }),
};

const deliveryCheckoutSchema = z
  .object({
    ...checkoutBase,
    fulfillmentMethod: z.literal("DELIVERY"),
    cityId: idSchema,
    areaId: idSchema.nullish(),
    addressLine: z.string().trim().min(5).max(300),
    locationDetails: z.string().trim().max(500).nullish(),
  })
  .strict();

const pickupCheckoutSchema = z
  .object({
    ...checkoutBase,
    fulfillmentMethod: z.literal("PICKUP"),
  })
  .strict();

export const checkoutSchema = z.discriminatedUnion("fulfillmentMethod", [
  deliveryCheckoutSchema,
  pickupCheckoutSchema,
]);

export type AddCartItemInput = z.infer<typeof addCartItemSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;

