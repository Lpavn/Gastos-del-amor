export type Category = {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
};

export type Product = {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  photo_url: string | null;
  available: boolean;
  sort_order: number;
  created_at: string;
};

export type OrderStatus =
  | "nuevo"
  | "en_preparacion"
  | "listo"
  | "entregado"
  | "cancelado";

export type Order = {
  id: string;
  customer_name: string | null;
  table_number: string | null;
  status: OrderStatus;
  notes: string | null;
  total: number;
  created_at: string;
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  created_at: string;
};

export type CartLine = {
  product: Product;
  quantity: number;
};
