import { JobItem } from './utils'

export function saveJobs(jobs: JobItem[]) {
  localStorage.setItem('jobs', JSON.stringify(jobs))
}

export function makeICS(job: JobItem) {
  const [hh, mm] = (job.time||'09:00').split(':').map(x=>parseInt(x))
  const dt = new Date()
  dt.setHours(hh||9, mm||0, 0, 0)
  const DTSTART = dt.toISOString().replace(/[-:]/g,'').split('.')[0] + 'Z'
  let rule = 'FREQ=DAILY'
  if (job.frequency==='weekly') rule = 'FREQ=WEEKLY'
  if (job.frequency==='monthly') rule = 'FREQ=MONTHLY'
  return `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:${DTSTART}
RRULE:${rule}
SUMMARY:${job.name}
END:VEVENT
END:VCALENDAR`
}
