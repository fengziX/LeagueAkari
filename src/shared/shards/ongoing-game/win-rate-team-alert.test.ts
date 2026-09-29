import type { AggregatedAnalysis } from '@shared/data-adapter/analysis/player'
import { describe, expect, it } from 'vitest'

import {
  collectQualifiedPlayers,
  evaluateWinRateTeamAlert,
  type WinRateTeamAlertCriteria
} from './win-rate-team-alert'

const DEFAULT_CRITERIA: WinRateTeamAlertCriteria = {
  minWinRate: 0.6,
  minPlayerCount: 2,
  minMatches: 0
}

function analysis(wins: number, losses: number): AggregatedAnalysis {
  const count = wins + losses

  return {
    winLoss: {
      all: {
        count,
        wins,
        losses,
        winRate: count ? wins / count : 0
      }
    }
  } as unknown as AggregatedAnalysis
}

const SELF = 'self-puuid'

describe('collectQualifiedPlayers', () => {
  it('保留达到胜率下限的玩家, 并按胜率降序排列', () => {
    const players = {
      a: analysis(60, 40),
      b: analysis(70, 30),
      c: analysis(50, 50)
    }

    const result = collectQualifiedPlayers(['a', 'b', 'c'], players, DEFAULT_CRITERIA)

    expect(result.map((p) => p.puuid)).toEqual(['b', 'a'])
    expect(result[0].winRate).toBeCloseTo(0.7)
  })

  it('场次不足下限的玩家不参与判定', () => {
    const players = {
      a: analysis(3, 0),
      b: analysis(8, 2)
    }

    const result = collectQualifiedPlayers(['a', 'b'], players, {
      ...DEFAULT_CRITERIA,
      minMatches: 5
    })

    expect(result.map((p) => p.puuid)).toEqual(['b'])
  })

  it('缺少分析结果的玩家被忽略', () => {
    const result = collectQualifiedPlayers(['missing'], {}, DEFAULT_CRITERIA)

    expect(result).toEqual([])
  })
})

describe('evaluateWinRateTeamAlert', () => {
  const teams = {
    'TEAM-100': [SELF, 'ally-1'],
    'TEAM-200': ['enemy-1', 'enemy-2', 'enemy-3']
  }

  const players = {
    [SELF]: analysis(30, 20),
    'ally-1': analysis(40, 10),
    'enemy-1': analysis(70, 30),
    'enemy-2': analysis(65, 35),
    'enemy-3': analysis(40, 60)
  }

  it('敌方有 2 名以上高胜率玩家时触发', () => {
    const payload = evaluateWinRateTeamAlert({
      teams,
      players,
      selfPuuid: SELF,
      criteria: DEFAULT_CRITERIA,
      gameId: 1234,
      phase: 'champ-select'
    })

    expect(payload).not.toBeNull()
    expect(payload!.teamIdentifier).toBe('TEAM-200')
    expect(payload!.gameId).toBe(1234)
    expect(payload!.players.map((p) => p.puuid)).toEqual(['enemy-1', 'enemy-2'])
  })

  it('敌方高胜率玩家不足要求人数时不触发', () => {
    const payload = evaluateWinRateTeamAlert({
      teams,
      players: { ...players, 'enemy-2': analysis(40, 60) },
      selfPuuid: SELF,
      criteria: DEFAULT_CRITERIA
    })

    expect(payload).toBeNull()
  })

  it('只有自己队伍满足条件时不触发', () => {
    const payload = evaluateWinRateTeamAlert({
      teams,
      players: {
        [SELF]: analysis(90, 10),
        'ally-1': analysis(80, 20),
        'enemy-1': analysis(30, 70)
      },
      selfPuuid: SELF,
      criteria: DEFAULT_CRITERIA
    })

    expect(payload).toBeNull()
  })

  it('无法确定自身身份时不触发', () => {
    const payload = evaluateWinRateTeamAlert({
      teams,
      players,
      selfPuuid: null,
      criteria: DEFAULT_CRITERIA
    })

    expect(payload).toBeNull()
  })

  it('单一混合队伍的模式 (如斗魂竞技场) 不触发', () => {
    const payload = evaluateWinRateTeamAlert({
      teams: { 'TEAM-ALL': ['enemy-1', 'enemy-2'] },
      players,
      selfPuuid: SELF,
      criteria: DEFAULT_CRITERIA
    })

    expect(payload).toBeNull()
  })

  it('提高人数要求后不再触发', () => {
    const payload = evaluateWinRateTeamAlert({
      teams,
      players,
      selfPuuid: SELF,
      criteria: { ...DEFAULT_CRITERIA, minPlayerCount: 3 }
    })

    expect(payload).toBeNull()
  })
})
