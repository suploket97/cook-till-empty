import { activeProvider } from "@/lib/ai/provider";

export const dynamic = "force-dynamic";

/** Lets the UI show the AI button only when a provider key is configured. */
export function GET() {
  const provider = activeProvider();
  return Response.json({ enabled: Boolean(provider), provider });
}
