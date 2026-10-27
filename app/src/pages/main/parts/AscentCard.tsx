import { useState } from '@lynx-js/react';

import { api } from '../../../api.js';
import { type AuthSession, MAX_NOTE_LENGTH, type Route } from '../../../client-contract.js';
import { WEB_PATHS } from '../../../web-pages.js';
import { useApp } from '../app-context.js';
import { Button } from '../components/Button.js';
import { Card } from '../components/Card.js';
import { Field } from '../components/Field.js';
import { FieldFrame } from '../components/FieldFrame.js';
import { GradePicker } from './GradePicker.js';
import { GradeTag } from './GradeTag.js';
import { Segmented } from '../components/Segmented.js';
import { SentBadge } from './SentBadge.js';
import { SectionTitle } from '../components/Text.js';
import type { Load } from '../hooks/useLoad.js';
import './AscentCard.css';

/** Changes the route on screen in place. */
export type UpdateRoute = Load<Route>['update'];

/** A climber's ascent as it is being filled in. */
type Draft = { sent: boolean; grade: string; note: string };

const SENT_OPTIONS = [
  { id: 'sent', label: 'Sent it', icon: 'check-circle' },
  { id: 'projecting', label: 'Projecting', icon: 'proj' },
] as const;

/**
 * The signed-in climber's own ascent of the route: sent or still projecting, a suggested grade, a
 * note. It is a prompt until a choice is made, a form while being filled in, and a summary after.
 */
export function AscentCard({
  route,
  update,
  reloadNotes,
}: {
  route: Route;
  update: UpdateRoute;
  /** Called after the ascent changes, since its note is listed under the route. */
  reloadNotes: () => void;
}) {
  const { auth, go } = useApp();
  if (!auth) {
    return (
      <Card>
        <SectionTitle>Log your ascent</SectionTitle>
        <text className="t-body c-ink-2">
          Sign in to mark a send, suggest a grade and leave a note. Browsing stays open.
        </text>
        <Button
          size="lg"
          block
          icon="user"
          onTap={() => go({ name: 'login', next: WEB_PATHS.route(route.id) })}
        >
          Sign in to log it
        </Button>
      </Card>
    );
  }
  return <Ascent auth={auth} route={route} update={update} reloadNotes={reloadNotes} />;
}

function Ascent({
  auth,
  route,
  update,
  reloadNotes,
}: {
  auth: AuthSession;
  route: Route;
  update: UpdateRoute;
  reloadNotes: () => void;
}) {
  const { notify, run } = useApp();
  const logged = route.my_ascent;
  const [draft, setDraft] = useState<Draft | null>(null);

  const save = (ascent: Draft) => {
    'background only';
    void run(async () => {
      // The whole ascent is replaced, and a grade counts toward the public grade only with a send.
      const updated = await api.logAscent(auth.token, route.id, {
        sent: ascent.sent,
        grade: ascent.grade || null,
        note: ascent.note.trim() || null,
      });
      update(() => updated);
      reloadNotes();
      setDraft(null);
      notify('success', 'Ascent saved.');
    });
  };

  const remove = () => {
    'background only';
    void run(async () => {
      const updated = await api.removeAscent(auth.token, route.id);
      update(() => updated);
      reloadNotes();
      setDraft(null);
      notify('success', 'Ascent removed.');
    });
  };

  if (draft) {
    return (
      <AscentForm
        draft={draft}
        onChange={setDraft}
        publicGrade={route.public_grade}
        editing={logged !== null}
        onSave={() => save(draft)}
        onRemove={remove}
      />
    );
  }

  if (logged) {
    return (
      <Card>
        <SectionTitle>Your ascent</SectionTitle>
        <view className="ascent-summary">
          <view className="ascent-badges">
            <SentBadge sent={logged.sent} />
            {logged.grade && (
              <view className="ascent-grade">
                <text className="t-cap c-ink-2">Your grade</text>
                <GradeTag grade={logged.grade} size="s" />
              </view>
            )}
          </view>
          {logged.note ? (
            <text className="t-body">{logged.note}</text>
          ) : (
            <text className="t-body c-ink-3">No note added.</text>
          )}
        </view>
        <view className="btn-row">
          <Button
            kind="secondary"
            size="sm"
            icon="edit"
            onTap={() =>
              setDraft({ sent: logged.sent, grade: logged.grade ?? '', note: logged.note ?? '' })
            }
          >
            Edit
          </Button>
          <Button kind="quiet-danger" size="sm" icon="trash" onTap={remove}>
            Remove
          </Button>
        </view>
      </Card>
    );
  }

  return (
    <Card>
      <SectionTitle>Your ascent</SectionTitle>
      <text className="t-body c-ink-2">
        Climbed it? Log it, suggest a grade and leave a note for the next climber.
      </text>
      <Segmented
        label="Did you send it?"
        options={SENT_OPTIONS}
        value={null}
        onChange={(id) => setDraft({ sent: id === 'sent', grade: '', note: '' })}
      />
    </Card>
  );
}

function AscentForm({
  draft,
  onChange,
  publicGrade,
  editing,
  onSave,
  onRemove,
}: {
  draft: Draft;
  onChange: (draft: Draft) => void;
  publicGrade: string;
  editing: boolean;
  onSave: () => void;
  onRemove: () => void;
}) {
  const { working } = useApp();
  return (
    <Card>
      <view className="split-row">
        <SectionTitle>Your ascent</SectionTitle>
        {editing && <text className="t-cap-b c-ink-2">Editing</text>}
      </view>
      <Segmented
        label="Did you send it?"
        options={SENT_OPTIONS}
        value={draft.sent ? 'sent' : 'projecting'}
        onChange={(id) => onChange({ ...draft, sent: id === 'sent' })}
      />
      <FieldFrame
        label="Grade you would give it (optional)"
        hint={
          draft.sent
            ? 'Your grade counts toward the public grade because you sent it.'
            : "Saved with your ascent, but it only counts toward the public grade once you've sent it."
        }
      >
        <GradePicker
          value={draft.grade}
          current={publicGrade}
          onChange={(grade) => onChange({ ...draft, grade })}
        />
      </FieldFrame>
      <Field
        label="Note (optional)"
        value={draft.note}
        onInput={(note) => onChange({ ...draft, note })}
        maxLength={MAX_NOTE_LENGTH}
        showCount
        placeholder="Beta, conditions, how it felt"
      />
      <Button size="lg" block icon="check" busy={working} onTap={onSave}>
        Save ascent
      </Button>
      {editing && (
        <Button kind="quiet-danger" size="sm" icon="trash" onTap={onRemove}>
          Remove my ascent
        </Button>
      )}
    </Card>
  );
}
