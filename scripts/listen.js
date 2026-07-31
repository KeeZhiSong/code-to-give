// Local inbound transport: polls GreenAPI and feeds handleWebhook().
//
// Run alongside `npm run dev`, in its own terminal:
//     npm run listen
//
// This is the LOCAL path. Once deployed to Vercel you'd instead point
// webhookUrl at /api/webhook and stop running this — the two are mutually
// exclusive, since setting webhookUrl drains notifications away from the queue.

import "../lib/loadEnv.js"; // must stay first — populates process.env
import { receiveNotification, deleteNotification, getStateInstance, getSettings } from "../lib/greenapi.js";
import { handleWebhook } from "../lib/handleWebhook.js";
import { getRoster } from "../lib/store.js";
import { EVENT, assertConfigured } from "../lib/config.js";

async function preflight() {
  const state = await getStateInstance();
  if (state?.stateInstance !== "authorized") {
    console.error(`❌ Instance is ${state?.stateInstance} — scan the QR in the GreenAPI console.`);
    process.exit(1);
  }

  const s = await getSettings();
  const missing = [];
  if (s?.incomingWebhook !== "yes") missing.push("incomingWebhook");
  if (s?.pollMessageWebhook !== "yes") missing.push("pollMessageWebhook");
  if (missing.length) {
    console.error(
      `❌ ${missing.join(" and ")} is OFF — poll votes will never arrive.\n` +
        `   Fix with:  node whatsapp-rsvp.js setup`
    );
    process.exit(1);
  }

  if (s?.webhookUrl) {
    console.error(
      `❌ webhookUrl is set to "${s.webhookUrl}".\n` +
        `   GreenAPI is POSTing notifications there instead of queueing them, so\n` +
        `   this polling listener will never see anything. Clear it in the console\n` +
        `   to run locally.`
    );
    process.exit(1);
  }

  console.log(`   instance: ${s.wid}  ✅ webhooks configured`);
}

async function printRoster() {
  const { going, notGoing } = await getRoster(EVENT.campaign);
  console.log(
    `   📋 ${EVENT.campaign} — Going: ${going.length} | Not going: ${notGoing.length}` +
      (going.length ? `\n      In: ${going.map((r) => r.name).join(", ")}` : "")
  );
}

(async () => {
  assertConfigured();
  console.log("Checking instance...");
  await preflight();
  console.log("👂 Listening for RSVP responses...  (Ctrl+C to stop)\n");

  while (true) {
    try {
      const notif = await receiveNotification();
      if (!notif) continue;

      const result = await handleWebhook(notif.body);
      await deleteNotification(notif.receiptId); // IMPORTANT: or it repeats forever
      if (result) await printRoster();
    } catch (e) {
      console.error("poll error:", e.message);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
})();
