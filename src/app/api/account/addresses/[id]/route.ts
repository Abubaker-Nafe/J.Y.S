import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/security/request";
import { addressUpdateSchema } from "@/lib/validation/auth";
import { parseJsonBody, parseWithSchema, ValidationError } from "@/lib/validation/common";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const session = await requireUser();
    const { id } = await context.params;
    const input = parseWithSchema(addressUpdateSchema, await parseJsonBody(request));
    if (Object.keys(input).length === 0) throw new ValidationError("At least one field is required");

    const address = await db.$transaction(async (tx) => {
      const existing = await tx.address.findFirst({
        where: { id, userId: session.user.id, isActive: true },
      });
      if (!existing) throw new ValidationError("Address was not found");
      const cityId = input.cityId ?? existing.cityId;
      const areaId = input.areaId === undefined ? existing.areaId : input.areaId;
      const city = await tx.city.findFirst({ where: { id: cityId, isActive: true } });
      if (!city) throw new ValidationError("Selected city is unavailable");
      if (areaId) {
        const area = await tx.area.findFirst({ where: { id: areaId, cityId, isActive: true } });
        if (!area) throw new ValidationError("Selected area is unavailable");
      }
      const updated = await tx.address.update({
        where: { id },
        data: {
          label: input.label,
          recipientName: input.recipientName,
          phone: input.phone,
          cityId: input.cityId,
          areaId: input.areaId,
          addressLine: input.addressLine,
          locationDetails: input.locationDetails,
        },
      });
      if (input.makeDefault) {
        await tx.customerProfile.upsert({
          where: { userId: session.user.id },
          create: { userId: session.user.id, defaultAddressId: id },
          update: { defaultAddressId: id },
        });
      }
      return updated;
    });
    return NextResponse.json({ address });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const session = await requireUser();
    const { id } = await context.params;
    await db.$transaction(async (tx) => {
      const removed = await tx.address.updateMany({
        where: { id, userId: session.user.id, isActive: true },
        data: { isActive: false },
      });
      if (removed.count === 0) throw new ValidationError("Address was not found");
      await tx.customerProfile.updateMany({
        where: { userId: session.user.id, defaultAddressId: id },
        data: { defaultAddressId: null },
      });
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return jsonError(error);
  }
}

