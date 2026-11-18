import { DEPARTMENTS, type Department } from '@/types/database'

// Tasks have no title field: they are a client, a department and free-text
// details. Using the client as the card heading made every card for the same
// client read identically, so the heading is taken from the details instead.

const MAX_TITLE_LENGTH = 70

interface TitledTask {
  details: string | null
  department: Department
}

function firstLine(details: string | null): string {
  return (details ?? '').split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? ''
}

// The first line of the details, shortened at a word boundary. Falls back to
// the department ("Design task") when no details were written.
export function taskTitle(task: TitledTask): string {
  const line = firstLine(task.details)
  if (!line) {
    const department = DEPARTMENTS.find((d) => d.value === task.department)?.label ?? task.department
    return `${department} task`
  }
  if (line.length <= MAX_TITLE_LENGTH) return line

  const cut = line.slice(0, MAX_TITLE_LENGTH)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

// True when the details say more than the heading already shows, so the card
// should print them underneath rather than repeat the same sentence.
export function hasMoreDetails(task: TitledTask): boolean {
  const all = (task.details ?? '').trim()
  const line = firstLine(task.details)
  return all !== line || line.length > MAX_TITLE_LENGTH
}
