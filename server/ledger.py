#!/usr/bin/env python3
"""SQLite transaction worker. Input is accounting metadata only, never prompts/keys/tokens."""
import json, os, sqlite3, sys
os.umask(0o077)
a=json.load(sys.stdin)
db=sqlite3.connect(sys.argv[1],timeout=5,isolation_level=None)
db.execute('PRAGMA busy_timeout=5000')
db.execute('PRAGMA synchronous=FULL')
db.execute("CREATE TABLE IF NOT EXISTS reservations (id TEXT PRIMARY KEY, uid TEXT NOT NULL, lane TEXT NOT NULL, day TEXT NOT NULL, created INTEGER NOT NULL, expires INTEGER NOT NULL, state TEXT NOT NULL, amount INTEGER NOT NULL)")
db.execute("CREATE TABLE IF NOT EXISTS breaker (id INTEGER PRIMARY KEY CHECK(id=1), tripped INTEGER NOT NULL)")
db.execute('CREATE INDEX IF NOT EXISTS quota_lookup ON reservations(day,uid,created)')
db.execute('CREATE TABLE IF NOT EXISTS snapshots (id TEXT PRIMARY KEY, owner TEXT NOT NULL, payload TEXT NOT NULL, revoked INTEGER NOT NULL DEFAULT 0)')
try:
 db.execute('BEGIN IMMEDIATE')
 now=a['now']
 # Expired pre-dispatch reservations are safe to refund. Dispatched requests may
 # have incurred charges: settle at the full reserved amount after lease expiry.
 db.execute("UPDATE reservations SET state='cancelled',amount=0 WHERE state='reserved' AND expires<=?",(now,))
 db.execute("UPDATE reservations SET state='settled' WHERE state='dispatched' AND expires<=?",(now,))
 op=a['op']
 if op=='snapshotPublish':
  row=db.execute('SELECT owner FROM snapshots WHERE id=?',(a['id'],)).fetchone()
  if row and row[0]!=a['owner']: raise ValueError('owner')
  db.execute('INSERT INTO snapshots VALUES(?,?,?,0) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,revoked=0',(a['id'],a['owner'],json.dumps(a['payload'])))
  result={'id':a['id']}
 elif op=='snapshotRead':
  row=db.execute('SELECT payload FROM snapshots WHERE id=? AND revoked=0',(a['id'],)).fetchone()
  result={'snapshot':json.loads(row[0]) if row else None}
 elif op=='snapshotRevoke':
  row=db.execute('SELECT owner FROM snapshots WHERE id=?',(a['id'],)).fetchone()
  if not row or row[0]!=a['owner']: raise ValueError('owner')
  db.execute('UPDATE snapshots SET revoked=1 WHERE id=?',(a['id'],))
  result={'ok':True}
 elif op=='reserve':
  c=a['limits']; day=a['day']; uid=a['uid']
  def count(sql,args=()): return db.execute(sql,args).fetchone()[0]
  if count('SELECT COALESCE(MAX(tripped),0) FROM breaker'): raise ValueError('budget')
  if count('SELECT COUNT(*) FROM reservations WHERE uid=? AND created>?',(uid,now-60000))>=c['perMinute']: raise ValueError('rate')
  if count('SELECT COUNT(*) FROM reservations WHERE uid=? AND day=?',(uid,day))>=c['perUserDaily']: raise ValueError('daily')
  if count('SELECT COUNT(*) FROM reservations WHERE day=?',(day,))>=c['globalDaily']: raise ValueError('global')
  if count("SELECT COUNT(*) FROM reservations WHERE state IN ('reserved','dispatched')")>=c['maxConcurrent']: raise ValueError('concurrency')
  spent=count('SELECT COALESCE(SUM(amount),0) FROM reservations WHERE day=?',(day,))
  if spent+a['amount']>c['globalBudgetMicros']: raise ValueError('budget')
  db.execute('INSERT INTO reservations VALUES(?,?,?,?,?,?,?,?)',(a['id'],uid,a['lane'],day,now,now+c['leaseMs'],'reserved',a['amount']))
  result={'id':a['id']}
 elif op=='dispatch':
  cur=db.execute("UPDATE reservations SET state='dispatched' WHERE id=? AND state='reserved' AND expires>?",(a['id'],now))
  if cur.rowcount!=1: raise ValueError('reservation')
  result={'ok':True}
 elif op=='cancel':
  # Idempotent; cannot refund a dispatched request.
  db.execute("UPDATE reservations SET state='cancelled',amount=0 WHERE id=? AND state='reserved'",(a['id'],))
  result={'ok':True}
 elif op=='settle':
  row=db.execute('SELECT state,amount FROM reservations WHERE id=?',(a['id'],)).fetchone()
  if not row: raise ValueError('reservation')
  if row[0]=='dispatched':
   actual=a.get('actualMicros'); amount=row[1] if actual is None else actual
   if not isinstance(amount,int) or amount<0: raise ValueError('amount')
   if amount>row[1]: db.execute('INSERT OR REPLACE INTO breaker VALUES(1,1)')
   db.execute("UPDATE reservations SET state='settled',amount=? WHERE id=?",(amount,a['id']))
  if a.get('trip'): db.execute('INSERT OR REPLACE INTO breaker VALUES(1,1)')
  result={'ok':True}
 elif op=='inspect':
  result={'records':[dict(zip(['id','uid','lane','day','created','expires','state','amount'],r)) for r in db.execute('SELECT * FROM reservations')], 'tripped':bool(db.execute('SELECT COALESCE(MAX(tripped),0) FROM breaker').fetchone()[0])}
 else: raise ValueError('operation')
 db.execute('COMMIT');print(json.dumps(result))
except ValueError as e:
 db.execute('ROLLBACK');print(json.dumps({'error':str(e)}))
finally: db.close()
