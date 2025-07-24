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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { Plus, Edit } from "lucide-react";
import { Card } from "@/components/ui/card";

interface Customer {
  id: string;
  name: string;
  primary_phone_number: string;
  address: string;
  gst_number: string;
  manager_name: string;
  manager_phone_number: string;
  comments: string;
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
  const [formData, setFormData] = useState({
    name: "",
    primary_phone_number: "",
    address: "",
    gst_number: "",
    manager_name: "",
    manager_phone_number: "",
    comments: "",
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
      setCustomers(data || []);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Customers</h1>
          <p className="text-muted-foreground">
            Manage your customer information
          </p>
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
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Primary Phone</TableHead>
              <TableHead>GST Number</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : (
              customers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell>{customer.name}</TableCell>
                  <TableCell>{customer.primary_phone_number}</TableCell>
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
      </Card>
    </div>
  );
};
