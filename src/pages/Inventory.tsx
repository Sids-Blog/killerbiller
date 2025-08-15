import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { exportToCSV, formatCurrency } from "@/lib/csv-export";
import { supabase } from "@/lib/supabase";
import { endOfMonth, format, startOfMonth } from "date-fns";
import { AlertTriangle, Check, ChevronsUpDown, Download, Package, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { DateRange } from "react-day-picker";

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
  lot_size?: number;
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
  const { role } = useAuth();
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedVendor, setSelectedVendor] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [cases, setCases] = useState(0);
  const [selectedProductLotSize, setSelectedProductLotSize] = useState(1);
  const [comments, setComments] = useState("");

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [newQuantity, setNewQuantity] = useState(0);

  // Filters
  const [productFilter, setProductFilter] = useState("all");
  const [vendorFilter, setVendorFilter] = useState("all");
  const [vendorSearchOpen, setVendorSearchOpen] = useState(false);
  const [productSearchOpen, setProductSearchOpen] = useState(false);
  const [addStockVendorSearchOpen, setAddStockVendorSearchOpen] = useState(false);
  const [addStockProductSearchOpen, setAddStockProductSearchOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    const inventoryPromise = supabase.from("inventory").select(`
      quantity,
      products (id, name, price, min_stock)
    `);
    const vendorsPromise = supabase.from("customers").select("id, name").eq("type", "vendor").order("name", { ascending: true });
    const allProductsPromise = supabase.from("products").select("id, name").order("name", { ascending: true });
    
    let transactionsQuery = supabase.from("inventory_transactions").select(`
      id, created_at, quantity_change, comments,
      products (name),
      customers (name)
    `);

    if (productFilter !== "all") transactionsQuery = transactionsQuery.eq('product_id', productFilter);
    if (vendorFilter !== "all") transactionsQuery = transactionsQuery.eq('vendor_id', vendorFilter);
    if (dateRange?.from) transactionsQuery = transactionsQuery.gte('created_at', dateRange.from.toISOString());
    if (dateRange?.to) transactionsQuery = transactionsQuery.lte('created_at', dateRange.to.toISOString());

    const transactionsPromise = transactionsQuery.order("created_at", { ascending: false });

    const [
      inventoryRes,
      vendorsRes,
      transactionsRes,
      allProductsRes
    ] = await Promise.all([inventoryPromise, vendorsPromise, transactionsPromise, allProductsPromise]);

    if (inventoryRes.error) toast({ title: "Error fetching inventory", description: inventoryRes.error.message, variant: "destructive" });
    else {
      const formattedData = inventoryRes.data.map((item: { products: { id: string; name: string; price: number; min_stock: number }; quantity: number }) => ({
        id: item.products.id,
        name: item.products.name,
        current_stock: item.quantity,
        min_stock: item.products.min_stock,
        price: item.products.price,
      }));
      setInventory(formattedData);
    }

    if (vendorsRes.error) toast({ title: "Error fetching vendors", description: vendorsRes.error.message, variant: "destructive" });
    else setVendors(vendorsRes.data || []);

    if (transactionsRes.error) toast({ title: "Error fetching transactions", description: transactionsRes.error.message, variant: "destructive" });
    else setTransactions(transactionsRes.data as Transaction[]);

    if (allProductsRes.error) toast({ title: "Error fetching all products", description: allProductsRes.error.message, variant: "destructive" });
    else setAllProducts(allProductsRes.data || []);

    setLoading(false);
  }, [toast, productFilter, vendorFilter, dateRange]);

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
        .select("products(id, name, lot_size)")
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

  const handleCasesChange = (value: number) => {
    setCases(value);
    if (value > 0) {
      setQuantity(value * selectedProductLotSize);
    }
  };

  const handleQuantityChange = (value: number) => {
    setQuantity(value);
    if (selectedProductLotSize > 0) {
      setCases(Math.floor(value / selectedProductLotSize));
    }
  };

  const submitStock = async () => {
    if (!selectedProduct || !selectedVendor || quantity <= 0) {
      toast({ title: "Error", description: "Please select a vendor, a product, and enter a valid quantity.", variant: "destructive" });
      return;
    }

    const { error } = await supabase.rpc("increment_stock", { p_product_id: selectedProduct, p_quantity: quantity, p_vendor_id: selectedVendor, p_comments: comments });
    if (error) toast({ title: "Error updating stock", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Success", description: "Stock updated successfully." });
      setSelectedProduct("");
      setSelectedVendor("");
      setQuantity(1);
      setCases(0);
      setSelectedProductLotSize(1);
      setComments("");
      fetchInitialData();
    }
  };

  const handleUpdateStock = async (productId: string) => {
    if (newQuantity < 0) {
      toast({ title: "Error", description: "Quantity cannot be negative.", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("inventory").update({ quantity: newQuantity }).eq("product_id", productId);
    if (error) toast({ title: "Error updating stock", description: error.message, variant: "destructive" });
    else {
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
                <Popover open={addStockVendorSearchOpen} onOpenChange={setAddStockVendorSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={addStockVendorSearchOpen}
                      className="w-full justify-between"
                    >
                      <span className="truncate">
                        {selectedVendor
                          ? vendors.find((vendor) => vendor.id === selectedVendor)?.name
                          : "Select vendor first"}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] max-w-[95vw] p-0">
                    <Command>
                      <CommandInput placeholder="Search vendors..." className="h-9" />
                      <CommandList className="max-h-[200px]">
                        <CommandEmpty>No vendor found.</CommandEmpty>
                        <CommandGroup>
                          {vendors.map((vendor) => (
                            <CommandItem
                              key={vendor.id}
                              value={vendor.name}
                              onSelect={() => {
                                setSelectedVendor(vendor.id);
                                setAddStockVendorSearchOpen(false);
                              }}
                              className="cursor-pointer"
                            >
                              <Check className={`mr-2 h-4 w-4 ${selectedVendor === vendor.id ? "opacity-100" : "opacity-0"}`} />
                              <span className="truncate">{vendor.name}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="product">Product</Label>
                <Popover open={addStockProductSearchOpen} onOpenChange={setAddStockProductSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={addStockProductSearchOpen}
                      className="w-full justify-between"
                      disabled={!selectedVendor || loadingProducts}
                    >
                      <span className="truncate">
                        {loadingProducts
                          ? "Loading products..."
                          : selectedProduct
                          ? products.find((product) => product.id === selectedProduct)?.name
                          : "Select product"}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] max-w-[95vw] p-0">
                    <Command>
                      <CommandInput placeholder="Search products..." className="h-9" />
                      <CommandList className="max-h-[200px]">
                        <CommandEmpty>No product found.</CommandEmpty>
                        <CommandGroup>
                          {products.map((product) => (
                            <CommandItem
                              key={product.id}
                              value={product.name}
                              onSelect={() => {
                                setSelectedProduct(product.id);
                                setSelectedProductLotSize(product.lot_size || 1);
                                setAddStockProductSearchOpen(false);
                              }}
                              className="cursor-pointer"
                            >
                              <Check className={`mr-2 h-4 w-4 ${selectedProduct === product.id ? "opacity-100" : "opacity-0"}`} />
                              <span className="truncate">{product.name}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cases">Cases</Label>
                <Input 
                  type="number" 
                  min="0" 
                  value={cases} 
                  onChange={(e) => handleCasesChange(parseInt(e.target.value) || 0)} 
                  placeholder="Enter number of cases"
                />
                {selectedProduct && selectedProductLotSize > 1 && (
                  <p className="text-xs text-muted-foreground">
                    1 case = {selectedProductLotSize} units
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity to Add (units)</Label>
                <Input 
                  type="number" 
                  min="1" 
                  value={quantity} 
                  onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 1)} 
                />
                {selectedProduct && selectedProductLotSize > 1 && cases > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {cases} case{cases !== 1 ? 's' : ''} = {quantity} units
                  </p>
                )}
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
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Current Inventory</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    try {
                      exportToCSV({
                        filename: 'current-inventory',
                        headers: ['Product Name', 'Current Stock', 'Minimum Stock', 'Price', 'Stock Status'],
                        data: inventory,
                        transformData: (item) => {
                          const stockStatus = item.current_stock === 0 ? 'Out of Stock' : item.current_stock <= item.min_stock ? 'Low Stock' : 'In Stock';
                          return {
                            'Product Name': item.name,
                            'Current Stock': item.current_stock.toString(),
                            'Minimum Stock': item.min_stock.toString(),
                            'Price': formatCurrency(item.price),
                            'Stock Status': stockStatus
                          };
                        }
                      });
                      toast({ title: "Success", description: "Inventory exported to CSV successfully" });
                    } catch (error) {
                      toast({ title: "Error", description: "Failed to export CSV", variant: "destructive" });
                    }
                  }}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Export CSV
                </Button>
              </div>
            </CardHeader>
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
                          {role === 'admin' && (
                            isEditing ? (<Button size="sm" onClick={() => handleUpdateStock(item.id)}>Save</Button>) : (<Button variant="outline" size="sm" onClick={() => { setEditingItemId(item.id); setNewQuantity(item.current_stock); }}>Edit</Button>)
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
        <TabsContent value="transactions">
          <Card className="mt-4">
            <CardHeader><CardTitle>Inventory Transactions</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4 mb-4">
                <Popover open={productSearchOpen} onOpenChange={setProductSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={productSearchOpen}
                      className="w-full sm:w-[180px] justify-between"
                    >
                      <span className="truncate">
                        {productFilter !== "all"
                          ? allProducts.find((product) => product.id === productFilter)?.name
                          : "Filter by product"}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[200px] p-0">
                    <Command>
                      <CommandInput placeholder="Search products..." className="h-9" />
                      <CommandList className="max-h-[200px]">
                        <CommandEmpty>No product found.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="all"
                            onSelect={() => {
                              setProductFilter("all");
                              setProductSearchOpen(false);
                            }}
                            className="cursor-pointer"
                          >
                            <Check className={`mr-2 h-4 w-4 ${productFilter === "all" ? "opacity-100" : "opacity-0"}`} />
                            <span>All Products</span>
                          </CommandItem>
                          {allProducts.map((product) => (
                            <CommandItem
                              key={product.id}
                              value={product.name}
                              onSelect={() => {
                                setProductFilter(product.id);
                                setProductSearchOpen(false);
                              }}
                              className="cursor-pointer"
                            >
                              <Check className={`mr-2 h-4 w-4 ${productFilter === product.id ? "opacity-100" : "opacity-0"}`} />
                              <span className="truncate">{product.name}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <Popover open={vendorSearchOpen} onOpenChange={setVendorSearchOpen}>
                    <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" aria-expanded={vendorSearchOpen} className="w-full sm:w-[200px] justify-between">
                            {vendorFilter !== "all" ? vendors.find((v) => v.id === vendorFilter)?.name : "Select vendor..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[200px] p-0">
                        <Command>
                            <CommandInput placeholder="Search vendor..." />
                            <CommandList>
                                <CommandEmpty>No vendor found.</CommandEmpty>
                                <CommandGroup>
                                    <CommandItem value="all" onSelect={() => {setVendorFilter("all"); setVendorSearchOpen(false);}}>All Vendors</CommandItem>
                                    {vendors.map((v) => (
                                        <CommandItem key={v.id} value={v.name} onSelect={() => {setVendorFilter(v.id); setVendorSearchOpen(false);}}>
                                            {v.name}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
                <Popover><PopoverTrigger asChild><Button variant={"outline"} className="w-full sm:w-auto justify-start text-left font-normal">{dateRange?.from ? (dateRange.to ? `${format(dateRange.from, "LLL dd, y")} - ${format(dateRange.to, "LLL dd, y")}` : format(dateRange.from, "LLL dd, y")) : <span>Pick a date range</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} /></PopoverContent></Popover>
              </div>
              <div className="overflow-x-auto">
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
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};