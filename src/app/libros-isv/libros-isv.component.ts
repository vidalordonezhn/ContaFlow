import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiLibrosIsvService, LibroIsvDetalle, LibroIsvGuardar, LibroIsvImportItem, LibroIsvImportResponse, LibroPartidaItem, LibroDetalleCompleto, GuardarLibroDetallePartidas } from '../services/api-libros-isv.service';
import { ApiClientsService, ClienteResponse } from '../services/api-clients.service';
import { PdfGeneratorService } from '../services/pdf-generator.service';
import { ClientSelectorComponent } from '../shared/client-selector/client-selector.component';

@Component({
  selector: 'app-libros-isv',
  standalone: true,
  imports: [CommonModule, FormsModule, ClientSelectorComponent],
  templateUrl: './libros-isv.component.html',
  styleUrl: './libros-isv.component.scss'
})
export class LibrosIsvComponent implements OnInit {
  private readonly librosService = inject(ApiLibrosIsvService);
  private readonly clientsService = inject(ApiClientsService);
  private readonly pdfService = inject(PdfGeneratorService);

  readonly activeTab = signal<'detalle' | 'declaracion' | 'masivo'>('detalle');
  readonly clientes = signal<ClienteResponse[]>([]);
  readonly selectedClienteId = signal<number | null>(null);
  readonly selectedCliente = computed(() => {
    const id = this.selectedClienteId();
    if (!id) return null;
    return this.clientes().find(c => Number(c.id) === Number(id)) || null;
  });
  readonly selectedMesNombre = computed(() => this.mesesList.find(m => m.num === this.selectedMes())?.nombre || 'Mes');
  readonly selectedAnio = signal<number>(new Date().getFullYear());
  readonly selectedMes = signal<number>(new Date().getMonth() + 1);

  readonly isLoading = signal(false);
  readonly isSaving = signal(false);
  readonly successMsg = signal<string | null>(null);
  readonly errorMsg = signal<string | null>(null);

  // Copiado y Seguridad SAR
  readonly mostrarSARPassword = signal(false);
  readonly copiedField = signal<string | null>(null);

  // ==========================================
  // ESTADO HOJA DE TRABAJO DETALLADA (PARTIDAS)
  // ==========================================
  readonly detalleItems = signal<LibroPartidaItem[]>([]);
  readonly serviciosProfesionales = signal<number>(0);
  readonly isSavingDetalle = signal(false);
  readonly isImportingDetalle = signal(false);

  // Cálculos en Vivo de la Hoja Detallada
  readonly sumComprasExentas = computed(() => 
    Math.round(this.detalleItems().reduce((acc, it) => acc + (Number(it.comprasExentas) || 0), 0) * 100) / 100
  );
  readonly sumComprasGravadas = computed(() => 
    Math.round(this.detalleItems().reduce((acc, it) => acc + (Number(it.comprasGravadas) || 0), 0) * 100) / 100
  );
  readonly sumIsvCompras = computed(() => 
    Math.round(this.detalleItems().reduce((acc, it) => acc + (Number(it.isvCompras15) || 0), 0) * 100) / 100
  );

  readonly sumVentasExentas = computed(() => 
    Math.round(this.detalleItems().reduce((acc, it) => acc + (Number(it.ventasExentas) || 0), 0) * 100) / 100
  );
  readonly sumVentasGravadas = computed(() => 
    Math.round(this.detalleItems().reduce((acc, it) => acc + (Number(it.ventasGravadas) || 0), 0) * 100) / 100
  );
  readonly sumIsvVentas = computed(() => 
    Math.round(this.detalleItems().reduce((acc, it) => acc + (Number(it.isvVentas15) || 0), 0) * 100) / 100
  );

  readonly liveImpuestoAPagarDetalle = computed(() => {
    const diff = Math.round((this.sumIsvVentas() - this.sumIsvCompras()) * 100) / 100;
    return diff > 0 ? diff : 0;
  });

  readonly liveSaldoAFavorDetalle = computed(() => {
    const diff = Math.round((this.sumIsvCompras() - this.sumIsvVentas()) * 100) / 100;
    return diff > 0 ? diff : 0;
  });

  readonly liveTotalLpsDetalle = computed(() => {
    const honorarios = Number(this.serviciosProfesionales()) || 0;
    return Math.round((this.liveImpuestoAPagarDetalle() + honorarios) * 100) / 100;
  });

  // ==========================================
  // ESTADO FORMULARIO DECLARACIÓN RESUMEN SAR-210
  // ==========================================
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

  // Cálculos en vivo SAR-210
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

  // Carga Masiva Resumen
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
        this.clientes.set(data || []);
        if (data && data.length > 0 && !this.selectedClienteId()) {
          const primerCliente = data.find(c => c.activo) || data[0];
          this.selectedClienteId.set(Number(primerCliente.id));
          this.serviciosProfesionales.set(primerCliente.cuotaMensual || 0);
          this.cargarDatosPeriodo();
        }
      },
      error: (err) => {
        console.error('Error al cargar clientes:', err);
      }
    });
  }

  onClientAutocompleteSelected(client: ClienteResponse): void {
    if (!client) return;
    this.selectedClienteId.set(Number(client.id));
    this.serviciosProfesionales.set(client.cuotaMensual || 0);
    this.cargarDatosPeriodo();
  }

  onClientAutocompleteCleared(): void {
    if (this.clientes().length > 0) {
      this.selectedClienteId.set(Number(this.clientes()[0].id));
      this.cargarDatosPeriodo();
    }
  }

  onClienteChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const numId = Number(target.value);
    if (numId) {
      this.onClienteSeleccionado(numId);
    }
  }

  onClienteSeleccionado(clienteId: any): void {
    const numId = Number(clienteId);
    if (!numId) return;
    this.selectedClienteId.set(numId);
    const cli = this.clientes().find(c => Number(c.id) === numId);
    if (cli) {
      this.serviciosProfesionales.set(cli.cuotaMensual || 0);
    }
    this.cargarDatosPeriodo();
  }

  cargarDatosPeriodo(): void {
    const cid = this.selectedClienteId();
    if (!cid) return;

    this.isLoading.set(true);
    this.errorMsg.set(null);

    // Cargar Detalle de Partidas
    this.librosService.getLibroDetalle(cid, this.selectedAnio(), this.selectedMes()).subscribe({
      next: (det) => {
        if (det.items && det.items.length > 0) {
          this.detalleItems.set(det.items);
        } else {
          // Inicializar con al menos 1 fila vacía
          this.detalleItems.set([this.crearFilaVacia(1)]);
        }
        if (det.serviciosProfesionales) {
          this.serviciosProfesionales.set(det.serviciosProfesionales);
        } else {
          const cli = this.selectedCliente();
          if (cli) this.serviciosProfesionales.set(cli.cuotaMensual || 0);
        }
      },
      error: () => {
        this.detalleItems.set([this.crearFilaVacia(1)]);
      }
    });

    // Cargar Resumen SAR-210
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
        this.isLoading.set(false);
      }
    });
  }

  // ==========================================
  // OPERACIONES HOJA DE TRABAJO PARTIDA POR PARTIDA
  // ==========================================
  crearFilaVacia(correlativo: number): LibroPartidaItem {
    const today = new Date().toISOString().split('T')[0];
    return {
      correlativo,
      fecha: today,
      proveedor: '',
      comprasExentas: 0,
      comprasGravadas: 0,
      isvCompras15: 0,
      facturaNumero: '',
      ventasExentas: 0,
      ventasGravadas: 0,
      isvVentas15: 0,
      notas: ''
    };
  }

  agregarFila(): void {
    const current = this.detalleItems();
    const nextCorrelativo = current.length + 1;
    this.detalleItems.update(list => [...list, this.crearFilaVacia(nextCorrelativo)]);
  }

  eliminarFila(index: number): void {
    const current = this.detalleItems();
    if (current.length <= 1) {
      this.detalleItems.set([this.crearFilaVacia(1)]);
      return;
    }
    const updated = current.filter((_, i) => i !== index).map((item, idx) => ({
      ...item,
      correlativo: idx + 1
    }));
    this.detalleItems.set(updated);
  }

  onComprasGravadasChange(item: LibroPartidaItem): void {
    const grav = Number(item.comprasGravadas) || 0;
    item.isvCompras15 = Math.round(grav * 0.15 * 100) / 100;
    this.notificarCambioDetalle();
  }

  onVentasGravadasChange(item: LibroPartidaItem): void {
    const grav = Number(item.ventasGravadas) || 0;
    item.isvVentas15 = Math.round(grav * 0.15 * 100) / 100;
    this.notificarCambioDetalle();
  }

  notificarCambioDetalle(): void {
    this.detalleItems.update(list => [...list]);
  }

  guardarDetalle(): void {
    const cid = this.selectedClienteId();
    if (!cid) return;

    this.isSavingDetalle.set(true);
    this.errorMsg.set(null);

    const dto: GuardarLibroDetallePartidas = {
      clienteId: cid,
      anio: this.selectedAnio(),
      mes: this.selectedMes(),
      serviciosProfesionales: Number(this.serviciosProfesionales()) || 0,
      items: this.detalleItems()
    };

    this.librosService.guardarLibroDetalle(dto).subscribe({
      next: (res) => {
        this.detalleItems.set(res.items);
        this.isSavingDetalle.set(false);
        this.showToast('¡Hoja de Trabajo y Detalle de Facturas guardados exitosamente!');
        // Actualizar resumen SAR-210 sincronizado
        this.cargarDatosPeriodo();
      },
      error: (err) => {
        this.isSavingDetalle.set(false);
        this.errorMsg.set(err.error?.message || 'Error al guardar la hoja de trabajo.');
      }
    });
  }

  descargarPlantillaDetalle(): void {
    window.location.href = this.librosService.descargarPlantillaDetalleUrl();
  }

  onDetalleCsvSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const cid = this.selectedClienteId();
    if (!cid) {
      this.errorMsg.set('Seleccione un cliente antes de importar.');
      return;
    }

    this.isImportingDetalle.set(true);
    this.errorMsg.set(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const csvText = e.target?.result as string;
      this.librosService.importarDetalleCsv(cid, this.selectedAnio(), this.selectedMes(), csvText).subscribe({
        next: (res) => {
          this.detalleItems.set(res.items && res.items.length > 0 ? res.items : [this.crearFilaVacia(1)]);
          this.isImportingDetalle.set(false);
          this.showToast(`¡Se importaron ${res.items.length} partidas correctamente desde el CSV!`);
          input.value = '';
          this.cargarDatosPeriodo();
        },
        error: (err) => {
          this.isImportingDetalle.set(false);
          this.errorMsg.set(err.error?.message || 'Error al importar archivo CSV.');
          input.value = '';
        }
      });
    };
    reader.readAsText(file);
  }

  // ==========================================
  // SEGURIDAD SAR Y COPIADO EN 1-CLIC
  // ==========================================
  copiarTexto(texto: string | undefined | null, campo: string): void {
    if (!texto) return;
    navigator.clipboard.writeText(texto).then(() => {
      this.copiedField.set(campo);
      setTimeout(() => {
        if (this.copiedField() === campo) {
          this.copiedField.set(null);
        }
      }, 2500);
    }).catch(() => {
      // Fallback
      const input = document.createElement('textarea');
      input.value = texto;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      this.copiedField.set(campo);
      setTimeout(() => this.copiedField.set(null), 2500);
    });
  }

  togglePasswordSAR(): void {
    this.mostrarSARPassword.update(v => !v);
  }

  // ==========================================
  // OPERACIONES DECLARACIÓN SAR-210 GLOBAL
  // ==========================================
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

  descargarPlantilla(): void {
    window.location.href = this.librosService.descargarPlantillaUrl();
  }

  exportarResumen(): void {
    window.location.href = this.librosService.exportarResumenMesUrl(this.selectedAnio(), this.selectedMes());
  }

  // Carga Masiva Resumen
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
        this.cargarDatosPeriodo();
      },
      error: () => {
        this.parseError.set('Error al enviar la importación masiva al servidor.');
        this.isImporting.set(false);
      }
    });
  }

  descargarPdfOficial(): void {
    let cli = this.selectedCliente();
    if (!cli && this.clientes().length > 0) {
      cli = this.clientes().find(c => Number(c.id) === Number(this.selectedClienteId())) || this.clientes()[0];
      if (cli) {
        this.selectedClienteId.set(cli.id);
      }
    }

    if (!cli) {
      this.errorMsg.set('No se encontró un cliente seleccionado para generar el PDF.');
      return;
    }

    this.pdfService.generarLibroDetallePdf({
      cliente: cli,
      mesNombre: this.selectedMesNombre(),
      mes: this.selectedMes(),
      anio: this.selectedAnio(),
      items: this.detalleItems(),
      sumComprasExentas: this.sumComprasExentas(),
      sumComprasGravadas: this.sumComprasGravadas(),
      sumIsvCompras: this.sumIsvCompras(),
      sumVentasExentas: this.sumVentasExentas(),
      sumVentasGravadas: this.sumVentasGravadas(),
      sumIsvVentas: this.sumIsvVentas(),
      impuestoAPagar: this.liveImpuestoAPagarDetalle(),
      saldoAFavor: this.liveSaldoAFavorDetalle(),
      serviciosProfesionales: Number(this.serviciosProfesionales()) || 0,
      totalLps: this.liveTotalLpsDetalle()
    }, true);

    this.showToast('¡Reporte PDF oficial generado y descargado con éxito!');
  }

  exportarExcelOficial(): void {
    let cli = this.selectedCliente();
    if (!cli && this.clientes().length > 0) {
      cli = this.clientes().find(c => Number(c.id) === Number(this.selectedClienteId())) || this.clientes()[0];
      if (cli) {
        this.selectedClienteId.set(cli.id);
      }
    }

    if (!cli) {
      this.errorMsg.set('No se encontró un cliente seleccionado para exportar a Excel.');
      return;
    }

    this.pdfService.exportarLibroDetalleExcel({
      cliente: cli,
      mesNombre: this.selectedMesNombre(),
      mes: this.selectedMes(),
      anio: this.selectedAnio(),
      items: this.detalleItems(),
      sumComprasExentas: this.sumComprasExentas(),
      sumComprasGravadas: this.sumComprasGravadas(),
      sumIsvCompras: this.sumIsvCompras(),
      sumVentasExentas: this.sumVentasExentas(),
      sumVentasGravadas: this.sumVentasGravadas(),
      sumIsvVentas: this.sumIsvVentas(),
      impuestoAPagar: this.liveImpuestoAPagarDetalle(),
      saldoAFavor: this.liveSaldoAFavorDetalle(),
      serviciosProfesionales: Number(this.serviciosProfesionales()) || 0,
      totalLps: this.liveTotalLpsDetalle()
    });

    this.showToast('¡Libro de Compras y Ventas exportado a Excel (.xlsx) con éxito!');
  }

  private showToast(msg: string): void {
    this.successMsg.set(msg);
    setTimeout(() => this.successMsg.set(null), 3500);
  }
}
