#!/usr/bin/env python3
"""Download every file in every Supabase Storage bucket into a local folder.

Used by backup-persea.command. Reads SUPABASE_URL and SUPABASE_SECRET_KEY from
the environment and writes <destino>/<bucket>/<path>. Standard library only,
so it runs on a Mac without installing anything.
"""
import json
import os
import sys
import urllib.parse
import urllib.request

BASE = os.environ["SUPABASE_URL"].rstrip("/") + "/storage/v1"
KEY = os.environ["SUPABASE_SECRET_KEY"]
HEADERS = {"apikey": KEY}
if KEY.startswith("eyJ"):  # legacy service_role JWT also needs the bearer header
    HEADERS["Authorization"] = f"Bearer {KEY}"


def call(path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    headers = dict(HEADERS, **({"Content-Type": "application/json"} if data else {}))
    req = urllib.request.Request(BASE + path, data=data, headers=headers, method="POST" if data else "GET")
    with urllib.request.urlopen(req, timeout=120) as res:
        return res.read()


def walk(bucket, prefix=""):
    """Yield every file path in the bucket (folders come back with id = null)."""
    offset = 0
    while True:
        items = json.loads(call(f"/object/list/{bucket}", {"prefix": prefix, "limit": 1000, "offset": offset,
                                                          "sortBy": {"column": "name", "order": "asc"}}))
        for it in items:
            path = f"{prefix}{it['name']}"
            if it.get("id") is None:
                yield from walk(bucket, path + "/")
            else:
                yield path
        if len(items) < 1000:
            return
        offset += 1000


def main(dest):
    buckets = [b["id"] for b in json.loads(call("/bucket"))]
    total, failed = 0, []
    for bucket in buckets:
        for path in walk(bucket):
            quoted = "/".join(urllib.parse.quote(p) for p in path.split("/"))
            target = os.path.join(dest, bucket, *path.split("/"))
            os.makedirs(os.path.dirname(target), exist_ok=True)
            try:
                with open(target, "wb") as f:
                    f.write(call(f"/object/{bucket}/{quoted}"))
                total += 1
            except Exception as e:  # keep going; report at the end
                failed.append(f"{bucket}/{path}: {e}")
    print(f"  {total} arquivos em {len(buckets)} pastas ({', '.join(buckets) or 'nenhuma'})")
    if failed:
        print(f"  Atenção: {len(failed)} arquivo(s) não baixaram:")
        for f in failed[:20]:
            print("   -", f)
        sys.exit(2)


if __name__ == "__main__":
    main(sys.argv[1])
