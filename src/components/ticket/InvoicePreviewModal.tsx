import { X, Download, Send, Loader2 } from 'lucide-react';
import { Order, Customer } from '@/src/types';
import { format } from 'date-fns';
import { cn } from '@/src/lib/utils';
import { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/** 将整页长图按 A4 高度分页写入 PDF，避免单页超高导致 jsPDF 异常或内容丢失 */
function canvasToMultiPagePdf(canvas: HTMLCanvasElement): jsPDF {
  const imgData = canvas.toDataURL('image/png', 1.0);
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const imgWidth = 210; // A4 width in mm
  const pageHeight = 297; // A4 height in mm
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  let heightLeft = imgHeight;

  let position = 0;

  // 第一页
  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  // 剩余页
  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  return pdf;
}

function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

interface InvoicePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: string;
  order: Order;
  customer?: Customer;
  lang?: string;
  /** 将当前预览渲染为 PDF 并作为附件发送给会话（由父组件调用 onSendMessage 等） */
  onSendToCustomer?: (payload: { content: string; attachments: string[] }) => void | Promise<void>;
}

const TRANSLATIONS: Record<string, any> = {
  en: {
    receipt: 'Receipt',
    invoice: 'INVOICE',
    commercialInvoice: 'Commercial Invoice',
    date: 'Date',
    orderNo: 'Order No.',
    customer: 'Customer',
    total: 'Total',
    billedTo: 'Billed To',
    status: 'Status',
    description: 'Description',
    qty: 'Qty',
    price: 'Price',
    amount: 'Amount',
    subtotal: 'Subtotal',
    tax: 'Tax',
    totalDue: 'Total Due',
    issuer: 'Issuer (Seller)',
    recipient: 'Recipient (Buyer)',
    address: 'Address',
    vatCode: 'VAT Code',
    legalName: 'Legal Name',
    company: 'Company',
    invoiceNo: 'Invoice Number',
    processingFee: 'Processing Fee',
    thankYou: 'Thank you for your purchase',
  },
  de: {
    receipt: 'Quittung',
    invoice: 'RECHNUNG',
    commercialInvoice: 'Handelsrechnung',
    date: 'Datum',
    orderNo: 'Bestellnummer',
    customer: 'Kunde',
    total: 'Gesamt',
    billedTo: 'Rechnungsempfänger',
    status: 'Status',
    description: 'Beschreibung',
    qty: 'Menge',
    price: 'Preis',
    amount: 'Betrag',
    subtotal: 'Zwischensumme',
    tax: 'MwSt.',
    totalDue: 'Gesamtbetrag',
    issuer: 'Aussteller (Verkäufer)',
    recipient: 'Empfänger (Käufer)',
    address: 'Adresse',
    vatCode: 'USt-IdNr.',
    legalName: 'Vollständiger Name',
    company: 'Unternehmen',
    invoiceNo: 'Rechnungsnummer',
    processingFee: 'Bearbeitungsgebühr',
    thankYou: 'Vielen Dank für Ihren Einkauf',
  },
  fr: {
    receipt: 'Reçu',
    invoice: 'FACTURE',
    commercialInvoice: 'Facture Commerciale',
    date: 'Date',
    orderNo: 'N° de commande',
    customer: 'Client',
    total: 'Total',
    billedTo: 'Facturé à',
    status: 'Statut',
    description: 'Désignation',
    qty: 'Qté',
    price: 'Prix',
    amount: 'Montant',
    subtotal: 'Total HT',
    tax: 'TVA',
    totalDue: 'Total TTC',
    issuer: 'Émetteur (Vendeur)',
    recipient: 'Destinataire (Acheteur)',
    address: 'Adresse',
    vatCode: 'Code VAT',
    legalName: 'Nom légal',
    company: 'Société',
    invoiceNo: 'Numéro de facture',
    processingFee: 'Frais de traitement',
    thankYou: 'Merci pour votre achat',
  },
};

export default function InvoicePreviewModal({
  isOpen,
  onClose,
  template,
  order,
  customer,
  lang = 'en',
  onSendToCustomer,
}: InvoicePreviewModalProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const captureRef = useRef<HTMLDivElement>(null);

  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;

  if (!isOpen) return null;

  const renderPreviewToPdf = async () => {
    const el = captureRef.current;
    if (!el) {
      throw new Error('missing_invoice_container');
    }

    // 确保 DOM 更新并稍微等待渲染，给图片或样式加载预留时间
    await new Promise((r) => setTimeout(r, 200));

    try {
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        logging: true, // 开启日志便于在控制台排查
        backgroundColor: '#ffffff',
        // 捕捉完整内容，即便在滚动容器内
        height: el.scrollHeight,
        width: el.scrollWidth,
        windowHeight: el.scrollHeight,
        windowWidth: el.scrollWidth,
        // 关键：处理 Tailwind V4 可能使用的现代 CSS 属性
        onclone: (doc) => {
          const clonedEl = doc.getElementById('invoice-capture-area');
          if (clonedEl) {
            clonedEl.style.height = 'auto';
            clonedEl.style.overflow = 'visible';
            // 额外处理：html2canvas 对某些现代 CSS 变量支持较弱，可在此处做强制降级样式
            clonedEl.querySelectorAll('*').forEach((node) => {
              const htmlNode = node as HTMLElement;
              // 如果有阴影或特殊的渐变，可以在这里做降级处理
              if (htmlNode.classList.contains('shadow-sm')) {
                htmlNode.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)';
              }
            });
          }
        },
      });

      if (!canvas || canvas.width === 0 || canvas.height === 0) {
        throw new Error('blank_canvas');
      }

      return canvasToMultiPagePdf(canvas);
    } catch (e) {
      console.error('html2canvas failed:', e);
      throw e;
    }
  };

  const handleDownloadPDF = async () => {
    const fileName = `Invoice_${order.platformOrderId}.pdf`;
    let fileHandle: FileSystemFileHandle | undefined;
    const w = window as Window & {
      showSaveFilePicker?: (options: {
        suggestedName?: string;
        types?: { description: string; accept: Record<string, string[]> }[];
      }) => Promise<FileSystemFileHandle>;
    };
    if (typeof w.showSaveFilePicker === 'function') {
      try {
        fileHandle = await w.showSaveFilePicker({
          suggestedName: fileName,
          types: [{ description: 'PDF', accept: { 'application/pdf': ['.pdf'] } }],
        });
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        fileHandle = undefined;
      }
    }

    try {
      setIsGenerating(true);
      const pdf = await renderPreviewToPdf();
      const blob = pdf.output('blob');
      if (fileHandle) {
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
      } else {
        triggerBlobDownload(blob, fileName);
      }
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      alert(
        error instanceof Error && error.message === 'missing_invoice_container'
          ? '无法获取发票内容，请重试'
          : error instanceof Error && error.message === 'canvas_export_blocked'
            ? '无法导出预览（浏览器安全策略限制），请尝试关闭隐私模式或更换浏览器'
            : '生成 PDF 失败，请重试'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendToCustomer = async () => {
    if (!onSendToCustomer) {
      alert('当前页面未接入发送会话，无法发送给客户');
      return;
    }
    try {
      setIsGenerating(true);
      const pdf = await renderPreviewToPdf();
      // 获取 Base64 Data URL
      const dataUrl = pdf.output('datauristring');
      
      const fileName = `Invoice_${order.platformOrderId}.pdf`;
      const content = `已随本消息附上订单发票 PDF（${fileName}），请查收。`;
      
      await Promise.resolve(onSendToCustomer({ content, attachments: [dataUrl] }));
      onClose();
    } catch (error) {
      console.error('Failed to send invoice:', error);
      alert(
        error instanceof Error && error.message === 'missing_invoice_container'
          ? '无法获取发票内容，请重试'
          : error instanceof Error && error.message === 'blank_canvas'
            ? '渲染预览失败（画布为空），请稍后重试'
            : error instanceof Error && error.message === 'canvas_export_blocked'
              ? '无法导出预览（浏览器安全策略限制），请尝试关闭隐私模式或更换浏览器'
              : '生成或发送失败，可能文件过大或后端限制。请确认后端已配置 10MB JSON 限制。'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const renderTemplate = () => {
    const store = order.storeEntity || {
      legalName: 'Nezha Shop Ltd.',
      displayName: 'Nezha Shop',
      address: '123 Commerce Street, London, UK EC1A 1BB',
      vatNumber: 'GB123456789'
    };
    const storeAny = store as Record<string, unknown>;
    const shopLogoUrl =
      (typeof storeAny.logoUrl === 'string' && storeAny.logoUrl.trim()) ||
      (typeof storeAny.logo === 'string' && storeAny.logo.trim()) ||
      (typeof storeAny.brandLogoUrl === 'string' && storeAny.brandLogoUrl.trim()) ||
      '';

    if (template === 'receipt') {
      return (
        <div
          className="max-w-3xl mx-auto bg-white p-16 shadow-sm rounded-xl font-sans text-slate-700 relative"
          style={{ backgroundColor: '#ffffff', color: '#334155' }}
        >
          <div className="flex justify-between items-start mb-10 relative z-10">
            <div>
              {shopLogoUrl ? (
                <img
                  src={shopLogoUrl}
                  alt={`${store.displayName} logo`}
                  className="w-12 h-12 rounded-xl object-cover mb-6 border border-slate-200"
                />
              ) : null}
              <h1 className="text-4xl font-bold text-slate-900 tracking-tight mb-2" style={{ color: '#0f172a' }}>
                {t.receipt}
              </h1>
              <p className="text-slate-500 font-mono text-sm tracking-wider" style={{ color: '#64748b' }}>
                {format(new Date(), 'MMM dd, yyyy HH:mm')}
              </p>
            </div>

            <div className="text-right">
              <h3 className="font-bold text-slate-900 text-xl tracking-tight mb-2" style={{ color: '#0f172a' }}>
                {store.legalName}
              </h3>
              <p className="text-slate-500 text-sm leading-relaxed whitespace-pre-line" style={{ color: '#64748b' }}>
                {store.address}
              </p>
              <p className="text-slate-400 text-sm mt-3 font-mono" style={{ color: '#94a3b8' }}>
                VAT: {store.vatNumber}
              </p>
            </div>
          </div>

          <div className="border-y border-dashed border-slate-300 py-6 mb-8 space-y-3" style={{ borderTop: '1px dashed #cbd5e1', borderBottom: '1px dashed #cbd5e1' }}>
            <div className="flex justify-between items-baseline">
              <span className="text-slate-500 text-xs uppercase tracking-wider" style={{ color: '#64748b' }}>{t.orderNo}</span>
              <span className="font-bold text-slate-900 tracking-tight" style={{ color: '#0f172a' }}>{order.platformOrderId}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-slate-500 text-xs uppercase tracking-wider" style={{ color: '#64748b' }}>{t.customer}</span>
              <span className="font-bold text-slate-900 tracking-tight" style={{ color: '#0f172a' }}>{customer?.name || 'Guest'}</span>
            </div>
          </div>

          <table className="w-full mb-10" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th
                  className="text-left py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b-2 border-slate-900"
                  style={{ color: '#94a3b8', borderBottom: '2px solid #0f172a' }}
                >
                  {t.description}
                </th>
                <th
                  className="text-center py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b-2 border-slate-900 w-20"
                  style={{ color: '#94a3b8', borderBottom: '2px solid #0f172a' }}
                >
                  {t.qty}
                </th>
                <th
                  className="text-right py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b-2 border-slate-900 w-44"
                  style={{ color: '#94a3b8', borderBottom: '2px solid #0f172a' }}
                >
                  {t.amount}
                </th>
              </tr>
            </thead>
            <tbody>
              {order.productTitles.map((title, i) => (
                <tr key={i}>
                  <td className="py-4 text-slate-900 font-medium border-b border-slate-100" style={{ borderBottom: '1px solid #f1f5f9' }}>
                    {title}
                  </td>
                  <td className="py-4 text-center text-slate-500 border-b border-slate-100 font-mono" style={{ borderBottom: '1px solid #f1f5f9' }}>
                    1
                  </td>
                  <td className="py-4 text-right text-slate-900 font-bold border-b border-slate-100 font-mono" style={{ borderBottom: '1px solid #f1f5f9' }}>
                    {order.amount} {order.currency}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end mb-6">
            <div
              className="w-80 bg-slate-900 text-white p-6 rounded-lg flex justify-between items-center"
              style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
            >
              <span className="text-xs uppercase tracking-widest font-bold opacity-80">{t.total}</span>
              <span className="text-2xl font-bold tracking-tight">
                {order.amount} {order.currency}
              </span>
            </div>
          </div>

          <div className="mt-6 text-center text-xs text-slate-400 uppercase tracking-widest space-y-1" style={{ color: '#94a3b8' }}>
            <p>{t.thankYou}</p>
            <p className="font-bold text-slate-500" style={{ color: '#64748b' }}>
              {store.legalName}
            </p>
          </div>
        </div>
      );
    }

    if (template === 'standard') {
      return (
        <div className="max-w-3xl mx-auto bg-white p-16 shadow-sm rounded-xl font-sans text-slate-700 relative" style={{ backgroundColor: '#ffffff', color: '#334155' }}>
          <div className="absolute top-0 right-16 w-32 h-32 bg-slate-50 rounded-full -translate-y-1/2 opacity-50 blur-2xl" style={{ backgroundColor: '#f8fafc' }}></div>
          
          <div className="flex justify-between items-start mb-16 relative z-10">
            <div>
              {shopLogoUrl ? (
                <img
                  src={shopLogoUrl}
                  alt={`${store.displayName} logo`}
                  className="w-12 h-12 rounded-xl object-cover mb-6 border border-slate-200"
                />
              ) : null}
              <h1 className="text-5xl font-bold text-slate-900 tracking-tighter mb-2" style={{ color: '#0f172a' }}>{t.invoice}</h1>
              <p className="text-slate-500 font-mono text-sm tracking-wider" style={{ color: '#64748b' }}>#INV-{order.id.replace('ORD-', '')}</p>
            </div>
            <div className="text-right">
              <h3 className="font-bold text-slate-900 text-xl tracking-tight mb-2" style={{ color: '#0f172a' }}>{store.legalName}</h3>
              <p className="text-slate-500 text-sm leading-relaxed whitespace-pre-line" style={{ color: '#64748b' }}>{store.address}</p>
              <p className="text-slate-400 text-sm mt-3 font-mono" style={{ color: '#94a3b8' }}>VAT: {store.vatNumber}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-12 mb-16">
            <div className="p-6 bg-slate-50/50 rounded-2xl border border-slate-100" style={{ backgroundColor: '#f8fafc', border: '1px solid #f1f5f9' }}>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3" style={{ color: '#94a3b8' }}>{t.billedTo}</p>
              <p className="font-bold text-slate-900 text-lg tracking-tight mb-1" style={{ color: '#0f172a' }}>{customer?.name || 'Unknown Customer'}</p>
              <p className="text-slate-500 text-sm" style={{ color: '#64748b' }}>{customer?.shippingCountry || 'Unknown Country'}</p>
              <p className="text-slate-500 text-sm mt-2" style={{ color: '#64748b' }}>{customer?.email}</p>
            </div>
            <div className="p-6 bg-slate-50/50 rounded-2xl border border-slate-100 flex flex-col justify-center" style={{ backgroundColor: '#f8fafc', border: '1px solid #f1f5f9' }}>
              <div className="space-y-3">
                <div className="flex justify-between items-baseline border-b border-slate-200/60 pb-3" style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest" style={{ color: '#94a3b8' }}>{t.date}</span>
                  <span className="font-medium text-slate-900 font-mono text-sm" style={{ color: '#0f172a' }}>{format(new Date(), 'MMM dd, yyyy')}</span>
                </div>
                <div className="flex justify-between items-baseline border-b border-slate-200/60 pb-3" style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest" style={{ color: '#94a3b8' }}>{t.orderNo}</span>
                  <span className="font-medium text-slate-900 font-mono text-sm" style={{ color: '#0f172a' }}>{order.platformOrderId}</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest" style={{ color: '#94a3b8' }}>{t.status}</span>
                  <span className="font-bold text-emerald-600 text-sm uppercase tracking-wider bg-emerald-50 px-2 py-0.5 rounded-md" style={{ color: '#059669', backgroundColor: '#ecfdf5' }}>{order.paymentStatus}</span>
                </div>
              </div>
            </div>
          </div>

          <table className="w-full mb-12">
            <thead>
              <tr>
                <th className="text-left py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b-2 border-slate-900" style={{ color: '#94a3b8', borderBottom: '2px solid #0f172a' }}>{t.description}</th>
                <th className="text-center py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b-2 border-slate-900 w-24" style={{ color: '#94a3b8', borderBottom: '2px solid #0f172a' }}>{t.qty}</th>
                <th className="text-right py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b-2 border-slate-900 w-32" style={{ color: '#94a3b8', borderBottom: '2px solid #0f172a' }}>{t.price}</th>
                <th className="text-right py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b-2 border-slate-900 w-32" style={{ color: '#94a3b8', borderBottom: '2px solid #0f172a' }}>{t.amount}</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {order.productTitles.map((title, i) => (
                <tr key={i} className="group">
                  <td className="py-5 text-slate-900 font-medium border-b border-slate-100 group-last:border-0" style={{ color: '#0f172a', borderBottom: '1px solid #f1f5f9' }}>{title}</td>
                  <td className="py-5 text-center text-slate-500 border-b border-slate-100 group-last:border-0 font-mono" style={{ color: '#64748b', borderBottom: '1px solid #f1f5f9' }}>1</td>
                  <td className="py-5 text-right text-slate-500 border-b border-slate-100 group-last:border-0 font-mono" style={{ color: '#64748b', borderBottom: '1px solid #f1f5f9' }}>{order.amount} {order.currency}</td>
                  <td className="py-5 text-right text-slate-900 font-bold border-b border-slate-100 group-last:border-0 font-mono" style={{ color: '#0f172a', borderBottom: '1px solid #f1f5f9' }}>{order.amount} {order.currency}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end">
            <div className="w-80 bg-slate-50 rounded-2xl p-6 border border-slate-100" style={{ backgroundColor: '#f8fafc', border: '1px solid #f1f5f9' }}>
              <div className="space-y-4 text-sm">
                <div className="flex justify-between text-slate-500 items-baseline" style={{ color: '#64748b' }}>
                  <span>{t.subtotal}</span>
                  <span className="font-mono">{(order.amount * 0.8).toFixed(2)} {order.currency}</span>
                </div>
                <div className="flex justify-between text-slate-500 items-baseline" style={{ color: '#64748b' }}>
                  <span>{t.tax} (20%)</span>
                  <span className="font-mono">{(order.amount * 0.2).toFixed(2)} {order.currency}</span>
                </div>
                <div className="flex justify-between items-baseline pt-4 border-t border-slate-200 mt-4" style={{ borderTop: '1px solid #e2e8f0' }}>
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-widest" style={{ color: '#0f172a' }}>{t.totalDue}</span>
                  <span className="text-2xl font-bold text-slate-900 tracking-tight font-mono" style={{ color: '#0f172a' }}>{order.amount} {order.currency}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (template === 'commercial') {
      const itemCount = Math.max(1, order.productTitles?.length ?? 0);
      const qty = 1;
      const unitPriceBeforeTaxesAndShipping = order.amount / itemCount;
      const subtotal = unitPriceBeforeTaxesAndShipping * qty * order.productTitles.length;
      const shippingCostWithoutTaxes: number = 0;
      const taxes: number = 0; // 参照模板：Always 0 (zero)
      const totalAmount = subtotal + shippingCostWithoutTaxes + taxes;

      const invoiceNo = `INV-${order.platformOrderId.replace(/-/g, '').slice(-12)}`;
      const invoiceDate = format(new Date(), 'yyyy-MM-dd');

      return (
        <div
          className="max-w-3xl mx-auto bg-white p-16 shadow-sm rounded-xl font-sans text-slate-700 relative"
          style={{ backgroundColor: '#ffffff', color: '#334155' }}
        >
          <div
            className="absolute top-0 right-16 w-32 h-32 bg-slate-50 rounded-full -translate-y-1/2 opacity-50 blur-2xl"
            style={{ backgroundColor: '#f8fafc' }}
          />

          <div className="flex justify-between items-start mb-10 relative z-10">
            <div>
              {shopLogoUrl ? (
                <img
                  src={shopLogoUrl}
                  alt={`${store.displayName} logo`}
                  className="w-12 h-12 rounded-xl object-cover mb-6 border border-slate-200"
                />
              ) : null}
              <h1 className="text-4xl font-bold text-slate-900 tracking-tight mb-2" style={{ color: '#0f172a' }}>
                Commercial Invoice
              </h1>
              <p className="text-slate-500 font-mono text-sm tracking-wider" style={{ color: '#64748b' }}>
                {`Order: ${order.platformOrderId}`}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-12 mb-8 relative z-10">
            {/* Seller Details */}
            <div className="p-6 bg-slate-50/50 rounded-2xl border border-slate-100" style={{ border: '1px solid #f1f5f9' }}>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4" style={{ color: '#94a3b8' }}>
                Seller Details
              </p>

              <div className="space-y-2">
                <div className="space-y-1">
                  <div className="text-[11px] font-semibold text-slate-600">Company name</div>
                  <div className="text-[11px] font-medium text-slate-900 break-words">{store.displayName}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-[11px] font-semibold text-slate-600">Full address</div>
                  <div className="text-[11px] whitespace-pre-line leading-relaxed text-slate-900 break-words">
                    {store.address}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-[11px] font-semibold text-slate-600">Phone</div>
                  <div className="text-[11px] text-slate-900 break-words">{'-'}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-[11px] font-semibold text-slate-600">EU VAT Registration Number</div>
                  <div className="text-[11px] font-mono text-slate-900 break-all">{store.vatNumber}</div>
                </div>
              </div>
            </div>

            {/* Receiver Details */}
            <div className="p-6 bg-slate-50/50 rounded-2xl border border-slate-100" style={{ border: '1px solid #f1f5f9' }}>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4" style={{ color: '#94a3b8' }}>
                Receiver Details
              </p>

              <div className="space-y-2">
                <div className="space-y-1">
                  <div className="text-[11px] font-semibold text-slate-600">Client name</div>
                  <div className="text-[11px] font-medium text-slate-900 break-words">{customer?.name ?? '-'}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-[11px] font-semibold text-slate-600">Client full address</div>
                  <div className="text-[11px] leading-relaxed text-slate-900 break-words">
                    <div>{customer?.shippingCountry ?? '-'}</div>
                    {customer?.email ? <div className="break-all">{customer.email}</div> : null}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-[11px] font-semibold text-slate-600">phone</div>
                  <div className="text-[11px] text-slate-900 break-words">{customer?.phone ?? '-'}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-[11px] font-semibold text-slate-600">Client VAT Number</div>
                  <div className="text-[11px] text-slate-900 break-words">{'-'}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Order / Invoice / Date */}
          <div className="space-y-3 mb-8 relative z-10">
            {[
              {
                label: 'Order Number',
                value: order.platformOrderId,
              },
              {
                label: 'Invoice Number',
                value: invoiceNo,
              },
              {
                label: 'Invoice Date',
                value: invoiceDate,
              },
            ].map((r, idx) => (
              <div
                key={idx}
                className="flex justify-between items-baseline border-b border-slate-200/60 pb-3"
                style={{ borderBottom: '1px solid #e2e8f0' }}
              >
                <span
                  className="text-[10px] font-bold text-slate-400 uppercase tracking-widest"
                  style={{ color: '#94a3b8' }}
                >
                  {r.label}
                </span>
                <span className="font-medium text-slate-900 font-mono text-sm whitespace-nowrap break-words" style={{ color: '#0f172a' }}>
                  {r.value}
                </span>
              </div>
            ))}
          </div>

          {/* Line items */}
          <table className="w-full mb-8" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th className="text-left py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b-2 border-slate-900">
                  Quantity
                </th>
                <th className="text-left py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b-2 border-slate-900">
                  Description
                </th>
                <th className="text-right py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b-2 border-slate-900 w-36">
                  Unit Price
                </th>
                <th className="text-right py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b-2 border-slate-900 w-36">
                  Total Price
                </th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {order.productTitles.map((title, i) => {
                const lineTotalPrice = unitPriceBeforeTaxesAndShipping * qty;
                return (
                  <tr key={i}>
                    <td className="py-4 text-center text-slate-500 border-b border-slate-100 font-mono" style={{ borderBottom: '1px solid #f1f5f9' }}>
                      {qty}
                    </td>
                    <td className="py-4 text-left text-slate-900 font-medium border-b border-slate-100" style={{ borderBottom: '1px solid #f1f5f9' }}>
                      {title}
                    </td>
                    <td className="py-4 text-right text-slate-500 border-b border-slate-100 font-mono" style={{ borderBottom: '1px solid #f1f5f9' }}>
                      {unitPriceBeforeTaxesAndShipping.toFixed(2)} {order.currency}
                    </td>
                    <td className="py-4 text-right text-slate-900 font-bold border-b border-slate-100 font-mono" style={{ borderBottom: '1px solid #f1f5f9' }}>
                      {lineTotalPrice.toFixed(2)} {order.currency}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Totals (align with template fields) */}
          <div className="flex justify-end relative z-10">
            <div className="w-[460px] max-w-full bg-slate-50 rounded-2xl p-6 border border-slate-100" style={{ border: '1px solid #f1f5f9' }}>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between text-slate-500 items-baseline" style={{ color: '#64748b' }}>
                  <span className="text-xs font-bold uppercase tracking-wider leading-snug break-words">Sum of total price</span>
                  <span className="font-mono font-semibold">
                    {subtotal.toFixed(2)} {order.currency}
                  </span>
                </div>

                <div className="flex justify-between text-slate-500 items-baseline" style={{ color: '#64748b' }}>
                  <span className="text-xs font-bold uppercase tracking-wider leading-snug break-words">Subtotal</span>
                  <span className="font-mono">{subtotal.toFixed(2)} {order.currency}</span>
                </div>

                <div className="flex justify-between text-slate-500 items-baseline" style={{ color: '#64748b' }}>
                  <span className="text-xs font-bold uppercase tracking-wider leading-snug break-words">Cost of the shipping without taxes</span>
                  <span className="font-mono">{shippingCostWithoutTaxes === 0 ? '-' : `${shippingCostWithoutTaxes.toFixed(2)} ${order.currency}`}</span>
                </div>

                <div className="flex justify-between text-slate-500 items-baseline" style={{ color: '#64748b' }}>
                  <span className="text-xs font-bold uppercase tracking-wider leading-snug break-words">Taxes</span>
                  <span className="font-mono">Always 0 (zero)</span>
                </div>

                <div className="flex justify-between items-baseline pt-4 border-t border-slate-200 mt-4" style={{ borderTop: '1px solid #e2e8f0' }}>
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-widest" style={{ color: '#0f172a' }}>
                    Sum of subtotal plus shipping (mandatory)
                  </span>
                  <span className="text-2xl font-bold text-slate-900 tracking-tight font-mono" style={{ color: '#0f172a' }}>
                    {totalAmount.toFixed(2)} {order.currency}
                  </span>
                </div>

                {/* template also displays the final "Total Amount" line */}
                <div className="flex justify-between items-baseline pt-3">
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wider" style={{ color: '#0f172a' }}>
                    Total Amount
                  </span>
                  <span className="font-mono font-medium text-slate-900" style={{ color: '#0f172a' }}>
                    {totalAmount.toFixed(2)} {order.currency}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="text-center p-8">
        <p className="text-slate-500">无法预览该发票模版</p>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-100 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 shrink-0">
        <h2 className="text-lg font-bold text-slate-900">发票预览 - 统一模版</h2>
          <button
            type="button"
            onClick={onClose}
            title="关闭"
            aria-label="关闭"
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body：整块 ref 供 html2canvas 捕获（避免 getElementById 与异步下载被浏览器拦截） */}
        <div className="flex-1 overflow-y-auto p-8">
          <div ref={captureRef} id="invoice-capture-area" className="min-h-[120px] flex flex-col items-stretch">
            {renderTemplate()}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-white border-t border-slate-200 shrink-0">
          <button 
            type="button"
            onClick={onClose} 
            disabled={isGenerating}
            className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
          >
            取消
          </button>
          <button 
            type="button"
            onClick={() => void handleDownloadPDF()}
            disabled={isGenerating}
            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {isGenerating ? '生成中...' : '下载 PDF'}
          </button>
          <button 
            type="button"
            onClick={handleSendToCustomer}
            disabled={isGenerating || !onSendToCustomer}
            title={!onSendToCustomer ? '未接入会话发送' : undefined}
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
