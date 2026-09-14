import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ApiRecibosService, ReciboResponse, ReciboCreate, ReciboItem } from '../services/api-recibos.service';
import { ApiClientsService, ClienteResponse, ClienteCreate } from '../services/api-clients.service';
import { ApiServiciosCatalogoService, ServicioCatalogoResponse, ServicioCatalogoCreate, ServicioCatalogoUpdate } from '../services/api-servicios-catalogo.service';
import { PdfGeneratorService, ReciboPdfData } from '../services/pdf-generator.service';
import { ClientSelectorComponent } from '../shared/client-selector/client-selector.component';

export interface ReciboPreviewModalData {
  reciboId?: number;
  tipoComprobante: 'SinCAI' | 'ConCAI';
  numeroRecibo: string;
  clienteNombre: string;
  clienteRtn: string;
  monto: number;
  telefonoWhatsApp?: string;
  blobUrl: string;
  safeUrl: SafeResourceUrl;
}

@Component({
  selector: 'app-receipts',
  standalone: true,
  imports: [CommonModule, FormsModule, ClientSelectorComponent],
  templateUrl: './receipts.component.html',
  styleUrl: './receipts.component.scss'
})
export class ReceiptsComponent implements OnInit {
  readonly recibosService = inject(ApiRecibosService);
  readonly clientsService = inject(ApiClientsService);
  readonly serviciosCatalogoService = inject(ApiServiciosCatalogoService);
  readonly pdfService = inject(PdfGeneratorService);
  private readonly sanitizer = inject(DomSanitizer);

  // Estados de navegación
  readonly currentView = signal<'emitir' | 'historial' | 'catalogo'>('emitir');

  // Datos principales
  readonly recibos = signal<ReciboResponse[]>([]);
  readonly clientes = signal<ClienteResponse[]>([]);
  readonly serviciosCatalogo = signal<ServicioCatalogoResponse[]>([]);
  readonly isLoading = signal(true);
  readonly isSaving = signal(false);
  readonly successMsg = signal<string | null>(null);
  readonly errorMsg = signal<string | null>(null);

  // Filtros Historial
  readonly searchQuery = signal('');
  readonly filterTipo = signal<'todos' | 'SinCAI' | 'ConCAI'>('todos');

  // Filtro Catálogo
  readonly catalogSearchQuery = signal('');

  // Modal Visor PDF
  readonly previewModal = signal<ReciboPreviewModalData | null>(null);

  // Modal Rápido de Nuevo Cliente
  readonly isNewClientModalOpen = signal(false);
  readonly newClientNombre = signal('');
  readonly newClientRtn = signal('');
  readonly newClientTelefono = signal('');
  readonly newClientCuota = signal<number>(0);
  readonly newClientError = signal<string | null>(null);

  // Modal de Nuevo Producto / Servicio del Catálogo
  readonly isNewServiceModalOpen = signal(false);
  readonly newServiceEditingId = signal<number | null>(null);
  readonly newServiceNombre = signal('');
  readonly newServicePrecio = signal<number>(0);
  readonly newServiceDescripcion = signal('');
  readonly newServiceCategoria = signal('General');
  readonly newServiceError = signal<string | null>(null);

  // -------------------------------------------------------------
  // FORMULARIO DE EMISIÓN DE COMPROBANTE
  // -------------------------------------------------------------
  readonly formTipoComprobante = signal<'SinCAI' | 'ConCAI'>('SinCAI');
  readonly formClienteId = signal<number | null>(null);
  readonly formNombreCliente = signal<string>('');
  readonly formRtnCliente = signal<string>('');
  readonly formNumeroComprobante = signal<string>('');
  readonly formFechaEmision = signal<string>(new Date().toISOString().substring(0, 10));
  readonly formMetodoPago = signal<string>('Transferencia');
  readonly formAplicarIsv = signal<boolean>(false);
  readonly formRegistrarComoPago = signal<boolean>(true);
  readonly formMesAplicado = signal<string>(`${new Intl.DateTimeFormat('es-HN', { month: 'long' }).format(new Date())} ${new Date().getFullYear()}`);
  readonly formObservaciones = signal<string>('');

  // Lista de Ítems del comprobante
  readonly formItems = signal<ReciboItem[]>([
    {
      producto: '',
      descripcion: '',
      cantidad: 1,
      precio: 0,
      total: 0
    }
  ]);

  // Cálculos reactivos de Totales
  readonly formSubtotal = computed(() => {
    return this.formItems().reduce((acc, item) => acc + (Number(item.total) || 0), 0);
  });

  readonly formImpuesto = computed(() => {
    if (!this.formAplicarIsv()) return 0;
    return Number((this.formSubtotal() * 0.15).toFixed(2));
  });

  readonly formTotal = computed(() => {
    return Number((this.formSubtotal() + this.formImpuesto()).toFixed(2));
  });

  // Lista filtrada del historial
  readonly filteredRecibos = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const tipo = this.filterTipo();

    return this.recibos().filter(r => {
      let matchTipo = true;
      if (tipo !== 'todos') {
        matchTipo = r.tipoComprobante === tipo;
      }
      if (!matchTipo) return false;

      if (!query) return true;
      return (r.numeroRecibo && r.numeroRecibo.toLowerCase().includes(query)) ||
             (r.numeroFiscal && r.numeroFiscal.toLowerCase().includes(query)) ||
             r.nombreCliente.toLowerCase().includes(query) ||
             r.rtnCliente.toLowerCase().includes(query) ||
             r.concepto.toLowerCase().includes(query);
    });
  });

  // Lista filtrada del catálogo de servicios
  readonly filteredCatalog = computed(() => {
    const query = this.catalogSearchQuery().toLowerCase().trim();
    return this.serviciosCatalogo().filter(s => {
      if (!query) return true;
      return s.nombre.toLowerCase().includes(query) ||
             (s.descripcionDefault && s.descripcionDefault.toLowerCase().includes(query)) ||
             (s.categoria && s.categoria.toLowerCase().includes(query));
    });
  });

  ngOnInit(): void {
    this.cargarDatos();
    this.generarNumeroSugerido();
  }

  cargarDatos(): void {
    this.isLoading.set(true);
    this.recibosService.getRecibos().subscribe({
      next: (data) => {
        this.recibos.set(data);
        this.clientsService.getClientes().subscribe(cls => this.clientes.set(cls.filter(c => c.activo)));
        this.cargarCatalogoServicios();
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      }
    });
  }

  cargarCatalogoServicios(): void {
    this.serviciosCatalogoService.getServicios().subscribe({
      next: (servicios) => {
        this.serviciosCatalogo.set(servicios);

        // Si la primera fila de ítems está vacía y hay servicios, inicializar con el primero
        const items = this.formItems();
        if (items.length === 1 && !items[0].producto && servicios.length > 0) {
          const primero = servicios[0];
          this.formItems.set([
            {
              producto: primero.nombre,
              descripcion: primero.descripcionDefault || primero.nombre,
              cantidad: 1,
              precio: primero.precioDefault,
              total: primero.precioDefault
            }
          ]);
        }
      },
      error: () => {}
    });
  }

  generarNumeroSugerido(): void {
    const anio = new Date().getFullYear();
    const count = this.recibos().length + 1;
    if (this.formTipoComprobante() === 'SinCAI') {
      this.formNumeroComprobante.set(`REC-${anio}-${String(count).padStart(4, '0')}`);
    } else {
      this.formNumeroComprobante.set(`FAC-${anio}-${String(count).padStart(4, '0')}`);
    }
  }

  setTipoComprobante(tipo: 'SinCAI' | 'ConCAI'): void {
    this.formTipoComprobante.set(tipo);
    this.generarNumeroSugerido();
  }

  onClientSelected(client: ClienteResponse): void {
    this.formClienteId.set(client.id);
    this.formNombreCliente.set(client.nombreRazonSocial);
    this.formRtnCliente.set(client.rtn);

    // Si tiene cuota mensual y el ítem es de honorarios, sugerir la cuota
    if (client.cuotaMensual && client.cuotaMensual > 0) {
      const items = this.formItems();
      if (items.length === 1 && items[0].producto.toLowerCase().includes('honorarios')) {
        this.actualizarItem(0, 'precio', client.cuotaMensual);
      }
    }
  }

  onClientCleared(): void {
    this.formClienteId.set(null);
    this.formNombreCliente.set('');
    this.formRtnCliente.set('');
  }

  // --- Manejo de la Tabla de Ítems ---
  agregarItem(producto: string = '', descripcion: string = '', precio: number = 0): void {
    const current = this.formItems();
    this.formItems.set([
      ...current,
      {
        producto: producto || '',
        descripcion: descripcion || '',
        cantidad: 1,
        precio: precio || 0,
        total: precio || 0
      }
    ]);
  }

  onSelectProducto(index: number, selectedValue: string): void {
    if (!selectedValue) return;

    // Buscar si es un ID numérico o el nombre del producto
    const servicio = this.serviciosCatalogo().find(s => s.id === Number(selectedValue) || s.nombre === selectedValue);

    if (servicio) {
      const items = [...this.formItems()];
      const item = { ...items[index] };
      item.producto = servicio.nombre;
      item.precio = servicio.precioDefault;
      item.descripcion = servicio.descripcionDefault || servicio.nombre;
      item.total = Number((item.cantidad * item.precio).toFixed(2));
      items[index] = item;
      this.formItems.set(items);
    } else {
      // Valor personalizado escrito
      this.actualizarItem(index, 'producto', selectedValue);
    }
  }

  actualizarItem(index: number, field: keyof ReciboItem, value: any): void {
    const items = [...this.formItems()];
    const item = { ...items[index] };

    if (field === 'cantidad') {
      item.cantidad = Math.max(0.01, Number(value) || 1);
      item.total = Number((item.cantidad * item.precio).toFixed(2));
    } else if (field === 'precio') {
      item.precio = Math.max(0, Number(value) || 0);
      item.total = Number((item.cantidad * item.precio).toFixed(2));
    } else if (field === 'producto') {
      item.producto = String(value);
    } else if (field === 'descripcion') {
      item.descripcion = String(value);
    }

    items[index] = item;
    this.formItems.set(items);
  }

  eliminarItem(index: number): void {
    const items = this.formItems();
    if (items.length <= 1) {
      this.formItems.set([
        {
          producto: '',
          descripcion: '',
          cantidad: 1,
          precio: 0,
          total: 0
        }
      ]);
      return;
    }
    this.formItems.set(items.filter((_, idx) => idx !== index));
  }

  // --- Modal Rápido de Nuevo Producto / Servicio ---
  abrirModalNuevoServicio(servicioParaEditar?: ServicioCatalogoResponse): void {
    if (servicioParaEditar) {
      this.newServiceEditingId.set(servicioParaEditar.id);
      this.newServiceNombre.set(servicioParaEditar.nombre);
      this.newServicePrecio.set(servicioParaEditar.precioDefault);
      this.newServiceDescripcion.set(servicioParaEditar.descripcionDefault || '');
      this.newServiceCategoria.set(servicioParaEditar.categoria || 'General');
    } else {
      this.newServiceEditingId.set(null);
      this.newServiceNombre.set('');
      this.newServicePrecio.set(0);
      this.newServiceDescripcion.set('');
      this.newServiceCategoria.set('General');
    }
    this.newServiceError.set(null);
    this.isNewServiceModalOpen.set(true);
  }

  cerrarModalNuevoServicio(): void {
    this.isNewServiceModalOpen.set(false);
    this.newServiceEditingId.set(null);
    this.newServiceError.set(null);
  }

  guardarNuevoServicio(): void {
    this.newServiceError.set(null);
    const nombre = this.newServiceNombre().trim();
    const precio = Number(this.newServicePrecio()) || 0;
    const descripcion = this.newServiceDescripcion().trim();
    const categoria = this.newServiceCategoria().trim() || 'General';

    if (!nombre) {
      this.newServiceError.set('El nombre del producto o servicio es obligatorio.');
      return;
    }
    if (precio < 0) {
      this.newServiceError.set('El precio debe ser mayor o igual a 0.');
      return;
    }

    const editId = this.newServiceEditingId();
    if (editId) {
      // Actualizar existente
      const updateDto: ServicioCatalogoUpdate = {
        nombre,
        precioDefault: precio,
        descripcionDefault: descripcion,
        categoria,
        activo: true
      };

      this.serviciosCatalogoService.actualizarServicio(editId, updateDto).subscribe({
        next: (updated) => {
          this.serviciosCatalogo.update(list => list.map(s => s.id === updated.id ? updated : s));
          this.cerrarModalNuevoServicio();
          this.showToast(`Producto "${updated.nombre}" actualizado correctamente.`);
        },
        error: (err) => {
          this.newServiceError.set(err.error?.mensaje || 'Error al actualizar producto.');
        }
      });
    } else {
      // Crear nuevo
      const createDto: ServicioCatalogoCreate = {
        nombre,
        precioDefault: precio,
        descripcionDefault: descripcion,
        categoria
      };

      this.serviciosCatalogoService.crearServicio(createDto).subscribe({
        next: (created) => {
          this.serviciosCatalogo.update(list => [...list, created]);

          // Si estamos en la vista de emisión, añadirlo automáticamente como una fila
          if (this.currentView() === 'emitir') {
            const currentItems = this.formItems();
            if (currentItems.length === 1 && !currentItems[0].producto) {
              this.formItems.set([
                {
                  producto: created.nombre,
                  descripcion: created.descripcionDefault || created.nombre,
                  cantidad: 1,
                  precio: created.precioDefault,
                  total: created.precioDefault
                }
              ]);
            } else {
              this.agregarItem(created.nombre, created.descripcionDefault || created.nombre, created.precioDefault);
            }
          }

          this.cerrarModalNuevoServicio();
          this.showToast(`Producto "${created.nombre}" registrado en catálogo y agregado a la factura.`);
        },
        error: (err) => {
          this.newServiceError.set(err.error?.mensaje || 'Error al guardar producto.');
        }
      });
    }
  }

  eliminarServicioDelCatalogo(s: ServicioCatalogoResponse): void {
    if (!confirm(`¿Está seguro de eliminar "${s.nombre}" del catálogo de servicios?`)) return;

    this.serviciosCatalogoService.eliminarServicio(s.id).subscribe({
      next: () => {
        this.serviciosCatalogo.update(list => list.filter(item => item.id !== s.id));
        this.showToast(`"${s.nombre}" eliminado del catálogo.`);
      },
      error: () => {
        this.showToast('Error al eliminar producto del catálogo.');
      }
    });
  }

  // --- Guardar y Emitir Comprobante ---
  guardarComprobante(previsualizarDespues: boolean = false): void {
    this.errorMsg.set(null);

    const nombre = this.formNombreCliente().trim();
    if (!nombre) {
      this.errorMsg.set('Debes seleccionar o escribir el nombre del cliente.');
      return;
    }

    const itemsValidos = this.formItems().filter(it => it.producto.trim() || it.total > 0);
    if (itemsValidos.length === 0) {
      this.errorMsg.set('Debes agregar al menos un ítem o servicio a la factura.');
      return;
    }

    this.isSaving.set(true);

    const createDto: ReciboCreate = {
      clienteId: this.formClienteId(),
      nombreCliente: nombre,
      rtnCliente: this.formRtnCliente().trim() || 'N/A',
      tipoComprobante: this.formTipoComprobante(),
      numeroRecibo: this.formNumeroComprobante().trim() || undefined,
      fechaEmision: new Date(this.formFechaEmision()).toISOString(),
      subtotal: this.formSubtotal(),
      impuesto: this.formImpuesto(),
      monto: this.formTotal(),
      metodoPago: this.formMetodoPago(),
      observaciones: this.formObservaciones().trim() || undefined,
      registrarComoPago: this.formRegistrarComoPago(),
      mesAplicado: this.formMesAplicado().trim(),
      items: itemsValidos
    };

    this.recibosService.crearRecibo(createDto).subscribe({
      next: (resp) => {
        this.isSaving.set(false);
        this.showToast(`¡Comprobante ${resp.numeroRecibo} generado con éxito!`);
        this.cargarDatos();

        if (previsualizarDespues) {
          this.abrirVisorHistorial(resp);
        }

        // Reiniciar formulario
        this.reiniciarFormulario();
      },
      error: (err) => {
        this.isSaving.set(false);
        this.errorMsg.set(err.error?.mensaje || 'Error al guardar el comprobante.');
      }
    });
  }

  reiniciarFormulario(): void {
    this.formClienteId.set(null);
    this.formNombreCliente.set('');
    this.formRtnCliente.set('');
    this.formObservaciones.set('');

    const servicios = this.serviciosCatalogo();
    if (servicios.length > 0) {
      this.formItems.set([
        {
          producto: servicios[0].nombre,
          descripcion: servicios[0].descripcionDefault || servicios[0].nombre,
          cantidad: 1,
          precio: servicios[0].precioDefault,
          total: servicios[0].precioDefault
        }
      ]);
    } else {
      this.formItems.set([
        {
          producto: '',
          descripcion: '',
          cantidad: 1,
          precio: 0,
          total: 0
        }
      ]);
    }

    this.generarNumeroSugerido();
  }

  // --- Generación y Descarga de PDF ---
  descargarPdfDirecto(): void {
    const pdfData = this.construirDatosPdfActual();
    this.pdfService.generarReciboPdf(pdfData, true);
    this.showToast('Descargando archivo PDF...');
  }

  previsualizarPdf(): void {
    const pdfData = this.construirDatosPdfActual();
    const doc = this.pdfService.generarReciboPdf(pdfData, false);
    const blob = doc.output('blob');
    const blobUrl = window.URL.createObjectURL(blob);
    const safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(blobUrl);

    const cliente = this.clientes().find(c => c.id === this.formClienteId());
    const whatsapp = cliente?.telefonoWhatsApp || cliente?.telefono;

    this.previewModal.set({
      tipoComprobante: pdfData.tipoComprobante,
      numeroRecibo: pdfData.numeroRecibo,
      clienteNombre: pdfData.clienteNombre,
      clienteRtn: pdfData.clienteRtn,
      monto: pdfData.total,
      telefonoWhatsApp: whatsapp,
      blobUrl,
      safeUrl
    });
  }

  private construirDatosPdfActual(): ReciboPdfData {
    const fechaObj = new Date(this.formFechaEmision() + 'T12:00:00');
    const fechaFormatted = `${String(fechaObj.getDate()).padStart(2, '0')}/${String(fechaObj.getMonth() + 1).padStart(2, '0')}/${fechaObj.getFullYear()}`;

    return {
      tipoComprobante: this.formTipoComprobante(),
      numeroRecibo: this.formNumeroComprobante() || 'REC-PROFORMA',
      fechaEmision: fechaFormatted,
      clienteNombre: this.formNombreCliente() || 'Cliente General',
      clienteRtn: this.formRtnCliente() || 'N/A',
      items: this.formItems().map(i => ({
        producto: i.producto || 'Servicio',
        descripcion: i.descripcion || 'Honorarios Contables',
        cantidad: Number(i.cantidad) || 1,
        precio: Number(i.precio) || 0,
        total: Number(i.total) || 0
      })),
      subtotal: this.formSubtotal(),
      impuesto: this.formImpuesto(),
      total: this.formTotal(),
      observaciones: this.formObservaciones()
    };
  }

  // --- Visor Modal de Historial ---
  abrirVisorHistorial(r: ReciboResponse): void {
    this.recibosService.descargarReciboPdf(r.id).subscribe({
      next: (blob) => {
        const blobUrl = window.URL.createObjectURL(blob);
        const safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(blobUrl);

        const cliente = this.clientes().find(c => c.id === r.clienteId);
        const whatsapp = cliente?.telefonoWhatsApp || cliente?.telefono;

        this.previewModal.set({
          reciboId: r.id,
          tipoComprobante: r.tipoComprobante,
          numeroRecibo: r.numeroRecibo,
          clienteNombre: r.nombreCliente,
          clienteRtn: r.rtnCliente,
          monto: r.monto,
          telefonoWhatsApp: whatsapp,
          blobUrl,
          safeUrl
        });
      },
      error: () => {
        const pdfData: ReciboPdfData = {
          tipoComprobante: r.tipoComprobante,
          numeroRecibo: r.numeroRecibo,
          numeroFiscal: r.numeroFiscal,
          cai: r.cai,
          rangoAutorizado: r.rangoAutorizado,
          fechaLimiteEmision: r.fechaLimiteEmision ? new Date(r.fechaLimiteEmision).toLocaleDateString('es-HN') : undefined,
          fechaEmision: new Date(r.fechaEmision).toLocaleDateString('es-HN'),
          clienteNombre: r.nombreCliente,
          clienteRtn: r.rtnCliente,
          items: r.items && r.items.length > 0 ? r.items : [{ producto: r.concepto, descripcion: r.concepto, cantidad: 1, precio: r.monto, total: r.monto }],
          subtotal: r.subtotal,
          impuesto: r.impuesto,
          total: r.monto
        };
        const doc = this.pdfService.generarReciboPdf(pdfData, false);
        const blob = doc.output('blob');
        const blobUrl = window.URL.createObjectURL(blob);
        const safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(blobUrl);

        this.previewModal.set({
          reciboId: r.id,
          tipoComprobante: r.tipoComprobante,
          numeroRecibo: r.numeroRecibo,
          clienteNombre: r.nombreCliente,
          clienteRtn: r.rtnCliente,
          monto: r.monto,
          blobUrl,
          safeUrl
        });
      }
    });
  }

  cerrarVisor(): void {
    const cur = this.previewModal();
    if (cur?.blobUrl) {
      window.URL.revokeObjectURL(cur.blobUrl);
    }
    this.previewModal.set(null);
  }

  imprimirDesdeVisor(): void {
    const cur = this.previewModal();
    if (cur?.blobUrl) {
      const w = window.open(cur.blobUrl, '_blank');
      if (w) w.focus();
    }
  }

  descargarDesdeVisor(): void {
    const cur = this.previewModal();
    if (cur?.blobUrl) {
      const link = document.createElement('a');
      link.href = cur.blobUrl;
      link.download = `${cur.numeroRecibo}.pdf`;
      link.click();
    }
  }

  // --- Envío por WhatsApp ---
  enviarWhatsAppComprobante(item: { clienteNombre: string; clienteId?: number; monto: number; numeroRecibo?: string; telefonoWhatsApp?: string; items?: ReciboItem[] }): void {
    let phone = item.telefonoWhatsApp;
    if (!phone && item.clienteId) {
      const c = this.clientes().find(cl => cl.id === item.clienteId);
      phone = c?.telefonoWhatsApp || c?.telefono;
    }

    if (!phone) {
      this.showToast(`El cliente "${item.clienteNombre}" no tiene número de WhatsApp registrado.`);
      return;
    }

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const fullPhone = cleanPhone.startsWith('504') ? cleanPhone : `504${cleanPhone}`;
    const montoFormatted = Number(item.monto).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    let detalleMsg = '';
    if (item.items && item.items.length > 0) {
      detalleMsg = `\n📋 *Detalle de servicios:*\n` + item.items.filter(it => it.producto).map(it => ` • ${it.producto}: L. ${Number(it.total).toFixed(2)}`).join('\n');
    }

    const mensaje = `Estimado(a) *${item.clienteNombre}*,\n\nLe saluda su despacho contable *Líderes Contables Ordóñez y Asociados*.\n\n📄 Le adjuntamos la confirmación de su comprobante *N° ${item.numeroRecibo || 'Oficial'}* por un total de *L. ${montoFormatted}*.${detalleMsg}\n\n¡Muchas gracias por su preferencia y confianza!`;

    const url = `https://wa.me/${fullPhone}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
  }

  // --- Modal Rápido de Nuevo Cliente ---
  abrirModalNuevoCliente(): void {
    this.newClientNombre.set('');
    this.newClientRtn.set('');
    this.newClientTelefono.set('');
    this.newClientCuota.set(0);
    this.newClientError.set(null);
    this.isNewClientModalOpen.set(true);
  }

  cerrarModalNuevoCliente(): void {
    this.isNewClientModalOpen.set(false);
    this.newClientError.set(null);
  }

  crearNuevoClienteRapido(): void {
    this.newClientError.set(null);
    const nombre = this.newClientNombre().trim();
    const rtn = this.newClientRtn().trim();

    if (!nombre) {
      this.newClientError.set('La Razón Social / Nombre es obligatorio.');
      return;
    }
    if (!rtn || rtn.length < 14) {
      this.newClientError.set('El RTN debe tener al menos 14 dígitos.');
      return;
    }

    const dto: ClienteCreate = {
      rtn,
      nombreRazonSocial: nombre,
      tipoPersona: 'Natural',
      telefono: this.newClientTelefono().trim() || undefined,
      telefonoWhatsApp: this.newClientTelefono().trim() || undefined,
      cuotaMensual: Number(this.newClientCuota()) || 0,
      diaCobro: 10
    };

    this.clientsService.crearCliente(dto).subscribe({
      next: (nuevo) => {
        this.clientes.update(cls => [...cls, nuevo]);
        this.onClientSelected(nuevo);
        this.cerrarModalNuevoCliente();
        this.showToast(`Cliente "${nuevo.nombreRazonSocial}" añadido y seleccionado con éxito.`);
      },
      error: (err) => {
        this.newClientError.set(err.error?.mensaje || 'Error al guardar cliente.');
      }
    });
  }

  anularComprobante(recibo: ReciboResponse): void {
    if (!confirm(`¿Está seguro de anular el comprobante ${recibo.numeroRecibo}?`)) return;

    this.recibosService.anularRecibo(recibo.id, 'Anulado desde el sistema').subscribe({
      next: () => {
        this.showToast(`Comprobante ${recibo.numeroRecibo} anulado correctamente.`);
        this.cargarDatos();
      },
      error: () => {
        this.showToast('Error al anular el comprobante.');
      }
    });
  }

  private showToast(msg: string): void {
    this.successMsg.set(msg);
    setTimeout(() => this.successMsg.set(null), 3800);
  }
}
