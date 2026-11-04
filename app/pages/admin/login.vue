<script setup lang="ts">
import { ofetch } from 'ofetch'

definePageMeta({ layout: 'admin' })

const { t } = useI18n()
const router = useRouter()

const username = ref('')
const password = ref('')
const failed = ref(false)
const submitting = ref(false)

async function submit() {
  failed.value = false
  submitting.value = true
  try {
    await ofetch('/api/admin/session', {
      method: 'POST',
      body: { username: username.value, password: password.value },
    })
    await router.push('/admin')
  } catch {
    failed.value = true
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <section class="panel panel-narrow">
    <h1>{{ t('login.adminHeading') }}</h1>
    <form class="terminal-form" @submit.prevent="submit">
      <label>
        {{ t('login.username') }}
        <input v-model="username" type="text" class="terminal-input" autocomplete="username" required>
      </label>
      <label>
        {{ t('login.password') }}
        <input v-model="password" type="password" class="terminal-input" autocomplete="current-password" required>
      </label>
      <p v-if="failed" class="terminal-error">{{ t('login.invalid') }}</p>
      <button type="submit" class="terminal-button" :disabled="submitting">{{ t('login.submit') }}</button>
    </form>
  </section>
</template>
