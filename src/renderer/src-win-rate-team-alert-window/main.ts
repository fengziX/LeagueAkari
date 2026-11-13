import 'reflect-metadata'

import '@renderer-shared/assets/css/tailwind.css'

import '@renderer-shared/assets/css/base-styles.css'
import '@renderer-shared/assets/css/lol-view.css'
import '@renderer-shared/assets/css/theme-system.css'
import { i18next } from '@renderer-shared/i18n'
import { MAIN_SHARD_NAMESPACE } from '@renderer-shared/shards/logger/context'
import I18nextVue from 'i18next-vue'
import { createPinia } from 'pinia'
import { createApp } from 'vue'

import NaiveUIProviderApp from './NaiveUIProviderApp.vue'
import './assets/css/styles.css'
import { manager } from './shards'

function reportToMain(level: 'info' | 'error', message: string) {
  try {
    const invoke = window.electron?.ipcRenderer?.invoke

    if (typeof invoke !== 'function') {
      return
    }

    Promise.resolve(
      invoke(
        'akariCall',
        MAIN_SHARD_NAMESPACE,
        'log',
        'win-rate-team-alert-window',
        level,
        message
      )
    ).catch(() => {})
  } catch {
    // 记录失败本身不应再抛错
  }
}

try {
  const app = createApp(NaiveUIProviderApp)
    .use(createPinia())
    .use(I18nextVue, { i18next })
    .use(manager)

  await manager.setup()
  app.mount('#app')
} catch (error) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error)

  console.error('League Akari 无法正确加载：', error)
  reportToMain('error', `bootstrap failed: ${message}`)

  const container = document.getElementById('app')

  if (container) {
    container.textContent = message
  }
}
