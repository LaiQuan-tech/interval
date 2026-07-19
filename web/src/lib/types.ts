export type Profile = {
  id: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  line_id: string | null;
  role: "customer" | "admin";
  tier_slug: string | null;
  tier_expires_at: string | null;
  created_at: string;
};

export type ProductType = "artwork" | "journey" | "membership";

export type Product = {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  compare_at_price: number | null;
  currency: string;
  images: { url: string; alt?: string }[];
  category: string;
  stock: number;
  status: "draft" | "active" | "archived";
  featured: boolean;
  sort_order: number;
  product_type: ProductType;
  price_rental_monthly: number | null; // 月租價(僅 artwork)
  points_price: number | null;         // 可折抵點數(journey 用)
  metadata: Record<string, unknown>;   // artwork: {tag, medium, gradient} / journey: {duration} / membership: {tier_slug}
};

export type OrderStatus =
  | "pending"
  | "paid"
  | "processing"
  | "shipped"
  | "completed"
  | "cancelled";

export type Order = {
  id: string;
  order_no: string;
  user_id: string | null;
  quote_id: string | null;
  status: OrderStatus;
  subtotal: number;
  shipping_fee: number;
  total: number;
  points_used: number;
  points_earned: number;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  shipping_address: string;
  payment_method: "bank_transfer" | "cod" | "card" | "other";
  note: string;
  public_token: string;
  paid_at: string | null;
  created_at: string;
};

export type PurchaseMode = "buyout" | "rental" | "journey" | "membership";

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  name: string;
  unit_price: number;
  quantity: number;
  purchase_mode: PurchaseMode;
  tier_slug: string | null;
};

export type QuoteLineItem = {
  name: string;
  unit_price: number;
  quantity: number;
  note?: string;
};

export type QuoteStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "accepted"
  | "declined"
  | "expired"
  | "converted";

export type Quote = {
  id: string;
  quote_no: string;
  session_id: string | null;
  user_id: string | null;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  status: QuoteStatus;
  line_items: QuoteLineItem[];
  subtotal: number;
  tax: number;
  total: number;
  valid_until: string | null;
  note: string;
  created_by: "ai" | "manual";
  public_token: string;
  order_id: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  created_at: string;
};

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type RateCardItem = {
  name: string;
  unit_price: number;
  unit?: string;
  min_quantity?: number;
  note?: string;
};

// ---------- 小時光:會員等級 / 點數 / 預約參訪 ----------
export type MembershipTier = {
  slug: string;
  name: string;
  price_yearly: number;
  rebate_rate: number; // 每消費 NT$100 累點數(%)
  perks: string[];
  sort: number;
};

export type PointsSource = "earn" | "redeem" | "expire" | "refund" | "manual_adjust" | "promo";

export type PointsLedgerEntry = {
  id: string;
  user_id: string;
  delta: number;
  source: PointsSource;
  source_ref_id: string | null;
  note: string | null;
  expires_at: string | null;
  created_at: string;
};

export type BookingStatus = "new" | "confirmed" | "done" | "cancelled";

export type Booking = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  visit_date: string | null;
  purpose: string | null;
  message: string | null;
  status: BookingStatus;
  created_at: string;
};
