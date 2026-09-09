import datetime
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from gpxtrackposter.exceptions import TrackLoadError
from gpxtrackposter.track import Track


class TrackValidationTest(unittest.TestCase):
    def make_track(self):
        track = Track()
        track.start_time = datetime.datetime(
            2025, 10, 9, 12, 0, tzinfo=datetime.timezone.utc
        )
        track.end_time = datetime.datetime(
            2025, 10, 9, 12, 30, tzinfo=datetime.timezone.utc
        )
        track.start_time_local = datetime.datetime(2025, 10, 9, 20, 0)
        track.end_time_local = datetime.datetime(2025, 10, 9, 20, 30)
        track.moving_dict = {
            "moving_time": datetime.timedelta(minutes=20),
            "elapsed_time": datetime.timedelta(minutes=30),
        }
        return track

    def test_rejects_unreasonable_local_year(self):
        track = self.make_track()
        track.start_time_local = datetime.datetime(7518, 5, 11, 5, 53, 34)

        with self.assertRaises(TrackLoadError):
            track._validate_loaded_track()

    def test_rejects_end_before_start(self):
        track = self.make_track()
        track.end_time = track.start_time - datetime.timedelta(minutes=1)

        with self.assertRaises(TrackLoadError):
            track._validate_loaded_track()

    def test_rejects_negative_moving_time(self):
        track = self.make_track()
        track.moving_dict["moving_time"] = datetime.timedelta(days=-1)

        with self.assertRaises(TrackLoadError):
            track._validate_loaded_track()

    def test_load_gpx_propagates_track_load_error(self):
        fixture = Path(__file__).resolve().parent / "test_valid_track.gpx"
        fixture.write_text(
            """<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><trkseg><trkpt lat="28.0" lon="113.0"><time>2025-10-09T12:00:00Z</time></trkpt></trkseg></trk>
</gpx>
""",
            encoding="utf-8",
        )
        self.addCleanup(lambda: fixture.unlink(missing_ok=True))

        track = Track()
        with patch.object(
            Track, "_load_gpx_data", side_effect=TrackLoadError("bad track")
        ):
            with self.assertRaises(TrackLoadError):
                track.load_gpx(str(fixture))


if __name__ == "__main__":
    unittest.main()
