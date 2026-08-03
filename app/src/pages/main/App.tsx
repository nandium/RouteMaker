import { useEffect, useLynxGlobalEventListener, useRef, useState } from '@lynx-js/react';
import type { GlobalProps } from '@lynx-js/types';

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
import {
  APP_NAME,
  CLIMBING_GRADES,
  LAYOUT_CHANGE_EVENT,
  MAX_COMMENT_LENGTH,
  SYSTEM_THEME_EVENT,
} from '../../client-contract.js';
import { iconColor } from '../../icons.js';
import { openNativeMap } from '../../native-map.js';
import { navigation } from '../../navigation.js';
import { sessionStore } from '../../session.js';
import { shareRoute } from '../../share.js';
import { loginPath, parseWebRoute, WEB_PATHS, type AppRoute } from '../../web-routes.js';
import {
  Action,
  AppearanceToggle,
  Field,
  Icon,
  NavItem,
  Pressable,
  RouteList,
  Stack,
  ToolLink,
} from './components.js';
import { RouteDetail } from './RouteDetail.js';
import './App.css';

type Screen = 'explore' | 'feed' | 'route' | 'profile' | 'account' | 'admin';
type AuthMode = 'login' | 'signup' | 'forgot';
type NoticeKind = 'success' | 'error';

const GUEST_NAME = 'Guest';
const DEFAULT_ROUTE: AppRoute = { name: 'gyms' };
const FIRST_CLIMBING_GRADE = CLIMBING_GRADES[0];
const LAST_CLIMBING_GRADE = CLIMBING_GRADES.at(-1)!;
const CLIMBING_GRADE_RANGE = `${FIRST_CLIMBING_GRADE}–${LAST_CLIMBING_GRADE}`;

const globalProps: GlobalProps = lynx.__globalProps;
const initialRoute = globalProps?.initialRoute ?? DEFAULT_ROUTE;
const initialWideLayout = Boolean(globalProps?.wideLayout);
const configuredTheme = globalProps?.themePreference;
const initialThemePreference = isThemePreference(configuredTheme) ? configuredTheme : null;
const initialSystemTheme = globalProps?.systemTheme === 'dark' ? 'dark' : 'light';
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
  const mapOpening = useRef(false);
  const mapOpenGeneration = useRef(0);
  const [sessionReady, setSessionReady] = useState(false);
  const [themePreference, setThemePreference] = useState<ThemePreference | null>(
    initialThemePreference
  );
  const [systemTheme, setSystemTheme] = useState<ColorScheme>(initialSystemTheme);
  const [wideLayout, setWideLayout] = useState(initialWideLayout);
  const colorScheme = resolveColorScheme(themePreference, systemTheme);
  const themeClass = ` theme-${colorScheme}`;

  const cancelPendingMap = () => {
    mapOpenGeneration.current += 1;
    mapOpening.current = false;
  };
  const changeScreen = (next: Screen) => {
    cancelPendingMap();
    setScreen(next);
  };

  useLynxGlobalEventListener(LAYOUT_CHANGE_EVENT, (value: unknown) => {
    if (typeof value === 'boolean') setWideLayout(value);
  });

  useLynxGlobalEventListener(SYSTEM_THEME_EVENT, (value: unknown) => {
    if (isThemePreference(value)) setSystemTheme(value);
  });

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
    changeScreen('account');
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
    cancelPendingMap();
    setRoutesLoading(true);
    void attempt(async () => {
      setSelectedGym(gym);
      setRoutes([]);
      setRoutes(await api.routes(token, { gymId: gym.id }));
      if (syncHistory) navigation.push(WEB_PATHS.gym(gym.id));
    }).finally(() => setRoutesLoading(false));
  };

  const loadRouteDetail = async (
    routeId: string,
    sessionToken: string | null,
    historyMode: 'push' | 'replace' | null
  ) => {
    setCommentBody('');
    setGrade('');
    setCommentsLoading(true);
    try {
      const detail = await api.route(routeId, sessionToken);
      setSelectedRoute(detail);
      setGrade(detail.public_grade);
      setComments([]);
      changeScreen('route');
      if (historyMode) navigation[historyMode](WEB_PATHS.route(routeId));
      try {
        setComments(await api.comments(routeId));
      } catch (error) {
        if (error instanceof ApiError && error.status === 401 && sessionToken) throw error;
        notify('error', 'Could not load comments. Try again.');
      }
    } finally {
      setCommentsLoading(false);
    }
  };

  const openRoute = (routeId: string, origin: Screen = screen, syncHistory = true) => {
    if (busyRef.current) return;
    setRouteOrigin(origin);
    setRoutesLoading(true);
    void attempt(() => loadRouteDetail(routeId, token, syncHistory ? 'push' : null)).finally(() =>
      setRoutesLoading(false)
    );
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
      changeScreen('profile');
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
    changeScreen(profileOrigin);
    restoreList(profileOrigin);
  };
  const backFromRoute = () => {
    if (navigation.back(pathForScreen(routeOrigin))) return;
    changeScreen(routeOrigin);
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

  const openTool = (tool: 'map' | 'editor', replace = false) => {
    if (tool === 'map') {
      if (mapOpening.current) return;
      mapOpening.current = true;
      const generation = ++mapOpenGeneration.current;
      void openNativeMap(
        gyms,
        colorScheme,
        api.location,
        () => generation === mapOpenGeneration.current,
        (gymId) => {
          if (generation !== mapOpenGeneration.current) return;
          mapOpening.current = false;
          const gym = gyms.find((candidate) => candidate.id === gymId);
          if (gym) chooseGym(gym);
        }
      )
        .then((result) => {
          if (generation !== mapOpenGeneration.current) return;
          mapOpening.current = false;
          if (result === 'unavailable') {
            openBrowserPath(WEB_PATHS.gymMap, 'gym map', replace);
          }
        })
        .catch(() => {
          if (generation !== mapOpenGeneration.current) return;
          mapOpening.current = false;
          notify('error', 'Could not open the gym map. Try again.');
        });
      return;
    }
    cancelPendingMap();
    openBrowserPath(WEB_PATHS.newRoute, 'route editor', replace);
  };

  const login = () => {
    authGeneration.current += 1;
    void attempt(async () => {
      const result = await api.login(email, password);
      const returnsToBrowserTool =
        postLoginPath === WEB_PATHS.gymMap || postLoginPath === WEB_PATHS.newRoute;
      const returnRoute = postLoginPath ? parseWebRoute(postLoginPath) : null;
      const nextRoutes =
        returnsToBrowserTool || postLoginPath === WEB_PATHS.admin || returnRoute?.name === 'route'
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
        openTool(nextPath === WEB_PATHS.gymMap ? 'map' : 'editor', true);
        return;
      }
      if (nextPath === WEB_PATHS.admin) {
        if (result.user.role !== 'admin') {
          changeScreen('account');
          navigation.replace(WEB_PATHS.account);
          notify('error', 'Administrator access is required.');
          return;
        }
        changeScreen('admin');
        navigation.replace(WEB_PATHS.admin);
        setAdminLoading(true);
        try {
          await fetchAdmin(result.token);
        } finally {
          setAdminLoading(false);
        }
        return;
      }
      if (returnRoute?.name === 'route') {
        await loadRouteDetail(returnRoute.routeId, result.token, 'replace');
        return;
      }
      changeScreen('feed');
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

  const missingAuthField = () => {
    if (authMode === 'signup' && !username.trim()) return 'username';
    if (!email.trim()) return 'email';
    if (authMode !== 'forgot' && !password) return 'password';
    return null;
  };

  const submitAuth = () => {
    const missingField = missingAuthField();
    if (missingField) {
      notify('error', `Enter your ${missingField}.`);
      return;
    }
    if (authMode === 'signup') signup();
    else if (authMode === 'forgot') forgot();
    else login();
  };

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
        changeScreen('account');
        navigation.replace(WEB_PATHS.login);
      }
    });
  };

  const submitGrade = () => {
    if (!token || !selectedRoute) return;
    void attempt(async () => {
      const normalizedGrade = grade.trim().toUpperCase();
      if (!CLIMBING_GRADES.includes(normalizedGrade)) {
        notify('error', `Use a grade from ${FIRST_CLIMBING_GRADE} to ${LAST_CLIMBING_GRADE}.`);
        return;
      }
      const result = await api.grade(token, selectedRoute.id, normalizedGrade);
      setSelectedRoute({ ...selectedRoute, public_grade: result.public_grade });
    });
  };

  const postComment = () => {
    if (!token || !selectedRoute) return;
    void attempt(async () => {
      const comment = commentBody.trim();
      if (!comment) {
        notify('error', 'Write a note before posting.');
        return;
      }
      if (comment.length > MAX_COMMENT_LENGTH) {
        notify('error', `Keep notes at most ${MAX_COMMENT_LENGTH} characters.`);
        return;
      }
      await api.comment(token, selectedRoute.id, comment);
      setCommentBody('');
      setComments(await api.comments(selectedRoute.id));
    });
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
    changeScreen('explore');
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
      changeScreen('feed');
      void loadFeed(initialRoute.following);
      return;
    }
    if (initialRoute.name === 'admin') {
      if (user?.role === 'admin') {
        changeScreen('admin');
        loadAdmin();
      } else if (user) {
        changeScreen('account');
        navigation.replace(WEB_PATHS.account);
        notify('error', 'Administrator access is required.');
      } else {
        setPostLoginPath(WEB_PATHS.admin);
        setAuthMode('login');
        changeScreen('account');
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
      changeScreen('account');
      navigation.replace(WEB_PATHS.account);
    }
  }, [sessionReady, gymsLoading]);

  const accountName = user?.username ?? GUEST_NAME;
  const accountInitial = [...(user?.display_name || accountName)][0].toUpperCase();
  const navItemDirection = wideLayout ? 'row' : 'column';
  const scrollKey =
    screen === 'route'
      ? `route-${selectedRoute?.id}`
      : screen === 'profile'
        ? `profile-${selectedProfile?.username}`
        : screen === 'explore'
          ? `explore-${selectedGym?.id ?? 'gyms'}`
          : screen === 'feed'
            ? `feed-${followingFeed ? 'following' : 'everyone'}`
            : screen;
  const nav = (
    <Stack className="nav" direction="row">
      <Stack className="nav__primary" direction="row">
        <NavItem
          active={screen === 'explore'}
          accessibilityLabel="Explore gyms"
          colorScheme={colorScheme}
          icon="map"
          label="Gyms"
          direction={navItemDirection}
          onTap={showExplore}
        />
        <NavItem
          active={screen === 'feed'}
          accessibilityLabel="Community feed"
          colorScheme={colorScheme}
          icon="feed"
          label="Feed"
          direction={navItemDirection}
          onTap={() => {
            if (busyRef.current) return;
            setSelectedGym(null);
            setSelectedRoute(null);
            setSelectedProfile(null);
            changeScreen('feed');
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
            direction={navItemDirection}
            onTap={() => {
              if (busyRef.current) return;
              changeScreen('admin');
              navigation.push(WEB_PATHS.admin);
              loadAdmin();
            }}
          />
        )}
      </Stack>
      <Pressable
        className="nav__account"
        label={user ? 'Your profile' : 'Guest account'}
        selected={screen === 'account'}
        direction="row"
        onTap={() => {
          if (busyRef.current) return;
          setPostLoginPath(undefined);
          changeScreen('account');
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
    </Stack>
  );

  let content;
  if (screen === 'profile' && selectedProfile) {
    content = (
      <view className="content">
        <Pressable className="back-link" label="Back" onTap={backFromProfile} direction="row">
          <Icon
            name="arrowLeft"
            color={iconColor(colorScheme, 'base')}
            className="back-link__icon"
          />
          <text className="back-link__text">Back</text>
        </Pressable>
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
      <RouteDetail
        view={{
          route: selectedRoute,
          routeImageUrl: api.imageUrl(selectedRoute.image_url),
          comments,
          commentsLoading,
          signedIn: Boolean(token),
          wideLayout,
          colorScheme,
          grade,
          gradeRange: CLIMBING_GRADE_RANGE,
          gradeAccessibilityLabel: `Community grade from ${FIRST_CLIMBING_GRADE} to ${LAST_CLIMBING_GRADE}`,
          commentBody,
          maxCommentLength: MAX_COMMENT_LENGTH,
        }}
        actions={{
          back: backFromRoute,
          openAuthor: () => chooseProfile(selectedRoute.author.username),
          vote: () => {
            if (!token) {
              return requireLogin('Sign in to vote on routes.');
            }
            void attempt(async () => {
              const vote = await api.vote(token, selectedRoute.id, !selectedRoute.voted);
              setSelectedRoute({ ...selectedRoute, ...vote });
            });
          },
          share: () =>
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
              ),
          changeGrade: setGrade,
          submitGrade,
          changeComment: setCommentBody,
          postComment,
          signInToContribute: () =>
            requireLogin('Sign in to contribute.', WEB_PATHS.route(selectedRoute.id)),
          report: () =>
            void attempt(async () => {
              await api.report(token!, selectedRoute.id, 'Community safety review');
              notify('success', 'Report sent to the moderators.');
            }),
        }}
      />
    );
  } else if (screen === 'account') {
    content = user ? (
      <view className="content content--account">
        <text className="eyebrow">Your account</text>
        <text className="heading">{user.username}</text>
        <text className="lede">{user.email}</text>
        <Field label="Display name" value={displayName} onInput={setDisplayName} />
        <Stack className="account-actions" direction="column">
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
        </Stack>
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
          onConfirm={authMode === 'forgot' ? submitAuth : undefined}
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
        <Stack className="auth-links" direction="row">
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
        </Stack>
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
                  <Stack className="stat-row" direction="row">
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
                  </Stack>
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
                  <Stack className="stat-row" direction="row">
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
                  </Stack>
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
        <Stack className="stat-row" direction="row">
          <Action
            quiet={followingFeed}
            selected={!followingFeed}
            onTap={() => {
              navigation.push(WEB_PATHS.feed());
              void loadFeed(false);
            }}
          >
            Everyone
          </Action>
          <Action
            quiet={!followingFeed}
            selected={followingFeed}
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
        </Stack>
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
          <Stack className="stat-row" direction="row">
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
          </Stack>
        ) : (
          <Stack className="tool-links" direction={wideLayout ? 'row' : 'column'}>
            {!gymsLoading && !gymsFailed && (
              <ToolLink
                colorScheme={colorScheme}
                icon="map"
                title="Gym map"
                detail="Browse gyms by location"
                grow={wideLayout}
                onTap={() => openTool('map')}
              />
            )}
            <ToolLink
              colorScheme={colorScheme}
              icon="plus"
              title="Add a route"
              detail="Mark holds on a wall photo"
              grow={wideLayout}
              onTap={() => openTool('editor')}
            />
          </Stack>
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

  const pageClass = `${wideLayout ? 'app-frame page--desktop' : 'app-frame'}${themeClass}`;
  return (
    <view className={pageClass}>
      <scroll-view key={scrollKey} className="page" scroll-orientation="vertical">
        <view className="shell">
          <Stack className="topbar" direction="row">
            <Stack className="brand" direction="row">
              <svg
                key={`brand-${colorScheme}`}
                className="brand__mark"
                content={logoMarkSvg(BRAND_PALETTE[colorScheme])}
              />
              <text className="brand__name">{APP_NAME}</text>
            </Stack>
            <text className="status">{busy ? 'Working…' : ''}</text>
            <AppearanceToggle value={colorScheme} onToggle={toggleTheme} />
            {wideLayout && nav}
          </Stack>
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
      {!wideLayout && nav}
    </view>
  );
}
