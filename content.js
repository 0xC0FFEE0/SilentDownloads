// content.js - Content script to hide download UI elements

(function() {
  'use strict';
  
  // Debug logging
  const DEBUG = false;
  
  function logDebug(message, data) {
    if (DEBUG) {
      console.log(`[Silent Downloads] ${message}`, data || '');
    }
  }

  // More precise function to hide download bubbles and notifications
  function hideDownloadElements() {
    logDebug('Hiding download elements');
    
    // More specific selectors for download UI elements across browsers
    const downloadSelectors = [
      // Chrome specific download UI
      '[class*="download-shelf"]', '[id*="download-shelf"]',
      'downloads-manager', '#downloads-manager', '#downloadsManager',
      'downloads-item', '.download-item',
      
      // Firefox specific download UI
      '#downloadsPanel', '#download-panel',
      '.downloadProgress', '.download-progress',
      
      // Edge specific download UI
      '#download-manager', '.download-manager',
      
      // Generic download UI that might appear in any browser
      '[role="dialog"][aria-labelledby*="download" i]',
      '[role="alertdialog"][aria-labelledby*="download" i]'
    ];
    
    try {
      // First hide specific download elements (more targeted approach)
      const specificElements = document.querySelectorAll(downloadSelectors.join(','));
      logDebug(`Found ${specificElements.length} specific download UI elements to hide`);
      
      specificElements.forEach(element => {
        if (element.style) {
          element.style.display = 'none';
          element.style.visibility = 'hidden';
          element.style.opacity = '0';
          element.style.height = '0';
          element.style.overflow = 'hidden';
        }
      });
      
      // Then check for notification-type elements with download-related text
      const notifications = document.querySelectorAll('[class*="notification"], [class*="toast"], [role="alert"]');
      
      notifications.forEach(element => {
        const text = element.textContent?.toLowerCase() || '';
        // More comprehensive keyword checking
        const downloadKeywords = ['download', 'downloaded', 'complete', 'saved', 'finished'];
        
        if (downloadKeywords.some(keyword => text.includes(keyword))) {
          if (element.style) {
            element.style.display = 'none';
            element.style.visibility = 'hidden';
          }
        }
      });
    } catch (error) {
      logDebug('Error hiding download elements:', error);
    }
  }

  // Improved CSS to hide download-related elements with better exclusions
  const style = document.createElement('style');
  style.textContent = `
    /* Chrome download UI elements */
    downloads-manager,
    #downloads-manager,
    downloads-toolbar,
    #download-toolbar,
    downloads-item,
    .download-toolbar,
    .download-shelf,
    #download-shelf,
    [class*="DownloadShelf" i],
    [id*="DownloadShelf" i],
    
    /* Firefox download UI elements */
    #downloadsPanel,
    #download-panel,
    #downloadsHistory,
    .downloadProgress,
    .download-progress,
    
    /* Edge download UI elements */
    #download-manager,
    .download-manager,
    
    /* Generic download notifications */
    .download-notification,
    .download-complete,
    .download-toast,
    .download-bubble,
    
    /* Notification elements that contain download text */
    [class*="notification" i]:has(span:is(:contains('download'), :contains('downloaded'), :contains('complete'))),
    [class*="toast" i]:has(span:is(:contains('download'), :contains('downloaded'), :contains('complete'))),
    [role="alert"]:has(span:is(:contains('download'), :contains('downloaded'), :contains('complete'))),
    
    /* Status messages */
    [aria-live]:has(*[class*="download" i]),
    [aria-live*="download" i],
    
    /* Generic download UI with careful exclusions */
    [class*="download" i]:not([class*="download-button" i]):not([class*="download-link" i]):not([class*="downloadable" i]):not(a):not(button),
    [id*="download" i]:not([id*="download-button" i]):not([id*="download-link" i]):not([id*="downloadable" i]):not(a):not(button) {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
      height: 0 !important;
      width: 0 !important;
      overflow: hidden !important;
      position: absolute !important;
      left: -9999px !important;
      z-index: -1 !important;
      pointer-events: none !important;
    }
  `;

  // More robust style injection
  function injectStyles() {
    try {
      if (document.head) {
        // Check if our style is already injected
        const existingStyle = document.querySelector('style[data-silent-downloads]');
        if (!existingStyle) {
          style.setAttribute('data-silent-downloads', 'true');
          document.head.appendChild(style);
          logDebug('Styles injected successfully');
        }
      } else {
        // Wait for head to be available
        logDebug('Head not available, waiting...');
        setTimeout(injectStyles, 10);
      }
    } catch (error) {
      logDebug('Error injecting styles:', error);
    }
  }
  
  // Inject styles immediately
  injectStyles();

  // More robust document ready handling
  function onDocumentReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback);
    } else {
      callback();
    }
  }
  
  // Hide elements on page load
  onDocumentReady(hideDownloadElements);

  // More efficient MutationObserver with debouncing
  let hideTimeout = null;
  
  const observer = new MutationObserver((mutations) => {
    let shouldHide = false;
    
    // More efficient mutation processing
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== 1) continue; // Skip non-element nodes
        
        const element = node;
        const className = (element.className?.toString() || '').toLowerCase();
        const id = (element.id || '').toLowerCase();
        const text = (element.textContent || '').toLowerCase();
        
        // More comprehensive checks
        const downloadKeywords = ['download', 'downloaded', 'complete', 'saved'];
        const textHasKeywords = downloadKeywords.some(keyword => text.includes(keyword));
        
        if (className.includes('download') ||
            id.includes('download') ||
            (className.includes('notification') && textHasKeywords) ||
            (className.includes('toast') && textHasKeywords) ||
            (element.getAttribute('role') === 'alert' && textHasKeywords)) {
          shouldHide = true;
          break;
        }
        
        // Check for potential download notification in subtree
        if (element.querySelector) {
          const downloadElements = element.querySelectorAll('[class*="download"], [id*="download"]');
          if (downloadElements.length > 0) {
            shouldHide = true;
            break;
          }
        }
      }
      
      if (shouldHide) break;
    }
    
    // Use debouncing to avoid excessive calls to hideDownloadElements
    if (shouldHide) {
      clearTimeout(hideTimeout);
      hideTimeout = setTimeout(hideDownloadElements, 50);
    }
  });

  // Start observing with better error handling
  try {
    const targetNode = document.body || document.documentElement;
    observer.observe(targetNode, {
      childList: true,
      subtree: true
    });
    logDebug('Observer started on', targetNode.nodeName);
  } catch (error) {
    logDebug('Error starting observer:', error);
  }

  // More robust notification API override
  if (window.Notification) {
    try {
      const originalNotification = window.Notification;
      
      // More comprehensive check for download-related notifications
      function isDownloadNotification(title, options) {
        const downloadKeywords = [
          'download', 'downloaded', 'downloading', 'complete', 'saved',
          'finished', 'file', '.zip', '.pdf', '.exe', '.dmg'
        ];
        
        // Check title
        if (title && typeof title === 'string') {
          const lowerTitle = title.toLowerCase();
          if (downloadKeywords.some(keyword => lowerTitle.includes(keyword))) {
            logDebug('Suppressing notification with title:', title);
            return true;
          }
        }
        
        // Check body
        if (options && options.body && typeof options.body === 'string') {
          const lowerBody = options.body.toLowerCase();
          if (downloadKeywords.some(keyword => lowerBody.includes(keyword))) {
            logDebug('Suppressing notification with body containing download keyword');
            return true;
          }
        }
        
        return false;
      }
      
      window.Notification = function(title, options) {
        if (isDownloadNotification(title, options)) {
          // Return a more complete no-op notification object
          return {
            close: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => false,
            onshow: null,
            onclick: null,
            onclose: null,
            onerror: null
          };
        }
        return new originalNotification(title, options);
      };
      
      // Properly copy all static properties and prototype
      Object.setPrototypeOf(window.Notification, originalNotification);
      
      // Copy all static properties and methods
      for (const prop in originalNotification) {
        if (originalNotification.hasOwnProperty(prop)) {
          window.Notification[prop] = originalNotification[prop];
        }
      }
      
      logDebug('Notification API successfully overridden');
    } catch (error) {
      logDebug('Error overriding Notification API:', error);
    }
  }

  // Improved console message suppression with better error handling
  try {
    const originalConsoleLog = console.log;
    const originalConsoleInfo = console.info;
    
    // Check if message is download-related
    function isDownloadMessage(args) {
      if (!args || !args.length) return false;
      
      const joinedMessage = args.map(arg => {
        if (typeof arg === 'string') return arg.toLowerCase();
        if (arg && typeof arg === 'object') {
          try {
            return JSON.stringify(arg).toLowerCase();
          } catch (e) {
            return '';
          }
        }
        return '';
      }).join(' ');
      
      return joinedMessage.includes('download');
    }
    
    console.log = function(...args) {
      // Don't filter our own debug logs
      if (args[0] && typeof args[0] === 'string' &&
          args[0].includes('[Silent Downloads]')) {
        originalConsoleLog.apply(console, args);
      } else if (!isDownloadMessage(args)) {
        originalConsoleLog.apply(console, args);
      }
    };
    
    console.info = function(...args) {
      if (!isDownloadMessage(args)) {
        originalConsoleInfo.apply(console, args);
      }
    };
    
    logDebug('Console methods successfully overridden');
  } catch (error) {
    // If there's an error, restore original console methods
    if (typeof originalConsoleLog !== 'undefined') {
      console.log = originalConsoleLog;
    }
    if (typeof originalConsoleInfo !== 'undefined') {
      console.info = originalConsoleInfo;
    }
    
    // Log error using native console
    console.error('Error overriding console methods:', error);
  }
  
  // Cleanup function to prevent memory leaks
  function cleanup() {
    try {
      if (observer) {
        observer.disconnect();
      }
      logDebug('Resources cleaned up');
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
  
  // Clean up when page is unloaded
  window.addEventListener('unload', cleanup);
  // Log initialization
  logDebug('Silent Downloads content script initialized');
})();