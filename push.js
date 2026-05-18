export const VAPID_PUBLIC_KEY = 'BPlj7NQfA670j7ZmTQnzcv5QLrsj0D1AtAimf9Ros_B0jUp6mk0w4UQ6K1RP5y891cfAB70zOJAFl5zrSPJ3lbE'

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
