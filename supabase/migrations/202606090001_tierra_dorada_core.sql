create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  price_usd numeric(10,2) not null check (price_usd >= 0),
  sack_kg integer not null default 50 check (sack_kg > 0),
  max_sacks integer not null default 400 check (max_sacks > 0),
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text,
  country text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_id uuid references public.customers(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'paid', 'in_export_process', 'shipped', 'cancelled')),
  destination_country text not null,
  currency text not null,
  exchange_rate numeric(12,4) not null,
  subtotal_usd numeric(12,2) not null check (subtotal_usd >= 0),
  total_local numeric(14,2) not null check (total_local >= 0),
  total_sacks integer not null check (total_sacks >= 0),
  total_weight_kg integer not null check (total_weight_kg >= 0),
  payment_method text,
  invoice_number text,
  invoice_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_slug text,
  product_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price_usd numeric(10,2) not null check (unit_price_usd >= 0),
  total_usd numeric(12,2) not null check (total_usd >= 0),
  weight_kg integer not null check (weight_kg >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null,
  status text not null default 'simulated'
    check (status in ('simulated', 'pending', 'approved', 'failed', 'refunded')),
  amount_usd numeric(12,2) not null check (amount_usd >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  company text,
  email text not null,
  country text,
  volume text,
  topic text,
  message text not null,
  status text not null default 'new'
    check (status in ('new', 'read', 'answered', 'archived')),
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

alter table public.products enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.contact_messages enable row level security;

drop policy if exists "Public can read active products" on public.products;
create policy "Public can read active products"
on public.products for select
using (active = true);

insert into public.products (slug, name, description, price_usd, sack_kg, max_sacks, image_url, active)
values (
  'tos',
  'Cacao Tostado Premium',
  'Granos de cacao seleccionados y tostados, con aroma intenso y textura crujiente. Presentacion lista para exportacion en sacos de 50 kg.',
  190.00,
  50,
  400,
  'img/cacao-tostado.png',
  true
)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  price_usd = excluded.price_usd,
  sack_kg = excluded.sack_kg,
  max_sacks = excluded.max_sacks,
  image_url = excluded.image_url,
  active = excluded.active;

create index if not exists customers_email_idx on public.customers (email);
create index if not exists orders_customer_id_idx on public.orders (customer_id);
create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists order_items_order_id_idx on public.order_items (order_id);
create index if not exists payments_order_id_idx on public.payments (order_id);
create index if not exists contact_messages_created_at_idx on public.contact_messages (created_at desc);
