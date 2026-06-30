/**
 * 串口节点通信协议层
 *
 * 帧结构: [0xAA 0x55] [CMD] [NODE_ID] [LEN_H] [LEN_L] [PAYLOAD...] [CHECKSUM]
 *   - 帧头: 双字节 0xAA 0x55
 *   - CMD: 1字节命令码
 *   - NODE_ID: 1字节节点ID (0xFF=广播)
 *   - LEN: 2字节大端 Payload 长度
 *   - PAYLOAD: n字节数据体
 *   - CHECKSUM: 1字节 XOR 校验
 *
 * 命令定义:
 *   0x01 上位机→下位机 发现节点(广播)
 *   0x02 下位机→上位机 节点信息上报
 *   0x03 双向 设置/查询绑定关系
 *   0x04 上位机→下位机 控制器参数配置
 *   0x05 上位机→下位机 执行器控制指令
 *   0x06 下位机→上位机 节点状态上报
 */
import { inject, onBeforeUnmount, ref } from 'vue'

const FRAME_HEAD = [0xAA, 0x55]

class NodeProtocolError extends Error {
  constructor(message) {
    super(message)
    this.name = 'NodeProtocolError'
  }
}

export function useNodeProtocol() {
  const serial = inject('serial', null)
  const onNodeMessage = ref(null) // 回调注册: (cmd, nodeId, payload) => void
  let receiveBuffer = []
  let cleanup = null

  // XOR校验
  function calcChecksum(bytes) {
    return bytes.reduce((acc, b) => acc ^ b, 0)
  }

  // 构建帧
  function buildFrame(cmd, nodeId, payload = []) {
    const header = [...FRAME_HEAD, cmd, nodeId]
    const len = payload.length
    const lenBytes = [(len >> 8) & 0xFF, len & 0xFF]
    const frame = [...header, ...lenBytes, ...payload]
    const checksum = calcChecksum(frame)
    frame.push(checksum)
    return frame
  }

  // 发送帧
  async function sendCommand(cmd, nodeId, payload = []) {
    if (!serial || !serial.sendHex) {
      throw new NodeProtocolError('串口未就绪')
    }
    const frame = buildFrame(cmd, nodeId, payload)
    await serial.sendHex(new Uint8Array(frame))
  }

  // 接收数据处理 - 帧解析
  function handleRawData(data) {
    if (typeof data === 'string') {
      // 尝试解析HEX字符串
      const hexStr = data.replace(/\s/g, '').replace(/[^0-9a-f]/gi, '')
      if (hexStr.length % 2 === 0) {
        const bytes = []
        for (let i = 0; i < hexStr.length; i += 2) {
          bytes.push(Number.parseInt(hexStr.substring(i, i + 2), 16))
        }
        receiveBuffer.push(...bytes)
      }
      else {
        return
      }
    }
    else if (data instanceof Uint8Array || data instanceof ArrayBuffer) {
      const bytes = data instanceof Uint8Array ? Array.from(data) : Array.from(new Uint8Array(data))
      receiveBuffer.push(...bytes)
    }
    else {
      return
    }

    // 尝试解析帧
    tryParseFrames()
  }

  function tryParseFrames() {
    while (receiveBuffer.length >= 7) {
      // 查找帧头
      const headIdx = receiveBuffer.findIndex(
        (_, i) => i + 1 < receiveBuffer.length
          && receiveBuffer[i] === FRAME_HEAD[0]
          && receiveBuffer[i + 1] === FRAME_HEAD[1],
      )
      if (headIdx < 0) {
        receiveBuffer = []
        return
      }

      // 丢弃帧头前的数据
      if (headIdx > 0) {
        receiveBuffer.splice(0, headIdx)
      }

      if (receiveBuffer.length < 7)
        return

      const cmd = receiveBuffer[2]
      const nodeId = receiveBuffer[3]
      const payloadLen = (receiveBuffer[4] << 8) | receiveBuffer[5]
      const frameTotalLen = 7 + payloadLen

      if (receiveBuffer.length < frameTotalLen)
        return

      const payload = receiveBuffer.slice(6, 6 + payloadLen)
      const receivedChecksum = receiveBuffer[6 + payloadLen]

      // 校验
      const frameWithoutChecksum = receiveBuffer.slice(0, 6 + payloadLen)
      const expectedChecksum = calcChecksum(frameWithoutChecksum)
      if (receivedChecksum !== expectedChecksum) {
        // 校验失败，跳过第一个字节继续查找
        receiveBuffer.splice(0, 1)
        continue
      }

      // 移除已解析的帧
      receiveBuffer.splice(0, frameTotalLen)

      // 触发回调
      if (onNodeMessage.value) {
        onNodeMessage.value(cmd, nodeId, payload)
      }
    }
  }

  // 启动监听
  function startListening() {
    if (!serial || cleanup)
      return

    if (serial.onTerminalData) {
      cleanup = serial.onTerminalData(handleRawData)
    }
  }

  // 停止监听
  function stopListening() {
    if (cleanup) {
      cleanup()
      cleanup = null
    }
    receiveBuffer = []
  }

  onBeforeUnmount(() => {
    stopListening()
  })

  // ---- 高层API ----

  // 发现节点（广播）
  async function discoverNodes() {
    await sendCommand(0x01, 0xFF)
  }

  // 查询节点信息
  async function queryNodeInfo(nodeId) {
    await sendCommand(0x02, nodeId)
  }

  // 设置绑定关系
  async function setBinding(controllerId, actuatorId, rule = '{}') {
    const payload = [
      controllerId,
      actuatorId,
      ...new TextEncoder().encode(rule),
    ]
    await sendCommand(0x03, 0xFF, payload)
  }

  // 配置控制器
  async function configController(nodeId, params) {
    const paramsStr = JSON.stringify(params)
    await sendCommand(0x04, nodeId, [...new TextEncoder().encode(paramsStr)])
  }

  // 控制执行器
  async function controlActuator(nodeId, action) {
    const actionStr = JSON.stringify(action)
    await sendCommand(0x05, nodeId, [...new TextEncoder().encode(actionStr)])
  }

  return {
    sendCommand,
    discoverNodes,
    queryNodeInfo,
    setBinding,
    configController,
    controlActuator,
    onNodeMessage,
    startListening,
    stopListening,
  }
}

export { NodeProtocolError }
