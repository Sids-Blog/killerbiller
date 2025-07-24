import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { CreditCard, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Bill {
  id: string;
  amount: number;
  dueDate: string;
  status: "outstanding" | "partial" | "paid";
  paidAmount: number;
}

export const Payments = () => {
  const { toast } = useToast();
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [selectedBills, setSelectedBills] = useState<string[]>([]);

  // Placeholder data - will be replaced with Supabase data
  const customers = [
    { id: "1", name: "Tech Corp", outstanding: 3250.00 },
    { id: "2", name: "Design Studio", outstanding: 1890.50 },
    { id: "3", name: "StartupXYZ", outstanding: 4200.00 }
  ];

  const customerBills: Record<string, Bill[]> = {
    "1": [
      { id: "B001", amount: 1250.00, dueDate: "2024-01-15", status: "outstanding", paidAmount: 0 },
      { id: "B004", amount: 2000.00, dueDate: "2024-01-20", status: "outstanding", paidAmount: 0 }
    ],
    "2": [
      { id: "B002", amount: 890.50, dueDate: "2024-01-14", status: "outstanding", paidAmount: 0 },
      { id: "B005", amount: 1000.00, dueDate: "2024-01-18", status: "outstanding", paidAmount: 0 }
    ],
    "3": [
      { id: "B003", amount: 2100.00, dueDate: "2024-01-13", status: "partial", paidAmount: 1000.00 },
      { id: "B006", amount: 3100.00, dueDate: "2024-01-22", status: "outstanding", paidAmount: 0 }
    ]
  };

  const getSelectedCustomerBills = () => {
    return selectedCustomer ? customerBills[selectedCustomer] || [] : [];
  };

  const handleBillSelection = (billId: string, checked: boolean) => {
    if (checked) {
      setSelectedBills([...selectedBills, billId]);
    } else {
      setSelectedBills(selectedBills.filter(id => id !== billId));
    }
  };

  const getTotalSelected = () => {
    const bills = getSelectedCustomerBills();
    return selectedBills.reduce((total, billId) => {
      const bill = bills.find(b => b.id === billId);
      return total + (bill ? (bill.amount - bill.paidAmount) : 0);
    }, 0);
  };

  const processPayment = async () => {
    if (!selectedCustomer || selectedBills.length === 0 || paymentAmount <= 0) {
      toast({
        title: "Error",
        description: "Please select customer, bills, and enter payment amount",
        variant: "destructive"
      });
      return;
    }

    // TODO: Replace with actual Supabase call
    console.log("Processing payment:", {
      customerId: selectedCustomer,
      billIds: selectedBills,
      amount: paymentAmount
    });

    toast({
      title: "Success",
      description: `Payment of $${paymentAmount} processed successfully`
    });

    // Reset form
    setSelectedCustomer("");
    setSelectedBills([]);
    setPaymentAmount(0);
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
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      <div className="flex justify-between w-full">
                        <span>{customer.name}</span>
                        <span className="text-muted-foreground">
                          ${customer.outstanding.toFixed(2)} outstanding
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
                  {getSelectedCustomerBills().map((bill) => (
                    <div key={bill.id} className="flex items-center space-x-3 p-2 hover:bg-muted rounded">
                      <Checkbox
                        id={bill.id}
                        checked={selectedBills.includes(bill.id)}
                        onCheckedChange={(checked) => handleBillSelection(bill.id, checked as boolean)}
                      />
                      <div className="flex-1">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{bill.id}</span>
                          <Badge variant={bill.status === 'outstanding' ? 'destructive' : 'secondary'}>
                            {bill.status}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Due: {bill.dueDate} | 
                          Remaining: ${(bill.amount - bill.paidAmount).toFixed(2)}
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
                  Total selected: ${getTotalSelected().toFixed(2)}
                </p>
              )}
            </div>

            <Button 
              onClick={processPayment} 
              className="w-full"
              disabled={!selectedCustomer || selectedBills.length === 0 || paymentAmount <= 0}
            >
              Process Payment
            </Button>
          </CardContent>
        </Card>

        {/* Customer Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Customer Balances
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {customers.map((customer) => (
                <div key={customer.id} className="p-4 bg-muted rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-medium">{customer.name}</h3>
                    <Badge variant={customer.outstanding > 0 ? "destructive" : "default"}>
                      ${customer.outstanding.toFixed(2)}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {customerBills[customer.id]?.length || 0} outstanding bills
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
          <div className="text-center py-8 text-muted-foreground">
            Payment history will appear here once connected to Supabase
          </div>
        </CardContent>
      </Card>
    </div>
  );
};