import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDragPlaceholder, CdkDropList } from '@angular/cdk/drag-drop';
import { Component, input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { CollapsibleCardComponent } from '../../shared/collapsible-card/collapsible-card.component';
import { SelectComponent, SelectOption } from '../../shared/select/select.component';
import { LOCATIONS, LocationId, MAX_DROPOFFS, MIN_DROPOFFS, locationName, routeDistanceKm } from '../../domain';
import { TripForm, createDropoffControl } from '../trip-form';
import { duplicateMessage } from '../trip-form.messages';

/**
 * Pickup + ordered drop-offs. Mutates the FormArray it is given; the parent
 * owns the form. Uses default change detection because its template reads
 * live form state (validity, which locations are taken).
 */
@Component({
  selector: 'app-route-editor',
  standalone: true,
  imports: [ReactiveFormsModule, CollapsibleCardComponent, SelectComponent, CdkDropList, CdkDrag, CdkDragHandle, CdkDragPlaceholder],
  templateUrl: './route-editor.component.html',
  styleUrl: './route-editor.component.css',
})
export class RouteEditorComponent {
  readonly form = input.required<TripForm>();

  readonly locations = LOCATIONS;
  readonly maxDropoffs = MAX_DROPOFFS;
  readonly locationName = locationName;

  get dropoffs() {
    return this.form().controls.dropoffs;
  }

  get canAdd(): boolean {
    return this.dropoffs.length < MAX_DROPOFFS;
  }

  get canRemove(): boolean {
    return this.dropoffs.length > MIN_DROPOFFS;
  }

  add(): void {
    if (!this.canAdd) return;
    this.dropoffs.push(createDropoffControl());
    this.dropoffs.markAsDirty();
  }

  remove(index: number): void {
    if (!this.canRemove) return;
    this.dropoffs.removeAt(index);
    this.dropoffs.markAsDirty();
  }

  /** Called by CDK when a drag ends — moves the control itself, keeping its state. */
  drop(event: CdkDragDrop<unknown>): void {
    this.move(event.previousIndex, event.currentIndex);
  }

  /** Keyboard-accessible alternative to dragging. */
  move(from: number, to: number): void {
    if (from === to || to < 0 || to >= this.dropoffs.length) return;
    const control = this.dropoffs.at(from);
    this.dropoffs.removeAt(from, { emitEvent: false });
    this.dropoffs.insert(to, control);
    this.dropoffs.markAsDirty();
  }

  /**
   * Options for one select. A location already used by another stop is disabled
   * and labelled, so duplicates can't be chosen (the group validator still
   * guarantees it).
   */
  optionsFor(ownIndex: number | 'pickup'): SelectOption<LocationId>[] {
    const { pickup, dropoffs } = this.form().getRawValue();
    return this.locations.map((loc) => {
      let note: string | undefined;
      if (ownIndex !== 'pickup' && pickup === loc.id) note = 'Used as pickup';
      const other = dropoffs.findIndex((d, i) => d === loc.id && i !== ownIndex);
      if (!note && other >= 0) note = `Used as drop-off ${other + 1}`;
      return { value: loc.id, label: loc.name, disabled: !!note, note };
    });
  }

  /** Header text while the card is collapsed. */
  get collapsedSummary(): string {
    const r = this.routeSummary;
    return r ? `${r.names.join(' → ')} · ${r.km} km` : 'Not complete';
  }

  get needsAttention(): boolean {
    const f = this.form();
    const touchedInvalid = [f.controls.pickup, ...this.dropoffs.controls].some((c) => c.invalid && c.touched);
    return touchedInvalid || !!this.duplicateError;
  }

  get duplicateError(): string | null {
    return duplicateMessage(this.form());
  }

  /** Live route preview, e.g. "27 km", once every stop is chosen and unique. */
  get routeSummary(): { names: string[]; km: number } | null {
    const { pickup, dropoffs } = this.form().getRawValue();
    const stops = [pickup, ...dropoffs];
    if (stops.some((s) => s === null) || this.duplicateError) return null;
    const ids = stops as LocationId[];
    return { names: ids.map(locationName), km: routeDistanceKm(ids) };
  }
}
