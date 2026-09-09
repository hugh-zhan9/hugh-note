const ACTIVITY_TYPE_MAP: Record<string, string> = {
  Run: 'running',
  running: 'running',
  VirtualRun: 'running',
  virtualrun: 'running',
  Walk: 'walking',
  walking: 'walking',
  Ride: 'cycling',
  cycling: 'cycling',
  Hike: 'hiking',
  Hiking: 'hiking',
  hiking: 'hiking',
  Swim: 'swimming',
  swimming: 'swimming',
  Ski: 'skiing',
  skiing: 'skiing',
};

export const DEFAULT_SELECTED_ACTIVITY_TYPES = ['running'] as const;
export const ACTIVITY_TYPE_ORDER = [
  'running',
  'cycling',
  'walking',
  'hiking',
  'swimming',
  'skiing',
] as const;

export interface ActivityLike {
  run_id: number;
  name: string;
  type: string;
  subtype?: string | null;
  start_date: string;
  start_date_local: string;
  distance: number;
  moving_time: string;
  average_speed: number;
  elevation_gain: number | null;
  streak: number;
}

const MORNING_RUN_OVERRIDE = {
  startDateLocal: '2026-03-13 08:13:15',
  name: '清晨跑步',
  type: 'Run',
  subtype: 'Run',
};

export const normalizeActivityType = (type?: string | null): string => {
  if (!type) return '';
  return ACTIVITY_TYPE_MAP[type] ?? type;
};

export const shouldUseRunTitles = (type?: string | null): boolean => {
  return normalizeActivityType(type) === 'running';
};

export const getActivityLabel = (
  type: string | null | undefined,
  fallbackLabel: string,
  runLabel: string
): string => {
  return shouldUseRunTitles(type) ? runLabel : fallbackLabel;
};

export const applyActivityPresentationRules = <T extends ActivityLike>(
  activities: T[]
): T[] => {
  return activities.map((activity) => {
    if (activity.start_date_local === MORNING_RUN_OVERRIDE.startDateLocal) {
      return {
        ...activity,
        name: MORNING_RUN_OVERRIDE.name,
        type: MORNING_RUN_OVERRIDE.type,
        subtype: MORNING_RUN_OVERRIDE.subtype,
      };
    }
    return activity;
  });
};

export const filterActivitiesByTypes = <T extends ActivityLike>(
  activities: T[],
  selectedTypes: string[]
): T[] => {
  const typeSet = new Set(selectedTypes.map(normalizeActivityType));
  return activities.filter((activity) =>
    typeSet.has(normalizeActivityType(activity.type))
  );
};

export const getAvailableActivityTypes = <T extends ActivityLike>(
  activities: T[]
): string[] => {
  const availableTypes = new Set(
    activities
      .map((activity) => normalizeActivityType(activity.type))
      .filter(Boolean)
  );

  return ACTIVITY_TYPE_ORDER.filter((type) => availableTypes.has(type));
};

export const toggleActivityTypeSelection = (
  selectedTypes: string[],
  type: string
): string[] => {
  const normalizedType = normalizeActivityType(type);
  if (!normalizedType) return selectedTypes;

  if (selectedTypes.includes(normalizedType)) {
    return selectedTypes.length === 1
      ? selectedTypes
      : selectedTypes.filter((selectedType) => selectedType !== normalizedType);
  }

  const nextSelectedTypes = [...selectedTypes, normalizedType];
  return ACTIVITY_TYPE_ORDER.filter((activityType) =>
    nextSelectedTypes.includes(activityType)
  );
};

export const sanitizeSelectedActivityTypes = (
  requestedTypes: string[],
  availableTypes: string[]
): string[] => {
  const normalizedRequestedTypes = ACTIVITY_TYPE_ORDER.filter((type) =>
    requestedTypes.map(normalizeActivityType).includes(type)
  ).filter((type) => availableTypes.includes(type));

  if (
    availableTypes.includes(DEFAULT_SELECTED_ACTIVITY_TYPES[0]) &&
    !normalizedRequestedTypes.includes(DEFAULT_SELECTED_ACTIVITY_TYPES[0])
  ) {
    return [
      DEFAULT_SELECTED_ACTIVITY_TYPES[0],
      ...normalizedRequestedTypes.filter(
        (type) => type !== DEFAULT_SELECTED_ACTIVITY_TYPES[0]
      ),
    ];
  }

  return normalizedRequestedTypes;
};

export const shouldReplayMapAnimation = ({
  previousSelectedTypesKey,
  nextSelectedTypesKey,
  isSingleRunMode,
}: {
  previousSelectedTypesKey: string;
  nextSelectedTypesKey: string;
  isSingleRunMode: boolean;
}): boolean => {
  if (isSingleRunMode) {
    return false;
  }

  return previousSelectedTypesKey === nextSelectedTypesKey;
};
