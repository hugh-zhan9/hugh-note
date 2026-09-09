import datetime
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

import polyline


class GeneratorDataPreservationTest(unittest.TestCase):
    def test_loading_does_not_infer_or_persist_indoor_routes(self):
        sys.path.insert(0, str(Path(__file__).resolve().parent))
        from generator import Generator
        from generator.db import Activity

        generator = Generator(":memory:")
        reference_route = polyline.encode([(28.0, 113.0), (28.01, 113.01)])
        placeholder_route = polyline.encode([(39.9, 116.4), (39.9, 116.4)])
        records = [
            ("Run", "generic", reference_route),
            ("Walk", "Walk", placeholder_route),
            ("Run", "Run", ""),
            ("Run", "treadmill", ""),
        ]
        try:
            for run_id, (kind, subtype, route) in enumerate(records, start=1):
                generator.session.add(
                    Activity(
                        run_id=run_id,
                        name=f"Activity {run_id}",
                        type=kind,
                        subtype=subtype,
                        summary_polyline=route,
                        distance=1000.0,
                        start_date_local=f"2025-01-{run_id:02d} 08:00:00",
                        moving_time=datetime.timedelta(minutes=10),
                    )
                )
            generator.session.commit()

            # Privacy filtering is a separate existing transformation. Keep its
            # input untouched here to isolate subtype and synthetic-route changes.
            with patch("generator.filter_out", side_effect=lambda route: route):
                loaded = generator.load()

            self.assertEqual(
                [(a["type"], a["subtype"], a["summary_polyline"]) for a in loaded],
                records,
            )
            generator.session.expire_all()
            saved = generator.session.query(Activity).order_by(Activity.run_id).all()
            self.assertEqual(
                [(a.type, a.subtype, a.summary_polyline) for a in saved], records
            )
        finally:
            generator.session.close()


if __name__ == "__main__":
    unittest.main()
