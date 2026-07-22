import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireUser, setSessionCookie } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/security/request";
import { profileUpdateSchema } from "@/lib/validation/auth";
import { parseJsonBody, parseWithSchema } from "@/lib/validation/common";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await requireUser();
    const profile = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
        customerProfile: {
          select: {
            preferredLocale: true,
            defaultAddressId: true,
          },
        },
      },
    });
    return NextResponse.json({ profile }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requireUser();
    const input = parseWithSchema(profileUpdateSchema, await parseJsonBody(request));
    const userData: Prisma.UserUpdateInput = {};
    if (input.name !== undefined) userData.name = input.name;
    if (input.phone !== undefined) userData.phone = input.phone;

    const user = await db.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: session.user.id },
        data: userData,
        select: { id: true, email: true, name: true, role: true, phone: true },
      });
      if (input.preferredLocale) {
        await tx.customerProfile.upsert({
          where: { userId: session.user.id },
          create: { userId: session.user.id, preferredLocale: input.preferredLocale },
          update: { preferredLocale: input.preferredLocale },
        });
      }
      return updated;
    });
    await setSessionCookie({ id: user.id, email: user.email, name: user.name, role: user.role });
    return NextResponse.json({ profile: user });
  } catch (error) {
    return jsonError(error);
  }
}

