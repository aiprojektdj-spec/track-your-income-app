// Schutz des Datei-Backup-Ordners vor einer leeren App (Kundenfall 2026-11-04).
// Wer auf einem neuen Geraet oder Origin seinen alten Ordner waehlt, importiert damit nichts.
// Bisher schrieb die leere App dann bei jedem Tab-Wechsel leere Backups hinein, und bei gleichem
// Firmennamen raeumte die 60er-Grenze die aeltesten echten Dateien weg.
const BackupOrdner = {
    // Leer = kein einziger Datensatz. Einstellungen sind Objekte und zaehlen bewusst nicht.
    // Unbekannte Listen zaehlen als Daten: im Zweifel wird wie bisher gesichert.
    appIstLeer(S) {
        const hatEintraege = (roh) => {
            if (roh == null) return false;
            try {
                const wert = typeof roh === 'string' ? JSON.parse(roh) : roh;
                return Array.isArray(wert) && wert.length > 0;
            } catch (e) { return true; }   // unlesbar: nicht als leer behandeln
        };
        const pfx = S._prefix, rPfx = S._rechPrefix;
        for (const [k, v] of Object.entries(S._cache)) {
            if ((k.startsWith(pfx) || k.startsWith(rPfx)) && hatEintraege(v)) return false;
        }
        return !S._EIGENBELEG_KEYS.some(k => {
            const fk = S._ebKeyPrefix + k;
            return hatEintraege(S._cache[fk] != null ? S._cache[fk] : localStorage.getItem(fk));
        });
    },

    async ordnerHatBackups(handle) {
        for await (const name of handle.keys()) {
            if (name.startsWith('backup') && (name.endsWith('.zip') || name.endsWith('.json'))) return true;
        }
        return false;
    },

    // true = nichts schreiben: die App ist leer und im Ordner liegen schon Backups
    async leereAppSchuetzen(S) {
        if (!S._fsDirHandle || !this.appIstLeer(S)) return false;
        return this.ordnerHatBackups(S._fsDirHandle);
    }
};
if (typeof window !== 'undefined') window.BackupOrdner = BackupOrdner;
