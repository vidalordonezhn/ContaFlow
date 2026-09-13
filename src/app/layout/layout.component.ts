import { Component, ElementRef, HostListener, ViewChild, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router } from '@angular/router';
import { ApiAuthService } from '../services/api-auth.service';
import { TabsService, ModuloItem } from '../services/tabs.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.scss'
})
export class LayoutComponent {
  protected readonly auth = inject(ApiAuthService);
  protected readonly tabsService = inject(TabsService);
  private readonly router = inject(Router);

  @ViewChild('searchInput') searchInputElement?: ElementRef<HTMLInputElement>;

  protected readonly showUserDropdown = signal<boolean>(false);
  protected readonly selectedResultIndex = signal<number>(0);

  protected readonly flattenedModulos = computed<ModuloItem[]>(() => {
    return this.tabsService.modulosFiltrados();
  });

  @HostListener('window:keydown', ['$event'])
  handleKeyboardShortcuts(event: KeyboardEvent): void {
    // 1. Ctrl + K / Cmd + K: Toggle Command Palette
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.toggleCommandPalette();
      return;
    }

    // 2. Escape: Close Search Modal and User Dropdowns
    if (event.key === 'Escape') {
      if (this.tabsService.searchOpen()) {
        event.preventDefault();
        this.tabsService.closeSearch();
      }
      if (this.showUserDropdown()) {
        this.showUserDropdown.set(false);
      }
      return;
    }

    // 3. Arrow Navigation & Enter inside Command Palette
    if (this.tabsService.searchOpen()) {
      const items = this.flattenedModulos();
      if (items.length === 0) return;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        const nextIndex = (this.selectedResultIndex() + 1) % items.length;
        this.selectedResultIndex.set(nextIndex);
        this.scrollSelectedIntoView();
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        const prevIndex = (this.selectedResultIndex() - 1 + items.length) % items.length;
        this.selectedResultIndex.set(prevIndex);
        this.scrollSelectedIntoView();
      } else if (event.key === 'Enter') {
        event.preventDefault();
        const selected = items[this.selectedResultIndex()];
        if (selected) {
          this.tabsService.openModulo(selected);
        }
      }
    }
  }

  protected toggleCommandPalette(): void {
    if (this.tabsService.searchOpen()) {
      this.tabsService.closeSearch();
    } else {
      this.openCommandPalette();
    }
  }

  protected openCommandPalette(): void {
    this.selectedResultIndex.set(0);
    this.tabsService.openSearch();
    setTimeout(() => {
      this.searchInputElement?.nativeElement?.focus();
    }, 50);
  }

  protected onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.tabsService.searchQuery.set(value);
    this.selectedResultIndex.set(0);
  }

  protected selectModuloByIndex(index: number): void {
    this.selectedResultIndex.set(index);
    const selected = this.flattenedModulos()[index];
    if (selected) {
      this.tabsService.openModulo(selected);
    }
  }

  protected getGlobalIndex(moduloId: string): number {
    return this.flattenedModulos().findIndex(m => m.id === moduloId);
  }

  private scrollSelectedIntoView(): void {
    setTimeout(() => {
      const el = document.querySelector('.palette-item.selected');
      if (el) {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }, 20);
  }

  protected toggleUserDropdown(event: Event): void {
    event.stopPropagation();
    this.showUserDropdown.update(v => !v);
  }

  @HostListener('document:click')
  protected closeUserDropdown(): void {
    this.showUserDropdown.set(false);
  }

  protected onLogout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
