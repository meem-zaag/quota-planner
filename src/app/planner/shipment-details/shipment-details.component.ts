import { Component, input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MAX_TRUCKS, MIN_TRUCKS, SERVICE_FEES, TRUCKS, TRUCK_LIST, fleetCapacityTonnes, parseLocalDateTime } from '../../domain';
import { CollapsibleCardComponent } from '../../shared/collapsible-card/collapsible-card.component';
import { DateTimePickerComponent } from '../../shared/date-time-picker/date-time-picker.component';
import { TripForm } from '../trip-form';
import { capacityMessage, controlMessage } from '../trip-form.messages';

/** Trucks, cargo, pickup time and optional services. */
@Component({
  selector: 'app-shipment-details',
  standalone: true,
  imports: [ReactiveFormsModule, CollapsibleCardComponent, DateTimePickerComponent],
  templateUrl: './shipment-details.component.html',
  styleUrl: './shipment-details.component.css',
})
export class ShipmentDetailsComponent {
  readonly form = input.required<TripForm>();

  readonly trucks = TRUCK_LIST;
  readonly truckCounts = Array.from({ length: MAX_TRUCKS - MIN_TRUCKS + 1 }, (_, i) => MIN_TRUCKS + i);
  readonly fees = SERVICE_FEES;

  get capacity(): number | null {
    const { truckCategory, truckCount } = this.form().getRawValue();
    return truckCategory && truckCount ? fleetCapacityTonnes(truckCategory, truckCount) : null;
  }

  get capacityError(): string | null {
    return capacityMessage(this.form());
  }

  error(name: 'cargoWeightTonnes' | 'pickupDateTime', label: string): string | null {
    const control = this.form().controls[name];
    return control.touched ? controlMessage(control, label) : null;
  }

  // --- Collapsed-card summaries ---------------------------------------------------
  get trucksSummary(): string {
    const { truckCategory, truckCount, cargoWeightTonnes } = this.form().getRawValue();
    if (!truckCategory || !truckCount) return 'Not complete';
    const trucks = `${truckCount} × ${TRUCKS[truckCategory].label}`;
    return cargoWeightTonnes ? `${trucks} · ${cargoWeightTonnes} T` : trucks;
  }

  get trucksNeedAttention(): boolean {
    const c = this.form().controls;
    return (
      [c.truckCategory, c.truckCount, c.cargoWeightTonnes].some((x) => x.invalid && x.touched) || !!this.capacityError
    );
  }

  get scheduleSummary(): string {
    const { pickupDateTime, loadingAssistance, unloadingAssistance } = this.form().getRawValue();
    const date = parseLocalDateTime(pickupDateTime);
    const when = date
      ? date.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
      : 'No pickup time';
    const services = [loadingAssistance && 'Loading', unloadingAssistance && 'Unloading'].filter(Boolean).join(' + ');
    return services ? `${when} · ${services}` : when;
  }

  get scheduleNeedsAttention(): boolean {
    const c = this.form().controls.pickupDateTime;
    return c.invalid && c.touched;
  }
}
