import { ComponentFixture, TestBed, discardPeriodicTasks, fakeAsync, tick } from '@angular/core/testing';
import { CLOCK } from '../core/clock';
import { DRAFT_STORAGE, DRAFT_STORAGE_KEY } from '../drafts/draft.service';
import { QUOTE_LATENCY } from '../quote/quote.service';
import { TripPlannerComponent } from './trip-planner.component';

describe('TripPlannerComponent (integration)', () => {
  let fixture: ComponentFixture<TripPlannerComponent>;
  let component: TripPlannerComponent;
  let memory: Map<string, string>;
  let latencies: number[];
  let now: Date;

  const panelText = () => (fixture.nativeElement as HTMLElement).querySelector('.panel')!.textContent!.replace(/\s+/g, ' ');

  const create = () => {
    fixture = TestBed.createComponent(TripPlannerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  const fillVerificationExample = () => {
    component.form.patchValue({
      pickup: 'A',
      truckCategory: 'medium',
      truckCount: 2,
      cargoWeightTonnes: 5,
      pickupDateTime: '2026-11-22T09:00',
      loadingAssistance: true,
    });
    component.form.controls.dropoffs.at(0).setValue('B');
    fixture.debugElement.query((d) => d.nativeElement.textContent?.trim().endsWith('Add drop-off')).nativeElement.click();
    component.form.controls.dropoffs.at(1).setValue('C');
    fixture.detectChanges();
  };

  beforeEach(() => {
    memory = new Map();
    latencies = [];
    now = new Date(2026, 10, 21, 12, 0);
    TestBed.configureTestingModule({
      imports: [TripPlannerComponent],
      providers: [
        { provide: CLOCK, useValue: { now: () => new Date(now) } },
        { provide: QUOTE_LATENCY, useValue: () => latencies.shift() ?? 500 },
        {
          provide: DRAFT_STORAGE,
          useValue: {
            getItem: (k: string) => memory.get(k) ?? null,
            setItem: (k: string, v: string) => memory.set(k, v),
            removeItem: (k: string) => memory.delete(k),
          },
        },
      ],
    });
  });

  it('prices the brief example end-to-end through the UI', fakeAsync(() => {
    create();
    fillVerificationExample();
    component.requestQuote();
    fixture.detectChanges();
    expect(panelText()).toContain('Calculating');

    tick(500);
    fixture.detectChanges();
    expect(panelText()).toContain('27 km');
    expect(panelText()).toContain('4,590 BDT');
    expect(panelText()).toContain('1,200 BDT');
    expect(panelText()).toContain('5,790 BDT');
    discardPeriodicTasks();
  }));

  it('never shows a total for inputs edited while the quote was pending', fakeAsync(() => {
    create();
    fillVerificationExample();
    component.requestQuote();
    component.form.controls.truckCount.setValue(3); // edit mid-flight
    fixture.detectChanges();
    expect(panelText()).toContain('You changed the trip');

    tick(500);
    fixture.detectChanges();
    expect(panelText()).toContain('Out of date');
    expect(panelText()).not.toContain('5,790');
    discardPeriodicTasks();
  }));

  it('refuses to quote once the pickup time has passed, even without edits', fakeAsync(() => {
    create();
    fillVerificationExample();
    now = new Date(2026, 10, 22, 9, 30); // time moves past the pickup
    component.requestQuote();
    tick(1500);
    fixture.detectChanges();
    expect(panelText()).toContain('No estimate yet');
    expect(component.form.controls.pickupDateTime.hasError('notInFuture')).toBeTrue();
    discardPeriodicTasks();
  }));

  it('restores a saved draft without reviving a quote', fakeAsync(() => {
    create();
    fillVerificationExample();
    component.requestQuote();
    tick(500);
    component.saveDraft();
    expect(memory.has(DRAFT_STORAGE_KEY)).toBeTrue();
    fixture.destroy();

    create(); // simulates a page refresh
    expect(component.form.controls.dropoffs.value).toEqual(['B', 'C']);
    expect(panelText()).toContain('No estimate yet');
    discardPeriodicTasks();
  }));
});
