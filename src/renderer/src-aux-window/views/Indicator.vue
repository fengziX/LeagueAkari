<template>
  <KeepAlive>
    <ChampSelect v-if="currentPage === 'champ-select'" />
    <Lounge v-else-if="currentPage === 'lounge'" />
    <Placeholder v-else />
  </KeepAlive>
</template>

<script setup lang="ts">
import { useInstance } from '@renderer-shared/shards'
import { LoggerRenderer } from '@renderer-shared/shards/logger'
import { useLeagueClientStore } from '@renderer-shared/shards/league-client/store'
import { computed, watch } from 'vue'

import ChampSelect from './ChampSelect.vue'
import Lounge from './Lounge.vue'
import Placeholder from './Placeholder.vue'

const lcs = useLeagueClientStore()
const logger = useInstance(LoggerRenderer)

const currentPage = computed(() => {
  switch (lcs.gameflow.phase) {
    case null:
    case 'None':
    case 'EndOfGame':
    case 'PreEndOfGame':
    case 'WatchInProgress':
    case 'GameStart':
    case 'InProgress':
    case 'WaitingForStats':
    case 'Reconnect':
      return 'placeholder'

    case 'Matchmaking':
    case 'ReadyCheck':
    case 'Lobby':
      return 'lounge'

    case 'ChampSelect':
      if (lcs.champSelect.session && lcs.champSelect.session.isSpectating) {
        return 'placeholder'
      }

      return 'champ-select'
  }

  return 'placeholder'
})

// 记录页面切换，便于排查「窗口空白」这类问题：能直接看出当时停在哪个视图、什么阶段
watch(
  () => [currentPage.value, lcs.gameflow.phase, Boolean(lcs.champSelect.session)] as const,
  ([page, phase, hasSession]) => {
    logger.info('aux-window', `page=${page} phase=${phase} champSelectSession=${hasSession}`)
  },
  { immediate: true }
)
</script>

<style scoped>
.control-item {
  height: 24px;

  &:not(:last-child) {
    margin-bottom: 2px;
  }
}
</style>
