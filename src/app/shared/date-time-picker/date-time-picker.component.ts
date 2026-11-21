import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import { Component, ElementRef, computed, forwardRef, inject, input, signal, viewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { CLOCK } from '../../core/clock';
import { parseLocalDateTime, toLocalDateTimeValue } from '../../domain';

interface DayCell {
  readonly date: Date;
  readonly day: number;
  readonly inMonth: boolean;
  readonly isToday: boolean;
  readonly isSelected: boolean;
  readonly isPast: boolean;
  readonly label: string;
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
let nextId = 0;

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Custom date + time picker replacing <input type="datetime-local">, whose popup
 * is drawn by the browser and can't be styled. The value format is unchanged
 * ("YYYY-MM-DDTHH:mm" in local time), so validators and drafts work as before.
 *
 * Past days/times are disabled as a convenience; the form validator remains the
 * real rule (time keeps moving after a value is picked).
 */
@Component({
  selector: 'app-date-time-picker',
  standalone: true,
  imports: [CdkConnectedOverlay, CdkOverlayOrigin],
  templateUrl: './date-time-picker.component.html',
  styleUrl: './date-time-picker.component.css',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DateTimePickerComponent), multi: true }],
})
export class DateTimePickerComponent implements ControlValueAccessor {
  private readonly clock = inject(CLOCK);

  readonly invalid = input(false);
  readonly inputId = input(`app-dtp-${nextId++}`);
  readonly panelId = `app-dtp-panel-${nextId++}`;

  readonly weekdays = WEEKDAYS;
  readonly hours = HOURS;
  readonly minutes = MINUTES;

  readonly value = signal('');
  readonly open = signal(false);
  readonly disabled = signal(false);
  /** First day of the month currently shown. */
  readonly viewMonth = signal(startOfDay(new Date()));
  /** Refreshed each time the panel opens, so "past" is always current. */
  private readonly now = signal(new Date());

  readonly positions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 6 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -6 },
  ];

  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');

  readonly selectedDate = computed(() => parseLocalDateTime(this.value()));

  readonly displayText = computed(() => {
    const d = this.selectedDate();
    if (!d) return null;
    const date = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    return `${date} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });

  readonly monthLabel = computed(() =>
    this.viewMonth().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
  );

  readonly canGoBack = computed(() => {
    const now = this.now();
    const v = this.viewMonth();
    return v.getFullYear() > now.getFullYear() || (v.getFullYear() === now.getFullYear() && v.getMonth() > now.getMonth());
  });

  /** 6×7 grid of days, starting on the Sunday on/before the 1st. */
  readonly days = computed<DayCell[]>(() => {
    const month = this.viewMonth();
    const today = startOfDay(this.now());
    const selected = this.selectedDate();
    const start = new Date(month.getFullYear(), month.getMonth(), 1 - month.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      return {
        date,
        day: date.getDate(),
        inMonth: date.getMonth() === month.getMonth(),
        isToday: sameDay(date, today),
        isSelected: !!selected && sameDay(date, selected),
        isPast: date < today,
        label: date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      };
    });
  });

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  // --- ControlValueAccessor ---------------------------------------------------
  writeValue(value: string | null): void {
    this.value.set(value ?? '');
  }
  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  // --- Panel ---------------------------------------------------------------------
  toggle(): void {
    this.open() ? this.close() : this.openPanel();
  }

  openPanel(): void {
    if (this.disabled()) return;
    this.now.set(this.clock.now());
    const base = this.selectedDate() ?? this.now();
    this.viewMonth.set(new Date(base.getFullYear(), base.getMonth(), 1));
    this.open.set(true);
    // After the overlay renders: focus a day and scroll the time lists to the selection.
    setTimeout(() => {
      const panel = document.getElementById(this.panelId);
      if (!panel) return;
      panel.querySelectorAll<HTMLElement>('.time-item.selected').forEach((el) => el.scrollIntoView({ block: 'center' }));
      (panel.querySelector<HTMLElement>('.day.selected') ?? panel.querySelector<HTMLElement>('.day.today'))?.focus();
    });
  }

  close(refocus = false): void {
    if (!this.open()) return;
    this.open.set(false);
    this.onTouched();
    if (refocus) this.trigger().nativeElement.focus();
  }

  shiftMonth(delta: number): void {
    const v = this.viewMonth();
    this.viewMonth.set(new Date(v.getFullYear(), v.getMonth() + delta, 1));
  }

  // --- Selection -------------------------------------------------------------------
  pickDay(cell: DayCell): void {
    if (cell.isPast) return;
    const current = this.selectedDate();
    let hour: number;
    let minute: number;
    if (current) {
      hour = current.getHours();
      minute = current.getMinutes();
    } else if (cell.isToday) {
      hour = Math.min(this.now().getHours() + 1, 23); // next full hour
      minute = 0;
    } else {
      hour = 9;
      minute = 0;
    }
    this.emit(new Date(cell.date.getFullYear(), cell.date.getMonth(), cell.date.getDate(), hour, minute));
  }

  pickHour(hour: number): void {
    const d = this.selectedDate();
    if (d) this.emit(new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, d.getMinutes()));
  }

  pickMinute(minute: number): void {
    const d = this.selectedDate();
    if (d) this.emit(new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), minute));
  }

  isHourPast(hour: number): boolean {
    const d = this.selectedDate();
    const now = this.now();
    return !!d && sameDay(d, now) && hour < now.getHours();
  }

  isMinutePast(minute: number): boolean {
    const d = this.selectedDate();
    const now = this.now();
    if (!d || !sameDay(d, now)) return false;
    return d.getHours() < now.getHours() || (d.getHours() === now.getHours() && minute <= now.getMinutes());
  }

  onPanelKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close(true);
    }
  }

  private emit(date: Date): void {
    const value = toLocalDateTimeValue(date);
    this.value.set(value);
    this.onChange(value);
  }
}
