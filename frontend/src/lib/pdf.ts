import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Inquiry, LedgerRecord, LedgerSummary } from '../types/index.ts';

function formatCurrency(amount: number): string {
  return `Rs. ${amount.toLocaleString('en-IN')}`;
}

export function exportInquiriesPDF(inquiries: Inquiry[]) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4',
  });

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Title and Generated Date (Strictly NO company name)
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text('Travel Inquiries Summary', 40, 40);

  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text(`Generated: ${dateStr} at ${timeStr} · Total Inquiries: ${inquiries.length}`, 40, 56);

  const tableBody = inquiries.map((inq) => {
    const typeLabel = inq.type === 'package' ? 'Package' : `Ticket (${inq.tripType || 'single'})`;
    const dates = inq.dateMode === 'fixed' 
      ? `${inq.startDate} to ${inq.endDate}` 
      : `Anytime: ${inq.startDate} to ${inq.endDate}`;
    const passengers = `${inq.adults}A, ${inq.children}C`;
    const statusLabel = inq.status === 'inquiry' ? 'Inquiry' : inq.status === 'confirmed' ? 'Confirmed' : 'Cancelled';
    const agentsCount = inq.dispatches?.length || 0;
    const sentList = (inq.dispatches || []).map((d) => d.agentName).join(', ') || 'None';

    return [
      `#${inq.inquiryNumber}`,
      inq.clientName,
      typeLabel,
      inq.destination,
      `${inq.pickup} -> ${inq.drop}`,
      dates,
      passengers,
      statusLabel,
      `${agentsCount} agent(s):\n${sentList}`,
    ];
  });

  autoTable(doc, {
    startY: 70,
    head: [['#', 'Client Name', 'Type', 'Destination', 'Route', 'Travel Dates', 'Pax', 'Status', 'Dispatched Agents']],
    body: tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59],
      cellPadding: 6,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    styles: {
      overflow: 'linebreak',
    },
    columnStyles: {
      0: { cellWidth: 40 },
      1: { cellWidth: 70 },
      2: { cellWidth: 65 },
      3: { cellWidth: 70 },
      4: { cellWidth: 80 },
      5: { cellWidth: 95 },
      6: { cellWidth: 40 },
      7: { cellWidth: 55 },
      8: { cellWidth: 140 },
    },
  });

  doc.save(`Travel_Inquiries_${now.toISOString().split('T')[0]}.pdf`);
}

export function exportLedgerPDF(records: LedgerRecord[], summary: LedgerSummary) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Title and Generated Date (Strictly NO company name)
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text('Client & Agent Ledger Statement', 40, 40);

  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated: ${dateStr} at ${timeStr} · Khatabook Ledger`, 40, 56);

  // Summary KPI Cards Box
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(40, 68, 515, 45, 6, 6, 'FD');

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL RECEIVED', 60, 84);
  doc.text('TOTAL SENT (DISBURSED)', 230, 84);
  doc.text('BALANCE WITH ME', 410, 84);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(formatCurrency(summary.totalReceived), 60, 101);

  doc.setTextColor(225, 29, 72); // rose-600
  doc.text(formatCurrency(summary.totalSent), 230, 101);

  doc.setTextColor(16, 185, 129); // emerald-600
  doc.text(formatCurrency(summary.balanceWithMe), 410, 101);

  // Reset font for table
  doc.setFont('helvetica', 'normal');

  const tableBody = records.map((rec) => {
    const disbursementsList = rec.disbursements && rec.disbursements.length > 0
      ? rec.disbursements.map((d) => `• ${d.agentName}: ${formatCurrency(d.amount)}${d.note ? ` (${d.note})` : ''}`).join('\n')
      : 'None disbursed';

    return [
      rec.date,
      rec.clientName + (rec.note ? `\nNote: ${rec.note}` : ''),
      formatCurrency(rec.amountReceived),
      `${formatCurrency(rec.totalSent)}\n${disbursementsList}`,
      formatCurrency(rec.balanceHeld),
    ];
  });

  autoTable(doc, {
    startY: 125,
    head: [['Date', 'Client Details', 'Received (Rs.)', 'Disbursed to Agents (Rs.)', 'Balance Held']],
    body: tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59],
      cellPadding: 7,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    styles: {
      overflow: 'linebreak',
    },
    columnStyles: {
      0: { cellWidth: 65 },
      1: { cellWidth: 120 },
      2: { cellWidth: 85, halign: 'right' },
      3: { cellWidth: 160 },
      4: { cellWidth: 85, halign: 'right', fontStyle: 'bold' },
    },
  });

  doc.save(`Ledger_Statement_${now.toISOString().split('T')[0]}.pdf`);
}
