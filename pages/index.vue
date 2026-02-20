<script setup>
const { stats, alphaMass, aliveTokens, byTier, tierCount, tierTotal } = useDB()

const yellow_mass = byTier(2)
const blue_mass = byTier(3)
const red_mass = byTier(4)

const yellowCount = tierCount(2)
const blueCount = tierCount(3)
const redCount = tierCount(4)

const alpha_mass = computed(() => stats.value?.alpha_mass ?? 1)
</script>

<template>
  <div>
    <section-hero />
    <section-stats-bar />
    <section-latest-merges />
    <section-ranking :title="`All Mass ${stats?.token_count ?? ''}/28990`" :items="aliveTokens" :alpha-mass="alpha_mass" searchable />
    <section-ranking :title="`Yellow Mass ${yellowCount}/${tierTotal(2)}`" :items="yellow_mass" :alpha-mass="alpha_mass" filterable :tier="2" />
    <section-ranking :title="`Blue Mass ${blueCount}/${tierTotal(3)}`" :items="blue_mass" :alpha-mass="alpha_mass" filterable :tier="3" />
    <section-ranking :title="`Red Mass ${redCount}/${tierTotal(4)}`" :items="red_mass" :alpha-mass="alpha_mass" />
    <section-mass-distribution />

    <footer class="footer">
      <p class="footer__text">Built by <a class="footer__link" href="https://etherscan.io/address/pxtrick.eth" target="_blank">pxtrick.eth</a></p>
      <p class="footer__support">If you find this useful, consider supporting the project</p>
    </footer>
  </div>
</template>

<style lang="postcss" scoped>
.footer {
  @apply py-6 px-4 md:px-8 text-left;
  border-top: 1px solid #1a1a1a;
}
.footer__text {
  @apply text-xs text-white;
  font-family: 'HND', sans-serif;
  line-height: 1.4;
}
.footer__support {
  @apply text-xs;
  color: #555;
  line-height: 1.4;
}
.footer__link {
  @apply text-white underline;
  text-underline-offset: 3px;
  transition: background-color 0.15s, color 0.15s;
}
.footer__link:hover {
  background: #fff;
  color: #000;
}

</style>
