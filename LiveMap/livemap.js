(() => {

////////////////////////////////////////////////////////////
///                                                      ///
///  LIVEMAP SCRIPT FOR FM-DX-WEBSERVER (V1.0)           ///
///                                                      ///
///  by nuscarrick            last update: 01.06.26      ///
///                                                      ///
///  https://github.com/nuscarrick/LiveMap               ///
///                                                      ///
////////////////////////////////////////////////////////////

///  This plugin only works from web server version 1.3.5 !!!

let ConsoleDebug = false; 			// Activate/Deactivate console output
const PSTRotatorFunctions = false; 	// If you use the PSTRotator plugin, you can activate the control here (default = false)
const updateInfo = true; 			// Enable or disable version check

////////////////////////////////////////////////////////////

    // Custom console log function
    function debugLog(...messages) {
      if (ConsoleDebug) {
        console.log(...messages);
      }
    }

    // Define iframe size and position variables
    let iframeWidth = parseInt(localStorage.getItem('iframeWidth')) || 600;
    let iframeHeight = parseInt(localStorage.getItem('iframeHeight')) || 650;
    let iframeLeft = parseInt(localStorage.getItem('iframeLeft')) || 10;
    let iframeTop = parseInt(localStorage.getItem('iframeTop')) || 10;

    const plugin_version = '1.0';
    let lastPicode = null;
    let lastFreq = null;
    let lastStationId = null;
    let websocket;
    let iframeContainer = null;
    let LiveMapActive = false;
    let picode, freq, itu, city, station, pol, distance, ps, stationid, radius, azimuth, LAT, LON;
    let stationListContainer;
    let foundPI;
    let foundID;
    let Latitude;
    let Longitude;
    let ws;
    let isTuneAuthenticated;
    let ipAddress;

    const plugin_path = 'https://raw.githubusercontent.com/nuscarrick/RadioDataCenter-LiveMap/';
    const plugin_JSfile = 'main/LiveMap/livemap.js'
    const plugin_name = 'Livemap';
    const PluginUpdateKey = `${plugin_name}_lastUpdateNotification`; // Unique key for localStorage
	
    const currentURL = new URL(window.location.href);
    const WebserverURL = currentURL.hostname;
    const WebserverPath = currentURL.pathname.replace(/setup/g, '');
	  let WebserverPORT = currentURL.port || (currentURL.protocol === 'https:' ? '443' : '80'); // Default ports if not specified
	
    const protocol = currentURL.protocol === 'https:' ? 'wss:' : 'ws:'; // Determine WebSocket protocol
    const WebsocketPORT = WebserverPORT; // Use the same port as HTTP/HTTPS
    const WEBSOCKET_URL = `${protocol}//${WebserverURL}:${WebsocketPORT}${WebserverPath}data_plugins`; // WebSocket URL with /data_plugins
	
    // Add custom CSS styles
    const style = document.createElement('style');
    style.innerHTML = `
/* LM-013: Bluish Professional Theme - CSS Variables */
:root {
    --livemap-bg-primary: #2c3e50;      /* Dark bluish background */
    --livemap-bg-secondary: #34495e;    /* Lighter bluish */
    --livemap-bg-tertiary: #1a252f;     /* Darkest bluish */
    --livemap-accent: #3498db;          /* Bright blue accent */
    --livemap-text: #ecf0f1;            /* Light text */
    --livemap-text-muted: #95a5a6;      /* Muted text */
    --livemap-border: #1a252f;          /* Dark border */
    --livemap-hover: #2980b9;           /* Hover state */
}

.tooltip1 {
    display: inline-block;
    cursor: pointer;
}

.tooltip1::after {
  content: attr(data-tooltip);
  position: absolute;
  bottom: 100%;
  transform: translateX(-100%);
  background-color: var(--livemap-bg-secondary);
  color: var(--livemap-text);
  padding: 5px 25px;
  border-radius: 15px;
  white-space: nowrap;
  font-size: 14px;
  opacity: 0;
  z-index: 9999;
  pointer-events: none;
  transition: opacity 0.3s;
}

.tooltip1:hover::after {
  opacity: 1;
}

.tooltip2 {
    display: inline-block;
    cursor: pointer;
}

.tooltip2::after {
  content: attr(data-tooltip);
  position: absolute;
  bottom: 100%;
  transform: translateX(10%);
  background-color: var(--livemap-bg-secondary);
  color: var(--livemap-text);
  padding: 5px 25px;
  border-radius: 15px;
  white-space: nowrap;
  font-size: 14px;
  opacity: 0;
  z-index: 9999;
  pointer-events: none;
  transition: opacity 0.3s;
}

.tooltip2:hover::after {
  opacity: 1;
}

body {
    margin: 0;
}

#wrapper {
    position: relative;
}

    .fade-out {
        animation: fadeOut 0.5s forwards;
    }

    @keyframes fadeOut {
        from {
            opacity: 1;
        }
        to {
            opacity: 0;
        }
    }
    
    .fade-in {
        animation: fadeInAnimation 1.0s forwards;
    }

    @keyframes fadeInAnimation {
        0% {
            opacity: 0;
        }
        100% {
            opacity: 1;
        }
    }

    #movableDiv {
        display: flex;
        flex-direction: column;
        border-radius: 15px 15px 0 0;
        position: fixed;
        cursor: move;
        overflow: hidden;
        justify-content: space-between;
        width: ${iframeWidth}px;
        height: ${iframeHeight}px;
        left: ${iframeLeft}px;
        top: ${iframeTop}px;
        background-color: var(--livemap-bg-primary);
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
    }

    #movableDiv iframe {
        display: block;
        flex-grow: 1;
        min-height: 0;
        width: 100%;
        height: 100%;
        border: none;
        border-radius: 0;
        position: relative;
    }

 .icon-hover-effect {
  color: var(--livemap-text-muted);
  cursor: pointer;
  transition: color 0.3s ease;
 }

 .icon-hover-effect:hover {
  color: var(--livemap-accent);
  text-decoration: none;
 }
 
    `;
    document.head.appendChild(style);

    // --- Audio Stream Functions removed (feature no longer used) ---

	// Function to check if the notification was shown today
  function shouldShowNotification() {
    const lastNotificationDate = localStorage.getItem(PluginUpdateKey);
    const today = new Date().toISOString().split('T')[0]; // Get current date in YYYY-MM-DD format

    if (lastNotificationDate === today) {
      return false; // Notification already shown today
    }
    // Update the date in localStorage to today
    localStorage.setItem(PluginUpdateKey, today);
    return true;
  }

  // Function to check plugin version
  function checkplugin_version() {
    // Fetch and evaluate the plugin script
    fetch(`${plugin_path}${plugin_JSfile}`)
      .then(response => response.text())
      .then(script => {
        // Search for plugin_version in the external script
        const plugin_versionMatch = script.match(/const plugin_version = '([\d.]+[a-z]*)?';/);
        if (!plugin_versionMatch) {
          console.error(`${plugin_name}: Plugin version could not be found`);
          return;
        }

        const externalplugin_version = plugin_versionMatch[1];

        // Function to compare versions
		function compareVersions(local, remote) {
			const parseVersion = (version) =>
				version.split(/(\d+|[a-z]+)/i).filter(Boolean).map((part) => (isNaN(part) ? part : parseInt(part, 10)));

			const localParts = parseVersion(local);
			const remoteParts = parseVersion(remote);

			for (let i = 0; i < Math.max(localParts.length, remoteParts.length); i++) {
				const localPart = localParts[i] || 0; // Default to 0 if part is missing
				const remotePart = remoteParts[i] || 0;

				if (typeof localPart === 'number' && typeof remotePart === 'number') {
					if (localPart > remotePart) return 1;
					if (localPart < remotePart) return -1;
				} else if (typeof localPart === 'string' && typeof remotePart === 'string') {
					// Lexicographical comparison for strings
					if (localPart > remotePart) return 1;
					if (localPart < remotePart) return -1;
				} else {
					// Numeric parts are "less than" string parts (e.g., `3.5` < `3.5a`)
					return typeof localPart === 'number' ? -1 : 1;
				}
			}

			return 0; // Versions are equal
		}


        // Check version and show notification if needed
        const comparisonResult = compareVersions(plugin_version, externalplugin_version);
        if (comparisonResult === 1) {
          // Local version is newer than the external version
          console.log(`${plugin_name}: The local version is newer than the plugin version.`);
        } else if (comparisonResult === -1) {
          // External version is newer and notification should be shown
          if (shouldShowNotification()) {
            console.log(`${plugin_name}: Plugin update available: ${plugin_version} -> ${externalplugin_version}`);
			sendToast(t('toast.warningImportant'), `${plugin_name}`, `${t('plugin.updateAvailable')}:<br>${plugin_version} -> ${externalplugin_version}`, false, false);
          }
        } else {
          // Versions are the same
          console.log(`${plugin_name}: The local version matches the plugin version.`);
        }
      })
      .catch(error => {
        console.error(`${plugin_name}: Error fetching the plugin script:`, error);
      });
	}

    // Function to fetch the client's IP address
    async function fetchIpAddress() {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip;
        } catch (error) {
            console.error('Failed to fetch IP address:', error);
            return 'unknown'; // Fallback value
        }
    }
	
function addDragFunctionalityToWrapper() {
    const wrapper = document.getElementById('wrapper');
    const liveMapButton = document.getElementById('LIVEMAP-on-off');
    const panel = document.querySelector('.panel-100-real');
    const dashboardPanelDescription = document.getElementById('dashboard-panel-description');

    if (!wrapper || !liveMapButton || !panel || !dashboardPanelDescription) {
        // console.error('Wrapper, LiveMapButton, Panel or dashboard-panel-description not found.');
        return;
    }

    // Ensure elements are positioned correctly
    if (!wrapper.style.position) wrapper.style.position = 'relative';
    if (!panel.style.position) panel.style.position = 'relative';
    // The dashboardPanelDescription will use margin-left, so no position is needed.

    let startX = 0;
    let wrapperStartLeft = 0;
    let panelStartLeft = 0;

    liveMapButton.onmousedown = function(e) {
        e.preventDefault();
        startX = e.clientX;
        wrapperStartLeft = parseInt(window.getComputedStyle(wrapper).left, 10) || 0;
        panelStartLeft = parseInt(window.getComputedStyle(panel).left, 10) || 0;
        document.onmousemove = onMouseMove;
        document.onmouseup = onMouseUp;
    };

    function onMouseMove(e) {
        const deltaX = e.clientX - startX;
        let newLeftPanel = panelStartLeft + deltaX;

        // Limit the movement: the wrapper should not go off-screen.
        const minLeft = 0;
        const maxLeft = window.innerWidth - wrapper.offsetWidth;
        newLeftPanel = Math.max(minLeft, Math.min(newLeftPanel, maxLeft));

        // Set both the panel and dashboardPanelDescription with the same value.
        panel.style.left = newLeftPanel + 'px';
        dashboardPanelDescription.style.marginLeft = newLeftPanel + 'px';

        // Optionally: move the wrapper as well if desired.
        wrapper.style.left = Math.max(minLeft, Math.min(wrapperStartLeft + deltaX, maxLeft)) + 'px';
    }

    function onMouseUp() {
        // Save positions to localStorage
        localStorage.setItem('panelLeft', panel.style.left);
        localStorage.setItem('wrapperLeft', wrapper.style.left);
        // Save the same value for dashboard-panel-description since they must be identical.
        localStorage.setItem('dashboardPanelMarginLeft', dashboardPanelDescription.style.marginLeft);
        document.onmousemove = null;
        document.onmouseup = null;
    }
}

addDragFunctionalityToWrapper();

function initializeWrapperPosition() {
    const wrapper = document.getElementById('wrapper');
    const panel = document.querySelector('.panel-100-real');
    const dashboardPanelDescription = document.getElementById('dashboard-panel-description');

    if (!wrapper || !panel || !dashboardPanelDescription) return;

    // Ensure the panel is positioned
    panel.style.position = 'relative';

    // Retrieve saved positions from localStorage
    const storedPanelLeft = localStorage.getItem('panelLeft');
    const storedWrapperLeft = localStorage.getItem('wrapperLeft');
    // We'll use the same value for the dashboard-panel-description
    const storedDashboardMarginLeft = localStorage.getItem('dashboardPanelMarginLeft');

    // If a saved value exists, apply it to both the panel and the dashboard description
    if (storedPanelLeft) {
        panel.style.left = storedPanelLeft;
        dashboardPanelDescription.style.marginLeft = storedPanelLeft;
    } else {
        panel.style.left = '0px';
        dashboardPanelDescription.style.marginLeft = '0px';
    }

    if (storedWrapperLeft) {
        wrapper.style.left = storedWrapperLeft;
    } else {
        wrapper.style.left = '0px';
    }
}

initializeWrapperPosition();








	// Call the initialization and drag functionality setup
	document.addEventListener('DOMContentLoaded', () => {
		setTimeout(() => {
			addDragFunctionalityToWrapper();
		}, 1500); // Wait 1500 ms before calling the functions
	});
	
    // Function to create the toggle button
    function createToggleButton() {
        const toggleButton = document.createElement('div');
        toggleButton.classList.add('tooltip2'); // Klasse hinzufügen
        toggleButton.setAttribute('data-tooltip', t('plugin.livemapPlugin.toggleStationList'));
        toggleButton.style.width = '10px';
        toggleButton.style.height = '10px';
        toggleButton.style.backgroundColor = 'var(--livemap-accent)';
        toggleButton.style.position = 'absolute';
        toggleButton.style.bottom = '0px';
        toggleButton.style.left = '0px';
        toggleButton.style.cursor = 'pointer';
        toggleButton.style.zIndex = '1000';
        toggleButton.style.borderRadius = '0 0 0 15px';
        toggleButton.style.transition = 'background-color 0.3s ease';

        // Add the toggle functionality
        toggleButton.onclick = () => {
            if (!stationListContainer) {
                console.error('stationListContainer is not defined.');
                return;
            }

            const stationListVisible = stationListContainer.style.visibility === 'visible';

            if (stationListVisible) {
                // Hide station list
                stationListContainer.classList.remove('fade-in');
                stationListContainer.classList.add('fade-out');
                stationListContainer.addEventListener('animationend', function handler() {
                    stationListContainer.style.opacity = '0';
                    stationListContainer.style.visibility = 'hidden';
                    stationListContainer.removeEventListener('animationend', handler);
                });

                // Save state to localStorage
                localStorage.setItem('stationListVisible', 'hidden');
            } else {
                // Show station list
                stationListContainer.style.opacity = '1';
                stationListContainer.style.visibility = 'visible';
                stationListContainer.classList.remove('fade-out');
                stationListContainer.classList.add('fade-in');

                // Save state to localStorage
                localStorage.setItem('stationListVisible', 'visible');
							
            }
        };

        return toggleButton;
    }

    // WebSocket setup function
    async function setupWebSocket() {
        if (!websocket || websocket.readyState === WebSocket.CLOSED) {
            try {
                websocket = await window.socketPromise;

                websocket.addEventListener("open", () => {
                    debugLog("WebSocket connected.");
                });

                websocket.addEventListener("message", handleWebSocketMessage);

                websocket.addEventListener("error", (error) => {
                    debugLog("WebSocket error:", error);
                });

                websocket.addEventListener("close", (event) => {
                    debugLog("WebSocket connection closed, retrying in 5 seconds.");
                    setTimeout(setupWebSocket, 5000);
                });

            } catch (error) {
                debugLog("Error during WebSocket setup:", error);
            }
        }
    }

    // Function to create the close button ("X") - LM-014: Apply bluish theme
    function createCloseButton() {
    const closeButton = document.createElement('div');
    closeButton.innerHTML = '×';
    closeButton.style.position = 'absolute';
    closeButton.style.top = '0px';
    closeButton.style.right = '8px';
    closeButton.style.cursor = 'pointer';
    closeButton.style.color = 'var(--livemap-text)';
    closeButton.style.backgroundColor = 'var(--livemap-bg-secondary)';
    closeButton.style.padding = '4px 8px';
    closeButton.style.paddingLeft = '15px';
    closeButton.style.zIndex = '10';
    closeButton.style.fontSize = '24px';
    closeButton.style.fontWeight = 'bold';
    closeButton.style.borderRadius = '0 15px 0 0';
    closeButton.style.transition = 'background-color 0.3s ease';
    
    closeButton.addEventListener('mouseenter', () => {
        closeButton.style.backgroundColor = 'var(--livemap-hover)';
    });
    
    closeButton.addEventListener('mouseleave', () => {
        closeButton.style.backgroundColor = 'var(--livemap-bg-secondary)';
    });

    closeButton.onclick = () => {

        // Speichern der aktuellen Position und Größe
        iframeLeft = parseInt(iframeContainer.style.left);
        iframeTop = parseInt(iframeContainer.style.top);
        iframeWidth = parseInt(iframeContainer.style.width);
        iframeHeight = parseInt(iframeContainer.style.height);

        localStorage.setItem('iframeLeft', iframeLeft);
        localStorage.setItem('iframeTop', iframeTop);
        localStorage.setItem('iframeWidth', iframeWidth);
        localStorage.setItem('iframeHeight', iframeHeight);

        // Animation starten
        iframeContainer.classList.add('fade-out');

        if (stationListContainer) {
            stationListContainer.classList.remove('fade-in');
            stationListContainer.classList.add('fade-out');
            stationListContainer.addEventListener('animationend', function handler() {
                stationListContainer.style.opacity = '0';
                stationListContainer.style.visibility = 'hidden';
                stationListContainer.removeEventListener('animationend', handler);
            });
        }

        // Nach Abschluss der Animation das Element entfernen und Button deaktivieren
        iframeContainer.addEventListener('animationend', () => {
            if (iframeContainer) {
                iframeContainer.remove();
                iframeContainer = null;
            }
            const LiveMapButton = document.getElementById('LIVEMAP-on-off');
            if (LiveMapButton) {
                LiveMapButton.classList.remove('active');       // aktive Klasse entfernen
                LiveMapActive = false;
            }
        });
    };

    return closeButton;
}


    // Create iframe element
    function createIframe() {
        const iframe = document.createElement('iframe');
        iframe.style.display = 'block';
        iframe.style.flexGrow = '1';
        iframe.style.minHeight = '0';
        iframe.style.border = 'none';
        iframe.style.borderRadius = '0';
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        return iframe;
    }

    // Create the iframe header - LM-014: Apply bluish professional theme
    function createIframeHeader() {
        const header = document.createElement('div');
        header.style.backgroundColor = 'var(--livemap-bg-secondary)';
        header.style.color = 'var(--livemap-text)';
        header.style.padding = '12px 15px';
        header.style.position = 'relative';
        header.style.zIndex = '1';
        header.style.fontWeight = '600';
        header.style.fontSize = '14px';
        header.style.borderBottom = '2px solid var(--livemap-border)';
        header.innerHTML = t('plugin.livemapPlugin.headerTitle');
        return header;
    }

    // Create the iframe footer - LM-014: Apply bluish professional theme
    function createIframeFooter() {

        const footer = document.createElement('div');
        footer.style.backgroundColor = 'var(--livemap-bg-secondary)';
        footer.style.color = 'var(--livemap-text)';
        footer.style.padding = '10px 15px';
        footer.style.position = 'relative';
        footer.style.zIndex = '1';
        footer.style.display = 'flex';
        footer.style.flexWrap = 'wrap';
        footer.style.justifyContent = 'flex-end';
        footer.style.alignItems = 'center';
        footer.style.borderTop = '2px solid var(--livemap-border)';

        // LM-016: Set default radius to 250km (removed radius selection UI)
        radius = '250';

        return footer;
    }

 // Function to open (or create) the IndexedDB database
function openCacheDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('apiCacheDB', 1);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('apiCache')) {
                db.createObjectStore('apiCache', { keyPath: 'key' });
            }
        };

        request.onsuccess = (event) => {
            resolve(event.target.result);
        };

        request.onerror = (event) => {
            reject('IndexedDB error: ' + event.target.errorCode);
        };
    });
}

// Function to get cached data
function getCachedData(db, key) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['apiCache'], 'readonly');
        const store = transaction.objectStore('apiCache');
        const request = store.get(key);

        request.onsuccess = (event) => {
            resolve(event.target.result);
        };

        request.onerror = (event) => {
            reject('Failed to get cached data');
        };
    });
}

// Function to cache data with a timestamp
function cacheData(db, key, data) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['apiCache'], 'readwrite');
        const store = transaction.objectStore('apiCache');

        const cacheEntry = {
            key,
            data,
            cachedAt: Date.now() // Store the current timestamp
        };

        const request = store.put(cacheEntry);

        request.onsuccess = () => {
            resolve();
        };

        request.onerror = (event) => {
            reject('Failed to cache data: ' + event.target.errorCode);
        };
    });
}

// Helper function to check if cached data is older than 7 days
function isCacheExpired(cachedAt) {
    const sevenDaysInMillis = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    const currentTime = Date.now();
    return (currentTime - cachedAt) > sevenDaysInMillis;
}

// LM-004: Main function with cache mechanism using fxdetails2.php API
async function fetchAndCacheStationData(freq, radius, picode, txposLat, txposLon, stationid, pol, foundPI) {

    try {
        const db = await openCacheDB();
        
        // Create a cache key based on the parameters
        const cacheKey = `livemap:v1:${freq}:${picode}:${txposLat}:${txposLon}`;
        
        // Check if data is already in cache
        const cachedData = await getCachedData(db, cacheKey);

        if (cachedData) {
            // Check if the cached data is older than 7 days
            if (!isCacheExpired(cachedData.cachedAt)) {
                debugLog('Returning cached data:', cachedData);
                displayStationData(cachedData.data, txposLat, txposLon, picode, pol, foundPI);
                return;
            } else {
                debugLog('Cache expired, fetching new data...');
            }
        }

        // Only fetch if we have a valid PI code (not '?')
        if (!picode || picode === '?') {
            debugLog('No valid PI code, skipping station data fetch');
            return;
        }

        // LM-004: Use new fxdetails2.php API
        const freqKHz = Math.round(parseFloat(freq) * 1000);
        const apiUrl = `https://api.fmlist.org/fmscan.com/fxdetails2.php?fx=${freqKHz}&pi=${picode}&pos=${txposLat},${txposLon}`;
        
        debugLog('Fetching station data from:', apiUrl);
        const response = await fetch(apiUrl);

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        debugLog('Fetched data from fxdetails2 API:', data);

        // Check if we got valid data
        if (!data || !data.frequencies || data.frequencies.length === 0) {
            debugLog('No station data returned from API');
            return;
        }

        // Cache the API response with a timestamp
        await cacheData(db, cacheKey, data);

        // Display the station data
        displayStationData(data, txposLat, txposLon, picode, pol, foundPI);

    } catch (error) {
        console.error('Error fetching station data:', error);
    }
}

    // Function to calculate the distance between two geographical points
    function calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Radius of the Earth in kilometers
        const dLat = toRadians(lat2 - lat1);
        const dLon = toRadians(lon2 - lon1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    // Convert degrees to radians
    function toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }

	// Function to calculate the azimuth (initial bearing) between two geographic points
	function calculateAzimuth(lat1, lon1, lat2, lon2) {
		// Convert latitude and longitude from degrees to radians
		const lat1Rad = lat1 * (Math.PI / 180);
		const lon1Rad = lon1 * (Math.PI / 180);
		const lat2Rad = lat2 * (Math.PI / 180);
		const lon2Rad = lon2 * (Math.PI / 180);

		// Calculate azimuth
		const deltaLon = lon2Rad - lon1Rad;
		const y = Math.sin(deltaLon) * Math.cos(lat2Rad);
		const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
				Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(deltaLon);
		let azimuth = Math.atan2(y, x) * (180 / Math.PI); // Convert to degrees

		// Normalize the azimuth to 0-360 degrees
		azimuth = (azimuth + 360) % 360;

		return azimuth; // Azimuth in degrees
	}
	
function receiveGPS() {;	
    // Check if the WebSocket connection exists
    if (!ws || ws.readyState === WebSocket.CLOSED) {
        console.log('Creating a new WebSocket connection...');
        ws = new WebSocket(WEBSOCKET_URL);

		// Event listener to receive data
		ws.addEventListener('message', (event) => {
		try {
			const parsedData = JSON.parse(event.data); // Use event.data
			//console.log(parsedData);
			if (parsedData.type === "GPS" && parsedData.value) {
				const gpsData = parsedData.value;
				const { status, time, lat, lon, alt, mode } = gpsData;
				if (status === "active") {
					Latitude = parseFloat(lat);
					Longitude = parseFloat(lon);
					//console.log('GPS Data Received:', { Latitude, Longitude });
				}
			}
		} catch (error) {
			logError("Error processing WebSocket data:", error);
		}
	});

	} else if (ws.readyState === WebSocket.OPEN) {
        sendMessage(azimuth); // Send the message if the connection is already open
    } else {
        console.error('WebSocket is not open. Current state:', ws.readyState);
    }
};
	

	async function sendRotorPosition(azimuth) {
    let ipAddress = await fetchIpAddress();

    // Check if the WebSocket connection exists
    if (!ws || ws.readyState === WebSocket.CLOSED) {
        console.log('Creating a new WebSocket connection...');
        ws = new WebSocket(WEBSOCKET_URL);

        // Add event listeners for WebSocket events
        ws.addEventListener('open', function () {
            console.log('WebSocket connection established.');
            sendMessage(azimuth); // Send the message when the connection is open
        });

        ws.addEventListener('error', function (error) {
            console.error('WebSocket error:', error);
        });

        ws.addEventListener('close', function () {
            console.log('WebSocket connection closed.');
            ws = null; // Clear the WebSocket reference when closed
        });

        // Add event listener to receive data
        ws.addEventListener('message', function (event) {
            try {
                // Parse the received data
                const parsedData = JSON.parse(event.data);

                // Check if the dataset is of type GPS
                if (parsedData.type === "GPS" && parsedData.value) {
                    const gpsData = parsedData.value;
                    const { status, time, lat, lon, alt, mode } = gpsData;

                    if (status === "active") {
                        Latitude = parseFloat(lat);
                        Longitude = parseFloat(lon);
                        console.log('Updated GPS Coordinates:', { Latitude, Longitude });
                    }
                }
            } catch (error) {
                logError("Error processing WebSocket data:", error);
            }
        });
    } else if (ws.readyState === WebSocket.OPEN) {
        sendMessage(azimuth); // Send the message if the connection is already open
    } else {
        console.error('WebSocket is not open. Current state:', ws.readyState);
    }

    // Function to send the message
    function sendMessage(azimuth) {
        const message = JSON.stringify({
            type: 'Rotor',
            value: azimuth.toString(),
            lock: isTuneAuthenticated,
            source: ipAddress
        });
        ws.send(message);
        console.log('Sent position:', message);
    }
}



	async function displayStationData(data, txposLat, txposLon, picode, pol, foundPI) {
	       // LM-004: Handle new fxdetails2.php API response format
	       if (!data) {
	           debugLog('No data received for station display');
	           return;
	       }

	       const iframeContainer = document.getElementById('movableDiv');

	       if (!stationListContainer) {
	           stationListContainer = document.createElement('div');
	           stationListContainer.style.position = 'absolute';
	           stationListContainer.style.left = `${iframeContainer.offsetLeft}px`;
	           stationListContainer.style.top = `${iframeContainer.offsetTop + iframeContainer.offsetHeight}px`;
	           stationListContainer.style.backgroundColor = 'var(--livemap-bg-secondary)';
	           stationListContainer.style.padding = '15px';
	           stationListContainer.style.borderRadius = '0px 0px 15px 15px';
	           stationListContainer.style.zIndex = '10';
	           stationListContainer.style.maxHeight = '182px';
	           stationListContainer.style.overflowY = 'scroll';
	           stationListContainer.style.visibility = 'visible';
	           stationListContainer.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.3)';
	           document.body.appendChild(stationListContainer);
	       } else {
	           stationListContainer.style.left = `${iframeContainer.offsetLeft}px`;
	           stationListContainer.style.top = `${iframeContainer.offsetTop + iframeContainer.offsetHeight}px`;
	       }

	       stationListContainer.style.msOverflowStyle = 'none';
	       stationListContainer.style.scrollbarWidth = 'none';
	       stationListContainer.style.WebkitOverflowScrolling = 'touch';
	       stationListContainer.style.overflowX = 'hidden';
	       stationListContainer.innerHTML = '';

	       // LM-004: Parse new API format (fxdetails2.php)
	       const filteredStations = [];
	       
	       if (data.frequencies && Array.isArray(data.frequencies)) {
	           // New API format from fxdetails2.php
	           data.frequencies.forEach(item => {
	               filteredStations.push({
	                   id: item.id,
	                   stationid: item.stationid,
	                   station: item.station,
	                   city: item.location,
	                   freq: parseFloat(item.frequency) / 1000, // Convert kHz to MHz
	                   pi: picode, // Use the picode from parameters
	                   dist: parseFloat(item.dist),
	                   azim: parseFloat(item.azim),
	                   erp: 0, // Not provided by this API
	                   pol: pol || 'H', // Use pol from parameters or default to H
	                   itu: '', // Not provided by this API
	                   lat: null, // Not provided by this API
	                   lon: null // Not provided by this API
	               });
	           });
	       }
	       
	       if (filteredStations.length === 0) {
	           debugLog('No stations to display');
	           return;
	       }
		
        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        table.style.fontSize = '13px';
        table.style.backgroundColor = 'var(--livemap-bg-secondary)';
        table.style.borderRadius = '15px';
        table.style.marginBottom = '0px';
        table.style.marginTop = '0px';
        table.style.textAlign = 'left';

        filteredStations.forEach((stationData) => {
            // LM-004: Handle new data structure
            const { station, city, freq: stationFreq, pi: stationPi, erp, id, stationid: sid, dist, azim, pol: stationPol, itu } = stationData;
     
   if (station) {
            
    const row = document.createElement('tr');
    row.style.margin = '0';
    row.style.padding = '0';
    row.style.transition = 'background-color 0.2s ease';

    // Highlight the received station
    if (id === stationid || sid === stationid) {
     row.style.backgroundColor = 'var(--livemap-bg-tertiary)';
    } else if (picode === stationPi && parseFloat(freq) === parseFloat(stationFreq)) {
     row.style.backgroundColor = 'var(--livemap-bg-tertiary)';
    }
    
    // Add hover effect
    row.addEventListener('mouseenter', () => {
     if (id !== stationid && sid !== stationid && !(picode === stationPi && parseFloat(freq) === parseFloat(stationFreq))) {
      row.style.backgroundColor = 'var(--livemap-bg-primary)';
     }
    });
    
    row.addEventListener('mouseleave', () => {
     if (id !== stationid && sid !== stationid && !(picode === stationPi && parseFloat(freq) === parseFloat(stationFreq))) {
      row.style.backgroundColor = 'transparent';
     }
    });

				// Play icon removed per user request

				const freqCell = document.createElement('td');
				freqCell.innerText = `${stationFreq.toFixed(2)} MHz`;
				freqCell.style.maxWidth = '100px';
				freqCell.style.width = '100px';
				freqCell.style.paddingLeft = '5px';
				freqCell.style.paddingRight = '25px';
				freqCell.style.color = 'var(--livemap-text)';
				freqCell.style.textAlign = 'right';
				freqCell.style.overflow = 'hidden';
				freqCell.style.whiteSpace = 'nowrap';
				freqCell.style.textOverflow = 'ellipsis';
				row.appendChild(freqCell);

				const piCell = document.createElement('td');
				if (stationPi) {
					piCell.innerText = stationPi;
				}
				piCell.style.maxWidth = '70px';
				piCell.style.width = '70px';
				piCell.style.paddingLeft = '5px';
				piCell.style.paddingRight = '25px';
				piCell.style.color = 'var(--livemap-text)';
				piCell.style.textAlign = 'right';
				piCell.style.overflow = 'hidden';
				piCell.style.whiteSpace = 'nowrap';
				piCell.style.textOverflow = 'ellipsis';
				row.appendChild(piCell);

				const stationCell = document.createElement('td');
				stationCell.innerText = station;
				stationCell.style.maxWidth = '160px';
				stationCell.style.width = '160px';
				stationCell.style.paddingLeft = '5px';
				stationCell.style.paddingRight = '5px';
				stationCell.style.color = 'var(--livemap-text)';
				stationCell.style.textAlign = 'left';
				stationCell.style.overflow = 'hidden';
				stationCell.style.whiteSpace = 'nowrap';
				stationCell.style.textOverflow = 'ellipsis';

				if	(PSTRotatorFunctions && azim) {
					// LM-004: Use azimuth from API if available
				      stationCell.title = `${t('plugin.livemapPlugin.turnTheRotorTo')} ${city}${itu ? ' [' + itu + ']' : ''} (${azim}°)`;
					stationCell.style.cursor = 'pointer';

					stationCell.addEventListener('mouseover', () => {
						stationCell.style.textDecoration = 'underline';
						stationCell.style.color = 'var(--livemap-accent)';
					});
				
					stationCell.addEventListener('mouseout', () => {
						stationCell.style.textDecoration = 'none';
						stationCell.style.color = 'var(--livemap-text)';
					});

					stationCell.addEventListener('click', () => {
	
						if (!isTuneAuthenticated) {
							sendToast('warning', t('plugin.livemap'), t('plugin.livemapPlugin.mustBeAuthenticated'), false, false);
						return;
						}
	
						// LM-004: Use azimuth from API
						sendToast('info', t('plugin.livemap'), `${t('plugin.livemapPlugin.turnTheRotorTo')} ${azim} ${t('plugin.livemapPlugin.degrees')}`, false, false);
						sendRotorPosition(azim);
					});

				}

				row.appendChild(stationCell);

				const cityCell = document.createElement('td');
				cityCell.innerText = itu ? `${city} [${itu}]` : city;
				cityCell.style.maxWidth = '160px';
				cityCell.style.width = '160px';
				cityCell.style.paddingLeft = '5px';
				cityCell.style.paddingRight = '5px';
				cityCell.style.color = 'var(--livemap-text)';
				cityCell.style.textAlign = 'left';
				cityCell.style.overflow = 'hidden';
				cityCell.style.whiteSpace = 'nowrap';
				cityCell.style.textOverflow = 'ellipsis';
				row.appendChild(cityCell);
					
				// LM-004: Add distance cell (from new API)
				if (dist !== undefined && dist !== null) {
					const distCell = document.createElement('td');
					distCell.innerText = `${Math.round(dist)} km`;
					distCell.style.maxWidth = '80px';
					distCell.style.width = '80px';
					distCell.style.paddingLeft = '5px';
					distCell.style.paddingRight = '15px';
					distCell.style.color = 'var(--livemap-text)';
					distCell.style.textAlign = 'right';
					row.appendChild(distCell);
				}

				// Polarization column removed per user request

				// LM-004: ERP not provided by fxdetails2 API, hide this cell
				if (erp !== undefined && erp !== null && erp > 0) {
					const erpCell = document.createElement('td');
					erpCell.innerText = `${erp.toFixed(2)} kW`;
					erpCell.style.maxWidth = '100px';
					erpCell.style.width = '100px';
					erpCell.style.paddingLeft = '5px';
					erpCell.style.paddingRight = '5px';
					erpCell.style.color = 'var(--livemap-text)';
					erpCell.style.textAlign = 'right';
					erpCell.style.overflow = 'hidden';
					erpCell.style.whiteSpace = 'nowrap';
					erpCell.style.textOverflow = 'ellipsis';

					if (erp < 0.5) {
						// ERP less than 0.5 kW, set background color to purple
						erpCell.style.backgroundColor = '#7800FF';
					} else if (erp >= 0.5 && erp < 5.0) {
						// ERP between 0.5 kW and 5.0 kW, set background color to blue
						erpCell.style.backgroundColor = '#238BFF';
					} else if (erp >= 5.0) {
						// ERP greater than or equal to 5.0 kW, set background color to dark blue
						erpCell.style.backgroundColor = '#0000FF';
					}

					// Append the ERP cell to the row
					row.appendChild(erpCell);
				}
							
				// Append the row to the table
				table.appendChild(row);
				
			}
			
        });

        // Add the table with stations to the station list container
        stationListContainer.appendChild(table);
        stationListContainer.style.width = `${iframeContainer.offsetWidth}px`;

		// LM-004: City cell click functionality disabled - new API doesn't provide lat/lon coordinates
		// This feature would require additional API endpoint or data to re-enable
		/*
		const cityCells = table.querySelectorAll('td:nth-child(5)');
		cityCells.forEach(cell => {
			cell.style.cursor = 'pointer';
			
			if (picode !== '?' && foundPI) {
				
				const cityToDisplay = cell.innerText.split(' [')[0];
				const cityStation = allStations.find(station => station.city === cityToDisplay);
				
				if (!cityStation  && !station.pi) {
					console.warn('City not found:', cityToDisplay);
					return;
				}

				const distanceToCity = calculateDistance(txposLat, txposLon, cityStation.lat, cityStation.lon);

				const stationsOfCity = allStations
					.filter(station => station.city === cityToDisplay)
					.sort((a, b) => b.erp - a.erp);

				// Clear the table before displaying stations from the selected city
				table.innerHTML = '';

				// Iterate through the stations from the same city and create table rows
				stationsOfCity.forEach(({ station, city, distance, pi, erp, id, itu }) => {
					
					if (station.station) {
					
						const row = document.createElement('tr');

						// Highlight the row if it's the current station
						if (station.id === stationid) {
							row.classList.add('bg-color-1');
						} else if (picode === pi && parseFloat(freq) === parseFloat(station.freq)) {
							row.classList.add('bg-color-1');
						}

						const freqCellStation = document.createElement('td');
						freqCellStation.innerText = `${station.freq.toFixed(2)} MHz`;
						freqCellStation.style.maxWidth = '100px';
						freqCellStation.style.width = '100px';
						freqCellStation.style.paddingLeft = '5px';
						freqCellStation.style.paddingRight = '25px';
						freqCellStation.style.color = 'white';
						freqCellStation.style.textAlign = 'right';
						freqCellStation.style.overflow = 'hidden';
						freqCellStation.style.whiteSpace = 'nowrap';
						freqCellStation.style.textOverflow = 'ellipsis';
						freqCellStation.style.cursor = 'pointer';
						row.appendChild(freqCellStation);

						// Add hover effect and click event for sending frequency data over WebSocket
						freqCellStation.addEventListener('mouseover', () => {
							freqCellStation.style.textDecoration = 'underline';
							freqCellStation.style.color = 'var(--color-4)';
						});

						freqCellStation.addEventListener('mouseout', () => {
							freqCellStation.style.textDecoration = 'none';
							freqCellStation.style.color = 'white';
						});

						freqCellStation.onclick = () => {
							const dataToSend = `T${(parseFloat(station.freq) * 1000).toFixed(0)}`;
							socket.send(dataToSend);
							debugLog("WebSocket sending:", dataToSend);
						};

						const piCell = document.createElement('td');
						if (station.pi) {
							piCell.innerText = pi;
						}
						piCell.style.maxWidth = '70px';
            piCell.style.width = '70px';
						piCell.style.paddingLeft = '5px';
						piCell.style.paddingRight = '25px';
						piCell.style.color = 'white';
						piCell.style.textAlign = 'right';
						piCell.style.overflow = 'hidden';
						piCell.style.whiteSpace = 'nowrap';
						piCell.style.textOverflow = 'ellipsis';
						row.appendChild(piCell);

						const stationCell = document.createElement('td');
						stationCell.innerText = station.station;
						stationCell.style.maxWidth = '160px';
						stationCell.style.width = '160px';
						stationCell.style.paddingLeft = '5px';
						stationCell.style.paddingRight = '5px';
						stationCell.style.color = 'white';
						stationCell.style.textAlign = 'left';
						stationCell.style.overflow = 'hidden';
						stationCell.style.whiteSpace = 'nowrap';
						stationCell.style.textOverflow = 'ellipsis';

						if	(PSTRotatorFunctions) {

							// @TODO need to translate from translation file
							// stationCell.title = `Turn the rotor to ${city}[${itu}]`;
              stationCell.title = `${t('plugin.livemapPlugin.turnTheRotorTo')} ${city}[${itu}]`;
							stationCell.style.cursor = 'pointer';

							stationCell.addEventListener('mouseover', () => {
								stationCell.style.textDecoration = 'underline';
								stationCell.style.color = 'var(--color-5)';
							});
				
							stationCell.addEventListener('mouseout', () => {
								stationCell.style.textDecoration = 'none';
								stationCell.style.color = 'white';
							});

								stationCell.addEventListener('click', () => {
	
								if (!isTuneAuthenticated) {
									sendToast('warning', t('plugin.livemap'), t('plugin.livemapPlugin.mustBeAuthenticated'), false, false);
									return;
								}
	
								const azimuthBetweenPoints = calculateAzimuth(txposLat, txposLon, cityStation.lat, cityStation.lon);
								const azimuth = `${azimuthBetweenPoints.toFixed(0)}`;
    									
								// @TODO need to translate from translation file
								// sendToast('info', 'Livemap', `Turn the rotor to ${azimuth} degrees`, false, false);
								sendToast('info', t('plugin.livemap'), `${t('plugin.livemapPlugin.turnTheRotorTo')} ${azimuth} ${t('plugin.livemapPlugin.degrees')}`, false, false);
								sendRotorPosition(azimuth);
							});

						}

						row.appendChild(stationCell);

						// Create and append the city and ITU code cell
						const cityAllCell = document.createElement('td');
						cityAllCell.innerText = `${city} [${itu}]`;
						cityAllCell.style.maxWidth = '160px';
						cityAllCell.style.width = '160px';
						cityAllCell.style.paddingRight = '5px';
						cityAllCell.style.paddingLeft = '5px';
						cityAllCell.title = t('plugin.livemapPlugin.openTransmitterLocationOn');
						cityAllCell.style.color = 'white';
						cityAllCell.style.textAlign = 'left';
						cityAllCell.style.overflow = 'hidden';
						cityAllCell.style.whiteSpace = 'nowrap';
						cityAllCell.style.textOverflow = 'ellipsis';
						cityAllCell.style.cursor = 'pointer';
						row.appendChild(cityAllCell);

						// Add hover effect for city cell
						cityAllCell.addEventListener('mouseover', () => {
							cityAllCell.style.textDecoration = 'underline';
							cityAllCell.style.color = 'var(--color-5)';
						});

						cityAllCell.addEventListener('mouseout', () => {
							cityAllCell.style.textDecoration = 'none';
							cityAllCell.style.color = 'white';
						});

						// Add click event to open the station's webpage
						cityAllCell.addEventListener('click', () => {
							window.open(`https://fmscan.org/transmitter.php?i=${id}`, '_blank');
						});

						// Create and append the distance cell
						const distanceCell = document.createElement('td');
						distanceCell.innerText = `${Math.round(distanceToCity)} km`;
						distanceCell.style.padding = '0';
						distanceCell.style.maxWidth = '75px';
						distanceCell.style.paddingLeft = '10px';
						distanceCell.style.paddingRight = '10px';
						distanceCell.style.color = 'white';
						distanceCell.style.textAlign = 'right';
						distanceCell.style.overflow = 'hidden';
						distanceCell.style.whiteSpace = 'nowrap';
						distanceCell.style.textOverflow = 'ellipsis';
						row.appendChild(distanceCell);

						const polCell = document.createElement('td');
						polCell.innerText = `${station.pol.substring(0, 1)}`;
						polCell.style.maxWidth = '1px';
						polCell.style.width = '1px';
						polCell.style.paddingLeft = '5px';
						polCell.style.paddingRight = '15px';
						polCell.style.color = 'white';
						polCell.style.textAlign = 'right';       
						row.appendChild(polCell);

						// Create and append the ERP cell
						const erpCell = document.createElement('td');
						erpCell.innerText = `${erp.toFixed(2)} kW`;
						erpCell.style.maxWidth = '100px';
						erpCell.style.width = '100px';
						erpCell.style.paddingLeft = '5px';
						erpCell.style.paddingRight = '5px';
						erpCell.style.color = 'white';
						erpCell.style.textAlign = 'right';
						erpCell.style.overflow = 'hidden';
						erpCell.style.whiteSpace = 'nowrap';
						erpCell.style.textOverflow = 'ellipsis';

						if (erp < 0.5) {
							// ERP less than 0.5 kW, set background color to purple
							erpCell.style.backgroundColor = '#7800FF';
						} else if (erp >= 0.5 && erp < 5.0) {
							// ERP between 0.5 kW and 5.0 kW, set background color to blue
							erpCell.style.backgroundColor = '#238BFF';
						} else if (erp >= 5.0) {
							// ERP greater than or equal to 5.0 kW, set background color to dark blue
							erpCell.style.backgroundColor = '#0000FF';
						}

						row.appendChild(erpCell);

						// Append the row to the table
						table.appendChild(row);
            
						// Create and append an empty row for spacing
						const emptyRow = document.createElement('tr');
						const emptyCell = document.createElement('td');
            
						emptyCell.colSpan = 7; // Adjust the number of columns accordingly
						emptyCell.style.height = '2px'; // Height of the empty row
						emptyRow.appendChild(emptyCell);
						table.appendChild(emptyRow);
					}
					});
			}

			// onclick-Ereignis setzen, sodass derselbe Code auch bei einem Klick ausgeführt wird
			cell.onclick = () => {
				
				const cityToDisplay = cell.innerText.split(' [')[0]; // Define cityToDisplay here
				const cityStation = allStations.find(station => station.city === cityToDisplay);

				if (!cityStation) {
					console.warn('City not found:', cityToDisplay);
					return;
				}

				const distanceToCity = calculateDistance(txposLat, txposLon, cityStation.lat, cityStation.lon);

				// Filter and sort the stations of the selected city by ERP in descending order
				const stationsOfCity = allStations
					.filter(station => station.city === cityToDisplay)
					.sort((a, b) => b.erp - a.erp); // Sorting in descending order based on ERP

				// Clear the table before displaying stations from the selected city
				table.innerHTML = '';
	
				// Iterate through the stations from the same city and create table rows
				stationsOfCity.forEach(({ station, city, distance, pi, erp, id, itu }) => {
				
					if (station.station) {
					
						const row = document.createElement('tr');

						// Highlight the row if it's the current station
						if (station.id === stationid) {
							row.classList.add('bg-color-1');
						} else if (picode === pi && parseFloat(freq) === parseFloat(station.freq)) {
							row.classList.add('bg-color-1');
						}

						const freqCellStation = document.createElement('td');
						freqCellStation.innerText = `${station.freq.toFixed(2)} MHz`;
						freqCellStation.style.maxWidth = '100px';
						freqCellStation.style.width = '100px';
						freqCellStation.style.paddingLeft = '5px';
						freqCellStation.style.paddingRight = '25px';
						freqCellStation.style.color = 'white';
						freqCellStation.style.textAlign = 'right';
						freqCellStation.style.overflow = 'hidden';
						freqCellStation.style.whiteSpace = 'nowrap';
						freqCellStation.style.textOverflow = 'ellipsis';
						freqCellStation.style.cursor = 'pointer';
						row.appendChild(freqCellStation);

						// Add hover effect and click event for sending frequency data over WebSocket
						freqCellStation.addEventListener('mouseover', () => {
							freqCellStation.style.textDecoration = 'underline';
							freqCellStation.style.color = 'var(--color-4)';
						});

						freqCellStation.addEventListener('mouseout', () => {
							freqCellStation.style.textDecoration = 'none';
							freqCellStation.style.color = 'white';
						});

						freqCellStation.onclick = () => {
							const dataToSend = `T${(parseFloat(station.freq) * 1000).toFixed(0)}`;
							socket.send(dataToSend);
							debugLog("WebSocket sending:", dataToSend);
						};

						const piCell = document.createElement('td');
						if (station.pi) {
							piCell.innerText = pi;
						}
						piCell.style.maxWidth = '70px';
							piCell.style.width = '70px';
						piCell.style.paddingLeft = '5px';
						piCell.style.paddingRight = '25px';
						piCell.style.color = 'white';
						piCell.style.textAlign = 'right';
						piCell.style.overflow = 'hidden';
						piCell.style.whiteSpace = 'nowrap';
						piCell.style.textOverflow = 'ellipsis';
						row.appendChild(piCell);

						const stationCell = document.createElement('td');
						stationCell.innerText = station.station;
						stationCell.style.maxWidth = '160px';
						stationCell.style.width = '160px';
						stationCell.style.paddingLeft = '5px';
						stationCell.style.paddingRight = '5px';
						stationCell.style.color = 'white';
						stationCell.style.textAlign = 'left';
						stationCell.style.overflow = 'hidden';
						stationCell.style.whiteSpace = 'nowrap';
						stationCell.style.textOverflow = 'ellipsis';

						if	(PSTRotatorFunctions) {

							// @TODO need to translate from translation file
							// stationCell.title = `Turn the rotor to ${city}[${itu}]`;
              stationCell.title = `${t('plugin.livemapPlugin.turnTheRotorTo')} ${city}[${itu}]`;
							stationCell.style.cursor = 'pointer';

							stationCell.addEventListener('mouseover', () => {
								stationCell.style.textDecoration = 'underline';
								stationCell.style.color = 'var(--color-5)';
							});
				
							stationCell.addEventListener('mouseout', () => {
								stationCell.style.textDecoration = 'none';
								stationCell.style.color = 'white';
							});

								stationCell.addEventListener('click', () => {
	
								if (!isTuneAuthenticated) {
									sendToast('warning', t('plugin.livemap'), t('plugin.livemapPlugin.mustBeAuthenticated'), false, false);
									return;
								}
	
								const azimuthBetweenPoints = calculateAzimuth(txposLat, txposLon, cityStation.lat, cityStation.lon);
								const azimuth = `${azimuthBetweenPoints.toFixed(0)}`;
    
								// @TODO need to translate from translation file
								// sendToast('info', 'Livemap', `Turn the rotor to ${azimuth} degrees`, false, false);
								sendToast('info', t('plugin.livemap'), `${t('plugin.livemapPlugin.turnTheRotorTo')} ${azimuth} ${t('plugin.livemapPlugin.degrees')}`, false, false);
								sendRotorPosition(azimuth);
							});

						}

						row.appendChild(stationCell);

						// Create and append the city and ITU code cell
						const cityAllCell = document.createElement('td');
						cityAllCell.innerText = `${city} [${itu}]`;
						cityAllCell.style.maxWidth = '160px';
						cityAllCell.style.width = '160px';
						cityAllCell.style.paddingRight = '5px';
						cityAllCell.style.paddingLeft = '5px';
						cityAllCell.title = t('plugin.livemapPlugin.openFrequencyList');
						cityAllCell.style.color = 'white';
						cityAllCell.style.textAlign = 'left';
						cityAllCell.style.overflow = 'hidden';
						cityAllCell.style.whiteSpace = 'nowrap';
						cityAllCell.style.textOverflow = 'ellipsis';
						cityAllCell.style.cursor = 'pointer';
						row.appendChild(cityAllCell);

						// Add hover effect for city cell
						cityAllCell.addEventListener('mouseover', () => {
							cityAllCell.style.textDecoration = 'underline';
							cityAllCell.style.color = 'var(--color-5)';
						});

						cityAllCell.addEventListener('mouseout', () => {
							cityAllCell.style.textDecoration = 'none';
							cityAllCell.style.color = 'white';
						});

						// Add click event to display more stations from the same city
						cityAllCell.addEventListener('click', () => {
							displayStationData(data, txposLat, txposLon, foundPI); // Ensure this function is defined correctly
						});

						// Create and append the distance cell
						const distanceCell = document.createElement('td');
						distanceCell.innerText = `${Math.round(distanceToCity)} km`;
						distanceCell.style.padding = '0';
						distanceCell.style.maxWidth = '75px';
						distanceCell.style.paddingLeft = '10px';
						distanceCell.style.paddingRight = '10px';
						distanceCell.style.color = 'white';
						distanceCell.style.textAlign = 'right';
						distanceCell.style.overflow = 'hidden';
						distanceCell.style.whiteSpace = 'nowrap';
						distanceCell.style.textOverflow = 'ellipsis';
						row.appendChild(distanceCell);

						const polCell = document.createElement('td');
						polCell.innerText = `${station.pol.substring(0, 1)}`;
						polCell.style.maxWidth = '1px';
						polCell.style.width = '1px';
						polCell.style.paddingLeft = '5px';
						polCell.style.paddingRight = '15px';
						polCell.style.color = 'white';
						polCell.style.textAlign = 'right';       
						row.appendChild(polCell);

						// Create and append the ERP cell
						const erpCell = document.createElement('td');
						erpCell.innerText = `${erp.toFixed(2)} kW`;
						erpCell.style.maxWidth = '100px';
						erpCell.style.width = '100px';
						erpCell.style.paddingLeft = '5px';
						erpCell.style.paddingRight = '5px';
						erpCell.style.color = 'white';
						erpCell.style.textAlign = 'right';
						erpCell.style.overflow = 'hidden';
						erpCell.style.whiteSpace = 'nowrap';
						erpCell.style.textOverflow = 'ellipsis';

						if (erp < 0.5) {
							// ERP less than 0.5 kW, set background color to purple
							erpCell.style.backgroundColor = '#7800FF';
						} else if (erp >= 0.5 && erp < 5.0) {
							// ERP between 0.5 kW and 5.0 kW, set background color to blue
							erpCell.style.backgroundColor = '#238BFF';
						} else if (erp >= 5.0) {
							// ERP greater than or equal to 5.0 kW, set background color to dark blue
							erpCell.style.backgroundColor = '#0000FF';
						}

						row.appendChild(erpCell);
						

						table.appendChild(row);
            
						// Create and append an empty row for spacing
						const emptyRow = document.createElement('tr');
						const emptyCell = document.createElement('td');
            
						emptyCell.colSpan = 7; // Adjust the number of columns accordingly
						emptyCell.style.height = '2px'; // Height of the empty row
						emptyRow.appendChild(emptyCell);
						table.appendChild(emptyRow);
					};
				});	
			};
		});
		*/
		// End of disabled city cell click functionality
	};

	// Function to open (or create) the IndexedDB database
    function openCacheDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('apiCacheDB', 1);

            // Create object store if not already present
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('apiCache')) {
                    db.createObjectStore('apiCache', { keyPath: 'key' });
                }
            };

            // Resolve when successfully opened
            request.onsuccess = (event) => {
                resolve(event.target.result);
            };

            // Reject if an error occurs
            request.onerror = (event) => {
                reject('IndexedDB error: ' + event.target.errorCode);
            };
        });
    }

    // Function to get cached data from the database
    function getCachedData(db, key) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['apiCache'], 'readonly');
            const store = transaction.objectStore('apiCache');
            const request = store.get(key);

            // Resolve if data is found
            request.onsuccess = (event) => {
                resolve(event.target.result);
            };

            // Reject if there is an error retrieving data
            request.onerror = (event) => {
                reject('Failed to get cached data');
            };
        });
    }

    // Function to cache data into the IndexedDB database
    function cacheData(db, key, data) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['apiCache'], 'readwrite');
            const store = transaction.objectStore('apiCache');
            const request = store.put({ key, data });

            // Resolve when data is successfully cached
            request.onsuccess = () => {
                resolve();
            };

            // Reject if there's an error during caching
            request.onerror = (event) => {
                reject('Failed to cache data: ' + event.target.errorCode);
            };
        });
    }

    // Async function to create or update the iframe based on the provided data
    async function openOrUpdateIframe(picode, freq, stationid, station, city, distance, ps, itu, pol, radius) {
		
        if (!LiveMapActive) return;

        // Handle Latitude and Longitude assignment
        if (typeof Latitude === 'undefined' || typeof Longitude === 'undefined') {
            LAT = localStorage.getItem('qthLatitude') || '0';
            LON = localStorage.getItem('qthLongitude') || '0';
        } else {
             LAT = Latitude;
             LON = Longitude;
        }

        // Reference position for the map/table (receiver's location) —
        // formerly could be overridden by a TXPOS toggle, which has been removed (dead/never-rendered feature).
        const txposLat = LAT;
        const txposLon = LON;

        let url;
        // LM-006: Convert frequency from MHz to kHz for API
        const freqKHz = Math.round(parseFloat(freq) * 1000);

        // Validate the PI code directly against the live fxmap.php API rather than a
        // separate lookup source, so newly-added stations aren't rejected just for being
        // absent from some other dataset. Fall back to '?' only if the API itself
        // reports the PI code as invalid (its "5.06" error response).
        let piCodeValid = false;
        let piCodeCheckUrl;
        if (picode && picode !== '?') {
            piCodeCheckUrl = `https://api.fmlist.org/fmscan.com/fxmap.php?fx=${freqKHz}&pi=${picode}&pos=${LAT},${LON}`;
            const piCheckResponse = await fetch(piCodeCheckUrl);
            if (piCheckResponse.ok) {
                const piCheckText = await piCheckResponse.text();
                piCodeValid = !piCheckText.includes('5.06'); // API'nin kendi hata metnine bakılıyor
            }
        }

        if (piCodeValid) {
            url = radius === 'none' ? piCodeCheckUrl : `${piCodeCheckUrl}&r=${radius}`;
        } else if (radius === 'none') {
            url = `https://api.fmlist.org/fmscan.com/fxmap.php?fx=${freqKHz}&pi=?&pos=${txposLat},${txposLon}`;
        } else {
            url = `https://api.fmlist.org/fmscan.com/fxmap.php?fx=${freqKHz}&pi=?&pos=${txposLat},${txposLon}&r=${radius}`;
        }

        const uniqueUrl = `${url}&t=${new Date().getTime()}`;

        // Function to create and insert the iframe
        function createAndInsertIframe() {
            const newIframe = createIframe();
            const header = createIframeHeader();
            const footer = createIframeFooter();
            const closeButton = createCloseButton();
            const toggleButton = createToggleButton(); // Create the blue toggle button
            newIframe.src = uniqueUrl;

            newIframe.style.opacity = '0';
            newIframe.style.transition = 'opacity 0.5s';

            if (!iframeContainer) {
                iframeContainer = document.createElement('div');
                iframeContainer.id = 'movableDiv';
                iframeContainer.style.width = `${iframeWidth}px`;
                iframeContainer.style.height = `${iframeHeight}px`;
                iframeContainer.style.left = `${iframeLeft}px`;
                iframeContainer.style.top = `${iframeTop}px`;
                iframeContainer.style.position = 'fixed';
                iframeContainer.style.opacity = '0';
                iframeContainer.style.transition = 'opacity 0.5s';
                iframeContainer.style.zIndex = '1000';
                iframeContainer.style.display = 'flex';
                iframeContainer.style.flexDirection = 'column';
                iframeContainer.style.overflow = 'hidden';
                iframeContainer.appendChild(header);
                iframeContainer.appendChild(newIframe);
                iframeContainer.appendChild(footer);
                iframeContainer.appendChild(closeButton);
                iframeContainer.appendChild(toggleButton); // Append the toggle button to the container
                document.body.appendChild(iframeContainer);
                addDragFunctionality(iframeContainer);
                addResizeFunctionality(iframeContainer);

                setTimeout(() => {
                    iframeContainer.style.opacity = '1';
                    newIframe.style.opacity = '1';
                }, 200);
            } else {
                iframeContainer.appendChild(newIframe);

                const existingHeader = iframeContainer.querySelector('div');
                if (existingHeader) {
                    if (!stationid) {
                        existingHeader.innerHTML = `${freq} MHz | ${picode}`;
                    } else {
                        existingHeader.innerHTML = `${freq} MHz | ${picode} | ${station} from ${city} [${itu}] [${distance} km]`;
                    }
                }

                // Remove old iframes
                const existingIframes = iframeContainer.querySelectorAll('iframe:not(:last-child)');
                existingIframes.forEach(iframe => {
                    iframe.parentNode.removeChild(iframe);
                });

                setTimeout(() => {
                    newIframe.style.opacity = '1';
                }, 200);
            }
        }

        if (freq === '0.0' || (picode !== '?' && picode !== lastPicode) || (freq !== lastFreq) || (stationid && stationid !== lastStationId)) {
            createAndInsertIframe();

            lastPicode = picode;
            lastStationId = stationid;
            lastFreq = freq;
            await fetchAndCacheStationData(freq, radius, picode, txposLat, txposLon, stationid, pol, foundPI);
        }
    }

    let previousFreq = null;
    let timeoutId = null;
    let isFirstUpdateAfterChange = false;
    let freq_save;
    let isToggleEnabled = true; // Flag to track if the toggle is enabled
    let longPressTimer = null; // Timer for detecting long press
    let longPressDuration = 1000; // Duration in milliseconds for long press (1 second)
    let isLongPressTriggered = false; // Flag to track whether long press was triggered

    // Find the element with the class "panel-33 hover-brighten" and the ID "freq-container"
    let element = document.querySelector('div.panel-33.hover-brighten#freq-container');

    // Check if the element was found
    if (element) {
        // Add the class "tooltip"
        element.classList.add('tooltip');

        // Add the "data-tooltip" attribute
        element.setAttribute('data-tooltip', t('plugin.livemapPlugin.toggleActualPreviousFrequency'));
    }

    // Find the element with the ID "freq-container"
    const freqContainer = document.getElementById('freq-container');

    const frequencyElement = document.getElementById('data-frequency'); // Get the frequency element

    // Check localStorage for saved toggle state and restore it
    const savedToggleState = localStorage.getItem('toggleEnabled');
    debugLog("Loaded toggle state from localStorage:", savedToggleState);

    // Restore the toggle state if found
    if (savedToggleState === 'false') {
        isToggleEnabled = false; // Restore the toggle state from localStorage
        debugLog("Restoring toggle state: disabled.");
    } else {
        debugLog("Restoring toggle state: enabled.");
    }

    // Define `ensureExistingDiv` function at the start of your code or above `handleWebSocketMessage`
	function ensureExistingDiv(freq_save) {
		let existingDiv = freqContainer.querySelector('.text-small.text-gray');
		if (existingDiv) {
			existingDiv.textContent = freq_save;
		} else {
			existingDiv = document.createElement('div');
			existingDiv.className = 'text-small text-gray hide-phone';
			existingDiv.textContent = freq_save;
			freqContainer.insertBefore(existingDiv, frequencyElement);
		}

		// Ensure freqContainer is a positioned ancestor
		const containerPosition = window.getComputedStyle(freqContainer).position;
		if (containerPosition === 'static') {
			freqContainer.style.position = 'relative';
		}

		// Pin the small freq div absolutely to the top-center of the freq container,
		// so it is unaffected by other plugins changing flex/block layout
		existingDiv.style.position = 'absolute';
		existingDiv.style.top = '46px';
		existingDiv.style.left = '50%';
		existingDiv.style.transform = 'translateX(-50%)';
		existingDiv.style.marginTop = '';
		existingDiv.style.zIndex = '1';

		existingDiv.style.display = isToggleEnabled ? '' : 'none';
		return existingDiv;
	}

    // Add long press event listener to freqContainer for toggling visibility and functionality
    freqContainer.addEventListener('mousedown', () => {
        isLongPressTriggered = false; // Reset the flag on each mousedown
        longPressTimer = setTimeout(() => {
            isLongPressTriggered = true; // Set the flag to true after a long press
            toggleFrequencyFunctions(); // Call the function to toggle visibility and functionality
        }, longPressDuration); // Detect long press after 1 second
    });

    freqContainer.addEventListener('mouseup', () => {
        clearTimeout(longPressTimer); // Clear the timer if mouse is released before long press
    });

    freqContainer.addEventListener('mouseleave', () => {
        clearTimeout(longPressTimer); // Clear the timer if the mouse leaves the container before the press is complete
    });
	
	// Function to handle sending data
	function sendFrequencyData() {
		if (isToggleEnabled) { // Check if the toggle functionality is enabled and data can be sent
			const dataToSend = `T${(parseFloat(freq_save) * 1000).toFixed(0)}`; // Prepare data to send via WebSocket
			socket.send(dataToSend); // Send the data using the WebSocket
			debugLog("WebSocket sending:", dataToSend); // Log the sent data
		}
	}

	// Add a click event listener to the frequency element
	frequencyElement.addEventListener('click', sendFrequencyData);

    async function handleWebSocketMessage(event) {
        try {
            const data = JSON.parse(event.data); // Parse the incoming WebSocket message
			
			// console.log(data);
            
			picode = data.pi; // Extract pi code from data
            freq = data.freq; // Extract frequency from data
            itu = data.txInfo.itu; // Extract ITU information from transmission info
            city = data.txInfo.city; // Extract city from transmission info
            station = data.txInfo.tx; // Extract station from transmission info
            distance = data.txInfo.dist; // Extract distance from transmission info
            pol = data.txInfo.pol; // Extract polarization from transmission info
            ps = data.ps; // Extract PS from data
            stationid = data.txInfo.id; // Extract station ID from transmission info

            // Check if the frequency has changed
            if (freq !== previousFreq) {

                if (frequencyElement) {
                    freq_save = previousFreq;

                    // ensureExistingDiv now handles all positioning
                    const existingDiv = ensureExistingDiv(freq_save);

                } else {
                    console.error('Element with ID "data-frequency" not found.');
                }

                previousFreq = freq; // Update the previous frequency

                isFirstUpdateAfterChange = true; // Set flag for the first update after frequency change

                // Clear any existing timeout
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }

                // Set a timeout to open or update the iframe
                timeoutId = setTimeout(() => {
                    openOrUpdateIframe(picode, freq, stationid, station, city, distance, ps, itu, pol, radius);
                    isFirstUpdateAfterChange = false; // Reset the update flag
                }, 1000);
            } else if (!isFirstUpdateAfterChange) {
                // If the frequency has not changed, just update the iframe
                openOrUpdateIframe(picode, freq, stationid, station, city, distance, ps, itu, pol, radius);
            }
        } catch (error) {
            console.error("Error processing the message:", error); // Log any errors that occur
        }
    }


    // Function to toggle the visibility of newDivElement and the frequency toggle functionality
    function toggleFrequencyFunctions() {
        const existingDiv = freqContainer.querySelector('.text-small.text-gray'); // Check if the div exists

        if (existingDiv) {
            if (isToggleEnabled) {
                existingDiv.style.display = 'none'; // Hide the previous frequency div
                debugLog("Toggling: hiding existingDiv.");
            } else {
                existingDiv.style.display = ''; // Show the previous frequency div
                debugLog("Toggling: showing existingDiv.");
            }
        } else {
            console.warn("existingDiv is null when toggling.");
        }

        isToggleEnabled = !isToggleEnabled; // Toggle the flag to enable/disable the frequency toggle

        // Save the current toggle state in localStorage
        localStorage.setItem('toggleEnabled', isToggleEnabled); 
        debugLog("Saved toggle state to localStorage:", isToggleEnabled);
    }

	// Function to add drag functionality to the iframe
	function addDragFunctionality(element) {
    let offsetX = 0, offsetY = 0, startX = 0, startY = 0;

    element.onmousedown = function(e) {
        if (e.target.id !== 'resizer') {
            e.preventDefault();
            startX = e.clientX;
            startY = e.clientY;
            document.onmousemove = onMouseMove;
            document.onmouseup = onMouseUp;
        }
    };

    function onMouseMove(e) {
        offsetX = startX - e.clientX;
        offsetY = startY - e.clientY;
        startX = e.clientX;
        startY = e.clientY;

        // Berechne neue Position
        let newLeft = element.offsetLeft - offsetX;
        let newTop = element.offsetTop - offsetY;

        // Begrenzung innerhalb des Fensters
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        // Überprüfen der Grenzen
        if (newLeft < 0) newLeft = 0;
        if (newTop < 0) newTop = 0;
        if (newLeft + element.offsetWidth > windowWidth) {
            newLeft = windowWidth - element.offsetWidth;
        }
        if (newTop + element.offsetHeight > windowHeight) {
            newTop = windowHeight - element.offsetHeight;
        }

        // Setzen der neuen Position
        element.style.left = newLeft + "px";
        element.style.top = newTop + "px";

        if (stationListContainer) {
            stationListContainer.style.left = `${element.offsetLeft}px`;
            stationListContainer.style.top = `${element.offsetTop + element.offsetHeight}px`;
        }
    }

    function onMouseUp() {
        localStorage.setItem('iframeLeft', element.style.left);
        localStorage.setItem('iframeTop', element.style.top);
        document.onmousemove = null;
        document.onmouseup = null;
    }
}


    // Function to add resize functionality to the iframe
    function addResizeFunctionality(element) {
        const resizer = document.createElement('div');
        resizer.id = 'resizer';
        resizer.classList.add('tooltip1'); // Klasse hinzufügen
        resizer.setAttribute('data-tooltip', t('plugin.livemapPlugin.resizeWindow'));
        resizer.style.width = '10px';
        resizer.style.height = '10px';
        resizer.style.background = 'var(--livemap-accent)';
        resizer.style.cursor = 'nwse-resize';
        resizer.style.position = 'absolute';
        resizer.style.right = '0';
        resizer.style.bottom = '0';
        resizer.style.zIndex = '1000';
        resizer.style.borderRadius = '0 0 15px 0';
        resizer.style.transition = 'background-color 0.3s ease';
        element.appendChild(resizer);
        
        resizer.addEventListener('mouseenter', () => {
            resizer.style.background = 'var(--livemap-hover)';
        });
        
        resizer.addEventListener('mouseleave', () => {
            resizer.style.background = 'var(--livemap-accent)';
        });

        resizer.addEventListener('mousedown', initResize);

        function initResize(e) {
            e.preventDefault();
            window.addEventListener('mousemove', resize);
            window.addEventListener('mouseup', stopResize);
        }

        function resize(e) {
            const newWidth = e.clientX - element.getBoundingClientRect().left;
            const newHeight = e.clientY - element.getBoundingClientRect().top;
            if (newWidth > 100 && newHeight > 100) {
                element.style.width = newWidth + 'px';
                element.style.height = newHeight + 'px';
                // Note: the iframe itself does not need manual width/height here —
                // it fills its container via CSS (flex-grow: 1, width/height: 100%).

                if (stationListContainer) {
                    stationListContainer.style.width = `${newWidth}px`;
                    stationListContainer.style.top = `${element.offsetTop + element.offsetHeight}px`;
                }
            }
        }

        function stopResize() {
            const newWidth = parseInt(element.style.width);
            const newHeight = parseInt(element.style.height);
            localStorage.setItem('iframeWidth', newWidth);
            localStorage.setItem('iframeHeight', newHeight);
            iframeWidth = newWidth;
            iframeHeight = newHeight;
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResize);
        }
    }

 function createButton(buttonId) {
  (function waitForFunction() {
    const maxWaitTime = 10000;
    let functionFound = false;

    const observer = new MutationObserver((mutationsList, observer) => {
      if (typeof addIconToPluginPanel === 'function') {
        observer.disconnect();
        // Create the button using addIconToPluginPanel
        addIconToPluginPanel(buttonId, t('plugin.livemap'), "solid", "map", t('plugin.showOnMap'));
        functionFound = true;

        const buttonObserver = new MutationObserver(() => {
          const $pluginButton = $(`#${buttonId}`);
          if ($pluginButton.length > 0) {
            $pluginButton.addClass("hide-phone bg-color-2");

            // Variables for long-press detection
            let isLongPress = false;
            let clickTimeout;

            // mousedown: Start the timer to detect a long press
            $pluginButton.on("mousedown", function(event) {
              isLongPress = false;
              clickTimeout = setTimeout(() => {
                isLongPress = true;
              }, 300); // 300 ms threshold for long press
            });

            // mouseup: If it wasn't a long press, toggle LiveMap
            $pluginButton.on("mouseup", function(event) {
              clearTimeout(clickTimeout);
              if (!isLongPress) {
                LiveMapActive = !LiveMapActive;
                if (LiveMapActive) {
                  // Activation: Add the "active" class
                  $pluginButton.addClass("active");
                  debugLog("LIVEMAP activated.");
                  lastPicode = '?';
                  lastFreq = '0.0';
                  lastStationId = null;
                  openOrUpdateIframe(lastPicode, lastFreq, lastStationId);
                  setTimeout(() => {
                    const storedVisibility = localStorage.getItem("stationListVisible");
                    if (stationListContainer) {
                      if (storedVisibility === "hidden") {
                        $(stationListContainer).css({ opacity: 0, visibility: "hidden" });
                      } else {
                        $(stationListContainer)
                          .css({ opacity: 1, visibility: "visible" })
                          .removeClass("fade-out").addClass("fade-in");
                      }
                    }
                  }, 200);
                } else {
                  // Deactivation: Remove the "active" class
                  $pluginButton.removeClass("active");
                  debugLog("LIVEMAP deactivated.");
                  if (iframeContainer) {
                    iframeLeft = parseInt(iframeContainer.style.left);
                    iframeTop = parseInt(iframeContainer.style.top);
                    iframeWidth = parseInt(iframeContainer.style.width);
                    iframeHeight = parseInt(iframeContainer.style.height);
                    localStorage.setItem("iframeLeft", iframeLeft);
                    localStorage.setItem("iframeTop", iframeTop);
                    localStorage.setItem("iframeWidth", iframeWidth);
                    localStorage.setItem("iframeHeight", iframeHeight);
                    $("iframe").each(function() {
                      $(this).css({ opacity: 0, transition: "opacity 0.5s" });
                    });
                    if (stationListContainer) {
                      $(stationListContainer)
                        .removeClass("fade-in").addClass("fade-out")
                        .one("animationend", function() {
                          $(stationListContainer).css({ opacity: 0, visibility: "hidden" });
                        });
                    }
                    if (iframeContainer) {
                      iframeContainer.classList.add("fade-out");
                      iframeContainer.addEventListener("animationend", function handler() {
                        document.body.removeChild(iframeContainer);
                        iframeContainer = null;
                        iframeContainer.removeEventListener("animationend", handler);
                      });
                    }
                  }
                }
              }
            });

            // mouseleave: Clear the timer if the mouse leaves the button
            $pluginButton.on("mouseleave", function() {
              clearTimeout(clickTimeout);
            });

            // Once the button is found and set up, disconnect the buttonObserver
            buttonObserver.disconnect();
          }
        });
        buttonObserver.observe(document.body, { childList: true, subtree: true });
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => {
      observer.disconnect();
      if (!functionFound) {
        console.error(`Function addIconToPluginPanel not found after ${maxWaitTime / 1000} seconds.`);
      }
    }, maxWaitTime);
  })();

  // Additional CSS adjustments for the button
  const aLivemapCss = `
    #${buttonId}:hover {
      color: var(--color-5);
      filter: brightness(120%);
    }
    #${buttonId}.active {
      background-color: var(--color-2) !important;
      filter: brightness(120%);
    }
  `;
  $("<style>")
    .prop("type", "text/css")
    .html(aLivemapCss)
    .appendTo("head");
}

// Create the button with the ID 'LIVEMAP-on-off'
createButton('LIVEMAP-on-off');


	// Function to check if the user is logged in as an administrator
    function checkAdminMode() {
        const bodyText = document.body.textContent || document.body.innerText;
        const compareText1 = t('plugin.loggedInAsAdministrator');
        const compareText2 = t('menu.loggedAsAdmin');
        const compareText3 = t('plugin.loggedInCanControlReceiver');
        isAdminLoggedIn = bodyText.includes(compareText1) || bodyText.includes(`${compareText2}.`);
        isTuneLoggedIn = bodyText.includes(compareText3);

        if (isAdminLoggedIn) {
            console.log(`Admin mode found. PSTRotator Plugin Authentication successful.`);
            isTuneAuthenticated = true;
        } else if (isTuneLoggedIn) {
            console.log(`Tune mode found. PSTRotator Plugin Authentication successful.`);
            isTuneAuthenticated = true;
        }
    }

    setupWebSocket(); // Load WebSocket
	checkAdminMode(); // Check admin mode
	receiveGPS();

	setTimeout(() => {
	// Execute the plugin version check if updateInfo is true and admin ist logged on
	if (updateInfo && isTuneAuthenticated) {
		checkplugin_version();
		}
	}, 200);
	
})();