import type { AscentNote } from '../../../client-contract.js';
import { plural } from '../../../plural.js';
import { useApp } from '../app-context.js';
import { cx } from '../class-names.js';
import { Button } from '../components/Button.js';
import { Icon } from '../components/Icon.js';
import { Pressable } from '../components/Pressable.js';
import { SectionTitle } from '../components/Text.js';
import { timeAgo, timeAgoSpoken } from '../format.js';
import type { Load } from '../hooks/useLoad.js';
import { Avatar } from './Avatar.js';
import { GradeTag } from './GradeTag.js';
import { ReportButton } from './ReportButton.js';
import { SentBadge } from './SentBadge.js';
import './Notes.css';

/** What other climbers said about the route. A failing request leaves the rest of the page readable. */
export function Notes({ notes }: { notes: Load<AscentNote[]> }) {
  return (
    <view className="notes">
      <view className="split-row">
        <SectionTitle>Notes</SectionTitle>
        {notes.status === 'ready' && (
          <text className="t-body-s c-ink-2">{plural(notes.data.length, 'note')}</text>
        )}
      </view>
      <NoteList notes={notes} />
    </view>
  );
}

function NoteList({ notes }: { notes: Load<AscentNote[]> }) {
  if (notes.status === 'loading') {
    return (
      <view
        className="note-skeletons"
        aria-busy="true"
        accessibility-element
        accessibility-label="Loading notes"
      >
        {[0, 1].map((key) => (
          <view key={key} className="note-skeleton">
            {['40%', '90%', '70%'].map((width) => (
              <view key={width} className="skel skel-line" style={{ width }} />
            ))}
          </view>
        ))}
      </view>
    );
  }
  if (notes.status === 'error') {
    return (
      <view className="inline-note is-error" role="alert">
        <Icon name="alert" tone="danger" size={20} />
        <view className="inline-note-body">
          <text className="inline-note-text">
            Could not load notes. The route is fine, try again.
          </text>
          <Button kind="secondary" size="sm" icon="refresh" onTap={notes.reload}>
            Try again
          </Button>
        </view>
      </view>
    );
  }
  if (!notes.data.length) {
    return (
      <view className="inline-note">
        <Icon name="beta" tone="ink-2" size={20} />
        <text className="inline-note-text">
          No notes yet. Log your ascent and leave the first one.
        </text>
      </view>
    );
  }
  return (
    <view className="note-list">
      {notes.data.map((note) => (
        <Note key={note.id} note={note} />
      ))}
    </view>
  );
}

function Note({ note }: { note: AscentNote }) {
  const { auth, go } = useApp();
  const mine = note.author.username === auth?.user.username;
  return (
    <view className={cx('note', mine && 'is-mine')}>
      <view className="note-top split-row">
        <Pressable
          className="note-head"
          label={`Open profile of ${note.author.display_name}`}
          onTap={() => go({ name: 'profile', username: note.author.username })}
        >
          <Avatar person={note.author} size="s" />
          <text className="t-label c-link">{note.author.display_name}</text>
          <text
            className="note-time"
            accessibility-label={timeAgoSpoken(note.updated_at)}
          >{`· ${timeAgo(note.updated_at)}`}</text>
        </Pressable>
        {!mine && <ReportButton icon target="ascent" id={note.id} label="Report note" />}
      </view>
      <view className="note-meta">
        <SentBadge sent={note.sent} />
        {note.grade && (
          <view className="note-grade">
            <text className="t-cap c-ink-2">Graded</text>
            <GradeTag grade={note.grade} size="s" />
          </view>
        )}
      </view>
      <text className="note-body">{note.note}</text>
    </view>
  );
}
