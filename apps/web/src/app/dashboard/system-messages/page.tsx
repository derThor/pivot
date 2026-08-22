import { NotificationsView } from "@/components/notifications-view";
import { getNotifications } from "@/lib/api-server";

/** Benachrichtigungs-Postfach (Nutzervorgabe, 2026-08-21, 1:1 nach
 * Bildvorlage) – ersetzt die vorherige, rein berechnete Banner-Liste.
 * `getNotifications()` synct serverseitig die aktuell zutreffenden
 * Bedingungen (siehe NotificationsService.sync() im Backend), bevor die
 * Liste zurückkommt. Details: knowledge-base/frontend/
 * toast-and-system-messages.md. */
export default async function SystemMessagesPage() {
  const notifications = await getNotifications();

  return <NotificationsView notifications={notifications ?? []} />;
}
