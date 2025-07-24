import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Package, AlertTriangle, Trash2 } from "lucide-react";
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

interface StockItem {
  product_id: string;
  product_name: string;
  quantity: number;
}

export const Inventory = () => {
  const { toast } = useToast();
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [newQuantity, setNewQuantity] = useState(0);

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("inventory")
      .select(`
        quantity,
        products (
          id,
          name,
          price,
          min_stock
        )
      `);

    if (error) {
      toast({ title: "Error fetching inventory", description: error.message, variant: "destructive" });
      setInventory([]);
    } else {
      const formattedData = data.map((item: any) => ({
        id: item.products.id,
        name: item.products.name,
        current_stock: item.quantity,
        min_stock: item.products.min_stock,
        price: item.products.price,
      }));
      setInventory(formattedData);
    }
    setLoading(false);
  }, [toast]);

  const fetchProducts = useCallback(async () => {
    const { data, error } = await supabase
      .from("products")
      .select("id, name")
      .order("name", { ascending: true });
    
    if (error) {
      toast({ title: "Error fetching products", description: error.message, variant: "destructive" });
    } else {
      setProducts(data || []);
    }
  }, [toast]);

  useEffect(() => {
    fetchInventory();
    fetchProducts();
  }, [fetchInventory, fetchProducts]);

  const addItem = () => {
    if (!selectedProduct || quantity <= 0) {
      toast({
        title: "Error",
        description: "Please select a product and enter a valid quantity.",
        variant: "destructive",
      });
      return;
    }
    const product = products.find((p) => p.id === selectedProduct);
    if (!product) return;

    const existingItemIndex = stockItems.findIndex(item => item.product_id === selectedProduct);

    if (existingItemIndex > -1) {
      const updatedItems = [...stockItems];
      updatedItems[existingItemIndex].quantity += quantity;
      setStockItems(updatedItems);
    } else {
      setStockItems([
        ...stockItems,
        {
          product_id: product.id,
          product_name: product.name,
          quantity: quantity,
        },
      ]);
    }

    setSelectedProduct("");
    setQuantity(1);
  };

  const removeItem = (index: number) => {
    setStockItems(stockItems.filter((_, i) => i !== index));
  };

  const submitStock = async () => {
    if (stockItems.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one item to the stock.",
        variant: "destructive"
      });
      return;
    }

    const stockUpdates = stockItems.map(async (item) => {
      const { data: existingStock, error: fetchError } = await supabase
        .from("inventory")
        .select("id, quantity")
        .eq("product_id", item.product_id)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw new Error(`Error checking stock for ${item.product_name}: ${fetchError.message}`);
      }

      if (existingStock) {
        const { error } = await supabase
          .from("inventory")
          .update({ quantity: existingStock.quantity + item.quantity })
          .eq("product_id", item.product_id);
        if (error) throw new Error(`Error updating stock for ${item.product_name}: ${error.message}`);
      } else {
        const { error } = await supabase
          .from("inventory")
          .insert({ product_id: item.product_id, quantity: item.quantity });
        if (error) throw new Error(`Error adding stock for ${item.product_name}: ${error.message}`);
      }
    });

    try {
      await Promise.all(stockUpdates);
      toast({ title: "Success", description: "Stock updated successfully for all items." });
      setStockItems([]);
      fetchInventory();
    } catch (error: any) {
      toast({ title: "Error updating stock", description: error.message, variant: "destructive" });
    }
  };

  const handleUpdateStock = async (productId: string) => {
    if (newQuantity < 0) {
      toast({
        title: "Error",
        description: "Quantity cannot be negative.",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from("inventory")
      .update({ quantity: newQuantity })
      .eq("product_id", productId);

    if (error) {
      toast({
        title: "Error updating stock",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Success", description: "Stock updated successfully." });
      fetchInventory();
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
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Total Products</p>
                <p className="text-2xl font-bold">{inventory.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              <div>
                <p className="text-sm text-muted-foreground">Low Stock</p>
                <p className="text-2xl font-bold text-warning">{lowStockCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div>
                <p className="text-sm text-muted-foreground">Out of Stock</p>
                <p className="text-2xl font-bold text-destructive">{outOfStockCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div>
              <p className="text-sm text-muted-foreground">Inventory Value</p>
              <p className="text-2xl font-bold">₹{totalValue.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="add-stock">
        <TabsList>
          <TabsTrigger value="add-stock">Stock Management</TabsTrigger>
          <TabsTrigger value="current-inventory">Current Inventory</TabsTrigger>
        </TabsList>
        <TabsContent value="add-stock">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
            {/* Add Stock Form */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Add Stock
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="product">Product</Label>
                  <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select product" />
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
                
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity to Add</Label>
                  <Input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                  />
                </div>
                
                <Button onClick={addItem} className="w-full">
                  Add to List
                </Button>
              </CardContent>
            </Card>

            {/* Stock Preview */}
            <Card>
              <CardHeader>
                <CardTitle>Stock Preview</CardTitle>
              </CardHeader>
              <CardContent>
                {stockItems.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No items added yet
                  </p>
                ) : (
                  <div className="space-y-4">
                    {stockItems.map((item, index) => (
                      <div key={index} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                        <div>
                          <p className="font-medium">{item.product_name}</p>
                          <p className="text-sm text-muted-foreground">Quantity: {item.quantity}</p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => removeItem(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button onClick={submitStock} className="w-full">
                      Submit Stock
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="current-inventory">
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Current Inventory</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p>Loading inventory...</p>
              ) : (
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
                                <Input
                                  id={`quantity-${item.id}`}
                                  type="number"
                                  value={newQuantity}
                                  onChange={(e) => setNewQuantity(parseInt(e.target.value, 10) || 0)}
                                  className="h-8 w-24"
                                />
                              </div>
                            ) : (
                              <span>Current: {item.current_stock}</span>
                            )}
                            <span>Min: {item.min_stock}</span>
                            <span>Value: ₹{(item.current_stock * item.price).toFixed(2)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-2 sm:mt-0">
                          <Badge variant={status.variant}>
                            {status.label}
                          </Badge>
                          {isEditing ? (
                            <Button size="sm" onClick={() => handleUpdateStock(item.id)}>Save</Button>
                          ) : (
                            <Button variant="outline" size="sm" onClick={() => {
                              setEditingItemId(item.id);
                              setNewQuantity(item.current_stock);
                            }}>Edit</Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};