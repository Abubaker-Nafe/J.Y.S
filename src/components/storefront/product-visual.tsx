import Image from "next/image";
import { cn } from "@/lib/utils";
import type { Product } from "@/lib/catalog";
import type { Locale } from "@/lib/i18n/config";

export function ProductVisual({ product, locale, className, priority = false, imageOverride, alt }: { product: Product; locale?: Locale; className?: string; priority?: boolean; imageOverride?: string; alt?: string }) {
  const { kind, from, to } = product.visual;
  const image = imageOverride ?? product.visual.image;
  const imageIndex = image ? product.images?.indexOf(image) ?? -1 : -1;
  const storedAlt = imageIndex >= 0 ? product.imageAlts?.[imageIndex] : undefined;
  const localizedAlt = alt || (locale ? storedAlt?.[locale] : storedAlt ? `${storedAlt.ar} / ${storedAlt.en}` : undefined) || (locale ? product.name[locale] : `${product.name.ar} / ${product.name.en}`) || product.name.en || product.name.ar;
  return (
    <div className={cn("relative isolate overflow-hidden bg-[#e8e2d8]", className)} style={{ background: `radial-gradient(circle at 50% 36%, ${to}66, transparent 33%), linear-gradient(145deg, #eee9e0, #d8d0c3)` }} role="img" aria-label={localizedAlt} data-priority={priority || undefined}>
      {image?.startsWith("/") ? <Image src={image} alt="" fill priority={priority} sizes="(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 22vw" className="z-10 object-cover" /> : image ? <span aria-hidden="true" className="absolute inset-0 z-10 bg-cover bg-center" style={{ backgroundImage: `url(${JSON.stringify(image)})` }} /> : null}
      <div className={image ? "hidden" : "contents"}>
      <div className="absolute inset-x-[12%] bottom-[8%] h-[12%] rounded-[50%] bg-black/20 blur-xl" />
      {kind === "bottle" && <><div className="absolute left-1/2 top-[18%] h-[58%] w-[27%] -translate-x-1/2 rounded-[25%_25%_18%_18%] border border-white/20 shadow-2xl" style={{ background: `linear-gradient(150deg, ${to}, ${from})` }} /><div className="absolute left-1/2 top-[11%] h-[13%] w-[12%] -translate-x-1/2 rounded-t-md bg-zinc-800 shadow" /><div className="absolute left-1/2 top-[38%] h-[22%] w-[23%] -translate-x-1/2 border-y border-white/35 bg-[#eee7d8] shadow"><span className="grid h-full place-items-center text-[clamp(.5rem,1.5vw,.8rem)] font-black tracking-[.25em] text-zinc-800">JYS</span></div></>}
      {kind === "jar" && <><div className="absolute left-1/2 top-[35%] h-[38%] w-[48%] -translate-x-1/2 rounded-b-[22%] border border-white/20 shadow-2xl" style={{ background: `linear-gradient(150deg, ${to}, ${from})` }} /><div className="absolute left-1/2 top-[27%] h-[13%] w-[51%] -translate-x-1/2 rounded-md border-y border-white/20 bg-zinc-800" /><span className="absolute left-1/2 top-[49%] -translate-x-1/2 text-sm font-black tracking-[.3em] text-white">JYS</span></>}
      {kind === "clipper" && <><div className="absolute left-1/2 top-[22%] h-[57%] w-[28%] -translate-x-1/2 -rotate-6 rounded-[18%_18%_30%_30%] border border-white/25 shadow-2xl" style={{ background: `linear-gradient(120deg, ${to}, ${from})` }} /><div className="absolute left-[39%] top-[14%] h-[14%] w-[28%] -rotate-6 rounded-sm bg-gradient-to-b from-zinc-300 to-zinc-700 [clip-path:polygon(8%_0,92%_0,100%_100%,0_100%)]" /><div className="absolute left-[47%] top-[43%] size-[7%] rounded-full border-2 border-white/50 bg-black/20" /></>}
      {kind === "razor" && <><div className="absolute left-[45%] top-[22%] h-[57%] w-[10%] rotate-[28deg] rounded-full shadow-2xl" style={{ background: `linear-gradient(90deg, ${from}, ${to})` }} /><div className="absolute left-[49%] top-[15%] h-[38%] w-[8%] rotate-[-56deg] rounded-sm bg-gradient-to-r from-zinc-700 via-zinc-200 to-zinc-600 shadow-xl" /></>}
      {kind === "comb" && <div className="absolute left-1/2 top-1/2 h-[23%] w-[65%] -translate-x-1/2 -translate-y-1/2 -rotate-12 bg-zinc-800 shadow-2xl [clip-path:polygon(0_0,100%_0,100%_24%,96%_24%,96%_100%,91%_100%,91%_24%,86%_24%,86%_92%,81%_92%,81%_24%,76%_24%,76%_100%,71%_100%,71%_24%,66%_24%,66%_92%,61%_92%,61%_24%,56%_24%,56%_100%,51%_100%,51%_24%,46%_24%,46%_92%,41%_92%,41%_24%,36%_24%,36%_100%,31%_100%,31%_24%,26%_24%,26%_92%,21%_92%,21%_24%,16%_24%,16%_100%,11%_100%,11%_24%,0_24%)]" />}
      {kind === "brush" && <><div className="absolute left-1/2 top-[45%] h-[38%] w-[16%] -translate-x-1/2 rounded-b-full shadow-xl" style={{ background: `linear-gradient(90deg, ${from}, ${to})` }} /><div className="absolute left-1/2 top-[17%] h-[41%] w-[49%] -translate-x-1/2 rounded-[50%_50%_30%_30%] bg-gradient-to-r from-zinc-800 via-zinc-500 to-zinc-900 shadow-2xl" /></>}
      </div>
      <div className="absolute inset-0 bg-gradient-to-tr from-black/5 via-transparent to-white/20" />
    </div>
  );
}
