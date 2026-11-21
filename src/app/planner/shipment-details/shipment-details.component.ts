import { Component, inject, input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { CLOCK } from '../../core/clock';
import { MAX_TRUCKS, MIN_TRUCKS, SERVICE_FEES, TRUCK_LIST, fleetCapacityTonnes, toLocalDateTimeValue } from '../../domain';
import { TripForm } from '../trip-form';
import { capacityMessage, controlMessage } from '../trip-form.messages';

/** Trucks, cargo, pickup time and optional services. */
@Component({
  selector: 'app-shipment-details',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './shipment-details.component.html',
  styleUrl: './shipment-details.component.css',
})
export class ShipmentDetailsComponent {
  readonly form = input.required<TripForm>();
  private readonly clock = inject(CLOCK);

  readonly trucks = TRUCK_LIST;
  readonly truckCounts = Array.from({ length: MAX_TRUCKS - MIN_TRUCKS + 1 }, (_, i) => MIN_TRUCKS + i);
  readonly fees = SERVICE_FEES;

  /** Earliest selectable time in the picker (the validator is the real check). */
  get minDateTime(): string {
    const next = this.clock.now();
    next.setMinutes(next.getMinutes() + 1);
    return toLocalDateTimeValue(next);
  }

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
}
