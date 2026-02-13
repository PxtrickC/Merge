<script setup>
import { Bar } from "vue-chartjs"
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js"
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

const mass_repartition = await useAPI("/mass_repartition")

const chart_data = {
  labels: [],
  datasets: [
    {
      label: "tokens",
      data: [],
      backgroundColor: "#33F8",
      hoverBackgroundColor: "#55F",
      borderRadius: 3,
    },
  ],
}
const chart_options = {
  normalized: true,
  responsive: true,
  plugins: {
    legend: { display: false },
    title: { display: false },
    tooltip: { backgroundColor: "#33F3" },
  },
  scales: {
    x: { grid: { display: false }, ticks: { color: "#fff6" } },
    y: {
      grid: { display: true, color: "#39373E99" },
      position: "right",
      ticks: { color: "#fff6" },
    },
  },
}

if (mass_repartition.value) fillChartData(mass_repartition.value)
else watch(mass_repartition, fillChartData)

function fillChartData(data) {
  const sorted = [...data].sort((a, b) => b.count - a.count)
  for (const item of sorted) {
    if (item.count === 0) continue
    chart_data.datasets[0].data.push(item.count)
    chart_data.labels.push(item.label ?? `m(${item.mass})`)
  }
}
</script>

<template>
  <div class="graph_container">
    <div class="graph__title">
      <span>Token per mass</span>
    </div>
    <div class="h-full">
      <Bar v-if="mass_repartition" :data="chart_data" :options="chart_options" />
    </div>
  </div>
</template>

<style lang="postcss" scoped>
.graph__container {
  height: calc(100% - 2rem);
}
.graph__title {
  @apply pb-2;
  @apply border-b border-white border-opacity-10;
  @apply flex justify-between items-center;
  @apply text-xl text-white text-opacity-40;
}
</style>
