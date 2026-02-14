<template>
  <NuxtLayout>
    <Suspense>
      <NuxtPage />
      <template #fallback>
        <Loading />
      </template>
    </Suspense>
  </NuxtLayout>
</template>
