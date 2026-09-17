import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { allChatIdsWithPerson, sendTelegramMessage } from "@/lib/telegram";

export const runtime = "nodejs";

// La llama Vercel Cron una vez por día (ver vercel.json). A cada persona
// activada en Telegram que todavía no cargó NINGÚN movimiento hoy le manda un
// recordatorio. Si ya cargó algo hoy, no la molesta.
export async function GET(req: NextRequest) {
  // Vercel manda "Authorization: Bearer <CRON_SECRET>" automáticamente en
  // cron jobs cuando la env var CRON_SECRET está configurada. Rechazamos
  // cualquier otro llamado a esta URL pública.
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Falta configurar Supabase." }, { status: 500 });
  }

  const people = allChatIdsWithPerson();
  if (people.length === 0) {
    return NextResponse.json({ reminded: 0, note: "Nadie activado en Telegram todavía." });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const today = new Date().toISOString().slice(0, 10);
  let reminded = 0;

  for (const { chatId, person } of people) {
    const { count } = await supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("paid_by", person)
      .eq("date", today);

    if (count && count > 0) continue;

    await sendTelegramMessage(
      chatId,
      `👋 ${person}, todavía no cargaste ningún gasto hoy. Mandame algo tipo "$15.550 verdulería" y lo guardo.`
    );
    reminded++;
  }

  return NextResponse.json({ reminded, checked: people.length });
}
