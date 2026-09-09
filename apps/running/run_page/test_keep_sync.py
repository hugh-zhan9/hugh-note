import sys
import types
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

KEEP_SYNC_IMPORTS = None


class KeepSyncTimestampTest(unittest.TestCase):
    @staticmethod
    def import_keep_sync():
        global KEEP_SYNC_IMPORTS
        if KEEP_SYNC_IMPORTS is None:
            sys.path.insert(0, str(Path(__file__).resolve().parent))
            with patch.dict(
                sys.modules,
                {
                    "eviltransform": types.SimpleNamespace(
                        gcj2wgs=lambda lat, lng: (lat, lng)
                    )
                },
            ):
                from keep_sync import (
                    normalize_keep_point_timestamp_seconds,
                    parse_points_to_gpx,
                )

            KEEP_SYNC_IMPORTS = (
                normalize_keep_point_timestamp_seconds,
                parse_points_to_gpx,
            )

        return KEEP_SYNC_IMPORTS

    def test_normalize_absolute_millisecond_timestamp(self):
        start_time = 1661348572000
        normalize_keep_point_timestamp_seconds, _ = self.import_keep_sync()

        seconds = normalize_keep_point_timestamp_seconds(1661348572000, start_time)

        self.assertEqual(
            datetime.fromtimestamp(seconds, tz=timezone.utc),
            datetime(2022, 8, 24, 13, 42, 52, tzinfo=timezone.utc),
        )

    def test_normalize_absolute_scaled_millisecond_timestamp(self):
        start_time = 1743082166493
        normalize_keep_point_timestamp_seconds, _ = self.import_keep_sync()

        seconds = normalize_keep_point_timestamp_seconds(174308216649300, start_time)

        self.assertEqual(
            datetime.fromtimestamp(seconds, tz=timezone.utc),
            datetime(2025, 3, 27, 13, 29, 26, 493000, tzinfo=timezone.utc),
        )

    def test_parse_points_to_gpx_uses_normalized_timestamp(self):
        start_time = 1743082166493
        _, parse_points_to_gpx = self.import_keep_sync()
        gpx = parse_points_to_gpx(
            [
                {
                    "latitude": 28.0,
                    "longitude": 113.0,
                    "timestamp": 174308216649300,
                }
            ],
            start_time,
            "Run",
        )

        point_time = gpx.tracks[0].segments[0].points[0].time
        self.assertEqual(point_time.year, 2025)
        self.assertEqual(point_time.month, 3)
        self.assertEqual(point_time.day, 27)
        self.assertEqual(point_time.hour, 13)


if __name__ == "__main__":
    unittest.main()
