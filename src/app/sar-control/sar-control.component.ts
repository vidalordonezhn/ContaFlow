import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiSARService, PeriodoSARResponse, SARResumenMensual } from '../services/api-sar.service';

@Component({
  selector: 'app-sar-control',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sar-control.component.html',
  styleUrl: './sar-control.component.scss'
})
export class SARControlComponent implements OnInit {
  private readonly sarService = inject(ApiSARService);
  private readonly router = inject(Router);

  readonly periodos = signal<PeriodoSARResponse[]>([]);
  readonly resumen = signal<SARResumenMensual | null>(null);
  readonly isLoading = signal(true);
  readonly errorMsg = signal<string | null>(null);
  readonly successMsg = signal<string | null>(null);

  // Selector Mes y Año
  readonly selectedMes = signal<number>(new Date().getMonth() + 1);
  readonly selectedAnio = signal<number>(new Date().getFullYear());

  // Filtros
  readonly activeTab = signal<'todos' | 'rojo' | 'amarillo' | 'verde'>('todos');
  readonly searchQuery = signal('');

  // Lista de Meses
  readonly meses = [
    { id: 1, name: 'Enero' },
    { id: 2, name: 'Febrero' },
    { id: 3, name: 'Marzo' },
    { id: 4, name: 'Abril' },
    { id: 5, name: 'Mayo' },
    { id: 6, name: 'Junio' },
    { id: 7, name: 'Julio' },
    { id: 8, name: 'Agosto' },
    { id: 9, name: 'Septiembre' },
    { id: 10, name: 'Octubre' },
    { id: 11, name: 'Noviembre' },
    { id: 12, name: 'Diciembre' }
  ];

  readonly anios = [2024, 2025, 2026, 2027];

  // KPIs
  readonly kpiTotal = computed(() => this.periodos().length);
  readonly kpiPendientes = computed(() => this.periodos().filter(p => !p.facturasRecibidas && !p.liquidadoSAR).length);
  readonly kpiEnProceso = computed(() => this.periodos().filter(p => p.facturasRecibidas && !p.liquidadoSAR).length);
  readonly kpiLiquidados = computed(() => this.periodos().filter(p => p.liquidadoSAR).length);

  // Filtrado
  readonly filteredPeriodos = computed(() => {
    const tab = this.activeTab();
    const query = this.searchQuery().toLowerCase().trim();

    return this.periodos().filter(p => {
      let matchTab = true;
      if (tab === 'rojo') matchTab = !p.facturasRecibidas && !p.liquidadoSAR;
      else if (tab === 'amarillo') matchTab = p.facturasRecibidas && !p.liquidadoSAR;
      else if (tab === 'verde') matchTab = p.liquidadoSAR;

      if (!matchTab) return false;

      if (!query) return true;
      return p.clienteNombre.toLowerCase().includes(query) ||
             p.clienteRtn.toLowerCase().includes(query) ||
             (p.clienteRubro && p.clienteRubro.toLowerCase().includes(query));
    });
  });

  ngOnInit(): void {
    this.cargarDatos();
  }

  cargarDatos(): void {
    this.isLoading.set(true);
    const mes = this.selectedMes();
    const anio = this.selectedAnio();

    this.sarService.getPeriodos(mes, anio).subscribe({
      next: (data) => {
        this.periodos.set(data);
        this.sarService.getResumen(mes, anio).subscribe(res => this.resumen.set(res));
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMsg.set('Error al cargar control SAR.');
        this.isLoading.set(false);
      }
    });
  }

  cambiarPeriodo(): void {
    this.cargarDatos();
  }

  irAPresentacionFacturas(periodo: PeriodoSARResponse): void {
    this.router.navigate(['/libros-isv'], {
      queryParams: {
        clienteId: periodo.clienteId,
        mes: this.selectedMes(),
        anio: this.selectedAnio()
      }
    });
  }

  getWhatsAppRecordatorio(periodo: PeriodoSARResponse): string {
    if (!periodo.clienteWhatsApp) return '#';
    const cleanPhone = periodo.clienteWhatsApp.replace(/[^0-9]/g, '');
    const fullPhone = cleanPhone.startsWith('504') ? cleanPhone : `504${cleanPhone}`;
    const nombreMes = this.meses.find(m => m.id === periodo.mes)?.name || '';
    
    const texto = `Estimado(a) ${periodo.clienteNombre}, le saluda su despacho contable.\n\nLe recordamos amablemente enviarnos sus facturas de ventas y compras del mes de *${nombreMes} ${periodo.anio}* antes del día 10 para poder preparar y liquidar su declaración a tiempo ante el SAR.\n\n¡Quedamos a su disposición!`;
    return `https://wa.me/${fullPhone}?text=${encodeURIComponent(texto)}`;
  }

  private showToast(msg: string): void {
    this.successMsg.set(msg);
    setTimeout(() => this.successMsg.set(null), 3500);
  }
}
