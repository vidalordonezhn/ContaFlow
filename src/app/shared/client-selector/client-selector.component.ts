import { Component, ElementRef, HostListener, computed, inject, input, model, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ClienteResponse } from '../../services/api-clients.service';

@Component({
  selector: 'app-client-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './client-selector.component.html',
  styleUrl: './client-selector.component.scss'
})
export class ClientSelectorComponent {
  private readonly elementRef = inject(ElementRef);

  readonly clients = input<ClienteResponse[]>([]);
  readonly selectedId = model<number | null>(null);
  readonly placeholder = input<string>('Buscar cliente por RTN, nombre o empresa...');
  readonly disabled = input<boolean>(false);

  readonly clientSelected = output<ClienteResponse>();
  readonly clientCleared = output<void>();

  readonly searchQuery = signal<string>('');
  readonly isOpen = signal<boolean>(false);
  readonly focusedIndex = signal<number>(-1);

  readonly selectedClient = computed(() => {
    const id = this.selectedId();
    if (!id) return null;
    return this.clients().find(c => c.id === id) || null;
  });

  readonly filteredClients = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const all = this.clients();

    if (!query) {
      return all.slice(0, 50);
    }

    return all.filter(c => 
      c.nombreRazonSocial.toLowerCase().includes(query) ||
      (c.nombreComercial && c.nombreComercial.toLowerCase().includes(query)) ||
      c.rtn.toLowerCase().includes(query) ||
      (c.rubro && c.rubro.toLowerCase().includes(query))
    ).slice(0, 50);
  });

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.isOpen.set(false);
    }
  }

  toggleDropdown(): void {
    if (this.disabled()) return;
    this.isOpen.update(v => !v);
    if (this.isOpen()) {
      this.searchQuery.set('');
      this.focusedIndex.set(-1);
    }
  }

  openDropdown(): void {
    if (this.disabled()) return;
    this.isOpen.set(true);
  }

  closeDropdown(): void {
    this.isOpen.set(false);
  }

  selectClient(client: ClienteResponse): void {
    this.selectedId.set(client.id);
    this.isOpen.set(false);
    this.searchQuery.set('');
    this.clientSelected.emit(client);
  }

  clearSelection(event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.selectedId.set(null);
    this.searchQuery.set('');
    this.isOpen.set(true);
    this.clientCleared.emit();
  }

  onKeyDown(event: KeyboardEvent): void {
    if (!this.isOpen()) {
      if (event.key === 'ArrowDown' || event.key === 'Enter') {
        this.openDropdown();
        event.preventDefault();
      }
      return;
    }

    const list = this.filteredClients();
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.focusedIndex.update(idx => (idx < list.length - 1 ? idx + 1 : 0));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.focusedIndex.update(idx => (idx > 0 ? idx - 1 : list.length - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const idx = this.focusedIndex();
      if (idx >= 0 && idx < list.length) {
        this.selectClient(list[idx]);
      } else if (list.length > 0) {
        this.selectClient(list[0]);
      }
    } else if (event.key === 'Escape') {
      this.closeDropdown();
    }
  }
}
