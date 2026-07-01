<script setup>
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
} from 'd3-force'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useNodeStore } from '@/store/useNodeStore'

const props = defineProps({
  width: { type: Number, default: 800 },
  height: { type: Number, default: 500 },
})

const emit = defineEmits(['nodeClick', 'nodeDblclick'])

const store = useNodeStore()
const svgRef = ref(null)
const dragging = ref(null)

// 初始布局：为新节点分配一个合理的起始位置
function autoLayout() {
  const controllers = store.controllers.value
  const actuators = store.actuators.value
  const padding = 60
  const ctrlGapX = (props.width - padding * 2) / Math.max(controllers.length || 1, 1)
  const actGapX = (props.width - padding * 2) / Math.max(actuators.length || 1, 1)

  controllers.forEach((node, i) => {
    if (!store.getNodePosition(node.id)) {
      const x = padding + i * ctrlGapX + ctrlGapX / 2
      store.updateNodePosition(node.id, x, props.height * 0.25)
    }
  })

  actuators.forEach((node, i) => {
    if (!store.getNodePosition(node.id)) {
      const x = padding + i * actGapX + actGapX / 2
      store.updateNodePosition(node.id, x, props.height * 0.75)
    }
  })
}

// 将 client 坐标转换为 SVG 内部坐标
function clientToSvg(clientX, clientY) {
  const svg = svgRef.value
  if (!svg)
    return { x: clientX, y: clientY }
  const pt = svg.createSVGPoint()
  pt.x = clientX
  pt.y = clientY
  const ctm = svg.getScreenCTM()
  if (!ctm)
    return { x: clientX, y: clientY }
  const svgP = pt.matrixTransform(ctm.inverse())
  return {
    x: Math.max(30, Math.min(props.width - 30, svgP.x)),
    y: Math.max(30, Math.min(props.height - 30, svgP.y)),
  }
}

// 从 store 节点构建物理模拟节点
function buildSimNodes() {
  return store.nodes.value.map((node) => {
    const pos = store.getNodePosition(node.id)
    return {
      id: node.id,
      x: pos?.x ?? props.width / 2,
      y: pos?.y ?? props.height / 2,
      vx: 0,
      vy: 0,
      type: node.type,
    }
  })
}

// 自动根据单控制器生成弹簧连接
function buildSimLinks(nodes) {
  const controllers = nodes.filter(n => n.type === 'controller')
  const actuators = nodes.filter(n => n.type === 'actuator')
  if (controllers.length === 0 || actuators.length === 0)
    return []
  const ctrl = controllers[0]
  return actuators.map(act => ({
    source: ctrl.id,
    target: act.id,
    id: `link_${ctrl.id}_${act.id}`,
  }))
}

// 力导向模拟
const simNodes = ref([])
const simLinks = ref([])
let simulation = null

function initSimulation() {
  if (simulation)
    simulation.stop()

  autoLayout()
  const nodes = buildSimNodes()
  const links = buildSimLinks(nodes)
  simNodes.value = nodes
  simLinks.value = links

  simulation = forceSimulation(nodes)
    .alphaDecay(0.02)
    .velocityDecay(0.3)
    .force('link', forceLink(links)
      .id(d => d.id)
      .distance(props.height * 0.35)
      .strength(0.6))
    .force('charge', forceManyBody().strength(-300))
    .force('collide', forceCollide().radius(48).strength(0.8))
    .force('center', forceCenter(props.width / 2, props.height / 2).strength(0.05))
    .force('x', forceX(props.width / 2).strength(0.03))
    .force('y', forceY(d => d.type === 'controller' ? props.height * 0.25 : props.height * 0.75).strength(0.08))
    .on('tick', () => {
      nodes.forEach((n) => {
        // 边界限制
        n.x = Math.max(30, Math.min(props.width - 30, n.x))
        n.y = Math.max(30, Math.min(props.height - 30, n.y))
        store.updateNodePosition(n.id, n.x, n.y)
      })
    })
}

function reHeat() {
  if (simulation) {
    autoLayout()
    const nodes = buildSimNodes()
    const links = buildSimLinks(nodes)
    simNodes.value = nodes
    simLinks.value = links
    simulation.nodes(nodes)
    simulation.force('link').links(links)
    simulation.alpha(1).restart()
  }
}

onMounted(() => {
  initSimulation()
})

onBeforeUnmount(() => {
  if (simulation)
    simulation.stop()
})

watch(() => store.nodes.value.length, () => {
  reHeat()
})

// 节点在画布上的渲染数据
const nodeElements = computed(() => {
  return store.nodes.value.map((node) => {
    const simNode = simNodes.value.find(n => n.id === node.id)
    const pos = simNode || store.getNodePosition(node.id) || { x: props.width / 2, y: props.height / 2 }
    const isController = node.type === 'controller'
    return {
      id: node.id,
      x: pos.x,
      y: pos.y,
      r: 24,
      name: node.name || node.id,
      fill: node.status === 'online'
        ? (isController ? '#3b82f6' : '#22c55e')
        : (node.status === 'offline' ? '#6b7280' : '#f59e0b'),
      stroke: store.selectedNodeId.value === node.id ? '#facc15' : 'none',
      strokeWidth: store.selectedNodeId.value === node.id ? 3 : 0,
      type: isController ? '控制器' : '执行器',
    }
  })
})

// 连线渲染数据：基于物理模拟节点位置
const linkElements = computed(() => {
  if (simLinks.value.length === 0)
    return []

  const nodeR = 24
  return simLinks.value.map((link) => {
    const source = typeof link.source === 'object' ? link.source : simNodes.value.find(n => n.id === link.source)
    const target = typeof link.target === 'object' ? link.target : simNodes.value.find(n => n.id === link.target)
    if (!source || !target)
      return null

    const dx = target.x - source.x
    const dy = target.y - source.y
    const dist = Math.sqrt(dx * dx + dy * dy) || 1
    const ux = dx / dist
    const uy = dy / dist

    return {
      id: link.id,
      x1: source.x + ux * nodeR,
      y1: source.y + uy * nodeR,
      x2: target.x - ux * (nodeR + 8),
      y2: target.y - uy * (nodeR + 8),
    }
  }).filter(Boolean)
})

// 拖拽
function onPointerDown(e, nodeId) {
  const node = simNodes.value.find(n => n.id === nodeId)
  if (!node || !simulation)
    return
  dragging.value = nodeId
  store.selectNode(nodeId)
  e.target.setPointerCapture(e.pointerId)
  const pos = clientToSvg(e.clientX, e.clientY)
  node.fx = pos.x
  node.fy = pos.y
  simulation.alpha(1).restart()
}

function onPointerMove(e) {
  if (!dragging.value)
    return
  const node = simNodes.value.find(n => n.id === dragging.value)
  if (!node)
    return
  const pos = clientToSvg(e.clientX, e.clientY)
  node.fx = pos.x
  node.fy = pos.y
}

function onPointerUp() {
  if (!dragging.value)
    return
  const node = simNodes.value.find(n => n.id === dragging.value)
  if (node) {
    node.fx = null
    node.fy = null
  }
  dragging.value = null
}
</script>

<template>
  <svg
    ref="svgRef"
    :viewBox="`0 0 ${width} ${height}`"
    class="w-full h-full bg-background/20"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointerleave="onPointerUp"
  >
    <!-- 绑定关系箭头标记 -->
    <defs>
      <marker
        id="arrowhead"
        markerWidth="10"
        markerHeight="7"
        refX="10"
        refY="3.5"
        orient="auto"
      >
        <polygon points="0 0, 10 3.5, 0 7" fill="#6366f1" />
      </marker>
    </defs>

    <!-- 连线 -->
    <g v-if="linkElements.length > 0">
      <line
        v-for="link in linkElements"
        :key="link.id"
        :x1="link.x1"
        :y1="link.y1"
        :x2="link.x2"
        :y2="link.y2"
        stroke="#6366f1"
        stroke-width="2"
        marker-end="url(#arrowhead)"
        class="cursor-pointer"
      />
    </g>

    <!-- 空状态提示 -->
    <text
      v-if="store.nodes.value.length === 0"
      :x="width / 2"
      :y="height / 2"
      text-anchor="middle"
      fill="#9ca3af"
      font-size="14"
    >
      暂无节点，点击"扫描"或"添加"按钮开始
    </text>

    <!-- 节点 -->
    <g
      v-for="node in nodeElements"
      :key="node.id"
      :style="{ cursor: dragging === node.id ? 'grabbing' : 'grab' }"
      @pointerdown="e => onPointerDown(e, node.id)"
      @click="emit('nodeClick', node.id)"
      @dblclick="emit('nodeDblclick', node.id)"
    >
      <!-- 阴影 -->
      <circle
        :cx="node.x + 2"
        :cy="node.y + 2"
        :r="node.r"
        fill="rgba(0,0,0,0.15)"
      />
      <!-- 节点圆 -->
      <circle
        :cx="node.x"
        :cy="node.y"
        :r="node.r"
        :fill="node.fill"
        :stroke="node.stroke"
        :stroke-width="node.strokeWidth"
        class="transition-colors duration-200"
      />
      <!-- 节点类型标签 -->
      <text
        :x="node.x"
        :y="node.y + 4"
        text-anchor="middle"
        fill="white"
        font-size="11"
        font-weight="bold"
      >
        {{ node.type === '控制器' ? 'C' : 'A' }}
      </text>
      <!-- 节点名称 -->
      <text
        :x="node.x"
        :y="node.y + node.r + 16"
        text-anchor="middle"
        fill="currentColor"
        font-size="12"
        class="select-none"
      >
        {{ node.name.length > 8 ? `${node.name.slice(0, 8)}…` : node.name }}
      </text>
    </g>
  </svg>
</template>
