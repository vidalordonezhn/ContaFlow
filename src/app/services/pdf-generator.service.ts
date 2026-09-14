import { Injectable, inject } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { ApiConfiguracionService, ConfiguracionDespacho } from './api-configuracion.service';
import { ClienteResponse, ExpedienteFiscal } from './api-clients.service';
import { LibroPartidaItem } from './api-libros-isv.service';
import { ReporteFinancieroResponse } from './api-reportes.service';

export interface LibroDetalleResumenPdf {
  cliente: ClienteResponse;
  mesNombre: string;
  mes: number;
  anio: number;
  items: LibroPartidaItem[];
  sumComprasExentas: number;
  sumComprasGravadas: number;
  sumIsvCompras: number;
  sumVentasExentas: number;
  sumVentasGravadas: number;
  sumIsvVentas: number;
  impuestoAPagar: number;
  saldoAFavor: number;
  serviciosProfesionales: number;
  totalLps: number;
}

@Injectable({
  providedIn: 'root'
})
export class PdfGeneratorService {
  private readonly configService = inject(ApiConfiguracionService);
  private despachoConfig: ConfiguracionDespacho | null = null;

  constructor() {
    this.configService.getConfiguracion().subscribe({
      next: (cfg) => {
        this.despachoConfig = cfg;
      },
      error: () => {}
    });
  }

  private formatLps(val: number | undefined | null): string {
    const num = Number(val) || 0;
    return 'L. ' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // =========================================================================
  // 1. HOJA DE TRABAJO OFICIAL DE COMPRAS Y VENTAS (LANDSCAPE VECTOR PDF)
  // =========================================================================
  generarLibroDetallePdf(data: LibroDetalleResumenPdf, autoDownload: boolean = true): jsPDF {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'letter'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const cfg = this.despachoConfig;

    // --- ENCABEZADO DEL DESPACHO ---
    doc.setFillColor(15, 23, 42); // Navy / Slate 900
    doc.rect(14, 10, pageWidth - 28, 1.5, 'F');

    // Logo o Titular
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text(cfg?.nombreDespacho || 'DESPACHO CONTABLE Y FISCAL', 14, 18);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`${cfg?.nombreContadorTitular || 'Contador Titular'} • ${cfg?.colegiacionCAH || 'CAH'} • RTN: ${cfg?.rtnDespacho || '08011980123456'}`, 14, 23);
    doc.text(`Tel: ${cfg?.telefono || '+504 2235-0000'} • Email: ${cfg?.email || 'contacto@despacho.hn'}`, 14, 27);

    // Título del Reporte
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(37, 99, 235); // Blue 600
    doc.text('HOJA DE TRABAJO OFICIAL - LIBRO DE COMPRAS Y VENTAS', pageWidth - 14, 18, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(`PERÍODO FISCAL: ${data.mesNombre.toUpperCase()} ${data.anio}`, pageWidth - 14, 24, { align: 'right' });

    // --- TARJETA DE INFORMACIÓN DEL CONTRIBUYENTE ---
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(14, 31, pageWidth - 28, 16, 2, 2, 'FD');

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('CONTRIBUYENTE:', 18, 37);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(data.cliente.nombreRazonSocial, 48, 37);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('RTN SAR:', 18, 43);
    doc.setFont('courier', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(data.cliente.rtn, 48, 43);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('PASSWORD SAR:', 150, 37);
    doc.setFont('courier', 'bold');
    doc.setTextColor(37, 99, 235);
    doc.text(data.cliente.contrasenaSAR || 'NO REGISTRADA', 185, 37);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('GIRO / RUBRO:', 150, 43);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(data.cliente.rubro || 'Comercio General', 185, 43);

    // --- TABLA DE PARTIDAS CON AUTOTABLE ---
    const tableHeaders: any[] = [
      [
        { content: 'DETALLE GENERAL', colSpan: 3, styles: { halign: 'center', fillColor: [241, 245, 249] as [number, number, number], textColor: [51, 65, 85] as [number, number, number] } },
        { content: 'COMPRAS', colSpan: 3, styles: { halign: 'center', fillColor: [236, 253, 245] as [number, number, number], textColor: [6, 95, 70] as [number, number, number] } },
        { content: 'VENTAS', colSpan: 4, styles: { halign: 'center', fillColor: [239, 246, 255] as [number, number, number], textColor: [30, 64, 175] as [number, number, number] } }
      ],
      [
        { content: '#', styles: { halign: 'center' } },
        { content: 'Fecha', styles: { halign: 'center' } },
        { content: 'Proveedor / Concepto', styles: { halign: 'left' } },
        { content: 'Compras Exentas', styles: { halign: 'right' } },
        { content: 'Compras Gravadas', styles: { halign: 'right' } },
        { content: 'Impto 15%', styles: { halign: 'right', textColor: [5, 150, 105] as [number, number, number] } },
        { content: 'Factura N°', styles: { halign: 'center' } },
        { content: 'Ventas Exentas', styles: { halign: 'right' } },
        { content: 'Ventas Gravadas', styles: { halign: 'right' } },
        { content: 'Impto 15%', styles: { halign: 'right', textColor: [37, 99, 235] as [number, number, number] } }
      ]
    ];

    const tableRows = data.items.map((it, idx) => [
      it.correlativo || (idx + 1),
      it.fecha || '—',
      it.proveedor || 'Sin descripción',
      it.comprasExentas ? this.formatLps(it.comprasExentas) : '0.00',
      it.comprasGravadas ? this.formatLps(it.comprasGravadas) : '0.00',
      it.isvCompras15 ? this.formatLps(it.isvCompras15) : '0.00',
      it.facturaNumero || '—',
      it.ventasExentas ? this.formatLps(it.ventasExentas) : '0.00',
      it.ventasGravadas ? this.formatLps(it.ventasGravadas) : '0.00',
      it.isvVentas15 ? this.formatLps(it.isvVentas15) : '0.00'
    ]);

    const tableFooters: any[] = [
      [
        { content: 'TOTALES:', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold', fillColor: [241, 245, 249] as [number, number, number] } },
        { content: this.formatLps(data.sumComprasExentas), styles: { halign: 'right', fontStyle: 'bold', fillColor: [241, 245, 249] as [number, number, number] } },
        { content: this.formatLps(data.sumComprasGravadas), styles: { halign: 'right', fontStyle: 'bold', fillColor: [241, 245, 249] as [number, number, number] } },
        { content: this.formatLps(data.sumIsvCompras), styles: { halign: 'right', fontStyle: 'bold', fillColor: [236, 253, 245] as [number, number, number], textColor: [5, 150, 105] as [number, number, number] } },
        { content: '', styles: { fillColor: [241, 245, 249] as [number, number, number] } },
        { content: this.formatLps(data.sumVentasExentas), styles: { halign: 'right', fontStyle: 'bold', fillColor: [241, 245, 249] as [number, number, number] } },
        { content: this.formatLps(data.sumVentasGravadas), styles: { halign: 'right', fontStyle: 'bold', fillColor: [241, 245, 249] as [number, number, number] } },
        { content: this.formatLps(data.sumIsvVentas), styles: { halign: 'right', fontStyle: 'bold', fillColor: [239, 246, 255] as [number, number, number], textColor: [37, 99, 235] as [number, number, number] } }
      ]
    ];

    autoTable(doc, {
      startY: 50,
      head: tableHeaders,
      body: tableRows,
      foot: tableFooters,
      theme: 'grid',
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
        lineColor: [203, 213, 225],
        lineWidth: 0.2
      },
      headStyles: {
        fillColor: [248, 250, 252],
        textColor: [15, 23, 42],
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 'auto', halign: 'left' },
        3: { cellWidth: 26, halign: 'right' },
        4: { cellWidth: 26, halign: 'right' },
        5: { cellWidth: 24, halign: 'right' },
        6: { cellWidth: 28, halign: 'center' },
        7: { cellWidth: 26, halign: 'right' },
        8: { cellWidth: 26, halign: 'right' },
        9: { cellWidth: 24, halign: 'right' }
      },
      margin: { left: 14, right: 14, bottom: 45 }
    });

    // Posición final de la tabla
    const finalY = (doc as any).lastAutoTable?.finalY || 130;
    
    // Si la tabla terminó muy abajo, añadir nueva página para el resumen
    let summaryY = finalY + 6;
    if (summaryY + 40 > pageHeight) {
      doc.addPage();
      summaryY = 15;
    }

    // --- CUADRO RESUMEN OFICIAL DE LIQUIDACIÓN ---
    const summaryWidth = 110;
    const summaryX = pageWidth - 14 - summaryWidth;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.4);
    doc.roundedRect(summaryX, summaryY, summaryWidth, 34, 1.5, 1.5, 'FD');

    // Filas del resumen
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text('Impuesto Compras (Crédito):', summaryX + 4, summaryY + 5.5);
    doc.setFont('courier', 'bold');
    doc.setTextColor(5, 150, 105);
    doc.text(this.formatLps(data.sumIsvCompras), summaryX + summaryWidth - 4, summaryY + 5.5, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text('Impuesto Ventas (Débito):', summaryX + 4, summaryY + 11.5);
    doc.setFont('courier', 'bold');
    doc.setTextColor(37, 99, 235);
    doc.text(this.formatLps(data.sumIsvVentas), summaryX + summaryWidth - 4, summaryY + 11.5, { align: 'right' });

    if (data.saldoAFavor > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(5, 150, 105);
      doc.text('Saldo a Favor Contribuyente:', summaryX + 4, summaryY + 17.5);
      doc.setFont('courier', 'bold');
      doc.text(this.formatLps(data.saldoAFavor), summaryX + summaryWidth - 4, summaryY + 17.5, { align: 'right' });
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(180, 83, 9);
      doc.text('Impuesto a Pagar Lps:', summaryX + 4, summaryY + 17.5);
      doc.setFont('courier', 'bold');
      doc.text(this.formatLps(data.impuestoAPagar), summaryX + summaryWidth - 4, summaryY + 17.5, { align: 'right' });
    }

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text('(+) Servicios Prof. (Honorarios):', summaryX + 4, summaryY + 23.5);
    doc.setFont('courier', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(this.formatLps(data.serviciosProfesionales), summaryX + summaryWidth - 4, summaryY + 23.5, { align: 'right' });

    // Franja TOTAL LPS
    doc.setFillColor(15, 23, 42);
    doc.rect(summaryX, summaryY + 26, summaryWidth, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text('TOTAL LPS:', summaryX + 4, summaryY + 31.5);
    doc.setFont('courier', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(56, 189, 248); // Sky blue
    doc.text(this.formatLps(data.totalLps), summaryX + summaryWidth - 4, summaryY + 31.5, { align: 'right' });

    // --- FIRMA DEL CONTADOR ---
    const sigX = 25;
    const sigY = summaryY + 24;
    doc.setDrawColor(100, 116, 139);
    doc.setLineWidth(0.3);
    doc.line(sigX, sigY, sigX + 65, sigY);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(cfg?.nombreContadorTitular || 'Firma Contador Titular', sigX + 32.5, sigY + 4, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(cfg?.colegiacionCAH || 'Colegiación Profesional', sigX + 32.5, sigY + 7.5, { align: 'center' });

    // --- PIE DE PÁGINA ---
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text(
        `ContaFlow • Hoja de Trabajo Generada el ${new Date().toLocaleDateString('es-HN')} a las ${new Date().toLocaleTimeString('es-HN')} • Página ${i} de ${totalPages}`,
        pageWidth / 2,
        pageHeight - 6,
        { align: 'center' }
      );
    }

    if (autoDownload) {
      const filename = `Libro_Compras_Ventas_${data.cliente.rtn}_${data.mesNombre}_${data.anio}.pdf`;
      doc.save(filename);
    }

    return doc;
  }

  // =========================================================================
  // 2. EXPORTAR A EXCEL (.XLSX) PROFESIONAL
  // =========================================================================
  exportarLibroDetalleExcel(data: LibroDetalleResumenPdf): void {
    const wsData: any[][] = [
      [this.despachoConfig?.nombreDespacho || 'DESPACHO CONTABLE Y FISCAL'],
      ['HOJA DE TRABAJO OFICIAL - LIBRO DE COMPRAS Y VENTAS'],
      [`Contribuyente: ${data.cliente.nombreRazonSocial}`, '', `RTN: ${data.cliente.rtn}`, '', `Período: ${data.mesNombre} ${data.anio}`],
      [`Password SAR: ${data.cliente.contrasenaSAR || 'N/A'}`, '', `Giro: ${data.cliente.rubro || 'Comercio'}`],
      [], // Fila en blanco
      [
        '#',
        'Fecha',
        'Proveedor / Concepto',
        'Compras Exentas (Lps)',
        'Compras Gravadas (Lps)',
        'ISV 15% Compras (Lps)',
        'Factura N°',
        'Ventas Exentas (Lps)',
        'Ventas Gravadas (Lps)',
        'ISV 15% Ventas (Lps)'
      ]
    ];

    data.items.forEach((it, idx) => {
      wsData.push([
        it.correlativo || (idx + 1),
        it.fecha || '',
        it.proveedor || '',
        Number(it.comprasExentas) || 0,
        Number(it.comprasGravadas) || 0,
        Number(it.isvCompras15) || 0,
        it.facturaNumero || '',
        Number(it.ventasExentas) || 0,
        Number(it.ventasGravadas) || 0,
        Number(it.isvVentas15) || 0
      ]);
    });

    // Fila Totales
    wsData.push([
      'TOTALES',
      '',
      '',
      data.sumComprasExentas,
      data.sumComprasGravadas,
      data.sumIsvCompras,
      '',
      data.sumVentasExentas,
      data.sumVentasGravadas,
      data.sumIsvVentas
    ]);

    // Resumen Final
    wsData.push([]);
    wsData.push(['', '', '', '', '', '', 'RESUMEN OFICIAL DE LIQUIDACIÓN', 'MONTO (LPS)']);
    wsData.push(['', '', '', '', '', '', 'Impuesto Compras (Crédito):', data.sumIsvCompras]);
    wsData.push(['', '', '', '', '', '', 'Impuesto Ventas (Débito):', data.sumIsvVentas]);
    if (data.saldoAFavor > 0) {
      wsData.push(['', '', '', '', '', '', 'Saldo a Favor Contribuyente:', data.saldoAFavor]);
    } else {
      wsData.push(['', '', '', '', '', '', 'Impuesto a Pagar Lps:', data.impuestoAPagar]);
    }
    wsData.push(['', '', '', '', '', '', '(+) Servicios Profesionales (Honorarios):', data.serviciosProfesionales]);
    wsData.push(['', '', '', '', '', '', 'TOTAL LPS A LIQUIDAR:', data.totalLps]);

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Ajuste de anchos de columna
    ws['!cols'] = [
      { wch: 6 },
      { wch: 12 },
      { wch: 30 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `ISV_${data.mesNombre}_${data.anio}`);
    XLSX.writeFile(wb, `Libro_Compras_Ventas_${data.cliente.rtn}_${data.mesNombre}_${data.anio}.xlsx`);
  }

  // =========================================================================
  // 3. REPORTE FINANCIERO Y ESTADÍSTICAS DEL DESPACHO PDF
  // =========================================================================
  generarReporteFinancieroPdf(rep: ReporteFinancieroResponse): jsPDF {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const cfg = this.despachoConfig;

    // Encabezado
    doc.setFillColor(15, 23, 42);
    doc.rect(14, 12, pageWidth - 28, 1.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text(cfg?.nombreDespacho || 'DESPACHO CONTABLE Y FISCAL', 14, 20);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Informe Financiero y Control de Cartera • Titular: ${cfg?.nombreContadorTitular || 'Contador'}`, 14, 25);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(37, 99, 235);
    doc.text(`REPORTE EJECUTIVO AL ${new Date().toLocaleDateString('es-HN')}`, pageWidth - 14, 20, { align: 'right' });

    // Tarjetas de Métricas (KPIs)
    const kpis = [
      { label: 'Cartera Facturable Mensual', val: this.formatLps(rep.totalFacturableMensual), color: [37, 99, 235] },
      { label: 'Recaudado este Mes', val: this.formatLps(rep.recaudadoMesActual), color: [5, 150, 105] },
      { label: 'Pendiente de Cobro', val: this.formatLps(rep.pendienteCobroMesActual), color: [220, 38, 38] },
      { label: 'Total Clientes Activos', val: `${rep.totalClientesActivos} Clientes`, color: [15, 23, 42] }
    ];

    let kpiX = 14;
    const kpiWidth = (pageWidth - 28 - 9) / 4;
    kpis.forEach((kpi) => {
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(kpiX, 32, kpiWidth, 20, 2, 2, 'FD');

      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text(kpi.label, kpiX + 3, 38, { maxWidth: kpiWidth - 6 });

      doc.setFontSize(9);
      doc.setFont('courier', 'bold');
      doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
      doc.text(kpi.val, kpiX + 3, 47);

      kpiX += kpiWidth + 3;
    });

    // Tabla de Histórico de Ingresos
    const rows = (rep.historicoIngresos || []).map(h => [
      h.mesNombre,
      h.cantidadPagos || 0,
      this.formatLps(h.montoTotal)
    ]);

    autoTable(doc, {
      startY: 58,
      head: [['Mes / Período', 'Cantidad de Pagos Recibidos', 'Total Recaudado (Lps)']],
      body: rows,
      theme: 'striped',
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 8.5, cellPadding: 3 },
      columnStyles: {
        0: { fontStyle: 'bold' },
        1: { halign: 'center' },
        2: { halign: 'right', fontStyle: 'bold', textColor: [5, 150, 105] }
      },
      margin: { left: 14, right: 14 }
    });

    const filename = `Reporte_Financiero_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
    return doc;
  }

  // =========================================================================
  // 4. EXPEDIENTE FISCAL COMPLETO DEL CONTRIBUYENTE PDF
  // =========================================================================
  generarExpedienteFiscalPdf(exp: ExpedienteFiscal): jsPDF {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const cfg = this.despachoConfig;

    // Encabezado
    doc.setFillColor(15, 23, 42);
    doc.rect(14, 12, pageWidth - 28, 1.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text(cfg?.nombreDespacho || 'DESPACHO CONTABLE Y FISCAL', 14, 20);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(37, 99, 235);
    doc.text('EXPEDIENTE FISCAL INTEGRAL DEL CONTRIBUYENTE', pageWidth - 14, 20, { align: 'right' });

    // Ficha del Cliente
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(14, 27, pageWidth - 28, 24, 2, 2, 'FD');

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('Razón Social:', 18, 33);
    doc.setTextColor(15, 23, 42);
    doc.text(exp.cliente.nombreRazonSocial, 42, 33);

    doc.setTextColor(71, 85, 105);
    doc.text('RTN Fiscal:', 18, 39);
    doc.setFont('courier', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(exp.cliente.rtn, 42, 39);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('Password SAR:', 120, 33);
    doc.setFont('courier', 'bold');
    doc.setTextColor(37, 99, 235);
    doc.text(exp.cliente.contrasenaSAR || 'NO REGISTRADA', 150, 33);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('Giro / Rubro:', 120, 39);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(exp.cliente.rubro || 'Comercio', 150, 39);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('Cuota Mensual:', 18, 45);
    doc.setFont('courier', 'bold');
    doc.setTextColor(5, 150, 105);
    doc.text(this.formatLps(exp.cliente.cuotaMensual), 42, 45);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('Teléfono / WA:', 120, 45);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(exp.cliente.telefonoWhatsApp || exp.cliente.telefono || '—', 150, 45);

    // Tabla de Declaraciones Mensuales ISV
    const isvRows = (exp.declaracionesMensualesISV || []).map(p => [
      `${p.mesNombre} ${p.anio}`,
      p.liquidadoSAR ? 'Liquidada / Presentada' : 'Pendiente',
      this.formatLps(p.montoImpuestoISV || 0),
      p.numeroDeclaracionSAR || '—'
    ]);

    autoTable(doc, {
      startY: 55,
      head: [['Período Mensual ISV', 'Estado', 'Monto ISV Calculado', 'N° Declaración SAR']],
      body: isvRows,
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 7.5, cellPadding: 2.5 },
      columnStyles: {
        0: { fontStyle: 'bold' },
        1: { halign: 'center' },
        2: { halign: 'right', fontStyle: 'bold', textColor: [180, 83, 9] },
        3: { halign: 'center', fontStyle: 'bold' }
      },
      margin: { left: 14, right: 14 }
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 120;

    // Tabla de Declaraciones Anuales
    if (exp.declaracionesAnuales && exp.declaracionesAnuales.length > 0) {
      const anualRows = exp.declaracionesAnuales.map(a => [
        a.anio,
        a.titulo,
        a.formularioSAR,
        a.estado,
        this.formatLps(a.montoDeclarado),
        a.numeroDeclaracionSAR || '—'
      ]);

      autoTable(doc, {
        startY: finalY + 8,
        head: [['Año', 'Obligación / Declaración Anual', 'Formulario', 'Estado', 'Monto Declarado', 'N° Presentación']],
        body: anualRows,
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 7.5, cellPadding: 2.5 },
        columnStyles: {
          0: { fontStyle: 'bold', halign: 'center' },
          1: { fontStyle: 'bold' },
          2: { halign: 'center' },
          3: { halign: 'center' },
          4: { halign: 'right', fontStyle: 'bold' },
          5: { halign: 'center' }
        },
        margin: { left: 14, right: 14 }
      });
    }

    const filename = `Expediente_Fiscal_${exp.cliente.rtn}.pdf`;
    doc.save(filename);
    return doc;
  }
}
