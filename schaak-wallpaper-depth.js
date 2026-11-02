const clamp = (value, minimum = 0, maximum = 1) => Math.max(minimum, Math.min(maximum, value))
const smooth = (start, end, value) => { const t = clamp((value - start) / (end - start)); return t * t * (3 - 2 * t) }

// Image-space outlines for the supplied room: the slab and its pedestal are
// closer than the window and wall. A continuous mesh keeps a single silhouette;
// there is no duplicate table layer sliding across the original photograph.
const TABLE = [[-.02,.58],[.59,.408],[1.03,.414],[.944,.478],[.956,.738],[.015,.632]]
const PEDESTAL = [[.32,.644],[.80,.700],[.764,.823],[.308,.773]]
function signedDistance(polygon, x, y) {
  let inside = false, distance = Infinity
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [ax, ay] = polygon[j], [bx, by] = polygon[i]
    const dx = bx - ax, dy = by - ay
    const t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy))
    distance = Math.min(distance, Math.hypot(x - ax - t * dx, y - ay - t * dy))
    if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside
  }
  return (inside ? 1 : -1) * distance
}

export function wallpaperDepthAt(u, v) {
  const room = .12 + .13 * (1 - clamp(u)) + .64 * smooth(.76, 1, v)
  const slab = smooth(-.018, .024, signedDistance(TABLE, u, v))
  const pedestal = smooth(-.015, .022, signedDistance(PEDESTAL, u, v))
  const tableDepth = .34 + .60 * smooth(.40, .72, v)
  return clamp(Math.max(room, room + (tableDepth - room) * slab, room + (.88 - room) * pedestal))
}

// Match background-size:cover; background-position:center 58% in the fallback.
// Depth is sampled after this crop, in original image coordinates, so rotating
// the phone or using a wide monitor cannot move the table's depth onto the wall.
export function wallpaperCover(width, height, imageWidth, imageHeight) {
  const scale = Math.max(width / imageWidth, height / imageHeight)
  const scaledWidth = imageWidth * scale, scaledHeight = imageHeight * scale
  return { x:(scaledWidth - width) * .5 / scaledWidth, y:(scaledHeight - height) * .58 / scaledHeight, width:width / scaledWidth, height:height / scaledHeight }
}

const VERTEX = `
attribute vec2 aPosition;
attribute vec2 aUv;
attribute float aDepth;
uniform vec2 uMotion;
uniform vec2 uStrength;
varying vec2 vUv;
void main() {
  vUv = aUv;
  gl_Position = vec4(aPosition + vec2(uMotion.x, -uMotion.y) * uStrength * aDepth, 0.0, 1.0);
}`
const FRAGMENT = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uImage;
varying vec2 vUv;
void main() { gl_FragColor = texture2D(uImage, vUv); }
`

// The owning wallpaper drives paint() from its existing, finite animation. This
// renderer never starts an animation loop and never touches the board or input.
// A normal CSS background stays underneath until the first successful draw.
export function maakWallpaperDepth({ host, doc = host?.ownerDocument, win = doc?.defaultView, imageUrl, onReady } = {}) {
  let canvas = null, gl = null, image = null, program = null, vertices = null, indices = null, texture = null, observer = null
  let ready = false, destroyed = false, cssWidth = 0, cssHeight = 0, count = 0, x = 0, y = 0
  let motionUniform = null, strengthUniform = null
  const shaders = [], cleanups = []
  const api = { paint, destroy, get ready() { return ready } }
  function destroy() {
    if (destroyed) return
    destroyed = true; ready = false
    if (image) { image.onload = null; image.onerror = null; image = null }
    observer?.disconnect(); observer = null
    while (cleanups.length) cleanups.pop()()
    if (gl) {
      try {
        if (texture) gl.deleteTexture(texture)
        if (vertices) gl.deleteBuffer(vertices)
        if (indices) gl.deleteBuffer(indices)
        if (program) gl.deleteProgram(program)
        for (const shader of shaders) gl.deleteShader(shader)
        gl.getExtension('WEBGL_lose_context')?.loseContext()
      } catch { /* a lost context has already released its resources */ }
    }
    canvas?.remove(); canvas = null; gl = null
  }
  function compile(type, source) {
    const shader = gl.createShader(type)
    if (!shader) throw Error('shader unavailable')
    shaders.push(shader); gl.shaderSource(shader, source); gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw Error('shader unavailable')
    return shader
  }
  function size() {
    const width = host.clientWidth || 0, height = host.clientHeight || 0
    if (width <= 0 || height <= 0) return false
    if (width === cssWidth && height === cssHeight) return true
    cssWidth = width; cssHeight = height
    // Bound both DPR and total pixels: the wallpaper does not need to render a
    // 4K phone panel at native resolution behind the board and controls.
    const ratio = Math.min(Number(win?.devicePixelRatio) || 1, 1.5, Math.sqrt(2_000_000 / (width * height)))
    canvas.width = Math.max(1, Math.floor(width * ratio)); canvas.height = Math.max(1, Math.floor(height * ratio))
    gl.viewport(0, 0, canvas.width, canvas.height)
    const crop = wallpaperCover(width, height, image.naturalWidth || image.width, image.naturalHeight || image.height)
    const columns = 48, rows = 80, data = new Float32Array((columns + 1) * (rows + 1) * 5)
    let offset = 0
    for (let row = 0; row <= rows; row++) for (let column = 0; column <= columns; column++) {
      const px = column / columns, py = row / rows, u = crop.x + px * crop.width, v = crop.y + py * crop.height
      // Pin the outside border; it lies beyond the viewport in the owner's
      // overscan, and prevents transparent edge seams at an extreme tilt.
      const edge = smooth(0, .045, px) * smooth(0, .045, 1 - px) * smooth(0, .045, py) * smooth(0, .045, 1 - py)
      data[offset++] = px * 2 - 1; data[offset++] = 1 - py * 2
      data[offset++] = u; data[offset++] = v; data[offset++] = wallpaperDepthAt(u, v) * edge
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, vertices); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
    gl.uniform2f(strengthUniform, 40 / width, 30 / height)
    return true
  }
  function paint(nextX = x, nextY = y) {
    x = Number.isFinite(nextX) ? clamp(nextX, -1, 1) : 0
    y = Number.isFinite(nextY) ? clamp(nextY, -1, 1) : 0
    if (!ready || destroyed || !gl) return
    try {
      if (!size()) return
      gl.uniform2f(motionUniform, x, y)
      gl.clear(gl.COLOR_BUFFER_BIT); gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, 0)
      canvas.style.visibility = 'visible'
    } catch { destroy() }
  }
  try {
    if (!host || !doc?.createElement || !imageUrl) return api
    canvas = doc.createElement('canvas')
    canvas.className = 'sch-wallpaper-depth'; canvas.setAttribute('aria-hidden', 'true')
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;visibility:hidden;pointer-events:none;'
    gl = canvas.getContext?.('webgl', { alpha:true, antialias:false, depth:false, stencil:false, preserveDrawingBuffer:false, powerPreference:'low-power' })
    if (!gl) { destroy(); return api }
    const vertex = compile(gl.VERTEX_SHADER, VERTEX), fragment = compile(gl.FRAGMENT_SHADER, FRAGMENT)
    program = gl.createProgram(); if (!program) throw Error('program unavailable')
    gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error('program unavailable')
    gl.useProgram(program)
    vertices = gl.createBuffer(); indices = gl.createBuffer(); texture = gl.createTexture()
    if (!vertices || !indices || !texture) throw Error('resources unavailable')
    gl.bindBuffer(gl.ARRAY_BUFFER, vertices)
    for (const [name, length, offset] of [['aPosition',2,0],['aUv',2,8],['aDepth',1,16]]) {
      const location = gl.getAttribLocation(program, name)
      if (location < 0) throw Error('attribute unavailable')
      gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, length, gl.FLOAT, false, 20, offset)
    }
    const data = new Uint16Array(48 * 80 * 6); let offset = 0
    for (let row = 0; row < 80; row++) for (let column = 0; column < 48; column++) {
      const a = row * 49 + column, b = a + 1, c = a + 49, d = c + 1
      for (const index of [a,c,b,b,c,d]) data[offset++] = index
    }
    count = data.length
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data, gl.STATIC_DRAW)
    motionUniform = gl.getUniformLocation(program, 'uMotion'); strengthUniform = gl.getUniformLocation(program, 'uStrength')
    gl.uniform1i(gl.getUniformLocation(program, 'uImage'), 0)
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.clearColor(0, 0, 0, 0)
    const lost = () => destroy()
    canvas.addEventListener('webglcontextlost', lost); cleanups.push(() => canvas?.removeEventListener('webglcontextlost', lost))
    host.append(canvas)
    image = win?.Image ? new win.Image() : doc.createElement('img')
    image.decoding = 'async'
    image.onload = () => {
      if (destroyed) return
      try {
        if (!(image.naturalWidth || image.width) || !(image.naturalHeight || image.height)) throw Error('image unavailable')
        // Mesh UVs deliberately use the photo's top-left origin.
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
        if (gl.getError() !== gl.NO_ERROR) throw Error('texture unavailable')
        ready = true; paint()
        if (destroyed) return
        const resize = () => paint()
        if (win?.ResizeObserver) { observer = new win.ResizeObserver(resize); observer.observe(host) }
        else if (win?.addEventListener) { win.addEventListener('resize', resize, { passive:true }); cleanups.push(() => win.removeEventListener('resize', resize)) }
        try { onReady?.() } catch { /* appearance must not interrupt the game */ }
      } catch { destroy() }
    }
    image.onerror = destroy
    image.src = imageUrl
  } catch { destroy() }
  return api
}
