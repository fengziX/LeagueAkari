import { createManager } from '@renderer-shared/shards'
import { AppCommonRenderer } from '@renderer-shared/shards/app-common'
import { AkariIpcRenderer } from '@renderer-shared/shards/ipc'
import { LoggerRenderer } from '@renderer-shared/shards/logger'
import { PiniaMobxUtilsRenderer } from '@renderer-shared/shards/pinia-mobx-utils'
import { SettingUtilsRenderer } from '@renderer-shared/shards/setting-utils'
import { SetupInAppScopeRenderer } from '@renderer-shared/shards/setup-in-app-scope'
import { WindowManagerRenderer } from '@renderer-shared/shards/window-manager'

/**
 * 这个窗口只负责把一次提醒原样画出来, 因此只装载最小的一组分片。
 * 英雄头像走 akari 协议, 不需要资源 provider 那一整套依赖。
 */
const manager = createManager()

manager.use(AkariIpcRenderer)
manager.use(AppCommonRenderer)
manager.use(LoggerRenderer)
manager.use(PiniaMobxUtilsRenderer)
manager.use(SettingUtilsRenderer)
manager.use(SetupInAppScopeRenderer)
manager.use(WindowManagerRenderer)

export { manager }
