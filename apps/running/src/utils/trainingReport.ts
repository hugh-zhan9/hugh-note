import type { TrainingSummary } from './trainingSummary';
import { shiftTrainingDate } from './trainingSummary';
import {
  parseEncryptedReport,
  type EncryptedTrainingReport,
} from './trainingCrypto';

export interface TrainingDay {
  day: number;
  kind: 'run' | 'rest';
  title: string;
  minutes: number;
  intensity: string;
  purpose: string;
}
export interface TrainingAdvice {
  overview: string;
  observations: string[];
  days: TrainingDay[];
  adjustments: string[];
  limitations: string[];
}
export interface PrivateTrainingAdvice {
  sections: { heading: string; body: string }[];
}
interface ReportBase {
  version: 1;
  generatedAt: string;
  summary: TrainingSummary;
}
export type TrainingReport = ReportBase &
  (
    | { status: 'disabled' | 'insufficient-data' }
    | {
        status: 'ready';
        reportId: string;
        planFrom: string;
        planThrough: string;
        advice: TrainingAdvice;
        privateReport: EncryptedTrainingReport;
      }
  );

function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).sort().join(',') !== [...keys].sort().join(',')
  )
    throw new Error('Invalid training report structure');
  return value as Record<string, unknown>;
}
function text(value: unknown, max = 1200): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw new Error('Invalid training report text');
  return value;
}
function texts(value: unknown): string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 6)
    throw new Error('Invalid training report list');
  return value.map((item) => text(item));
}
export function parseTrainingAdvice(value: unknown): TrainingAdvice {
  const v = object(value, [
    'overview',
    'observations',
    'days',
    'adjustments',
    'limitations',
  ]);
  if (!Array.isArray(v.days) || v.days.length !== 7)
    throw new Error('Training plan must contain seven days');
  const days = v.days.map((item, index): TrainingDay => {
    const day = object(item, [
      'day',
      'kind',
      'title',
      'minutes',
      'intensity',
      'purpose',
    ]);
    if (
      day.day !== index + 1 ||
      (day.kind !== 'run' && day.kind !== 'rest') ||
      typeof day.minutes !== 'number' ||
      !Number.isInteger(day.minutes) ||
      day.minutes < 0 ||
      day.minutes > 180 ||
      (day.kind === 'rest' ? day.minutes !== 0 : day.minutes < 5)
    )
      throw new Error('Invalid training day');
    return {
      day: day.day as number,
      kind: day.kind as TrainingDay['kind'],
      title: text(day.title, 80),
      minutes: day.minutes,
      intensity: text(day.intensity, 200),
      purpose: text(day.purpose, 400),
    };
  });
  if (days.filter((day) => day.kind === 'run').length > 5)
    throw new Error('Training plan exceeds available days');
  return {
    overview: text(v.overview),
    observations: texts(v.observations),
    days,
    adjustments: texts(v.adjustments),
    limitations: texts(v.limitations),
  };
}
export function parsePrivateAdvice(value: unknown): PrivateTrainingAdvice {
  const v = object(value, ['sections']);
  if (
    !Array.isArray(v.sections) ||
    v.sections.length < 1 ||
    v.sections.length > 6
  )
    throw new Error('Invalid private report sections');
  return {
    sections: v.sections.map((item) => {
      const section = object(item, ['heading', 'body']);
      return {
        heading: text(section.heading, 100),
        body: text(section.body, 4000),
      };
    }),
  };
}

export function parseTrainingReport(value: unknown): TrainingReport {
  if (!value || typeof value !== 'object')
    throw new Error('Invalid training report');
  const v = value as TrainingReport;
  if (
    v.version !== 1 ||
    !['disabled', 'insufficient-data', 'ready'].includes(v.status) ||
    typeof v.generatedAt !== 'string' ||
    !Number.isFinite(Date.parse(v.generatedAt)) ||
    !v.summary
  )
    throw new Error('Invalid training report');
  shiftTrainingDate(v.summary.asOf, 0);
  if (
    !Array.isArray(v.summary.weeks) ||
    v.summary.weeks.length !== 8 ||
    !Array.isArray(v.summary.recentRuns)
  )
    throw new Error('Invalid training summary');
  for (const p of [v.summary.current, v.summary.previous, ...v.summary.weeks]) {
    if (
      !p ||
      ![
        'runs',
        'runningDays',
        'distanceKm',
        'durationMinutes',
        'longestRunKm',
        'heartRateRuns',
      ].every((key) => {
        const n = p[key as keyof typeof p];
        return typeof n === 'number' && Number.isFinite(n) && n >= 0;
      })
    )
      throw new Error('Invalid training summary');
    for (const n of [p.paceSecondsPerKm, p.averageHeartRate])
      if (n !== null && (typeof n !== 'number' || !Number.isFinite(n) || n < 0))
        throw new Error('Invalid training summary');
    shiftTrainingDate(p.from, 0);
    shiftTrainingDate(p.through, 0);
  }
  if (v.status === 'ready') {
    if (
      typeof v.reportId !== 'string' ||
      !/^[a-f0-9]{64}$/.test(v.reportId) ||
      v.planFrom !== shiftTrainingDate(v.summary.asOf, 1) ||
      v.planThrough !== shiftTrainingDate(v.summary.asOf, 7)
    )
      throw new Error('Invalid training report identity');
    parseTrainingAdvice(v.advice);
    parseEncryptedReport(v.privateReport);
  }
  return v;
}
