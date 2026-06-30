import { onBeforeUnmount, ref } from 'vue'
import { useNodeProtocol } from '@/composables/useNodeProtocol'
import { useNodeStore } from '@/store/useNodeStore'

/**
 * 节点自动扫描 composable
 * 定时广播发现帧，将响应节点自动加入 Store
 */
export function useNodeAutoScan() {
  const { discoverNodes, onNodeMessage, startListening } = useNodeProtocol()
  const { addNode, updateNodeStatus } = useNodeStore()

  const scanning = ref(false)
  let scanTimer = null
  const SCAN_INTERVAL = 3000 // 默认3秒
  const NODE_TIMEOUT = 10000 // 10秒无响应视为离线

  // 处理节点上报帧
  function handleNodeMessage(cmd, nodeId, payload) {
    if (cmd === 0x02) {
      // 节点信息上报
      let name = `节点 ${nodeId}`
      let type = 'actuator'
      try {
        const infoStr = new TextDecoder().decode(new Uint8Array(payload))
        const info = JSON.parse(infoStr)
        name = info.name || name
        type = info.type || type
      }
      catch {
        // 解析失败，使用默认值
      }

      addNode({
        id: `node_${nodeId}`,
        type,
        name,
        nodeId,
        status: 'online',
      })
    }
    else if (cmd === 0x06) {
      // 节点状态上报
      const storeId = `node_${nodeId}`
      try {
        const statusStr = new TextDecoder().decode(new Uint8Array(payload))
        const status = JSON.parse(statusStr)
        updateNodeStatus(storeId, status.status || 'online')
      }
      catch {
        updateNodeStatus(storeId, 'online')
      }
    }
  }

  // 开始扫描
  function startScan() {
    if (scanning.value)
      return

    scanning.value = true
    startListening()

    // 注册消息回调
    onNodeMessage.value = handleNodeMessage

    // 立即发现一次
    discoverNodes().catch(() => {})

    // 定时扫描
    scanTimer = setInterval(() => {
      discoverNodes().catch(() => {})

      // 标记超时节点为离线
      const now = Date.now()
      const store = useNodeStore()
      store.nodes.value.forEach((node) => {
        if (node.lastSeen && now - node.lastSeen > NODE_TIMEOUT) {
          if (node.status !== 'offline') {
            updateNodeStatus(node.id, 'offline')
          }
        }
      })
    }, SCAN_INTERVAL)
  }

  // 停止扫描
  function stopScan() {
    scanning.value = false
    if (scanTimer) {
      clearInterval(scanTimer)
      scanTimer = null
    }
    onNodeMessage.value = null
  }

  // 手动触发发现
  async function triggerDiscovery() {
    if (scanning.value) {
      await discoverNodes()
    }
  }

  onBeforeUnmount(() => {
    stopScan()
  })

  return {
    scanning,
    startScan,
    stopScan,
    triggerDiscovery,
  }
}
