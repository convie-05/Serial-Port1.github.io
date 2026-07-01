import { createGlobalState, useLocalStorage } from '@vueuse/core'
import { computed, ref } from 'vue'

function isValidPosition(p) {
  return p && Number.isFinite(p.x) && Number.isFinite(p.y)
}

/**
 * 节点拓扑控制 Store
 * 管理所有节点信息、绑定关系、布局位置
 */
export const useNodeStore = createGlobalState(() => {
  // 节点列表
  const nodes = ref([])
  // 绑定关系列表
  const bindings = ref([])
  // 当前选中的节点ID
  const selectedNodeId = ref(null)
  // 节点在SVG画布上的位置缓存
  const nodePositions = useLocalStorage('nodeTopology:positions', {}, { listenToStorageChanges: false })

  // 清理已损坏的位置数据（一次性修复）
  const cleanedPositions = {}
  for (const id in nodePositions.value) {
    if (isValidPosition(nodePositions.value[id])) {
      cleanedPositions[id] = nodePositions.value[id]
    }
  }
  nodePositions.value = cleanedPositions

  // 选中节点对象
  const selectedNode = computed(() => {
    if (!selectedNodeId.value)
      return null
    return nodes.value.find(n => n.id === selectedNodeId.value) || null
  })

  // 按类型分组的节点
  const controllers = computed(() => nodes.value.filter(n => n.type === 'controller'))
  const actuators = computed(() => nodes.value.filter(n => n.type === 'actuator'))

  // 添加节点
  function addNode(node) {
    // 控制器全局唯一：若已存在控制器，则更新该控制器而非新增
    if (node.type === 'controller') {
      const existing = nodes.value.find(n => n.type === 'controller')
      if (existing) {
        const index = nodes.value.findIndex(n => n.id === existing.id)
        nodes.value[index] = { ...nodes.value[index], ...node, id: existing.id, lastSeen: Date.now() }
        return
      }
    }

    const index = nodes.value.findIndex(n => n.id === node.id)
    if (index >= 0) {
      // 更新已有节点
      nodes.value[index] = { ...nodes.value[index], ...node, lastSeen: Date.now() }
    }
    else {
      // 新增节点
      nodes.value.push({ ...node, lastSeen: Date.now() })
    }
  }

  // 移除节点
  function removeNode(id) {
    nodes.value = nodes.value.filter(n => n.id !== id)
    bindings.value = bindings.value.filter(
      b => b.controllerId !== id && b.actuatorId !== id,
    )
    if (selectedNodeId.value === id) {
      selectedNodeId.value = null
    }
  }

  // 更新节点状态
  function updateNodeStatus(id, status) {
    const node = nodes.value.find(n => n.id === id)
    if (node) {
      node.status = status
      node.lastSeen = Date.now()
    }
  }

  // 设置绑定关系
  function setBinding(binding) {
    const index = bindings.value.findIndex(
      b => b.controllerId === binding.controllerId && b.actuatorId === binding.actuatorId,
    )
    if (index >= 0) {
      bindings.value[index] = { ...bindings.value[index], ...binding }
    }
    else {
      bindings.value.push({ id: `b_${Date.now()}`, ...binding })
    }
  }

  // 移除绑定关系
  function removeBinding(id) {
    bindings.value = bindings.value.filter(b => b.id !== id)
  }

  // 获取指定控制器的绑定执行器列表
  function getBoundActuators(controllerId) {
    return bindings.value
      .filter(b => b.controllerId === controllerId)
      .map(b => nodes.value.find(n => n.id === b.actuatorId))
      .filter(Boolean)
  }

  // 获取指定执行器的绑定控制器列表
  function getBoundControllers(actuatorId) {
    return bindings.value
      .filter(b => b.actuatorId === actuatorId)
      .map(b => nodes.value.find(n => n.id === b.controllerId))
      .filter(Boolean)
  }

  // 选中节点
  function selectNode(id) {
    selectedNodeId.value = id
  }

  // 清除选中
  function clearSelection() {
    selectedNodeId.value = null
  }

  // 更新节点位置（SVG拖拽后保存）
  function updateNodePosition(id, x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y))
      return
    nodePositions.value = { ...nodePositions.value, [id]: { x, y } }
  }

  // 获取节点位置
  function getNodePosition(id) {
    return nodePositions.value[id] || null
  }

  // 模拟添加节点（无硬件时可测试）
  function addMockNode(type, name) {
    const id = `mock_${type}_${Date.now()}`
    addNode({
      id,
      type,
      name: name || `${type === 'controller' ? '控制器' : '执行器'} ${nodes.value.length + 1}`,
      status: 'online',
      config: type === 'controller'
        ? { mode: 'auto', pid: { p: 1.0, i: 0.1, d: 0.05 }, threshold: 50 }
        : { pwm: 0, position: 0, state: 'off' },
    })
    return id
  }

  return {
    nodes,
    bindings,
    selectedNodeId,
    selectedNode,
    controllers,
    actuators,
    nodePositions,
    addNode,
    removeNode,
    updateNodeStatus,
    setBinding,
    removeBinding,
    getBoundActuators,
    getBoundControllers,
    selectNode,
    clearSelection,
    updateNodePosition,
    getNodePosition,
    addMockNode,
  }
})
