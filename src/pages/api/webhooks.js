import { createNodeMiddleware, createProbot } from 'probot';

import { robot as app } from '../../bot';

export default createNodeMiddleware(app, { probot: createProbot(), webhooksPath: '/api/webhooks' });
