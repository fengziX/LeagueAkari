import { i18next } from '@main/i18n'
import icon from '@resources/LA_ICON.ico?asset&asarUnpack'
import type { AggregatedAnalysis } from '@shared/data-adapter/analysis/player'
import type { QueryStage } from '@shared/shards/ongoing-game'
import {
  evaluateWinRateTeamAlert,
  type WinRateTeamAlertCriteria,
  type WinRateTeamAlertPayload
} from '@shared/shards/ongoing-game'
import { Notification } from 'electron'
import { compareStructural } from 'mobx'

import type { OngoingGameMainContext } from './context'

/**
 * 胜率队提醒的渲染层事件名
 */
export const WIN_RATE_TEAM_ALERT_EVENT = 'win-rate-team-alert'

/**
 * 分析结果并非一次性就绪, 战绩会随查询进度逐步填充, 因此需要少量延迟后再判定
 */
const EVALUATE_DELAY_MS = 800

interface WinRateTeamAlertSnapshot {
  gameId: number | null
  phase: string
  teams: Record<string, string[]>
  players: Record<string, AggregatedAnalysis>
  criteria: WinRateTeamAlertCriteria
}

function getGameId(queryStage: QueryStage): number | null {
  const info = queryStage.gameInfo
  if (info && 'gameId' in info) {
    return info.gameId
  }

  return null
}

/**
 * 敌方队伍中出现 N 名以上高胜率玩家时, 提醒用户 “这是胜率队”。
 *
 * 判定依赖 `state.analysis`, 因此只有战绩查询有结果后才可能触发。
 */
export class OngoingGameWinRateTeamAlertController {
  /**
   * 已提醒过的玩家数量, 避免分析结果逐步填充时重复弹出相同的提醒
   */
  private readonly _alertedPlayerCount = new Map<string, number>()

  constructor(private readonly _context: OngoingGameMainContext) {}

  watch() {
    const { mobxUtils, settings, state } = this._context

    mobxUtils.reaction(
      (): WinRateTeamAlertSnapshot | null => {
        if (!settings.winRateTeamAlertEnabled) {
          return null
        }

        return {
          gameId: getGameId(state.queryStage),
          phase: state.queryStage.phase,
          teams: state.teams,
          players: state.analysis?.players ?? {},
          criteria: {
            minWinRate: settings.winRateTeamAlertMinWinRate,
            minPlayerCount: settings.winRateTeamAlertMinPlayerCount,
            minMatches: settings.winRateTeamAlertMinMatches
          }
        }
      },
      (snapshot) => {
        if (snapshot) {
          this._evaluate(snapshot)
        }
      },
      { delay: EVALUATE_DELAY_MS, equals: compareStructural }
    )

    mobxUtils.reaction(
      () => state.queryStage.phase === 'unavailable',
      (isUnavailable) => {
        if (isUnavailable) {
          this._alertedPlayerCount.clear()
        }
      }
    )
  }

  private _evaluate(snapshot: WinRateTeamAlertSnapshot) {
    const { leagueClient, logger, settings } = this._context
    const selfPuuid = leagueClient.data.summoner.me?.puuid ?? null

    const payload = evaluateWinRateTeamAlert({
      teams: snapshot.teams,
      players: snapshot.players,
      selfPuuid,
      criteria: snapshot.criteria,
      gameId: snapshot.gameId,
      phase: snapshot.phase
    })

    if (!payload) {
      return
    }

    const key = `${snapshot.gameId ?? snapshot.phase}:${payload.teamIdentifier}`
    const alertedCount = this._alertedPlayerCount.get(key) ?? 0

    // 满足条件的人数没有变多, 说明只是同一批数据被重新计算, 不重复提醒
    if (payload.players.length <= alertedCount) {
      return
    }

    this._alertedPlayerCount.set(key, payload.players.length)

    logger.info('Win rate team alert triggered', {
      gameId: payload.gameId,
      teamIdentifier: payload.teamIdentifier,
      players: payload.players.length
    })

    this._context.ipc.sendEvent(this._context.namespace, WIN_RATE_TEAM_ALERT_EVENT, payload)

    if (settings.winRateTeamAlertSystemNotification) {
      this._showSystemNotification(payload)
    }
  }

  private _showSystemNotification(payload: WinRateTeamAlertPayload) {
    const { logger } = this._context

    try {
      if (!Notification.isSupported()) {
        return
      }

      new Notification({
        title: i18next.t('ongoing-game-main.winRateTeamAlert.title'),
        body: i18next.t('ongoing-game-main.winRateTeamAlert.body', {
          count: payload.players.length,
          rate: (payload.criteria.minWinRate * 100).toFixed(0)
        }),
        icon
      }).show()
    } catch (error) {
      logger.warn('Failed to send win rate team system notification', error)
    }
  }
}
