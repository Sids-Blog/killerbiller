-- Safe Migration Script - This will NOT delete existing data
-- Only adds new functionality for auto-numbering

-- Create sequence for invoice numbers if it doesn't exist
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;

-- Create sequence for order numbers if it doesn't exist
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1;

-- Function to generate next invoice number (NAEBILL000001 format)
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
  next_num INTEGER;
BEGIN
  next_num := nextval('invoice_number_seq');
  RETURN 'NAEBILL' || LPAD(next_num::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate next order number (NAEORD000001 format)
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
  next_num INTEGER;
BEGIN
  next_num := nextval('order_number_seq');
  RETURN 'NAEORD' || LPAD(next_num::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add invoice_number column to existing bills table if it doesn't exist
DO $$ 
DECLARE
  bill_counter INTEGER := 1;
  bill_record RECORD;
  max_existing_num INTEGER := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bills' AND column_name = 'invoice_number') THEN
    ALTER TABLE bills ADD COLUMN invoice_number TEXT UNIQUE;
  END IF;
  
  -- Find the highest existing NAEBILL number to avoid conflicts
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 8) AS INTEGER)), 0) 
  INTO max_existing_num 
  FROM bills 
  WHERE invoice_number LIKE 'NAEBILL%';
  
  -- Start counter from the next available number
  bill_counter := max_existing_num + 1;
  
  -- Update only bills that don't have a valid NAEBILL number
  FOR bill_record IN 
    SELECT id FROM bills 
    WHERE invoice_number IS NULL 
       OR invoice_number = '' 
       OR invoice_number NOT LIKE 'NAEBILL%'
    ORDER BY created_at
  LOOP
    UPDATE bills 
    SET invoice_number = 'NAEBILL' || LPAD(bill_counter::TEXT, 6, '0')
    WHERE id = bill_record.id;
    bill_counter := bill_counter + 1;
  END LOOP;
  
  -- Set the sequence to continue from the current max
  PERFORM setval('invoice_number_seq', GREATEST(1, bill_counter - 1));
END $$;

-- Add order_number column to existing orders table if it doesn't exist
DO $$ 
DECLARE
  order_counter INTEGER := 1;
  order_record RECORD;
  max_existing_num INTEGER := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'order_number') THEN
    ALTER TABLE orders ADD COLUMN order_number TEXT UNIQUE;
  END IF;
  
  -- Find the highest existing NAEORD number to avoid conflicts
  SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM 8) AS INTEGER)), 0) 
  INTO max_existing_num 
  FROM orders 
  WHERE order_number LIKE 'NAEORD%';
  
  -- Start counter from the next available number
  order_counter := max_existing_num + 1;
  
  -- Update only orders that don't have a valid NAEORD number
  FOR order_record IN 
    SELECT id FROM orders 
    WHERE order_number IS NULL 
       OR order_number = '' 
       OR order_number NOT LIKE 'NAEORD%'
    ORDER BY created_at
  LOOP
    UPDATE orders 
    SET order_number = 'NAEORD' || LPAD(order_counter::TEXT, 6, '0')
    WHERE id = order_record.id;
    order_counter := order_counter + 1;
  END LOOP;
  
  -- Set the sequence to continue from the current max
  PERFORM setval('order_number_seq', GREATEST(1, order_counter - 1));
END $$;

-- Migration: Update existing bills and orders to use new format if they still have old format
-- This handles cases where records might have been created with the old INV/ORD format
DO $$ 
DECLARE
  bill_counter INTEGER := 1;
  order_counter INTEGER := 1;
  bill_record RECORD;
  order_record RECORD;
  max_bill_num INTEGER := 0;
  max_order_num INTEGER := 0;
BEGIN
  -- Find the highest existing numbers to avoid conflicts
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 8) AS INTEGER)), 0) 
  INTO max_bill_num 
  FROM bills 
  WHERE invoice_number LIKE 'NAEBILL%';
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM 8) AS INTEGER)), 0) 
  INTO max_order_num 
  FROM orders 
  WHERE order_number LIKE 'NAEORD%';
  
  -- Start counters from the next available numbers
  bill_counter := max_bill_num + 1;
  order_counter := max_order_num + 1;
  
  -- Update existing bills that still use old INV format
  FOR bill_record IN 
    SELECT id FROM bills WHERE invoice_number LIKE 'INV%' ORDER BY created_at
  LOOP
    UPDATE bills 
    SET invoice_number = 'NAEBILL' || LPAD(bill_counter::TEXT, 6, '0')
    WHERE id = bill_record.id;
    bill_counter := bill_counter + 1;
  END LOOP;
  
  -- Update existing orders that still use old ORD format  
  FOR order_record IN 
    SELECT id FROM orders WHERE order_number LIKE 'ORD%' ORDER BY created_at
  LOOP
    UPDATE orders 
    SET order_number = 'NAEORD' || LPAD(order_counter::TEXT, 6, '0')
    WHERE id = order_record.id;
    order_counter := order_counter + 1;
  END LOOP;
  
  -- Reset sequences to continue from the current max values after migration
  PERFORM setval('invoice_number_seq', GREATEST(1, bill_counter - 1));
  PERFORM setval('order_number_seq', GREATEST(1, order_counter - 1));
END $$;

-- Create or replace trigger function to set invoice_number on bill insert
CREATE OR REPLACE FUNCTION set_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invoice_number IS NULL THEN
    NEW.invoice_number := generate_invoice_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create or replace trigger function to set order_number on order insert
CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := generate_order_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers (drop and recreate to ensure they're up to date)
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
