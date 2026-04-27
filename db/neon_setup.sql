-- Neon-compatible schema for KillerBiller
-- Removed Supabase-specific auth references and RLS policies that rely on Supabase functions

-- Drop existing structures if they exist
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.roles CASCADE;
DROP TABLE IF EXISTS public.product_vendors CASCADE;
DROP TABLE IF EXISTS public.damaged_stock_log CASCADE;
DROP TABLE IF EXISTS public.credit CASCADE;
DROP TABLE IF EXISTS public.seller_info CASCADE;
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.expense_categories CASCADE;
DROP TABLE IF EXISTS public.inventory_transactions CASCADE;
DROP TABLE IF EXISTS public.order_items CASCADE;
DROP TABLE IF EXISTS public.orders CASCADE;
DROP TABLE IF EXISTS public.bill_items CASCADE;
DROP TABLE IF EXISTS public.bills CASCADE;
DROP TABLE IF EXISTS public.inventory CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.customers CASCADE;

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create Customers table
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  primary_phone_number TEXT UNIQUE NOT NULL,
  address TEXT NOT NULL,
  gst_number TEXT,
  manager_name TEXT,
  manager_phone_number TEXT,
  comments TEXT,
  type TEXT NOT NULL DEFAULT 'customer' CHECK (type IN ('vendor', 'customer')),
  is_active BOOLEAN DEFAULT true,
  outstanding_balance NUMERIC(10, 2) DEFAULT 0.00,
  is_cooler BOOLEAN DEFAULT false,
  is_cooler_details TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create Products table
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  lot_size INTEGER DEFAULT 1,
  lot_price NUMERIC(10, 2) DEFAULT 0.00,
  min_stock INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create Inventory table
CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(product_id)
);

-- Create Bills table
CREATE TABLE IF NOT EXISTS bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT UNIQUE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  total_amount NUMERIC(10, 2) NOT NULL,
  paid_amount NUMERIC(10, 2) DEFAULT 0.00,
  status TEXT NOT NULL DEFAULT 'outstanding',
  due_date DATE DEFAULT now() + interval '30 days',
  discount NUMERIC(10, 2) DEFAULT 0.00,
  gst_amount NUMERIC(10, 2) DEFAULT 0.00,
  cgst_percentage NUMERIC(5, 2) DEFAULT 0.00,
  sgst_percentage NUMERIC(5, 2) DEFAULT 0.00,
  cess_percentage NUMERIC(5, 2) DEFAULT 0.00,
  is_gst_bill BOOLEAN DEFAULT false,
  comments TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  date_of_bill TIMESTAMPTZ DEFAULT now()
);

-- Create Bill Items table
CREATE TABLE IF NOT EXISTS bill_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID REFERENCES bills(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL,
  price NUMERIC(10, 2) NOT NULL
);

-- Create Orders table
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  comments TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create Order Items table
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  lots INTEGER,
  units INTEGER
);

-- Create Inventory Transactions table
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  vendor_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  quantity_change INTEGER NOT NULL,
  comments TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create Expense Categories table
CREATE TABLE IF NOT EXISTS expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create Transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount NUMERIC(10, 2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('revenue', 'expense')),
  description TEXT,
  bill_id UUID REFERENCES bills(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  vendor_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  category_id UUID REFERENCES expense_categories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  date_of_transaction TIMESTAMPTZ DEFAULT now()
);

-- Create damaged_stock_log table
CREATE TABLE IF NOT EXISTS damaged_stock_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    vendor_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL,
    unit_cost NUMERIC NOT NULL,
    total_value NUMERIC GENERATED ALWAYS AS ((quantity * unit_cost)) STORED,
    reason TEXT,
    status TEXT DEFAULT 'PENDING_ADJUSTMENT' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create Product Vendors table
CREATE TABLE IF NOT EXISTS product_vendors (
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, vendor_id)
);

-- Create Credit table
CREATE TABLE IF NOT EXISTS credit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  amount NUMERIC(10, 2) NOT NULL,
  date TIMESTAMPTZ DEFAULT now(),
  comments TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'redeemed')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create Seller Information table
CREATE TABLE IF NOT EXISTS seller_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  email TEXT NOT NULL,
  contact_number TEXT NOT NULL,
  address TEXT,
  gst_number TEXT,
  bank_account_number TEXT,
  account_holder_name TEXT,
  account_no TEXT,
  branch TEXT,
  ifsc_code TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enforce single row for seller_info
CREATE UNIQUE INDEX IF NOT EXISTS single_seller_info_idx ON seller_info ((true));

-- Create Roles table
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create Users table (Stand-alone version for Neon)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE,
  password_hash TEXT, -- To be used if custom auth is implemented
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create User_Roles table
CREATE TABLE IF NOT EXISTS user_roles (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

-- Insert default roles
INSERT INTO roles (name, description) VALUES
  ('admin', 'Administrator with full access'),
  ('manager', 'Manager with access to most features'),
  ('staff', 'Staff with limited access')
ON CONFLICT (name) DO NOTHING;

-- === FUNCTIONS (Ported to standard Postgres) ===

-- Function to decrement stock
CREATE OR REPLACE FUNCTION decrement_stock(p_product_id UUID, p_quantity INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE inventory
  SET quantity = quantity - p_quantity
  WHERE product_id = p_product_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update customer balance
CREATE OR REPLACE FUNCTION update_customer_balance(p_customer_id UUID, p_amount NUMERIC)
RETURNS VOID AS $$
BEGIN
  UPDATE customers
  SET outstanding_balance = outstanding_balance + p_amount
  WHERE id = p_customer_id;
END;
$$ LANGUAGE plpgsql;

-- Function to increment stock
CREATE OR REPLACE FUNCTION increment_stock(p_product_id UUID, p_quantity INTEGER, p_vendor_id UUID, p_comments TEXT)
RETURNS VOID AS $$
BEGIN
  INSERT INTO inventory_transactions (product_id, quantity_change, vendor_id, comments)
  VALUES (p_product_id, p_quantity, p_vendor_id, p_comments);

  UPDATE inventory
  SET quantity = quantity + p_quantity, updated_at = now()
  WHERE product_id = p_product_id;

  IF NOT FOUND THEN
    INSERT INTO inventory (product_id, quantity)
    VALUES (p_product_id, p_quantity);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to process a payment
CREATE OR REPLACE FUNCTION process_payment(p_customer_id UUID, p_payment_amount NUMERIC, p_bill_ids UUID[], p_date_of_transaction TIMESTAMPTZ)
RETURNS VOID AS $$
DECLARE
  bill_record RECORD;
  payment_left NUMERIC := p_payment_amount;
  payable_amount NUMERIC;
BEGIN
  UPDATE customers
  SET outstanding_balance = outstanding_balance - p_payment_amount
  WHERE id = p_customer_id;

  FOR bill_record IN
    SELECT * FROM bills
    WHERE id = ANY(p_bill_ids) AND status IN ('outstanding', 'partial')
    ORDER BY due_date
  LOOP
    IF payment_left <= 0 THEN
      EXIT;
    END IF;

    payable_amount := bill_record.total_amount - bill_record.paid_amount;
    
    IF payment_left >= payable_amount THEN
      UPDATE bills
      SET paid_amount = total_amount, status = 'paid'
      WHERE id = bill_record.id;

      INSERT INTO transactions (bill_id, customer_id, amount, type, description, date_of_transaction)
      VALUES (bill_record.id, p_customer_id, payable_amount, 'revenue', 'Payment for Bill #' || bill_record.invoice_number, p_date_of_transaction);

      payment_left := payment_left - payable_amount;
    ELSE
      UPDATE bills
      SET paid_amount = paid_amount + payment_left, status = 'partial'
      WHERE id = bill_record.id;

      INSERT INTO transactions (bill_id, customer_id, amount, type, description, date_of_transaction)
      VALUES (bill_record.id, p_customer_id, payment_left, 'revenue', 'Partial payment for Bill #' || bill_record.invoice_number, p_date_of_transaction);

      payment_left := 0;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to record an expense
CREATE OR REPLACE FUNCTION record_expense(p_amount NUMERIC, p_vendor_id UUID, p_category_id UUID, p_comments TEXT, p_date_of_transaction TIMESTAMPTZ)
RETURNS VOID AS $$
BEGIN
  INSERT INTO transactions (amount, vendor_id, category_id, description, type, date_of_transaction)
  VALUES (p_amount, p_vendor_id, p_category_id, p_comments, 'expense', p_date_of_transaction);
END;
$$ LANGUAGE plpgsql;

-- Function to get main dashboard stats
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS TABLE(total_products BIGINT, low_stock_items BIGINT, outstanding_bills BIGINT, total_receivables NUMERIC, monthly_revenue NUMERIC) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT count(*) FROM products) as total_products,
    (SELECT count(*) FROM inventory i JOIN products p ON i.product_id = p.id WHERE i.quantity <= p.min_stock) as low_stock_items,
    (SELECT count(*) FROM bills WHERE status IN ('outstanding', 'partial')) as outstanding_bills,
    (SELECT COALESCE(sum(total_amount - paid_amount), 0) FROM bills WHERE status IN ('outstanding', 'partial')) as total_receivables,
    (SELECT COALESCE(sum(amount), 0) FROM transactions WHERE type = 'revenue' AND created_at >= date_trunc('month', now())) as monthly_revenue;
END;
$$ LANGUAGE plpgsql;

-- Sequence for invoice numbers
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1;

-- Function to generate next invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
  next_num INTEGER;
BEGIN
  next_num := nextval('invoice_number_seq');
  RETURN 'INV' || LPAD(next_num::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- Function to generate next order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
  next_num INTEGER;
BEGIN
  next_num := nextval('order_number_seq');
  RETURN 'ORD' || LPAD(next_num::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- Triggers for numbers
CREATE OR REPLACE FUNCTION set_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invoice_number IS NULL THEN
    NEW.invoice_number := generate_invoice_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := generate_order_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_invoice_number ON bills;
CREATE TRIGGER trigger_set_invoice_number
  BEFORE INSERT ON bills
  FOR EACH ROW
  EXECUTE FUNCTION set_invoice_number();

DROP TRIGGER IF EXISTS trigger_set_order_number ON orders;
CREATE TRIGGER trigger_set_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION set_order_number();

-- Function to upsert a product and its vendors
CREATE OR REPLACE FUNCTION upsert_product_with_vendors(
  p_id UUID,
  p_name TEXT,
  p_price NUMERIC,
  p_lot_size INTEGER,
  p_lot_price NUMERIC,
  p_min_stock INTEGER,
  p_vendor_ids UUID[]
)
RETURNS VOID AS $$
DECLARE
  v_product_id UUID;
BEGIN
  IF p_id IS NOT NULL THEN
    -- Update existing product
    UPDATE products
    SET name = p_name,
        price = p_price,
        lot_size = p_lot_size,
        lot_price = p_lot_price,
        min_stock = p_min_stock
    WHERE id = p_id;
    v_product_id := p_id;
    
    -- Delete existing vendor mappings
    DELETE FROM product_vendors WHERE product_id = v_product_id;
  ELSE
    -- Insert new product
    INSERT INTO products (name, price, lot_size, lot_price, min_stock)
    VALUES (p_name, p_price, p_lot_size, p_lot_price, p_min_stock)
    RETURNING id INTO v_product_id;
  END IF;

  -- Insert new vendor mappings
  INSERT INTO product_vendors (product_id, vendor_id)
  SELECT v_product_id, unnest(p_vendor_ids);
END;
$$ LANGUAGE plpgsql;

-- Timestamp update function
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_inventory_timestamp ON inventory;
CREATE TRIGGER trigger_update_inventory_timestamp
BEFORE UPDATE ON inventory
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trigger_update_seller_info_timestamp ON seller_info;
CREATE TRIGGER trigger_update_seller_info_timestamp
BEFORE UPDATE ON seller_info
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- Function to decrement stock from damage
CREATE OR REPLACE FUNCTION decrement_stock_from_damage(p_product_id UUID, p_quantity INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE inventory
  SET quantity = quantity - p_quantity
  WHERE product_id = p_product_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get users with roles
CREATE OR REPLACE FUNCTION get_users_with_roles()
RETURNS TABLE(id UUID, username TEXT, role_name TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.username, r.name as role_name
  FROM users u
  LEFT JOIN user_roles ur ON u.id = ur.user_id
  LEFT JOIN roles r ON ur.role_id = r.id;
END;
$$ LANGUAGE plpgsql;

-- Function to delete user
CREATE OR REPLACE FUNCTION delete_user(user_id_to_delete UUID)
RETURNS VOID AS $$
BEGIN
  DELETE FROM users WHERE id = user_id_to_delete;
END;
$$ LANGUAGE plpgsql;
