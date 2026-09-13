import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiSARService, PeriodoSARResponse } from '../services/api-sar.service';
import { ApiClientsService, ClienteResponse } from '../services/api-clients.service';
import { ApiPagosService, PagoResponse } from '../services/api-pagos.service';
import { ApiConfiguracionService, ConfiguracionDespacho } from '../services/api-configuracion.service';
import { ClientSelectorComponent } from '../shared/client-selector/client-selector.component';

export type EstadoRecordatorio = 'Pendiente' | 'Enviado' | 'Respondido' | 'Omitido';

export interface ManualReminder {
  id: string;
  clienteId: number;
  clienteNombre: string;
  clienteRtn: string;
  telefonoWhatsApp?: string;
  email?: string;
  cuotaMensual?: number;
  tipo: 'SAR' | 'Cobro' | 'Declaracion' | 'Personalizado';
  mensaje: string;
  fechaCreacion: string;
  enviado?: boolean;
  estado: EstadoRecordatorio;
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

  readonly clientes = signal<ClienteResponse[]>([]);
  readonly periodosSAR = signal<PeriodoSARResponse[]>([]);
  readonly pagos = signal<PagoResponse[]>([]);
  readonly manualReminders = signal<ManualReminder[]>([]);
  readonly configDespacho = signal<ConfiguracionDespacho | null>(null);

  readonly isLoading = signal(true);
  readonly successMsg = signal<string | null>(null);
  readonly errorMsg = signal<string | null>(null);

  // Tabs de navegación
  readonly activeTab = signal<'manual' | 'sar' | 'cobros' | 'todos'>('manual');
  readonly searchQuery = signal('');

  // Modal para agregar recordatorio manual
  readonly isModalOpen = signal(false);
  readonly modalClienteId = signal<number | null>(null);
  readonly modalTipo = signal<'SAR' | 'Cobro' | 'Declaracion' | 'Personalizado'>('SAR');
  readonly modalMensaje = signal('');
  readonly modalError = signal<string | null>(null);

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

  // Clientes con facturas SAR pendientes
  readonly pendientesSAR = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const list = this.periodosSAR().filter(p => !p.facturasRecibidas);
    if (!q) return list;
    return list.filter(p => 
      p.clienteNombre.toLowerCase().includes(q) || 
      p.clienteRtn.toLowerCase().includes(q)
    );
  });

  // Clientes con honorarios pendientes de pago este mes
  readonly pendientesCobro = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const mes = this.mesActual().toLowerCase();
    
    // Clientes que no tienen pago registrado este mes
    const pagosMes = this.pagos().filter(p => p.mesAplicado.toLowerCase().includes(mes));
    const clienteIdsPagados = new Set(pagosMes.map(p => p.clienteId));

    const noPagados = this.clientes().filter(c => c.activo && !clienteIdsPagados.has(c.id));

    if (!q) return noPagados;
    return noPagados.filter(c => 
      c.nombreRazonSocial.toLowerCase().includes(q) || 
      c.rtn.toLowerCase().includes(q) ||
      (c.nombreComercial && c.nombreComercial.toLowerCase().includes(q))
    );
  });

  // Clientes filtrados para directorio completo
  readonly filteredClientes = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const list = this.clientes().filter(c => c.activo);
    if (!q) return list;
    return list.filter(c => 
      c.nombreRazonSocial.toLowerCase().includes(q) || 
      c.rtn.toLowerCase().includes(q) ||
      (c.nombreComercial && c.nombreComercial.toLowerCase().includes(q)) ||
      (c.rubro && c.rubro.toLowerCase().includes(q))
    );
  });

  // Recordatorios manuales filtrados
  readonly filteredManualReminders = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const list = this.manualReminders();
    if (!q) return list;
    return list.filter(r => 
      r.clienteNombre.toLowerCase().includes(q) || 
      r.clienteRtn.toLowerCase().includes(q) ||
      r.mensaje.toLowerCase().includes(q)
    );
  });

  ngOnInit(): void {
    this.cargarDatos();
    this.cargarManualRemindersDeStorage();
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
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMsg.set('Error al cargar clientes y estados.');
        this.isLoading.set(false);
      }
    });
  }

  cargarManualRemindersDeStorage(): void {
    try {
      const stored = localStorage.getItem('contaflow_manual_reminders');
      if (stored) {
        const parsed: any[] = JSON.parse(stored);
        const normalized: ManualReminder[] = parsed.map(r => ({
          ...r,
          estado: (r.estado as EstadoRecordatorio) || (r.enviado ? 'Enviado' : 'Pendiente'),
          enviado: r.estado === 'Enviado' || r.estado === 'Respondido' || !!r.enviado
        }));
        this.manualReminders.set(normalized);
      }
    } catch {
      this.manualReminders.set([]);
    }
  }

  guardarManualRemindersEnStorage(): void {
    try {
      localStorage.setItem('contaflow_manual_reminders', JSON.stringify(this.manualReminders()));
    } catch {}
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

    const newReminder: ManualReminder = {
      id: 'rem_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      clienteId: cliente.id,
      clienteNombre: cliente.nombreRazonSocial,
      clienteRtn: cliente.rtn,
      telefonoWhatsApp: cliente.telefonoWhatsApp || cliente.telefono,
      email: cliente.emailPrincipal,
      cuotaMensual: cliente.cuotaMensual,
      tipo: this.modalTipo(),
      mensaje: this.modalMensaje(),
      fechaCreacion: new Date().toISOString(),
      estado: 'Pendiente',
      enviado: false
    };

    this.manualReminders.update(list => [newReminder, ...list]);
    this.guardarManualRemindersEnStorage();
    this.showToast(`Recordatorio para "${cliente.nombreRazonSocial}" guardado en tu lista.`);
    this.closeModal();
    this.activeTab.set('manual');
  }

  agregarDesdeSugerencia(cliente: { id: number; nombreRazonSocial: string; rtn: string; telefonoWhatsApp?: string; telefono?: string; emailPrincipal?: string; cuotaMensual?: number }, tipo: 'SAR' | 'Cobro'): void {
    const yaExiste = this.manualReminders().some(r => r.clienteId === cliente.id && r.tipo === tipo && r.estado === 'Pendiente');
    if (yaExiste) {
      this.showToast(`"${cliente.nombreRazonSocial}" ya está en tu lista como pendiente.`);
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

    const newReminder: ManualReminder = {
      id: 'rem_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      clienteId: cliente.id,
      clienteNombre: cliente.nombreRazonSocial,
      clienteRtn: cliente.rtn,
      telefonoWhatsApp: cliente.telefonoWhatsApp || cliente.telefono,
      email: cliente.emailPrincipal,
      cuotaMensual: cliente.cuotaMensual,
      tipo: tipo,
      mensaje: template,
      fechaCreacion: new Date().toISOString(),
      estado: 'Pendiente',
      enviado: false
    };

    this.manualReminders.update(list => [newReminder, ...list]);
    this.guardarManualRemindersEnStorage();
    this.showToast(`Se agregó a "${cliente.nombreRazonSocial}" a la lista de avisos.`);
  }

  cambiarEstado(reminderId: string, nuevoEstado: EstadoRecordatorio): void {
    this.manualReminders.update(list => 
      list.map(r => r.id === reminderId ? { 
        ...r, 
        estado: nuevoEstado, 
        enviado: nuevoEstado === 'Enviado' || nuevoEstado === 'Respondido' 
      } : r)
    );
    this.guardarManualRemindersEnStorage();
    this.showToast(`Estado actualizado a: ${nuevoEstado}`);
  }

  eliminarRecordatorio(reminderId: string): void {
    this.manualReminders.update(list => list.filter(r => r.id !== reminderId));
    this.guardarManualRemindersEnStorage();
    this.showToast('Recordatorio eliminado de la lista.');
  }

  limpiarEnviados(): void {
    this.manualReminders.update(list => list.filter(r => r.estado === 'Pendiente'));
    this.guardarManualRemindersEnStorage();
    this.showToast('Se limpiaron los recordatorios gestionados.');
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
