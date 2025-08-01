import { useState, useEffect, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { Plus, Calendar as CalendarIcon, Filter, X, Edit, Check, ChevronsUpDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

interface Product {
  id: string;
  name: string;
}

interface Vendor {
  id: string;
  name: string;
}

interface DamagedStockLog {
  id: string;
  created_at: string;
  product_id: string;
  vendor_id: string;
  quantity: number;
  unit_cost: number;
  total_value: number;
  reason: string;
  status: 'PENDING_ADJUSTMENT' | 'ADJUSTED';
  products: { name: string };
  customers: { name: string };
}

export const DamagedStock = () => {
  const { toast } = useToast();
  const [logs, setLogs] = useState<DamagedStockLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<DamagedStockLog[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<DamagedStockLog | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [vendorSearchOpen, setVendorSearchOpen] = useState(false);
  const [editVendorSearchOpen, setEditVendorSearchOpen] = useState(false);
  const [productSearchOpen, setProductSearchOpen] = useState(false);
  const [editProductSearchOpen, setEditProductSearchOpen] = useState(false);
  
  // Filter states
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [productFilter, setProductFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [formData, setFormData] = useState({
    product_id: "",
    vendor_id: "",
    quantity: 0,
    unit_cost: 0,
    reason: "",
  });

  const [editFormData, setEditFormData] = useState({
    product_id: "",
    vendor_id: "",
    quantity: 0,
    unit_cost: 0,
    reason: "",
  });

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("damaged_stock_log")
      .select("*, products(name), customers(name)")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Error fetching logs", description: error.message, variant: "destructive" });
    } else {
      setLogs(data as DamagedStockLog[]);
      setFilteredLogs(data as DamagedStockLog[]);
    }
    setLoading(false);
  }, [toast]);

  const fetchProducts = useCallback(async () => {
    const { data, error } = await supabase.from("products").select("id, name");
    if (error) {
      toast({ title: "Error fetching products", description: error.message, variant: "destructive" });
    } else {
      setProducts(data || []);
    }
  }, [toast]);

  const fetchVendors = useCallback(async () => {
    const { data, error } = await supabase
      .from("customers")
      .select("id, name")
      .eq("type", "vendor")
      .eq("is_active", true)
      .order("name");
    if (error) {
      toast({ title: "Error fetching vendors", description: error.message, variant: "destructive" });
    } else {
      setVendors(data || []);
    }
  }, [toast]);

  useEffect(() => {
    fetchLogs();
    fetchProducts();
    fetchVendors();
  }, [fetchLogs, fetchProducts, fetchVendors]);

  useEffect(() => {
    let result = logs;
    if (dateRange?.from && dateRange?.to) {
      result = result.filter(log => {
        const logDate = new Date(log.created_at);
        return logDate >= dateRange.from! && logDate <= dateRange.to!;
      });
    }
    if (productFilter !== "all") {
      result = result.filter(log => log.product_id === productFilter);
    }
    if (statusFilter !== "all") {
      result = result.filter(log => log.status === statusFilter);
    }
    setFilteredLogs(result);
  }, [dateRange, productFilter, statusFilter, logs]);

  const handleSave = async () => {
    if (!formData.product_id || !formData.vendor_id || formData.quantity <= 0 || formData.unit_cost <= 0) {
      toast({ title: "Error", description: "Please fill in all required fields including vendor.", variant: "destructive" });
      return;
    }

    const { error: logError } = await supabase.from("damaged_stock_log").insert([
      {
        product_id: formData.product_id,
        vendor_id: formData.vendor_id,
        quantity: formData.quantity,
        unit_cost: formData.unit_cost,
        reason: formData.reason,
      },
    ]);

    if (logError) {
      toast({ title: "Error creating log", description: logError.message, variant: "destructive" });
      return;
    }

    const { error: stockError } = await supabase.rpc("decrement_stock_from_damage", {
      p_product_id: formData.product_id,
      p_quantity: formData.quantity,
    });

    if (stockError) {
      toast({ title: "Error updating stock", description: stockError.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Damaged stock logged successfully." });
      fetchLogs();
      setIsDialogOpen(false);
      setFormData({ product_id: "", vendor_id: "", quantity: 0, unit_cost: 0, reason: "" });
      setVendorSearchOpen(false);
      setProductSearchOpen(false);
    }
  };

  const handleEdit = (log: DamagedStockLog) => {
    setEditingLog(log);
    setEditFormData({
      product_id: log.product_id,
      vendor_id: log.vendor_id,
      quantity: log.quantity,
      unit_cost: log.unit_cost,
      reason: log.reason,
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!editFormData.product_id || !editFormData.vendor_id || editFormData.quantity <= 0 || editFormData.unit_cost <= 0) {
      toast({ title: "Error", description: "Please fill in all required fields including vendor.", variant: "destructive" });
      return;
    }

    if (!editingLog) return;

    // Calculate stock difference
    const quantityDiff = editFormData.quantity - editingLog.quantity;

    const { error: updateError } = await supabase
      .from("damaged_stock_log")
      .update({
        product_id: editFormData.product_id,
        vendor_id: editFormData.vendor_id,
        quantity: editFormData.quantity,
        unit_cost: editFormData.unit_cost,
        reason: editFormData.reason,
      })
      .eq("id", editingLog.id);

    if (updateError) {
      toast({ title: "Error updating log", description: updateError.message, variant: "destructive" });
      return;
    }

    // Adjust stock if quantity changed
    if (quantityDiff !== 0) {
      const { error: stockError } = await supabase.rpc("decrement_stock_from_damage", {
        p_product_id: editFormData.product_id,
        p_quantity: quantityDiff,
      });

      if (stockError) {
        toast({ title: "Error updating stock", description: stockError.message, variant: "destructive" });
      }
    }

    toast({ title: "Success", description: "Damaged stock log updated successfully." });
    fetchLogs();
    setIsEditDialogOpen(false);
    setEditingLog(null);
    setEditVendorSearchOpen(false);
    setEditProductSearchOpen(false);
  };
  
  const handleStatusChange = async (id: string, newStatus: 'PENDING_ADJUSTMENT' | 'ADJUSTED') => {
    const { error } = await supabase
      .from('damaged_stock_log')
      .update({ status: newStatus })
      .eq('id', id);

    if (error) {
      toast({ title: 'Error updating status', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Status updated successfully.' });
      fetchLogs();
    }
  };

  const clearFilters = () => {
    setDateRange(undefined);
    setProductFilter("all");
    setStatusFilter("all");
  };

  const hasActiveFilters = dateRange?.from || productFilter !== "all" || statusFilter !== "all";

  // Vendor Dropdown Component
  const VendorDropdown = ({ 
    value, 
    onValueChange, 
    open, 
    onOpenChange, 
    placeholder = "Select vendor..." 
  }: {
    value: string;
    onValueChange: (value: string) => void;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    placeholder?: string;
  }) => (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between mt-1 h-10"
        >
          <span className="truncate flex-1 text-left">
            {value
              ? vendors.find((vendor) => vendor.id === value)?.name
              : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-0" 
        side="bottom" 
        align="start"
        sideOffset={4}
        avoidCollisions={true}
      >
        <Command>
          <CommandInput placeholder="Search vendors..." className="h-9" />
          <CommandList className="max-h-[180px] overflow-y-auto">
            <CommandEmpty>No vendor found.</CommandEmpty>
            <CommandGroup>
              {vendors.map((vendor) => (
                <CommandItem
                  key={vendor.id}
                  value={vendor.name}
                  onSelect={() => {
                    onValueChange(vendor.id);
                    onOpenChange(false);
                  }}
                  className="cursor-pointer"
                >
                  <Check className={`mr-2 h-4 w-4 flex-shrink-0 ${value === vendor.id ? "opacity-100" : "opacity-0"}`} />
                  <span className="truncate">{vendor.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );

  // Mobile card view component
  const MobileLogCard = ({ log }: { log: DamagedStockLog }) => (
    <Card className="mb-3">
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-semibold text-sm">{log.products.name}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(log.created_at).toLocaleDateString()} • {log.customers?.name || 'Unknown Vendor'}
              </p>
            </div>
            <Badge variant={log.status === 'ADJUSTED' ? 'default' : 'destructive'} className="text-xs">
              {log.status.replace('_', ' ')}
            </Badge>
          </div>
          
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">Quantity</p>
              <p className="font-medium">{log.quantity}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Unit Cost</p>
              <p className="font-medium">₹{log.unit_cost.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Total Value</p>
              <p className="font-medium">₹{log.total_value.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Vendor</p>
              <p className="font-medium">{log.customers?.name || 'Unknown'}</p>
            </div>
          </div>
          
          {log.reason && (
            <div>
              <p className="text-muted-foreground text-sm">Reason</p>
              <p className="text-sm">{log.reason}</p>
            </div>
          )}
          
          <div className="flex gap-2">
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => handleEdit(log)}
              className="flex-1"
            >
              <Edit className="h-3 w-3 mr-1" />
              Edit
            </Button>
            {log.status === 'PENDING_ADJUSTMENT' && (
              <Button 
                size="sm" 
                onClick={() => handleStatusChange(log.id, 'ADJUSTED')}
                className="flex-1"
              >
                Mark as Adjusted
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Damaged Stock Log</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Log and track damaged or unsellable inventory.
          </p>
        </div>
        
        {/* Add New Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Log Damaged Stock</span>
              <span className="sm:hidden">Log Damage</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[95vw] max-w-md mx-auto">
            <DialogHeader>
              <DialogTitle className="text-lg">Log New Damaged Stock</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label className="text-sm font-medium">Product *</Label>
                <Popover open={productSearchOpen} onOpenChange={setProductSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={productSearchOpen}
                      className="w-full justify-between mt-1 h-10"
                    >
                      <span className="truncate flex-1 text-left">
                        {formData.product_id
                          ? products.find((product) => product.id === formData.product_id)?.name
                          : "Select a product"}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent 
                    className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-0" 
                    side="bottom" 
                    align="start"
                    sideOffset={4}
                    avoidCollisions={true}
                  >
                    <Command>
                      <CommandInput placeholder="Search products..." className="h-9" />
                      <CommandList className="max-h-[180px] overflow-y-auto">
                        <CommandEmpty>No product found.</CommandEmpty>
                        <CommandGroup>
                          {products.map((product) => (
                            <CommandItem
                              key={product.id}
                              value={product.name}
                              onSelect={() => {
                                setFormData({ ...formData, product_id: product.id });
                                setProductSearchOpen(false);
                              }}
                              className="cursor-pointer"
                            >
                              <Check className={`mr-2 h-4 w-4 flex-shrink-0 ${formData.product_id === product.id ? "opacity-100" : "opacity-0"}`} />
                              <span className="truncate">{product.name}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label className="text-sm font-medium">Vendor *</Label>
                <VendorDropdown
                  value={formData.vendor_id}
                  onValueChange={(value) => setFormData({ ...formData, vendor_id: value })}
                  open={vendorSearchOpen}
                  onOpenChange={setVendorSearchOpen}
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Quantity Damaged *</Label>
                <Input 
                  type="number" 
                  className="mt-1"
                  placeholder="Enter quantity"
                  onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })} 
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Unit Cost (Purchase Price) *</Label>
                <Input 
                  type="number" 
                  step="0.01"
                  className="mt-1"
                  placeholder="Enter unit cost"
                  onChange={(e) => setFormData({ ...formData, unit_cost: Number(e.target.value) })} 
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Reason for Damage</Label>
                <Textarea 
                  className="mt-1 min-h-[60px] resize-none"
                  placeholder="Describe the reason for damage"
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })} 
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsDialogOpen(false);
                  setVendorSearchOpen(false);
                  setProductSearchOpen(false);
                }}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSave}
                className="w-full sm:w-auto"
              >
                Save Log
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="w-[95vw] max-w-md mx-auto">
            <DialogHeader>
              <DialogTitle className="text-lg">Edit Damaged Stock Log</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label className="text-sm font-medium">Product *</Label>
                <Popover open={editProductSearchOpen} onOpenChange={setEditProductSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={editProductSearchOpen}
                      className="w-full justify-between mt-1 h-10"
                    >
                      <span className="truncate flex-1 text-left">
                        {editFormData.product_id
                          ? products.find((product) => product.id === editFormData.product_id)?.name
                          : "Select a product"}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent 
                    className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-0" 
                    side="bottom" 
                    align="start"
                    sideOffset={4}
                    avoidCollisions={true}
                  >
                    <Command>
                      <CommandInput placeholder="Search products..." className="h-9" />
                      <CommandList className="max-h-[180px] overflow-y-auto">
                        <CommandEmpty>No product found.</CommandEmpty>
                        <CommandGroup>
                          {products.map((product) => (
                            <CommandItem
                              key={product.id}
                              value={product.name}
                              onSelect={() => {
                                setEditFormData({ ...editFormData, product_id: product.id });
                                setEditProductSearchOpen(false);
                              }}
                              className="cursor-pointer"
                            >
                              <Check className={`mr-2 h-4 w-4 flex-shrink-0 ${editFormData.product_id === product.id ? "opacity-100" : "opacity-0"}`} />
                              <span className="truncate">{product.name}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label className="text-sm font-medium">Vendor *</Label>
                <VendorDropdown
                  value={editFormData.vendor_id}
                  onValueChange={(value) => setEditFormData({ ...editFormData, vendor_id: value })}
                  open={editVendorSearchOpen}
                  onOpenChange={setEditVendorSearchOpen}
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Quantity Damaged *</Label>
                <Input 
                  type="number" 
                  className="mt-1"
                  placeholder="Enter quantity"
                  value={editFormData.quantity}
                  onChange={(e) => setEditFormData({ ...editFormData, quantity: Number(e.target.value) })} 
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Unit Cost (Purchase Price) *</Label>
                <Input 
                  type="number" 
                  step="0.01"
                  className="mt-1"
                  placeholder="Enter unit cost"
                  value={editFormData.unit_cost}
                  onChange={(e) => setEditFormData({ ...editFormData, unit_cost: Number(e.target.value) })} 
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Reason for Damage</Label>
                <Textarea 
                  className="mt-1 min-h-[60px] resize-none"
                  placeholder="Describe the reason for damage"
                  value={editFormData.reason}
                  onChange={(e) => setEditFormData({ ...editFormData, reason: e.target.value })} 
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsEditDialogOpen(false);
                  setEditingLog(null);
                  setEditVendorSearchOpen(false);
                  setEditProductSearchOpen(false);
                }}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleUpdate}
                className="w-full sm:w-auto"
              >
                Update Log
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          {/* Mobile filter toggle */}
          <div className="flex justify-between items-center mb-4 sm:hidden">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2"
            >
              <Filter className="h-4 w-4" />
              Filters
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  Active
                </Badge>
              )}
            </Button>
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                className="flex items-center gap-1"
              >
                <X className="h-3 w-3" />
                Clear
              </Button>
            )}
          </div>

          {/* Filter controls */}
          <div className={`space-y-3 ${showFilters ? 'block' : 'hidden'} sm:block`}>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <span className="truncate">
                          {format(dateRange.from, "MMM dd")} - {format(dateRange.to, "MMM dd")}
                        </span>
                      ) : (
                        <span className="truncate">{format(dateRange.from, "MMM dd, y")}</span>
                      )
                    ) : (
                      <span>Date range</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start" side="bottom">
                  <Calendar
                    mode="range"
                    selected={dateRange}
                    onSelect={setDateRange}
                    initialFocus
                    className="rounded-md border"
                  />
                </PopoverContent>
              </Popover>
              
              <Select value={productFilter} onValueChange={setProductFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All products" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Products</SelectItem>
                  {products.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="PENDING_ADJUSTMENT">Pending</SelectItem>
                  <SelectItem value="ADJUSTED">Adjusted</SelectItem>
                </SelectContent>
              </Select>
              
              <Button 
                onClick={clearFilters} 
                variant="outline"
                className="hidden sm:flex"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Display */}
      <Card>
        <CardContent className="p-0 sm:p-4">
          {/* Desktop Table View */}
          <div className="hidden sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Unit Cost</TableHead>
                  <TableHead>Total Value</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No damaged stock logs found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium">{log.products.name}</TableCell>
                      <TableCell className="font-medium">{log.customers?.name || 'Unknown Vendor'}</TableCell>
                      <TableCell>{new Date(log.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>{log.quantity}</TableCell>
                      <TableCell>₹{log.unit_cost.toFixed(2)}</TableCell>
                      <TableCell>₹{log.total_value.toFixed(2)}</TableCell>
                      <TableCell className="max-w-xs truncate">{log.reason}</TableCell>
                      <TableCell>
                        <Badge variant={log.status === 'ADJUSTED' ? 'default' : 'destructive'}>
                          {log.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleEdit(log)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          {log.status === 'PENDING_ADJUSTMENT' && (
                            <Button 
                              size="sm" 
                              onClick={() => handleStatusChange(log.id, 'ADJUSTED')}
                            >
                              Mark as Adjusted
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card View */}
          <div className="sm:hidden p-4">
            {loading ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Loading...</p>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No damaged stock logs found.</p>
              </div>
            ) : (
              <div>
                {filteredLogs.map((log) => (
                  <MobileLogCard key={log.id} log={log} />
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};