import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getMapRuntimeConfig,
  getViewportForGeoData,
  shouldAutoFitToBounds,
  shouldApplyPendingAutoFit,
} from './map';

test('third-party map vendors do not require a Mapbox token', () => {
  assert.deepEqual(
    getMapRuntimeConfig({
      vendor: 'mapcn_openfreemap',
      mapboxToken: '',
      styleUrl: 'https://tiles.openfreemap.org/styles/bright',
    }),
    {
      mapStyle: 'https://tiles.openfreemap.org/styles/bright',
      mapboxAccessToken: undefined,
      shouldAttachMapboxLanguage: false,
    }
  );
});

test('mapbox vendor still passes mapbox token and language plugin flag', () => {
  assert.deepEqual(
    getMapRuntimeConfig({
      vendor: 'mapbox',
      mapboxToken: 'pk.test',
      styleUrl: 'mapbox://styles/mapbox/dark-v11',
    }),
    {
      mapStyle: 'mapbox://styles/mapbox/dark-v11',
      mapboxAccessToken: 'pk.test',
      shouldAttachMapboxLanguage: true,
    }
  );
});

test('shouldAutoFitToBounds when scope changes outside single-run mode', () => {
  assert.equal(
    shouldAutoFitToBounds({
      previousScopeKey: 'Year:2026|running',
      nextScopeKey: 'Year:Total|running',
      singleRunId: null,
    }),
    true
  );
  assert.equal(
    shouldAutoFitToBounds({
      previousScopeKey: 'Year:2026|running',
      nextScopeKey: 'Year:2026|running',
      singleRunId: null,
    }),
    false
  );
  assert.equal(
    shouldAutoFitToBounds({
      previousScopeKey: 'Year:2026|running',
      nextScopeKey: 'Year:Total|running',
      singleRunId: 123,
    }),
    false
  );
});

test('shouldApplyPendingAutoFit only applies after matching scope is ready', () => {
  assert.equal(
    shouldApplyPendingAutoFit({
      pendingScopeKey: 'Year:Total|running',
      currentScopeKey: 'Year:2026|running',
      singleRunId: null,
    }),
    false
  );
  assert.equal(
    shouldApplyPendingAutoFit({
      pendingScopeKey: 'Year:Total|running',
      currentScopeKey: 'Year:Total|running',
      singleRunId: null,
    }),
    true
  );
  assert.equal(
    shouldApplyPendingAutoFit({
      pendingScopeKey: 'Year:Total|running',
      currentScopeKey: 'Year:Total|running',
      singleRunId: 1,
    }),
    false
  );
});

test('getViewportForGeoData fits all route coordinates for total scope', () => {
  const singleScope = getViewportForGeoData({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: [
            [112.95, 28.18],
            [112.97, 28.2],
          ],
        },
      },
    ],
  });

  const totalScope = getViewportForGeoData({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: [
            [112.95, 28.18],
            [112.97, 28.2],
          ],
        },
      },
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: [
            [121.47, 31.23],
            [121.49, 31.25],
          ],
        },
      },
    ],
  });

  assert.notEqual(totalScope.longitude, singleScope.longitude);
  assert.notEqual(totalScope.latitude, singleScope.latitude);
  assert.ok(
    (totalScope.zoom ?? 0) < (singleScope.zoom ?? 0),
    '总视图应该比单条/单年视图缩得更远'
  );
});

test('getViewportForGeoData focuses on the dominant activity cluster when tiny distant clusters exist', () => {
  const dominantClusterScope = getViewportForGeoData({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: [
            [112.95, 28.18],
            [112.97, 28.2],
          ],
        },
      },
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: [
            [112.96, 28.19],
            [112.98, 28.21],
          ],
        },
      },
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: [
            [112.94, 28.17],
            [112.95, 28.19],
          ],
        },
      },
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: [
            [112.97, 28.18],
            [112.99, 28.22],
          ],
        },
      },
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: [
            [121.47, 31.23],
            [121.49, 31.25],
          ],
        },
      },
    ],
  });

  assert.ok(
    Math.abs((dominantClusterScope.longitude ?? 0) - 112.96) < 0.5,
    '地图中心应该仍聚焦主活动城市'
  );
  assert.ok(
    Math.abs((dominantClusterScope.latitude ?? 0) - 28.19) < 0.5,
    '地图纬度应该仍聚焦主活动城市'
  );
  assert.ok(
    (dominantClusterScope.zoom ?? 0) > 8,
    '主活动簇视图不应被远端少量数据拉得过远'
  );
});

test('empty filtered map data has a finite default viewport', () => {
  assert.deepEqual(
    getViewportForGeoData({ type: 'FeatureCollection', features: [] }),
    {
      longitude: 20,
      latitude: 20,
      zoom: 3,
    }
  );
});

test('a single repeated route coordinate does not produce invalid bounds', () => {
  assert.deepEqual(
    getViewportForGeoData({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: [
              [113, 28],
              [113, 28],
            ],
          },
        },
      ],
    }),
    { longitude: 113, latitude: 28, zoom: 9 }
  );
});
