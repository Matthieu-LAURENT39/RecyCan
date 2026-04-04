// ─── Config ──────────────────────────────────────────────
const DEPOSIT_PER_BOTTLE = 3n   // Wei
const SYMBOL             = "Wei"
const SCAN_DEBOUNCE_MS   = 3000 // ms entre deux scans

// ─── State ───────────────────────────────────────────────
const scanned    = { buy: {}, return: {} }
const readers    = {}
const scanCooldown = {}

// ─── Rendu de la liste ───────────────────────────────────
function renderList(view) {
  const items     = scanned[view]
  const container = document.getElementById('items-' + view)
  const list      = document.getElementById('list-' + view)
  const barcodes  = Object.keys(items)

  if (barcodes.length === 0) {
    list.classList.add('hidden')
    return
  }
  list.classList.remove('hidden')

  container.innerHTML = barcodes.map(code => `
    <div class="flex items-center justify-between border border-gray-100 rounded-xl px-3 py-2 text-sm">
      <span class="font-mono text-gray-600 truncate max-w-[180px]">${code}</span>
      <div class="flex items-center gap-2 shrink-0">
        <button onclick="changeQty('${view}', '${code}', -1)"
          class="w-6 h-6 rounded-lg border border-gray-200 text-gray-500 hover:border-green-600 hover:text-green-700 flex items-center justify-center text-base leading-none">−</button>
        <input type="number" min="1" value="${items[code]}"
          onchange="setQty('${view}', '${code}', this.value)"
          class="w-12 text-center border border-gray-200 rounded-lg py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-400" />
        <button onclick="changeQty('${view}', '${code}', +1)"
          class="w-6 h-6 rounded-lg border border-gray-200 text-gray-500 hover:border-green-600 hover:text-green-700 flex items-center justify-center text-base leading-none">+</button>
        <button onclick="removeItem('${view}', '${code}')"
          class="ml-1 text-gray-300 hover:text-red-400 text-xs">✕</button>
      </div>
    </div>
  `).join('')

  updateTotal(view)
}

function updateTotal(view) {
  const items = scanned[view]
  const total = Object.values(items).reduce((sum, qty) => sum + BigInt(qty), 0n) * DEPOSIT_PER_BOTTLE
  document.getElementById('total-' + view).textContent = `${total} ${SYMBOL}`
}

// ─── Actions sur la liste ────────────────────────────────
function changeQty(view, code, delta) {
  const newQty = (scanned[view][code] || 0) + delta
  if (newQty <= 0) {
    removeItem(view, code)
  } else {
    scanned[view][code] = newQty
    renderList(view)
  }
}

function setQty(view, code, value) {
  const qty = parseInt(value)
  if (!qty || qty <= 0) {
    removeItem(view, code)
  } else {
    scanned[view][code] = qty
    renderList(view)
  }
}

function removeItem(view, code) {
  delete scanned[view][code]
  renderList(view)
}

function resetList(view) {
  scanned[view] = {}
  renderList(view)
}

function addScan(view, code) {
  scanned[view][code] = (scanned[view][code] || 0) + 1
  document.getElementById('last-scan-' + view).textContent = code
  beep()
  flashScan(view)
  renderList(view)
}

// ─── Audio ───────────────────────────────────────────────
function beep() {
  const ctx  = new AudioContext()
  const osc  = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.frequency.value = 1200
  gain.gain.setValueAtTime(0.3, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + 0.15)
}

// ─── Effets visuels ──────────────────────────────────────
function flashScan(view) {
  const video = document.getElementById('video-' + view)

  video.classList.add('ring-4', 'ring-green-400', 'ring-offset-2')
  setTimeout(() => {
    video.classList.remove('ring-4', 'ring-green-400', 'ring-offset-2')
  }, 600)

  const toast = document.getElementById('toast')
  toast.classList.remove('opacity-0', 'translate-y-2')
  toast.classList.add('opacity-100', 'translate-y-0')
  setTimeout(() => {
    toast.classList.remove('opacity-100', 'translate-y-0')
    toast.classList.add('opacity-0', 'translate-y-2')
  }, 1200)
}

// ─── Scanner ─────────────────────────────────────────────
function openScanner(view) {
  document.getElementById('scanner-' + view).classList.remove('hidden')
  const video  = document.getElementById('video-' + view)
  const reader = new ZXing.BrowserMultiFormatReader()
  readers[view] = reader

  reader.decodeFromConstraints(
    { video: { facingMode: 'environment' } },
    video,
    (result, err) => {
      if (result && !scanCooldown[view]) {
        scanCooldown[view] = true
        addScan(view, result.getText())
        setTimeout(() => { scanCooldown[view] = false }, SCAN_DEBOUNCE_MS)
      }
    }
  )
}

function closeScanner(view) {
  if (readers[view]) {
    readers[view].reset()
    delete readers[view]
  }
  document.getElementById('scanner-' + view).classList.add('hidden')
  document.getElementById('last-scan-' + view).textContent = '—'
}

// ─── Navigation ──────────────────────────────────────────
function switchView(view) {
  ['home', 'buy', 'return'].forEach(v => {
    document.getElementById('view-' + v).classList.toggle('hidden', v !== view)
    if (v !== view && readers[v]) closeScanner(v)
  })
  const btnB = document.getElementById('btn-buy')
  const btnR = document.getElementById('btn-return')
  if (view === 'buy') {
    btnB.classList.add('bg-white', 'text-green-800')
    btnB.classList.remove('border-2', 'border-white', 'text-white')
    btnR.classList.add('border-2', 'border-white', 'text-white')
    btnR.classList.remove('bg-white', 'text-green-800')
  } else if (view === 'return') {
    btnR.classList.add('bg-white', 'text-green-800')
    btnR.classList.remove('border-2', 'border-white', 'text-white')
    btnB.classList.add('border-2', 'border-white', 'text-white')
    btnB.classList.remove('bg-white', 'text-green-800')
  }
}
