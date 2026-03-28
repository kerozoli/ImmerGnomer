# ImmerGnomer

A GNOME Shell extension (GNOME 45–50) that displays the live status of your
**ImmerReader** heater in the top panel.

## Features

| Feature | Detail |
|---|---|
| Panel icon | Flame (🔥) or snowflake (❄) coloured by throttle level |
| Throttle 0 | White — idle / cold |
| Throttle 1 | Pale yellow — low heat |
| Throttle 2 | Amber orange — medium heat |
| Throttle 3 | Deep orange — high heat |
| Throttle 4 | Hot red — maximum heat |
| Drop-down | Temperature, throttle bar, heating & boiler state, last-update time |
| Settings | Configurable API URL and poll interval (5–300 s) |

## REST API

The extension polls a JSON endpoint that returns:

```json
{
  "temperaute": 55,
  "throttle":   3,
  "heating":    true,
  "boilerOn":   false
}
```

*(Field name `temperaute` matches the Java model — the extension accepts both
`temperaute` and `temperature`.)*

## Installation

Download the latest `immergnomer@immerreader.local.zip` from the
[Releases](../../releases) page, then:

```bash
gnome-extensions install immergnomer@immerreader.local.zip
gnome-extensions enable immergnomer@immerreader.local
```

Then open **Settings → Extensions → ImmerGnomer → ⚙** to enter your API URL.

## Release

A GitHub Actions workflow (`.github/workflows/release.yml`) builds and
publishes a release automatically whenever a version tag is pushed:

```bash
git tag v1.0.0
git push origin v1.0.0
```

This compiles the GSettings schema, zips the extension files, and attaches the
zip to a new GitHub Release.

## Development / Testing (Wayland)

```bash
dbus-run-session -- gnome-shell --nested --wayland
```

Open a second terminal in the nested session and enable the extension there.

## Files

```
ImmerGnomer/
├── extension.js                    Main extension
├── prefs.js                        Preferences window (GTK4 / Adwaita)
├── metadata.json                   Extension metadata
├── .github/workflows/release.yml  Release workflow
└── schemas/
    └── org.gnome.shell.extensions.immergnomer.gschema.xml
```
