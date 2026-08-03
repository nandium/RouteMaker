import { API_PATHS } from '../src/client-contract.js';
import type { Gym, Metadata } from '../src/client-contract.js';
import { browserRequest } from './http.js';
import { mountEditor } from './editor.js';
import { mountMap } from './map.js';
import { element } from './shared.js';

export async function mountTool(root: HTMLElement, tool: 'map' | 'editor') {
  root.className = 'tool-page';
  root.replaceChildren();
  const intro = element('section', 'tool-intro');
  intro.append(
    element('p', 'tool-kicker', tool === 'map' ? 'Gym finder' : 'Route creator'),
    element('h1', '', tool === 'map' ? 'Climbing gyms, on a map.' : 'Mark the holds that matter.'),
    element(
      'p',
      '',
      tool === 'map'
        ? 'Browse approved gyms or request one after signing in.'
        : 'Choose a wall photo, add markers manually or detect holds, then publish.'
    )
  );
  root.append(intro);
  try {
    const gyms = await browserRequest<Gym[]>(API_PATHS.gyms);
    if (tool === 'map') {
      await mountMap(root, gyms);
    } else {
      mountEditor(root, gyms, await browserRequest<Metadata>(API_PATHS.meta));
    }
  } catch (error) {
    const failure = element(
      'p',
      'tool-status tool-status--error',
      error instanceof Error ? error.message : 'API unavailable'
    );
    const retry = element('button', '', 'Try again');
    retry.onclick = () => void mountTool(root, tool);
    if (tool === 'map') {
      const fallback = element('section', 'tool-card');
      fallback.append(failure, retry);
      root.append(fallback);
    } else {
      root.append(failure, retry);
    }
  }
}
