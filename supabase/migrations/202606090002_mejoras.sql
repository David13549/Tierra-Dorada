-- =========================================================
-- Migracion 2: facturas en DB, clientes sin duplicados,
--              inventario de sacos disponibles
-- Ejecutar en: Supabase Dashboard -> SQL Editor -> Run
-- =========================================================

-- ---------------------------------------------------------
-- 1. Tabla invoices
--    Guarda el HTML de cada factura en la base de datos para
--    que las facturas sobrevivan redeploys en cualquier hosting.
-- ---------------------------------------------------------
create table if not exists public.invoices (
  id             uuid        primary key default gen_random_uuid(),
  invoice_number text        not null unique,
  order_id       uuid        references public.orders(id) on delete set null,
  customer_email text        not null,
  html_content   text        not null,
  invoice_url    text,
  created_at     timestamptz not null default now()
);

alter table public.invoices enable row level security;

create index if not exists invoices_invoice_number_idx on public.invoices (invoice_number);
create index if not exists invoices_order_id_idx       on public.invoices (order_id);
create index if not exists invoices_created_at_idx     on public.invoices (created_at desc);

-- ---------------------------------------------------------
-- 2. Clientes sin duplicados por email
--    Permite hacer UPSERT desde el servidor cuando el mismo
--    comprador realiza mas de un pedido.
-- ---------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'customers_email_unique'
       and conrelid = 'public.customers'::regclass
  ) then
    alter table public.customers
      add constraint customers_email_unique unique (email);
  end if;
end$$;

-- ---------------------------------------------------------
-- 3. Inventario: sacos disponibles por producto
--    available_sacks comienza igual a max_sacks y se reduce
--    automaticamente con cada order_item insertado.
-- ---------------------------------------------------------
alter table public.products
  add column if not exists available_sacks integer;

update public.products
  set available_sacks = max_sacks
  where available_sacks is null;

alter table public.products
  alter column available_sacks set not null,
  alter column available_sacks set default 400;

alter table public.products
  drop constraint if exists products_available_sacks_check;
alter table public.products
  add  constraint products_available_sacks_check
  check (available_sacks >= 0);

-- Trigger: descuenta stock al insertar una linea de pedido
create or replace function public.decrease_product_stock()
returns trigger language plpgsql as $$
begin
  if new.product_id is not null then
    update public.products
      set available_sacks = available_sacks - new.quantity
      where id = new.product_id
        and available_sacks >= new.quantity;
  elsif new.product_slug is not null then
    update public.products
      set available_sacks = available_sacks - new.quantity
      where slug = new.product_slug
        and available_sacks >= new.quantity;
  end if;
  return new;
end;
$$;

drop trigger if exists order_items_decrease_stock on public.order_items;
create trigger order_items_decrease_stock
  after insert on public.order_items
  for each row execute function public.decrease_product_stock();
