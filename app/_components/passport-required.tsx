import { ShieldAlertIcon } from "lucide-react";

export function PassportRequired() {
  return (
    <main className="grid min-h-dvh place-items-center bg-[#fafafa] px-4 text-foreground">
      <section className="w-full max-w-md border bg-background p-8">
        <ShieldAlertIcon aria-hidden="true" className="mb-6 size-8" />
        <h1 className="text-2xl font-semibold">Vercel Passport required</h1>
        <p className="mt-3 text-sm leading-6 text-gray-900">
          This deployment must be protected by Passport before chat access is available.
        </p>
      </section>
    </main>
  );
}
