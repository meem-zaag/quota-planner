import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import { Component, ElementRef, computed, forwardRef, input, signal, viewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface SelectOption<T> {
  readonly value: T;
  readonly label: string;
  readonly disabled?: boolean;
  /** Small secondary text, e.g. "Used as pickup". */
  readonly note?: string;
}

let nextId = 0;

/**
 * Custom dropdown that replaces the native <select> (whose menu the browser
 * draws and can't be styled). Implements ControlValueAccessor, so it works with
 * [formControl] exactly like a native input.
 *
 * Accessibility: combobox + listbox pattern. Keyboard: ↑/↓ to move, Enter/Space
 * to select, Home/End, Esc to close, Tab closes.
 */
@Component({
  selector: 'app-select',
  standalone: true,
  imports: [CdkConnectedOverlay, CdkOverlayOrigin],
  templateUrl: './select.component.html',
  styleUrl: './select.component.css',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SelectComponent), multi: true }],
})
export class SelectComponent<T> implements ControlValueAccessor {
  readonly options = input.required<readonly SelectOption<T>[]>();
  readonly placeholder = input('Select…');
  readonly invalid = input(false);
  readonly inputId = input(`app-select-${nextId++}`);

  readonly listId = `app-select-list-${nextId++}`;
  readonly value = signal<T | null>(null);
  readonly open = signal(false);
  readonly disabled = signal(false);
  readonly activeIndex = signal(-1);
  readonly panelWidth = signal(0);

  readonly selected = computed(() => this.options().find((o) => o.value === this.value()) ?? null);

  readonly positions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 6 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -6 },
  ];

  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');

  private onChange: (value: T | null) => void = () => {};
  private onTouched: () => void = () => {};

  // --- ControlValueAccessor ---------------------------------------------------
  writeValue(value: T | null): void {
    this.value.set(value);
  }
  registerOnChange(fn: (value: T | null) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  // --- Behaviour ---------------------------------------------------------------
  toggle(): void {
    this.open() ? this.close() : this.openPanel();
  }

  openPanel(): void {
    if (this.disabled()) return;
    this.panelWidth.set(this.trigger().nativeElement.getBoundingClientRect().width);
    const current = this.options().findIndex((o) => o.value === this.value());
    this.activeIndex.set(current >= 0 ? current : this.firstEnabled(0, 1));
    this.open.set(true);
  }

  close(refocus = false): void {
    if (!this.open()) return;
    this.open.set(false);
    this.onTouched();
    if (refocus) this.trigger().nativeElement.focus();
  }

  choose(option: SelectOption<T>): void {
    if (option.disabled) return;
    this.value.set(option.value);
    this.onChange(option.value);
    this.close(true);
  }

  onBlur(): void {
    if (!this.open()) this.onTouched();
  }

  onKeydown(event: KeyboardEvent): void {
    const opts = this.options();
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        if (!this.open()) return this.openPanel();
        const dir = event.key === 'ArrowDown' ? 1 : -1;
        this.activeIndex.set(this.firstEnabled(this.activeIndex() + dir, dir));
        break;
      }
      case 'Home':
      case 'End':
        if (this.open()) {
          event.preventDefault();
          this.activeIndex.set(event.key === 'Home' ? this.firstEnabled(0, 1) : this.firstEnabled(opts.length - 1, -1));
        }
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (!this.open()) return this.openPanel();
        if (opts[this.activeIndex()]) this.choose(opts[this.activeIndex()]);
        break;
      case 'Escape':
        if (this.open()) {
          event.preventDefault();
          this.close(true);
        }
        break;
      case 'Tab':
        this.close();
        break;
    }
  }

  /** Next enabled option index from `start` in direction `dir` (stays put if none). */
  private firstEnabled(start: number, dir: 1 | -1): number {
    const opts = this.options();
    for (let i = start; i >= 0 && i < opts.length; i += dir) {
      if (!opts[i].disabled) return i;
    }
    return this.activeIndex();
  }
}
