-- Menú Digital + Pedidos — demo de portfolio
-- Corré todo este archivo una sola vez en Supabase (SQL Editor > New query > Run)

create extension if not exists "pgcrypto";

-- Categorías del menú (Entradas, Platos, Bebidas, Postres...)
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Productos / platos de la carta
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references categories(id) on delete set null,
  name text not null,
  description text,
  price numeric(10,2) not null default 0,
  photo_url text,
  available boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Pedidos hechos por clientes desde /menu
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text,
  table_number text,
  status text not null default 'nuevo'
    check (status in ('nuevo','en_preparacion','listo','entregado','cancelado')),
  notes text,
  total numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);

-- Ítems de cada pedido (guarda nombre/precio del momento, aunque el producto cambie después)
create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  product_name text not null,
  quantity integer not null default 1,
  unit_price numeric(10,2) not null default 0,
  subtotal numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_products_category on products(category_id);
create index if not exists idx_order_items_order on order_items(order_id);
create index if not exists idx_orders_created on orders(created_at desc);

-- --- Row Level Security ---
-- Nota de diseño: esta es una demo de portfolio, no un cliente real. Igual que
-- en "Gastos del Amor", la app no tiene login de verdad: el cliente pide sin
-- cuenta y el dueño entra al panel con un PIN (protección del lado del
-- navegador, no de la base). Por eso acá se habilita acceso público total con
-- la clave anónima. Para un comercio real, esto se reemplaza por policies
-- separadas: público = solo lectura de productos disponibles + creación de
-- pedidos; dueño = acceso completo autenticado con Supabase Auth.
alter table categories enable row level security;
alter table products enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;

create policy "public full access categories" on categories for all using (true) with check (true);
create policy "public full access products" on products for all using (true) with check (true);
create policy "public full access orders" on orders for all using (true) with check (true);
create policy "public full access order_items" on order_items for all using (true) with check (true);

-- --- Habilitar tiempo real (para que el panel de Pedidos se actualice solo) ---
alter publication supabase_realtime add table orders;
alter publication supabase_realtime add table order_items;

-- --- Datos de ejemplo, para que la demo se vea completa desde el primer minuto ---
with cat as (
  insert into categories (name, sort_order) values
    ('Entradas', 1),
    ('Platos principales', 2),
    ('Bebidas', 3),
    ('Postres', 4)
  returning id, name
)
insert into products (category_id, name, description, price, available, sort_order)
select c.id, p.name, p.description, p.price, true, p.sort_order
from (values
  ('Entradas', 'Empanadas de carne (x3)', 'Cortadas a cuchillo, horneadas', 4200, 1),
  ('Entradas', 'Provoleta', 'Con orégano y aceite de oliva', 5800, 2),
  ('Platos principales', 'Milanesa napolitana', 'Con papas fritas', 9500, 1),
  ('Platos principales', 'Bife de chorizo', 'A la parrilla, 350g', 13500, 2),
  ('Platos principales', 'Tarta de verdura', 'Con ensalada mixta', 7800, 3),
  ('Bebidas', 'Gaseosa línea Coca-Cola 500ml', null, 2500, 1),
  ('Bebidas', 'Agua con o sin gas', null, 1800, 2),
  ('Bebidas', 'Copa de vino de la casa', null, 3200, 3),
  ('Postres', 'Flan casero', 'Con dulce de leche y crema', 3500, 1),
  ('Postres', 'Helado (2 bochas)', null, 3200, 2)
) as p(cat_name, name, description, price, sort_order)
join cat c on c.name = p.cat_name;
