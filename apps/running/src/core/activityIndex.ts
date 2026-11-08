import { indexUrl, routeUrls } from 'virtual:activity-data';
import type { Activity } from './types';
import { createJsonResource } from './activityResource';
import { createActivityRouteLoader } from './activityRoutes';

const index = createJsonResource<Activity[]>(indexUrl, (value) => {
  if (!Array.isArray(value)) throw new Error('Invalid activity index');
  return value as Activity[];
});
export const getActivityIndex = () => index.read();
export const resetActivityIndex = () => index.reset();

const routes = createActivityRouteLoader(routeUrls);
export const loadActivityRoutes = routes.load;
export const resetActivityRoutes = routes.reset;
