import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { CreditCard, ArrowDownCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

// Interfaces
interface Bill {
  id: string;
  total_amount: number;
  due_date: string;
  status: "outstanding" | "partial" | "paid";
  paid_amount: number;
}

interface Customer {
  id: string;
  name: string;
  outstanding_balance: number;
  type: "customer" | "vendor";
}

interface Transaction {
  id: string;
  amount: number;
  created_at: string;
  type: "collection" | "expense";
  party_name: string | null;
  details: string | null;
}

interface ExpenseCategory {
  id: string;
  name: string;
}

export const Payments = () => {
  const { toast } = useToast();
  // Collection Form State
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [selectedBills, setSelectedBills] = useState<string[]>([]);
  const [customerBills, setCustomerBills] = useState<Bill[]>([]);

  // Expense Form State
  const [expenseAmount, setExpenseAmount] = useState(0);
  const [selectedVendor, setSelectedVendor] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [expenseComments, setExpenseComments] = useState("");

  // Shared State
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vendors, setVendors] = useState<Customer[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const customersPromise = supabase.from("customers").select("id, name, outstanding_balance, type").eq("is_active", true).order("name");
    const categoriesPromise = supabase.from("expense_categories").select("*").order("name");
    const paymentsPromise = supabase.from("payments").select(`id, amount, created_at, customers (name)`).order("created_at", { ascending: false }).limit(10);
    const expensesPromise = supabase.from("expenses").select(`id, amount, created_at, comments, customers (name), expense_categories (name)`).order("created_at", { ascending: false }).limit(10);

    const [customersRes, categoriesRes, paymentsRes, expensesRes] = await Promise.all([customersPromise, categoriesPromise, paymentsPromise, expensesPromise]);

    if (customersRes.error) {
      toast({ title: "Error fetching customers/vendors", description: customersRes.error.message, variant: "destructive" });
    } else {
      setCustomers(customersRes.data.filter(c => c.type === 'customer') || []);
      setVendors(customersRes.data.filter(c => c.type === 'vendor') || []);
    }

    if (categoriesRes.error) {
      toast({ title: "Error fetching expense categories", description: categoriesRes.error.message, variant: "destructive" });
    } else {
      setExpenseCategories(categoriesRes.data || []);
    }

    const collections = (paymentsRes.data || []).map(p => ({
      id: p.id,
      amount: p.amount,
      created_at: p.created_at,
      type: 'collection' as const,
      party_name: p.customers?.name || 'N/A',
      details: 'Payment Received'
    }));

    const expenses = (expensesRes.data || []).map(e => ({
      id: e.id,
      amount: e.amount,
      created_at: e.created_at,
      type: 'expense' as const,
      party_name: e.customers?.name || e.expense_categories?.name || 'N/A',
      details: e.comments || e.expense_categories?.name || 'Expense'
    }));

    const allTransactions = [...collections, ...expenses].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setRecentTransactions(allTransactions.slice(0, 15));

    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const fetchCustomerBills = async () => {
      if (!selectedCustomer) {
        setCustomerBills([]);
        return;
      }
      const { data, error } = await supabase.from("bills").select("*").eq("customer_id", selectedCustomer).in("status", ["outstanding", "partial"]);
      if (error) {
        toast({ title: "Error fetching bills", description: error.message, variant: "destructive" });
      } else {
        setCustomerBills(data || []);
      }
    };
    fetchCustomerBills();
  }, [selectedCustomer, toast]);

  const processCollection = async () => {
    if (!selectedCustomer || selectedBills.length === 0 || paymentAmount <= 0) {
      toast({ title: "Error", description: "Please select a customer, bills, and enter a valid payment amount.", variant: "destructive" });
      return;
    }
    const { error } = await supabase.rpc('process_payment', { p_customer_id: selectedCustomer, p_payment_amount: paymentAmount, p_bill_ids: selectedBills });
    if (error) {
      toast({ title: "Error processing collection", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: `Collection of Rs. ${paymentAmount} processed successfully.` });
      setSelectedCustomer("");
      setSelectedBills([]);
      setPaymentAmount(0);
      fetchData();
    }
  };

  const recordExpense = async () => {
    if (expenseAmount <= 0 || (!selectedVendor && !selectedCategory)) {
      toast({ title: "Error", description: "Please enter an amount and select a vendor or category.", variant: "destructive" });
      return;
    }
    const { error } = await supabase.rpc('record_expense', { p_amount: expenseAmount, p_vendor_id: selectedVendor || null, p_category_id: selectedCategory || null, p_comments: expenseComments });
    if (error) {
      toast({ title: "Error recording expense", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Expense recorded successfully." });
      setExpenseAmount(0);
      setSelectedVendor("");
      setSelectedCategory("");
      setExpenseComments("");
      fetchData();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Payments & Expenses</h1>
        <p className="text-muted-foreground">Record incoming collections and outgoing expenses.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" />Record Collection</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customer">Customer</Label>
              <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                <SelectTrigger id="customer">
                  <SelectValue placeholder="Select a customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedCustomer && (
              <div className="space-y-2">
                <Label>Outstanding Bills</Label>
                {customerBills.length > 0 ? (
                  <div className="space-y-2 rounded-md border p-4 max-h-48 overflow-y-auto">
                    {customerBills.map((bill) => (
                      <div key={bill.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`bill-${bill.id}`}
                            checked={selectedBills.includes(bill.id)}
                            onCheckedChange={(checked) => {
                              setSelectedBills(
                                checked
                                  ? [...selectedBills, bill.id]
                                  : selectedBills.filter((id) => id !== bill.id)
                              );
                            }}
                          />
                          <Label htmlFor={`bill-${bill.id}`} className="font-normal">
                            Bill #{bill.id.substring(0, 6)} - Due: {new Date(bill.due_date).toLocaleDateString()}
                          </Label>
                        </div>
                        <Badge variant={bill.status === 'partial' ? 'secondary' : 'outline'}>
                          Rs. {(bill.total_amount - bill.paid_amount).toFixed(2)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-md border p-4 text-center">
                    <p className="text-sm text-muted-foreground">No outstanding bills for this customer.</p>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="paymentAmount">Payment Amount</Label>
              <Input
                id="paymentAmount"
                type="number"
                min="0"
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                disabled={selectedBills.length === 0}
              />
            </div>

            <Button onClick={processCollection} className="w-full" disabled={loading || selectedBills.length === 0 || paymentAmount <= 0}>
              Record Collection
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><ArrowDownCircle className="h-5 w-5" />Record Expense</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="expenseAmount">Expense Amount</Label>
              <Input type="number" min="0" step="0.01" value={expenseAmount} onChange={(e) => setExpenseAmount(parseFloat(e.target.value) || 0)} placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor">Vendor (Optional)</Label>
              <Select value={selectedVendor} onValueChange={setSelectedVendor}><SelectTrigger><SelectValue placeholder="Select a vendor" /></SelectTrigger><SelectContent>{vendors.map((v) => (<SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>))}</SelectContent></Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category (Optional)</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}><SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger><SelectContent>{expenseCategories.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}</SelectContent></Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="expenseComments">Comments</Label>
              <Textarea value={expenseComments} onChange={(e) => setExpenseComments(e.target.value)} placeholder="Add a note..." />
            </div>
            <Button onClick={recordExpense} className="w-full" disabled={loading}>Record Expense</Button>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="balances">
        <TabsList><TabsTrigger value="balances">Balances</TabsTrigger><TabsTrigger value="transactions">Recent Transactions</TabsTrigger></TabsList>
        <TabsContent value="balances">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
            <Card>
              <CardHeader><CardTitle>Customer Balances</CardTitle></CardHeader>
              <CardContent><Table><TableHeader><TableRow><TableHead>Customer</TableHead><TableHead className="text-right">Outstanding</TableHead></TableRow></TableHeader><TableBody>{customers.map(c => (<TableRow key={c.id}><TableCell>{c.name}</TableCell><TableCell className="text-right">Rs. {c.outstanding_balance.toFixed(2)}</TableCell></TableRow>))}</TableBody></Table></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Vendor Balances</CardTitle></CardHeader>
              <CardContent><Table><TableHeader><TableRow><TableHead>Vendor</TableHead><TableHead className="text-right">Outstanding</TableHead></TableRow></TableHeader><TableBody>{vendors.map(v => (<TableRow key={v.id}><TableCell>{v.name}</TableCell><TableCell className="text-right">Rs. {v.outstanding_balance.toFixed(2)}</TableCell></TableRow>))}</TableBody></Table></CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="transactions">
          <Card className="mt-4">
            <CardHeader><CardTitle>Recent Transactions</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Party</TableHead><TableHead>Details</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
                <TableBody>{recentTransactions.map(t => (<TableRow key={t.id}><TableCell><Badge variant={t.type === 'collection' ? 'default' : 'secondary'}>{t.type}</Badge></TableCell><TableCell>{t.party_name}</TableCell><TableCell>{t.details}</TableCell><TableCell className="text-right">Rs. {t.amount.toFixed(2)}</TableCell><TableCell>{new Date(t.created_at).toLocaleString()}</TableCell></TableRow>))}</TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
