import { WebMercatorViewport } from '@math.gl/web-mercator';
import { FeatureCollection, LineString } from 'geojson';

import { Coordinate, IViewState } from './geoUtils';

interface MapRuntimeConfigInput {
  vendor: string;
  styleUrl: string;
  mapboxToken?: string;
}

interface MapRuntimeConfig {
  mapStyle: string;
  mapboxAccessToken?: string;
  shouldAttachMapboxLanguage: boolean;
}

interface AutoFitBoundsInput {
  previousScopeKey: string;
  nextScopeKey: string;
  singleRunId: number | null;
}

interface PendingAutoFitInput {
  pendingScopeKey: string | null;
  currentScopeKey: string;
  singleRunId: number | null;
}

const DEFAULT_VIEW_STATE: IViewState = {
  longitude: 20,
  latitude: 20,
  zoom: 3,
};

const CLUSTER_DISTANCE_THRESHOLD = 1.5;
const DOMINANT_CLUSTER_MIN_FEATURES = 3;
const DOMINANT_CLUSTER_RATIO = 0.6;

type CoordinateCluster = {
  center: Coordinate;
  featureCount: number;
  points: Coordinate[];
};

const calculateFeatureCenter = (coordinates: Coordinate[]): Coordinate => {
  const [longitudeSum, latitudeSum] = coordinates.reduce(
    (acc, [longitude, latitude]) => [acc[0] + longitude, acc[1] + latitude],
    [0, 0]
  );

  return [
    longitudeSum / coordinates.length,
    latitudeSum / coordinates.length,
  ] as Coordinate;
};

const getDistanceBetweenPoints = (
  [longitudeA, latitudeA]: Coordinate,
  [longitudeB, latitudeB]: Coordinate
) => {
  const longitudeDistance = longitudeA - longitudeB;
  const latitudeDistance = latitudeA - latitudeB;
  return Math.hypot(longitudeDistance, latitudeDistance);
};

const getDominantClusterPoints = (
  geoData: FeatureCollection<LineString>
): Coordinate[] | null => {
  const clusters: CoordinateCluster[] = [];

  for (const feature of geoData.features) {
    const coordinates = (feature.geometry.coordinates as Coordinate[]).filter(
      (point) => point.length === 2
    );
    if (coordinates.length === 0) {
      continue;
    }

    const center = calculateFeatureCenter(coordinates);
    const matchedCluster = clusters.find(
      (cluster) =>
        getDistanceBetweenPoints(cluster.center, center) <=
        CLUSTER_DISTANCE_THRESHOLD
    );

    if (!matchedCluster) {
      clusters.push({
        center,
        featureCount: 1,
        points: [...coordinates],
      });
      continue;
    }

    matchedCluster.points.push(...coordinates);
    matchedCluster.featureCount += 1;
    matchedCluster.center = calculateFeatureCenter(matchedCluster.points);
  }

  if (clusters.length <= 1) {
    return null;
  }

  const dominantCluster = [...clusters].sort(
    (left, right) => right.featureCount - left.featureCount
  )[0];

  if (
    dominantCluster.featureCount < DOMINANT_CLUSTER_MIN_FEATURES ||
    dominantCluster.featureCount / geoData.features.length <
      DOMINANT_CLUSTER_RATIO
  ) {
    return null;
  }

  return dominantCluster.points;
};

export const getViewportForGeoData = (
  geoData: FeatureCollection<LineString>
): IViewState => {
  const allPoints = geoData.features.flatMap((feature) =>
    (feature.geometry.coordinates as Coordinate[]).filter(
      (point) => point.length === 2
    )
  );
  const points = getDominantClusterPoints(geoData) ?? allPoints;

  if (points.length === 0) {
    return DEFAULT_VIEW_STATE;
  }

  const uniquePoints = new Set(points.map((point) => point.join(',')));
  if (uniquePoints.size === 1) {
    const [longitude, latitude] = points[0];
    return { longitude, latitude, zoom: 9 };
  }

  const longitudes = points.map(([longitude]) => longitude);
  const latitudes = points.map(([, latitude]) => latitude);
  const bounds: [Coordinate, Coordinate] = [
    [Math.min(...longitudes), Math.min(...latitudes)],
    [Math.max(...longitudes), Math.max(...latitudes)],
  ];
  const { longitude, latitude, zoom } = new WebMercatorViewport({
    width: 800,
    height: 600,
  }).fitBounds(bounds, { padding: 80 });

  return { longitude, latitude, zoom };
};

export const getMapRuntimeConfig = ({
  vendor,
  styleUrl,
  mapboxToken,
}: MapRuntimeConfigInput): MapRuntimeConfig => {
  const isMapboxVendor = vendor === 'mapbox';

  return {
    mapStyle: styleUrl,
    mapboxAccessToken: isMapboxVendor ? mapboxToken : undefined,
    shouldAttachMapboxLanguage: isMapboxVendor,
  };
};

export const shouldAutoFitToBounds = ({
  previousScopeKey,
  nextScopeKey,
  singleRunId,
}: AutoFitBoundsInput): boolean => {
  if (singleRunId !== null) {
    return false;
  }

  return previousScopeKey !== nextScopeKey;
};

export const shouldApplyPendingAutoFit = ({
  pendingScopeKey,
  currentScopeKey,
  singleRunId,
}: PendingAutoFitInput): boolean => {
  if (singleRunId !== null || pendingScopeKey === null) {
    return false;
  }

  return pendingScopeKey === currentScopeKey;
};
