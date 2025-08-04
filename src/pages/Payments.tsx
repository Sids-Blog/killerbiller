import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
import { CreditCard, ArrowDownCircle, CalendarIcon, ChevronsUpDown, Check, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { DateRange } from "react-day-picker";
import { exportToCSV, formatCurrency, formatDateTime } from "@/lib/csv-export";

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
  date_of_transaction: string;
  type: "revenue" | "expense";
  description: string | null;
  customer: { name: string } | null;
  vendor: { name: string } | null;
  expense_categories: { name: string } | null;
}

interface ExpenseCategory {
  id: string;
  name: string;
}

export const Payments = () => {
  const { toast } = useToast();
  // Form States
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [selectedBills, setSelectedBills] = useState<string[]>([]);
  const [customerBills, setCustomerBills] = useState<Bill[]>([]);
  const [collectionDate, setCollectionDate] = useState<Date | undefined>(new Date());
  const [expenseAmount, setExpenseAmount] = useState(0);
  const [selectedVendor, setSelectedVendor] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [expenseComments, setExpenseComments] = useState("");
  const [expenseDate, setExpenseDate] = useState<Date | undefined>(new Date());

  // Shared State
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vendors, setVendors] = useState<Customer[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter State
  const [typeFilter, setTypeFilter] = useState("all");
  const [partyFilter, setPartyFilter] = useState("all");
  const [partySearchOpen, setPartySearchOpen] = useState(false);
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [vendorSearchOpen, setVendorSearchOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  const combinedParties = useMemo(() => [...customers, ...vendors], [customers, vendors]);
  const combinedPartiesRef = useRef(combinedParties);

  useEffect(() => {
    combinedPartiesRef.current = combinedParties;
  }, [combinedParties]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const customersPromise = supabase.from("customers").select("id, name, outstanding_balance, type").eq("is_active", true).order("name");
    const categoriesPromise = supabase.from("expense_categories").select("*").order("name");
    
    let query = supabase.from("transactions").select(`
      id, amount, created_at, date_of_transaction, type, description,
      customer:customers!customer_id(name),
      vendor:customers!vendor_id(name),
      expense_categories(name)
    `);

    if (typeFilter !== "all") query = query.eq("type", typeFilter);
    if (partyFilter !== "all") {
        const party = combinedPartiesRef.current.find(p => p.id === partyFilter);
        if (party?.type === 'customer') query = query.eq('customer_id', partyFilter);
        else query = query.eq('vendor_id', partyFilter);
    }
    if (dateRange?.from) query = query.gte('date_of_transaction', dateRange.from.toISOString());
    if (dateRange?.to) query = query.lte('date_of_transaction', dateRange.to.toISOString());

    const transactionsPromise = query.order("date_of_transaction", { ascending: false });

    const [customersRes, categoriesRes, transactionsRes] = await Promise.all([customersPromise, categoriesPromise, transactionsPromise]);

    if (customersRes.error) toast({ title: "Error fetching customers/vendors", description: customersRes.error.message, variant: "destructive" });
    else {
      setCustomers(customersRes.data.filter(c => c.type === 'customer') || []);
      setVendors(customersRes.data.filter(c => c.type === 'vendor') || []);
    }

    if (categoriesRes.error) toast({ title: "Error fetching expense categories", description: categoriesRes.error.message, variant: "destructive" });
    else setExpenseCategories(categoriesRes.data || []);

    if (transactionsRes.error) toast({ title: "Error fetching transactions", description: transactionsRes.error.message, variant: "destructive" });
    else setTransactions(transactionsRes.data as unknown as Transaction[]);

    setLoading(false);
  }, [toast, typeFilter, partyFilter, dateRange]);

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
      if (error) toast({ title: "Error fetching bills", description: error.message, variant: "destructive" });
      else setCustomerBills(data || []);
    };
    fetchCustomerBills();
  }, [selectedCustomer, toast]);

  const processCollection = async () => {
    if (!selectedCustomer || selectedBills.length === 0 || paymentAmount <= 0) {
      toast({ title: "Error", description: "Please select a customer, bills, and enter a valid payment amount.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    const { error } = await supabase.rpc('process_payment', { p_customer_id: selectedCustomer, p_payment_amount: paymentAmount, p_bill_ids: selectedBills, p_date_of_transaction: collectionDate?.toISOString() });
    if (error) toast({ title: "Error processing collection", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Success", description: `Collection of Rs. ${paymentAmount} processed successfully.` });
      setSelectedCustomer("");
      setSelectedBills([]);
      setPaymentAmount(0);
      setCollectionDate(new Date());
      fetchData();
    }
    setIsSubmitting(false);
  };

  const recordExpense = async () => {
    if (expenseAmount <= 0 || (!selectedVendor && !selectedCategory)) {
      toast({ title: "Error", description: "Please enter an amount and select a vendor or category.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    const { error } = await supabase.rpc('record_expense', { p_amount: expenseAmount, p_vendor_id: selectedVendor || null, p_category_id: selectedCategory || null, p_comments: expenseComments, p_date_of_transaction: expenseDate?.toISOString() });
    if (error) toast({ title: "Error recording expense", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Success", description: "Expense recorded successfully." });
      setExpenseAmount(0);
      setSelectedVendor("");
      setSelectedCategory("");
      setExpenseComments("");
      setExpenseDate(new Date());
      fetchData();
    }
    setIsSubmitting(false);
  };

  const getPartyName = (transaction: Transaction) => {
    if (transaction.type === 'revenue') return transaction.customer?.name || 'N/A';
    return transaction.vendor?.name || transaction.expense_categories?.name || 'General Expense';
  }

  const getDetails = (transaction: Transaction) => {
    if (transaction.type === 'revenue') return 'Payment Received';
    return transaction.description || transaction.expense_categories?.name || 'N/A';
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Payments & Expenses</h1>
        <p className="text-muted-foreground">Record incoming collections and outgoing expenses.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Record Collection Card */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" />Record Collection</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customer">Customer</Label>
              <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={customerSearchOpen}
                    className="w-full justify-between"
                  >
                    <span className="truncate">
                      {selectedCustomer
                        ? customers.find((customer) => customer.id === selectedCustomer)?.name
                        : "Select a customer"}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] max-w-[95vw] p-0" side="bottom" align="start" avoidCollisions={true}>
                  <Command>
                    <CommandInput placeholder="Search customers..." className="h-9" />
                    <CommandList className="max-h-[200px]">
                      <CommandEmpty>No customer found.</CommandEmpty>
                      <CommandGroup>
                        {customers.map((customer) => (
                          <CommandItem
                            key={customer.id}
                            value={customer.name}
                            onSelect={() => {
                              setSelectedCustomer(customer.id);
                              setCustomerSearchOpen(false);
                            }}
                            className="cursor-pointer"
                          >
                            <Check className={`mr-2 h-4 w-4 ${selectedCustomer === customer.id ? "opacity-100" : "opacity-0"}`} />
                            <div className="flex flex-col">
                              <span className="truncate">{customer.name}</span>
                              <span className="text-xs text-muted-foreground">
                                Balance: ₹{customer.outstanding_balance?.toFixed(2) || '0.00'}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {selectedCustomer && (
              <div className="space-y-2">
                <Label>Outstanding Bills</Label>
                {customerBills.length > 0 ? (
                  <div className="space-y-2 rounded-md border p-4 max-h-48 overflow-y-auto">{customerBills.map((bill) => (<div key={bill.id} className="flex items-center justify-between"><div className="flex items-center gap-2"><Checkbox id={`bill-${bill.id}`} checked={selectedBills.includes(bill.id)} onCheckedChange={(checked) => {setSelectedBills(checked ? [...selectedBills, bill.id] : selectedBills.filter((id) => id !== bill.id));}} /><Label htmlFor={`bill-${bill.id}`} className="font-normal">Bill #{bill.id.substring(0, 6)} - Due: {new Date(bill.due_date).toLocaleDateString()}</Label></div><Badge variant={bill.status === 'partial' ? 'secondary' : 'outline'}>Rs. {(bill.total_amount - bill.paid_amount).toFixed(2)}</Badge></div>))}</div>
                ) : (
                  <div className="rounded-md border p-4 text-center"><p className="text-sm text-muted-foreground">No outstanding bills for this customer.</p></div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="paymentAmount">Payment Amount</Label>
                    <Input id="paymentAmount" type="number" min="0" step="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)} placeholder="0.00" disabled={selectedBills.length === 0} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="collectionDate">Date</Label>
                    <Popover><PopoverTrigger asChild><Button variant={"outline"} className="w-full justify-start text-left font-normal">{collectionDate ? format(collectionDate, "PPP") : <span>Pick a date</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={collectionDate} onSelect={setCollectionDate} initialFocus /></PopoverContent></Popover>
                </div>
            </div>

            <Button onClick={processCollection} className="w-full" disabled={isSubmitting || selectedBills.length === 0 || paymentAmount <= 0}>
                {isSubmitting ? 'Processing...' : 'Record Collection'}
            </Button>
          </CardContent>
        </Card>
        {/* Record Expense Card */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><ArrowDownCircle className="h-5 w-5" />Record Expense</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="expenseAmount">Expense Amount</Label>
                    <Input type="number" min="0" step="0.01" value={expenseAmount} onChange={(e) => setExpenseAmount(parseFloat(e.target.value) || 0)} placeholder="0.00" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="expenseDate">Date</Label>
                    <Popover><PopoverTrigger asChild><Button variant={"outline"} className="w-full justify-start text-left font-normal">{expenseDate ? format(expenseDate, "PPP") : <span>Pick a date</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={expenseDate} onSelect={setExpenseDate} initialFocus /></PopoverContent></Popover>
                </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor">Vendor (Optional)</Label>
              <Popover open={vendorSearchOpen} onOpenChange={setVendorSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={vendorSearchOpen}
                    className="w-full justify-between"
                  >
                    <span className="truncate">
                      {selectedVendor
                        ? vendors.find((vendor) => vendor.id === selectedVendor)?.name
                        : "Select a vendor"}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] max-w-[95vw] p-0" side="bottom" align="start" avoidCollisions={true}>
                  <Command>
                    <CommandInput placeholder="Search vendors..." className="h-9" />
                    <CommandList className="max-h-[200px]">
                      <CommandEmpty>No vendor found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="none"
                          onSelect={() => {
                            setSelectedVendor("");
                            setVendorSearchOpen(false);
                          }}
                          className="cursor-pointer"
                        >
                          <Check className={`mr-2 h-4 w-4 ${selectedVendor === "" ? "opacity-100" : "opacity-0"}`} />
                          <span className="text-muted-foreground">None (Clear selection)</span>
                        </CommandItem>
                        {vendors.map((vendor) => (
                          <CommandItem
                            key={vendor.id}
                            value={vendor.name}
                            onSelect={() => {
                              setSelectedVendor(vendor.id);
                              setVendorSearchOpen(false);
                            }}
                            className="cursor-pointer"
                          >
                            <Check className={`mr-2 h-4 w-4 ${selectedVendor === vendor.id ? "opacity-100" : "opacity-0"}`} />
                            <span className="truncate">{vendor.name}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category (Optional)</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}><SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger><SelectContent>{expenseCategories.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}</SelectContent></Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="expenseComments">Comments</Label>
              <Textarea value={expenseComments} onChange={(e) => setExpenseComments(e.target.value)} placeholder="Add a note..." />
            </div>
            <Button onClick={recordExpense} className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Recording...' : 'Record Expense'}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="transactions">
        <TabsList><TabsTrigger value="transactions">Recent Transactions</TabsTrigger><TabsTrigger value="balances">Balances</TabsTrigger></TabsList>
        <TabsContent value="transactions">
          <Card className="mt-4">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Recent Transactions</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    try {
                      exportToCSV({
                        filename: 'recent-transactions',
                        headers: ['Date', 'Type', 'Party', 'Amount', 'Details'],
                        data: transactions,
                        transformData: (transaction) => ({
                          'Date': formatDateTime(transaction.date_of_transaction),
                          'Type': transaction.type === 'revenue' ? 'Revenue' : 'Expense',
                          'Party': getPartyName(transaction),
                          'Amount': formatCurrency(transaction.amount),
                          'Details': getDetails(transaction)
                        })
                      });
                      toast({ title: "Success", description: "Transactions exported to CSV successfully" });
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
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4 mb-4">
                <Select value={typeFilter} onValueChange={setTypeFilter}><SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Filter by type" /></SelectTrigger><SelectContent><SelectItem value="all">All Types</SelectItem><SelectItem value="revenue">Revenue</SelectItem><SelectItem value="expense">Expense</SelectItem></SelectContent></Select>
                <Popover open={partySearchOpen} onOpenChange={setPartySearchOpen}>
                    <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" aria-expanded={partySearchOpen} className="w-full sm:w-[200px] justify-between">
                            {partyFilter !== "all" ? combinedParties.find((p) => p.id === partyFilter)?.name : "Select party..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[200px] p-0">
                        <Command>
                            <CommandInput placeholder="Search party..." />
                            <CommandList>
                                <CommandEmpty>No party found.</CommandEmpty>
                                <CommandGroup>
                                    <CommandItem value="all" onSelect={() => {setPartyFilter("all"); setPartySearchOpen(false);}}>All Parties</CommandItem>
                                    {combinedParties.map((p) => (
                                        <CommandItem key={p.id} value={p.name} onSelect={() => {setPartyFilter(p.id); setPartySearchOpen(false);}}>
                                            {p.name}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
                <Popover><PopoverTrigger asChild><Button variant={"outline"} className="w-full sm:w-auto justify-start text-left font-normal">{dateRange?.from ? (dateRange.to ? `${format(dateRange.from, "LLL dd, y")} - ${format(dateRange.to, "LLL dd, y")}` : format(dateRange.from, "LLL dd, y")) : <span>Pick a date range</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} /></PopoverContent></Popover>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Party</TableHead><TableHead className="hidden sm:table-cell">Details</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="hidden md:table-cell">Date</TableHead></TableRow></TableHeader>
                  <TableBody>{transactions.map(t => (<TableRow key={t.id}><TableCell><Badge variant={t.type === 'revenue' ? 'default' : 'secondary'}>{t.type}</Badge></TableCell><TableCell className="max-w-[100px] truncate">{getPartyName(t)}</TableCell><TableCell className="hidden sm:table-cell">{getDetails(t)}</TableCell><TableCell className="text-right">Rs. {t.amount.toFixed(2)}</TableCell><TableCell className="hidden md:table-cell text-xs">{new Date(t.date_of_transaction).toLocaleDateString()}</TableCell></TableRow>))}</TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="balances">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
            <Card><CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Customer Balances</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    try {
                      exportToCSV({
                        filename: 'customer-balances',
                        headers: ['Customer Name', 'Outstanding Balance'],
                        data: customers,
                        transformData: (customer) => ({
                          'Customer Name': customer.name,
                          'Outstanding Balance': formatCurrency(customer.outstanding_balance || 0)
                        })
                      });
                      toast({ title: "Success", description: "Customer balances exported to CSV successfully" });
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
            </CardHeader><CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Customer</TableHead><TableHead className="text-right">Outstanding</TableHead></TableRow></TableHeader><TableBody>{customers.map(c => (<TableRow key={c.id}><TableCell>{c.name}</TableCell><TableCell className="text-right">Rs. {c.outstanding_balance?.toFixed(2) || '0.00'}</TableCell></TableRow>))}</TableBody></Table></div></CardContent></Card>
            <Card><CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Vendor Balances</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    try {
                      exportToCSV({
                        filename: 'vendor-balances',
                        headers: ['Vendor Name', 'Outstanding Balance'],
                        data: vendors,
                        transformData: (vendor) => ({
                          'Vendor Name': vendor.name,
                          'Outstanding Balance': formatCurrency(vendor.outstanding_balance || 0)
                        })
                      });
                      toast({ title: "Success", description: "Vendor balances exported to CSV successfully" });
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
            </CardHeader><CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Vendor</TableHead><TableHead className="text-right">Outstanding</TableHead></TableRow></TableHeader><TableBody>{vendors.map(v => (<TableRow key={v.id}><TableCell>{v.name}</TableCell><TableCell className="text-right">Rs. {v.outstanding_balance?.toFixed(2) || '0.00'}</TableCell></TableRow>))}</TableBody></Table></div></CardContent></Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};