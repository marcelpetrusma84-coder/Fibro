# Reference chess artwork

The three-player board and the piece drawings reproduce the supplied reference
from [Green Chess](https://greenchess.net/variant/8yalta.png).

Board and adapted pieces: **Uray M. János / Green Chess**.
License: [Creative Commons Attribution–ShareAlike 3.0 Unported](https://creativecommons.org/licenses/by-sa/3.0/).
The original author notices are retained in the SVG files.

Sources:

- [Artwork downloads and license](https://greenchess.net/info.php?item=downloads)
- [Original board archive](https://greenchess.net/zip/boards-other-svg.zip), `yalta3.svg`
- [Original standard piece archive](https://greenchess.net/zip/pieces-basic-svg.zip)
- The piece files identify their original Wikipedia chess-piece drawings, based
  on Colin M. L. Burnett's chess artwork.

Changes: the external SVG DTD declarations were removed; red pieces were made
from the original white pieces by changing the white fill to `#ff6666`.
The manually shaped grid coordinates in `schaak-drie.js` are taken from the
original board. These artwork adaptations retain the CC BY-SA 3.0 license.

`glass/` contains the same piece contours with translucent red glass, gray smoke
glass and milky white glass, sharp illuminated rims and small neon halos.
These derivatives also retain CC BY-SA 3.0 and the original SVG notices.
Regenerate them with `node tools/generate-chess-glass.mjs`; the original artwork
in this directory remains available for comparison.

`tests/fixtures/chess-three-reference.png` is the original starting-position
image, retained as a visual reference under the same license.
