import { type ReactNode, useState } from '@lynx-js/react';

import { api } from '../../../api.js';
import type { AuthSession, Gym, Report, User } from '../../../client-contract.js';
import { useApp } from '../app-context.js';
import { Async } from '../components/Async.js';
import { Button } from '../components/Button.js';
import { Hero, HeroHeader, HeroSubtitle, HeroTitle } from '../components/Hero.js';
import { Segmented } from '../components/Segmented.js';
import { RowSkeletons, State } from '../components/State.js';
import { DisplayText, SectionTitle } from '../components/Text.js';
import { useLoad } from '../hooks/useLoad.js';
import { AccountItem } from './admin/AccountItem.js';
import { GymItem } from './admin/GymItem.js';
import { ReportItem } from './admin/ReportItem.js';
import './Admin.css';

type Queues = { reports: Report[]; gyms: Gym[]; users: User[] };
type Tab = 'reports' | 'gyms' | 'accounts';

// The three lists a moderator works through: what a column and a tab are called, and what shows
// when nothing is waiting.
const SECTIONS: { id: Tab; title: string; tab: string; empty: ReactNode }[] = [
  {
    id: 'reports',
    title: 'Reports',
    tab: 'Reports',
    empty: <State title="No open reports" body="Nothing needs a decision right now." />,
  },
  {
    id: 'gyms',
    title: 'Gym requests',
    tab: 'Gyms',
    empty: <State title="No gyms awaiting approval" body="New requests show up here." />,
  },
  {
    id: 'accounts',
    title: 'Accounts',
    tab: 'Accounts',
    empty: <State title="No other accounts" body="Accounts appear once climbers sign up." />,
  },
];

export function Admin({ auth }: { auth: AuthSession }) {
  const { go } = useApp();
  if (auth.user.role === 'admin') return <Moderation auth={auth} />;
  return (
    <view className="page">
      <State failed title="Admins only" body="Administrator access is required.">
        <Button size="lg" block onTap={() => go({ name: 'account' }, 'reset')}>
          Go to account
        </Button>
      </State>
    </view>
  );
}

function Moderation({ auth }: { auth: AuthSession }) {
  const { token } = auth;
  const { wideLayout } = useApp();
  const [tab, setTab] = useState<Tab>('reports');
  const queues = useLoad(async (): Promise<Queues> => {
    const [reports, gyms, users] = await Promise.all([
      api.adminReports(token),
      api.adminGyms(token),
      api.adminUsers(token),
    ]);
    return { reports, gyms, users };
  }, [token]);

  return (
    <Async
      state={queues}
      loading={
        <>
          <Hero>
            <HeroTitle>Moderation</HeroTitle>
          </Hero>
          <view className="page">
            <RowSkeletons count={2} label="Loading moderation" />
          </view>
        </>
      }
      failure="Couldn't load moderation"
    >
      {({ reports, gyms, users }) => {
        const accounts = users.filter(({ id }) => id !== auth.user.id);
        const lists = {
          reports: reports.map((report) => (
            <ReportItem
              key={report.id}
              report={report}
              token={token}
              onDecided={() =>
                queues.update((q) => ({
                  ...q,
                  reports: q.reports.filter((r) => r.id !== report.id),
                }))
              }
            />
          )),
          gyms: gyms.map((gym) => (
            <GymItem
              key={gym.id}
              gym={gym}
              token={token}
              onDecided={() =>
                queues.update((q) => ({ ...q, gyms: q.gyms.filter((g) => g.id !== gym.id) }))
              }
            />
          )),
          accounts: accounts.map((account) => (
            <AccountItem
              key={account.id}
              account={account}
              token={token}
              onChanged={(disabled) =>
                queues.update((q) => ({
                  ...q,
                  users: q.users.map((u) => (u.id === account.id ? { ...u, disabled } : u)),
                }))
              }
            />
          )),
        };
        const counts = { reports: reports.length, gyms: gyms.length, accounts: accounts.length };

        return (
          <>
            <Hero>
              <HeroHeader
                title="Moderation"
                subtitle={
                  wideLayout
                    ? 'Decide on reports, approve gyms, manage accounts.'
                    : 'Reports, gym requests and accounts.'
                }
                aside={
                  wideLayout ? (
                    <view className="admin-totals">
                      {[
                        [counts.reports, 'reports'],
                        [counts.gyms, 'gyms waiting'],
                        [counts.accounts, 'accounts'],
                      ].map(([n, label]) => (
                        <view key={label} className="admin-total">
                          <DisplayText className="c-on-wall" size={36} leading={38}>
                            {String(n)}
                          </DisplayText>
                          <HeroSubtitle>{String(label)}</HeroSubtitle>
                        </view>
                      ))}
                    </view>
                  ) : (
                    <Segmented
                      label="Moderation lists"
                      value={tab}
                      onChange={setTab}
                      options={SECTIONS.map(({ id, tab: name }) => ({
                        id,
                        label: `${name} ${counts[id]}`,
                      }))}
                    />
                  )
                }
              />
            </Hero>
            {wideLayout ? (
              <view className="page admin-board">
                {SECTIONS.map(({ id, title, empty }) => (
                  <view key={id} className="admin-column">
                    <view className="admin-column-head split-row">
                      <SectionTitle>{title}</SectionTitle>
                      <text className="t-body-s c-ink-2">{String(counts[id])}</text>
                    </view>
                    <view className="admin-list">{counts[id] ? lists[id] : empty}</view>
                  </view>
                ))}
              </view>
            ) : (
              <view>{counts[tab] ? lists[tab] : SECTIONS.find(({ id }) => id === tab)!.empty}</view>
            )}
          </>
        );
      }}
    </Async>
  );
}
