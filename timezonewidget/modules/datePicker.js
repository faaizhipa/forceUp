'use strict';

const GlobalSyncDatePicker = (() => {
  'use strict';

  const ACTIVE_CLASS = 'gsw-date-picker-active';
  let activePanel = null;
  let activeCleanup = null;
  const ANCHOR_GAP = 8;

  function _buildDayGrid(date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells = [];
    for (let i = 0; i < startWeekday; i++) {
      cells.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push(new Date(year, month, day));
    }
    while (cells.length % 7 !== 0) {
      cells.push(null);
    }
    return cells;
  }

  function _closePanel() {
    if (activePanel) {
      activePanel.classList.remove(ACTIVE_CLASS);
      activePanel.remove();
      activePanel = null;
    }
    if (activeCleanup) {
      activeCleanup();
      activeCleanup = null;
    }
  }

  function _resolveHost(host) {
    if (host && typeof host.appendChild === 'function') {
      return host;
    }
    if (!host && typeof GlobalSyncApp !== 'undefined' && typeof GlobalSyncApp.getPopupContainer === 'function') {
      const inferredHost = GlobalSyncApp.getPopupContainer();
      if (inferredHost) {
        return inferredHost;
      }
    }
    if (host) {
      console.warn('[GlobalSyncDatePicker] Invalid host provided, falling back to document.body');
    }
    return document.body;
  }

  function _positionPanel(panel, anchor, host) {
    const anchorRect = anchor.getBoundingClientRect();
    if (host === document.body) {
      panel.style.top = `${anchorRect.bottom + window.scrollY + ANCHOR_GAP}px`;
      panel.style.left = `${anchorRect.left + window.scrollX}px`;
      return;
    }
    const hostRect = host.getBoundingClientRect();
    panel.style.top = `${anchorRect.bottom - hostRect.top + ANCHOR_GAP}px`;
    panel.style.left = `${anchorRect.left - hostRect.left}px`;
  }

  function open(options) {
    const { anchor, value = new Date(), onSelect, host } = options;
    if (!anchor) {
      throw new Error('[GlobalSyncDatePicker] anchor element is required');
    }

    _closePanel();
    const targetHost = _resolveHost(host);

    let currentMonth = new Date(value.getFullYear(), value.getMonth(), 1);

    const panel = document.createElement('div');
    panel.className = 'gsw-date-picker-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');

    function render() {
      panel.innerHTML = '';

      const header = document.createElement('div');
      header.className = 'gsw-date-picker-header';

      const prevBtn = document.createElement('button');
      prevBtn.type = 'button';
      prevBtn.className = 'gsw-date-picker-nav';
      prevBtn.textContent = '‹';
      prevBtn.addEventListener('click', () => {
        currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
        render();
      });

      const nextBtn = document.createElement('button');
      nextBtn.type = 'button';
      nextBtn.className = 'gsw-date-picker-nav';
      nextBtn.textContent = '›';
      nextBtn.addEventListener('click', () => {
        currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
        render();
      });

      const title = document.createElement('div');
      title.className = 'gsw-date-picker-title';
      title.textContent = currentMonth.toLocaleString(undefined, { month: 'long', year: 'numeric' });

      header.appendChild(prevBtn);
      header.appendChild(title);
      header.appendChild(nextBtn);
      panel.appendChild(header);

      const weekdayRow = document.createElement('div');
      weekdayRow.className = 'gsw-date-picker-weekdays';
      const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
      weekdays.forEach((day) => {
        const cell = document.createElement('span');
        cell.textContent = day;
        weekdayRow.appendChild(cell);
      });
      panel.appendChild(weekdayRow);

      const grid = document.createElement('div');
      grid.className = 'gsw-date-picker-grid';
      const cells = _buildDayGrid(currentMonth);
      cells.forEach((cellDate) => {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'gsw-date-picker-cell';

        if (!cellDate) {
          cell.classList.add('empty');
          cell.disabled = true;
        } else {
          cell.textContent = String(cellDate.getDate());
          const isSameMonth = cellDate.getMonth() === currentMonth.getMonth();
          if (!isSameMonth) {
            cell.classList.add('muted');
          }
          if (
            cellDate.getFullYear() === value.getFullYear() &&
            cellDate.getMonth() === value.getMonth() &&
            cellDate.getDate() === value.getDate()
          ) {
            cell.classList.add('selected');
          }
          cell.addEventListener('click', () => {
            if (typeof onSelect === 'function') {
              onSelect(new Date(cellDate));
            }
            _closePanel();
          });
        }
        grid.appendChild(cell);
      });
      panel.appendChild(grid);
    }

    render();
    targetHost.appendChild(panel);
    _positionPanel(panel, anchor, targetHost);
    requestAnimationFrame(() => panel.classList.add(ACTIVE_CLASS));

    const handleClickOutside = (event) => {
      if (!panel.contains(event.target) && event.target !== anchor) {
        _closePanel();
      }
    };

    const handleEsc = (event) => {
      if (event.key === 'Escape') {
        _closePanel();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);

    activePanel = panel;
    activeCleanup = () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };

    return {
      destroy: _closePanel
    };
  }

  return { open, close: _closePanel };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = GlobalSyncDatePicker;
}
