import { randomBytes, createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";
import type { LoginInput, RegisterInput } from "@/lib/validation/auth";
import { ValidationError } from "@/lib/validation/common";
import { hashPassword, performDummyPasswordCheck, verifyPassword } from "./password";
import type { SessionUser } from "./session";

export class InvalidCredentialsError extends Error {
  constructor() {
    super("Invalid email or password");
    this.name = "InvalidCredentialsError";
  }
}

export async function registerCustomer(input: RegisterInput): Promise<SessionUser> {
  const passwordHash = await hashPassword(input.password);

  return db.$transaction(async (tx) => {
    const city = await tx.city.findFirst({ where: { id: input.cityId, isActive: true } });
    if (!city) throw new ValidationError("Selected city is unavailable");

    if (input.areaId) {
      const area = await tx.area.findFirst({
        where: { id: input.areaId, cityId: input.cityId, isActive: true },
      });
      if (!area) throw new ValidationError("Selected area is unavailable");
    }

    try {
      const user = await tx.user.create({
        data: {
          name: input.name,
          email: input.email,
          phone: input.phone,
          passwordHash,
          role: "CUSTOMER",
          customerProfile: {
            create: { preferredLocale: input.preferredLocale },
          },
        },
        select: { id: true, email: true, name: true, role: true },
      });

      const address = await tx.address.create({
        data: {
          userId: user.id,
          recipientName: input.name,
          phone: input.phone,
          cityId: input.cityId,
          areaId: input.areaId ?? null,
          addressLine: input.addressLine,
          locationDetails: input.locationDetails ?? null,
          label: input.preferredLocale === "ar" ? "الرئيسي" : "Home",
        },
      });
      await tx.customerProfile.update({
        where: { userId: user.id },
        data: { defaultAddressId: address.id },
      });
      return user;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ValidationError("An account with this email or phone already exists");
      }
      throw error;
    }
  });
}

export async function authenticateCredentials(input: LoginInput): Promise<SessionUser> {
  const user = await db.user.findUnique({
    where: { email: input.email },
    select: { id: true, email: true, name: true, role: true, status: true, passwordHash: true },
  });
  if (!user) {
    await performDummyPasswordCheck(input.password);
    throw new InvalidCredentialsError();
  }

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid || user.status !== "ACTIVE") throw new InvalidCredentialsError();

  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function requestPasswordReset(email: string, requestedIp: string): Promise<void> {
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, status: true },
  });
  if (!user || user.status !== "ACTIVE") return;

  const token = randomBytes(32).toString("base64url");
  await db.$transaction([
    db.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    }),
    db.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashResetToken(token),
        expiresAt: new Date(Date.now() + 60 * 60 * 1_000),
        requestedIp: requestedIp === "unknown" ? null : requestedIp,
      },
    }),
  ]);

  const baseUrl = process.env.APP_URL ?? "http://localhost:3000";
  try {
    await sendPasswordResetEmail({
      to: user.email,
      recipientName: user.name,
      resetUrl: `${baseUrl.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`,
    });
  } catch (error) {
    // The public endpoint must remain indistinguishable for existing and unknown emails.
    console.error("Password reset email failed", error instanceof Error ? error.message : "Unknown error");
  }
}

export async function resetPassword(token: string, password: string): Promise<void> {
  const tokenHash = hashResetToken(token);
  const passwordHash = await hashPassword(password);
  const now = new Date();

  await db.$transaction(async (tx) => {
    const record = await tx.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, usedAt: true, expiresAt: true },
    });
    if (!record || record.usedAt || record.expiresAt <= now) {
      throw new ValidationError("This password-reset link is invalid or has expired");
    }

    const consumed = await tx.passwordResetToken.updateMany({
      where: { id: record.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (consumed.count !== 1) {
      throw new ValidationError("This password-reset link is invalid or has expired");
    }

    await tx.user.update({ where: { id: record.userId }, data: { passwordHash } });
    await tx.passwordResetToken.updateMany({
      where: { userId: record.userId, usedAt: null },
      data: { usedAt: now },
    });
  });
}
