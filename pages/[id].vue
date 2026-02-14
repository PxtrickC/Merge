<script setup>
const $route = useRoute()
const { open } = useTokenDrawer()

const id = +$route.params.id
if (!isNaN(id)) {
  open(id)
}

await navigateTo('/', { replace: true })
</script>
