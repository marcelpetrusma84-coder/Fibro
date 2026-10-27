/* Alleen de presentatie: scores worden door neon-raiders-scores.js opgehaald.
   Namen worden uitsluitend met textContent toegevoegd, nooit als HTML. */
const fallbackT = (key, values) => String(key).replace(/\{(\w+)\}/g, (match, key) => values?.[key] ?? match)

export function scoreDatum(value, locale = 'nl-NL') {
  if (value == null || value === '') return null
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return null
  try {
    return {
      iso: date.toISOString(),
      day: new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric' }).format(date),
      time: new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(date)
    }
  } catch {
    return scoreDatum(value, 'nl-NL')
  }
}

export function maakNeonScorebord({ host = document.body, service, T = globalThis.T || fallbackT,
  isActief = () => true, onOpen = () => {}, onClose = () => {} } = {}) {
  if (!service || typeof service.loadBoards !== 'function') throw new TypeError('Score service ontbreekt')
  const doc = host.ownerDocument || document
  if (!doc.getElementById('nr-scoreboard-css')) {
    const link = doc.createElement('link')
    link.id = 'nr-scoreboard-css'; link.rel = 'stylesheet'
    link.href = new URL('./neon-raiders-scoreboard.css?v=2', import.meta.url).href
    doc.head.appendChild(link)
  }
  const element = (tag, className, text) => {
    const node = doc.createElement(tag)
    if (className) node.className = className
    if (text !== undefined) node.textContent = text
    return node
  }
  const dialog = element('dialog', 'nr-scoreboard')
  dialog.setAttribute('aria-label', T('Neon Raiders scores'))
  const header = element('header', 'nr-sb-header')
  const heading = element('div')
  heading.append(element('p', 'nr-sb-eyebrow', 'NEON RAIDERS'), element('h2', '', T('Scores')))
  const closeButton = element('button', 'nr-sb-close', '×')
  closeButton.type = 'button'; closeButton.setAttribute('aria-label', T('Sluiten'))
  header.append(heading, closeButton)
  const status = element('p', 'nr-sb-status', T('Scores laden…'))
  status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite')
  const columns = element('div', 'nr-sb-columns')
  function column(title, subtitle, type) {
    const section = element('section', 'nr-sb-column nr-sb-' + type)
    const titleNode = element('h3', '', title)
    section.append(titleNode, element('p', 'nr-sb-subtitle', subtitle))
    const list = element('ol', 'nr-sb-list'); list.setAttribute('aria-label', title)
    section.appendChild(list); columns.appendChild(section)
    return list
  }
  const personalList = column(T('Jouw top 10'), T('Jouw beste rondes'), 'personal')
  const friendsList = column(T('Vrienden top 10'), T('Jij en je vrienden'), 'friends')
  const globalPanel = element('section', 'nr-sb-global')
  const globalLabel = element('h3', '', T('Hoogste score op Fibro'))
  const globalScore = element('strong', 'nr-sb-global-score', '—')
  const globalDetail = element('p', 'nr-sb-global-detail')
  globalPanel.append(globalLabel, globalScore, globalDetail)
  const footer = element('footer', 'nr-sb-footer')
  footer.appendChild(element('p', '', T('Dag en tijd zijn in jouw lokale tijdzone.')))
  const refreshButton = element('button', 'nr-sb-refresh', T('Vernieuwen'))
  refreshButton.type = 'button'; footer.appendChild(refreshButton)
  dialog.append(header, status, columns, globalPanel, footer)
  host.appendChild(dialog)

  let destroyed = false, generation = 0, isOpen = false, returnFocus = null, lastBoards = null
  const locale = () => T.locale || (T.taal === 'en' ? 'en-GB' : 'nl-NL')
  const number = value => new Intl.NumberFormat(locale()).format(Math.max(0, Math.floor(Number(value) || 0)))
  function dateNode(value) {
    const date = scoreDatum(value, locale())
    if (!date) return element('span', 'nr-sb-date', T('Datum onbekend'))
    const node = element('time', 'nr-sb-date')
    node.dateTime = date.iso
    node.append(element('span', '', date.day), element('span', 'nr-sb-time', date.time))
    return node
  }
  function drawList(list, rows, friends, remoteAvailable) {
    list.replaceChildren()
    const scores = Array.isArray(rows) ? rows.slice(0, 10) : []
    if (!scores.length) {
      const empty = element('li', 'nr-sb-empty', friends && !remoteAvailable
        ? T('De online lijst komt hier zodra die beschikbaar is.')
        : T('Nog geen scores. Speel een ronde om de lijst te vullen.'))
      list.appendChild(empty); return
    }
    scores.forEach((row, index) => {
      const item = element('li', 'nr-sb-row')
      if (row.isSelf) item.classList.add('nr-sb-self')
      const rank = element('span', 'nr-sb-rank', String(index + 1))
      rank.setAttribute('aria-hidden', 'true')
      const body = element('div', 'nr-sb-run')
      if (friends) {
        const name = element('span', 'nr-sb-name', row.name || (row.isSelf ? T('Jij') : T('Vriend')))
        body.appendChild(name)
      }
      body.appendChild(dateNode(row.playedAt))
      item.append(rank, body, element('strong', 'nr-sb-points', number(row.score)))
      list.appendChild(item)
    })
  }
  function draw(boards) {
    lastBoards = boards
    const online = boards.status === 'online'
    drawList(personalList, boards.personal, false, true)
    drawList(friendsList, boards.friends, true, online)
    globalScore.textContent = boards.global ? number(boards.global.score) : '—'
    globalDetail.replaceChildren()
    if (boards.global) {
      // De service geeft uitsluitend een naam terug voor jezelf of een vriend.
      if (boards.global.name) globalDetail.appendChild(element('span', 'nr-sb-record-name', boards.global.name))
      else if (boards.global.isSelf) globalDetail.appendChild(element('span', 'nr-sb-record-name', T('Jij')))
      if (boards.global.playedAt) globalDetail.appendChild(dateNode(boards.global.playedAt))
    } else {
      globalDetail.textContent = online ? T('Nog geen Fibro-record.') : T('Het Fibro-record verschijnt zodra je online lijst beschikbaar is.')
    }
    status.textContent = online ? T('De tien hoogste scores, met de beste score bovenaan.')
      : boards.status === 'setup' ? T('Jouw scores worden bewaard. De gedeelde scorelijsten worden nog klaargezet.')
      : boards.status === 'local' ? T('Jouw scores staan op dit apparaat. Log in voor de gedeelde scorelijsten.')
      : T('Jouw scores blijven bewaard. De online lijsten worden vernieuwd zodra je verbinding terug is.')
    if (boards.durable === false && !online) status.textContent = T('Deze browser kan je scores niet blijvend opslaan. Houd dit venster open tot ze online zijn bewaard.')
    dialog.dataset.state = boards.status || 'offline'
  }
  async function refresh() {
    if (destroyed) return
    const request = ++generation
    refreshButton.disabled = true
    dialog.setAttribute('aria-busy', 'true')
    if (!lastBoards) status.textContent = T('Scores laden…')
    try {
      const boards = await service.loadBoards()
      if (destroyed || request !== generation || !isActief()) return
      draw(boards || { personal: [], friends: [], global: null, status: 'offline' })
    } catch {
      if (destroyed || request !== generation || !isActief()) return
      draw({ ...(lastBoards || { personal: [], friends: [], global: null }), status: 'offline' })
    } finally {
      if (!destroyed && request === generation) {
        refreshButton.disabled = false
        dialog.setAttribute('aria-busy', 'false')
      }
    }
  }
  function close() {
    if (!isOpen) return
    isOpen = false
    if (typeof dialog.close === 'function') dialog.close()
    else dialog.removeAttribute('open')
    onClose()
    if (returnFocus?.isConnected) returnFocus.focus()
  }
  function open() {
    if (destroyed || !isActief()) return
    if (!isOpen) {
      returnFocus = doc.activeElement
      isOpen = true
      if (typeof dialog.showModal === 'function') dialog.showModal()
      else dialog.setAttribute('open', '')
      onOpen()
      closeButton.focus()
    }
    return refresh()
  }
  const cancel = event => { event.preventDefault(); close() }
  const dismiss = event => { if (event.target === dialog) close() }
  closeButton.addEventListener('click', close)
  refreshButton.addEventListener('click', refresh)
  dialog.addEventListener('cancel', cancel)
  dialog.addEventListener('click', dismiss)
  dialog.addEventListener('close', () => { if (isOpen) close() })
  return { open, refresh, close, destroy() {
    if (destroyed) return
    close(); destroyed = true; generation++
    dialog.remove()
  } }
}
