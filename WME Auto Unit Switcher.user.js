// ==UserScript==
// @name         WME Auto Unit Switcher
// @namespace    https://github.com/
// @version      1.0.3
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
    const CUSTOM_RULE_IDS_KEY = 'wme_auto_unit_switcher_custom_rule_ids';
    const COUNTRY_NAMES_STORAGE_KEY = 'wme_auto_unit_switcher_country_names';
    const GLOBAL_MULTI_UNIT_KEY = 'wme_auto_unit_switcher_global_multi_unit';
    const RESET_1_0_2_KEY = 'wme_auto_unit_switcher_reset_1_0_2';
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
        234: { unit: 'imperial', multiUnit: false }, // United Kingdom
        182: { unit: 'imperial', multiUnit: false }, // Puerto Rico
        88:  { unit: 'imperial', multiUnit: false }, // Guam
        236: { unit: 'imperial', multiUnit: false }  // U.S. Virgin Islands
    };

    // Complete Waze Country ID -> Name lookup table (supports both ID & name search)
    const WAZE_COUNTRY_NAMES = {
        1: "Afghanistan", 2: "Albania", 3: "Algeria", 4: "American Samoa", 5: "Andorra",
        6: "Angola", 7: "Anguilla", 8: "Antarctica", 9: "Antigua and Barbuda", 10: "Argentina",
        11: "Armenia", 12: "Aruba", 13: "Australia", 14: "Austria", 15: "Azerbaijan",
        16: "Bahamas", 17: "Bahrain", 18: "Bangladesh", 19: "Barbados", 20: "Belarus",
        21: "Belgium", 22: "Belize", 23: "Benin", 24: "Bermuda", 25: "Bhutan",
        26: "Bolivia", 27: "Bosnia and Herzegovina", 28: "Botswana", 29: "Bouvet Island", 30: "Brazil",
        31: "British Indian Ocean Territory", 32: "Brunei", 33: "Bulgaria", 34: "Burkina Faso", 35: "Burundi",
        36: "Cambodia", 37: "Cameroon", 38: "Canada", 39: "Cape Verde", 40: "Cayman Islands",
        41: "Central African Republic", 42: "Chad", 43: "Chile", 44: "China", 45: "Christmas Island",
        46: "Cocos (Keeling) Islands", 47: "Colombia", 48: "Comoros", 49: "Congo", 50: "Cook Islands",
        51: "Costa Rica", 52: "Croatia", 53: "Cuba", 54: "Cyprus", 55: "Cuba",
        56: "Czech Republic", 57: "Denmark", 58: "Djibouti", 59: "Dominica", 60: "Dominican Republic",
        61: "Ecuador", 62: "Egypt", 63: "El Salvador", 64: "Equatorial Guinea", 65: "Eritrea",
        66: "Estonia", 67: "Ethiopia", 68: "Falkland Islands", 69: "Faroe Islands", 70: "Fiji",
        71: "Finland", 72: "France", 73: "France", 74: "French Guiana", 75: "French Polynesia",
        76: "French Southern Territories", 77: "Gabon", 78: "Gambia", 79: "Georgia", 80: "Germany",
        81: "Ghana", 82: "Gibraltar", 83: "Greece", 84: "Greenland", 85: "Grenada",
        86: "Guadeloupe", 87: "Guam", 88: "Guam", 89: "Guatemala", 90: "Guernsey",
        91: "Guinea", 92: "Guinea-Bissau", 93: "Guyana", 94: "Haiti", 95: "Heard Island and McDonald Islands",
        96: "Honduras", 97: "Hong Kong", 98: "Hungary", 99: "Iceland", 100: "India",
        101: "Indonesia", 102: "Iran", 103: "Iraq", 104: "Ireland", 105: "Isle of Man",
        106: "Israel", 107: "Italy", 108: "Ivory Coast", 109: "Jamaica", 110: "Japan",
        111: "Jersey", 112: "Jordan", 113: "Kazakhstan", 114: "Kenya", 115: "Kiribati",
        116: "Kuwait", 117: "Kyrgyzstan", 118: "Laos", 119: "Latvia", 120: "Lebanon",
        121: "Lesotho", 122: "Liberia", 123: "Libya", 124: "Liberia", 125: "Liechtenstein",
        126: "Lithuania", 127: "Luxembourg", 128: "Macau", 129: "North Macedonia", 130: "Madagascar",
        131: "Malawi", 132: "Malaysia", 133: "Maldives", 134: "Mali", 135: "Malta",
        136: "Marshall Islands", 137: "Martinique", 138: "Mauritania", 139: "Mauritius", 140: "Mayotte",
        141: "Mexico", 142: "Micronesia", 143: "Moldova", 144: "Monaco", 145: "Mongolia",
        146: "Montenegro", 147: "Montserrat", 148: "Morocco", 149: "Mozambique", 150: "Myanmar",
        151: "Namibia", 152: "Nauru", 153: "Nepal", 154: "Netherlands", 155: "Netherlands Antilles",
        156: "New Caledonia", 157: "New Zealand", 158: "Nicaragua", 159: "Niger", 160: "Nigeria",
        161: "Niue", 162: "Norfolk Island", 163: "North Korea", 164: "Northern Mariana Islands", 165: "Norway",
        166: "Oman", 167: "Pakistan", 168: "Palau", 169: "Palestine", 170: "Panama",
        171: "Papua New Guinea", 172: "Paraguay", 173: "Peru", 174: "Philippines", 175: "Pitcairn Islands",
        176: "Poland", 177: "Portugal", 178: "Puerto Rico", 179: "Qatar", 180: "Reunion",
        181: "Romania", 182: "Puerto Rico", 183: "Russia", 184: "Rwanda", 185: "Saint Barthelemy",
        186: "Saint Helena", 187: "Saint Kitts and Nevis", 188: "Saint Lucia", 189: "Saint Martin", 190: "Saint Pierre and Miquelon",
        191: "Saint Vincent and the Grenadines", 192: "Samoa", 193: "San Marino", 194: "Sao Tome and Principe", 195: "Saudi Arabia",
        196: "Senegal", 197: "Serbia", 198: "Seychelles", 199: "Sierra Leone", 200: "Singapore",
        201: "Slovakia", 202: "Slovenia", 203: "Solomon Islands", 204: "Somalia", 205: "South Africa",
        206: "South Georgia", 207: "South Korea", 208: "Spain", 209: "Sri Lanka", 210: "Sudan",
        211: "Suriname", 212: "Svalbard and Jan Mayen", 213: "Eswatini", 214: "Sweden", 215: "Switzerland",
        216: "Syria", 217: "Taiwan", 218: "Tajikistan", 219: "Tanzania", 220: "Thailand",
        221: "Timor-Leste", 222: "Togo", 223: "Tokelau", 224: "Tonga", 225: "Trinidad and Tobago",
        226: "Tunisia", 227: "Turkey", 228: "Turkmenistan", 229: "Turks and Caicos Islands", 230: "Tuvalu",
        231: "Uganda", 232: "Ukraine", 233: "United Arab Emirates", 234: "United Kingdom", 235: "United States",
        236: "U.S. Virgin Islands", 237: "Uruguay", 238: "Uzbekistan", 239: "Vanuatu", 240: "Vatican City",
        241: "Venezuela", 242: "Vietnam", 243: "Wallis and Futuna", 244: "Western Sahara", 245: "Yemen",
        246: "Zambia", 247: "Zimbabwe", 248: "Kosovo", 249: "South Sudan", 250: "Curacao",
        251: "Sint Maarten", 252: "Bonaire"
    };

    let sdk = null;
    // Map<number, { unit: 'imperial' | 'metric', multiUnit: boolean }>
    let countryRules = new Map();
    // Set<number> of country IDs explicitly added or modified by the user
    let customRuleIds = new Set();
    // Map<number, string>
    let cachedCountryNames = new Map();
    let globalMultiUnit = true;
    let lastCountryId = null;
    let activeCountryId = null;
    let multiUnitObserver = null;
    let scanScheduled = false;

    function getDisplayName() {
        return (SCRIPT_NAME && SCRIPT_NAME.trim()) || (typeof GM_info !== 'undefined' && GM_info.script.name) || 'WME Auto Unit Switcher';
    }

    function getScriptVersion() {
        return (typeof GM_info !== 'undefined' && GM_info.script && GM_info.script.version) || '1.0.3.beta-1';
    }

    function getScriptId() {
        const clean = (SCRIPT_ID || '').trim().replace(/[^a-zA-Z0-9_-]/g, '-');
        return clean.length >= 3 ? clean : 'wme-auto-unit-switcher';
    }

    function isValidCountryName(name) {
        return typeof name === 'string' && name.trim().length > 0 && !/^Country ID:\s*\d+$/i.test(name.trim());
    }

    function setCachedCountryName(id, name) {
        if (typeof id !== 'number' || isNaN(id)) return false;
        if (!isValidCountryName(name)) return false;
        const cleanName = name.trim();
        if (cachedCountryNames.get(id) !== cleanName) {
            cachedCountryNames.set(id, cleanName);
            return true;
        }
        return false;
    }

    function loadSettings() {
        let shouldResetDefaults = false;

        try {
            if (localStorage.getItem(RESET_1_0_2_KEY) !== 'true') {
                shouldResetDefaults = true;
                localStorage.setItem(RESET_1_0_2_KEY, 'true');
            }
        } catch (e) {
            console.error(`${getDisplayName()}: Error checking reset flag.`, e);
        }

        cachedCountryNames = new Map(
            Object.entries(WAZE_COUNTRY_NAMES).map(([id, name]) => [parseInt(id, 10), name])
        );

        if (shouldResetDefaults) {
            countryRules = new Map(
                Object.entries(DEFAULT_COUNTRY_RULES).map(([id, cfg]) => [parseInt(id, 10), { ...cfg }])
            );
            customRuleIds = new Set();
            globalMultiUnit = true;
            saveSettings();
            return;
        }

        try {
            const savedNames = localStorage.getItem(COUNTRY_NAMES_STORAGE_KEY);
            if (savedNames) {
                const parsedNames = JSON.parse(savedNames);
                if (parsedNames && typeof parsedNames === 'object') {
                    Object.entries(parsedNames).forEach(([idStr, name]) => {
                        setCachedCountryName(parseInt(idStr, 10), name);
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
            const savedCustomIds = localStorage.getItem(CUSTOM_RULE_IDS_KEY);
            if (savedCustomIds) {
                const parsedIds = JSON.parse(savedCustomIds);
                if (Array.isArray(parsedIds)) {
                    customRuleIds = new Set(parsedIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id)));
                }
            }
        } catch (e) {
            console.error(`${getDisplayName()}: Error loading custom rule IDs.`, e);
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
                            setCachedCountryName(id, cfg.name);
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
                            if (!Object.prototype.hasOwnProperty.call(DEFAULT_COUNTRY_RULES, id)) {
                                customRuleIds.add(id);
                            }
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
                const knownName = getCountryName(id);
                obj[id] = {
                    unit: cfg.unit,
                    multiUnit: Boolean(cfg.multiUnit),
                    ...(isValidCountryName(knownName) ? { name: knownName } : {})
                };
            });
            localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
            localStorage.setItem(GLOBAL_MULTI_UNIT_KEY, String(globalMultiUnit));
            localStorage.setItem(CUSTOM_RULE_IDS_KEY, JSON.stringify(Array.from(customRuleIds)));
            saveCountryNamesCache();
        } catch (e) {
            console.error(`${getDisplayName()}: Error saving settings.`, e);
        }
    }

    function saveCountryNamesCache() {
        try {
            const namesObj = {};
            cachedCountryNames.forEach((name, id) => {
                if (isValidCountryName(name) && WAZE_COUNTRY_NAMES[id] !== name) {
                    namesObj[id] = name;
                }
            });
            localStorage.setItem(COUNTRY_NAMES_STORAGE_KEY, JSON.stringify(namesObj));
        } catch (e) {
            console.error(`${getDisplayName()}: Error saving country names cache.`, e);
        }
    }

    function cacheLoadedCountryNames(extraIdsToLookup = []) {
        if (!sdk) return false;
        let updated = false;

        try {
            const topCountry = sdk.DataModel.Countries.getTopCountry();
            if (topCountry && setCachedCountryName(topCountry.id, topCountry.name)) {
                updated = true;
            }
        } catch (_) {}

        try {
            const loadedCountries = sdk.DataModel.Countries.getAll() || [];
            loadedCountries.forEach(c => {
                if (c && setCachedCountryName(c.id, c.name)) {
                    updated = true;
                }
            });
        } catch (_) {}

        const idsToCheck = new Set([...countryRules.keys(), ...extraIdsToLookup]);
        idsToCheck.forEach(id => {
            if (sdk.DataModel.Countries.getById) {
                try {
                    const c = sdk.DataModel.Countries.getById({ countryId: id });
                    if (c && setCachedCountryName(c.id, c.name)) {
                        updated = true;
                    }
                } catch (_) {}
            }
        });

        if (updated) {
            saveCountryNamesCache();
        }

        return updated;
    }

    function getCountryName(countryId) {
        if (sdk && sdk.DataModel && sdk.DataModel.Countries) {
            try {
                const top = sdk.DataModel.Countries.getTopCountry();
                if (top && top.id === countryId && isValidCountryName(top.name)) {
                    setCachedCountryName(countryId, top.name);
                    return top.name.trim();
                }
            } catch (_) {}

            try {
                if (sdk.DataModel.Countries.getById) {
                    const c = sdk.DataModel.Countries.getById({ countryId });
                    if (c && isValidCountryName(c.name)) {
                        setCachedCountryName(countryId, c.name);
                        return c.name.trim();
                    }
                }
            } catch (_) {}
        }

        if (cachedCountryNames.has(countryId)) {
            return cachedCountryNames.get(countryId);
        }
        return WAZE_COUNTRY_NAMES[countryId] || `Country ID: ${countryId}`;
    }

    function resolveCountryInput(rawInput) {
        const query = (rawInput || '').trim();
        if (!query) return null;

        // 1. Direct numeric ID: e.g. "73"
        if (/^\d+$/.test(query)) {
            const id = parseInt(query, 10);
            if (id > 0) {
                cacheLoadedCountryNames([id]);
                return { id, name: getCountryName(id) };
            }
            return null;
        }

        // 2. Datalist formatted string: e.g. "France (73)"
        const trailingIdMatch = query.match(/\((\d+)\)\s*$/);
        if (trailingIdMatch) {
            const id = parseInt(trailingIdMatch[1], 10);
            if (id > 0) {
                cacheLoadedCountryNames([id]);
                return { id, name: getCountryName(id) };
            }
        }

        // 3. Case-insensitive exact or partial name match against cached + built-in countries
        const lowerQuery = query.toLowerCase();
        const allEntries = Array.from(cachedCountryNames.entries());

        const exactMatches = allEntries
            .filter(([, name]) => name.toLowerCase() === lowerQuery)
            .sort((a, b) => b[0] - a[0]);
        if (exactMatches.length > 0) {
            return { id: exactMatches[0][0], name: exactMatches[0][1] };
        }

        const prefixMatches = allEntries
            .filter(([, name]) => name.toLowerCase().startsWith(lowerQuery))
            .sort((a, b) => a[1].length - b[1].length || b[0] - a[0]);
        if (prefixMatches.length > 0) {
            return { id: prefixMatches[0][0], name: prefixMatches[0][1] };
        }

        const partialMatches = allEntries
            .filter(([, name]) => name.toLowerCase().includes(lowerQuery))
            .sort((a, b) => a[1].length - b[1].length || b[0] - a[0]);
        if (partialMatches.length > 0) {
            return { id: partialMatches[0][0], name: partialMatches[0][1] };
        }

        return null;
    }

    function updateCountryDatalist(datalistEl, rawQuery) {
        if (!datalistEl) return;
        const query = (rawQuery || '').trim().toLowerCase();

        // Keep datalist empty until the user actually starts typing
        if (!query) {
            datalistEl.innerHTML = '';
            return;
        }

        const matches = Array.from(cachedCountryNames.entries())
            .filter(([id, name]) => {
                if (!isValidCountryName(name)) return false;
                return name.toLowerCase().includes(query) || String(id).startsWith(query);
            })
            .sort((a, b) => {
                const aStarts = a[1].toLowerCase().startsWith(query) ? 0 : 1;
                const bStarts = b[1].toLowerCase().startsWith(query) ? 0 : 1;
                return aStarts - bStarts || a[1].localeCompare(b[1]) || a[0] - b[0];
            });

        datalistEl.innerHTML = matches
            .map(([id, name]) => `<option value="${name} (${id})"></option>`)
            .join('');
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
                getScriptVersion(),
                updateMessage,
                USERSCRIPT_URL || "https://github.com/Thynamelessone/WME-AutoUnitSwitcher",
                ""
            );
        }

        onMapUpdate();
        console.log(`${displayName}: Initialized with WME SDK.`);
    }

    // --- Multi-Unit Conversion & Measure Tool (Light + Shadow DOM) ---

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

    function traverseWithShadowRoots(rootNode, callback) {
        if (!rootNode) return;
        const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, null);
        let current;
        while ((current = walker.nextNode())) {
            if (current.nodeType === Node.TEXT_NODE) {
                callback(current);
            } else if (current.nodeType === Node.ELEMENT_NODE) {
                if (current.id === 'wme-aus-container') continue;
                if (current.shadowRoot) {
                    traverseWithShadowRoots(current.shadowRoot, callback);
                }
            }
        }
    }

    function clearMultiUnitNodes() {
        const removeInRoot = (root) => {
            if (!root) return;
            root.querySelectorAll('.wme-aus-extra-unit').forEach(el => el.remove());
            root.querySelectorAll('[data-wme-aus-val]').forEach(el => {
                delete el.dataset.wmeAusVal;
            });
            root.querySelectorAll('*').forEach(el => {
                if (el.shadowRoot) removeInRoot(el.shadowRoot);
            });
        };
        removeInRoot(document.body);
    }

    function updateMultiUnitNodes() {
        if (!isMultiUnitActiveForCurrentCountry()) {
            clearMultiUnitNodes();
            return;
        }

        const candidateElements = new Set();

        traverseWithShadowRoots(document.body, (textNode) => {
            const parent = textNode.parentElement;
            if (!parent) return;
            if (parent.closest && parent.closest('#wme-aus-container')) return;
            if (parent.classList && parent.classList.contains('wme-aus-extra-unit')) return;
            const tag = parent.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'SCRIPT' || tag === 'STYLE' || tag === 'OPTION') return;

            const txt = textNode.nodeValue ? textNode.nodeValue.trim() : '';
            if (!txt) return;

            if (/^\d[\d,.]*\s*(ft|feet|m|meters?|metres?)\b/i.test(txt)) {
                candidateElements.add(parent);
            }
        });

        candidateElements.forEach(el => {
            if (el.closest && el.closest('#wme-aus-container')) return;

            const nonBadgeChildren = Array.from(el.children).filter(
                c => !c.classList.contains('wme-aus-extra-unit')
            );
            if (nonBadgeChildren.length > 0) return;

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
                badge.style.cssText = 'font-size: 0.9em; opacity: 0.9; font-weight: 500; white-space: nowrap; margin-left: 4px;';
                el.appendChild(badge);
            }

            badge.textContent = isFeet ? formatConversionFromFeet(numericVal) : formatConversionFromMeters(numericVal);
        });
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

            #wme-aus-add-id.wme-aus-input-error {
                border-color: #e06c75;
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

        setCachedCountryName(countryId, topCountry.name);

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
        const version = getScriptVersion();

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
                    <small style="display: block; color: var(--aus-muted); text-wrap: wrap;">Show <code>(yd / m)</code> or <code>(yd / ft)</code> in all countries.</small>
                </span>
            </label>

            <div class="wme-aus-input-row">
                <input type="text" id="wme-aus-add-id" list="wme-aus-country-datalist" placeholder="Country name or ID" />
                <datalist id="wme-aus-country-datalist"></datalist>
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
        const countryDatalist = container.querySelector('#wme-aus-country-datalist');
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

        addInput.addEventListener('input', () => {
            addInput.classList.remove('wme-aus-input-error');
            updateCountryDatalist(countryDatalist, addInput.value);
        });

        const handleAddCountry = () => {
            const resolved = resolveCountryInput(addInput.value);
            const selectedUnit = addUnitSelect.value === 'imperial' ? 'imperial' : 'metric';
            if (resolved && resolved.id > 0) {
                setCachedCountryName(resolved.id, resolved.name);
                const existing = countryRules.get(resolved.id);
                countryRules.set(resolved.id, {
                    unit: selectedUnit,
                    multiUnit: existing ? existing.multiUnit : false
                });
                customRuleIds.add(resolved.id);
                saveSettings();
                addInput.value = '';
                countryDatalist.innerHTML = '';
                addInput.classList.remove('wme-aus-input-error');
                refreshCountryListUI(container);
                checkAndSetUnits(true);
            } else {
                addInput.classList.add('wme-aus-input-error');
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
            customRuleIds = new Set();
            globalMultiUnit = true;
            globalMultiChk.checked = true;
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

        listContainer.querySelectorAll('.wme-aus-country-row').forEach(row => {
            const idAttr = parseInt(row.dataset.countryId, 10);
            const nameAttr = row.dataset.countryName;
            if (!isNaN(idAttr) && isValidCountryName(nameAttr)) {
                setCachedCountryName(idAttr, nameAttr);
            }
        });

        if (cacheLoadedCountryNames()) {
            const inputEl = root.querySelector('#wme-aus-add-id');
            if (inputEl && inputEl.value.trim()) {
                updateCountryDatalist(root.querySelector('#wme-aus-country-datalist'), inputEl.value);
            }
        }

        const knownCountries = new Map();
        const loadedIds = new Set();

        const loadedCountries = sdk.DataModel.Countries.getAll() || [];
        loadedCountries.forEach(c => {
            if (c && typeof c.id === 'number') {
                setCachedCountryName(c.id, c.name);
            }
        });

        if (typeof activeCountryId === 'number') {
            loadedIds.add(activeCountryId);
            knownCountries.set(activeCountryId, getCountryName(activeCountryId));
        }

        customRuleIds.forEach(id => {
            if (!knownCountries.has(id)) {
                knownCountries.set(id, getCountryName(id));
            }
        });

        const sortedEntries = Array.from(knownCountries.entries())
            .filter(([id]) => loadedIds.has(id) || customRuleIds.has(id))
            .sort((a, b) => a[1].localeCompare(b[1]));

        listContainer.innerHTML = '';
        sortedEntries.forEach(([id, name]) => {
            const rule = getRuleForCountry(id);
            const currentUnit = rule.unit;
            const isMulti = Boolean(rule.multiUnit);
            const hasExplicitRule = countryRules.has(id);
            const isDefaultCountry = Object.prototype.hasOwnProperty.call(DEFAULT_COUNTRY_RULES, id);
            const multiToggleLabel = currentUnit === 'imperial' ? '+yd/m' : '+yd/ft';
            const multiToggleTitle = currentUnit === 'imperial'
                ? 'Show Yards & Meters next to Feet'
                : 'Show Yards & Feet next to Meters';

            const row = document.createElement('div');
            row.className = 'wme-aus-country-row';
            row.dataset.countryId = String(id);
            row.dataset.countryName = name;

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
                    ${hasExplicitRule && !isDefaultCountry ? `<button type="button" class="wme-aus-remove-btn" title="Remove custom rule">✕</button>` : ''}
                </span>
            `;

            const select = row.querySelector('.wme-aus-unit-select');
            select.addEventListener('change', (e) => {
                setCachedCountryName(id, name);
                const newUnit = e.target.value === 'imperial' ? 'imperial' : 'metric';
                const prev = getRuleForCountry(id);
                countryRules.set(id, { unit: newUnit, multiUnit: prev.multiUnit });
                customRuleIds.add(id);
                saveSettings();
                refreshCountryListUI(root);
                checkAndSetUnits(true);
                updateMultiUnitNodes();
            });

            const multiChk = row.querySelector('.wme-aus-multi-toggle input');
            if (multiChk) {
                multiChk.addEventListener('change', (e) => {
                    setCachedCountryName(id, name);
                    const prev = getRuleForCountry(id);
                    countryRules.set(id, { unit: prev.unit, multiUnit: e.target.checked });
                    customRuleIds.add(id);
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
                    customRuleIds.delete(id);
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