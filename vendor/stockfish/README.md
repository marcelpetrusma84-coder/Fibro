# Stockfish.js 19.0.1 — lite, single-threaded

Unmodified release files from
https://github.com/nmrugg/stockfish.js/releases/tag/v19.0.1.
The engine is Stockfish 19, built by Nathan Rugg / Chess.com and the Stockfish
contributors. License: GPL v3; see `Copying.txt` and `AUTHORS` in this directory.

`manifest.json` records the exact download URLs, byte lengths and SHA-256 hashes.
The matching JavaScript and WebAssembly files must stay together. Fibro loads
them as a classic Web Worker only for Ultra chess; other levels do not download
the engine. This single-threaded edition requires no cross-origin isolation.

The complete corresponding upstream source release is provided alongside the
binary as `stockfish-19.0.1-source.tar.gz`, including the C++ engine, browser
wrapper, build script and build instructions. The matching original NNUE model
is also supplied as `nn-61e7af4bb97d.nnue` (SHA-256 recorded in the manifest).
For rebuilding, extract the source archive, copy this model into its `src/`
directory and follow its README using Emscripten 6.0.9:

```
node build.js --lite --single-threaded --no-split
```

The upstream model source is Fishtest
(`https://tests.stockfishchess.org/api/nn/nn-61e7af4bb97d.nnue`). The supplied
model was recovered byte for byte from the unmodified release WASM's data
segments; its SHA-256 begins `61e7af4bb97d`, independently confirming the exact
upstream network identity. It is already embedded in the shipped WASM and
requires no runtime download.
Source and build tooling are also available at
https://github.com/nmrugg/stockfish.js/tree/v19.0.1.
