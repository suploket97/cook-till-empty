import { KitchenApp } from "@/components/KitchenApp";
import { supabaseEnabled } from "@/lib/supabase/config";

export default function Home() {
  return <KitchenApp syncAvailable={supabaseEnabled} />;
}
