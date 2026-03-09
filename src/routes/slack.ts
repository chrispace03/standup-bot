import { Router, Request, Response, NextFunction } from 'express';
import { slackVerify } from '../middleware/slack-verify';

const router = Router();

// All Slack routes require signature verification
router.use(slackVerify);

// Slash commands (Slack sends application/x-www-form-urlencoded)
router.post('/commands', (req: Request, res: Response) => {
  const { command, text, user_id, response_url } = req.body;

  switch (command) {
    case '/standup':
      // Acknowledge immediately — actual generation comes in Phase 6
      res.json({
        response_type: 'ephemeral',
        text: `Generating your standup${text ? ` (${text})` : ''}... This feature is coming soon!`,
      });
      break;

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
