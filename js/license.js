// ============================================================
// License - Offline ECDSA P-256 Lizenzprüfung
// ============================================================
//
// SETUP (einmalig):
//   1. Node.js installieren (nodejs.org)
//   2. In tools/ ausführen: node setup-keypair.js
//   3. Den ausgegebenen JWK-Wert unten bei PUBLIC_KEY_JWK eintragen
//
// Solange PUBLIC_KEY_JWK = null → Entwicklermodus (kein Check)
// ============================================================

const License = {

    // ── Hier deinen Public Key eintragen ──────────────────────
    // Nach "node tools/setup-keypair.js" den JWK-Output hier einfügen:
    PUBLIC_KEY_JWK: null,
    // Beispiel nach Setup:
    // PUBLIC_KEY_JWK: {"kty":"EC","x":"...","y":"...","crv":"P-256"},
    // ──────────────────────────────────────────────────────────

    // ── Master-Override-Keys (Backdoor für persönliche Nutzung) ─
    // ⚠️ Wer den Source-Code lesen kann, sieht diese Keys. Nur für
    // eigene Nutzung gedacht — bei kommerzieller Verteilung entfernen!
    MASTER_KEYS: {
        // Universal-Schlüssel — gilt bis Ende 2099
        'OYI-MASTER-UNIVERSAL-2099': {
            name:    'Universal Master',
            email:   'master@local',
            tier:    'enterprise',
            expires: '2099-12-31'
        },
        // Demo-Schlüssel für Test-User — automatisch +90 Tage ab Aktivierung
        'OYI-DEMO-90-DAYS': {
            name:    'Demo-Lizenz (90 Tage)',
            email:   'demo@local',
            tier:    'pro',
            _dynamicExpiry: 90  // Tage ab Aktivierung
        }
    },

    _LS_KEY:     'app_license',
    _cachedData: null,

    // Gibt true zurück wenn Entwicklermodus (kein Public Key konfiguriert)
    isDevMode() {
        return this.PUBLIC_KEY_JWK === null;
    },

    // Gecachte Lizenzdaten abrufen (nach init() verfügbar)
    getData() {
        return this._cachedData;
    },

    // Prüft ob Lizenz aktiv und nicht abgelaufen
    isActive() {
        if (this.isDevMode()) return true;
        if (!this._cachedData) return false;
        return new Date(this._cachedData.expires) >= new Date();
    },

    // Ablauf in Tagen (negativ = bereits abgelaufen)
    daysUntilExpiry() {
        if (!this._cachedData || !this._cachedData.expires) return null;
        const diff = new Date(this._cachedData.expires) - new Date();
        return Math.ceil(diff / 86400000);
    },

    // ── Haupteinstieg: wird von App.init() aufgerufen ─────────
    // onValid(licenseData | null) wird nach erfolgreicher Prüfung aufgerufen
    async init(onValid) {
        // Entwicklermodus: kein Public Key → direkt weiter
        if (this.isDevMode()) {
            if (window.location.hostname !== 'localhost' && window.location.protocol !== 'file:') {
                console.warn('[License] Entwicklermodus aktiv – Lizenzprüfung deaktiviert.');
            }
            onValid(null);
            return;
        }

        const stored = localStorage.getItem(this._LS_KEY);
        if (stored) {
            try {
                const data = await this._verify(stored);
                this._cachedData = data;
                const days = this.daysUntilExpiry();
                if (days !== null && days < 0) {
                    // Abgelaufen: Warnung anzeigen, aber noch 30 Tage Kulanz
                    if (days >= -30) {
                        this._showExpiredWarning(Math.abs(days), onValid);
                        return;
                    }
                    // Kulanzzeit abgelaufen: Neueingabe erzwingen
                    this._showScreen(onValid, `Lizenz ist seit ${Math.abs(days)} Tagen abgelaufen. Bitte erneuern.`);
                    return;
                }
                if (days !== null && days <= 30) {
                    // Bald ablaufend: Toast-Hinweis
                    setTimeout(() => {
                        if (typeof Utils !== 'undefined') {
                            Utils.showToast(`⚠️ Lizenz läuft in ${days} Tagen ab`, 'warning');
                        }
                    }, 3000);
                }
                onValid(data);
                return;
            } catch (e) {
                // Gespeicherte Lizenz ungültig (manipuliert?)
                localStorage.removeItem(this._LS_KEY);
                this._showScreen(onValid, 'Gespeicherte Lizenz ist ungültig. Bitte erneut eingeben.');
                return;
            }
        }

        // Keine Lizenz vorhanden
        this._showScreen(onValid, null);
    },

    // ── Lizenzschlüssel verifizieren ──────────────────────────
    async _verify(licenseStr) {
        licenseStr = licenseStr.trim();

        // ── Master-Key-Check (vor Signatur-Verifikation) ──
        const master = this.MASTER_KEYS && this.MASTER_KEYS[licenseStr];
        if (master) {
            const today = new Date().toISOString().split('T')[0];
            let expires = master.expires;
            if (master._dynamicExpiry) {
                const d = new Date();
                d.setDate(d.getDate() + master._dynamicExpiry);
                expires = d.toISOString().split('T')[0];
            }
            return {
                name:    master.name,
                email:   master.email,
                tier:    master.tier,
                expires: expires,
                issued:  today,
                _isMaster: true
            };
        }

        const parts = licenseStr.split('.');
        if (parts.length !== 2) throw new Error('Ungültiges Format');

        const [payloadB64, sigB64] = parts;

        // Base64url dekodieren
        const payloadBytes = this._b64urlToBytes(payloadB64);
        const sigBytes     = this._b64urlToBytes(sigB64);

        // Public Key importieren
        const pubKey = await crypto.subtle.importKey(
            'jwk',
            this.PUBLIC_KEY_JWK,
            { name: 'ECDSA', namedCurve: 'P-256' },
            false,
            ['verify']
        );

        // Signatur prüfen (signiert wurde der payloadB64-String als UTF-8)
        const msgBytes = new TextEncoder().encode(payloadB64);
        const valid = await crypto.subtle.verify(
            { name: 'ECDSA', hash: 'SHA-256' },
            pubKey,
            sigBytes,
            msgBytes
        );

        if (!valid) throw new Error('Ungültige Signatur');

        // Payload dekodieren und validieren
        const payloadJson = new TextDecoder().decode(payloadBytes);
        const data = JSON.parse(payloadJson);
        if (!data.name || !data.expires || !data.issued) throw new Error('Unvollständige Lizenzdaten');

        return data;
    },

    // ── Lizenz-Eingabe-Screen ─────────────────────────────────
    _showScreen(onValid, errorMsg) {
        const overlay = document.getElementById('modalOverlay');
        const modal   = document.getElementById('modal');
        if (!overlay || !modal) { onValid(null); return; }

        modal.innerHTML = `
            <div style="text-align:center;padding:24px 0 16px;">
                <div style="font-size:40px;margin-bottom:12px;">🔑</div>
                <h2 style="margin:0 0 6px;font-size:22px;color:var(--text-primary);">Lizenzschlüssel erforderlich</h2>
                <p style="color:var(--text-secondary);font-size:13px;margin:0;">Bitte gib deinen Lizenzschlüssel ein, um fortzufahren.</p>
            </div>
            ${errorMsg ? `<div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:13px;color:#ef4444;">⚠️ ${errorMsg}</div>` : ''}
            <div class="form-group">
                <label class="form-label">Lizenzschlüssel</label>
                <textarea class="form-textarea" id="licKeyInput" rows="4" placeholder="Lizenzschlüssel hier einfügen…" style="font-family:monospace;font-size:12px;resize:vertical;"></textarea>
            </div>
            <div id="licErrorBox" style="display:none;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:10px 14px;font-size:13px;color:#ef4444;margin-bottom:12px;"></div>
            <div style="display:flex;justify-content:flex-end;">
                <button class="btn btn-primary" id="licActivateBtn" style="min-width:140px;">Aktivieren</button>
            </div>
            <p style="text-align:center;font-size:12px;color:var(--text-muted);margin-top:16px;">
                Kein Schlüssel? Kontaktiere den Anbieter dieser Software.
            </p>
        `;
        overlay.classList.add('active');

        document.getElementById('licActivateBtn').addEventListener('click', async () => {
            const btn     = document.getElementById('licActivateBtn');
            const input   = document.getElementById('licKeyInput').value.trim();
            const errBox  = document.getElementById('licErrorBox');
            if (!input) { errBox.textContent = 'Bitte einen Lizenzschlüssel eingeben.'; errBox.style.display = ''; return; }

            btn.disabled = true;
            btn.textContent = 'Prüfe…';
            errBox.style.display = 'none';

            try {
                const data = await this._verify(input);
                // Ablaufprüfung
                const days = Math.ceil((new Date(data.expires) - new Date()) / 86400000);
                if (days < -30) throw new Error(`Lizenz ist seit ${Math.abs(days)} Tagen abgelaufen.`);

                localStorage.setItem(this._LS_KEY, input);
                this._cachedData = data;
                overlay.classList.remove('active');
                if (days < 0) {
                    this._showExpiredWarning(Math.abs(days), onValid);
                } else {
                    onValid(data);
                }
            } catch (e) {
                errBox.textContent = '❌ ' + (e.message || 'Ungültiger Lizenzschlüssel');
                errBox.style.display = '';
                btn.disabled = false;
                btn.textContent = 'Aktivieren';
            }
        });

        // Enter-Shortcut
        document.getElementById('licKeyInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                document.getElementById('licActivateBtn').click();
            }
        });
    },

    // ── Abgelaufene Lizenz – Kulanz-Warnung ───────────────────
    _showExpiredWarning(daysExpired, onValid) {
        const overlay = document.getElementById('modalOverlay');
        const modal   = document.getElementById('modal');

        modal.innerHTML = `
            <div style="text-align:center;padding:24px 0 16px;">
                <div style="font-size:40px;margin-bottom:12px;">⚠️</div>
                <h2 style="margin:0 0 6px;font-size:20px;color:var(--warning,#f59e0b);">Lizenz abgelaufen</h2>
                <p style="color:var(--text-secondary);font-size:13px;margin:0 0 16px;">Deine Lizenz ist seit <strong>${daysExpired}</strong> Tagen abgelaufen.<br>Noch ${30 - daysExpired} Kulanz-Tage verbleiben.</p>
            </div>
            <div class="form-group">
                <label class="form-label">Neuen Lizenzschlüssel eingeben (optional)</label>
                <textarea class="form-textarea" id="licRenewInput" rows="3" placeholder="Neuer Schlüssel…" style="font-family:monospace;font-size:12px;"></textarea>
            </div>
            <div id="licRenewError" style="display:none;color:#ef4444;font-size:13px;margin-bottom:8px;"></div>
            <div style="display:flex;gap:10px;justify-content:flex-end;">
                <button class="btn" id="licSkipBtn">Trotzdem fortfahren</button>
                <button class="btn btn-primary" id="licRenewBtn">Lizenz erneuern</button>
            </div>
        `;
        overlay.classList.add('active');

        document.getElementById('licSkipBtn').addEventListener('click', () => {
            overlay.classList.remove('active');
            onValid(this._cachedData);
        });

        document.getElementById('licRenewBtn').addEventListener('click', async () => {
            const input  = document.getElementById('licRenewInput').value.trim();
            const errBox = document.getElementById('licRenewError');
            if (!input) { errBox.textContent = 'Bitte neuen Schlüssel eingeben.'; errBox.style.display = ''; return; }
            try {
                const data = await this._verify(input);
                const days = Math.ceil((new Date(data.expires) - new Date()) / 86400000);
                if (days < 0) throw new Error('Dieser Schlüssel ist ebenfalls abgelaufen.');
                localStorage.setItem(this._LS_KEY, input);
                this._cachedData = data;
                overlay.classList.remove('active');
                onValid(data);
            } catch (e) {
                errBox.textContent = '❌ ' + (e.message || 'Ungültig');
                errBox.style.display = '';
            }
        });
    },

    // ── Hilfsfunktionen ───────────────────────────────────────
    _b64urlToBytes(b64url) {
        const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
        const padded = b64 + '='.repeat((4 - b64.length % 4) % 4);
        const binary = atob(padded);
        return Uint8Array.from(binary, c => c.charCodeAt(0));
    },
};
