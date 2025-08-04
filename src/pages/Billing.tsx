import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, Plus, Download, ChevronsUpDown, Check } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";
import html2pdf from "html2pdf.js";
import InvoiceTemplate from "@/components/templates/InvoiceTemplate";
import ReceiptTemplate from "@/components/templates/ReceiptTemplate";
import { createRoot } from "react-dom/client";
import { Customer } from "./Customers";
import { exportToCSV, formatCurrency, formatDate } from "@/lib/csv-export";

// Interfaces
export interface BillItem {
  product_id: string;
  product_name: string;
  master_lot_size: number;
  lots: string;
  quantity: number;
  price: number;
  lot_price: number;
}

interface Product {
  id: string;
  name: string;
  price: number;
  lot_size: number;
  lot_price: number;
  inventory: { quantity: number };
}

interface Bill {
  id: string;
  invoice_number: string;
  created_at: string;
  date_of_bill: string;
  total_amount: number;
  status: "outstanding" | "paid" | "partial";
  is_gst_bill: boolean;
  customers: { name: string } | null;
}

export const Billing = () => {
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const orderState = location.state?.order;

  // Create Bill states
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [billItems, setBillItems] = useState<BillItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [discount, setDiscount] = useState(0);
  const [comments, setComments] = useState("");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [billDate, setBillDate] = useState<Date | undefined>(new Date());
  const [isGstBill, setIsGstBill] = useState(false);
  const [sgstPercent, setSgstPercent] = useState(14);
  const [cgstPercent, setCgstPercent] = useState(14);
  const [cessPercent, setCessPercent] = useState(12);

  // Shared states
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // All Bills states
  const [bills, setBills] = useState<Bill[]>([]);
  const [filteredBills, setFilteredBills] = useState<Bill[]>([]);
  const [customerFilter, setCustomerFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [gstFilter, setGstFilter] = useState("all");
  const [billToDelete, setBillToDelete] = useState<string | null>(null);

  // Searchable dropdown states
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [productSearchOpen, setProductSearchOpen] = useState(false);
  const [customerFilterSearchOpen, setCustomerFilterSearchOpen] =
    useState(false);

  const handleDeleteBill = async () => {
    if (!billToDelete) return;
    setLoading(true);

    const { error } = await supabase.rpc("delete_bill", {
      p_bill_id: billToDelete,
    });

    if (error) {
      toast({
        title: "Error deleting bill",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Success", description: "Bill deleted successfully" });
      fetchData();
    }

    setBillToDelete(null);
    setLoading(false);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    const customerPromise = supabase
      .from("customers")
      .select("*")
      .eq("is_active", true)
      .eq("type", "customer");
    const productPromise = supabase
      .from("products")
      .select("*, inventory(quantity)");
    const billsPromise = supabase
      .from("bills")
      .select(
        "id, invoice_number, created_at, date_of_bill, total_amount, status, is_gst_bill, customers ( name )"
      )
      .order("date_of_bill", { ascending: false });

    const [customerRes, productRes, billsRes] = await Promise.all([
      customerPromise,
      productPromise,
      billsPromise,
    ]);

    if (customerRes.error)
      toast({
        title: "Error fetching customers",
        description: customerRes.error.message,
        variant: "destructive",
      });
    else setCustomers(customerRes.data || []);

    if (productRes.error)
      toast({
        title: "Error fetching products",
        description: productRes.error.message,
        variant: "destructive",
      });
    else setProducts(productRes.data || []);

    if (billsRes.error)
      toast({
        title: "Error fetching bills",
        description: billsRes.error.message,
        variant: "destructive",
      });
    else {
      const transformedData = (billsRes.data || []).map((bill) => ({
        ...bill,
        customers: Array.isArray(bill.customers)
          ? bill.customers[0] || null
          : bill.customers,
      }));
      setBills(transformedData as unknown as Bill[]);
      setFilteredBills(transformedData as unknown as Bill[]);
    }

    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (orderState && products.length > 0 && customers.length > 0) {
      setSelectedCustomer(orderState.customer_id);
      setOrderId(orderState.id);
      const items = orderState.order_items.map(
        (item: { product_id: string; quantity: number }) => {
          const product = products.find((p) => p.id === item.product_id);
          return {
            product_id: item.product_id,
            product_name: product?.name || "Unknown",
            master_lot_size: product?.lot_size || 0,
            lots: item.quantity / (product?.lot_size || 1) + "",
            quantity: item.quantity,
            price: product?.price || 0,
            lot_price: product?.lot_price || 0,
          };
        }
      );
      setBillItems(items);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [orderState, products, customers, navigate, location.pathname]);

  useEffect(() => {
    let result = bills;
    if (customerFilter !== "all")
      result = result.filter(
        (bill) =>
          bill.customers?.name ===
          customers.find((c) => c.id === customerFilter)?.name
      );
    if (statusFilter !== "all")
      result = result.filter((bill) => bill.status === statusFilter);
    if (gstFilter !== "all")
      result = result.filter((bill) =>
        gstFilter === "gst" ? bill.is_gst_bill : !bill.is_gst_bill
      );
    setFilteredBills(result);
  }, [customerFilter, statusFilter, gstFilter, bills, customers]);

  const addItem = () => {
    if (!selectedProduct) return;
    const product = products.find((p) => p.id === selectedProduct);
    if (!product) return;

    const availableStock = product.inventory?.quantity ?? 0;
    const quantityInBill = billItems
      .filter((item) => item.product_id === selectedProduct)
      .reduce((sum, item) => sum + item.quantity, 0);

    const requestedQuantity = product.lot_size;

    if (quantityInBill + requestedQuantity > availableStock) {
      toast({
        title: "Error: Stock Limit Exceeded",
        description: `Cannot add ${requestedQuantity} of ${product.name}. Available stock: ${availableStock}. You already have ${quantityInBill} in this bill.`,
        variant: "destructive",
      });
      return;
    }

    setBillItems([
      ...billItems,
      {
        product_id: product.id,
        product_name: product.name,
        master_lot_size: product.lot_size,
        lots: "1",
        quantity: product.lot_size,
        price: product.price,
        lot_price: product.lot_price,
      },
    ]);
    setSelectedProduct("");
  };

  const removeItem = (index: number) => {
    setBillItems(billItems.filter((_, i) => i !== index));
  };

  const handleItemChange = (
    index: number,
    field: keyof BillItem,
    value: string | number
  ) => {
    const updatedItems = [...billItems];
    const item = { ...updatedItems[index] };
    const product = products.find((p) => p.id === item.product_id);
    if (!product) return;

    const availableStock = product.inventory?.quantity ?? 0;
    let newQuantity = item.quantity;

    switch (field) {
      case "lots":
        newQuantity = (parseInt(String(value)) || 0) * item.master_lot_size;
        if (newQuantity > availableStock) {
          toast({
            title: "Error: Stock Limit Exceeded",
            description: `Cannot set quantity to ${newQuantity} for ${product.name}. Available stock: ${availableStock}.`,
            variant: "destructive",
          });
          return;
        }
        item.lots = String(value);
        item.quantity = newQuantity;
        item.price = product.price;
        item.lot_price = product.lot_price;
        break;
      case "quantity":
        newQuantity = parseInt(String(value)) || 0;
        if (newQuantity > availableStock) {
          toast({
            title: "Error: Stock Limit Exceeded",
            description: `Cannot set quantity to ${newQuantity} for ${product.name}. Available stock: ${availableStock}.`,
            variant: "destructive",
          });
          return;
        }
        item.quantity = newQuantity;
        item.lots = "";
        break;
      case "price":
        item.price = parseFloat(String(value)) || 0;
        item.lot_price = item.price * item.master_lot_size;
        break;
      case "lot_price":
        item.lot_price = parseFloat(String(value)) || 0;
        if (item.master_lot_size > 0)
          item.price = item.lot_price / item.master_lot_size;
        break;
    }
    updatedItems[index] = item;
    setBillItems(updatedItems);
  };

  const billCalculations = useMemo(() => {
    const subtotal = billItems.reduce(
      (sum, item) => sum + item.quantity * item.price,
      0
    );
    let grandTotal = subtotal - discount;
    let taxDetails = {
      sgst: 0,
      cgst: 0,
      cess: 0,
      taxableValue: subtotal,
    };

    if (isGstBill) {
      const totalGstRate = (sgstPercent + cgstPercent + cessPercent) / 100;
      let totalTaxableValue = 0;
      let totalSgst = 0;
      let totalCgst = 0;
      let totalCess = 0;

      billItems.forEach((item) => {
        const finalPrice = item.price * item.quantity;
        const basePrice = finalPrice / (1 + totalGstRate);
        totalTaxableValue += basePrice;
        if (totalGstRate > 0) {
          totalSgst += basePrice * (sgstPercent / 100);
          totalCgst += basePrice * (cgstPercent / 100);
          totalCess += basePrice * (cessPercent / 100);
        }
      });

      taxDetails = {
        sgst: totalSgst,
        cgst: totalCgst,
        cess: totalCess,
        taxableValue: totalTaxableValue,
      };
      grandTotal =
        totalTaxableValue + totalSgst + totalCgst + totalCess - discount;
    }

    return {
      subtotal,
      grandTotal,
      ...taxDetails,
    };
  }, [billItems, discount, isGstBill, sgstPercent, cgstPercent, cessPercent]);

  const previewInvoice = (
    billDetails: Bill,
    items: BillItem[],
    customerDetails: Customer
  ) => {
    // Create a modal container
    const modal = document.createElement("div");
    modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0,0,0,0.8);
    z-index: 10000;
    display: flex;
    justify-content: center;
    align-items: center;
    overflow-y: auto;
    padding: 20px;
    box-sizing: border-box;
  `;

    // Create content container with responsive dimensions
    const content = document.createElement("div");
    const A4_WIDTH_MM = 210;
    const A4_HEIGHT_MM = 297;
    const isMobileView = window.innerWidth < 768;

    content.style.cssText = `
    background-color: white;
    width: ${isMobileView ? '100vw' : `${A4_WIDTH_MM}mm`};
    min-width: ${isMobileView ? '100vw' : `${A4_WIDTH_MM}mm`};
    max-width: ${isMobileView ? '100vw' : `${A4_WIDTH_MM}mm`};
    min-height: ${isMobileView ? '100vh' : `${A4_HEIGHT_MM}mm`};
    position: relative;
    border-radius: ${isMobileView ? '0' : '8px'};
    box-shadow: ${isMobileView ? 'none' : '0 10px 30px rgba(0,0,0,0.3)'};
    margin: auto;
    overflow: ${isMobileView ? 'auto' : 'visible'};
  `;

    modal.appendChild(content);
    document.body.appendChild(modal);

    // Control panel (buttons) - positioned outside React root
    const controlPanel = document.createElement("div");
    const isMobile = window.innerWidth < 768;
    
    controlPanel.style.cssText = `
    position: fixed;
    top: ${isMobile ? '20px' : '10px'};
    right: ${isMobile ? '20px' : '10px'};
    display: flex;
    gap: ${isMobile ? '12px' : '10px'};
    z-index: 10002;
    background: rgba(255, 255, 255, 0.95);
    padding: ${isMobile ? '12px' : '8px'};
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    backdrop-filter: blur(10px);
  `;

    // Download button
    const downloadButton = document.createElement("button");
    downloadButton.innerHTML = isMobile ? "📥" : "📥 PDF";
    downloadButton.style.cssText = `
    background: #007bff;
    color: white;
    border: none;
    padding: ${isMobile ? '10px 12px' : '6px 12px'};
    border-radius: 6px;
    cursor: pointer;
    font-size: ${isMobile ? '16px' : '12px'};
    font-weight: bold;
    box-shadow: 0 2px 8px rgba(0,123,255,0.3);
    min-width: ${isMobile ? '44px' : 'auto'};
    min-height: ${isMobile ? '44px' : 'auto'};
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  `;

    // Close button
    const closeButton = document.createElement("button");
    closeButton.innerHTML = "✕";
    closeButton.style.cssText = `
    background: #dc3545;
    color: white;
    border: none;
    padding: ${isMobile ? '10px 12px' : '6px 10px'};
    border-radius: 6px;
    cursor: pointer;
    font-size: ${isMobile ? '18px' : '12px'};
    font-weight: bold;
    box-shadow: 0 2px 8px rgba(220,53,69,0.3);
    min-width: ${isMobile ? '44px' : 'auto'};
    min-height: ${isMobile ? '44px' : 'auto'};
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  `;

    const cleanup = () => {
      root.unmount();
      document.body.removeChild(modal);
    };

    downloadButton.onclick = async () => {
      try {
        downloadButton.innerHTML = "⏳...";
        downloadButton.disabled = true;

        // Use the visible content for PDF generation
        const pdfOptions = {
          margin: 0.4,
          filename: `invoice_${billDetails.id.substring(0, 8)}.pdf`,
          image: {
            type: "jpeg",
            quality: 0.98,
          },
          html2canvas: {
            scale: 2,
            useCORS: true,
            allowTaint: false,
            backgroundColor: "#ffffff",
            logging: false,
            width: content.offsetWidth,
            height: content.offsetHeight,
            scrollX: 0,
            scrollY: 0,
            windowWidth: content.offsetWidth,
            windowHeight: content.offsetHeight,
          },
          jsPDF: {
            unit: "mm",
            format: "a4",
            orientation: "portrait",
            compress: true,
          },
        };

        // Generate PDF from the visible modal content
        await html2pdf().from(content).set(pdfOptions).save();

        toast({
          title: "PDF Downloaded Successfully",
          description: "Your invoice has been downloaded.",
          variant: "default",
        });
      } catch (error: any) {
        console.error("PDF generation error:", error);
        toast({
          title: "PDF Generation Failed",
          description:
            error.message ||
            "There was an error generating the PDF. Please try again.",
          variant: "destructive",
        });
      } finally {
        downloadButton.innerHTML = "📥 PDF";
        downloadButton.disabled = false;
      }
    };

    closeButton.onclick = cleanup;

    // Add buttons to control panel
    controlPanel.appendChild(downloadButton);
    controlPanel.appendChild(closeButton);
    
    // Add control panel to modal (not content)
    modal.appendChild(controlPanel);

    // Render the invoice with responsive dimensions
    const root = createRoot(content);
    root.render(
      <div
        style={{
          width: isMobileView ? '100vw' : `${A4_WIDTH_MM}mm`,
          minWidth: isMobileView ? '100vw' : `${A4_WIDTH_MM}mm`,
          maxWidth: isMobileView ? '100vw' : `${A4_WIDTH_MM}mm`,
          minHeight: isMobileView ? '100vh' : `${A4_HEIGHT_MM}mm`,
          backgroundColor: "white",
          margin: 0,
          padding: isMobileView ? '10px' : 0,
          boxSizing: "border-box",
          overflow: isMobileView ? 'auto' : 'hidden',
          transform: isMobileView ? 'scale(0.8)' : 'none',
          transformOrigin: 'top left',
        }}
      >
        <InvoiceTemplate
          billCalculations={billCalculations}
          billDetails={billDetails}
          items={items}
          customerDetails={customerDetails}
        />
      </div>
    );

    // Close modal when clicking outside (but not on buttons)
    modal.onclick = (e) => {
      if (e.target === modal) {
        cleanup();
      }
    };

    // Handle ESC key to close modal
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        cleanup();
        document.removeEventListener("keydown", handleEscKey);
      }
    };
    document.addEventListener("keydown", handleEscKey);
  };

  const previewReceipt = (
    billDetails: Bill,
    items: BillItem[],
    customerDetails: Customer
  ) => {
    // Create a modal container
    const modal = document.createElement("div");
    modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0,0,0,0.8);
    z-index: 10000;
    display: flex;
    justify-content: center;
    align-items: center;
    overflow-y: auto;
    padding: 20px;
    box-sizing: border-box;
  `;

    // Create content container with responsive dimensions
    const content = document.createElement("div");
    const A4_WIDTH_MM = 210;
    const A4_HEIGHT_MM = 297;
    const isMobileView = window.innerWidth < 768;

    content.style.cssText = `
    background-color: white;
    width: ${isMobileView ? '100vw' : `${A4_WIDTH_MM}mm`};
    min-width: ${isMobileView ? '100vw' : `${A4_WIDTH_MM}mm`};
    max-width: ${isMobileView ? '100vw' : `${A4_WIDTH_MM}mm`};
    min-height: ${isMobileView ? '100vh' : `${A4_HEIGHT_MM}mm`};
    position: relative;
    border-radius: ${isMobileView ? '0' : '8px'};
    box-shadow: ${isMobileView ? 'none' : '0 10px 30px rgba(0,0,0,0.3)'};
    margin: auto;
    overflow: ${isMobileView ? 'auto' : 'visible'};
  `;

    modal.appendChild(content);
    document.body.appendChild(modal);

    // Control panel (buttons) - positioned outside React root
    const controlPanel = document.createElement("div");
    const isMobile = window.innerWidth < 768;
    
    controlPanel.style.cssText = `
    position: fixed;
    top: ${isMobile ? '20px' : '10px'};
    right: ${isMobile ? '20px' : '10px'};
    display: flex;
    gap: ${isMobile ? '12px' : '10px'};
    z-index: 10002;
    background: rgba(255, 255, 255, 0.95);
    padding: ${isMobile ? '12px' : '8px'};
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    backdrop-filter: blur(10px);
  `;

    // Download button
    const downloadButton = document.createElement("button");
    downloadButton.innerHTML = isMobile ? "📄" : "📄 Receipt";
    downloadButton.style.cssText = `
    background: #28a745;
    color: white;
    border: none;
    padding: ${isMobile ? '10px 12px' : '6px 12px'};
    border-radius: 6px;
    cursor: pointer;
    font-size: ${isMobile ? '16px' : '12px'};
    font-weight: bold;
    box-shadow: 0 2px 8px rgba(40,167,69,0.3);
    min-width: ${isMobile ? '44px' : 'auto'};
    min-height: ${isMobile ? '44px' : 'auto'};
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  `;

    // Close button
    const closeButton = document.createElement("button");
    closeButton.innerHTML = "✕";
    closeButton.style.cssText = `
    background: #dc3545;
    color: white;
    border: none;
    padding: ${isMobile ? '10px 12px' : '6px 10px'};
    border-radius: 6px;
    cursor: pointer;
    font-size: ${isMobile ? '18px' : '12px'};
    font-weight: bold;
    box-shadow: 0 2px 8px rgba(220,53,69,0.3);
    min-width: ${isMobile ? '44px' : 'auto'};
    min-height: ${isMobile ? '44px' : 'auto'};
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  `;

    const cleanup = () => {
      root.unmount();
      document.body.removeChild(modal);
    };

    downloadButton.onclick = async () => {
      try {
        downloadButton.innerHTML = "⏳...";
        downloadButton.disabled = true;

        // Use the visible content for PDF generation
        const pdfOptions = {
          margin: 0.4,
          filename: `receipt_${billDetails.id.substring(0, 8)}.pdf`,
          image: {
            type: "jpeg",
            quality: 0.98,
          },
          html2canvas: {
            scale: 2,
            useCORS: true,
            allowTaint: false,
            backgroundColor: "#ffffff",
            logging: false,
            width: content.offsetWidth,
            height: content.offsetHeight,
            scrollX: 0,
            scrollY: 0,
            windowWidth: content.offsetWidth,
            windowHeight: content.offsetHeight,
          },
          jsPDF: {
            unit: "mm",
            format: "a4",
            orientation: "portrait",
            compress: true,
          },
        };

        // Generate PDF from the visible modal content
        await html2pdf().from(content).set(pdfOptions).save();

        toast({
          title: "Receipt Downloaded Successfully",
          description: "Your receipt has been downloaded.",
          variant: "default",
        });
      } catch (error: any) {
        console.error("PDF generation error:", error);
        toast({
          title: "PDF Generation Failed",
          description:
            error.message ||
            "There was an error generating the PDF. Please try again.",
          variant: "destructive",
        });
      } finally {
        downloadButton.innerHTML = "📄 Receipt";
        downloadButton.disabled = false;
      }
    };

    closeButton.onclick = cleanup;

    // Add buttons to control panel
    controlPanel.appendChild(downloadButton);
    controlPanel.appendChild(closeButton);
    
    // Add control panel to modal (not content)
    modal.appendChild(controlPanel);

    // Render the receipt with responsive dimensions
    const root = createRoot(content);
    root.render(
      <div
        style={{
          width: isMobileView ? '100vw' : `${A4_WIDTH_MM}mm`,
          minWidth: isMobileView ? '100vw' : `${A4_WIDTH_MM}mm`,
          maxWidth: isMobileView ? '100vw' : `${A4_WIDTH_MM}mm`,
          minHeight: isMobileView ? '100vh' : `${A4_HEIGHT_MM}mm`,
          backgroundColor: "white",
          margin: 0,
          padding: isMobileView ? '10px' : 0,
          boxSizing: "border-box",
          overflow: isMobileView ? 'auto' : 'hidden',
          transform: isMobileView ? 'scale(0.8)' : 'none',
          transformOrigin: 'top left',
        }}
      >
        <ReceiptTemplate
          billDetails={billDetails}
          items={items}
          customerDetails={customerDetails}
        />
      </div>
    );

    // Close modal when clicking outside (but not on buttons)
    modal.onclick = (e) => {
      if (e.target === modal) {
        cleanup();
      }
    };

    // Handle ESC key to close modal
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        cleanup();
        document.removeEventListener("keydown", handleEscKey);
      }
    };
    document.addEventListener("keydown", handleEscKey);
  };

  // Simplified generatePdf function that just calls previewInvoice
  const generatePdf = async (
    billDetails: Bill,
    items: BillItem[],
    customerDetails: Customer
  ) => {
    previewInvoice(billDetails, items, customerDetails);
  };

  const handleDownloadPdf = async (billId: string) => {
    setLoading(true);
    const { data: billDetails, error: billError } = await supabase
      .from("bills")
      .select("*, customers(*)")
      .eq("id", billId)
      .single();

    if (billError || !billDetails) {
      toast({
        title: "Error fetching bill details",
        description: billError?.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const { data: billItemsData, error: itemsError } = await supabase
      .from("bill_items")
      .select("*, products(name)")
      .eq("bill_id", billId);

    if (itemsError || !billItemsData) {
      toast({
        title: "Error fetching bill items",
        description: itemsError?.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const customer = Array.isArray(billDetails.customers)
      ? billDetails.customers[0]
      : billDetails.customers;

    if (!customer) {
      toast({
        title: "Error",
        description: "Customer details not found for this bill.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const itemsForPdf: BillItem[] = billItemsData.map(
      (item: {
        product_id: string;
        products: { name: string };
        quantity: number;
        price: number;
      }) => ({
        product_id: item.product_id,
        product_name: item.products?.name || "Unknown Product",
        quantity: item.quantity,
        price: item.price,
        master_lot_size: 0,
        lots: "",
        lot_price: 0,
      })
    );

    //generatePdf(billDetails, itemsForPdf, customer);
    previewInvoice(billDetails, itemsForPdf, customer);
    setLoading(false);
  };

  const handleDownloadReceipt = async (billId: string) => {
    setLoading(true);
    const { data: billDetails, error: billError } = await supabase
      .from("bills")
      .select("*, customers(*)")
      .eq("id", billId)
      .single();

    if (billError || !billDetails) {
      toast({
        title: "Error fetching bill details",
        description: billError?.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const { data: billItemsData, error: itemsError } = await supabase
      .from("bill_items")
      .select("*, products(name)")
      .eq("bill_id", billId);

    if (itemsError || !billItemsData) {
      toast({
        title: "Error fetching bill items",
        description: itemsError?.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const customer = Array.isArray(billDetails.customers)
      ? billDetails.customers[0]
      : billDetails.customers;

    if (!customer) {
      toast({
        title: "Error",
        description: "Customer details not found for this bill.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const itemsForPdf: BillItem[] = billItemsData.map(
      (item: {
        product_id: string;
        products: { name: string };
        quantity: number;
        price: number;
      }) => ({
        product_id: item.product_id,
        product_name: item.products?.name || "Unknown Product",
        quantity: item.quantity,
        price: item.price,
        master_lot_size: 0,
        lots: "",
        lot_price: 0,
      })
    );

    previewReceipt(billDetails, itemsForPdf, customer);
    setLoading(false);
  };

  const submitBill = async () => {
    if (!selectedCustomer || billItems.length === 0) {
      toast({
        title: "Error",
        description: "Please select a customer and add at least one item",
        variant: "destructive",
      });
      return;
    }

    // Final stock validation before submission
    for (const item of billItems) {
      const product = products.find((p) => p.id === item.product_id);
      const availableStock = product?.inventory?.quantity ?? 0;
      if (item.quantity > availableStock) {
        toast({
          title: "Error: Stock Limit Exceeded",
          description: `The quantity for ${item.product_name} (${item.quantity}) exceeds the available stock (${availableStock}). Please remove it or reduce the quantity.`,
          variant: "destructive",
        });
        return;
      }
    }

    const { grandTotal, sgst, cgst, cess } = billCalculations;

    const { data: bill, error: billError } = await supabase
      .from("bills")
      .insert({
        customer_id: selectedCustomer,
        total_amount: grandTotal,
        status: "outstanding",
        discount: discount,
        comments: comments,
        date_of_bill: billDate?.toISOString(),
        is_gst_bill: isGstBill,
        sgst_percentage: isGstBill ? sgstPercent : null,
        cgst_percentage: isGstBill ? cgstPercent : null,
        cess_percentage: isGstBill ? cessPercent : null,
        gst_amount: sgst + cgst + cess,
      })
      .select()
      .single();

    if (billError || !bill) {
      toast({
        title: "Error creating bill",
        description: billError?.message,
        variant: "destructive",
      });
      return;
    }

    const itemsToInsert = billItems.map((item) => ({
      bill_id: bill.id,
      product_id: item.product_id,
      quantity: item.quantity,
      price: item.price,
    }));

    const { error: itemsError } = await supabase
      .from("bill_items")
      .insert(itemsToInsert);
    if (itemsError) {
      toast({
        title: "Error adding bill items",
        description: itemsError.message,
        variant: "destructive",
      });
      return;
    }

    for (const item of billItems) {
      const { error: stockError } = await supabase.rpc("decrement_stock", {
        p_product_id: item.product_id,
        p_quantity: item.quantity,
      });
      if (stockError)
        toast({
          title: "Error updating stock",
          description: stockError.message,
          variant: "destructive",
        });
    }

    const { error: customerError } = await supabase.rpc(
      "update_customer_balance",
      { p_customer_id: selectedCustomer, p_amount: grandTotal }
    );
    if (customerError)
      toast({
        title: "Error updating customer balance",
        description: customerError.message,
        variant: "destructive",
      });

    if (orderId) {
      const { error: orderUpdateError } = await supabase
        .from("orders")
        .update({ status: "fulfilled" })
        .eq("id", orderId);
      if (orderUpdateError)
        toast({
          title: "Error updating order status",
          description: orderUpdateError.message,
          variant: "destructive",
        });
    }

    toast({ title: "Success", description: "Bill created successfully" });
    const customerDetails = customers.find((c) => c.id === selectedCustomer);
    if (customerDetails)
      generatePdf(
        { ...bill, discount, comments, grandTotal },
        billItems,
        customerDetails
      );

    setSelectedCustomer("");
    setBillItems([]);
    setDiscount(0);
    setComments("");
    setOrderId(null);
    setBillDate(new Date());
    fetchData();
  };

  return (
    <AlertDialog>
      <div className="space-y-6">
        <Tabs defaultValue="create-bill">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="create-bill">Create Bill</TabsTrigger>
            <TabsTrigger value="all-bills">All Bills</TabsTrigger>
          </TabsList>
          <TabsContent value="create-bill">
            <Card>
              <CardHeader>
                <CardTitle>Create a New Bill</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <Label htmlFor="customer">Customer</Label>
                    <Popover
                      open={customerSearchOpen}
                      onOpenChange={setCustomerSearchOpen}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={customerSearchOpen}
                          className="w-full justify-between"
                        >
                          <span className="truncate">
                            {selectedCustomer
                              ? customers.find(
                                  (customer) => customer.id === selectedCustomer
                                )?.name
                              : "Select a customer"}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] max-w-[95vw] p-0">
                        <Command>
                          <CommandInput
                            placeholder="Search customers..."
                            className="h-9"
                          />
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
                                  <Check
                                    className={`mr-2 h-4 w-4 ${
                                      selectedCustomer === customer.id
                                        ? "opacity-100"
                                        : "opacity-0"
                                    }`}
                                  />
                                  <div className="flex flex-col">
                                    <span className="truncate">
                                      {customer.name}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      Phone:{" "}
                                      {customer.primary_phone_number || "N/A"}
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
                  <div>
                    <Label htmlFor="billDate">Bill Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className="w-full justify-start text-left font-normal"
                        >
                          {billDate ? (
                            format(billDate, "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={billDate}
                          onSelect={setBillDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {/* Customer Comments Display */}
                {selectedCustomer && (() => {
                  const customer = customers.find(c => c.id === selectedCustomer);
                  return customer?.comments ? (
                    <div className="space-y-2">
                      <Label>Customer Comments</Label>
                      <Input
                        value={customer.comments}
                        disabled
                        className="bg-muted cursor-not-allowed text-muted-foreground"
                        placeholder="No comments available"
                      />
                    </div>
                  ) : null;
                })()}

                <div className="space-y-2">
                  <Label>Add Products</Label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Popover
                      open={productSearchOpen}
                      onOpenChange={setProductSearchOpen}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={productSearchOpen}
                          className="w-full justify-between"
                        >
                          <span className="truncate">
                            {selectedProduct
                              ? products.find(
                                  (product) => product.id === selectedProduct
                                )?.name
                              : "Select a product"}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] max-w-[95vw] p-0">
                        <Command>
                          <CommandInput
                            placeholder="Search products..."
                            className="h-9"
                          />
                          <CommandList className="max-h-[200px]">
                            <CommandEmpty>No product found.</CommandEmpty>
                            <CommandGroup>
                              {products.map((product) => (
                                <CommandItem
                                  key={product.id}
                                  value={product.name}
                                  onSelect={() => {
                                    setSelectedProduct(product.id);
                                    setProductSearchOpen(false);
                                  }}
                                  className="cursor-pointer"
                                >
                                  <Check
                                    className={`mr-2 h-4 w-4 ${
                                      selectedProduct === product.id
                                        ? "opacity-100"
                                        : "opacity-0"
                                    }`}
                                  />
                                  <div className="flex flex-col">
                                    <span className="truncate">
                                      {product.name}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      Stock: {product.inventory?.quantity ?? 0}{" "}
                                      | Price: ₹{product.price.toFixed(2)}
                                    </span>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <Button onClick={addItem} className="sm:w-auto w-full">
                      <Plus className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Add</span>
                    </Button>
                  </div>
                </div>

                {/* Mobile View for Bill Items */}
                <div className="space-y-4 md:hidden">
                  {billItems.map((item, index) => (
                    <Card key={index}>
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-base font-medium">
                          {item.product_name}
                        </CardTitle>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Case</Label>
                            <Input
                              type="number"
                              value={item.lots}
                              onChange={(e) =>
                                handleItemChange(index, "lots", e.target.value)
                              }
                            />
                          </div>
                          <div>
                            <Label>Quantity</Label>
                            <Input
                              type="number"
                              value={item.quantity}
                              onChange={(e) =>
                                handleItemChange(
                                  index,
                                  "quantity",
                                  e.target.value
                                )
                              }
                            />
                          </div>
                          <div>
                            <Label>Price/Unit</Label>
                            <Input
                              type="number"
                              value={item.price}
                              onChange={(e) =>
                                handleItemChange(index, "price", e.target.value)
                              }
                            />
                          </div>
                          <div>
                            <Label>Price/Lot</Label>
                            <Input
                              type="number"
                              value={item.lot_price}
                              onChange={(e) =>
                                handleItemChange(
                                  index,
                                  "lot_price",
                                  e.target.value
                                )
                              }
                            />
                          </div>
                        </div>
                        <div className="text-right font-medium">
                          Total: ₹{(item.quantity * item.price).toFixed(2)}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Desktop View for Bill Items */}
                <Card className="hidden md:block">
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-[150px]">
                              Product
                            </TableHead>
                            <TableHead>Case</TableHead>
                            <TableHead>Quantity</TableHead>
                            <TableHead>Price/Unit</TableHead>
                            <TableHead>Price/Lot</TableHead>
                            <TableHead>Total</TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {billItems.map((item, index) => (
                            <TableRow key={index}>
                              <TableCell>{item.product_name}</TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  value={item.lots}
                                  onChange={(e) =>
                                    handleItemChange(
                                      index,
                                      "lots",
                                      e.target.value
                                    )
                                  }
                                  className="min-w-[5rem]"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  value={item.quantity}
                                  onChange={(e) =>
                                    handleItemChange(
                                      index,
                                      "quantity",
                                      e.target.value
                                    )
                                  }
                                  className="min-w-[5rem]"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  value={item.price}
                                  onChange={(e) =>
                                    handleItemChange(
                                      index,
                                      "price",
                                      e.target.value
                                    )
                                  }
                                  className="min-w-[5rem]"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  value={item.lot_price}
                                  onChange={(e) =>
                                    handleItemChange(
                                      index,
                                      "lot_price",
                                      e.target.value
                                    )
                                  }
                                  className="min-w-[5rem]"
                                />
                              </TableCell>
                              <TableCell>
                                ₹{(item.quantity * item.price).toFixed(2)}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeItem(index)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="include-gst"
                    checked={isGstBill}
                    onCheckedChange={(checked) =>
                      setIsGstBill(Boolean(checked))
                    }
                  />
                  <Label htmlFor="include-gst" className="font-medium">
                    Include GST
                  </Label>
                </div>

                {isGstBill && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-lg">
                    <div>
                      <Label htmlFor="sgst">SGST (%)</Label>
                      <Input
                        id="sgst"
                        type="number"
                        value={sgstPercent}
                        onChange={(e) => setSgstPercent(Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="cgst">CGST (%)</Label>
                      <Input
                        id="cgst"
                        type="number"
                        value={cgstPercent}
                        onChange={(e) => setCgstPercent(Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="cess">CESS (%)</Label>
                      <Input
                        id="cess"
                        type="number"
                        value={cessPercent}
                        onChange={(e) => setCessPercent(Number(e.target.value))}
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="discount">Discount (₹)</Label>
                    <Input
                      id="discount"
                      type="number"
                      value={discount}
                      onChange={(e) => setDiscount(Number(e.target.value))}
                    />
                  </div>
                  <div className="text-right space-y-1">
                    <p>Subtotal: ₹{billCalculations.taxableValue.toFixed(2)}</p>
                    {isGstBill && (
                      <>
                        <p>
                          SGST ({sgstPercent}%): ₹
                          {billCalculations.sgst.toFixed(2)}
                        </p>
                        <p>
                          CGST ({cgstPercent}%): ₹
                          {billCalculations.cgst.toFixed(2)}
                        </p>
                        {cessPercent > 0 && (
                          <p>
                            CESS ({cessPercent}%): ₹
                            {billCalculations.cess.toFixed(2)}
                          </p>
                        )}
                      </>
                    )}
                    <p>Discount: - ₹{discount.toFixed(2)}</p>
                    <p className="font-bold text-lg">
                      Grand Total: ₹{billCalculations.grandTotal.toFixed(2)}
                    </p>
                  </div>
                </div>

                <div>
                  <Label htmlFor="comments">Comments</Label>
                  <Textarea
                    id="comments"
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    placeholder="Add any comments for the bill..."
                  />
                </div>

                <Button
                  onClick={submitBill}
                  disabled={loading}
                  className="w-full sm:w-auto"
                >
                  Create Bill & Download PDF
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="all-bills">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>All Bills</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      try {
                        exportToCSV({
                          filename: 'all-bills',
                          headers: ['Invoice Number', 'Customer', 'Date', 'Amount', 'Status', 'GST Bill', 'Created At'],
                          data: filteredBills,
                          transformData: (bill) => ({
                            'Invoice Number': bill.invoice_number || bill.id,
                            'Customer': bill.customers?.name || 'N/A',
                            'Date': formatDate(bill.date_of_bill),
                            'Amount': formatCurrency(bill.total_amount),
                            'Status': bill.status,
                            'GST Bill': bill.is_gst_bill ? 'Yes' : 'No',
                            'Created At': formatDate(bill.created_at)
                          })
                        });
                        toast({ title: "Success", description: "Bills exported to CSV successfully" });
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
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-2">
                  <Popover
                    open={customerFilterSearchOpen}
                    onOpenChange={setCustomerFilterSearchOpen}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={customerFilterSearchOpen}
                        className="w-full justify-between"
                      >
                        <span className="truncate">
                          {customerFilter !== "all"
                            ? customers.find(
                                (customer) => customer.id === customerFilter
                              )?.name
                            : "Filter by customer"}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[200px] p-0">
                      <Command>
                        <CommandInput
                          placeholder="Search customers..."
                          className="h-9"
                        />
                        <CommandList className="max-h-[200px]">
                          <CommandEmpty>No customer found.</CommandEmpty>
                          <CommandGroup>
                            <CommandItem
                              value="all"
                              onSelect={() => {
                                setCustomerFilter("all");
                                setCustomerFilterSearchOpen(false);
                              }}
                              className="cursor-pointer"
                            >
                              <Check
                                className={`mr-2 h-4 w-4 ${
                                  customerFilter === "all"
                                    ? "opacity-100"
                                    : "opacity-0"
                                }`}
                              />
                              <span>All Customers</span>
                            </CommandItem>
                            {customers.map((customer) => (
                              <CommandItem
                                key={customer.id}
                                value={customer.name}
                                onSelect={() => {
                                  setCustomerFilter(customer.id);
                                  setCustomerFilterSearchOpen(false);
                                }}
                                className="cursor-pointer"
                              >
                                <Check
                                  className={`mr-2 h-4 w-4 ${
                                    customerFilter === customer.id
                                      ? "opacity-100"
                                      : "opacity-0"
                                  }`}
                                />
                                <span className="truncate">
                                  {customer.name}
                                </span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="outstanding">Outstanding</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="partial">Partial</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={gstFilter} onValueChange={setGstFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by GST" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Bills</SelectItem>
                      <SelectItem value="gst">GST</SelectItem>
                      <SelectItem value="non-gst">Non-GST</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Mobile View for All Bills */}
                <div className="space-y-4 md:hidden">
                  {filteredBills.map((bill) => (
                    <Card key={bill.id}>
                      <CardHeader>
                        <CardTitle className="text-base font-medium">
                          {bill.invoice_number || `#${bill.id.slice(0, 6)}...`}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {bill.customers?.name || "N/A"}
                        </p>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span>Date:</span>
                          <span>
                            {new Date(bill.date_of_bill).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Amount:</span>
                          <span className="font-bold">
                            ₹{bill.total_amount.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>GST Bill:</span>
                          <span>{bill.is_gst_bill ? "Yes" : "No"}</span>
                        </div>
                        <div className="flex items-center justify-between pt-2">
                          <Badge
                            variant={
                              bill.status === "paid"
                                ? "default"
                                : bill.status === "outstanding"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {bill.status}
                          </Badge>
                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownloadPdf(bill.id)}
                            >
                              <Download className="mr-2 h-4 w-4" />
                              PDF
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownloadReceipt(bill.id)}
                              className="bg-green-50 hover:bg-green-100"
                            >
                              <Download className="mr-2 h-4 w-4" />
                              Receipt
                            </Button>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => setBillToDelete(bill.id)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </Button>
                            </AlertDialogTrigger>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Desktop View for All Bills */}
                <div className="overflow-x-auto hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice No</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>GST Bill</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredBills.map((bill) => (
                        <TableRow key={bill.id}>
                          <TableCell>{bill.invoice_number || `#${bill.id.slice(0, 6)}...`}</TableCell>
                          <TableCell>{bill.customers?.name || "N/A"}</TableCell>
                          <TableCell>
                            {new Date(bill.date_of_bill).toLocaleDateString()}
                          </TableCell>
                          <TableCell>₹{bill.total_amount.toFixed(2)}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                bill.status === "paid"
                                  ? "default"
                                  : bill.status === "outstanding"
                                  ? "destructive"
                                  : "secondary"
                              }
                            >
                              {bill.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {bill.is_gst_bill ? "Yes" : "No"}
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDownloadPdf(bill.id)}
                              >
                                <Download className="mr-2 h-4 w-4" />
                                PDF
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDownloadReceipt(bill.id)}
                                className="bg-green-50 hover:bg-green-100"
                              >
                                <Download className="mr-2 h-4 w-4" />
                                Receipt
                              </Button>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => setBillToDelete(bill.id)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </Button>
                              </AlertDialogTrigger>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              bill, revert the stock levels, and update the customer's balance.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setBillToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteBill} disabled={loading}>
              {loading ? "Deleting..." : "Continue"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </div>
    </AlertDialog>
  );
};
