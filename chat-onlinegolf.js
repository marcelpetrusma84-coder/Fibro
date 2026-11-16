// Een bekende offline→online-overgang, los van de visuele laag en de verbinding.
export function maakOnlineOvergang({ bijBinnenkomst, bijWeg = () => {} }) {
  let vriend = null, vorige = null
  return {
    kies(id, online) { vriend = id == null ? null : String(id); vorige = typeof online === 'boolean' ? online : null },
    werkBij(id, online, magTonen = true) {
      if (vriend === null || String(id) !== vriend || typeof online !== 'boolean') return false
      const binnenkomst = vorige === false && online
      vorige = online
      if (!online) bijWeg()
      if (!binnenkomst || !magTonen) return false
      bijBinnenkomst()
      return true
    },
    reset() { vriend = null; vorige = null; bijWeg() }
  }
}

const VERTEX = `attribute vec2 positie;
varying vec2 punt;
void main(){ punt=(positie+1.0)*.5; gl_Position=vec4(positie,0.0,1.0); }`
const FRAGMENT = `precision highp float;
varying vec2 punt;
uniform float voortgang;
uniform float verhouding;
float plooi(vec2 p){
  float bocht=p.y*7.6+.65*sin(p.x*3.8)+.28*sin(p.x*7.2+p.y*2.0);
  return .6*sin(bocht)+.23*sin(bocht*2.05+p.x*1.5)+.09*sin(p.y*19.0+p.x*5.0);
}
void main(){
  vec2 uv=vec2(punt.x,1.0-punt.y);
  float tijd=voortgang*2.5;
  vec2 p=vec2(uv.x*max(.8,verhouding),uv.y);
  p.y+=.035*sin(p.x*4.0-tijd*1.3)+.012*sin(p.x*9.0+tijd);
  float h=plooi(p);
  float dx=(plooi(p+vec2(.008,0.0))-h)/.008;
  float dy=(plooi(p+vec2(0.0,.008))-h)/.008;
  vec3 normaal=normalize(vec3(-dx*.34,-dy*.22,1.0));
  float front=mix(-.34,1.4,voortgang);
  float afstand=uv.y-front+.035*sin(uv.x*6.0+tijd);
  float band=exp(-pow(afstand/.235,2.0));
  float rand=exp(-pow((afstand+.075)/.038,2.0));
  vec3 lamp=normalize(vec3(.38-uv.x,front-uv.y,1.15));
  float diffuus=max(0.0,dot(normaal,lamp));
  float glans=pow(max(0.0,dot(reflect(-lamp,normaal),vec3(0.0,0.0,1.0))),23.0);
  float ribbel=pow(.5+.5*sin(h*8.0+uv.y*18.0),7.0);
  // Gebroken licht, als een bewegende waterreflectie over blauw satijn.
  float a=sin(p.x*27.0+sin(p.y*20.0+tijd)*1.7);
  float b=sin(p.y*31.0+sin(p.x*18.0-tijd*.8)*1.8);
  float caustiek=pow(max(0.0,1.0-abs(a+b)*.65),15.0);
  float draad=.985+.015*sin(uv.x*920.0)*sin(uv.y*1250.0);
  vec3 kleur=vec3(.004,.018,.10)+vec3(.012,.10,.47)*diffuus*diffuus;
  kleur+=vec3(.015,.19,.94)*(ribbel*.48+glans*.85);
  kleur+=vec3(.11,.75,1.0)*(caustiek*.36+rand*.46+glans*.4);
  kleur*=draad;
  float aan=smoothstep(0.0,.065,voortgang)*(1.0-smoothstep(.91,1.0,voortgang));
  float alfa=clamp(band*.92+rand*.22,0.0,.96)*aan;
  gl_FragColor=vec4(clamp(kleur,0.0,1.0),alfa);
}`

function maakSatijn(canvas) {
  let gl = null, programma = null, buffer = null
  const shaders = []
  const stop = () => {
    if (!gl) return
    if (buffer) gl.deleteBuffer(buffer)
    if (programma) gl.deleteProgram(programma)
    for (const s of shaders) gl.deleteShader(s)
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    gl = null
  }
  try {
    gl = canvas.getContext('webgl', { alpha:true, antialias:false, premultipliedAlpha:false, powerPreference:'low-power' })
    if (!gl) return null
    for (const [type, bron] of [[gl.VERTEX_SHADER, VERTEX], [gl.FRAGMENT_SHADER, FRAGMENT]]) {
      const s = gl.createShader(type); shaders.push(s)
      gl.shaderSource(s, bron); gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('shader')
    }
    programma = gl.createProgram()
    for (const s of shaders) gl.attachShader(programma, s)
    gl.linkProgram(programma)
    if (!gl.getProgramParameter(programma, gl.LINK_STATUS)) throw new Error('programma')
    gl.useProgram(programma)
    buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), gl.STATIC_DRAW)
    const attribuut = gl.getAttribLocation(programma, 'positie')
    gl.enableVertexAttribArray(attribuut); gl.vertexAttribPointer(attribuut, 2, gl.FLOAT, false, 0, 0)
    const voortgang = gl.getUniformLocation(programma, 'voortgang'), verhouding = gl.getUniformLocation(programma, 'verhouding')
    return {
      teken(p, breedte, hoogte) {
        const schaal = Math.min(1.25, canvas.ownerDocument.defaultView.devicePixelRatio || 1, 1200 / Math.max(breedte, hoogte))
        const w = Math.max(1, Math.round(breedte * schaal)), h = Math.max(1, Math.round(hoogte * schaal))
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h }
        gl.viewport(0, 0, w, h)
        gl.uniform1f(voortgang, p); gl.uniform1f(verhouding, breedte / hoogte)
        gl.drawArrays(gl.TRIANGLES, 0, 3)
      }, stop
    }
  } catch (e) { stop(); return null }
}

export function maakChatOnlineGolf({ ouder, berichten, tekst = naam => naam }) {
  if (!ouder) return { speel() {}, stop() {}, ruimOp() {} }
  const doc = ouder.ownerDocument, win = doc.defaultView
  const minder = win.matchMedia?.('(prefers-reduced-motion: reduce)')
  let laag = null, melding = null, satijn = null, frame = null, timer = null, generatie = 0, klaar = false
  const stop = () => {
    generatie++
    if (frame !== null) win.cancelAnimationFrame(frame)
    win.clearTimeout(timer); frame = timer = null
    satijn?.stop(); satijn = null
    laag?.remove(); melding?.remove(); laag = melding = null
    ouder.classList.remove('chat-onlinegolf-actief')
    berichten?.classList.remove('chat-onlinegolf-lezen')
  }
  const speel = naam => {
    stop()
    if (klaar || doc.hidden) return
    const deze = generatie
    melding = doc.createElement('div')
    melding.className = 'chat-onlinegolf-melding'
    melding.hidden = true
    melding.setAttribute('role', 'status'); melding.setAttribute('aria-live', 'polite')
    melding.setAttribute('aria-atomic', 'true')
    ouder.appendChild(melding)
    const toonMelding = () => {
      if (deze !== generatie || doc.hidden) return
      melding.textContent = tekst(naam)
      melding.hidden = false
      melding.classList.add('is-zichtbaar')
      timer = win.setTimeout(stop, 3500)
    }
    if (minder?.matches) { toonMelding(); return }
    laag = doc.createElement('div'); laag.className = 'chat-onlinegolf'
    laag.setAttribute('aria-hidden', 'true')
    const canvas = doc.createElement('canvas'); laag.appendChild(canvas)
    ouder.prepend(laag)
    satijn = maakSatijn(canvas)
    if (!satijn) { laag.classList.add('zonder-webgl'); canvas.remove() }
    canvas.addEventListener('webglcontextlost', e => {
      e.preventDefault()
      if (deze !== generatie) return
      satijn = null
      laag?.classList.add('zonder-webgl')
      canvas.remove()
    })
    ouder.classList.add('chat-onlinegolf-actief')
    berichten?.classList.add('chat-onlinegolf-lezen')
    const begin = win.performance.now()
    const teken = nu => {
      if (deze !== generatie) return
      if (doc.hidden) { stop(); return }
      const p = Math.min(1, (nu - begin) / 2500)
      if (p >= 1) {
        satijn?.stop(); satijn = null
        laag?.remove(); laag = null; frame = null
        ouder.classList.remove('chat-onlinegolf-actief')
        berichten?.classList.remove('chat-onlinegolf-lezen')
        toonMelding()
        return
      }
      try { satijn?.teken(p, win.innerWidth, win.innerHeight) }
      catch (e) { satijn?.stop(); satijn = null; laag.classList.add('zonder-webgl'); canvas.remove() }
      frame = win.requestAnimationFrame(teken)
    }
    frame = win.requestAnimationFrame(teken)
  }
  const bijVerborgen = () => { if (doc.hidden) stop() }
  doc.addEventListener('visibilitychange', bijVerborgen)
  win.addEventListener('pagehide', stop)
  return {
    speel, stop,
    ruimOp() { stop(); klaar = true; doc.removeEventListener('visibilitychange', bijVerborgen); win.removeEventListener('pagehide', stop) }
  }
}
