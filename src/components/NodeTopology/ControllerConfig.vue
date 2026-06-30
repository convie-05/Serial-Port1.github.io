<script setup>
import { reactive } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useNodeProtocol } from '@/composables/useNodeProtocol'
import { useNodeStore } from '@/store/useNodeStore'

const props = defineProps({
  node: { type: Object, required: true },
})

const protocol = useNodeProtocol()
const store = useNodeStore()

const form = reactive({
  mode: props.node.config?.mode || 'auto',
  pid: { ...(props.node.config?.pid || { p: 1.0, i: 0.1, d: 0.05 }) },
  threshold: props.node.config?.threshold ?? 50,
})

async function handleSave() {
  const config = { mode: form.mode, pid: form.pid, threshold: form.threshold }
  try {
    await protocol.configController(props.node.nodeId || props.node.id, config)
    store.addNode({ ...props.node, config })
  }
  catch (e) {
    console.error('配置控制器失败:', e)
  }
}
</script>

<template>
  <div class="space-y-3 p-2">
    <div class="space-y-1.5">
      <Label>工作模式</Label>
      <Select v-model="form.mode">
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="auto">
            自动
          </SelectItem>
          <SelectItem value="manual">
            手动
          </SelectItem>
          <SelectItem value="pid">
            PID
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div class="space-y-1.5">
      <Label>PID - P</Label>
      <Input v-model.number="form.pid.p" type="number" step="0.1" />
    </div>
    <div class="space-y-1.5">
      <Label>PID - I</Label>
      <Input v-model.number="form.pid.i" type="number" step="0.01" />
    </div>
    <div class="space-y-1.5">
      <Label>PID - D</Label>
      <Input v-model.number="form.pid.d" type="number" step="0.01" />
    </div>
    <div class="space-y-1.5">
      <Label>阈值</Label>
      <Input v-model.number="form.threshold" type="number" min="0" max="100" />
    </div>

    <Button class="w-full" @click="handleSave">
      保存配置
    </Button>
  </div>
</template>
