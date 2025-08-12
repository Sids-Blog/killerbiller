import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Edit, Trash2, Plus, Building } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { Products } from "./Products"; // Import the Products component
import UserManagement from "./UserManagement";
import { useState, useEffect, useCallback } from "react";

interface ExpenseCategory {
  id: string;
  name: string;
}

interface SellerInfo {
  id: string;
  company_name: string;
  address: string;
  contact_number: string;
  gst_number: string;
  email: string;
  bank_account_number: string;
  account_holder_name: string;
  account_no: string;
  branch: string;
  ifsc_code: string;
  created_at: string;
  updated_at: string;
}

const ExpenseCategoryManager = () => {
  const { toast } = useToast();
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);
  const [categoryName, setCategoryName] = useState("");

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("expense_categories").select("*").order("name");
    if (error) {
      toast({ title: "Error fetching categories", description: error.message, variant: "destructive" });
    } else {
      setCategories(data || []);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const openDialog = (category?: ExpenseCategory) => {
    if (category) {
      setEditingCategory(category);
      setCategoryName(category.name);
    } else {
      setEditingCategory(null);
      setCategoryName("");
    }
    setIsDialogOpen(true);
  };

  const saveCategory = async () => {
    if (!categoryName) {
      toast({ title: "Error", description: "Category name cannot be empty.", variant: "destructive" });
      return;
    }

    if (editingCategory) {
      const { error } = await supabase.from("expense_categories").update({ name: categoryName }).eq("id", editingCategory.id);
      if (error) {
        toast({ title: "Error updating category", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Category updated." });
      }
    } else {
      const { error } = await supabase.from("expense_categories").insert([{ name: categoryName }]);
      if (error) {
        toast({ title: "Error creating category", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Category created." });
      }
    }
    fetchCategories();
    setIsDialogOpen(false);
  };

  const deleteCategory = async (categoryId: string) => {
    const { error } = await supabase.from("expense_categories").delete().eq("id", categoryId);
    if (error) {
      toast({ title: "Error deleting category", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Category deleted." });
      fetchCategories();
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
        <p className="text-muted-foreground text-sm sm:text-base">Manage expense categories for tracking payments.</p>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              onClick={() => openDialog()}
              className="w-full sm:w-auto text-sm"
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Category
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[95vw] max-w-md mx-auto">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">
                {editingCategory ? "Edit Category" : "Add New Category"}
              </DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-3">
              <Label htmlFor="categoryName" className="text-sm font-medium">Category Name</Label>
              <Input 
                id="categoryName" 
                value={categoryName} 
                onChange={(e) => setCategoryName(e.target.value)}
                className="text-sm"
                placeholder="Enter category name"
              />
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => setIsDialogOpen(false)}
                className="w-full sm:w-auto text-sm"
                size="sm"
              >
                Cancel
              </Button>
              <Button 
                onClick={saveCategory}
                className="w-full sm:w-auto text-sm"
                size="sm"
              >
                {editingCategory ? "Update" : "Create"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      
      <Card>
        <CardHeader className="pb-3 sm:pb-6">
          <CardTitle className="text-lg sm:text-xl">Expense Categories</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">No categories found. Add your first category to get started.</p>
            </div>
          ) : (
            <div className="space-y-2 sm:space-y-3">
              {categories.map(cat => (
                <div key={cat.id} className="flex justify-between items-center p-3 sm:p-4 bg-muted rounded-lg">
                  <span className="font-medium text-sm sm:text-base truncate pr-2">{cat.name}</span>
                  <div className="flex gap-1 sm:gap-2 flex-shrink-0">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => openDialog(cat)}
                      className="h-8 w-8 sm:h-9 sm:w-9"
                    >
                      <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => deleteCategory(cat.id)}
                      className="h-8 w-8 sm:h-9 sm:w-9 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const SellerInfoManager = () => {
  const { toast } = useToast();
  const [sellerInfo, setSellerInfo] = useState<SellerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<Omit<SellerInfo, "id" | "created_at" | "updated_at">>({
    company_name: "",
    address: "",
    contact_number: "",
    gst_number: "",
    email: "",
    bank_account_number: "",
    account_holder_name: "",
    account_no: "",
    branch: "",
    ifsc_code: "",
  });

  const fetchSellerInfo = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("seller_info").select("*").limit(1).maybeSingle();
    if (error) {
      toast({ title: "Error fetching seller info", description: error.message, variant: "destructive" });
    } else {
      setSellerInfo(data);
      if (data) {
        setFormData({
          company_name: data.company_name,
          address: data.address,
          contact_number: data.contact_number,
          gst_number: data.gst_number || "",
          email: data.email || "",
          bank_account_number: data.bank_account_number,
          account_holder_name: data.account_holder_name,
          account_no: data.account_no,
          branch: data.branch,
          ifsc_code: data.ifsc_code,
        });
      }
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchSellerInfo();
  }, [fetchSellerInfo]);

  const openDialog = () => {
    setIsDialogOpen(true);
  };

  const saveSellerInfo = async () => {
    // Validate required fields (only company name, email, and contact number)
    if (!formData.company_name || !formData.email || !formData.contact_number) {
      toast({ 
        title: "Error", 
        description: "Please fill in Company Name, Email, and Contact Number.", 
        variant: "destructive" 
      });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast({ 
        title: "Error", 
        description: "Please enter a valid email address.", 
        variant: "destructive" 
      });
      return;
    }

    if (sellerInfo) {
      // Update existing record
      const { error } = await supabase
        .from("seller_info")
        .update(formData)
        .eq("id", sellerInfo.id);
      if (error) {
        toast({ title: "Error updating seller info", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Seller information updated." });
      }
    } else {
      // Create new record (should only happen once due to single-row constraint)
      const { error } = await supabase.from("seller_info").insert([formData]);
      if (error) {
        // If there's a constraint violation, it means a record already exists
        if (error.code === '23505') {
          toast({ 
            title: "Error", 
            description: "Seller information already exists. Please refresh the page.", 
            variant: "destructive" 
          });
          fetchSellerInfo(); // Refresh to get the existing record
        } else {
          toast({ title: "Error creating seller info", description: error.message, variant: "destructive" });
        }
      } else {
        toast({ title: "Success", description: "Seller information created." });
      }
    }
    fetchSellerInfo();
    setIsDialogOpen(false);
  };

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
        <p className="text-muted-foreground text-sm sm:text-base">
          Configure your company information for invoices and receipts.
        </p>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              onClick={openDialog}
              className="w-full sm:w-auto text-sm"
              size="sm"
            >
              <Building className="h-4 w-4 mr-2" />
              {sellerInfo ? "Edit Info" : "Add Info"}
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[95vw] max-w-2xl mx-auto max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">
                {sellerInfo ? "Edit Seller Information" : "Add Seller Information"}
              </DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company_name" className="text-sm font-medium">Company Name *</Label>
                  <Input 
                    id="company_name" 
                    value={formData.company_name} 
                    onChange={(e) => handleInputChange('company_name', e.target.value)}
                    placeholder="Enter company name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact_number" className="text-sm font-medium">Contact Number *</Label>
                  <Input 
                    id="contact_number" 
                    value={formData.contact_number} 
                    onChange={(e) => handleInputChange('contact_number', e.target.value)}
                    placeholder="Enter contact number"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="address" className="text-sm font-medium">Address</Label>
                <Textarea 
                  id="address" 
                  value={formData.address} 
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  placeholder="Enter complete address (optional)"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gst_number" className="text-sm font-medium">GST Number</Label>
                  <Input 
                    id="gst_number" 
                    value={formData.gst_number} 
                    onChange={(e) => handleInputChange('gst_number', e.target.value)}
                    placeholder="Enter GST number (optional)"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">Email *</Label>
                  <Input 
                    id="email" 
                    type="email"
                    value={formData.email} 
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="Enter email address"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bank_account_number" className="text-sm font-medium">Bank Account Number</Label>
                  <Input 
                    id="bank_account_number" 
                    value={formData.bank_account_number} 
                    onChange={(e) => handleInputChange('bank_account_number', e.target.value)}
                    placeholder="Enter bank account number (optional)"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="account_holder_name" className="text-sm font-medium">Account Holder Name</Label>
                  <Input 
                    id="account_holder_name" 
                    value={formData.account_holder_name} 
                    onChange={(e) => handleInputChange('account_holder_name', e.target.value)}
                    placeholder="Enter account holder name (optional)"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="account_no" className="text-sm font-medium">Account No</Label>
                  <Input 
                    id="account_no" 
                    value={formData.account_no} 
                    onChange={(e) => handleInputChange('account_no', e.target.value)}
                    placeholder="Enter account number (optional)"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="branch" className="text-sm font-medium">Branch</Label>
                  <Input 
                    id="branch" 
                    value={formData.branch} 
                    onChange={(e) => handleInputChange('branch', e.target.value)}
                    placeholder="Enter branch name (optional)"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ifsc_code" className="text-sm font-medium">IFSC Code</Label>
                  <Input 
                    id="ifsc_code" 
                    value={formData.ifsc_code} 
                    onChange={(e) => handleInputChange('ifsc_code', e.target.value)}
                    placeholder="Enter IFSC code (optional)"
                  />
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => setIsDialogOpen(false)}
                className="w-full sm:w-auto text-sm"
                size="sm"
              >
                Cancel
              </Button>
              <Button 
                onClick={saveSellerInfo}
                className="w-full sm:w-auto text-sm"
                size="sm"
              >
                {sellerInfo ? "Update" : "Create"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      
      <Card>
        <CardHeader className="pb-3 sm:pb-6">
          <CardTitle className="text-lg sm:text-xl">Seller Information</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          ) : !sellerInfo ? (
            <div className="text-center py-8">
              <Building className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-sm text-muted-foreground mb-4">No seller information found. Add your company details to get started.</p>
              <Button onClick={openDialog} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Seller Info
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground">Company Name</h3>
                  <p className="text-sm">{sellerInfo.company_name}</p>
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground">Contact Number</h3>
                  <p className="text-sm">{sellerInfo.contact_number}</p>
                </div>
              </div>
              
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground">Address</h3>
                <p className="text-sm">{sellerInfo.address}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground">GST Number</h3>
                  <p className="text-sm">{sellerInfo.gst_number || "N/A"}</p>
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground">Email</h3>
                  <p className="text-sm">{sellerInfo.email || "N/A"}</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold text-sm text-muted-foreground mb-3">Bank Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium text-xs text-muted-foreground">Account Holder</h4>
                    <p className="text-sm">{sellerInfo.account_holder_name}</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-xs text-muted-foreground">Account Number</h4>
                    <p className="text-sm">{sellerInfo.account_no}</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-xs text-muted-foreground">Branch</h4>
                    <p className="text-sm">{sellerInfo.branch}</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-xs text-muted-foreground">IFSC Code</h4>
                    <p className="text-sm">{sellerInfo.ifsc_code}</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button onClick={openDialog} size="sm" variant="outline">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Information
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export const Admin = () => {
  // The ProtectedRoute component already ensures that only admins can access this page.
  // No need for a separate loading or access check here.

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Admin Panel</h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          Manage products and other administrative settings.
        </p>
      </div>
      
      <Tabs defaultValue="products" className="w-full">
        <TabsList className="grid w-full grid-cols-4 h-auto p-1">
          <TabsTrigger
            value="products"
            className="text-xs sm:text-sm px-2 sm:px-4 py-2 data-[state=active]:bg-background"
          >
            <span className="hidden sm:inline">Products</span>
            <span className="sm:hidden">Products</span>
          </TabsTrigger>
          <TabsTrigger
            value="seller-info"
            className="text-xs sm:text-sm px-2 sm:px-4 py-2 data-[state=active]:bg-background"
          >
            <span className="hidden sm:inline">Seller Info</span>
            <span className="sm:hidden">Seller</span>
          </TabsTrigger>
          <TabsTrigger
            value="expense-categories"
            className="text-xs sm:text-sm px-2 sm:px-4 py-2 data-[state=active]:bg-background"
          >
            <span className="hidden sm:inline">Expense Categories</span>
            <span className="sm:hidden">Categories</span>
          </TabsTrigger>
          <TabsTrigger
            value="user-management"
            className="text-xs sm:text-sm px-2 sm:px-4 py-2 data-[state=active]:bg-background"
          >
            <span className="hidden sm:inline">User Management</span>
            <span className="sm:hidden">Users</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="mt-4 sm:mt-6">
          <Products />
        </TabsContent>
        <TabsContent value="seller-info" className="mt-4 sm:mt-6">
          <SellerInfoManager />
        </TabsContent>
        <TabsContent value="expense-categories" className="mt-4 sm:mt-6">
          <ExpenseCategoryManager />
        </TabsContent>
        <TabsContent value="user-management" className="mt-4 sm:mt-6">
          <UserManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
};