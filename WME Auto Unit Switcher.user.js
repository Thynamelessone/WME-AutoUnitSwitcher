// ==UserScript==
// @name         WME Auto Unit Switcher
// @namespace    https://github.com/
// @version      1.0.0.beta-1
// @description  Automatically switches WME units between Metric and Imperial.
// @author       Thynamelessone
// @match        https://www.waze.com/*editor*
// @match        https://beta.waze.com/*editor*
// @exclude      https://www.waze.com/*user/*editor/*
// @grant        none
// @require      https://greasyfork.org/scripts/24851-wazewrap/code/WazeWrap.js
// @downloadURL  
// @updateURL    
// ==/UserScript==

(function () {
    'use strict';

    const SCRIPT_ID = "WME AUS";
    const SCRIPT_NAME = "WME Auto Unit Switcher";
    const updateMessage = "";

    const STORAGE_KEY = 'wme_auto_unit_switcher_imperial_ids';

    // Default Imperial Country IDs:
    // 235 = United States, 234 = United Kingdom, 182 = Puerto Rico, 88 = Guam, 236 = US Virgin Islands
    const DEFAULT_IMPERIAL_IDS = [235, 234, 182, 88, 236];

    let imperialCountryIds = new Set();
    let lastCountryId = null;

    function loadSettings() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    imperialCountryIds = new Set(parsed);
                    return;
                }
            }
        } catch (e) {
            console.error(`${SCRIPT_NAME || 'WME Auto Unit Switcher'}: Error loading settings, using defaults.`, e);
        }
        imperialCountryIds = new Set(DEFAULT_IMPERIAL_IDS);
    }

    function saveSettings() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(imperialCountryIds)));
        } catch (e) {
            console.error(`${SCRIPT_NAME || 'WME Auto Unit Switcher'}: Error saving settings.`, e);
        }
    }

    function bootstrap(tries = 1) {
        if (typeof W !== 'undefined' && W.map && W.model && W.prefs && W.userscripts &&
            typeof WazeWrap !== 'undefined' && WazeWrap.Ready) {
            init();
        } else if (tries < 1000) {
            setTimeout(() => bootstrap(++tries), 200);
        } else {
            console.error(`${SCRIPT_NAME || 'WME Auto Unit Switcher'}: WazeWrap failed to load.`);
        }
    }

    function init() {
        const displayName = SCRIPT_NAME || GM_info.script.name;
        const scriptId = SCRIPT_ID || 'wme-auto-unit-switcher';

        loadSettings();
        registerSidebarTab(scriptId, displayName);

        W.map.events.register('moveend', null, onMapUpdate);
        W.model.events.register('mergeend', null, onMapUpdate);

        // Show WazeWrap update notification if updateMessage is populated
        if (updateMessage && updateMessage.trim() !== "") {
            WazeWrap.Interface.ShowScriptUpdate(
                displayName,
                GM_info.script.version,
                updateMessage,
                "https://greasyfork.org/", // Optional: Replace with your GreasyFork script URL
                ""                         // Optional: Replace with your Waze forum thread URL
            );
        }

        onMapUpdate();
        console.log(`${displayName}: Initialized with WazeWrap.`);
    }

    function onMapUpdate() {
        checkAndSetUnits();
        refreshCountryListUI();
    }

    function checkAndSetUnits(force = false) {
        if (!W.model.countries || !W.model.getTopCountry) return;

        const topCountry = W.model.getTopCountry();
        if (!topCountry) return;

        const countryId = topCountry.attributes.id;

        if (!force && countryId === lastCountryId) return;
        lastCountryId = countryId;

        const shouldBeImperial = imperialCountryIds.has(countryId);
        const isCurrentlyImperial = W.prefs.get('isImperial');

        if (shouldBeImperial !== isCurrentlyImperial) {
            setWMEUnits(shouldBeImperial, topCountry.attributes.name);
        }
    }

    function setWMEUnits(useImperial, countryName) {
        try {
            W.prefs.set('isImperial', useImperial);

            const targetId = useImperial ? 'prefs-unit-imperial' : 'prefs-unit-metric';
            const radioBtn = document.getElementById(targetId);
            if (radioBtn && !radioBtn.checked) {
                radioBtn.click();
            }

            const unitLabel = useImperial ? 'Imperial (ft/mi)' : 'Metric (m/km)';
            console.log(`${SCRIPT_NAME || 'WME Auto Unit Switcher'}: Switched to ${unitLabel} for ${countryName}.`);
            updateStatusBanner(countryName, useImperial);
        } catch (err) {
            console.error(`${SCRIPT_NAME || 'WME Auto Unit Switcher'}: Failed to switch units.`, err);
        }
    }

    // --- UI & Sidebar Registration ---

    async function registerSidebarTab(scriptId, displayName) {
        try {
            const { tabLabel, tabPane } = W.userscripts.registerSidebarTab(scriptId);

            tabLabel.innerText = 'Auto Units';
            tabLabel.title = `${displayName} Settings`;

            tabPane.innerHTML = `
                <div id="wme-aus-container" style="padding: 10px; font-family: 'Open Sans', sans-serif; font-size: 13px;">
                    <h4 style="margin-top: 0; font-weight: 600;">${displayName}</h4>
                    <p style="color: #666; font-size: 12px; margin-bottom: 10px;">
                        Checked countries will automatically use <b>Imperial</b> units. All other countries will use <b>Metric</b>.
                    </p>

                    <div id="wme-aus-status" style="background: #f0f4f8; border-left: 3px solid #0099ff; padding: 6px 8px; margin-bottom: 12px; font-size: 12px;">
                        Detecting country...
                    </div>

                    <div style="display: flex; gap: 6px; margin-bottom: 10px;">
                        <input type="number" id="wme-aus-add-id" placeholder="Country ID (e.g. 124)" style="flex: 1; padding: 4px 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 12px;" />
                        <button id="wme-aus-add-btn" style="padding: 4px 10px; background: #0099ff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">Add ID</button>
                    </div>

                    <div style="font-weight: 600; margin-bottom: 6px; font-size: 12px; border-bottom: 1px solid #ddd; padding-bottom: 4px;">
                        Imperial Countries & Loaded Map Areas
                    </div>
                    <div id="wme-aus-country-list" style="max-height: 300px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px;">
                    </div>

                    <button id="wme-aus-reset-btn" style="width: 100%; padding: 6px; background: #e0e0e0; color: #333; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
                        Reset to Defaults
                    </button>
                    <div style="margin-top: 8px; font-size: 11px; color: #999; text-align: right;">
                        v${GM_info.script.version}
                    </div>
                </div>
            `;

            await W.userscripts.waitForElementConnected(tabPane);

            document.getElementById('wme-aus-add-btn').addEventListener('click', () => {
                const input = document.getElementById('wme-aus-add-id');
                const val = parseInt(input.value.trim(), 10);
                if (!isNaN(val) && val > 0) {
                    imperialCountryIds.add(val);
                    saveSettings();
                    input.value = '';
                    refreshCountryListUI();
                    checkAndSetUnits(true);
                }
            });

            document.getElementById('wme-aus-reset-btn').addEventListener('click', () => {
                imperialCountryIds = new Set(DEFAULT_IMPERIAL_IDS);
                saveSettings();
                refreshCountryListUI();
                checkAndSetUnits(true);
            });

            refreshCountryListUI();
            const topCountry = W.model.getTopCountry();
            if (topCountry) {
                updateStatusBanner(topCountry.attributes.name, imperialCountryIds.has(topCountry.attributes.id));
            }
        } catch (err) {
            console.error(`${displayName}: Error registering sidebar tab.`, err);
        }
    }

    function updateStatusBanner(countryName, isImperial) {
        const statusEl = document.getElementById('wme-aus-status');
        if (statusEl) {
            statusEl.innerHTML = `Active: <b>${countryName}</b><br>Mode: <b>${isImperial ? 'Imperial (ft/mi)' : 'Metric (m/km)'}</b>`;
        }
    }

    function refreshCountryListUI() {
        const listContainer = document.getElementById('wme-aus-country-list');
        if (!listContainer || !W.model || !W.model.countries) return;

        const knownCountries = new Map();

        const modelObjects = W.model.countries.getObjectArray ? W.model.countries.getObjectArray() : Object.values(W.model.countries.objects || {});
        modelObjects.forEach(c => {
            if (c && c.attributes) {
                knownCountries.set(c.attributes.id, c.attributes.name);
            }
        });

        const fallbackNames = {
            235: 'United States',
            234: 'United Kingdom',
            182: 'Puerto Rico',
            88: 'Guam',
            236: 'U.S. Virgin Islands'
        };

        imperialCountryIds.forEach(id => {
            if (!knownCountries.has(id)) {
                knownCountries.set(id, fallbackNames[id] || `Country ID: ${id}`);
            }
        });

        const sortedEntries = Array.from(knownCountries.entries()).sort((a, b) => a[1].localeCompare(b[1]));

        listContainer.innerHTML = '';
        sortedEntries.forEach(([id, name]) => {
            const isChecked = imperialCountryIds.has(id);
            const row = document.createElement('label');
            row.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 4px 6px; background: #fafafa; border: 1px solid #eee; border-radius: 4px; cursor: pointer; margin: 0; font-weight: normal;';

            row.innerHTML = `
                <span style="display: flex; align-items: center; gap: 6px;">
                    <input type="checkbox" data-country-id="${id}" ${isChecked ? 'checked' : ''} style="margin: 0; cursor: pointer;" />
                    <span>${name} <small style="color: #888;">(${id})</small></span>
                </span>
                <span style="font-size: 11px; color: ${isChecked ? '#d9534f' : '#5cb85c'}; font-weight: 600;">
                    ${isChecked ? 'Imperial' : 'Metric'}
                </span>
            `;

            const checkbox = row.querySelector('input');
            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    imperialCountryIds.add(id);
                } else {
                    imperialCountryIds.delete(id);
                }
                saveSettings();
                refreshCountryListUI();
                checkAndSetUnits(true);
            });

            listContainer.appendChild(row);
        });
    }

    bootstrap();
})();