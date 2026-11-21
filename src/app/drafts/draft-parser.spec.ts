import { TestBed } from '@angular/core/testing';
import { CLOCK } from '../core/clock';
import { parseDraft } from './draft-parser';
import { DRAFT_STORAGE, DRAFT_STORAGE_KEY, DraftService } from './draft.service';
import { EMPTY_DRAFT, TripDraft } from './draft.model';

const stored = (trip: Record<string, unknown>) =>
  JSON.stringify({ version: 1, savedAt: '2026-11-21T06:00:00.000Z', trip });

describe('parseDraft (malformed saved data)', () => {
  it('returns nothing for a missing draft', () => {
    expect(parseDraft(null)).toEqual({ draft: null, savedAt: null, issues: [] });
  });

  it('discards invalid JSON safely', () => {
    const result = parseDraft('{not json');
    expect(result.draft).toBeNull();
    expect(result.issues.length).toBe(1);
  });

  it('discards the wrong overall shape or version', () => {
    expect(parseDraft('[]').draft).toBeNull();
    expect(parseDraft('"hello"').draft).toBeNull();
    expect(parseDraft(JSON.stringify({ version: 99, trip: {} })).draft).toBeNull();
  });

  it('clears unknown location IDs and duplicate locations, keeping valid ones', () => {
    const { draft, issues } = parseDraft(stored({ pickup: 'A', dropoffs: ['Z', 'B', 'A', 'B'] }));
    expect(draft?.pickup).toBe('A');
    expect(draft?.dropoffs).toEqual([null, 'B', null]); // truncated to 3, 'Z' unknown, 'A' duplicate
    expect(issues.length).toBe(3);
  });

  it('resets wrong data types and out-of-range truck counts', () => {
    const { draft } = parseDraft(
      stored({
        pickup: 42,
        dropoffs: 'B',
        truckCategory: 'rocket',
        truckCount: 9,
        cargoWeightTonnes: '5',
        pickupDateTime: 'tomorrow',
        loadingAssistance: 'yes',
      }),
    );
    expect(draft).toEqual({
      ...EMPTY_DRAFT,
      pickup: null,
      dropoffs: [null],
      truckCategory: null,
      truckCount: 1,
    });
  });

  it('keeps a well-formed draft intact', () => {
    const trip: TripDraft = {
      pickup: 'A',
      dropoffs: ['B', 'C'],
      truckCategory: 'medium',
      truckCount: 2,
      cargoWeightTonnes: 5,
      pickupDateTime: '2020-01-01T10:00', // past times are kept; the form re-validates them
      loadingAssistance: true,
      unloadingAssistance: false,
    };
    const result = parseDraft(stored({ ...trip }));
    expect(result.draft).toEqual(trip);
    expect(result.issues).toEqual([]);
  });
});

describe('DraftService', () => {
  let memory: Map<string, string>;
  let service: DraftService;

  beforeEach(() => {
    memory = new Map();
    const fakeStorage = {
      getItem: (k: string) => memory.get(k) ?? null,
      setItem: (k: string, v: string) => memory.set(k, v),
      removeItem: (k: string) => memory.delete(k),
    } as unknown as Storage;
    TestBed.configureTestingModule({
      providers: [
        { provide: DRAFT_STORAGE, useValue: fakeStorage },
        { provide: CLOCK, useValue: { now: () => new Date('2026-11-21T06:00:00.000Z') } },
      ],
    });
    service = TestBed.inject(DraftService);
  });

  it('round-trips a draft (save → load)', () => {
    const draft: TripDraft = { ...EMPTY_DRAFT, pickup: 'C', dropoffs: ['D', null] };
    service.save(draft);
    const loaded = service.load();
    expect(loaded.draft).toEqual(draft);
    expect(loaded.savedAt?.toISOString()).toBe('2026-11-21T06:00:00.000Z');
  });

  it('removes corrupted data so it is not reported on every load', () => {
    memory.set(DRAFT_STORAGE_KEY, '%%%');
    expect(service.load().issues.length).toBe(1);
    expect(memory.has(DRAFT_STORAGE_KEY)).toBeFalse();
    expect(service.load().issues.length).toBe(0);
  });
});
