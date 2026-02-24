<script setup>
const { tokenId, isOpen, close } = useTokenDrawer()
const { open: openMatter } = useMatterDrawer()

const { alphaMass } = useDB()
const alpha_mass = computed(() => alphaMass.value || 0)

const { data: matterTokens } = useLazyFetch('/data/matter_tokens.json')
const matterForToken = computed(() => {
  if (!matterTokens.value || !tokenData.value) return []
  return matterTokens.value.filter(m => m.parent === tokenData.value.id)
})

const tokenData = ref(null)
const transfers = ref([])
const mergeTimeline = ref([])
const initialMass = ref(null)
const loading = ref(false)

const panelRef = ref(null)

watch(tokenId, async (id) => {
  if (!id) return
  loading.value = true
  tokenData.value = null
  transfers.value = []
  mergeTimeline.value = []
  initialMass.value = null

  nextTick(() => {
    if (panelRef.value) panelRef.value.scrollTop = 0
  })

  try {
    const { token } = await useToken(id)
    if (token.value) {
      tokenData.value = {
        ...token.value,
        merged_to: token.value.mergedTo ?? null,
        merged_on: token.value.mergedOn ?? null,
      }
    }

    await new Promise(r => setTimeout(r, 1200))

    const [transferResult, timelineResult] = await Promise.all([
      useTokenTransfers(id),
      useTokenMergeTimeline(id),
    ])
    transfers.value = transferResult.transfers.value
    mergeTimeline.value = timelineResult.timeline.value
    initialMass.value = timelineResult.initialMass.value
  } catch (err) {
    console.error('[TokenDrawer]', err)
  } finally {
    loading.value = false
  }
})

let savedScrollY = 0
watch(isOpen, (open) => {
  if (!import.meta.client) return
  if (open) {
    savedScrollY = window.scrollY
    document.body.style.position = 'fixed'
    document.body.style.top = `-${savedScrollY}px`
    document.body.style.left = '0'
    document.body.style.right = '0'
  } else {
    document.body.style.position = ''
    document.body.style.top = ''
    document.body.style.left = ''
    document.body.style.right = ''
    window.scrollTo(0, savedScrollY)
  }
})

function onKeyDown(e) {
  if (e.key === 'Escape' && isOpen.value) close()
}

onMounted(() => document.addEventListener('keydown', onKeyDown))
onUnmounted(() => document.removeEventListener('keydown', onKeyDown))
</script>

<template>
  <Transition name="fade">
    <div v-if="isOpen" class="drawer__backdrop" @click="close" />
  </Transition>
  <Transition name="slide">
    <div v-if="isOpen" ref="panelRef" class="drawer__panel">
      <button class="drawer__close" @click="close">
        <icon class="w-5" variant="return" />
      </button>

      <div v-if="loading && !tokenData" class="drawer__loading">
        <Loading :fullscreen="false" />
      </div>

      <div v-if="tokenData" class="drawer__content">
        <card-token v-bind="tokenData" :alpha_mass="alpha_mass" />

        <trade-panel
          v-if="!tokenData.merged"
          :token-id="+tokenData.id"
          :owner="tokenData.owner"
        />

        <card-activity
          :id="+tokenData.id"
          :loading="loading"
          :merged="tokenData.merged"
          :merged_to="tokenData.merged_to"
          :merged_on="tokenData.merged_on"
          :alpha_mass="alpha_mass"
          :transfers="transfers"
          :merge-timeline="mergeTimeline"
          :initial-mass="initialMass"
        />

        <div v-if="matterForToken.length" class="drawer__matter">
          <div class="section__title">matter*</div>
          <div class="drawer__matter-grid">
            <div
              v-for="m in matterForToken"
              :key="m.id"
              class="drawer__matter-item"
              @click="openMatter(m)"
            >
              <img :src="m.image_cdn || m.image" :alt="m.name" class="drawer__matter-img" width="512" height="512" />
              <span class="drawer__matter-name">{{ m.name }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style lang="postcss" scoped>
.drawer__backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 50;
}
.drawer__panel {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  max-width: 30rem;
  background: #0a0a0a;
  border-left: 1px solid #1a1a1a;
  z-index: 51;
  overflow-y: auto;
  @apply p-4 sm:p-6;
}
.drawer__close {
  @apply mb-4 sm:mb-6 text-white;
}
.drawer__content {
  @apply flex flex-col gap-8 sm:gap-10;
}
.drawer__loading {
  @apply flex justify-center py-12;
}

/* matter section */
.section__title {
  @apply text-2xl md:text-6xl text-white mb-4 md:mb-6;
}
.drawer__matter {
  @apply flex flex-col;
}
.drawer__matter-grid {
  @apply grid grid-cols-2 gap-3;
}
.drawer__matter-item {
  @apply flex flex-col items-center gap-1.5 cursor-pointer;
}
.drawer__matter-item:hover .drawer__matter-name {
  color: #999;
}
.drawer__matter-img {
  @apply w-full h-auto block rounded;
  aspect-ratio: 1;
  object-fit: cover;
}
.drawer__matter-name {
  @apply text-xs text-white truncate w-full text-center;
  transition: color 0.2s;
}

/* transitions */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
.slide-enter-active, .slide-leave-active {
  transition: transform 0.3s ease;
}
.slide-enter-from, .slide-leave-to {
  transform: translateX(100%);
}

/* scrollbar */
::-webkit-scrollbar {
  @apply w-1;
}
::-webkit-scrollbar-track {
  background: #0a0a0a;
}
::-webkit-scrollbar-thumb {
  background: #333;
  border-radius: 4px;
}
</style>
