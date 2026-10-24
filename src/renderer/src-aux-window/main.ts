import 'reflect-metadata'

import '@renderer-shared/assets/css/tailwind.css'

import '@renderer-shared/assets/css/base-styles.css'
import '@renderer-shared/assets/css/lol-view.css'
import '@renderer-shared/assets/css/theme-system.css'
import { i18next } from '@renderer-shared/i18n'
import { MAIN_SHARD_NAMESPACE } from '@renderer-shared/shards/logger/context'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import duration from 'dayjs/plugin/duration'
import relativeTime from 'dayjs/plugin/relativeTime'
import I18nextVue from 'i18next-vue'
import { createPinia } from 'pinia'
import { createApp } from 'vue'

import NaiveUIProviderApp from './NaiveUIProviderApp.vue'
import './assets/css/styles.css'
import { manager } from './shards'

/**
 * 启动失败时自动重载的次数。分片初始化偶发竞态失败时，重载通常即可恢复；
 * 连续失败则说明是确定性错误，此时显示错误信息而不是白屏。
 */
const BOOTSTRAP_RETRY_KEY = 'akari:aux-window:bootstrap-retries'
const MAX_BOOTSTRAP_RETRIES = 2
const RETRY_DELAY_MS = 800

/**
 * `manager.setup()` 理论上不会永久挂起，但一旦某个分片的 `onInit` 等不到结果，
 * 它既不会抛错也不会结束 —— 表现就是永久白窗（无报错、无弹窗、无崩溃）。
 * 这里加一个上限，把「挂起」也归入可恢复的失败路径。
 */
const BOOTSTRAP_TIMEOUT_MS = 20000

function describeError(error: unknown): string {
  if (error instanceof Error) {
    const cause = (error as { cause?: unknown }).cause

    if (cause instanceof Error) {
      return `${error.message} | cause: ${cause.name}: ${cause.message}`
    }

    if (cause) {
      return `${error.message} | cause: ${String(cause)}`
    }

    return `${error.name}: ${error.message}`
  }

  return String(error)
}

function escapeHtml(text: string) {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }

  return text.replace(/[&<>"']/g, (char) => map[char])
}

/**
 * 尽力把消息写进主进程日志。
 *
 * 启动阶段 logger 分片往往还没初始化（它自己可能就是失败的那个），
 * 因此不能走 `LoggerRenderer`，只能直接调用原始的 IPC 通道。
 */
function reportToMain(level: 'info' | 'error', message: string) {
  try {
    const invoke = window.electron?.ipcRenderer?.invoke

    if (typeof invoke !== 'function') {
      return
    }

    Promise.resolve(
      invoke('akariCall', MAIN_SHARD_NAMESPACE, 'log', 'aux-window', level, message)
    ).catch(() => {})
  } catch {
    // 记录失败本身不应再抛错
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} did not settle within ${ms}ms`))
    }, ms)

    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      }
    )
  })
}

function renderBootstrapFailure(container: HTMLElement, message: string) {
  container.innerHTML = `
    <div style="box-sizing:border-box;height:100%;padding:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#1f2328;background:#fff;">
      <div style="font-size:14px;font-weight:600;">Mini Akari 加载失败</div>
      <div style="font-size:12px;line-height:1.5;color:#57606a;max-height:150px;overflow:auto;word-break:break-word;width:100%;">${escapeHtml(message)}</div>
      <button id="akari-bootstrap-retry" type="button" style="cursor:pointer;border:1px solid #d0d7de;background:#f6f8fa;color:#1f2328;border-radius:6px;padding:4px 12px;font-size:12px;">重新加载</button>
      <div style="font-size:11px;color:#8c959f;">若反复失败，请把这段错误信息反馈给开发者</div>
    </div>
    <style>
      @media (prefers-color-scheme: dark) {
        #app > div { background:#1b1b1f !important; color:#e6edf3 !important; }
        #app > div > div:nth-child(2) { color:#9da7b3 !important; }
        #app #akari-bootstrap-retry { border-color:#3d444d !important; background:#21262d !important; color:#e6edf3 !important; }
        #app > div > div:last-child { color:#6e7681 !important; }
      }
    </style>
  `

  container
    .querySelector<HTMLButtonElement>('#akari-bootstrap-retry')
    ?.addEventListener('click', () => {
      try {
        sessionStorage.removeItem(BOOTSTRAP_RETRY_KEY)
      } catch {
        // ignore
      }

      location.reload()
    })
}

function handleBootstrapFailure(error: unknown) {
  const message = describeError(error)

  console.error('League Akari 无法正确加载：', error)
  reportToMain('error', `bootstrap failed: ${message}`)

  let retries = 0

  try {
    retries = Number(sessionStorage.getItem(BOOTSTRAP_RETRY_KEY) ?? '0')
  } catch {
    retries = 0
  }

  if (retries < MAX_BOOTSTRAP_RETRIES) {
    try {
      sessionStorage.setItem(BOOTSTRAP_RETRY_KEY, String(retries + 1))
    } catch {
      // ignore
    }

    // 直接重载可能立刻再次踩到同一个竞态，稍等片刻让主进程与其他窗口就绪
    setTimeout(() => location.reload(), RETRY_DELAY_MS)
    return
  }

  const container = document.getElementById('app')

  if (container) {
    renderBootstrapFailure(container, message)
    return
  }

  // 连挂载点都没有时，只能退回到最原始的可见反馈
  document.body.textContent = message
}

try {
  reportToMain('info', 'bootstrap: stage=module-start')

  dayjs.extend(relativeTime)
  dayjs.extend(duration)

  const app = createApp(NaiveUIProviderApp)
    .use(createPinia())
    .use(I18nextVue, { i18next })
    .use(manager)

  reportToMain('info', 'bootstrap: stage=app-created')

  await withTimeout(manager.setup(), BOOTSTRAP_TIMEOUT_MS, 'manager.setup()')

  reportToMain('info', 'bootstrap: stage=setup-ok')

  app.mount('#app')

  reportToMain('info', 'bootstrap: stage=mounted')

  try {
    sessionStorage.removeItem(BOOTSTRAP_RETRY_KEY)
  } catch {
    // ignore
  }
} catch (error) {
  handleBootstrapFailure(error)
}
