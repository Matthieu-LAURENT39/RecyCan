import { ethers } from 'ethers'
import { BrowserMultiFormatReader } from '@zxing/library'
import { createAppKit } from '@reown/appkit'
import { EthersAdapter } from '@reown/appkit-adapter-ethers'
import { sepolia } from '@reown/appkit/networks'

// ─── WalletConnect AppKit ─────────────────────────────────
const ethersAdapter = new EthersAdapter()

const modal = createAppKit({
  adapters: [ethersAdapter],
  networks: [sepolia],
  projectId: 'd4cf487a7a6e15c267de764e4f3e5635',
  metadata: {
    name: 'Cannes Recycle',
    description: 'Bottle deposit dApp',
    url: window.location.origin,
    icons: ["https://avatars.githubusercontent.com/u/179229932"]
  },
  features: {
    email: true,
    socials:[
      "google",
      "x",
      "github",
      "discord",
      "apple",
      "facebook",
      "farcaster",
    ],
    emailShowWallets: true,
  },
  allWallets: "SHOW"
})

// ─── Config ──────────────────────────────────────────────
const SYMBOL = 'ETH'
const SCAN_DEBOUNCE_MS = 3000
const CONTRACT_ADDRESS = '0x99fc83461F447D77C0C3d5ddD7eB28336A7Eb06e'

const CONTRACT_ABI = [
  'function products(bytes32) view returns (uint256 depositWei, bool retired)',
  'function refundableUnits(address, bytes32) view returns (uint256)',
  'function isReturnOperator(address) view returns (bool)',
  'function buyBottle(bytes32 barcodeHash, uint256 quantity) payable',
  'function returnBottle(address user, bytes32 barcodeHash, uint256 quantity)'
]

// ─── State ───────────────────────────────────────────────
const scanned = { buy: {}, return: {} }
const readers = {}
const scanCooldown = {}
const productCache = {}

let provider
let signer
let contract

function isWalletConnected() {
  return Boolean(signer)
}

function updateWalletGate() {
  const locked = !isWalletConnected()
  const gate = document.getElementById('view-wallet-required')

  if (gate) {
    gate.classList.toggle('hidden', !locked)
  }
}

modal.subscribeAccount(async (account) => {
  if (account.isConnected && account.address) {
    const walletProvider = modal.getWalletProvider()
    provider = new ethers.BrowserProvider(walletProvider)
    signer = await provider.getSigner()
    const connectedAddress = account.address

    const short = `${connectedAddress.slice(0, 6)}...${connectedAddress.slice(-4)}`
    setWalletStatus(`Connected: ${short} · ${CONTRACT_ADDRESS.slice(0, 6)}...${CONTRACT_ADDRESS.slice(-4)}`)

    const returnInput = document.getElementById('return-address')
    if (!returnInput.value) {
      returnInput.value = connectedAddress
    }

    contract = new ethers.Contract(getContractAddress(), CONTRACT_ABI, signer)
    await refreshAllChainData()
    await checkReturnOperatorAuthorization()
    //updateWalletGate()

    const hash = location.hash.replace('#', '')
    switchView(['buy', 'return', 'receipt'].includes(hash) ? hash : 'buy')
  } else {
    provider = undefined
    signer = undefined
    contract = undefined
    setWalletStatus('Wallet not connected')
    //updateWalletGate()
    switchView(location.hash.replace('#', '') || 'buy')
  }
})

// ─── Blockchain ──────────────────────────────────────────
// Normalizes a barcode by trimming whitespace and removing inner spaces.
function normalizeBarcode(barcode) {
  return String(barcode).trim().replace(/\s+/g, '')
}

// Normalizes and hashes (keccak256) a barcode for on-chain lookup.
function hashBarcode(barcode) {
  return ethers.keccak256(ethers.toUtf8Bytes(normalizeBarcode(barcode)))
}

function getContractAddress() {
  return CONTRACT_ADDRESS
}

function getTxExplorerUrl(txHash) {
  return `https://sepolia.etherscan.io/tx/${txHash}`
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderReceipt({ title, subtitle, items, totalWei, txs }) {
  const titleEl = document.getElementById('receipt-title')
  const subtitleEl = document.getElementById('receipt-subtitle')
  const itemsEl = document.getElementById('receipt-items')
  const totalEl = document.getElementById('receipt-total')
  const txsEl = document.getElementById('receipt-txs')

  titleEl.textContent = title
  subtitleEl.textContent = subtitle

  itemsEl.innerHTML = items.map(item => `
    <div class="border border-gray-100 rounded-xl px-3 py-2 text-sm space-y-1">
      <div class="flex items-center justify-between gap-3">
        <span class="font-mono text-gray-700 truncate">${escapeHtml(item.barcode)}</span>
        <span class="text-gray-800">x${item.qty}</span>
      </div>
      <div class="flex items-center justify-between text-xs text-gray-500">
        <span>Deposit per unit</span>
        <span>${WeiToEth(item.depositWei)} ${SYMBOL}</span>
      </div>
      <div class="flex items-center justify-between text-xs text-gray-500">
        <span>Line total</span>
        <span>${WeiToEth(item.lineWei)} ${SYMBOL}</span>
      </div>
    </div>
  `).join('')

  totalEl.textContent = `${WeiToEth(totalWei)} ${SYMBOL}`

  txsEl.innerHTML = txs.map(tx => `
    <a href="${getTxExplorerUrl(tx.hash)}" target="_blank" rel="noopener noreferrer"
      class="block border border-gray-100 rounded-xl px-3 py-2 hover:border-green-300 hover:bg-green-50 transition-colors">
      <div class="flex items-center justify-between gap-3 text-sm">
        <span class="text-gray-700">${escapeHtml(tx.label)}</span>
        <span class="font-mono text-[11px] text-green-700 truncate max-w-[180px]">${tx.hash}</span>
      </div>
    </a>
  `).join('')

  switchView('receipt')
}


function setWalletStatus(text) {
  document.getElementById('wallet-status').textContent = text
}

function setReturnWarning(message, visible) {
  const warning = document.getElementById('return-operator-warning')
  const warningText = document.getElementById('return-operator-warning-text')
  if (!warning || !warningText) return

  warningText.textContent = message
  warning.classList.toggle('hidden', !visible)
}

function setClaimButtonEnabled(enabled) {
  const button = document.getElementById('btn-claim-deposit')
  if (!button) return
  button.disabled = !enabled
  button.classList.toggle('opacity-50', !enabled)
  button.classList.toggle('cursor-not-allowed', !enabled)
}

async function checkReturnOperatorAuthorization() {
  if (!window.ethereum) {
    setReturnWarning('No wallet detected. Install a wallet to verify return authorization.', true)
    setClaimButtonEnabled(false)
    return false
  }

  if (!signer) {
    setReturnWarning('', false)
    setClaimButtonEnabled(false)
    return false
  }

  try {
    const c = await ensureContract()
    const operator = await signer.getAddress()
    const canOperate = await c.isReturnOperator(operator)

    if (!canOperate) {
      setReturnWarning('Selected wallet does not belong to an authorized return operator. Switch to an authorized operator wallet.', true)
      setClaimButtonEnabled(false)
      return false
    }

    setReturnWarning('', false)
    setClaimButtonEnabled(true)
    return true
  } catch (e) {
    setReturnWarning('Unable to verify return authorization right now. Please reconnect the wallet and try again.', true)
    setClaimButtonEnabled(false)
    return false
  }
}



function WeiToEth(wei) {
  const eth = ethers.formatEther(wei)
  const [whole, frac = ''] = eth.split('.')
  const trimmedFrac = frac.replace(/0+$/, '')

  if (!trimmedFrac) return whole
  return `${whole}.${trimmedFrac.slice(0, 8)}`
}

async function connectWallet() {
  try {
    await modal.open()
  } catch (e) {
    alert(e.shortMessage || e.message || 'Wallet connection failed.')
  }
}

async function ensureContract() {
  if (!signer) {
    await connectWallet()
  }
  if (!signer) {
    throw new Error('Please connect your wallet first, then try again.')
  }

  const addr = getContractAddress()
  if (!ethers.isAddress(addr)) {
    throw new Error('Invalid contract address. Please report this to the dev team.')
  }

  if (!contract || contract.target.toLowerCase() !== addr.toLowerCase()) {
    contract = new ethers.Contract(addr, CONTRACT_ABI, signer)
  }

  return contract
}

async function fetchProductData(barcode) {
  const current = productCache[barcode]
  if (current && !current.loading) {
    return current
  }

  if (!contract) {
    return { exists: false, retired: false, depositWei: 0n, loading: false }
  }

  productCache[barcode] = { exists: false, retired: false, depositWei: 0n, loading: true }

  try {
    const barcodeHash = hashBarcode(barcode)
    const product = await contract.products(barcodeHash)
    const depositWei = BigInt(product.depositWei)
    const exists = depositWei > 0n

    productCache[barcode] = {
      exists,
      retired: Boolean(product.retired),
      depositWei,
      barcodeHash,
      loading: false
    }
  } catch (e) {
    productCache[barcode] = { exists: false, retired: false, depositWei: 0n, loading: false }
  }

  return productCache[barcode]
}

async function refreshAllChainData() {
  const allCodes = [...Object.keys(scanned.buy), ...Object.keys(scanned.return)]
  await Promise.all(allCodes.map(code => fetchProductData(code)))
  renderList('buy')
  renderList('return')
}

// ─── Rendu de la liste ───────────────────────────────────
function productTag(code) {
  const p = productCache[code]
  if (!p || p.loading) return '<span class="text-xs text-gray-400">Loading from chain...</span>'
  if (!p.exists) return '<span class="text-xs text-red-500">Unknown product, it is not registered for the deposit program on-chain.</span>'
  if (p.retired) return `<span class="text-xs text-amber-600">The product is retired and no longer eligible for deposit</span>`
  return `<span class="text-xs text-green-700">Deposit: ${WeiToEth(p.depositWei)} ${SYMBOL}</span>`
}

function renderList(view) {
  const items = scanned[view]
  const container = document.getElementById('items-' + view)
  const list = document.getElementById('list-' + view)
  const barcodes = Object.keys(items)

  if (barcodes.length === 0) {
    list.classList.add('hidden')
    document.getElementById('total-' + view).textContent = `0 ${SYMBOL}`
    return
  }
  list.classList.remove('hidden')

  container.innerHTML = barcodes.map(code => `
    <div class="flex items-center justify-between border border-gray-100 rounded-xl px-3 py-2 text-sm">
      <div class="min-w-0">
        <span class="font-mono text-gray-600 truncate max-w-[180px] block">${code}</span>
        ${productTag(code)}
      </div>
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

  void updateTotal(view)
}

async function updateTotal(view) {
  const items = scanned[view]
  let total = 0n

  for (const [code, qty] of Object.entries(items)) {
    const p = await fetchProductData(code)
    if (!p.exists) continue
    total += p.depositWei * BigInt(qty)
  }

  document.getElementById('total-' + view).textContent = `${WeiToEth(total)} ${SYMBOL}`
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
  if (!isWalletConnected()) return

  const normalized = normalizeBarcode(code)
  if (!normalized) return

  scanned[view][normalized] = (scanned[view][normalized] || 0) + 1
  document.getElementById('last-scan-' + view).textContent = normalized
  beep()
  flashScan(view)
  void fetchProductData(normalized).then(() => renderList(view))
  renderList(view)
}

async function confirmPurchase() {
  try {
    const c = await ensureContract()
    const items = Object.entries(scanned.buy)
    if (items.length === 0) {
      alert('Scan at least one product before confirming purchase.')
      return
    }

    const button = document.getElementById('btn-confirm-purchase')
    button.disabled = true
    button.textContent = 'Processing...'


    const receiptItems = []
    const receiptTxs = []
    let totalWei = 0n

    for (const [barcode, qty] of items) {
      const p = await fetchProductData(barcode)
      if (!p.exists) {
        throw new Error(`Barcode ${barcode} is not registered in the contract.`)
      }
      if (p.retired) {
        throw new Error(`Barcode ${barcode} is retired and cannot be bought.`)
      }

      const value = p.depositWei * BigInt(qty)
      const tx = await c.buyBottle(p.barcodeHash, BigInt(qty), { value })
      await tx.wait()

      receiptItems.push({
        barcode,
        qty,
        depositWei: p.depositWei,
        lineWei: value
      })
      receiptTxs.push({
        label: `Purchase for ${barcode}`,
        hash: tx.hash
      })
      totalWei += value
    }

    resetList('buy')
    renderReceipt({
      title: 'Purchase receipt',
      subtitle: 'Your bottles are registered for deposit refunds.',
      items: receiptItems,
      totalWei,
      txs: receiptTxs
    })
  } catch (e) {
    alert(e.shortMessage || e.message || 'Transaction failed.')
  } finally {
    const button = document.getElementById('btn-confirm-purchase')
    button.disabled = false
    button.textContent = 'Confirm purchase'
  }
}

async function claimDeposit() {
  try {
    const c = await ensureContract()
    const canOperate = await checkReturnOperatorAuthorization()
    if (!canOperate) {
      throw new Error('Connected wallet is not an authorized return operator. Switch to the operator wallet.')
    }

    const user = document.getElementById('return-address').value.trim()
    if (!ethers.isAddress(user)) {
      throw new Error('Please enter a valid return address.')
    }

    const items = Object.entries(scanned.return)
    if (items.length === 0) {
      alert('Scan at least one product before claiming a refund.')
      return
    }

    const button = document.getElementById('btn-claim-deposit')
    button.disabled = true
    button.textContent = 'Processing...'

    const receiptItems = []
    const receiptTxs = []
    let totalWei = 0n

    for (const [barcode, qty] of items) {
      const p = await fetchProductData(barcode)
      if (!p.exists) {
        throw new Error(`Barcode ${barcode} is not registered in the contract.`)
      }

      const availableUnits = await c.refundableUnits(user, p.barcodeHash)
      if (BigInt(availableUnits) < BigInt(qty)) {
        throw new Error(`Insufficient refundable units for ${barcode}. Available: ${availableUnits}, requested: ${qty}.`)
      }

      const tx = await c.returnBottle(user, p.barcodeHash, BigInt(qty))  
      await tx.wait()

      const lineWei = p.depositWei * BigInt(qty)
      receiptItems.push({
        barcode,
        qty,
        depositWei: p.depositWei,
        lineWei
      })
      receiptTxs.push({
        label: `Return for ${barcode}`,
        hash: tx.hash
      })
      totalWei += lineWei
    }

    resetList('return')
    renderReceipt({
      title: 'Return receipt',
      subtitle: `Refund destination: ${user}`,
      items: receiptItems,
      totalWei,
      txs: receiptTxs
    })
  } catch (e) {
    alert(e.shortMessage || e.message || 'Transaction failed.')
  } finally {
    const button = document.getElementById('btn-claim-deposit')
    button.textContent = 'Claim my deposit'
    await checkReturnOperatorAuthorization()
  }
}

// ─── Audio ───────────────────────────────────────────────
function beep() {
  const ctx = new AudioContext()
  const osc = ctx.createOscillator()
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
  if (!isWalletConnected()) {
    alert('Please connect your wallet first.')
    return
  }


  document.getElementById('scanner-' + view).classList.remove('hidden')
  const video = document.getElementById('video-' + view)
  const reader = new BrowserMultiFormatReader()
  readers[view] = reader

  reader.decodeFromConstraints(
    { video: { facingMode: 'environment' } },
    video,
    result => {
      if (result && !scanCooldown[view]) {
        scanCooldown[view] = true
        addScan(view, result.getText())
        setTimeout(() => {
          scanCooldown[view] = false
        }, SCAN_DEBOUNCE_MS)
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
  updateWalletGate()
  const returnInfo = document.getElementById('return-process-info')
  if (returnInfo) {
    returnInfo.classList.toggle('hidden', view !== 'return')
  }

  const btnB = document.getElementById('btn-buy')
  const btnR = document.getElementById('btn-return')

  const setBadgeState = (button, isActive) => {
    button.classList.remove(
      'bg-white',
      'text-green-800',
      'border-2',
      'border-white',
      'text-white',
      'hover:bg-green-50',
      'hover:bg-green-700'
    )

    if (isActive) {
      button.classList.add('bg-white', 'text-green-800', 'hover:bg-green-50')
      return
    }

    button.classList.add('border-2', 'border-white', 'text-white', 'hover:bg-green-700')
  }

  setBadgeState(btnB, view !== 'return')
  setBadgeState(btnR, view === 'return')

  if (!isWalletConnected()) {
    ['buy', 'return', 'receipt'].forEach(v => {
      document.getElementById('view-' + v).classList.add('hidden')
      if ((v === 'buy' || v === 'return') && readers[v]) closeScanner(v)
    })

    if (['buy', 'return', 'receipt'].includes(view) && location.hash !== `#${view}`) {
      location.hash = view
    }
    return
  }
  ['buy', 'return', 'receipt'].forEach(v => {
    document.getElementById('view-' + v).classList.toggle('hidden', v !== view)
    if (v !== view && (v === 'buy' || v === 'return') && readers[v]) closeScanner(v)
  })

  document.getElementById('view-wallet-required').classList.add('hidden')
  location.hash = view

  if (view === 'buy') {
    setBadgeState(btnB, true)
    setBadgeState(btnR, false)
  } else if (view === 'return') {
    setBadgeState(btnR, true)
    setBadgeState(btnB, false)
    void checkReturnOperatorAuthorization()
  }

}

window.addEventListener('load', () => {
  const hash = location.hash.replace('#', '') || 'buy'
  switchView(['buy', 'return'].includes(hash) ? hash : 'buy')

  // Initialize the contract link in the header
  const link = document.getElementById('contract-link')
  link.href = `https://sepolia.etherscan.io/address/${getContractAddress()}`

  void checkReturnOperatorAuthorization()
  updateWalletGate()

    if (window.ethereum) {
    window.ethereum.on('accountsChanged', () => window.location.reload())
    window.ethereum.on('chainChanged', () => window.location.reload())
  }
})


// ─── Expose to window for inline onclick handlers ────────
window.switchView = switchView
window.connectWallet = connectWallet
window.openScanner = openScanner
window.closeScanner = closeScanner
window.resetList = resetList
window.confirmPurchase = confirmPurchase
window.claimDeposit = claimDeposit
window.changeQty = changeQty
window.setQty = setQty
window.removeItem = removeItem
