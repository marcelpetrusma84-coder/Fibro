import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

// A small DOM fixture exercises the shared controller without opening cameras,
// signing in, or relying on a browser's media permissions.
class Node extends EventTarget {
  constructor(name = 'div') {
    super()
    this.nodeName = name
    this.children = []
    this.parentElement = null
    this.dataset = {}
    this.attrs = new Map()
    this.classes = new Set()
    this.values = new Map()
    this.style = {
      getPropertyValue: name => this.values.get(name) || '',
      getPropertyPriority: () => '',
      setProperty: (name, value) => this.values.set(name, value),
      removeProperty: name => this.values.delete(name)
    }
    this.classList = {
      add: (...names) => names.forEach(name => this.classes.add(name)),
      remove: (...names) => names.forEach(name => this.classes.delete(name)),
      contains: name => this.classes.has(name),
      toggle: (name, force = !this.classes.has(name)) => {
        if (force) this.classes.add(name)
        else this.classes.delete(name)
        return force
      }
    }
    this.clientHeight = 800
    this.scrollHeight = 1400
    this.scrollTop = 0
    this.width = 360
    this.visible = true
  }
  get className() { return [...this.classes].join(' ') }
  set className(value) { this.classes = new Set(value.split(/\s+/)) }
  get previousSibling() { return this.parentElement?.children[this.parentElement.children.indexOf(this) - 1] || null }
  setAttribute(name, value) { this.attrs.set(name, String(value)) }
  getAttribute(name) { return this.attrs.get(name) ?? null }
  removeAttribute(name) { this.attrs.delete(name) }
  append(...nodes) {
    for (const node of nodes) { node.remove(); this.children.push(node); node.parentElement = this }
  }
  insertBefore(node, sibling) {
    node.remove()
    this.children.splice(this.children.indexOf(sibling), 0, node)
    node.parentElement = this
  }
  before(node) { this.parentElement.insertBefore(node, this) }
  after(node) {
    const parent = this.parentElement
    const next = parent.children[parent.children.indexOf(this) + 1]
    if (next) parent.insertBefore(node, next)
    else parent.append(node)
  }
  remove() {
    if (!this.parentElement) return
    const siblings = this.parentElement.children
    siblings.splice(siblings.indexOf(this), 1)
    this.parentElement = null
  }
  querySelectorAll(selector) {
    const target = selector.split(' ').at(-1)
    const result = []
    const visit = node => {
      for (const child of node.children) {
        if (target.startsWith('.') && child.classList.contains(target.slice(1))) result.push(child)
        visit(child)
      }
    }
    visit(this)
    return result
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null }
  closest() { return this.getAttribute('role') === 'button' || this.nodeName === 'button' ? this : null }
  getBoundingClientRect() { return { width: this.width, top: 0 } }
}

globalThis.document = { createElement: name => new Node(name), createComment: () => new Node('#comment') }
globalThis.window = new EventTarget()
globalThis.Element = Node
globalThis.MutationObserver = class { observe() {} disconnect() {} }
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
globalThis.requestAnimationFrame = () => 0
globalThis.cancelAnimationFrame = () => {}
globalThis.getComputedStyle = node => ({ display: node.visible ? 'block' : 'none' })

const { mountChessLayout } = await import('../../chess-layout.js')
const { maakSchaakTaal } = await import('../../schaak-taal.js')
const root = new Node()
const remote = new Node(), own = new Node(), content = new Node(), game = new Node(), board = new Node(), chat = new Node()
remote.className = own.className = 'camera'
own.setAttribute('lang', 'fr')
game.className = 'sch-spel'
board.className = 'sch-frame'
game.dataset.cameraLayout = 'around'
game.append(board)
content.append(game)
root.append(remote, content, own, chat)
const originalOrder = [...root.children]

let layout = mountChessLayout({ root, cameraSelector: '.camera' })
assert.equal(remote.parentElement, root, 'default layout keeps the original positions')
game.dataset.cameraLayout = 'top'
layout.sync()
const group = root.querySelector('.chess-camera-group')
assert.ok(group, 'top layout creates a camera group')
assert.deepEqual(group.children, [remote, own], 'both original camera nodes stay together in the correct order')
assert.equal(group.parentElement, root)
assert.ok(root.children.indexOf(group) < root.children.indexOf(content), 'camera group precedes the board in DOM order')
assert.ok(root.children.indexOf(chat) > root.children.indexOf(content), 'chat keeps its own row after the board')
own.dispatchEvent(new Event('click'))
assert.equal(own.classList.contains('is-expanded'), true)
assert.equal(remote.classList.contains('is-expanded'), false, 'camera sizes remain independent')
board.width = 620
layout.sync()
assert.equal(root.style.getPropertyValue('--chess-board-width'), '620px', 'the board is still the width reference')

game.dataset.cameraLayout = 'around'
layout.sync()
assert.equal(root.querySelector('.chess-camera-group'), null)
assert.ok(root.children.indexOf(remote) < root.children.indexOf(content))
assert.ok(root.children.indexOf(own) > root.children.indexOf(content))
assert.equal(own.classList.contains('is-expanded'), true, 'switching arrangement preserves camera size')
remote.visible = own.visible = false
game.dataset.cameraLayout = 'top'
layout.sync()
assert.equal(root.querySelector('.chess-camera-group').hidden, true, 'turning cameras off leaves no empty group space')
remote.visible = own.visible = true
layout.sync()
assert.equal(root.querySelector('.chess-camera-group').hidden, false, 'saved top layout becomes visible when cameras turn on')
const taal = maakSchaakTaal({ storage:{getItem:()=>null,setItem(){}},eventTarget:window })
const groupedCameras = [...group.children]
taal.setLanguage('en')
assert.equal(own.getAttribute('aria-label'),'Restore camera view','expanded camera label changes language in place')
assert.equal(remote.getAttribute('aria-label'),'Show larger camera view')
assert.equal(group.getAttribute('aria-label'),'Player cameras')
assert.equal(root.querySelector('.chess-scroll-rail').getAttribute('aria-label'),'Game scrolling')
assert.deepEqual(group.children,groupedCameras,'changing language never remounts a camera')
assert.equal(own.classList.contains('is-expanded'),true,'changing language preserves camera size')
taal.setLanguage('nl'); taal.destroy()
assert.equal(own.getAttribute('aria-label'),'Cameraweergave herstellen')
layout.destroy()
assert.deepEqual(root.children, originalOrder, 'cleanup restores the exact original DOM')
assert.equal(own.classList.contains('is-expanded'), false)
assert.equal(own.getAttribute('lang'),'fr','cleanup restores the camera language from before chess')
layout = mountChessLayout({ root, cameraSelector: '.camera' })
assert.ok(root.querySelector('.chess-camera-group'), 'mounting again respects the current setting')
layout.destroy()
assert.deepEqual(root.children, originalOrder, 'remounting does not leak wrappers or anchors')

const ui = readFileSync(new URL('../../schaken-ui.js', import.meta.url), 'utf8')
const readSettings = ui.match(/function readSettings\(\) \{[\s\S]*?\n\}/)[0]
const settingsContext = vm.createContext({ localStorage: { getItem: () => '{}' } })
vm.runInContext(`const SETTINGS_KEY = 'test'; ${readSettings}; globalThis.read = readSettings`, settingsContext)
assert.equal(settingsContext.read().camerasAtTop, false, 'existing users keep the original camera arrangement')
settingsContext.localStorage.getItem = () => '{"camerasAtTop":true,"board":"glass","noobMode":true}'
assert.equal(settingsContext.read().camerasAtTop, true)
assert.equal(settingsContext.read().board, 'glass', 'existing settings survive the new option')
assert.equal(settingsContext.read().noobMode, true)
settingsContext.localStorage.getItem = () => '{broken'
assert.equal(settingsContext.read().camerasAtTop, false, 'damaged saved settings use a safe default')

console.log('PASS: camera grouping, board width reference, independent resize, off/on, DOM restoration, remount cleanup, settings migration.')
