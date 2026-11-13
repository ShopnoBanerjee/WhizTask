import { format } from 'date-fns'

// Helpers for <input type="date"> / <input type="datetime-local"> values.
// A bare "yyyy-MM-dd" compared against a timestamp column means midnight UTC,
// which cuts off most of the chosen day. These convert the day to explicit
// instants in the viewer's own timezone instead. Call them in the browser.

export function todayLocal(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function dayStartIso(day: string): string {
  return new Date(`${day}T00:00:00`).toISOString()
}

export function dayEndIso(day: string): string {
  return new Date(`${day}T23:59:59.999`).toISOString()
}

// ISO timestamp (or Date) -> value for <input type="datetime-local">
export function toDateTimeInput(value: string | Date): string {
  return format(new Date(value), "yyyy-MM-dd'T'HH:mm")
}
