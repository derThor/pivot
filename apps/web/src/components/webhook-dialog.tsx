"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { toastCreated } from "@/components/app-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const eventOptions = [
  { value: "content.published", label: "Inhalt veröffentlicht" },
  { value: "content.updated", label: "Inhalt geändert" },
];

export function WebhookDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function reset() {
    setUrl("");
    setEvents([]);
    setError(null);
  }

  function toggleEvent(value: string, checked: boolean) {
    setEvents((prev) =>
      checked ? [...prev, value] : prev.filter((v) => v !== value),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (events.length === 0) {
      setError("Bitte mindestens ein Event auswählen.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, events }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.message ?? "Webhook konnte nicht angelegt werden.");
        return;
      }
      setOpen(false);
      reset();
      toastCreated("Der Webhook wurde angelegt.");
      router.refresh();
    } catch {
      setError("Server nicht erreichbar. Bitte später erneut versuchen.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger render={<Button />}>
        <Plus />
        Neuer Webhook
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Webhook anlegen</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="webhook-url">Ziel-URL</Label>
            <Input
              id="webhook-url"
              type="url"
              required
              placeholder="https://example.com/webhook"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Events</Label>
            {eventOptions.map((option) => (
              <label
                key={option.value}
                className="flex items-center gap-2 text-sm"
              >
                <Checkbox
                  checked={events.includes(option.value)}
                  onCheckedChange={(checked) =>
                    toggleEvent(option.value, checked === true)
                  }
                />
                {option.label}
              </label>
            ))}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Wird angelegt…" : "Webhook anlegen"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
