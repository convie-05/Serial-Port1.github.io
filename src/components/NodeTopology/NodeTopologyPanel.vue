<script setup>
import { onBeforeUnmount, ref } from 'vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useNodeAutoScan } from '@/composables/useNodeAutoScan'
import { useNodeStore } from '@/store/useNodeStore'
import BindingConfigDialog from './BindingConfigDialog.vue'
import NodeDetailPanel from './NodeDetailPanel.vue'
import NodeTopologyGraph from './NodeTopologyGraph.vue'

const store = useNodeStore()
const scan = useNodeAutoScan()
const showBindingDialog = ref(false)

function addController() {
  store.addMockNode('controller')
}

function addActuator() {
  store.addMockNode('actuator')
}

function onNodeClick(nodeId) {
  store.selectNode(nodeId)
}

function clearAll() {
  const ids = [...store.nodes.value.map(n => n.id)]
  ids.forEach(id => store.removeNode(id))
}

onBeforeUnmount(() => {
  scan.stopScan()
})
</script>

<template>
  <div class="h-full flex flex-col bg-background/40 backdrop-blur-sm">
    <!-- 工具栏 -->
    <div class="flex items-center justify-between px-3 py-2 border-b">
      <div class="flex items-center space-x-2">
        <h3 class="text-sm font-semibold">
          节点拓扑
        </h3>
        <Badge variant="outline" class="text-xs">
          {{ store.controllers.value.length }} 控制器
        </Badge>
        <Badge variant="outline" class="text-xs">
          {{ store.actuators.value.length }} 执行器
        </Badge>
        <Badge
          :variant="scan.scanning.value ? 'default' : 'secondary'"
          class="text-xs"
        >
          {{ scan.scanning.value ? '扫描中' : '已停止' }}
        </Badge>
      </div>
      <div class="flex items-center space-x-1">
        <Button
          size="sm"
          variant="outline"
          class="h-7 px-2 text-xs"
          @click="scan.scanning.value ? scan.stopScan() : scan.startScan()"
        >
          {{ scan.scanning.value ? '停止扫描' : '开始扫描' }}
        </Button>
        <Button
          size="sm"
          variant="outline"
          class="h-7 px-2 text-xs"
          @click="scan.triggerDiscovery"
        >
          发现
        </Button>
        <Separator orientation="vertical" class="h-4" />
        <Button
          size="sm"
          variant="outline"
          class="h-7 px-2 text-xs"
          :disabled="store.controllers.value.length > 0"
          @click="addController"
        >
          + 控制器
        </Button>
        <Button
          size="sm"
          variant="outline"
          class="h-7 px-2 text-xs"
          @click="addActuator"
        >
          + 执行器
        </Button>
        <Dialog v-model:open="showBindingDialog">
          <DialogTrigger as-child>
            <Button size="sm" variant="outline" class="h-7 px-2 text-xs">
              配置绑定
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>配置绑定关系</DialogTitle>
            <DialogDescription>
              选择控制器和执行器建立绑定关系
            </DialogDescription>
            <BindingConfigDialog @close="showBindingDialog = false" />
          </DialogContent>
        </Dialog>
        <Separator orientation="vertical" class="h-4" />
        <Button
          size="sm"
          variant="ghost"
          class="h-7 px-2 text-xs text-destructive"
          @click="clearAll"
        >
          清空
        </Button>
      </div>
    </div>

    <!-- 主区域：拓扑图 + 详情侧栏 -->
    <div class="flex-1 overflow-hidden">
      <ResizablePanelGroup id="topology-main" direction="horizontal">
        <ResizablePanel :order="20" :default-size="70" :min-size="50">
          <div class="w-full h-full relative">
            <NodeTopologyGraph
              :width="800"
              :height="500"
              class="w-full h-full"
              @node-click="onNodeClick"
            />
          </div>
        </ResizablePanel>
        <ResizableHandle with-handle />
        <ResizablePanel :order="21" :default-size="30" :min-size="20" :max-size="45">
          <ScrollArea class="h-full">
            <NodeDetailPanel />
          </ScrollArea>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  </div>
</template>
