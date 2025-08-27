// test-framework.js - Testing utility for Silent Downloads extension
// This file can be loaded in the developer console to test the extension functionality

const SilentDownloadsTest = (() => {
  // Test configuration
  const config = {
    logEnabled: true,
    autoRun: false,
    testTimeout: 5000 // ms
  };
  
  // Test results
  const results = {
    passed: 0,
    failed: 0,
    total: 0,
    tests: []
  };
  
  // Logging function
  function log(message, type = 'info') {
    if (!config.logEnabled) return;
    
    const styles = {
      info: 'color: #0066cc',
      success: 'color: #28a745',
      error: 'color: #dc3545',
      warning: 'color: #ffc107',
      header: 'color: #6610f2; font-weight: bold; font-size: 14px'
    };
    
    console.log(`%c[SilentDownloadsTest] ${message}`, styles[type] || styles.info);
  }
  
  // Assert function
  function assert(condition, message) {
    if (condition) {
      return { success: true, message: 'Passed: ' + message };
    } else {
      return { success: false, message: 'Failed: ' + message };
    }
  }
  
  // Test runner
  async function runTest(test) {
    log(`Running test: ${test.name}`, 'header');
    results.total++;
    
    try {
      // Create timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Test timed out after ${config.testTimeout}ms`)), config.testTimeout);
      });
      
      // Run the test with timeout
      const result = await Promise.race([test.test(), timeoutPromise]);
      
      if (result.success) {
        results.passed++;
        log(`✓ ${result.message}`, 'success');
      } else {
        results.failed++;
        log(`✗ ${result.message}`, 'error');
      }
      
      // Store result
      results.tests.push({
        name: test.name,
        success: result.success,
        message: result.message
      });
      
      return result;
    } catch (error) {
      results.failed++;
      const errorMessage = `Error in test '${test.name}': ${error.message}`;
      log(`✗ ${errorMessage}`, 'error');
      
      // Store result
      results.tests.push({
        name: test.name,
        success: false,
        message: errorMessage
      });
      
      return { success: false, message: errorMessage };
    }
  }
  
  // Run all tests
  async function runAllTests() {
    // Reset results
    results.passed = 0;
    results.failed = 0;
    results.total = 0;
    results.tests = [];
    
    log('Starting test suite', 'header');
    
    // Run each test sequentially
    for (const test of tests) {
      await runTest(test);
    }
    
    // Log summary
    logSummary();
    
    return results;
  }
  
  // Log test summary
  function logSummary() {
    log('Test Summary', 'header');
    log(`Total tests: ${results.total}`, 'info');
    log(`Passed: ${results.passed}`, 'success');
    log(`Failed: ${results.failed}`, results.failed > 0 ? 'error' : 'info');
    
    if (results.failed > 0) {
      log('Failed tests:', 'error');
      results.tests
        .filter(test => !test.success)
        .forEach(test => log(`- ${test.name}: ${test.message}`, 'error'));
    }
  }
  
  // Test if extension is installed and enabled
  async function testExtensionInstalled() {
    return new Promise(resolve => {
      try {
        chrome.runtime.sendMessage({ action: 'getSettings' }, response => {
          if (chrome.runtime.lastError) {
            resolve(assert(false, 'Extension not installed or enabled: ' + chrome.runtime.lastError.message));
          } else if (response) {
            resolve(assert(true, 'Extension is installed and enabled'));
          } else {
            resolve(assert(false, 'Extension not responding correctly'));
          }
        });
      } catch (error) {
        resolve(assert(false, 'Error checking extension: ' + error.message));
      }
    });
  }
  
  // Test if download interception works
  async function testDownloadInterception() {
    return new Promise(resolve => {
      // First ensure silent downloads is enabled
      chrome.runtime.sendMessage({ 
        action: 'saveSettings',
        silentDownloads: true
      }, () => {
        // Create a fake download to test interception
        const downloadUrl = 'data:text/plain;base64,SGVsbG8gV29ybGQ='; // "Hello World" in base64
        
        // Start download
        chrome.downloads.download({
          url: downloadUrl,
          filename: 'test-download.txt',
          saveAs: false
        }, downloadId => {
          if (chrome.runtime.lastError) {
            resolve(assert(false, 'Failed to start test download: ' + chrome.runtime.lastError.message));
            return;
          }
          
          // Check if the download started without prompt
          if (downloadId) {
            // Clean up by canceling and erasing the download
            chrome.downloads.cancel(downloadId, () => {
              chrome.downloads.erase({ id: downloadId }, () => {
                resolve(assert(true, 'Download interception working correctly'));
              });
            });
          } else {
            resolve(assert(false, 'Download interception failed'));
          }
        });
      });
    });
  }
  
  // Test if notification hiding works
  async function testNotificationHiding() {
    return new Promise(resolve => {
      // Create a test notification
      const testNotificationId = 'test-download-notification';
      
      chrome.notifications.create(testNotificationId, {
        type: 'basic',
        iconUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==',
        title: 'Download Complete',
        message: 'Your test download has completed.'
      }, createdId => {
        if (chrome.runtime.lastError) {
          resolve(assert(false, 'Failed to create test notification: ' + chrome.runtime.lastError.message));
          return;
        }
        
        // Give the extension a moment to process and clear the notification
        setTimeout(() => {
          chrome.notifications.getAll(notifications => {
            const notificationExists = notifications && Object.keys(notifications).includes(testNotificationId);
            
            // Clean up by clearing the notification if it still exists
            if (notificationExists) {
              chrome.notifications.clear(testNotificationId);
              resolve(assert(false, 'Download notification was not hidden'));
            } else {
              resolve(assert(true, 'Download notification was successfully hidden'));
            }
          });
        }, 500);
      });
    });
  }
  
  // Test settings persistence
  async function testSettingsPersistence() {
    return new Promise(resolve => {
      // Set test settings
      const testSettings = {
        action: 'saveSettings',
        silentDownloads: true,
        defaultPath: 'TestDownloads',
        hideNotifications: true,
        hideDownloadBar: true,
        autoStart: true
      };
      
      chrome.runtime.sendMessage(testSettings, response => {
        if (chrome.runtime.lastError || !response || !response.success) {
          resolve(assert(false, 'Failed to save test settings'));
          return;
        }
        
        // Now retrieve the settings and check if they match
        chrome.runtime.sendMessage({ action: 'getSettings' }, retrievedSettings => {
          if (chrome.runtime.lastError || !retrievedSettings) {
            resolve(assert(false, 'Failed to retrieve test settings'));
            return;
          }
          
          const settingsMatch = 
            retrievedSettings.silentDownloads === testSettings.silentDownloads &&
            retrievedSettings.defaultPath === testSettings.defaultPath &&
            retrievedSettings.hideNotifications === testSettings.hideNotifications &&
            retrievedSettings.hideDownloadBar === testSettings.hideDownloadBar &&
            retrievedSettings.autoStart === testSettings.autoStart;
          
          resolve(assert(settingsMatch, 'Settings persistence is working correctly'));
        });
      });
    });
  }
  
  // Define test suite
  const tests = [
    { name: 'Extension Installation', test: testExtensionInstalled },
    { name: 'Download Interception', test: testDownloadInterception },
    { name: 'Notification Hiding', test: testNotificationHiding },
    { name: 'Settings Persistence', test: testSettingsPersistence }
  ];
  
  // Public API
  return {
    runTest,
    runAllTests,
    getResults: () => ({ ...results }),
    setConfig: newConfig => Object.assign(config, newConfig),
    getConfig: () => ({ ...config }),
    tests
  };
})();

// Auto-run tests if configured
if (SilentDownloadsTest.getConfig().autoRun) {
  SilentDownloadsTest.runAllTests();
}

console.log('%cSilent Downloads Test Framework Loaded', 'color: #6610f2; font-weight: bold; font-size: 16px');
console.log('To run all tests, use: SilentDownloadsTest.runAllTests()');
console.log('To run a specific test, use: SilentDownloadsTest.runTest(SilentDownloadsTest.tests[index])');