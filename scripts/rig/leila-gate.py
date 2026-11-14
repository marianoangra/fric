#!/usr/bin/env python3
"""
leila-gate — porteiro entre o túnel e o Ollama, roda NA RIG (só stdlib, Python 3.8+).

O Ollama não tem senha e a API dele aceita pull/delete/create. O túnel aponta para ESTE
processo (127.0.0.1:11435), nunca para o 11434. Aqui só passa:
  - GET  /api/ps                     (status: a rig está viva / modelo carregado?)
  - POST /api/chat com model "leila" (parâmetros sensíveis são forçados aqui de novo)
e só com  Authorization: Bearer <LEILA_TOKEN>.

Config por variável de ambiente (ver leila-gate.service):
  LEILA_TOKEN   obrigatório, o mesmo valor da env LEILA_TOKEN na Vercel
  GATE_PORT     padrão 11435
  OLLAMA        padrão http://127.0.0.1:11434
"""
import hmac
import json
import os
import sys
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

TOKEN = os.environ.get("LEILA_TOKEN", "")
PORT = int(os.environ.get("GATE_PORT", "11435"))
OLLAMA = os.environ.get("OLLAMA", "http://127.0.0.1:11434").rstrip("/")
MAX_BODY = 16_000

if len(TOKEN) < 24:
    sys.exit("LEILA_TOKEN ausente ou curto demais (mín. 24 caracteres)")


class Gate(BaseHTTPRequestHandler):
    server_version = "leila-gate"
    sys_version = ""

    def log_message(self, fmt, *args):  # sem IP/conteúdo no log, só método/rota/status
        sys.stderr.write("%s\n" % (fmt % args))

    def _deny(self, code, msg):
        body = json.dumps({"error": msg}).encode()
        self.send_response(code)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _authed(self):
        got = self.headers.get("authorization", "")
        return hmac.compare_digest(got.encode(), ("Bearer " + TOKEN).encode())

    def _relay(self, req):
        try:
            up = urllib.request.urlopen(req, timeout=120)
        except Exception:
            return self._deny(502, "ollama_offline")
        self.send_response(up.status)
        self.send_header("content-type", up.headers.get("content-type", "application/json"))
        self.send_header("cache-control", "no-store")
        self.end_headers()
        try:
            while True:
                chunk = up.read1(4096) if hasattr(up, "read1") else up.read(4096)
                if not chunk:
                    break
                self.wfile.write(chunk)
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError):
            pass  # visitante saiu no meio da resposta
        finally:
            up.close()

    def do_GET(self):
        if not self._authed():
            return self._deny(401, "unauthorized")
        if self.path != "/api/ps":
            return self._deny(404, "not_found")
        self._relay(urllib.request.Request(OLLAMA + "/api/ps"))

    def do_POST(self):
        if not self._authed():
            return self._deny(401, "unauthorized")
        if self.path != "/api/chat":
            return self._deny(404, "not_found")
        n = int(self.headers.get("content-length") or 0)
        if n <= 0 or n > MAX_BODY:
            return self._deny(413, "too_large")
        try:
            body = json.loads(self.rfile.read(n))
            msgs = body["messages"]
            assert isinstance(msgs, list) and 0 < len(msgs) <= 8
            for m in msgs:
                assert m.get("role") in ("user", "assistant")
                assert isinstance(m.get("content"), str) and len(m["content"]) <= 1000
        except Exception:
            return self._deny(400, "bad_request")
        safe = {
            "model": "leila",
            "think": False,
            "stream": bool(body.get("stream", True)),
            "keep_alive": -1,
            "options": {"num_predict": min(int((body.get("options") or {}).get("num_predict", 150)), 200)},
            "messages": [{"role": m["role"], "content": m["content"]} for m in msgs],
        }
        req = urllib.request.Request(
            OLLAMA + "/api/chat",
            data=json.dumps(safe).encode(),
            headers={"content-type": "application/json"},
            method="POST",
        )
        self._relay(req)

    def _no(self):
        self._deny(405, "method_not_allowed")

    do_PUT = do_DELETE = do_PATCH = do_HEAD = do_OPTIONS = _no


if __name__ == "__main__":
    print(f"leila-gate em 127.0.0.1:{PORT} -> {OLLAMA}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", PORT), Gate).serve_forever()
