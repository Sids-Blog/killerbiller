import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, Plus, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";
import html2pdf from 'html2pdf.js';
import InvoiceTemplate from '@/components/templates/InvoiceTemplate';
import { createRoot } from 'react-dom/client';
import { Customer } from "./Customers";

// Interfaces
export interface BillItem {
  product_id: string;
  product_name: string;
  master_lot_size: number;
  lots: string;
  quantity: number;
  price: number;
  lot_price: number;
}

interface Product {
  id:string;
  name: string;
  price: number;
  lot_size: number;
  lot_price: number;
  inventory: { quantity: number };
}

interface Bill {
  id: string;
  created_at: string;
  date_of_bill: string;
  total_amount: number;
  status: 'outstanding' | 'paid' | 'partial';
  is_gst_bill: boolean;
  customers: { name: string } | null;
}

export const Billing = () => {
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const orderState = location.state?.order;

  // Create Bill states
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [billItems, setBillItems] = useState<BillItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [discount, setDiscount] = useState(0);
  const [comments, setComments] = useState("");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [billDate, setBillDate] = useState<Date | undefined>(new Date());
  const [isGstBill, setIsGstBill] = useState(false);
  const [sgstPercent, setSgstPercent] = useState(14);
  const [cgstPercent, setCgstPercent] = useState(14);
  const [cessPercent, setCessPercent] = useState(12);

  // Shared states
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // All Bills states
  const [bills, setBills] = useState<Bill[]>([]);
  const [filteredBills, setFilteredBills] = useState<Bill[]>([]);
  const [customerFilter, setCustomerFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [gstFilter, setGstFilter] = useState("all");
  const [billToDelete, setBillToDelete] = useState<string | null>(null);

  const handleDeleteBill = async () => {
    if (!billToDelete) return;
    setLoading(true);

    const { error } = await supabase.rpc('delete_bill', { p_bill_id: billToDelete });

    if (error) {
      toast({ title: "Error deleting bill", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Bill deleted successfully" });
      fetchData();
    }

    setBillToDelete(null);
    setLoading(false);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    const customerPromise = supabase
      .from("customers")
      .select("*")
      .eq("is_active", true)
      .eq("type", "customer");
    const productPromise = supabase
      .from("products")
      .select("*, inventory(quantity)");
    const billsPromise = supabase
      .from("bills")
      .select("id, created_at, date_of_bill, total_amount, status, is_gst_bill, customers ( name )")
      .order("date_of_bill", { ascending: false });

    const [customerRes, productRes, billsRes] = await Promise.all([
      customerPromise,
      productPromise,
      billsPromise,
    ]);

    if (customerRes.error) toast({ title: "Error fetching customers", description: customerRes.error.message, variant: "destructive" });
    else setCustomers(customerRes.data || []);

    if (productRes.error) toast({ title: "Error fetching products", description: productRes.error.message, variant: "destructive" });
    else setProducts(productRes.data || []);

    if (billsRes.error) toast({ title: "Error fetching bills", description: billsRes.error.message, variant: "destructive" });
    else {
      const transformedData = (billsRes.data || []).map(bill => ({
        ...bill,
        customers: Array.isArray(bill.customers) ? bill.customers[0] || null : bill.customers,
      }));
      setBills(transformedData as unknown as Bill[]);
      setFilteredBills(transformedData as unknown as Bill[]);
    }

    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (orderState && products.length > 0 && customers.length > 0) {
      setSelectedCustomer(orderState.customer_id);
      setOrderId(orderState.id);
      const items = orderState.order_items.map((item: any) => {
        const product = products.find(p => p.id === item.product_id);
        return {
          product_id: item.product_id,
          product_name: product?.name || 'Unknown',
          master_lot_size: product?.lot_size || 0,
          lots: item.quantity / (product?.lot_size || 1) + "",
          quantity: item.quantity,
          price: product?.price || 0,
          lot_price: product?.lot_price || 0,
        };
      });
      setBillItems(items);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [orderState, products, customers, navigate, location.pathname]);

  useEffect(() => {
    let result = bills;
    if (customerFilter !== "all") result = result.filter(bill => bill.customers?.name === customers.find(c => c.id === customerFilter)?.name);
    if (statusFilter !== "all") result = result.filter(bill => bill.status === statusFilter);
    if (gstFilter !== "all") result = result.filter(bill => gstFilter === 'gst' ? bill.is_gst_bill : !bill.is_gst_bill);
    setFilteredBills(result);
  }, [customerFilter, statusFilter, gstFilter, bills, customers]);

  const addItem = () => {
    if (!selectedProduct) return;
    const product = products.find((p) => p.id === selectedProduct);
    if (!product) return;

    const availableStock = product.inventory?.quantity ?? 0;
    if (product.lot_size > availableStock) {
      toast({ title: "Error", description: `Not enough stock for ${product.name}. Available: ${availableStock}`, variant: "destructive" });
      return;
    }

    setBillItems([...billItems, {
        product_id: product.id,
        product_name: product.name,
        master_lot_size: product.lot_size,
        lots: "1",
        quantity: product.lot_size,
        price: product.price,
        lot_price: product.lot_price,
    }]);
    setSelectedProduct("");
  };

  const removeItem = (index: number) => {
    setBillItems(billItems.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof BillItem, value: string | number) => {
    const updatedItems = [...billItems];
    const item = { ...updatedItems[index] };

    switch (field) {
      case "lots":
        item.lots = String(value);
        item.quantity = (parseInt(String(value)) || 0) * item.master_lot_size;
        const product = products.find((p) => p.id === item.product_id);
        if (product) {
          item.price = product.price;
          item.lot_price = product.lot_price;
        }
        break;
      case "quantity":
        item.quantity = parseInt(String(value)) || 0;
        item.lots = "";
        break;
      case "price":
        item.price = parseFloat(String(value)) || 0;
        item.lot_price = item.price * item.master_lot_size;
        break;
      case "lot_price":
        item.lot_price = parseFloat(String(value)) || 0;
        if (item.master_lot_size > 0) item.price = item.lot_price / item.master_lot_size;
        break;
    }
    updatedItems[index] = item;
    setBillItems(updatedItems);
  };

  const billCalculations = useMemo(() => {
    const subtotal = billItems.reduce((sum, item) => sum + item.quantity * item.price, 0);
    let grandTotal = subtotal - discount;
    let taxDetails = {
      sgst: 0,
      cgst: 0,
      cess: 0,
      taxableValue: subtotal,
    };

    if (isGstBill) {
      const totalGstRate = (sgstPercent + cgstPercent + cessPercent) / 100;
      let totalTaxableValue = 0;
      let totalSgst = 0;
      let totalCgst = 0;
      let totalCess = 0;

      billItems.forEach(item => {
        const finalPrice = item.price * item.quantity;
        const basePrice = finalPrice / (1 + totalGstRate);
        totalTaxableValue += basePrice;
        if (totalGstRate > 0) {
          totalSgst += basePrice * (sgstPercent / 100);
          totalCgst += basePrice * (cgstPercent / 100);
          totalCess += basePrice * (cessPercent / 100);
        }
      });
      
      taxDetails = {
        sgst: totalSgst,
        cgst: totalCgst,
        cess: totalCess,
        taxableValue: totalTaxableValue,
      };
      grandTotal = totalTaxableValue + totalSgst + totalCgst + totalCess - discount;
    }
    
    return {
      subtotal,
      grandTotal,
      ...taxDetails,
    };
  }, [billItems, discount, isGstBill, sgstPercent, cgstPercent, cessPercent]);

const generatePdf = (billDetails: any, items: BillItem[], customerDetails: Customer) => {
  // Create a visible container first for debugging
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '0';
  container.style.width = '100vw';
  container.style.height = '100vh';
  container.style.backgroundColor = 'rgba(0,0,0,0.8)';
  container.style.zIndex = '9999';
  container.style.overflowY = 'auto';
  container.style.display = 'flex';
  container.style.justifyContent = 'center';
  container.style.alignItems = 'flex-start';
  container.style.padding = '20px';
  document.body.appendChild(container);

  // Create the actual content wrapper
  const wrapper = document.createElement('div');
  wrapper.style.width = '800px'; // Fixed width instead of mm units
  wrapper.style.minHeight = '1000px';
  wrapper.style.backgroundColor = 'white';
  wrapper.style.padding = '20px';
  wrapper.style.boxSizing = 'border-box';
  wrapper.style.fontFamily = 'Arial, sans-serif';
  wrapper.style.fontSize = '12px';
  wrapper.style.color = '#000';
  container.appendChild(wrapper);

  // Render the React component
  const root = createRoot(wrapper);
  root.render(
    <InvoiceTemplate 
      billDetails={billDetails} 
      items={items} 
      customerDetails={customerDetails} 
    />
  );

  // Simplified PDF options
  const opt = {
    margin: 0.5,
    filename: `tax_invoice_${billDetails.id}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { 
      scale: 2,
      useCORS: true,
      logging: true, // Enable logging for debugging
      backgroundColor: '#ffffff'
    },
    jsPDF: { 
      unit: 'in', 
      format: 'letter', 
      orientation: 'portrait' 
    }
  };

  // Add close button for debugging
  const closeButton = document.createElement('button');
  closeButton.innerHTML = 'Generate PDF';
  closeButton.style.position = 'absolute';
  closeButton.style.top = '10px';
  closeButton.style.right = '10px';
  closeButton.style.padding = '10px 20px';
  closeButton.style.backgroundColor = '#007bff';
  closeButton.style.color = 'white';
  closeButton.style.border = 'none';
  closeButton.style.borderRadius = '5px';
  closeButton.style.cursor = 'pointer';
  closeButton.style.zIndex = '10000';
  container.appendChild(closeButton);

  closeButton.onclick = () => {
    // Generate PDF when button is clicked
    console.log('Starting PDF generation...');
    html2pdf()
      .from(wrapper)
      .set(opt)
      .save()
      .then(() => {
        console.log('PDF generated successfully');
        // Cleanup
        root.unmount();
        document.body.removeChild(container);
      })
      .catch((err: any) => {
        console.error("PDF generation error:", err);
        alert('Error generating PDF: ' + err.message);
        // Cleanup
        root.unmount();
        if (document.body.contains(container)) {
          document.body.removeChild(container);
        }
      });
  };

  // Auto-generate after a delay (you can remove this if you want manual control)
  setTimeout(() => {
    console.log('Auto-generating PDF...');
    closeButton.click();
  }, 2000);
};

// Alternative function for preview (shows PDF content in modal)
  const previewInvoice = (billDetails: any, items: BillItem[], customerDetails: Customer) => {
    // Create a modal container
    const modal = document.createElement('div');
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.backgroundColor = 'rgba(0,0,0,0.8)';
    modal.style.zIndex = '10000';
    modal.style.display = 'flex';
    modal.style.justifyContent = 'center';
    modal.style.alignItems = 'center';
    modal.style.overflowY = 'auto';
    
    // Create content container
    const content = document.createElement('div');
    content.style.backgroundColor = 'white';
    content.style.maxWidth = '90%';
    content.style.maxHeight = '90%';
    content.style.overflow = 'auto';
    content.style.position = 'relative';
    content.style.borderRadius = '8px';
    content.style.boxShadow = '0 10px 30px rgba(0,0,0,0.3)';
    
    // Close button
    const closeButton = document.createElement('button');
    closeButton.innerHTML = '×';
    closeButton.style.position = 'absolute';
    closeButton.style.top = '10px';
    closeButton.style.right = '15px';
    closeButton.style.background = 'none';
    closeButton.style.border = 'none';
    closeButton.style.fontSize = '24px';
    closeButton.style.cursor = 'pointer';
    closeButton.style.zIndex = '10001';
    closeButton.style.color = '#666';
    closeButton.onclick = () => {
      root.unmount();
      document.body.removeChild(modal);
    };
    
    content.appendChild(closeButton);
    modal.appendChild(content);
    document.body.appendChild(modal);
    
    // Render the invoice
    const root = createRoot(content);
    root.render(
      <div style={{ padding: '20px' }}>
        <InvoiceTemplate 
          billDetails={billDetails} 
          items={items} 
          customerDetails={customerDetails} 
        />
      </div>
    );
    
    // Close modal when clicking outside
    modal.onclick = (e) => {
      if (e.target === modal) {
        root.unmount();
        document.body.removeChild(modal);
      }
    };
  };

  const handleDownloadPdf = async (billId: string) => {
    setLoading(true);
    const { data: billDetails, error: billError } = await supabase
      .from('bills')
      .select('*, customers(*)')
      .eq('id', billId)
      .single();

    if (billError || !billDetails) {
      toast({ title: "Error fetching bill details", description: billError?.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    const { data: billItemsData, error: itemsError } = await supabase
      .from('bill_items')
      .select('*, products(name)')
      .eq('bill_id', billId);

    if (itemsError || !billItemsData) {
      toast({ title: "Error fetching bill items", description: itemsError?.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    const customer = Array.isArray(billDetails.customers) ? billDetails.customers[0] : billDetails.customers;

    if (!customer) {
        toast({ title: "Error", description: "Customer details not found for this bill.", variant: "destructive" });
        setLoading(false);
        return;
    }

    const itemsForPdf: BillItem[] = billItemsData.map((item: any) => ({
        product_id: item.product_id,
        product_name: item.products?.name || 'Unknown Product',
        quantity: item.quantity,
        price: item.price,
        master_lot_size: 0, 
        lots: '',
        lot_price: 0,
    }));


    //generatePdf(billDetails, itemsForPdf, customer);
    previewInvoice(billDetails, itemsForPdf, customer);
    setLoading(false);
  };

  const submitBill = async () => {
    if (!selectedCustomer || billItems.length === 0) {
      toast({ title: "Error", description: "Please select a customer and add at least one item", variant: "destructive" });
      return;
    }

    const { grandTotal, sgst, cgst, cess } = billCalculations;

    const { data: bill, error: billError } = await supabase
      .from("bills")
      .insert({
        customer_id: selectedCustomer,
        total_amount: grandTotal,
        status: "outstanding",
        discount: discount,
        comments: comments,
        date_of_bill: billDate?.toISOString(),
        is_gst_bill: isGstBill,
        sgst_percentage: isGstBill ? sgstPercent : null,
        cgst_percentage: isGstBill ? cgstPercent : null,
        cess_percentage: isGstBill ? cessPercent : null,
        gst_amount: sgst + cgst + cess,
      })
      .select()
      .single();

    if (billError || !bill) {
      toast({ title: "Error creating bill", description: billError?.message, variant: "destructive" });
      return;
    }

    const itemsToInsert = billItems.map((item) => ({
      bill_id: bill.id,
      product_id: item.product_id,
      quantity: item.quantity,
      price: item.price,
    }));

    const { error: itemsError } = await supabase.from("bill_items").insert(itemsToInsert);
    if (itemsError) {
      toast({ title: "Error adding bill items", description: itemsError.message, variant: "destructive" });
      return;
    }

    for (const item of billItems) {
      const { error: stockError } = await supabase.rpc("decrement_stock", { p_product_id: item.product_id, p_quantity: item.quantity });
      if (stockError) toast({ title: "Error updating stock", description: stockError.message, variant: "destructive" });
    }

    const { error: customerError } = await supabase.rpc("update_customer_balance", { p_customer_id: selectedCustomer, p_amount: grandTotal });
    if (customerError) toast({ title: "Error updating customer balance", description: customerError.message, variant: "destructive" });

    if (orderId) {
      const { error: orderUpdateError } = await supabase.from('orders').update({ status: 'fulfilled' }).eq('id', orderId);
      if (orderUpdateError) toast({ title: "Error updating order status", description: orderUpdateError.message, variant: "destructive" });
    }

    toast({ title: "Success", description: "Bill created successfully" });
    const customerDetails = customers.find(c => c.id === selectedCustomer);
    if (customerDetails) generatePdf({ ...bill, discount, comments, grandTotal }, billItems, customerDetails);

    setSelectedCustomer("");
    setBillItems([]);
    setDiscount(0);
    setComments("");
    setOrderId(null);
    setBillDate(new Date());
    fetchData();
  };

  return (
    <AlertDialog>
      <div className="space-y-6">
        <Tabs defaultValue="create-bill">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="create-bill">Create Bill</TabsTrigger>
            <TabsTrigger value="all-bills">All Bills</TabsTrigger>
          </TabsList>
          <TabsContent value="create-bill">
            <Card>
              <CardHeader><CardTitle>Create a New Bill</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <Label htmlFor="customer">Customer</Label>
                    <Select value={selectedCustomer} onValueChange={setSelectedCustomer}><SelectTrigger><SelectValue placeholder="Select a customer" /></SelectTrigger><SelectContent>{customers.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}</SelectContent></Select>
                  </div>
                  <div>
                      <Label htmlFor="billDate">Bill Date</Label>
                      <Popover><PopoverTrigger asChild><Button variant={"outline"} className="w-full justify-start text-left font-normal">{billDate ? format(billDate, "PPP") : <span>Pick a date</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={billDate} onSelect={setBillDate} initialFocus /></PopoverContent></Popover>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Add Products</Label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Select value={selectedProduct} onValueChange={setSelectedProduct}><SelectTrigger><SelectValue placeholder="Select a product" /></SelectTrigger><SelectContent>{products.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name} (Stock: {p.inventory?.quantity ?? 0})</SelectItem>))}</SelectContent></Select>
                    <Button onClick={addItem} className="sm:w-auto w-full"><Plus className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Add</span></Button>
                  </div>
                </div>

                {/* Mobile View for Bill Items */}
                <div className="space-y-4 md:hidden">
                  {billItems.map((item, index) => (
                    <Card key={index}>
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-base font-medium">{item.product_name}</CardTitle>
                        <Button variant="ghost" size="icon" onClick={() => removeItem(index)}><Trash2 className="h-4 w-4" /></Button>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Lots</Label>
                            <Input type="number" value={item.lots} onChange={(e) => handleItemChange(index, "lots", e.target.value)} />
                          </div>
                          <div>
                            <Label>Quantity</Label>
                            <Input type="number" value={item.quantity} onChange={(e) => handleItemChange(index, "quantity", e.target.value)} />
                          </div>
                          <div>
                            <Label>Price/Unit</Label>
                            <Input type="number" value={item.price} onChange={(e) => handleItemChange(index, "price", e.target.value)} />
                          </div>
                          <div>
                            <Label>Price/Lot</Label>
                            <Input type="number" value={item.lot_price} onChange={(e) => handleItemChange(index, "lot_price", e.target.value)} />
                          </div>
                        </div>
                        <div className="text-right font-medium">
                          Total: ₹{(item.quantity * item.price).toFixed(2)}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Desktop View for Bill Items */}
                <Card className="hidden md:block">
                  <CardContent className="p-0">
                      <div className="overflow-x-auto">
                          <Table>
                              <TableHeader>
                                  <TableRow>
                                      <TableHead className="min-w-[150px]">Product</TableHead>
                                      <TableHead>Lots</TableHead>
                                      <TableHead>Quantity</TableHead>
                                      <TableHead>Price/Unit</TableHead>
                                      <TableHead>Price/Lot</TableHead>
                                      <TableHead>Total</TableHead>
                                      <TableHead></TableHead>
                                  </TableRow>
                              </TableHeader>
                              <TableBody>
                                  {billItems.map((item, index) => (
                                  <TableRow key={index}>
                                      <TableCell>{item.product_name}</TableCell>
                                      <TableCell><Input type="number" value={item.lots} onChange={(e) => handleItemChange(index, "lots", e.target.value)} className="min-w-[5rem]" /></TableCell>
                                      <TableCell><Input type="number" value={item.quantity} onChange={(e) => handleItemChange(index, "quantity", e.target.value)} className="min-w-[5rem]" /></TableCell>
                                      <TableCell><Input type="number" value={item.price} onChange={(e) => handleItemChange(index, "price", e.target.value)} className="min-w-[5rem]" /></TableCell>
                                      <TableCell><Input type="number" value={item.lot_price} onChange={(e) => handleItemChange(index, "lot_price", e.target.value)} className="min-w-[5rem]" /></TableCell>
                                      <TableCell>₹{(item.quantity * item.price).toFixed(2)}</TableCell>
                                      <TableCell><Button variant="ghost" size="icon" onClick={() => removeItem(index)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                                  </TableRow>
                                  ))}
                              </TableBody>
                          </Table>
                      </div>
                  </CardContent>
                </Card>

                <div className="flex items-center space-x-2">
                  <Checkbox id="include-gst" checked={isGstBill} onCheckedChange={(checked) => setIsGstBill(Boolean(checked))} />
                  <Label htmlFor="include-gst" className="font-medium">Include GST</Label>
                </div>

                {isGstBill && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-lg">
                    <div>
                      <Label htmlFor="sgst">SGST (%)</Label>
                      <Input id="sgst" type="number" value={sgstPercent} onChange={(e) => setSgstPercent(Number(e.target.value))} />
                    </div>
                    <div>
                      <Label htmlFor="cgst">CGST (%)</Label>
                      <Input id="cgst" type="number" value={cgstPercent} onChange={(e) => setCgstPercent(Number(e.target.value))} />
                    </div>
                    <div>
                      <Label htmlFor="cess">CESS (%)</Label>
                      <Input id="cess" type="number" value={cessPercent} onChange={(e) => setCessPercent(Number(e.target.value))} />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="discount">Discount (₹)</Label>
                    <Input id="discount" type="number" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} />
                  </div>
                  <div className="text-right space-y-1">
                    <p>Subtotal: ₹{billCalculations.taxableValue.toFixed(2)}</p>
                    {isGstBill && (
                      <>
                        <p>SGST ({sgstPercent}%): ₹{billCalculations.sgst.toFixed(2)}</p>
                        <p>CGST ({cgstPercent}%): ₹{billCalculations.cgst.toFixed(2)}</p>
                        {cessPercent > 0 && <p>CESS ({cessPercent}%): ₹{billCalculations.cess.toFixed(2)}</p>}
                      </>
                    )}
                    <p>Discount: - ₹{discount.toFixed(2)}</p>
                    <p className="font-bold text-lg">Grand Total: ₹{billCalculations.grandTotal.toFixed(2)}</p>
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="comments">Comments</Label>
                  <Textarea id="comments" value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Add any comments for the bill..." />
                </div>

                <Button onClick={submitBill} disabled={loading} className="w-full sm:w-auto">Create Bill & Download PDF</Button>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="all-bills">
            <Card>
              <CardHeader><CardTitle>All Bills</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-2">
                    <Select value={customerFilter} onValueChange={setCustomerFilter}><SelectTrigger><SelectValue placeholder="Filter by customer" /></SelectTrigger><SelectContent><SelectItem value="all">All Customers</SelectItem>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
                    <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger><SelectValue placeholder="Filter by status" /></SelectTrigger><SelectContent><SelectItem value="all">All Statuses</SelectItem><SelectItem value="outstanding">Outstanding</SelectItem><SelectItem value="paid">Paid</SelectItem><SelectItem value="partial">Partial</SelectItem></SelectContent></Select>
                    <Select value={gstFilter} onValueChange={setGstFilter}><SelectTrigger><SelectValue placeholder="Filter by GST" /></SelectTrigger><SelectContent><SelectItem value="all">All Bills</SelectItem><SelectItem value="gst">GST</SelectItem><SelectItem value="non-gst">Non-GST</SelectItem></SelectContent></Select>
                </div>
                
                {/* Mobile View for All Bills */}
                <div className="space-y-4 md:hidden">
                  {filteredBills.map((bill) => (
                    <Card key={bill.id}>
                      <CardHeader>
                        <CardTitle className="text-base font-medium">Bill #{bill.id.slice(0, 6)}...</CardTitle>
                        <p className="text-sm text-muted-foreground">{bill.customers?.name || 'N/A'}</p>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span>Date:</span>
                          <span>{new Date(bill.date_of_bill).toLocaleDateString()}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Amount:</span>
                          <span className="font-bold">₹{bill.total_amount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>GST Bill:</span>
                          <span>{bill.is_gst_bill ? "Yes" : "No"}</span>
                        </div>
                        <div className="flex items-center justify-between pt-2">
                          <Badge variant={bill.status === "paid" ? "default" : bill.status === "outstanding" ? "destructive" : "secondary"}>{bill.status}</Badge>
                          <div className="flex space-x-2">
                            <Button variant="outline" size="sm" onClick={() => handleDownloadPdf(bill.id)}><Download className="mr-2 h-4 w-4" />PDF</Button>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="sm" onClick={() => setBillToDelete(bill.id)}><Trash2 className="mr-2 h-4 w-4" />Delete</Button>
                            </AlertDialogTrigger>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Desktop View for All Bills */}
                <div className="overflow-x-auto hidden md:block">
                  <Table>
                      <TableHeader>
                          <TableRow>
                              <TableHead>Bill ID</TableHead>
                              <TableHead>Customer</TableHead>
                              <TableHead>Date</TableHead>
                              <TableHead>Amount</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>GST Bill</TableHead>
                              <TableHead>Actions</TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                          {filteredBills.map((bill) => (
                          <TableRow key={bill.id}>
                              <TableCell>#{bill.id.slice(0, 6)}...</TableCell>
                              <TableCell>{bill.customers?.name || 'N/A'}</TableCell>
                              <TableCell>{new Date(bill.date_of_bill).toLocaleDateString()}</TableCell>
                              <TableCell>₹{bill.total_amount.toFixed(2)}</TableCell>
                              <TableCell><Badge variant={bill.status === "paid" ? "default" : bill.status === "outstanding" ? "destructive" : "secondary"}>{bill.status}</Badge></TableCell>
                              <TableCell>{bill.is_gst_bill ? "Yes" : "No"}</TableCell>
                              <TableCell>
                                <div className="flex space-x-2">
                                  <Button variant="outline" size="sm" onClick={() => handleDownloadPdf(bill.id)}><Download className="mr-2 h-4 w-4" />PDF</Button>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="sm" onClick={() => setBillToDelete(bill.id)}><Trash2 className="mr-2 h-4 w-4" />Delete</Button>
                                  </AlertDialogTrigger>
                                </div>
                              </TableCell>
                          </TableRow>
                          ))}
                      </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the bill, revert the stock levels, and update the customer's balance.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setBillToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteBill} disabled={loading}>
              {loading ? 'Deleting...' : 'Continue'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </div>
    </AlertDialog>
  );
};
