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
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { Plus, Edit, Filter, X, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { exportToCSV } from "@/lib/csv-export";

export interface Customer {
  id: string;
  name: string;
  primary_phone_number: string;
  address: string;
  gst_number: string;
  manager_name: string;
  manager_phone_number: string;
  comments: string;
  type: "customer" | "vendor";
  is_active: boolean;
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

export const Customers = () => {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(
    null
  );
  
  // Filter states
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [formData, setFormData] = useState<Omit<Customer, "id">>({
    name: "",
    primary_phone_number: "",
    address: "",
    gst_number: "",
    manager_name: "",
    manager_phone_number: "",
    comments: "",
    type: "customer",
    is_active: true,
  });

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      toast({
        title: "Error fetching customers",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setCustomers(data as Customer[] || []);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Filter customers based on active filters
  useEffect(() => {
    let result = customers;
    
    // Filter by type
    if (typeFilter !== "all") {
      result = result.filter(customer => customer.type === typeFilter);
    }
    
    // Filter by status
    if (statusFilter !== "all") {
      const isActive = statusFilter === "active";
      result = result.filter(customer => customer.is_active === isActive);
    }
    
    // Filter by search query (name, phone, GST number)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(customer => 
        customer.name.toLowerCase().includes(query) ||
        customer.primary_phone_number.toLowerCase().includes(query) ||
        (customer.gst_number && customer.gst_number.toLowerCase().includes(query))
      );
    }
    
    setFilteredCustomers(result);
  }, [customers, typeFilter, statusFilter, searchQuery]);

  // Initialize filteredCustomers when customers change
  useEffect(() => {
    if (customers.length > 0 && filteredCustomers.length === 0 && typeFilter === "all" && statusFilter === "all" && searchQuery === "") {
      setFilteredCustomers(customers);
    }
  }, [customers, filteredCustomers.length, typeFilter, statusFilter, searchQuery]);

  const openDialog = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer);
      setFormData(customer);
    } else {
      setEditingCustomer(null);
      setFormData({
        name: "",
        primary_phone_number: "",
        address: "",
        gst_number: "",
        manager_name: "",
        manager_phone_number: "",
        comments: "",
        type: "customer",
        is_active: true,
      });
    }
    setIsDialogOpen(true);
  };

  const saveCustomer = async () => {
    if (!formData.name || !formData.primary_phone_number || !formData.address) {
      toast({
        title: "Error",
        description: "Name, Primary Phone Number, and Address are required.",
        variant: "destructive",
      });
      return;
    }

    if (editingCustomer) {
      const { error } = await supabase
        .from("customers")
        .update(formData)
        .eq("id", editingCustomer.id);
      if (error) {
        toast({
          title: "Error updating customer",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Customer updated successfully.",
        });
        fetchCustomers();
      }
    } else {
      const { error } = await supabase.from("customers").insert([formData]);
      if (error) {
        toast({
          title: "Error creating customer",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Customer created successfully.",
        });
        fetchCustomers();
      }
    }

    setIsDialogOpen(false);
    setEditingCustomer(null);
  };

  const clearFilters = () => {
    setTypeFilter("all");
    setStatusFilter("all");
    setSearchQuery("");
  };

  const hasActiveFilters = typeFilter !== "all" || statusFilter !== "all" || searchQuery.trim() !== "";

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Customers</h1>
          <p className="text-muted-foreground">
            Manage your customer information
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              try {
                exportToCSV({
                  filename: 'customers',
                  headers: ['Name', 'Type', 'Phone', 'Address', 'GST Number', 'Manager Name', 'Manager Phone', 'Comments', 'Status'],
                  data: filteredCustomers,
                  transformData: (customer) => ({
                    'Name': customer.name,
                    'Type': customer.type === 'customer' ? 'Customer' : 'Vendor',
                    'Phone': customer.primary_phone_number || '',
                    'Address': customer.address || '',
                    'GST Number': customer.gst_number || '',
                    'Manager Name': customer.manager_name || '',
                    'Manager Phone': customer.manager_phone_number || '',
                    'Comments': customer.comments || '',
                    'Status': customer.is_active ? 'Active' : 'Inactive'
                  })
                });
                toast({ title: "Success", description: "Customers exported to CSV successfully" });
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
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => openDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Add Customer
              </Button>
            </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>
                {editingCustomer ? "Edit Customer" : "Add New Customer"}
              </DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <MandatoryLabel>Name</MandatoryLabel>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <MandatoryLabel>Primary Phone</MandatoryLabel>
                <Input
                  id="primary_phone_number"
                  value={formData.primary_phone_number}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      primary_phone_number: e.target.value,
                    })
                  }
                />
              </div>
              <div className="col-span-2 space-y-2">
                <MandatoryLabel>Address</MandatoryLabel>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gst_number">GST Number</Label>
                <Input
                  id="gst_number"
                  value={formData.gst_number}
                  onChange={(e) =>
                    setFormData({ ...formData, gst_number: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manager_name">Manager Name</Label>
                <Input
                  id="manager_name"
                  value={formData.manager_name}
                  onChange={(e) =>
                    setFormData({ ...formData, manager_name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manager_phone_number">Manager Phone</Label>
                <Input
                  id="manager_phone_number"
                  value={formData.manager_phone_number}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      manager_phone_number: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <MandatoryLabel>Type</MandatoryLabel>
                <Select
                  value={formData.type}
                  onValueChange={(value) =>
                    setFormData({ ...formData, type: value as "customer" | "vendor" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="vendor">Vendor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="comments">Comments</Label>
                <Textarea
                  id="comments"
                  value={formData.comments}
                  onChange={(e) =>
                    setFormData({ ...formData, comments: e.target.value })
                  }
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_active: checked })
                  }
                />
                <Label htmlFor="is_active">Active</Label>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={saveCustomer}>
                {editingCustomer ? "Save Changes" : "Create Customer"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          {/* Mobile filter toggle */}
          <div className="flex justify-between items-center mb-4 md:hidden">
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
          <div className={`space-y-3 ${showFilters ? 'block' : 'hidden'} md:block`}>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {/* Search */}
              <div className="space-y-2">
                <Label htmlFor="search">Search</Label>
                <Input
                  id="search"
                  placeholder="Search by name, phone, GST..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full"
                />
              </div>
              
              {/* Type Filter */}
              <div className="space-y-2">
                <Label htmlFor="type-filter">Type</Label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="vendor">Vendor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Status Filter */}
              <div className="space-y-2">
                <Label htmlFor="status-filter">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Clear Filters Button - Desktop */}
              <div className="flex items-end">
                <Button 
                  onClick={clearFilters} 
                  variant="outline"
                  className="w-full"
                  disabled={!hasActiveFilters}
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        {/* Desktop Table View */}
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Primary Phone</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>GST Number</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : (
                filteredCustomers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell>{customer.name}</TableCell>
                    <TableCell>{customer.primary_phone_number}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          customer.type === "customer" ? "default" : "secondary"
                        }
                      >
                        {customer.type}
                      </Badge>
                    </TableCell>
                    <TableCell>{customer.gst_number}</TableCell>
                    <TableCell>
                      <Badge
                        variant={customer.is_active ? "default" : "destructive"}
                      >
                        {customer.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDialog(customer)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden p-4">
          {loading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Loading...</p>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                {customers.length === 0 ? "No customers found." : "No customers match the current filters."}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredCustomers.map((customer) => (
                <Card key={customer.id} className="border">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">{customer.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {customer.primary_phone_number}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            customer.type === "customer" ? "default" : "secondary"
                          }
                        >
                          {customer.type}
                        </Badge>
                        <Badge
                          variant={customer.is_active ? "default" : "destructive"}
                        >
                          {customer.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="space-y-2 mb-4">
                      {customer.address && (
                        <div>
                          <p className="text-xs text-muted-foreground">Address</p>
                          <p className="text-sm">{customer.address}</p>
                        </div>
                      )}
                      {customer.gst_number && (
                        <div>
                          <p className="text-xs text-muted-foreground">GST Number</p>
                          <p className="text-sm">{customer.gst_number}</p>
                        </div>
                      )}
                      {customer.manager_name && (
                        <div>
                          <p className="text-xs text-muted-foreground">Manager</p>
                          <p className="text-sm">
                            {customer.manager_name}
                            {customer.manager_phone_number && (
                              <span className="text-muted-foreground"> • {customer.manager_phone_number}</span>
                            )}
                          </p>
                        </div>
                      )}
                      {customer.comments && (
                        <div>
                          <p className="text-xs text-muted-foreground">Comments</p>
                          <p className="text-sm">{customer.comments}</p>
                        </div>
                      )}
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openDialog(customer)}
                      className="w-full"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Customer
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
