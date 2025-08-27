// background.js - Service worker for handling downloads silently

let defaultDownloadPath = '';

// Create unified logging function
function logMessage(level, message, data = null) {
  const timestamp = new Date().toISOString();
  
  console[level](`[Silent Downloads] [${timestamp}] ${message}`, data || '');
  
  // Store critical logs for debugging
  if (level === 'error' || level === 'warn') {
    chrome.storage.local.get(['errorLogs'], (result) => {
      const logs = result.errorLogs || [];
      logs.push({
        timestamp,
        level,
        message,
        data: data ? JSON.stringify(data) : null
      });
      // Keep only last 50 errors
      if (logs.length > 50) logs.shift();
      chrome.storage.local.set({ errorLogs: logs });
    });
  }
}

// Unified initialization - Consolidating previous duplicate listeners
chrome.runtime.onInstalled.addListener(async () => {
  logMessage('info', 'Extension installed or updated');
  
  // Set default download preferences
  chrome.storage.sync.set({
    silentDownloads: true,
    defaultPath: '',
    hideNotifications: true,
    hideDownloadBar: true,
    autoStart: true
  }, () => {
    if (chrome.runtime.lastError) {
      logMessage('error', 'Failed to set initial preferences', chrome.runtime.lastError);
    } else {
      logMessage('info', 'Initial preferences set successfully');
    }
  });
  
  try {
    await setDefaultDownloadPath();
  } catch (error) {
    logMessage('error', 'Error in initial path setup', error);
  }
});

// Get user's default download directory on startup
chrome.runtime.onStartup.addListener(async () => {
  logMessage('info', 'Browser started with extension loaded');
  try {
    await setDefaultDownloadPath();
  } catch (error) {
    logMessage('error', 'Error setting download path on startup', error);
  }
});

// Improved default path detection with better fallbacks
async function setDefaultDownloadPath() {
  try {
    // First attempt: Try to get from recent downloads
    const recentDownloads = await chrome.downloads.search({
      limit: 1,
      orderBy: ['-startTime']
    });
    
    if (recentDownloads.length > 0 && recentDownloads[0].filename) {
      const lastDownload = recentDownloads[0];
      // Handle both forward and backslashes for cross-platform compatibility
      const pathSeparator = lastDownload.filename.includes('/') ? '/' : '\\';
      const pathParts = lastDownload.filename.split(pathSeparator);
      pathParts.pop(); // Remove filename
      defaultDownloadPath = pathParts.join(pathSeparator);
      logMessage('info', 'Using path from recent download', defaultDownloadPath);
      return;
    }
    
    // Second attempt: Use browser-specific defaults based on platform
    try {
      const platformInfo = await chrome.runtime.getPlatformInfo();
      if (platformInfo.os === 'win') {
        defaultDownloadPath = 'Downloads';
      } else if (platformInfo.os === 'mac') {
        defaultDownloadPath = 'Downloads';
      } else {
        defaultDownloadPath = 'Downloads';
      }
      logMessage('info', `Using platform default path (${platformInfo.os})`, defaultDownloadPath);
    } catch (platformError) {
      // Third attempt: Ultimate fallback
      defaultDownloadPath = 'Downloads';
      logMessage('warn', 'Could not determine platform, using fallback path', platformError);
    }
  } catch (error) {
    defaultDownloadPath = 'Downloads'; // Ultimate fallback
    logMessage('error', 'Error determining download path', error);
  }
}

// Enhanced download interception
chrome.downloads.onDeterminingFilename.addListener((downloadItem, suggest) => {
  logMessage('info', 'Processing download', {
    url: downloadItem.url,
    filename: downloadItem.filename,
    fileSize: downloadItem.fileSize,
    mimeType: downloadItem.mime
  });
  
  chrome.storage.sync.get(['silentDownloads', 'defaultPath'], (result) => {
    try {
      if (result.silentDownloads) {
        const customPath = result.defaultPath || defaultDownloadPath;
        
        // Handle both forward and backslashes for cross-platform compatibility
        const pathSeparator = downloadItem.filename.includes('/') ? '/' : '\\';
        const filename = downloadItem.filename.split(pathSeparator).pop();
        
        // Construct the target path with appropriate separator
        const targetPath = customPath ? `${customPath}${pathSeparator}${filename}` : filename;
        
        logMessage('info', `Using path: ${customPath}, filename: ${filename}`);
        
        // Suggest the filename without prompting user
        suggest({
          filename: targetPath,
          conflictAction: 'uniquify'
        });
      } else {
        suggest({}); // Use browser default behavior
      }
    } catch (error) {
      logMessage('error', 'Error in filename determination', error);
      suggest({}); // Fallback to browser default on error
    }
  });
  
  return true; // This allows the suggestion to be asynchronous
});

// Enhanced notification hiding
chrome.downloads.onCreated.addListener((downloadItem) => {
  logMessage('info', 'Download created', {
    id: downloadItem.id,
    url: downloadItem.url
  });
  
  chrome.storage.sync.get(['silentDownloads', 'hideNotifications'], (result) => {
    try {
      if (result.silentDownloads && result.hideNotifications !== false) {
        // More comprehensive notification clearing
        chrome.notifications.getAll((notifications) => {
          if (!notifications) return;
          
          Object.keys(notifications).forEach((notificationId) => {
            const notification = notifications[notificationId];
            
            // Check title and message for download-related keywords
            const downloadKeywords = ['download', 'save', 'complete', 'finish'];
            const titleMatch = notification.title &&
                              downloadKeywords.some(keyword =>
                                notification.title.toLowerCase().includes(keyword));
            
            const messageMatch = notification.message &&
                                downloadKeywords.some(keyword =>
                                  notification.message.toLowerCase().includes(keyword));
            
            if (titleMatch || messageMatch) {
              chrome.notifications.clear(notificationId);
              logMessage('info', 'Cleared download notification', notificationId);
            }
          });
        });
      }
    } catch (error) {
      logMessage('error', 'Error handling download creation', error);
    }
  });
});

// Enhanced handling for completed downloads
chrome.downloads.onChanged.addListener((downloadDelta) => {
  if (downloadDelta.state) {
    logMessage('info', `Download state changed to: ${downloadDelta.state.current}`, {
      id: downloadDelta.id,
      previousState: downloadDelta.state.previous
    });
  }
  
  chrome.storage.sync.get(['silentDownloads', 'hideNotifications'], (result) => {
    try {
      if (result.silentDownloads && result.hideNotifications !== false) {
        // Only clear notifications when downloads complete
        if (downloadDelta.state?.current === 'complete') {
          // Small delay to catch notifications that appear after completion
          setTimeout(() => {
            chrome.notifications.getAll((notifications) => {
              Object.keys(notifications).forEach((notificationId) => {
                chrome.notifications.clear(notificationId);
                logMessage('info', 'Cleared completion notification', notificationId);
              });
            });
          }, 500);
        }
      }
    } catch (error) {
      logMessage('error', 'Error handling download state change', error);
    }
  });
});

// Enhanced message handler for popup/options communication
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  logMessage('info', 'Received message', { action: request.action });
  
  if (request.action === 'getSettings') {
    chrome.storage.sync.get([
      'silentDownloads',
      'defaultPath',
      'hideNotifications',
      'hideDownloadBar',
      'autoStart'
    ], (result) => {
      if (chrome.runtime.lastError) {
        logMessage('error', 'Error retrieving settings', chrome.runtime.lastError);
        sendResponse({
          error: chrome.runtime.lastError.message,
          silentDownloads: true, // Default values as fallback
          defaultPath: defaultDownloadPath,
          hideNotifications: true,
          hideDownloadBar: true,
          autoStart: true
        });
      } else {
        const response = {
          silentDownloads: result.silentDownloads !== false, // Default true
          defaultPath: result.defaultPath ?? defaultDownloadPath,
          hideNotifications: result.hideNotifications !== false,
          hideDownloadBar: result.hideDownloadBar !== false,
          autoStart: result.autoStart !== false
        };
        
        logMessage('info', 'Sending settings to UI', response);
        sendResponse(response);
      }
    });
    return true;
  } else if (request.action === 'saveSettings') {
    const settingsToSave = {
      silentDownloads: request.silentDownloads,
      defaultPath: request.defaultPath,
      hideNotifications: request.hideNotifications,
      hideDownloadBar: request.hideDownloadBar,
      autoStart: request.autoStart
    };
    
    logMessage('info', 'Saving settings', settingsToSave);
    
    chrome.storage.sync.set(settingsToSave, () => {
      if (chrome.runtime.lastError) {
        logMessage('error', 'Error saving settings', chrome.runtime.lastError);
        sendResponse({success: false, error: chrome.runtime.lastError.message});
      } else {
        if (request.defaultPath) {
          defaultDownloadPath = request.defaultPath;
          logMessage('info', 'Updated default download path', defaultDownloadPath);
        }
        logMessage('info', 'Settings saved successfully');
        sendResponse({success: true});
      }
    });
    return true;
  } else if (request.action === 'getLogs') {
    // Add ability to retrieve logs for debugging
    chrome.storage.local.get(['errorLogs'], (result) => {
      sendResponse({logs: result.errorLogs || []});
    });
    return true;
  } else if (request.action === 'clearLogs') {
    // Add ability to clear logs
    chrome.storage.local.set({errorLogs: []}, () => {
      sendResponse({success: true});
    });
    return true;
  }
});

// Ensure extension icon shows the correct state
chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });

// Update badge when settings change
chrome.storage.onChanged.addListener((changes) => {
  if (changes.silentDownloads) {
    updateBadge(changes.silentDownloads.newValue);
  }
});

// Initialize badge on startup
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.sync.get(['silentDownloads'], (result) => {
    updateBadge(result.silentDownloads !== false);
  });
});

// Update badge text based on silent downloads state
function updateBadge(isEnabled) {
  if (isEnabled) {
    chrome.action.setBadgeText({ text: 'ON' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

// Initial badge update
chrome.storage.sync.get(['silentDownloads'], (result) => {
  updateBadge(result.silentDownloads !== false);
});