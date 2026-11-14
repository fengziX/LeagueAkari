import { NATIVE_SUPPORT, getLeagueClientWindowPlacement } from '@main/native'
import icon from '@resources/LA_ICON.ico?asset&asarUnpack'
import type { WinRateTeamAlertDisplayPayload } from '@shared/shards/ongoing-game'
import { screen } from 'electron'
import { runInAction } from 'mobx'

import { BaseAkariWindow } from '../base-akari-window'
import type { WindowManagerMainContext } from '../context'
import { WinRateTeamAlertWindowSettings, WinRateTeamAlertWindowState } from './state'

/**
 * 胜率队提醒窗口。
 *
 * 系统通知在 Windows 上很容易被专注助手 / 通知设置吞掉, 因此改用一个大尺寸、
 * 置顶的独立窗口来提醒: 窗口出现即占据屏幕中央, 用户不可能漏看。
 */
export class AkariWinRateTeamAlertWindow extends BaseAkariWindow<
  WinRateTeamAlertWindowState,
  WinRateTeamAlertWindowSettings
> {
  static readonly NAMESPACE_SUFFIX = 'win-rate-team-alert-window'
  static readonly HTML_ENTRY = 'win-rate-team-alert-window.html'
  static readonly TITLE = 'League Akari - Win Rate Team Alert'
  static readonly BASE_WIDTH = 960
  static readonly BASE_HEIGHT = 640
  static readonly MIN_WIDTH = 560
  static readonly MIN_HEIGHT = 380

  /**
   * 窗口尚未 ready 时收到提醒, 等待 ready-to-show 后再显示, 避免闪现白窗
   */
  private _pendingShow = false

  constructor(_context: WindowManagerMainContext) {
    const state = new WinRateTeamAlertWindowState()
    const settings = new WinRateTeamAlertWindowSettings()

    super(_context, AkariWinRateTeamAlertWindow.NAMESPACE_SUFFIX, state, settings, {
      baseWidth: AkariWinRateTeamAlertWindow.BASE_WIDTH,
      baseHeight: AkariWinRateTeamAlertWindow.BASE_HEIGHT,
      minWidth: AkariWinRateTeamAlertWindow.MIN_WIDTH,
      minHeight: AkariWinRateTeamAlertWindow.MIN_HEIGHT,
      htmlEntry: AkariWinRateTeamAlertWindow.HTML_ENTRY,
      // 每次提醒都重新居中, 不记忆位置: 避免上一次被拖到屏幕外后这次看不到
      rememberPosition: false,
      rememberSize: true,
      repositionWindowIfInvisible: true,
      repaintResizeNudge: true,
      browserWindowOptions: {
        title: AkariWinRateTeamAlertWindow.TITLE,
        icon,
        show: false,
        frame: false,
        resizable: true,
        maximizable: false,
        minimizable: true,
        fullscreenable: false,
        alwaysOnTop: true,
        skipTaskbar: false,
        autoHideMenuBar: true,
        titleBarStyle: 'hidden',
        trafficLightPosition: { x: 12, y: 12 }
      }
    })
  }

  /**
   * 展示一次提醒。窗口不存在时会先创建, 就绪后自动显示。
   */
  showAlert(payload: WinRateTeamAlertDisplayPayload) {
    this._logger.info('showAlert requested', {
      gameId: payload.gameId,
      players: payload.players.length
    })

    runInAction(() => this.state.setAlert(payload))

    this._pendingShow = true

    this.createWindow()

    this._logger.info('showAlert state', {
      ready: this.state.ready,
      hasWindow: !!this._window,
      visible: this._window?.isVisible() ?? null
    })

    if (this.state.ready) {
      this._reveal()
    }
  }

  /**
   * 收起提醒但不销毁窗口, 下次提醒可立即复用
   */
  dismiss() {
    this._pendingShow = false
    this.hide()
  }

  private _reveal() {
    const win = this._window

    if (!win || win.isDestroyed()) {
      return
    }

    this._pendingShow = false

    const visibleBefore = win.isVisible()

    this._centerOnActiveDisplay()

    const visibleAfterCenter = win.isVisible()

    // 不能走基类 show()：Windows 上对隐藏窗口调用 setBounds 会把它「实体化」，
    // 于是基类看到 isVisible() === true 就跳过真正的 show()，Electron 也就不再发出
    // 'show' 事件 —— 挂在 'show' 上的重绘逻辑随之失效，留下一个可见但从不绘制的白框。
    // 这里直接强制显示并主动请求重绘。
    win.show()
    win.focus()

    runInAction(() => this.state.setShow(win.isVisible()))

    this._requestRepaint()

    this._probeRenderedContent()

    this._logger.info('Reveal alert window', {
      visibleBefore,
      visibleAfterCenter,
      visibleAfterShow: win.isVisible(),
      bounds: win.getBounds()
    })
  }

  /**
   * 居中到英雄联盟客户端所在的显示器, 客户端不在时退回主显示器。
   */
  private _centerOnActiveDisplay() {
    const win = this._window

    if (!win) {
      return
    }

    let display = screen.getPrimaryDisplay()

    if (NATIVE_SUPPORT.getLeagueClientWindowPlacement.available) {
      const placement = getLeagueClientWindowPlacement()

      // 客户端最小化时返回 { 0, 0, 134, 37 } 这类无意义尺寸
      if (placement && placement.width >= 200 && placement.height >= 50) {
        display = screen.getDisplayMatching({
          x: placement.left,
          y: placement.top,
          width: placement.width,
          height: placement.height
        })
      }
    }

    const area = display.workArea
    const [currentWidth, currentHeight] = win.getSize()

    const width = Math.min(currentWidth, area.width)
    const height = Math.min(currentHeight, area.height)

    win.setBounds({
      x: Math.round(area.x + (area.width - width) / 2),
      y: Math.round(area.y + (area.height - height) / 2),
      width,
      height
    })
  }

  override async onInit() {
    await super.onInit()

    this._mobxUtils.reaction(
      () => this.state.ready,
      (ready) => {
        if (ready && this._pendingShow) {
          this._reveal()
        }
      },
      { fireImmediately: true }
    )
  }

  protected override getStatePropKeys() {
    return ['payload', 'alertSeq'] as const
  }
}
