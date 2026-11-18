import { createSiteContext, createDatabaseClient, errorResponse } from './_qoder/backend.mjs';
import { application } from './router.mjs';

// forwardApplicationCredentials сохраняет cookie приложения: регистрация, вход и сессии
// форума живут только в нашей базе, платформа не используется как источник личности игрока.
const handle = application({
  db: createDatabaseClient(),
  env: (name: string) => Deno.env.get(name),
});

Deno.serve(async (request) => {
  let context;
  try {
    context = createSiteContext(request, { forwardApplicationCredentials: true });
    return await handle(context);
  } catch (error) {
    return errorResponse(error, context?.requestId);
  }
});
