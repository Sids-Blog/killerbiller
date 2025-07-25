-- Create Customers table
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
  price NUMERIC(10, 2) NOT NULL, -- Price per unit, calculated from lot
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
  comments TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create Bill Items table
CREATE TABLE bill_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID REFERENCES bills(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL,
  price NUMERIC(10, 2) NOT NULL
);

-- Create Payments table
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID REFERENCES bills(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  amount NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

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

-- Function to process a payment
CREATE OR REPLACE FUNCTION process_payment(p_customer_id UUID, p_payment_amount NUMERIC, p_bill_ids UUID[])
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

      INSERT INTO payments (bill_id, customer_id, amount)
      VALUES (bill_record.id, p_customer_id, payable_amount);

      payment_left := payment_left - payable_amount;
    ELSE
      -- Partially pay the bill
      UPDATE bills
      SET paid_amount = paid_amount + payment_left, status = 'partial'
      WHERE id = bill_record.id;

      INSERT INTO payments (bill_id, customer_id, amount)
      VALUES (bill_record.id, p_customer_id, payment_left);

      payment_left := 0;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to get dashboard stats
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS TABLE(total_products BIGINT, low_stock_items BIGINT, outstanding_bills BIGINT, total_receivables NUMERIC, monthly_revenue NUMERIC, pending_payments BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT count(*) FROM products) as total_products,
    (SELECT count(*) FROM inventory i JOIN products p ON i.product_id = p.id WHERE i.quantity <= p.min_stock) as low_stock_items,
    (SELECT count(*) FROM bills WHERE status IN ('outstanding', 'partial')) as outstanding_bills,
    (SELECT sum(total_amount - paid_amount) FROM bills WHERE status IN ('outstanding', 'partial')) as total_receivables,
    (SELECT sum(amount) FROM payments WHERE created_at >= date_trunc('month', now())) as monthly_revenue,
    (SELECT count(*) FROM payments WHERE bill_id IS NULL) as pending_payments;
END;
$$ LANGUAGE plpgsql;

-- Function to get low stock products
CREATE OR REPLACE FUNCTION get_low_stock_products()
RETURNS TABLE(name TEXT, quantity INTEGER, min_stock INTEGER) AS $$
BEGIN
  RETURN QUERY
  SELECT p.name, i.quantity, p.min_stock
  FROM inventory i
  JOIN products p ON i.product_id = p.id
  WHERE i.quantity <= p.min_stock;
END;
$$ LANGUAGE plpgsql;

-- Enable Row Level Security
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Create Inventory Transactions table
CREATE TABLE inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  vendor_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  quantity_change INTEGER NOT NULL,
  comments TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Function to increment stock
CREATE OR REPLACE FUNCTION increment_stock(p_product_id UUID, p_quantity INTEGER, p_vendor_id UUID, p_comments TEXT)
RETURNS VOID AS $
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
$ LANGUAGE plpgsql;


-- Policies (assuming you have a system where users are associated with their data)
-- These are placeholder policies. You'll need to adapt them to your authentication setup.
-- For example, if you have a user_id in each table linked to auth.users().
CREATE POLICY "Allow all access to all users" ON customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to all users" ON products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to all users" ON inventory FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to all users" ON bills FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to all users" ON bill_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to all users" ON payments FOR ALL USING (true) WITH CHECK (true);
