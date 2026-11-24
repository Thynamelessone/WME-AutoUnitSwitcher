// ==UserScript==
// @name         WME Auto Unit Switcher
// @namespace    https://github.com/
// @version      1.0.0.beta-3
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

    // 64x64 inline SVG ruler icon for WME Studio's script bar
    const SCRIPT_ICON_DATA_URL = 'data:image/svg+xml;utf8,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="#0099ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="3" y="7" width="18" height="10" rx="2" fill="#0099ff" fill-opacity="0.15"/>' +
        '<path d="M7 7v4M11 7v3M15 7v4M19 7v3"/>' +
        '</svg>'
    );

    // Default Imperial Country IDs:
    // 235 = United States, 234 = United Kingdom, 182 = Puerto Rico, 88 = Guam, 236 = US Virgin Islands
    const DEFAULT_IMPERIAL_IDS = [235, 234, 182, 88, 236];

    let imperialCountryIds = new Set();
    let lastCountryId = null;

    function getDisplayName() {
        return (SCRIPT_NAME && SCRIPT_NAME.trim()) || (typeof GM_info !== 'undefined' && GM_info.script.name) || 'WME Auto Unit Switcher';
    }

    function getScriptId() {
        const clean = (SCRIPT_ID || '').trim().replace(/[^a-zA-Z0-9_-]/g, '');
        return clean.length >= 3 ? clean : 'wme-auto-unit-switcher';
    }

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
            console.error(`${getDisplayName()}: Error loading settings, using defaults.`, e);
        }
        imperialCountryIds = new Set(DEFAULT_IMPERIAL_IDS);
    }

    function saveSettings() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(imperialCountryIds)));
        } catch (e) {
            console.error(`${getDisplayName()}: Error saving settings.`, e);
        }
    }

    function bootstrap(tries = 1) {
        if (typeof W !== 'undefined' && W.map && W.model && W.prefs && W.userscripts &&
            typeof WazeWrap !== 'undefined' && WazeWrap.Ready) {
            init();
        } else if (tries < 1000) {
            setTimeout(() => bootstrap(++tries), 200);
        } else {
            console.error(`${getDisplayName()}: WazeWrap failed to load.`);
        }
    }

    function init() {
        const displayName = getDisplayName();
        const scriptId = getScriptId();

        loadSettings();
        injectStudioStyles();
        registerSidebarTab(scriptId, displayName);

        W.map.events.register('moveend', null, onMapUpdate);
        W.model.events.register('mergeend', null, onMapUpdate);

        if (updateMessage && updateMessage.trim() !== "") {
            WazeWrap.Interface.ShowScriptUpdate(
                displayName,
                typeof GM_info !== 'undefined' ? GM_info.script.version : '1.3.2',
                updateMessage,
                USERSCRIPT_URL || "https://greasyfork.org/",
                ""
            );
        }

        onMapUpdate();
        console.log(`${displayName}: Initialized.`);
    }

    // --- WME Studio Theme-Aware CSS (with full fallbacks) ---

    function injectStudioStyles() {
        if (document.getElementById('wme-aus-styles')) return;

        const style = document.createElement('style');
        style.id = 'wme-aus-styles';
        style.textContent = `
            #wme-aus-container {
                --aus-bg: var(--wme-studio-surface, var(--background_default, #ffffff));
                --aus-text: var(--wme-studio-text, var(--content_default, #202124));
                --aus-muted: var(--wme-studio-text-muted, var(--content_p2, #666666));
                --aus-border: var(--wme-studio-border, var(--hairline, #dadce0));
                --aus-input: var(--wme-studio-input, var(--background_variant, #f5f6f7));
                --aus-hover: var(--wme-studio-hover, #ebedef);
                --aus-accent: var(--wme-studio-accent, var(--primary, #0099ff));
                --aus-on-accent: var(--wme-studio-on-accent, #ffffff);
                --aus-radius: var(--wme-studio-radius, 4px);
                --aus-btn-radius: var(--wme-studio-button-radius, 4px);

                padding: 10px;
                font-family: var(--ws-font, 'Open Sans', sans-serif);
                font-size: 13px;
                color: var(--aus-text);
                background: var(--aus-bg);
                display: block;
            }

            html[data-wme-studio-theme="dark"] #wme-aus-container,
            html[data-wme-studio-theme="black"] #wme-aus-container {
                color-scheme: dark;
            }

            #wme-aus-container h4 {
                margin-top: 0;
                font-weight: 600;
                color: var(--aus-text);
            }

            .wme-aus-desc {
                color: var(--aus-muted);
                font-size: 12px;
                margin-bottom: 10px;
            }

            #wme-aus-status {
                background: var(--aus-input);
                border-left: 3px solid var(--aus-accent);
                border-radius: var(--aus-radius);
                padding: 6px 8px;
                margin-bottom: 12px;
                font-size: 12px;
                color: var(--aus-text);
            }

            .wme-aus-input-row {
                display: flex;
                gap: 6px;
                margin-bottom: 10px;
            }

            #wme-aus-add-id {
                flex: 1;
                padding: 4px 6px;
                background: var(--aus-input);
                color: var(--aus-text);
                border: 1px solid var(--aus-border);
                border-radius: var(--aus-radius);
                font-size: 12px;
            }

            #wme-aus-add-btn {
                padding: 4px 10px;
                background: var(--aus-accent);
                color: var(--aus-on-accent);
                border: none;
                border-radius: var(--aus-btn-radius);
                cursor: pointer;
                font-size: 12px;
                font-weight: 600;
            }

            .wme-aus-section-title {
                font-weight: 600;
                margin-bottom: 6px;
                font-size: 12px;
                border-bottom: 1px solid var(--aus-border);
                padding-bottom: 4px;
                color: var(--aus-text);
            }

            #wme-aus-country-list {
                max-height: 300px;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                gap: 6px;
                margin-bottom: 12px;
            }

            .wme-aus-country-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 5px 8px;
                background: var(--aus-input);
                color: var(--aus-text);
                border: 1px solid var(--aus-border);
                border-radius: var(--aus-radius);
                cursor: pointer;
                margin: 0;
                font-weight: normal;
                transition: background-color 0.15s ease;
            }

            html[data-wme-studio-motion="reduced"] .wme-aus-country-row {
                transition: none;
            }

            .wme-aus-country-row:hover {
                background: var(--aus-hover);
            }

            .wme-aus-country-id {
                color: var(--aus-muted);
            }

            .wme-aus-badge-imperial {
                font-size: 11px;
                color: #e06c75;
                font-weight: 600;
            }

            .wme-aus-badge-metric {
                font-size: 11px;
                color: #4caf50;
                font-weight: 600;
            }

            #wme-aus-reset-btn {
                width: 100%;
                padding: 6px;
                background: var(--aus-input);
                color: var(--aus-text);
                border: 1px solid var(--aus-border);
                border-radius: var(--aus-btn-radius);
                cursor: pointer;
                font-size: 12px;
            }

            #wme-aus-reset-btn:hover {
                background: var(--aus-hover);
            }

            .wme-aus-footer {
                margin-top: 8px;
                font-size: 11px;
                color: var(--aus-muted);
                text-align: right;
            }
        `;
        document.head.appendChild(style);
    }

    // --- Core Unit Switching Logic ---

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
        } else {
            updateStatusBanner(topCountry.attributes.name, shouldBeImperial);
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
            console.log(`${getDisplayName()}: Switched to ${unitLabel} for ${countryName}.`);
            updateStatusBanner(countryName, useImperial);
        } catch (err) {
            console.error(`${getDisplayName()}: Failed to switch units.`, err);
        }
    }

    // --- UI & Sidebar Registration ---

    function registerSidebarTab(scriptId, displayName) {
        try {
            const { tabLabel, tabPane } = W.userscripts.registerSidebarTab(scriptId);

            tabLabel.innerText = 'Auto Units';
            tabLabel.title = `${displayName} Settings`;
            tabLabel.dataset.scriptName = displayName;
            tabLabel.dataset.iconUrl = (typeof GM_info !== 'undefined' && GM_info.script.icon) || SCRIPT_ICON_DATA_URL;
            if (USERSCRIPT_URL) {
                tabLabel.dataset.userscriptUrl = USERSCRIPT_URL;
            }

            const version = typeof GM_info !== 'undefined' ? GM_info.script.version : '1.3.2';

            const container = document.createElement('div');
            container.id = 'wme-aus-container';
            container.innerHTML = `
                <h4>${displayName}</h4>
                <p class="wme-aus-desc">
                    Checked countries will automatically use <b>Imperial</b> units. All other countries will use <b>Metric</b>.
                </p>

                <div id="wme-aus-status">
                    Detecting country...
                </div>

                <div class="wme-aus-input-row">
                    <input type="number" id="wme-aus-add-id" placeholder="Country ID (e.g. 124)" />
                    <button id="wme-aus-add-btn" type="button">Add ID</button>
                </div>

                <div class="wme-aus-section-title">
                    Imperial Countries & Loaded Map Areas
                </div>
                <div id="wme-aus-country-list"></div>

                <button id="wme-aus-reset-btn" type="button">
                    Reset to Defaults
                </button>
                <div class="wme-aus-footer">
                    v${version}
                </div>
            `;

            tabPane.appendChild(container);

            const addBtn = container.querySelector('#wme-aus-add-btn');
            const addInput = container.querySelector('#wme-aus-add-id');
            const resetBtn = container.querySelector('#wme-aus-reset-btn');

            addBtn.addEventListener('click', () => {
                const val = parseInt(addInput.value.trim(), 10);
                if (!isNaN(val) && val > 0) {
                    imperialCountryIds.add(val);
                    saveSettings();
                    addInput.value = '';
                    refreshCountryListUI(container);
                    checkAndSetUnits(true);
                }
            });

            resetBtn.addEventListener('click', () => {
                imperialCountryIds = new Set(DEFAULT_IMPERIAL_IDS);
                saveSettings();
                refreshCountryListUI(container);
                checkAndSetUnits(true);
            });

            tabLabel.addEventListener('click', () => {
                refreshCountryListUI(container);
            });

            refreshCountryListUI(container);
            const topCountry = W.model.getTopCountry && W.model.getTopCountry();
            if (topCountry) {
                updateStatusBanner(topCountry.attributes.name, imperialCountryIds.has(topCountry.attributes.id), container);
            }
        } catch (err) {
            console.error(`${displayName}: Error registering sidebar tab.`, err);
        }
    }

    function updateStatusBanner(countryName, isImperial, root = document) {
        const statusEl = root.querySelector('#wme-aus-status');
        if (statusEl) {
            statusEl.innerHTML = `Active: <b>${countryName}</b><br>Mode: <b>${isImperial ? 'Imperial (ft/mi)' : 'Metric (m/km)'}</b>`;
        }
    }

    function refreshCountryListUI(root = document) {
        const listContainer = root.querySelector('#wme-aus-country-list');
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
            row.className = 'wme-aus-country-row';

            row.innerHTML = `
                <span style="display: flex; align-items: center; gap: 6px;">
                    <input type="checkbox" data-country-id="${id}" ${isChecked ? 'checked' : ''} style="margin: 0; cursor: pointer;" />
                    <span>${name} <small class="wme-aus-country-id">(${id})</small></span>
                </span>
                <span class="${isChecked ? 'wme-aus-badge-imperial' : 'wme-aus-badge-metric'}">
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
                refreshCountryListUI(root);
                checkAndSetUnits(true);
            });

            listContainer.appendChild(row);
        });
    }

    bootstrap();
})();