import { useEffect, useRef, useState } from '@lynx-js/react';

import {
  ApiError,
  api,
  apiBaseUrl,
  type Comment,
  type Gym,
  type PublicProfile,
  type Report,
  type Route,
  type User,
} from '../../api.js';
import {
  appearanceStore,
  isThemePreference,
  resolveColorScheme,
  type ColorScheme,
  type ThemePreference,
} from '../../appearance.js';
import { BRAND_PALETTE, logoMarkSvg } from '../../brand.js';
import { APP_NAME } from '../../client-contract.js';
import { navigation } from '../../navigation.js';
import { sessionStore } from '../../session.js';
import { shareRoute } from '../../share.js';
import { loginPath, WEB_PATHS, type AppRoute } from '../../web-routes.js';
import {
  Action,
  AppearanceToggle,
  Field,
  NavItem,
  Pressable,
  RouteList,
  ToolLink,
} from './components.js';
import './App.css';

type Screen = 'explore' | 'feed' | 'route' | 'profile' | 'account' | 'admin';
type AuthMode = 'login' | 'signup' | 'forgot';
type NoticeKind = 'success' | 'error';
type AppBootstrap = {
  initialRoute?: AppRoute;
  wideLayout?: boolean;
  themePreference?: ThemePreference;
  systemTheme?: ColorScheme;
};

const GUEST_NAME = 'Guest';
const DEFAULT_ROUTE: AppRoute = { name: 'gyms' };

const initialData = lynx.__presetData?.initial_data as AppBootstrap | undefined;
const globalProps = lynx.__globalProps as AppBootstrap;
const initialRoute = globalProps?.initialRoute ?? initialData?.initialRoute ?? DEFAULT_ROUTE;
const initialWideLayout = Boolean(globalProps?.wideLayout ?? initialData?.wideLayout);
const configuredTheme = globalProps?.themePreference ?? initialData?.themePreference;
const initialThemePreference = isThemePreference(configuredTheme) ? configuredTheme : null;
const initialSystemTheme =
  (globalProps?.systemTheme ?? initialData?.systemTheme) === 'dark' ? 'dark' : 'light';
const initialScreen: Screen =
  initialRoute.name === 'feed'
    ? 'feed'
    : initialRoute.name === 'account' ||
        initialRoute.name === 'login' ||
        initialRoute.name === 'signup' ||
        initialRoute.name === 'forgot-password'
      ? 'account'
      : initialRoute.name === 'admin'
        ? 'admin'
        : 'explore';
const initialAuthMode: AuthMode =
  initialRoute.name === 'signup'
    ? 'signup'
    : initialRoute.name === 'forgot-password'
      ? 'forgot'
      : 'login';
const initialNextPath =
  initialRoute.name === 'login' || initialRoute.name === 'signup' ? initialRoute.next : undefined;

export function App() {
  // Navigation selects a screen, while each action updates the API-backed state
  // it owns. Keeping that flow local avoids a routing/store framework here.
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [selectedGym, setSelectedGym] = useState<Gym | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<PublicProfile | null>(null);
  const [routeOrigin, setRouteOrigin] = useState<Screen>('feed');
  const [profileOrigin, setProfileOrigin] = useState<Screen>('feed');
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [message, setMessage] = useState('');
  const [noticeKind, setNoticeKind] = useState<NoticeKind>('error');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [gymsLoading, setGymsLoading] = useState(true);
  const [gymsFailed, setGymsFailed] = useState(false);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [followingFeed, setFollowingFeed] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>(initialAuthMode);
  const [postLoginPath, setPostLoginPath] = useState<string | undefined>(initialNextPath);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [commentBody, setCommentBody] = useState('');
  const [grade, setGrade] = useState('');
  const [reports, setReports] = useState<Report[]>([]);
  const [pendingGyms, setPendingGyms] = useState<Gym[]>([]);
  const [adminUsers, setAdminUsers] = useState<User[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const initialRouteHandled = useRef(false);
  const authGeneration = useRef(0);
  const [sessionReady, setSessionReady] = useState(false);
  const [themePreference, setThemePreference] = useState<ThemePreference | null>(
    initialThemePreference
  );
  const colorScheme = resolveColorScheme(themePreference, initialSystemTheme);
  const themeClass = ` theme-${colorScheme}`;

  // Mutations are serialized to make double taps harmless. Background reads can
  // opt out so a slow startup request never blocks sign-in or navigation.
  const attempt = async (work: () => Promise<void>, exclusive = true) => {
    if (exclusive && busyRef.current) return false;
    if (exclusive) {
      busyRef.current = true;
      setBusy(true);
    }
    setMessage('');
    try {
      await work();
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401 && token) {
        authGeneration.current += 1;
        sessionStore.clear();
        setToken(null);
        setUser(null);
        setAuthMode('login');
        setNoticeKind('error');
        setMessage('Your saved session expired. Sign in again to continue.');
      } else {
        setNoticeKind('error');
        setMessage(error instanceof Error ? error.message : 'Something went wrong');
      }
      return false;
    } finally {
      if (exclusive) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  };

  const notify = (kind: NoticeKind, text: string) => {
    setNoticeKind(kind);
    setMessage(text);
  };

  const toggleTheme = () => {
    const nextTheme = colorScheme === 'light' ? 'dark' : 'light';
    setThemePreference(nextTheme);
    appearanceStore.save(nextTheme);
  };

  const authPath = (mode: AuthMode) =>
    mode === 'signup'
      ? WEB_PATHS.signup
      : mode === 'forgot'
        ? WEB_PATHS.forgotPassword
        : loginPath(postLoginPath);

  const changeAuthMode = (mode: AuthMode) => {
    setMessage('');
    setAuthMode(mode);
    navigation.push(authPath(mode));
  };

  const requireLogin = (text: string, next?: string) => {
    notify('error', text);
    setPostLoginPath(next);
    setAuthMode('login');
    setScreen('account');
    navigation.push(loginPath(next));
  };

  const loadGyms = async () => {
    setGymsLoading(true);
    setGymsFailed(false);
    const succeeded = await attempt(async () => {
      setGyms(await api.gyms());
    }, false);
    setGymsFailed(!succeeded);
    setGymsLoading(false);
  };
  const loadFeed = (following = followingFeed) => {
    if (busyRef.current) return Promise.resolve(false);
    setRoutesLoading(true);
    setRoutes([]);
    return attempt(async () => {
      setRoutes(await api.routes(token, { following }));
      setFollowingFeed(following);
    }).finally(() => setRoutesLoading(false));
  };

  useEffect(() => {
    void loadGyms();
    const generation = authGeneration.current;
    void sessionStore
      .load()
      .then(async (savedToken) => {
        if (!savedToken) return;
        try {
          const savedUser = await api.me(savedToken);
          if (generation !== authGeneration.current) return;
          setToken(savedToken);
          setUser(savedUser);
          setDisplayName(savedUser.display_name);
        } catch (error) {
          if (generation !== authGeneration.current) return;
          if (error instanceof ApiError && error.status === 401) {
            sessionStore.clear();
          } else {
            setNoticeKind('error');
            setMessage('Could not restore your session. Check your connection and try again.');
          }
        }
      })
      .finally(() => {
        if (generation === authGeneration.current) setSessionReady(true);
      });
  }, []);

  const chooseGym = (gym: Gym, syncHistory = true) => {
    if (busyRef.current) return;
    setRoutesLoading(true);
    void attempt(async () => {
      setSelectedGym(gym);
      setRoutes([]);
      setRoutes(await api.routes(token, { gymId: gym.id }));
      if (syncHistory) navigation.push(WEB_PATHS.gym(gym.id));
    }).finally(() => setRoutesLoading(false));
  };

  const openRoute = (routeId: string, origin: Screen = screen, syncHistory = true) => {
    if (busyRef.current) return;
    setRouteOrigin(origin);
    setCommentBody('');
    setGrade('');
    setRoutesLoading(true);
    setCommentsLoading(true);
    void attempt(async () => {
      const detail = await api.route(routeId, token);
      setSelectedRoute(detail);
      setGrade(detail.public_grade);
      setComments([]);
      setScreen('route');
      if (syncHistory) navigation.push(WEB_PATHS.route(routeId));
      try {
        setComments(await api.comments(routeId));
      } catch (error) {
        if (error instanceof ApiError && error.status === 401 && token) throw error;
        notify('error', 'Could not load comments. Try again.');
      }
    }).finally(() => {
      setRoutesLoading(false);
      setCommentsLoading(false);
    });
  };
  const chooseRoute = (route: Route) => openRoute(route.id, screen);

  const chooseProfile = (username: string, origin: Screen = screen, syncHistory = true) => {
    if (busyRef.current) return;
    setProfileOrigin(origin);
    setRoutesLoading(true);
    void attempt(async () => {
      const profile = await api.profile(username, token);
      setSelectedProfile(profile);
      setRoutes(await api.routes(token, { authorId: profile.id }));
      setScreen('profile');
      if (syncHistory) navigation.push(WEB_PATHS.profile(username));
    }).finally(() => setRoutesLoading(false));
  };

  const restoreList = (origin: Screen) => {
    if (origin === 'feed') {
      void loadFeed(followingFeed);
      return;
    }
    if (origin === 'explore' && selectedGym) {
      setRoutesLoading(true);
      void attempt(async () => {
        setRoutes(await api.routes(token, { gymId: selectedGym.id }));
      }).finally(() => setRoutesLoading(false));
    }
  };
  const pathForScreen = (origin: Screen) => {
    if (origin === 'feed') return WEB_PATHS.feed(followingFeed);
    if (origin === 'route' && selectedRoute) return WEB_PATHS.route(selectedRoute.id);
    if (origin === 'profile' && selectedProfile) return WEB_PATHS.profile(selectedProfile.username);
    if (origin === 'account') return user ? WEB_PATHS.account : WEB_PATHS.login;
    if (origin === 'admin') return WEB_PATHS.admin;
    return selectedGym ? WEB_PATHS.gym(selectedGym.id) : WEB_PATHS.gyms;
  };
  const backFromProfile = () => {
    if (navigation.back(pathForScreen(profileOrigin))) return;
    setScreen(profileOrigin);
    restoreList(profileOrigin);
  };
  const backFromRoute = () => {
    if (navigation.back(pathForScreen(routeOrigin))) return;
    setScreen(routeOrigin);
    restoreList(routeOrigin);
  };

  const openBrowserPath = (path: string, label: string, replace = false) => {
    if (!apiBaseUrl) {
      notify('error', 'The app server is not configured.');
      return;
    }
    const opened = navigation.openExternal(`${apiBaseUrl}${path}`, replace, (success) => {
      if (!success) notify('error', `Could not open the ${label}. Try again.`);
    });
    if (!opened) notify('error', `Could not open the ${label} on this device.`);
  };

  const login = () => {
    authGeneration.current += 1;
    void attempt(async () => {
      const result = await api.login(email, password);
      const returnsToBrowserTool =
        postLoginPath === WEB_PATHS.gymMap || postLoginPath === WEB_PATHS.newRoute;
      const nextRoutes =
        returnsToBrowserTool || postLoginPath === WEB_PATHS.admin
          ? []
          : await api.routes(result.token);
      sessionStore.save(result.token);
      setToken(result.token);
      setUser(result.user);
      setDisplayName(result.user.display_name);
      setSelectedGym(null);
      setSelectedRoute(null);
      setSelectedProfile(null);
      setFollowingFeed(false);
      setRoutes(nextRoutes);
      const nextPath = postLoginPath;
      setPostLoginPath(undefined);
      if (nextPath === WEB_PATHS.gymMap || nextPath === WEB_PATHS.newRoute) {
        openBrowserPath(nextPath, nextPath === WEB_PATHS.gymMap ? 'gym map' : 'route editor', true);
        return;
      }
      if (nextPath === WEB_PATHS.admin) {
        if (result.user.role !== 'admin') {
          setScreen('account');
          navigation.replace(WEB_PATHS.account);
          notify('error', 'Administrator access is required.');
          return;
        }
        setScreen('admin');
        navigation.replace(WEB_PATHS.admin);
        setAdminLoading(true);
        try {
          await fetchAdmin(result.token);
        } finally {
          setAdminLoading(false);
        }
        return;
      }
      setScreen('feed');
      navigation.replace(WEB_PATHS.feed());
    }).finally(() => setSessionReady(true));
  };

  const signup = () =>
    void attempt(async () => {
      await api.signup({
        email,
        username,
        display_name: displayName || username,
        password,
      });
      setAuthMode('login');
      navigation.replace(WEB_PATHS.login);
      notify(
        'success',
        'Check your email for a verification link. Open it in your browser, then return here and sign in.'
      );
    });

  const forgot = () =>
    void attempt(async () => {
      await api.forgot(email);
      setAuthMode('login');
      navigation.replace(WEB_PATHS.login);
      notify(
        'success',
        'Check your email for a password-reset link. Complete it in your browser, then return here and sign in.'
      );
    });

  const submitAuth = authMode === 'signup' ? signup : authMode === 'forgot' ? forgot : login;

  const logout = () => {
    authGeneration.current += 1;
    void attempt(async () => {
      try {
        await api.logout(token!);
      } finally {
        sessionStore.clear();
        setToken(null);
        setUser(null);
        setSelectedGym(null);
        setSelectedRoute(null);
        setSelectedProfile(null);
        setFollowingFeed(false);
        setAuthMode('login');
        setScreen('account');
        navigation.replace(WEB_PATHS.login);
      }
    });
  };

  const submitGrade = () => {
    if (!token || !selectedRoute) return;
    void attempt(async () => {
      if (!grade.trim()) {
        notify('error', 'Choose a community grade before submitting.');
        return;
      }
      const result = await api.grade(token, selectedRoute.id, grade.trim());
      setSelectedRoute({ ...selectedRoute, public_grade: result.public_grade });
    });
  };

  const postComment = () => {
    if (!token || !selectedRoute) return;
    void attempt(async () => {
      await api.comment(token, selectedRoute.id, commentBody);
      setCommentBody('');
      setComments(await api.comments(selectedRoute.id));
    });
  };

  const openTool = (tool: 'map' | 'editor') => {
    openBrowserPath(
      tool === 'map' ? WEB_PATHS.gymMap : WEB_PATHS.newRoute,
      tool === 'map' ? 'gym map' : 'route editor'
    );
  };

  const inspectReport = (report: Report) => {
    if (report.route_id) {
      openRoute(report.route_id);
    } else if (report.target_type === 'user' && report.target_label) {
      chooseProfile(report.target_label);
    }
  };

  const showExplore = () => {
    if (busyRef.current) return;
    setScreen('explore');
    setSelectedGym(null);
    setSelectedRoute(null);
    setSelectedProfile(null);
    setRoutes([]);
    navigation.push(WEB_PATHS.gyms);
  };

  const fetchAdmin = async (sessionToken: string) => {
    const [nextReports, nextGyms, nextUsers] = await Promise.all([
      api.adminReports(sessionToken),
      api.adminGyms(sessionToken),
      api.adminUsers(sessionToken),
    ]);
    setReports(nextReports);
    setPendingGyms(nextGyms);
    setAdminUsers(nextUsers);
  };

  const loadAdmin = (sessionToken = token) => {
    if (busyRef.current || !sessionToken) return;
    setAdminLoading(true);
    void attempt(() => fetchAdmin(sessionToken)).finally(() => setAdminLoading(false));
  };

  useEffect(() => {
    if (!sessionReady || initialRouteHandled.current) return;
    if (initialRoute.name === 'gym' && gymsLoading) return;
    initialRouteHandled.current = true;
    if (initialRoute.name === 'gym') {
      const gym = gyms.find((item) => item.id === initialRoute.gymId);
      if (gym) chooseGym(gym, false);
      else {
        notify('error', 'That gym could not be found.');
        navigation.replace(WEB_PATHS.gyms);
      }
      return;
    }
    if (initialRoute.name === 'route') {
      openRoute(initialRoute.routeId, 'explore', false);
      return;
    }
    if (initialRoute.name === 'profile') {
      chooseProfile(initialRoute.username, 'explore', false);
      return;
    }
    if (initialRoute.name === 'feed') {
      setScreen('feed');
      void loadFeed(initialRoute.following);
      return;
    }
    if (initialRoute.name === 'admin') {
      if (user?.role === 'admin') {
        setScreen('admin');
        loadAdmin();
      } else if (user) {
        setScreen('account');
        navigation.replace(WEB_PATHS.account);
        notify('error', 'Administrator access is required.');
      } else {
        setPostLoginPath(WEB_PATHS.admin);
        setAuthMode('login');
        setScreen('account');
        navigation.replace(loginPath(WEB_PATHS.admin));
      }
      return;
    }
    if (initialRoute.name === 'account' && !user) {
      setAuthMode('login');
      navigation.replace(WEB_PATHS.login);
      return;
    }
    if (
      user &&
      (initialRoute.name === 'login' ||
        initialRoute.name === 'signup' ||
        initialRoute.name === 'forgot-password')
    ) {
      setScreen('account');
      navigation.replace(WEB_PATHS.account);
    }
  }, [sessionReady, gymsLoading]);

  const accountName = user?.username ?? GUEST_NAME;
  const accountInitial = [...(user?.display_name || accountName)][0].toUpperCase();
  const nav = (
    <view className="nav">
      <view className="nav__primary">
        <NavItem
          active={screen === 'explore'}
          accessibilityLabel="Explore gyms"
          colorScheme={colorScheme}
          icon="map"
          label="Gyms"
          onTap={showExplore}
        />
        <NavItem
          active={screen === 'feed'}
          accessibilityLabel="Community feed"
          colorScheme={colorScheme}
          icon="feed"
          label="Feed"
          onTap={() => {
            if (busyRef.current) return;
            setSelectedGym(null);
            setSelectedRoute(null);
            setSelectedProfile(null);
            setScreen('feed');
            navigation.push(WEB_PATHS.feed());
            void loadFeed(false);
          }}
        />
        {user?.role === 'admin' && (
          <NavItem
            active={screen === 'admin'}
            accessibilityLabel="Admin moderation"
            colorScheme={colorScheme}
            icon="admin"
            label="Admin"
            onTap={() => {
              if (busyRef.current) return;
              setScreen('admin');
              navigation.push(WEB_PATHS.admin);
              loadAdmin();
            }}
          />
        )}
      </view>
      <Pressable
        className="nav__account"
        label={user ? 'Your profile' : 'Guest account'}
        onTap={() => {
          if (busyRef.current) return;
          setPostLoginPath(undefined);
          setScreen('account');
          navigation.push(user ? WEB_PATHS.account : WEB_PATHS.login);
        }}
      >
        <text className="nav__avatar">{accountInitial}</text>
        <text
          className={
            screen === 'account'
              ? 'nav__account-label nav__account-label--active'
              : 'nav__account-label'
          }
        >
          {accountName}
        </text>
      </Pressable>
    </view>
  );

  let content;
  if (screen === 'profile' && selectedProfile) {
    content = (
      <view className="content">
        <Action quiet onTap={backFromProfile}>
          Back
        </Action>
        <text className="eyebrow">Climber profile</text>
        <text className="heading">{selectedProfile.display_name}</text>
        <text className="lede">
          @{selectedProfile.username} · {selectedProfile.followers} followers ·{' '}
          {selectedProfile.following} following
        </text>
        {user?.id !== selectedProfile.id && (
          <Action
            quiet={selectedProfile.followed}
            onTap={() => {
              if (!token) {
                return requireLogin('Sign in to follow climbers.');
              }
              void attempt(async () => {
                const result = await api.follow(
                  token,
                  selectedProfile.id,
                  !selectedProfile.followed
                );
                setSelectedProfile({
                  ...selectedProfile,
                  followed: result.followed,
                  followers: selectedProfile.followers + (result.followed ? 1 : -1),
                });
              });
            }}
          >
            {selectedProfile.followed ? 'Following' : 'Follow'}
          </Action>
        )}
        <text className="section-title">Routes</text>
        <RouteList routes={routes} chooseRoute={chooseRoute} loading={routesLoading} />
      </view>
    );
  } else if (screen === 'route' && selectedRoute) {
    content = (
      <view className="content">
        <Action quiet onTap={backFromRoute}>
          Back
        </Action>
        <text className="eyebrow">{selectedRoute.gym.name}</text>
        <text className="topo-number">ROUTE {selectedRoute.id.slice(0, 4).toUpperCase()}</text>
        <text className="heading">{selectedRoute.name}</text>
        <view className="route-meta">
          <text className="grade">{selectedRoute.public_grade}</text>
          <Pressable
            label={`Open ${selectedRoute.author.display_name}'s profile`}
            onTap={() => chooseProfile(selectedRoute.author.username)}
          >
            <text className="muted">by {selectedRoute.author.display_name}</text>
          </Pressable>
        </view>
        <image
          className="route-image"
          src={api.imageUrl(selectedRoute.image_url)}
          mode="aspectFit"
          accessibility-element
          accessibility-label={`${selectedRoute.name} route topo`}
        />
        <view className="stat-row">
          <Action
            quiet={selectedRoute.voted}
            onTap={() => {
              if (!token) {
                return requireLogin('Sign in to vote on routes.');
              }
              void attempt(async () => {
                const vote = await api.vote(token, selectedRoute.id, !selectedRoute.voted);
                setSelectedRoute({ ...selectedRoute, ...vote });
              });
            }}
          >
            {selectedRoute.voted
              ? `Voted · ${selectedRoute.votes}`
              : `Vote · ${selectedRoute.votes}`}
          </Action>
          <Action
            quiet
            onTap={() =>
              void shareRoute(selectedRoute.id, selectedRoute.name)
                .then((result) => {
                  if (result === 'cancelled') return;
                  if (result === 'unavailable')
                    throw new Error('Sharing is not available on this device.');
                  notify(
                    'success',
                    result === 'copied'
                      ? 'Route link copied.'
                      : result === 'opened'
                        ? 'Share sheet opened.'
                        : 'Route shared.'
                  );
                })
                .catch((error) =>
                  notify('error', error instanceof Error ? error.message : 'Sharing failed.')
                )
            }
          >
            Share route
          </Action>
        </view>
        {token && (
          <>
            <text className="section-title">Community grade</text>
            <view className="inline-form">
              <input
                className="field__input field__input--small"
                accessibility-element
                accessibility-label="Community grade"
                {...({ value: grade } as object)}
                placeholder="Choose a grade"
                bindinput={(event) => setGrade(event.detail.value)}
                confirm-type="done"
                bindconfirm={submitGrade}
              />
              <Action onTap={submitGrade}>Submit</Action>
            </view>
            <text className="section-title">Add one comment</text>
            <Field
              label="Add a useful note"
              value={commentBody}
              onInput={setCommentBody}
              onConfirm={postComment}
            />
            <Action onTap={postComment}>Post comment</Action>
          </>
        )}
        <text className="section-title">Comments</text>
        {commentsLoading ? (
          <text className="muted">Loading comments…</text>
        ) : comments.length ? (
          comments.map((comment) => (
            <view className="card" key={comment.id}>
              <text className="card__title">{comment.author.display_name}</text>
              <text className="card__body">{comment.body}</text>
            </view>
          ))
        ) : (
          <text className="muted">No comments yet.</text>
        )}
        {token && (
          <Pressable
            className="danger-link"
            label="Report this route"
            onTap={() =>
              void attempt(async () => {
                await api.report(token, selectedRoute.id, 'Community safety review');
                notify('success', 'Report sent to the moderators.');
              })
            }
          >
            <text>Report this route</text>
          </Pressable>
        )}
      </view>
    );
  } else if (screen === 'account') {
    content = user ? (
      <view className="content">
        <text className="eyebrow">Your account</text>
        <text className="heading">{user.username}</text>
        <text className="lede">{user.email}</text>
        <Field label="Display name" value={displayName} onInput={setDisplayName} />
        <Action
          onTap={() =>
            void attempt(async () => {
              const updated = await api.updateProfile(token!, displayName);
              setUser(updated);
              notify('success', 'Profile saved.');
            })
          }
        >
          Save profile
        </Action>
        <Action quiet onTap={logout}>
          Sign out
        </Action>
      </view>
    ) : (
      <view className="content content--auth">
        <text className="eyebrow">RouteMaker account</text>
        <text className="heading">
          {authMode === 'signup'
            ? 'Join the community.'
            : authMode === 'forgot'
              ? 'Reset your password.'
              : 'Welcome back.'}
        </text>
        {authMode === 'signup' && (
          <>
            <Field label="Username" value={username} onInput={setUsername} />
            <Field label="Display name" value={displayName} onInput={setDisplayName} />
          </>
        )}
        <Field
          label="Email"
          type="email"
          value={email}
          onInput={setEmail}
          onConfirm={authMode === 'forgot' ? forgot : undefined}
        />
        {authMode !== 'forgot' && (
          <Field
            label="Password"
            type="password"
            value={password}
            onInput={setPassword}
            onConfirm={submitAuth}
          />
        )}
        <Action onTap={submitAuth}>
          {authMode === 'signup'
            ? 'Create account'
            : authMode === 'forgot'
              ? 'Send reset link'
              : 'Sign in'}
        </Action>
        <view className="auth-links">
          {authMode === 'forgot' ? (
            <Pressable label="Back to sign in" onTap={() => changeAuthMode('login')}>
              <text>Back to sign in</text>
            </Pressable>
          ) : (
            <>
              <Pressable
                label={authMode === 'signup' ? 'Already registered?' : 'Create an account'}
                onTap={() => changeAuthMode(authMode === 'signup' ? 'login' : 'signup')}
              >
                <text>{authMode === 'signup' ? 'Already registered?' : 'Create an account'}</text>
              </Pressable>
              <Pressable label="Forgot password?" onTap={() => changeAuthMode('forgot')}>
                <text>Forgot password?</text>
              </Pressable>
            </>
          )}
        </view>
      </view>
    );
  } else if (screen === 'admin' && user?.role === 'admin') {
    content = (
      <view className="content">
        {adminLoading ? (
          <text className="muted loading">Loading moderation…</text>
        ) : (
          <>
            <text className="eyebrow">Moderation</text>
            <text className="heading">Keep the feed useful.</text>
            <text className="section-title">Open reports</text>
            {reports.length ? (
              reports.map((report) => (
                <view className="card" key={report.id}>
                  <text className="card__title">{report.target_type}</text>
                  <text className="card__body">
                    {report.target_label ?? report.target_id} · {report.reason}
                  </text>
                  <view className="stat-row">
                    {(report.route_id ||
                      (report.target_type === 'user' && report.target_label)) && (
                      <Action quiet onTap={() => inspectReport(report)}>
                        Inspect
                      </Action>
                    )}
                    <Action
                      onTap={() =>
                        void attempt(async () => {
                          await api.moderateReport(token!, report.id, 'hide');
                          setReports(reports.filter((item) => item.id !== report.id));
                        })
                      }
                    >
                      Hide
                    </Action>
                    <Action
                      quiet
                      onTap={() =>
                        void attempt(async () => {
                          await api.moderateReport(token!, report.id, 'dismiss');
                          setReports(reports.filter((item) => item.id !== report.id));
                        })
                      }
                    >
                      Dismiss
                    </Action>
                  </view>
                </view>
              ))
            ) : (
              <text className="muted">No open reports.</text>
            )}
            <text className="section-title">Pending gyms</text>
            {pendingGyms.length ? (
              pendingGyms.map((gym) => (
                <view className="card" key={gym.id}>
                  <text className="card__title">{gym.name}</text>
                  <text className="card__body">{gym.address}</text>
                  <view className="stat-row">
                    <Action
                      onTap={() =>
                        void attempt(async () => {
                          await api.moderateGym(token!, gym.id, 'approve');
                          setPendingGyms(pendingGyms.filter((item) => item.id !== gym.id));
                        })
                      }
                    >
                      Approve
                    </Action>
                    <Action
                      quiet
                      onTap={() =>
                        void attempt(async () => {
                          await api.moderateGym(token!, gym.id, 'reject');
                          setPendingGyms(pendingGyms.filter((item) => item.id !== gym.id));
                        })
                      }
                    >
                      Reject
                    </Action>
                  </view>
                </view>
              ))
            ) : (
              <text className="muted">No gyms awaiting approval.</text>
            )}
            <text className="section-title">Accounts</text>
            {adminUsers.length > 1 ? (
              adminUsers
                .filter((account) => account.id !== user.id)
                .map((account) => (
                  <view className="card" key={account.id}>
                    <text className="card__title">{account.display_name}</text>
                    <text className="card__body">
                      @{account.username} · {account.disabled ? 'disabled' : 'active'}
                    </text>
                    <Action
                      quiet={!account.disabled}
                      onTap={() =>
                        void attempt(async () => {
                          await api.setUserDisabled(token!, account.id, !account.disabled);
                          setAdminUsers(
                            adminUsers.map((item) =>
                              item.id === account.id ? { ...item, disabled: !item.disabled } : item
                            )
                          );
                        })
                      }
                    >
                      {account.disabled ? 'Enable account' : 'Disable account'}
                    </Action>
                  </view>
                ))
            ) : (
              <text className="muted">No other accounts.</text>
            )}
          </>
        )}
      </view>
    );
  } else if (screen === 'feed') {
    content = (
      <view className="content">
        <text className="eyebrow">Community beta</text>
        <text className="heading">Fresh routes.</text>
        <view className="stat-row">
          <Action
            quiet={followingFeed}
            onTap={() => {
              navigation.push(WEB_PATHS.feed());
              void loadFeed(false);
            }}
          >
            Everyone
          </Action>
          <Action
            quiet={!followingFeed}
            onTap={() => {
              if (!token) {
                return requireLogin('Sign in to see routes from climbers you follow.');
              }
              navigation.push(WEB_PATHS.feed(true));
              void loadFeed(true);
            }}
          >
            Following
          </Action>
        </view>
        <RouteList routes={routes} chooseRoute={chooseRoute} loading={routesLoading} />
      </view>
    );
  } else {
    content = (
      <view className="content">
        <text className="eyebrow">
          {selectedGym ? selectedGym.country_code : 'Explore local beta'}
        </text>
        <text className="heading">{selectedGym?.name ?? 'Find your next route.'}</text>
        <text className="lede">
          {selectedGym?.address ?? 'Browse approved gyms or explore them by location on the map.'}
        </text>
        {selectedGym ? (
          <view className="stat-row">
            <Action
              quiet
              onTap={() => {
                setSelectedGym(null);
                setRoutes([]);
                navigation.push(WEB_PATHS.gyms);
                void loadGyms();
              }}
            >
              All gyms
            </Action>
            <Action onTap={() => openTool('editor')}>Add a route</Action>
          </view>
        ) : (
          <view className="tool-links">
            <ToolLink
              colorScheme={colorScheme}
              icon="map"
              title="Gym map"
              detail="Browse gyms by location"
              onTap={() => openTool('map')}
            />
            <ToolLink
              colorScheme={colorScheme}
              icon="plus"
              title="Add a route"
              detail="Mark holds on a wall photo"
              onTap={() => openTool('editor')}
            />
          </view>
        )}
        {selectedGym ? (
          <RouteList routes={routes} chooseRoute={chooseRoute} loading={routesLoading} />
        ) : gymsLoading ? (
          <text className="muted loading">Loading gyms…</text>
        ) : gymsFailed ? (
          <Action onTap={() => void loadGyms()}>Retry gyms</Action>
        ) : gyms.length ? (
          gyms.map((gym) => (
            <Pressable
              className="card card--tap"
              key={gym.id}
              onTap={() => chooseGym(gym)}
              label={`Open ${gym.name}`}
            >
              <text className="card__title">{gym.name}</text>
              <text className="card__body">{gym.address}</text>
            </Pressable>
          ))
        ) : (
          <text className="empty">No gyms yet.</text>
        )}
      </view>
    );
  }

  return (
    <scroll-view
      className={`${initialWideLayout ? 'page page--desktop' : 'page'}${themeClass}`}
      scroll-orientation="vertical"
    >
      <view className="shell">
        <view className="topbar">
          <view className="brand">
            <svg
              key={`brand-${colorScheme}`}
              className="brand__mark"
              content={logoMarkSvg(BRAND_PALETTE[colorScheme])}
            />
            <text className="brand__name">{APP_NAME}</text>
          </view>
          <text className="status">{busy ? 'Working…' : ''}</text>
          <AppearanceToggle value={colorScheme} onToggle={toggleTheme} />
          {nav}
        </view>
        {message && (
          <text
            className={noticeKind === 'success' ? 'notice notice--success' : 'notice'}
            accessibility-element
            accessibility-traits="updating"
            accessibility-label={message}
          >
            {message}
          </text>
        )}
        {content}
      </view>
    </scroll-view>
  );
}
