import { generateObject } from "ai";
import { getModel } from "@/lib/ai/provider";
import { guardAi } from "@/lib/ai/guard";
import { CLASSIFY_SYSTEM } from "@/lib/ai/prompt";
import { Classified, ClassifyRequest } from "@/lib/ai/schema";

export const runtime = "nodejs";

/** Names and files an ingredient the built-in catalogue doesn't know (e.g. "hummus"). */
export async function POST(req: Request) {
  const model = getModel();
  if (!model) return Response.json({ error: "ai_disabled" }, { status: 503 });

  const blocked = await guardAi(req);
  if (blocked) return blocked;

  const parsed = ClassifyRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "bad_request" }, { status: 400 });

  try {
    const { object } = await generateObject({
      model,
      schema: Classified,
      system: CLASSIFY_SYSTEM,
      prompt: `Items: ${JSON.stringify(parsed.data.items)}`,
    });
    return Response.json(object);
  } catch (err) {
    console.error("AI classify failed", err);
    return Response.json({ error: "ai_failed" }, { status: 502 });
  }
}
