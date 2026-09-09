import type { Activity } from '@/core/types';

// Dashboard's existing filters, charts and map expressions use these display tags.
// Keep this vocabulary at its boundary; the shared export and cache stay canonical.
const displayTypes: Record<string, string> = {
  running: 'Run',
  cycling: 'Ride',
  walking: 'Walk',
  hiking: 'Hike',
  swimming: 'Swim',
  skiing: 'Ski',
};
export function dashboardActivities(activities: Activity[]): Activity[] {
  return activities.map((activity) => ({
    ...activity,
    type: displayTypes[activity.type] ?? activity.type,
  }));
}
