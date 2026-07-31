import type { ReactNode } from 'react';

import type { Route } from '../../api.js';
import type { ColorScheme } from '../../appearance.js';
import { iconColor, iconSvg, type IconName } from '../../icons.js';

// Firefox's Lynx Web fallback snapshots orientation when an element connects.
// Inline layout avoids a cold-load race with the asynchronously inserted stylesheet.
export const COLUMN_STYLE = 'display: linear; linear-direction: column;';
export const ROW_STYLE = 'display: linear; linear-direction: row;';
export const GROWING_ROW_STYLE = `${ROW_STYLE} linear-weight: 1;`;

export function Icon({
  name,
  color,
  className,
}: {
  name: IconName;
  color: string;
  className?: string;
}) {
  return (
    <svg
      key={`${name}-${color}`}
      className={className ? `icon ${className}` : 'icon'}
      content={iconSvg(name, color)}
    />
  );
}

export function Pressable({
  children,
  label,
  onTap,
  className,
  selected,
  style,
}: {
  children: ReactNode;
  label: string;
  onTap: () => void;
  className?: string;
  selected?: boolean;
  style?: string;
}) {
  const selectedProps =
    selected === undefined
      ? {}
      : {
          'aria-pressed': selected,
          'accessibility-value': selected ? 'Selected' : 'Not selected',
        };
  return (
    <view
      className={className ? `pressable ${className}` : 'pressable'}
      style={style}
      {...({ 'aria-label': label, role: 'button', tabindex: '0', ...selectedProps } as object)}
      bindtap={onTap}
      accessibility-element
      accessibility-traits={selected ? 'selected' : 'button'}
      accessibility-role-description="button"
      accessibility-label={label}
      focusable
    >
      {children}
    </view>
  );
}

export function Field({
  label,
  value,
  onInput,
  onConfirm,
  type = 'text',
}: {
  label: string;
  value: string;
  onInput: (value: string) => void;
  onConfirm?: () => void;
  type?: 'text' | 'email' | 'password';
}) {
  return (
    <view className="field">
      <text className="field__label" accessibility-element accessibility-label={label}>
        {label}
      </text>
      <input
        className="field__input"
        accessibility-element
        accessibility-label={label}
        type={type}
        confirm-type={onConfirm ? 'done' : undefined}
        value={value}
        placeholder={label}
        bindinput={(event) => onInput(event.detail.value)}
        bindconfirm={onConfirm}
      />
    </view>
  );
}

export function Action({
  children,
  onTap,
  quiet = false,
}: {
  children: string;
  onTap: () => void;
  quiet?: boolean;
}) {
  return (
    <Pressable className={quiet ? 'action action--quiet' : 'action'} label={children} onTap={onTap}>
      <text className={quiet ? 'action__text action__text--quiet' : 'action__text'}>
        {children}
      </text>
    </Pressable>
  );
}

export function AppearanceToggle({
  value,
  onToggle,
}: {
  value: ColorScheme;
  onToggle: () => void;
}) {
  const nextTheme = value === 'light' ? 'dark' : 'light';
  return (
    <Pressable
      className={
        value === 'dark' ? 'appearance-toggle appearance-toggle--dark' : 'appearance-toggle'
      }
      label={`Switch to ${nextTheme} theme`}
      onTap={onToggle}
      style={ROW_STYLE}
    >
      <Icon name="sun" color={iconColor(value, 'sun')} className="appearance-toggle__icon" />
      <view className="appearance-toggle__track">
        <view className="appearance-toggle__thumb" />
      </view>
      <Icon name="moon" color={iconColor(value, 'moon')} className="appearance-toggle__icon" />
    </Pressable>
  );
}

export function NavItem({
  active,
  accessibilityLabel,
  colorScheme,
  icon,
  label,
  style,
  onTap,
}: {
  active: boolean;
  accessibilityLabel?: string;
  colorScheme: ColorScheme;
  icon: IconName;
  label: string;
  style: string;
  onTap: () => void;
}) {
  return (
    <Pressable
      className="nav__link"
      label={accessibilityLabel ?? label}
      onTap={onTap}
      selected={active}
      style={style}
    >
      <Icon
        name={icon}
        color={iconColor(colorScheme, active ? 'active' : 'base')}
        className="nav__icon"
      />
      <text className={active ? 'nav__item nav__item--active' : 'nav__item'}>{label}</text>
    </Pressable>
  );
}

export function ToolLink({
  colorScheme,
  icon,
  title,
  detail,
  style = ROW_STYLE,
  onTap,
}: {
  colorScheme: ColorScheme;
  icon: IconName;
  title: string;
  detail: string;
  style?: string;
  onTap: () => void;
}) {
  return (
    <Pressable className="tool-link" label={`${title}: ${detail}`} onTap={onTap} style={style}>
      <view className="tool-link__symbol">
        <Icon name={icon} color={iconColor(colorScheme, 'active')} />
      </view>
      <view className="tool-link__copy">
        <text className="tool-link__title">{title}</text>
        <text className="tool-link__detail">{detail}</text>
      </view>
      <Icon
        name="arrowRight"
        color={iconColor(colorScheme, 'active')}
        className="tool-link__arrow"
      />
    </Pressable>
  );
}

export function RouteList({
  routes,
  chooseRoute,
  loading = false,
}: {
  routes: Route[];
  chooseRoute: (route: Route) => void;
  loading?: boolean;
}) {
  if (loading) return <text className="muted loading">Loading routes…</text>;
  if (!routes.length) return <text className="empty">No routes here yet.</text>;
  return (
    <view className="route-list">
      {routes.map((route, index) => (
        <Pressable
          className="route-card"
          key={route.id}
          onTap={() => chooseRoute(route)}
          label={`Open route ${index + 1}, ${route.name}`}
          style={ROW_STYLE}
        >
          <text className="route-card__index">{String(index + 1).padStart(2, '0')}</text>
          <view className="route-card__copy">
            <text className="card__title">{route.name}</text>
            <text className="card__body">
              {route.gym.name} · {route.author.display_name}
            </text>
          </view>
          <view className="route-card__right">
            <text className="grade">{route.public_grade}</text>
            <text className="route-card__stats">
              {route.votes} votes · {route.comment_count} notes
            </text>
          </view>
        </Pressable>
      ))}
    </view>
  );
}
