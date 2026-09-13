import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiConfiguracionService, ConfiguracionDespacho } from '../services/api-configuracion.service';
import { ApiCAIService, CAIResponse, CAICreate } from '../services/api-cai.service';

@Component({
  selector: 'app-configuracion',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './configuracion.component.html',
  styleUrl: './configuracion.component.scss'
})
export class ConfiguracionComponent implements OnInit {
  private readonly configService = inject(ApiConfiguracionService);
  private readonly caiService = inject(ApiCAIService);

  readonly loading = signal<boolean>(true);
  readonly saving = signal<boolean>(false);
  readonly savingCAI = signal<boolean>(false);
  readonly successMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  // CAI Activo del SAR
  readonly caiActivo = signal<CAIResponse | null>(null);
  readonly mostrarFormNuevoCAI = signal<boolean>(false);

  // Modelo Formulario CAI
  caiForm: CAICreate = {
    cai: '3C4F81-912A34-034389-112233-445566-77',
    tipoDocumento: 'Recibo por Honorarios Profesionales',
    establecimiento: '000',
    puntoEmision: '001',
    tipoDocCodigo: '01',
    rangoInicial: 1,
    rangoFinal: 500,
    fechaLimiteEmision: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
    activo: true,
    observaciones: 'Autorización SAR vigente'
  };

  // Form model
  config: ConfiguracionDespacho = {
    id: 0,
    nombreDespacho: 'DESPACHO CONTABLE & FISCAL',
    nombreContadorTitular: 'Lic. Vidal Ordoñez',
    colegiacionCAH: 'Col. Prof. CAH # 12458',
    rtnDespacho: '08011980123456',
    telefono: '+504 2235-0000',
    telefonoWhatsApp: '50499887766',
    email: 'contacto@despachocontable.hn',
    direccion: 'Boulevard Morazán, Edificio Torre Alianza, Nivel 3, Tegucigalpa, M.D.C., Honduras, C.A.',
    ciudad: 'Tegucigalpa',
    slogan: 'Servicios Profesionales de Contabilidad, Auditoría y Asesoría Tributaria SAR',
    logoBase64: null,
    mensajePieRecibo: 'Este documento es un comprobante digital de pago de honorarios profesionales emitido conforme a las normas vigentes.',
    banco1Activo: true,
    banco1Nombre: 'BAC Credomatic',
    banco1TipoCuenta: 'Cuenta de Cheques',
    banco1Numero: '741-234567-01',
    banco1Beneficiario: 'Despacho Contable y Fiscal',
    banco2Activo: true,
    banco2Nombre: 'Banco Atlántida',
    banco2TipoCuenta: 'Cuenta de Ahorros',
    banco2Numero: '110-098765-22',
    banco2Beneficiario: 'Vidal Ordoñez',
    banco3Activo: true,
    banco3Nombre: 'Banco Ficohsa',
    banco3TipoCuenta: 'Cuenta de Ahorros',
    banco3Numero: '200-019283-44',
    banco3Beneficiario: 'Vidal Ordoñez',
    banco4Activo: false,
    banco4Nombre: 'Banco del País (Banpaís)',
    banco4TipoCuenta: 'Cuenta de Ahorros',
    banco4Numero: '01-502-000123-9',
    banco4Beneficiario: 'Despacho Contable'
  };

  ngOnInit(): void {
    this.cargarDatos();
  }

  cargarDatos(): void {
    this.loading.set(true);
    this.configService.getConfiguracion().subscribe({
      next: (data) => {
        this.config = { ...data };
        this.cargarCAI();
      },
      error: (err) => {
        console.error('Error al cargar configuración:', err);
        this.cargarCAI();
      }
    });
  }

  cargarCAI(): void {
    this.caiService.getCAIActivo().subscribe({
      next: (cai) => {
        this.caiActivo.set(cai);
        if (cai) {
          this.caiForm = {
            cai: cai.cai,
            tipoDocumento: cai.tipoDocumento,
            establecimiento: cai.establecimiento,
            puntoEmision: cai.puntoEmision,
            tipoDocCodigo: cai.tipoDocCodigo,
            rangoInicial: cai.rangoInicial,
            rangoFinal: cai.rangoFinal,
            fechaLimiteEmision: cai.fechaLimiteEmision ? cai.fechaLimiteEmision.split('T')[0] : '',
            activo: cai.activo,
            observaciones: cai.observaciones || ''
          };
        }
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  onLogoFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];

      // Validar tamaño máximo 2MB
      if (file.size > 2 * 1024 * 1024) {
        this.errorMessage.set('La imagen no debe superar los 2MB.');
        setTimeout(() => this.errorMessage.set(null), 4000);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        this.config.logoBase64 = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  removerLogo(): void {
    this.config.logoBase64 = null;
  }

  guardar(): void {
    this.saving.set(true);
    this.successMessage.set(null);
    this.errorMessage.set(null);

    this.configService.updateConfiguracion(this.config).subscribe({
      next: (res) => {
        this.config = { ...res };
        this.saving.set(false);
        this.successMessage.set('¡Configuración y branding guardados correctamente!');
        setTimeout(() => this.successMessage.set(null), 5000);
      },
      error: (err) => {
        console.error('Error al guardar configuración:', err);
        this.saving.set(false);
        this.errorMessage.set('Ocurrió un error al guardar los cambios.');
      }
    });
  }

  guardarCAI(): void {
    this.savingCAI.set(true);
    this.successMessage.set(null);
    this.errorMessage.set(null);

    const currentCAI = this.caiActivo();
    if (currentCAI) {
      this.caiService.actualizarCAI(currentCAI.id, {
        cai: this.caiForm.cai,
        tipoDocumento: this.caiForm.tipoDocumento,
        establecimiento: this.caiForm.establecimiento,
        puntoEmision: this.caiForm.puntoEmision,
        tipoDocCodigo: this.caiForm.tipoDocCodigo,
        rangoInicial: this.caiForm.rangoInicial,
        rangoFinal: this.caiForm.rangoFinal,
        fechaLimiteEmision: this.caiForm.fechaLimiteEmision,
        activo: this.caiForm.activo,
        observaciones: this.caiForm.observaciones
      }).subscribe({
        next: (cai) => {
          this.caiActivo.set(cai);
          this.savingCAI.set(false);
          this.mostrarFormNuevoCAI.set(false);
          this.successMessage.set('¡Autorización CAI del SAR actualizada con éxito!');
          setTimeout(() => this.successMessage.set(null), 5000);
        },
        error: (err) => {
          console.error('Error al actualizar CAI:', err);
          this.savingCAI.set(false);
          this.errorMessage.set('Ocurrió un error al actualizar los datos del CAI.');
        }
      });
    } else {
      this.caiService.registrarNuevoCAI(this.caiForm).subscribe({
        next: (cai) => {
          this.caiActivo.set(cai);
          this.savingCAI.set(false);
          this.mostrarFormNuevoCAI.set(false);
          this.successMessage.set('¡Nueva autorización CAI del SAR registrada con éxito!');
          setTimeout(() => this.successMessage.set(null), 5000);
        },
        error: (err) => {
          console.error('Error al registrar CAI:', err);
          this.savingCAI.set(false);
          this.errorMessage.set('Ocurrió un error al registrar el CAI.');
        }
      });
    }
  }
}
