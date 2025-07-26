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
import { Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";

interface Product {
  id: string;
  name: string;
}

interface DamagedStockLog {
  id: string;
  created_at: string;
  product_id: string;
  quantity: number;
  unit_cost: number;
  total_value: number;
  reason: string;
  status: 'PENDING_ADJUSTMENT' | 'ADJUSTED';
  products: { name: string };
}

export const DamagedStock = () => {
  const { toast } = useToast();
  const [logs, setLogs] = useState<DamagedStockLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<DamagedStockLog[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Filter states
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [productFilter, setProductFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [formData, setFormData] = useState({
    product_id: "",
    quantity: 0,
    unit_cost: 0,
    reason: "",
  });

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("damaged_stock_log")
      .select("*, products(name)")
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

  useEffect(() => {
    fetchLogs();
    fetchProducts();
  }, [fetchLogs, fetchProducts]);

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
    if (!formData.product_id || formData.quantity <= 0 || formData.unit_cost <= 0) {
      toast({ title: "Error", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }

    const { error: logError } = await supabase.from("damaged_stock_log").insert([
      {
        product_id: formData.product_id,
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
    }
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Damaged Stock Log</h1>
          <p className="text-muted-foreground">
            Log and track damaged or unsellable inventory.
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Log Damaged Stock
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Log New Damaged Stock</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Product</Label>
                <Select onValueChange={(value) => setFormData({ ...formData, product_id: value })}>
                  <SelectTrigger><SelectValue placeholder="Select a product" /></SelectTrigger>
                  <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Quantity Damaged</Label>
                <Input type="number" onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Unit Cost (Purchase Price)</Label>
                <Input type="number" onChange={(e) => setFormData({ ...formData, unit_cost: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Reason for Damage</Label>
                <Textarea onChange={(e) => setFormData({ ...formData, reason: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave}>Save Log</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant={"outline"} className="w-full sm:w-auto justify-start text-left font-normal">
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "LLL dd, y")} -{" "}
                        {format(dateRange.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(dateRange.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={setDateRange}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <Select value={productFilter} onValueChange={setProductFilter}>
              <SelectTrigger><SelectValue placeholder="Filter by product" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Products</SelectItem>
                {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue placeholder="Filter by status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="PENDING_ADJUSTMENT">Pending Adjustment</SelectItem>
                <SelectItem value="ADJUSTED">Adjusted</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => { setDateRange(undefined); setProductFilter("all"); setStatusFilter("all"); }} variant="outline">
              Clear Filters
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
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
                <TableRow><TableCell colSpan={8} className="text-center">Loading...</TableCell></TableRow>
              ) : (
                filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>{log.products.name}</TableCell>
                    <TableCell>{new Date(log.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>{log.quantity}</TableCell>
                    <TableCell>₹{log.unit_cost.toFixed(2)}</TableCell>
                    <TableCell>₹{log.total_value.toFixed(2)}</TableCell>
                    <TableCell>{log.reason}</TableCell>
                    <TableCell>
                      <Badge variant={log.status === 'ADJUSTED' ? 'default' : 'destructive'}>
                        {log.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {log.status === 'PENDING_ADJUSTMENT' && (
                        <Button size="sm" onClick={() => handleStatusChange(log.id, 'ADJUSTED')}>
                          Mark as Adjusted
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
