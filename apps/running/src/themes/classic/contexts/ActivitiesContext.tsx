import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getActivityData } from '@/core/hooks/useActivities';
import type { Activity } from '../utils/utils';
import { COUNTRY_STANDARDIZATION } from '@/themes/classic/static/city';
import {
  DEFAULT_SELECTED_ACTIVITY_TYPES,
  filterActivitiesByTypes,
  getAvailableActivityTypes,
  normalizeActivityType,
  sanitizeSelectedActivityTypes,
  toggleActivityTypeSelection,
} from '@/utils/activity';
import { locationForRun, titleForRun } from '@/themes/classic/utils/utils';

const STORAGE_KEY = 'running_page_selected_activity_types';

const standardizeCountryName = (country: string): string => {
  for (const [pattern, standardName] of COUNTRY_STANDARDIZATION) {
    if (country.includes(pattern)) {
      return standardName;
    }
  }
  return country;
};

const getInitialSelectedTypes = (availableTypes: string[]): string[] => {
  const defaultTypes = DEFAULT_SELECTED_ACTIVITY_TYPES.filter((type) =>
    availableTypes.includes(type)
  );

  if (typeof window === 'undefined') {
    return defaultTypes.length > 0
      ? [...defaultTypes]
      : availableTypes.slice(0, 1);
  }

  try {
    const savedTypes = window.localStorage.getItem(STORAGE_KEY);
    if (!savedTypes) {
      return defaultTypes.length > 0
        ? [...defaultTypes]
        : availableTypes.slice(0, 1);
    }

    const parsedTypes = JSON.parse(savedTypes) as string[];
    const normalizedTypes = parsedTypes
      .map((type) => normalizeActivityType(type))
      .filter(
        (type, index, arr) =>
          availableTypes.includes(type) && arr.indexOf(type) === index
      );

    if (normalizedTypes.length > 0) {
      return sanitizeSelectedActivityTypes(normalizedTypes, availableTypes);
    }
  } catch {
    // Storage can be unavailable; retain the existing default selection.
  }

  return defaultTypes.length > 0
    ? [...defaultTypes]
    : availableTypes.slice(0, 1);
};

type ActivitiesContextValue = {
  activities: Activity[];
  availableTypes: string[];
  selectedTypes: string[];
  setSelectedTypes: (types: string[]) => void;
  toggleActivityType: (type: string) => void;
  years: string[];
  countries: string[];
  provinces: string[];
  cities: Record<string, number>;
  runPeriod: Record<string, number>;
  thisYear: string;
};

export const ActivitiesContext = createContext<ActivitiesContextValue | null>(
  null
);

export const ActivitiesProvider = ({ children }: { children: ReactNode }) => {
  const activities = getActivityData();
  const availableTypes = useMemo(
    () => getAvailableActivityTypes(activities),
    [activities]
  );
  const [selectedTypes, setSelectedTypesState] = useState<string[]>(() =>
    getInitialSelectedTypes(availableTypes)
  );

  const setSelectedTypes = useCallback(
    (types: string[]) => {
      const normalizedTypes = ACTIVITY_TYPE_ORDER_SAFE(types, availableTypes);
      setSelectedTypesState(
        normalizedTypes.length > 0
          ? normalizedTypes
          : getInitialSelectedTypes(availableTypes)
      );
    },
    [availableTypes]
  );

  const toggleActivityType = useCallback(
    (type: string) => {
      const normalizedType = normalizeActivityType(type);
      if (!availableTypes.includes(normalizedType)) {
        return;
      }

      setSelectedTypesState((currentSelectedTypes) =>
        ACTIVITY_TYPE_ORDER_SAFE(
          toggleActivityTypeSelection(currentSelectedTypes, normalizedType),
          availableTypes
        )
      );
    },
    [availableTypes]
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedTypes));
    } catch {
      /* Filtering still works without persistence. */
    }
  }, [selectedTypes]);

  const filteredActivities = useMemo(
    () => filterActivitiesByTypes(activities, selectedTypes),
    [activities, selectedTypes]
  );

  const processedData = useMemo(() => {
    const cities: Record<string, number> = {};
    const runPeriod: Record<string, number> = {};
    const provinces: Set<string> = new Set();
    const countries: Set<string> = new Set();
    const years: Set<string> = new Set();

    filteredActivities.forEach((run) => {
      const location = locationForRun(run);

      const periodName = titleForRun(run);
      if (periodName) {
        runPeriod[periodName] = runPeriod[periodName]
          ? runPeriod[periodName] + 1
          : 1;
      }

      const { city, province, country } = location;
      if (city.length > 1) {
        cities[city] = cities[city]
          ? cities[city] + run.distance
          : run.distance;
      }
      if (province) provinces.add(province);
      if (country) countries.add(standardizeCountryName(country));
      const year = run.start_date_local.slice(0, 4);
      years.add(year);
    });

    const yearsArray = [...years].sort().reverse();
    const thisYear = yearsArray[0] || '';

    return {
      activities: filteredActivities,
      years: yearsArray,
      countries: [...countries],
      provinces: [...provinces],
      cities,
      runPeriod,
      thisYear,
    };
  }, [filteredActivities]);

  const value = useMemo(
    () => ({
      ...processedData,
      availableTypes,
      selectedTypes,
      setSelectedTypes,
      toggleActivityType,
    }),
    [
      availableTypes,
      processedData,
      selectedTypes,
      setSelectedTypes,
      toggleActivityType,
    ]
  );

  return (
    <ActivitiesContext.Provider value={value}>
      {children}
    </ActivitiesContext.Provider>
  );
};

const ACTIVITY_TYPE_ORDER_SAFE = (
  types: string[],
  availableTypes: string[]
): string[] => {
  const uniqueTypes = [
    ...new Set(
      types.map((type) => normalizeActivityType(type)).filter(Boolean)
    ),
  ];
  return sanitizeSelectedActivityTypes(uniqueTypes, availableTypes);
};
