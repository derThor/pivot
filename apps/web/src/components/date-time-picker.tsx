"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const PANEL_WIDTH = 384; // px, entspricht in etwa max-w-sm
const VIEWPORT_MARGIN = 8;

const PRESETS = [
  {
    label: "In 1 Stunde",
    getDate: () => new Date(Date.now() + 60 * 60 * 1000),
  },
  {
    label: "Morgen, 9 Uhr",
    getDate: () => {
      const date = new Date();
      date.setDate(date.getDate() + 1);
      date.setHours(9, 0, 0, 0);
      return date;
    },
  },
  {
    label: "Nächste Woche",
    getDate: () => {
      const date = new Date();
      date.setDate(date.getDate() + 7);
      date.setHours(9, 0, 0, 0);
      return date;
    },
  },
];

interface DayCell {
  date: Date;
  inCurrentMonth: boolean;
}

function buildMonthGrid(year: number, month: number): DayCell[][] {
  const firstOfMonth = new Date(year, month, 1);
  // Montag = 0 ... Sonntag = 6
  const leadingBlanks = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: DayCell[] = [];
  for (let i = leadingBlanks; i > 0; i--) {
    cells.push({
      date: new Date(year, month, 1 - i),
      inCurrentMonth: false,
    });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ date: new Date(year, month, day), inCurrentMonth: true });
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1]!.date;
    cells.push({
      date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1),
      inCurrentMonth: false,
    });
  }

  const weeks: DayCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** "YYYY-MM-DDTHH:mm" (datetime-local-kompatibel) <-> Date, in lokaler Zeit. */
function parseValue(value: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toValue(date: Date, hour: number, minute: number): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(hour)}:${pad(minute)}`;
}

const monthFormatter = new Intl.DateTimeFormat("de-DE", { month: "long" });
const displayFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function DateTimePicker({
  id,
  value,
  onChange,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const parsedValue = parseValue(value);
  const [viewDate, setViewDate] = useState(() => parsedValue ?? new Date());
  const [draftDate, setDraftDate] = useState<Date | null>(parsedValue);
  const [hour, setHour] = useState(parsedValue ? parsedValue.getHours() : 9);
  const [minute, setMinute] = useState(
    parsedValue ? parsedValue.getMinutes() : 0,
  );

  // Nur clientseitig portalen (SSR hat kein document.body-Ziel).
  useEffect(() => {
    setMounted(true);
  }, []);

  // Position relativ zum Viewport berechnen (nicht zum nächsten
  // positionierten/`overflow`-begrenzten Vorfahren) – dadurch entkommt
  // das Panel als Portal-Kind von `document.body` jedem `overflow-hidden`
  // auf dem Weg dorthin (z.B. der `<Card>`-Wrapper im zweispaltigen
  // Editor-Layout, in dem dieses Feld sitzt).
  function computePosition() {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const isMobile = window.innerWidth < 640;
    const width = isMobile
      ? window.innerWidth - VIEWPORT_MARGIN * 2
      : Math.min(PANEL_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2);

    let left = isMobile ? VIEWPORT_MARGIN : rect.left;
    left = Math.min(left, window.innerWidth - width - VIEWPORT_MARGIN);
    left = Math.max(left, VIEWPORT_MARGIN);

    const spaceBelow = window.innerHeight - rect.bottom;
    const estimatedHeight = 380;
    const openUpward =
      spaceBelow < estimatedHeight && rect.top > estimatedHeight;
    const top = openUpward
      ? Math.max(VIEWPORT_MARGIN, rect.top - estimatedHeight - 8)
      : rect.bottom + 8;

    setPosition({ top, left });
  }

  useEffect(() => {
    if (!open) return;
    computePosition();

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        !triggerRef.current?.contains(target) &&
        !panelRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    }
    function handleReflow() {
      computePosition();
    }
    function handleScroll(event: Event) {
      // Scrollt der Trigger selbst mit weg (z.B. Seiten-Scroll), Panel
      // schließen statt an falscher Position schweben zu lassen. Scroll
      // *innerhalb* des Panels (Kalender-Body) soll es offen lassen.
      if (panelRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("resize", handleReflow);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("resize", handleReflow);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [open]);

  function openPicker() {
    const current = parseValue(value);
    setDraftDate(current);
    setHour(current ? current.getHours() : 9);
    setMinute(current ? current.getMinutes() : 0);
    setViewDate(current ?? new Date());
    setOpen(true);
  }

  function applyPreset(getDate: () => Date) {
    const date = getDate();
    setDraftDate(date);
    setHour(date.getHours());
    setMinute(date.getMinutes());
    setViewDate(date);
  }

  function changeMonth(delta: number) {
    setViewDate(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1),
    );
  }

  function handleApply() {
    if (!draftDate) return;
    onChange(toValue(draftDate, hour, minute));
    setOpen(false);
  }

  function handleReset() {
    onChange("");
    setDraftDate(null);
    setOpen(false);
  }

  const weeks = buildMonthGrid(viewDate.getFullYear(), viewDate.getMonth());
  const today = new Date();

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        onClick={() => (open ? setOpen(false) : openPicker())}
        className={cn(
          "flex h-8 w-full items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 text-left text-sm outline-none transition-colors hover:border-ring/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          !parsedValue && "text-muted-foreground",
        )}
      >
        <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
        {parsedValue
          ? displayFormatter.format(parsedValue)
          : "Datum & Uhrzeit wählen"}
      </button>

      {mounted &&
        open &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              position: "fixed",
              top: position.top,
              left: position.left,
              width:
                typeof window !== "undefined" && window.innerWidth < 640
                  ? window.innerWidth - VIEWPORT_MARGIN * 2
                  : PANEL_WIDTH,
            }}
            className="z-[100] flex max-h-[90vh] flex-col overflow-auto rounded-2xl border bg-popover text-popover-foreground shadow-lg"
          >
            <div className="flex flex-col sm:flex-row">
              <div className="flex shrink-0 gap-1 overflow-x-auto border-b p-3 sm:w-32 sm:flex-col sm:overflow-visible sm:border-r sm:border-b-0">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => applyPreset(preset.getDate)}
                    className="shrink-0 rounded-lg px-2 py-1.5 text-left text-xs font-medium whitespace-nowrap text-muted-foreground hover:bg-muted sm:whitespace-normal"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="flex-1 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <button
                    type="button"
                    aria-label="Vorheriger Monat"
                    onClick={() => changeMonth(-1)}
                    className="flex size-7 items-center justify-center rounded-full border text-muted-foreground hover:bg-muted"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <p className="text-sm font-semibold">
                    <span className="capitalize">
                      {monthFormatter.format(viewDate)}
                    </span>{" "}
                    <span className="font-normal text-muted-foreground">
                      {viewDate.getFullYear()}
                    </span>
                  </p>
                  <button
                    type="button"
                    aria-label="Nächster Monat"
                    onClick={() => changeMonth(1)}
                    className="flex size-7 items-center justify-center rounded-full border text-muted-foreground hover:bg-muted"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-y-1 text-center">
                  {WEEKDAYS.map((day) => (
                    <span
                      key={day}
                      className="text-[0.7rem] font-medium text-muted-foreground"
                    >
                      {day}
                    </span>
                  ))}
                  {weeks.flatMap((week, weekIndex) =>
                    week.map((cell, dayIndex) => {
                      const isSelected =
                        draftDate && isSameDay(cell.date, draftDate);
                      const isToday = isSameDay(cell.date, today);
                      return (
                        <button
                          key={`${weekIndex}-${dayIndex}`}
                          type="button"
                          onClick={() => setDraftDate(cell.date)}
                          className={cn(
                            "mx-auto flex size-8 items-center justify-center rounded-full text-sm transition-colors",
                            !cell.inCurrentMonth && "text-muted-foreground/40",
                            cell.inCurrentMonth &&
                              !isSelected &&
                              "text-foreground hover:bg-muted",
                            isSelected &&
                              "bg-gradient-to-br from-orange-400 to-rose-500 font-semibold text-white",
                            !isSelected &&
                              isToday &&
                              "ring-1 ring-inset ring-ring",
                          )}
                        >
                          {cell.date.getDate()}
                        </button>
                      );
                    }),
                  )}
                </div>

                <div className="mt-3 flex items-center justify-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={pad(hour)}
                    onChange={(e) =>
                      setHour(
                        Math.min(23, Math.max(0, Number(e.target.value) || 0)),
                      )
                    }
                    className="h-8 w-14 rounded-lg border border-input bg-transparent text-center text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    aria-label="Stunde"
                  />
                  <span className="text-muted-foreground">:</span>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={pad(minute)}
                    onChange={(e) =>
                      setMinute(
                        Math.min(59, Math.max(0, Number(e.target.value) || 0)),
                      )
                    }
                    className="h-8 w-14 rounded-lg border border-input bg-transparent text-center text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    aria-label="Minute"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="min-w-0 truncate text-xs text-muted-foreground">
                {draftDate
                  ? displayFormatter.format(
                      new Date(
                        draftDate.getFullYear(),
                        draftDate.getMonth(),
                        draftDate.getDate(),
                        hour,
                        minute,
                      ),
                    )
                  : "Kein Zeitpunkt gewählt"}
              </p>
              <div className="flex shrink-0 gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="flex-1 sm:flex-none"
                  onClick={handleReset}
                >
                  Zurücksetzen
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={!draftDate}
                  onClick={handleApply}
                  className="flex-1 sm:flex-none"
                >
                  Übernehmen
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
