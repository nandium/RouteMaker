import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { STORAGE_KEYS } from '../storage.js';
import type { GymListing, Place } from '../../src/client-contract.js';
import { browserRequest } from '../http.js';
import { allByRole, byRole, installDom, queryByRole, settle } from '../test-dom.js';
import { createInitialMapCenter, mountMap } from './map.js';

const maplibre = vi.hoisted(() => {
  const state = {
    failOnCreate: false,
    maps: [] as FakeMap[],
    markers: [] as FakeMarker[],
  };
  class FakeMap {
    handlers = new Map<string, (event?: unknown) => void>();
    flyTo = vi.fn();
    setCenter = vi.fn();
    setStyle = vi.fn();
    remove = vi.fn();
    addControl = vi.fn();
    constructor() {
      if (state.failOnCreate) throw new Error('WebGL is unavailable.');
      state.maps.push(this);
    }
    on(type: string, handler: (event?: unknown) => void) {
      this.handlers.set(type, handler);
    }
    getCenter() {
      return { lat: 1.3, lng: 103.8 };
    }
    getZoom() {
      return 10;
    }
    emit(type: string, event?: unknown) {
      this.handlers.get(type)?.(event);
    }
  }
  class FakePopup {
    offset: unknown;
    content?: HTMLElement;
    setDOMContent(content: HTMLElement) {
      this.content = content;
      return this;
    }
    setOffset(offset: unknown) {
      this.offset = offset;
      return this;
    }
    isOpen() {
      return false;
    }
  }
  class FakeMarker {
    popup?: FakePopup;
    togglePopup = vi.fn();
    constructor(readonly options: { element: HTMLElement }) {
      state.markers.push(this);
    }
    setLngLat() {
      return this;
    }
    setPopup(popup: FakePopup) {
      this.popup = popup;
      return this;
    }
    getPopup() {
      return this.popup;
    }
    addTo() {
      return this;
    }
  }
  class FakeNavigationControl {
    constructor(readonly options: unknown) {}
  }
  return { state, FakeMap, FakeMarker, FakePopup, FakeNavigationControl };
});

vi.mock('maplibre-gl', () => ({
  Map: maplibre.FakeMap,
  Marker: maplibre.FakeMarker,
  Popup: maplibre.FakePopup,
  NavigationControl: maplibre.FakeNavigationControl,
  setWorkerUrl: vi.fn(),
}));
vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}));
vi.mock('../http.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../http.js')>()),
  browserRequest: vi.fn(),
}));
vi.mock('../theme.js', () => ({
  currentScheme: () => 'light',
  onThemeChange: vi.fn(() => () => undefined),
}));

const request = vi.mocked(browserRequest);

describe('initial map centering', () => {
  const map = () => ({ flyTo: vi.fn(), getZoom: vi.fn(() => 10), setCenter: vi.fn() });

  it('lets device location replace a coarse fallback', () => {
    const target = map();
    const center = createInitialMapCenter(target);

    center.fallback({ latitude: 1.35, longitude: 103.82 });
    center.device({ latitude: 1.3004, longitude: 103.8006 });

    expect(target.setCenter).toHaveBeenCalledWith([103.82, 1.35]);
    expect(target.flyTo).toHaveBeenCalledWith({ center: [103.801, 1.3], zoom: 13 });
  });

  it('does not let a late fallback replace device location', () => {
    const target = map();
    const center = createInitialMapCenter(target);

    center.device({ latitude: 1.3, longitude: 103.8 });
    center.fallback({ latitude: 1.35, longitude: 103.82 });

    expect(target.flyTo).toHaveBeenCalledOnce();
    expect(target.setCenter).not.toHaveBeenCalled();
  });

  it('does not move the map after user interaction', () => {
    const target = map();
    const center = createInitialMapCenter(target);

    center.interact();
    center.fallback({ latitude: 1.35, longitude: 103.82 });
    center.device({ latitude: 1.3, longitude: 103.8 });

    expect(target.setCenter).not.toHaveBeenCalled();
    expect(target.flyTo).not.toHaveBeenCalled();
  });
});

const gym: GymListing = {
  id: 'gym-1',
  name: 'Boulder+ Aperia',
  address: '12 Kallang Ave, Singapore',
  country_code: 'SG',
  latitude: 1.31,
  longitude: 103.86,
  status: 'approved',
  route_count: 3,
};

describe('gym map page', () => {
  let root: HTMLElement;

  beforeEach(() => {
    installDom('http://localhost/gyms/map');
    maplibre.state.failOnCreate = false;
    maplibre.state.maps.length = 0;
    maplibre.state.markers.length = 0;
    request.mockReset();
    request.mockResolvedValue(null);
    root = document.createElement('main');
    document.body.append(root);
  });
  afterEach(() => vi.unstubAllGlobals());

  const inputFor = (label: string) => byRole<HTMLInputElement>(root, 'textbox', label);
  const search = async (query: string) => {
    byRole<HTMLInputElement>(root, 'textbox', 'Search gyms or places').value = query;
    byRole<HTMLFormElement>(root, 'search').requestSubmit();
    await settle();
  };

  it('lists the gyms with their route counts and puts a pin on the map for each', async () => {
    await mountMap(root, [gym]);

    expect(byRole(root, 'heading', 'Approved gyms')).toBeTruthy();
    expect(root.textContent).toContain('3 routes');
    const pins = maplibre.state.markers.filter((marker) => marker.popup);
    expect(pins).toHaveLength(1);
    expect(pins[0].options.element.getAttribute('aria-label')).toBe(`Open ${gym.name}`);
    expect(pins[0].options.element.querySelector('svg')).not.toBeNull();
    const popup = (pins[0].popup as { content: HTMLElement }).content;
    expect(popup.textContent).toContain(gym.name);
    expect(popup.textContent).toContain('3 routes');
    expect(byRole(popup, 'link', 'View routes').getAttribute('href')).toBe('/gyms/gym-1');
  });

  it('links each gym in the list to its routes', async () => {
    await mountMap(root, [gym]);

    expect(byRole(root, 'link', `View routes at ${gym.name}`).getAttribute('href')).toBe(
      '/gyms/gym-1'
    );
  });

  it('adds zoom buttons without a compass', async () => {
    await mountMap(root, [gym]);

    const [control, position] = maplibre.state.maps[0].addControl.mock.calls[0];
    expect(control.options).toEqual({ showCompass: false });
    expect(position).toBe('top-right');
  });

  it('opens each popup above its rendered pin', async () => {
    Object.defineProperty(window.HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      value: 34,
    });

    await mountMap(root, [gym]);

    const pin = maplibre.state.markers.find((marker) => marker.popup)!;
    expect((pin.popup as { offset: number }).offset).toBe(34);
  });

  it('keeps the list and the coordinate form when the map cannot start', async () => {
    localStorage.setItem(STORAGE_KEYS.session, 'token');
    maplibre.state.failOnCreate = true;

    await mountMap(root, [gym]);

    expect(queryByRole(root, 'region')).toBeNull();
    expect(queryByRole(root, 'heading', 'Map')).toBeNull();
    expect(byRole(root, 'alert').textContent).toBe(
      'The map could not start on this device. The approved gym list is still available below.'
    );
    expect(root.textContent).toContain(gym.name);
    expect(root.textContent).toContain('Enter the gym coordinates below.');
  });

  it('fills the request coordinates from a map click, but not from a marker click', async () => {
    localStorage.setItem(STORAGE_KEYS.session, 'token');
    await mountMap(root, [gym]);
    const map = maplibre.state.maps[0];
    const markerElement = document.createElement('div');
    markerElement.className = 'maplibregl-marker';

    map.emit('click', { originalEvent: { target: markerElement }, lngLat: { lat: 9, lng: 9 } });
    expect(inputFor('Latitude').value).toBe('');

    map.emit('click', {
      originalEvent: { target: document.createElement('canvas') },
      lngLat: { lat: 1.3521, lng: 103.8198 },
    });
    expect(inputFor('Latitude').value).toBe('1.352100');
    expect(inputFor('Longitude').value).toBe('103.819800');
  });

  it('flies to a searched place and offers it for the request', async () => {
    localStorage.setItem(STORAGE_KEYS.session, 'token');
    const place: Place = {
      name: 'Kallang Wave',
      address: 'Stadium Walk',
      latitude: 1.303,
      longitude: 103.875,
    };
    request.mockImplementation(async (path) => (path.startsWith('/places') ? [place] : null));
    await mountMap(root, []);

    await search('kallang');
    allByRole<HTMLButtonElement>(byRole(root, 'search'), 'button', /Kallang Wave/)[0].click();

    expect(maplibre.state.maps[0].flyTo).toHaveBeenCalledWith({
      center: [103.875, 1.303],
      zoom: 15,
    });
    expect(inputFor('Latitude').value).toBe('1.303000');
  });

  it('opens the popup when a known gym is picked', async () => {
    await mountMap(root, [gym]);

    await search('aperia');
    allByRole<HTMLButtonElement>(byRole(root, 'search'), 'button', /Boulder\+ Aperia/)[0].click();

    const pin = maplibre.state.markers.find((marker) => marker.popup)!;
    expect(pin.togglePopup).toHaveBeenCalledOnce();
  });
});
