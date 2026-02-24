<script setup>
const props = defineProps({
  steps: { type: Array, default: () => [] },
  error: { type: String, default: null },
  success: { type: Boolean, default: false },
})

// Parse Reservoir SDK steps into display-friendly format
const displaySteps = computed(() => {
  if (!props.steps.length) return []
  return props.steps.map((step) => {
    const item = step.items?.[0]
    const txHash = item?.txHashes?.[0]?.txHash ?? null
    return {
      action: step.action,
      description: step.description,
      status: step.status,   // 'incomplete' | 'complete'
      kind: step.kind,       // 'transaction' | 'signature'
      txHash,
      error: step.error ?? null,
    }
  })
})

// Overall status
const allComplete = computed(() => displaySteps.value.length > 0 && displaySteps.value.every((s) => s.status === "complete"))
const currentStep = computed(() => displaySteps.value.find((s) => s.status === "incomplete") ?? null)
</script>

<template>
  <div class="tx-progress">
    <!-- Error state -->
    <div v-if="error" class="tx-progress__error">
      <span class="tx-progress__error-icon">✕</span>
      <span>{{ error }}</span>
    </div>

    <!-- Steps -->
    <div v-if="steps.length" class="tx-progress__steps">
      <div v-for="(step, i) in displaySteps" :key="i" class="tx-progress__step" :class="`tx-progress__step--${step.status}`">
        <div class="tx-progress__step-indicator">
          <span v-if="step.status === 'complete'" class="tx-progress__check">✓</span>
          <span v-else-if="step === currentStep" class="tx-progress__spinner" />
          <span v-else class="tx-progress__dot" />
        </div>
        <div class="tx-progress__step-info">
          <span class="tx-progress__step-action">{{ step.action }}</span>
          <a
            v-if="step.txHash"
            :href="`https://etherscan.io/tx/${step.txHash}`"
            target="_blank"
            class="tx-progress__txlink"
          >
            view on Etherscan ↗
          </a>
        </div>
      </div>
    </div>

    <!-- Success state -->
    <div v-if="success || allComplete" class="tx-progress__success">
      <span>✓</span>
      <span>Complete</span>
    </div>
  </div>
</template>

<style lang="postcss" scoped>
.tx-progress {
  @apply flex flex-col gap-2;
}

.tx-progress__steps {
  @apply flex flex-col gap-2;
}

.tx-progress__step {
  @apply flex items-start gap-3;
}

.tx-progress__step--complete .tx-progress__step-action {
  @apply text-opacity-40;
}

.tx-progress__step-indicator {
  @apply mt-0.5 w-4 flex items-center justify-center shrink-0;
}

.tx-progress__check {
  @apply text-xs text-white text-opacity-60;
}

.tx-progress__dot {
  @apply inline-block w-1.5 h-1.5 rounded-full bg-white bg-opacity-20;
}

.tx-progress__spinner {
  @apply inline-block w-3 h-3 rounded-full border border-white border-opacity-60;
  border-top-color: transparent;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.tx-progress__step-info {
  @apply flex flex-col gap-0.5;
}

.tx-progress__step-action {
  @apply text-xs text-white leading-tight;
}

.tx-progress__txlink {
  @apply text-2xs text-white text-opacity-40 hover:text-opacity-70 underline underline-offset-2;
}

.tx-progress__error {
  @apply flex items-start gap-2 text-xs text-red;
}

.tx-progress__error-icon {
  @apply text-red mt-0.5;
}

.tx-progress__success {
  @apply flex items-center gap-2 text-xs text-white text-opacity-60;
}
</style>
