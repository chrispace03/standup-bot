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

const router = Router();

// All Slack routes require signature verification
router.use(slackVerify);

// Slash commands (Slack sends application/x-www-form-urlencoded)
router.post('/commands', (req: Request, res: Response) => {
  const { command, user_id, channel_id } = req.body;

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

    case '/standup-settings':
      res.json({
        response_type: 'ephemeral',
        text: `Settings for <@${user_id}>:\n• Standup time: 09:00\n• Days: Mon–Fri\n\n_Settings management coming soon!_`,
      });
      break;

    case '/standup-connect':
      res.json({
        response_type: 'ephemeral',
        text: 'Service connections:\n• Slack: Connected\n• Jira: Not connected\n• Google Calendar: Not connected\n\n_Connection management coming soon!_',
      });
      break;

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
router.post('/interactions', (req: Request, res: Response, next: NextFunction) => {
  try {
    // Slack sends payload as a JSON string in a form-encoded body
    const payload = JSON.parse(req.body.payload || '{}');
    const { type } = payload;

    switch (type) {
      case 'block_actions':
        // Handle button/action clicks — stub for now
        res.status(200).send();
        break;

      case 'view_submission':
        // Handle modal form submissions — stub for now
        res.json({ response_action: 'clear' });
        break;

      default:
        res.status(200).send();
    }
  } catch (err) {
    next(err);
  }
});

export default router;
