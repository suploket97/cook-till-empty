import Link from "next/link";

export const metadata = { title: "Privacy · Cook-Till-Empty" };

/*
 * TEMPLATE — review before publishing. Replace the bracketed parts, and have it checked if the app is public
 * or commercial. Written for UK GDPR; adjust for Thailand's PDPA if you serve users there.
 */
export default function Privacy() {
  const h = "font-display text-lg font-semibold mt-6";
  return (
    <main className="mx-auto max-w-[68ch] px-4 py-10 text-[15px] leading-relaxed">
      <Link href="/" className="text-sm text-accent underline underline-offset-2">
        ← Cook-Till-Empty
      </Link>
      <h1 className="mt-4 font-display text-3xl font-bold">Privacy notice</h1>
      <p className="mt-2 text-sm text-muted">Last updated: [date]. Controller: [your name or company], [contact email].</p>

      <h2 className={h}>What the app stores</h2>
      <p>
        Your fridge contents, shopping list, cooking log and settings. Without an account they stay in your browser on this device. If you sign in,
        they are stored in our database (Supabase, [region]) so they sync across your devices and with people in your household, and we store your
        email address to sign you in.
      </p>

      <h2 className={h}>AI recipe ideas</h2>
      <p>
        Only if you press “Ask AI”, a list of your ingredients, their amounts, your kitchen region and your pantry-staples setting are sent to
        [OpenAI / Google / Anthropic] to generate recipe ideas. Your email and account details are not sent. The provider processes this data on
        our behalf under its API terms. AI suggestions can be wrong: check allergens and cook meat, fish and eggs thoroughly.
      </p>

      <h2 className={h}>Notifications</h2>
      <p>
        If you turn on expiry notifications while signed in, we store your device’s push address (issued by your browser’s push service, e.g.
        Google, Apple or Mozilla), your language, time zone and warning setting, and send one summary a day through that service. Turn
        notifications off or sign out to delete it.
      </p>

      <h2 className={h}>Why we can use it</h2>
      <p>To provide the service you asked for (contract), and for sign-in security (legitimate interests).</p>

      <h2 className={h}>How long we keep it</h2>
      <p>Until you delete it or your account. Contact us to delete your account and all its data.</p>

      <h2 className={h}>Your rights</h2>
      <p>
        You can ask for a copy of your data, correct it, delete it or object to its use. Contact [email]. You can complain to the Information
        Commissioner’s Office (ico.org.uk).
      </p>
    </main>
  );
}
