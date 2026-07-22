import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/security/request";
import { addressSchema } from "@/lib/validation/auth";
import { parseJsonBody, parseWithSchema, ValidationError } from "@/lib/validation/common";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await requireUser();
    const [addresses, profile] = await db.$transaction([
      db.address.findMany({
        where: { userId: session.user.id, isActive: true },
        orderBy: { createdAt: "desc" },
        include: {
          city: { select: { id: true, nameAr: true, nameEn: true } },
          area: { select: { id: true, nameAr: true, nameEn: true } },
        },
      }),
      db.customerProfile.findUnique({
        where: { userId: session.user.id },
        select: { defaultAddressId: true },
      }),
    ]);
    return NextResponse.json({
      addresses: addresses.map((address) => ({
        ...address,
        isDefault: profile?.defaultAddressId === address.id,
      })),
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requireUser();
    const input = parseWithSchema(addressSchema, await parseJsonBody(request));
    const address = await db.$transaction(async (tx) => {
      const city = await tx.city.findFirst({ where: { id: input.cityId, isActive: true } });
      if (!city) throw new ValidationError("Selected city is unavailable");
      if (input.areaId) {
        const area = await tx.area.findFirst({
          where: { id: input.areaId, cityId: input.cityId, isActive: true },
        });
        if (!area) throw new ValidationError("Selected area is unavailable");
      }
      const created = await tx.address.create({
        data: {
          userId: session.user.id,
          label: input.label ?? null,
          recipientName: input.recipientName,
          phone: input.phone,
          cityId: input.cityId,
          areaId: input.areaId ?? null,
          addressLine: input.addressLine,
          locationDetails: input.locationDetails ?? null,
        },
      });
      const profile = await tx.customerProfile.findUnique({ where: { userId: session.user.id } });
      if (input.makeDefault || !profile?.defaultAddressId) {
        await tx.customerProfile.upsert({
          where: { userId: session.user.id },
          create: { userId: session.user.id, defaultAddressId: created.id },
          update: { defaultAddressId: created.id },
        });
      }
      return created;
    });
    return NextResponse.json({ address }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

