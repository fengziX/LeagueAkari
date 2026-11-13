<template>
  <div
    class="alert-window"
    @mouseenter="paused = true"
    @mouseleave="paused = false"
  >
    <SetupInAppScope />

    <header class="alert-titlebar">
      <span class="alert-titlebar__dot" />
      <span class="alert-titlebar__text">{{ t('titlebar') }}</span>
      <button
        class="alert-titlebar__close"
        type="button"
        :title="t('close')"
        @click="handleDismiss"
      >
        <NIcon :size="16"><CloseIcon /></NIcon>
      </button>
    </header>

    <main v-if="hasAlert" class="alert-body">
      <section class="alert-hero">
        <svg class="alert-hero__glyph" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 3.2 1.9 20.4a1 1 0 0 0 .87 1.5h18.46a1 1 0 0 0 .87-1.5L12 3.2Z"
            fill="currentColor"
            opacity="0.22"
          />
          <path
            d="M12 3.2 1.9 20.4a1 1 0 0 0 .87 1.5h18.46a1 1 0 0 0 .87-1.5L12 3.2Z"
            fill="none"
            stroke="currentColor"
            stroke-width="1.4"
            stroke-linejoin="round"
          />
          <path
            d="M12 8.6v5.6"
            stroke="currentColor"
            stroke-width="1.9"
            stroke-linecap="round"
          />
          <circle cx="12" cy="17.6" r="1.05" fill="currentColor" />
        </svg>

        <div class="alert-hero__body">
          <h1 class="alert-hero__headline">{{ t('headline') }}</h1>
          <p class="alert-hero__summary">{{ summaryText }}</p>
        </div>

        <div class="alert-hero__count">
          <span class="alert-hero__count-value">{{ players.length }}</span>
          <span class="alert-hero__count-unit">{{ t('playersUnit') }}</span>
        </div>
      </section>

      <section class="alert-players">
        <article
          v-for="(player, index) in players"
          :key="player.puuid"
          class="player-card"
          :style="{ '--alert-index': index }"
        >
          <div class="player-card__avatar">
            <img
              v-if="player.championId"
              class="player-card__avatar-img"
              :src="championIconUrl(player.championId)"
              alt=""
              @error="handleAvatarError"
            />
          </div>

          <div class="player-card__meta">
            <div class="player-card__name" :title="player.name">{{ player.name }}</div>
            <div class="player-card__records">
              {{ t('records', { wins: player.wins, games: player.games }) }}
            </div>
          </div>

          <div class="player-card__rate" :style="{ color: rateColor(player.winRate) }">
            <span class="player-card__rate-value">{{ formatRate(player.winRate) }}</span>
            <span class="player-card__rate-unit">%</span>
          </div>

          <div class="player-card__bar">
            <div
              class="player-card__bar-fill"
              :style="{
                width: `${Math.min(100, Math.max(4, player.winRate * 100))}%`,
                background: rateColor(player.winRate)
              }"
            />
          </div>
        </article>
      </section>
    </main>

    <footer class="alert-footer">
      <div class="alert-footer__hint">
        {{ paused ? t('paused') : t('autoClose', { seconds: remaining }) }}
      </div>

      <div class="alert-footer__progress">
        <div class="alert-footer__progress-fill" :style="{ width: `${progress}%` }" />
      </div>

      <NButton type="error" size="large" strong class="alert-footer__button" @click="handleDismiss">
        {{ t('dismiss') }}
      </NButton>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { useInstance } from '@renderer-shared/shards'
import { SetupInAppScope } from '@renderer-shared/shards/setup-in-app-scope/setup-in-app-scope-component'
import { WindowManagerRenderer } from '@renderer-shared/shards/window-manager'
import { useWinRateTeamAlertWindowStore } from '@renderer-shared/shards/window-manager/store'
import { Close as CloseIcon } from '@vicons/ionicons5'
import { useTranslation } from 'i18next-vue'
import { NButton, NIcon } from 'naive-ui'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const { t } = useTranslation(undefined, { keyPrefix: 'notifications.winRateTeamAlert' })

const wm = useInstance(WindowManagerRenderer)
const ws = useWinRateTeamAlertWindowStore()

/** 自动关闭的停留时长 */
const AUTO_CLOSE_SECONDS = 45

const remaining = ref(AUTO_CLOSE_SECONDS)
const paused = ref(false)

let timer: ReturnType<typeof setInterval> | null = null

const hasAlert = computed(() => ws.payload !== null)

const players = computed(() => ws.payload?.players ?? [])

const progress = computed(() => {
  return Math.max(0, Math.min(100, (remaining.value / AUTO_CLOSE_SECONDS) * 100))
})

const summaryText = computed(() => {
  const alert = ws.payload

  if (!alert) {
    return ''
  }

  const { criteria, teamSize } = alert
  const count = alert.players.length
  const rate = (criteria.minWinRate * 100).toFixed(0)

  if (criteria.minMatches > 0) {
    return t('summaryWithMinMatches', {
      count,
      teamSize,
      rate,
      minMatches: criteria.minMatches
    })
  }

  return t('summary', { count, teamSize, rate })
})

function formatRate(rate: number) {
  return (rate * 100).toFixed(1)
}

/**
 * 直接使用 akari 协议从客户端取英雄头像, 免去为这一个窗口引入资源 provider 的一整套分片
 */
function championIconUrl(championId: number | null) {
  return `akari://league-client/lol-game-data/assets/v1/champion-icons/${championId ?? 0}.png`
}

/**
 * 客户端未连接时头像取不到, 直接隐藏 img, 露出底下的占位底色
 */
function handleAvatarError(event: Event) {
  const target = event.target as HTMLImageElement | null

  if (target) {
    target.style.visibility = 'hidden'
  }
}

/**
 * 胜率越高越红, 60% 左右偏橙, 80% 以上接近纯红
 */
function rateColor(rate: number) {
  const ratio = Math.max(0, Math.min(1, (rate - 0.5) / 0.35))
  const hue = Math.round(38 - 38 * ratio)
  const saturation = Math.round(72 + 24 * ratio)
  const lightness = Math.round(56 - 8 * ratio)

  return `hsl(${hue} ${saturation}% ${lightness}%)`
}

function stopTimer() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

function startTimer() {
  stopTimer()
  remaining.value = AUTO_CLOSE_SECONDS

  timer = setInterval(() => {
    if (paused.value) {
      return
    }

    remaining.value -= 1

    if (remaining.value <= 0) {
      handleDismiss()
    }
  }, 1000)
}

function handleDismiss() {
  stopTimer()
  wm.winRateTeamAlertWindow.close()
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    handleDismiss()
  }
}

watch(
  () => ws.alertSeq,
  (seq) => {
    if (seq > 0) {
      paused.value = false
      startTimer()
    }
  },
  { immediate: true }
)

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  stopTimer()
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<style>
html,
body,
#app {
  height: 100%;
  width: 100%;
}

.alert-window {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: var(--la-color-bg-primary);
  color: var(--la-color-text-primary);
}

/* ---------- 标题栏 ---------- */

.alert-titlebar {
  display: flex;
  align-items: center;
  gap: 8px;
  height: var(--la-titlebar-height);
  flex: 0 0 auto;
  padding: 0 8px 0 14px;
  -webkit-app-region: drag;
}

.alert-titlebar__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #e5484d;
  box-shadow: 0 0 0 3px rgb(229 72 77 / 0.18);
  flex: 0 0 auto;
}

.alert-titlebar__text {
  flex: 1 1 auto;
  font-size: 12px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  opacity: 0.6;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.alert-titlebar__close {
  -webkit-app-region: no-drag;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 26px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.alert-titlebar__close:hover {
  background: rgb(var(--la-card-tint-rgb) / 0.12);
}

/* ---------- 主体 ---------- */

.alert-body {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 6px 22px 0;
  overflow: hidden;
}

.alert-hero {
  position: relative;
  display: flex;
  align-items: center;
  gap: 18px;
  flex: 0 0 auto;
  padding: 22px 24px;
  border-radius: 16px;
  color: #fff;
  background:
    radial-gradient(120% 160% at 0% 0%, rgb(255 128 96 / 0.55), transparent 62%),
    linear-gradient(122deg, #d93a3a 0%, #a71f28 46%, #6d1220 100%);
  box-shadow: 0 18px 40px -22px rgb(160 24 32 / 0.9);
  overflow: hidden;
}

.alert-hero__glyph {
  flex: 0 0 auto;
  width: 54px;
  height: 54px;
  color: #ffe6cf;
  filter: drop-shadow(0 2px 8px rgb(0 0 0 / 0.28));
  animation: alert-pulse 2.2s ease-in-out infinite;
}

.alert-hero__body {
  flex: 1 1 auto;
  min-width: 0;
}

.alert-hero__headline {
  margin: 0;
  font-size: 30px;
  font-weight: 800;
  line-height: 1.15;
  letter-spacing: 0.02em;
  text-shadow: 0 2px 12px rgb(0 0 0 / 0.28);
}

.alert-hero__summary {
  margin: 8px 0 0;
  font-size: 14px;
  line-height: 1.5;
  color: rgb(255 255 255 / 0.86);
}

.alert-hero__count {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 86px;
  height: 86px;
  border-radius: 50%;
  border: 1px solid rgb(255 255 255 / 0.35);
  background: rgb(0 0 0 / 0.18);
}

.alert-hero__count-value {
  font-size: 34px;
  font-weight: 800;
  line-height: 1;
}

.alert-hero__count-unit {
  margin-top: 3px;
  font-size: 11px;
  letter-spacing: 0.08em;
  color: rgb(255 255 255 / 0.8);
}

/* ---------- 玩家卡片 ---------- */

.alert-players {
  flex: 1 1 auto;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(272px, 1fr));
  grid-auto-rows: min-content;
  gap: 12px;
  padding-bottom: 16px;
  overflow-y: auto;
}

.player-card {
  position: relative;
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr) auto;
  grid-template-areas:
    'avatar meta rate'
    'bar bar bar';
  align-items: center;
  gap: 4px 14px;
  padding: 14px 16px 12px;
  border-radius: 12px;
  background: var(--la-card-surface-95);
  border: 1px solid rgb(var(--la-card-border-rgb) / 0.14);
  animation: alert-card-in 0.34s ease both;
  animation-delay: calc(var(--alert-index) * 45ms);
}

.player-card .player-card__avatar {
  grid-area: avatar;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  overflow: hidden;
  background: linear-gradient(135deg, rgb(229 72 77 / 0.55), rgb(120 24 32 / 0.55));
}

.player-card__avatar-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.player-card__meta {
  grid-area: meta;
  min-width: 0;
}

.player-card__name {
  font-size: 16px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.player-card__records {
  margin-top: 4px;
  font-size: 12px;
  opacity: 0.62;
}

.player-card__rate {
  grid-area: rate;
  display: flex;
  align-items: baseline;
  font-variant-numeric: tabular-nums;
}

.player-card__rate-value {
  font-size: 30px;
  font-weight: 800;
  line-height: 1;
}

.player-card__rate-unit {
  margin-left: 2px;
  font-size: 13px;
  font-weight: 700;
  opacity: 0.8;
}

.player-card__bar {
  grid-area: bar;
  height: 4px;
  margin-top: 10px;
  border-radius: 2px;
  background: rgb(var(--la-card-tint-rgb) / 0.12);
  overflow: hidden;
}

.player-card__bar-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.4s ease;
}

/* ---------- 底部 ---------- */

.alert-footer {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 22px 16px;
}

.alert-footer__hint {
  flex: 0 0 auto;
  font-size: 12px;
  opacity: 0.58;
  font-variant-numeric: tabular-nums;
}

.alert-footer__progress {
  flex: 1 1 auto;
  height: 3px;
  border-radius: 2px;
  background: rgb(var(--la-card-tint-rgb) / 0.12);
  overflow: hidden;
}

.alert-footer__progress-fill {
  height: 100%;
  border-radius: 2px;
  background: linear-gradient(90deg, #e5484d, #f0855f);
  transition: width 0.9s linear;
}

.alert-footer__button {
  flex: 0 0 auto;
  min-width: 132px;
}

@keyframes alert-pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.92;
  }

  50% {
    transform: scale(1.06);
    opacity: 1;
  }
}

@keyframes alert-card-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .alert-hero__glyph,
  .player-card {
    animation: none;
  }
}
</style>
