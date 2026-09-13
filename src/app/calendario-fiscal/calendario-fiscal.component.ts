import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiCalendarioService, HitoFiscal, CalendarioFiscalResumen, ClienteSeguimiento, ActualizarSeguimientoDto } from '../services/api-calendario.service';

@Component({
  selector: 'app-calendario-fiscal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './calendario-fiscal.component.html',
  styleUrl: './calendario-fiscal.component.scss'
})
export class CalendarioFiscalComponent implements OnInit {
  private readonly calendarioService = inject(ApiCalendarioService);

  readonly anioSeleccionado = signal<number>(new Date().getFullYear());
  readonly aniosDisponibles = [2024, 2025, 2026, 2027, 2028];

  readonly loading = signal<boolean>(true);
  readonly loadingDetalle = signal<boolean>(false);
  readonly savingModal = signal<boolean>(false);
  readonly successMsg = signal<string | null>(null);
  readonly errorMsg = signal<string | null>(null);

  readonly resumen = signal<CalendarioFiscalResumen | null>(null);
  readonly hitoSeleccionado = signal<HitoFiscal | null>(null);
  readonly clientesSeguimiento = signal<ClienteSeguimiento[]>([]);
  readonly filtroEstado = signal<'TODOS' | 'Pendiente' | 'EnProceso' | 'Declarado' | 'NoAplica'>('TODOS');
  readonly searchQuery = signal<string>('');

  // Modal para editar liquidación / declaración
  readonly isModalOpen = signal<boolean>(false);
  readonly modalCliente = signal<ClienteSeguimiento | null>(null);
  modalEstado: string = 'Declarado';
  modalMonto?: number;
  modalNumeroDeclaracion: string = '';
  modalFechaCumplimiento: string = new Date().toISOString().split('T')[0];
  modalObservaciones: string = '';

  readonly clientesFiltrados = computed(() => {
    let list = this.clientesSeguimiento();
    const query = this.searchQuery().toLowerCase().trim();
    const estado = this.filtroEstado();

    if (estado !== 'TODOS') {
      list = list.filter(c => c.estado === estado);
    }

    if (query) {
      list = list.filter(c =>
        c.nombreRazonSocial.toLowerCase().includes(query) ||
        (c.nombreComercial && c.nombreComercial.toLowerCase().includes(query)) ||
        c.rtn.includes(query)
      );
    }

    return list;
  });

  ngOnInit(): void {
    this.cargarCalendario();
  }

  cambiarAnio(anio: number): void {
    this.anioSeleccionado.set(anio);
    this.cargarCalendario();
  }

  cargarCalendario(): void {
    this.loading.set(true);
    this.calendarioService.getCalendarioAnual(this.anioSeleccionado()).subscribe({
      next: (data) => {
        this.resumen.set(data);
        this.loading.set(false);

        // Seleccionar por defecto el próximo hito o el primero de la lista
        const targetHito = data.proximoHito || data.hitos[0];
        if (targetHito) {
          this.seleccionarHito(targetHito);
        }
      },
      error: (err) => {
        console.error('Error al cargar calendario fiscal:', err);
        this.loading.set(false);
      }
    });
  }

  seleccionarHito(hito: HitoFiscal): void {
    this.hitoSeleccionado.set(hito);
    this.loadingDetalle.set(true);
    this.calendarioService.getClientesPorObligacion(this.anioSeleccionado(), hito.codigo).subscribe({
      next: (clientes) => {
        this.clientesSeguimiento.set(clientes);
        this.loadingDetalle.set(false);
      },
      error: (err) => {
        console.error('Error al cargar detalle de clientes para hito:', err);
        this.loadingDetalle.set(false);
      }
    });
  }

  actualizarEstadoRapido(cliente: ClienteSeguimiento, nuevoEstado: 'Pendiente' | 'EnProceso' | 'Declarado' | 'NoAplica'): void {
    cliente.estado = nuevoEstado;
    const dto: ActualizarSeguimientoDto = {
      clienteId: cliente.clienteId,
      anio: this.anioSeleccionado(),
      tipoObligacion: cliente.tipoObligacion,
      estado: nuevoEstado,
      montoDeclarado: cliente.montoDeclarado,
      numeroDeclaracionSAR: cliente.numeroDeclaracionSAR,
      fechaCumplimiento: nuevoEstado === 'Declarado' ? (cliente.fechaCumplimiento || new Date().toISOString()) : undefined,
      observaciones: cliente.observaciones
    };

    this.calendarioService.actualizarEstado(dto).subscribe({
      next: () => {
        this.showToast(`Estado de "${cliente.nombreRazonSocial}" actualizado a ${nuevoEstado}.`);
        this.refrescarResumenHitos();
      },
      error: () => {
        this.showToast('Error al actualizar estado.');
      }
    });
  }

  abrirModalDetalle(cliente: ClienteSeguimiento): void {
    this.modalCliente.set(cliente);
    this.modalEstado = cliente.estado;
    this.modalMonto = cliente.montoDeclarado;
    this.modalNumeroDeclaracion = cliente.numeroDeclaracionSAR || '';
    this.modalFechaCumplimiento = cliente.fechaCumplimiento ? cliente.fechaCumplimiento.split('T')[0] : new Date().toISOString().split('T')[0];
    this.modalObservaciones = cliente.observaciones || '';
    this.isModalOpen.set(true);
  }

  cerrarModal(): void {
    this.isModalOpen.set(false);
    this.modalCliente.set(null);
  }

  guardarModal(): void {
    const c = this.modalCliente();
    if (!c) return;

    this.savingModal.set(true);
    const dto: ActualizarSeguimientoDto = {
      clienteId: c.clienteId,
      anio: this.anioSeleccionado(),
      tipoObligacion: c.tipoObligacion,
      estado: this.modalEstado,
      montoDeclarado: this.modalMonto,
      numeroDeclaracionSAR: this.modalNumeroDeclaracion,
      fechaCumplimiento: this.modalEstado === 'Declarado' ? new Date(this.modalFechaCumplimiento).toISOString() : undefined,
      observaciones: this.modalObservaciones
    };

    this.calendarioService.actualizarEstado(dto).subscribe({
      next: () => {
        c.estado = this.modalEstado as any;
        c.montoDeclarado = this.modalMonto;
        c.numeroDeclaracionSAR = this.modalNumeroDeclaracion;
        c.fechaCumplimiento = dto.fechaCumplimiento;
        c.observaciones = this.modalObservaciones;

        this.savingModal.set(false);
        this.cerrarModal();
        this.showToast(`Liquidación SAR de "${c.nombreRazonSocial}" guardada con éxito.`);
        this.refrescarResumenHitos();
      },
      error: () => {
        this.savingModal.set(false);
        this.showToast('Error al guardar datos.');
      }
    });
  }

  enviarWhatsApp(cliente: ClienteSeguimiento): void {
    let telefono = cliente.telefonoWhatsApp || '';
    telefono = telefono.replace(/[^0-9]/g, '');
    if (telefono.length === 8) {
      telefono = '504' + telefono;
    }

    if (!telefono) {
      alert(`El cliente "${cliente.nombreRazonSocial}" no tiene número de WhatsApp registrado.`);
      return;
    }

    const hito = this.hitoSeleccionado();
    const titulo = hito ? hito.titulo : 'Obligación Fiscal SAR';
    const formulario = hito ? hito.formularioSAR : 'SAR';
    const fecha = hito ? `${hito.diaVencimiento} de ${hito.mesNombre} de ${this.anioSeleccionado()}` : 'fin de mes';

    let mensaje = '';
    if (hito?.codigo === 'ISR_ANUAL') {
      mensaje = `Estimado(a) *${cliente.nombreRazonSocial}*, le saluda su despacho contable. Le recordamos cordialmente que el próximo *${fecha}* vence el plazo legal ante el SAR para la presentación y pago de la *Declaración Anual de Impuesto Sobre la Renta (ISR ${this.anioSeleccionado()})* (${formulario}). Le solicitamos coordinar la entrega de su información contable a la brevedad. ¡Muchas gracias!`;
    } else if (hito?.codigo.startsWith('PAGO_CUENTA')) {
      mensaje = `Estimado(a) *${cliente.nombreRazonSocial}*, un cordial saludo de su despacho contable. Le recordamos amablemente que el *${fecha}* vence la cuota obligatoria del *${titulo}* del SAR (${formulario}). Agradecemos coordinar con tiempo su cálculo y liquidación.`;
    } else if (hito?.codigo === 'RETENCIONES_ANUAL') {
      mensaje = `Estimado(a) *${cliente.nombreRazonSocial}*, le saluda su contador. Le recordamos que el *${fecha}* vence la *Declaración Informativa Anual de Retenciones* (${formulario}) ante el SAR. Quedamos a sus órdenes para la preparación de su informe.`;
    } else {
      mensaje = `Estimado(a) *${cliente.nombreRazonSocial}*, le recordamos que el *${fecha}* vence la obligación fiscal ante el SAR: *${titulo}*.`;
    }

    const url = `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
  }

  private refrescarResumenHitos(): void {
    this.calendarioService.getCalendarioAnual(this.anioSeleccionado()).subscribe({
      next: (data) => {
        this.resumen.set(data);
        const current = this.hitoSeleccionado();
        if (current) {
          const updated = data.hitos.find(h => h.codigo === current.codigo);
          if (updated) this.hitoSeleccionado.set(updated);
        }
      }
    });
  }

  private showToast(msg: string): void {
    this.successMsg.set(msg);
    setTimeout(() => this.successMsg.set(null), 4000);
  }
}
