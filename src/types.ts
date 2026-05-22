import type { Context } from "hono";
import { z } from "zod";

export type AppContext = Context<{ Bindings: Env }>;

export type Env = {
  OAUTH_TOKEN_ENDPOINT: string;
  BUNI_BASE_URL: string;
  SUPABASE_URL: string;
  SUPABASE_KEY: string;
  CONSUMER_KEY: string;
  CONSUMER_SECRET: string;
  SHORTCODE: string;
  PASSKEY: string;
  WORKER_BASE_URL: string;
};

export const Task = z.object({
	name: z.string().openapi({ example: "lorem" }),
	slug: z.string(),
	description: z.string().optional(),
	completed: z.boolean().default(false),
	due_date: z.iso.date(),
});
