"""Serve a local exported preview with SQLite SharedArrayBuffer isolation headers."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

class PreviewHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cross-Origin-Opener-Policy','same-origin')
        self.send_header('Cross-Origin-Embedder-Policy','credentialless')
        self.send_header('Cache-Control','no-store')
        super().end_headers()
    def do_GET(self):
        path=urlsplit(self.path).path
        target=Path(self.translate_path(path))
        if not target.exists() and not Path(path).suffix:
            self.path='/index.html'
        super().do_GET()

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--host',default='127.0.0.1')
    parser.add_argument('--port',type=int,default=18758)
    parser.add_argument('--directory',type=Path,default=Path(__file__).resolve().parents[1]/'dist')
    args=parser.parse_args()
    if not (args.directory/'index.html').exists():parser.error('Run expo export --platform web first.')
    server=ThreadingHTTPServer((args.host,args.port),partial(PreviewHandler,directory=str(args.directory.resolve())))
    print(f'OpenRoots preview http://{args.host}:{args.port}',flush=True)
    server.serve_forever()

if __name__=='__main__':main()
