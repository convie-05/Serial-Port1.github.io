<script setup>
import { reactive, ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useNodeProtocol } from '@/composables/useNodeProtocol'
import { useNodeStore } from '@/store/useNodeStore'

const emit = defineEmits(['close'])

const protocol = useNodeProtocol()
const store = useNodeStore()
const saving = ref(false)

const form = reactive({
  controllerId: '',
  actuatorId: '',
  rule: '{}',
})

async function handleSave() {
  if (!form.controllerId || !form.actuatorId)
    return
  saving.value = true
  try {
    const contId = form.controllerId
    const actId = form.actuatorId
    await protocol.setBinding(contId, actId, form.rule)
    store.setBinding({
      controllerId: contId,
      actuatorId: actId,
      rule: form.rule,
    })
    emit('close')
  }
  catch (e) {
    console.error('设置绑定关系失败:', e)
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="space-y-4 p-4">
    <h3 class="text-lg font-semibold">
      配置绑定关系
    </h3>

    <div class="space-y-1.5">
      <Label>选择控制器</Label>
      <Select v-model="form.controllerId">
        <SelectTrigger>
          <SelectValue placeholder="请选择控制器" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="ctrl in store.controllers.value"
            :key="ctrl.id"
            :value="ctrl.id"
          >
            {{ ctrl.name }} ({{ ctrl.id }})
          </SelectItem>
          <SelectItem v-if="store.controllers.value.length === 0" value="" disabled>
            暂无控制器
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div class="space-y-1.5">
      <Label>选择执行器</Label>
      <Select v-model="form.actuatorId">
        <SelectTrigger>
          <SelectValue placeholder="请选择执行器" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="act in store.actuators.value"
            :key="act.id"
            :value="act.id"
          >
            {{ act.name }} ({{ act.id }})
          </SelectItem>
          <SelectItem v-if="store.actuators.value.length === 0" value="" disabled>
            暂无执行器
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div class="space-y-1.5">
      <Label>规则 (JSON)</Label>
      <Input v-model="form.rule" placeholder="{&quot;type&quot;:&quot;threshold&quot;,&quot;value&quot;:50}" />
    </div>

    <div class="flex space-x-2 justify-end pt-2">
      <Button variant="outline" @click="emit('close')">
        取消
      </Button>
      <Button
        :disabled="!form.controllerId || !form.actuatorId || saving"
        @click="handleSave"
      >
        {{ saving ? '保存中...' : '保存绑定' }}
      </Button>
    </div>
  </div>
</template>
