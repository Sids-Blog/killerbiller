import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface BillItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}

export const Billing = () => {
  const { toast } = useToast();
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [billItems, setBillItems] = useState<BillItem[]>([]);
  const [newItem, setNewItem] = useState({ productId: "", quantity: 1 });

  // Placeholder data - will be replaced with Supabase data
  const customers = [
    { id: "1", name: "Tech Corp", email: "contact@techcorp.com" },
    { id: "2", name: "Design Studio", email: "hello@designstudio.com" },
    { id: "3", name: "StartupXYZ", email: "team@startupxyz.com" }
  ];

  const products = [
    { id: "1", name: "Laptop Stand", price: 45.99, stock: 15 },
    { id: "2", name: "Wireless Mouse", price: 29.99, stock: 8 },
    { id: "3", name: "USB-C Cable", price: 19.99, stock: 25 },
    { id: "4", name: "Monitor Stand", price: 89.99, stock: 6 }
  ];

  const addItem = () => {
    if (!newItem.productId || newItem.quantity <= 0) return;
    
    const product = products.find(p => p.id === newItem.productId);
    if (!product) return;

    const existingItemIndex = billItems.findIndex(item => item.productId === newItem.productId);
    
    if (existingItemIndex >= 0) {
      const updatedItems = [...billItems];
      updatedItems[existingItemIndex].quantity += newItem.quantity;
      setBillItems(updatedItems);
    } else {
      setBillItems([...billItems, {
        productId: newItem.productId,
        productName: product.name,
        quantity: newItem.quantity,
        price: product.price
      }]);
    }
    
    setNewItem({ productId: "", quantity: 1 });
  };

  const removeItem = (index: number) => {
    setBillItems(billItems.filter((_, i) => i !== index));
  };

  const total = billItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);

  const submitBill = async () => {
    if (!selectedCustomer || billItems.length === 0) {
      toast({
        title: "Error",
        description: "Please select a customer and add at least one item",
        variant: "destructive"
      });
      return;
    }

    // TODO: Replace with actual Supabase call
    console.log("Creating bill:", {
      customerId: selectedCustomer,
      items: billItems,
      total
    });

    toast({
      title: "Success",
      description: "Bill created successfully"
    });

    // Reset form
    setSelectedCustomer("");
    setBillItems([]);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Create Bill</h1>
        <p className="text-muted-foreground">Generate customer invoices</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bill Form */}
        <Card>
          <CardHeader>
            <CardTitle>Bill Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customer">Customer</Label>
              <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                <SelectTrigger>
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      <div>
                        <div className="font-medium">{customer.name}</div>
                        <div className="text-sm text-muted-foreground">{customer.email}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <div className="flex-1 space-y-2">
                <Label htmlFor="product">Product</Label>
                <Select value={newItem.productId} onValueChange={(value) => setNewItem({...newItem, productId: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        <div className="flex justify-between w-full">
                          <span>{product.name}</span>
                          <span className="text-muted-foreground">${product.price}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="w-24 space-y-2">
                <Label htmlFor="quantity">Qty</Label>
                <Input
                  type="number"
                  min="1"
                  value={newItem.quantity}
                  onChange={(e) => setNewItem({...newItem, quantity: parseInt(e.target.value) || 1})}
                />
              </div>
              
              <div className="flex items-end">
                <Button onClick={addItem} size="icon">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bill Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Bill Preview</CardTitle>
          </CardHeader>
          <CardContent>
            {billItems.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No items added yet</p>
            ) : (
              <div className="space-y-4">
                {billItems.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">{item.productName}</p>
                      <p className="text-sm text-muted-foreground">
                        ${item.price} × {item.quantity}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        ${(item.price * item.quantity).toFixed(2)}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                
                <div className="border-t pt-4">
                  <div className="flex justify-between items-center text-lg font-bold">
                    <span>Total:</span>
                    <span>${total.toFixed(2)}</span>
                  </div>
                </div>
                
                <Button 
                  onClick={submitBill} 
                  className="w-full"
                  disabled={!selectedCustomer || billItems.length === 0}
                >
                  Create Bill
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};