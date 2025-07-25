import { useState, useEffect, useCallback } from "react";
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
import { Plus, Package, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

interface InventoryItem {
  id: string;
  name: string;
  current_stock: number;
  min_stock: number;
  price: number;
}

interface Product {
  id: string;
  name: string;
}

interface Vendor {
  id: string;
  name: string;
}

interface Transaction {
  id: string;
  created_at: string;
  quantity_change: number;
  comments: string;
  products: { name: string };
  customers: { name: string };
}

export const Inventory = () => {
  const { toast } = useToast();
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedVendor, setSelectedVendor] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [comments, setComments] = useState("");

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]); // Will now hold filtered products
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [newQuantity, setNewQuantity] = useState(0);

  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    const inventoryPromise = supabase.from("inventory").select(`
      quantity,
      products (id, name, price, min_stock)
    `);
    const vendorsPromise = supabase.from("customers").select("id, name").eq("type", "vendor").order("name", { ascending: true });
    const transactionsPromise = supabase.from("inventory_transactions").select(`
      id, created_at, quantity_change, comments,
      products (name),
      customers (name)
    `).order("created_at", { ascending: false });

    const [
      inventoryRes,
      vendorsRes,
      transactionsRes
    ] = await Promise.all([inventoryPromise, vendorsPromise, transactionsPromise]);

    if (inventoryRes.error) {
      toast({ title: "Error fetching inventory", description: inventoryRes.error.message, variant: "destructive" });
    } else {
      const formattedData = inventoryRes.data.map((item: any) => ({
        id: item.products.id,
        name: item.products.name,
        current_stock: item.quantity,
        min_stock: item.products.min_stock,
        price: item.products.price,
      }));
      setInventory(formattedData);
    }

    if (vendorsRes.error) {
      toast({ title: "Error fetching vendors", description: vendorsRes.error.message, variant: "destructive" });
    } else {
      setVendors(vendorsRes.data || []);
    }

    if (transactionsRes.error) {
      toast({ title: "Error fetching transactions", description: transactionsRes.error.message, variant: "destructive" });
    } else {
      setTransactions(transactionsRes.data as Transaction[]);
    }

    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Effect to fetch products when a vendor is selected
  useEffect(() => {
    const fetchProductsForVendor = async () => {
      if (!selectedVendor) {
        setProducts([]);
        return;
      }
      setLoadingProducts(true);
      setSelectedProduct(""); // Reset product selection

      const { data, error } = await supabase
        .from("product_vendors")
        .select("products(id, name)")
        .eq("vendor_id", selectedVendor);

      if (error) {
        toast({ title: "Error fetching products for vendor", description: error.message, variant: "destructive" });
        setProducts([]);
      } else {
        setProducts(data.map(item => item.products) as Product[]);
      }
      setLoadingProducts(false);
    };

    fetchProductsForVendor();
  }, [selectedVendor, toast]);

  const submitStock = async () => {
    if (!selectedProduct || !selectedVendor || quantity <= 0) {
      toast({
        title: "Error",
        description: "Please select a vendor, a product, and enter a valid quantity.",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase.rpc("increment_stock", {
      p_product_id: selectedProduct,
      p_quantity: quantity,
      p_vendor_id: selectedVendor,
      p_comments: comments,
    });

    if (error) {
      toast({ title: "Error updating stock", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Stock updated successfully." });
      setSelectedProduct("");
      setSelectedVendor("");
      setQuantity(1);
      setComments("");
      fetchInitialData(); // Refetch all data to update inventory and transactions
    }
  };

  const handleUpdateStock = async (productId: string) => {
    if (newQuantity < 0) {
      toast({ title: "Error", description: "Quantity cannot be negative.", variant: "destructive" });
      return;
    }

    const { error } = await supabase
      .from("inventory")
      .update({ quantity: newQuantity })
      .eq("product_id", productId);

    if (error) {
      toast({ title: "Error updating stock", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Stock updated successfully." });
      fetchInitialData();
      setEditingItemId(null);
    }
  };

  const getStockStatus = (current: number, min: number) => {
    if (current === 0) return { label: "Out of Stock", variant: "destructive" as const };
    if (current <= min) return { label: "Low Stock", variant: "destructive" as const };
    if (current <= min * 1.5) return { label: "Warning", variant: "secondary" as const };
    return { label: "In Stock", variant: "default" as const };
  };

  const lowStockCount = inventory.filter(item => item.current_stock <= item.min_stock).length;
  const outOfStockCount = inventory.filter(item => item.current_stock === 0).length;
  const totalValue = inventory.reduce((sum, item) => sum + (item.current_stock * item.price), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Inventory Management</h1>
        <p className="text-muted-foreground">Track and manage your product stock</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><div className="flex items-center gap-2"><Package className="h-5 w-5 text-primary" /><div><p className="text-sm text-muted-foreground">Total Products</p><p className="text-2xl font-bold">{inventory.length}</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-warning" /><div><p className="text-sm text-muted-foreground">Low Stock</p><p className="text-2xl font-bold text-warning">{lowStockCount}</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" /><div><p className="text-sm text-muted-foreground">Out of Stock</p><p className="text-2xl font-bold text-destructive">{outOfStockCount}</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div><p className="text-sm text-muted-foreground">Inventory Value</p><p className="text-2xl font-bold">Rs. {totalValue.toFixed(2)}</p></div></CardContent></Card>
      </div>

      <Tabs defaultValue="add-stock">
        <TabsList>
          <TabsTrigger value="add-stock">Add Stock</TabsTrigger>
          <TabsTrigger value="current-inventory">Current Inventory</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
        </TabsList>
        <TabsContent value="add-stock">
          <Card className="mt-4 lg:w-1/2">
            <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5" />Add Stock</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="vendor">Vendor</Label>
                <Select value={selectedVendor} onValueChange={setSelectedVendor}>
                  <SelectTrigger><SelectValue placeholder="Select vendor first" /></SelectTrigger>
                  <SelectContent>{vendors.map((v) => (<SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="product">Product</Label>
                <Select value={selectedProduct} onValueChange={setSelectedProduct} disabled={!selectedVendor || loadingProducts}>
                  <SelectTrigger><SelectValue placeholder={loadingProducts ? "Loading products..." : "Select product"} /></SelectTrigger>
                  <SelectContent>{products.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity to Add</Label>
                <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value) || 1)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="comments">Comments</Label>
                <Textarea id="comments" value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Optional comments..." />
              </div>
              <Button onClick={submitStock} className="w-full">Submit Stock</Button>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="current-inventory">
          <Card className="mt-4">
            <CardHeader><CardTitle>Current Inventory</CardTitle></CardHeader>
            <CardContent>
              {loading ? (<p>Loading inventory...</p>) : (
                <div className="space-y-3">
                  {inventory.map((item) => {
                    const status = getStockStatus(item.current_stock, item.min_stock);
                    const isEditing = editingItemId === item.id;
                    return (
                      <div key={item.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-muted rounded-lg">
                        <div className="flex-1">
                          <h3 className="font-medium">{item.name}</h3>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            {isEditing ? (
                              <div className="flex items-center gap-2">
                                <Label htmlFor={`quantity-${item.id}`} className="text-xs">Current:</Label>
                                <Input id={`quantity-${item.id}`} type="number" value={newQuantity} onChange={(e) => setNewQuantity(parseInt(e.target.value, 10) || 0)} className="h-8 w-24" />
                              </div>
                            ) : (<span>Current: {item.current_stock}</span>)}
                            <span>Min: {item.min_stock}</span>
                            <span>Value: Rs. {(item.current_stock * item.price).toFixed(2)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-2 sm:mt-0">
                          <Badge variant={status.variant}>{status.label}</Badge>
                          {isEditing ? (<Button size="sm" onClick={() => handleUpdateStock(item.id)}>Save</Button>) : (<Button variant="outline" size="sm" onClick={() => { setEditingItemId(item.id); setNewQuantity(item.current_stock); }}>Edit</Button>)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="transactions">
          <Card className="mt-4">
            <CardHeader><CardTitle>Inventory Transactions</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Comments</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={5} className="text-center">Loading...</TableCell></TableRow>
                  ) : (
                    transactions.map(tx => (
                      <TableRow key={tx.id}>
                        <TableCell>{tx.products?.name || 'N/A'}</TableCell>
                        <TableCell>{tx.customers?.name || 'N/A'}</TableCell>
                        <TableCell>{tx.quantity_change}</TableCell>
                        <TableCell>{new Date(tx.created_at).toLocaleString()}</TableCell>
                        <TableCell>{tx.comments || '-'}</TableCell>
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