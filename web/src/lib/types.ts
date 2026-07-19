export type Profile = {
  id: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  line_id: string | null;
  role: "customer" | "admin";
  created_at: string;
};

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

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  name: string;
  unit_price: number;
  quantity: number;
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
