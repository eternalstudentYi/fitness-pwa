// ============================================
// 深蹲提醒助手 - Service Worker
// 接收 Web Push 推送并显示系统通知
// ============================================

// 接收推送事件
self.addEventListener('push', (event) => {
  let data = {
    title: '锻炼时间到！',
    body: '该做深蹲了！站起来，做 20 个深蹲吧！',
    timeKey: '',
    reminderIndex: 1,
    isLast: false
  };

  try {
    if (event.data) {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    }
  } catch (e) {
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const title = data.isLast
    ? `最后一次提醒！（第${data.reminderIndex}/6次）`
    : `锻炼时间到！（第${data.reminderIndex}次）`;

  const options = {
    body: data.body,
    icon: '/icon-192.jpg',
    badge: '/icon-192.jpg',
    vibrate: [200, 100, 200],
    tag: data.timeKey || 'fitness-reminder',
    renotify: true,
    requireInteraction: true,
    data: {
      timeKey: data.timeKey,
      url: '/'
    },
    actions: [
      { action: 'complete', title: '马上做' },
      { action: 'snooze', title: '稍后提醒' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// 通知点击事件
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'complete') {
    // 标记完成：打开网页并带上参数
    const timeKey = event.notification.data.timeKey || '';
    event.waitUntil(
      clients.openWindow(`/?complete=${encodeURIComponent(timeKey)}`)
    );
  } else if (event.action === 'snooze') {
    // 稍后提醒：不做任何操作，定时器会 5 分钟后再推
    console.log('用户选择稍后提醒');
  } else {
    // 点击通知主体，打开网页
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Service Worker 安装
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Service Worker 激活
self.addEventListener('activate', (event) => {
  event.waitUntil(
    clients.claim()
  );
});
