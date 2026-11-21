import { Component, input, model } from '@angular/core';

let nextId = 0;

/**
 * Card with a clickable header that collapses its body. When collapsed, the
 * header shows a one-line summary so the user still sees what was entered.
 * The body is made `inert` while collapsed so hidden fields can't be tabbed to.
 */
@Component({
  selector: 'app-collapsible-card',
  standalone: true,
  templateUrl: './collapsible-card.component.html',
  styleUrl: './collapsible-card.component.css',
})
export class CollapsibleCardComponent {
  readonly heading = input.required<string>();
  readonly step = input<string | number | null>(null);
  /** Shown on the right of the header while expanded. */
  readonly hint = input<string | null>(null);
  /** Shown in the header while collapsed. */
  readonly summary = input<string | null>(null);
  /** Flags the section in the header (e.g. it contains errors). */
  readonly attention = input(false);
  /** Two-way bindable: [(collapsed)]. */
  readonly collapsed = model(false);

  readonly bodyId = `card-body-${nextId++}`;
  readonly headingId = `card-heading-${nextId++}`;

  toggle(): void {
    this.collapsed.update((c) => !c);
  }
}
