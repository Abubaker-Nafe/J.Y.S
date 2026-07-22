import { z } from "zod";
import {
  emailSchema,
  idSchema,
  localeSchema,
  palestinianPhoneSchema,
  passwordSchema,
} from "./common";

export const registerSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: emailSchema,
    phone: palestinianPhoneSchema,
    password: passwordSchema,
    cityId: idSchema,
    areaId: idSchema.nullish(),
    addressLine: z.string().trim().min(5).max(300),
    locationDetails: z.string().trim().max(500).nullish(),
    preferredLocale: localeSchema.default("ar"),
  })
  .strict();

export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1).max(128),
  })
  .strict();

export const forgotPasswordSchema = z.object({ email: emailSchema }).strict();

export const resetPasswordSchema = z
  .object({
    token: z.string().trim().min(32).max(256),
    password: passwordSchema,
  })
  .strict();

export const profileUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    phone: palestinianPhoneSchema.optional(),
    preferredLocale: localeSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const addressSchema = z
  .object({
    label: z.string().trim().max(50).nullish(),
    recipientName: z.string().trim().min(2).max(100),
    phone: palestinianPhoneSchema,
    cityId: idSchema,
    areaId: idSchema.nullish(),
    addressLine: z.string().trim().min(5).max(300),
    locationDetails: z.string().trim().max(500).nullish(),
    makeDefault: z.boolean().default(false),
  })
  .strict();

export const addressUpdateSchema = addressSchema.partial().extend({
  makeDefault: z.boolean().optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

