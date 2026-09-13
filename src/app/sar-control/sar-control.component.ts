import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiSARService, PeriodoSARResponse, SARResumenMensual, MarcarRecepcion, RegistrarLiquidacionSAR } from '../services/api-sar.service';

@Component({
  selector: 'app-sar-control',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sar-control.component.html',
  styleUrl: './sar-control.component.scss'
})
export class SARControlComponent implements OnInit {
  private readonly sarService = inject(ApiSARService);

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

  // Modales
  readonly isRecepcionModalOpen = signal(false);
  readonly isLiquidacionModalOpen = signal(false);
  readonly selectedPeriodo = signal<PeriodoSARResponse | null>(null);
  readonly formError = signal<string | null>(null);

  // Formulario Recepción
  readonly formFacturasRecibidas = signal(true);
  readonly formCantVentas = signal<number>(0);
  readonly formCantCompras = signal<number>(0);
  readonly formNotasRecepcion = signal('');

  // Formulario Liquidación
  readonly formNumeroDeclaracion = signal('');
  readonly formMontoISV = signal<number>(0);
  readonly formMontoRetenciones = signal<number>(0);
  readonly formNotasLiquidacion = signal('');

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
  readonly kpiPendientes = computed(() => this.periodos().filter(p => !p.facturasRecibidas).length);
  readonly kpiEnProceso = computed(() => this.periodos().filter(p => p.facturasRecibidas && !p.liquidadoSAR).length);
  readonly kpiLiquidados = computed(() => this.periodos().filter(p => p.liquidadoSAR).length);

  // Filtrado
  readonly filteredPeriodos = computed(() => {
    const tab = this.activeTab();
    const query = this.searchQuery().toLowerCase().trim();

    return this.periodos().filter(p => {
      let matchTab = true;
      if (tab === 'rojo') matchTab = !p.facturasRecibidas;
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

  openRecepcionModal(periodo: PeriodoSARResponse): void {
    this.selectedPeriodo.set(periodo);
    this.formFacturasRecibidas.set(true);
    this.formCantVentas.set(periodo.cantidadFacturasVenta || 0);
    this.formCantCompras.set(periodo.cantidadFacturasCompra || 0);
    this.formNotasRecepcion.set(periodo.notasDocumentos || '');
    this.formError.set(null);
    this.isRecepcionModalOpen.set(true);
  }

  openLiquidacionModal(periodo: PeriodoSARResponse): void {
    this.selectedPeriodo.set(periodo);
    this.formNumeroDeclaracion.set(periodo.numeroDeclaracionSAR || '');
    this.formMontoISV.set(periodo.montoImpuestoISV || 0);
    this.formMontoRetenciones.set(periodo.montoRetenciones || 0);
    this.formError.set(null);
    this.isLiquidacionModalOpen.set(true);
  }

  closeModals(): void {
    this.isRecepcionModalOpen.set(false);
    this.isLiquidacionModalOpen.set(false);
    this.formError.set(null);
  }

  guardarRecepcion(): void {
    const periodo = this.selectedPeriodo();
    if (!periodo) return;

    const dto: MarcarRecepcion = {
      facturasRecibidas: this.formFacturasRecibidas(),
      cantidadFacturasVenta: Number(this.formCantVentas()) || 0,
      cantidadFacturasCompra: Number(this.formCantCompras()) || 0,
      notasDocumentos: this.formNotasRecepcion().trim() || undefined
    };

    this.sarService.marcarRecepcion(periodo.id, dto).subscribe({
      next: () => {
        this.showToast('Recepción de documentos guardada.');
        this.closeModals();
        this.cargarDatos();
      },
      error: (err) => {
        this.formError.set(err.error?.mensaje || 'Error al guardar.');
      }
    });
  }

  guardarLiquidacion(): void {
    const periodo = this.selectedPeriodo();
    if (!periodo) return;

    if (!this.formNumeroDeclaracion().trim()) {
      this.formError.set('El número de declaración SAR es obligatorio.');
      return;
    }

    const dto: RegistrarLiquidacionSAR = {
      numeroDeclaracionSAR: this.formNumeroDeclaracion().trim(),
      montoImpuestoISV: Number(this.formMontoISV()) || 0,
      montoRetenciones: Number(this.formMontoRetenciones()) || 0,
      notas: this.formNotasLiquidacion().trim() || undefined
    };

    this.sarService.registrarLiquidacion(periodo.id, dto).subscribe({
      next: () => {
        this.showToast('Liquidación SAR registrada exitosamente.');
        this.closeModals();
        this.cargarDatos();
      },
      error: (err) => {
        this.formError.set(err.error?.mensaje || 'Error al guardar.');
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
