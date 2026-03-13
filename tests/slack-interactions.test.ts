import {
  handleSettingsSubmission,
  handleBlockAction,
  handleEditBlockersSubmission,
  ViewSubmissionPayload,
  BlockActionsPayload,
} from '../src/handlers/slack-interactions';

// Must use var (not const) for jest.mock hoisting to work
/* eslint-disable no-var */
var mockUpdate = jest.fn().mockResolvedValue(undefined);
var mockGetBySlackId = jest.fn().mockResolvedValue({ displayName: 'Chris' });
var mockGenerate = jest.fn().mockResolvedValue({ record: {}, posted: true });
var mockPostEphemeral = jest.fn().mockResolvedValue(undefined);
var mockOpenModal = jest.fn().mockResolvedValue(undefined);
var mockUpdateMessage = jest.fn().mockResolvedValue(undefined);
var mockGetById = jest.fn().mockResolvedValue(null);
var mockSave = jest.fn().mockResolvedValue(undefined);
/* eslint-enable no-var */

jest.mock('../src/services/user.service', () => ({
  UserService: jest.fn().mockImplementation(() => ({
    update: mockUpdate,
    getBySlackId: mockGetBySlackId,
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
  StandupService: jest.fn().mockImplementation(() => ({
    getById: mockGetById,
    save: mockSave,
  })),
}));

jest.mock('../src/services/token.service', () => ({
  TokenService: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../src/services/slack.service', () => ({
  getSlackService: () => ({
    postEphemeral: mockPostEphemeral,
    openModal: mockOpenModal,
    updateMessage: mockUpdateMessage,
  }),
}));

jest.mock('../src/utils/slack-formatter', () => ({
  formatStandupMessage: jest.fn().mockReturnValue([{ type: 'section', text: { type: 'mrkdwn', text: 'mock' } }]),
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
      trigger_id: 'trigger.123',
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
      trigger_id: 'trigger.123',
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
      trigger_id: 'trigger.123',
      user: { id: 'U12345' },
      channel: { id: 'C123' },
      actions: [],
    };

    await handleBlockAction(payload);

    expect(mockGenerate).not.toHaveBeenCalled();
    expect(mockPostEphemeral).not.toHaveBeenCalled();
  });

  it('dispatches edit_standup and opens modal with current blockers', async () => {
    mockGetById.mockResolvedValueOnce({
      userId: 'U12345',
      date: '2026-03-10',
      blockers: 'Waiting on API access',
      yesterday: [],
      today: [],
      events: [],
    });

    const payload: BlockActionsPayload = {
      type: 'block_actions',
      trigger_id: 'trigger.456',
      user: { id: 'U12345' },
      channel: { id: 'C123' },
      message: { ts: '1234567890.123456' },
      actions: [{
        action_id: 'edit_standup',
        value: JSON.stringify({ userId: 'U12345', date: '2026-03-10' }),
      }],
    };

    await handleBlockAction(payload);

    expect(mockOpenModal).toHaveBeenCalledWith('trigger.456', expect.objectContaining({
      type: 'modal',
      callback_id: 'edit_blockers_modal',
      title: { type: 'plain_text', text: 'Edit Blockers' },
    }));

    // Verify modal has the current blocker text pre-filled
    const modal = mockOpenModal.mock.calls[0][1];
    expect(modal.blocks[0].element.initial_value).toBe('Waiting on API access');

    // Verify private_metadata has the context for updating the message
    const meta = JSON.parse(modal.private_metadata);
    expect(meta).toEqual({
      userId: 'U12345',
      date: '2026-03-10',
      channelId: 'C123',
      messageTs: '1234567890.123456',
    });
  });

  it('opens edit modal with empty initial_value when blockers are "None"', async () => {
    mockGetById.mockResolvedValueOnce({
      userId: 'U12345',
      date: '2026-03-10',
      blockers: 'None',
      yesterday: [],
      today: [],
      events: [],
    });

    const payload: BlockActionsPayload = {
      type: 'block_actions',
      trigger_id: 'trigger.789',
      user: { id: 'U12345' },
      channel: { id: 'C123' },
      actions: [{
        action_id: 'edit_standup',
        value: JSON.stringify({ userId: 'U12345', date: '2026-03-10' }),
      }],
    };

    await handleBlockAction(payload);

    const modal = mockOpenModal.mock.calls[0][1];
    expect(modal.blocks[0].element.initial_value).toBe('');
  });

  it('does nothing for edit_standup when date is missing', async () => {
    const payload: BlockActionsPayload = {
      type: 'block_actions',
      trigger_id: 'trigger.123',
      user: { id: 'U12345' },
      channel: { id: 'C123' },
      actions: [{
        action_id: 'edit_standup',
        value: JSON.stringify({ userId: 'U12345' }), // no date
      }],
    };

    await handleBlockAction(payload);

    expect(mockOpenModal).not.toHaveBeenCalled();
  });
});

describe('handleEditBlockersSubmission', () => {
  it('saves new blockers and updates Slack message', async () => {
    const record = {
      userId: 'U12345',
      date: '2026-03-10',
      blockers: 'None',
      yesterday: [],
      today: [],
      events: [],
    };
    mockGetById.mockResolvedValueOnce(record);

    const payload: ViewSubmissionPayload = {
      type: 'view_submission',
      user: { id: 'U12345' },
      view: {
        callback_id: 'edit_blockers_modal',
        private_metadata: JSON.stringify({
          userId: 'U12345',
          date: '2026-03-10',
          channelId: 'C123',
          messageTs: '1234567890.123456',
        }),
        state: {
          values: {
            blockers_block: {
              blockers_input: { value: 'Blocked on code review' },
            },
          },
        },
      },
    };

    const result = await handleEditBlockersSubmission(payload);

    expect(result).toEqual({});
    expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({
      blockers: 'Blocked on code review',
    }));
    expect(mockUpdateMessage).toHaveBeenCalledWith(
      'C123',
      '1234567890.123456',
      expect.any(Array),
      "Chris's Standup",
    );
  });

  it('sets blockers to "None" when input is empty', async () => {
    const record = {
      userId: 'U12345',
      date: '2026-03-10',
      blockers: 'Old blocker',
      yesterday: [],
      today: [],
      events: [],
    };
    mockGetById.mockResolvedValueOnce(record);

    const payload: ViewSubmissionPayload = {
      type: 'view_submission',
      user: { id: 'U12345' },
      view: {
        callback_id: 'edit_blockers_modal',
        private_metadata: JSON.stringify({
          userId: 'U12345',
          date: '2026-03-10',
          channelId: 'C123',
          messageTs: '1234567890.123456',
        }),
        state: {
          values: {
            blockers_block: {
              blockers_input: { value: '  ' }, // whitespace only
            },
          },
        },
      },
    };

    await handleEditBlockersSubmission(payload);

    expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({
      blockers: 'None',
    }));
  });

  it('skips update when standup record not found', async () => {
    mockGetById.mockResolvedValueOnce(null);

    const payload: ViewSubmissionPayload = {
      type: 'view_submission',
      user: { id: 'U12345' },
      view: {
        callback_id: 'edit_blockers_modal',
        private_metadata: JSON.stringify({
          userId: 'U12345',
          date: '2026-03-10',
          channelId: 'C123',
          messageTs: '1234567890.123456',
        }),
        state: {
          values: {
            blockers_block: {
              blockers_input: { value: 'Some blocker' },
            },
          },
        },
      },
    };

    const result = await handleEditBlockersSubmission(payload);

    expect(result).toEqual({});
    expect(mockSave).not.toHaveBeenCalled();
    expect(mockUpdateMessage).not.toHaveBeenCalled();
  });

  it('saves but skips Slack update when message context is missing', async () => {
    const record = {
      userId: 'U12345',
      date: '2026-03-10',
      blockers: 'None',
      yesterday: [],
      today: [],
      events: [],
    };
    mockGetById.mockResolvedValueOnce(record);

    const payload: ViewSubmissionPayload = {
      type: 'view_submission',
      user: { id: 'U12345' },
      view: {
        callback_id: 'edit_blockers_modal',
        private_metadata: JSON.stringify({
          userId: 'U12345',
          date: '2026-03-10',
          // no channelId or messageTs
        }),
        state: {
          values: {
            blockers_block: {
              blockers_input: { value: 'New blocker' },
            },
          },
        },
      },
    };

    await handleEditBlockersSubmission(payload);

    expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({
      blockers: 'New blocker',
    }));
    expect(mockUpdateMessage).not.toHaveBeenCalled();
  });
});
