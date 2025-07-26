import { BillItem } from '@/pages/Billing';
import { Customer } from '@/pages/Customers';
import React from 'react';

interface InvoiceTemplateProps {
  billDetails: any;
  items: BillItem[];
  customerDetails: Customer;
}

const InvoiceTemplate: React.FC<InvoiceTemplateProps> = ({ billDetails, items, customerDetails }) => {
  // Calculate tax amounts using database values
  const subtotal = billDetails.total_amount || items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
  const cgstRate = billDetails.cgst_percentage || 9; // Use DB value or default to 9%
  const sgstRate = billDetails.sgst_percentage || 9; // Use DB value or default to 9%
  const cessRate = billDetails.cess_percentage || 0; // Use DB value or default to 0%
  
  // If it's a GST bill, use the stored GST amount, otherwise calculate
  const totalTaxAmount = billDetails.is_gst_bill ? (billDetails.gst_amount || 0) : 0;
  const cgstAmount = billDetails.is_gst_bill ? (subtotal * cgstRate) / 100 : 0;
  const sgstAmount = billDetails.is_gst_bill ? (subtotal * sgstRate) / 100 : 0;
  const cessAmount = billDetails.is_gst_bill ? (subtotal * cessRate) / 100 : 0;
  
  const grandTotal = subtotal + totalTaxAmount - (billDetails.discount || 0);

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
      width: '100%',
      minHeight: '800px',
      padding: '20px',
      boxSizing: 'border-box',
      backgroundColor: 'white'
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
                YOUR COMPANY NAME
              </div>
              <div>123 Business Street, Business Area</div>
              <div>CITY - 123456</div>
              <div>GSTIN/UIN: 29ABCDE1234F1Z5</div>
              <div>State Name: Your State, Code: 29</div>
              <div>E-Mail: contact@yourcompany.com</div>
            </td>
            <td style={{ ...cellStyle, width: '40%' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tr>
                  <td style={{ padding: '2px', fontWeight: 'bold' }}>Invoice No.</td>
                  <td style={{ padding: '2px' }}>#{billDetails.id}</td>
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
                  <td style={{ padding: '2px' }}>{billDetails.id} dt. {new Date(billDetails.date_of_bill || billDetails.created_at).toLocaleDateString('en-GB')}</td>
                </tr>
                <tr>
                  <td style={{ padding: '2px', fontWeight: 'bold' }}>Buyer's Order No.</td>
                  <td style={{ padding: '2px', fontWeight: 'bold' }}>Dated</td>
                </tr>
                <tr>
                  <td style={{ padding: '2px' }}>-</td>
                  <td style={{ padding: '2px' }}>{new Date(billDetails.date_of_bill || billDetails.created_at).toLocaleDateString('en-GB')}</td>
                </tr>
                <tr>
                  <td style={{ padding: '2px', fontWeight: 'bold' }}>Dispatch Doc No.</td>
                  <td style={{ padding: '2px', fontWeight: 'bold' }}>Delivery Note Date</td>
                </tr>
                <tr>
                  <td style={{ padding: '2px', fontWeight: 'bold' }}>Dispatched through</td>
                  <td style={{ padding: '2px', fontWeight: 'bold' }}>Destination</td>
                </tr>
                <tr>
                  <td style={{ padding: '2px', fontWeight: 'bold' }}>Terms of Delivery</td>
                  <td style={{ padding: '2px' }}></td>
                </tr>
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
            <th style={{ ...headerCellStyle, width: '5%' }}>Sl No</th>
            <th style={{ ...headerCellStyle, width: '15%' }}>Marks & Nos/ Container No</th>
            <th style={{ ...headerCellStyle, width: '35%' }}>Description of Goods</th>
            <th style={{ ...headerCellStyle, width: '10%' }}>HSN/SAC</th>
            <th style={{ ...headerCellStyle, width: '10%' }}>Quantity</th>
            <th style={{ ...headerCellStyle, width: '8%' }}>Rate</th>
            <th style={{ ...headerCellStyle, width: '5%' }}>per</th>
            <th style={{ ...headerCellStyle, width: '12%' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={item.product_id}>
              <td style={{ ...cellStyle, textAlign: 'center' }}>{index + 1}</td>
              <td style={cellStyle}>-</td>
              <td style={cellStyle}>{item.product_name}</td>
              <td style={{ ...cellStyle, textAlign: 'center' }}>-</td>
              <td style={{ ...cellStyle, textAlign: 'center' }}>
                {item.quantity} Nos.
              </td>
              <td style={{ ...cellStyle, textAlign: 'right' }}>{item.price.toFixed(2)}</td>
              <td style={{ ...cellStyle, textAlign: 'center' }}>Nos.</td>
              <td style={{ ...cellStyle, textAlign: 'right' }}>{(item.quantity * item.price).toFixed(2)}</td>
            </tr>
          ))}
          
          {/* Tax rows - only show if it's a GST bill */}
          {billDetails.is_gst_bill && (
            <>
              <tr>
                <td style={cellStyle}></td>
                <td style={cellStyle}></td>
                <td style={cellStyle}>
                  <div>OUTPUT CGST @ {cgstRate}%</div>
                  <div>OUTPUT SGST @ {sgstRate}%</div>
                  {cessRate > 0 && <div>CESS @ {cessRate}%</div>}
                </td>
                <td style={cellStyle}></td>
                <td style={cellStyle}></td>
                <td style={{ ...cellStyle, textAlign: 'right' }}>{cgstRate}%</td>
                <td style={cellStyle}></td>
                <td style={{ ...cellStyle, textAlign: 'right' }}>{cgstAmount.toFixed(2)}</td>
              </tr>
              <tr>
                <td style={cellStyle}></td>
                <td style={cellStyle}></td>
                <td style={cellStyle}></td>
                <td style={cellStyle}></td>
                <td style={cellStyle}></td>
                <td style={{ ...cellStyle, textAlign: 'right' }}>{sgstRate}%</td>
                <td style={cellStyle}></td>
                <td style={{ ...cellStyle, textAlign: 'right' }}>{sgstAmount.toFixed(2)}</td>
              </tr>
              {cessRate > 0 && (
                <tr>
                  <td style={cellStyle}></td>
                  <td style={cellStyle}></td>
                  <td style={cellStyle}></td>
                  <td style={cellStyle}></td>
                  <td style={cellStyle}></td>
                  <td style={{ ...cellStyle, textAlign: 'right' }}>{cessRate}%</td>
                  <td style={cellStyle}></td>
                  <td style={{ ...cellStyle, textAlign: 'right' }}>{cessAmount.toFixed(2)}</td>
                </tr>
              )}
            </>
          )}

          {/* Total row */}
          <tr>
            <td style={cellStyle}></td>
            <td style={cellStyle}></td>
            <td style={{ ...cellStyle, fontWeight: 'bold' }}>Total</td>
            <td style={cellStyle}></td>
            <td style={{ ...cellStyle, textAlign: 'center', fontWeight: 'bold' }}>
              {items.reduce((sum, item) => sum + item.quantity, 0)} Nos.
            </td>
            <td style={cellStyle}></td>
            <td style={cellStyle}></td>
            <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 'bold' }}>₹ {(billDetails.total_amount || grandTotal).toFixed(2)}</td>
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
              INR {numberToWords(Math.round(billDetails.total_amount || grandTotal))} Only
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
              <td style={{ ...cellStyle, textAlign: 'right' }}>{subtotal.toFixed(2)}</td>
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
              <td style={{ ...cellStyle, textAlign: 'right' }}>{(billDetails.gst_amount || totalTaxAmount).toFixed(2)}</td>
            </tr>
            <tr>
              <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 'bold' }}>Total: {subtotal.toFixed(2)}</td>
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
              <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 'bold' }}>{(billDetails.gst_amount || totalTaxAmount).toFixed(2)}</td>
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
                Tax Amount (in words): INR {numberToWords(Math.round(billDetails.gst_amount || totalTaxAmount))} Only
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
              <div><strong>A/c Holder's Name:</strong> YOUR COMPANY NAME</div>
              <div><strong>Bank Name:</strong> YOUR BANK NAME</div>
              <div><strong>A/c No.:</strong> 1234567890123456</div>
              <div><strong>Branch & IFS Code:</strong> BANK0001234</div>
              <div><strong>SWIFT Code:</strong> BANK0001234</div>
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