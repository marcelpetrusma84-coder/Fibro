# Chess table wallpaper

`walnut-table-room.png` is the unmodified reference photo supplied by the user.
`walnut-table-room-3d.png` is the enhanced wallpaper, edited with the built-in
imagegen tool on 2 November 2026. The reference remains intact. The edited image
keeps the room, viewpoint and table, with stronger walnut relief, slab highlights
and contact shadows. See [the generation prompt](wallpaper-generation.md).

The app loads the enhanced image locally only when the wallpaper is enabled.
It starts enabled on devices without an existing preference; the menu can turn
it off, and that choice is preserved. Sensor permission is never requested
automatically just because the background is enabled by default.
`schaak-wallpaper-depth.js` renders a single textured depth mesh: the nearby slab
and pedestal move more than the distant room, without duplicated image layers.
The CSS photo remains the fallback when WebGL is unavailable or loses context.
Motion is implemented in `schaak-wallpaper.js`; no Pixel 4D app code, service,
sensor telemetry or external image request is used.
