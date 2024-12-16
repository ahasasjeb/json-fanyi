import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useVisitorStore = defineStore('visitor', () => {
  const visitorId = ref('')

  const setVisitorId = (id: string) => {
    visitorId.value = id
  }

  return {
    visitorId,
    setVisitorId,
  }
})
