import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiReportesService, ReporteFinancieroResponse } from '../services/api-reportes.service';
import { PdfGeneratorService } from '../services/pdf-generator.service';

@Component({
  selector: 'app-reportes',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reportes.component.html',
  styleUrl: './reportes.component.scss'
})
export class ReportesComponent implements OnInit {
  private readonly reportesService = inject(ApiReportesService);
  private readonly pdfService = inject(PdfGeneratorService);

  readonly data = signal<ReporteFinancieroResponse | null>(null);
  readonly isLoading = signal(true);
  readonly errorMsg = signal<string | null>(null);

  // Valor máximo para calcular la altura de las barras
  readonly maxIngreso = computed(() => {
    const list = this.data()?.historicoIngresos || [];
    if (list.length === 0) return 10000;
    const max = Math.max(...list.map(i => Number(i.montoTotal) || 0));
    return max > 0 ? max : 10000;
  });

  ngOnInit(): void {
    this.cargarReporte();
  }

  cargarReporte(): void {
    this.isLoading.set(true);
    this.reportesService.getReporteFinanciero().subscribe({
      next: (res) => {
        this.data.set(res);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMsg.set('No se pudo cargar el reporte financiero.');
        this.isLoading.set(false);
      }
    });
  }

  getBarHeight(monto: number): number {
    const max = this.maxIngreso();
    if (max <= 0) return 10;
    const height = (monto / max) * 160;
    return Math.max(12, Math.min(160, height));
  }

  descargarReportePdf(): void {
    const rep = this.data();
    if (rep) {
      this.pdfService.generarReporteFinancieroPdf(rep);
    }
  }

  imprimirReporte(): void {
    this.descargarReportePdf();
  }
}
