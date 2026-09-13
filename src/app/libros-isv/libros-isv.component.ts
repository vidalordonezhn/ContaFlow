import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiLibrosIsvService, LibroIsvDetalle, LibroIsvGuardar, LibroIsvImportItem, LibroIsvImportResponse } from '../services/api-libros-isv.service';
import { ApiClientsService, ClienteResponse } from '../services/api-clients.service';

@Component({
  selector: 'app-libros-isv',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './libros-isv.component.html',
  styleUrl: './libros-isv.component.scss'
})
export class LibrosIsvComponent implements OnInit {
  private readonly librosService = inject(ApiLibrosIsvService);
  private readonly clientsService = inject(ApiClientsService);

  readonly activeTab = signal<'individual' | 'masivo'>('individual');
  readonly clientes = signal<ClienteResponse[]>([]);
  readonly selectedClienteId = signal<number | null>(null);
  readonly selectedCliente = computed(() => this.clientes().find(c => c.id === this.selectedClienteId()));
  readonly selectedMesNombre = computed(() => this.mesesList.find(m => m.num === this.selectedMes())?.nombre || 'Mes');
  readonly selectedAnio = signal<number>(new Date().getFullYear());
  readonly selectedMes = signal<number>(new Date().getMonth() + 1);

  readonly isLoading = signal(false);
  readonly isSaving = signal(false);
  readonly successMsg = signal<string | null>(null);
  readonly errorMsg = signal<string | null>(null);

  // Formulario Individual
  readonly formVentas15 = signal<number>(0);
  readonly formVentas18 = signal<number>(0);
  readonly formVentasExentas = signal<number>(0);

  readonly formCompras15 = signal<number>(0);
  readonly formCompras18 = signal<number>(0);
  readonly formComprasExentas = signal<number>(0);
  readonly formImportaciones15 = signal<number>(0);

  readonly formSaldoAnterior = signal<number>(0);
  readonly formRetenciones = signal<number>(0);
  readonly formMarcarLiquidado = signal<boolean>(false);
  readonly formNumeroDeclaracion = signal<string>('');

  // Período cargado
  readonly currentLibro = signal<LibroIsvDetalle | null>(null);

  // Meses disponibles
  readonly mesesList = [
    { num: 1, nombre: 'Enero' },
    { num: 2, nombre: 'Febrero' },
    { num: 3, nombre: 'Marzo' },
    { num: 4, nombre: 'Abril' },
    { num: 5, nombre: 'Mayo' },
    { num: 6, nombre: 'Junio' },
    { num: 7, nombre: 'Julio' },
    { num: 8, nombre: 'Agosto' },
    { num: 9, nombre: 'Septiembre' },
    { num: 10, nombre: 'Octubre' },
    { num: 11, nombre: 'Noviembre' },
    { num: 12, nombre: 'Diciembre' }
  ];

  readonly aniosList = [2024, 2025, 2026, 2027];

  // Cálculos en vivo (Reactivos en tiempo real)
  readonly liveDebito15 = computed(() => Math.round((Number(this.formVentas15()) || 0) * 0.15 * 100) / 100);
  readonly liveDebito18 = computed(() => Math.round((Number(this.formVentas18()) || 0) * 0.18 * 100) / 100);
  readonly liveTotalDebito = computed(() => Math.round((this.liveDebito15() + this.liveDebito18()) * 100) / 100);
  readonly liveTotalVentas = computed(() => 
    (Number(this.formVentas15()) || 0) + (Number(this.formVentas18()) || 0) + (Number(this.formVentasExentas()) || 0)
  );

  readonly liveCredito15 = computed(() => 
    Math.round(((Number(this.formCompras15()) || 0) + (Number(this.formImportaciones15()) || 0)) * 0.15 * 100) / 100
  );
  readonly liveCredito18 = computed(() => Math.round((Number(this.formCompras18()) || 0) * 0.18 * 100) / 100);
  readonly liveTotalCredito = computed(() => Math.round((this.liveCredito15() + this.liveCredito18()) * 100) / 100);
  readonly liveTotalCompras = computed(() => 
    (Number(this.formCompras15()) || 0) + (Number(this.formCompras18()) || 0) + 
    (Number(this.formComprasExentas()) || 0) + (Number(this.formImportaciones15()) || 0)
  );

  readonly liveNeto = computed(() => {
    const debito = this.liveTotalDebito();
    const credito = this.liveTotalCredito();
    const anterior = Number(this.formSaldoAnterior()) || 0;
    const retenciones = Number(this.formRetenciones()) || 0;
    return Math.round((debito - credito - anterior - retenciones) * 100) / 100;
  });

  readonly liveImpuestoPagar = computed(() => this.liveNeto() > 0 ? this.liveNeto() : 0);
  readonly liveSaldoFavor = computed(() => this.liveNeto() < 0 ? Math.abs(this.liveNeto()) : 0);

  // Carga Masiva
  readonly selectedFile = signal<File | null>(null);
  readonly parsedRows = signal<LibroIsvImportItem[]>([]);
  readonly parseError = signal<string | null>(null);
  readonly isImporting = signal(false);
  readonly importResult = signal<LibroIsvImportResponse | null>(null);

  ngOnInit(): void {
    this.cargarClientes();
  }

  cargarClientes(): void {
    this.clientsService.getClientes().subscribe({
      next: (data) => {
        const activos = data.filter(c => c.activo);
        this.clientes.set(activos);
        if (activos.length > 0 && !this.selectedClienteId()) {
          this.selectedClienteId.set(activos[0].id);
          this.cargarPeriodo();
        }
      }
    });
  }

  cargarPeriodo(): void {
    const cid = this.selectedClienteId();
    if (!cid) return;

    this.isLoading.set(true);
    this.errorMsg.set(null);

    this.librosService.getLibroIsv(cid, this.selectedAnio(), this.selectedMes()).subscribe({
      next: (data) => {
        this.currentLibro.set(data);
        this.formVentas15.set(data.ventasGravadas15);
        this.formVentas18.set(data.ventasGravadas18);
        this.formVentasExentas.set(data.ventasExentas);
        this.formCompras15.set(data.comprasGravadas15);
        this.formCompras18.set(data.comprasGravadas18);
        this.formComprasExentas.set(data.comprasExentas);
        this.formImportaciones15.set(data.importacionesGravadas15);
        this.formSaldoAnterior.set(data.saldoAFavorPeriodoAnterior);
        this.formRetenciones.set(data.retencionesISVRecibidas);
        this.formMarcarLiquidado.set(data.liquidadoSAR);
        this.formNumeroDeclaracion.set(data.numeroDeclaracionSAR || '');
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMsg.set('No se pudo cargar el período fiscal.');
        this.isLoading.set(false);
      }
    });
  }

  guardarIndividual(): void {
    const cid = this.selectedClienteId();
    if (!cid) return;

    this.isSaving.set(true);
    this.errorMsg.set(null);

    const dto: LibroIsvGuardar = {
      clienteId: cid,
      anio: this.selectedAnio(),
      mes: this.selectedMes(),
      ventasGravadas15: Number(this.formVentas15()) || 0,
      ventasGravadas18: Number(this.formVentas18()) || 0,
      ventasExentas: Number(this.formVentasExentas()) || 0,
      comprasGravadas15: Number(this.formCompras15()) || 0,
      comprasGravadas18: Number(this.formCompras18()) || 0,
      comprasExentas: Number(this.formComprasExentas()) || 0,
      importacionesGravadas15: Number(this.formImportaciones15()) || 0,
      saldoAFavorPeriodoAnterior: Number(this.formSaldoAnterior()) || 0,
      retencionesISVRecibidas: Number(this.formRetenciones()) || 0,
      marcarComoLiquidado: this.formMarcarLiquidado(),
      numeroDeclaracionSAR: this.formNumeroDeclaracion().trim() || undefined
    };

    this.librosService.guardarLibroIsv(dto).subscribe({
      next: (data) => {
        this.currentLibro.set(data);
        this.showToast('Liquidación de ISV (SAR-210) guardada correctamente.');
        this.isSaving.set(false);
      },
      error: () => {
        this.errorMsg.set('Error al guardar la liquidación.');
        this.isSaving.set(false);
      }
    });
  }

  // Descarga de Plantilla
  descargarPlantilla(): void {
    window.location.href = this.librosService.descargarPlantillaUrl();
  }

  // Exportar Resumen Mensual
  exportarResumen(): void {
    window.location.href = this.librosService.exportarResumenMesUrl(this.selectedAnio(), this.selectedMes());
  }

  // Manejo de Archivos Masivos
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.procesarArchivo(input.files[0]);
    }
  }

  onFileDrop(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer && event.dataTransfer.files.length > 0) {
      this.procesarArchivo(event.dataTransfer.files[0]);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  private procesarArchivo(file: File): void {
    this.selectedFile.set(file);
    this.parseError.set(null);
    this.importResult.set(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      this.parseCsvContent(text);
    };
    reader.readAsText(file);
  }

  private parseCsvContent(text: string): void {
    try {
      const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
      if (lines.length <= 1) {
        this.parseError.set('El archivo está vacío o solo contiene encabezados.');
        return;
      }

      const rows: LibroIsvImportItem[] = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = this.splitCsvLine(lines[i]);
        if (cols.length < 5) continue;

        const rtn = (cols[0] || '').trim().replace(/"/g, '');
        if (!rtn) continue;

        rows.push({
          rtn: rtn,
          anio: parseInt(cols[2]) || this.selectedAnio(),
          mes: parseInt(cols[3]) || this.selectedMes(),
          ventasGravadas15: parseFloat(cols[4]) || 0,
          ventasGravadas18: parseFloat(cols[5]) || 0,
          ventasExentas: parseFloat(cols[6]) || 0,
          comprasGravadas15: parseFloat(cols[7]) || 0,
          comprasGravadas18: parseFloat(cols[8]) || 0,
          comprasExentas: parseFloat(cols[9]) || 0,
          importacionesGravadas15: parseFloat(cols[10]) || 0,
          saldoAFavorPeriodoAnterior: parseFloat(cols[11]) || 0,
          retencionesISVRecibidas: parseFloat(cols[12]) || 0,
          numeroDeclaracionSAR: cols[13] ? cols[13].trim().replace(/"/g, '') : undefined
        });
      }

      if (rows.length === 0) {
        this.parseError.set('No se encontraron filas con formato válido en el archivo.');
        return;
      }

      this.parsedRows.set(rows);
    } catch {
      this.parseError.set('Error al procesar el archivo CSV/Excel. Verifique la estructura.');
    }
  }

  private splitCsvLine(line: string): string[] {
    const result: string[] = [];
    let insideQuotes = false;
    let entry = '';

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === ',' && !insideQuotes) {
        result.push(entry);
        entry = '';
      } else {
        entry += char;
      }
    }
    result.push(entry);
    return result;
  }

  ejecutarImportacionMasiva(): void {
    const items = this.parsedRows();
    if (items.length === 0) return;

    this.isImporting.set(true);
    this.parseError.set(null);

    this.librosService.importarMasivo(items).subscribe({
      next: (res) => {
        this.importResult.set(res);
        this.isImporting.set(false);
        this.parsedRows.set([]);
        this.selectedFile.set(null);
        this.showToast(`Se procesaron ${res.totalGuardados} períodos exitosamente.`);
        this.cargarPeriodo();
      },
      error: () => {
        this.parseError.set('Error al enviar la importación masiva al servidor.');
        this.isImporting.set(false);
      }
    });
  }

  imprimirHojaTrabajo(): void {
    window.print();
  }

  private showToast(msg: string): void {
    this.successMsg.set(msg);
    setTimeout(() => this.successMsg.set(null), 3500);
  }
}
