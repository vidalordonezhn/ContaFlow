import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ApiPagosService, PagoResponse, PagoCreate } from '../services/api-pagos.service';
import { ApiClientsService, ClienteResponse } from '../services/api-clients.service';
import { ClientSelectorComponent } from '../shared/client-selector/client-selector.component';

export interface ReciboPreviewData {
  reciboId: number;
  numeroRecibo: string;
  clienteNombre: string;
  clienteRtn: string;
  monto: number;
  mesAplicado: string;
  telefonoWhatsApp?: string;
  blobUrl: string;
  safeUrl: SafeResourceUrl;
}

@Component({
  selector: 'app-payments',
  standalone: true,
  imports: [CommonModule, FormsModule, ClientSelectorComponent],
  templateUrl: './payments.component.html',
  styleUrl: './payments.component.scss'
})
export class PaymentsComponent implements OnInit {
  private readonly pagosService = inject(ApiPagosService);
  private readonly clientsService = inject(ApiClientsService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly pagos = signal<PagoResponse[]>([]);
  readonly clientes = signal<ClienteResponse[]>([]);
  readonly isLoading = signal(true);
  readonly errorMsg = signal<string | null>(null);
  readonly successMsg = signal<string | null>(null);

  // Visor / Previsualizador de Recibo Modal
  readonly previewRecibo = signal<ReciboPreviewData | null>(null);

  // Filtros
  readonly searchQuery = signal('');
  readonly activeTab = signal<'todos' | 'transferencia' | 'efectivo' | 'deposito'>('todos');

  // Modal
  readonly isModalOpen = signal(false);
  readonly formError = signal<string | null>(null);

  // Opciones estándar para selección de período
  readonly mesesList = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  readonly aniosList = [2024, 2025, 2026, 2027, 2028];

  // Formulario de Pago
  readonly formClienteId = signal<number | null>(null);
  readonly formMonto = signal<number>(0);
  readonly formFechaPago = signal<string>(new Date().toISOString().substring(0, 10));
  readonly formMetodoPago = signal<string>('Transferencia');
  readonly formReferencia = signal<string>('');
  readonly formMes = signal<string>(this.mesesList[new Date().getMonth()]);
  readonly formAnio = signal<number>(new Date().getFullYear());
  readonly formMesAplicado = computed(() => `${this.formMes()} ${this.formAnio()}`);
  readonly formObservaciones = signal<string>('');
  readonly formGenerarRecibo = signal<boolean>(true);

  // Verificación de duplicados para el cliente y mes seleccionado
  readonly pagoDuplicado = computed(() => {
    const clienteId = this.formClienteId();
    const mes = this.formMesAplicado();
    if (!clienteId || !mes) return null;
    return this.pagos().find(p => 
      p.clienteId === clienteId && 
      p.mesAplicado.trim().toLowerCase() === mes.trim().toLowerCase()
    ) || null;
  });

  // KPIs
  readonly kpiTotalRecaudado = computed(() =>
    this.pagos().reduce((sum, p) => sum + Number(p.monto || 0), 0)
  );
  readonly kpiTotalPagos = computed(() => this.pagos().length);
  readonly kpiRecibosEmitidos = computed(() => this.pagos().filter(p => p.reciboId).length);

  // Filtrado
  readonly filteredPagos = computed(() => {
    const tab = this.activeTab();
    const query = this.searchQuery().toLowerCase().trim();

    return this.pagos().filter(p => {
      let matchTab = true;
      if (tab !== 'todos') {
        matchTab = p.metodoPago.toLowerCase() === tab;
      }
      if (!matchTab) return false;

      if (!query) return true;
      return p.clienteNombre.toLowerCase().includes(query) ||
             p.clienteRtn.toLowerCase().includes(query) ||
             (p.numeroRecibo && p.numeroRecibo.toLowerCase().includes(query)) ||
             p.mesAplicado.toLowerCase().includes(query) ||
             (p.referenciaBancaria && p.referenciaBancaria.toLowerCase().includes(query));
    });
  });

  ngOnInit(): void {
    this.cargarDatos();
  }

  cargarDatos(): void {
    this.isLoading.set(true);
    this.pagosService.getPagos().subscribe({
      next: (data) => {
        this.pagos.set(data);
        this.clientsService.getClientes().subscribe(cls => this.clientes.set(cls.filter(c => c.activo)));
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMsg.set('Error al cargar historial de pagos.');
        this.isLoading.set(false);
      }
    });
  }

  openCreateModal(): void {
    const hoy = new Date();
    this.formClienteId.set(this.clientes().length > 0 ? this.clientes()[0].id : null);
    if (this.clientes().length > 0) {
      this.formMonto.set(Number(this.clientes()[0].cuotaMensual) || 0);
    } else {
      this.formMonto.set(0);
    }
    this.formFechaPago.set(hoy.toISOString().substring(0, 10));
    this.formMetodoPago.set('Transferencia');
    this.formReferencia.set('');
    this.formMes.set(this.mesesList[hoy.getMonth()]);
    this.formAnio.set(hoy.getFullYear());
    this.formObservaciones.set('');
    this.formGenerarRecibo.set(true);
    this.formError.set(null);
    this.isModalOpen.set(true);
  }

  setMesRapido(offsetMeses: number): void {
    const d = new Date();
    d.setMonth(d.getMonth() + offsetMeses);
    this.formMes.set(this.mesesList[d.getMonth()]);
    this.formAnio.set(d.getFullYear());
  }

  onClienteChange(clienteId: number): void {
    this.formClienteId.set(clienteId);
    const cliente = this.clientes().find(c => c.id === Number(clienteId));
    if (cliente) {
      this.formMonto.set(Number(cliente.cuotaMensual) || 0);
    }
  }

  onClientSelected(cliente: ClienteResponse): void {
    this.formClienteId.set(cliente.id);
    this.formMonto.set(Number(cliente.cuotaMensual) || 0);
  }

  onClientCleared(): void {
    this.formClienteId.set(null);
    this.formMonto.set(0);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
    this.formError.set(null);
  }

  registrarPago(): void {
    this.formError.set(null);

    if (!this.formClienteId()) {
      this.formError.set('Debes seleccionar un cliente.');
      return;
    }
    if (!this.formMonto() || this.formMonto() <= 0) {
      this.formError.set('El monto debe ser mayor a 0.');
      return;
    }
    if (!this.formMesAplicado().trim()) {
      this.formError.set('El mes aplicado es obligatorio.');
      return;
    }

    const dto: PagoCreate = {
      clienteId: Number(this.formClienteId()),
      monto: Number(this.formMonto()),
      fechaPago: new Date(this.formFechaPago()).toISOString(),
      metodoPago: this.formMetodoPago(),
      referenciaBancaria: this.formReferencia().trim() || undefined,
      mesAplicado: this.formMesAplicado().trim(),
      observaciones: this.formObservaciones().trim() || undefined,
      generarRecibo: this.formGenerarRecibo()
    };

    this.pagosService.registrarPago(dto).subscribe({
      next: (res) => {
        this.showToast(`Pago registrado con éxito. Recibo: ${res.numeroRecibo || 'Generado'}`);
        this.closeModal();
        this.cargarDatos();
      },
      error: (err) => {
        this.formError.set(err.error?.mensaje || 'Error al registrar el pago.');
      }
    });
  }

  descargarRecibo(reciboId: number, numeroRecibo: string): void {
    this.pagosService.descargarReciboPdf(reciboId).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${numeroRecibo}.pdf`;
        link.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => {
        this.errorMsg.set('No se pudo descargar el recibo PDF.');
      }
    });
  }

  abrirVisorRecibo(pago: PagoResponse): void {
    if (!pago.reciboId) return;

    this.pagosService.descargarReciboPdf(pago.reciboId).subscribe({
      next: (blob) => {
        const blobUrl = window.URL.createObjectURL(blob);
        const safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(blobUrl);

        const cliente = this.clientes().find(c => c.id === pago.clienteId);
        const whatsapp = cliente?.telefonoWhatsApp || cliente?.telefono;

        this.previewRecibo.set({
          reciboId: pago.reciboId!,
          numeroRecibo: pago.numeroRecibo || 'Recibo Oficial',
          clienteNombre: pago.clienteNombre,
          clienteRtn: pago.clienteRtn,
          monto: Number(pago.monto),
          mesAplicado: pago.mesAplicado,
          telefonoWhatsApp: whatsapp,
          blobUrl,
          safeUrl
        });
      },
      error: () => {
        this.errorMsg.set('No se pudo cargar la vista previa del recibo.');
      }
    });
  }

  cerrarVisorRecibo(): void {
    const curr = this.previewRecibo();
    if (curr?.blobUrl) {
      window.URL.revokeObjectURL(curr.blobUrl);
    }
    this.previewRecibo.set(null);
  }

  imprimirReciboDesdeVisor(): void {
    const curr = this.previewRecibo();
    if (curr?.blobUrl) {
      const win = window.open(curr.blobUrl, '_blank');
      if (win) {
        win.focus();
      }
    }
  }

  enviarWhatsAppPago(pago: { clienteNombre: string; clienteId?: number; monto: number; mesAplicado: string; numeroRecibo?: string; telefonoWhatsApp?: string }): void {
    let phone = pago.telefonoWhatsApp;
    if (!phone && pago.clienteId) {
      const cliente = this.clientes().find(c => c.id === pago.clienteId);
      phone = cliente?.telefonoWhatsApp || cliente?.telefono;
    }

    if (!phone) {
      this.showToast(`El cliente "${pago.clienteNombre}" no tiene número de WhatsApp registrado.`);
      return;
    }

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const fullPhone = cleanPhone.startsWith('504') ? cleanPhone : `504${cleanPhone}`;
    const montoFormatted = Number(pago.monto).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const mensaje = `Estimado(a) ${pago.clienteNombre},\n\nLe saluda su despacho contable. Le confirmamos con agrado la recepción de su pago de honorarios correspondiente al mes de ${pago.mesAplicado} por un valor de L. ${montoFormatted}.\n\n📄 Recibo Oficial N°: ${pago.numeroRecibo || 'Generado'}.\n\n¡Muchas gracias por su puntualidad y confianza!`;

    const url = `https://wa.me/${fullPhone}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
  }

  private showToast(msg: string): void {
    this.successMsg.set(msg);
    setTimeout(() => this.successMsg.set(null), 3500);
  }
}
