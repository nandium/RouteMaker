import type { Comment, Route } from '../../api.js';
import type { ColorScheme } from '../../appearance.js';
import { iconColor } from '../../icons.js';
import { Action, Field, Icon, Pressable, Stack } from './components.js';

export type RouteDetailView = {
  route: Route;
  routeImageUrl: string;
  comments: Comment[];
  commentsLoading: boolean;
  signedIn: boolean;
  wideLayout: boolean;
  colorScheme: ColorScheme;
  grade: string;
  gradeRange: string;
  gradeAccessibilityLabel: string;
  commentBody: string;
  maxCommentLength: number;
};

export type RouteDetailActions = {
  back: () => void;
  openAuthor: () => void;
  vote: () => void;
  share: () => void;
  changeGrade: (value: string) => void;
  submitGrade: () => void;
  changeComment: (value: string) => void;
  postComment: () => void;
  signInToContribute: () => void;
  report: () => void;
};

export function RouteDetail({
  view,
  actions,
}: {
  view: RouteDetailView;
  actions: RouteDetailActions;
}) {
  const {
    route,
    routeImageUrl,
    comments,
    commentsLoading,
    signedIn,
    wideLayout,
    colorScheme,
    grade,
    gradeRange,
    gradeAccessibilityLabel,
    commentBody,
    maxCommentLength,
  } = view;

  return (
    <view className="content content--route">
      <Pressable className="back-link" label="Back" onTap={actions.back} direction="row">
        <Icon name="arrowLeft" color={iconColor(colorScheme, 'base')} className="back-link__icon" />
        <text className="back-link__text">Back</text>
      </Pressable>
      <view className="route-header">
        <Stack className="route-kicker" direction={wideLayout ? 'row' : 'column'}>
          <text className="eyebrow">{route.gym.name}</text>
          <text className="topo-number">ROUTE {route.id.slice(0, 4).toUpperCase()}</text>
        </Stack>
        <text className="heading">{route.name}</text>
        <Stack className="route-meta" direction="row">
          <text className="grade">{route.public_grade || 'Unrated'}</text>
          <Pressable
            className="route-author-link"
            label={`Open ${route.author.display_name}'s profile`}
            onTap={actions.openAuthor}
          >
            <text className="muted">by {route.author.display_name}</text>
          </Pressable>
        </Stack>
      </view>
      <view className="route-media">
        <image
          className="route-image"
          src={routeImageUrl}
          mode="aspectFit"
          accessibility-element
          accessibility-label={`${route.name} route topo`}
        />
        <Stack className="stat-row route-actions" direction="row">
          <Action quiet={route.voted} onTap={actions.vote}>
            {route.voted ? `Voted · ${route.votes}` : `Vote · ${route.votes}`}
          </Action>
          <Action quiet onTap={actions.share}>
            Share route
          </Action>
        </Stack>
      </view>
      <view className="route-community">
        <text className="route-community__title">Community</text>
        {signedIn && (
          <Stack className="route-contribute" direction={wideLayout ? 'row' : 'column'}>
            <view className="route-contribute__block">
              <text className="section-title">Suggested grade</text>
              <Stack className="inline-form" direction="row">
                <input
                  className="field__input field__input--small"
                  accessibility-element
                  accessibility-label={gradeAccessibilityLabel}
                  value={grade}
                  placeholder={gradeRange}
                  bindinput={(event) => actions.changeGrade(event.detail.value)}
                  confirm-type="done"
                  bindconfirm={actions.submitGrade}
                />
                <Action onTap={actions.submitGrade}>Submit</Action>
              </Stack>
            </view>
            <view className="route-contribute__block">
              <text className="section-title">Add a note</text>
              <Field
                label="Note"
                value={commentBody}
                onInput={actions.changeComment}
                onConfirm={actions.postComment}
                maxLength={maxCommentLength}
              />
              <Action onTap={actions.postComment}>Post comment</Action>
            </view>
          </Stack>
        )}
        {!signedIn && (
          <view className="route-community__guest">
            <text className="muted">Sign in to suggest a grade or add a note.</text>
            <Action onTap={actions.signInToContribute}>Sign in to contribute</Action>
          </view>
        )}
        <text className="section-title route-comments__title">Comments</text>
        {commentsLoading ? (
          <text className="muted">Loading comments…</text>
        ) : comments.length ? (
          comments.map((comment) => (
            <view className="card route-comment" key={comment.id}>
              <text className="card__title">{comment.author.display_name}</text>
              <text className="card__body">{comment.body}</text>
            </view>
          ))
        ) : (
          <text className="muted">No comments yet.</text>
        )}
        {signedIn && (
          <Pressable className="danger-link" label="Report this route" onTap={actions.report}>
            <text>Report this route</text>
          </Pressable>
        )}
      </view>
    </view>
  );
}
