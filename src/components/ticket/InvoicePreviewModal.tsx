import { X, Download, Send, Loader2 } from 'lucide-react';
import { Order, Customer } from '@/src/types';
import { format } from 'date-fns';
import { cn } from '@/src/lib/utils';
import { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface InvoicePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: string;
  order: Order;
  customer?: Customer;
}

export default function InvoicePreviewModal({ isOpen, onClose, template, order, customer }: InvoicePreviewModalProps) {
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen) return null;

  const handleDownloadPDF = async () => {
    if (!invoiceRef.current) return;
    
    try {
      setIsGenerating(true);
      const canvas = await html2canvas(invoiceRef.current, {
        scale: 2, // Higher resolution
        useCORS: true,
        logging: false,
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Invoice_${order.platformOrderId}.pdf`);
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      alert('生成 PDF 失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendToCustomer = async () => {
    // Simulate sending
    setIsGenerating(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsGenerating(false);
    alert('发票已成功发送给客户');
    onClose();
  };

  const renderTemplate = () => {
    if (template === 'simple') {
      return (
        <div ref={invoiceRef} className="max-w-md mx-auto bg-[#F9F9F7] p-12 shadow-sm rounded-xl font-mono text-sm text-slate-800 relative overflow-hidden">
          {/* Decorative top edge */}
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-slate-800 to-slate-600"></div>
          
          <div className="text-center mb-10">
            <div className="w-14 h-14 bg-slate-900 text-white rounded-full flex items-center justify-center mx-auto mb-6 text-2xl font-bold font-sans tracking-tighter">N</div>
            <h2 className="text-3xl font-bold tracking-[0.2em] uppercase text-slate-900 mb-2">Receipt</h2>
            <p className="text-slate-500 text-xs tracking-widest uppercase">{format(new Date(), 'MMM dd, yyyy HH:mm')}</p>
          </div>
          
          <div className="border-y border-dashed border-slate-300 py-6 mb-6 space-y-3">
            <div className="flex justify-between items-baseline">
              <span className="text-slate-500 text-xs uppercase tracking-wider">Order No.</span>
              <span className="font-bold text-slate-900 tracking-tight">{order.platformOrderId}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-slate-500 text-xs uppercase tracking-wider">Customer</span>
              <span className="font-bold text-slate-900 tracking-tight">{customer?.name || 'Guest'}</span>
            </div>
          </div>

          <div className="space-y-4 mb-8">
            {order.productTitles.map((title, i) => (
              <div key={i} className="flex justify-between gap-6 leading-relaxed">
                <span className="text-slate-700">{title}</span>
                <span className="shrink-0 font-medium">1 × {order.amount}{order.currency}</span>
              </div>
            ))}
          </div>

          <div className="bg-slate-900 text-white p-6 rounded-lg flex justify-between items-center">
            <span className="text-xs uppercase tracking-widest font-bold opacity-80">Total</span>
            <span className="text-2xl font-bold tracking-tight">{order.amount} {order.currency}</span>
          </div>
          
          <div className="mt-12 text-center text-xs text-slate-400 uppercase tracking-widest space-y-1">
            <p>Thank you for your purchase</p>
            <p className="font-bold text-slate-500">Nezha Shop Ltd.</p>
          </div>
        </div>
      );
    }

    if (template === 'standard') {
      return (
        <div ref={invoiceRef} className="max-w-3xl mx-auto bg-white p-16 shadow-sm rounded-xl font-sans text-slate-700 relative">
          <div className="absolute top-0 right-16 w-32 h-32 bg-slate-50 rounded-full -translate-y-1/2 opacity-50 blur-2xl"></div>
          
          <div className="flex justify-between items-start mb-16 relative z-10">
            <div>
              <div className="w-12 h-12 bg-slate-900 text-white rounded-xl flex items-center justify-center mb-6 text-2xl font-bold tracking-tighter shadow-sm">N</div>
              <h1 className="text-5xl font-bold text-slate-900 tracking-tighter mb-2">INVOICE</h1>
              <p className="text-slate-500 font-mono text-sm tracking-wider">#INV-{order.id.replace('ORD-', '')}</p>
            </div>
            <div className="text-right">
              <h3 className="font-bold text-slate-900 text-xl tracking-tight mb-2">Nezha Shop Ltd.</h3>
              <p className="text-slate-500 text-sm leading-relaxed">123 Commerce Street<br/>London, UK EC1A 1BB</p>
              <p className="text-slate-400 text-sm mt-3 font-mono">VAT: GB123456789</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-12 mb-16">
            <div className="p-6 bg-slate-50/50 rounded-2xl border border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Billed To</p>
              <p className="font-bold text-slate-900 text-lg tracking-tight mb-1">{customer?.name || 'Unknown Customer'}</p>
              <p className="text-slate-500 text-sm">{customer?.shippingCountry || 'Unknown Country'}</p>
              <p className="text-slate-500 text-sm mt-2">{customer?.email}</p>
            </div>
            <div className="p-6 bg-slate-50/50 rounded-2xl border border-slate-100 flex flex-col justify-center">
              <div className="space-y-3">
                <div className="flex justify-between items-baseline border-b border-slate-200/60 pb-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date</span>
                  <span className="font-medium text-slate-900 font-mono text-sm">{format(new Date(), 'MMM dd, yyyy')}</span>
                </div>
                <div className="flex justify-between items-baseline border-b border-slate-200/60 pb-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Order ID</span>
                  <span className="font-medium text-slate-900 font-mono text-sm">{order.platformOrderId}</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</span>
                  <span className="font-bold text-emerald-600 text-sm uppercase tracking-wider bg-emerald-50 px-2 py-0.5 rounded-md">{order.paymentStatus}</span>
                </div>
              </div>
            </div>
          </div>

          <table className="w-full mb-12">
            <thead>
              <tr>
                <th className="text-left py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b-2 border-slate-900">Description</th>
                <th className="text-center py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b-2 border-slate-900 w-24">Qty</th>
                <th className="text-right py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b-2 border-slate-900 w-32">Price</th>
                <th className="text-right py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b-2 border-slate-900 w-32">Amount</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {order.productTitles.map((title, i) => (
                <tr key={i} className="group">
                  <td className="py-5 text-slate-900 font-medium border-b border-slate-100 group-last:border-0">{title}</td>
                  <td className="py-5 text-center text-slate-500 border-b border-slate-100 group-last:border-0 font-mono">1</td>
                  <td className="py-5 text-right text-slate-500 border-b border-slate-100 group-last:border-0 font-mono">{order.amount} {order.currency}</td>
                  <td className="py-5 text-right text-slate-900 font-bold border-b border-slate-100 group-last:border-0 font-mono">{order.amount} {order.currency}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end">
            <div className="w-80 bg-slate-50 rounded-2xl p-6 border border-slate-100">
              <div className="space-y-4 text-sm">
                <div className="flex justify-between text-slate-500 items-baseline">
                  <span>Subtotal</span>
                  <span className="font-mono">{(order.amount * 0.8).toFixed(2)} {order.currency}</span>
                </div>
                <div className="flex justify-between text-slate-500 items-baseline">
                  <span>Tax (20%)</span>
                  <span className="font-mono">{(order.amount * 0.2).toFixed(2)} {order.currency}</span>
                </div>
                <div className="flex justify-between items-baseline pt-4 border-t border-slate-200 mt-4">
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-widest">Total Due</span>
                  <span className="text-2xl font-bold text-slate-900 tracking-tight font-mono">{order.amount} {order.currency}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (template === 'detailed') {
      const ht = (order.amount / 1.2).toFixed(2);
      const tva = (order.amount - parseFloat(ht)).toFixed(2);
      
      return (
        <div ref={invoiceRef} className="max-w-4xl mx-auto bg-white p-16 shadow-sm font-sans text-[13px] text-slate-800 border border-slate-200 relative">
          {/* Minimalist header accent */}
          <div className="absolute top-0 left-16 w-24 h-1 bg-[#2b78b5]"></div>
          
          <div className="flex justify-between items-end mb-16">
            <h1 className="text-4xl font-light text-[#2b78b5] tracking-tight">Facture<br/><span className="font-bold">Commerciale</span></h1>
            <div className="text-right space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Numéro de facture</p>
              <p className="text-xl font-mono font-bold text-slate-900">{order.platformOrderId.replace(/-/g, '')}M-A</p>
              <p className="text-slate-500 font-mono text-xs mt-2">{format(new Date(), 'yyyy-MM-dd HH:mm:ss')}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-16 mb-16">
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-[#2b78b5] uppercase tracking-widest mb-4">Émetteur (Vendeur)</p>
              <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 space-y-2">
                <p className="flex justify-between"><span className="text-slate-500">Société:</span> <span className="font-medium text-slate-900">Ruyangfang</span></p>
                <p className="flex justify-between"><span className="text-slate-500">Nom légal:</span> <span className="font-medium text-slate-900">SEENER sp.zoo.</span></p>
                <div className="flex justify-between items-start pt-2 mt-2 border-t border-slate-200/60">
                  <span className="text-slate-500 shrink-0 mr-4">Adresse:</span> 
                  <span className="text-right text-slate-900 leading-relaxed">ul. BARTYCKA, nr 22B, lok. 21A<br/>00-716 WARSZAWA<br/>POLSKA</span>
                </div>
                <p className="flex justify-between pt-2 mt-2 border-t border-slate-200/60"><span className="text-slate-500">Code NIF:</span> <span className="font-mono font-medium text-slate-900">0000990053</span></p>
              </div>
            </div>
            
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-[#2b78b5] uppercase tracking-widest mb-4">Destinataire (Acheteur)</p>
              <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 space-y-2 h-full">
                <p className="flex justify-between"><span className="text-slate-500">Facturé à:</span> <span className="font-bold text-slate-900">{customer?.name?.toUpperCase() || 'UNKNOWN'}</span></p>
                <div className="flex justify-between items-start pt-2 mt-2 border-t border-slate-200/60">
                  <span className="text-slate-500 shrink-0 mr-4">Adresse:</span> 
                  <span className="text-right text-slate-900 leading-relaxed">67 GRD RUE OPTIQUE<br/>67430 DIEMERINGEN<br/>FR</span>
                </div>
              </div>
            </div>
          </div>
          
          <table className="w-full mb-12">
            <thead>
              <tr>
                <th className="border-b-2 border-slate-900 py-3 px-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest w-1/2">Désignation</th>
                <th className="border-b-2 border-slate-900 py-3 px-4 text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">Qté</th>
                <th className="border-b-2 border-slate-900 py-3 px-4 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest">Prix unitaire HT<br/><span className="text-[8px] font-normal tracking-normal text-slate-400">(incluant TVA)</span></th>
                <th className="border-b-2 border-slate-900 py-3 px-4 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest">Prix total HT<br/><span className="text-[8px] font-normal tracking-normal text-slate-400">(incluant TVA)</span></th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {order.productTitles.map((title, i) => (
                <tr key={i} className="group">
                  <td className="border-b border-slate-100 py-4 px-4 text-left text-slate-900 font-medium group-last:border-0">{title}</td>
                  <td className="border-b border-slate-100 py-4 px-4 text-center text-slate-500 font-mono group-last:border-0">1</td>
                  <td className="border-b border-slate-100 py-4 px-4 text-right text-slate-500 font-mono group-last:border-0">{order.amount} {order.currency}</td>
                  <td className="border-b border-slate-100 py-4 px-4 text-right text-slate-900 font-bold font-mono group-last:border-0">{order.amount} {order.currency}</td>
                </tr>
              ))}
              <tr>
                <td className="border-b border-slate-200 py-4 px-4 text-left text-slate-600">Frais de traitement</td>
                <td className="border-b border-slate-200 py-4 px-4 text-center text-slate-500 font-mono">1</td>
                <td className="border-b border-slate-200 py-4 px-4 text-right text-slate-500 font-mono">0.00 {order.currency}</td>
                <td className="border-b border-slate-200 py-4 px-4 text-right text-slate-900 font-bold font-mono">0.00 {order.currency}</td>
              </tr>
            </tbody>
          </table>

          <div className="flex justify-end">
            <div className="w-96">
              <div className="space-y-3">
                <div className="flex justify-between items-baseline px-4 text-slate-600">
                  <span className="text-xs uppercase tracking-wider">Total Hors Taxe</span>
                  <span className="font-mono font-medium">{ht} {order.currency}</span>
                </div>
                <div className="flex justify-between items-baseline px-4 text-slate-600">
                  <span className="text-xs uppercase tracking-wider">TVA (20%)</span>
                  <span className="font-mono font-medium">{tva} {order.currency}</span>
                </div>
                <div className="flex justify-between items-baseline p-4 bg-[#2b78b5] text-white rounded-xl mt-4">
                  <span className="text-xs font-bold uppercase tracking-widest">Total en euros</span>
                  <span className="text-2xl font-bold font-mono tracking-tight">{order.amount} {order.currency}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-100 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 shrink-0">
          <h2 className="text-lg font-bold text-slate-900">
            发票预览 - {template === 'simple' ? '简易模版' : template === 'standard' ? '标准模版' : '详细模版'}
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-8">
          {renderTemplate()}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-white border-t border-slate-200 shrink-0">
          <button 
            onClick={onClose} 
            disabled={isGenerating}
            className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
          >
            取消
          </button>
          <button 
            onClick={handleDownloadPDF}
            disabled={isGenerating}
            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {isGenerating ? '生成中...' : '下载 PDF'}
          </button>
          <button 
            onClick={handleSendToCustomer}
            disabled={isGenerating}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#F97316] text-white rounded-xl text-sm font-medium hover:bg-[#ea580c] transition-colors shadow-sm disabled:opacity-50"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {isGenerating ? '发送中...' : '发送给客户'}
          </button>
        </div>
      </div>
    </div>
  );
}
