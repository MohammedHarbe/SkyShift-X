import { z } from 'zod';

export const Health = z.object({
  status: z.enum(['ok', 'degraded']),
  service: z.string(),
  apiVersion: z.string(),
  capabilities: z.object({
    dynamicJourneys: z.boolean().describe('true when the AI backend can generate journeys on demand'),
    liveObservations: z.boolean().describe('true when observations come from real SPHEREx data'),
  }),
});
export type Health = z.infer<typeof Health>;
