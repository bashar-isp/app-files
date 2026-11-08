/* بشار الالوسي — Service Worker
   المهمة: إظهار إشعارات الهاتف الحقيقية (مثل إشعارات الواتساب) + فتح التطبيق عند الضغط على الإشعار */
self.addEventListener('install', function (e) { self.skipWaiting(); });

self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });

/* عند الضغط على الإشعار: ركّز نافذة التطبيق المفتوحة أو افتحها */
self.addEventListener('notificationclick', function (e) {
    e.notification.close();
    e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
        for (var i = 0; i < list.length; i++) { if ('focus' in list[i]) return list[i].focus(); }
        return self.clients.openWindow('./');
    }));
});

/* دعم Web Push — لو فعّلنا سيرفر إشعارات لاحقاً يوصل الإشعار حتى وهو التطبيق مسكر */
self.addEventListener('push', function (e) {
    var data = {};
    try { data = e.data ? e.data.json() : {}; } catch (err) { data = { body: e.data ? e.data.text() : '' }; }
    var title = data.title || 'بشار الالوسي — إشعار جديد';
    var opts = {
        body: data.body || '',
        icon: data.icon || 'icon-192.png',
        badge: 'icon-192.png',
        dir: 'rtl',
        lang: 'ar',
        tag: data.tag || ('bashar-' + Date.now()),
        renotify: true,
        data: { url: './' }
    };
    e.waitUntil(self.registration.showNotification(title, opts));
});
