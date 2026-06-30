import {
  createGlobalState,
  useIntervalFn,
  useLocalStorage,
} from '@vueuse/core'
import { ref } from 'vue'
import { generateUUID } from '@/utils/uuid'

const baseURL = 'https://led.baud-dance.com/api'

async function getOnline(userId) {
  const res = await fetch(`${baseURL}/online/serial/${userId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }
  return await res.json()
}

export default createGlobalState(() => {
  const uuid = useLocalStorage('uuid', generateUUID())
  const online = ref({ led: 'none', serial: 0 })
  const { pause, resume } = useIntervalFn(
    async () => {
      try {
        console.log('uuid:', uuid.value)
        const res = await getOnline(uuid.value)
        console.log('res:', res)
        online.value = res?.data || { led: 'none', serial: 0 }
      }
      catch (err) {
        console.warn('[useOnline] 获取在线人数失败:', err.message || err)
        // 保持上次状态，不中断轮询
      }
    },
    1000 * 60,
    { immediate: true, immediateCallback: true },
  )

  return { online, pause, resume }
})
