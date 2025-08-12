import { BillItem } from '@/pages/Billing';
import { Customer } from '@/pages/Customers';
import React from 'react';

interface Bill {
  id: string;
  invoice_number: string;
  created_at: string;
  date_of_bill: string;
  total_amount: number;
  status: 'outstanding' | 'paid' | 'partial';
  is_gst_bill: boolean;
  customers: { name: string } | null;
  cgst_percentage?: number;
  sgst_percentage?: number;
  cess_percentage?: number;
  gst_amount?: number;
  discount?: number;
  comments?: string;
}

interface SellerInfo {
  id: string;
  company_name: string;
  email: string;
  contact_number: string;
  address?: string;
  gst_number?: string;
  bank_account_number?: string;
  account_holder_name?: string;
  account_no?: string;
  branch?: string;
  ifsc_code?: string;
}

interface InvoiceTemplateProps {
  billCalculations: {
    sgst: number;
    cgst: number;
    cess: number;
    taxableValue: number;
    subtotal: number;
    grandTotal: number;
  }
  billDetails: Bill;
  items: BillItem[];
  customerDetails: Customer;
  sellerInfo?: SellerInfo;
}

const InvoiceTemplate: React.FC<InvoiceTemplateProps> = ({ billCalculations, billDetails, items, customerDetails, sellerInfo }) => {
  // Use the calculations from Billing.tsx for consistency
  const cgstRate = billDetails.cgst_percentage || 9;
  const sgstRate = billDetails.sgst_percentage || 9;
  const cessRate = billDetails.cess_percentage || 0;
  const discount = billDetails.discount || 0;
  
  // Fallback calculation if billCalculations values are 0 or undefined
  const subtotal = billCalculations.subtotal || items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
  const grandTotal = billDetails.total_amount || subtotal;
  
  // Calculate tax amounts - use billCalculations if available and non-zero, otherwise calculate
  let taxableValue = billCalculations.taxableValue;
  let cgstAmount = billCalculations.cgst;
  let sgstAmount = billCalculations.sgst;
  let cessAmount = billCalculations.cess;
  
  // If the tax amounts from billCalculations are 0 or undefined, calculate them manually
  if (billDetails.is_gst_bill && (cgstAmount === 0 || sgstAmount === 0 || !cgstAmount || !sgstAmount)) {
    const totalGstRate = (cgstRate + sgstRate + cessRate) / 100;
    taxableValue = subtotal / (1 + totalGstRate);
    cgstAmount = taxableValue * (cgstRate / 100);
    sgstAmount = taxableValue * (sgstRate / 100);
    cessAmount = taxableValue * (cessRate / 100);
  }

  const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse' as const,
    border: '1px solid #000',
    fontSize: '11px'
  };

  const cellStyle = {
    border: '1px solid #000',
    padding: '4px 6px',
    verticalAlign: 'top' as const
  };

  const headerCellStyle = {
    ...cellStyle,
    backgroundColor: '#f5f5f5',
    fontWeight: 'bold' as const,
    textAlign: 'center' as const
  };

  return (
    <div style={{
      fontFamily: 'Arial, sans-serif',
      fontSize: '12px',
      color: '#000',
      width: '210mm', // Fixed A4 width - won't change based on viewport
      minWidth: '210mm', // Ensure minimum width
      maxWidth: '210mm', // Ensure maximum width
      minHeight: '297mm', // A4 height
      padding: '20px',
      boxSizing: 'border-box',
      backgroundColor: 'white',
      margin: '0 auto', // Center the content
      overflow: 'hidden' // Prevent content from overflowing
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '10px' }}>
        <h1 style={{ margin: '0', fontSize: '16px', fontWeight: 'bold' }}>Tax Invoice</h1>
        <div style={{ fontSize: '12px', fontStyle: 'italic', marginTop: '2px' }}>(ORIGINAL FOR RECIPIENT)</div>
      </div>

      {/* Company and Invoice Details */}
      <table style={tableStyle}>
        <tbody>
          <tr>
            <td style={{ ...cellStyle, width: '60%', verticalAlign: 'top' }}>
              <div style={{ fontWeight: 'bold', fontSize: '12px', marginBottom: '5px' }}>
                {sellerInfo?.company_name || 'YOUR COMPANY NAME'}
              </div>
              {sellerInfo?.address && (
                <div>{sellerInfo.address}</div>
              )}
              {sellerInfo?.gst_number && (
                <div>GSTIN/UIN: {sellerInfo.gst_number}</div>
              )}
              <div>E-Mail: {sellerInfo?.email || 'contact@yourcompany.com'}</div>
              {sellerInfo?.contact_number && (
                <div>Contact: {sellerInfo.contact_number}</div>
              )}
            </td>
            <td style={{ ...cellStyle, width: '40%' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    <td style={{ padding: '2px', fontWeight: 'bold' }}>Invoice No.</td>
                    <td style={{ padding: '2px' }}>{billDetails.invoice_number}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '2px', fontWeight: 'bold' }}>Dated</td>
                    <td style={{ padding: '2px' }}>{new Date(billDetails.date_of_bill || billDetails.created_at).toLocaleDateString('en-GB')}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '2px', fontWeight: 'bold' }}>Delivery Note</td>
                    <td style={{ padding: '2px' }}>Mode/Terms of Payment</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '2px', fontWeight: 'bold' }}>Reference No. & Date</td>
                    <td style={{ padding: '2px' }}>{billDetails.invoice_number} dt. {new Date(billDetails.date_of_bill || billDetails.created_at).toLocaleDateString('en-GB')}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '2px', fontWeight: 'bold' }}>Buyer's Order No.</td>
                    <td style={{ padding: '2px' }}>-</td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Consignee Details */}
      <table style={{ ...tableStyle, marginTop: '2px' }}>
        <tbody>
          <tr>
            <td style={{ ...cellStyle, width: '50%' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '3px' }}>Consignee (Ship to)</div>
              <div style={{ fontWeight: 'bold' }}>{customerDetails.name}</div>
              <div>{customerDetails.address}</div>
              <div>GSTIN/UIN: {customerDetails.gst_number || 'N/A'}</div>
              <div>State Name: TamilNadu</div>
            </td>
            <td style={{ ...cellStyle, width: '50%' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '3px' }}>Buyer (Bill to)</div>
              <div style={{ fontWeight: 'bold' }}>{customerDetails.name}</div>
              <div>{customerDetails.address}</div>
              <div>GSTIN/UIN: {customerDetails.gst_number || 'N/A'}</div>
              <div>State Name: TamilNadu</div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Items Table */}
      <table style={{ ...tableStyle, marginTop: '2px' }}>
        <thead>
          <tr>
            <th style={{ ...headerCellStyle, width: '8%' }}>Sl No</th>
            <th style={{ ...headerCellStyle, width: '50%' }}>Description of Goods</th>
            <th style={{ ...headerCellStyle, width: '12%' }}>Quantity</th>
            <th style={{ ...headerCellStyle, width: '10%' }}>Rate</th>
            <th style={{ ...headerCellStyle, width: '8%' }}>per</th>
            <th style={{ ...headerCellStyle, width: '12%' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            // Calculate the base price and amount like in Billing.tsx
            const finalPrice = item.quantity * item.price;
            const totalGstRate = billDetails.is_gst_bill ? (cgstRate + sgstRate + cessRate) / 100 : 0;
            const basePrice = billDetails.is_gst_bill ? finalPrice / (1 + totalGstRate) : finalPrice;
            const unitBasePrice = billDetails.is_gst_bill ? item.price / (1 + totalGstRate) : item.price;
            
            return (
              <tr key={item.product_id}>
                <td style={{ ...cellStyle, textAlign: 'center' }}>{index + 1}</td>
                <td style={cellStyle}>{item.product_name}</td>
                <td style={{ ...cellStyle, textAlign: 'center' }}>
                  {item.quantity} Nos.
                </td>
                <td style={{ ...cellStyle, textAlign: 'right' }}>{unitBasePrice.toFixed(2)}</td>
                <td style={{ ...cellStyle, textAlign: 'center' }}>Nos.</td>
                <td style={{ ...cellStyle, textAlign: 'right' }}>{basePrice.toFixed(2)}</td>
              </tr>
            );
          })}
          
          {/* Tax rows - only show if it's a GST bill */}
          {billDetails.is_gst_bill && (
            <>
              <tr>
                <td style={cellStyle}></td>
                <td style={cellStyle}>OUTPUT CGST @ {cgstRate}%</td>
                <td style={cellStyle}></td>
                <td style={{ ...cellStyle, textAlign: 'right' }}>{cgstRate}%</td>
                <td style={cellStyle}></td>
                <td style={{ ...cellStyle, textAlign: 'right' }}>{cgstAmount.toFixed(2)}</td>
              </tr>
              <tr>
                <td style={cellStyle}></td>
                <td style={cellStyle}>OUTPUT SGST @ {sgstRate}%</td>
                <td style={cellStyle}></td>
                <td style={{ ...cellStyle, textAlign: 'right' }}>{sgstRate}%</td>
                <td style={cellStyle}></td>
                <td style={{ ...cellStyle, textAlign: 'right' }}>{sgstAmount.toFixed(2)}</td>
              </tr>
              {cessRate > 0 && (
                <tr>
                  <td style={cellStyle}></td>
                  <td style={cellStyle}>CESS @ {cessRate}%</td>
                  <td style={cellStyle}></td>
                  <td style={{ ...cellStyle, textAlign: 'right' }}>{cessRate}%</td>
                  <td style={cellStyle}></td>
                  <td style={{ ...cellStyle, textAlign: 'right' }}>{cessAmount.toFixed(2)}</td>
                </tr>
              )}
            </>
          )}

          {discount > 0 && (
            <tr>
              <td style={cellStyle} colSpan={5} align='right'>Discount</td>
              <td style={{ ...cellStyle, textAlign: 'right' }}>-{discount.toFixed(2)}</td>
            </tr>
          )}

          {/* Total row */}
          <tr>
            <td style={{...cellStyle, fontWeight: 'bold'}} colSpan={2}>Total</td>
            <td style={{ ...cellStyle, textAlign: 'center', fontWeight: 'bold' }}>
              {items.reduce((sum, item) => sum + item.quantity, 0)} Nos.
            </td>
            <td style={cellStyle}></td>
            <td style={cellStyle}></td>
            <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 'bold' }}>₹ {grandTotal.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      {/* Amount in words */}
      <table style={{ ...tableStyle, marginTop: '2px' }}>
        <tbody>
          <tr>
            <td style={{ ...cellStyle, fontWeight: 'bold' }}>Amount Chargeable (in words)</td>
          </tr>
          <tr>
            <td style={{ ...cellStyle, height: '30px' }}>
              INR {numberToWords(Math.round(grandTotal))} Only
            </td>
          </tr>
        </tbody>
      </table>

      {/* Tax Summary Table - only show if it's a GST bill */}
      {billDetails.is_gst_bill && (
        <table style={{ ...tableStyle, marginTop: '2px' }}>
          <thead>
            <tr>
              <th style={headerCellStyle} rowSpan={2}>Taxable Value</th>
              <th style={headerCellStyle} colSpan={2}>CGST</th>
              <th style={headerCellStyle} colSpan={2}>SGST/UTGST</th>
              {cessRate > 0 && <th style={headerCellStyle} colSpan={2}>Cess</th>}
              <th style={headerCellStyle} rowSpan={2}>Total Tax Amount</th>
            </tr>
            <tr>
              <th style={headerCellStyle}>Rate</th>
              <th style={headerCellStyle}>Amount</th>
              <th style={headerCellStyle}>Rate</th>
              <th style={headerCellStyle}>Amount</th>
              {cessRate > 0 && (
                <>
                  <th style={headerCellStyle}>Rate</th>
                  <th style={headerCellStyle}>Amount</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ ...cellStyle, textAlign: 'right' }}>{taxableValue.toFixed(2)}</td>
              <td style={{ ...cellStyle, textAlign: 'center' }}>{cgstRate}%</td>
              <td style={{ ...cellStyle, textAlign: 'right' }}>{cgstAmount.toFixed(2)}</td>
              <td style={{ ...cellStyle, textAlign: 'center' }}>{sgstRate}%</td>
              <td style={{ ...cellStyle, textAlign: 'right' }}>{sgstAmount.toFixed(2)}</td>
              {cessRate > 0 && (
                <>
                  <td style={{ ...cellStyle, textAlign: 'center' }}>{cessRate}%</td>
                  <td style={{ ...cellStyle, textAlign: 'right' }}>{cessAmount.toFixed(2)}</td>
                </>
              )}
              <td style={{ ...cellStyle, textAlign: 'right' }}>{(cgstAmount + sgstAmount + cessAmount).toFixed(2)}</td>
            </tr>
            <tr>
              <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 'bold' }}>Total: {taxableValue.toFixed(2)}</td>
              <td style={cellStyle}></td>
              <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 'bold' }}>{cgstAmount.toFixed(2)}</td>
              <td style={cellStyle}></td>
              <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 'bold' }}>{sgstAmount.toFixed(2)}</td>
              {cessRate > 0 && (
                <>
                  <td style={cellStyle}></td>
                  <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 'bold' }}>{cessAmount.toFixed(2)}</td>
                </>
              )}
              <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 'bold' }}>{(cgstAmount + sgstAmount + cessAmount).toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      )}

      {/* Tax Amount in words - only show if it's a GST bill */}
      {billDetails.is_gst_bill && (
        <table style={{ ...tableStyle, marginTop: '2px' }}>
          <tbody>
            <tr>
              <td style={{ ...cellStyle, fontWeight: 'bold' }}>
                Tax Amount (in words): INR {numberToWords(Math.round(cgstAmount + sgstAmount + cessAmount))} Only
              </td>
            </tr>
          </tbody>
        </table>
      )}

      {/* Bank Details and Declaration */}
      <table style={{ ...tableStyle, marginTop: '2px' }}>
        <tbody>
          <tr>
            <td style={{ ...cellStyle, width: '50%' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Company's Bank Details</div>
              <div><strong>A/c Holder's Name:</strong> {sellerInfo?.account_holder_name || sellerInfo?.company_name || 'YOUR COMPANY NAME'}</div>
              <div><strong>Bank Name:</strong> {sellerInfo?.branch || 'YOUR BANK NAME'}</div>
              <div><strong>A/c No.:</strong> {sellerInfo?.bank_account_number || 'None'}</div>
              <div><strong>Branch & IFS Code:</strong> {sellerInfo?.ifsc_code || 'BANK0001234'}</div>
            </td>
            <td style={{ ...cellStyle, width: '50%' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Declaration</div>
              <div style={{ fontSize: '10px', lineHeight: '1.3' }}>
                We declare that this invoice shows the actual price of the
                goods described and that all particulars are true and correct.
              </div>
              <div style={{ textAlign: 'right', marginTop: '40px', fontWeight: 'bold' }}>
                Authorised Signatory
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Footer */}
      <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '10px' }}>
        This is a Computer Generated Invoice
      </div>

      {billDetails.comments && (
        <div style={{ marginTop: '10px', fontSize: '10px' }}>
          <strong>Comments:</strong> {billDetails.comments}
        </div>
      )}
    </div>
  );
};

// Helper function to convert numbers to words (simplified version)
const numberToWords = (num: number): string => {
  if (num === 0) return 'Zero';
  
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const thousands = ['', 'Thousand', 'Lakh', 'Crore'];

  const convertHundreds = (n: number): string => {
    let result = '';
    if (n >= 100) {
      result += ones[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n >= 20) {
      result += tens[Math.floor(n / 10)] + ' ';
      n %= 10;
    } else if (n >= 10) {
      result += teens[n - 10] + ' ';
      return result;
    }
    if (n > 0) {
      result += ones[n] + ' ';
    }
    return result;
  };

  if (num < 1000) {
    return convertHundreds(num).trim();
  }

  let result = '';
  let thousandIndex = 0;
  
  while (num > 0) {
    if (num % 1000 !== 0) {
      result = convertHundreds(num % 1000) + thousands[thousandIndex] + ' ' + result;
    }
    num = Math.floor(num / 1000);
    thousandIndex++;
  }
  
  return result.trim();
};

export default InvoiceTemplate;