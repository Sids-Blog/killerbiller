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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { CreditCard, ArrowDownCircle, CalendarIcon, ChevronsUpDown, Check, Download, Receipt } from "lucide-react";
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

interface Vendor {
  id: string;
  name: string;
  outstanding_balance: number;
  credit_balance: number;
  type: "vendor";
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

interface Credit {
  id: string;
  vendor_id: string;
  amount: number;
  date: string;
  comments: string | null;
  status: "pending" | "redeemed";
  created_at: string;
  customers: { name: string } | null;
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
  const [creditAmount, setCreditAmount] = useState(0);
  const [selectedCreditVendor, setSelectedCreditVendor] = useState("");
  const [creditComments, setCreditComments] = useState("");
  const [creditDate, setCreditDate] = useState<Date | undefined>(new Date());

  // Shared State
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
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
  const [creditVendorSearchOpen, setCreditVendorSearchOpen] = useState(false);
  const [credits, setCredits] = useState<Credit[]>([]);
  const [filteredCredits, setFilteredCredits] = useState<Credit[]>([]);
  const [editingCredit, setEditingCredit] = useState<Credit | null>(null);
  const [isEditCreditDialogOpen, setIsEditCreditDialogOpen] = useState(false);
  
  // Credit filters
  const [creditStatusFilter, setCreditStatusFilter] = useState("all");
  const [creditVendorFilter, setCreditVendorFilter] = useState("all");
  const [creditDateRange, setCreditDateRange] = useState<DateRange | undefined>();
  const [creditVendorFilterSearchOpen, setCreditVendorFilterSearchOpen] = useState(false);
  
  // Balance search filters
  const [customerBalanceSearchTerm, setCustomerBalanceSearchTerm] = useState("");
  const [vendorBalanceSearchTerm, setVendorBalanceSearchTerm] = useState("");
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  const combinedParties = useMemo(() => [...customers, ...vendors], [customers, vendors]);
  const combinedPartiesRef = useRef(combinedParties);

  // Filtered balance data
  const filteredCustomerBalances = useMemo(() => {
    if (!customerBalanceSearchTerm.trim()) return customers;
    return customers.filter(customer =>
      customer.name.toLowerCase().includes(customerBalanceSearchTerm.toLowerCase())
    );
  }, [customers, customerBalanceSearchTerm]);

  const filteredVendorBalances = useMemo(() => {
    if (!vendorBalanceSearchTerm.trim()) return vendors;
    return vendors.filter(vendor =>
      vendor.name.toLowerCase().includes(vendorBalanceSearchTerm.toLowerCase())
    );
  }, [vendors, vendorBalanceSearchTerm]);

  useEffect(() => {
    combinedPartiesRef.current = combinedParties;
  }, [combinedParties]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const customersPromise = supabase.from("customers").select("id, name, outstanding_balance, type").eq("is_active", true).eq("type", "customer").order("name");
    const vendorsPromise = supabase.from("customers").select("id, name, outstanding_balance, type").eq("is_active", true).eq("type", "vendor").order("name");
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
    const creditsPromise = supabase.from("credit").select("*, customers(name)").order("created_at", { ascending: false });

    const [customersRes, vendorsRes, categoriesRes, transactionsRes, creditsRes] = await Promise.all([customersPromise, vendorsPromise, categoriesPromise, transactionsPromise, creditsPromise]);

    if (customersRes.error) toast({ title: "Error fetching customers", description: customersRes.error.message, variant: "destructive" });
    else setCustomers(customersRes.data || []);

    if (categoriesRes.error) toast({ title: "Error fetching expense categories", description: categoriesRes.error.message, variant: "destructive" });
    else setExpenseCategories(categoriesRes.data || []);

    if (transactionsRes.error) toast({ title: "Error fetching transactions", description: transactionsRes.error.message, variant: "destructive" });
    else setTransactions(transactionsRes.data as unknown as Transaction[]);

    if (creditsRes.error) toast({ title: "Error fetching credits", description: creditsRes.error.message, variant: "destructive" });
    else setCredits(creditsRes.data as unknown as Credit[]);

    // Calculate vendor credit balances after credits are loaded
    if (vendorsRes.error) toast({ title: "Error fetching vendors", description: vendorsRes.error.message, variant: "destructive" });
    else {
      const creditsData = creditsRes.data as unknown as Credit[] || [];
      const vendorsWithCredits = vendorsRes.data?.map(vendor => {
        const pendingCredits = creditsData.filter(credit => 
          credit.vendor_id === vendor.id && credit.status === 'pending'
        ).reduce((sum, credit) => sum + credit.amount, 0);
        
        return {
          ...vendor,
          credit_balance: pendingCredits
        };
      }) || [];
      setVendors(vendorsWithCredits);
    }

    setLoading(false);
  }, [toast, typeFilter, partyFilter, dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter credits based on active filters
  useEffect(() => {
    let result = credits;
    
    // Filter by status
    if (creditStatusFilter !== "all") {
      result = result.filter(credit => credit.status === creditStatusFilter);
    }
    
    // Filter by vendor
    if (creditVendorFilter !== "all") {
      result = result.filter(credit => credit.vendor_id === creditVendorFilter);
    }
    
    // Filter by date range
    if (creditDateRange?.from && creditDateRange?.to) {
      result = result.filter(credit => {
        const creditDate = new Date(credit.date);
        return creditDate >= creditDateRange.from! && creditDate <= creditDateRange.to!;
      });
    }
    
    setFilteredCredits(result);
  }, [credits, creditStatusFilter, creditVendorFilter, creditDateRange]);

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

  const recordCredit = async () => {
    if (creditAmount <= 0 || !selectedCreditVendor) {
      toast({ title: "Error", description: "Please enter an amount and select a vendor.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    const { error } = await supabase.from('credit').insert([{
      vendor_id: selectedCreditVendor,
      amount: creditAmount,
      date: creditDate?.toISOString(),
      comments: creditComments,
      status: 'pending'
    }]);
    if (error) toast({ title: "Error recording credit", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Success", description: "Credit recorded successfully." });
      setCreditAmount(0);
      setSelectedCreditVendor("");
      setCreditComments("");
      setCreditDate(new Date());
      fetchData();
    }
    setIsSubmitting(false);
  };

  const openEditCreditDialog = (credit: Credit) => {
    setEditingCredit(credit);
    setSelectedCreditVendor(credit.vendor_id);
    setCreditAmount(credit.amount);
    setCreditDate(new Date(credit.date));
    setCreditComments(credit.comments || "");
    setIsEditCreditDialogOpen(true);
  };

  const updateCreditStatus = async (creditId: string, newStatus: 'pending' | 'redeemed') => {
    const { error } = await supabase
      .from('credit')
      .update({ status: newStatus })
      .eq('id', creditId);

    if (error) {
      toast({ title: "Error updating credit status", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: `Credit marked as ${newStatus}.` });
      fetchData(); // This will refresh both credits and vendor balances
    }
  };

  const updateCredit = async () => {
    if (creditAmount <= 0 || !selectedCreditVendor || !editingCredit) {
      toast({ title: "Error", description: "Please enter valid data.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    const { error } = await supabase
      .from('credit')
      .update({
        vendor_id: selectedCreditVendor,
        amount: creditAmount,
        date: creditDate?.toISOString(),
        comments: creditComments,
      })
      .eq('id', editingCredit.id);

    if (error) {
      toast({ title: "Error updating credit", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Credit updated successfully." });
      setIsEditCreditDialogOpen(false);
      setEditingCredit(null);
      setCreditAmount(0);
      setSelectedCreditVendor("");
      setCreditComments("");
      setCreditDate(new Date());
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

  const clearCreditFilters = () => {
    setCreditStatusFilter("all");
    setCreditVendorFilter("all");
    setCreditDateRange(undefined);
  };

  const hasCreditFilters = creditStatusFilter !== "all" || creditVendorFilter !== "all" || creditDateRange?.from;

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
        
        {/* Record Credit Card */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" />Record Credit</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="creditAmount">Credit Amount</Label>
                    <Input type="number" min="0" step="0.01" value={creditAmount} onChange={(e) => setCreditAmount(parseFloat(e.target.value) || 0)} placeholder="0.00" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="creditDate">Date</Label>
                    <Popover><PopoverTrigger asChild><Button variant={"outline"} className="w-full justify-start text-left font-normal">{creditDate ? format(creditDate, "PPP") : <span>Pick a date</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={creditDate} onSelect={setCreditDate} initialFocus /></PopoverContent></Popover>
                </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="creditVendor">Vendor</Label>
              <Popover open={creditVendorSearchOpen} onOpenChange={setCreditVendorSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={creditVendorSearchOpen}
                    className="w-full justify-between"
                  >
                    <span className="truncate">
                      {selectedCreditVendor
                        ? vendors.find((vendor) => vendor.id === selectedCreditVendor)?.name
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
                        {vendors.map((vendor) => (
                          <CommandItem
                            key={vendor.id}
                            value={vendor.name}
                            onSelect={() => {
                              setSelectedCreditVendor(vendor.id);
                              setCreditVendorSearchOpen(false);
                            }}
                            className="cursor-pointer"
                          >
                            <Check className={`mr-2 h-4 w-4 ${selectedCreditVendor === vendor.id ? "opacity-100" : "opacity-0"}`} />
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
              <Label htmlFor="creditComments">Comments</Label>
              <Textarea value={creditComments} onChange={(e) => setCreditComments(e.target.value)} placeholder="Add a note..." />
            </div>
            <Button onClick={recordCredit} className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Recording...' : 'Record Credit'}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="transactions">
        <TabsList><TabsTrigger value="transactions">Recent Transactions</TabsTrigger><TabsTrigger value="balances">Balances</TabsTrigger><TabsTrigger value="credits">Credits</TabsTrigger></TabsList>
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
                        data: filteredCustomerBalances,
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
            </CardHeader><CardContent>
              {/* Customer Search Filter */}
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Input
                    placeholder="Search customers by name..."
                    value={customerBalanceSearchTerm}
                    onChange={(e) => setCustomerBalanceSearchTerm(e.target.value)}
                    className="max-w-md"
                  />
                  {customerBalanceSearchTerm && (
                    <span className="text-sm text-muted-foreground">
                      Showing {filteredCustomerBalances.length} of {customers.length} customers
                    </span>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCustomerBalanceSearchTerm("")}
                  disabled={!customerBalanceSearchTerm}
                >
                  Clear
                </Button>
              </div>
              <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Customer</TableHead><TableHead className="text-right">Outstanding</TableHead></TableRow></TableHeader><TableBody>{filteredCustomerBalances.map(c => (<TableRow key={c.id}><TableCell>{c.name}</TableCell><TableCell className="text-right">Rs. {c.outstanding_balance?.toFixed(2) || '0.00'}</TableCell></TableRow>))}</TableBody></Table></div></CardContent></Card>
            <Card><CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Vendor Credit Balances</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    try {
                      exportToCSV({
                        filename: 'vendor-balances',
                        headers: ['Vendor Name', 'Credit Balance'],
                        data: filteredVendorBalances,
                        transformData: (vendor) => ({
                          'Vendor Name': vendor.name,
                          'Credit Balance': formatCurrency(vendor.credit_balance || 0)
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
            </CardHeader><CardContent>
              {/* Vendor Search Filter */}
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Input
                    placeholder="Search vendors by name..."
                    value={vendorBalanceSearchTerm}
                    onChange={(e) => setVendorBalanceSearchTerm(e.target.value)}
                    className="max-w-md"
                  />
                  {vendorBalanceSearchTerm && (
                    <span className="text-sm text-muted-foreground">
                      Showing {filteredVendorBalances.length} of {vendors.length} vendors
                    </span>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setVendorBalanceSearchTerm("")}
                  disabled={!vendorBalanceSearchTerm}
                >
                  Clear
                </Button>
              </div>
              <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Vendor</TableHead><TableHead className="text-right">Credit Balance</TableHead></TableRow></TableHeader><TableBody>{filteredVendorBalances.map(v => (<TableRow key={v.id}><TableCell>{v.name}</TableCell><TableCell className="text-right">Rs. {v.credit_balance?.toFixed(2) || '0.00'}</TableCell></TableRow>))}</TableBody></Table></div></CardContent></Card>
          </div>
        </TabsContent>
        <TabsContent value="credits">
          <Card className="mt-4">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Credits</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    try {
                      exportToCSV({
                        filename: 'credits',
                        headers: ['Date', 'Vendor', 'Amount', 'Status', 'Comments'],
                        data: filteredCredits,
                        transformData: (credit) => ({
                          'Date': formatDateTime(credit.date),
                          'Vendor': credit.customers?.name || 'N/A',
                          'Amount': formatCurrency(credit.amount),
                          'Status': credit.status === 'pending' ? 'Pending' : 'Redeemed',
                          'Comments': credit.comments || ''
                        })
                      });
                      toast({ title: "Success", description: "Credits exported to CSV successfully" });
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
              {/* Credit Filters */}
              <div className="flex flex-col sm:flex-row gap-4 mb-4 p-4 border rounded-lg bg-muted/50">
                <Select value={creditStatusFilter} onValueChange={setCreditStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="redeemed">Redeemed</SelectItem>
                  </SelectContent>
                </Select>
                
                <Popover open={creditVendorFilterSearchOpen} onOpenChange={setCreditVendorFilterSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={creditVendorFilterSearchOpen} className="w-full sm:w-[200px] justify-between">
                      {creditVendorFilter !== "all" ? vendors.find((v) => v.id === creditVendorFilter)?.name : "Select vendor..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[200px] p-0">
                    <Command>
                      <CommandInput placeholder="Search vendor..." />
                      <CommandList>
                        <CommandEmpty>No vendor found.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem value="all" onSelect={() => {setCreditVendorFilter("all"); setCreditVendorFilterSearchOpen(false);}}>All Vendors</CommandItem>
                          {vendors.map((v) => (
                            <CommandItem key={v.id} value={v.name} onSelect={() => {setCreditVendorFilter(v.id); setCreditVendorFilterSearchOpen(false);}}>
                              {v.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant={"outline"} className="w-full sm:w-auto justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {creditDateRange?.from ? (
                        creditDateRange.to ? (
                          `${format(creditDateRange.from, "LLL dd, y")} - ${format(creditDateRange.to, "LLL dd, y")}`
                        ) : (
                          format(creditDateRange.from, "LLL dd, y")
                        )
                      ) : (
                        <span>Pick date range</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar initialFocus mode="range" defaultMonth={creditDateRange?.from} selected={creditDateRange} onSelect={setCreditDateRange} numberOfMonths={2} />
                  </PopoverContent>
                </Popover>
                
                <Button 
                  onClick={clearCreditFilters} 
                  variant="outline"
                  disabled={!hasCreditFilters}
                  className="w-full sm:w-auto"
                >
                  Clear Filters
                </Button>
              </div>
              
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Comments</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          Loading...
                        </TableCell>
                      </TableRow>
                    ) : filteredCredits.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          {credits.length === 0 ? "No credits found." : "No credits match the current filters."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredCredits.map((credit) => (
                        <TableRow key={credit.id}>
                          <TableCell>{new Date(credit.date).toLocaleDateString()}</TableCell>
                          <TableCell>{credit.customers?.name || 'N/A'}</TableCell>
                          <TableCell>₹{credit.amount.toFixed(2)}</TableCell>
                          <TableCell>
                            <Badge variant={credit.status === 'redeemed' ? 'default' : 'secondary'}>
                              {credit.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-xs truncate">{credit.comments}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEditCreditDialog(credit)}
                              >
                                Edit
                              </Button>
                              {credit.status === 'pending' && (
                                <Button
                                  size="sm"
                                  onClick={() => updateCreditStatus(credit.id, 'redeemed')}
                                >
                                  Mark Redeemed
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Credit Dialog */}
      <Dialog open={isEditCreditDialogOpen} onOpenChange={setIsEditCreditDialogOpen}>
        <DialogContent className="w-[95vw] max-w-md mx-auto">
          <DialogHeader>
            <DialogTitle>Edit Credit</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editCreditAmount">Credit Amount</Label>
                <Input 
                  id="editCreditAmount"
                  type="number" 
                  min="0" 
                  step="0.01" 
                  value={creditAmount} 
                  onChange={(e) => setCreditAmount(parseFloat(e.target.value) || 0)} 
                  placeholder="0.00" 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editCreditDate">Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant={"outline"} className="w-full justify-start text-left font-normal">
                      {creditDate ? format(creditDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={creditDate} onSelect={setCreditDate} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="editCreditVendor">Vendor</Label>
              <Popover open={creditVendorSearchOpen} onOpenChange={setCreditVendorSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={creditVendorSearchOpen}
                    className="w-full justify-between"
                  >
                    <span className="truncate">
                      {selectedCreditVendor
                        ? vendors.find((vendor) => vendor.id === selectedCreditVendor)?.name
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
                        {vendors.map((vendor) => (
                          <CommandItem
                            key={vendor.id}
                            value={vendor.name}
                            onSelect={() => {
                              setSelectedCreditVendor(vendor.id);
                              setCreditVendorSearchOpen(false);
                            }}
                            className="cursor-pointer"
                          >
                            <Check className={`mr-2 h-4 w-4 ${selectedCreditVendor === vendor.id ? "opacity-100" : "opacity-0"}`} />
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
              <Label htmlFor="editCreditComments">Comments</Label>
              <Textarea 
                id="editCreditComments"
                value={creditComments} 
                onChange={(e) => setCreditComments(e.target.value)} 
                placeholder="Add a note..." 
              />
            </div>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={() => setIsEditCreditDialogOpen(false)}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button 
              onClick={updateCredit} 
              disabled={isSubmitting}
              className="w-full sm:w-auto"
            >
              {isSubmitting ? 'Updating...' : 'Update Credit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};