import { readFile } from 'node:fs/promises';
import type { Plugin } from 'vite';
import {
  applyActivityPresentationRules,
  normalizeActivityType,
} from '../src/utils/activity';
import type { Activity } from '../src/core/types';

// This is a read-only projection. Never write corrections back to the sync data.
export function projectActivities(input: unknown): Activity[] {
  if (!Array.isArray(input)) throw new Error('Activities must be an array');
  const ids = new Set<number>();
  for (const [index, activity] of input.entries()) {
    const invalid = () => new Error(`Invalid activity at index ${index}`);
    if (!activity || typeof activity !== 'object') throw invalid();
    if (!Number.isInteger(activity.run_id) || ids.has(activity.run_id))
      throw invalid();
    ids.add(activity.run_id);
    for (const key of [
      'name',
      'type',
      'moving_time',
      'start_date',
      'start_date_local',
    ]) {
      if (typeof activity[key] !== 'string') throw invalid();
    }
    if (!/^\d+:[0-5]\d:[0-5]\d(?:\.\d+)?$/.test(activity.moving_time))
      throw invalid();
    if (
      !activity.type ||
      Number.isNaN(Date.parse(activity.start_date_local)) ||
      Number.isNaN(Date.parse(activity.start_date))
    )
      throw invalid();
    for (const key of ['distance', 'average_speed', 'streak']) {
      if (!Number.isFinite(activity[key]) || activity[key] < 0) throw invalid();
    }
    if (
      activity.elevation_gain !== null &&
      !Number.isFinite(activity.elevation_gain)
    )
      throw invalid();
    for (const key of ['summary_polyline', 'location_country']) {
      if (activity[key] != null && typeof activity[key] !== 'string')
        throw invalid();
    }
  }
  return applyActivityPresentationRules(input as Activity[]).map(
    (activity) => ({
      ...activity,
      type: normalizeActivityType(activity.type),
    })
  );
}

export function activityDataPlugin(sourcePath: string): Plugin {
  const read = async () =>
    JSON.stringify(
      projectActivities(JSON.parse(await readFile(sourcePath, 'utf8')))
    );
  return {
    name: 'site-activity-data',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = req.url?.split('?')[0];
        if (
          pathname !== '/running/data/activities.json' &&
          pathname !== '/data/activities.json'
        )
          return next();
        try {
          const data = await read();
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Cache-Control', 'no-cache');
          res.end(data);
        } catch (error) {
          server.config.logger.error(String(error));
          res.statusCode = 500;
          res.end('Activity data export failed');
        }
      });
    },
    async generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'data/activities.json',
        source: await read(),
      });
    },
  };
}
