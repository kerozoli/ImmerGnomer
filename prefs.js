import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';

import {ExtensionPreferences, gettext as _}
    from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class ImmerGnomerPreferences extends ExtensionPreferences {

    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        window.set_default_size(600, 400);
        window.title = 'ImmerGnomer Settings';

        // ── Page ─────────────────────────────────────────────────────────────
        const page = new Adw.PreferencesPage({
            title: 'General',
            icon_name: 'dialog-settings-symbolic',
        });
        window.add(page);

        // ── API group ─────────────────────────────────────────────────────────
        const apiGroup = new Adw.PreferencesGroup({
            title: 'REST API',
            description: 'Configure the ImmerReader heater API connection',
        });
        page.add(apiGroup);

        // API URL entry
        const urlRow = new Adw.EntryRow({
            title: 'API URL',
            show_apply_button: true,
        });
        settings.bind('api-url', urlRow, 'text', Gio.SettingsBindFlags.DEFAULT);
        apiGroup.add(urlRow);

        // ── Polling group ────────────────────────────────────────────────────
        const pollGroup = new Adw.PreferencesGroup({
            title: 'Polling',
            description: 'How often the extension queries the heater status',
        });
        page.add(pollGroup);

        // Poll interval spin row
        const spinRow = new Adw.SpinRow({
            title: 'Poll Interval',
            subtitle: 'Seconds between API requests (5–300)',
            adjustment: new Gtk.Adjustment({
                lower: 5,
                upper: 300,
                step_increment: 5,
                value: settings.get_int('poll-interval'),
            }),
        });
        settings.bind(
            'poll-interval',
            spinRow,
            'value',
            Gio.SettingsBindFlags.DEFAULT
        );
        pollGroup.add(spinRow);

        // ── Legend group ─────────────────────────────────────────────────────
        const legendGroup = new Adw.PreferencesGroup({
            title: 'Flame Colour Legend',
            description: 'Panel icon colour reflects the throttle level',
        });
        page.add(legendGroup);

        const LEGEND = [
            ['Throttle 0', '❄  White — idle / cold'],
            ['Throttle 1', '🔥  Pale Yellow — low'],
            ['Throttle 2', '🔥  Amber Orange — medium'],
            ['Throttle 3', '🔥  Deep Orange — high'],
            ['Throttle 4', '🔥  Hot Red — maximum'],
        ];

        for (const [title, subtitle] of LEGEND) {
            const row = new Adw.ActionRow({title, subtitle, activatable: false});
            legendGroup.add(row);
        }
    }
}
