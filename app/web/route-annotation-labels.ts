import { type Annotation, type HoldUse, selectedAnnotations } from './route-annotations.js';

const HOLD_USE_LABELS: Record<HoldUse, string> = {
  any: 'Any limb',
  hand: 'Hand only',
  foot: 'Foot only',
};

export function holdUseLabel(use: HoldUse) {
  return HOLD_USE_LABELS[use];
}

export function annotationLabel(
  annotation: Annotation,
  annotations: readonly Annotation[],
  showSequence: boolean
) {
  if (!showSequence) return annotation.use === 'foot' ? 'F' : annotation.use === 'hand' ? 'H' : 'A';
  const routeStage = (item: Annotation) => (item.start_tapes ? 0 : item.finish_tapes ? 2 : 1);
  const ordered = selectedAnnotations(annotations)
    .filter((item) => item.use !== 'foot' || item.start_tapes || item.finish_tapes)
    .sort((left, right) => {
      return (
        routeStage(left) - routeStage(right) || (left.order ?? Infinity) - (right.order ?? Infinity)
      );
    });
  if (!ordered.includes(annotation)) return 'F';
  return String(ordered.indexOf(annotation) + 1);
}
