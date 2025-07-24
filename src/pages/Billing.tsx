import { useState, useEffect, useCallback, useMemo } from "react";
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
import { Trash2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

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
  total_amount: number;
  status: 'outstanding' | 'paid' | 'partial';
  customers: { name: string }[];
}

export const Billing = () => {
  const { toast } = useToast();
  // Create Bill states
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [billItems, setBillItems] = useState<BillItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [discount, setDiscount] = useState(0);
  const [comments, setComments] = useState("");

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
      .select("id, name, primary_phone_number")
      .eq("is_active", true);
    const productPromise = supabase
      .from("products")
      .select("*, inventory(quantity)");
    const billsPromise = supabase
      .from("bills")
      .select("id, created_at, total_amount, status, customers ( name )")
      .order("created_at", { ascending: false });

    const [customerRes, productRes, billsRes] = await Promise.all([
      customerPromise,
      productPromise,
      billsPromise,
    ]);

    if (customerRes.error) {
      toast({
        title: "Error fetching customers",
        description: customerRes.error.message,
        variant: "destructive",
      });
    } else {
      setCustomers(customerRes.data || []);
    }

    if (productRes.error) {
      toast({
        title: "Error fetching products",
        description: productRes.error.message,
        variant: "destructive",
      });
    } else {
      setProducts(productRes.data || []);
    }

    if (billsRes.error) {
      toast({
        title: "Error fetching bills",
        description: billsRes.error.message,
        variant: "destructive",
      });
    } else {
      setBills(billsRes.data || []);
      setFilteredBills(billsRes.data || []);
    }

    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filtering logic
  useEffect(() => {
    let result = bills;
    if (customerFilter !== "all") {
      result = result.filter(bill => bill.customers[0]?.name === customers.find(c => c.id === customerFilter)?.name);
    }
    if (statusFilter !== "all") {
      result = result.filter(bill => bill.status === statusFilter);
    }
    setFilteredBills(result);
  }, [customerFilter, statusFilter, bills, customers]);

  const addItem = () => {
    if (!selectedProduct) return;
    const product = products.find((p) => p.id === selectedProduct);
    if (!product) return;

    const availableStock = product.inventory?.quantity ?? 0;
    if (product.lot_size > availableStock) {
      toast({
        title: "Error",
        description: `Not enough stock for ${product.name}. Available: ${availableStock}`,
        variant: "destructive",
      });
      return;
    }

    setBillItems([
      ...billItems,
      {
        product_id: product.id,
        product_name: product.name,
        master_lot_size: product.lot_size,
        lots: "1",
        quantity: product.lot_size,
        price: product.price,
        lot_price: product.lot_price,
      },
    ]);
    setSelectedProduct("");
  };

  const removeItem = (index: number) => {
    setBillItems(billItems.filter((_, i) => i !== index));
  };

  const handleItemChange = (
    index: number,
    field: keyof BillItem,
    value: string | number
  ) => {
    const updatedItems = [...billItems];
    const item = { ...updatedItems[index] };

    switch (field) {
      case "lots":
        item.lots = String(value);
        const lots = parseInt(String(value)) || 0;
        item.quantity = lots * item.master_lot_size;
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
        if (item.master_lot_size > 0) {
          item.price = item.lot_price / item.master_lot_size;
        }
        break;
    }

    updatedItems[index] = item;
    setBillItems(updatedItems);
  };

  const total = useMemo(() => billItems.reduce(
    (sum, item) => sum + item.quantity * item.price,
    0
  ), [billItems]);

  const submitBill = async () => {
    if (!selectedCustomer || billItems.length === 0) {
      toast({
        title: "Error",
        description: "Please select a customer and add at least one item",
        variant: "destructive",
      });
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
      })
      .select()
      .single();

    if (billError || !bill) {
      toast({
        title: "Error creating bill",
        description: billError?.message,
        variant: "destructive",
      });
      return;
    }

    const itemsToInsert = billItems.map((item) => ({
      bill_id: bill.id,
      product_id: item.product_id,
      quantity: item.quantity,
      price: item.price,
    }));

    const { error: itemsError } = await supabase
      .from("bill_items")
      .insert(itemsToInsert);

    if (itemsError) {
      toast({
        title: "Error adding bill items",
        description: itemsError.message,
        variant: "destructive",
      });
      return;
    }

    for (const item of billItems) {
      const { error: stockError } = await supabase.rpc("decrement_stock", {
        p_product_id: item.product_id,
        p_quantity: item.quantity,
      });
      if (stockError) {
        toast({
          title: "Error updating stock",
          description: stockError.message,
          variant: "destructive",
        });
      }
    }

    const { error: customerError } = await supabase.rpc(
      "update_customer_balance",
      {
        p_customer_id: selectedCustomer,
        p_amount: grandTotal,
      }
    );

    if (customerError) {
      toast({
        title: "Error updating customer balance",
        description: customerError.message,
        variant: "destructive",
      });
    }

    toast({ title: "Success", description: "Bill created successfully" });

    setSelectedCustomer("");
    setBillItems([]);
    setDiscount(0);
    setComments("");
    fetchData();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Billing</h1>
        <p className="text-muted-foreground">Generate and manage customer invoices</p>
      </div>

      <Tabs defaultValue="create-bill">
        <TabsList>
          <TabsTrigger value="create-bill">Create Bill</TabsTrigger>
          <TabsTrigger value="all-bills">All Bills</TabsTrigger>
        </TabsList>
        <TabsContent value="create-bill">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Bill Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="customer">Customer</Label>
                  <Select
                    value={selectedCustomer}
                    onValueChange={setSelectedCustomer}
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end gap-2">
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="product">Product</Label>
                    <Select
                      value={selectedProduct}
                      onValueChange={setSelectedProduct}
                      disabled={loading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select product to add" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name} - ₹{product.price.toFixed(2)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={addItem} size="icon">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Bill Preview</CardTitle>
              </CardHeader>
              <CardContent>
                {billItems.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No items added yet
                  </p>
                ) : (
                  <div className="space-y-4">
                    {billItems.map((item, index) => (
                      <div
                        key={index}
                        className="p-3 bg-muted rounded-lg space-y-3"
                      >
                        <div className="flex justify-between items-center">
                          <div className="flex-1">
                            <p className="font-medium">{item.product_name}</p> 
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeItem(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Lots</Label>
                            <Input
                              type="text"
                              value={item.lots}
                              onChange={(e) =>
                                handleItemChange(index, "lots", e.target.value)
                              }
                              className="h-8"
                              placeholder="N/A"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Units</Label>
                            <Input
                              type="number"
                              value={item.quantity}
                              onChange={(e) =>
                                handleItemChange(
                                  index,
                                  "quantity",
                                  e.target.value
                                )
                              }
                              className="h-8"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Lot Price (₹)</Label>
                            <Input
                              type="number"
                              value={item.lot_price}
                              onChange={(e) =>
                                handleItemChange(
                                  index,
                                  "lot_price",
                                  e.target.value
                                )
                              }
                              className="h-8"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Unit Price (₹)</Label>
                            <Input
                              type="number"
                              value={item.price}
                              onChange={(e) =>
                                handleItemChange(index, "price", e.target.value)
                              }
                              className="h-8"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end items-center">
                          <Badge variant="outline">
                            Line Total: ₹
                            {(item.price * item.quantity).toFixed(2)}
                          </Badge>
                        </div>
                      </div>
                    ))}

                    <div className="border-t pt-4 space-y-4">
                      <div className="flex justify-between items-center">
                        <span>Subtotal:</span>
                        <span>₹{total.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label htmlFor="discount" className="w-24">Discount:</Label>
                        <Input
                          id="discount"
                          type="number"
                          value={discount}
                          onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                          className="h-8"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Label htmlFor="comments" className="w-24">Comments:</Label>
                        <Textarea
                          id="comments"
                          value={comments}
                          onChange={(e) => setComments(e.target.value)}
                          className="h-8"
                        />
                      </div>
                      <div className="flex justify-between items-center text-lg font-bold">
                        <span>Grand Total:</span>
                        <span>₹{(total - discount).toFixed(2)}</span>
                      </div>
                    </div>

                    <Button
                      onClick={submitBill}
                      className="w-full"
                      disabled={
                        !selectedCustomer || billItems.length === 0 || loading
                      }
                    >
                      Create Bill
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="all-bills">
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>All Bills</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-end gap-4 mb-4">
                <Select value={customerFilter} onValueChange={setCustomerFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by customer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Customers</SelectItem>
                    {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="outstanding">Outstanding</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bill ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={5}>Loading...</TableCell></TableRow>
                  ) : (
                    filteredBills.map(bill => (
                      <TableRow key={bill.id}>
                        <TableCell className="font-mono">{bill.id.slice(0, 8)}</TableCell>
                        <TableCell>{bill.customers[0]?.name ?? "N/A"}</TableCell>
                        <TableCell>{new Date(bill.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>₹{bill.total_amount.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant={
                            bill.status === 'paid' ? 'default' :
                            bill.status === 'partial' ? 'secondary' : 'destructive'
                          }>
                            {bill.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
