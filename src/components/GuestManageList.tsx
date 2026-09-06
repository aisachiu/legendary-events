import {
  addSpotHostAction,
  cancelAttendanceAction,
  markGroupPaidAction,
  markPaidAction,
  markRefundedAction,
  promoteFromWaitlistAction,
  removeSpotHostAction,
  setGroupTotalAction,
  updateSpotAmountAction,
} from "@/app/actions/payments";
import { StatusPills } from "@/components/Pills";
import { displayContactLine } from "@/lib/contacts";
import { formatMoney } from "@/lib/format";

export function GuestManageList({
  rows,
  variant,
  maxPerOrder,
}: {
  rows: {
    id: string;
    status: string;
    channelName?: string;
    maxPerOrder?: number;
    user: { name: string; email: string; phone: string | null };
    spots: {
      id: string;
      name: string;
      isHolder: boolean;
      status: string;
      payment: {
        id: string;
        status: string;
        amountCents: number;
        currency: string;
        evidencePath: string | null;
        evidenceNote: string | null;
        refundNote: string | null;
        refundAmountCents: number | null;
      } | null;
    }[];
  }[];
  variant: "participants" | "waitlist" | "cancelled";
  maxPerOrder: number;
}) {
  if (rows.length === 0) {
    return (
      <p className="mt-4 text-[var(--mute)]">
        {variant === "waitlist"
          ? "No one is waiting."
          : variant === "cancelled"
            ? "No cancelled participants."
            : "No active participants."}
      </p>
    );
  }

  const cancelled = variant === "cancelled";
  const waitlist = variant === "waitlist";

  return (
    <div className="mt-6 grid gap-4">
      {rows.map((row) => {
        const spots = cancelled ? row.spots : row.spots.filter((s) => s.status !== "CANCELLED");
        const total = spots.reduce((sum, s) => sum + (s.payment?.amountCents ?? 0), 0);
        const currency = spots.find((s) => s.payment)?.payment?.currency ?? "hkd";
        const unpaid = spots.filter(
          (s) => s.payment && s.payment.status !== "PAID" && s.payment.status !== "REFUNDED",
        );
        return (
          <div key={row.id} className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-serif text-xl">
                  {row.user.name}
                  {row.channelName ? (
                    <span className="ml-2 align-middle text-xs font-sans font-normal text-[var(--mute)]">
                      · {row.channelName}
                    </span>
                  ) : null}
                </p>
                <p className="text-sm text-[var(--mute)]">{displayContactLine(row.user)}</p>
                <div className="mt-2">
                  <StatusPills registrationStatus={row.status} />
                </div>
              </div>
              <p className="text-sm">
                {total > 0 ? formatMoney(total, currency) : "Free"} · {spots.length}{" "}
                {spots.length === 1 ? "spot" : "spots"}
              </p>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="text-[var(--mute)]">
                    <th className="py-1 pr-3 font-normal">Name</th>
                    <th className="py-1 pr-3 font-normal">Status</th>
                    <th className="py-1 pr-3 font-normal">Amount</th>
                    <th className="py-1 pr-3 font-normal">Evidence</th>
                    <th className="py-1 font-normal">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {spots.map((spot) => (
                    <tr key={spot.id} className="border-t border-[var(--line)] align-top">
                      <td className="py-2 pr-3">
                        {spot.name}
                        {spot.isHolder ? " · booker" : ""}
                      </td>
                      <td className="py-2 pr-3">
                        <StatusPills
                          registrationStatus={spot.status}
                          paymentStatus={spot.payment?.status}
                        />
                      </td>
                      <td className="py-2 pr-3">
                        {spot.payment &&
                        spot.payment.status !== "PAID" &&
                        spot.payment.status !== "REFUNDED" ? (
                          <form action={updateSpotAmountAction} className="flex items-center gap-2">
                            <input type="hidden" name="paymentId" value={spot.payment.id} />
                            <input
                              className="field w-24"
                              name="amount"
                              type="number"
                              step="0.01"
                              min="0"
                              defaultValue={(spot.payment.amountCents / 100).toFixed(2)}
                            />
                            <button className="btn-line text-xs" type="submit">
                              Set
                            </button>
                          </form>
                        ) : spot.payment ? (
                          formatMoney(spot.payment.amountCents, spot.payment.currency)
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        {spot.payment?.evidencePath ? (
                          <a
                            className="underline"
                            href={`/api/receipts/${spot.payment.id}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Receipt
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-2">
                        {spot.payment &&
                        spot.payment.status !== "PAID" &&
                        spot.payment.status !== "REFUNDED" ? (
                          <div className="flex flex-wrap gap-2">
                            <form action={markPaidAction}>
                              <input type="hidden" name="paymentId" value={spot.payment.id} />
                              <input type="hidden" name="decision" value="paid" />
                              <button className="btn-gold" type="submit">
                                Mark paid
                              </button>
                            </form>
                            {spot.payment.status === "AWAITING_REVIEW" ||
                            spot.payment.status === "REJECTED" ? (
                              <form action={markPaidAction}>
                                <input type="hidden" name="paymentId" value={spot.payment.id} />
                                <input type="hidden" name="decision" value="reject" />
                                <button className="btn-line" type="submit">
                                  Reject
                                </button>
                              </form>
                            ) : null}
                          </div>
                        ) : null}
                        {spot.payment?.status === "PAID" ? (
                          <form action={markRefundedAction} className="flex flex-wrap gap-2">
                            <input type="hidden" name="paymentId" value={spot.payment.id} />
                            <input
                              className="field w-24"
                              name="refundAmount"
                              type="number"
                              step="0.01"
                              defaultValue={(spot.payment.amountCents / 100).toFixed(2)}
                            />
                            <button className="btn-line" type="submit">
                              Refund
                            </button>
                          </form>
                        ) : null}
                        {spot.payment?.status === "REFUNDED" ? (
                          <p className="text-xs text-[var(--mute)]">
                            Refunded{" "}
                            {formatMoney(
                              spot.payment.refundAmountCents ?? spot.payment.amountCents,
                              spot.payment.currency,
                            )}
                          </p>
                        ) : null}
                        {!cancelled && spot.payment?.status !== "PAID" && spots.length > 1 ? (
                          <form action={removeSpotHostAction} className="mt-2">
                            <input type="hidden" name="spotId" value={spot.id} />
                            <button className="text-xs text-red-800 underline" type="submit">
                              Remove
                            </button>
                          </form>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex flex-wrap items-end gap-2">
              {!cancelled && spots.length < (row.maxPerOrder ?? maxPerOrder) ? (
                <form action={addSpotHostAction} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="registrationId" value={row.id} />
                  <div>
                    <label className="label">Add person</label>
                    <input className="field w-40" name="name" required placeholder="Name" />
                  </div>
                  <button className="btn-line" type="submit">
                    Add
                  </button>
                </form>
              ) : null}
              {unpaid.length > 1 ? (
                <form action={setGroupTotalAction} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="registrationId" value={row.id} />
                  <div>
                    <label className="label">Set group total</label>
                    <input
                      className="field w-28"
                      name="groupTotal"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                    />
                  </div>
                  <button className="btn-line" type="submit">
                    Split
                  </button>
                </form>
              ) : null}
              {waitlist ? (
                <form action={promoteFromWaitlistAction}>
                  <input type="hidden" name="registrationId" value={row.id} />
                  <button className="btn-gold" type="submit">
                    Move group to participants
                  </button>
                </form>
              ) : null}
              {unpaid.length > 1 ? (
                <form action={markGroupPaidAction}>
                  <input type="hidden" name="registrationId" value={row.id} />
                  <button className="btn-gold" type="submit">
                    Mark whole group paid
                  </button>
                </form>
              ) : unpaid.length === 1 ? (
                <form action={markGroupPaidAction}>
                  <input type="hidden" name="registrationId" value={row.id} />
                  <button className="btn-gold" type="submit">
                    Mark group paid
                  </button>
                </form>
              ) : null}
              {!cancelled ? (
                <form action={cancelAttendanceAction}>
                  <input type="hidden" name="registrationId" value={row.id} />
                  <button className="text-sm text-red-800 underline" type="submit">
                    Remove booking
                  </button>
                </form>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
