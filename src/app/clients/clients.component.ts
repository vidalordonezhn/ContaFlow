import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiClientsService, ClienteResponse, ClienteCreate, ClienteUpdate, ExpedienteFiscal } from '../services/api-clients.service';

@Component({
  selector: 'app-clients',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './clients.component.html',
  styleUrl: './clients.component.scss'
})
export class ClientsComponent implements OnInit {
  private readonly clientsService = inject(ApiClientsService);

  readonly clientes = signal<ClienteResponse[]>([]);
  readonly isLoading = signal(true);
  readonly errorMsg = signal<string | null>(null);
  readonly successMsg = signal<string | null>(null);

  // Filtros
  readonly activeTab = signal<'todos' | 'juridicas' | 'naturales' | 'activos' | 'inactivos'>('todos');
  readonly searchQuery = signal('');
  readonly selectedRubro = signal<string>('todos');

  // Modales
  readonly isModalOpen = signal(false);
  readonly isEditing = signal(false);
  readonly selectedClienteId = signal<number | null>(null);
  readonly formError = signal<string | null>(null);

  // Modal Expediente Fiscal Digital 360°
  readonly isExpedienteModalOpen = signal(false);
  readonly selectedExpediente = signal<import('../services/api-clients.service').ExpedienteFiscal | null>(null);
  readonly loadingExpediente = signal(false);
  readonly expedienteTab = signal<'anuales' | 'mensuales' | 'recibos'>('anuales');

  // Formulario
  readonly formRtn = signal('');
  readonly formNombreRazonSocial = signal('');
  readonly formNombreComercial = signal('');
  readonly formTipoPersona = signal('Juridica');
  readonly formRubro = signal('Comercio General');
  readonly formEmailPrincipal = signal('');
  readonly formEmailSecundario = signal('');
  readonly formTelefono = signal('');
  readonly formTelefonoWhatsApp = signal('');
  readonly formDireccion = signal('');
  readonly formCuotaMensual = signal<number>(2500);
  readonly formDiaCobro = signal<number>(5);
  readonly formActivo = signal(true);
  readonly formNotas = signal('');

  // Rubros disponibles en Honduras
  readonly rubrosList = [
    'Comercio General',
    'Servicios Profesionales',
    'Restaurante / Alimentos',
    'Construcción e Ingeniería',
    'Salud y Farmacia',
    'Transporte y Logística',
    'Tecnología e Informática',
    'Bienes Raíces',
    'Taller / Automotriz',
    'Otro Rubro'
  ];

  // KPIs Computados
  readonly kpiTotal = computed(() => this.clientes().length);
  readonly kpiActivos = computed(() => this.clientes().filter(c => c.activo).length);
  readonly kpiJuridicas = computed(() => this.clientes().filter(c => c.tipoPersona === 'Juridica' && c.activo).length);
  readonly kpiNaturales = computed(() => this.clientes().filter(c => c.tipoPersona === 'Natural' && c.activo).length);
  readonly kpiCuotaTotal = computed(() => 
    this.clientes().filter(c => c.activo).reduce((sum, c) => sum + Number(c.cuotaMensual || 0), 0)
  );

  // Filtrado reactivo
  readonly filteredClientes = computed(() => {
    const tab = this.activeTab();
    const query = this.searchQuery().toLowerCase().trim();
    const rubro = this.selectedRubro();

    return this.clientes().filter(c => {
      // Pestaña
      let matchTab = true;
      if (tab === 'juridicas') matchTab = c.tipoPersona === 'Juridica' && c.activo;
      else if (tab === 'naturales') matchTab = c.tipoPersona === 'Natural' && c.activo;
      else if (tab === 'activos') matchTab = c.activo;
      else if (tab === 'inactivos') matchTab = !c.activo;

      if (!matchTab) return false;

      // Rubro
      if (rubro !== 'todos' && c.rubro !== rubro) return false;

      // Búsqueda
      if (!query) return true;
      return c.nombreRazonSocial.toLowerCase().includes(query) ||
             (c.nombreComercial && c.nombreComercial.toLowerCase().includes(query)) ||
             c.rtn.toLowerCase().includes(query) ||
             (c.rubro && c.rubro.toLowerCase().includes(query)) ||
             (c.emailPrincipal && c.emailPrincipal.toLowerCase().includes(query)) ||
             (c.telefonoWhatsApp && c.telefonoWhatsApp.toLowerCase().includes(query));
    });
  });

  ngOnInit(): void {
    this.cargarClientes();
  }

  cargarClientes(): void {
    this.isLoading.set(true);
    this.clientsService.getClientes().subscribe({
      next: (data) => {
        this.clientes.set(data);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMsg.set('No se pudo conectar con el servidor.');
        this.isLoading.set(false);
      }
    });
  }

  openCreateModal(): void {
    this.isEditing.set(false);
    this.selectedClienteId.set(null);
    this.formRtn.set('');
    this.formNombreRazonSocial.set('');
    this.formNombreComercial.set('');
    this.formTipoPersona.set('Juridica');
    this.formRubro.set('Comercio General');
    this.formEmailPrincipal.set('');
    this.formEmailSecundario.set('');
    this.formTelefono.set('');
    this.formTelefonoWhatsApp.set('');
    this.formDireccion.set('');
    this.formCuotaMensual.set(2500);
    this.formDiaCobro.set(5);
    this.formActivo.set(true);
    this.formNotas.set('');
    this.formError.set(null);
    this.isModalOpen.set(true);
  }

  openEditModal(c: ClienteResponse): void {
    this.isEditing.set(true);
    this.selectedClienteId.set(c.id);
    this.formRtn.set(c.rtn);
    this.formNombreRazonSocial.set(c.nombreRazonSocial);
    this.formNombreComercial.set(c.nombreComercial || '');
    this.formTipoPersona.set(c.tipoPersona);
    this.formRubro.set(c.rubro || 'Comercio General');
    this.formEmailPrincipal.set(c.emailPrincipal || '');
    this.formEmailSecundario.set(c.emailSecundario || '');
    this.formTelefono.set(c.telefono || '');
    this.formTelefonoWhatsApp.set(c.telefonoWhatsApp || '');
    this.formDireccion.set(c.direccion || '');
    this.formCuotaMensual.set(c.cuotaMensual);
    this.formDiaCobro.set(c.diaCobro);
    this.formActivo.set(c.activo);
    this.formNotas.set(c.notas || '');
    this.formError.set(null);
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
    this.formError.set(null);
  }

  saveCliente(): void {
    this.formError.set(null);

    if (!this.formNombreRazonSocial().trim()) {
      this.formError.set('La razón social o nombre es obligatorio.');
      return;
    }

    if (!this.isEditing()) {
      if (!this.formRtn().trim()) {
        this.formError.set('El RTN fiscal es obligatorio.');
        return;
      }

      const createDto: ClienteCreate = {
        rtn: this.formRtn().trim(),
        nombreRazonSocial: this.formNombreRazonSocial().trim(),
        nombreComercial: this.formNombreComercial().trim() || undefined,
        tipoPersona: this.formTipoPersona(),
        rubro: this.formRubro(),
        emailPrincipal: this.formEmailPrincipal().trim() || undefined,
        emailSecundario: this.formEmailSecundario().trim() || undefined,
        telefono: this.formTelefono().trim() || undefined,
        telefonoWhatsApp: this.formTelefonoWhatsApp().trim() || undefined,
        direccion: this.formDireccion().trim() || undefined,
        cuotaMensual: Number(this.formCuotaMensual()) || 0,
        diaCobro: Number(this.formDiaCobro()) || 5,
        notas: this.formNotas().trim() || undefined
      };

      this.clientsService.crearCliente(createDto).subscribe({
        next: () => {
          this.showToast('Cliente registrado exitosamente.');
          this.closeModal();
          this.cargarClientes();
        },
        error: (err) => {
          this.formError.set(err.error?.mensaje || 'Error al registrar el cliente.');
        }
      });
    } else {
      const updateDto: ClienteUpdate = {
        nombreRazonSocial: this.formNombreRazonSocial().trim(),
        nombreComercial: this.formNombreComercial().trim() || undefined,
        tipoPersona: this.formTipoPersona(),
        rubro: this.formRubro(),
        emailPrincipal: this.formEmailPrincipal().trim() || undefined,
        emailSecundario: this.formEmailSecundario().trim() || undefined,
        telefono: this.formTelefono().trim() || undefined,
        telefonoWhatsApp: this.formTelefonoWhatsApp().trim() || undefined,
        direccion: this.formDireccion().trim() || undefined,
        cuotaMensual: Number(this.formCuotaMensual()) || 0,
        diaCobro: Number(this.formDiaCobro()) || 5,
        activo: this.formActivo(),
        notas: this.formNotas().trim() || undefined
      };

      this.clientsService.actualizarCliente(this.selectedClienteId()!, updateDto).subscribe({
        next: () => {
          this.showToast('Datos del cliente actualizados correctamente.');
          this.closeModal();
          this.cargarClientes();
        },
        error: (err) => {
          this.formError.set(err.error?.mensaje || 'Error al actualizar el cliente.');
        }
      });
    }
  }

  toggleStatus(c: ClienteResponse): void {
    this.clientsService.toggleStatus(c.id).subscribe({
      next: () => {
        this.showToast(`Estado de ${c.nombreRazonSocial} actualizado.`);
        this.cargarClientes();
      },
      error: () => {
        this.errorMsg.set('No se pudo cambiar el estado.');
      }
    });
  }

  getWhatsAppLink(phone?: string, clientName?: string): string {
    if (!phone) return '#';
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const fullPhone = cleanPhone.startsWith('504') ? cleanPhone : `504${cleanPhone}`;
    const msg = encodeURIComponent(`Hola estimado ${clientName}, le saluda su despacho contable para darle seguimiento a su cuenta y documentación.`);
    return `https://wa.me/${fullPhone}?text=${msg}`;
  }

  // Expediente Fiscal Digital 360°
  openExpediente(clienteId: number): void {
    this.loadingExpediente.set(true);
    this.selectedExpediente.set(null);
    this.expedienteTab.set('anuales');
    this.isExpedienteModalOpen.set(true);

    this.clientsService.getExpedienteFiscal(clienteId).subscribe({
      next: (data) => {
        this.selectedExpediente.set(data);
        this.loadingExpediente.set(false);
      },
      error: () => {
        this.errorMsg.set('No se pudo cargar el expediente fiscal del contribuyente.');
        this.loadingExpediente.set(false);
      }
    });
  }

  closeExpediente(): void {
    this.isExpedienteModalOpen.set(false);
    this.selectedExpediente.set(null);
  }

  imprimirExpediente(): void {
    window.print();
  }

  getWhatsAppExpediente(exp: ExpedienteFiscal): string {
    const phone = exp.cliente.telefonoWhatsApp || exp.cliente.telefono;
    if (!phone) return '#';
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const fullPhone = cleanPhone.startsWith('504') ? cleanPhone : `504${cleanPhone}`;
    const msg = encodeURIComponent(
      `Estimado contribuyente *${exp.cliente.nombreRazonSocial}* (RTN: ${exp.cliente.rtn}):\n\n` +
      `Le compartimos el resumen consolidado de su *Expediente Fiscal Digital*:\n` +
      `📌 Total Declaraciones SAR Presentadas: *${exp.totalDeclaracionesPresentadas}*\n` +
      `💰 Impuesto Liquidado ante SAR: *L. ${exp.totalImpuestoLiquidadoSAR.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}*\n` +
      `🧾 Comprobantes Fiscales Emitidos: *${exp.comprobantesEmitidos.length} recibos*\n\n` +
      `Su expediente se encuentra al día en los registros de nuestro Despacho Contable.`
    );
    return `https://wa.me/${fullPhone}?text=${msg}`;
  }

  private showToast(msg: string): void {
    this.successMsg.set(msg);
    setTimeout(() => this.successMsg.set(null), 3500);
  }
}
