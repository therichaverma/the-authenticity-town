"""Serves the town at http://localhost:4173, telling browsers never to keep old copies of the files."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCache(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


ThreadingHTTPServer(('127.0.0.1', 4173), NoCache).serve_forever()
