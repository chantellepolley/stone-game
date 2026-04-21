import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

webpush.setVapidDetails(
  "mailto:push@stonethegame.com",
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

Deno.serve(async (req) => {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
      },
    });
  }

  try {
    const { playerId, title, body, tag, url } = await req.json();
    if (!playerId) {
      return new Response(JSON.stringify({ error: "playerId required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get all push subscriptions for this player
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, keys")
      .eq("player_id", playerId);

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: "no subscriptions" }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const payload = JSON.stringify({
      title: title || "STONE",
      body: body || "Something happened in your game!",
      tag: tag || "stone-notification",
      url: url || "/",
    });

    let sent = 0;
    const expired: string[] = [];

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          payload,
          { TTL: 86400, urgency: "high" }
        );
        sent++;
      } catch (err: unknown) {
        const pushErr = err as { statusCode?: number };
        if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
          // Subscription expired — clean it up
          expired.push(sub.id);
        } else {
          console.error(`Push failed for ${sub.endpoint}:`, err);
        }
      }
    }

    // Clean up expired subscriptions
    if (expired.length > 0) {
      await supabase.from("push_subscriptions").delete().in("id", expired);
    }

    return new Response(JSON.stringify({ sent, expired: expired.length }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
