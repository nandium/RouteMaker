import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Gym, Place } from '../../src/client-contract.js';
import { browserRequest } from '../http.js';
import { allByRole, byRole, installDom, settle } from '../test-dom.js';
import { createPlaceSearch, mergeHits, searchGyms, type SearchHit } from './place-search.js';

vi.mock('../http.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../http.js')>()),
  browserRequest: vi.fn(),
}));

const request = vi.mocked(browserRequest);

function gym(name = 'Boulder+ Aperia'): Gym {
  return {
    id: 'gym-1',
    name,
    address: '12 Kallang Ave, Singapore',
    country_code: 'SG',
    latitude: 1.31,
    longitude: 103.86,
    status: 'approved',
  };
}

function place(index: number, latitude = 1.32, longitude = 103.87): Place {
  return {
    name: `Place ${index}`,
    address: `Address ${index}`,
    latitude: latitude + index / 1000,
    longitude: longitude + index / 1000,
  };
}

describe('result merging', () => {
  it('matches gyms by name or address, ignoring case', () => {
    const gyms = [gym(), gym('Climb Central')];

    expect(searchGyms(gyms, 'xyz')).toEqual([]);
    expect(searchGyms(gyms, 'central').map((hit) => hit.name)).toEqual(['Climb Central']);
    expect(searchGyms(gyms, 'kallang')).toHaveLength(2);
  });

  it('drops places at a gym and caps the list, keeping a slot for places', () => {
    const local: SearchHit[] = searchGyms(
      Array.from({ length: 6 }, (_, index) => ({
        ...gym(`Gym ${index}`),
        latitude: index,
        longitude: 1,
      })),
      'gym'
    );
    const duplicate: Place = { ...place(0), latitude: 0, longitude: 1 };

    const hits = mergeHits(local, [duplicate, place(1)]);

    expect(hits.map((hit) => hit.name)).toEqual(['Gym 0', 'Gym 1', 'Gym 2', 'Gym 3', 'Place 1']);
  });

  it('uses every slot for gyms when no place is left', () => {
    const local = searchGyms(
      Array.from({ length: 6 }, (_, index) => ({
        ...gym(`Gym ${index}`),
        latitude: index,
        longitude: 1,
      })),
      'gym'
    );

    expect(mergeHits(local, [])).toHaveLength(5);
  });
});

describe('place search box', () => {
  beforeEach(() => {
    installDom();
    request.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  function mount(gyms: Gym[] = []) {
    const pick = vi.fn();
    const form = createPlaceSearch({
      gyms,
      center: () => ({ latitude: 1.301234, longitude: 103.801234 }),
      pick,
    });
    document.body.append(form);
    const input = byRole<HTMLInputElement>(form, 'textbox', 'Search gyms or places');
    const results = form.querySelector<HTMLElement>('[aria-label="Search results"]')!;
    return {
      pick,
      input,
      results,
      choices: () => allByRole<HTMLButtonElement>(results, 'button'),
      search(query: string) {
        input.value = query;
        form.requestSubmit();
      },
    };
  }

  it('always asks the geocoder, merges with local gyms and credits the sources', async () => {
    const local = gym();
    request.mockResolvedValue([
      { ...place(0), latitude: local.latitude, longitude: local.longitude },
      ...Array.from({ length: 8 }, (_, index) => place(index + 1)),
    ]);
    const { search, results, choices } = mount([local]);

    search('boulder+');
    await settle();

    expect(request).toHaveBeenCalledOnce();
    expect(request.mock.calls[0][0]).toContain('q=boulder%2B&lat=1.301&lon=103.801');
    expect(choices()).toHaveLength(5);
    expect(results.textContent).toContain(local.name);
    expect(results.textContent).not.toContain('Place 0');
    expect(byRole(results, 'link', '© OpenStreetMap contributors')).toBeTruthy();
  });

  it('counts results in the singular too', async () => {
    request.mockResolvedValue([place(1)]);
    const { search, results } = mount();

    search('kallang');
    await settle();

    expect(byRole(results, 'status').textContent).toBe('1 result');
  });

  it('hands the chosen result to the map and fills the box', async () => {
    const local = gym();
    request.mockResolvedValue([]);
    const { search, results, choices, pick, input } = mount([local]);

    search('aperia');
    await settle();
    choices()[0].click();

    expect(pick).toHaveBeenCalledWith(expect.objectContaining({ name: local.name, gym: local }));
    expect(input.value).toBe(local.name);
    expect(results.hidden).toBe(true);
  });

  it('aborts on dismissal and ignores the late response', async () => {
    let resolvePlaces!: (places: Place[]) => void;
    request.mockImplementation(() => new Promise<Place[]>((resolve) => (resolvePlaces = resolve)));
    const { search, input, results } = mount();

    search('pending place');
    const signal = request.mock.calls[0][1]?.signal;
    input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    resolvePlaces([place(1)]);
    await settle();

    expect(signal?.aborted).toBe(true);
    expect(results.hidden).toBe(true);
    expect(results.childElementCount).toBe(0);
  });

  it('lets a newer search replace one still in flight', async () => {
    const answers: Array<(places: Place[]) => void> = [];
    request.mockImplementation(() => new Promise<Place[]>((resolve) => answers.push(resolve)));
    const { search, results } = mount();

    search('first place');
    search('second place');
    expect(request.mock.calls[0][1]?.signal?.aborted).toBe(true);
    answers[1]([place(2)]);
    await settle();
    answers[0]([place(1)]);
    await settle();

    expect(results.textContent).toContain('Place 2');
    expect(results.textContent).not.toContain('Place 1');
  });

  it('keeps local results when the geocoder fails', async () => {
    request.mockRejectedValue(new Error('Provider unavailable'));
    const local = gym();
    const { search, results } = mount([local]);

    search('boulder+');
    await settle();

    expect(results.textContent).toContain(local.name);
    expect(results.textContent).not.toContain('Provider unavailable');
  });

  it('shows the failure when nothing local matches', async () => {
    request.mockRejectedValue(new Error('Provider unavailable'));
    const { search, results } = mount();

    search('nowhere');
    await settle();

    expect(byRole(results, 'alert').textContent).toBe('Provider unavailable');
  });

  it('says when nothing was found', async () => {
    request.mockResolvedValue([]);
    const { search, results } = mount();

    search('nowhere');
    await settle();

    expect(results.textContent).toContain('No places found.');
  });

  it('explains a query that is too short once padding is trimmed, and keeps working', async () => {
    request.mockResolvedValue([place(1)]);
    const { search, results } = mount();

    search('   ab   ');
    await settle();
    expect(byRole(results, 'alert').textContent).toBe('Search needs at least 3 characters.');
    expect(request).not.toHaveBeenCalled();

    search('kallang');
    await settle();

    expect(request).toHaveBeenCalledOnce();
    expect(results.textContent).toContain('Place 1');
  });
});
