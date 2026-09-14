import { Injectable, inject } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { ApiConfiguracionService, ConfiguracionDespacho } from './api-configuracion.service';
import { ClienteResponse, ExpedienteFiscal } from './api-clients.service';
import { LibroPartidaItem, LibroVentaItem, LibroCompraItem, ResumenVentasCasillas, ResumenComprasCasillas, LiquidacionConsolidada } from './api-libros-isv.service';
import { ReporteFinancieroResponse } from './api-reportes.service';

export interface LibroCompletoExportData {
  cliente: {
    nombreRazonSocial: string;
    rtn: string;
    contrasenaSAR?: string;
    rubro?: string;
    cuotaMensual?: number;
  };
  mesNombre: string;
  mes: number;
  anio: number;
  ventas: LibroVentaItem[];
  compras: LibroCompraItem[];
  resumenVentas: ResumenVentasCasillas;
  resumenCompras: ResumenComprasCasillas;
  liquidacion: LiquidacionConsolidada;
}

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

export interface ReciboPdfItem {
  producto: string;
  descripcion: string;
  cantidad: number;
  precio: number;
  total: number;
}

export interface ReciboPdfData {
  tipoComprobante: 'SinCAI' | 'ConCAI';
  numeroRecibo: string;
  numeroFiscal?: string;
  cai?: string;
  rangoAutorizado?: string;
  fechaLimiteEmision?: string;
  fechaEmision: string;
  clienteNombre: string;
  clienteRtn: string;
  items: ReciboPdfItem[];
  subtotal: number;
  impuesto: number;
  total: number;
  montoEnLetras?: string;
  observaciones?: string;
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

  // =========================================================================
  // 5. LIBRO DUAL OFICIAL COMPLETO (VENTAS, COMPRAS Y RESUMEN SAR - EJEMPLO.XLSX)
  // =========================================================================
  generarLibroDualPdf(data: LibroCompletoExportData, autoDownload: boolean = true): jsPDF {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'letter'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const cfg = this.despachoConfig;

    // --- ENCABEZADO DEL DESPACHO ---
    doc.setFillColor(15, 23, 42);
    doc.rect(14, 8, pageWidth - 28, 1.2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text(cfg?.nombreDespacho || 'DESPACHO CONTABLE Y FISCAL', 14, 15);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`${cfg?.nombreContadorTitular || 'Contador Titular'} • ${cfg?.colegiacionCAH || 'CAH'} • RTN: ${cfg?.rtnDespacho || '08011980123456'}`, 14, 19.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(37, 99, 235);
    doc.text('LIBROS OFICIALES DE VENTAS, COMPRAS Y LIQUIDACIÓN ISV', pageWidth - 14, 15, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`PERÍODO FISCAL: ${data.mesNombre.toUpperCase()} ${data.anio}`, pageWidth - 14, 20, { align: 'right' });

    // --- FICHA DEL CONTRIBUYENTE ---
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(14, 23, pageWidth - 28, 13, 1.5, 1.5, 'FD');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('CONTRIBUYENTE:', 17, 28);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(data.cliente.nombreRazonSocial, 44, 28);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('RTN SAR:', 17, 33);
    doc.setFont('courier', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(data.cliente.rtn, 44, 33);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('PASSWORD SAR:', 150, 28);
    doc.setFont('courier', 'bold');
    doc.setTextColor(37, 99, 235);
    doc.text(data.cliente.contrasenaSAR || 'NO REGISTRADA', 182, 28);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('GIRO / RUBRO:', 150, 33);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(data.cliente.rubro || 'Comercio General', 182, 33);

    // --- 1. TABLA LIBRO DE VENTAS ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 64, 175);
    doc.text('1. LIBRO DE VENTAS DETALLADO (DÉBITO FISCAL)', 14, 40);

    const ventasHeaders: any[] = [
      [
        { content: '#', styles: { halign: 'center' } },
        { content: 'Fecha', styles: { halign: 'center' } },
        { content: 'Factura N°', styles: { halign: 'center' } },
        { content: 'Exonerado', styles: { halign: 'right' } },
        { content: 'Exento', styles: { halign: 'right' } },
        { content: 'Gravado 15%', styles: { halign: 'right' } },
        { content: 'Gravado 18%', styles: { halign: 'right' } },
        { content: 'ISV 15%', styles: { halign: 'right', textColor: [37, 99, 235] as [number, number, number] } },
        { content: 'ISV 18%', styles: { halign: 'right', textColor: [37, 99, 235] as [number, number, number] } },
        { content: 'Total Fila', styles: { halign: 'right', fontStyle: 'bold' } }
      ]
    ];

    const ventasRows = data.ventas.map((v, idx) => [
      v.correlativo || (idx + 1),
      v.fecha || '—',
      v.factura || '—',
      v.exonerado ? this.formatLps(v.exonerado) : '0.00',
      v.exento ? this.formatLps(v.exento) : '0.00',
      v.gravado15 ? this.formatLps(v.gravado15) : '0.00',
      v.gravado18 ? this.formatLps(v.gravado18) : '0.00',
      v.isv15 ? this.formatLps(v.isv15) : '0.00',
      v.isv18 ? this.formatLps(v.isv18) : '0.00',
      this.formatLps(v.total)
    ]);

    const rv = data.resumenVentas;
    const ventasFooters: any[] = [
      [
        { content: 'TOTALES VENTAS:', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold', fillColor: [239, 246, 255] as [number, number, number] } },
        { content: this.formatLps(rv.totalExonerado), styles: { halign: 'right', fontStyle: 'bold', fillColor: [239, 246, 255] as [number, number, number] } },
        { content: this.formatLps(rv.totalExento), styles: { halign: 'right', fontStyle: 'bold', fillColor: [239, 246, 255] as [number, number, number] } },
        { content: this.formatLps(rv.totalGravado15), styles: { halign: 'right', fontStyle: 'bold', fillColor: [239, 246, 255] as [number, number, number] } },
        { content: this.formatLps(rv.totalGravado18), styles: { halign: 'right', fontStyle: 'bold', fillColor: [239, 246, 255] as [number, number, number] } },
        { content: this.formatLps(rv.totalIsv15), styles: { halign: 'right', fontStyle: 'bold', fillColor: [219, 234, 254] as [number, number, number], textColor: [30, 64, 175] as [number, number, number] } },
        { content: this.formatLps(rv.totalIsv18), styles: { halign: 'right', fontStyle: 'bold', fillColor: [219, 234, 254] as [number, number, number], textColor: [30, 64, 175] as [number, number, number] } },
        { content: this.formatLps(rv.totalGeneral), styles: { halign: 'right', fontStyle: 'bold', fillColor: [239, 246, 255] as [number, number, number] } }
      ]
    ];

    autoTable(doc, {
      startY: 43,
      head: ventasHeaders,
      body: ventasRows.length > 0 ? ventasRows : [['—', 'Sin registros de venta', '', '0.00', '0.00', '0.00', '0.00', '0.00', '0.00', '0.00']],
      foot: ventasFooters,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 1.5, lineColor: [203, 213, 225], lineWidth: 0.15 },
      headStyles: { fillColor: [239, 246, 255], textColor: [30, 64, 175], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 26, halign: 'center' },
        3: { cellWidth: 24, halign: 'right' },
        4: { cellWidth: 24, halign: 'right' },
        5: { cellWidth: 26, halign: 'right' },
        6: { cellWidth: 26, halign: 'right' },
        7: { cellWidth: 24, halign: 'right' },
        8: { cellWidth: 24, halign: 'right' },
        9: { cellWidth: 28, halign: 'right' }
      },
      margin: { left: 14, right: 14 }
    });

    let currentY = (doc as any).lastAutoTable?.finalY || 80;

    // --- 2. TABLA LIBRO DE COMPRAS ---
    if (currentY + 35 > pageHeight) {
      doc.addPage();
      currentY = 15;
    } else {
      currentY += 5;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(6, 95, 70);
    doc.text('2. LIBRO DE COMPRAS DETALLADO (CRÉDITO FISCAL)', 14, currentY);

    const comprasHeaders: any[] = [
      [
        { content: '#', styles: { halign: 'center' } },
        { content: 'Fecha', styles: { halign: 'center' } },
        { content: 'Factura N°', styles: { halign: 'center' } },
        { content: 'Proveedor', styles: { halign: 'left' } },
        { content: 'Exonerado', styles: { halign: 'right' } },
        { content: 'Exento', styles: { halign: 'right' } },
        { content: 'Gravado 15%', styles: { halign: 'right' } },
        { content: 'Gravado 18%', styles: { halign: 'right' } },
        { content: 'ISV 15%', styles: { halign: 'right', textColor: [5, 150, 105] as [number, number, number] } },
        { content: 'ISV 18%', styles: { halign: 'right', textColor: [5, 150, 105] as [number, number, number] } },
        { content: 'Total Fila', styles: { halign: 'right', fontStyle: 'bold' } }
      ]
    ];

    const comprasRows = data.compras.map((c, idx) => [
      c.correlativo || (idx + 1),
      c.fecha || '—',
      c.factura || '—',
      c.proveedor || 'Sin proveedor',
      c.exonerado ? this.formatLps(c.exonerado) : '0.00',
      c.exento ? this.formatLps(c.exento) : '0.00',
      c.gravado15 ? this.formatLps(c.gravado15) : '0.00',
      c.gravado18 ? this.formatLps(c.gravado18) : '0.00',
      c.isv15 ? this.formatLps(c.isv15) : '0.00',
      c.isv18 ? this.formatLps(c.isv18) : '0.00',
      this.formatLps(c.total)
    ]);

    const rc = data.resumenCompras;
    const comprasFooters: any[] = [
      [
        { content: 'TOTALES COMPRAS:', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold', fillColor: [236, 253, 245] as [number, number, number] } },
        { content: this.formatLps(rc.totalExonerado), styles: { halign: 'right', fontStyle: 'bold', fillColor: [236, 253, 245] as [number, number, number] } },
        { content: this.formatLps(rc.totalExento), styles: { halign: 'right', fontStyle: 'bold', fillColor: [236, 253, 245] as [number, number, number] } },
        { content: this.formatLps(rc.totalGravado15), styles: { halign: 'right', fontStyle: 'bold', fillColor: [236, 253, 245] as [number, number, number] } },
        { content: this.formatLps(rc.totalGravado18), styles: { halign: 'right', fontStyle: 'bold', fillColor: [236, 253, 245] as [number, number, number] } },
        { content: this.formatLps(rc.totalIsv15), styles: { halign: 'right', fontStyle: 'bold', fillColor: [209, 250, 229] as [number, number, number], textColor: [6, 95, 70] as [number, number, number] } },
        { content: this.formatLps(rc.totalIsv18), styles: { halign: 'right', fontStyle: 'bold', fillColor: [209, 250, 229] as [number, number, number], textColor: [6, 95, 70] as [number, number, number] } },
        { content: this.formatLps(rc.totalGeneral), styles: { halign: 'right', fontStyle: 'bold', fillColor: [236, 253, 245] as [number, number, number] } }
      ]
    ];

    autoTable(doc, {
      startY: currentY + 3,
      head: comprasHeaders,
      body: comprasRows.length > 0 ? comprasRows : [['—', 'Sin registros de compra', '', '', '0.00', '0.00', '0.00', '0.00', '0.00', '0.00', '0.00']],
      foot: comprasFooters,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 1.5, lineColor: [203, 213, 225], lineWidth: 0.15 },
      headStyles: { fillColor: [236, 253, 245], textColor: [6, 95, 70], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 18, halign: 'center' },
        2: { cellWidth: 22, halign: 'center' },
        3: { cellWidth: 'auto', halign: 'left' },
        4: { cellWidth: 22, halign: 'right' },
        5: { cellWidth: 22, halign: 'right' },
        6: { cellWidth: 24, halign: 'right' },
        7: { cellWidth: 24, halign: 'right' },
        8: { cellWidth: 22, halign: 'right' },
        9: { cellWidth: 22, halign: 'right' },
        10: { cellWidth: 26, halign: 'right' }
      },
      margin: { left: 14, right: 14 }
    });

    currentY = (doc as any).lastAutoTable?.finalY || 130;

    // --- 3. CUADRO OFICIAL DE LIQUIDACIÓN SAR ---
    if (currentY + 45 > pageHeight) {
      doc.addPage();
      currentY = 15;
    } else {
      currentY += 6;
    }

    const liqWidth = 118;
    const liqX = pageWidth - 14 - liqWidth;
    const liq = data.liquidacion;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.35);
    doc.roundedRect(liqX, currentY, liqWidth, 38, 1.5, 1.5, 'FD');

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text('Débito Fiscal Ventas (ISV 15% + 18%):', liqX + 3, currentY + 5);
    doc.setFont('courier', 'bold');
    doc.setTextColor(30, 64, 175);
    doc.text(this.formatLps(liq.debitoFiscalVentas), liqX + liqWidth - 3, currentY + 5, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text('(-) Crédito Fiscal Compras (ISV 15% + 18%):', liqX + 3, currentY + 10);
    doc.setFont('courier', 'bold');
    doc.setTextColor(6, 95, 70);
    doc.text(this.formatLps(liq.creditoFiscalCompras), liqX + liqWidth - 3, currentY + 10, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text('(-) Saldo Anterior a Favor:', liqX + 3, currentY + 15);
    doc.setFont('courier', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(this.formatLps(liq.saldoAFavorPeriodoAnterior), liqX + liqWidth - 3, currentY + 15, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text('(-) Retenciones ISV (15% + 18%):', liqX + 3, currentY + 20);
    doc.setFont('courier', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(this.formatLps(liq.totalRetenciones), liqX + liqWidth - 3, currentY + 20, { align: 'right' });

    if (liq.saldoAFavorContribuyente > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(5, 150, 105);
      doc.text('(=) Saldo a Favor Contribuyente SAR:', liqX + 3, currentY + 25);
      doc.setFont('courier', 'bold');
      doc.text(this.formatLps(liq.saldoAFavorContribuyente), liqX + liqWidth - 3, currentY + 25, { align: 'right' });
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(180, 83, 9);
      doc.text('(=) Liquidación Final a Pagar SAR:', liqX + 3, currentY + 25);
      doc.setFont('courier', 'bold');
      doc.text(this.formatLps(liq.liquidacionFinalPagar), liqX + liqWidth - 3, currentY + 25, { align: 'right' });
    }

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text('(+) Honorarios Profesionales Contables:', liqX + 3, currentY + 30);
    doc.setFont('courier', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(this.formatLps(liq.serviciosProfesionales), liqX + liqWidth - 3, currentY + 30, { align: 'right' });

    // Franja TOTAL LPS
    doc.setFillColor(15, 23, 42);
    doc.rect(liqX, currentY + 32.5, liqWidth, 5.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text('TOTAL LPS:', liqX + 3, currentY + 36.5);
    doc.setFont('courier', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(56, 189, 248);
    doc.text(this.formatLps(liq.totalPagarLps), liqX + liqWidth - 3, currentY + 36.5, { align: 'right' });

    // Firma Contador
    const sigX = 25;
    const sigY = currentY + 26;
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

    // Numeración de páginas
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text(
        `ContaFlow • Libro Dual ISV Generado el ${new Date().toLocaleDateString('es-HN')} • Página ${i} de ${totalPages}`,
        pageWidth / 2,
        pageHeight - 5,
        { align: 'center' }
      );
    }

    if (autoDownload) {
      const filename = `Libro_Ventas_Compras_${data.cliente.rtn}_${data.mesNombre}_${data.anio}.pdf`;
      doc.save(filename);
    }

    return doc;
  }

  exportarLibroDualExcel(data: LibroCompletoExportData): void {
    const wsData: any[][] = [
      [this.despachoConfig?.nombreDespacho || 'DESPACHO CONTABLE Y FISCAL'],
      ['LIBRO OFICIAL DE VENTAS, COMPRAS Y LIQUIDACIÓN ISV'],
      [`Contribuyente: ${data.cliente.nombreRazonSocial}`, '', `RTN: ${data.cliente.rtn}`, '', `Período: ${data.mesNombre} ${data.anio}`],
      [`Password SAR: ${data.cliente.contrasenaSAR || 'N/A'}`, '', `Giro: ${data.cliente.rubro || 'Comercio'}`],
      [],
      ['--- LIBRO DE VENTAS ---'],
      ['#', 'Fecha', 'Factura', 'Exonerado', 'Exento', 'Gravado 15%', 'Gravado 18%', 'ISV 15%', 'ISV 18%', 'Total']
    ];

    data.ventas.forEach((v, idx) => {
      wsData.push([
        v.correlativo || (idx + 1),
        v.fecha || '',
        v.factura || '',
        Number(v.exonerado) || 0,
        Number(v.exento) || 0,
        Number(v.gravado15) || 0,
        Number(v.gravado18) || 0,
        Number(v.isv15) || 0,
        Number(v.isv18) || 0,
        Number(v.total) || 0
      ]);
    });

    const rv = data.resumenVentas;
    wsData.push([
      'TOTALES VENTAS',
      '',
      '',
      rv.totalExonerado,
      rv.totalExento,
      rv.totalGravado15,
      rv.totalGravado18,
      rv.totalIsv15,
      rv.totalIsv18,
      rv.totalGeneral
    ]);

    wsData.push([]);
    wsData.push(['--- LIBRO DE COMPRAS ---']);
    wsData.push(['#', 'Fecha', 'Factura', 'Proveedor', 'Exonerado', 'Exento', 'Gravado 15%', 'Gravado 18%', 'ISV 15%', 'ISV 18%', 'Total']);

    data.compras.forEach((c, idx) => {
      wsData.push([
        c.correlativo || (idx + 1),
        c.fecha || '',
        c.factura || '',
        c.proveedor || '',
        Number(c.exonerado) || 0,
        Number(c.exento) || 0,
        Number(c.gravado15) || 0,
        Number(c.gravado18) || 0,
        Number(c.isv15) || 0,
        Number(c.isv18) || 0,
        Number(c.total) || 0
      ]);
    });

    const rc = data.resumenCompras;
    wsData.push([
      'TOTALES COMPRAS',
      '',
      '',
      '',
      rc.totalExonerado,
      rc.totalExento,
      rc.totalGravado15,
      rc.totalGravado18,
      rc.totalIsv15,
      rc.totalIsv18,
      rc.totalGeneral
    ]);

    const liq = data.liquidacion;
    wsData.push([]);
    wsData.push(['', '', '', '', 'RESUMEN OFICIAL DE LIQUIDACIÓN SAR', 'MONTO (LPS)']);
    wsData.push(['', '', '', '', 'Débito Fiscal Ventas (ISV 15% + 18%):', liq.debitoFiscalVentas]);
    wsData.push(['', '', '', '', '(-) Crédito Fiscal Compras (ISV 15% + 18%):', liq.creditoFiscalCompras]);
    wsData.push(['', '', '', '', '(-) Saldo Anterior a Favor:', liq.saldoAFavorPeriodoAnterior]);
    wsData.push(['', '', '', '', '(-) Retenciones ISV (15% + 18%):', liq.totalRetenciones]);
    if (liq.saldoAFavorContribuyente > 0) {
      wsData.push(['', '', '', '', '(=) Saldo a Favor Contribuyente:', liq.saldoAFavorContribuyente]);
    } else {
      wsData.push(['', '', '', '', '(=) Liquidación Final a Pagar SAR:', liq.liquidacionFinalPagar]);
    }
    wsData.push(['', '', '', '', '(+) Honorarios Profesionales:', liq.serviciosProfesionales]);
    wsData.push(['', '', '', '', 'TOTAL LPS A LIQUIDAR:', liq.totalPagarLps]);

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [
      { wch: 6 },
      { wch: 12 },
      { wch: 18 },
      { wch: 28 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 18 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `ISV_${data.mesNombre}_${data.anio}`);
    XLSX.writeFile(wb, `Libro_Ventas_Compras_${data.cliente.rtn}_${data.mesNombre}_${data.anio}.xlsx`);
  }

  // =========================================================================
  // 6. GENERADOR DE RECIBOS Y FACTURAS (DUAL: INFORMAL IMAGE 3 Y FORMAL SAR)
  // =========================================================================
  generarReciboPdf(data: ReciboPdfData, autoDownload: boolean = true): jsPDF {
    if (data.tipoComprobante === 'ConCAI') {
      return this.generarReciboFiscalPdf(data, autoDownload);
    } else {
      return this.generarReciboInformalPdf(data, autoDownload);
    }
  }

  // --- 6A. DISEÑO INFORMAL (IMAGE 3 - LÍDERES CONTABLES ORDOÑEZ Y ASOCIADOS) ---
  generarReciboInformalPdf(data: ReciboPdfData, autoDownload: boolean = true): jsPDF {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const cfg = this.despachoConfig;

    const nombreDespacho = cfg?.nombreDespacho || 'LIDERES CONTABLES ORDOÑEZ Y ASOCIADOS';
    const titular = cfg?.nombreContadorTitular || 'JOSE VIDAL ORDOÑEZ GALO';
    const rtn = cfg?.rtnDespacho || '06011969003369';
    const direccion = cfg?.direccion || 'BARRIO LA LIBERTAD ANTIGUAS OFICINAS EEH, 3 CDR AL OESTE';
    const email = cfg?.email || 'JOSEVIDAL.ORDONEZGALO@GMAIL.COM';
    const tel = cfg?.telefono || '9279-5295';

    // 1. ENCABEZADO SUPERIOR
    // Logo circular amarillo/dorado
    doc.setFillColor(254, 240, 138); // Yellow 200
    doc.setDrawColor(234, 179, 8); // Yellow 500
    doc.setLineWidth(0.8);
    doc.circle(22, 20, 8, 'FD');

    // Emoji/Icono en el centro del logo
    doc.setFontSize(11);
    doc.text('🦅', 19.5, 23.5);

    // Nombre del Despacho y Datos de Cabecera
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42); // Slate 900
    doc.text(nombreDespacho.toUpperCase(), 34, 18);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(71, 85, 105); // Slate 600
    const subheaderText = `PROP. ${titular.toUpperCase()} | RTN: ${rtn} | ${direccion.toUpperCase()} | EMAIL: ${email.toUpperCase()} | TEL. ${tel}`;
    doc.text(subheaderText, 34, 23, { maxWidth: pageWidth - 48 });

    // 2. BARRA AMARILLA DE DATOS DEL CLIENTE (#FEF9C3)
    const cardY = 30;
    const cardHeight = 14;
    doc.setFillColor(254, 249, 195); // Yellow 100
    doc.setDrawColor(250, 204, 21); // Yellow 400
    doc.setLineWidth(0.5);
    doc.roundedRect(14, cardY, pageWidth - 28, cardHeight, 1.5, 1.5, 'FD');

    // Cuadrantes dentro de la barra
    // RTN
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(113, 63, 18); // Amber 900
    doc.text('RTN:', 18, cardY + 5);
    doc.setFont('courier', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(data.clienteRtn || 'N/A', 18, cardY + 10.5);

    // CLIENTE
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(113, 63, 18);
    doc.text('CLIENTE:', 64, cardY + 5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(data.clienteNombre || 'Cliente General', 64, cardY + 10.5, { maxWidth: 62 });

    // # FACTURA / RECIBO
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(113, 63, 18);
    doc.text('# FACTURA / RECIBO:', 130, cardY + 5);
    doc.setFont('courier', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(180, 83, 9); // Amber 700
    doc.text(data.numeroRecibo, 130, cardY + 10.5);

    // FECHA EMISIÓN
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(113, 63, 18);
    doc.text('FECHA EMISIÓN:', 172, cardY + 5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(data.fechaEmision, 172, cardY + 10.5);

    // 3. TABLA DE ITEMS CON COLUMNAS EXACTAS: PRODUCTO | DESCRIPCIÓN | CANTIDAD | PRECIO | TOTAL
    const headers = [
      [
        { content: 'PRODUCTO', styles: { halign: 'left' } },
        { content: 'DESCRIPCIÓN', styles: { halign: 'left' } },
        { content: 'CANTIDAD', styles: { halign: 'center' } },
        { content: 'PRECIO', styles: { halign: 'right' } },
        { content: 'TOTAL', styles: { halign: 'right' } }
      ]
    ];

    const rows = data.items.map(it => [
      it.producto || 'Servicio Profesional',
      it.descripcion || 'Honorarios Contables',
      it.cantidad ? it.cantidad.toString() : '1',
      this.formatLps(it.precio),
      this.formatLps(it.total)
    ]);

    autoTable(doc, {
      startY: 48,
      head: headers as any,
      body: rows,
      theme: 'grid',
      headStyles: {
        fillColor: [15, 23, 42], // Slate 900
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        cellPadding: 3
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [30, 41, 59],
        cellPadding: 3,
        lineColor: [226, 232, 240],
        lineWidth: 0.2
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      columnStyles: {
        0: { cellWidth: 42, fontStyle: 'bold' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 28, halign: 'right' },
        4: { cellWidth: 32, halign: 'right', fontStyle: 'bold', textColor: [15, 23, 42] }
      },
      margin: { left: 14, right: 14 }
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 100;
    const bottomY = finalY + 8;

    // 4. SECCIÓN INFERIOR: CITA TRIBUTARIA AMARILLA (IZQUIERDA) Y TOTALES (DERECHA)
    const quoteWidth = 106;
    const totalsWidth = 72;
    const totalsX = pageWidth - 14 - totalsWidth;

    // Cita Tributaria Amarilla
    doc.setFillColor(254, 249, 195); // Yellow 100
    doc.setDrawColor(250, 204, 21); // Yellow 400
    doc.setLineWidth(0.4);
    doc.roundedRect(14, bottomY, quoteWidth, 30, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(202, 138, 4); // Yellow 600
    doc.text('“', 17, bottomY + 7);

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.8);
    doc.setTextColor(113, 63, 18); // Amber 900
    const quoteText = 'La tributación no es solo una obligación, es una herramienta clave para el desarrollo de un país y la sostenibilidad de las empresas; conocer y aplicar correctamente las normas fiscales permite tomar decisiones inteligentes, evitar sanciones y contribuir al bienestar colectivo.';
    doc.text(quoteText, 24, bottomY + 6, { maxWidth: quoteWidth - 12, lineHeightFactor: 1.25 });

    // Cuadro de Totales
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.4);
    doc.roundedRect(totalsX, bottomY, totalsWidth, 30, 1.5, 1.5, 'FD');

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('SUBTOTAL:', totalsX + 4, bottomY + 6.5);
    doc.setFont('courier', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(this.formatLps(data.subtotal), totalsX + totalsWidth - 4, bottomY + 6.5, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('IMPUESTO:', totalsX + 4, bottomY + 13);
    doc.setFont('courier', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(this.formatLps(data.impuesto), totalsX + totalsWidth - 4, bottomY + 13, { align: 'right' });

    doc.setDrawColor(203, 213, 225);
    doc.line(totalsX + 4, bottomY + 17, totalsX + totalsWidth - 4, bottomY + 17);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text('TOTAL:', totalsX + 4, bottomY + 24);
    doc.setFont('courier', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(5, 150, 105); // Green 600
    doc.text(this.formatLps(data.total), totalsX + totalsWidth - 4, bottomY + 24, { align: 'right' });

    // 5. FIRMA Y SELLO
    const sigY = bottomY + 45;
    const sigWidth = 65;
    const sigX = (pageWidth - sigWidth) / 2;

    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.3);
    doc.line(sigX, sigY, sigX + sigWidth, sigY);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text('FIRMA Y SELLO', pageWidth / 2, sigY + 4, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.text(titular, pageWidth / 2, sigY + 8, { align: 'center' });
    if (cfg?.colegiacionCAH) {
      doc.text(cfg.colegiacionCAH, pageWidth / 2, sigY + 11.5, { align: 'center' });
    }

    if (autoDownload) {
      const cleanNum = data.numeroRecibo.replace(/[^a-zA-Z0-9-_]/g, '_');
      doc.save(`Recibo_${cleanNum}.pdf`);
    }

    return doc;
  }

  // --- 6B. DISEÑO FISCAL OFICIAL CON CAI (SAR) ---
  generarReciboFiscalPdf(data: ReciboPdfData, autoDownload: boolean = true): jsPDF {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const cfg = this.despachoConfig;

    // Encabezado
    doc.setFillColor(15, 23, 42);
    doc.rect(14, 10, pageWidth - 28, 1.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text((cfg?.nombreDespacho || 'DESPACHO CONTABLE Y FISCAL').toUpperCase(), 14, 18);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Titular: ${cfg?.nombreContadorTitular || 'Contador'} • RTN: ${cfg?.rtnDespacho || '08011980123456'} • ${cfg?.colegiacionCAH || 'CAH'}`, 14, 23);
    doc.text(`Tel: ${cfg?.telefono || '+504 2235-0000'} • Email: ${cfg?.email || 'contacto@despacho.hn'}`, 14, 27);

    // Caja de Número de Factura / CAI
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(pageWidth - 80, 14, 66, 16, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text('FACTURA / RECIBO FISCAL', pageWidth - 47, 19, { align: 'center' });

    doc.setFont('courier', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(37, 99, 235);
    doc.text(data.numeroFiscal || data.numeroRecibo, pageWidth - 47, 24.5, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(`Fecha: ${data.fechaEmision}`, pageWidth - 47, 28.5, { align: 'center' });

    // Bloque CAI
    const caiY = 33;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(14, caiY, pageWidth - 28, 12, 1.5, 1.5, 'FD');

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('CAI (SAR):', 18, caiY + 5);
    doc.setFont('courier', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(data.cai || 'N/A', 35, caiY + 5);

    if (data.rangoAutorizado) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text('Rango Autorizado:', 18, caiY + 9.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      doc.text(data.rangoAutorizado, 44, caiY + 9.5);
    }

    if (data.fechaLimiteEmision) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text('Fecha Límite:', pageWidth - 65, caiY + 5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(220, 38, 38);
      doc.text(data.fechaLimiteEmision, pageWidth - 45, caiY + 5);
    }

    // Datos Cliente
    const cliY = caiY + 15;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, cliY, pageWidth - 28, 11, 1.5, 1.5, 'FD');

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('CLIENTE:', 18, cliY + 7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(data.clienteNombre, 35, cliY + 7);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('RTN:', pageWidth - 70, cliY + 7);
    doc.setFont('courier', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(data.clienteRtn, pageWidth - 55, cliY + 7);

    // Tabla de Ítems
    const headers = [['PRODUCTO', 'DESCRIPCIÓN', 'CANTIDAD', 'PRECIO', 'TOTAL']];
    const rows = data.items.map(it => [
      it.producto || 'Servicio Profesional',
      it.descripcion || 'Honorarios',
      it.cantidad ? it.cantidad.toString() : '1',
      this.formatLps(it.precio),
      this.formatLps(it.total)
    ]);

    autoTable(doc, {
      startY: cliY + 14,
      head: headers,
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
      bodyStyles: { fontSize: 7.5, cellPadding: 2.5 },
      columnStyles: {
        0: { cellWidth: 40, fontStyle: 'bold' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 28, halign: 'right' },
        4: { cellWidth: 32, halign: 'right', fontStyle: 'bold' }
      },
      margin: { left: 14, right: 14 }
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 110;
    const totalsY = finalY + 6;

    // Totales
    const totWidth = 75;
    const totX = pageWidth - 14 - totWidth;

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(totX, totalsY, totWidth, 26, 1.5, 1.5, 'FD');

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('SUBTOTAL:', totX + 4, totalsY + 6);
    doc.setFont('courier', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(this.formatLps(data.subtotal), totX + totWidth - 4, totalsY + 6, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('ISV 15%:', totX + 4, totalsY + 12);
    doc.setFont('courier', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(this.formatLps(data.impuesto), totX + totWidth - 4, totalsY + 12, { align: 'right' });

    doc.setDrawColor(203, 213, 225);
    doc.line(totX + 4, totalsY + 15.5, totX + totWidth - 4, totalsY + 15.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text('TOTAL LPS:', totX + 4, totalsY + 21.5);
    doc.setFont('courier', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(5, 150, 105);
    doc.text(this.formatLps(data.total), totX + totWidth - 4, totalsY + 21.5, { align: 'right' });

    // Firma
    const sigY = totalsY + 38;
    doc.setDrawColor(148, 163, 184);
    doc.line(pageWidth / 2 - 30, sigY, pageWidth / 2 + 30, sigY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text('FIRMA AUTORIZADA', pageWidth / 2, sigY + 4, { align: 'center' });

    // Pie de página oficial
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text('ORIGINAL: CLIENTE   •   COPIA: OBLIGADO TRIBUTARIO EMISOR', pageWidth / 2, pageHeight - 8, { align: 'center' });

    if (autoDownload) {
      const cleanNum = data.numeroRecibo.replace(/[^a-zA-Z0-9-_]/g, '_');
      doc.save(`Factura_SAR_${cleanNum}.pdf`);
    }

    return doc;
  }
}

