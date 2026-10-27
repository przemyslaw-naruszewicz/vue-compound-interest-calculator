<script setup>
import { InvestmentCalculator } from './index.js'
</script>

<template>
  <main class="demo">
    <header class="demo__header">
      <p class="demo__eyebrow">Savings planner</p>
      <h1>Compound Interest Calculator</h1>
      <p class="demo__intro">
        Explore how your savings could grow with monthly contributions and compound interest.
        Adjust the amounts, duration and annual return to see your projection update.
        Amounts are shown in Polish złoty (PLN).
      </p>
    </header>
    <InvestmentCalculator />
  </main>
</template>
