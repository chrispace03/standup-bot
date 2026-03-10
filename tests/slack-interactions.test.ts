import {
  handleSettingsSubmission,
  handleBlockAction,
  ViewSubmissionPayload,
  BlockActionsPayload,
} from '../src/handlers/slack-interactions';

// Must use var (not const) for jest.mock hoisting to work
/* eslint-disable no-var */
var mockUpdate = jest.fn().mockResolvedValue(undefined);
var mockGenerate = jest.fn().mockResolvedValue({ record: {}, posted: true });
var mockPostEphemeral = jest.fn().mockResolvedValue(undefined);
/* eslint-enable no-var */

jest.mock('../src/services/user.service', () => ({
  UserService: jest.fn().mockImplementation(() => ({
    update: mockUpdate,
  })),
}));

jest.mock('../src/config', () => ({
  config: {
    app: { encryptionKey: 'test-key' },
    jira: {},
    google: {},
  },
  getDb: jest.fn().mockReturnValue({}),
}));

jest.mock('../src/services/standup-generator.service', () => ({
  StandupGeneratorService: jest.fn().mockImplementation(() => ({
    generate: mockGenerate,
  })),
}));

jest.mock('../src/services/standup.service', () => ({
  StandupService: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../src/services/token.service', () => ({
  TokenService: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../src/services/slack.service', () => ({
  getSlackService: () => ({
    postEphemeral: mockPostEphemeral,
  }),
}));

function makeSubmissionPayload(overrides: Record<string, any> = {}): ViewSubmissionPayload {
  return {
    type: 'view_submission',
    user: { id: 'U12345' },
    view: {
      callback_id: 'settings_modal',
      private_metadata: 'U12345',
      state: {
        values: {
          timezone_block: {
            timezone_select: {
              selected_option: { value: 'America/New_York' },
            },
          },
          time_block: {
            time_picker: {
              selected_time: '09:30',
            },
          },
          days_block: {
            days_checkboxes: {
              selected_options: [
                { value: '1' },
                { value: '2' },
                { value: '3' },
                { value: '4' },
                { value: '5' },
              ],
            },
          },
          enabled_block: {
            enabled_checkbox: {
              selected_options: [{ value: 'enabled' }],
            },
          },
          channel_block: {
            channel_select: {
              selected_conversation: 'C456',
            },
          },
        },
      },
    },
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('handleSettingsSubmission', () => {
  it('parses values and calls UserService.update()', async () => {
    const payload = makeSubmissionPayload();
    await handleSettingsSubmission(payload);

    expect(mockUpdate).toHaveBeenCalledWith('U12345', {
      timezone: 'America/New_York',
      standupTime: '09:30',
      standupDays: [1, 2, 3, 4, 5],
      standupEnabled: true,
      defaultChannelId: 'C456',
    });
  });

  it('returns empty object on success (closes modal)', async () => {
    const result = await handleSettingsSubmission(makeSubmissionPayload());
    expect(result).toEqual({});
  });

  it('returns validation error when enabled but no days selected', async () => {
    const payload = makeSubmissionPayload();
    payload.view.state.values.days_block.days_checkboxes.selected_options = [];
    // enabled is still true

    const result = await handleSettingsSubmission(payload);

    expect(result).toEqual({
      response_action: 'errors',
      errors: { days_block: 'Select at least one day when standups are enabled' },
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('allows no days when standup is disabled', async () => {
    const payload = makeSubmissionPayload();
    payload.view.state.values.days_block.days_checkboxes.selected_options = [];
    payload.view.state.values.enabled_block.enabled_checkbox.selected_options = [];

    const result = await handleSettingsSubmission(payload);

    expect(result).toEqual({});
    expect(mockUpdate).toHaveBeenCalledWith('U12345', expect.objectContaining({
      standupEnabled: false,
      standupDays: [],
    }));
  });
});

describe('handleBlockAction', () => {
  it('dispatches regenerate_standup and calls generate()', async () => {
    const payload: BlockActionsPayload = {
      type: 'block_actions',
      user: { id: 'U12345' },
      channel: { id: 'C123' },
      actions: [{
        action_id: 'regenerate_standup',
        value: JSON.stringify({ userId: 'U12345', date: '2026-03-10' }),
      }],
    };

    await handleBlockAction(payload);

    expect(mockGenerate).toHaveBeenCalledWith('U12345', 'C123');
  });

  it('dispatches skip_standup and posts ephemeral confirmation', async () => {
    const payload: BlockActionsPayload = {
      type: 'block_actions',
      user: { id: 'U12345' },
      channel: { id: 'C123' },
      actions: [{
        action_id: 'skip_standup',
        value: JSON.stringify({ userId: 'U12345', date: '2026-03-10' }),
      }],
    };

    await handleBlockAction(payload);

    expect(mockPostEphemeral).toHaveBeenCalledWith(
      'C123', 'U12345', [], 'Standup skipped for today.',
    );
  });

  it('does nothing when actions array is empty', async () => {
    const payload: BlockActionsPayload = {
      type: 'block_actions',
      user: { id: 'U12345' },
      channel: { id: 'C123' },
      actions: [],
    };

    await handleBlockAction(payload);

    expect(mockGenerate).not.toHaveBeenCalled();
    expect(mockPostEphemeral).not.toHaveBeenCalled();
  });
});
