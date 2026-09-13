import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ApiPagosService, PagoResponse } from '../services/api-pagos.service';
import { ApiClientsService, ClienteResponse } from '../services/api-clients.service';

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
  selector: 'app-receipts',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './receipts.component.html',
  styleUrl: './receipts.component.scss'
})
export class ReceiptsComponent implements OnInit {
  private readonly pagosService = inject(ApiPagosService);
  private readonly clientsService = inject(ApiClientsService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly recibos = signal<PagoResponse[]>([]);
  readonly clientes = signal<ClienteResponse[]>([]);
  readonly isLoading = signal(true);
  readonly searchQuery = signal('');
  readonly successMsg = signal<string | null>(null);

  // Modal de vista previa del recibo
  readonly previewRecibo = signal<ReciboPreviewData | null>(null);

  readonly recibosValidos = computed(() =>
    this.recibos().filter(r => r.reciboId && r.numeroRecibo)
  );

  readonly filteredRecibos = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    return this.recibosValidos().filter(r => {
      if (!query) return true;
      return (r.numeroRecibo && r.numeroRecibo.toLowerCase().includes(query)) ||
             r.clienteNombre.toLowerCase().includes(query) ||
             r.clienteRtn.toLowerCase().includes(query) ||
             r.mesAplicado.toLowerCase().includes(query);
    });
  });

  ngOnInit(): void {
    this.cargarRecibos();
  }

  cargarRecibos(): void {
    this.isLoading.set(true);
    this.pagosService.getPagos().subscribe({
      next: (data) => {
        this.recibos.set(data);
        this.clientsService.getClientes().subscribe(cls => this.clientes.set(cls));
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      }
    });
  }

  descargarPdf(reciboId: number, numeroRecibo: string): void {
    this.pagosService.descargarReciboPdf(reciboId).subscribe(blob => {
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${numeroRecibo}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    });
  }

  abrirVisorRecibo(r: PagoResponse): void {
    if (!r.reciboId) return;

    this.pagosService.descargarReciboPdf(r.reciboId).subscribe(blob => {
      const blobUrl = window.URL.createObjectURL(blob);
      const safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(blobUrl);

      const cliente = this.clientes().find(c => c.id === r.clienteId);
      const whatsapp = cliente?.telefonoWhatsApp || cliente?.telefono;

      this.previewRecibo.set({
        reciboId: r.reciboId!,
        numeroRecibo: r.numeroRecibo || 'Recibo Oficial',
        clienteNombre: r.clienteNombre,
        clienteRtn: r.clienteRtn,
        monto: Number(r.monto),
        mesAplicado: r.mesAplicado,
        telefonoWhatsApp: whatsapp,
        blobUrl,
        safeUrl
      });
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

  enviarWhatsAppPago(r: { clienteNombre: string; clienteId?: number; monto: number; mesAplicado: string; numeroRecibo?: string; telefonoWhatsApp?: string }): void {
    let phone = r.telefonoWhatsApp;
    if (!phone && r.clienteId) {
      const cliente = this.clientes().find(c => c.id === r.clienteId);
      phone = cliente?.telefonoWhatsApp || cliente?.telefono;
    }

    if (!phone) {
      this.showToast(`El cliente "${r.clienteNombre}" no tiene número de WhatsApp registrado.`);
      return;
    }

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const fullPhone = cleanPhone.startsWith('504') ? cleanPhone : `504${cleanPhone}`;
    const montoFormatted = Number(r.monto).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const mensaje = `Estimado(a) ${r.clienteNombre},\n\nLe saluda su despacho contable. Le confirmamos con agrado la recepción de su pago de honorarios correspondiente al mes de ${r.mesAplicado} por un valor de L. ${montoFormatted}.\n\n📄 Recibo Oficial N°: ${r.numeroRecibo || 'Generado'}.\n\n¡Muchas gracias por su puntualidad y confianza!`;

    const url = `https://wa.me/${fullPhone}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
  }

  private showToast(msg: string): void {
    this.successMsg.set(msg);
    setTimeout(() => this.successMsg.set(null), 3500);
  }
}
