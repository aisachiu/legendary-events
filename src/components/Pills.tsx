import { paymentLabel, registrationLabel } from "@/lib/format";

export function Pill({
  children,
  tone = "gold",
}: {
  children: React.ReactNode;
  tone?: "gold" | "mute" | "ok" | "warn";
}) {
  const map = {
    gold: "border-[var(--gold)]/40 bg-[var(--gold-soft)] text-[var(--gold-ink)]",
    mute: "border-[var(--line)] bg-white text-[var(--mute)]",
    ok: "border-emerald-700/20 bg-emerald-50 text-emerald-900",
    warn: "border-amber-700/20 bg-amber-50 text-amber-950",
  };
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs tracking-wide ${map[tone]}`}
    >
      {children}
    </span>
  );
}

export function StatusPills({
  registrationStatus,
  paymentStatus,
}: {
  registrationStatus: string;
  paymentStatus?: string | null;
}) {
  const regTone =
    registrationStatus === "CONFIRMED"
      ? "ok"
      : registrationStatus === "PENDING_PAYMENT"
        ? "warn"
        : "mute";
  return (
    <span className="flex flex-wrap gap-1.5">
      <Pill tone={regTone}>{registrationLabel[registrationStatus] ?? registrationStatus}</Pill>
      {paymentStatus ? (
        <Pill tone={paymentStatus === "PAID" ? "ok" : "gold"}>
          {paymentLabel[paymentStatus] ?? paymentStatus}
        </Pill>
      ) : null}
    </span>
  );
}
