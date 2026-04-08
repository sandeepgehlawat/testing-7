/**
 * PDF Tax Report Generator
 *
 * Creates a professional PDF tax report using jsPDF.
 */

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Totals, CostBasisMethod } from "./types";
import type { Tx } from "./tax";

type ReportData = {
  wallet: string;
  country: string;
  year: string;
  method: CostBasisMethod;
  txs: Tx[];
  totals: Totals;
  estimatedTax: number;
};

/**
 * Generate a tax report PDF
 */
export async function generateTaxReport(data: ReportData): Promise<Blob> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = 20;

  // Colors
  const brandColor: [number, number, number] = [99, 102, 241]; // Indigo-500
  const textColor: [number, number, number] = [31, 41, 55]; // Gray-800
  const subColor: [number, number, number] = [107, 114, 128]; // Gray-500
  const gainColor: [number, number, number] = [16, 185, 129]; // Emerald-500
  const lossColor: [number, number, number] = [239, 68, 68]; // Red-500

  // ============ HEADER ============
  // Logo area
  doc.setFillColor(...brandColor);
  doc.roundedRect(margin, y, 10, 10, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("CT", margin + 2.5, y + 6.5);

  // Title
  doc.setTextColor(...textColor);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Crypto Tax Report", margin + 14, y + 7);

  // Subtitle
  doc.setTextColor(...subColor);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`${data.year} Tax Year · ${data.country}`, margin + 14, y + 13);

  y += 25;

  // ============ WALLET INFO ============
  doc.setDrawColor(229, 231, 235);
  doc.setFillColor(249, 250, 251);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 20, 3, 3, "FD");

  doc.setTextColor(...subColor);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("WALLET ADDRESS", margin + 5, y + 6);

  doc.setTextColor(...textColor);
  doc.setFontSize(9);
  doc.setFont("courier", "normal");
  doc.text(data.wallet, margin + 5, y + 12);

  doc.setTextColor(...subColor);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`Cost Basis Method: ${data.method}`, margin + 5, y + 17);

  y += 28;

  // ============ SUMMARY CARDS ============
  const cardWidth = (pageWidth - margin * 2 - 10) / 2;
  const cardHeight = 25;

  // Card 1: Estimated Tax
  doc.setFillColor(...brandColor);
  doc.roundedRect(margin, y, cardWidth, cardHeight, 3, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("ESTIMATED TAX DUE", margin + 5, y + 8);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(formatCurrency(data.estimatedTax), margin + 5, y + 19);

  // Card 2: Net Gains
  const netGainsColor: [number, number, number] =
    data.totals.netGains >= 0 ? gainColor : lossColor;
  doc.setFillColor(249, 250, 251);
  doc.setDrawColor(229, 231, 235);
  doc.roundedRect(margin + cardWidth + 10, y, cardWidth, cardHeight, 3, 3, "FD");
  doc.setTextColor(...subColor);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("NET CAPITAL GAINS", margin + cardWidth + 15, y + 8);
  doc.setTextColor(...netGainsColor);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  const netGainsText =
    data.totals.netGains >= 0
      ? `+${formatCurrency(data.totals.netGains)}`
      : `-${formatCurrency(Math.abs(data.totals.netGains))}`;
  doc.text(netGainsText, margin + cardWidth + 15, y + 19);

  y += cardHeight + 8;

  // ============ BREAKDOWN TABLE ============
  doc.setTextColor(...textColor);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Capital Gains Breakdown", margin, y + 5);
  y += 10;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Category", "Amount"]],
    body: [
      ["Total Proceeds", formatCurrency(data.totals.proceeds)],
      ["Total Cost Basis", formatCurrency(data.totals.costBasis)],
      ["Capital Gains", `+${formatCurrency(data.totals.gains)}`],
      ["Capital Losses", `-${formatCurrency(data.totals.losses)}`],
      ["Net Gains", formatCurrency(data.totals.netGains)],
      ["", ""],
      ["Long-term Gains (> 1 year)", formatCurrency(data.totals.longTermGains)],
      ["Short-term Gains (< 1 year)", formatCurrency(data.totals.shortTermGains)],
    ],
    styles: {
      fontSize: 9,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [249, 250, 251],
      textColor: [107, 114, 128],
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { cellWidth: "auto", halign: "right" },
    },
    alternateRowStyles: {
      fillColor: [255, 255, 255],
    },
  });

  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  // ============ INCOME SECTION ============
  if (data.totals.income > 0) {
    doc.setTextColor(...textColor);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Crypto Income", margin, y + 5);
    y += 10;

    const incomeRows: (string | number)[][] = [];
    if (data.totals.airdrops.count > 0) {
      incomeRows.push([
        `Airdrops (${data.totals.airdrops.count} events)`,
        formatCurrency(data.totals.airdrops.total),
      ]);
    }
    if (data.totals.yieldEvents.count > 0) {
      incomeRows.push([
        `Yield/Interest (${data.totals.yieldEvents.count} events)`,
        formatCurrency(data.totals.yieldEvents.total),
      ]);
    }
    incomeRows.push(["Total Income", formatCurrency(data.totals.income)]);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Category", "Amount"]],
      body: incomeRows,
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [249, 250, 251],
        textColor: [107, 114, 128],
        fontStyle: "bold",
      },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: "auto", halign: "right" },
      },
    });

    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  // ============ TRANSACTIONS TABLE ============
  // Check if we need a new page
  if (y > 200) {
    doc.addPage();
    y = 20;
  }

  doc.setTextColor(...textColor);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(`Transactions (${data.txs.length} total)`, margin, y + 5);
  y += 10;

  // Filter to disposals only for the main table
  const disposals = data.txs.filter((tx) => tx.isDisposal);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Date", "Token", "Amount", "Cost Basis", "Proceeds", "Gain/Loss", "Held"]],
    body: disposals.slice(0, 50).map((tx) => [
      tx.date,
      tx.token,
      tx.amount.toFixed(4),
      formatCurrency(tx.costBasis),
      formatCurrency(tx.proceeds),
      formatCurrency(tx.proceeds - tx.costBasis),
      formatHeldDays(tx.heldDays),
    ]),
    styles: {
      fontSize: 7,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [249, 250, 251],
      textColor: [107, 114, 128],
      fontStyle: "bold",
      fontSize: 7,
    },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 15 },
      2: { cellWidth: 20, halign: "right" },
      3: { cellWidth: 25, halign: "right" },
      4: { cellWidth: 25, halign: "right" },
      5: { cellWidth: 25, halign: "right" },
      6: { cellWidth: 18, halign: "right" },
    },
    didParseCell: (data) => {
      // Color gain/loss column
      if (data.section === "body" && data.column.index === 5) {
        const value = parseFloat(data.cell.raw as string);
        if (value >= 0) {
          data.cell.styles.textColor = gainColor;
        } else {
          data.cell.styles.textColor = lossColor;
        }
      }
    },
  });

  if (disposals.length > 50) {
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;
    doc.setTextColor(...subColor);
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.text(
      `Showing first 50 of ${disposals.length} transactions. Export CSV for full list.`,
      margin,
      y
    );
  }

  // ============ FOOTER ============
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.getHeight();

    // Footer line
    doc.setDrawColor(229, 231, 235);
    doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);

    // Footer text
    doc.setTextColor(...subColor);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(
      "Generated by ChainTax · chaintax.app · Not legal or financial advice",
      margin,
      pageHeight - 10
    );
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin - 15, pageHeight - 10);

    // Generated date
    doc.text(
      `Generated: ${new Date().toISOString().split("T")[0]}`,
      pageWidth / 2 - 15,
      pageHeight - 10
    );
  }

  // Return as Blob
  return doc.output("blob");
}

function formatCurrency(value: number): string {
  return "$" + Math.abs(value).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function formatHeldDays(days: number): string {
  if (days >= 365) {
    const years = Math.floor(days / 365);
    const months = Math.floor((days % 365) / 30);
    return months > 0 ? `${years}y ${months}m` : `${years}y`;
  }
  return `${days}d`;
}
