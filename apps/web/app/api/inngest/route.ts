import { serve } from 'inngest/next';
import { functions, inngest } from '@momus/jobs';

/** Allow long sync steps on Vercel Fluid/Pro (Inngest docs recommend configuring this). */
export const maxDuration = 300;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
});
