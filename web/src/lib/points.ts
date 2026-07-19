import { createAdminClient } from "@/lib/supabase/admin";
import type { MembershipTier, Order, PointsLedgerEntry } from "@/lib/types";

// 點數規則(仿 realreal points_ledger):
//  * 1 點 = NT$1(redeem 時折抵)
//  * earn 冪等靠 points_ledger_dedupe unique index (user_id, source, source_ref_id)
//  * 無等級會員預設回饋 1%
const DEFAULT_REBATE_RATE = 1;
const POINTS_EXPIRE_DAYS = 365;

const UNIQUE_VIOLATION = "23505";

function db() {
  return createAdminClient();
}

export async function getPointsBalance(
  userId: string
): Promise<{ balance: number; expiringSoon: number }> {
  const supabase = db();

  const { data: balanceRow } = await supabase
    .from("v_user_points_balance")
    .select("balance")
    .eq("user_id", userId)
    .maybeSingle();
  const balance = (balanceRow?.balance as number | undefined) ?? 0;

  // 30 天內到期(近似值:未計入之後可能發生的 redeem,僅供前端軟提示)
  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 86400000).toISOString();
  const { data: earnRows } = await supabase
    .from("points_ledger")
    .select("id, delta")
    .eq("user_id", userId)
    .eq("source", "earn")
    .not("expires_at", "is", null)
    .gt("expires_at", now.toISOString())
    .lte("expires_at", in30Days);

  let expiringSoon = 0;
  if (earnRows && earnRows.length > 0) {
    const ids = earnRows.map((r) => r.id as string);
    const { data: expiredRefs } = await supabase
      .from("points_ledger")
      .select("source_ref_id")
      .eq("user_id", userId)
      .eq("source", "expire")
      .in("source_ref_id", ids);
    const alreadyExpired = new Set((expiredRefs ?? []).map((r) => r.source_ref_id as string));
    expiringSoon = earnRows
      .filter((r) => !alreadyExpired.has(r.id as string))
      .reduce((sum, r) => sum + (r.delta as number), 0);
  }

  return { balance, expiringSoon };
}

export async function getPointsLedger(
  userId: string,
  opts?: { limit?: number }
): Promise<PointsLedgerEntry[]> {
  const supabase = db();
  const { data } = await supabase
    .from("points_ledger")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 50);
  return (data ?? []) as PointsLedgerEntry[];
}

// 會員目前等級(已過期視為無等級,不影響 profiles.tier_slug 本身 — 到期清除交由後續排程處理)
export async function getMemberTier(userId: string): Promise<MembershipTier | null> {
  const supabase = db();
  const { data: profile } = await supabase
    .from("profiles")
    .select("tier_slug, tier_expires_at")
    .eq("id", userId)
    .maybeSingle();
  if (!profile?.tier_slug) return null;
  if (profile.tier_expires_at && new Date(profile.tier_expires_at) < new Date()) return null;

  const { data: tier } = await supabase
    .from("membership_tiers")
    .select("*")
    .eq("slug", profile.tier_slug)
    .maybeSingle();
  return (tier as MembershipTier | null) ?? null;
}

// 訂單狀態 → paid 時呼叫:依會員等級回饋率核發點數,365 天到期
export async function grantPointsForOrder(order: Order) {
  if (!order.user_id) return; // 訪客訂單無帳號可歸戶,不核發點數
  const supabase = db();

  const tier = await getMemberTier(order.user_id);
  const rebateRate = tier?.rebate_rate ?? DEFAULT_REBATE_RATE;
  const earned = Math.floor((order.total * rebateRate) / 100);
  if (earned <= 0) return;

  const expiresAt = new Date(Date.now() + POINTS_EXPIRE_DAYS * 86400000).toISOString();
  const { error } = await supabase.from("points_ledger").insert({
    user_id: order.user_id,
    delta: earned,
    source: "earn",
    source_ref_id: order.id,
    note: `訂單 ${order.order_no} 消費回饋`,
    expires_at: expiresAt,
  });

  if (error) {
    if (error.code !== UNIQUE_VIOLATION) {
      console.error("[points] grant failed:", error);
    }
    return; // 已核發過(冪等)或失敗,不覆寫 points_earned
  }

  await supabase.from("orders").update({ points_earned: earned }).eq("id", order.id);
}

// 建單時呼叫:1 點 = NT$1,server 端驗證餘額後寫入 redeem 負項
export async function redeemPointsForOrder(
  userId: string,
  orderId: string,
  points: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (points <= 0) return { ok: true };
  const supabase = db();

  const { balance } = await getPointsBalance(userId);
  if (points > balance) return { ok: false, error: "點數餘額不足" };

  const { error } = await supabase.from("points_ledger").insert({
    user_id: userId,
    delta: -points,
    source: "redeem",
    source_ref_id: orderId,
    note: "訂單折抵",
  });

  if (error) {
    if (error.code === UNIQUE_VIOLATION) return { ok: true }; // 已折抵過,冪等視為成功
    console.error("[points] redeem failed:", error);
    return { ok: false, error: "點數折抵失敗" };
  }
  return { ok: true };
}

// 訂單取消時呼叫:回沖已使用的折抵、收回已核發的消費回饋(對稱寫入,靠 dedupe 冪等)
export async function refundPointsForOrder(order: Order) {
  if (!order.user_id) return;
  const supabase = db();

  if (order.points_used > 0) {
    const { error } = await supabase.from("points_ledger").insert({
      user_id: order.user_id,
      delta: order.points_used,
      source: "refund",
      source_ref_id: order.id,
      note: `訂單 ${order.order_no} 取消,退回折抵點數`,
    });
    if (error && error.code !== UNIQUE_VIOLATION) {
      console.error("[points] refund redeem failed:", error);
    }
  }

  if (order.points_earned > 0) {
    const { data: earnRow } = await supabase
      .from("points_ledger")
      .select("id, delta")
      .eq("user_id", order.user_id)
      .eq("source", "earn")
      .eq("source_ref_id", order.id)
      .maybeSingle();
    if (earnRow) {
      // 沿用「expire」語意收回(與到期排程共用同一組冪等 key,避免日後又被排程重複沖銷)
      const { error } = await supabase.from("points_ledger").insert({
        user_id: order.user_id,
        delta: -(earnRow.delta as number),
        source: "expire",
        source_ref_id: earnRow.id,
        note: `訂單 ${order.order_no} 取消,收回消費回饋點數`,
      });
      if (error && error.code !== UNIQUE_VIOLATION) {
        console.error("[points] revoke earn failed:", error);
      }
    }
  }
}

// 管理員手動調點(可正可負)
export async function adjustPoints(
  userId: string,
  delta: number,
  note: string,
  actorId: string
) {
  if (!Number.isInteger(delta) || delta === 0) {
    throw new Error("調整點數須為非零整數");
  }
  const supabase = db();
  const { error } = await supabase.from("points_ledger").insert({
    user_id: userId,
    delta,
    source: "manual_adjust",
    note: `${note || "後台手動調整"}(操作人:${actorId})`,
  });
  if (error) throw new Error(error.message);
}

// 會員方案商品付款後呼叫:寫入 profiles.tier_slug,效期 +1 年
export async function applyMembershipPurchase(order: Order) {
  if (!order.user_id) return;
  const supabase = db();

  const { data: items } = await supabase
    .from("order_items")
    .select("tier_slug")
    .eq("order_id", order.id)
    .eq("purchase_mode", "membership")
    .not("tier_slug", "is", null);
  if (!items || items.length === 0) return;

  const slugs = [...new Set(items.map((i) => i.tier_slug as string))];
  const { data: tiers } = await supabase
    .from("membership_tiers")
    .select("slug, sort")
    .in("slug", slugs);
  if (!tiers || tiers.length === 0) return;

  // 同筆訂單理論上只會有一個會員方案商品;若有多個,取等級最高(sort 最大)者
  const best = [...tiers].sort((a, b) => (b.sort as number) - (a.sort as number))[0];
  const expiresAt = new Date(Date.now() + POINTS_EXPIRE_DAYS * 86400000).toISOString();

  await supabase
    .from("profiles")
    .update({ tier_slug: best.slug, tier_expires_at: expiresAt })
    .eq("id", order.user_id);
}
