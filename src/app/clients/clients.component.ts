import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';
import { ApiClientsService, ClienteResponse, ClienteCreate, ClienteUpdate, ExpedienteFiscal, ClienteImportItem, ClienteImportResponse } from '../services/api-clients.service';
import { ApiRubrosService, RubroResponse } from '../services/api-rubros.service';
import { ApiGeoService, DepartamentoResponse, MunicipioResponse } from '../services/api-geo.service';
import { PdfGeneratorService } from '../services/pdf-generator.service';
import { TabsService } from '../services/tabs.service';

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
  readonly geoService = inject(ApiGeoService);
  private readonly pdfService = inject(PdfGeneratorService);
  private readonly tabsService = inject(TabsService);

  readonly clientes = signal<ClienteResponse[]>([]);
  readonly rubros = signal<RubroResponse[]>([]);
  readonly departamentos = this.geoService.departamentos;
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

  // Modal Carga Masiva de Clientes (Excel / CSV)
  readonly isImportModalOpen = signal(false);
  readonly selectedImportFile = signal<File | null>(null);
  readonly parsedClients = signal<ClienteImportItem[]>([]);
  readonly isImporting = signal(false);
  readonly importResult = signal<ClienteImportResponse | null>(null);
  readonly importError = signal<string | null>(null);

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
  readonly showPassword = signal(true);
  readonly formDni = signal('');
  readonly formRepresentanteLegalNombre = signal('');
  readonly formRepresentanteLegalRtn = signal('');
  readonly formDepartamentoId = signal<number | null>(null);
  readonly formMunicipioId = signal<number | null>(null);
  readonly formEmailPrincipal = signal('');
  readonly formEmailSecundario = signal('');
  readonly formTelefono = signal('');
  readonly formTelefonoWhatsApp = signal('');
  readonly formDireccion = signal('');
  readonly formCuotaMensual = signal<number>(0);
  readonly formDiaCobro = signal<number>(5);
  readonly formActivo = signal(true);
  readonly formNotas = signal('');

  // Copiado rápido
  readonly copiedField = signal<string | null>(null);

  // Visibilidad de contraseñas SAR en tabla (visibles por defecto, ID en Set indica oculto)
  readonly hiddenPasswords = signal<Set<number>>(new Set());

  // Municipios disponibles para el departamento seleccionado
  readonly availableMunicipios = computed<MunicipioResponse[]>(() => {
    const depId = this.formDepartamentoId();
    if (!depId) return [];
    const dep = this.departamentos().find(d => d.id === Number(depId));
    return dep ? dep.municipios : [];
  });

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
    this.geoService.cargarDepartamentos().subscribe();
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
    this.formDni.set('');
    this.formRepresentanteLegalNombre.set('');
    this.formRepresentanteLegalRtn.set('');
    this.formDepartamentoId.set(null);
    this.formMunicipioId.set(null);
    this.formEmailPrincipal.set('');
    this.formEmailSecundario.set('');
    this.formTelefono.set('');
    this.formTelefonoWhatsApp.set('');
    this.formDireccion.set('');
    this.formCuotaMensual.set(0);
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
    this.showPassword.set(true);
    this.formDni.set(c.dni || '');
    this.formRepresentanteLegalNombre.set(c.representanteLegalNombre || '');
    this.formRepresentanteLegalRtn.set(c.representanteLegalRtn || '');
    this.formDepartamentoId.set(c.departamentoId || null);
    this.formMunicipioId.set(c.municipioId || null);
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

  onRtnOrDniChange(val: string, source: 'rtn' | 'dni'): void {
    if (source === 'rtn') {
      this.formRtn.set(val);
      const clean = val.replace(/[^0-9]/g, '');
      // Si es persona natural con 14 dígitos en RTN, auto-completar DNI
      if (this.formTipoPersona() === 'Natural' && clean.length === 14 && !this.formDni()) {
        this.formDni.set(clean.substring(0, 13));
      }
    } else {
      this.formDni.set(val);
    }

    // Auto-detectar Departamento y Municipio a partir de los 4 dígitos
    const detect = this.geoService.detectarUbicacionPorRtnODni(val);
    if (detect && detect.departamentoId) {
      this.formDepartamentoId.set(detect.departamentoId);
      if (detect.municipioId) {
        this.formMunicipioId.set(detect.municipioId);
      }
    }
  }

  onDepartamentoChange(depId: any): void {
    const numId = depId ? Number(depId) : null;
    this.formDepartamentoId.set(numId);

    // Si el municipio actual no pertenece al nuevo departamento, limpiarlo
    const currentMunId = this.formMunicipioId();
    if (currentMunId) {
      const muns = this.availableMunicipios();
      if (!muns.some(m => m.id === currentMunId)) {
        this.formMunicipioId.set(null);
      }
    }
  }

  closeModal(): void {
    this.isModalOpen.set(false);
    this.formError.set(null);
  }

  copiarAlPortapapeles(texto: string, label: string): void {
    if (!texto) return;
    navigator.clipboard.writeText(texto).then(() => {
      this.copiedField.set(label);
      const friendlyName = label.includes('RTN') ? 'RTN' : label.includes('SAR') ? 'Clave SAR' : label;
      this.showToast(`¡${friendlyName} copiado al portapapeles!`);
      setTimeout(() => {
        if (this.copiedField() === label) {
          this.copiedField.set(null);
        }
      }, 2000);
    });
  }

  togglePasswordVisibility(clienteId: number): void {
    this.hiddenPasswords.update(set => {
      const newSet = new Set(set);
      if (newSet.has(clienteId)) {
        newSet.delete(clienteId);
      } else {
        newSet.add(clienteId);
      }
      return newSet;
    });
  }

  isPasswordHidden(clienteId: number): boolean {
    return this.hiddenPasswords().has(clienteId);
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

    const dep = this.departamentos().find(d => d.id === Number(this.formDepartamentoId()));
    const mun = dep?.municipios.find(m => m.id === Number(this.formMunicipioId()));

    if (!this.isEditing()) {
      const createDto: ClienteCreate = {
        rtn: this.formRtn().trim(),
        nombreRazonSocial: this.formNombreRazonSocial().trim(),
        nombreComercial: this.formNombreComercial().trim() || undefined,
        tipoPersona: this.formTipoPersona(),
        rubro: this.formRubro(),
        contrasenaSAR: this.formContrasenaSAR().trim() || undefined,
        dni: this.formDni().trim() || undefined,
        representanteLegalNombre: this.formRepresentanteLegalNombre().trim() || undefined,
        representanteLegalRtn: this.formRepresentanteLegalRtn().trim() || undefined,
        departamentoId: this.formDepartamentoId() ? Number(this.formDepartamentoId()) : undefined,
        departamentoNombre: dep?.nombre,
        municipioId: this.formMunicipioId() ? Number(this.formMunicipioId()) : undefined,
        municipioNombre: mun?.nombre,
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
        dni: this.formDni().trim() || undefined,
        representanteLegalNombre: this.formRepresentanteLegalNombre().trim() || undefined,
        representanteLegalRtn: this.formRepresentanteLegalRtn().trim() || undefined,
        departamentoId: this.formDepartamentoId() ? Number(this.formDepartamentoId()) : undefined,
        departamentoNombre: dep?.nombre,
        municipioId: this.formMunicipioId() ? Number(this.formMunicipioId()) : undefined,
        municipioNombre: mun?.nombre,
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
    
    let mensaje = `Estimado(a) *${exp.cliente.nombreRazonSocial}*, le saluda su despacho contable.\n\n`;
    mensaje += `📊 *ESTADO DE CUMPLIMIENTO FISCAL SAR*:\n`;
    mensaje += `• Declaraciones SAR Presentadas: ${exp.totalDeclaracionesPresentadas}\n`;
    mensaje += `• ISV Mensual: ${exp.detalleISV}\n`;
    mensaje += `• Pagos a Cuenta: ${exp.detallePagosACuenta}\n\n`;
    
    if (exp.estadoCobranza === 'Pendiente') {
      mensaje += `💼 *ESTADO DE CUENTA HONORARIOS*:\n`;
      mensaje += `• ${exp.mensajeCobranza}\n\n`;
      mensaje += `Le agradecemos gestionar su pago a la brevedad. Quedamos a sus órdenes para cualquier consulta.`;
    } else if (exp.estadoCobranza === 'SaldoAFavor' || exp.estadoCobranza === 'AlDia') {
      mensaje += `💼 *ESTADO DE CUENTA HONORARIOS*:\n`;
      mensaje += `• ✅ ${exp.mensajeCobranza}\n\n`;
      mensaje += `¡Muchas gracias por mantener sus cuentas e impuestos al día!`;
    } else {
      mensaje += `Quedamos a su entera disposición. ¡Feliz día!`;
    }

    return `https://wa.me/${fullPhone}?text=${encodeURIComponent(mensaje)}`;
  }

  irAGenerarRecibo(): void {
    this.closeExpediente();
    const modulo = this.tabsService.catalogoModulos.find(m => m.id === 'recibos');
    if (modulo) {
      this.tabsService.openModulo(modulo);
    }
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

  // ==========================================
  // CARGA MASIVA DE CLIENTES (EXCEL / CSV)
  // ==========================================

  openImportModal(): void {
    this.selectedImportFile.set(null);
    this.parsedClients.set([]);
    this.importResult.set(null);
    this.importError.set(null);
    this.isImportModalOpen.set(true);
  }

  closeImportModal(): void {
    this.isImportModalOpen.set(false);
    this.selectedImportFile.set(null);
    this.parsedClients.set([]);
    this.importResult.set(null);
    this.importError.set(null);
  }

  descargarPlantilla(): void {
    window.location.href = this.clientsService.descargarPlantillaUrl();
  }

  onFileSelected(event: any): void {
    const file = event.target.files?.[0];
    if (file) {
      this.procesarArchivo(file);
    }
  }

  onFileDrop(event: DragEvent): void {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.procesarArchivo(file);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  private procesarArchivo(file: File): void {
    this.selectedImportFile.set(file);
    this.importError.set(null);
    this.importResult.set(null);
    this.parsedClients.set([]);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

        if (!rawData || rawData.length < 2) {
          throw new Error('El archivo está vacío o no contiene filas de datos.');
        }

        // Buscar fila de encabezados
        let headerRowIndex = 0;
        for (let i = 0; i < Math.min(5, rawData.length); i++) {
          const rowStr = rawData[i].map((c: any) => String(c).toLowerCase()).join(' ');
          if (rowStr.includes('rtn') || rowStr.includes('nombre') || rowStr.includes('razon') || rowStr.includes('cliente')) {
            headerRowIndex = i;
            break;
          }
        }

        const headers = rawData[headerRowIndex].map((h: any) => String(h).trim().toLowerCase());
        
        // Mapeo flexible de índices
        const getColIndex = (keywords: string[]): number => {
          return headers.findIndex((h: string) => keywords.some(k => h.includes(k)));
        };

        const idxRtn = getColIndex(['rtn', 'cif', 'id']);
        const idxNombre = getColIndex(['razon', 'nombre', 'cliente', 'empresa']);
        const idxComercial = getColIndex(['comercial', 'rotulo', 'negocio', 'local']);
        const idxTipo = getColIndex(['tipo', 'persona']);
        const idxRubro = getColIndex(['rubro', 'giro', 'actividad', 'categoria']);
        const idxSar = getColIndex(['sar', 'clave', 'pass', 'contrasena', 'contraseña']);
        const idxDni = getColIndex(['dni', 'identidad', 'cedula']);
        const idxRepNombre = getColIndex(['representante', 'apoderado', 'gerente']);
        const idxRepRtn = getColIndex(['rtnrepresentante', 'rtnapoderado', 'rtnrep']);
        const idxDep = getColIndex(['departamento', 'depto', 'dep']);
        const idxMun = getColIndex(['municipio', 'ciudad', 'poblacion']);
        const idxEmail = getColIndex(['email', 'correo']);
        const idxEmailSec = getColIndex(['emailsec', 'secundario', 'correo2']);
        const idxTel = getColIndex(['tel', 'telefono', 'fijo']);
        const idxWa = getColIndex(['whatsapp', 'wa', 'cel', 'celular', 'movil']);
        const idxDir = getColIndex(['dir', 'direccion', 'domicilio']);
        const idxCuota = getColIndex(['cuota', 'honorario', 'monto', 'tarifa', 'pago', 'precio']);
        const idxDia = getColIndex(['dia', 'cobro', 'corte']);
        const idxNotas = getColIndex(['nota', 'obs', 'comentario']);

        const list: ClienteImportItem[] = [];

        for (let r = headerRowIndex + 1; r < rawData.length; r++) {
          const row = rawData[r];
          if (!row || row.length === 0) continue;

          const rawRtn = idxRtn >= 0 ? String(row[idxRtn] || '') : String(row[0] || '');
          const cleanRtn = rawRtn.replace(/[^0-9A-Za-z]/g, '').trim().toUpperCase();
          const rawNombre = idxNombre >= 0 ? String(row[idxNombre] || '') : String(row[1] || '');

          if (!cleanRtn && !rawNombre) continue;

          const isNatural = idxTipo >= 0 
            ? String(row[idxTipo] || '').toLowerCase().includes('natural') 
            : (cleanRtn.startsWith('0801') && cleanRtn.length === 13);
          const tipoPersona = isNatural ? 'Natural' : 'Juridica';

          // DNI: Si viene en columna o se extrae de RTN si es Natural
          let dniVal: string | undefined = idxDni >= 0 ? String(row[idxDni] || '').trim() : undefined;
          if (!dniVal && isNatural && cleanRtn.length === 14) {
            dniVal = cleanRtn.substring(0, 13);
          }

          // Auto-detección de Geo si no viene explícita
          let depVal = idxDep >= 0 ? String(row[idxDep] || '').trim() : undefined;
          let munVal = idxMun >= 0 ? String(row[idxMun] || '').trim() : undefined;
          if (!depVal || !munVal) {
            const detect = this.geoService.detectarUbicacionPorRtnODni(cleanRtn);
            if (detect) {
              if (!depVal && detect.departamentoNombre) depVal = detect.departamentoNombre;
              if (!munVal && detect.municipioNombre) munVal = detect.municipioNombre;
            }
          }

          const cuotaVal = idxCuota >= 0 ? parseFloat(String(row[idxCuota]).replace(/[^0-9.]/g, '')) || 0 : 0;
          const diaVal = idxDia >= 0 ? parseInt(String(row[idxDia]).replace(/[^0-9]/g, '')) || 5 : 5;

          list.push({
            rtn: cleanRtn,
            nombreRazonSocial: rawNombre.trim(),
            nombreComercial: idxComercial >= 0 ? String(row[idxComercial] || '').trim() : undefined,
            tipoPersona: tipoPersona,
            rubro: idxRubro >= 0 && row[idxRubro] ? String(row[idxRubro]).trim() : 'Comercio General',
            contrasenaSAR: idxSar >= 0 ? String(row[idxSar] || '').trim() : undefined,
            dni: dniVal || undefined,
            representanteLegalNombre: idxRepNombre >= 0 ? String(row[idxRepNombre] || '').trim() : undefined,
            representanteLegalRtn: idxRepRtn >= 0 ? String(row[idxRepRtn] || '').trim() : undefined,
            departamentoNombre: depVal || undefined,
            municipioNombre: munVal || undefined,
            emailPrincipal: idxEmail >= 0 ? String(row[idxEmail] || '').trim() : undefined,
            emailSecundario: idxEmailSec >= 0 ? String(row[idxEmailSec] || '').trim() : undefined,
            telefono: idxTel >= 0 ? String(row[idxTel] || '').trim() : undefined,
            telefonoWhatsApp: idxWa >= 0 ? String(row[idxWa] || '').trim() : undefined,
            direccion: idxDir >= 0 ? String(row[idxDir] || '').trim() : undefined,
            cuotaMensual: cuotaVal > 0 ? cuotaVal : 1500,
            diaCobro: diaVal >= 1 && diaVal <= 31 ? diaVal : 5,
            notas: idxNotas >= 0 ? String(row[idxNotas] || '').trim() : undefined
          });
        }

        if (list.length === 0) {
          throw new Error('No se detectaron clientes con RTN o Nombre válido.');
        }

        this.parsedClients.set(list);
        this.showToast(`¡Se detectaron ${list.length} clientes listos para importar!`);
      } catch (err: any) {
        this.importError.set(err.message || 'Error al procesar el archivo Excel.');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  ejecutarImportacionMasiva(): void {
    const list = this.parsedClients();
    if (list.length === 0) return;

    this.isImporting.set(true);
    this.importError.set(null);

    this.clientsService.importarMasivo(list).subscribe({
      next: (res) => {
        this.importResult.set(res);
        this.isImporting.set(false);
        this.parsedClients.set([]);
        this.selectedImportFile.set(null);
        this.showToast(`¡Importación completada! ${res.totalGuardados} creados, ${res.totalActualizados} actualizados.`);
        this.cargarClientes();
        this.cargarRubros();
      },
      error: (err) => {
        this.isImporting.set(false);
        this.importError.set(err.error?.mensaje || 'Error al enviar la carga masiva al servidor.');
      }
    });
  }

  private showToast(msg: string): void {
    this.successMsg.set(msg);
    setTimeout(() => this.successMsg.set(null), 3500);
  }
}
