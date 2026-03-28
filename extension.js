import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Soup from 'gi://Soup';
import Clutter from 'gi://Clutter';
import St from 'gi://St';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

// ─── Flame colour palette ────────────────────────────────────────────────────
// throttle 0  → white  (no heat / idle)
// throttle 1  → pale yellow
// throttle 2  → warm yellow‑orange
// throttle 3  → deep orange
// throttle 4  → vivid red
const THROTTLE_COLORS = [
    '#FFFFFF', // 0 – white  (cold / idle)
    '#FFE566', // 1 – pale yellow
    '#FFAB2E', // 2 – amber orange
    '#FF6A00', // 3 – deep orange
    '#FF1F1F', // 4 – hot red
];

// Unicode flame characters we draw in the panel label
const FLAME = '🔥';
const SNOWFLAKE = '❄';   // shown when not heating & throttle 0

// ─── Indicator class ─────────────────────────────────────────────────────────
const ImmerIndicator = GObject.registerClass(
class ImmerIndicator extends PanelMenu.Button {

    _init(settings) {
        super._init(0.0, 'ImmerGnomer');

        this._settings = settings;

        // ── Panel label ──────────────────────────────────────────────────────
        this._label = new St.Label({
            text: '…',
            y_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
            style: 'font-size: 14px; padding: 0 4px;',
        });
        this.add_child(this._label);

        // ── Drop-down popup ──────────────────────────────────────────────────
        this._buildMenu();
    }

    _buildMenu() {
        // Title row
        const titleItem = new PopupMenu.PopupMenuItem('ImmerReader Status', {reactive: false});
        titleItem.label.style = 'font-weight: bold; font-size: 12px;';
        this.menu.addMenuItem(titleItem);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Status rows (updated dynamically)
        this._tempItem      = this._addRow('🌡  Temperature', '—');
        this._throttleItem  = this._addRow('🔥  Throttle',    '—');
        this._heatingItem   = this._addRow('♨  Heating',     '—');
        this._boilerItem    = this._addRow('🪣  Boiler',      '—');

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Last-updated timestamp
        this._updatedItem = this._addRow('🕐  Updated', 'never');

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Quick links
        const prefItem = new PopupMenu.PopupMenuItem('⚙  Settings…');
        prefItem.connect('activate', () => {
            this._extension.openPreferences();
        });
        this.menu.addMenuItem(prefItem);
    }

    _addRow(label, value) {
        const item = new PopupMenu.PopupMenuItem(`${label}: ${value}`, {reactive: false});
        item._labelText = label;
        item._valueText = value;
        this.menu.addMenuItem(item);
        return item;
    }

    _updateRow(item, value) {
        item.label.text = `${item._labelText}: ${value}`;
        item._valueText = value;
    }

    // Called by the extension after a successful API fetch
    update(data) {
        const {temperature, throttle, heating, boilerOn} = data;

        // Hide the whole indicator when the heater is off
        this.visible = heating;
        if (!heating) return;

        // ── Panel indicator ──────────────────────────────────────────────────
        const clamped  = Math.max(0, Math.min(4, throttle));
        const color    = THROTTLE_COLORS[clamped];

        this._label.text  = `${FLAME} ${temperature}°C`;
        this._label.style = `font-size: 14px; padding: 0 4px; color: ${color};`;

        // ── Popup rows ───────────────────────────────────────────────────────
        this._updateRow(this._tempItem,     `${temperature} °C`);
        this._updateRow(this._throttleItem, `${clamped}/4  ${this._throttleBar(clamped)}`);
        this._updateRow(this._heatingItem,  '✔ Yes');
        this._updateRow(this._boilerItem,   boilerOn ? '✔ On'  : '✘ Off');

        const now = new Date();
        this._updateRow(this._updatedItem,
            `${now.getHours().toString().padStart(2,'0')}:` +
            `${now.getMinutes().toString().padStart(2,'0')}:` +
            `${now.getSeconds().toString().padStart(2,'0')}`);
    }

    // Simple text progress bar: ■■■□□
    _throttleBar(level) {
        const filled  = '■'.repeat(level);
        const empty   = '□'.repeat(4 - level);
        return filled + empty;
    }

    showError(msg) {
        this._label.text  = '⚠ —';
        this._label.style = 'font-size: 14px; padding: 0 4px; color: #FF5555;';
        this._updateRow(this._updatedItem, `Error: ${msg}`);
    }
});


// ─── Main Extension ───────────────────────────────────────────────────────────
export default class ImmerGnomerExtension extends Extension {

    enable() {
        this._settings = this.getSettings();

        this._indicator = new ImmerIndicator(this._settings);
        this._indicator._extension = this;   // back-ref for openPreferences()

        Main.panel.addToStatusArea(this.uuid, this._indicator);

        // Start polling
        this._poll();
        this._pollTimer = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            this._settings.get_int('poll-interval'),
            () => { this._poll(); return GLib.SOURCE_CONTINUE; }
        );

        // Re-start the timer if the interval changes in preferences
        this._settingsChangedId = this._settings.connect('changed::poll-interval', () => {
            if (this._pollTimer) {
                GLib.source_remove(this._pollTimer);
                this._pollTimer = null;
            }
            this._pollTimer = GLib.timeout_add_seconds(
                GLib.PRIORITY_DEFAULT,
                this._settings.get_int('poll-interval'),
                () => { this._poll(); return GLib.SOURCE_CONTINUE; }
            );
        });
    }

    disable() {
        if (this._pollTimer) {
            GLib.source_remove(this._pollTimer);
            this._pollTimer = null;
        }
        if (this._settingsChangedId && this._settings) {
            this._settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = null;
        }
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
        this._settings = null;
    }

    _poll() {
        const url = this._settings.get_string('api-url');
        this._fetchStatus(url);
    }

    _fetchStatus(url) {
        try {
            const session  = new Soup.Session();
            const message  = Soup.Message.new('GET', url);
            message.request_headers.append('Accept', 'application/json');

            session.send_and_read_async(
                message,
                GLib.PRIORITY_DEFAULT,
                null,
                (sess, result) => {
                    try {
                        const bytes = sess.send_and_read_finish(result);
                        if (message.status_code !== 200) {
                            this._indicator?.showError(`HTTP ${message.status_code}`);
                            return;
                        }
                        const text = new TextDecoder().decode(bytes.get_data());
                        const json = JSON.parse(text);

                        // Map Java-style field names (camelCase)
                        // The REST API returns: { "temperaute": 55, "throttle": 3,
                        //                         "heating": true, "boilerOn": false }
                        this._indicator?.update({
                            temperature : json.temperaute ?? json.temperature ?? 0,
                            throttle    : json.throttle   ?? 0,
                            heating     : json.heating    ?? false,
                            boilerOn    : json.boilerOn   ?? false,
                        });
                    } catch (e) {
                        this._indicator?.showError(e.message.substring(0, 40));
                    }
                }
            );
        } catch (e) {
            this._indicator?.showError(e.message.substring(0, 40));
        }
    }
}
