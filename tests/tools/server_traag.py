import http.server, functools, sys, os
import time
DELAY=float(os.environ.get('DELAY_MS','0'))/1000
class H(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if DELAY: time.sleep(DELAY)
        return super().do_GET()
    def end_headers(self):
        self.send_header('Cache-Control', 'max-age=600')
        super().end_headers()
    def log_message(self, fmt, *a):
        sys.stderr.write("SRV " + (fmt % a) + "\n")
root = sys.argv[1]; port = int(sys.argv[2])
http.server.ThreadingHTTPServer(('127.0.0.1', port), functools.partial(H, directory=root)).serve_forever()
