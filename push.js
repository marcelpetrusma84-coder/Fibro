export const VAPID_PUBLIC_KEY = 'BFRFUyT_qEMMA2G3jq1SnTfAv1ASgtNpHSBzB_IQBvJM3IeWiXeCYb2mVvLVgHrDIYLvNYV53QElg2Hn3HycuSo'

export async function abonneerOpNotificaties() {
  if (!('Notification' in window)) return null
  const toestemming = await Notification.requestPermission()
  if (toestemming !== 'granted') return null

  const reg = await navigator.serviceWorker.ready
  const bestaand = await reg.pushManager.getSubscription()
  if (bestaand) return bestaand

  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: VAPID_PUBLIC_KEY
  })
  return subscription
}
