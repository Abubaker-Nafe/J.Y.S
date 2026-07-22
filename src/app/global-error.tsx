"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="grid min-h-screen place-items-center bg-[#f4f0e8] p-6 text-[#1d1b19]">
        <main className="max-w-lg rounded-3xl border border-[#d8d1c5] bg-white p-8 text-center shadow-xl">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-[#7d272d]">JYS</p>
          <h1 className="text-3xl font-semibold">Something went wrong</h1>
          <p className="mt-3 text-[#716c64]">The request could not be completed. No order was submitted twice.</p>
          <button className="mt-7 rounded-full bg-[#1d1b19] px-6 py-3 font-semibold text-white" onClick={reset}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
