import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    LineChart,
    Line,
    AreaChart,
    Area,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from "recharts";
import {
    TrendingUp,
    TrendingDown,
    DollarSign,
    AlertTriangle,
    Calendar,
    Filter,
    Download,
    User,
    Building,
    Tag,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import {
    formatCurrency,
    formatPercentage,
    groupTransactionsByMonth,
    getTopCustomers,
    getExpensesByCategory,
    getDateRangePreset,
    type Transaction,
    type MonthlyData,
} from "@/lib/financialUtils";
import * as XLSX from "exceljs";

interface Customer {
    id: string;
    name: string;
}

interface Product {
    id: string;
    name: string;
}

interface ExpenseCategory {
    id: string;
    name: string;
}

interface FinancialStats {
    total_revenue: number;
    total_expenses: number;
    net_profit: number;
    profit_margin: number;
    outstanding_receivables: number;
    transaction_count: number;
}

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export const FinancialAnalytics = () => {
    const { toast } = useToast();

    // Filter states
    const [datePreset, setDatePreset] = useState("month");
    const [startDate, setStartDate] = useState<Date | null>(null);
    const [endDate, setEndDate] = useState<Date | null>(null);
    const [selectedVendors, setSelectedVendors] = useState<string[]>([]);
    const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
    const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

    // Data states
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<FinancialStats | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [vendors, setVendors] = useState<Customer[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<ExpenseCategory[]>([]);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    // Fetch reference data
    useEffect(() => {
        fetchReferenceData();
    }, []);

    // Fetch analytics data when filters change
    useEffect(() => {
        fetchAnalyticsData();
    }, [datePreset, startDate, endDate, selectedVendors, selectedCustomers, selectedProducts, selectedCategories]);

    const fetchReferenceData = async () => {
        try {
            const [customersRes, vendorsRes, productsRes, categoriesRes] = await Promise.all([
                supabase.from("customers").select("id, name").eq("type", "customer").eq("is_active", true),
                supabase.from("customers").select("id, name").eq("type", "vendor").eq("is_active", true),
                supabase.from("products").select("id, name"),
                supabase.from("expense_categories").select("id, name"),
            ]);

            if (customersRes.data) setCustomers(customersRes.data);
            if (vendorsRes.data) setVendors(vendorsRes.data);
            if (productsRes.data) setProducts(productsRes.data);
            if (categoriesRes.data) setCategories(categoriesRes.data);
        } catch (error) {
            console.error("Error fetching reference data:", error);
        }
    };

    const fetchAnalyticsData = async () => {
        setLoading(true);
        try {
            // Get date range
            let start: Date, end: Date;
            if (datePreset === "custom" && startDate && endDate) {
                start = startDate;
                end = endDate;
            } else {
                const range = getDateRangePreset(datePreset);
                start = range.start;
                end = range.end;
            }

            // If product filter is selected, first get bill_ids that contain those products
            let billIdsWithProducts: string[] | null = null;
            if (selectedProducts.length > 0) {
                const { data: billItems } = await supabase
                    .from("bill_items")
                    .select("bill_id")
                    .in("product_id", selectedProducts);

                if (billItems) {
                    billIdsWithProducts = [...new Set(billItems.map(item => item.bill_id))];
                }
            }

            // Fetch transactions
            let query = supabase
                .from("transactions")
                .select("*")
                .gte("date_of_transaction", start.toISOString())
                .lte("date_of_transaction", end.toISOString())
                .order("date_of_transaction", { ascending: false });

            if (selectedVendors.length > 0) {
                query = query.in("vendor_id", selectedVendors);
            }
            if (selectedCustomers.length > 0) {
                query = query.in("customer_id", selectedCustomers);
            }
            if (selectedCategories.length > 0) {
                query = query.in("category_id", selectedCategories);
            }
            // Filter by bill_ids if product filter is active
            if (billIdsWithProducts && billIdsWithProducts.length > 0) {
                query = query.in("bill_id", billIdsWithProducts);
            } else if (selectedProducts.length > 0 && (!billIdsWithProducts || billIdsWithProducts.length === 0)) {
                // If product filter is active but no bills found, return empty results
                setTransactions([]);
                setStats({
                    total_revenue: 0,
                    total_expenses: 0,
                    net_profit: 0,
                    profit_margin: 0,
                    outstanding_receivables: 0,
                    transaction_count: 0,
                });
                setMonthlyData([]);
                setLoading(false);
                return;
            }

            const { data: transactionsData, error: transactionsError } = await query;

            if (transactionsError) throw transactionsError;

            setTransactions(transactionsData || []);

            // Calculate stats
            const revenue = (transactionsData || [])
                .filter((t) => t.type === "revenue")
                .reduce((sum, t) => sum + t.amount, 0);

            const expenses = (transactionsData || [])
                .filter((t) => t.type === "expense")
                .reduce((sum, t) => sum + t.amount, 0);

            const netProfit = revenue - expenses;
            const profitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

            // Get outstanding receivables
            const { data: billsData } = await supabase
                .from("bills")
                .select("total_amount, paid_amount")
                .in("status", ["outstanding", "partial"]);

            const outstandingReceivables = (billsData || []).reduce(
                (sum, bill) => sum + (bill.total_amount - bill.paid_amount),
                0
            );

            setStats({
                total_revenue: revenue,
                total_expenses: expenses,
                net_profit: netProfit,
                profit_margin: profitMargin,
                outstanding_receivables: outstandingReceivables,
                transaction_count: transactionsData?.length || 0,
            });

            // Generate monthly data
            const monthly = groupTransactionsByMonth(transactionsData || []);
            setMonthlyData(monthly);
        } catch (error) {
            console.error("Error fetching analytics data:", error);
            toast({
                title: "Error",
                description: "Failed to fetch analytics data",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const handleDatePresetChange = (value: string) => {
        setDatePreset(value);
        if (value !== "custom") {
            setStartDate(null);
            setEndDate(null);
        }
    };

    const handleResetFilters = () => {
        setDatePreset("month");
        setStartDate(null);
        setEndDate(null);
        setSelectedVendors([]);
        setSelectedCustomers([]);
        setSelectedProducts([]);
        setSelectedCategories([]);
    };

    const exportToExcel = async () => {
        try {
            const workbook = new XLSX.Workbook();
            const worksheet = workbook.addWorksheet("Transactions");

            // Add headers
            worksheet.columns = [
                { header: "Date", key: "date", width: 15 },
                { header: "Type", key: "type", width: 10 },
                { header: "Amount", key: "amount", width: 15 },
                { header: "Description", key: "description", width: 30 },
            ];

            // Add data
            transactions.forEach((t) => {
                worksheet.addRow({
                    date: new Date(t.date_of_transaction).toLocaleDateString(),
                    type: t.type,
                    amount: t.amount,
                    description: t.description || "",
                });
            });

            // Generate file
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], {
                type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `financial_analytics_${new Date().toISOString().split("T")[0]}.xlsx`;
            link.click();
            window.URL.revokeObjectURL(url);

            toast({
                title: "Success",
                description: "Data exported successfully",
            });
        } catch (error) {
            console.error("Export error:", error);
            toast({
                title: "Error",
                description: "Failed to export data",
                variant: "destructive",
            });
        }
    };

    const topCustomers = getTopCustomers(transactions, customers, 5);
    const expensesByCategory = getExpensesByCategory(transactions, categories);

    // Pagination
    const totalPages = Math.ceil(transactions.length / itemsPerPage);
    const paginatedTransactions = transactions.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    if (loading) {
        return (
            <div className="flex justify-center items-center py-12">
                <p className="text-muted-foreground">Loading analytics...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Filters Section */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Filter className="h-5 w-5" />
                        Filters
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                            <div className="space-y-2">
                                <Label>Date Range</Label>
                                <Select value={datePreset} onValueChange={handleDatePresetChange}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="today">Today</SelectItem>
                                        <SelectItem value="week">This Week</SelectItem>
                                        <SelectItem value="month">This Month</SelectItem>
                                        <SelectItem value="quarter">This Quarter</SelectItem>
                                        <SelectItem value="year">This Year</SelectItem>
                                        <SelectItem value="custom">Custom Range</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {datePreset === "custom" && (
                                <>
                                    <div className="space-y-2">
                                        <Label>Start Date</Label>
                                        <input
                                            type="date"
                                            className="w-full px-3 py-2 border rounded-md"
                                            onChange={(e) => setStartDate(new Date(e.target.value))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>End Date</Label>
                                        <input
                                            type="date"
                                            className="w-full px-3 py-2 border rounded-md"
                                            onChange={(e) => setEndDate(new Date(e.target.value))}
                                        />
                                    </div>
                                </>
                            )}

                            <div className="flex items-end gap-2">
                                <Button onClick={handleResetFilters} variant="outline" size="sm">
                                    Reset Filters
                                </Button>
                                <Button onClick={exportToExcel} variant="outline" size="sm">
                                    <Download className="h-4 w-4 mr-2" />
                                    Export
                                </Button>
                            </div>
                        </div>

                        {/* Additional Filters Row */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <User className="h-4 w-4" />
                                    Customer
                                </Label>
                                <Select
                                    value={selectedCustomers[0] || "all"}
                                    onValueChange={(value) => setSelectedCustomers(value === "all" ? [] : [value])}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="All Customers" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Customers</SelectItem>
                                        {customers.map((customer) => (
                                            <SelectItem key={customer.id} value={customer.id}>
                                                {customer.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <Building className="h-4 w-4" />
                                    Vendor
                                </Label>
                                <Select
                                    value={selectedVendors[0] || "all"}
                                    onValueChange={(value) => setSelectedVendors(value === "all" ? [] : [value])}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="All Vendors" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Vendors</SelectItem>
                                        {vendors.map((vendor) => (
                                            <SelectItem key={vendor.id} value={vendor.id}>
                                                {vendor.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <Tag className="h-4 w-4" />
                                    Product
                                </Label>
                                <Select
                                    value={selectedProducts[0] || "all"}
                                    onValueChange={(value) => setSelectedProducts(value === "all" ? [] : [value])}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="All Products" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Products</SelectItem>
                                        {products.map((product) => (
                                            <SelectItem key={product.id} value={product.id}>
                                                {product.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <Tag className="h-4 w-4" />
                                    Expense Category
                                </Label>
                                <Select
                                    value={selectedCategories[0] || "all"}
                                    onValueChange={(value) => setSelectedCategories(value === "all" ? [] : [value])}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="All Categories" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Categories</SelectItem>
                                        {categories.map((category) => (
                                            <SelectItem key={category.id} value={category.id}>
                                                {category.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Scorecard Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-green-500" />
                            Total Revenue
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                            {formatCurrency(stats?.total_revenue || 0)}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                            Total Expenses
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">
                            {formatCurrency(stats?.total_expenses || 0)}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            {(stats?.net_profit || 0) >= 0 ? (
                                <TrendingUp className="h-4 w-4 text-green-500" />
                            ) : (
                                <TrendingDown className="h-4 w-4 text-red-500" />
                            )}
                            Net Profit/Loss
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div
                            className={`text-2xl font-bold ${(stats?.net_profit || 0) >= 0 ? "text-green-600" : "text-red-600"
                                }`}
                        >
                            {formatCurrency(stats?.net_profit || 0)}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Profit Margin
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div
                            className={`text-2xl font-bold ${(stats?.profit_margin || 0) >= 0 ? "text-green-600" : "text-red-600"
                                }`}
                        >
                            {formatPercentage(stats?.profit_margin || 0, false)}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Trend Chart */}
            <Card>
                <CardHeader>
                    <CardTitle>Revenue vs Expenses Trend</CardTitle>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={monthlyData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis />
                            <Tooltip
                                formatter={(value: number) => formatCurrency(value)}
                            />
                            <Legend />
                            <Area
                                type="monotone"
                                dataKey="revenue"
                                stackId="1"
                                stroke="#10b981"
                                fill="#10b981"
                                fillOpacity={0.6}
                                name="Revenue"
                            />
                            <Area
                                type="monotone"
                                dataKey="expenses"
                                stackId="2"
                                stroke="#ef4444"
                                fill="#ef4444"
                                fillOpacity={0.6}
                                name="Expenses"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Month-wise Breakdown */}
            <Card>
                <CardHeader>
                    <CardTitle>Month-wise Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Month</TableHead>
                                <TableHead className="text-right">Revenue</TableHead>
                                <TableHead className="text-right">Expenses</TableHead>
                                <TableHead className="text-right">Profit/Loss</TableHead>
                                <TableHead className="text-right">Margin</TableHead>
                                <TableHead className="text-right">Growth</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {monthlyData.map((month) => (
                                <TableRow key={month.monthYear}>
                                    <TableCell className="font-medium">{month.month}</TableCell>
                                    <TableCell className="text-right text-green-600">
                                        {formatCurrency(month.revenue)}
                                    </TableCell>
                                    <TableCell className="text-right text-red-600">
                                        {formatCurrency(month.expenses)}
                                    </TableCell>
                                    <TableCell
                                        className={`text-right font-semibold ${month.profit >= 0 ? "text-green-600" : "text-red-600"
                                            }`}
                                    >
                                        {formatCurrency(month.profit)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {formatPercentage(month.profitMargin, false)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <span
                                            className={`flex items-center justify-end gap-1 ${month.growth >= 0 ? "text-green-600" : "text-red-600"
                                                }`}
                                        >
                                            {month.growth >= 0 ? (
                                                <TrendingUp className="h-4 w-4" />
                                            ) : (
                                                <TrendingDown className="h-4 w-4" />
                                            )}
                                            {formatPercentage(Math.abs(month.growth), false)}
                                        </span>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Additional Insights */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Customers */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <User className="h-5 w-5" />
                            Top Revenue Customers
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {topCustomers.length > 0 ? (
                            <div className="space-y-3">
                                {topCustomers.map((customer, index) => (
                                    <div key={customer.id} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-muted-foreground">
                                                #{index + 1}
                                            </span>
                                            <span className="font-medium">{customer.name}</span>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-semibold text-green-600">
                                                {formatCurrency(customer.revenue)}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {formatPercentage(customer.percentage, false)}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground text-center py-4">
                                No customer revenue data available
                            </p>
                        )}
                    </CardContent>
                </Card>

                {/* Expense Breakdown */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Tag className="h-5 w-5" />
                            Expense Breakdown
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {expensesByCategory.length > 0 ? (
                            <div className="space-y-3">
                                {expensesByCategory.map((item, index) => (
                                    <div key={item.category} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div
                                                className="w-3 h-3 rounded-full"
                                                style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                            />
                                            <span className="font-medium">{item.category}</span>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-semibold text-red-600">
                                                {formatCurrency(item.amount)}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {formatPercentage(item.percentage, false)}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground text-center py-4">
                                No expense data available
                            </p>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Outstanding Receivables */}
            {stats && stats.outstanding_receivables > 0 && (
                <Card className="border-orange-200 bg-orange-50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-orange-700">
                            <AlertTriangle className="h-5 w-5" />
                            Outstanding Receivables Impact
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">
                                    Total outstanding amount from unpaid bills
                                </p>
                                <p className="text-2xl font-bold text-orange-700 mt-1">
                                    {formatCurrency(stats.outstanding_receivables)}
                                </p>
                            </div>
                            <Button variant="outline" onClick={() => window.location.href = "/payments"}>
                                View Payments
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Transaction List */}
            <Card>
                <CardHeader>
                    <CardTitle>Transaction List ({stats?.transaction_count || 0} total)</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Amount</TableHead>
                                <TableHead>Description</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedTransactions.map((transaction) => (
                                <TableRow key={transaction.id}>
                                    <TableCell>
                                        {new Date(transaction.date_of_transaction).toLocaleDateString()}
                                    </TableCell>
                                    <TableCell>
                                        <span
                                            className={`px-2 py-1 rounded text-xs font-semibold ${transaction.type === "revenue"
                                                ? "bg-green-100 text-green-700"
                                                : "bg-red-100 text-red-700"
                                                }`}
                                        >
                                            {transaction.type}
                                        </span>
                                    </TableCell>
                                    <TableCell
                                        className={`font-semibold ${transaction.type === "revenue" ? "text-green-600" : "text-red-600"
                                            }`}
                                    >
                                        {formatCurrency(transaction.amount)}
                                    </TableCell>
                                    <TableCell className="max-w-md truncate">
                                        {transaction.description || "—"}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between mt-4">
                            <p className="text-sm text-muted-foreground">
                                Page {currentPage} of {totalPages}
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                >
                                    Previous
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};
