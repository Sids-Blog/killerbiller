import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  Package, 
  AlertTriangle,
  Loader2,
  IndianRupee,
  TrendingUp,
  Receipt,
  TrendingDown,
  CalendarDays,
  CalendarIcon
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

interface Product {
  id: string;
  name: string;
  price: number;
  min_stock: number;
  current_stock: number;
  lot_size: number;
}

interface Customer {
  id: string;
  name: string;
  outstanding_balance: number;
}

interface DashboardStats {
  total_receivables: number;
  monthly_revenue: number;
  outstanding_bills: number;
  low_stock_items: number;
  daily_revenue: number;
  weekly_revenue: number;
  daily_expense: number;
  weekly_expense: number;
  monthly_expense: number;
}

export const Dashboard = () => {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    
    const statsPromise = supabase.rpc('get_dashboard_stats');
    const extendedStatsPromise = supabase.rpc('get_extended_dashboard_stats');
    const productPromise = supabase.from("products").select("*");
    const inventoryPromise = supabase.from("inventory").select("product_id, quantity");
    const customerPromise = supabase
      .from("customers")
      .select("id, name, outstanding_balance")
      .gt("outstanding_balance", 0)
      .order("outstanding_balance", { ascending: false });

    const [statsRes, extendedStatsRes, productRes, inventoryRes, customerRes] = await Promise.all([
      statsPromise,
      extendedStatsPromise,
      productPromise,
      inventoryPromise,
      customerPromise,
    ]);

    if (statsRes.error || extendedStatsRes.error) {
      toast({ title: "Error fetching dashboard stats", description: statsRes.error?.message || extendedStatsRes.error?.message, variant: "destructive" });
    } else {
      setStats({ ...statsRes.data[0], ...extendedStatsRes.data[0] });
    }

    if (productRes.error) {
      toast({ title: "Error fetching products", description: productRes.error.message, variant: "destructive" });
    } else if (inventoryRes.error) {
      toast({ title: "Error fetching inventory", description: inventoryRes.error.message, variant: "destructive" });
    }
    else {
      const inventoryMap = new Map(inventoryRes.data.map(item => [item.product_id, item.quantity]));
      const productsWithStock = productRes.data.map(product => ({
        ...product,
        current_stock: inventoryMap.get(product.id) || 0,
      }));
      setProducts(productsWithStock);
    }

    if (customerRes.error) {
      toast({ title: "Error fetching customers", description: customerRes.error.message, variant: "destructive" });
    } else {
      setCustomers(customerRes.data || []);
    }

    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your inventory and billing</p>
      </div>

      {/* Revenue & Expense Grid */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-foreground">Financial Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Daily Revenue</CardTitle>
                <IndianRupee className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">₹{(stats.daily_revenue || 0).toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                Today's earnings
                </p>
            </CardContent>
            </Card>
            <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Weekly Revenue</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">₹{(stats.weekly_revenue || 0).toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                Last 7 days
                </p>
            </CardContent>
            </Card>
            <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">₹{(stats.monthly_revenue || 0).toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                Revenue this month
                </p>
            </CardContent>
            </Card>
            <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Daily Expense</CardTitle>
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">₹{(stats.daily_expense || 0).toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                Today's spending
                </p>
            </CardContent>
            </Card>
            <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Weekly Expense</CardTitle>
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">₹{(stats.weekly_expense || 0).toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                Last 7 days
                </p>
            </CardContent>
            </Card>
            <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Monthly Expense</CardTitle>
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">₹{(stats.monthly_expense || 0).toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                Last 30 days
                </p>
            </CardContent>
            </Card>
        </div>
      </div>


      {/* Operational Stats Grid */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-foreground">Operational Stats</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Receivables</CardTitle>
                <IndianRupee className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">₹{(stats.total_receivables || 0).toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                Amount to be collected
                </p>
            </CardContent>
            </Card>
            <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Outstanding Bills</CardTitle>
                <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{stats.outstanding_bills || 0}</div>
                <p className="text-xs text-muted-foreground">
                Unpaid or partially paid bills
                </p>
            </CardContent>
            </Card>
            <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
                <AlertTriangle className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-warning">{stats.low_stock_items || 0}</div>
                <p className="text-xs text-muted-foreground">
                Products needing restock
                </p>
            </CardContent>
            </Card>
        </div>
      </div>


      {/* Product Scorecards */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-foreground">Product Inventory</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {products.map(product => {
            const quantity = product.current_stock;
            const lots = product.lot_size > 0 ? (quantity / product.lot_size).toFixed(1) : 0;
            const status = quantity === 0 ? "destructive" : quantity <= product.min_stock ? "warning" : "default";
            return (
              <Card key={product.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{product.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Current Stock:</span>
                    <Badge variant={status === 'default' ? 'outline' : status === 'warning' ? 'secondary' : 'destructive'}>{quantity} units</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Lots:</span>
                    <span className="font-semibold">{lots}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Min Stock:</span>
                    <span>{product.min_stock}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Inventory Value:</span>
                    <span className="font-semibold">₹{(quantity * product.price).toLocaleString()}</span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Receivables List */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-foreground">Top Outstanding Balances</h2>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Outstanding Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map(customer => (
                <TableRow key={customer.id}>
                  <TableCell>{customer.name}</TableCell>
                  <TableCell className="text-right font-semibold">₹{customer.outstanding_balance.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
};