import type { WinRateTeamAlertDisplayPayload } from '@shared/shards/ongoing-game'
import { Rectangle } from 'electron'
import { makeAutoObservable, observableRef } from 'mobx'

export class WinRateTeamAlertWindowSettings {
  opacity: number = 1

  pinned: boolean = true

  setOpacity(opacity: number) {
    this.opacity = opacity
  }

  setPinned(pinned: boolean) {
    this.pinned = pinned
  }

  constructor() {
    makeAutoObservable(this)
  }
}

export class WinRateTeamAlertWindowState {
  status: 'normal' | 'maximized' | 'minimized' = 'normal'

  focus: 'focused' | 'blurred' = 'focused'

  ready: boolean = false

  show: boolean = false

  trackedBounds: Rectangle | null = null

  /**
   * 待显示的提醒内容, 为 null 时渲染层不展示任何内容
   */
  payload: WinRateTeamAlertDisplayPayload | null = null

  /**
   * 每次提醒递增, 供渲染层重置倒计时等一次性状态
   */
  alertSeq: number = 0

  setAlert(payload: WinRateTeamAlertDisplayPayload) {
    this.payload = payload
    this.alertSeq += 1
  }

  clearAlert() {
    this.payload = null
  }

  setStatus(status: 'normal' | 'maximized' | 'minimized') {
    this.status = status
  }

  setFocus(focus: 'focused' | 'blurred') {
    this.focus = focus
  }

  setReady(ready: boolean) {
    this.ready = ready
  }

  setShow(show: boolean) {
    this.show = show
  }

  setTrackedBounds(bounds: Rectangle | null) {
    this.trackedBounds = bounds
  }

  constructor() {
    makeAutoObservable(this, {
      trackedBounds: observableRef,
      payload: observableRef
    })
  }
}
