import { generateObject } from "ai";
import { getModel } from "@/lib/ai/provider";
import { guardAi } from "@/lib/ai/guard";
import { RECIPE_SYSTEM, recipePrompt } from "@/lib/ai/prompt";
import { AiRecipes, RecipesRequest } from "@/lib/ai/schema";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const model = getModel();
  if (!model) return Response.json({ error: "ai_disabled" }, { status: 503 });

  const blocked = await guardAi(req);
  if (blocked) return blocked;

  const parsed = RecipesRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "bad_request" }, { status: 400 });

  try {
    const { object } = await generateObject({
      model,
      schema: AiRecipes,
      system: RECIPE_SYSTEM,
      prompt: recipePrompt(parsed.data),
    });
    return Response.json({ recipes: object.recipes.slice(0, 3) });
  } catch (err) {
    console.error("AI recipe generation failed", err);
    return Response.json({ error: "ai_failed" }, { status: 502 });
  }
}
