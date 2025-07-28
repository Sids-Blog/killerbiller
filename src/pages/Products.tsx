import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Edit, Trash2, Plus, Check, ChevronsUpDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

interface Vendor {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  min_stock: number;
  lot_size: number;
  lot_price: number;
  product_vendors: { customers: Vendor }[];
}

const MandatoryLabel = ({ children }: { children: React.ReactNode }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Label>
        {children} <span className="text-destructive">*</span>
      </Label>
    </TooltipTrigger>
    <TooltipContent>
      <p>This field is required</p>
    </TooltipContent>
  </Tooltip>
);

export const Products = () => {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedVendors, setSelectedVendors] = useState<Vendor[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    price: 0,
    min_stock: 0,
    lot_size: 1,
    lot_price: 0,
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const productPromise = supabase
      .from("products")
      .select("*, product_vendors(customers(id, name))")
      .order("name", { ascending: true });

    const vendorPromise = supabase
      .from("customers")
      .select("id, name")
      .eq("type", "vendor")
      .order("name", { ascending: true });

    const [productRes, vendorRes] = await Promise.all([
      productPromise,
      vendorPromise,
    ]);

    if (productRes.error) {
      toast({
        title: "Error fetching products",
        description: productRes.error.message,
        variant: "destructive",
      });
    } else {
      setProducts(productRes.data as Product[] || []);
    }

    if (vendorRes.error) {
      toast({
        title: "Error fetching vendors",
        description: vendorRes.error.message,
        variant: "destructive",
      });
    } else {
      setVendors(vendorRes.data || []);
    }

    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFormDataChange = (field: string, value: string | number) => {
    const newFormData = { ...formData, [field]: value };
    if (
      (field === "lot_price" || field === "lot_size") &&
      newFormData.lot_size > 0
    ) {
      newFormData.price = newFormData.lot_price / newFormData.lot_size;
    }
    setFormData(newFormData);
  };

  const openDialog = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        price: product.price,
        min_stock: product.min_stock,
        lot_size: product.lot_size,
        lot_price: product.lot_price,
      });
      setSelectedVendors(product.product_vendors.map(pv => pv.customers));
    } else {
      setEditingProduct(null);
      setFormData({
        name: "",
        price: 0,
        min_stock: 0,
        lot_size: 1,
        lot_price: 0,
      });
      setSelectedVendors([]);
    }
    setIsDialogOpen(true);
  };

  const saveProduct = async () => {
    if (!formData.name || formData.lot_price <= 0 || formData.lot_size <= 0) {
      toast({
        title: "Error",
        description: "Please fill all required fields with valid values.",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase.rpc("upsert_product_with_vendors", {
      p_id: editingProduct?.id || null,
      p_name: formData.name,
      p_price: formData.lot_price / formData.lot_size,
      p_lot_size: formData.lot_size,
      p_lot_price: formData.lot_price,
      p_min_stock: formData.min_stock,
      p_vendor_ids: selectedVendors.map(v => v.id),
    });

    if (error) {
      toast({
        title: "Error saving product",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: `Product ${editingProduct ? "updated" : "added"} successfully.`,
      });
      fetchData();
      setIsDialogOpen(false);
      setEditingProduct(null);
    }
  };

  const deleteProduct = async (productId: string) => {
    const { error } = await supabase.from("products").delete().eq("id", productId);
    if (error) {
      toast({
        title: "Error deleting product",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Success", description: "Product deleted successfully." });
      fetchData();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Product Management</h1>
          <p className="text-muted-foreground">Manage your product catalog</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild><Button onClick={() => openDialog()}><Plus className="h-4 w-4 mr-2" />Add Product</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingProduct ? "Edit Product" : "Add New Product"}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="col-span-2 space-y-2">
                <MandatoryLabel>Product Name</MandatoryLabel>
                <Input id="name" value={formData.name} onChange={(e) => handleFormDataChange("name", e.target.value)} placeholder="Enter product name" />
              </div>
              <div className="space-y-2">
                <MandatoryLabel>Lot Size (units)</MandatoryLabel>
                <Input id="lot_size" type="number" min="1" value={formData.lot_size} onChange={(e) => handleFormDataChange("lot_size", parseInt(e.target.value) || 1)} />
              </div>
              <div className="space-y-2">
                <MandatoryLabel>Lot Price (Rs.)</MandatoryLabel>
                <Input id="lot_price" type="number" min="0" step="0.01" value={formData.lot_price} onChange={(e) => handleFormDataChange("lot_price", parseFloat(e.target.value) || 0)} placeholder="0.00" />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Unit Price (Rs.)</Label>
                <Input type="text" value={formData.price.toFixed(2)} readOnly className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="minStock">Minimum Stock Level</Label>
                <Input id="minStock" type="number" min="0" value={formData.min_stock} onChange={(e) => handleFormDataChange("min_stock", parseInt(e.target.value) || 0)} placeholder="0" />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Vendors</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between">
                      <span className="truncate">
                        {selectedVendors.length > 0 ? selectedVendors.map(v => v.name).join(", ") : "Select vendors..."}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                    <Command>
                      <CommandInput placeholder="Search vendors..." />
                      <CommandEmpty>No vendors found.</CommandEmpty>
                      <CommandGroup>
                        <CommandList>
                          {vendors.map((vendor) => (
                            <CommandItem
                              key={vendor.id}
                              value={vendor.name}
                              onSelect={() => {
                                setSelectedVendors(current => 
                                  current.some(v => v.id === vendor.id) 
                                  ? current.filter(v => v.id !== vendor.id) 
                                  : [...current, vendor]
                                );
                              }}
                            >
                              <Check className={`mr-2 h-4 w-4 ${selectedVendors.some(v => v.id === vendor.id) ? "opacity-100" : "opacity-0"}`} />
                              {vendor.name}
                            </CommandItem>
                          ))}
                        </CommandList>
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button onClick={saveProduct} className="flex-1">{editingProduct ? "Update" : "Add"} Product</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (<p>Loading products...</p>) : (
          products.map((product) => (
            <Card key={product.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{product.name}</CardTitle>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openDialog(product)}><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteProduct(product.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between"><span className="text-sm text-muted-foreground">Lot Price:</span><span className="font-medium">Rs. {product.lot_price.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-sm text-muted-foreground">Lot Size:</span><span className="font-medium">{product.lot_size} units</span></div>
                  <div className="flex justify-between"><span className="text-sm text-muted-foreground">Unit Price:</span><span className="font-medium">Rs. {product.price.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-sm text-muted-foreground">Min Stock:</span><span className="font-medium">{product.min_stock} units</span></div>
                </div>
                <div className="mt-4 pt-2 border-t">
                  <h4 className="text-sm font-medium mb-2">Vendors</h4>
                  <div className="flex flex-wrap gap-1">
                    {product.product_vendors.length > 0 ? (
                      product.product_vendors.map(pv => (
                        <Badge key={pv.customers.id} variant="secondary">{pv.customers.name}</Badge>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground">No vendors linked.</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};
