<script setup>
import { reactive } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useNodeProtocol } from '@/composables/useNodeProtocol'
import { useNodeStore } from '@/store/useNodeStore'

const props = defineProps({
  node: { type: Object, required: true },
})

const protocol = useNodeProtocol()
const store = useNodeStore()

const form = reactive({
  state: props.node.config?.state || 'off',
  pwm: props.node.config?.pwm ?? 0,
  position: props.node.config?.position ?? 0,
})

async function sendAction(action) {
  try {
    await protocol.controlActuator(props.node.nodeId || props.node.id, action)
    store.addNode({ ...props.node, config: { ...props.node.config, ...action } })
  }
  catch (e) {
    console.error('控制执行器失败:', e)
  }
}

function turnOn() {
  form.state = 'on'
  sendAction({ state: 'on', pwm: form.pwm })
}

function turnOff() {
  form.state = 'off'
  sendAction({ state: 'off', pwm: 0 })
}

function setPwm() {
  sendAction({ state: form.state, pwm: form.pwm })
}

function setPosition() {
  sendAction({ state: form.state, position: form.position })
}
</script>

<template>
  <div class="space-y-3 p-2">
    <div class="flex space-x-2">
      <Button
        variant="default"
        class="flex-1"
        :class="{ 'bg-green-600 hover:bg-green-700': form.state === 'on' }"
        :disabled="form.state === 'on'"
        @click="turnOn"
      >
        开启
      </Button>
      <Button
        variant="secondary"
        class="flex-1"
        :class="{ 'bg-red-600 hover:bg-red-700 text-white': form.state === 'off' }"
        :disabled="form.state === 'off'"
        @click="turnOff"
      >
        关闭
      </Button>
    </div>

    <div class="space-y-1.5">
      <Label>PWM 值 (0-255)</Label>
      <div class="flex space-x-2">
        <Input v-model.number="form.pwm" type="number" min="0" max="255" class="flex-1" />
        <Button variant="outline" @click="setPwm">
          设置
        </Button>
      </div>
    </div>

    <div v-if="node.config?.position !== undefined" class="space-y-1.5">
      <Label>位置</Label>
      <div class="flex space-x-2">
        <Input v-model.number="form.position" type="number" min="0" max="180" class="flex-1" />
        <Button variant="outline" @click="setPosition">
          设置
        </Button>
      </div>
    </div>
  </div>
</template>
