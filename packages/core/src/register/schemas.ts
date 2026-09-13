import { z } from 'zod';
import { ErrorKindSchema } from '../providers/errors';
import type { Tier } from './types';

export const LengthSchema = z.enum(['short', 'medium', 'long']);

export const TierSchema = z.enum(['fast', 'main', 'reasoning']) satisfies z.ZodType<Tier>;

export const EffortSchema = z.enum(['quick', 'balanced', 'deep']);

export const RegisterSchema = z.object({
  who: z.string().min(1).optional(),
  tone: z.array(z.string().min(1)).optional(),
  format: z.string().min(1).optional(),
  length: LengthSchema.optional(),
});

export const TransformRequestSchema = z.object({
  requestId: z.string().min(1),
  intentText: z.string().min(1),
  mode: z.enum(['polish', 'compose']),
  register: RegisterSchema,
  effort: EffortSchema,
  recipeId: z.string().min(1).optional(),
  refinements: z.array(z.string().min(1)).optional(),
});

export const PortRequestSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('transform'), request: TransformRequestSchema }),
  z.object({ type: z.literal('cancel'), requestId: z.string().min(1) }),
]);

export const StreamEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('chunk'), requestId: z.string().min(1), text: z.string() }),
  z.object({ type: z.literal('done'), requestId: z.string().min(1) }),
  z.object({
    type: z.literal('error'),
    requestId: z.string().min(1),
    kind: ErrorKindSchema,
    message: z.string().min(1),
  }),
]);

export const InvokeMessageSchema = z.object({ type: z.literal('invoke-bar') });

/**
 * The content script asks the worker to inject the bar bundle into *its* frame. Injection has to
 * come from the worker: it needs a tab and frame id, and it must land in the isolated world —
 * never in the page's, where the page could read our payload and our code.
 */
export const BarScriptRequestSchema = z.object({ type: z.literal('bar-script') });

/**
 * The bar's stylesheet travels through the worker rather than being fetched by the injected
 * script: a page-context fetch of an extension resource needs `web_accessible_resources`, and a
 * public path is a fingerprint any page could read.
 */
export const BarStylesRequestSchema = z.object({ type: z.literal('bar-styles') });

export const BarStylesResponseSchema = z.object({ css: z.string() });

export const PingMessageSchema = z.object({ type: z.literal('meant-ping') });

export const PingResponseSchema = z.object({ alive: z.literal(true) });

export const DoctorRequestSchema = z.object({ type: z.literal('doctor') });

export type DoctorRequest = z.infer<typeof DoctorRequestSchema>;

export type TransformRequest = z.infer<typeof TransformRequestSchema>;
export type PortRequest = z.infer<typeof PortRequestSchema>;
export type StreamEvent = z.infer<typeof StreamEventSchema>;
