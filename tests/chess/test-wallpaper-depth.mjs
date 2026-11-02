import assert from 'node:assert/strict'
import { maakWallpaperDepth, wallpaperCover, wallpaperDepthAt } from '../../schaak-wallpaper-depth.js'

class Events {
  listeners = new Map()
  addEventListener(name, fn) { if (!this.listeners.has(name)) this.listeners.set(name, new Set()); this.listeners.get(name).add(fn) }
  removeEventListener(name, fn) { this.listeners.get(name)?.delete(fn) }
  emit(name) { for (const fn of [...(this.listeners.get(name) || [])]) fn() }
  count() { return [...this.listeners.values()].reduce((sum, values) => sum + values.size, 0) }
}
function fixture({ context = true, shader = true, linked = true, upload = true, observer = true, width = 1000, height = 800, dpr = 3 } = {}) {
  const calls = [], deleted = [], images = [], observers = [], window = new Events()
  let id = 0
  const gl = {
    VERTEX_SHADER:1, FRAGMENT_SHADER:2, COMPILE_STATUS:3, LINK_STATUS:4, ARRAY_BUFFER:5, ELEMENT_ARRAY_BUFFER:6, STATIC_DRAW:7,
    FLOAT:8, TEXTURE0:9, TEXTURE_2D:10, TEXTURE_MIN_FILTER:11, TEXTURE_MAG_FILTER:12, LINEAR:13, TEXTURE_WRAP_S:14, TEXTURE_WRAP_T:15,
    CLAMP_TO_EDGE:16, UNPACK_FLIP_Y_WEBGL:17, RGBA:18, UNSIGNED_BYTE:19, COLOR_BUFFER_BIT:20, TRIANGLES:21, UNSIGNED_SHORT:22, NO_ERROR:0,
    createShader:() => ({ id:++id, kind:'shader' }), createProgram:() => ({ id:++id, kind:'program' }), createBuffer:() => ({ id:++id, kind:'buffer' }), createTexture:() => ({ id:++id, kind:'texture' }),
    getShaderParameter:() => shader, getProgramParameter:() => linked,
    getAttribLocation:(_, name) => ({ aPosition:0, aUv:1, aDepth:2 })[name], getUniformLocation:(_, name) => name,
    getError:() => upload ? 0 : 1285,
    getExtension(name) { calls.push(['extension', name]); return { loseContext:() => calls.push(['loseContext']) } },
  }
  for (const method of ['shaderSource','compileShader','attachShader','linkProgram','useProgram','bindBuffer','bufferData','enableVertexAttribArray','vertexAttribPointer','uniform1i','activeTexture','bindTexture','texParameteri','clearColor','pixelStorei','texImage2D','viewport','uniform2f','clear','drawElements']) gl[method] = (...args) => calls.push([method, ...args])
  for (const method of ['deleteShader','deleteProgram','deleteBuffer','deleteTexture']) gl[method] = value => deleted.push(value)
  const host = {
    clientWidth:width, clientHeight:height, children:[], style:{ backgroundImage:'url(photo.png)', transform:'translate3d(1px,2px,0)' },
    append(child) { this.children.push(child); child.parent = this }
  }
  const canvas = new Events()
  canvas.style = {}; canvas.setAttribute = () => {}
  canvas.getContext = (name, options) => { calls.push(['getContext', name, options]); return context ? gl : null }
  canvas.remove = () => { host.children = host.children.filter(child => child !== canvas) }
  const document = { createElement(tag) { assert.equal(tag, 'canvas'); return canvas } }
  window.Image = class {
    constructor() { images.push(this); this.naturalWidth = 941; this.naturalHeight = 1672 }
    set src(value) { this.url = value }
  }
  if (observer) window.ResizeObserver = class { constructor(fn) { this.callback = fn; observers.push(this) } observe(value) { this.host = value } disconnect() { this.disconnected = true } }
  window.devicePixelRatio = dpr
  window.requestAnimationFrame = () => { throw Error('renderer must not create an animation loop') }
  let readyCalls = 0
  const before = { ...host.style }
  const renderer = maakWallpaperDepth({ host, doc:document, win:window, imageUrl:'assets/chess/walnut-table-room-3d.png', onReady:() => readyCalls++ })
  return { renderer, host, canvas, gl, window, calls, deleted, images, observers, before, get readyCalls() { return readyCalls }, load() { images[0].onload() }, draws:() => calls.filter(([name]) => name === 'drawElements') }
}

// Physical ordering is consistent with the visible subject, even after a
// viewport crop: near slab/pedestal > receding table > far window/wall.
const windowDepth = wallpaperDepthAt(.68,.25), backTable = wallpaperDepthAt(.78,.45), nearTable = wallpaperDepthAt(.58,.65), pedestal = wallpaperDepthAt(.60,.77)
assert(windowDepth < backTable && backTable < nearTable && windowDepth < pedestal)
for (let y = 0; y <= 1; y += .01) for (let x = 0; x <= 1; x += .01) {
  const depth = wallpaperDepthAt(x, y)
  assert(depth >= 0 && depth <= 1, 'the mesh has bounded depth across the entire portrait')
  assert(Math.abs(depth - wallpaperDepthAt(x + .001, y)) < .05, 'the table silhouette is continuous rather than a torn/doubled layer')
}
const portrait = wallpaperCover(941, 1672, 941, 1672)
assert.deepEqual(portrait, { x:0, y:0, width:1, height:1 })
const wide = wallpaperCover(1200, 600, 941, 1672)
assert.equal(wide.width, 1)
assert.equal(wide.y, (1 - wide.height) * .58)
const narrow = wallpaperCover(300, 900, 941, 1672)
assert.equal(narrow.height, 1)
assert.equal(narrow.x, (1 - narrow.width) * .5)

const f = fixture()
assert.equal(f.renderer.ready, false)
assert.equal(f.canvas.style.visibility, undefined, 'canvas stays hidden in cssText until a successful draw')
assert.equal(f.draws().length, 0, 'CSS photograph stays visible while the texture is loading')
assert.equal(f.images.length, 1)
assert.equal(f.images[0].url, 'assets/chess/walnut-table-room-3d.png')
f.renderer.paint(.5, -.25)
f.load()
assert.equal(f.renderer.ready, true)
assert.equal(f.readyCalls, 1)
assert.equal(f.canvas.style.visibility, 'visible')
assert.equal(f.observers[0].host, f.host)
assert.equal(f.canvas.width, 1500)
assert.equal(f.canvas.height, 1200)
assert.equal(f.draws().length, 1)
assert.deepEqual(f.calls.filter(([method, uniform]) => method === 'uniform2f' && uniform === 'uMotion').at(-1), ['uniform2f', 'uMotion', .5, -.25])
assert(f.calls.filter(([method, target]) => method === 'bufferData' && target === f.gl.ARRAY_BUFFER).at(-1)[2] instanceof Float32Array)
const indexData = f.calls.find(([method, target]) => method === 'bufferData' && target === f.gl.ELEMENT_ARRAY_BUFFER)[2]
assert.equal(indexData.length, 48 * 80 * 6)
assert(Math.max(...indexData) < 65536)
f.renderer.paint(20, -20)
assert.deepEqual(f.calls.filter(([method, uniform]) => method === 'uniform2f' && uniform === 'uMotion').at(-1), ['uniform2f', 'uMotion', 1, -1], 'input cannot produce unbounded distortion')
f.host.clientWidth = 4000; f.host.clientHeight = 2200; f.observers[0].callback()
assert(f.canvas.width * f.canvas.height <= 2_000_000, 'total pixels are bounded on high-DPI and large monitors')
assert.deepEqual(f.host.style, f.before, 'renderer never changes the host, board, or fallback photograph styles')
assert.equal(f.canvas.count(), 1)
f.renderer.destroy(); f.renderer.destroy()
assert.equal(f.renderer.ready, false)
assert.equal(f.host.children.length, 0)
assert.equal(f.observers[0].disconnected, true)
assert.equal(f.canvas.count(), 0)
assert.equal(f.deleted.filter(value => value.kind === 'texture').length, 1)
assert.equal(f.deleted.filter(value => value.kind === 'buffer').length, 2)
assert.equal(f.deleted.filter(value => value.kind === 'program').length, 1)
assert.equal(f.deleted.filter(value => value.kind === 'shader').length, 2)
const drawCount = f.draws().length
f.renderer.paint(1, 1)
assert.equal(f.draws().length, drawCount, 'disposed renderers cannot draw again')

const beforeLoad = fixture()
const lateLoad = beforeLoad.images[0].onload
beforeLoad.renderer.destroy(); lateLoad()
assert.equal(beforeLoad.images[0].onload, null)
assert.equal(beforeLoad.images[0].onerror, null)
assert.equal(beforeLoad.draws().length, 0)
assert.equal(beforeLoad.readyCalls, 0, 'an obsolete image decode cannot revive a previous game')

for (const settings of [{ context:false }, { shader:false }, { linked:false }, { upload:false }]) {
  const failed = fixture(settings)
  if (settings.upload === false) failed.load()
  assert.equal(failed.renderer.ready, false)
  assert.equal(failed.host.children.length, 0, 'the CSS photograph is the fallback after any GPU initialization/upload failure')
  assert.deepEqual(failed.host.style, failed.before)
  failed.renderer.paint(1, 1); failed.renderer.destroy()
}
const imageError = fixture(); imageError.images[0].onerror()
assert.equal(imageError.host.children.length, 0)
assert.equal(imageError.readyCalls, 0)
const lost = fixture(); lost.load(); lost.canvas.emit('webglcontextlost')
assert.equal(lost.host.children.length, 0)
assert.equal(lost.renderer.ready, false)
assert.equal(lost.observers[0].disconnected, true)
assert.equal(lost.canvas.count(), 0)
const fallbackResize = fixture({ observer:false }); fallbackResize.load()
assert.equal(fallbackResize.window.count(), 1)
fallbackResize.host.clientHeight = 500; fallbackResize.window.emit('resize')
assert.equal(fallbackResize.canvas.height, 750)
fallbackResize.renderer.destroy()
assert.equal(fallbackResize.window.count(), 0)
const hidden = fixture({ width:0, height:0 }); hidden.load()
assert.equal(hidden.draws().length, 0)
hidden.host.clientWidth = 500; hidden.host.clientHeight = 500; hidden.observers[0].callback()
assert.equal(hidden.draws().length, 1, 'a hidden game can reveal the image after its layout becomes measurable')
hidden.renderer.destroy()
assert.doesNotThrow(() => maakWallpaperDepth().destroy())
console.log('Wallpaper depth: crop, physical depth, bounded rendering, fallback and lifecycle passed')
