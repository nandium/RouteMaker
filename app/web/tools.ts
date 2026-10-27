import { API_PATHS } from '../src/client-contract.js';
import type { GymListing, User } from '../src/client-contract.js';
import { mountAuthAction, mountUsedLink } from './auth-action.js';
import { button, createHero, createStatus, element } from './dom.js';
import { createHeader } from './header.js';
import { browserRequest, errorMessage, isUnauthorized } from './http.js';
import { showTitle, type ToolPage } from './pages.js';
import { redirectToLogin, storedSession } from './session.js';
import './tools.css';

type GymTool = {
  hero: readonly [title: string, subtitle: string];
  mount: (main: HTMLElement, gyms: GymListing[]) => Promise<void>;
};

/**
 * Who the token belongs to; null when it has expired. Asking before the editor opens finds an
 * expired session now rather than at publish time, and says whose draft to offer.
 */
async function signedInUser(token: string) {
  try {
    return await browserRequest<User>(API_PATHS.me, { token });
  } catch (error) {
    if (isUnauthorized(error)) return null;
    throw error;
  }
}

const GYM_TOOLS: Record<'gym-map' | 'new-route', GymTool> = {
  'gym-map': {
    hero: [
      'Gym map',
      'Browse approved gyms, search for a place, or request a gym that is missing.',
    ],
    mount: async (main, gyms) => (await import('./map/map.js')).mountMap(main, gyms),
  },
  'new-route': {
    hero: ['Add a route', 'Photograph the wall, mark the holds, publish to your gym.'],
    mount: async (main, gyms) => {
      const token = storedSession();
      const [editor, user] = await Promise.all([
        import('./editor/editor.js'),
        token ? signedInUser(token) : null,
      ]);
      if (!user) return redirectToLogin();
      editor.mountEditor(main, gyms, user.id);
    },
  },
};

export async function mountToolPage(root: HTMLElement, page: ToolPage) {
  showTitle(page);
  root.className = 'tool-page';
  document.body.prepend(createHeader(page.name));
  if (page.name === 'auth-action') return mountAuthAction(root, page.mode, page.oobCode);
  if (page.name === 'used-link') return mountUsedLink(root);
  const tool = GYM_TOOLS[page.name];
  const load = async () => {
    const main = element('main', 'tool-main');
    root.replaceChildren(createHero(...tool.hero), main);
    try {
      await tool.mount(main, await browserRequest<GymListing[]>(API_PATHS.gyms));
    } catch (error) {
      const retry = button('Try again', 'secondary');
      retry.onclick = () => void load();
      main.append(createStatus(errorMessage(error), 'error'), retry);
    }
  };
  await load();
}
