// R131: shows crTOUR notices pushed by the server and opens the right screen when tapped. No caching here.
self.addEventListener('push', (evento) => {
  let dados = {}
  try { dados = evento.data ? evento.data.json() : {} } catch { dados = {} }
  const titulo = typeof dados.title === 'string' ? dados.title : 'crTOUR'
  evento.waitUntil(self.registration.showNotification(titulo, {
    body: typeof dados.body === 'string' ? dados.body : '',
    tag: typeof dados.tag === 'string' ? dados.tag : undefined,
    icon: '/icones/192',
    badge: '/icones/192',
    data: { url: typeof dados.url === 'string' && dados.url.startsWith('/') ? dados.url : '/avisos' }, // same-site paths only
  }))
})

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close()
  const destino = new URL(evento.notification.data?.url ?? '/avisos', self.location.origin).href
  evento.waitUntil((async () => {
    const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const aberta = janelas.find((j) => new URL(j.url).origin === self.location.origin)
    if (aberta) { await aberta.focus(); return aberta.navigate(destino) }
    return self.clients.openWindow(destino)
  })())
})
