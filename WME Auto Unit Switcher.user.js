// ==UserScript==
// @name         WME Auto Unit Switcher
// @namespace    https://github.com/
// @version      1.0.0.beta-10
// @description  Automatically switches WME units between Metric and Imperial.
// @author       Thynamelessone
// @match        https://www.waze.com/*editor*
// @match        https://beta.waze.com/*editor*
// @exclude      https://www.waze.com/*user/*editor/*
// @grant        none
// @require      https://greasyfork.org/scripts/24851-wazewrap/code/WazeWrap.js
// @downloadURL  https://github.com/Thynamelessone/WME-AutoUnitSwitcher/raw/refs/heads/beta/WME%20Auto%20Unit%20Switcher.user.js
// @updateURL    https://github.com/Thynamelessone/WME-AutoUnitSwitcher/raw/refs/heads/beta/WME%20Auto%20Unit%20Switcher.user.js
// ==/UserScript==

/* global getWmeSdk, WazeWrap, GM_info */

(function () {
    'use strict';

    const SCRIPT_ID = "WME AUS";
    const SCRIPT_NAME = "WME Auto Unit Switcher";
    const updateMessage = "";
    const USERSCRIPT_URL = "";

    const STORAGE_KEY = 'wme_auto_unit_switcher_country_rules_v2';
    const COUNTRY_NAMES_STORAGE_KEY = 'wme_auto_unit_switcher_country_names';
    const GLOBAL_MULTI_UNIT_KEY = 'wme_auto_unit_switcher_global_multi_unit';
    const LEGACY_V1_STORAGE_KEY = 'wme_auto_unit_switcher_country_rules';
    const LEGACY_UK_HYBRID_KEY = 'wme_auto_unit_switcher_uk_hybrid';

    // 64x64 inline SVG ruler icon for WME Studio's script bar
    const SCRIPT_ICON_DATA_URL = 'data:image/svg+xml;utf8,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="#0099ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="3" y="7" width="18" height="10" rx="2" fill="#0099ff" fill-opacity="0.15"/>' +
        '<path d="M7 7v4M11 7v3M15 7v4M19 7v3"/>' +
        '</svg>'
    );

    // Default Country Rules: { unit: 'imperial' | 'metric', multiUnit: boolean }
    const DEFAULT_COUNTRY_RULES = {
        235: { unit: 'imperial', multiUnit: false }, // United States
        234: { unit: 'imperial', multiUnit: true },  // United Kingdom (ft + yd/m)
        182: { unit: 'imperial', multiUnit: false }, // Puerto Rico
        88:  { unit: 'imperial', multiUnit: false }, // Guam
        236: { unit: 'imperial', multiUnit: false }  // U.S. Virgin Islands
    };

    const FALLBACK_NAMES = {
        235: 'United States',
        234: 'United Kingdom',
        182: 'Puerto Rico',
        88: 'Guam',
        236: 'U.S. Virgin Islands'
    };

    let sdk = null;
    // Map<number, { unit: 'imperial' | 'metric', multiUnit: boolean }>
    let countryRules = new Map();
    // Map<number, string>
    let cachedCountryNames = new Map();
    let globalMultiUnit = false;
    let lastCountryId = null;
    let activeCountryId = null;
    let multiUnitObserver = null;
    let scanScheduled = false;

    function getDisplayName() {
        return (SCRIPT_NAME && SCRIPT_NAME.trim()) || (typeof GM_info !== 'undefined' && GM_info.script.name) || 'WME Auto Unit Switcher';
    }

    function getScriptId() {
        const clean = (SCRIPT_ID || '').trim().replace(/[^a-zA-Z0-9_-]/g, '-');
        return clean.length >= 3 ? clean : 'wme-auto-unit-switcher';
    }

    function loadSettings() {
        // Load cached country names first
        cachedCountryNames = new Map(
            Object.entries(FALLBACK_NAMES).map(([id, name]) => [parseInt(id, 10), name])
        );
        try {
            const savedNames = localStorage.getItem(COUNTRY_NAMES_STORAGE_KEY);
            if (savedNames) {
                const parsedNames = JSON.parse(savedNames);
                if (parsedNames && typeof parsedNames === 'object') {
                    Object.entries(parsedNames).forEach(([idStr, name]) => {
                        const id = parseInt(idStr, 10);
                        if (!isNaN(id) && typeof name === 'string' && name.trim()) {
                            cachedCountryNames.set(id, name.trim());
                        }
                    });
                }
            }
        } catch (e) {
            console.error(`${getDisplayName()}: Error loading cached country names.`, e);
        }

        try {
            const globalSaved = localStorage.getItem(GLOBAL_MULTI_UNIT_KEY);
            if (globalSaved !== null) {
                globalMultiUnit = globalSaved === 'true';
            }
        } catch (e) {
            console.error(`${getDisplayName()}: Error loading global multi-unit setting.`, e);
        }

        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                    const map = new Map();
                    Object.entries(parsed).forEach(([idStr, cfg]) => {
                        const id = parseInt(idStr, 10);
                        if (!isNaN(id) && cfg && (cfg.unit === 'imperial' || cfg.unit === 'metric')) {
                            map.set(id, {
                                unit: cfg.unit,
                                multiUnit: Boolean(cfg.multiUnit)
                            });
                            if (typeof cfg.name === 'string' && cfg.name.trim()) {
                                cachedCountryNames.set(id, cfg.name.trim());
                            }
                        }
                    });
                    countryRules = map;
                    return;
                }
            }

            // Migrate legacy v1 rules if present
            const legacySaved = localStorage.getItem(LEGACY_V1_STORAGE_KEY);
            if (legacySaved) {
                const legacyParsed = JSON.parse(legacySaved);
                const legacyUk = localStorage.getItem(LEGACY_UK_HYBRID_KEY);
                const ukEnabled = legacyUk !== null ? legacyUk === 'true' : true;

                if (legacyParsed && typeof legacyParsed === 'object') {
                    const map = new Map();
                    Object.entries(legacyParsed).forEach(([idStr, unit]) => {
                        const id = parseInt(idStr, 10);
                        if (!isNaN(id) && (unit === 'imperial' || unit === 'metric')) {
                            map.set(id, {
                                unit,
                                multiUnit: id === 234 ? ukEnabled : false
                            });
                        }
                    });
                    countryRules = map;
                    saveSettings();
                    return;
                }
            }
        } catch (e) {
            console.error(`${getDisplayName()}: Error loading settings, using defaults.`, e);
        }

        countryRules = new Map(
            Object.entries(DEFAULT_COUNTRY_RULES).map(([id, cfg]) => [parseInt(id, 10), { ...cfg }])
        );
    }

    function saveSettings() {
        try {
            const obj = {};
            countryRules.forEach((cfg, id) => {
                const knownName = cachedCountryNames.get(id);
                obj[id] = {
                    unit: cfg.unit,
                    multiUnit: Boolean(cfg.multiUnit),
                    ...(knownName ? { name: knownName } : {})
                };
            });
            localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
            localStorage.setItem(GLOBAL_MULTI_UNIT_KEY, String(globalMultiUnit));
            saveCountryNamesCache();
        } catch (e) {
            console.error(`${getDisplayName()}: Error saving settings.`, e);
        }
    }

    function saveCountryNamesCache() {
        try {
            const namesObj = {};
            cachedCountryNames.forEach((name, id) => {
                namesObj[id] = name;
            });
            localStorage.setItem(COUNTRY_NAMES_STORAGE_KEY, JSON.stringify(namesObj));
        } catch (e) {
            console.error(`${getDisplayName()}: Error saving country names cache.`, e);
        }
    }

    function cacheLoadedCountryNames() {
        if (!sdk) return false;
        let updated = false;

        const topCountry = sdk.DataModel.Countries.getTopCountry();
        if (topCountry && typeof topCountry.id === 'number' && topCountry.name) {
            if (cachedCountryNames.get(topCountry.id) !== topCountry.name) {
                cachedCountryNames.set(topCountry.id, topCountry.name);
                updated = true;
            }
        }

        const loadedCountries = sdk.DataModel.Countries.getAll() || [];
        loadedCountries.forEach(c => {
            if (c && typeof c.id === 'number' && c.name) {
                if (cachedCountryNames.get(c.id) !== c.name) {
                    cachedCountryNames.set(c.id, c.name);
                    updated = true;
                }
            }
        });

        if (updated) {
            saveCountryNamesCache();
        }
        return updated;
    }

    function getCountryName(countryId) {
        return cachedCountryNames.get(countryId) || FALLBACK_NAMES[countryId] || `Country ID: ${countryId}`;
    }

    function getRuleForCountry(countryId) {
        return countryRules.get(countryId) || { unit: 'metric', multiUnit: false };
    }

    function isMultiUnitActiveForCurrentCountry() {
        if (globalMultiUnit) return true;
        if (activeCountryId == null) return false;
        return Boolean(getRuleForCountry(activeCountryId).multiUnit);
    }

    // --- SDK & WazeWrap Bootstrap ---

    async function bootstrap() {
        try {
            if (window.SDK_INITIALIZED) {
                await window.SDK_INITIALIZED;
            } else {
                await new Promise((resolve) => {
                    if (typeof getWmeSdk === 'function') return resolve();
                    window.addEventListener('wme-initialized', resolve, { once: true });
                });
            }

            sdk = getWmeSdk({
                scriptId: getScriptId(),
                scriptName: getDisplayName()
            });

            if (!sdk.State || !sdk.State.isReady()) {
                await sdk.Events.once({ eventName: 'wme-ready' });
            }

            waitForWazeWrap();
        } catch (err) {
            console.error(`${getDisplayName()}: Failed to initialize WME SDK.`, err);
        }
    }

    function waitForWazeWrap(tries = 1) {
        if (typeof WazeWrap !== 'undefined' && WazeWrap.Ready) {
            init(true);
        } else if (tries < 50) {
            setTimeout(() => waitForWazeWrap(++tries), 200);
        } else {
            console.warn(`${getDisplayName()}: WazeWrap did not load in time, continuing with SDK only.`);
            init(false);
        }
    }

    async function init(hasWazeWrap = true) {
        const displayName = getDisplayName();

        loadSettings();
        injectStudioStyles();
        await registerSidebarTab(displayName);
        setupMultiUnitObserver();

        sdk.Events.on({ eventName: 'wme-map-move-end', eventHandler: onMapUpdate });
        sdk.Events.on({ eventName: 'wme-map-data-loaded', eventHandler: onMapUpdate });

        if (hasWazeWrap && updateMessage && updateMessage.trim() !== "") {
            WazeWrap.Interface.ShowScriptUpdate(
                displayName,
                typeof GM_info !== 'undefined' ? GM_info.script.version : '1.0.0.beta-9',
                updateMessage,
                USERSCRIPT_URL || "https://github.com/Thynamelessone/WME-AutoUnitSwitcher",
                ""
            );
        }

        onMapUpdate();
        console.log(`${displayName}: Initialized with WME SDK.`);
    }

    // --- Multi-Unit Conversion & Measure Tool DOM Helper ---

    function formatNumber(val) {
        return val >= 100
            ? Math.round(val).toLocaleString()
            : val.toFixed(1).replace(/\.0$/, '');
    }

    function formatConversionFromFeet(feetValue) {
        const yards = feetValue / 3;
        const meters = feetValue * 0.3048;
        return `(${formatNumber(yards)} yd / ${formatNumber(meters)} m)`;
    }

    function formatConversionFromMeters(metersValue) {
        const yards = metersValue / 0.9144;
        const feet = metersValue / 0.3048;
        return `(${formatNumber(yards)} yd / ${formatNumber(feet)} ft)`;
    }

    function setupMultiUnitObserver() {
        if (multiUnitObserver) return;

        multiUnitObserver = new MutationObserver(() => {
            if (!isMultiUnitActiveForCurrentCountry()) return;
            if (scanScheduled) return;

            scanScheduled = true;
            requestAnimationFrame(() => {
                scanScheduled = false;
                updateMultiUnitNodes();
            });
        });

        multiUnitObserver.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });
    }

    function clearMultiUnitNodes() {
        document.querySelectorAll('.wme-aus-extra-unit').forEach(el => el.remove());
        document.querySelectorAll('[data-wme-aus-val]').forEach(el => {
            delete el.dataset.wmeAusVal;
        });
    }

    function updateMultiUnitNodes() {
        if (!isMultiUnitActiveForCurrentCountry()) {
            clearMultiUnitNodes();
            return;
        }

        const elements = new Set();

        const candidateSelectors = [
            '.ol-scale-line-inner',
            '.wm-scale-bar',
            '[class*="scale"] [class*="label"]',
            '#edit-panel .length',
            '#edit-panel [class*="length"]',
            '#edit-panel [class*="distance"]',
            '#segment-edit-general .length',
            '.segment-length',
            '.waze-control-scale-line-inner',
            '[class*="measure"] [class*="label"]',
            '[class*="measure"] [class*="tooltip"]',
            '[class*="measure"] span',
            '[class*="measure"] div',
            '.ol-tooltip',
            '.ol-tooltip-measure',
            '.ol-overlay-container span',
            '.ol-overlay-container div'
        ];

        candidateSelectors.forEach(sel => {
            document.querySelectorAll(sel).forEach(el => elements.add(el));
        });

        const scanRoots = [
            document.getElementById('edit-panel'),
            document.getElementById('map')
        ].filter(Boolean);

        scanRoots.forEach(root => {
            const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
            let node;
            while ((node = walker.nextNode())) {
                const parent = node.parentElement;
                if (!parent || parent.closest('#wme-aus-container') || parent.classList.contains('wme-aus-extra-unit')) continue;
                if (parent.tagName === 'INPUT' || parent.tagName === 'TEXTAREA' || parent.tagName === 'SELECT' || parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE') continue;

                const txt = node.nodeValue ? node.nodeValue.trim() : '';
                if (/^\d[\d,.]*\s*(ft|feet|m|meters?|metres?)\b/i.test(txt)) {
                    elements.add(parent);
                }
            }
        });

        elements.forEach(el => {
            if (el.closest('#wme-aus-container')) return;
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return;

            if (el.children.length > 1 || (el.children.length === 1 && !el.children[0].classList.contains('wme-aus-extra-unit'))) {
                return;
            }

            let rawText = '';
            el.childNodes.forEach(child => {
                if (child.nodeType === Node.TEXT_NODE) {
                    rawText += child.nodeValue;
                } else if (child.nodeType === Node.ELEMENT_NODE && !child.classList.contains('wme-aus-extra-unit')) {
                    rawText += child.textContent;
                }
            });

            const match = rawText.trim().match(/^(\d[\d,]*\.?\d*)\s*(ft|feet|m|meters?|metres?)\b/i);
            if (!match) {
                const existing = el.querySelector('.wme-aus-extra-unit');
                if (existing) existing.remove();
                delete el.dataset.wmeAusVal;
                return;
            }

            const numericVal = parseFloat(match[1].replace(/,/g, ''));
            const unitToken = match[2].toLowerCase();

            if (isNaN(numericVal) || numericVal <= 0) return;

            const isFeet = unitToken === 'ft' || unitToken === 'feet';
            const stateKey = `${isFeet ? 'ft' : 'm'}:${numericVal}`;

            let badge = el.querySelector('.wme-aus-extra-unit');
            if (el.dataset.wmeAusVal === stateKey && badge) return;
            el.dataset.wmeAusVal = stateKey;

            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'wme-aus-extra-unit';
                el.appendChild(badge);
            }

            badge.textContent = ` ${isFeet ? formatConversionFromFeet(numericVal) : formatConversionFromMeters(numericVal)}`;
        });
    }

    // --- WME Studio Theme-Aware CSS (with full fallbacks) ---

    function injectStudioStyles() {
        if (document.getElementById('wme-aus-styles')) return;

        const style = document.createElement('style');
        style.id = 'wme-aus-styles';
        style.textContent = `
            .wme-aus-extra-unit {
                font-size: 0.9em;
                opacity: 0.88;
                font-weight: 500;
                white-space: nowrap;
            }

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
                display: block !important;
                visibility: visible !important;
                opacity: 1 !important;
                width: 100%;
                box-sizing: border-box;
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

            .wme-aus-option-box {
                display: flex;
                align-items: flex-start;
                gap: 8px;
                padding: 6px 8px;
                margin-bottom: 12px;
                background: var(--aus-input);
                border: 1px solid var(--aus-border);
                border-radius: var(--aus-radius);
                font-size: 12px;
                cursor: pointer;
            }

            .wme-aus-option-box input {
                margin-top: 2px;
                cursor: pointer;
            }

            .wme-aus-input-row {
                display: flex;
                gap: 5px;
                margin-bottom: 10px;
            }

            #wme-aus-add-id {
                flex: 1;
                min-width: 0;
                padding: 4px 6px;
                background: var(--aus-input);
                color: var(--aus-text);
                border: 1px solid var(--aus-border);
                border-radius: var(--aus-radius);
                font-size: 12px;
            }

            #wme-aus-add-unit {
                padding: 4px 6px;
                background: var(--aus-input);
                color: var(--aus-text);
                border: 1px solid var(--aus-border);
                border-radius: var(--aus-radius);
                font-size: 12px;
                cursor: pointer;
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
                white-space: nowrap;
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
                gap: 6px;
                padding: 5px 8px;
                background: var(--aus-input);
                color: var(--aus-text);
                border: 1px solid var(--aus-border);
                border-radius: var(--aus-radius);
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

            .wme-aus-country-info {
                flex: 1;
                min-width: 0;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .wme-aus-country-id {
                color: var(--aus-muted);
            }

            .wme-aus-row-controls {
                display: flex;
                align-items: center;
                gap: 5px;
                flex-shrink: 0;
            }

            .wme-aus-unit-select {
                padding: 2px 4px;
                background: var(--aus-bg);
                color: var(--aus-text);
                border: 1px solid var(--aus-border);
                border-radius: var(--aus-radius);
                font-size: 11px;
                font-weight: 600;
                cursor: pointer;
            }

            .wme-aus-unit-select.is-imperial {
                color: #e06c75;
            }

            .wme-aus-unit-select.is-metric {
                color: #4caf50;
            }

            .wme-aus-multi-toggle {
                display: inline-flex;
                align-items: center;
                gap: 3px;
                padding: 2px 5px;
                background: var(--aus-bg);
                border: 1px solid var(--aus-border);
                border-radius: var(--aus-radius);
                font-size: 10px;
                color: var(--aus-muted);
                cursor: pointer;
                margin: 0;
                user-select: none;
            }

            .wme-aus-multi-toggle input {
                margin: 0;
                cursor: pointer;
            }

            .wme-aus-multi-toggle.is-active {
                color: var(--aus-accent);
                border-color: var(--aus-accent);
                font-weight: 600;
            }

            .wme-aus-remove-btn {
                padding: 1px 5px;
                background: transparent;
                color: var(--aus-muted);
                border: 1px solid transparent;
                border-radius: var(--aus-radius);
                cursor: pointer;
                font-size: 12px;
                line-height: 1.4;
            }

            .wme-aus-remove-btn:hover {
                color: #e06c75;
                border-color: var(--aus-border);
                background: var(--aus-bg);
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

    // --- Core Unit Switching Logic (SDK) ---

    function onMapUpdate() {
        cacheLoadedCountryNames();
        checkAndSetUnits();
        refreshCountryListUI();
        updateMultiUnitNodes();
    }

    function checkAndSetUnits(force = false) {
        if (!sdk) return;

        const topCountry = sdk.DataModel.Countries.getTopCountry();
        if (!topCountry) return;

        const countryId = topCountry.id;
        activeCountryId = countryId;

        if (!isMultiUnitActiveForCurrentCountry()) {
            clearMultiUnitNodes();
        }

        if (!force && countryId === lastCountryId) return;
        lastCountryId = countryId;

        const rule = getRuleForCountry(countryId);
        const shouldBeImperial = rule.unit === 'imperial';
        const prefs = sdk.Settings.getUserSettings();
        const isCurrentlyImperial = Boolean(prefs && prefs.isImperial);

        if (shouldBeImperial !== isCurrentlyImperial) {
            setWMEUnits(shouldBeImperial, topCountry.name);
        } else {
            updateStatusBanner(topCountry.name, shouldBeImperial);
        }
    }

    function setWMEUnits(useImperial, countryName) {
        try {
            sdk.Settings.setUserSettings({ isImperial: useImperial });

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

    // --- UI & Sidebar Registration (SDK) ---

    function buildUIElement(displayName) {
        const version = typeof GM_info !== 'undefined' ? GM_info.script.version : '1.0.0.beta-9';

        const container = document.createElement('div');
        container.id = 'wme-aus-container';
        container.innerHTML = `
            <h4>${displayName}</h4>
            <p class="wme-aus-desc">
                Configure <b>Imperial</b> or <b>Metric</b> units per country. Unlisted countries default to <b>Metric</b>.
            </p>

            <div id="wme-aus-status">
                Detecting country...
            </div>

            <label class="wme-aus-option-box">
                <input type="checkbox" id="wme-aus-global-multi-chk" ${globalMultiUnit ? 'checked' : ''} />
                <span>
                    <b>Show Multiple Units Globally</b><br>
                    <small style="color: var(--aus-muted);">Show <code>(yd / m)</code> or <code>(yd / ft)</code> in all countries and hide per-country toggles.</small>
                </span>
            </label>

            <div class="wme-aus-input-row">
                <input type="number" id="wme-aus-add-id" placeholder="Country ID (e.g. 124)" />
                <select id="wme-aus-add-unit" title="Unit system for this country">
                    <option value="imperial">Imperial</option>
                    <option value="metric">Metric</option>
                </select>
                <button id="wme-aus-add-btn" type="button">Add</button>
            </div>

            <div class="wme-aus-section-title">
                Configured & Loaded Map Countries
            </div>
            <div id="wme-aus-country-list"></div>

            <button id="wme-aus-reset-btn" type="button">
                Reset to Defaults
            </button>
            <div class="wme-aus-footer">
                v${version}
            </div>
        `;

        const globalMultiChk = container.querySelector('#wme-aus-global-multi-chk');
        const addBtn = container.querySelector('#wme-aus-add-btn');
        const addInput = container.querySelector('#wme-aus-add-id');
        const addUnitSelect = container.querySelector('#wme-aus-add-unit');
        const resetBtn = container.querySelector('#wme-aus-reset-btn');

        globalMultiChk.addEventListener('change', (e) => {
            globalMultiUnit = e.target.checked;
            saveSettings();
            refreshCountryListUI(container);
            if (isMultiUnitActiveForCurrentCountry()) {
                updateMultiUnitNodes();
            } else {
                clearMultiUnitNodes();
            }
        });

        const handleAddCountry = () => {
            const val = parseInt(addInput.value.trim(), 10);
            const selectedUnit = addUnitSelect.value === 'imperial' ? 'imperial' : 'metric';
            if (!isNaN(val) && val > 0) {
                cacheLoadedCountryNames();
                const existing = countryRules.get(val);
                countryRules.set(val, {
                    unit: selectedUnit,
                    multiUnit: existing ? existing.multiUnit : false
                });
                saveSettings();
                addInput.value = '';
                refreshCountryListUI(container);
                checkAndSetUnits(true);
            }
        };

        addBtn.addEventListener('click', handleAddCountry);
        addInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleAddCountry();
        });

        resetBtn.addEventListener('click', () => {
            countryRules = new Map(
                Object.entries(DEFAULT_COUNTRY_RULES).map(([id, cfg]) => [parseInt(id, 10), { ...cfg }])
            );
            globalMultiUnit = false;
            globalMultiChk.checked = false;
            saveSettings();
            refreshCountryListUI(container);
            checkAndSetUnits(true);
            if (isMultiUnitActiveForCurrentCountry()) {
                updateMultiUnitNodes();
            } else {
                clearMultiUnitNodes();
            }
        });

        refreshCountryListUI(container);
        const topCountry = sdk.DataModel.Countries.getTopCountry();
        if (topCountry) {
            const isImp = getRuleForCountry(topCountry.id).unit === 'imperial';
            updateStatusBanner(topCountry.name, isImp, container);
        }

        return container;
    }

    async function registerSidebarTab(displayName) {
        try {
            const { tabLabel, tabPane } = await sdk.Sidebar.registerScriptTab();

            tabLabel.innerText = 'Auto Units';
            tabLabel.title = `${displayName} Settings`;
            tabLabel.dataset.scriptName = displayName;
            tabLabel.dataset.iconUrl = (typeof GM_info !== 'undefined' && GM_info.script.icon) || SCRIPT_ICON_DATA_URL;
            if (USERSCRIPT_URL) {
                tabLabel.dataset.userscriptUrl = USERSCRIPT_URL;
            }

            const mount = () => {
                if (!tabPane) return;
                if (!tabPane.querySelector('#wme-aus-container')) {
                    tabPane.appendChild(buildUIElement(displayName));
                }
            };

            mount();

            const observer = new MutationObserver(mount);
            observer.observe(document.body, { childList: true, subtree: true });

            tabLabel.addEventListener('click', () => {
                mount();
                cacheLoadedCountryNames();
                refreshCountryListUI(tabPane);
            });
        } catch (err) {
            console.error(`${displayName}: Error registering SDK sidebar tab:`, err);
        }
    }

    function updateStatusBanner(countryName, isImperial, root = document) {
        const statusEl = root.querySelector('#wme-aus-status');
        if (statusEl) {
            const multiLabel = isMultiUnitActiveForCurrentCountry()
                ? (isImperial ? ' + yd/m' : ' + yd/ft')
                : '';
            statusEl.innerHTML = `Active: <b>${countryName}</b><br>Mode: <b>${isImperial ? 'Imperial (ft/mi)' : 'Metric (m/km)'}${multiLabel}</b>`;
        }
    }

    function refreshCountryListUI(root = document) {
        const listContainer = root.querySelector('#wme-aus-country-list');
        if (!listContainer || !sdk) return;

        cacheLoadedCountryNames();

        const knownCountries = new Map();

        // Include all countries currently loaded in WME
        const loadedCountries = sdk.DataModel.Countries.getAll() || [];
        loadedCountries.forEach(c => {
            if (c && typeof c.id === 'number') {
                knownCountries.set(c.id, getCountryName(c.id));
            }
        });

        // Include all configured countries with their persisted names
        countryRules.forEach((cfg, id) => {
            if (!knownCountries.has(id)) {
                knownCountries.set(id, getCountryName(id));
            }
        });

        const sortedEntries = Array.from(knownCountries.entries()).sort((a, b) => a[1].localeCompare(b[1]));

        listContainer.innerHTML = '';
        sortedEntries.forEach(([id, name]) => {
            const rule = getRuleForCountry(id);
            const currentUnit = rule.unit;
            const isMulti = Boolean(rule.multiUnit);
            const hasExplicitRule = countryRules.has(id);
            const multiToggleLabel = currentUnit === 'imperial' ? '+yd/m' : '+yd/ft';
            const multiToggleTitle = currentUnit === 'imperial'
                ? 'Show Yards & Meters next to Feet'
                : 'Show Yards & Feet next to Meters';

            const row = document.createElement('div');
            row.className = 'wme-aus-country-row';

            row.innerHTML = `
                <span class="wme-aus-country-info" title="${name} (${id})">
                    ${name} <small class="wme-aus-country-id">(${id})</small>
                </span>
                <span class="wme-aus-row-controls">
                    <select class="wme-aus-unit-select ${currentUnit === 'imperial' ? 'is-imperial' : 'is-metric'}" data-country-id="${id}">
                        <option value="imperial" ${currentUnit === 'imperial' ? 'selected' : ''}>Imperial</option>
                        <option value="metric" ${currentUnit === 'metric' ? 'selected' : ''}>Metric</option>
                    </select>
                    ${!globalMultiUnit ? `
                        <label class="wme-aus-multi-toggle ${isMulti ? 'is-active' : ''}" title="${multiToggleTitle}">
                            <input type="checkbox" ${isMulti ? 'checked' : ''} />
                            <span>${multiToggleLabel}</span>
                        </label>
                    ` : ''}
                    ${hasExplicitRule ? `<button type="button" class="wme-aus-remove-btn" title="Remove custom rule">✕</button>` : ''}
                </span>
            `;

            const select = row.querySelector('.wme-aus-unit-select');
            select.addEventListener('change', (e) => {
                const newUnit = e.target.value === 'imperial' ? 'imperial' : 'metric';
                const prev = getRuleForCountry(id);
                countryRules.set(id, { unit: newUnit, multiUnit: prev.multiUnit });
                saveSettings();
                refreshCountryListUI(root);
                checkAndSetUnits(true);
                updateMultiUnitNodes();
            });

            const multiChk = row.querySelector('.wme-aus-multi-toggle input');
            if (multiChk) {
                multiChk.addEventListener('change', (e) => {
                    const prev = getRuleForCountry(id);
                    countryRules.set(id, { unit: prev.unit, multiUnit: e.target.checked });
                    saveSettings();
                    refreshCountryListUI(root);
                    if (id === activeCountryId) {
                        const topCountry = sdk.DataModel.Countries.getTopCountry();
                        if (topCountry) {
                            updateStatusBanner(topCountry.name, prev.unit === 'imperial', root);
                        }
                        if (isMultiUnitActiveForCurrentCountry()) {
                            updateMultiUnitNodes();
                        } else {
                            clearMultiUnitNodes();
                        }
                    }
                });
            }

            const removeBtn = row.querySelector('.wme-aus-remove-btn');
            if (removeBtn) {
                removeBtn.addEventListener('click', () => {
                    countryRules.delete(id);
                    saveSettings();
                    refreshCountryListUI(root);
                    checkAndSetUnits(true);
                    updateMultiUnitNodes();
                });
            }

            listContainer.appendChild(row);
        });
    }

    bootstrap();
})();