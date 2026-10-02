export interface ExportTableDefinition {
  sectionTitle?: string;
  headers: string[];
  rows: Array<Array<string | number>>;
  footerRow?: Array<string | number>;
  isAccountingStatement?: boolean;
}

export interface ExportReportPayload {
  filename: string;
  reportTitle: string;
  subtitle?: string;
  periodLabel: string;
  summaryItems?: Array<{ label: string; value: string; sublabel?: string }>;
  tables: ExportTableDefinition[];
}

function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '""';
  const str = String(value).replace(/"/g, '""');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str}"`;
  }
  return str;
}

export function exportReportToCSV(payload: ExportReportPayload): void {
  const lines: string[] = [];

  lines.push(escapeCsvCell('AYAM GEPREK ARY'));
  lines.push(escapeCsvCell(payload.reportTitle.toUpperCase()));
  if (payload.subtitle) {
    lines.push(escapeCsvCell(payload.subtitle));
  }
  lines.push(`${escapeCsvCell('Periode')},${escapeCsvCell(payload.periodLabel)}`);
  lines.push(
    `${escapeCsvCell('Dicetak pada')},${escapeCsvCell(
      new Date().toLocaleString('id-ID')
    )}`
  );
  lines.push('');

  if (payload.summaryItems && payload.summaryItems.length > 0) {
    lines.push(
      `${escapeCsvCell('RINGKASAN')},${escapeCsvCell('NILAI')},${escapeCsvCell(
        'KETERANGAN'
      )}`
    );
    for (const item of payload.summaryItems) {
      lines.push(
        [
          escapeCsvCell(item.label),
          escapeCsvCell(item.value),
          escapeCsvCell(item.sublabel || ''),
        ].join(',')
      );
    }
    lines.push('');
  }

  for (const tbl of payload.tables) {
    if (tbl.sectionTitle) {
      lines.push(escapeCsvCell(tbl.sectionTitle.toUpperCase()));
    }
    lines.push(tbl.headers.map(escapeCsvCell).join(','));
    for (const row of tbl.rows) {
      lines.push(row.map(escapeCsvCell).join(','));
    }
    if (tbl.footerRow && tbl.footerRow.length > 0) {
      lines.push(tbl.footerRow.map(escapeCsvCell).join(','));
    }
    lines.push('');
  }

  const csvContent = '\uFEFF' + lines.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${payload.filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function exportReportToPDF(
  payload: ExportReportPayload
): Promise<void> {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const maxCols = payload.tables.reduce(
    (max, t) => Math.max(max, t.headers.length),
    0
  );
  const orientation = maxCols >= 7 ? 'landscape' : 'portrait';

  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const printedAtStr = new Date().toLocaleString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  let currentY = 16;

  // Formal Accounting Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('AYAM GEPREK ARY', 14, currentY);

  currentY += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(payload.reportTitle.toUpperCase(), 14, currentY);

  currentY += 5.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Periode: ${payload.periodLabel}`, 14, currentY);

  if (payload.subtitle) {
    currentY += 4.5;
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(payload.subtitle, 14, currentY);
  }

  currentY += 3.5;
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.line(14, currentY, pageWidth - 14, currentY);
  currentY += 5;

  // Summary Block (if provided and not already a formal statement)
  if (payload.summaryItems && payload.summaryItems.length > 0) {
    const summaryBody = payload.summaryItems.map((s) => [
      s.label,
      s.value,
      s.sublabel || '-',
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['Ringkasan Metrik', 'Nominal', 'Keterangan']],
      body: summaryBody,
      theme: 'plain',
      styles: {
        fontSize: 8.5,
        cellPadding: 2,
        textColor: [15, 23, 42],
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [248, 250, 252],
        textColor: [71, 85, 105],
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 65 },
        1: { fontStyle: 'bold', halign: 'right', cellWidth: 45 },
        2: { textColor: [100, 116, 139] },
      },
      margin: { left: 14, right: 14 },
    });

    currentY = (doc as any).lastAutoTable.finalY + 6;
  }

  // Main Report Tables
  for (const tbl of payload.tables) {
    if (tbl.sectionTitle) {
      if (currentY > pageHeight - 30) {
        doc.addPage();
        currentY = 16;
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text(tbl.sectionTitle, 14, currentY);
      currentY += 2.5;
    }

    const colStyles: Record<number, any> = {};
    if (tbl.isAccountingStatement) {
      // Col 0 is Account Name (left), remaining cols are right-aligned numbers
      colStyles[0] = { halign: 'left' };
      for (let c = 1; c < tbl.headers.length; c++) {
        colStyles[c] = { halign: 'right' };
      }
    }

    autoTable(doc, {
      startY: currentY,
      head: [tbl.headers],
      body: tbl.rows.map((r) => r.map((c) => String(c ?? ''))),
      foot: tbl.footerRow
        ? [tbl.footerRow.map((c) => String(c ?? ''))]
        : undefined,
      theme: tbl.isAccountingStatement ? 'plain' : 'striped',
      styles: {
        fontSize: maxCols >= 8 ? 7.5 : 8.5,
        cellPadding: tbl.isAccountingStatement ? 2.2 : 2.2,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.15,
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      footStyles: {
        fillColor: [241, 245, 249],
        textColor: [15, 23, 42],
        fontStyle: 'bold',
        halign: tbl.isAccountingStatement ? 'right' : 'left',
      },
      columnStyles: colStyles,
      didParseCell: (hookData) => {
        if (tbl.isAccountingStatement && hookData.section === 'body') {
          const rawRow = hookData.row.raw as Array<string | number> | undefined;
          const label = String(rawRow?.[0] || '');
          const isSectionOrTotal =
            label === label.toUpperCase() && label.trim().length > 0;
          if (isSectionOrTotal) {
            hookData.cell.styles.fontStyle = 'bold';
            if (
              label.startsWith('TOTAL') ||
              label.startsWith('LABA')
            ) {
              hookData.cell.styles.fillColor = [248, 250, 252];
              hookData.cell.styles.textColor = [15, 23, 42];
            }
          }
        }
        if (
          tbl.isAccountingStatement &&
          hookData.section === 'foot' &&
          hookData.column.index === 0
        ) {
          hookData.cell.styles.halign = 'left';
        }
      },
      margin: { left: 14, right: 14, bottom: 20 },
    });

    currentY = (doc as any).lastAutoTable.finalY + 7;
  }

  // Formal Footer on every page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(14, pageHeight - 14, pageWidth - 14, pageHeight - 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Nama perusahaan: AYAM GEPREK ARY   |   Dicetak pada: ${printedAtStr}`,
      14,
      pageHeight - 9
    );
    doc.text(
      `Halaman ${i} dari ${pageCount}`,
      pageWidth - 14,
      pageHeight - 9,
      { align: 'right' }
    );
  }

  doc.save(`${payload.filename}.pdf`);
}
