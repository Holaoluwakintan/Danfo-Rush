#!/usr/bin/env python3
"""Danfo Rush: one production deploy to Vercel by REST API (no CLI; nothing is built on Vercel).
Uploads dist/ (run `node build.mjs` first) + api/c.js + vercel.json.
Env (all optional):
  VERCEL_TOKEN    (else read from /home/user/tab/files/.vercel-new-account.env)
  VERCEL_TEAM     (default team_Z8w5vQEijLwxTPREwdQDqCe8; "" for a personal account)
  VERCEL_PROJECT  (default danfo-rush)
  DANFO_DOMAIN    (default danfo-rush-ng.vercel.app; added to the project if missing)
Usage: python3 deploy.py [--dry]"""
import os, sys, json, hashlib, time, requests
SRC = os.path.dirname(os.path.abspath(__file__))
TEAM = os.environ.get('VERCEL_TEAM', 'team_Z8w5vQEijLwxTPREwdQDqCe8')
PROJECT = os.environ.get('VERCEL_PROJECT', 'danfo-rush')
DOMAIN = os.environ.get('DANFO_DOMAIN', 'danfo-rush-ng.vercel.app')
tok = os.environ.get('VERCEL_TOKEN')
if not tok:
    f = '/home/user/tab/files/.vercel-new-account.env'
    tok = [l.split('=', 1)[1].strip().strip('"') for l in open(f) if l.startswith('VERCEL_TOKEN_NEW=')][0]
H = {'Authorization': 'Bearer ' + tok}
Q = ('?teamId=' + TEAM) if TEAM else ''
A = lambda path: 'https://api.vercel.com' + path + (('&' if '?' in path else '?') + 'teamId=' + TEAM if TEAM else '')
files = []
dist = os.path.join(SRC, 'dist')
for root, _, fs in os.walk(dist):
    for f in fs:
        p = os.path.join(root, f); files.append((os.path.relpath(p, dist), p))
files.append(('api/c.js', os.path.join(SRC, 'api/c.js')))
files.append(('vercel.json', os.path.join(SRC, 'vercel.json')))
print(len(files), 'files', sum(os.path.getsize(p) for _, p in files), 'bytes')
if '--dry' in sys.argv: sys.exit(0)
# project + domain (idempotent)
r = requests.get(A('/v9/projects/' + PROJECT), headers=H, timeout=30)
if r.status_code == 404:
    r = requests.post(A('/v10/projects'), headers=H, json={'name': PROJECT, 'framework': None}, timeout=30)
    print('project create', r.status_code, r.text[:200])
proj = r.json(); pid = proj.get('id'); print('project', pid)
r = requests.post(A(f'/v10/projects/{pid}/domains'), headers=H, json={'name': DOMAIN}, timeout=30)
print('domain', r.status_code, r.text[:200])
meta = []
for rel, p in files:
    b = open(p, 'rb').read(); sha = hashlib.sha1(b).hexdigest()
    for a in range(4):
        r = requests.post('https://api.vercel.com/v2/files' + Q, headers={**H, 'x-vercel-digest': sha, 'Content-Type': 'application/octet-stream'}, data=b, timeout=120)
        if r.status_code in (200, 201): break
        print('upload retry', rel, r.status_code, r.text[:200]); time.sleep(3)
    else: sys.exit('upload failed: ' + rel)
    meta.append({'file': rel, 'sha': sha, 'size': len(b)})
body = {'name': PROJECT, 'project': PROJECT, 'target': 'production', 'files': meta,
        'projectSettings': {'framework': None, 'buildCommand': None, 'installCommand': None, 'outputDirectory': None}}
r = requests.post(A('/v13/deployments?skipAutoDetectionConfirmation=1'), headers=H, json=body, timeout=120)
print('deploy', r.status_code, r.text[:400])
if r.status_code not in (200, 201): sys.exit(1)
d = r.json(); did = d['id']; print('id', did, d.get('url'))
st = None
for i in range(60):
    s = requests.get(A('/v13/deployments/' + did), headers=H, timeout=30).json()
    st = s.get('readyState') or s.get('status'); print(i, st)
    if st in ('READY', 'ERROR', 'CANCELED'): break
    time.sleep(4)
json.dump({'id': did, 'state': st, 'url': d.get('url'), 'domain': DOMAIN}, open(os.path.join(SRC, '.last-deploy.json'), 'w'))
print('done', st, 'https://' + DOMAIN)
