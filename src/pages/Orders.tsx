import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
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
import { Trash2, Plus, FileText, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";

// Interfaces
interface OrderItem {
  product_id: string;
  product_name: string;
  master_lot_size: number;
  lots: string;
  quantity: number;
}

interface Customer {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  lot_size: number;
  inventory: { quantity: number };
}

interface Order {
  id: string;
  created_at: string;
  status: 'pending' | 'fulfilled';
  customer_id: string;
  customers: { name: string } | null;
  order_items: { id: string, lots: number, units: number, product_id: string, products: { name: string, lot_size: number } | null }[];
  comments: string;
}

export const Orders = () => {
  const { toast } = useToast();
  // Create Order states
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [comments, setComments] = useState("");

  // Shared states
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // All Orders states
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);


  // Edit Modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editedItems, setEditedItems] = useState<{ id: string; product_name: string; master_lot_size: number; lots: string; quantity: number }[]>([]);
  const [editedComments, setEditedComments] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const customerPromise = supabase
      .from("customers")
      .select("id, name")
      .eq("is_active", true)
      .eq("type", "customer");
    const productPromise = supabase
      .from("products")
      .select("*, inventory(quantity)");
    const ordersPromise = supabase
      .from("orders")
      .select("id, created_at, status, customer_id, comments, customers ( name ), order_items(id, lots, units, product_id, products(name, lot_size))")
      .order("created_at", { ascending: false });

    const [customerRes, productRes, ordersRes] = await Promise.all([
      customerPromise,
      productPromise,
      ordersPromise,
    ]);

    if (customerRes.error) toast({ title: "Error fetching customers", description: customerRes.error.message, variant: "destructive" });
    else setCustomers(customerRes.data || []);

    if (productRes.error) toast({ title: "Error fetching products", description: productRes.error.message, variant: "destructive" });
    else setProducts(productRes.data || []);

    if (ordersRes.error) toast({ title: "Error fetching orders", description: ordersRes.error.message, variant: "destructive" });
    else {
      const transformedData = (ordersRes.data || []).map(order => ({
        ...order,
        customers: Array.isArray(order.customers) ? order.customers[0] || null : order.customers,
      }));
      setOrders(transformedData as unknown as Order[]);
      setFilteredOrders(transformedData as unknown as Order[]);
    }

    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filtering logic
  useEffect(() => {
    let result = orders;
    if (customerFilter !== "all") {
      result = result.filter(order => order.customer_id === customerFilter);
    }
    if (statusFilter !== "all") {
      result = result.filter(order => order.status === statusFilter);
    }
    if (dateFilter) {
      result = result.filter(order => new Date(order.created_at).toDateString() === dateFilter.toDateString());
    }
    setFilteredOrders(result);
  }, [customerFilter, statusFilter, dateFilter, orders]);

  const addItem = () => {
    if (!selectedProduct) return;
    const product = products.find((p) => p.id === selectedProduct);
    if (!product) return;

    setOrderItems([...orderItems, {
      product_id: product.id,
      product_name: product.name,
      master_lot_size: product.lot_size,
      lots: "1",
      quantity: product.lot_size,
    }]);
    setSelectedProduct("");
  };

  const removeItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: 'lots' | 'quantity', value: string) => {
    const updatedItems = [...orderItems];
    const item = { ...updatedItems[index] };
    
    if (field === 'lots') {
        item.lots = value;
        const lots = parseInt(value) || 0;
        item.quantity = lots * item.master_lot_size;
    } else if (field === 'quantity') {
        item.quantity = parseInt(value) || 0;
        item.lots = "";
    }

    updatedItems[index] = item;
    setOrderItems(updatedItems);
  };

  const submitOrder = async () => {
    if (!selectedCustomer || orderItems.length === 0) {
      toast({ title: "Error", description: "Please select a customer and add at least one item", variant: "destructive" });
      return;
    }

    const { data: order, error: orderError } = await supabase
      .from("orders").insert({ customer_id: selectedCustomer, status: "pending", comments: comments }).select().single();

    if (orderError || !order) {
      toast({ title: "Error creating order", description: orderError?.message, variant: "destructive" });
      return;
    }

    const itemsToInsert = orderItems.map((item) => {
        const lots = Math.floor(item.quantity / item.master_lot_size);
        const units = item.quantity % item.master_lot_size;
        return {
            order_id: order.id,
            product_id: item.product_id,
            lots: lots,
            units: units,
        }
    });
    const { error: itemsError } = await supabase.from("order_items").insert(itemsToInsert);

    if (itemsError) {
      toast({ title: "Error adding order items", description: itemsError.message, variant: "destructive" });
      return;
    }

    toast({ title: "Success", description: "Order created successfully" });
    setSelectedCustomer("");
    setOrderItems([]);
    setComments("");
    fetchData();
  };

  const calculateQuantity = (lots: number, units: number, lot_size: number) => {
    if(!lots) lots = 0;
    if(!units) units = 0;
    return (lots * lot_size) + units;
  }

  const openEditModal = (order: Order) => {
    setEditingOrder(order);
    const transformedItems = order.order_items.map(item => {
        const lot_size = item.products?.lot_size ?? 1;
        return {
            ...item,
            product_name: item.products?.name || 'N/A',
            master_lot_size: lot_size,
            quantity: calculateQuantity(item.lots, item.units, lot_size),
            lots: String(item.lots)
        }
    });
    setEditedItems(transformedItems);
    setEditedComments(order.comments || "");
    setIsEditModalOpen(true);
  };

  const handleEditItemChange = (index: number, field: 'lots' | 'quantity', value: string) => {
    const updatedItems = [...editedItems];
    const item = { ...updatedItems[index] };

    if (field === 'lots') {
        item.lots = value;
        const lots = parseInt(value) || 0;
        item.quantity = lots * item.master_lot_size;
    } else if (field === 'quantity') {
        item.quantity = parseInt(value) || 0;
        item.lots = "";
    }
    
    updatedItems[index] = item;
    setEditedItems(updatedItems);
  };

  const handleUpdateOrder = async () => {
    if (!editingOrder) return;

    const itemUpdates = editedItems.map(item => {
      const lot_size = item.master_lot_size ?? 1;
      const lots = Math.floor(item.quantity / lot_size);
      const units = item.quantity % lot_size;
      return supabase.from('order_items').update({ lots: lots, units: units }).eq('id', item.id)
    });

    const results = await Promise.all(itemUpdates);
    const itemsError = results.find(r => r.error)?.error;


    if (itemsError) {
      toast({ title: "Error updating order items", description: itemsError.message, variant: "destructive" });
      return;
    }

    const { error: orderError } = await supabase.from('orders').update({ comments: editedComments }).eq('id', editingOrder.id);

    if (orderError) {
      toast({ title: "Error updating order", description: orderError.message, variant: "destructive" });
      return;
    }

    toast({ title: "Success", description: "Order updated successfully" });
    setIsEditModalOpen(false);
    setEditingOrder(null);
    fetchData();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Orders</h1>
        <p className="text-muted-foreground">Capture and manage customer orders</p>
      </div>

      <Tabs defaultValue="create-order">
        <TabsList>
          <TabsTrigger value="create-order">Create Order</TabsTrigger>
          <TabsTrigger value="all-orders">All Orders</TabsTrigger>
        </TabsList>
        <TabsContent value="create-order">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Order Details</CardTitle>
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
                            {product.name}
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
                <CardTitle>Order Preview</CardTitle>
              </CardHeader>
              <CardContent>
                {orderItems.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No items added yet
                  </p>
                ) : (
                  <div className="space-y-4">
                    {orderItems.map((item, index) => (
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
                            <Label className="text-xs">Quantity</Label>
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
                        </div>
                      </div>
                    ))}

                    <div className="border-t pt-4 space-y-4">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="comments" className="w-24">Comments:</Label>
                        <Textarea
                          id="comments"
                          value={comments}
                          onChange={(e) => setComments(e.target.value)}
                          className="h-8"
                        />
                      </div>
                    </div>

                    <Button
                      onClick={submitOrder}
                      className="w-full"
                      disabled={
                        !selectedCustomer || orderItems.length === 0 || loading
                      }
                    >
                      Create Order
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="all-orders">
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>All Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4 mb-4">
                {/* Customer Filter with Search */}
                <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[280px] justify-start">
                      {customerFilter !== "all" ? customers.find(c => c.id === customerFilter)?.name : "Select customer..."}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[280px] p-0">
                    <Command>
                      <CommandInput placeholder="Search customer..." />
                      <CommandList>
                        <CommandEmpty>No customer found.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem value="all" onSelect={() => {setCustomerFilter("all"); setCustomerSearchOpen(false);}}>All Customers</CommandItem>
                          {customers.map((customer) => (
                            <CommandItem key={customer.id} value={customer.name} onSelect={() => {setCustomerFilter(customer.id); setCustomerSearchOpen(false);}}>
                              {customer.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>

                {/* Status Filter */}
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="fulfilled">Fulfilled</SelectItem>
                  </SelectContent>
                </Select>

                {/* Date Filter */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant={"outline"} className="w-[240px] justify-start text-left font-normal">
                      {dateFilter ? format(dateFilter, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dateFilter} onSelect={setDateFilter} initialFocus />
                  </PopoverContent>
                </Popover>

                <Button onClick={() => { setCustomerFilter("all"); setStatusFilter("all"); setDateFilter(undefined); }}>Reset Filters</Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={6}>Loading...</TableCell></TableRow>
                  ) : (
                    filteredOrders.map(order => (
                      <TableRow key={order.id}>
                        <TableCell className="font-mono">{order.id.slice(0, 8)}</TableCell>
                        <TableCell>{order.customers?.name ?? "N/A"}</TableCell>
                        <TableCell>{new Date(order.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          {order.order_items.map((item, index) => (
                            <div key={index}>
                              {item.products?.name}: {calculateQuantity(item.lots, item.units, item.products?.lot_size ?? 1)}
                            </div>
                          ))}
                        </TableCell>
                        <TableCell>
                          <Badge variant={order.status === 'fulfilled' ? 'default' : 'secondary'}>
                            {order.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="flex gap-2">
                          {order.status === 'pending' && (
                            <>
                              <Button variant="outline" size="sm" asChild>
                                <Link to="/billing" state={{ order: {...order, order_items: order.order_items.map(oi => ({...oi, quantity: calculateQuantity(oi.lots, oi.units, oi.products?.lot_size ?? 1)})) } }}>
                                  <FileText className="h-4 w-4 mr-2" />
                                  Generate Bill
                                </Link>
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => openEditModal(order)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                            </>
                          )}
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

      {/* Edit Order Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Order #{editingOrder?.id.slice(0, 8)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {editedItems.map((item, index) => (
              <div key={item.id} className="grid grid-cols-3 items-center gap-4">
                <Label className="text-right col-span-1">{item.product_name}</Label>
                <div className="col-span-2 grid grid-cols-2 gap-2">
                    <Input
                    type="text"
                    value={item.lots}
                    onChange={(e) => handleEditItemChange(index, "lots", e.target.value)}
                    placeholder="Lots"
                    />
                    <Input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => handleEditItemChange(index, "quantity", e.target.value)}
                    placeholder="Quantity"
                    />
                </div>
              </div>
            ))}
            <div className="grid grid-cols-3 items-center gap-4">
              <Label htmlFor="edit-comments" className="text-right">Comments</Label>
              <Textarea
                id="edit-comments"
                value={editedComments}
                onChange={(e) => setEditedComments(e.target.value)}
                className="col-span-2"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">Cancel</Button>
            </DialogClose>
            <Button type="button" onClick={handleUpdateOrder}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};