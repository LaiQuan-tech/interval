import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCompanyProfile, getShippingConfig } from "@/lib/settings";
import {
  formatDate,
  formatDateTime,
  formatTWD,
  getOrderStatusLabel,
  getPaymentMethodLabel,
  getPurchaseModeLabel,
  getShippingMethodLabel,
} from "@/lib/format";
import PaymentReportForm from "@/components/PaymentReportForm";
import { getLocale, getMessages } from "@/lib/i18n/server";
import type { Order, OrderItem } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUS_CHIP: Record<string, string> = {
  pending: "bg-warn-soft text-warn",
  paid: "bg-ok-soft text-ok",
  processing: "bg-panel text-accent",
  shipped: "bg-panel text-accent",
  completed: "bg-ok-soft text-ok",
  cancelled: "bg-danger-soft text-danger",
};

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { token } = await params;
  const { created } = await searchParams;

  let order: Order | null = null;
  let items: OrderItem[] = [];
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("orders")
      .select("*")
      .eq("public_token", token)
      .maybeSingle();
    order = data as Order | null;
    if (order) {
      const { data: itemData } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", order.id)
        .order("created_at");
      items = (itemData ?? []) as OrderItem[];
    }
  } catch {
    /* env 未設定 */
  }

  if (!order) notFound();

  const [company, shippingConfig, locale] = await Promise.all([
    getCompanyProfile(),
    getShippingConfig(),
    getLocale(),
  ]);
  const messages = getMessages(locale);
  const t = messages.order;
  const deadline = new Date(order.created_at);
  deadline.setDate(deadline.getDate() + shippingConfig.deadline_days);

  const invoiceSummary = (() => {
    if (!order.invoice?.type) return null;
    if (order.invoice.type === "company") {
      return `${t.invoiceCompanyPrefix}${order.invoice.tax_id ?? "—"}${t.invoiceCompanyMid}${order.invoice.title ?? "—"}`;
    }
    return order.invoice.carrier
      ? `${t.invoiceCloudCarrierPrefix}${order.invoice.carrier}${t.invoiceCloudCarrierSuffix}`
      : t.invoiceCloudPersonal;
  })();

  return (
    <div className="lm-container max-w-135 py-10 sm:py-16">
      {created && (
        <div className="mb-6 border border-gold bg-panel p-4 text-center font-medium text-ink">
          {t.createdBannerPrefix}{order.contact_email}
        </div>
      )}

      <div className="iv-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm text-ink-soft">{t.orderNoLabel}</div>
            <h1 className="font-serif text-xl text-ink">{order.order_no}</h1>
          </div>
          <span className={`iv-chip ${STATUS_CHIP[order.status] ?? ""}`}>
            {getOrderStatusLabel(order.status, locale)}
          </span>
        </div>

        <div className="mt-5 space-y-1.5 border-t border-line pt-5 text-sm">
          <p><span className="text-ink-soft">{t.orderedAtLabel}</span>{formatDateTime(order.created_at, locale)}</p>
          <p><span className="text-ink-soft">{t.recipientLabel}</span>{order.contact_name}</p>
          {order.shipping_method !== "none" && (
            <p>
              <span className="text-ink-soft">
                {order.shipping_method === "pickup" ? t.pickupMethodLabel : t.shippingAddressLabel}
              </span>
              {order.shipping_method === "pickup"
                ? getShippingMethodLabel("pickup", locale)
                : order.shipping_address || "—"}
            </p>
          )}
          {invoiceSummary && (
            <p><span className="text-ink-soft">{t.invoiceLabel}</span>{invoiceSummary}</p>
          )}
          <p><span className="text-ink-soft">{t.paymentMethodLabel}</span>{getPaymentMethodLabel(order.payment_method, locale)}</p>
        </div>

        <div className="mt-5 border-t border-line pt-5">
          <h2 className="mb-3 font-serif text-ink">{t.itemsTitle}</h2>
          <ul className="space-y-2 text-sm">
            {items.map((i) => (
              <li key={i.id} className="flex justify-between gap-3">
                <span>
                  {i.name}
                  <span className="ml-1 text-[11px] text-accent">
                    ({getPurchaseModeLabel(i.purchase_mode, locale)})
                  </span>
                  {" "}× {i.quantity}
                </span>
                <span className="shrink-0">{formatTWD(i.unit_price * i.quantity, locale)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 space-y-1.5 border-t border-line pt-4 text-sm">
            <div className="flex justify-between">
              <span className="text-ink-soft">{t.subtotal}</span>
              <span>{formatTWD(order.subtotal, locale)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-soft">{t.shippingFee}</span>
              <span>{order.shipping_fee === 0 ? t.shippingFree : formatTWD(order.shipping_fee, locale)}</span>
            </div>
            {order.points_used > 0 && (
              <div className="flex justify-between text-accent">
                <span>{t.pointsDiscount}</span>
                <span>-{formatTWD(order.points_used, locale)}</span>
              </div>
            )}
            <div className="flex justify-between pt-1 text-base font-medium">
              <span>{t.total}</span>
              <span className="font-serif text-[18px] text-ink">{formatTWD(order.total, locale)}</span>
            </div>
          </div>
        </div>

        {order.status === "pending" &&
          order.payment_method === "bank_transfer" &&
          company.bank_info && (
            <div className="mt-5 border border-line bg-panel p-4 text-sm leading-relaxed">
              <p className="font-medium text-ink">{t.bankInfoTitle}</p>
              <p className="mt-1 whitespace-pre-wrap text-ink-soft">{company.bank_info}</p>
              <p className="mt-2 text-ink-soft">
                {t.amountDueLabel}<span className="font-semibold text-ink">{formatTWD(order.total, locale)}</span>
              </p>
              <p className="text-ink-soft">{t.paymentDeadlinePrefix}{formatDate(deadline, locale)}{t.paymentDeadlineSuffix}</p>
              <p className="mt-2 text-ink-soft">
                {t.bankInfoNote}
              </p>
              <PaymentReportForm token={token} initialReport={order.payment_report} />
            </div>
          )}
      </div>

      <p className="mt-6 text-center text-sm text-ink-soft">
        {t.footerHelpPrefix}{company.email ? `${t.footerHelpEmailPrefix}${company.email}` : ""}{t.footerHelpSuffix}
      </p>
    </div>
  );
}
