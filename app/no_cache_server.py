#!/usr/bin/env python3
"""Local dev server that disables all caching — for this prototype only,
where ES module/CSS caching in Chrome was masking edits during development."""
import http.server
import socketserver

PORT = 8765

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

if __name__ == '__main__':
    with socketserver.TCPServer(('', PORT), NoCacheHandler) as httpd:
        print(f'Serving with no-cache headers on http://localhost:{PORT}')
        httpd.serve_forever()
