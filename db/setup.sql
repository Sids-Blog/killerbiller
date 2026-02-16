-- This is a consolidated setup file reflecting the final database schema.
-- It is designed to be idempotent, meaning it can be run multiple times without causing errors.

-- Drop existing structures if they exist to ensure a clean slate for changes
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.roles CASCADE;
DROP TABLE IF EXISTS public.product_vendors CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS get_users_with_roles();

-- Create Customers table (for both customers and vendors)
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
  price NUMERIC(10, 2) NOT NULL, -- Price per unit
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
  status TEXT NOT NULL DEFAULT 'outstanding', -- outstanding, partial, paid
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
  status TEXT NOT NULL DEFAULT 'pending', -- pending, fulfilled
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

-- Create Inventory Transactions table (for logging stock changes)
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

-- Create unified Transactions table (for revenue and expenses)
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

-- Create the damaged_stock_log table
CREATE TABLE IF NOT EXISTS public.damaged_stock_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    vendor_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
    quantity integer NOT NULL,
    unit_cost numeric NOT NULL,
    total_value numeric GENERATED ALWAYS AS ((quantity * unit_cost)) STORED,
    reason text,
    status text DEFAULT 'PENDING_ADJUSTMENT'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT damaged_stock_log_pkey PRIMARY KEY (id),
    CONSTRAINT damaged_stock_log_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE
);

-- Create Product Vendors table (mapping products to suppliers/vendors)
CREATE TABLE IF NOT EXISTS public.product_vendors (
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
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

-- Create Seller Information table (single row design)
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
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT single_seller_info CHECK (id = id) -- Enforces single row when combined with unique constraint
);

-- Add a unique constraint to ensure only one row exists
CREATE UNIQUE INDEX IF NOT EXISTS single_seller_info_idx ON seller_info ((true));

-- Create Roles table
CREATE TABLE public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create public.users table
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create User_Roles table
CREATE TABLE public.user_roles (
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

-- Insert default roles
INSERT INTO roles (name, description) VALUES
  ('admin', 'Administrator with full access'),
  ('manager', 'Manager with access to most features'),
  ('staff', 'Staff with limited access')
ON CONFLICT (name) DO NOTHING;


-- === DATABASE FUNCTIONS ===

-- Function to populate public.users on new user signup
CREATE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, username)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', new.email) -- Fallback to email
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- Function to get users with their roles
CREATE FUNCTION get_users_with_roles()
RETURNS TABLE(id UUID, username TEXT, role_name TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    pu.username,
    r.name as role_name
  FROM auth.users u
  LEFT JOIN public.users pu ON u.id = pu.id
  LEFT JOIN public.user_roles ur ON u.id = ur.user_id
  LEFT JOIN public.roles r ON ur.role_id = r.id
  ORDER BY pu.username;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to delete a user from auth schema
CREATE OR REPLACE FUNCTION delete_user(user_id_to_delete UUID)
RETURNS void AS $$
BEGIN
  DELETE FROM auth.users WHERE id = user_id_to_delete;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
  -- Add the transaction to the log
  INSERT INTO inventory_transactions (product_id, quantity_change, vendor_id, comments)
  VALUES (p_product_id, p_quantity, p_vendor_id, p_comments);

  -- Update the main inventory table
  UPDATE inventory
  SET quantity = quantity + p_quantity, updated_at = now()
  WHERE product_id = p_product_id;

  -- If the product is not in the inventory table, insert it.
  IF NOT FOUND THEN
    INSERT INTO inventory (product_id, quantity)
    VALUES (p_product_id, p_quantity);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to process a payment (collection)
CREATE OR REPLACE FUNCTION process_payment(p_customer_id UUID, p_payment_amount NUMERIC, p_bill_ids UUID[], p_date_of_transaction TIMESTAMPTZ)
RETURNS VOID AS $$
DECLARE
  bill_record RECORD;
  payment_left NUMERIC := p_payment_amount;
  payable_amount NUMERIC;
BEGIN
  -- Update customer balance
  UPDATE customers
  SET outstanding_balance = outstanding_balance - p_payment_amount
  WHERE id = p_customer_id;

  -- Loop through selected bills and apply payment
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
      -- Pay the bill in full
      UPDATE bills
      SET paid_amount = total_amount, status = 'paid'
      WHERE id = bill_record.id;

      INSERT INTO transactions (bill_id, customer_id, amount, type, description, date_of_transaction)
      VALUES (bill_record.id, p_customer_id, payable_amount, 'revenue', 'Payment for Bill #' || bill_record.id::text, p_date_of_transaction);

      payment_left := payment_left - payable_amount;
    ELSE
      -- Partially pay the bill
      UPDATE bills
      SET paid_amount = paid_amount + payment_left, status = 'partial'
      WHERE id = bill_record.id;

      INSERT INTO transactions (bill_id, customer_id, amount, type, description, date_of_transaction)
      VALUES (bill_record.id, p_customer_id, payment_left, 'revenue', 'Partial payment for Bill #' || bill_record.id::text, p_date_of_transaction);

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
    (SELECT sum(total_amount - paid_amount) FROM bills WHERE status IN ('outstanding', 'partial')) as total_receivables,
    (SELECT sum(amount) FROM transactions WHERE type = 'revenue' AND created_at >= date_trunc('month', now())) as monthly_revenue;
END;
$$ LANGUAGE plpgsql;

-- Function to get extended dashboard stats (revenue and expenses)
CREATE OR REPLACE FUNCTION get_extended_dashboard_stats()
RETURNS TABLE(
    daily_revenue NUMERIC,
    weekly_revenue NUMERIC,
    monthly_revenue NUMERIC,
    daily_expense NUMERIC,
    weekly_expense NUMERIC,
    monthly_expense NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE type = 'revenue' AND date_of_transaction >= now() - interval '1 day') as daily_revenue,
    (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE type = 'revenue' AND date_of_transaction >= now() - interval '7 days') as weekly_revenue,
    (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE type = 'revenue' AND date_of_transaction >= now() - interval '30 days') as monthly_revenue,
    (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE type = 'expense' AND date_of_transaction >= now() - interval '1 day') as daily_expense,
    (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE type = 'expense' AND date_of_transaction >= now() - interval '7 days') as weekly_expense,
    (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE type = 'expense' AND date_of_transaction >= now() - interval '30 days') as monthly_expense;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_vendors_with_credit_balances()
RETURNS TABLE(
    id UUID,
    name TEXT,
    primary_phone_number TEXT,
    address TEXT,
    gst_number TEXT,
    manager_name TEXT,
    manager_phone_number TEXT,
    comments TEXT,
    type TEXT,
    is_active BOOLEAN,
    outstanding_balance NUMERIC,
    credit_balance NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.primary_phone_number,
    c.address,
    c.gst_number,
    c.manager_name,
    c.manager_phone_number,
    c.comments,
    c.type,
    c.is_active,
    c.outstanding_balance,
    COALESCE(cr.pending_credits, 0) as credit_balance
  FROM customers c
  LEFT JOIN (
    SELECT 
      vendor_id,
      SUM(amount) as pending_credits
    FROM credit 
    WHERE status = 'pending'
    GROUP BY vendor_id
  ) cr ON c.id = cr.vendor_id
  WHERE c.type = 'vendor' AND c.is_active = true
  ORDER BY c.name;
END;
$$ LANGUAGE plpgsql;

-- Function to get comprehensive financial analytics with filtering
CREATE OR REPLACE FUNCTION get_financial_analytics(
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL,
    p_vendor_ids UUID[] DEFAULT NULL,
    p_customer_ids UUID[] DEFAULT NULL,
    p_category_ids UUID[] DEFAULT NULL
)
RETURNS TABLE(
    total_revenue NUMERIC,
    total_expenses NUMERIC,
    net_profit NUMERIC,
    profit_margin NUMERIC,
    outstanding_receivables NUMERIC,
    transaction_count BIGINT
) AS $$
DECLARE
    v_start_date TIMESTAMPTZ;
    v_end_date TIMESTAMPTZ;
BEGIN
    -- Set default date range if not provided (last 30 days)
    v_start_date := COALESCE(p_start_date, now() - interval '30 days');
    v_end_date := COALESCE(p_end_date, now());

    RETURN QUERY
    WITH filtered_transactions AS (
        SELECT 
            t.amount,
            t.type,
            t.date_of_transaction
        FROM transactions t
        WHERE 
            t.date_of_transaction >= v_start_date
            AND t.date_of_transaction <= v_end_date
            AND (p_vendor_ids IS NULL OR t.vendor_id = ANY(p_vendor_ids))
            AND (p_customer_ids IS NULL OR t.customer_id = ANY(p_customer_ids))
            AND (p_category_ids IS NULL OR t.category_id = ANY(p_category_ids))
    ),
    revenue_sum AS (
        SELECT COALESCE(SUM(amount), 0) as total
        FROM filtered_transactions
        WHERE type = 'revenue'
    ),
    expense_sum AS (
        SELECT COALESCE(SUM(amount), 0) as total
        FROM filtered_transactions
        WHERE type = 'expense'
    )
    SELECT
        r.total as total_revenue,
        e.total as total_expenses,
        (r.total - e.total) as net_profit,
        CASE 
            WHEN r.total > 0 THEN ((r.total - e.total) / r.total * 100)
            ELSE 0
        END as profit_margin,
        (SELECT COALESCE(SUM(total_amount - paid_amount), 0) 
         FROM bills 
         WHERE status IN ('outstanding', 'partial')) as outstanding_receivables,
        (SELECT COUNT(*) FROM filtered_transactions) as transaction_count
    FROM revenue_sum r, expense_sum e;
END;
$$ LANGUAGE plpgsql;


-- Function to delete a bill and handle all related data
CREATE OR REPLACE FUNCTION delete_bill(p_bill_id UUID)
RETURNS VOID AS $$
DECLARE
  bill_to_delete RECORD;
  item_to_revert RECORD;
BEGIN
  -- 1. Get the bill details before deleting
  SELECT * INTO bill_to_delete FROM bills WHERE id = p_bill_id;

  -- If bill doesn't exist, exit
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- 2. Revert customer's outstanding balance
  IF bill_to_delete.customer_id IS NOT NULL THEN
    UPDATE customers
    SET outstanding_balance = outstanding_balance - bill_to_delete.total_amount
    WHERE id = bill_to_delete.customer_id;
  END IF;

  -- 3. Revert stock for each item in the bill
  FOR item_to_revert IN
    SELECT * FROM bill_items WHERE bill_id = p_bill_id
  LOOP
    UPDATE inventory
    SET quantity = quantity + item_to_revert.quantity
    WHERE product_id = item_to_revert.product_id;
  END LOOP;

  -- 4. Delete related transactions (payments applied to this bill)
  DELETE FROM transactions WHERE bill_id = p_bill_id;

  -- 5. Delete bill items (CASCADE delete should handle this, but explicit is safer)
  DELETE FROM bill_items WHERE bill_id = p_bill_id;

  -- 6. Delete the bill itself
  DELETE FROM bills WHERE id = p_bill_id;

END;
$$ LANGUAGE plpgsql;

-- Create the function to decrement stock
CREATE OR REPLACE FUNCTION decrement_stock_from_damage(p_product_id uuid, p_quantity integer)
RETURNS void AS $$
BEGIN
  UPDATE inventory
  SET quantity = quantity - p_quantity
  WHERE product_id = p_product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create sequence for invoice numbers
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;

-- Create sequence for order numbers  
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1;

-- Function to generate next invoice number (INV000001 format)
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
  next_num INTEGER;
BEGIN
  next_num := nextval('invoice_number_seq');
  RETURN 'INV' || LPAD(next_num::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate next order number (ORD000001 format)
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
  next_num INTEGER;
BEGIN
  next_num := nextval('order_number_seq');
  RETURN 'ORD' || LPAD(next_num::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add invoice_number column to existing bills table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bills' AND column_name = 'invoice_number') THEN
    ALTER TABLE bills ADD COLUMN invoice_number TEXT UNIQUE;
    
    -- Update existing bills with formatted invoice numbers
    UPDATE bills 
    SET invoice_number = 'INV' || LPAD(ROW_NUMBER() OVER (ORDER BY created_at)::TEXT, 6, '0')
    WHERE invoice_number IS NULL;
    
    -- Set the sequence to continue from the current max
    SELECT setval('invoice_number_seq', COALESCE((SELECT MAX(CAST(SUBSTRING(invoice_number FROM 4) AS INTEGER)) FROM bills WHERE invoice_number LIKE 'INV%'), 0));
  END IF;
END $$;

-- Add order_number column to existing orders table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'order_number') THEN
    ALTER TABLE orders ADD COLUMN order_number TEXT UNIQUE;
    
    -- Update existing orders with formatted order numbers
    UPDATE orders 
    SET order_number = 'ORD' || LPAD(ROW_NUMBER() OVER (ORDER BY created_at)::TEXT, 6, '0')
    WHERE order_number IS NULL;
    
    -- Set the sequence to continue from the current max
    SELECT setval('order_number_seq', COALESCE((SELECT MAX(CAST(SUBSTRING(order_number FROM 4) AS INTEGER)) FROM orders WHERE order_number LIKE 'ORD%'), 0));
  END IF;
END $$;


-- === ROW LEVEL SECURITY (RLS) ===

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.damaged_stock_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_info ENABLE ROW LEVEL SECURITY;


-- Note: These are placeholder policies. Adapt them to your authentication setup.
DROP POLICY IF EXISTS "Allow all access to all users" ON customers;
CREATE POLICY "Allow all access to all users" ON customers FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all access to all users" ON products;
CREATE POLICY "Allow all access to all users" ON products FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all access to all users" ON inventory;
CREATE POLICY "Allow all access to all users" ON inventory FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all access to all users" ON bills;
CREATE POLICY "Allow all access to all users" ON bills FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all access to all users" ON bill_items;
CREATE POLICY "Allow all access to all users" ON bill_items FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all access to all users" ON orders;
CREATE POLICY "Allow all access to all users" ON orders FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all access to all users" ON order_items;
CREATE POLICY "Allow all access to all users" ON order_items FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all access to all users" ON inventory_transactions;
CREATE POLICY "Allow all access to all users" ON inventory_transactions FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all access to all users" ON expense_categories;
CREATE POLICY "Allow all access to all users" ON expense_categories FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all access to all users" ON transactions;
CREATE POLICY "Allow all access to all users" ON transactions FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public access to all users" ON public.damaged_stock_log;
CREATE POLICY "Allow public access to all users" ON public.damaged_stock_log FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all access to all users" ON public.product_vendors;
CREATE POLICY "Allow all access to all users" ON public.product_vendors FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all access to all users" ON roles;
CREATE POLICY "Allow all access to all users" ON roles FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all access to all users" ON user_roles;
CREATE POLICY "Allow all access to all users" ON user_roles FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all access to all users" ON public.users;
CREATE POLICY "Allow all access to all users" ON public.users FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all access to all users" ON credit;
CREATE POLICY "Allow all access to all users" ON credit FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all access to all users" ON seller_info;
CREATE POLICY "Allow all access to all users" ON seller_info FOR ALL USING (true) WITH CHECK (true);


-- === INDEXES for Performance ===

CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_bills_customer_id ON bills(customer_id);
CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(status);
CREATE INDEX IF NOT EXISTS idx_bill_items_bill_id ON bill_items(bill_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_vendor_id ON transactions(vendor_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_customer_id ON transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_seller_info_company_name ON seller_info(company_name);
CREATE INDEX IF NOT EXISTS idx_product_vendors_product_id ON public.product_vendors(product_id);
CREATE INDEX IF NOT EXISTS idx_product_vendors_vendor_id ON public.product_vendors(vendor_id);


-- === TRIGGERS ===

-- Trigger function to set invoice_number on bill insert
CREATE OR REPLACE FUNCTION set_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invoice_number IS NULL THEN
    NEW.invoice_number := generate_invoice_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to set order_number on order insert
CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := generate_order_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
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

-- Trigger to automatically update the 'updated_at' timestamp in the inventory table
CREATE OR REPLACE FUNCTION update_inventory_timestamp()
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
EXECUTE FUNCTION update_inventory_timestamp();

-- Trigger to automatically update the 'updated_at' timestamp in the seller_info table
CREATE OR REPLACE FUNCTION update_seller_info_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_seller_info_timestamp ON seller_info;
CREATE TRIGGER trigger_update_seller_info_timestamp
BEFORE UPDATE ON seller_info
FOR EACH ROW
EXECUTE FUNCTION update_seller_info_timestamp();