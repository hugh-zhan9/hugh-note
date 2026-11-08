import { useEffect, useState } from 'react';
import { loadActivityRoutes, resetActivityRoutes } from '../activityIndex';

import type { RouteActivity } from '../activityRoutes';

export function useRouteActivities<T extends RouteActivity>(activities: T[]) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    input: T[];
    attempt: number;
    data?: T[];
    error?: string;
  }>();
  useEffect(() => {
    let current = true;
    loadActivityRoutes(activities).then(
      (data) => {
        if (current) setState({ input: activities, attempt, data });
      },
      (error: unknown) => {
        if (current)
          setState({
            input: activities,
            attempt,
            error: error instanceof Error ? error.message : String(error),
          });
      }
    );
    return () => {
      current = false;
    };
  }, [activities, attempt]);
  const matched = state?.input === activities && state.attempt === attempt;
  return {
    activities: matched && state.data ? state.data : activities,
    pending: !matched || (!state.data && !state.error),
    error: matched ? state.error : undefined,
    retry() {
      resetActivityRoutes();
      setAttempt((value) => value + 1);
    },
  };
}
