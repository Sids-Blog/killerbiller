-- This is a consolidated setup file reflecting the final database schema.

-- Create Customers table (for both customers and vendors)
CREATE TABLE customers (
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
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create Products table
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL, -- Price per unit
  lot_size INTEGER DEFAULT 1,
  lot_price NUMERIC(10, 2) DEFAULT 0.00,
  min_stock INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create Inventory table
CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(product_id)
);

-- Create Bills table
CREATE TABLE bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
CREATE TABLE bill_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID REFERENCES bills(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL,
  price NUMERIC(10, 2) NOT NULL
);

-- Create Orders table
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, fulfilled
  comments TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create Order Items table
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  lots INTEGER,
  units INTEGER
);

-- Create Inventory Transactions table (for logging stock changes)
CREATE TABLE inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  vendor_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  quantity_change INTEGER NOT NULL,
  comments TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create Expense Categories table
CREATE TABLE expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create unified Transactions table (for revenue and expenses)
CREATE TABLE transactions (
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
CREATE TABLE public.damaged_stock_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    quantity integer NOT NULL,
    unit_cost numeric NOT NULL,
    total_value numeric GENERATED ALWAYS AS ((quantity * unit_cost)) STORED,
    reason text,
    status text DEFAULT 'PENDING_ADJUSTMENT'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT damaged_stock_log_pkey PRIMARY KEY (id),
    CONSTRAINT damaged_stock_log_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE
);


-- === DATABASE FUNCTIONS ===

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
) AS $
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
$ LANGUAGE plpgsql;

-- Function to delete a bill and handle all related data
CREATE OR REPLACE FUNCTION delete_bill(p_bill_id UUID)
RETURNS VOID AS $
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
$ LANGUAGE plpgsql;

-- Create the function to decrement stock
CREATE OR REPLACE FUNCTION decrement_stock_from_damage(p_product_id uuid, p_quantity integer)
RETURNS void AS $
BEGIN
  UPDATE inventory
  SET quantity = quantity - p_quantity
  WHERE product_id = p_product_id;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;


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


-- Note: These are placeholder policies. Adapt them to your authentication setup.
CREATE POLICY "Allow all access to all users" ON customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to all users" ON products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to all users" ON inventory FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to all users" ON bills FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to all users" ON bill_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to all users" ON orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to all users" ON order_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to all users" ON inventory_transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to all users" ON expense_categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to all users" ON transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access to all users" ON public.damaged_stock_log FOR ALL USING (true) WITH CHECK (true);


-- === INDEXES for Performance ===

CREATE INDEX idx_customers_name ON customers(name);
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_bills_customer_id ON bills(customer_id);
CREATE INDEX idx_bills_status ON bills(status);
CREATE INDEX idx_bill_items_bill_id ON bill_items(bill_id);
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_vendor_id ON transactions(vendor_id);
CREATE INDEX idx_transactions_category_id ON transactions(category_id);
CREATE INDEX idx_transactions_customer_id ON transactions(customer_id);


-- === TRIGGERS ===

-- Trigger to automatically update the 'updated_at' timestamp in the inventory table
CREATE OR REPLACE FUNCTION update_inventory_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_inventory_timestamp
BEFORE UPDATE ON inventory
FOR EACH ROW
EXECUTE FUNCTION update_inventory_timestamp();