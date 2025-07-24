import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Package, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export const Inventory = () => {
  const { toast } = useToast();
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState(1);

  // Placeholder data - will be replaced with Supabase data
  const inventory = [
    { id: "1", name: "Laptop Stand", currentStock: 15, minStock: 10, price: 45.99 },
    { id: "2", name: "Wireless Mouse", currentStock: 2, minStock: 15, price: 29.99 },
    { id: "3", name: "USB-C Cable", currentStock: 25, minStock: 20, price: 19.99 },
    { id: "4", name: "Monitor Stand", currentStock: 6, minStock: 5, price: 89.99 },
    { id: "5", name: "Keyboard Tray", currentStock: 8, minStock: 8, price: 65.99 },
    { id: "6", name: "Cable Management", currentStock: 1, minStock: 12, price: 15.99 }
  ];

  const products = [
    { id: "1", name: "Laptop Stand" },
    { id: "2", name: "Wireless Mouse" },
    { id: "3", name: "USB-C Cable" },
    { id: "4", name: "Monitor Stand" },
    { id: "5", name: "Keyboard Tray" },
    { id: "6", name: "Cable Management" }
  ];

  const addStock = async () => {
    if (!selectedProduct || quantity <= 0) {
      toast({
        title: "Error",
        description: "Please select a product and enter a valid quantity",
        variant: "destructive"
      });
      return;
    }

    // TODO: Replace with actual Supabase call
    console.log("Adding stock:", {
      productId: selectedProduct,
      quantity
    });

    toast({
      title: "Success",
      description: `Added ${quantity} units to inventory`
    });

    setSelectedProduct("");
    setQuantity(1);
  };

  const getStockStatus = (current: number, min: number) => {
    if (current === 0) return { label: "Out of Stock", variant: "destructive" as const };
    if (current <= min) return { label: "Low Stock", variant: "destructive" as const };
    if (current <= min * 1.5) return { label: "Warning", variant: "secondary" as const };
    return { label: "In Stock", variant: "default" as const };
  };

  const lowStockCount = inventory.filter(item => item.currentStock <= item.minStock).length;
  const outOfStockCount = inventory.filter(item => item.currentStock === 0).length;
  const totalValue = inventory.reduce((sum, item) => sum + (item.currentStock * item.price), 0);

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
              <p className="text-2xl font-bold">${totalValue.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
            
            <Button onClick={addStock} className="w-full">
              Add to Stock
            </Button>
          </CardContent>
        </Card>

        {/* Current Inventory */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Current Inventory</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {inventory.map((item) => {
                const status = getStockStatus(item.currentStock, item.minStock);
                return (
                  <div key={item.id} className="flex items-center justify-between p-4 bg-muted rounded-lg">
                    <div className="flex-1">
                      <h3 className="font-medium">{item.name}</h3>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>Current: {item.currentStock}</span>
                        <span>Min: {item.minStock}</span>
                        <span>Value: ${(item.currentStock * item.price).toFixed(2)}</span>
                      </div>
                    </div>
                    <Badge variant={status.variant}>
                      {status.label}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};