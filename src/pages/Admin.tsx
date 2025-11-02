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
import { Edit, Trash2, Plus, Building, Download, AlertTriangle, Clock, DollarSign, User, TrendingUp, TrendingDown } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import * as XLSX from 'exceljs';
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

const GSTSettingsManager = () => {
  const { toast } = useToast();
  const [sgstPercent, setSgstPercent] = useState(14);
  const [cgstPercent, setCgstPercent] = useState(14);
  const [cessPercent, setCessPercent] = useState(0);

  useEffect(() => {
    // Load from localStorage on mount
    const savedSgst = localStorage.getItem('default_sgst_percentage');
    const savedCgst = localStorage.getItem('default_cgst_percentage');
    const savedCess = localStorage.getItem('default_cess_percentage');
    
    if (savedSgst) setSgstPercent(parseFloat(savedSgst));
    if (savedCgst) setCgstPercent(parseFloat(savedCgst));
    if (savedCess) setCessPercent(parseFloat(savedCess));
  }, []);

  const saveSettings = () => {
    localStorage.setItem('default_sgst_percentage', sgstPercent.toString());
    localStorage.setItem('default_cgst_percentage', cgstPercent.toString());
    localStorage.setItem('default_cess_percentage', cessPercent.toString());
    toast({ title: "Success", description: "Default GST rates saved successfully." });
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
        <p className="text-muted-foreground text-sm sm:text-base">
          Set default GST rates that will be used when creating new bills. You can still override them per bill.
        </p>
      </div>
      
      <Card>
        <CardHeader className="pb-3 sm:pb-6">
          <CardTitle className="text-lg sm:text-xl">Default GST Rates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sgst" className="text-sm font-medium">SGST (%)</Label>
                <Input 
                  id="sgst"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={sgstPercent}
                  onChange={(e) => setSgstPercent(parseFloat(e.target.value) || 0)}
                  placeholder="14.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cgst" className="text-sm font-medium">CGST (%)</Label>
                <Input 
                  id="cgst"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={cgstPercent}
                  onChange={(e) => setCgstPercent(parseFloat(e.target.value) || 0)}
                  placeholder="14.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cess" className="text-sm font-medium">CESS (%)</Label>
                <Input 
                  id="cess"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={cessPercent}
                  onChange={(e) => setCessPercent(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="flex justify-end pt-4">
              <Button onClick={saveSettings} size="sm">
                Save Settings
              </Button>
            </div>
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>Current Settings:</strong> SGST: {sgstPercent}%, CGST: {cgstPercent}%, CESS: {cessPercent}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

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

const DatabaseExportManager = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const exportToSQL = async () => {
    setLoading(true);
    try {
      let sqlContent = `-- Database Backup Export
-- Generated on: ${new Date().toISOString()}
-- 
-- WARNING: This file contains all data from your database.
-- Review before executing in production.

SET session_replication_role = replica;

`;

      // Define all tables to export (in order to respect foreign key constraints)
      const tables = [
        'roles',
        'users',
        'user_roles',
        'expense_categories',
        'seller_info',
        'customers',
        'products',
        'inventory',
        'bills',
        'bill_items',
        'orders',
        'order_items',
        'inventory_transactions',
        'transactions',
        'damaged_stock_log',
        'credit'
      ];

      // Export each table
      for (const tableName of tables) {
        try {
          const { data, error } = await supabase.from(tableName).select('*');
          
          if (error) {
            console.warn(`Failed to export table ${tableName}:`, error.message);
            continue;
          }

          if (data && data.length > 0) {
            sqlContent += `-- Table: ${tableName}\n`;
            sqlContent += `DELETE FROM ${tableName};\n`;
            
            for (const row of data) {
              const columns = Object.keys(row);
              const values = columns.map(col => {
                const value = row[col];
                if (value === null || value === undefined) return 'NULL';
                if (typeof value === 'string') {
                  // Escape single quotes in strings
                  return `'${value.replace(/'/g, "''")}'`;
                }
                if (typeof value === 'boolean') return value ? 'true' : 'false';
                if (typeof value === 'object') {
                  // Handle JSON objects/arrays
                  return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
                }
                if (value instanceof Date) {
                  return `'${value.toISOString()}'`;
                }
                return value;
              });
              
              sqlContent += `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`;
            }
            sqlContent += '\n';
          }
        } catch (tableError) {
          console.warn(`Error processing table ${tableName}:`, tableError);
          sqlContent += `-- Error exporting table ${tableName}: ${tableError}\n\n`;
          continue;
        }
      }

      sqlContent += `SET session_replication_role = DEFAULT;\n`;
      sqlContent += `-- End of backup\n`;

      // Create and download the SQL file
      const blob = new Blob([sqlContent], { type: 'text/plain;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Generate filename with current date
      const today = new Date().toISOString().split('T')[0];
      link.download = `database_backup_${today}.sql`;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "SQL Backup Created",
        description: "Database backup SQL file has been downloaded.",
        variant: "default",
      });
    } catch (error) {
      console.error('SQL Export error:', error);
      toast({
        title: "SQL Export Failed",
        description: "Failed to create SQL backup. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const exportDatabase = async () => {
    setLoading(true);
    try {
      // Create a new workbook
      const workbook = new XLSX.Workbook();
      
      // Define all tables to export
      const tables = [
        'customers',
        'products', 
        'inventory',
        'bills',
        'bill_items',
        'orders',
        'order_items',
        'inventory_transactions',
        'expense_categories',
        'transactions',
        'damaged_stock_log',
        'credit',
        'seller_info',
        'roles',
        'user_roles'
      ];

      // Export each table as a separate worksheet
      for (const tableName of tables) {
        try {
          const { data, error } = await supabase.from(tableName).select('*');
          
          if (error) {
            console.warn(`Failed to export table ${tableName}:`, error.message);
            continue;
          }

          if (data && data.length > 0) {
            // Create worksheet
            const worksheet = workbook.addWorksheet(tableName);
            
            // Get column headers from the first row
            const headers = Object.keys(data[0]);
            
            // Add headers
            worksheet.addRow(headers);
            
            // Add data rows
            data.forEach(row => {
              const values = headers.map(header => {
                const value = row[header];
                // Handle different data types
                if (value === null || value === undefined) return '';
                if (typeof value === 'object') return JSON.stringify(value);
                return value;
              });
              worksheet.addRow(values);
            });
            
            // Style the header row
            const headerRow = worksheet.getRow(1);
            headerRow.font = { bold: true };
            headerRow.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFE6E6FA' }
            };
            
            // Auto-fit columns
            worksheet.columns.forEach(column => {
              column.width = 15;
            });
          }
        } catch (tableError) {
          console.warn(`Error processing table ${tableName}:`, tableError);
          continue;
        }
      }

      // Generate Excel file
      const buffer = await workbook.xlsx.writeBuffer();
      
      // Create download link
      const blob = new Blob([buffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Generate filename with current date
      const today = new Date().toISOString().split('T')[0];
      link.download = `database_export_${today}.xlsx`;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export Successful",
        description: "Database has been exported successfully.",
        variant: "default",
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export database. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
        <p className="text-muted-foreground text-sm sm:text-base">
          Export all database tables to an Excel file for backup or analysis.
        </p>
      </div>
      
      <Card>
        <CardHeader className="pb-3 sm:pb-6">
          <CardTitle className="text-lg sm:text-xl">Database Export</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Building className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-sm text-muted-foreground mb-6">
              Choose your preferred backup format for the complete database.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                onClick={exportDatabase} 
                disabled={loading}
                className="gap-2"
                variant="default"
              >
                <Download className="h-4 w-4" />
                {loading ? "Exporting..." : "Export as Excel"}
              </Button>
              <Button 
                onClick={exportToSQL} 
                disabled={loading}
                className="gap-2"
                variant="outline"
              >
                <Download className="h-4 w-4" />
                {loading ? "Exporting..." : "Export as SQL"}
              </Button>
            </div>
            <div className="mt-4 text-xs text-muted-foreground">
              <p><strong>Excel:</strong> Ideal for data analysis and viewing</p>
              <p><strong>SQL:</strong> Perfect for database backup and restoration</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const InsightsManager = () => {
  const { toast } = useToast();
  const [outstandingBills, setOutstandingBills] = useState<any[]>([]);
  const [productOrderData, setProductOrderData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProductOrderData = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('order_items')
        .select(`
          product_id,
          lots,
          units,
          orders!inner (
            created_at
          ),
          products (
            name,
            lot_size
          )
        `);

      if (error) {
        toast({ 
          title: "Error fetching product data", 
          description: error.message, 
          variant: "destructive" 
        });
        return;
      }

      // Calculate date ranges
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

      // Calculate quantities per product with time periods
      const productMap = new Map();
      
      data?.forEach(item => {
        // Type check: products and orders should be objects, not arrays
        const products = Array.isArray(item.products) ? item.products[0] : item.products;
        const orders = Array.isArray(item.orders) ? item.orders[0] : item.orders;
        
        if (products && orders) {
          const productId = item.product_id;
          const lotSize = products.lot_size || 1;
          const totalQuantity = (item.lots * lotSize) + item.units;
          const orderDate = new Date(orders.created_at);
          
          if (!productMap.has(productId)) {
            productMap.set(productId, {
              name: products.name,
              totalQuantity: 0,
              thisMonth: 0,
              lastMonth: 0,
              orderCount: 0
            });
          }
          
          const product = productMap.get(productId);
          product.totalQuantity += totalQuantity;
          product.orderCount += 1;
          
          // Check if order is from this month
          if (orderDate >= thisMonthStart) {
            product.thisMonth += totalQuantity;
          }
          
          // Check if order is from last month
          if (orderDate >= lastMonthStart && orderDate <= lastMonthEnd) {
            product.lastMonth += totalQuantity;
          }
        }
      });

      const productArray = Array.from(productMap.values())
        .sort((a, b) => b.totalQuantity - a.totalQuantity);
      
      setProductOrderData(productArray);
    } catch (error) {
      toast({ 
        title: "Error", 
        description: "Failed to fetch product order data", 
        variant: "destructive" 
      });
    }
  }, [toast]);

  const fetchOutstandingBills = useCallback(async () => {
    try {
      // Get bills that are outstanding for more than 15 days
      const fifteenDaysAgo = new Date();
      fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
      
      const { data, error } = await supabase
        .from('bills')
        .select(`
          id,
          invoice_number,
          total_amount,
          paid_amount,
          status,
          date_of_bill,
          created_at,
          customers (
            id,
            name,
            primary_phone_number,
            outstanding_balance
          )
        `)
        .in('status', ['outstanding', 'partial'])
        .lt('date_of_bill', fifteenDaysAgo.toISOString())
        .order('date_of_bill', { ascending: true });

      if (error) {
        toast({ 
          title: "Error fetching outstanding bills", 
          description: error.message, 
          variant: "destructive" 
        });
      } else {
        setOutstandingBills(data || []);
      }
    } catch (error) {
      toast({ 
        title: "Error", 
        description: "Failed to fetch outstanding bills", 
        variant: "destructive" 
      });
    }
  }, [toast]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await Promise.all([
        fetchOutstandingBills(),
        fetchProductOrderData()
      ]);
      setLoading(false);
    };
    fetchData();
  }, [fetchOutstandingBills, fetchProductOrderData]);

  const getDaysOverdue = (billDate: string) => {
    const billDateObj = new Date(billDate);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - billDateObj.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getOutstandingAmount = (total: number, paid: number) => {
    return total - paid;
  };

  const getTotalOutstandingAmount = () => {
    return outstandingBills.reduce((total, bill) => {
      return total + getOutstandingAmount(bill.total_amount, bill.paid_amount);
    }, 0);
  };

  const getTotalOutstandingBills = () => {
    return outstandingBills.length;
  };

  const getCustomersWithOutstandingBills = () => {
    const customerMap = new Map();
    
    outstandingBills.forEach(bill => {
      if (bill.customers) {
        const customerId = bill.customers.id;
        if (!customerMap.has(customerId)) {
          customerMap.set(customerId, {
            id: customerId,
            name: bill.customers.name,
            phone: bill.customers.primary_phone_number,
            outstanding_balance: bill.customers.outstanding_balance,
            bills: [],
            total_outstanding: 0,
            bill_count: 0
          });
        }
        
        const customer = customerMap.get(customerId);
        const outstandingAmount = getOutstandingAmount(bill.total_amount, bill.paid_amount);
        
        customer.bills.push({
          id: bill.id,
          invoice_number: bill.invoice_number,
          date_of_bill: bill.date_of_bill,
          total_amount: bill.total_amount,
          paid_amount: bill.paid_amount,
          outstanding_amount: outstandingAmount,
          days_overdue: getDaysOverdue(bill.date_of_bill)
        });
        
        customer.total_outstanding += outstandingAmount;
        customer.bill_count += 1;
      }
    });
    
    return Array.from(customerMap.values()).sort((a, b) => b.total_outstanding - a.total_outstanding);
  };

  const getMostOrderedProducts = (limit = 5) => {
    return productOrderData.slice(0, limit);
  };

  const getLeastOrderedProducts = (limit = 5) => {
    return productOrderData.slice(-limit).reverse();
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
        <p className="text-muted-foreground text-sm sm:text-base">
          Monitor outstanding bills and customer payment status for better cash flow management.
        </p>
        <Button 
          onClick={async () => {
            setLoading(true);
            await Promise.all([
              fetchOutstandingBills(),
              fetchProductOrderData()
            ]);
            setLoading(false);
          }}
          variant="outline"
          size="sm"
          className="w-full sm:w-auto"
          disabled={loading}
        >
          <Clock className="h-4 w-4 mr-2" />
          {loading ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Outstanding</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{getTotalOutstandingAmount().toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Across all overdue bills
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue Bills</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getTotalOutstandingBills()}</div>
            <p className="text-xs text-muted-foreground">
              Bills older than 15 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Affected Customers</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getCustomersWithOutstandingBills().length}</div>
            <p className="text-xs text-muted-foreground">
              Customers with overdue bills
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Product Analytics Score Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Most Ordered Products</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <p className="text-sm text-muted-foreground">Loading...</p>
              </div>
            ) : productOrderData.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">No order data available</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={getMostOrderedProducts()} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="name" 
                        tick={{ fontSize: 10 }}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip 
                        formatter={(value, name) => {
                          const labels = {
                            totalQuantity: 'Total Units',
                            thisMonth: 'This Month',
                            lastMonth: 'Last Month'
                          };
                          return [value, labels[name] || name];
                        }}
                        labelFormatter={(label) => `Product: ${label}`}
                      />
                      <Legend 
                        wrapperStyle={{ fontSize: '12px' }}
                        formatter={(value) => {
                          const labels = {
                            totalQuantity: 'Total Units',
                            thisMonth: 'This Month',
                            lastMonth: 'Last Month'
                          };
                          return labels[value] || value;
                        }}
                      />
                      <Bar dataKey="totalQuantity" fill="hsl(142 52% 45%)" name="totalQuantity" />
                      <Bar dataKey="thisMonth" fill="hsl(176 48% 35%)" name="thisMonth" />
                      <Bar dataKey="lastMonth" fill="hsl(38 92% 50%)" name="lastMonth" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">Top Products Details:</h4>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {getMostOrderedProducts(3).map((product, index) => (
                      <div key={index} className="flex items-center justify-between text-xs bg-muted p-2 rounded">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{product.name}</p>
                          <p className="text-muted-foreground">#{index + 1} Most Ordered</p>
                        </div>
                        <div className="text-right space-y-1">
                          <div className="flex gap-2 text-xs">
                            <span className="text-accent">Total: {product.totalQuantity}</span>
                          </div>
                          <div className="flex gap-2 text-xs">
                            <span className="text-primary">This: {product.thisMonth}</span>
                            <span className="text-warning">Last: {product.lastMonth}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Least Ordered Products</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <p className="text-sm text-muted-foreground">Loading...</p>
              </div>
            ) : productOrderData.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">No order data available</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={getLeastOrderedProducts()} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="name" 
                        tick={{ fontSize: 10 }}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip 
                        formatter={(value, name) => {
                          const labels = {
                            totalQuantity: 'Total Units',
                            thisMonth: 'This Month',
                            lastMonth: 'Last Month'
                          };
                          return [value, labels[name] || name];
                        }}
                        labelFormatter={(label) => `Product: ${label}`}
                      />
                      <Legend 
                        wrapperStyle={{ fontSize: '12px' }}
                        formatter={(value) => {
                          const labels = {
                            totalQuantity: 'Total Units',
                            thisMonth: 'This Month',
                            lastMonth: 'Last Month'
                          };
                          return labels[value] || value;
                        }}
                      />
                      <Bar dataKey="totalQuantity" fill="hsl(0 84.2% 60.2%)" name="totalQuantity" />
                      <Bar dataKey="thisMonth" fill="hsl(176 48% 35%)" name="thisMonth" />
                      <Bar dataKey="lastMonth" fill="hsl(38 92% 50%)" name="lastMonth" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">Bottom Products Details:</h4>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {getLeastOrderedProducts(3).map((product, index) => (
                      <div key={index} className="flex items-center justify-between text-xs bg-muted p-2 rounded">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{product.name}</p>
                          <p className="text-muted-foreground">#{index + 1} Least Ordered</p>
                        </div>
                        <div className="text-right space-y-1">
                          <div className="flex gap-2 text-xs">
                            <span className="text-destructive">Total: {product.totalQuantity}</span>
                          </div>
                          <div className="flex gap-2 text-xs">
                            <span className="text-primary">This: {product.thisMonth}</span>
                            <span className="text-warning">Last: {product.lastMonth}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Customer Cards */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">Outstanding Bills by Customer</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <p className="text-sm text-muted-foreground">Loading outstanding bills...</p>
            </div>
          ) : outstandingBills.length === 0 ? (
            <div className="text-center py-8">
              <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">No outstanding bills found.</p>
              <p className="text-xs text-muted-foreground mt-1">All bills are either paid or less than 15 days old.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {getCustomersWithOutstandingBills().map((customer) => (
                <Card key={customer.id} className="border-l-4 border-l-orange-500">
                  <CardContent className="p-4">
                    <div className="flex flex-col lg:flex-row justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <h3 className="font-semibold text-lg">{customer.name}</h3>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          Phone: {customer.phone}
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Total Outstanding</p>
                            <p className="font-semibold text-lg text-orange-600">
                              ₹{customer.total_outstanding.toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Outstanding Bills</p>
                            <p className="font-semibold text-lg text-red-600">
                              {customer.bill_count}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Customer Balance</p>
                            <p className="font-semibold text-lg text-blue-600">
                              ₹{customer.outstanding_balance.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="lg:border-l lg:pl-4">
                        <h4 className="font-medium text-sm text-muted-foreground mb-2">Overdue Bills:</h4>
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                          {customer.bills.map((bill) => (
                            <div key={bill.id} className="flex items-center justify-between text-sm bg-muted p-2 rounded">
                              <div>
                                <p className="font-medium">{bill.invoice_number}</p>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(bill.date_of_bill).toLocaleDateString()}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-medium text-orange-600">
                                  ₹{bill.outstanding_amount.toLocaleString()}
                                </p>
                                <p className="text-xs text-red-600">
                                  {bill.days_overdue} days overdue
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
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
      
      <Tabs defaultValue="seller" className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-auto p-1">
          <TabsTrigger
            value="seller"
            className="text-sm sm:text-base px-4 sm:px-6 py-3 data-[state=active]:bg-background"
          >
            <Building className="h-4 w-4 mr-2" />
            Seller Management
          </TabsTrigger>
          <TabsTrigger
            value="admin-tools"
            className="text-sm sm:text-base px-4 sm:px-6 py-3 data-[state=active]:bg-background"
          >
            <Edit className="h-4 w-4 mr-2" />
            Admin Tools
          </TabsTrigger>
        </TabsList>

        <TabsContent value="seller" className="mt-4 sm:mt-6">
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
                value="gst-settings"
                className="text-xs sm:text-sm px-2 sm:px-4 py-2 data-[state=active]:bg-background"
              >
                <span className="hidden sm:inline">GST Settings</span>
                <span className="sm:hidden">GST</span>
              </TabsTrigger>
              <TabsTrigger
                value="expense-categories"
                className="text-xs sm:text-sm px-2 sm:px-4 py-2 data-[state=active]:bg-background"
              >
                <span className="hidden sm:inline">Expense Categories</span>
                <span className="sm:hidden">Categories</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="products" className="mt-4 sm:mt-6">
              <Products />
            </TabsContent>
            <TabsContent value="seller-info" className="mt-4 sm:mt-6">
              <SellerInfoManager />
            </TabsContent>
            <TabsContent value="gst-settings" className="mt-4 sm:mt-6">
              <GSTSettingsManager />
            </TabsContent>
            <TabsContent value="expense-categories" className="mt-4 sm:mt-6">
              <ExpenseCategoryManager />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="admin-tools" className="mt-4 sm:mt-6">
          <Tabs defaultValue="insights" className="w-full">
            <TabsList className="grid w-full grid-cols-3 h-auto p-1">
              <TabsTrigger
                value="insights"
                className="text-xs sm:text-sm px-2 sm:px-4 py-2 data-[state=active]:bg-background"
              >
                <span className="hidden sm:inline">Insights</span>
                <span className="sm:hidden">Insights</span>
              </TabsTrigger>
              <TabsTrigger
                value="user-management"
                className="text-xs sm:text-sm px-2 sm:px-4 py-2 data-[state=active]:bg-background"
              >
                <span className="hidden sm:inline">User Management</span>
                <span className="sm:hidden">Users</span>
              </TabsTrigger>
              <TabsTrigger
                value="export"
                className="text-xs sm:text-sm px-2 sm:px-4 py-2 data-[state=active]:bg-background"
              >
                <span className="hidden sm:inline">Export</span>
                <span className="sm:hidden">Export</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="insights" className="mt-4 sm:mt-6">
              <InsightsManager />
            </TabsContent>
            <TabsContent value="user-management" className="mt-4 sm:mt-6">
              <UserManagement />
            </TabsContent>
            <TabsContent value="export" className="mt-4 sm:mt-6">
              <DatabaseExportManager />
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  );
};