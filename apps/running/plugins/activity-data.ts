import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import type { Plugin } from 'vite';
import {
  applyActivityPresentationRules,
  normalizeActivityType,
} from '../src/utils/activity';
import type { Activity } from '../src/core/types';
import { getSummaryYears } from '../src/utils/yearSummary';

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
  let snapshot: ReturnType<typeof read> | undefined;
  const read = async () =>
    splitActivityData(JSON.parse(await readFile(sourcePath, 'utf8')));
  const data = () => (snapshot ??= read());
  const virtualId = 'virtual:activity-data';
  return {
    name: 'site-activity-data',
    buildStart() {
      snapshot = undefined;
    },
    resolveId(id) {
      if (id === virtualId) return '\0' + virtualId;
    },
    async load(id) {
      if (id !== '\0' + virtualId) return;
      const result = await data();
      return `export const indexUrl=${JSON.stringify('/running/' + result.index.fileName)}; export const routeUrls=${JSON.stringify(Object.fromEntries(Object.entries(result.routes).map(([year, asset]) => [year, '/running/' + asset.fileName])))}; export const summaryYears=${JSON.stringify(result.summaryYears)};`;
    },
    async transformIndexHtml() {
      const result = await data();
      return [
        {
          tag: 'link',
          attrs: {
            rel: 'preload',
            as: 'fetch',
            href: '/running/' + result.index.fileName,
            crossorigin: 'anonymous',
          },
          injectTo: 'head',
        },
      ];
    },
    handleHotUpdate(ctx) {
      if (ctx.file === sourcePath) {
        snapshot = undefined;
        ctx.server.ws.send({ type: 'full-reload' });
      }
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = req.url?.split('?')[0];
        if (
          !pathname?.startsWith('/running/data/') &&
          !pathname?.startsWith('/data/')
        )
          return next();
        try {
          const result = await data();
          const name = pathname.replace(/^\/(?:running\/)?/, '');
          const asset =
            name === 'data/activities.json'
              ? { source: result.full }
              : [result.index, ...Object.values(result.routes)].find(
                  (asset) => asset.fileName === name
                );
          if (!asset) return next();
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Cache-Control', 'no-cache');
          res.end(asset.source);
        } catch (error) {
          server.config.logger.error(String(error));
          res.statusCode = 500;
          res.end('Activity data export failed');
        }
      });
    },
    async generateBundle() {
      const result = await data();
      this.emitFile({
        type: 'asset',
        fileName: 'data/activities.json',
        source: result.full,
      });
      for (const asset of [result.index, ...Object.values(result.routes)])
        this.emitFile({ type: 'asset', ...asset });
    },
  };
}

export function splitActivityData(input: unknown) {
  const activities = projectActivities(input);
  const asset = (name: string, value: unknown) => {
    const source = JSON.stringify(value);
    const hash = createHash('sha256').update(source).digest('hex').slice(0, 16);
    return { fileName: `data/${name}.${hash}.json`, source };
  };
  const routes: Record<string, Record<string, string>> = {};
  const index = activities.map((activity) => {
    if (activity.summary_polyline) {
      const year = activity.start_date_local.slice(0, 4);
      (routes[year] ??= {})[activity.run_id] = activity.summary_polyline;
    }
    return {
      ...activity,
      summary_polyline: null,
      has_route: Boolean(activity.summary_polyline),
    };
  });
  return {
    summaryYears: getSummaryYears(activities),
    full: JSON.stringify(activities),
    index: asset('activity-index', index),
    routes: Object.fromEntries(
      Object.entries(routes).map(([year, lines]) => [
        year,
        asset('routes-' + year, lines),
      ])
    ),
  };
}
