// ============================================
// 深蹲提醒助手 - 前端逻辑
// ============================================

// 配置
const CONFIG = {
  remindTimes: [
    { hour: 9,  minute: 0,  period: '上午' },
    { hour: 10, minute: 0,  period: '上午' },
    { hour: 14, minute: 0,  period: '下午' },
    { hour: 15, minute: 0,  period: '下午' },
    { hour: 16, minute: 0,  period: '下午' }
  ],
  exercise: '深蹲',
  exerciseCount: 20,
  snoozeInterval: 5,    // 未完成则隔5分钟再提醒
  maxReminders: 6,       // 每个时段最多提醒6次
  apiBase: ''             // 部署后改为 Cloudflare Worker 地址
};

// 后端 API 地址（部署后修改）
const API_BASE = CONFIG.apiBase || (window.location.hostname.includes('github.io')
  ? 'https://your-worker.your-subdomain.workers.dev'
  : '');

// 设备ID（用 localStorage 存一个唯一 ID）
function getDeviceId() {
  let id = localStorage.getItem('deviceId');
  if (!id) {
    id = 'dev-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('deviceId', id);
  }
  return id;
}

// 今日日期字符串
function getTodayStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}

// 时段标识
function getTimeKey(t) {
  return `${String(t.hour).padStart(2,'0')}:${String(t.minute).padStart(2,'0')}`;
}

// 今日完成记录
function getCompletedTimes() {
  const key = `completed_${getTodayStr()}`;
  return JSON.parse(localStorage.getItem(key) || '[]');
}

function addCompletedTime(timeKey) {
  const key = `completed_${getTodayStr()}`;
  const list = getCompletedTimes();
  if (!list.includes(timeKey)) {
    list.push(timeKey);
    localStorage.setItem(key, JSON.stringify(list));
    // 同步到后端
    if (API_BASE) {
      fetch(`${API_BASE}/api/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: getDeviceId(), timeKey, date: getTodayStr() })
      }).catch(() => {});
    }
  }
}

// 提醒计数（每设备每时段每天已提醒了几次）
function getRemindedCount(timeKey) {
  const key = `reminded_${getTodayStr()}_${timeKey}`;
  return parseInt(localStorage.getItem(key) || '0');
}

function incRemindedCount(timeKey) {
  const key = `reminded_${getTodayStr()}_${timeKey}`;
  const count = getRemindedCount(timeKey) + 1;
  localStorage.setItem(key, String(count));
  return count;
}

// ============================================
// 页面初始化
// ============================================
const scheduleListEl = document.getElementById('scheduleList');
const nextTimeEl = document.getElementById('nextTime');
const countdownEl = document.getElementById('countdown');
const nextReminderInfoEl = document.getElementById('nextReminderInfo');
const progressTextEl = document.getElementById('progressText');
const progressFillEl = document.getElementById('progressFill');
const enablePushBtn = document.getElementById('enablePushBtn');
const pushStatusEl = document.getElementById('pushStatus');

function initSchedule() {
  const completed = getCompletedTimes();
  const now = new Date();
  const items = CONFIG.remindTimes.map(t => {
    const timeKey = getTimeKey(t);
    const baseTarget = new Date();
    baseTarget.setHours(t.hour, t.minute, 0, 0);
    const lastReminderTime = new Date(baseTarget.getTime() + (CONFIG.maxReminders - 1) * CONFIG.snoozeInterval * 60000);

    let statusClass = 'status-upcoming';
    let statusText = '待提醒';

    if (completed.includes(timeKey)) {
      statusClass = 'status-done';
      statusText = '已完成';
    } else if (now > lastReminderTime) {
      statusClass = 'status-expired';
      statusText = '已过期';
    } else if (now >= baseTarget) {
      const reminded = getRemindedCount(timeKey);
      statusClass = 'status-pending';
      statusText = `提醒中 (${reminded}/${CONFIG.maxReminders})`;
    }

    return { time: timeKey, period: t.period, statusClass, statusText };
  });

  scheduleListEl.innerHTML = items.map(item => `
    <div class="schedule-item">
      <div class="schedule-time">
        <span class="schedule-period">${item.period}</span>
        <span class="schedule-time-text">${item.time}</span>
      </div>
      <span class="schedule-status ${item.statusClass}">${item.statusText}</span>
    </div>
  `).join('');

  const completedCount = completed.length;
  progressTextEl.textContent = `${completedCount}/5`;
  progressFillEl.style.width = `${(completedCount / 5) * 100}%`;
}

// ============================================
// 倒计时逻辑
// ============================================
function updateCountdown() {
  const now = new Date();
  const completed = getCompletedTimes();
  let next = null;
  let nextBaseTime = '';
  let nextReminderIndex = 0;

  for (const t of CONFIG.remindTimes) {
    const timeKey = getTimeKey(t);
    if (completed.includes(timeKey)) continue;
    const reminded = getRemindedCount(timeKey);

    for (let i = reminded; i < CONFIG.maxReminders; i++) {
      const targetMinute = t.minute + i * CONFIG.snoozeInterval;
      const targetHour = t.hour + Math.floor(targetMinute / 60);
      const actualMinute = targetMinute % 60;
      const target = new Date();
      target.setHours(targetHour, actualMinute, 0, 0);
      if (target > now) {
        next = target;
        nextBaseTime = timeKey;
        nextReminderIndex = i + 1;
        break;
      }
    }
    if (next) break;
  }

  if (!next) {
    nextTimeEl.textContent = '今日已完成';
    countdownEl.textContent = '明天继续加油！';
    nextReminderInfoEl.textContent = '所有时段提醒已结束';
    return;
  }

  const diff = next - now;
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);

  nextTimeEl.textContent = `${String(next.getHours()).padStart(2,'0')}:${String(next.getMinutes()).padStart(2,'0')}`;
  countdownEl.textContent = `${String(hours).padStart(2,'0')}小时${String(minutes).padStart(2,'0')}分${String(seconds).padStart(2,'0')}秒`;
  nextReminderInfoEl.textContent = nextReminderIndex === 1
    ? `${nextBaseTime} 时段 · 第 1 次提醒`
    : `${nextBaseTime} 时段 · 第 ${nextReminderIndex}/${CONFIG.maxReminders} 次（每 5 分钟提醒一次）`;
}

// ============================================
// 前台提醒（网页打开时弹窗 + 震动）
// ============================================
function checkReminder() {
  const now = new Date();
  const completed = getCompletedTimes();

  for (const t of CONFIG.remindTimes) {
    const timeKey = getTimeKey(t);
    if (completed.includes(timeKey)) continue;

    const reminded = getRemindedCount(timeKey);
    if (reminded >= CONFIG.maxReminders) continue;

    const remindMinute = t.minute + reminded * CONFIG.snoozeInterval;
    const remindHour = t.hour + Math.floor(remindMinute / 60);
    const actualMinute = remindMinute % 60;

    if (now.getHours() === remindHour && now.getMinutes() === actualMinute && now.getSeconds() === 0) {
      const newCount = incRemindedCount(timeKey);
      showReminderModal(timeKey, newCount);
      initSchedule();
      break;
    }
  }
}

// 弹窗提醒
function showReminderModal(timeKey, reminderIndex) {
  if (navigator.vibrate) navigator.vibrate(200);

  const isLast = reminderIndex >= CONFIG.maxReminders;
  const now = new Date();
  const currentTimeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

  let title = `锻炼时间到！（第${reminderIndex}次）`;
  let content = `现在是 ${currentTimeStr}，该做${CONFIG.exercise}了！站起来，做 ${CONFIG.exerciseCount} 个${CONFIG.exercise}吧！`;

  if (isLast) {
    title = `最后一次提醒！（第${reminderIndex}/${CONFIG.maxReminders}次）`;
    content = `这是今天 ${timeKey} 时段的最后一次提醒了，快起来做 ${CONFIG.exerciseCount} 个${CONFIG.exercise}！`;
  }

  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalContent').textContent = content;
  document.getElementById('modalOverlay').classList.add('active');

  // 把当前 timeKey 存在按钮上
  document.getElementById('modalComplete').dataset.timeKey = timeKey;
  document.getElementById('modalSnooze').dataset.timeKey = timeKey;
}

// 关闭弹窗
function closeModal() {
  document.getElementById('modalOverlay').classList.remove('active');
}

// 标记完成
function markComplete(timeKey) {
  addCompletedTime(timeKey);
  // 重置提醒计数
  const key = `reminded_${getTodayStr()}_${timeKey}`;
  localStorage.removeItem(key);
  closeModal();
  initSchedule();
  updateCountdown();
  showToast('太棒了！');
}

// Toast 提示
function showToast(msg) {
  const toast = document.createElement('div');
  toast.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.8);color:#fff;padding:16px 24px;border-radius:12px;font-size:16px;z-index:10000;animation:fadeIn 0.3s';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

// ============================================
// Web Push 订阅
// ============================================
async function checkPushSupport() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    enablePushBtn.textContent = '当前浏览器不支持推送通知';
    enablePushBtn.disabled = true;
    pushStatusEl.textContent = '建议使用 Chrome、Edge 或 Safari（iOS 16.4+需先添加到主屏幕）';
    return false;
  }
  return true;
}

async function subscribePush() {
  try {
    // 注册 Service Worker
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    // 检查是否已订阅
    let subscription = await reg.pushManager.getSubscription();
    if (subscription) {
      enablePushBtn.textContent = '推送已开启';
      enablePushBtn.disabled = true;
      pushStatusEl.textContent = '已订阅推送通知，到点会收到系统通知';
      return;
    }

    // 获取 VAPID 公钥
    if (!API_BASE) {
      enablePushBtn.textContent = '开启推送通知';
      enablePushBtn.disabled = false;
      pushStatusEl.textContent = '后端尚未配置，当前仅支持网页打开时提醒。部署后端后可开启锁屏推送。';
      return;
    }

    const res = await fetch(`${API_BASE}/api/vapid-public-key`);
    const { publicKey } = await res.json();

    // 订阅推送
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });

    // 发送订阅信息到后端
    await fetch(`${API_BASE}/api/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: getDeviceId(),
        subscription: subscription.toJSON()
      })
    });

    enablePushBtn.textContent = '推送已开启';
    enablePushBtn.disabled = true;
    pushStatusEl.textContent = '已订阅推送通知，到点会收到系统通知';
    showToast('推送通知已开启！');
  } catch (err) {
    console.error('推送订阅失败:', err);
    enablePushBtn.textContent = '开启推送通知';
    pushStatusEl.textContent = '订阅失败，请检查通知权限是否开启';
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// ============================================
// 事件绑定
// ============================================
document.getElementById('modalComplete').addEventListener('click', function() {
  const timeKey = this.dataset.timeKey;
  if (timeKey) markComplete(timeKey);
});

document.getElementById('modalSnooze').addEventListener('click', function() {
  closeModal();
  // 不做任何操作，定时器会在 5 分钟后再次触发
});

enablePushBtn.addEventListener('click', subscribePush);

// ============================================
// 启动
// ============================================
async function init() {
  initSchedule();
  updateCountdown();

  // 检查 URL 参数：通知点击后跳转带 ?complete=09:00
  const params = new URLSearchParams(window.location.search);
  const completeParam = params.get('complete');
  if (completeParam) {
    markComplete(completeParam);
    // 清除 URL 参数
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  // 前台提醒定时器（每秒检查）
  setInterval(() => {
    checkReminder();
    updateCountdown();
  }, 1000);

  // 检查推送支持
  const supported = await checkPushSupport();
  if (supported) {
    if (!API_BASE || API_BASE.includes('your-worker')) {
      enablePushBtn.textContent = '后端未配置';
      enablePushBtn.disabled = true;
      pushStatusEl.textContent = '当前仅支持网页打开时提醒。部署后端后可开启锁屏推送。';
    } else {
      enablePushBtn.textContent = '开启推送通知';
      enablePushBtn.disabled = false;
      pushStatusEl.textContent = '点击开启后，即使关闭网页也能收到提醒';
      // 自动检查是否已订阅
      subscribePush();
    }
  }
}

// 等待 DOM 就绪
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
