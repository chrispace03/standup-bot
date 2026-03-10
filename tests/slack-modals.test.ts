import { buildSettingsModal, COMMON_TIMEZONES } from '../src/utils/slack-modals';
import { User } from '../src/models';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    slackUserId: 'U12345',
    slackTeamId: 'T12345',
    displayName: 'Test User',
    email: 'test@example.com',
    timezone: 'America/New_York',
    standupTime: '09:00',
    standupEnabled: true,
    standupDays: [1, 2, 3, 4, 5],
    googleConnected: false,
    defaultChannelId: 'C123',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('buildSettingsModal', () => {
  it('returns correct modal structure', () => {
    const modal = buildSettingsModal(makeUser());

    expect(modal.type).toBe('modal');
    expect(modal.callback_id).toBe('settings_modal');
    expect(modal.title).toEqual({ type: 'plain_text', text: 'Standup Settings' });
    expect(modal.submit).toEqual({ type: 'plain_text', text: 'Save' });
    expect(modal.close).toEqual({ type: 'plain_text', text: 'Cancel' });
    expect(modal.private_metadata).toBe('U12345');
    expect(modal.blocks).toHaveLength(5);
  });

  it('pre-populates timezone from user', () => {
    const modal = buildSettingsModal(makeUser({ timezone: 'America/New_York' }));
    const blocks = modal.blocks as any[];
    const tzBlock = blocks.find((b: any) => b.block_id === 'timezone_block');

    expect(tzBlock.element.initial_option).toEqual({
      text: { type: 'plain_text', text: 'Eastern Time - America/New_York' },
      value: 'America/New_York',
    });
  });

  it('omits initial_option when timezone is not in common list', () => {
    const modal = buildSettingsModal(makeUser({ timezone: 'Africa/Nairobi' }));
    const blocks = modal.blocks as any[];
    const tzBlock = blocks.find((b: any) => b.block_id === 'timezone_block');

    expect(tzBlock.element.initial_option).toBeUndefined();
  });

  it('pre-populates standup time', () => {
    const modal = buildSettingsModal(makeUser({ standupTime: '10:30' }));
    const blocks = modal.blocks as any[];
    const timeBlock = blocks.find((b: any) => b.block_id === 'time_block');

    expect(timeBlock.element.initial_time).toBe('10:30');
  });

  it('pre-populates standup days', () => {
    const modal = buildSettingsModal(makeUser({ standupDays: [1, 3, 5] }));
    const blocks = modal.blocks as any[];
    const daysBlock = blocks.find((b: any) => b.block_id === 'days_block');

    expect(daysBlock.element.initial_options).toHaveLength(3);
    const values = daysBlock.element.initial_options.map((o: any) => o.value);
    expect(values).toEqual(['1', '3', '5']);
  });

  it('pre-populates enabled state when true', () => {
    const modal = buildSettingsModal(makeUser({ standupEnabled: true }));
    const blocks = modal.blocks as any[];
    const enabledBlock = blocks.find((b: any) => b.block_id === 'enabled_block');

    expect(enabledBlock.element.initial_options).toHaveLength(1);
    expect(enabledBlock.element.initial_options[0].value).toBe('enabled');
  });

  it('omits initial_options for enabled when false', () => {
    const modal = buildSettingsModal(makeUser({ standupEnabled: false }));
    const blocks = modal.blocks as any[];
    const enabledBlock = blocks.find((b: any) => b.block_id === 'enabled_block');

    expect(enabledBlock.element.initial_options).toBeUndefined();
  });

  it('pre-populates default channel when set', () => {
    const modal = buildSettingsModal(makeUser({ defaultChannelId: 'C_CUSTOM' }));
    const blocks = modal.blocks as any[];
    const channelBlock = blocks.find((b: any) => b.block_id === 'channel_block');

    expect(channelBlock.element.initial_conversation).toBe('C_CUSTOM');
  });

  it('omits initial_conversation when no default channel', () => {
    const modal = buildSettingsModal(makeUser({ defaultChannelId: undefined }));
    const blocks = modal.blocks as any[];
    const channelBlock = blocks.find((b: any) => b.block_id === 'channel_block');

    expect(channelBlock.element.initial_conversation).toBeUndefined();
  });

  it('includes all common timezones as options', () => {
    const modal = buildSettingsModal(makeUser());
    const blocks = modal.blocks as any[];
    const tzBlock = blocks.find((b: any) => b.block_id === 'timezone_block');

    expect(tzBlock.element.options).toHaveLength(COMMON_TIMEZONES.length);
  });
});
