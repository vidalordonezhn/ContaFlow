import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiUsuariosService, UsuarioResponse, UsuarioCreate, UsuarioUpdate } from '../services/api-usuarios.service';
import { ApiAuthService } from '../services/api-auth.service';

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './usuarios.component.html',
  styleUrl: './usuarios.component.scss'
})
export class UsuariosComponent implements OnInit {
  private readonly usuariosService = inject(ApiUsuariosService);
  protected readonly auth = inject(ApiAuthService);

  // Estado de Datos
  readonly usuarios = signal<UsuarioResponse[]>([]);
  readonly isLoading = signal(true);
  readonly errorMsg = signal<string | null>(null);
  readonly successMsg = signal<string | null>(null);

  // Filtros y Pestañas
  readonly activeTab = signal<'todos' | 'contadores' | 'asistentes' | 'admins' | 'inactivos'>('todos');
  readonly searchQuery = signal('');

  // Modales
  readonly isModalOpen = signal(false);
  readonly isPasswordModalOpen = signal(false);
  readonly isEditing = signal(false);
  readonly selectedUserId = signal<number | null>(null);
  readonly selectedUsername = signal<string>('');

  // Formulario Usuario
  readonly formUsername = signal('');
  readonly formNombre = signal('');
  readonly formEmail = signal('');
  readonly formTelefono = signal('');
  readonly formPassword = signal('');
  readonly formRol = signal('Contador');
  readonly formActivo = signal(true);

  // Formulario Password
  readonly newPassword = signal('');
  readonly confirmPassword = signal('');
  readonly formError = signal<string | null>(null);

  // KPIs Computados
  readonly kpiTotal = computed(() => this.usuarios().length);
  readonly kpiActivos = computed(() => this.usuarios().filter(u => u.activo).length);
  readonly kpiContadores = computed(() => this.usuarios().filter(u => u.rol === 'Contador' && u.activo).length);
  readonly kpiAsistentes = computed(() => this.usuarios().filter(u => u.rol === 'Asistente' && u.activo).length);
  readonly kpiAdmins = computed(() => this.usuarios().filter(u => u.rol === 'Admin' && u.activo).length);
  readonly kpiInactivos = computed(() => this.usuarios().filter(u => !u.activo).length);

  // Filtrado reactivo de usuarios por pestaña y búsqueda
  readonly filteredUsuarios = computed(() => {
    const tab = this.activeTab();
    const query = this.searchQuery().toLowerCase().trim();

    return this.usuarios().filter(u => {
      // Filtro por pestaña
      let matchesTab = true;
      if (tab === 'contadores') matchesTab = u.rol === 'Contador' && u.activo;
      else if (tab === 'asistentes') matchesTab = u.rol === 'Asistente' && u.activo;
      else if (tab === 'admins') matchesTab = u.rol === 'Admin' && u.activo;
      else if (tab === 'inactivos') matchesTab = !u.activo;

      if (!matchesTab) return false;

      // Filtro por búsqueda de texto
      if (!query) return true;
      return u.nombre.toLowerCase().includes(query) ||
             u.username.toLowerCase().includes(query) ||
             (u.email && u.email.toLowerCase().includes(query)) ||
             (u.telefono && u.telefono.toLowerCase().includes(query));
    });
  });

  ngOnInit(): void {
    this.cargarUsuarios();
  }

  cargarUsuarios(): void {
    this.isLoading.set(true);
    this.usuariosService.getUsuarios().subscribe({
      next: (data) => {
        this.usuarios.set(data);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMsg.set('No se pudo conectar con el servidor para cargar el personal.');
        this.isLoading.set(false);
      }
    });
  }

  openCreateModal(): void {
    this.isEditing.set(false);
    this.selectedUserId.set(null);
    this.formUsername.set('');
    this.formNombre.set('');
    this.formEmail.set('');
    this.formTelefono.set('');
    this.formPassword.set('');
    this.formRol.set('Contador');
    this.formActivo.set(true);
    this.formError.set(null);
    this.isModalOpen.set(true);
  }

  openEditModal(user: UsuarioResponse): void {
    this.isEditing.set(true);
    this.selectedUserId.set(user.id);
    this.formUsername.set(user.username);
    this.formNombre.set(user.nombre);
    this.formEmail.set(user.email || '');
    this.formTelefono.set(user.telefono || '');
    this.formRol.set(user.rol);
    this.formActivo.set(user.activo);
    this.formError.set(null);
    this.isModalOpen.set(true);
  }

  openPasswordModal(user: UsuarioResponse): void {
    this.selectedUsername.set(user.username);
    this.newPassword.set('');
    this.confirmPassword.set('');
    this.formError.set(null);
    this.isPasswordModalOpen.set(true);
  }

  closeModals(): void {
    this.isModalOpen.set(false);
    this.isPasswordModalOpen.set(false);
    this.formError.set(null);
  }

  saveUsuario(): void {
    this.formError.set(null);

    if (!this.formNombre().trim()) {
      this.formError.set('El nombre completo es obligatorio.');
      return;
    }

    if (!this.isEditing()) {
      if (!this.formUsername().trim()) {
        this.formError.set('El nombre de usuario es obligatorio.');
        return;
      }
      if (!this.formPassword() || this.formPassword().length < 6) {
        this.formError.set('La contraseña debe tener al menos 6 caracteres.');
        return;
      }

      const createDto: UsuarioCreate = {
        username: this.formUsername().trim(),
        nombre: this.formNombre().trim(),
        email: this.formEmail().trim() || undefined,
        telefono: this.formTelefono().trim() || undefined,
        password: this.formPassword(),
        rol: this.formRol()
      };

      this.usuariosService.crearUsuario(createDto).subscribe({
        next: () => {
          this.showToast('Empleado / Usuario creado exitosamente.');
          this.closeModals();
          this.cargarUsuarios();
        },
        error: (err) => {
          this.formError.set(err.error?.mensaje || 'Error al registrar el usuario.');
        }
      });
    } else {
      const updateDto: UsuarioUpdate = {
        nombre: this.formNombre().trim(),
        email: this.formEmail().trim() || undefined,
        telefono: this.formTelefono().trim() || undefined,
        rol: this.formRol(),
        activo: this.formActivo()
      };

      this.usuariosService.actualizarUsuario(this.selectedUserId()!, updateDto).subscribe({
        next: () => {
          this.showToast('Datos de usuario actualizados correctamente.');
          this.closeModals();
          this.cargarUsuarios();
        },
        error: (err) => {
          this.formError.set(err.error?.mensaje || 'Error al actualizar el usuario.');
        }
      });
    }
  }

  savePassword(): void {
    if (!this.newPassword() || this.newPassword().length < 6) {
      this.formError.set('La contraseña debe tener mínimo 6 caracteres.');
      return;
    }
    if (this.newPassword() !== this.confirmPassword()) {
      this.formError.set('Las contraseñas no coinciden.');
      return;
    }

    this.usuariosService.cambiarPassword(this.selectedUsername(), this.newPassword()).subscribe({
      next: () => {
        this.showToast('Contraseña actualizada con éxito.');
        this.closeModals();
      },
      error: (err) => {
        this.formError.set(err.error?.mensaje || 'Error al cambiar la contraseña.');
      }
    });
  }

  toggleStatus(user: UsuarioResponse): void {
    this.usuariosService.toggleStatus(user.id).subscribe({
      next: () => {
        this.showToast(`Estado de ${user.nombre} actualizado.`);
        this.cargarUsuarios();
      },
      error: () => {
        this.errorMsg.set('No se pudo cambiar el estado.');
      }
    });
  }

  private showToast(msg: string): void {
    this.successMsg.set(msg);
    setTimeout(() => this.successMsg.set(null), 3500);
  }
}
