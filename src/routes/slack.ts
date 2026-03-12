import { Router, Request, Response, NextFunction } from 'express';
import { config, getDb } from '../config';
import { slackVerify } from '../middleware/slack-verify';
import {
  TokenService,
  StandupService,
  UserService,
  StandupGeneratorService,
  getSlackService,
} from '../services';
import { buildSettingsModal, formatConnectionStatus, formatStandupHistory } from '../utils';
import {
  handleSettingsSubmission,
  handleBlockAction,
  handleEditBlockersSubmission,
} from '../handlers/slack-interactions';

const router = Router();

// All Slack routes require signature verification
router.use(slackVerify);

// Slash commands (Slack sends application/x-www-form-urlencoded)
router.post('/commands', (req: Request, res: Response) => {
  const { command, user_id, channel_id, trigger_id } = req.body;

  switch (command) {
    case '/standup': {
      res.json({
        response_type: 'ephemeral',
        text: 'Generating your standup...',
      });

      // Fire-and-forget: generate and post asynchronously
      const db = getDb();
      const generator = new StandupGeneratorService(
        new TokenService(db, config.app.encryptionKey),
        new StandupService(db),
        new UserService(db),
        getSlackService(),
        config.jira,
        config.google,
      );
      generator.generate(user_id, channel_id).catch((err: Error) => {
        console.error(`[STANDUP] Generation failed for ${user_id}:`, err);
        getSlackService()
          .postEphemeral(channel_id, user_id, [], `Standup generation failed: ${err.message}`)
          .catch((e: unknown) => console.error('[STANDUP] Error notification failed:', e));
      });
      break;
    }

    case '/standup-settings': {
      // Acknowledge immediately — trigger_id expires in 3s
      res.status(200).send();

      (async () => {
        const db = getDb();
        const userService = new UserService(db);
        const user = await userService.getBySlackId(user_id);
        if (!user) {
          await getSlackService().postEphemeral(
            channel_id,
            user_id,
            [],
            'Please set up your account first with /standup-connect',
          );
          return;
        }
        const modal = buildSettingsModal(user);
        await getSlackService().openModal(trigger_id, modal);
      })().catch((err: Error) => {
        console.error(`[SETTINGS] Modal open failed for ${user_id}:`, err);
      });
      break;
    }

    case '/standup-history': {
      res.status(200).send();

      (async () => {
        const db = getDb();
        const userService = new UserService(db);
        const standupService = new StandupService(db);
        const user = await userService.getBySlackId(user_id);
        const displayName = user?.displayName || 'Your';
        const records = await standupService.getHistory(user_id);
        const blocks = formatStandupHistory(records, displayName);
        await getSlackService().postEphemeral(
          channel_id,
          user_id,
          blocks,
          'Standup history',
        );
      })().catch((err: Error) => {
        console.error(`[HISTORY] Failed for ${user_id}:`, err);
      });
      break;
    }

    case '/standup-connect': {
      // Acknowledge immediately
      res.status(200).send();

      (async () => {
        const db = getDb();
        const tokenService = new TokenService(db, config.app.encryptionKey);
        const tokens = await tokenService.getTokens(user_id);
        const blocks = formatConnectionStatus(tokens, config.app.baseUrl, user_id);
        await getSlackService().postEphemeral(
          channel_id,
          user_id,
          blocks,
          'Service connections',
        );
      })().catch((err: Error) => {
        console.error(`[CONNECT] Failed for ${user_id}:`, err);
      });
      break;
    }

    default:
      res.json({
        response_type: 'ephemeral',
        text: `Unknown command: ${command}`,
      });
  }
});

// Slack Events API
router.post('/events', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type } = req.body;

    // URL verification challenge (required for Slack app setup)
    if (type === 'url_verification') {
      res.json({ challenge: req.body.challenge });
      return;
    }

    // Event callback
    if (type === 'event_callback') {
      const event = req.body.event;
      // Acknowledge immediately
      res.status(200).send();

      // Event dispatch stub — actual handlers come in later phases
      console.log(`[SLACK] Received event: ${event?.type}`);
      return;
    }

    res.status(200).send();
  } catch (err) {
    next(err);
  }
});

// Slack interactive components (buttons, modals)
router.post('/interactions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Slack sends payload as a JSON string in a form-encoded body
    const payload = JSON.parse(req.body.payload || '{}');
    const { type } = payload;

    switch (type) {
      case 'block_actions':
        // Acknowledge immediately, process async
        res.status(200).send();
        handleBlockAction(payload).catch((err: Error) => {
          console.error('[INTERACTION] Block action failed:', err);
        });
        break;

      case 'view_submission': {
        if (payload.view?.callback_id === 'settings_modal') {
          const result = await handleSettingsSubmission(payload);
          res.json(result);
        } else if (payload.view?.callback_id === 'edit_blockers_modal') {
          const result = await handleEditBlockersSubmission(payload);
          res.json(result);
        } else {
          res.json({ response_action: 'clear' });
        }
        break;
      }

      default:
        res.status(200).send();
    }
  } catch (err) {
    next(err);
  }
});

export default router;
