#!/usr/bin/env python3
"""Serve the composed public directory with the same root 404 as GitHub Pages."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class SiteHandler(SimpleHTTPRequestHandler):
    def send_error(self, code, message=None, explain=None):
        page = Path(self.directory) / '404.html'
        if code != 404 or not page.is_file():
            return super().send_error(code, message, explain)
        content = page.read_bytes()
        self.send_response(404)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(content)))
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(content)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=1313)
    args = parser.parse_args()
    public = Path(__file__).resolve().parent.parent / 'dist' / 'site'
    if not (public / 'running/data/activities.json').is_file():
        parser.error('Run scripts/preview.sh to build the combined site first')
    server = ThreadingHTTPServer(('127.0.0.1', args.port), partial(SiteHandler, directory=str(public)))
    print(f'Preview: http://127.0.0.1:{args.port}', flush=True)
    server.serve_forever()
