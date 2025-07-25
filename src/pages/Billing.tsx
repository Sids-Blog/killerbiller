import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";

// Interfaces
interface BillItem {
  product_id: string;
  product_name: string;
  master_lot_size: number;
  lots: string;
  quantity: number;
  price: number;
  lot_price: number;
}

interface Customer {
  id: string;
  name: string;
  primary_phone_number: string;
  address: string;
  gst_number: string;
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

  // Shared states
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // All Bills states
  const [bills, setBills] = useState<Bill[]>([]);
  const [filteredBills, setFilteredBills] = useState<Bill[]>([]);
  const [customerFilter, setCustomerFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const customerPromise = supabase
      .from("customers")
      .select("id, name, primary_phone_number, address, gst_number")
      .eq("is_active", true)
      .eq("type", "customer");
    const productPromise = supabase
      .from("products")
      .select("*, inventory(quantity)");
    const billsPromise = supabase
      .from("bills")
      .select("id, created_at, date_of_bill, total_amount, status, customers ( name )")
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
    setFilteredBills(result);
  }, [customerFilter, statusFilter, bills, customers]);

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

  const total = useMemo(() => billItems.reduce((sum, item) => sum + item.quantity * item.price, 0), [billItems]);

  const generatePdf = (billDetails: any, items: BillItem[], customerDetails: Customer) => {
    const doc = new jsPDF();

    // Bill Header
    doc.setFontSize(20);
    doc.text("Bill/Invoice", 105, 20, { align: "center" });

    // Customer Details
    doc.setFontSize(12);
    doc.text(`Bill To: ${customerDetails.name}`, 14, 40);
    doc.text(`Address: ${customerDetails.address}`, 14, 48);
    doc.text(`Phone: ${customerDetails.primary_phone_number}`, 14, 56);
    if (customerDetails.gst_number) {
      doc.text(`GSTIN: ${customerDetails.gst_number}`, 14, 64);
    }

    // Bill Details
    doc.text(`Bill ID: #${billDetails.id.slice(0, 13)}`, 196, 40, { align: "right" });
    doc.text(`Date: ${new Date(billDetails.date_of_bill).toLocaleDateString()}`, 196, 48, { align: "right" });

    // Bill Items Table
    autoTable(doc, {
      startY: 75,
      head: [['Product', 'Quantity', 'Price/Unit', 'Total']],
      body: items.map(item => [
        item.product_name,
        item.quantity,
        `₹${item.price.toFixed(2)}`,
        `₹${(item.quantity * item.price).toFixed(2)}`
      ]),
      theme: 'striped',
      headStyles: { fillColor: [38, 38, 38] },
    });

    // Totals
    const finalY = (doc as any).lastAutoTable.finalY;
    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.price, 0);
    const discount = billDetails.discount || 0;
    const grandTotal = subtotal - discount;

    doc.setFontSize(12);
    doc.text(`Subtotal:`, 150, finalY + 10, { align: "right" });
    doc.text(`₹${subtotal.toFixed(2)}`, 196, finalY + 10, { align: "right" });
    doc.text(`Discount:`, 150, finalY + 17, { align: "right" });
    doc.text(`- ₹${discount.toFixed(2)}`, 196, finalY + 17, { align: "right" });
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`Grand Total:`, 150, finalY + 25, { align: "right" });
    doc.text(`₹${grandTotal.toFixed(2)}`, 196, finalY + 25, { align: "right" });

    // Comments
    if (billDetails.comments) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('Comments:', 14, finalY + 40);
        const splitComments = doc.splitTextToSize(billDetails.comments, 182);
        doc.text(splitComments, 14, finalY + 45);
    }

    // Footer
    doc.setFontSize(10);
    doc.text("Thank you for your business!", 105, 280, { align: "center" });


    doc.save(`bill_${billDetails.id}.pdf`);
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


    generatePdf(billDetails, itemsForPdf, customer);
    setLoading(false);
  };

  const submitBill = async () => {
    if (!selectedCustomer || billItems.length === 0) {
      toast({ title: "Error", description: "Please select a customer and add at least one item", variant: "destructive" });
      return;
    }

    const grandTotal = total - discount;

    const { data: bill, error: billError } = await supabase
      .from("bills")
      .insert({
        customer_id: selectedCustomer,
        total_amount: grandTotal,
        status: "outstanding",
        discount: discount,
        comments: comments,
        date_of_bill: billDate?.toISOString(),
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
    if (customerDetails) generatePdf({ ...bill, discount, comments }, billItems, customerDetails);

    setSelectedCustomer("");
    setBillItems([]);
    setDiscount(0);
    setComments("");
    setOrderId(null);
    setBillDate(new Date());
    fetchData();
  };

  return (
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="discount">Discount (₹)</Label>
                  <Input id="discount" type="number" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} />
                </div>
                <div className="text-right space-y-1">
                  <p>Subtotal: ₹{total.toFixed(2)}</p>
                  <p className="font-bold text-lg">Grand Total: ₹{(total - discount).toFixed(2)}</p>
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
                      <div className="flex items-center justify-between pt-2">
                        <Badge variant={bill.status === "paid" ? "default" : bill.status === "outstanding" ? "destructive" : "secondary"}>{bill.status}</Badge>
                        <Button variant="outline" size="sm" onClick={() => handleDownloadPdf(bill.id)}><Download className="mr-2 h-4 w-4" />PDF</Button>
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
                            <TableCell><Button variant="outline" size="sm" onClick={() => handleDownloadPdf(bill.id)}><Download className="mr-2 h-4 w-4" />Download PDF</Button></TableCell>
                        </TableRow>
                        ))}
                    </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
