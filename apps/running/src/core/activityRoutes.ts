import { createJsonResource } from './activityResource';

export type RouteActivity = {
  run_id: number;
  start_date_local: string;
  summary_polyline?: string | null;
  has_route?: boolean;
};
type Routes = Record<string, string>;

export function createActivityRouteLoader(
  urls: Record<string, string>,
  request: typeof fetch = (...args) => fetch(...args)
) {
  const resources = new Map<
    string,
    ReturnType<typeof createJsonResource<Routes>>
  >();
  function resource(year: string) {
    let result = resources.get(year);
    if (!result) {
      if (!urls[year]) throw new Error(`缺少 ${year} 年的路线数据`);
      result = createJsonResource<Routes>(
        urls[year],
        (value) => {
          if (
            !value ||
            typeof value !== 'object' ||
            Array.isArray(value) ||
            !Object.values(value).every((line) => typeof line === 'string')
          )
            throw new Error('Invalid route data');
          return value as Routes;
        },
        request
      );
      resources.set(year, result);
    }
    return result;
  }
  return {
    async load<T extends RouteActivity>(activities: T[]): Promise<T[]> {
      const years = [
        ...new Set(
          activities
            .filter((a) => a.has_route)
            .map((a) => a.start_date_local.slice(0, 4))
        ),
      ];
      const loaded = new Map(
        await Promise.all(
          years.map(
            async (year) => [year, await resource(year).load()] as const
          )
        )
      );
      return activities.map((activity) => {
        if (!activity.has_route) return activity;
        const line = loaded.get(activity.start_date_local.slice(0, 4))?.[
          activity.run_id
        ];
        if (!line) throw new Error(`路线数据缺少活动 ${activity.run_id}`);
        return { ...activity, summary_polyline: line };
      });
    },
    reset() {
      for (const value of resources.values()) value.reset();
    },
  };
}
