import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiSARService, PeriodoSARResponse } from '../services/api-sar.service';
import { ApiClientsService, ClienteResponse } from '../services/api-clients.service';
import { ApiPagosService, PagoResponse } from '../services/api-pagos.service';
import { ApiConfiguracionService, ConfiguracionDespacho } from '../services/api-configuracion.service';
import { ApiRecordatoriosService, RecordatorioResponse, RecordatorioCreate } from '../services/api-recordatorios.service';
import { ClientSelectorComponent } from '../shared/client-selector/client-selector.component';

export type EstadoRecordatorio = 'Pendiente' | 'Enviado' | 'Respondido' | 'Omitido';

export interface ClienteNotifView {
  id: number;
  nombreRazonSocial: string;
  nombreComercial?: string;
  rtn: string;
  rubro?: string;
  telefono?: string;
  telefonoWhatsApp?: string;
  emailPrincipal?: string;
  cuotaMensual: number;
  diaCobro: number;
  tieneFacturasPendientesSAR: boolean;
  periodoSAR?: PeriodoSARResponse;
  tieneCobroPendiente: boolean;
  avisos: RecordatorioResponse[];
  avisosPendientesCount: number;
  avisosEnviadosCount: number;
}

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, FormsModule, ClientSelectorComponent],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.scss'
})
export class NotificationsComponent implements OnInit {
  private readonly sarService = inject(ApiSARService);
  private readonly clientsService = inject(ApiClientsService);
  private readonly pagosService = inject(ApiPagosService);
  private readonly configService = inject(ApiConfiguracionService);
  private readonly recordatoriosService = inject(ApiRecordatoriosService);

  readonly clientes = signal<ClienteResponse[]>([]);
  readonly periodosSAR = signal<PeriodoSARResponse[]>([]);
  readonly pagos = signal<PagoResponse[]>([]);
  readonly recordatorios = signal<RecordatorioResponse[]>([]);
  readonly configDespacho = signal<ConfiguracionDespacho | null>(null);

  readonly isLoading = signal(true);
  readonly isSaving = signal(false);
  readonly successMsg = signal<string | null>(null);
  readonly errorMsg = signal<string | null>(null);

  // Tabs de navegación
  readonly activeTab = signal<'manual' | 'sar' | 'cobros' | 'todos'>('todos');
  readonly searchQuery = signal('');
  readonly filtroClienteEstado = signal<'todos' | 'sar_pendiente' | 'cobro_pendiente' | 'con_avisos'>('todos');

  // Modal para agregar recordatorio
  readonly isModalOpen = signal(false);
  readonly modalClienteId = signal<number | null>(null);
  readonly modalTipo = signal<'SAR' | 'Cobro' | 'Declaracion' | 'Personalizado'>('SAR');
  readonly modalMensaje = signal('');
  readonly modalError = signal<string | null>(null);

  // Modal / Drawer de detalle de avisos por cliente
  readonly clienteDetalleAvisos = signal<ClienteNotifView | null>(null);

  // Plantillas de mensajes predefinidas
  readonly plantillas: Record<string, string> = {
    SAR: 'Estimado(a) {cliente}, le saluda su despacho contable. Le recordamos amablemente ir entregando sus facturas de compras y ventas de {mes} para tener la documentación completa lista para su declaración ante el SAR. ¡Muchas gracias!',
    Cobro: 'Estimado(a) {cliente}, un cordial saludo de su despacho contable. Le recordamos amablemente la cuota de honorarios correspondiente al mes de {mes} por valor de L. {cuota}. Agradecemos su puntual pago mediante transferencia o depósito.',
    Declaracion: 'Estimado(a) {cliente}, le informamos con agrado que su declaración tributaria ante el SAR del mes de {mes} ha sido presentada exitosamente. Adjuntamos su comprobante. Quedamos a sus órdenes.',
    Personalizado: 'Estimado(a) {cliente}, le saluda su contador. Le contactamos para coordinar lo siguiente respecto a su cuenta contable: '
  };

  readonly mesActual = computed(() => {
    const hoy = new Date();
    const nombres = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return `${nombres[hoy.getMonth()]} ${hoy.getFullYear()}`;
  });

  // Lista unificada y enriquecida de clientes con todos sus estados cruzados
  readonly clientesEnriquecidos = computed<ClienteNotifView[]>(() => {
    const cls = this.clientes();
    const sars = this.periodosSAR();
    const pgs = this.pagos();
    const recs = this.recordatorios();
    const mes = this.mesActual().toLowerCase();

    const pagosMes = pgs.filter(p => p.mesAplicado.toLowerCase().includes(mes));
    const clienteIdsPagados = new Set(pagosMes.map(p => p.clienteId));

    return cls.map(c => {
      const periodo = sars.find(s => s.clienteId === c.id);
      const facturasPendientes = periodo ? !periodo.facturasRecibidas : true;
      const cobroPendiente = !clienteIdsPagados.has(c.id);
      const clienteAvisos = recs.filter(r => r.clienteId === c.id);
      const pend = clienteAvisos.filter(r => r.estado === 'Pendiente').length;
      const env = clienteAvisos.filter(r => r.estado === 'Enviado' || r.estado === 'Respondido').length;

      return {
        id: c.id,
        nombreRazonSocial: c.nombreRazonSocial,
        nombreComercial: c.nombreComercial,
        rtn: c.rtn,
        rubro: c.rubro,
        telefono: c.telefono,
        telefonoWhatsApp: c.telefonoWhatsApp,
        emailPrincipal: c.emailPrincipal,
        cuotaMensual: c.cuotaMensual,
        diaCobro: c.diaCobro,
        tieneFacturasPendientesSAR: facturasPendientes,
        periodoSAR: periodo,
        tieneCobroPendiente: cobroPendiente,
        avisos: clienteAvisos,
        avisosPendientesCount: pend,
        avisosEnviadosCount: env
      };
    });
  });

  // Clientes con facturas SAR pendientes
  readonly pendientesSAR = computed(() => {
    return this.clientesEnriquecidos().filter(c => c.tieneFacturasPendientesSAR);
  });

  // Clientes con honorarios pendientes de pago este mes
  readonly pendientesCobro = computed(() => {
    return this.clientesEnriquecidos().filter(c => c.tieneCobroPendiente);
  });

  // Clientes filtrados para la pestaña Todos los Clientes
  readonly filteredClientes = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const filtro = this.filtroClienteEstado();
    let list = this.clientesEnriquecidos();

    if (filtro === 'sar_pendiente') {
      list = list.filter(c => c.tieneFacturasPendientesSAR);
    } else if (filtro === 'cobro_pendiente') {
      list = list.filter(c => c.tieneCobroPendiente);
    } else if (filtro === 'con_avisos') {
      list = list.filter(c => c.avisos.length > 0);
    }

    if (!q) return list;
    return list.filter(c => 
      c.nombreRazonSocial.toLowerCase().includes(q) || 
      c.rtn.toLowerCase().includes(q) ||
      (c.nombreComercial && c.nombreComercial.toLowerCase().includes(q)) ||
      (c.rubro && c.rubro.toLowerCase().includes(q))
    );
  });

  // Avisos filtrados para la pestaña Mi Lista de Avisos
  readonly filteredRecordatorios = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const list = this.recordatorios();
    if (!q) return list;
    return list.filter(r => 
      r.clienteNombre.toLowerCase().includes(q) || 
      r.clienteRtn.toLowerCase().includes(q) ||
      r.mensaje.toLowerCase().includes(q) ||
      r.tipo.toLowerCase().includes(q)
    );
  });

  readonly totalAvisosPendientes = computed(() => {
    return this.recordatorios().filter(r => r.estado === 'Pendiente').length;
  });

  ngOnInit(): void {
    this.cargarDatos();
  }

  cargarDatos(): void {
    this.isLoading.set(true);
    const hoy = new Date();
    this.clientsService.getClientes().subscribe({
      next: (cls) => {
        this.clientes.set(cls);
        this.sarService.getPeriodos(hoy.getMonth() + 1, hoy.getFullYear()).subscribe({
          next: (sars: PeriodoSARResponse[]) => this.periodosSAR.set(sars),
          error: () => {}
        });
        this.pagosService.getPagos().subscribe({
          next: (pgs) => this.pagos.set(pgs),
          error: () => {}
        });
        this.configService.getConfiguracion().subscribe({
          next: (cfg) => this.configDespacho.set(cfg),
          error: () => {}
        });
        this.recordatoriosService.getRecordatorios().subscribe({
          next: (recs) => this.recordatorios.set(recs),
          error: () => {}
        });
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMsg.set('Error al cargar clientes y estados.');
        this.isLoading.set(false);
      }
    });
  }

  recargarRecordatorios(): void {
    this.recordatoriosService.getRecordatorios().subscribe({
      next: (recs) => {
        this.recordatorios.set(recs);
        // Si hay un cliente abierto en detalle, actualizarlo
        const currentDetalle = this.clienteDetalleAvisos();
        if (currentDetalle) {
          const updated = this.clientesEnriquecidos().find(c => c.id === currentDetalle.id);
          if (updated) this.clienteDetalleAvisos.set(updated);
        }
      }
    });
  }

  openNewReminderModal(preselectedClientId?: number, tipo: 'SAR' | 'Cobro' | 'Declaracion' | 'Personalizado' = 'SAR'): void {
    this.modalClienteId.set(preselectedClientId || (this.clientes().length > 0 ? this.clientes()[0].id : null));
    this.modalTipo.set(tipo);
    this.modalError.set(null);
    this.actualizarMensajeModal();
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
    this.modalError.set(null);
  }

  verAvisosDeCliente(cliente: ClienteNotifView): void {
    this.clienteDetalleAvisos.set(cliente);
  }

  cerrarDetalleAvisos(): void {
    this.clienteDetalleAvisos.set(null);
  }

  onModalTipoChange(tipo: 'SAR' | 'Cobro' | 'Declaracion' | 'Personalizado'): void {
    this.modalTipo.set(tipo);
    this.actualizarMensajeModal();
  }

  onModalClienteSelected(cliente: ClienteResponse): void {
    this.modalClienteId.set(cliente.id);
    this.actualizarMensajeModal();
  }

  onModalClienteCleared(): void {
    this.modalClienteId.set(null);
  }

  private actualizarMensajeModal(): void {
    const cliente = this.clientes().find(c => c.id === this.modalClienteId());
    const tipo = this.modalTipo();
    let template = this.plantillas[tipo] || this.plantillas['SAR'];

    const nombre = cliente ? cliente.nombreRazonSocial : 'Contribuyente';
    const cuota = cliente ? Number(cliente.cuotaMensual).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';
    const mes = this.mesActual();

    template = template
      .replace('{cliente}', nombre)
      .replace('{cuota}', cuota)
      .replace('{mes}', mes);

    if (tipo === 'Cobro') {
      const cfg = this.configDespacho();
      if (cfg && cfg.banco1Activo && cfg.banco1Numero) {
        template += ` Puede depositar a ${cfg.banco1Nombre} (${cfg.banco1TipoCuenta}): ${cfg.banco1Numero} a nombre de ${cfg.banco1Beneficiario}.`;
      }
    }

    this.modalMensaje.set(template);
  }

  guardarRecordatorio(): void {
    const clienteId = this.modalClienteId();
    if (!clienteId) {
      this.modalError.set('Debes seleccionar un cliente.');
      return;
    }

    const cliente = this.clientes().find(c => c.id === clienteId);
    if (!cliente) return;

    this.isSaving.set(true);
    const dto: RecordatorioCreate = {
      clienteId: cliente.id,
      tipo: this.modalTipo(),
      titulo: `Aviso ${this.modalTipo()} - ${this.mesActual()}`,
      mensaje: this.modalMensaje(),
      canal: 'WhatsApp',
      estado: 'Pendiente',
      telefonoDestino: cliente.telefonoWhatsApp || cliente.telefono,
      emailDestino: cliente.emailPrincipal
    };

    this.recordatoriosService.crearRecordatorio(dto).subscribe({
      next: (creado) => {
        this.isSaving.set(false);
        this.recordatorios.update(list => [creado, ...list]);
        this.showToast(`Aviso asignado exitosamente a "${cliente.nombreRazonSocial}".`);
        this.closeModal();
        this.recargarRecordatorios();
      },
      error: () => {
        this.isSaving.set(false);
        this.modalError.set('Ocurrió un error al guardar el aviso en la base de datos.');
      }
    });
  }

  agregarDesdeSugerencia(cliente: ClienteNotifView, tipo: 'SAR' | 'Cobro'): void {
    const yaExiste = cliente.avisos.some(r => r.tipo === tipo && r.estado === 'Pendiente');
    if (yaExiste) {
      this.showToast(`"${cliente.nombreRazonSocial}" ya tiene un aviso pendiente de ${tipo}.`);
      return;
    }

    let template = this.plantillas[tipo];
    const cuota = Number(cliente.cuotaMensual || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    template = template
      .replace('{cliente}', cliente.nombreRazonSocial)
      .replace('{cuota}', cuota)
      .replace('{mes}', this.mesActual());

    if (tipo === 'Cobro') {
      const cfg = this.configDespacho();
      if (cfg && cfg.banco1Activo && cfg.banco1Numero) {
        template += ` Puede depositar a ${cfg.banco1Nombre} (${cfg.banco1TipoCuenta}): ${cfg.banco1Numero} a nombre de ${cfg.banco1Beneficiario}.`;
      }
    }

    const dto: RecordatorioCreate = {
      clienteId: cliente.id,
      tipo: tipo,
      titulo: `Aviso ${tipo} - ${this.mesActual()}`,
      mensaje: template,
      canal: 'WhatsApp',
      estado: 'Pendiente',
      telefonoDestino: cliente.telefonoWhatsApp || cliente.telefono,
      emailDestino: cliente.emailPrincipal
    };

    this.recordatoriosService.crearRecordatorio(dto).subscribe({
      next: (creado) => {
        this.recordatorios.update(list => [creado, ...list]);
        this.showToast(`Aviso de ${tipo} creado para "${cliente.nombreRazonSocial}".`);
        this.recargarRecordatorios();
      },
      error: () => {
        this.showToast('Error al crear el aviso sugerido.');
      }
    });
  }

  cambiarEstado(reminderId: number, nuevoEstado: EstadoRecordatorio): void {
    this.recordatoriosService.actualizarEstado(reminderId, { estado: nuevoEstado }).subscribe({
      next: (actualizado) => {
        this.recordatorios.update(list => list.map(r => r.id === reminderId ? actualizado : r));
        this.showToast(`Estado actualizado a: ${nuevoEstado}`);
        this.recargarRecordatorios();
      },
      error: () => {
        this.showToast('Error al actualizar estado del aviso.');
      }
    });
  }

  eliminarRecordatorio(reminderId: number): void {
    this.recordatoriosService.eliminarRecordatorio(reminderId).subscribe({
      next: () => {
        this.recordatorios.update(list => list.filter(r => r.id !== reminderId));
        this.showToast('Aviso eliminado correctamente.');
        this.recargarRecordatorios();
      },
      error: () => {
        this.showToast('Error al eliminar aviso.');
      }
    });
  }

  limpiarEnviados(): void {
    this.recordatoriosService.limpiarEnviados().subscribe({
      next: (resp) => {
        this.showToast(resp.mensaje || 'Se limpiaron los avisos gestionados.');
        this.recargarRecordatorios();
      },
      error: () => {
        this.showToast('Error al limpiar los avisos.');
      }
    });
  }

  enviarPorWhatsApp(reminder: RecordatorioResponse): void {
    const url = this.getWhatsAppUrl(reminder.telefonoWhatsApp, reminder.mensaje);
    if (url !== '#') {
      window.open(url, '_blank');
      if (reminder.estado === 'Pendiente') {
        this.cambiarEstado(reminder.id, 'Enviado');
      }
    } else {
      this.showToast('El cliente no tiene número de teléfono registrado.');
    }
  }

  getWhatsAppUrl(phone?: string, mensaje?: string): string {
    if (!phone) return '#';
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const fullPhone = cleanPhone.startsWith('504') ? cleanPhone : `504${cleanPhone}`;
    const msg = encodeURIComponent(mensaje || this.plantillas['SAR']);
    return `https://wa.me/${fullPhone}?text=${msg}`;
  }

  getEmailUrl(email?: string, asunto?: string, mensaje?: string): string {
    if (!email) return '#';
    const subj = encodeURIComponent(asunto || 'Aviso de Despacho Contable');
    const body = encodeURIComponent(mensaje || '');
    return `mailto:${email}?subject=${subj}&body=${body}`;
  }

  private showToast(msg: string): void {
    this.successMsg.set(msg);
    setTimeout(() => this.successMsg.set(null), 3500);
  }
}
