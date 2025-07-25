import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { CreditCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

type BillStatus = "outstanding" | "partial" | "paid";

interface Bill {
  id: string;
  total_amount: number;
  due_date: string;
  status: BillStatus;
  paid_amount: number;
}

interface Customer {
  id: string;
  name: string;
  outstanding_balance: number;
}

interface Payment {
    id: string;
    amount: number;
    created_at: string;
    bills: { id: string; } | null;
    customers: { name: string; } | null;
}

export const Payments = () => {
  const { toast } = useToast();
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [selectedBills, setSelectedBills] = useState<string[]>([]);
  
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerBills, setCustomerBills] = useState<Bill[]>([]);
  const [recentPayments, setRecentPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("customers")
      .select("id, name, outstanding_balance")
      .eq('is_active', true)
      .order("name");
    
    if (error) {
      toast({ title: "Error fetching customers", description: error.message, variant: "destructive" });
    } else {
      setCustomers(data || []);
    }
    setLoading(false);
  }, [toast]);

  const fetchRecentPayments = useCallback(async () => {
    const { data, error } = await supabase
      .from("payments")
      .select(`
        id,
        amount,
        created_at,
        bills (id),
        customers (name)
      `)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      toast({ title: "Error fetching recent payments", description: error.message, variant: "destructive" });
    } else {
      setRecentPayments(data || []);
    }
  }, [toast]);

  useEffect(() => {
    fetchCustomers();
    fetchRecentPayments();
  }, [fetchCustomers, fetchRecentPayments]);

  useEffect(() => {
    const fetchCustomerBills = async () => {
      if (!selectedCustomer) {
        setCustomerBills([]);
        return;
      }
      const { data, error } = await supabase
        .from("bills")
        .select("*")
        .eq("customer_id", selectedCustomer)
        .in("status", ["outstanding", "partial"]);
      
      if (error) {
        toast({ title: "Error fetching bills", description: error.message, variant: "destructive" });
      } else {
        setCustomerBills(data || []);
      }
    };
    fetchCustomerBills();
  }, [selectedCustomer, toast]);

  const handleBillSelection = (billId: string, checked: boolean) => {
    if (checked) {
      setSelectedBills([...selectedBills, billId]);
    } else {
      setSelectedBills(selectedBills.filter(id => id !== billId));
    }
  };

  const getTotalSelected = () => {
    return selectedBills.reduce((total, billId) => {
      const bill = customerBills.find(b => b.id === billId);
      return total + (bill ? (bill.total_amount - bill.paid_amount) : 0);
    }, 0);
  };

  const processPayment = async () => {
    if (!selectedCustomer || selectedBills.length === 0 || paymentAmount <= 0) {
      toast({ title: "Error", description: "Please select customer, bills, and enter payment amount", variant: "destructive" });
      return;
    }

    // Note: For production, these operations should be wrapped in a single transaction 
    // using a Supabase Edge Function to ensure data consistency.
    const { error } = await supabase.rpc('process_payment', {
      p_customer_id: selectedCustomer,
      p_payment_amount: paymentAmount,
      p_bill_ids: selectedBills
    });

    if (error) {
      toast({ title: "Error processing payment", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: `Payment of ₹${paymentAmount} processed successfully` });
      // Reset form and refetch data
      setSelectedCustomer("");
      setSelectedBills([]);
      setPaymentAmount(0);
      fetchCustomers();
      fetchRecentPayments();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Payment Collection</h1>
        <p className="text-muted-foreground">Process customer payments and update balances</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Record Payment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customer">Customer</Label>
              <Select value={selectedCustomer} onValueChange={(value) => {
                setSelectedCustomer(value);
                setSelectedBills([]);
              }} disabled={loading}>
                <SelectTrigger>
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      <div className="flex justify-between w-full">
                        <span>{customer.name}</span>
                        <span className="text-muted-foreground">
                          ₹{customer.outstanding_balance.toFixed(2)} outstanding
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedCustomer && (
              <div className="space-y-3">
                <Label>Outstanding Bills</Label>
                <div className="border rounded-lg p-3 space-y-2 max-h-60 overflow-y-auto">
                  {customerBills.map((bill) => (
                    <div key={bill.id} className="flex items-center space-x-3 p-2 hover:bg-muted rounded">
                      <Checkbox
                        id={bill.id}
                        checked={selectedBills.includes(bill.id)}
                        onCheckedChange={(checked) => handleBillSelection(bill.id, checked as boolean)}
                      />
                      <div className="flex-1">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">Bill #{bill.id.substring(0, 5)}</span>
                          <Badge variant={bill.status === 'outstanding' ? 'destructive' : 'secondary'}>
                            {bill.status}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Due: {new Date(bill.due_date).toLocaleDateString()} | 
                          Remaining: ₹{(bill.total_amount - bill.paid_amount).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="amount">Payment Amount</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
              />
              {selectedBills.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  Total selected: ₹{getTotalSelected().toFixed(2)}
                </p>
              )}
            </div>

            <Button 
              onClick={processPayment} 
              className="w-full"
              disabled={!selectedCustomer || selectedBills.length === 0 || paymentAmount <= 0 || loading}
            >
              Process Payment
            </Button>
          </CardContent>
        </Card>

        {/* Customer Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="font-bold text-lg">₹</span>
              Customer Balances
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {customers.map((customer) => (
                <div key={customer.id} className="p-4 bg-muted rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-medium">{customer.name}</h3>
                    <Badge variant={customer.outstanding_balance > 0 ? "destructive" : "default"}>
                      ₹{customer.outstanding_balance.toFixed(2)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Payments */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Payments</CardTitle>
        </CardHeader>
        <CardContent>
          {recentPayments.length > 0 ? (
            <div className="space-y-3">
              {recentPayments.map(payment => (
                <div key={payment.id} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                  <div>
                    <p className="font-medium">
                      {payment.customers?.name || 'N/A'} paid ₹{payment.amount.toFixed(2)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(payment.created_at).toLocaleString()}
                    </p>
                  </div>
                  <Badge variant="outline">
                    Bill #{payment.bills?.id.substring(0,5) || 'N/A'}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No recent payments
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};