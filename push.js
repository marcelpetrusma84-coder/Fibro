export const VAPID_PUBLIC_KEY = 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE4VhhJGuLpOKa8JMtoC1r20RbCG-1JSuIXQgxGgRBoH6E-pdZZ70-31STJISZKlTVqhHHgOEX2jx5_CO4f0vLZw'

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
