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

interface ReceiptTemplateProps {
  billDetails: Bill;
  items: BillItem[];
  customerDetails: Customer;
  sellerInfo?: SellerInfo;
}

const ReceiptTemplate: React.FC<ReceiptTemplateProps> = ({ billDetails, items, customerDetails, sellerInfo }) => {
  const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
  const discount = billDetails.discount || 0;
  const total = billDetails.total_amount;

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
      width: '210mm',
      minWidth: '210mm',
      maxWidth: '210mm',
      minHeight: '297mm',
      padding: '20px',
      boxSizing: 'border-box',
      backgroundColor: 'white',
      margin: '0 auto',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <h1 style={{ margin: '0', fontSize: '18px', fontWeight: 'bold' }}>RECEIPT</h1>
        <div style={{ fontSize: '12px' }}>Bill No: {billDetails.invoice_number}</div>
        <div style={{ fontSize: '12px' }}>Date: {new Date(billDetails.date_of_bill || billDetails.created_at).toLocaleDateString('en-GB')}</div>
      </div>

      {/* Company and Customer Details Side by Side */}
      <div style={{ marginBottom: '20px', borderBottom: '1px solid #000', paddingBottom: '10px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ width: '50%', padding: '0 10px 0 0', verticalAlign: 'top' }}>
                <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '8px' }}>
                  {sellerInfo?.company_name || 'YOUR COMPANY NAME'}
                </div>
                <div style={{ fontSize: '11px', lineHeight: '1.4' }}>
                  {sellerInfo?.address && (
                    <div>{sellerInfo.address}</div>
                  )}
                  <div>Contact: {sellerInfo?.email || 'contact@yourcompany.com'}</div>
                  {sellerInfo?.contact_number && (
                    <div>Phone: {sellerInfo.contact_number}</div>
                  )}
                </div>
              </td>
              <td style={{ width: '50%', padding: '0 0 0 10px', verticalAlign: 'top', borderLeft: '1px solid #ccc' }}>
                <div style={{ fontWeight: 'bold', fontSize: '12px', marginBottom: '8px' }}>BILL TO:</div>
                <div style={{ fontSize: '11px', lineHeight: '1.4' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>{customerDetails.name}</div>
                  <div>{customerDetails.address}</div>
                  {customerDetails.gst_number && <div>GSTIN: {customerDetails.gst_number}</div>}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Items Table */}
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={{ ...headerCellStyle, width: '8%' }}>S.No</th>
            <th style={{ ...headerCellStyle, width: '42%' }}>Description</th>
            <th style={{ ...headerCellStyle, width: '15%' }}>Quantity</th>
            <th style={{ ...headerCellStyle, width: '15%' }}>Rate</th>
            <th style={{ ...headerCellStyle, width: '20%' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={item.product_id}>
              <td style={{ ...cellStyle, textAlign: 'center' }}>{index + 1}</td>
              <td style={cellStyle}>{item.product_name}</td>
              <td style={{ ...cellStyle, textAlign: 'center' }}>{item.quantity}</td>
              <td style={{ ...cellStyle, textAlign: 'right' }}>₹{item.price.toFixed(2)}</td>
              <td style={{ ...cellStyle, textAlign: 'right' }}>₹{(item.quantity * item.price).toFixed(2)}</td>
            </tr>
          ))}
          
          {/* Subtotal */}
          <tr>
            <td style={cellStyle} colSpan={4} align="right"><strong>Subtotal:</strong></td>
            <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 'bold' }}>₹{subtotal.toFixed(2)}</td>
          </tr>

          {/* Discount if applicable */}
          {discount > 0 && (
            <tr>
              <td style={cellStyle} colSpan={4} align="right"><strong>Discount:</strong></td>
              <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 'bold' }}>-₹{discount.toFixed(2)}</td>
            </tr>
          )}

          {/* Tax if GST bill */}
          {billDetails.is_gst_bill && billDetails.gst_amount && (
            <tr>
              <td style={cellStyle} colSpan={4} align="right"><strong>Tax:</strong></td>
              <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 'bold' }}>₹{billDetails.gst_amount.toFixed(2)}</td>
            </tr>
          )}

          {/* Total */}
          <tr style={{ backgroundColor: '#f0f0f0' }}>
            <td style={{ ...cellStyle, fontWeight: 'bold' }} colSpan={4} align="right">
              <strong>TOTAL:</strong>
            </td>
            <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 'bold', fontSize: '14px' }}>
              ₹{total.toFixed(2)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Footer */}
      <div style={{ marginTop: '10px', textAlign: 'center', fontSize: '11px' }}>
        <div>This is a computer generated receipt</div>
      </div>

      {/* Comments if any */}
      {billDetails.comments && (
        <div style={{ marginTop: '20px', fontSize: '10px', borderTop: '1px solid #ccc', paddingTop: '10px' }}>
          <strong>Comments:</strong> {billDetails.comments}
        </div>
      )}
    </div>
  );
};

export default ReceiptTemplate;