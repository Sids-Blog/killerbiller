import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Edit, Trash2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { Products } from "./Products"; // Import the Products component
import UserManagement from "./UserManagement";
import { useState, useEffect, useCallback } from "react";

interface ExpenseCategory {
  id: string;
  name: string;
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
        <TabsList className="grid w-full grid-cols-3 h-auto p-1">
          <TabsTrigger
            value="products"
            className="text-xs sm:text-sm px-2 sm:px-4 py-2 data-[state=active]:bg-background"
          >
            <span className="hidden sm:inline">Products</span>
            <span className="sm:hidden">Products</span>
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