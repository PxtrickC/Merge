<script setup>
import { useClipboard } from "@vueuse/core"

const { copy } = useClipboard()

const tina_address = "0xC958c2B65E9840F76E34EE660e27cCf254d75Fa4"
const show_notification = ref(false)

async function copyAddress() {
  await copy(tina_address)
  show_notification.value = true
  setTimeout(() => {
    show_notification.value = false
  }, 2000)
}
</script>

<template>
  <div class="text-3xs md:text-xs text-white text-opacity-30">
    <span class="flex gap-1">
      <span>support me <a class="link cursor-pointer" @click="copyAddress">{{tina_address}}</a></span>
      <transition name="slide-in">
        <div v-if="show_notification" class="ml-1 px-2 bg-gray-dark text-3xs md:text-2xs">
          copied!
        </div>
      </transition>
    </span>
  </div>
</template>
