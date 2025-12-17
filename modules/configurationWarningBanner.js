/**
 * Configuration Warning Banner
 * Displays a compact (48px) banner prompting the user to configure required preferences.
 */

const ConfigurationWarningBanner = (function() {
  'use strict';

  const BANNER_ID = 'cforce-config-warning-banner';
  const CONFIG_BANNER_HEIGHT = 48;

  const BANNER_STYLES = `
    #${BANNER_ID} {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 999999;
      background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
      color: #fff;
      height: ${CONFIG_BANNER_HEIGHT}px;
      min-height: ${CONFIG_BANNER_HEIGHT}px;
      max-height: ${CONFIG_BANNER_HEIGHT}px;
      padding: 0 16px;
      box-sizing: border-box;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
      display: flex;
      align-items: center;
      gap: 12px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      animation: slideDown 0.35s cubic-bezier(0.68, -0.55, 0.265, 1.55);
    }

    @keyframes slideDown {
      from { transform: translateY(-100%); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    #${BANNER_ID}-icon {
      width: 22px;
      height: 22px;
      min-width: 22px;
      min-height: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.18);
      border-radius: 50%;
      font-size: 14px;
      flex-shrink: 0;
    }

    #${BANNER_ID}-content {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
      overflow: hidden;
    }

    #${BANNER_ID}-title {
      font-size: 13px;
      font-weight: 700;
      line-height: 1.1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    #${BANNER_ID}-message {
      font-size: 11px;
      opacity: 0.9;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    #${BANNER_ID}-defaults {
      display: none;
      font-size: 11px;
      line-height: 1.2;
    }

    #${BANNER_ID}-defaults-title { font-weight: 700; }
    #${BANNER_ID}-defaults-list { margin: 2px 0 0 0; padding: 0; list-style: none; display: flex; gap: 8px; }
    #${BANNER_ID}-defaults-list li { white-space: nowrap; }

    #${BANNER_ID}-form {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-top: 2px;
      flex-wrap: wrap;
    }

    .${BANNER_ID}-field {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      color: #fff;
      white-space: nowrap;
    }

    .${BANNER_ID}-field span { opacity: 0.9; }

    .${BANNER_ID}-field select,
    .${BANNER_ID}-field input[type="text"],
    .${BANNER_ID}-field input[type="number"] {
      height: 26px;
      border-radius: 4px;
      border: 1px solid rgba(255, 255, 255, 0.35);
      background: rgba(255, 255, 255, 0.12);
      color: #fff;
      padding: 0 8px;
      font-size: 11px;
      min-width: 120px;
      outline: none;
    }

    .${BANNER_ID}-field input::placeholder { color: rgba(255, 255, 255, 0.6); }

    .${BANNER_ID}-checkbox {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      opacity: 0.9;
    }

    #${BANNER_ID}-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }

    #${BANNER_ID}-btn-configure,
    #${BANNER_ID}-btn-dismiss {
      padding: 6px 14px;
      border: none;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s ease;
      white-space: nowrap;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    #${BANNER_ID}-btn-configure { background: #fff; color: #ee5a6f; }
    #${BANNER_ID}-btn-configure:hover { background: #f6f6f6; transform: translateY(-1px); box-shadow: 0 2px 8px rgba(0,0,0,0.18); }

    #${BANNER_ID}-btn-dismiss { background: rgba(255, 255, 255, 0.18); color: #fff; border: 1px solid rgba(255,255,255,0.35); }
    #${BANNER_ID}-btn-dismiss:hover { background: rgba(255,255,255,0.28); }

    @media (max-width: 900px) {
      #${BANNER_ID} { flex-wrap: wrap; height: auto; min-height: ${CONFIG_BANNER_HEIGHT}px; padding: 8px 12px; }
      #${BANNER_ID}-form { width: 100%; }
      #${BANNER_ID}-message { white-space: normal; }
    }
  `;

  let bannerElement = null;
  let isVisible = false;

  function createDefaultsList(preferences) {
    const defaults = [];
    if (preferences.meta.isFirstRun || !preferences.meta.setupCompleted) {
      defaults.push(`Shift timing: <strong>9 PM - 6 AM MYT</strong>`);
      defaults.push(`Team: <strong>${preferences.irt.team}</strong>`);
      defaults.push(`IRT: <strong>${preferences.irt.useTeamDefaults ? 'Team defaults' : preferences.irt.customMinutes + 'm'}</strong>`);
      if (preferences.userTimezone.auto) {
        const tzLabel = preferences.userTimezone.detected || 'auto';
        defaults.push(`User timezone: <strong>Auto (${tzLabel})</strong>`);
      }
    }

    if (!defaults.length) {
      return '';
    }

    return `
      <div id="${BANNER_ID}-defaults">
        <div id="${BANNER_ID}-defaults-title">Currently using defaults:</div>
        <ul id="${BANNER_ID}-defaults-list">
          ${defaults.map(item => `<li>${item}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  function createBannerHTML(preferences) {
    const teamOptions = ['EndNote', 'Alma', 'Primo', 'Summon', '360', 'Generic'];
    const selectedTeam = teamOptions.includes(preferences?.irt?.team) ? preferences.irt.team : 'Generic';
    const timezoneValue = preferences?.userTimezone?.manual || preferences?.userTimezone?.detected || preferences?.shift?.timezone || 'Asia/Kuala_Lumpur';
    const useTeamDefaults = preferences?.irt?.useTeamDefaults !== false;
    const customIrt = preferences?.irt?.customMinutes || '';

    return `
      <div id="${BANNER_ID}">
        <div id="${BANNER_ID}-icon">⚠️</div>
        <div id="${BANNER_ID}-content">
          <div id="${BANNER_ID}-title">Configuration Required</div>
          <div id="${BANNER_ID}-message">Using defaults for shift, team, and IRT. Set your preferences to get accurate highlighting.</div>
          ${createDefaultsList(preferences)}
        </div>
        
        <div id="${BANNER_ID}-form">
          <label class="${BANNER_ID}-field">
            <span>Team</span>
            <select id="${BANNER_ID}-team">
              ${teamOptions.map(team => `<option value="${team}" ${team === selectedTeam ? 'selected' : ''}>${team}</option>`).join('')}
            </select>
          </label>
          <label class="${BANNER_ID}-field">
            <span>Timezone</span>
            <input id="${BANNER_ID}-timezone" type="text" value="${timezoneValue}" placeholder="e.g., Asia/Kuala_Lumpur" />
          </label>
          <label class="${BANNER_ID}-field">
            <span>IRT (mins)</span>
            <input id="${BANNER_ID}-irt" type="number" min="5" max="240" value="${useTeamDefaults ? '' : customIrt}" ${useTeamDefaults ? 'disabled' : ''} />
            <label class="${BANNER_ID}-checkbox">
              <input id="${BANNER_ID}-irt-defaults" type="checkbox" ${useTeamDefaults ? 'checked' : ''} />
              Use team defaults
            </label>
          </label>
        </div>
        <div id="${BANNER_ID}-actions">
          <button id="${BANNER_ID}-btn-configure">Save preferences</button>
          <button id="${BANNER_ID}-btn-dismiss">Use defaults</button>
        </div>
      </div>
    `;
  }

  function injectStyles() {
    if (document.getElementById(`${BANNER_ID}-styles`)) {
      return;
    }
    const styleElement = document.createElement('style');
    styleElement.id = `${BANNER_ID}-styles`;
    styleElement.textContent = BANNER_STYLES;
    document.head.appendChild(styleElement);
  }

  async function show(preferences) {
    if (isVisible) {
      return;
    }

    injectStyles();
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = createBannerHTML(preferences);
    bannerElement = tempDiv.firstElementChild;

    const configureBtn = bannerElement.querySelector(`#${BANNER_ID}-btn-configure`);
    const dismissBtn = bannerElement.querySelector(`#${BANNER_ID}-btn-dismiss`);
    const irtDefaultsCheckbox = bannerElement.querySelector(`#${BANNER_ID}-irt-defaults`);
    const irtInput = bannerElement.querySelector(`#${BANNER_ID}-irt`);

    irtDefaultsCheckbox.addEventListener('change', () => {
      const useDefaults = irtDefaultsCheckbox.checked;
      irtInput.disabled = useDefaults;
      if (useDefaults) {
        irtInput.value = '';
      }
    });

    configureBtn.addEventListener('click', handleSavePreferences);
    dismissBtn.addEventListener('click', handleDismiss);

    document.body.appendChild(bannerElement);
    isVisible = true;
  }

  function hide() {
    if (!isVisible || !bannerElement) return;
    bannerElement.remove();
    bannerElement = null;
    isVisible = false;
  }

  async function handleSavePreferences() {
    try {
      const team = bannerElement.querySelector(`#${BANNER_ID}-team`)?.value || 'Generic';
      const timezone = bannerElement.querySelector(`#${BANNER_ID}-timezone`)?.value?.trim();
      const useTeamDefaults = bannerElement.querySelector(`#${BANNER_ID}-irt-defaults`)?.checked;
      const customIrtRaw = bannerElement.querySelector(`#${BANNER_ID}-irt`)?.value?.trim();
      const customIrt = customIrtRaw ? parseInt(customIrtRaw, 10) : null;

      const prefs = await UserPreferences.get();
      
      // Update preferences based on form data
      prefs.irt.team = team;
      prefs.irt.useTeamDefaults = !!useTeamDefaults;
      
      // Only set customMinutes if not using defaults
      if (!useTeamDefaults && Number.isFinite(customIrt)) {
        prefs.irt.customMinutes = customIrt;
      } else if (useTeamDefaults) {
        prefs.irt.customMinutes = null;
      }

      if (timezone) {
        prefs.userTimezone.auto = false;
        prefs.userTimezone.manual = timezone;
        
        // Also update shift timezone to match unless user has configured it separately (simplification for banner)
        prefs.shift.timezone = timezone;
      }

      // Mark setup as complete and dismiss warning permanently
      prefs.meta.isFirstRun = false;
      prefs.meta.setupCompleted = true;
      prefs.meta.warningDismissed = true;

      await UserPreferences.save(prefs);
      
      // Double check dismissal in case save() didn't persist some flags deeply
      await UserPreferences.markWarningSeen();
      
      hide();
      
      // Optionally notify user or refresh page logic if needed, but for now just hide.
    } catch (error) {
      console.error('[ConfigWarningBanner] Failed to save banner preferences:', error);
      alert('Unable to save preferences. Please open the extension popup and try again.');
    }
  }

  async function handleDismiss() {
    try {
      await UserPreferences.markWarningSeen();
      hide();
    } catch (error) {
      console.error('[ConfigWarningBanner] Failed to dismiss banner:', error);
      hide();
    }
  }

  async function checkAndShow() {
    const shouldShow = await UserPreferences.shouldShowWarning();
    if (!shouldShow) {
      return;
    }
    const prefs = await UserPreferences.get();
    await show(prefs);
  }

  async function forceShow() {
    const prefs = await UserPreferences.get();
    await show(prefs);
  }

  function update(preferences) {
    if (!isVisible) return;
    hide();
    show(preferences);
  }

  return {
    show,
    hide,
    checkAndShow,
    forceShow,
    update,
    isVisible: () => isVisible
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ConfigurationWarningBanner;
}
