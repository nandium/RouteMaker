import { useState } from '@lynx-js/react';

import { api } from '../../../api.js';
import {
  MAX_REPORT_DETAILS_LENGTH,
  REPORT_REASONS,
  type ReportReason,
  type ReportTarget,
} from '../../../client-contract.js';
import { useApp } from '../app-context.js';
import { Button, IconButton } from '../components/Button.js';
import { Field } from '../components/Field.js';
import { FieldFrame } from '../components/FieldFrame.js';
import { Choice, ChoiceGroup, Sheet } from '../components/Sheet.js';
import { REASONS } from '../report-reasons.js';

/**
 * Opens the report sheet for one piece of content; guests cannot report. It is a red text button,
 * or with `icon` a quiet flag, for where there are too many of them to shout.
 */
export function ReportButton({
  target,
  id,
  label,
  icon = false,
}: {
  target: ReportTarget;
  id: string;
  label: string;
  icon?: boolean;
}) {
  const { auth, openSheet } = useApp();
  if (!auth) return null;
  const open = () =>
    openSheet(<ReportSheet token={auth.token} target={target} id={id} title={label} />);
  return icon ? (
    <IconButton icon="flag" tone="ink-3" label={label} onTap={open} />
  ) : (
    <Button kind="quiet-danger" size="md" icon="flag" onTap={open}>
      {label}
    </Button>
  );
}

function ReportSheet({
  token,
  target,
  id,
  title,
}: {
  token: string;
  target: ReportTarget;
  id: string;
  title: string;
}) {
  const { closeSheet, notify, run } = useApp();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [error, setError] = useState('');

  const send = () => {
    'background only';
    if (!reason) return setError('Choose a reason for the report.');
    void run(async () => {
      await api.report(token, {
        target_type: target,
        target_id: id,
        reason,
        details: details.trim() || undefined,
      });
      closeSheet();
      notify('success', 'Report sent to the moderators.');
    });
  };

  return (
    <Sheet title={title}>
      <FieldFrame error={error}>
        <ChoiceGroup label="Reason">
          {REPORT_REASONS.map((option) => (
            <Choice
              key={option}
              label={REASONS[option].label}
              detail={REASONS[option].detail}
              selected={option === reason}
              onTap={() => {
                setReason(option);
                setError('');
              }}
            />
          ))}
        </ChoiceGroup>
      </FieldFrame>
      <Field
        label="Details (optional)"
        value={details}
        onInput={setDetails}
        maxLength={MAX_REPORT_DETAILS_LENGTH}
        showCount
        placeholder="Anything the moderators should know"
      />
      <view className="btn-row">
        <Button kind="secondary" size="lg" onTap={closeSheet}>
          Cancel
        </Button>
        <Button size="lg" onTap={send}>
          Send report
        </Button>
      </view>
    </Sheet>
  );
}
