import type { User } from '../../../client-contract.js';
import { InitialTile } from '../components/InitialTile.js';

/** The first letter of a person's name; there are no photos. */
export const initialOf = (person: Pick<User, 'username' | 'display_name'>) =>
  [...(person.display_name || person.username || '?').trim()][0]?.toUpperCase() ?? '?';

export const Avatar = ({
  person,
  size = 'm',
}: {
  person: Pick<User, 'username' | 'display_name'>;
  size?: 's' | 'm' | 'l';
}) => <InitialTile letter={initialOf(person)} size={size} />;
