<script setup>
import { computed } from 'vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useNodeStore } from '@/store/useNodeStore'
import ActuatorControl from './ActuatorControl.vue'
import ControllerConfig from './ControllerConfig.vue'

const store = useNodeStore()

const statusBadge = computed(() => {
  if (!store.selectedNode.value)
    return { text: '', variant: 'secondary' }
  const s = store.selectedNode.value.status
  if (s === 'online')
    return { text: '在线', variant: 'default' }
  if (s === 'offline')
    return { text: '离线', variant: 'secondary' }
  return { text: '未知', variant: 'outline' }
})

// 该节点的绑定关系
const nodeBindings = computed(() => {
  if (!store.selectedNode.value)
    return []
  if (store.selectedNode.value.type === 'controller') {
    return store.getBoundActuators(store.selectedNode.value.id).map(a => ({
      type: '执行器',
      name: a.name,
      id: a.id,
    }))
  }
  return store.getBoundControllers(store.selectedNode.value.id).map(c => ({
    type: '控制器',
    name: c.name,
    id: c.id,
  }))
})
</script>

<template>
  <div class="h-full flex flex-col bg-background/40 backdrop-blur-sm">
    <!-- 无选中节点 -->
    <div
      v-if="!store.selectedNode.value"
      class="flex items-center justify-center h-full text-muted-foreground text-sm p-4 text-center"
    >
      点击拓扑图中的节点查看详情
    </div>

    <!-- 选中节点详情 -->
    <template v-else>
      <div class="p-3 space-y-2">
        <div class="flex items-center justify-between">
          <h4 class="font-semibold text-sm truncate">
            {{ store.selectedNode.value.name }}
          </h4>
          <Badge :variant="statusBadge.variant">
            {{ statusBadge.text }}
          </Badge>
        </div>
        <div class="text-xs text-muted-foreground">
          ID: {{ store.selectedNode.value.id }}
        </div>
        <div class="text-xs text-muted-foreground">
          类型: {{ store.selectedNode.value.type === 'controller' ? '控制器' : '执行器' }}
        </div>
      </div>

      <Separator />

      <ScrollArea class="flex-1">
        <!-- 控制器配置 -->
        <ControllerConfig
          v-if="store.selectedNode.value.type === 'controller'"
          :node="store.selectedNode.value"
        />

        <!-- 执行器控制 -->
        <ActuatorControl
          v-else
          :node="store.selectedNode.value"
        />
      </ScrollArea>

      <Separator />

      <!-- 绑定关系列表 -->
      <div class="p-3 space-y-2">
        <h5 class="text-xs font-medium text-muted-foreground uppercase">
          绑定关系
        </h5>
        <div v-if="nodeBindings.length === 0" class="text-xs text-muted-foreground">
          暂未绑定
        </div>
        <div
          v-for="b in nodeBindings"
          :key="b.id"
          class="flex items-center justify-between text-xs py-1"
        >
          <span>
            <Badge variant="outline" class="mr-1">{{ b.type }}</Badge>
            {{ b.name }}
          </span>
        </div>
      </div>

      <Separator />

      <div class="p-2">
        <Button
          variant="destructive"
          size="sm"
          class="w-full"
          @click="store.removeNode(store.selectedNode.value.id)"
        >
          删除节点
        </Button>
      </div>
    </template>
  </div>
</template>
