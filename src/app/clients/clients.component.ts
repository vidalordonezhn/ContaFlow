import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiClientsService, ClienteResponse, ClienteCreate, ClienteUpdate, ExpedienteFiscal } from '../services/api-clients.service';
import { ApiRubrosService, RubroResponse } from '../services/api-rubros.service';
import { PdfGeneratorService } from '../services/pdf-generator.service';

@Component({
  selector: 'app-clients',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './clients.component.html',
  styleUrl: './clients.component.scss'
})
export class ClientsComponent implements OnInit {
  private readonly clientsService = inject(ApiClientsService);
  private readonly rubrosService = inject(ApiRubrosService);
  private readonly pdfService = inject(PdfGeneratorService);

  readonly clientes = signal<ClienteResponse[]>([]);
  readonly rubros = signal<RubroResponse[]>([]);
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
  readonly selectedExpediente = signal<ExpedienteFiscal | null>(null);
  readonly loadingExpediente = signal(false);
  readonly expedienteTab = signal<'anuales' | 'mensuales' | 'recibos'>('anuales');

  // Modal Nuevo Rubro Rápido
  readonly isRubroModalOpen = signal(false);
  readonly nuevoRubroNombre = signal('');
  readonly nuevoRubroDesc = signal('');
  readonly rubroModalError = signal<string | null>(null);

  // Formulario
  readonly formRtn = signal('');
  readonly formNombreRazonSocial = signal('');
  readonly formNombreComercial = signal('');
  readonly formTipoPersona = signal('Juridica');
  readonly formRubro = signal('Comercio General');
  readonly formContrasenaSAR = signal('');
  readonly showPassword = signal(false);
  readonly formEmailPrincipal = signal('');
  readonly formEmailSecundario = signal('');
  readonly formTelefono = signal('');
  readonly formTelefonoWhatsApp = signal('');
  readonly formDireccion = signal('');
  readonly formCuotaMensual = signal<number>(2500);
  readonly formDiaCobro = signal<number>(5);
  readonly formActivo = signal(true);
  readonly formNotas = signal('');

  // Copiado rápido
  readonly copiedField = signal<string | null>(null);

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
    this.cargarRubros();
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

  cargarRubros(): void {
    this.rubrosService.getRubros().subscribe({
      next: (rbs) => {
        this.rubros.set(rbs);
        if (rbs.length > 0 && !this.formRubro()) {
          this.formRubro.set(rbs[0].nombre);
        }
      },
      error: () => {}
    });
  }

  openCreateModal(): void {
    this.isEditing.set(false);
    this.selectedClienteId.set(null);
    this.formRtn.set('');
    this.formNombreRazonSocial.set('');
    this.formNombreComercial.set('');
    this.formTipoPersona.set('Juridica');
    this.formRubro.set(this.rubros().length > 0 ? this.rubros()[0].nombre : 'Comercio General');
    this.formContrasenaSAR.set('');
    this.showPassword.set(false);
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
    this.formRubro.set(c.rubro || (this.rubros().length > 0 ? this.rubros()[0].nombre : 'Comercio General'));
    this.formContrasenaSAR.set(c.contrasenaSAR || '');
    this.showPassword.set(false);
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

  copiarAlPortapapeles(texto: string, label: string): void {
    if (!texto) return;
    navigator.clipboard.writeText(texto).then(() => {
      this.copiedField.set(label);
      this.showToast(`¡${label} copiado al portapapeles!`);
      setTimeout(() => this.copiedField.set(null), 2500);
    });
  }

  // Modal Nuevo Rubro
  openNuevoRubroModal(): void {
    this.nuevoRubroNombre.set('');
    this.nuevoRubroDesc.set('');
    this.rubroModalError.set(null);
    this.isRubroModalOpen.set(true);
  }

  closeNuevoRubroModal(): void {
    this.isRubroModalOpen.set(false);
    this.rubroModalError.set(null);
  }

  guardarNuevoRubro(): void {
    const nombre = this.nuevoRubroNombre().trim();
    if (!nombre) {
      this.rubroModalError.set('Ingresa el nombre del rubro.');
      return;
    }

    this.rubrosService.crearRubro({
      nombre: nombre,
      descripcion: this.nuevoRubroDesc().trim() || undefined
    }).subscribe({
      next: (nuevo) => {
        this.rubros.update(list => [...list, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre)));
        this.formRubro.set(nuevo.nombre);
        this.showToast(`Rubro "${nuevo.nombre}" agregado al catálogo.`);
        this.closeNuevoRubroModal();
      },
      error: (err) => {
        this.rubroModalError.set(err.error?.message || 'Error al crear el rubro.');
      }
    });
  }

  saveCliente(): void {
    this.formError.set(null);

    if (!this.formNombreRazonSocial().trim()) {
      this.formError.set('La razón social o nombre es obligatorio.');
      return;
    }

    if (!this.formRtn().trim()) {
      this.formError.set('El RTN fiscal es obligatorio.');
      return;
    }

    if (!this.isEditing()) {
      const createDto: ClienteCreate = {
        rtn: this.formRtn().trim(),
        nombreRazonSocial: this.formNombreRazonSocial().trim(),
        nombreComercial: this.formNombreComercial().trim() || undefined,
        tipoPersona: this.formTipoPersona(),
        rubro: this.formRubro(),
        contrasenaSAR: this.formContrasenaSAR().trim() || undefined,
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
        rtn: this.formRtn().trim(),
        nombreRazonSocial: this.formNombreRazonSocial().trim(),
        nombreComercial: this.formNombreComercial().trim() || undefined,
        tipoPersona: this.formTipoPersona(),
        rubro: this.formRubro(),
        contrasenaSAR: this.formContrasenaSAR().trim() || undefined,
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

      const id = this.selectedClienteId();
      if (!id) return;

      this.clientsService.actualizarCliente(id, updateDto).subscribe({
        next: () => {
          this.showToast('Cliente actualizado correctamente.');
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
    const accion = c.activo ? 'desactivar' : 'activar';
    if (confirm(`¿Estás seguro de que deseas ${accion} al cliente "${c.nombreRazonSocial}"?`)) {
      this.clientsService.toggleStatus(c.id).subscribe({
        next: () => {
          this.showToast(`Cliente ${c.activo ? 'desactivado' : 'activado'} correctamente.`);
          this.cargarClientes();
        },
        error: () => {
          this.showToast('Error al cambiar el estado del cliente.');
        }
      });
    }
  }

  openExpediente(clienteId: number): void {
    this.loadingExpediente.set(true);
    this.selectedExpediente.set(null);
    this.isExpedienteModalOpen.set(true);

    this.clientsService.getExpedienteFiscal(clienteId).subscribe({
      next: (data) => {
        this.selectedExpediente.set(data);
        this.loadingExpediente.set(false);
      },
      error: () => {
        this.loadingExpediente.set(false);
        this.showToast('No se pudo cargar el expediente fiscal.');
        this.closeExpediente();
      }
    });
  }

  closeExpediente(): void {
    this.isExpedienteModalOpen.set(false);
    this.selectedExpediente.set(null);
  }

  getWhatsAppLink(telefono?: string, nombre?: string): string {
    if (!telefono) return '#';
    const cleanPhone = telefono.replace(/[^0-9]/g, '');
    const fullPhone = cleanPhone.startsWith('504') ? cleanPhone : `504${cleanPhone}`;
    const msg = encodeURIComponent(`Hola ${nombre || 'Estimado Cliente'}, le saluda su despacho contable.`);
    return `https://wa.me/${fullPhone}?text=${msg}`;
  }

  getWhatsAppExpediente(exp: ExpedienteFiscal): string {
    const tel = exp.cliente.telefonoWhatsApp || exp.cliente.telefono;
    if (!tel) return '#';
    const cleanPhone = tel.replace(/[^0-9]/g, '');
    const fullPhone = cleanPhone.startsWith('504') ? cleanPhone : `504${cleanPhone}`;
    const msg = encodeURIComponent(`Estimado(a) ${exp.cliente.nombreRazonSocial}, le compartimos un resumen de su Expediente Fiscal: Declaraciones SAR presentadas: ${exp.totalDeclaracionesPresentadas}. Quedamos a sus órdenes.`);
    return `https://wa.me/${fullPhone}?text=${msg}`;
  }

  descargarExpedientePdf(): void {
    const exp = this.selectedExpediente();
    if (exp) {
      this.pdfService.generarExpedienteFiscalPdf(exp);
      this.showToast('¡Expediente Fiscal en PDF generado con éxito!');
    }
  }

  imprimirExpediente(): void {
    this.descargarExpedientePdf();
  }

  private showToast(msg: string): void {
    this.successMsg.set(msg);
    setTimeout(() => this.successMsg.set(null), 3500);
  }
}
