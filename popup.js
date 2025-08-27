// popup.js - Popup interface for the extension

document.addEventListener('DOMContentLoaded', function() {
  const silentCheckbox = document.getElementById('silentDownloads');
  const pathInput = document.getElementById('downloadPath');
  const saveBtn = document.getElementById('saveBtn');
  const optionsBtn = document.getElementById('optionsBtn');
  const status = document.getElementById('status');

  // Load current settings
  chrome.runtime.sendMessage({action: 'getSettings'}, (response) => {
    if (response) {
      silentCheckbox.checked = response.silentDownloads;
      pathInput.value = response.defaultPath || '';
    }
  });

  // Save settings
  saveBtn.addEventListener('click', function() {
    const settings = {
      action: 'saveSettings',
      silentDownloads: silentCheckbox.checked,
      defaultPath: pathInput.value.trim()
    };

    chrome.runtime.sendMessage(settings, (response) => {
      if (response && response.success) {
        status.textContent = 'Settings saved!';
        status.style.color = '#28a745';
        setTimeout(() => {
          status.textContent = '';
        }, 2000);
      } else {
        status.textContent = 'Error saving settings';
        status.style.color = '#dc3545';
      }
    });
  });

  // Open options page
  optionsBtn.addEventListener('click', function() {
    chrome.runtime.openOptionsPage();
  });

  // Real-time updates
  silentCheckbox.addEventListener('change', function() {
    if (this.checked) {
      status.textContent = 'Downloads will be silent';
      status.style.color = '#666';
    } else {
      status.textContent = 'Normal download behavior';
      status.style.color = '#666';
    }
  });
});