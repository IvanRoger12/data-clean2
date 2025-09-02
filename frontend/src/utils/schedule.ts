import { Job, JobRun } from './types';

const JOBS_KEY = 'dataclean_jobs';
const RUNS_KEY = 'dataclean_runs';

export function loadJobs(): Job[] {
  return JSON.parse(localStorage.getItem(JOBS_KEY) || '[]');
}
export function saveJobs(jobs: Job[]) {
  localStorage.setItem(JOBS_KEY, JSON.stringify(jobs));
}
export function loadRuns(): JobRun[] {
  return JSON.parse(localStorage.getItem(RUNS_KEY) || '[]');
}
export function saveRuns(runs: JobRun[]) {
  localStorage.setItem(RUNS_KEY, JSON.stringify(runs));
}

export function createJob(job: Omit<Job, 'id'|'status'|'nextRunISO'>): Job {
  const id = `job_${Date.now()}`;
  const nextRunISO = computeNextRunISO(job.frequency, job.time);
  const full: Job = { ...job, id, nextRunISO, status: 'pending' };
  const jobs = loadJobs(); jobs.push(full); saveJobs(jobs);
  return full;
}

export function computeNextRunISO(freq: Job['frequency'], timeHHMM: string): string {
  const [h,m] = timeHHMM.split(':').map(Number);
  const d = new Date(); d.setHours(h || 9, m || 0, 0, 0);
  if (d < new Date()) d.setDate(d.getDate() + 1);
  return d.toISOString();
}

export function exportICS(job: Job): string {
  const dt = job.nextRunISO.replace(/[-:]/g,'').split('.')[0] + 'Z';
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//DataClean AI//EN',
    'BEGIN:VEVENT',
    `UID:${job.id}@dataclean`,
    `DTSTAMP:${dt}`,
    `DTSTART:${dt}`,
    `SUMMARY:DataClean Job - ${job.name}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
}

export function dryRunJob(job: Job): JobRun {
  const run: JobRun = {
    id: `run_${Date.now()}`,
    jobId: job.id,
    startedAt: new Date().toISOString(),
    status: 'running'
  };
  const runs = loadRuns(); runs.unshift(run); saveRuns(runs);
  // Finir en "completed" (MVP)
  setTimeout(() => {
    run.status = 'completed';
    run.finishedAt = new Date().toISOString();
    run.resultNote = 'Dry-run simulé (MVP)';
    saveRuns([...runs]);
  }, 800);
  return run;
}
