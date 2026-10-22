const availableElement = document.getElementById('available');
const approvedElement = document.getElementById('approved');
const rejectedElement = document.getElementById('rejected');
const capacityLabel = document.getElementById('capacity-label');
const progressFill = document.getElementById('progress-fill');
const serverStatus = document.getElementById('server-status');
const hostnameElement = document.getElementById('hostname');
const messageElement = document.getElementById('message');
const activityList = document.getElementById('activity-list');
const reserveButton = document.getElementById('reserve-btn');
const resetButton = document.getElementById('reset-btn');

let busy = false;

async function loadStatus() {
  const response = await fetch('/status', { cache: 'no-store' });

  if (!response.ok) {
    throw new Error('Failed to load reservations');
  }

  const data = await response.json();

  availableElement.textContent = data.available;
  approvedElement.textContent = data.approved;
  rejectedElement.textContent = data.rejected;

  capacityLabel.textContent =
    `${data.approved} / ${data.totalCapacity}`;

  progressFill.style.width =
    `${(data.approved / data.totalCapacity) * 100}%`;

  hostnameElement.textContent = `Server: ${data.hostname}`;

  serverStatus.textContent = 'Server online';
  serverStatus.className = 'status online';

  return data;
}

function addActivity(message) {
  if (activityList.firstElementChild?.textContent ===
      'No activity yet.') {
    activityList.innerHTML = '';
  }

  const item = document.createElement('li');
  item.textContent = `${new Date().toLocaleTimeString()} - ${message}`;

  activityList.prepend(item);

  while (activityList.children.length > 10) {
    activityList.lastElementChild.remove();
  }
}

async function sendRequest(endpoint) {
  if (busy) return;

  busy = true;
  reserveButton.disabled = true;
  resetButton.disabled = true;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
    });

    const data = await response.json();

    if (!response.ok && response.status !== 409) {
      throw new Error(data.message || 'Request failed');
    }

    messageElement.textContent = data.message;
    addActivity(data.message);

    await loadStatus();
  } catch (error) {
    messageElement.textContent = error.message;
    addActivity(`Error: ${error.message}`);
    serverStatus.textContent = 'Connection error';
    serverStatus.className = 'status offline';
  } finally {
    busy = false;
    reserveButton.disabled = false;
    resetButton.disabled = false;
  }
}

reserveButton.addEventListener('click', () => {
  sendRequest('/reserve');
});

resetButton.addEventListener('click', () => {
  sendRequest('/reset');
});

loadStatus().catch((error) => {
  messageElement.textContent = error.message;
  serverStatus.textContent = 'Connection error';
  serverStatus.className = 'status offline';
});

// Refresh status when k6 or other clients update reservations.
setInterval(() => {
  if (!busy) loadStatus().catch(() => {
    serverStatus.textContent = 'Connection error';
    serverStatus.className = 'status offline';
  });
}, 2000);
