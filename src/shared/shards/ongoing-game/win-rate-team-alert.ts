import type { AggregatedAnalysis } from '@shared/data-adapter/analysis/player'

/**
 * 胜率队提醒: 当敌方队伍中存在指定数量以上的高胜率玩家时, 弹窗提醒。
 *
 * 注意, 这里的判定与面板上的 “胜率队” 标签 (renderer 侧
 * `ongoing-game-panel/TeamTagsArea.vue`) 是两套独立的标准:
 * 面板标签侧侧重于 “预组队 + 极高胜率 + 连胜”, 而本提醒默认只关心
 * “敌方有 N 名以上胜率不低于 M 的玩家”, 即用户可自行配置的口径。
 */

export interface WinRateTeamAlertCriteria {
  /** 视为高胜率玩家的胜率下限, 0 ~ 1 */
  minWinRate: number
  /** 至少需要多少名满足胜率的玩家 */
  minPlayerCount: number
  /** 玩家的总场次下限, 场次不足的玩家不参与判定 (0 表示不限制) */
  minMatches: number
}

export interface WinRateTeamAlertPlayer {
  puuid: string
  wins: number
  losses: number
  games: number
  winRate: number
}

export interface WinRateTeamAlertPayload {
  /** 对局 ID, 部分阶段可能为空 */
  gameId: number | null
  /** 触发时的查询阶段, 例如 champ-select / in-game */
  phase: string
  /** 敌方队伍的队伍标识, 例如 TEAM-200 */
  teamIdentifier: string
  /** 敌方队伍人数 */
  teamSize: number
  /** 本次判定使用的口径, 便于展示与排错 */
  criteria: WinRateTeamAlertCriteria
  /** 满足条件的敌方玩家, 按胜率从高到低 */
  players: WinRateTeamAlertPlayer[]
}

export interface EvaluateWinRateTeamAlertArgs {
  /** 队伍标识到玩家 puuid 列表的映射 */
  teams: Record<string, string[]>
  /** 玩家分析结果 */
  players: Record<string, AggregatedAnalysis>
  /** 当前登录召唤师的 puuid, 用于区分敌我。缺失时不做判定 */
  selfPuuid: string | null
  criteria: WinRateTeamAlertCriteria
  gameId?: number | null
  phase?: string
}

/**
 * 单个队伍中满足胜率条件的玩家, 按胜率降序排列
 */
export function collectQualifiedPlayers(
  puuids: string[],
  players: Record<string, AggregatedAnalysis>,
  criteria: WinRateTeamAlertCriteria
): WinRateTeamAlertPlayer[] {
  const qualified: WinRateTeamAlertPlayer[] = []

  for (const puuid of puuids) {
    const analysis = players[puuid]
    if (!analysis) {
      continue
    }

    const { wins, losses, count, winRate } = analysis.winLoss.all

    if (count < Math.max(0, criteria.minMatches)) {
      continue
    }

    if (winRate + Number.EPSILON < criteria.minWinRate) {
      continue
    }

    qualified.push({ puuid, wins, losses, games: count, winRate })
  }

  return qualified.toSorted((a, b) => b.winRate - a.winRate)
}

/**
 * 判定敌方队伍是否构成 “胜率队”。
 *
 * 仅返回第一支满足条件的敌方队伍。`selfPuuid` 缺失时返回 `null`,
 * 因为无从判断哪一支才是敌方队伍。
 */
export function evaluateWinRateTeamAlert(
  args: EvaluateWinRateTeamAlertArgs
): WinRateTeamAlertPayload | null {
  const { teams, players, selfPuuid, criteria, gameId = null, phase = 'unknown' } = args

  if (!selfPuuid) {
    return null
  }

  const minPlayerCount = Math.max(1, Math.floor(criteria.minPlayerCount))

  let result: WinRateTeamAlertPayload | null = null

  for (const [teamIdentifier, puuids] of Object.entries(teams)) {
    // 该模式下只有一支混合队伍, 不存在敌我之分
    if (teamIdentifier === 'TEAM-ALL') {
      continue
    }

    // 自己所在的队伍, 跳过
    if (puuids.includes(selfPuuid)) {
      continue
    }

    if (!puuids.length) {
      continue
    }

    const qualified = collectQualifiedPlayers(puuids, players, criteria)
    if (qualified.length < minPlayerCount) {
      continue
    }

    if (!result || qualified.length > result.players.length) {
      result = {
        gameId,
        phase,
        teamIdentifier,
        teamSize: puuids.length,
        criteria,
        players: qualified
      }
    }
  }

  return result
}
