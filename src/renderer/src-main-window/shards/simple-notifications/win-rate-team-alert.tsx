import { OngoingGameRenderer } from '@renderer-shared/shards/ongoing-game'
import { useOngoingGameStore } from '@renderer-shared/shards/ongoing-game/store'
import type { WinRateTeamAlertPayload } from '@shared/shards/ongoing-game'
import { riotId } from '@shared/utils/name'
import { useTranslation } from 'i18next-vue'
import { NButton, useNotification } from 'naive-ui'

import type { SimpleNotificationsRendererContext } from './context'

const ALERT_DURATION_MS = 20000

/**
 * 胜率队提醒: 敌方队伍中出现 N 名以上高胜率玩家时弹窗
 */
export function watchWinRateTeamAlert(context: SimpleNotificationsRendererContext) {
  const { t } = useTranslation(undefined, {
    keyPrefix: 'notifications.simple.winRateTeamAlert'
  })

  const notification = useNotification()
  const ongoingGame = useOngoingGameStore()

  context.ipc.onEventVue(
    OngoingGameRenderer.id,
    'win-rate-team-alert',
    (payload: WinRateTeamAlertPayload) => {
      const no = notification.warning({
        title: () => t('title'),
        duration: ALERT_DURATION_MS,
        content: () => (
          <div class="flex flex-col gap-2">
            <div>
              {t('content', {
                count: payload.players.length,
                rate: (payload.criteria.minWinRate * 100).toFixed(0)
              })}
            </div>
            <div class="flex flex-col gap-0.5">
              {payload.players.map((player) => (
                <div class="text-xs" key={player.puuid}>
                  {t('player', {
                    name: riotId(ongoingGame.summoner[player.puuid]),
                    rate: (player.winRate * 100).toFixed(1),
                    wins: player.wins,
                    games: player.games
                  })}
                </div>
              ))}
            </div>
            <div class="flex justify-end">
              <NButton size="tiny" onClick={() => no.destroy()}>
                {t('negativeText')}
              </NButton>
            </div>
          </div>
        )
      })
    }
  )
}
