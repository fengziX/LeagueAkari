import type { AggregatedAnalysis } from '@shared/data-adapter/analysis/player'
import type {
  QueryStage,
  WinRateTeamAlertCriteria,
  WinRateTeamAlertDisplayPayload,
  WinRateTeamAlertPayload
} from '@shared/shards/ongoing-game'
import { evaluateWinRateTeamAlert } from '@shared/shards/ongoing-game'
import { riotId } from '@shared/utils/name'
import { compareStructural } from 'mobx'

import type { OngoingGameMainContext } from './context'

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
 * 敌方队伍中出现 N 名以上高胜率玩家时, 弹出一个大尺寸窗口提醒用户 “这是胜率队”。
 *
 * 判定依赖 `state.analysis`, 因此只有战绩查询有结果后才可能触发。
 */
export class OngoingGameWinRateTeamAlertController {
  /**
   * 已提醒过的玩家数量, 避免分析结果逐步填充时重复弹出相同的提醒
   */
  private readonly _alertedPlayerCount = new Map<string, number>()

  /**
   * 当前提醒对应的查询阶段, 阶段切换后自动收起窗口, 避免挡住对局画面
   */
  private _alertedPhase: string | null = null

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
          this._alertedPhase = null
          this._context.windowManager.winRateTeamAlertWindow.dismiss()
        }
      }
    )

    // 阶段一变 (例如选人结束进入对局) 就收起提醒窗口
    mobxUtils.reaction(
      () => state.queryStage.phase,
      (phase) => {
        if (this._alertedPhase && phase !== this._alertedPhase) {
          this._alertedPhase = null
          this._context.windowManager.winRateTeamAlertWindow.dismiss()
        }
      }
    )
  }

  private _evaluate(snapshot: WinRateTeamAlertSnapshot) {
    const { leagueClient, logger } = this._context
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
    this._alertedPhase = snapshot.phase

    logger.info('Win rate team alert triggered', {
      gameId: payload.gameId,
      teamIdentifier: payload.teamIdentifier,
      players: payload.players.length
    })

    try {
      this._context.windowManager.winRateTeamAlertWindow.showAlert(this._toDisplayPayload(payload))
    } catch (error) {
      // 提醒本身失败不应影响战绩查询, 但必须留下痕迹, 否则表现为「什么都没弹」
      logger.error('Failed to show win rate team alert window', error)
    }
  }

  /**
   * 补充召唤师名与英雄, 让弹窗渲染进程不必再查询战局状态
   */
  private _toDisplayPayload(payload: WinRateTeamAlertPayload): WinRateTeamAlertDisplayPayload {
    const { state } = this._context
    // championSelections 在拿不到战局时返回 `{}`, 这里统一按映射表读取
    const selections = state.championSelections as Record<string, number>

    return {
      ...payload,
      createdAt: Date.now(),
      players: payload.players.map((player) => {
        const championId = selections[player.puuid]

        return {
          ...player,
          name: riotId(state.summoner[player.puuid]),
          championId: typeof championId === 'number' && championId > 0 ? championId : null
        }
      })
    }
  }
}
