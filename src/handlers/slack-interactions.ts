import { config, getDb } from '../config';
import { UserService } from '../services/user.service';
import { StandupService } from '../services/standup.service';
import { TokenService } from '../services/token.service';
import { StandupGeneratorService } from '../services/standup-generator.service';
import { getSlackService } from '../services/slack.service';
import { formatStandupMessage } from '../utils/slack-formatter';

// Minimal Slack payload types
export interface ViewSubmissionPayload {
  type: 'view_submission';
  user: { id: string };
  view: {
    callback_id: string;
    private_metadata: string;
    state: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      values: Record<string, Record<string, any>>;
    };
  };
}

export interface BlockActionsPayload {
  type: 'block_actions';
  trigger_id: string;
  user: { id: string };
  channel?: { id: string };
  message?: { ts: string };
  actions: Array<{ action_id: string; value?: string }>;
}

export async function handleSettingsSubmission(
  payload: ViewSubmissionPayload,
): Promise<Record<string, unknown>> {
  const values = payload.view.state.values;
  const slackUserId = payload.view.private_metadata;

  // Parse form values
  const timezone = values.timezone_block.timezone_select.selected_option?.value;
  const standupTime = values.time_block.time_picker.selected_time;
  const standupDays = (values.days_block.days_checkboxes.selected_options || [])
    .map((opt: { value: string }) => parseInt(opt.value, 10));
  const standupEnabled =
    (values.enabled_block.enabled_checkbox.selected_options || []).length > 0;
  const defaultChannelId =
    values.channel_block?.channel_select?.selected_conversation || undefined;

  // Validate: if enabled, must have at least one day
  if (standupEnabled && standupDays.length === 0) {
    return {
      response_action: 'errors',
      errors: { days_block: 'Select at least one day when standups are enabled' },
    };
  }

  const userService = new UserService(getDb());
  await userService.update(slackUserId, {
    ...(timezone ? { timezone } : {}),
    ...(standupTime ? { standupTime } : {}),
    standupDays,
    standupEnabled,
    ...(defaultChannelId ? { defaultChannelId } : {}),
  });

  return {}; // empty response closes modal
}

export async function handleBlockAction(
  payload: BlockActionsPayload,
): Promise<void> {
  const action = payload.actions[0];
  if (!action) return;

  switch (action.action_id) {
    case 'regenerate_standup': {
      const context = action.value ? JSON.parse(action.value) : {};
      const userId = context.userId || payload.user.id;
      const channelId = payload.channel?.id;

      if (!channelId) break;

      const db = getDb();
      const generator = new StandupGeneratorService(
        new TokenService(db, config.app.encryptionKey),
        new StandupService(db),
        new UserService(db),
        getSlackService(),
        config.jira,
        config.google,
      );
      await generator.generate(userId, channelId);
      break;
    }

    case 'skip_standup': {
      const channelId = payload.channel?.id;
      if (!channelId) break;

      await getSlackService().postEphemeral(
        channelId,
        payload.user.id,
        [],
        'Standup skipped for today.',
      );
      break;
    }

    case 'edit_standup': {
      const context = action.value ? JSON.parse(action.value) : {};
      const userId = context.userId || payload.user.id;
      const date = context.date;
      if (!date) break;

      const db = getDb();
      const standupService = new StandupService(db);
      const record = await standupService.getById(date, userId);
      const currentBlockers = record?.blockers || '';

      const modal = {
        type: 'modal',
        callback_id: 'edit_blockers_modal',
        private_metadata: JSON.stringify({
          userId,
          date,
          channelId: payload.channel?.id,
          messageTs: payload.message?.ts,
        }),
        title: { type: 'plain_text', text: 'Edit Blockers' },
        submit: { type: 'plain_text', text: 'Save' },
        close: { type: 'plain_text', text: 'Cancel' },
        blocks: [
          {
            type: 'input',
            block_id: 'blockers_block',
            label: { type: 'plain_text', text: 'Blockers' },
            element: {
              type: 'plain_text_input',
              action_id: 'blockers_input',
              multiline: true,
              initial_value: currentBlockers === 'None' ? '' : currentBlockers,
              placeholder: { type: 'plain_text', text: 'Describe any blockers, or leave empty for "None"' },
            },
          },
        ],
      };

      await getSlackService().openModal(payload.trigger_id, modal);
      break;
    }

    // connect_jira / connect_google are URL buttons — no server handler needed
    default:
      break;
  }
}

export async function handleEditBlockersSubmission(
  payload: ViewSubmissionPayload,
): Promise<Record<string, unknown>> {
  const values = payload.view.state.values;
  const meta = JSON.parse(payload.view.private_metadata);
  const { userId, date, channelId, messageTs } = meta;

  const newBlockers = values.blockers_block.blockers_input.value?.trim() || 'None';

  const db = getDb();
  const standupService = new StandupService(db);
  const record = await standupService.getById(date, userId);

  if (record) {
    record.blockers = newBlockers;
    await standupService.save(record);

    // Update the original Slack message if we have the context
    if (channelId && messageTs) {
      const userService = new UserService(db);
      const user = await userService.getBySlackId(userId);
      const displayName = user?.displayName || 'Your';
      const blocks = formatStandupMessage(record, displayName);
      await getSlackService().updateMessage(channelId, messageTs, blocks, `${displayName}'s Standup`);
    }
  }

  return {}; // empty response closes modal
}
