// Financial Analytics Utility Functions

export interface Transaction {
    id: string;
    amount: number;
    type: 'revenue' | 'expense';
    description: string | null;
    date_of_transaction: string;
    customer_id: string | null;
    vendor_id: string | null;
    category_id: string | null;
    bill_id: string | null;
    created_at: string;
}

export interface MonthlyData {
    month: string;
    monthYear: string;
    revenue: number;
    expenses: number;
    profit: number;
    profitMargin: number;
    growth: number;
}

export interface TopCustomer {
    id: string;
    name: string;
    revenue: number;
    percentage: number;
}

export interface ExpenseByCategory {
    category: string;
    amount: number;
    percentage: number;
}

/**
 * Format currency value
 */
export const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
    }).format(value);
};

/**
 * Calculate profit margin percentage
 */
export const calculateProfitMargin = (revenue: number, expenses: number): number => {
    if (revenue === 0) return 0;
    return ((revenue - expenses) / revenue) * 100;
};

/**
 * Calculate growth percentage
 */
export const calculateGrowth = (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
};

/**
 * Format percentage with sign
 */
export const formatPercentage = (value: number, showSign: boolean = true): string => {
    const sign = showSign && value > 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
};

/**
 * Group transactions by month
 */
export const groupTransactionsByMonth = (
    transactions: Transaction[]
): MonthlyData[] => {
    const monthMap = new Map<string, { revenue: number; expenses: number }>();

    transactions.forEach((transaction) => {
        const date = new Date(transaction.date_of_transaction);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        if (!monthMap.has(monthKey)) {
            monthMap.set(monthKey, { revenue: 0, expenses: 0 });
        }

        const monthData = monthMap.get(monthKey)!;
        if (transaction.type === 'revenue') {
            monthData.revenue += transaction.amount;
        } else {
            monthData.expenses += transaction.amount;
        }
    });

    // Convert to array and sort by date
    const monthlyData: MonthlyData[] = Array.from(monthMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([monthKey, data], index, array) => {
            const [year, month] = monthKey.split('-');
            const date = new Date(parseInt(year), parseInt(month) - 1);
            const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

            const profit = data.revenue - data.expenses;
            const profitMargin = calculateProfitMargin(data.revenue, data.expenses);

            // Calculate growth compared to previous month
            let growth = 0;
            if (index > 0) {
                const previousProfit = array[index - 1][1].revenue - array[index - 1][1].expenses;
                growth = calculateGrowth(profit, previousProfit);
            }

            return {
                month: monthName,
                monthYear: monthKey,
                revenue: data.revenue,
                expenses: data.expenses,
                profit,
                profitMargin,
                growth,
            };
        });

    return monthlyData;
};

/**
 * Get top customers by revenue
 */
export const getTopCustomers = (
    transactions: Transaction[],
    customers: { id: string; name: string }[],
    limit: number = 5
): TopCustomer[] => {
    const customerRevenue = new Map<string, number>();

    transactions
        .filter((t) => t.type === 'revenue' && t.customer_id)
        .forEach((t) => {
            const current = customerRevenue.get(t.customer_id!) || 0;
            customerRevenue.set(t.customer_id!, current + t.amount);
        });

    const totalRevenue = Array.from(customerRevenue.values()).reduce((sum, val) => sum + val, 0);

    const topCustomers = Array.from(customerRevenue.entries())
        .map(([customerId, revenue]) => {
            const customer = customers.find((c) => c.id === customerId);
            return {
                id: customerId,
                name: customer?.name || 'Unknown',
                revenue,
                percentage: totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0,
            };
        })
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, limit);

    return topCustomers;
};

/**
 * Get expense breakdown by category
 */
export const getExpensesByCategory = (
    transactions: Transaction[],
    categories: { id: string; name: string }[]
): ExpenseByCategory[] => {
    const categoryExpenses = new Map<string, number>();

    transactions
        .filter((t) => t.type === 'expense' && t.category_id)
        .forEach((t) => {
            const current = categoryExpenses.get(t.category_id!) || 0;
            categoryExpenses.set(t.category_id!, current + t.amount);
        });

    const totalExpenses = Array.from(categoryExpenses.values()).reduce((sum, val) => sum + val, 0);

    const expensesByCategory = Array.from(categoryExpenses.entries())
        .map(([categoryId, amount]) => {
            const category = categories.find((c) => c.id === categoryId);
            return {
                category: category?.name || 'Uncategorized',
                amount,
                percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0,
            };
        })
        .sort((a, b) => b.amount - a.amount);

    return expensesByCategory;
};

/**
 * Get date range presets
 */
export const getDateRangePreset = (preset: string): { start: Date; end: Date } => {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    let start: Date;

    switch (preset) {
        case 'today':
            start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
            break;
        case 'week':
            start = new Date(now);
            start.setDate(now.getDate() - 7);
            start.setHours(0, 0, 0, 0);
            break;
        case 'month':
            start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
            break;
        case 'quarter':
            const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
            start = new Date(now.getFullYear(), quarterStartMonth, 1, 0, 0, 0);
            break;
        case 'year':
            start = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
            break;
        default:
            // Default to last 30 days
            start = new Date(now);
            start.setDate(now.getDate() - 30);
            start.setHours(0, 0, 0, 0);
    }

    return { start, end };
};
