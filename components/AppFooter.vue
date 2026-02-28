<template>
  <footer class="footer">
    <p class="footer__text">Built by <a class="footer__link" href="https://etherscan.io/address/pxtrick.eth" target="_blank">pxtrick.eth</a></p>
    <p class="footer__support">If you find this useful, consider supporting the project</p>
  </footer>
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
