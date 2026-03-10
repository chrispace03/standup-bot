import { User } from '../models';

export const COMMON_TIMEZONES = [
  { label: 'Eastern Time - America/New_York', value: 'America/New_York' },
  { label: 'Central Time - America/Chicago', value: 'America/Chicago' },
  { label: 'Mountain Time - America/Denver', value: 'America/Denver' },
  { label: 'Pacific Time - America/Los_Angeles', value: 'America/Los_Angeles' },
  { label: 'Alaska - America/Anchorage', value: 'America/Anchorage' },
  { label: 'Hawaii - Pacific/Honolulu', value: 'Pacific/Honolulu' },
  { label: 'UTC', value: 'UTC' },
  { label: 'London - Europe/London', value: 'Europe/London' },
  { label: 'Paris - Europe/Paris', value: 'Europe/Paris' },
  { label: 'Berlin - Europe/Berlin', value: 'Europe/Berlin' },
  { label: 'Helsinki - Europe/Helsinki', value: 'Europe/Helsinki' },
  { label: 'Dubai - Asia/Dubai', value: 'Asia/Dubai' },
  { label: 'Kolkata - Asia/Kolkata', value: 'Asia/Kolkata' },
  { label: 'Singapore - Asia/Singapore', value: 'Asia/Singapore' },
  { label: 'Shanghai - Asia/Shanghai', value: 'Asia/Shanghai' },
  { label: 'Tokyo - Asia/Tokyo', value: 'Asia/Tokyo' },
  { label: 'Seoul - Asia/Seoul', value: 'Asia/Seoul' },
  { label: 'Sydney - Australia/Sydney', value: 'Australia/Sydney' },
  { label: 'Auckland - Pacific/Auckland', value: 'Pacific/Auckland' },
  { label: 'Sao Paulo - America/Sao_Paulo', value: 'America/Sao_Paulo' },
  { label: 'Toronto - America/Toronto', value: 'America/Toronto' },
];

const DAY_OPTIONS = [
  { text: { type: 'plain_text' as const, text: 'Monday' }, value: '1' },
  { text: { type: 'plain_text' as const, text: 'Tuesday' }, value: '2' },
  { text: { type: 'plain_text' as const, text: 'Wednesday' }, value: '3' },
  { text: { type: 'plain_text' as const, text: 'Thursday' }, value: '4' },
  { text: { type: 'plain_text' as const, text: 'Friday' }, value: '5' },
  { text: { type: 'plain_text' as const, text: 'Saturday' }, value: '6' },
  { text: { type: 'plain_text' as const, text: 'Sunday' }, value: '0' },
];

const ENABLED_OPTION = {
  text: { type: 'plain_text' as const, text: 'Enable automatic standups' },
  value: 'enabled',
};

export function buildSettingsModal(user: User): Record<string, unknown> {
  const timezoneOptions = COMMON_TIMEZONES.map((tz) => ({
    text: { type: 'plain_text' as const, text: tz.label },
    value: tz.value,
  }));

  const currentTz = timezoneOptions.find((opt) => opt.value === user.timezone);

  const initialDays = DAY_OPTIONS.filter((day) =>
    user.standupDays.includes(parseInt(day.value, 10)),
  );

  return {
    type: 'modal',
    callback_id: 'settings_modal',
    title: { type: 'plain_text', text: 'Standup Settings' },
    submit: { type: 'plain_text', text: 'Save' },
    close: { type: 'plain_text', text: 'Cancel' },
    private_metadata: user.slackUserId,
    blocks: [
      {
        type: 'input',
        block_id: 'timezone_block',
        label: { type: 'plain_text', text: 'Timezone' },
        element: {
          type: 'static_select',
          action_id: 'timezone_select',
          placeholder: { type: 'plain_text', text: 'Select a timezone' },
          ...(currentTz ? { initial_option: currentTz } : {}),
          options: timezoneOptions,
        },
      },
      {
        type: 'input',
        block_id: 'time_block',
        label: { type: 'plain_text', text: 'Standup Time' },
        element: {
          type: 'timepicker',
          action_id: 'time_picker',
          initial_time: user.standupTime,
          placeholder: { type: 'plain_text', text: 'Select a time' },
        },
      },
      {
        type: 'input',
        block_id: 'days_block',
        label: { type: 'plain_text', text: 'Standup Days' },
        element: {
          type: 'checkboxes',
          action_id: 'days_checkboxes',
          options: DAY_OPTIONS,
          ...(initialDays.length > 0 ? { initial_options: initialDays } : {}),
        },
      },
      {
        type: 'input',
        block_id: 'enabled_block',
        label: { type: 'plain_text', text: 'Auto Standup' },
        element: {
          type: 'checkboxes',
          action_id: 'enabled_checkbox',
          options: [ENABLED_OPTION],
          ...(user.standupEnabled ? { initial_options: [ENABLED_OPTION] } : {}),
        },
        optional: true,
      },
      {
        type: 'input',
        block_id: 'channel_block',
        label: { type: 'plain_text', text: 'Default Channel' },
        element: {
          type: 'conversations_select',
          action_id: 'channel_select',
          placeholder: { type: 'plain_text', text: 'Select a channel' },
          ...(user.defaultChannelId ? { initial_conversation: user.defaultChannelId } : {}),
          filter: { include: ['public', 'private'], exclude_bot_users: true },
        },
        optional: true,
      },
    ],
  };
}
