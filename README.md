# Sky Sweep

The sky above you, played back as music. A radar beam sweeps the air around wherever you are, and each plane it passes sounds a note.

- `index.html` is the whole page: radar map, sweep, score, and sound. It asks for your location (rounded to about 7 miles on your device) or a place you search for.
- `netlify/functions/near.mts` fetches aircraft within 250 nm of that rough area from [adsb.lol](https://adsb.lol), a community network of volunteer ADS-B receivers, and caches each area for a few seconds.
- The beam widens or narrows to reach about two dozen planes and adjusts its speed to keep roughly 40 to 100 notes a minute. The page plays the sky back 45 seconds behind real time so each plane sits between two known positions.

Map outlines from Natural Earth and the U.S. Census Bureau (via us-atlas and world-atlas). Place search by OpenStreetMap Nominatim.
