// options.js - Options page functionality for Silent Downloads extension

document.addEventListener('DOMContentLoaded', function() {
  // Get DOM elements
  const silentDownloadsCheckbox = document.getElementById('silentDownloads');
  const downloadPathInput = document.getElementById('downloadPath');
  const hideNotificationsCheckbox = document.getElementById('hideNotifications');
  const hideDownloadBarCheckbox = document.getElementById('hideDownloadBar');
  const autoStartCheckbox = document.getElementById('autoStart');
  const conflictActionSelect = document.getElementById('conflictAction');
  const showDebugLogsCheckbox = document.getElementById('showDebugLogs');
  const logsSection = document.getElementById('logsSection');
  const logsContainer = document.getElementById('logs');
  const clearLogsBtn = document.getElementById('clearLogs');
  const saveBtn = document.getElementById('saveBtn');
  const statusEl = document.getElementById('status');

  // Load settings
  loadSettings();

  // Event listeners
  saveBtn.addEventListener('click', saveSettings);
  clearLogsBtn.addEventListener('click', clearLogs);
  showDebugLogsCheckbox.addEventListener('change', toggleLogsSection);

  // Load current settings from storage
  function loadSettings() {
    chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
      if (!response) {
        showStatus('Error loading settings. Please try again.', 'error');
        return;
      }

      // Set form values
      silentDownloadsCheckbox.checked = response.silentDownloads !== false;
      downloadPathInput.value = response.defaultPath || '';
      hideNotificationsCheckbox.checked = response.hideNotifications !== false;
      hideDownloadBarCheckbox.checked = response.hideDownloadBar !== false;
      autoStartCheckbox.checked = response.autoStart !== false;
      
      // Set conflict action if available
      if (response.conflictAction) {
        conflictActionSelect.value = response.conflictAction;
      }
      
      // Check for debug mode
      chrome.storage.local.get(['debugMode'], (result) => {
        showDebugLogsCheckbox.checked = result.debugMode === true;
        toggleLogsSection();
        
        // If debug mode is enabled, load logs
        if (result.debugMode) {
          loadLogs();
        }
      });
    });
  }

  // Save settings
  function saveSettings() {
    const settings = {
      action: 'saveSettings',
      silentDownloads: silentDownloadsCheckbox.checked,
      defaultPath: downloadPathInput.value.trim(),
      hideNotifications: hideNotificationsCheckbox.checked,
      hideDownloadBar: hideDownloadBarCheckbox.checked,
      autoStart: autoStartCheckbox.checked,
      conflictAction: conflictActionSelect.value
    };
    
    chrome.runtime.sendMessage(settings, (response) => {
      if (response && response.success) {
        // Also save debug mode setting locally
        chrome.storage.local.set({ 
          debugMode: showDebugLogsCheckbox.checked 
        }, () => {
          showStatus('Settings saved successfully!', 'success');
        });
      } else {
        showStatus('Error saving settings: ' + (response?.error || 'Unknown error'), 'error');
      }
    });
  }
  
  // Show or hide logs section based on debug checkbox
  function toggleLogsSection() {
    if (showDebugLogsCheckbox.checked) {
      logsSection.classList.remove('hidden');
      loadLogs();
    } else {
      logsSection.classList.add('hidden');
    }
  }
  
  // Load error logs
  function loadLogs() {
    chrome.runtime.sendMessage({ action: 'getLogs' }, (response) => {
      if (response && response.logs && response.logs.length > 0) {
        let logsHTML = '';
        response.logs.forEach(log => {
          const timestamp = log.timestamp || 'Unknown time';
          const level = log.level || 'info';
          const message = log.message || 'No message';
          const data = log.data || '';
          
          const levelColor = level === 'error' ? '#dc3545' : 
                            level === 'warn' ? '#ffc107' : '#28a745';
          
          logsHTML += `<div style="margin-bottom:8px; border-bottom:1px solid #eee; padding-bottom:4px;">
                         <span style="color:${levelColor}; font-weight:bold;">[${level.toUpperCase()}]</span> 
                         <span style="color:#666;">${timestamp}</span><br>
                         <span>${message}</span>
                         ${data ? `<pre style="margin:4px 0; background:#f8f9fa; padding:4px; border-radius:2px; font-size:11px;">${data}</pre>` : ''}
                       </div>`;
        });
        logsContainer.innerHTML = logsHTML;
      } else {
        logsContainer.innerHTML = 'No logs available';
      }
    });
  }
  
  // Clear error logs
  function clearLogs() {
    chrome.runtime.sendMessage({ action: 'clearLogs' }, (response) => {
      if (response && response.success) {
        logsContainer.innerHTML = 'Logs cleared';
        showStatus('Logs cleared successfully', 'success');
      } else {
        showStatus('Error clearing logs', 'error');
      }
    });
  }
  
  // Show status message
  function showStatus(message, type) {
    statusEl.textContent = message;
    statusEl.className = 'status';
    
    if (type) {
      statusEl.classList.add(type);
    }
    
    statusEl.classList.remove('hidden');
    
    // Hide after 3 seconds
    setTimeout(() => {
      statusEl.classList.add('hidden');
    }, 3000);
  }
});

// Add version checking for browser compatibility
(function checkBrowserVersion() {
  const minVersion = {
    chrome: 80, // Minimum Chrome version
    firefox: 78, // Minimum Firefox version
    edge: 80    // Minimum Edge version
  };
  
  // Try to detect browser and version
  function getBrowser() {
    const userAgent = navigator.userAgent;
    let browser = 'unknown';
    let version = 0;
    
    if (userAgent.indexOf('Chrome') > -1) {
      browser = 'chrome';
      const match = userAgent.match(/Chrome\/(\d+)/);
      if (match) version = parseInt(match[1]);
    } else if (userAgent.indexOf('Firefox') > -1) {
      browser = 'firefox';
      const match = userAgent.match(/Firefox\/(\d+)/);
      if (match) version = parseInt(match[1]);
    } else if (userAgent.indexOf('Edg') > -1) {
      browser = 'edge';
      const match = userAgent.match(/Edg\/(\d+)/);
      if (match) version = parseInt(match[1]);
    }
    
    return { browser, version };
  }
  
  // Check compatibility and show warning if needed
  const { browser, version } = getBrowser();
  if (browser !== 'unknown' && minVersion[browser] && version < minVersion[browser]) {
    const warningDiv = document.createElement('div');
    warningDiv.style.background = '#fff3cd';
    warningDiv.style.color = '#856404';
    warningDiv.style.padding = '10px';
    warningDiv.style.borderRadius = '4px';
    warningDiv.style.marginBottom = '20px';
    warningDiv.innerHTML = `
      <strong>Warning:</strong> You're using ${browser} version ${version}, which may not be fully compatible with this extension.
      For best results, please update to version ${minVersion[browser]} or higher.
    `;
    
    // Insert at the top of the page
    document.body.insertBefore(warningDiv, document.body.firstChild);
  }
})();