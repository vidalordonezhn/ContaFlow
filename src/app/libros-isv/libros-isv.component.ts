import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';
import {
  ApiLibrosIsvService,
  LibroIsvDetalle,
  LibroIsvGuardar,
  LibroIsvImportItem,
  LibroIsvImportResponse,
  LibroVentaItem,
  LibroCompraItem,
  ResumenVentasCasillas,
  ResumenComprasCasillas,
  LiquidacionConsolidada,
  LibroCompletoMensual,
  GuardarLibroCompletoRequest
} from '../services/api-libros-isv.service';
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

  // Pestañas principales (Vista Dual Completa por defecto)
  readonly activeTab = signal<'vistaDual' | 'ventas' | 'compras' | 'liquidacion' | 'masivo'>('vistaDual');

  // Selección de Contribuyente & Período
  readonly clientes = signal<ClienteResponse[]>([]);
  readonly selectedClienteId = signal<number | null>(null);
  readonly selectedCliente = computed(() => {
    const id = this.selectedClienteId();
    if (!id) return null;
    return this.clientes().find(c => Number(c.id) === Number(id)) || null;
  });
  readonly selectedMes = signal<number>(new Date().getMonth() + 1);
  readonly selectedAnio = signal<number>(new Date().getFullYear());
  readonly selectedMesNombre = computed(() => this.mesesList.find(m => m.num === this.selectedMes())?.nombre || 'Mes');

  readonly isLoading = signal(false);
  readonly isSaving = signal(false);
  readonly isImportingExcel = signal(false);
  readonly successMsg = signal<string | null>(null);
  readonly errorMsg = signal<string | null>(null);

  // Copiado y Seguridad SAR
  readonly mostrarSARPassword = signal(true);
  readonly copiedCasilla = signal<string | null>(null);

  // ==========================================
  // ESTADO LIBRO DE VENTAS DETALLADO
  // ==========================================
  readonly ventasItems = signal<LibroVentaItem[]>([]);

  readonly sumVentasExonerado = computed(() =>
    Math.round(this.ventasItems().reduce((acc, v) => acc + (Number(v.exonerado) || 0), 0) * 100) / 100
  );
  readonly sumVentasExento = computed(() =>
    Math.round(this.ventasItems().reduce((acc, v) => acc + (Number(v.exento) || 0), 0) * 100) / 100
  );
  readonly sumVentasGravado15 = computed(() =>
    Math.round(this.ventasItems().reduce((acc, v) => acc + (Number(v.gravado15) || 0), 0) * 100) / 100
  );
  readonly sumVentasGravado18 = computed(() =>
    Math.round(this.ventasItems().reduce((acc, v) => acc + (Number(v.gravado18) || 0), 0) * 100) / 100
  );
  readonly sumVentasIsv15 = computed(() =>
    Math.round(this.ventasItems().reduce((acc, v) => acc + (Number(v.isv15) || 0), 0) * 100) / 100
  );
  readonly sumVentasIsv18 = computed(() =>
    Math.round(this.ventasItems().reduce((acc, v) => acc + (Number(v.isv18) || 0), 0) * 100) / 100
  );
  readonly sumVentasDebito = computed(() =>
    Math.round((this.sumVentasIsv15() + this.sumVentasIsv18()) * 100) / 100
  );
  readonly sumVentasTotal = computed(() =>
    Math.round((this.sumVentasExonerado() + this.sumVentasExento() + this.sumVentasGravado15() + this.sumVentasGravado18() + this.sumVentasDebito()) * 100) / 100
  );

  // ==========================================
  // ESTADO LIBRO DE COMPRAS DETALLADO
  // ==========================================
  readonly comprasItems = signal<LibroCompraItem[]>([]);

  readonly sumComprasExonerado = computed(() =>
    Math.round(this.comprasItems().reduce((acc, c) => acc + (Number(c.exonerado) || 0), 0) * 100) / 100
  );
  readonly sumComprasExento = computed(() =>
    Math.round(this.comprasItems().reduce((acc, c) => acc + (Number(c.exento) || 0), 0) * 100) / 100
  );
  readonly sumComprasGravado15 = computed(() =>
    Math.round(this.comprasItems().reduce((acc, c) => acc + (Number(c.gravado15) || 0), 0) * 100) / 100
  );
  readonly sumComprasGravado18 = computed(() =>
    Math.round(this.comprasItems().reduce((acc, c) => acc + (Number(c.gravado18) || 0), 0) * 100) / 100
  );
  readonly sumComprasIsv15 = computed(() =>
    Math.round(this.comprasItems().reduce((acc, c) => acc + (Number(c.isv15) || 0), 0) * 100) / 100
  );
  readonly sumComprasIsv18 = computed(() =>
    Math.round(this.comprasItems().reduce((acc, c) => acc + (Number(c.isv18) || 0), 0) * 100) / 100
  );
  readonly sumComprasCredito = computed(() =>
    Math.round((this.sumComprasIsv15() + this.sumComprasIsv18()) * 100) / 100
  );
  readonly sumComprasTotal = computed(() =>
    Math.round((this.sumComprasExonerado() + this.sumComprasExento() + this.sumComprasGravado15() + this.sumComprasGravado18() + this.sumComprasCredito()) * 100) / 100
  );

  // ==========================================
  // ESTADO LIQUIDACIÓN CONSOLIDADA SAR
  // ==========================================
  readonly saldoAnterior = signal<number>(0);
  readonly retenciones15 = signal<number>(0);
  readonly retenciones18 = signal<number>(0);
  readonly totalRetenciones = computed(() =>
    Math.round(((Number(this.retenciones15()) || 0) + (Number(this.retenciones18()) || 0)) * 100) / 100
  );
  readonly serviciosProfesionales = signal<number>(0);
  readonly marcarLiquidado = signal<boolean>(false);
  readonly numeroDeclaracion = signal<string>('');

  // Cálculos en vivo de liquidación consolidada
  readonly liveDiferenciaIsv = computed(() => {
    const debito = this.sumVentasDebito();
    const credito = this.sumComprasCredito();
    const saldoAnt = Number(this.saldoAnterior()) || 0;
    const ret = this.totalRetenciones();
    return Math.round((debito - credito - saldoAnt - ret) * 100) / 100;
  });

  readonly liveImpuestoPagar = computed(() =>
    this.liveDiferenciaIsv() > 0 ? this.liveDiferenciaIsv() : 0
  );

  readonly liveSaldoFavor = computed(() =>
    this.liveDiferenciaIsv() < 0 ? Math.abs(this.liveDiferenciaIsv()) : 0
  );

  readonly liveTotalLps = computed(() => {
    const honorarios = Number(this.serviciosProfesionales()) || 0;
    return Math.round((this.liveImpuestoPagar() + honorarios) * 100) / 100;
  });

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

  cargarDatosPeriodo(): void {
    const cid = this.selectedClienteId();
    if (!cid) return;

    this.isLoading.set(true);
    this.errorMsg.set(null);

    this.librosService.getLibroCompleto(cid, this.selectedAnio(), this.selectedMes()).subscribe({
      next: (data) => {
        // Ventas
        if (data.ventasItems && data.ventasItems.length > 0) {
          this.ventasItems.set(data.ventasItems);
        } else {
          this.ventasItems.set([this.crearVentaVacia(1)]);
        }

        // Compras
        if (data.comprasItems && data.comprasItems.length > 0) {
          this.comprasItems.set(data.comprasItems);
        } else {
          this.comprasItems.set([this.crearCompraVacia(1)]);
        }

        // Liquidación
        if (data.liquidacion) {
          this.saldoAnterior.set(data.liquidacion.saldoAFavorPeriodoAnterior || 0);
          this.retenciones15.set(data.liquidacion.retenciones15 || 0);
          this.retenciones18.set(data.liquidacion.retenciones18 || 0);
          this.serviciosProfesionales.set(data.liquidacion.serviciosProfesionales || (this.selectedCliente()?.cuotaMensual || 0));
        }

        this.marcarLiquidado.set(data.liquidadoSAR);
        this.numeroDeclaracion.set(data.numeroDeclaracionSAR || '');
        this.isLoading.set(false);
      },
      error: () => {
        this.ventasItems.set([this.crearVentaVacia(1)]);
        this.comprasItems.set([this.crearCompraVacia(1)]);
        this.isLoading.set(false);
      }
    });
  }

  // ==========================================
  // OPERACIONES LIBRO DE VENTAS
  // ==========================================
  crearVentaVacia(correlativo: number): LibroVentaItem {
    const today = new Date().toISOString().split('T')[0];
    return {
      correlativo,
      fecha: today,
      factura: '',
      exonerado: 0,
      exento: 0,
      gravado15: 0,
      gravado18: 0,
      isv15: 0,
      isv18: 0,
      total: 0,
      notas: ''
    };
  }

  agregarFilaVenta(): void {
    const current = this.ventasItems();
    const nextCorrelativo = current.length + 1;
    this.ventasItems.update(list => [...list, this.crearVentaVacia(nextCorrelativo)]);
  }

  eliminarFilaVenta(index: number): void {
    const current = this.ventasItems();
    if (current.length <= 1) {
      this.ventasItems.set([this.crearVentaVacia(1)]);
      return;
    }
    const updated = current.filter((_, i) => i !== index).map((item, idx) => ({
      ...item,
      correlativo: idx + 1
    }));
    this.ventasItems.set(updated);
  }

  onVentaGravada15Change(item: LibroVentaItem): void {
    const grav = Number(item.gravado15) || 0;
    item.isv15 = Math.round(grav * 0.15 * 100) / 100;
    this.recalcVentaTotal(item);
  }

  onVentaGravada18Change(item: LibroVentaItem): void {
    const grav = Number(item.gravado18) || 0;
    item.isv18 = Math.round(grav * 0.18 * 100) / 100;
    this.recalcVentaTotal(item);
  }

  recalcVentaTotal(item: LibroVentaItem): void {
    const exon = Number(item.exonerado) || 0;
    const exen = Number(item.exento) || 0;
    const grav15 = Number(item.gravado15) || 0;
    const grav18 = Number(item.gravado18) || 0;
    const isv15 = Number(item.isv15) || 0;
    const isv18 = Number(item.isv18) || 0;
    item.total = Math.round((exon + exen + grav15 + grav18 + isv15 + isv18) * 100) / 100;
    this.ventasItems.update(list => [...list]);
  }

  // ==========================================
  // OPERACIONES LIBRO DE COMPRAS
  // ==========================================
  crearCompraVacia(correlativo: number): LibroCompraItem {
    const today = new Date().toISOString().split('T')[0];
    return {
      correlativo,
      fecha: today,
      factura: '',
      proveedor: '',
      exonerado: 0,
      exento: 0,
      gravado15: 0,
      gravado18: 0,
      isv15: 0,
      isv18: 0,
      total: 0,
      notas: ''
    };
  }

  agregarFilaCompra(): void {
    const current = this.comprasItems();
    const nextCorrelativo = current.length + 1;
    this.comprasItems.update(list => [...list, this.crearCompraVacia(nextCorrelativo)]);
  }

  eliminarFilaCompra(index: number): void {
    const current = this.comprasItems();
    if (current.length <= 1) {
      this.comprasItems.set([this.crearCompraVacia(1)]);
      return;
    }
    const updated = current.filter((_, i) => i !== index).map((item, idx) => ({
      ...item,
      correlativo: idx + 1
    }));
    this.comprasItems.set(updated);
  }

  onCompraGravada15Change(item: LibroCompraItem): void {
    const grav = Number(item.gravado15) || 0;
    item.isv15 = Math.round(grav * 0.15 * 100) / 100;
    this.recalcCompraTotal(item);
  }

  onCompraGravada18Change(item: LibroCompraItem): void {
    const grav = Number(item.gravado18) || 0;
    item.isv18 = Math.round(grav * 0.18 * 100) / 100;
    this.recalcCompraTotal(item);
  }

  recalcCompraTotal(item: LibroCompraItem): void {
    const exon = Number(item.exonerado) || 0;
    const exen = Number(item.exento) || 0;
    const grav15 = Number(item.gravado15) || 0;
    const grav18 = Number(item.gravado18) || 0;
    const isv15 = Number(item.isv15) || 0;
    const isv18 = Number(item.isv18) || 0;
    item.total = Math.round((exon + exen + grav15 + grav18 + isv15 + isv18) * 100) / 100;
    this.comprasItems.update(list => [...list]);
  }

  // ==========================================
  // GUARDAR LIBROS Y LIQUIDACIÓN COMPLETA
  // ==========================================
  guardarTodo(): void {
    const cid = this.selectedClienteId();
    if (!cid) {
      this.errorMsg.set('Seleccione un contribuyente.');
      return;
    }

    this.isSaving.set(true);
    this.errorMsg.set(null);

    const req: GuardarLibroCompletoRequest = {
      clienteId: cid,
      mes: this.selectedMes(),
      anio: this.selectedAnio(),
      saldoAFavorPeriodoAnterior: Number(this.saldoAnterior()) || 0,
      retenciones15: Number(this.retenciones15()) || 0,
      retenciones18: Number(this.retenciones18()) || 0,
      serviciosProfesionales: Number(this.serviciosProfesionales()) || 0,
      marcarComoLiquidado: this.marcarLiquidado(),
      numeroDeclaracionSAR: this.numeroDeclaracion().trim() || undefined,
      ventasItems: this.ventasItems(),
      comprasItems: this.comprasItems()
    };

    this.librosService.guardarLibroCompleto(req).subscribe({
      next: (res) => {
        this.ventasItems.set(res.ventasItems && res.ventasItems.length > 0 ? res.ventasItems : [this.crearVentaVacia(1)]);
        this.comprasItems.set(res.comprasItems && res.comprasItems.length > 0 ? res.comprasItems : [this.crearCompraVacia(1)]);
        this.isSaving.set(false);
        this.showToast('¡Libros de Ventas, Compras y Liquidación SAR guardados exitosamente!');
      },
      error: (err) => {
        this.isSaving.set(false);
        this.errorMsg.set(err.error?.mensaje || 'Error al guardar los libros de compras y ventas.');
      }
    });
  }

  // ==========================================
  // COPIADO RÁPIDO PARA EL PORTAL DEL SAR (1-CLIC)
  // ==========================================
  copiarCasilla(valor: number | string | undefined | null, nombreCasilla: string): void {
    let textToCopy = '0.00';
    if (typeof valor === 'number') {
      textToCopy = valor.toFixed(2);
    } else if (valor) {
      textToCopy = String(valor);
    }

    navigator.clipboard.writeText(textToCopy).then(() => {
      this.copiedCasilla.set(nombreCasilla);
      setTimeout(() => {
        if (this.copiedCasilla() === nombreCasilla) {
          this.copiedCasilla.set(null);
        }
      }, 2500);
    }).catch(() => {
      const input = document.createElement('textarea');
      input.value = textToCopy;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      this.copiedCasilla.set(nombreCasilla);
      setTimeout(() => this.copiedCasilla.set(null), 2500);
    });
  }

  togglePasswordSAR(): void {
    this.mostrarSARPassword.update(v => !v);
  }

  // ==========================================
  // IMPORTACIÓN DIRECTA DE EXCEL (EJEMPLO.XLSX)
  // ==========================================
  onExcelSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    this.procesarArchivoExcel(input.files[0]);
    input.value = '';
  }

  onExcelDrop(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer && event.dataTransfer.files.length > 0) {
      this.procesarArchivoExcel(event.dataTransfer.files[0]);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  private procesarArchivoExcel(file: File): void {
    this.isImportingExcel.set(true);
    this.errorMsg.set(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        
        if (!rawData || rawData.length < 2) {
          throw new Error('El archivo Excel está vacío.');
        }

        const nuevasVentas: LibroVentaItem[] = [];
        const nuevasCompras: LibroCompraItem[] = [];
        let seqVentas = 1;
        let seqCompras = 1;

        // Inspeccionar si es formato EJEMPLO.xlsx con Ventas a la izquierda y Compras a la derecha
        // o si son filas consecutivas
        for (let r = 2; r < rawData.length; r++) {
          const row = rawData[r];
          if (!row || row.length === 0) continue;

          // Detectar Ventas (Col A..I: Fecha=0, Factura=1, Exon=2, Exen=3, Grav15=4, Grav18=5, Isv15=6, Isv18=7, Tot=8)
          const fechaV = this.parseDateCell(row[0]);
          const facV = String(row[1] || '').trim();
          const grav15V = parseFloat(row[4]) || 0;
          const grav18V = parseFloat(row[5]) || 0;
          const exonV = parseFloat(row[2]) || 0;
          const exenV = parseFloat(row[3]) || 0;

          if (facV || grav15V > 0 || grav18V > 0 || exonV > 0 || exenV > 0) {
            const isv15 = Math.round(grav15V * 0.15 * 100) / 100;
            const isv18 = Math.round(grav18V * 0.18 * 100) / 100;
            const tot = Math.round((exonV + exenV + grav15V + grav18V + isv15 + isv18) * 100) / 100;
            nuevasVentas.push({
              correlativo: seqVentas++,
              fecha: fechaV,
              factura: facV,
              exonerado: exonV,
              exento: exenV,
              gravado15: grav15V,
              gravado18: grav18V,
              isv15: isv15,
              isv18: isv18,
              total: tot
            });
          }

          // Detectar Compras (Col K..U: Fecha=11, Factura=12, Proveedor=13, Exon=14, Exen=15, Grav15=16, Grav18=17, Isv15=18, Isv18=19, Tot=20)
          const colOffset = row.length > 11 ? 11 : -1;
          if (colOffset >= 0) {
            const fechaC = this.parseDateCell(row[colOffset]);
            const facC = String(row[colOffset + 1] || '').trim();
            const provC = String(row[colOffset + 2] || '').trim();
            const exonC = parseFloat(row[colOffset + 3]) || 0;
            const exenC = parseFloat(row[colOffset + 4]) || 0;
            const grav15C = parseFloat(row[colOffset + 5]) || 0;
            const grav18C = parseFloat(row[colOffset + 6]) || 0;

            if (facC || provC || grav15C > 0 || grav18C > 0 || exonC > 0 || exenC > 0) {
              const isv15 = Math.round(grav15C * 0.15 * 100) / 100;
              const isv18 = Math.round(grav18C * 0.18 * 100) / 100;
              const tot = Math.round((exonC + exenC + grav15C + grav18C + isv15 + isv18) * 100) / 100;
              nuevasCompras.push({
                correlativo: seqCompras++,
                fecha: fechaC,
                factura: facC,
                proveedor: provC,
                exonerado: exonC,
                exento: exenC,
                gravado15: grav15C,
                gravado18: grav18C,
                isv15: isv15,
                isv18: isv18,
                total: tot
              });
            }
          }
        }

        if (nuevasVentas.length > 0) {
          this.ventasItems.set(nuevasVentas);
        }
        if (nuevasCompras.length > 0) {
          this.comprasItems.set(nuevasCompras);
        }

        this.isImportingExcel.set(false);
        this.showToast(`¡Excel cargado con éxito! (${nuevasVentas.length} ventas, ${nuevasCompras.length} compras)`);
      } catch (err: any) {
        this.isImportingExcel.set(false);
        this.errorMsg.set('Error al procesar el archivo Excel: ' + (err.message || 'Estructura no reconocida.'));
      }
    };
    reader.readAsArrayBuffer(file);
  }

  private parseDateCell(val: any): string {
    if (!val) return new Date().toISOString().split('T')[0];
    if (typeof val === 'number') {
      const dateObj = new Date(Math.round((val - 25569) * 86400 * 1000));
      return !isNaN(dateObj.getTime()) ? dateObj.toISOString().split('T')[0] : '';
    }
    const str = String(val).trim();
    return str.length >= 10 ? str.substring(0, 10) : str;
  }

  // ==========================================
  // EXPORTACIÓN PDF Y EXCEL OFICIAL
  // ==========================================
  descargarPdfOficial(): void {
    const cli = this.selectedCliente();
    if (!cli) {
      this.errorMsg.set('Seleccione un contribuyente para generar el PDF.');
      return;
    }

    const rv: ResumenVentasCasillas = {
      totalExonerado: this.sumVentasExonerado(),
      totalExento: this.sumVentasExento(),
      totalGravado15: this.sumVentasGravado15(),
      totalGravado18: this.sumVentasGravado18(),
      totalIsv15: this.sumVentasIsv15(),
      totalIsv18: this.sumVentasIsv18(),
      totalDebitoFiscal: this.sumVentasDebito(),
      totalGeneral: this.sumVentasTotal()
    };

    const rc: ResumenComprasCasillas = {
      totalExonerado: this.sumComprasExonerado(),
      totalExento: this.sumComprasExento(),
      totalGravado15: this.sumComprasGravado15(),
      totalGravado18: this.sumComprasGravado18(),
      totalIsv15: this.sumComprasIsv15(),
      totalIsv18: this.sumComprasIsv18(),
      totalCreditoFiscal: this.sumComprasCredito(),
      totalGeneral: this.sumComprasTotal()
    };

    const liq: LiquidacionConsolidada = {
      debitoFiscalVentas: this.sumVentasDebito(),
      creditoFiscalCompras: this.sumComprasCredito(),
      diferenciaIsv: this.liveDiferenciaIsv(),
      saldoAFavorPeriodoAnterior: Number(this.saldoAnterior()) || 0,
      retenciones15: Number(this.retenciones15()) || 0,
      retenciones18: Number(this.retenciones18()) || 0,
      totalRetenciones: this.totalRetenciones(),
      liquidacionFinalPagar: this.liveImpuestoPagar(),
      saldoAFavorContribuyente: this.liveSaldoFavor(),
      serviciosProfesionales: Number(this.serviciosProfesionales()) || 0,
      totalPagarLps: this.liveTotalLps()
    };

    this.pdfService.generarLibroDualPdf({
      cliente: cli,
      mesNombre: this.selectedMesNombre(),
      mes: this.selectedMes(),
      anio: this.selectedAnio(),
      ventas: this.ventasItems(),
      compras: this.comprasItems(),
      resumenVentas: rv,
      resumenCompras: rc,
      liquidacion: liq
    }, true);

    this.showToast('¡PDF Oficial de Libros de Compras y Ventas descargado!');
  }

  exportarExcelOficial(): void {
    const cli = this.selectedCliente();
    if (!cli) {
      this.errorMsg.set('Seleccione un contribuyente para exportar a Excel.');
      return;
    }

    const rv: ResumenVentasCasillas = {
      totalExonerado: this.sumVentasExonerado(),
      totalExento: this.sumVentasExento(),
      totalGravado15: this.sumVentasGravado15(),
      totalGravado18: this.sumVentasGravado18(),
      totalIsv15: this.sumVentasIsv15(),
      totalIsv18: this.sumVentasIsv18(),
      totalDebitoFiscal: this.sumVentasDebito(),
      totalGeneral: this.sumVentasTotal()
    };

    const rc: ResumenComprasCasillas = {
      totalExonerado: this.sumComprasExonerado(),
      totalExento: this.sumComprasExento(),
      totalGravado15: this.sumComprasGravado15(),
      totalGravado18: this.sumComprasGravado18(),
      totalIsv15: this.sumComprasIsv15(),
      totalIsv18: this.sumComprasIsv18(),
      totalCreditoFiscal: this.sumComprasCredito(),
      totalGeneral: this.sumComprasTotal()
    };

    const liq: LiquidacionConsolidada = {
      debitoFiscalVentas: this.sumVentasDebito(),
      creditoFiscalCompras: this.sumComprasCredito(),
      diferenciaIsv: this.liveDiferenciaIsv(),
      saldoAFavorPeriodoAnterior: Number(this.saldoAnterior()) || 0,
      retenciones15: Number(this.retenciones15()) || 0,
      retenciones18: Number(this.retenciones18()) || 0,
      totalRetenciones: this.totalRetenciones(),
      liquidacionFinalPagar: this.liveImpuestoPagar(),
      saldoAFavorContribuyente: this.liveSaldoFavor(),
      serviciosProfesionales: Number(this.serviciosProfesionales()) || 0,
      totalPagarLps: this.liveTotalLps()
    };

    this.pdfService.exportarLibroDualExcel({
      cliente: cli,
      mesNombre: this.selectedMesNombre(),
      mes: this.selectedMes(),
      anio: this.selectedAnio(),
      ventas: this.ventasItems(),
      compras: this.comprasItems(),
      resumenVentas: rv,
      resumenCompras: rc,
      liquidacion: liq
    });

    this.showToast('¡Libro de Compras y Ventas exportado a Excel (.xlsx)!');
  }

  // ==========================================
  // CARGA MASIVA DE PERÍODOS FISCALES
  // ==========================================
  descargarPlantilla(): void {
    window.location.href = this.librosService.descargarPlantillaUrl();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.procesarArchivoCsv(input.files[0]);
    }
  }

  onFileDrop(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer && event.dataTransfer.files.length > 0) {
      this.procesarArchivoCsv(event.dataTransfer.files[0]);
    }
  }

  private procesarArchivoCsv(file: File): void {
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
        const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
        if (cols.length < 5) continue;

        const rtn = cols[0];
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
          numeroDeclaracionSAR: cols[13] || undefined
        });
      }

      if (rows.length === 0) {
        this.parseError.set('No se encontraron filas con formato válido en el archivo.');
        return;
      }

      this.parsedRows.set(rows);
    } catch {
      this.parseError.set('Error al procesar el archivo CSV. Verifique el formato.');
    }
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

  private showToast(msg: string): void {
    this.successMsg.set(msg);
    setTimeout(() => this.successMsg.set(null), 3500);
  }
}
