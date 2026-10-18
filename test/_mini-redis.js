// Kleines In-Memory-Redis für die Upstash-REST-Schnittstelle (POST JSON-Kommando → {result}).
// Kein Test für sich — benutzt von test-api-grenzen.js und test-anker-integritaet.js.
// Deckt genau die Kommandos ab, die api/_sync-store.js sendet. EVAL (CAS-Skript) wird für
// den Sync-Push nachgebildet.
'use strict';

function miniRedis() {
    const kv = new Map(), sets = new Map(), lists = new Map(), log = [];
    const set = k => { if (!sets.has(k)) sets.set(k, new Set()); return sets.get(k); };
    const list = k => { if (!lists.has(k)) lists.set(k, []); return lists.get(k); };
    function cmd(c) {
        log.push(c);
        const [op, k, ...a] = c;
        switch (op) {
            case 'GET': return kv.has(k) ? kv.get(k) : null;
            case 'SET': {
                const nx = a.indexOf('NX') !== -1;
                if (nx && kv.has(k)) return null;
                kv.set(k, a[0]); return 'OK';
            }
            case 'DEL': { let n = 0; [k].concat(a).forEach(x => { if (kv.delete(x) | sets.delete(x) | lists.delete(x)) n++; }); return n; }
            case 'INCR': { const v = Number(kv.get(k) || 0) + 1; kv.set(k, String(v)); return v; }
            case 'INCRBY': { const v = Number(kv.get(k) || 0) + Number(a[0]); kv.set(k, String(v)); return v; }
            case 'EXPIRE': return 1;
            case 'SADD': { const s = set(k); let n = 0; a.forEach(x => { if (!s.has(x)) { s.add(x); n++; } }); return n; }
            case 'SREM': { const s = set(k); let n = 0; a.forEach(x => { if (s.delete(x)) n++; }); return n; }
            case 'SCARD': return set(k).size;
            case 'SMEMBERS': return Array.from(set(k));
            case 'RPUSH': { const l = list(k); l.push(...a); return l.length; }
            case 'LLEN': return list(k).length;
            case 'LTRIM': { const l = list(k); let s = Number(a[0]), e = Number(a[1]); if (s < 0) s = Math.max(0, l.length + s); if (e < 0) e = l.length + e; lists.set(k, l.slice(s, e + 1)); return 'OK'; }
            case 'LRANGE': { const l = list(k); let s = Number(a[0]), e = Number(a[1]); if (e < 0) e = l.length + e; return l.slice(s, e + 1); }
            case 'EVAL': {
                // CAS aus api/_sync-store.js: KEYS[1] = a[1], ARGV[1] = a[2], ARGV[2] = a[3]
                const key = a[1], expected = a[2], data = a[3];
                const cur = kv.get(key);
                if (cur) { let o = null; try { o = JSON.parse(cur); } catch (e) {} if (!o || String(o.version) !== expected) return cur; }
                kv.set(key, data); return 'OK';
            }
            default: throw new Error('miniRedis: unbekanntes Kommando ' + op);
        }
    }
    return { kv, sets, lists, log, cmd,
        fetch: async (url, opts) => ({ json: async () => { try { return { result: cmd(JSON.parse(opts.body)) }; } catch (e) { return { error: e.message }; } } }) };
}

module.exports = { miniRedis };
