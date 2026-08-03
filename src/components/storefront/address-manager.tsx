"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { LoaderCircle, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import type { Locale } from "@/lib/i18n/config";
import type { StorefrontLocations } from "@/lib/catalog/locations";
import { translate } from "@/lib/i18n/dictionaries";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

interface Address {
  id: string;
  label: string | null;
  recipientName: string;
  phone: string;
  cityId: string;
  areaId: string | null;
  addressLine: string;
  locationDetails: string | null;
  isDefault: boolean;
  city: { nameAr: string; nameEn: string };
  area?: { nameAr: string; nameEn: string } | null;
}
type Feedback = { tone: "success" | "error"; text: string } | null;

export function AddressManager({ locale, locations }: { locale: Locale; locations: StorefrontLocations }) {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Address | null>(null);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [cityId, setCityId] = useState(locations.cities[0]?.id ?? "");
  const [areaId, setAreaId] = useState("");
  const city = locations.cities.find((item) => item.id === cityId);

  const load = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch("/api/account/addresses", { cache: "no-store" });
      if (!response.ok) throw new Error();
      const data = await response.json() as { addresses: Address[] };
      setAddresses(data.addresses);
      return true;
    } catch {
      setFeedback({ tone: "error", text: locale === "ar" ? "تعذر تحميل العناوين." : "Addresses could not be loaded." });
      return false;
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/account/addresses", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const data = await response.json() as { addresses: Address[] };
        setAddresses(data.addresses);
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setFeedback({ tone: "error", text: locale === "ar" ? "تعذر تحميل العناوين." : "Addresses could not be loaded." });
        }
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [locale]);

  function closeForm() {
    setOpen(false);
    setEditing(null);
    setAreaId("");
  }

  function startNew() {
    setFeedback(null);
    setEditing(null);
    setCityId(locations.cities[0]?.id ?? "");
    setAreaId("");
    setOpen(true);
  }

  function startEdit(address: Address) {
    setFeedback(null);
    setEditing(address);
    setCityId(address.cityId);
    setAreaId(address.areaId ?? "");
    setOpen(true);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFeedback(null);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(editing ? `/api/account/addresses/${editing.id}` : "/api/account/addresses", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: String(form.get("label")) || undefined,
          recipientName: String(form.get("recipientName")),
          phone: String(form.get("phone")),
          cityId: String(form.get("cityId")),
          areaId: String(form.get("areaId")) || null,
          addressLine: String(form.get("addressLine")),
          locationDetails: String(form.get("locationDetails")) || null,
          makeDefault: Boolean(form.get("makeDefault")),
        }),
      });
      const payload = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) throw new Error(payload.message);
      const wasEditing = Boolean(editing);
      closeForm();
      const refreshed = await load();
      if (refreshed) setFeedback({ tone: "success", text: locale === "ar" ? (wasEditing ? "تم تحديث العنوان." : "تمت إضافة العنوان.") : (wasEditing ? "Address updated." : "Address added.") });
    } catch (error) {
      setFeedback({ tone: "error", text: locale === "ar" ? "تعذر حفظ العنوان. تحقق من البيانات وحاول مجدداً." : error instanceof Error && error.message ? error.message : "Address could not be saved." });
    } finally {
      setPending(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm(locale === "ar" ? "إزالة هذا العنوان؟" : "Remove this address?")) return;
    setPending(true);
    setFeedback(null);
    try {
      const response = await fetch(`/api/account/addresses/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      setAddresses((current) => current.filter((item) => item.id !== id));
      setFeedback({ tone: "success", text: locale === "ar" ? "تمت إزالة العنوان." : "Address removed." });
    } catch {
      setFeedback({ tone: "error", text: locale === "ar" ? "تعذرت إزالة العنوان." : "Address could not be removed." });
    } finally {
      setPending(false);
    }
  }

  async function makeDefault(id: string) {
    setPending(true);
    setFeedback(null);
    try {
      const response = await fetch(`/api/account/addresses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ makeDefault: true }),
      });
      if (!response.ok) throw new Error();
      const refreshed = await load();
      if (refreshed) setFeedback({ tone: "success", text: locale === "ar" ? "تم تعيين العنوان الافتراضي." : "Default address updated." });
    } catch {
      setFeedback({ tone: "error", text: locale === "ar" ? "تعذر تعيين العنوان الافتراضي." : "The default address could not be updated." });
    } finally {
      setPending(false);
    }
  }

  if (loading) {
    return <div className="grid min-h-64 place-items-center" role="status" aria-live="polite"><LoaderCircle className="size-7 animate-spin text-accent" aria-hidden="true" /><span className="sr-only">{translate(locale, "common.loading")}</span></div>;
  }

  return <section className="min-w-0">
    <div className="flex min-w-0 flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0"><h2 className="break-anywhere font-display text-3xl font-semibold">{translate(locale, "addresses.title")}</h2><p className="break-anywhere mt-2 text-sm text-muted">{translate(locale, "addresses.emptyText")}</p></div>
      <Button className="w-full shrink-0 sm:w-auto" onClick={open ? closeForm : startNew}><Plus className="size-4" />{open ? translate(locale, "common.cancel") : translate(locale, "addresses.add")}</Button>
    </div>
    {locations.source === "unavailable" ? <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">{locale === "ar" ? "المدن والمناطق غير متاحة من قاعدة البيانات، لذلك لا يمكن إضافة عنوان." : "Cities and areas are unavailable from the database, so an address cannot be added."}</p> : null}
    {feedback ? <p role={feedback.tone === "error" ? "alert" : "status"} className={feedback.tone === "error" ? "mt-5 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800" : "mt-5 rounded-xl bg-accent/5 p-3 text-sm font-semibold text-accent"}>{feedback.text}</p> : null}
    {open && locations.source !== "unavailable" ? <form key={editing?.id ?? "new-address"} onSubmit={save} className="mt-6 grid gap-4 rounded-2xl border border-line bg-surface p-5 sm:grid-cols-2">
      <div><Label htmlFor="address-label">{locale === "ar" ? "اسم العنوان" : "Address label"}</Label><Input id="address-label" name="label" defaultValue={editing?.label ?? ""} placeholder={locale === "ar" ? "المنزل" : "Home"} /></div>
      <div><Label htmlFor="recipient">{translate(locale, "auth.name")}</Label><Input id="recipient" name="recipientName" defaultValue={editing?.recipientName ?? ""} required /></div>
      <div><Label htmlFor="address-phone">{translate(locale, "auth.phone")}</Label><Input id="address-phone" name="phone" type="tel" dir="ltr" defaultValue={editing?.phone ?? ""} required /></div>
      <div><Label htmlFor="address-city">{translate(locale, "checkout.city")}</Label><Select id="address-city" name="cityId" value={cityId} onChange={(event) => { setCityId(event.target.value); setAreaId(""); }}>{locations.cities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></div>
      <div><Label htmlFor="address-area">{translate(locale, "checkout.area")}</Label><Select id="address-area" name="areaId" value={areaId} onChange={(event) => setAreaId(event.target.value)}><option value="">—</option>{city?.areas.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></div>
      <div><Label htmlFor="address-line">{translate(locale, "checkout.street")}</Label><Input id="address-line" name="addressLine" defaultValue={editing?.addressLine ?? ""} required /></div>
      <div className="sm:col-span-2"><Label htmlFor="address-location">{translate(locale, "checkout.location")}</Label><Input id="address-location" name="locationDetails" defaultValue={editing?.locationDetails ?? ""} /></div>
      <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="makeDefault" defaultChecked={editing?.isDefault} className="size-4 accent-accent" />{locale === "ar" ? "اجعله العنوان الافتراضي" : "Make this the default address"}</label>
      <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="quiet" onClick={closeForm}>{translate(locale, "common.cancel")}</Button><Button type="submit" disabled={pending}>{pending ? translate(locale, "common.loading") : translate(locale, "common.save")}</Button></div>
    </form> : null}
    <div className="mt-6">
      {addresses.length ? <div className="grid min-w-0 gap-4 sm:grid-cols-2">{addresses.map((address) => <article key={address.id} className="min-w-0 rounded-2xl border border-line bg-surface-strong p-5">
        <div className="flex items-start justify-between gap-3"><span className="grid size-10 place-items-center rounded-xl bg-brand-strong text-white"><MapPin className="size-4" /></span>{address.isDefault ? <Badge tone="success">{locale === "ar" ? "افتراضي" : "Default"}</Badge> : null}</div>
        <h3 className="break-anywhere mt-4 font-black">{address.label || address.recipientName}</h3>
        <p className="break-anywhere mt-2 text-sm leading-6 text-muted">{locale === "ar" ? address.city.nameAr : address.city.nameEn}{address.area ? ` · ${locale === "ar" ? address.area.nameAr : address.area.nameEn}` : ""}<br />{address.addressLine}<br /><span className="break-anywhere" dir="ltr">{address.phone}</span></p>
        <div className="mt-4 flex min-w-0 flex-wrap gap-1"><button type="button" onClick={() => startEdit(address)} className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 py-2 text-xs font-bold hover:bg-canvas"><Pencil className="size-4" />{locale === "ar" ? "تعديل" : "Edit"}</button>{!address.isDefault ? <button type="button" disabled={pending} onClick={() => void makeDefault(address.id)} className="min-h-11 rounded-full px-3 py-2 text-xs font-bold hover:bg-canvas">{locale === "ar" ? "تعيين افتراضي" : "Make default"}</button> : null}<button type="button" onClick={() => void remove(address.id)} className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50"><Trash2 className="size-4" />{translate(locale, "common.remove")}</button></div>
      </article>)}</div> : <EmptyState compact title={translate(locale, "addresses.empty")} text={translate(locale, "addresses.emptyText")} />}
    </div>
  </section>;
}
