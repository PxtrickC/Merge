<script setup>
import { decodeValue } from '~/utils/contract.mjs'

const { address, isConnected, myTokenId, openModal, disconnect, shortAddress } = useWallet()
const { db, alphaMass } = useDB()
const { open: openDrawer } = useTokenDrawer()

const showDropdown = ref(false)
const wrapperRef = ref(null)

const alpha_mass = computed(() => alphaMass.value || 1)

const myToken = computed(() => {
  if (!myTokenId.value || !db.value?.tokens) return null
  const entry = db.value.tokens[myTokenId.value]
  if (!entry || entry[0] === 0) return null
  const { class: tier, mass } = decodeValue(entry[0])
  return { id: myTokenId.value, tier, mass, merges: entry[1] || 0 }
})

function handleClick() {
  if (!isConnected.value) {
    openModal()
  } else {
    showDropdown.value = !showDropdown.value
  }
}

function viewToken() {
  if (!myToken.value) return
  showDropdown.value = false
  openDrawer(myToken.value.id)
}

function handleDisconnect() {
  showDropdown.value = false
  disconnect()
}

// Close on click outside
function onClickOutside(e) {
  if (wrapperRef.value && !wrapperRef.value.contains(e.target)) {
    showDropdown.value = false
  }
}

function onKeyDown(e) {
  if (e.key === 'Escape') showDropdown.value = false
}

onMounted(() => {
  document.addEventListener('click', onClickOutside)
  document.addEventListener('keydown', onKeyDown)
})
onUnmounted(() => {
  document.removeEventListener('click', onClickOutside)
  document.removeEventListener('keydown', onKeyDown)
})
</script>

<template>
  <div ref="wrapperRef" class="wallet">
    <button class="wallet-btn" @click="handleClick">
      <template v-if="isConnected">
        <span class="wallet-btn__dot"></span>
        <span class="wallet-btn__addr">{{ shortAddress(address) }}</span>
      </template>
      <template v-else>
        Connect
      </template>
    </button>

    <Transition name="dropdown">
      <div v-if="showDropdown && isConnected" class="wallet-dropdown">
        <!-- Token preview -->
        <div v-if="myToken" class="wallet-dropdown__token" @click="viewToken">
          <div class="wallet-dropdown__sphere">
            <merge-svg :tier="myToken.tier" :mass="myToken.mass" :alpha_mass="alpha_mass" />
          </div>
          <div class="wallet-dropdown__meta">
            <span class="wallet-dropdown__mass">m({{ myToken.mass }})</span>
            <span class="wallet-dropdown__id">#{{ myToken.id }}</span>
          </div>
        </div>

        <!-- No token -->
        <div v-else-if="myTokenId === 0" class="wallet-dropdown__empty">
          No Merge token found
        </div>

        <!-- Loading -->
        <div v-else class="wallet-dropdown__empty">
          Loading...
        </div>

        <!-- Disconnect -->
        <button class="wallet-dropdown__action wallet-dropdown__action--disconnect" @click="handleDisconnect">
          Disconnect
        </button>
      </div>
    </Transition>
  </div>
</template>

<style lang="postcss" scoped>
.wallet {
  position: relative;
}
.wallet-btn {
  @apply flex items-center gap-2 px-3 py-1.5 text-sm text-white;
  font-family: 'HND', sans-serif;
  border: 1px solid #333;
  border-radius: 4px;
  transition: border-color 0.2s, background 0.2s;
}
.wallet-btn:hover {
  border-color: #555;
  background: #1a1a1a;
}
.wallet-btn__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #4ade80;
}
.wallet-btn__addr {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.75rem;
}

/* Dropdown */
.wallet-dropdown {
  position: absolute;
  right: 0;
  top: calc(100% + 6px);
  min-width: 200px;
  background: #111;
  border: 1px solid #333;
  border-radius: 6px;
  overflow: hidden;
  z-index: 100;
}

.wallet-dropdown__token {
  @apply flex items-center gap-3 p-3 cursor-pointer;
  transition: background 0.15s;
}
.wallet-dropdown__token:hover {
  background: #1a1a1a;
}
.wallet-dropdown__sphere {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
}
.wallet-dropdown__sphere svg {
  width: 100%;
  height: 100%;
}
.wallet-dropdown__meta {
  @apply flex flex-col;
}
.wallet-dropdown__mass {
  @apply text-sm text-white;
  font-family: 'HND', sans-serif;
}
.wallet-dropdown__id {
  @apply text-xs;
  color: #555;
}

.wallet-dropdown__empty {
  @apply p-3 text-xs text-center;
  color: #555;
  font-family: 'HND', sans-serif;
}

.wallet-dropdown__action {
  @apply w-full px-3 py-2.5 text-xs text-white text-left;
  font-family: 'HND', sans-serif;
  border-top: 1px solid #222;
  transition: background 0.15s;
}
.wallet-dropdown__action:hover {
  background: #1a1a1a;
}
.wallet-dropdown__action--disconnect {
  color: #888;
}

/* Transition */
.dropdown-enter-active, .dropdown-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.dropdown-enter-from, .dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
