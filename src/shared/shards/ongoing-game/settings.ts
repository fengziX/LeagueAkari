export type OngoingGamePanelOrderPlayerBy =
  | 'win-rate'
  | 'kda'
  | 'default'
  | 'akari-score'
  | 'position'
  | 'premade-team'

export type OngoingGamePanelChampionUsage = 'recent' | 'mastery' | 'none'

export type OngoingGameMatchHistoryTagPreference = 'current' | 'all'

export interface OngoingGamePanelPlayerCardTagSettings {
  showPremadeTeamTag: boolean
  showSuspiciousFlashPositionTag: boolean
  showWinningStreakTag: boolean
  showLosingStreakTag: boolean
  showSoloKillsTag: boolean
  showEasyGankTag: boolean
  showGreatPerformanceTag: boolean
  showAverageTeamDamageTag: boolean
  showAverageTeamDamageTakenTag: boolean
  showAverageTeamGoldTag: boolean
  showAverageCsPerMinuteTag: boolean
  showAverageDamageGoldEfficiencyTag: boolean
  showAverageEnemyMissingPingsTag: boolean
  showAverageVisionScoreTag: boolean
  showAverageKillDamageEfficiencyTag: boolean
  showSelfTag: boolean
  showMetTag: boolean
  showTaggedTag: boolean
  showWinRateTeamTag: boolean
  showPrivacyTag: boolean
  showAkariScoreTag: boolean
}

export interface OngoingGamePanelSettings {
  enabled: boolean
  matchHistoryLoadCount: number
  orderPlayerBy: OngoingGamePanelOrderPlayerBy
  showChampionUsage: OngoingGamePanelChampionUsage
  showMatchHistoryItemBorder: boolean
  showJunglePathing: boolean
  showJunglePathingForAllPlayers: boolean
  playerCardTags: OngoingGamePanelPlayerCardTagSettings
}

export interface OngoingGameSettingsData extends OngoingGamePanelSettings {
  concurrency: number
  gameDetailsLoadCount: number
  matchHistoryTagPreference: OngoingGameMatchHistoryTagPreference
  autoRouteWhenGameStarts: boolean
  queryInLobbyPhase: boolean
  premadeTeamInferMatchCountThreshold: number

  /**
   * 胜率队弹窗提醒: 敌方队伍中出现 N 名以上高胜率玩家时提醒
   */
  winRateTeamAlertEnabled: boolean
  /**
   * 胜率队提醒: 视为高胜率玩家的胜率下限, 0 ~ 1
   */
  winRateTeamAlertMinWinRate: number
  /**
   * 胜率队提醒: 至少需要多少名高胜率玩家
   */
  winRateTeamAlertMinPlayerCount: number
  /**
   * 胜率队提醒: 参与判定的玩家所需的最少总场次, 0 表示不限制
   */
  winRateTeamAlertMinMatches: number
  /**
   * 胜率队提醒: 是否额外发送系统通知 (适用于主窗口不在前台的情况)
   */
  winRateTeamAlertSystemNotification: boolean
}

export const DEFAULT_WIN_RATE_TEAM_ALERT = Object.freeze({
  enabled: true,
  minWinRate: 0.6,
  minPlayerCount: 2,
  minMatches: 0,
  systemNotification: true
})

export const DEFAULT_ONGOING_GAME_PANEL_PLAYER_CARD_TAG_SETTINGS =
  Object.freeze<OngoingGamePanelPlayerCardTagSettings>({
    showPremadeTeamTag: true,
    showSuspiciousFlashPositionTag: true,
    showWinningStreakTag: true,
    showLosingStreakTag: true,
    showSoloKillsTag: true,
    showEasyGankTag: true,
    showGreatPerformanceTag: true,
    showAverageTeamDamageTag: false,
    showAverageTeamDamageTakenTag: false,
    showAverageTeamGoldTag: false,
    showAverageCsPerMinuteTag: false,
    showAverageDamageGoldEfficiencyTag: false,
    showAverageEnemyMissingPingsTag: false,
    showAverageVisionScoreTag: false,
    showAverageKillDamageEfficiencyTag: true,
    showSelfTag: true,
    showMetTag: true,
    showTaggedTag: true,
    showWinRateTeamTag: true,
    showPrivacyTag: true,
    showAkariScoreTag: false
  })

export function createDefaultOngoingGamePanelPlayerCardTagSettings(): OngoingGamePanelPlayerCardTagSettings {
  return { ...DEFAULT_ONGOING_GAME_PANEL_PLAYER_CARD_TAG_SETTINGS }
}
