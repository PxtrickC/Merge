export function useDragScroll() {
  const el = ref(null)

  onMounted(() => {
    if (!el.value) return

    let pos = { left: 0, x: 0 }
    let dragged = false

    function preventClick(e) {
      e.preventDefault()
      e.stopPropagation()
    }

    function onMouseMove(e) {
      const dx = e.clientX - pos.x
      if (Math.abs(dx) > 5) dragged = true
      el.value.scrollLeft = pos.left - dx
    }

    function onMouseUp() {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      el.value.style.cursor = 'grab'
      el.value.style.removeProperty('user-select')

      if (dragged) {
        el.value.addEventListener('click', preventClick, { capture: true, once: true })
      }
    }

    function onMouseDown(e) {
      pos = { left: el.value.scrollLeft, x: e.clientX }
      dragged = false
      el.value.style.cursor = 'grabbing'
      el.value.style.userSelect = 'none'
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    }

    el.value.addEventListener('mousedown', onMouseDown)
    el.value.style.cursor = 'grab'
  })

  return el
}
