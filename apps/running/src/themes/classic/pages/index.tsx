import {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
  useSyncExternalStore,
} from 'react';
import { Analytics } from '@vercel/analytics/react';
import { Helmet } from 'react-helmet-async';
import Layout from '@/themes/classic/components/Layout';
import LocationStat from '@/themes/classic/components/LocationStat';
import RunMap from '@/themes/classic/components/RunMap';
import RunTable from '@/themes/classic/components/RunTable';
import SVGStat from '@/themes/classic/components/SVGStat';
import YearsStat from '@/themes/classic/components/YearsStat';
import ActivityTypeFilter from '@/themes/classic/components/ActivityTypeFilter';
import useActivities from '@/themes/classic/hooks/useActivities';
import getSiteMetadata from '@/hooks/useSiteMetadata';
import { useInterval } from '@/hooks/useInterval';
import { IS_CHINESE } from '@/themes/classic/utils/const';
import {
  Activity,
  filterAndSortRuns,
  filterCityRuns,
  filterTitleRuns,
  filterYearRuns,
  scrollToMap,
  sortDateFunc,
  titleForShow,
  RunIds,
} from '../utils/utils';
import { geoJsonForRuns, type IViewState } from '../utils/geoUtils';
import { useThemeChangeCounter } from '../hooks/useTheme';

import { shouldReplayMapAnimation } from '@/utils/activity';
import {
  getViewportForGeoData,
  shouldApplyPendingAutoFit,
  shouldAutoFitToBounds,
} from '../utils/map';

const HASH_RUN_CHANGE_EVENT = 'running-page-hash-run-change';

const getRunIdFromHash = () => {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash.replace('#', '');
  if (!hash.startsWith('run_')) return null;
  const runId = parseInt(hash.replace('run_', ''), 10);
  return Number.isNaN(runId) ? null : runId;
};

const subscribeToRunHash = (onStoreChange: () => void) => {
  window.addEventListener('hashchange', onStoreChange);
  window.addEventListener(HASH_RUN_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener('hashchange', onStoreChange);
    window.removeEventListener(HASH_RUN_CHANGE_EVENT, onStoreChange);
  };
};

const notifyRunHashChange = () => {
  window.dispatchEvent(new Event(HASH_RUN_CHANGE_EVENT));
};

const clearRunHash = () => {
  if (window.location.hash) {
    window.history.pushState(
      null,
      '',
      `${window.location.pathname}${window.location.search}`
    );
    notifyRunHashChange();
  }
};

const setRunHash = (runId: number) => {
  const newHash = `#run_${runId}`;
  if (window.location.hash !== newHash) {
    window.history.pushState(null, '', newHash);
    notifyRunHashChange();
  }
};

const useRunHashId = () =>
  useSyncExternalStore(subscribeToRunHash, getRunIdFromHash, () => null);

const Index = () => {
  const { siteTitle, siteUrl } = getSiteMetadata();
  const { activities, selectedTypes, thisYear } = useActivities();
  const themeChangeCounter = useThemeChangeCounter();
  const [year, setYear] = useState(thisYear);
  const [runIndex, setRunIndex] = useState(-1);
  const [title, setTitle] = useState('');
  // Animation states for replacing intervalIdRef
  const [isAnimating, setIsAnimating] = useState(false);
  const [currentAnimationIndex, setCurrentAnimationIndex] = useState(0);
  const [animationRuns, setAnimationRuns] = useState<Activity[]>([]);
  const [currentFilter, setCurrentFilter] = useState<{
    item: string;
    scope: string;
    func: (_run: Activity, _value: string) => boolean;
  }>({ item: thisYear, scope: `Year:${thisYear}`, func: filterYearRuns });

  // Track if we're showing a single run from URL hash
  const singleRunId = useRunHashId();

  // Animation trigger for single runs - increment this to force animation replay
  const [animationTrigger, setAnimationTrigger] = useState(0);

  const selectedRunIdRef = useRef<number | null>(null);
  const selectedRunDateRef = useRef<string | null>(null);
  const previousSelectedTypesKeyRef = useRef(selectedTypes.join('-'));
  const previousScopeKeyRef = useRef(
    `Year:${thisYear}|${selectedTypes.join('-')}`
  );
  const [pendingAutoFitScopeKey, setPendingAutoFitScopeKey] = useState<
    string | null
  >(null);

  // Memoize expensive calculations
  const runs = useMemo(() => {
    return filterAndSortRuns(
      activities,
      currentFilter.item,
      currentFilter.func,
      sortDateFunc
    );
  }, [activities, currentFilter.item, currentFilter.func]);

  const geoData = useMemo(() => {
    void themeChangeCounter;
    return geoJsonForRuns(runs);
  }, [runs, themeChangeCounter]);

  // for auto zoom
  const bounds = useMemo(() => {
    return getViewportForGeoData(geoData);
  }, [geoData]);

  const [viewState, setViewState] = useState<IViewState>(() => ({
    ...bounds,
  }));

  // Add state for animated geoData to handle the animation effect
  const [animatedGeoData, setAnimatedGeoData] = useState(geoData);

  // Use useInterval for animation instead of intervalIdRef
  useInterval(
    () => {
      if (!isAnimating || currentAnimationIndex >= animationRuns.length) {
        setIsAnimating(false);
        setAnimatedGeoData(geoData);
        return;
      }

      const runsNum = animationRuns.length;
      const sliceNum = runsNum >= 8 ? Math.ceil(runsNum / 8) : 1;
      const nextIndex = Math.min(currentAnimationIndex + sliceNum, runsNum);
      const tempRuns = animationRuns.slice(0, nextIndex);
      setAnimatedGeoData(geoJsonForRuns(tempRuns));
      setCurrentAnimationIndex(nextIndex);

      if (nextIndex >= runsNum) {
        setIsAnimating(false);
        setAnimatedGeoData(geoData);
      }
    },
    isAnimating ? 300 : null
  );

  // Helper function to start animation
  const startAnimation = useCallback(
    (runsToAnimate: Activity[]) => {
      if (runsToAnimate.length === 0) {
        setAnimatedGeoData(geoData);
        return;
      }

      const sliceNum =
        runsToAnimate.length >= 8 ? Math.ceil(runsToAnimate.length / 8) : 1;
      setAnimationRuns(runsToAnimate);
      setCurrentAnimationIndex(sliceNum);
      setIsAnimating(true);
    },
    [geoData]
  );

  const changeByItem = useCallback(
    (
      item: string,
      name: string,
      func: (_run: Activity, _value: string) => boolean
    ) => {
      scrollToMap();
      if (name != 'Year') {
        setYear(thisYear);
      }
      setCurrentFilter({ item, scope: `${name}:${item}`, func });
      setRunIndex(-1);
      setTitle(`${item} ${name} Running Heatmap`);
      // Reset single run state when changing filters
      clearRunHash();
    },
    [thisYear]
  );

  const changeYear = useCallback(
    (y: string) => {
      setYear(y);
      changeByItem(y, 'Year', filterYearRuns);
      setIsAnimating(false);
    },
    [changeByItem]
  );

  const changeCity = useCallback(
    (city: string) => {
      changeByItem(city, 'City', filterCityRuns);
    },
    [changeByItem]
  );

  const changeTitle = useCallback(
    (title: string) => {
      changeByItem(title, 'Title', filterTitleRuns);
    },
    [changeByItem]
  );

  const locateActivity = useCallback(
    (runIds: RunIds) => {
      const ids = new Set(runIds);

      const selectedRuns = !runIds.length
        ? runs
        : runs.filter((run: Activity) => ids.has(run.run_id));

      if (!selectedRuns.length) {
        return;
      }

      const lastRun = selectedRuns.slice().sort(sortDateFunc)[0];

      if (!lastRun) {
        return;
      }

      // Set runIndex for table highlighting when single run is selected
      if (runIds.length === 1) {
        const runId = runIds[0];
        const runIdx = runs.findIndex((run) => run.run_id === runId);
        setRunIndex(runIdx);
      } else {
        setRunIndex(-1);
      }

      // Update URL hash when a single run is located
      if (runIds.length === 1) {
        const runId = runIds[0];
        setRunHash(runId);
      } else {
        // If multiple runs or no runs, clear the hash and single run state
        clearRunHash();
      }

      // Create geoData for selected runs and calculate new bounds
      const selectedGeoData = geoJsonForRuns(selectedRuns);
      const selectedBounds = getViewportForGeoData(selectedGeoData);

      // Stop any existing animation
      setIsAnimating(false);

      // Update the animated geoData immediately to trigger RunMap animation
      setAnimatedGeoData(selectedGeoData);

      // For single run, trigger animation by incrementing the trigger
      if (runIds.length === 1) {
        setAnimationTrigger((prev) => prev + 1);
      }

      // Update view state
      setViewState({
        ...selectedBounds,
      });
      setTitle(titleForShow(lastRun));
      scrollToMap();
    },
    [runs]
  );

  // Auto locate activity when singleRunId is set and activities are loaded
  // First, detect the run's year and switch to it if needed
  useEffect(() => {
    if (singleRunId !== null && activities.length > 0) {
      const frameId = requestAnimationFrame(() => {
        const targetRun = activities.find((run) => run.run_id === singleRunId);
        if (targetRun) {
          const runYear = targetRun.start_date_local.slice(0, 4);
          if (year !== runYear) {
            setYear(runYear);
            setCurrentFilter({
              item: runYear,
              scope: `Year:${runYear}`,
              func: filterYearRuns,
            });
          }
        } else {
          // If run doesn't exist, clear the hash and show a warning
          console.warn(`Run with ID ${singleRunId} not found in activities`);
          window.history.replaceState(null, '', window.location.pathname);
          notifyRunHashChange();
        }
      });
      return () => cancelAnimationFrame(frameId);
    }
  }, [singleRunId, activities, year]);

  useEffect(() => {
    if (singleRunId !== null && runs.length > 0) {
      const frameId = requestAnimationFrame(() => {
        const runExistsInCurrentRuns = runs.some(
          (run) => run.run_id === singleRunId
        );
        if (runExistsInCurrentRuns) {
          locateActivity([singleRunId]);
        }
      });
      return () => cancelAnimationFrame(frameId);
    }
  }, [runs, singleRunId, locateActivity]);

  // Auto-fit to the full dataset of the current scope when scope changes.
  useEffect(() => {
    const scopeKey = `${currentFilter.scope}|${selectedTypes.join('-')}`;
    const shouldAutoFit = shouldAutoFitToBounds({
      previousScopeKey: previousScopeKeyRef.current,
      nextScopeKey: scopeKey,
      singleRunId,
    });

    previousScopeKeyRef.current = scopeKey;

    if (shouldAutoFit) {
      setPendingAutoFitScopeKey(scopeKey);
    }
  }, [currentFilter.scope, selectedTypes, singleRunId]);

  useEffect(() => {
    const scopeKey = `${currentFilter.scope}|${selectedTypes.join('-')}`;
    if (
      shouldApplyPendingAutoFit({
        pendingScopeKey: pendingAutoFitScopeKey,
        currentScopeKey: scopeKey,
        singleRunId,
      })
    ) {
      setViewState(bounds);
      setPendingAutoFitScopeKey(null);
    }
  }, [
    bounds,
    currentFilter.scope,
    pendingAutoFitScopeKey,
    selectedTypes,
    singleRunId,
  ]);

  // Animate geoData when runs change
  useEffect(() => {
    if (singleRunId === null) {
      const selectedTypesKey = selectedTypes.join('-');
      const shouldReplayAnimation = shouldReplayMapAnimation({
        previousSelectedTypesKey: previousSelectedTypesKeyRef.current,
        nextSelectedTypesKey: selectedTypesKey,
        isSingleRunMode: singleRunId !== null,
      });

      previousSelectedTypesKeyRef.current = selectedTypesKey;

      if (shouldReplayAnimation) {
        startAnimation(runs);
      } else {
        setIsAnimating(false);
        setAnimatedGeoData(geoData);
      }
    }
  }, [geoData, runs, selectedTypes, singleRunId, startAnimation]);

  useEffect(() => {
    if (year !== 'Total') {
      return;
    }

    let svgStat = document.getElementById('svgStat');
    if (!svgStat) {
      return;
    }

    const handleClick = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.tagName.toLowerCase() === 'path') {
        // Use querySelector to get the <desc> element and the <title> element.
        const descEl = target.querySelector('desc');
        if (descEl) {
          // If the runId exists in the <desc> element, it means that a running route has been clicked.
          const runId = Number(descEl.innerHTML);
          if (!runId) {
            return;
          }
          if (selectedRunIdRef.current === runId) {
            selectedRunIdRef.current = null;
            locateActivity(runs.map((r) => r.run_id));
          } else {
            selectedRunIdRef.current = runId;
            locateActivity([runId]);
          }
          return;
        }

        const titleEl = target.querySelector('title');
        if (titleEl) {
          // If the runDate exists in the <title> element, it means that a date square has been clicked.
          const [runDate] = titleEl.innerHTML.match(
            /\d{4}-\d{1,2}-\d{1,2}/
          ) || [`${+thisYear + 1}`];
          const runIDsOnDate = runs
            .filter((r) => r.start_date_local.slice(0, 10) === runDate)
            .map((r) => r.run_id);
          if (!runIDsOnDate.length) {
            return;
          }
          if (selectedRunDateRef.current === runDate) {
            selectedRunDateRef.current = null;
            locateActivity(runs.map((r) => r.run_id));
          } else {
            selectedRunDateRef.current = runDate;
            locateActivity(runIDsOnDate);
          }
        }
      }
    };
    svgStat.addEventListener('click', handleClick);
    return () => {
      svgStat && svgStat.removeEventListener('click', handleClick);
    };
  }, [year, locateActivity, runs, thisYear]);

  return (
    <Layout>
      <Helmet>
        <html lang="zh-CN" />
      </Helmet>
      <div className="w-full lg:w-1/3">
        <h1 className="my-12 mt-6 text-5xl font-extrabold italic">
          <a href={siteUrl}>{siteTitle}</a>
        </h1>
        {(viewState.zoom ?? 0) <= 3 && IS_CHINESE ? (
          <LocationStat
            changeYear={changeYear}
            changeCity={changeCity}
            changeTitle={changeTitle}
          />
        ) : (
          <YearsStat year={year} onClick={changeYear} />
        )}
      </div>
      <div className="w-full lg:w-2/3" id="map-container">
        <ActivityTypeFilter />
        <RunMap
          title={title}
          viewState={viewState}
          geoData={animatedGeoData}
          setViewState={setViewState}
          changeYear={changeYear}
          thisYear={year}
          animationTrigger={animationTrigger}
        />
        {year === 'Total' ? (
          <SVGStat />
        ) : (
          <RunTable
            runs={runs}
            locateActivity={locateActivity}
            runIndex={runIndex}
            setRunIndex={setRunIndex}
          />
        )}
      </div>
      {/* Enable Audiences in Vercel Analytics: https://vercel.com/docs/concepts/analytics/audiences/quickstart */}
      {import.meta.env.VERCEL && <Analytics />}
    </Layout>
  );
};

export default Index;
