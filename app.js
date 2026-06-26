const monthSelect = document.getElementById("month");
const yearInput = document.getElementById("year");
const dailyLimitInput = document.getElementById("dailyLimit");
const dayOffList = document.getElementById("dayOffList");
const projectList = document.getElementById("projectList");
const projectCountInput = document.getElementById("projectCount");
const summary = document.getElementById("summary");
const calendar = document.getElementById("calendar");
const sidebarMiniCalendars = document.getElementById("sidebarMiniCalendars");
const toolbarTitle = document.getElementById("toolbarTitle");
const prevMonthButton = document.getElementById("prevMonthButton");
const nextMonthButton = document.getElementById("nextMonthButton");
const timesheetCountLabel = document.getElementById("timesheetCount");
const holidayCountLabel = document.getElementById("holidayCount");
const daysOffCountLabel = document.getElementById("daysOffCount");
const projectCountLabel = document.getElementById("projectCountLabel");
const allocationBreakdown = document.getElementById("allocationBreakdown");
const chooseHolidaysButton = document.getElementById("chooseHolidaysButton");
const refreshHolidaysButton = document.getElementById("refreshHolidaysButton");
const downloadHolidaysButton = document.getElementById("downloadHolidaysButton");
const holidaySourceLabel = document.getElementById("holidaySourceLabel");
const holidayConfigPicker = document.getElementById("holidayConfigPicker");
let calculateTimer = null;
let holidayConfig = null;
let latestHolidaySnapshot = null;
let holidayConfigSource = "json";
let holidayConfigFileName = "holidays.json";
const holidayRuntimeCache = new Map();
const holidayCachePrefix = "timesheet-holiday-cache";
const holidayConfigUrl = "./holidays.json";

const projectColorPalette = [
  { color: "#4f8cff", soft: "rgba(79, 140, 255, 0.18)" },
  { color: "#32c7a1", soft: "rgba(50, 199, 161, 0.18)" },
  { color: "#ff9f43", soft: "rgba(255, 159, 67, 0.18)" },
  { color: "#f25f8b", soft: "rgba(242, 95, 139, 0.18)" },
  { color: "#a78bfa", soft: "rgba(167, 139, 250, 0.18)" },
  { color: "#22c55e", soft: "rgba(34, 197, 94, 0.18)" },
  { color: "#06b6d4", soft: "rgba(6, 182, 212, 0.18)" },
  { color: "#f97316", soft: "rgba(249, 115, 22, 0.18)" },
];

const monthNames = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

function localDate(year, month, day) {
  return new Date(year, month - 1, day, 12);
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function formatMonthDay(date) {
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatHours(value) {
  return `${Number(value).toFixed(2).replace(/\.00$/, "")}h`;
}

function formatPercent(value) {
  return `${Number(value).toFixed(1).replace(/\.0$/, "")}%`;
}

function formatLongWeekday(date) {
  return new Intl.DateTimeFormat("pt-PT", {
    weekday: "long",
  }).format(date);
}

function formatToolbarMonth(year, month) {
  return new Intl.DateTimeFormat("pt-PT", {
    month: "long",
    year: "numeric",
  }).format(localDate(year, month, 1));
}

function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function cloneDate(date) {
  return new Date(date.getTime());
}

function addDays(date, amount) {
  const next = cloneDate(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function getEasterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return localDate(year, month, day);
}

function serializeHoliday(holiday) {
  return {
    date: dateKey(holiday.date),
    name: holiday.name,
    type: holiday.type || "national",
  };
}

function isValidMonthDay(month, day) {
  return Number.isInteger(month) && month >= 1 && month <= 12 && Number.isInteger(day) && day >= 1 && day <= 31;
}

function normalizeHolidayConfig(rawConfig) {
  const config = rawConfig && typeof rawConfig === "object" ? rawConfig : {};
  return {
    fixed: Array.isArray(config.fixed)
      ? config.fixed.filter(
          (holiday) => holiday && isValidMonthDay(Number(holiday.month), Number(holiday.day)) && holiday.name
        )
      : [],
    movable: Array.isArray(config.movable)
      ? config.movable.filter(
          (holiday) => holiday && Number.isFinite(Number(holiday.offsetDays)) && holiday.name
        )
      : [],
    municipal: Array.isArray(config.municipal)
      ? config.municipal.filter(
          (holiday) => holiday && isValidMonthDay(Number(holiday.month), Number(holiday.day)) && holiday.name
        )
      : [],
    onlineSources: Array.isArray(config.onlineSources)
      ? config.onlineSources.filter((source) => source && typeof source.url === "string" && source.url)
      : [],
  };
}

function normalizeStoredHoliday(holiday) {
  if (!holiday) return null;

  const date =
    holiday.date instanceof Date
      ? holiday.date
      : typeof holiday.date === "string"
        ? parseDateInput(holiday.date)
        : null;

  if (!date || Number.isNaN(date.getTime())) {
    return null;
  }

  return {
    date,
    name: holiday.name || "Holiday",
    type: holiday.type || "national",
  };
}

function setHolidayConfigUnavailable(message) {
  holidaySourceLabel.textContent = message;
  summary.innerHTML = '<div class="summary-item error"><strong>Load holidays.json to continue.</strong></div>';
  calendar.innerHTML = '<p class="empty-state">Holiday configuration is required before the calendar can be calculated.</p>';
}

function getHolidayConfigLoadHelpMessage() {
  return window.location.protocol === "file:"
    ? "Browser blocked automatic local JSON loading over file://. Choose holidays.json to continue."
    : "Holiday rules could not be loaded from holidays.json.";
}

function recordHolidaySnapshot(year, source, holidays, updatedAt = new Date().toISOString()) {
  latestHolidaySnapshot = {
    year,
    source,
    updatedAt,
    holidays: holidays.map(serializeHoliday),
  };
}

function applyHolidayConfig(rawConfig, source, fileName = "holidays.json") {
  holidayConfig = normalizeHolidayConfig(rawConfig);
  holidayConfigSource = source;
  holidayConfigFileName = fileName;
  return holidayConfig;
}

async function readHolidayConfigFromFile(file) {
  const text = await file.text();
  const parsed = JSON.parse(text);
  return applyHolidayConfig(parsed, "picker", file.name || "holidays.json");
}

async function loadHolidayConfig() {
  if (holidayConfig) {
    return holidayConfig;
  }

  try {
    const response = await fetch(holidayConfigUrl, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to load ${holidayConfigUrl}: ${response.status}`);
    }

    return applyHolidayConfig(await response.json(), "json", "holidays.json");
  } catch (error) {
    console.warn(error);
    holidayConfigSource = "unavailable";
    throw new Error("holidays.json could not be loaded automatically.");
  }
}

function buildLocalHolidayList(year, config) {
  const holidays = [];
  const fixed = config.fixed || [];
  const movable = config.movable || [];
  const municipal = config.municipal || [];

  fixed.forEach((holiday) => {
    holidays.push({
      date: localDate(year, holiday.month, holiday.day),
      name: holiday.name,
      type: holiday.type || "national",
    });
  });

  const easter = getEasterSunday(year);
  movable.forEach((holiday) => {
    holidays.push({
      date: addDays(easter, holiday.offsetDays),
      name: holiday.name,
      type: holiday.type || "national",
    });
  });

  municipal.forEach((holiday) => {
    holidays.push({
      date: localDate(year, holiday.month, holiday.day),
      name: holiday.name,
      type: holiday.type || "municipal",
    });
  });

  return holidays;
}

async function fetchOnlineHolidayList(year, config) {
  const sources = config.onlineSources || [];
  const source = sources.find((entry) => entry.url) || null;
  if (!source) {
    return [];
  }

  const response = await fetch(source.url.replace("{year}", String(year)));
  if (!response.ok) {
    throw new Error(`Failed to load holiday data from ${source.name || source.url}`);
  }

  const payload = await response.json();
  return payload
    .filter((item) => item && item.date)
    .filter((item) => item.global !== false)
    .map((item) => {
      const [itemYear, itemMonth, itemDay] = item.date.split("-").map(Number);
      return {
        date: localDate(itemYear, itemMonth, itemDay),
        name: item.name || item.localName || "Holiday",
        type: item.type === "Public" ? "national" : item.type || "national",
      };
    })
    .filter((holiday) => holiday.date && !Number.isNaN(holiday.date.getTime()));
}

function cacheKeyForHolidayYear(year) {
  return `${holidayCachePrefix}:${year}`;
}

function readCachedHolidayYear(year) {
  try {
    const raw = localStorage.getItem(cacheKeyForHolidayYear(year));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.holidays)) return null;
    const holidays = parsed.holidays.map(normalizeStoredHoliday).filter(Boolean);
    if (!holidays.length) return null;
    return {
      ...parsed,
      holidays,
    };
  } catch {
    return null;
  }
}

function writeCachedHolidayYear(year, payload) {
  try {
    localStorage.setItem(cacheKeyForHolidayYear(year), JSON.stringify(payload));
  } catch {
    // Ignore storage failures; the runtime cache still keeps the data for this session.
  }
}

function downloadJsonFile(filename, payload) {
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function chooseHolidayConfigFile() {
  holidayConfigPicker.value = "";
  holidayConfigPicker.click();
}

async function getPortugueseHolidays(year, { preferOnline = false } = {}) {
  const config = await loadHolidayConfig();

  if (!preferOnline) {
    const localHolidays = buildLocalHolidayList(year, config);
    const sourceLabel = holidayConfigSource === "picker" ? "selected holidays.json" : "local rules";
    recordHolidaySnapshot(year, sourceLabel, localHolidays);
    holidaySourceLabel.textContent =
      holidayConfigSource === "picker"
        ? `Using holiday rules from selected file: ${holidayConfigFileName}.`
        : "Using local holiday rules from holidays.json.";
    return localHolidays;
  }

  const cached = holidayRuntimeCache.get(year) || readCachedHolidayYear(year);
  if (cached?.holidays?.length) {
    recordHolidaySnapshot(year, cached.source, cached.holidays, cached.updatedAt);
    holidaySourceLabel.textContent = cached.updatedAt
      ? `Using ${cached.source} holidays updated ${new Intl.DateTimeFormat("en-GB", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(cached.updatedAt))}.`
      : `Using ${cached.source} holidays from cache.`;
    holidayRuntimeCache.set(year, cached);
    return cached.holidays;
  }

  const onlineHolidays = await fetchOnlineHolidayList(year, config);
  const municipal = buildLocalHolidayList(year, { fixed: [], movable: [], municipal: config.municipal || [] });
  const combined = [...onlineHolidays, ...municipal];
  const payload = {
    source: config.onlineSources?.[0]?.name || "online source",
    updatedAt: new Date().toISOString(),
    holidays: combined,
  };

  holidayRuntimeCache.set(year, payload);
  writeCachedHolidayYear(year, payload);
  recordHolidaySnapshot(year, payload.source, combined, payload.updatedAt);
  holidaySourceLabel.textContent = `Online holiday list refreshed ${new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(payload.updatedAt))}.`;
  return combined;
}

function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function countWeekdaysInMonth(year, month) {
  let count = 0;
  const daysInMonth = getDaysInMonth(year, month);
  for (let day = 1; day <= daysInMonth; day += 1) {
    if (!isWeekend(localDate(year, month, day))) count += 1;
  }
  return count;
}

function collectWorkingDayKeysInRange(start, end, year, month, holidayKeys = new Set()) {
  const rangeStart = start <= end ? start : end;
  const rangeEnd = start <= end ? end : start;
  const keys = new Set();

  for (let cursor = cloneDate(rangeStart); cursor <= rangeEnd; cursor = addDays(cursor, 1)) {
    if (cursor.getMonth() + 1 !== month || cursor.getFullYear() !== year) continue;
    if (isWeekend(cursor)) continue;
    if (holidayKeys.has(dateKey(cursor))) continue;
    keys.add(dateKey(cursor));
  }

  return keys;
}

function parseDateInput(value) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return localDate(year, month, day);
}

function wireDatePicker(input) {
  const openPicker = () => {
    if (typeof input.showPicker === "function") {
      input.showPicker();
    }
  };

  input.addEventListener("click", openPicker);
  input.addEventListener("focus", openPicker);
}

function makeDayOffRow(index) {
  const wrapper = document.createElement("div");
  wrapper.className = "day-off-row";
  wrapper.dataset.index = String(index);

  wrapper.innerHTML = `
    <div class="row-top">
      <strong>Day off ${index + 1}</strong>
      <button type="button" class="secondary remove-row">Remove</button>
    </div>
    <div class="row-grid">
      <label>
        Start
        <input type="date" class="day-off-start" />
      </label>
      <label>
        End
        <input type="date" class="day-off-end" />
      </label>
      <label>
        Note
        <input type="text" class="day-off-note" placeholder="Vacation, appointment, etc." />
      </label>
    </div>
  `;

  const removeButton = wrapper.querySelector(".remove-row");
  const startInput = wrapper.querySelector(".day-off-start");
  const endInput = wrapper.querySelector(".day-off-end");

  [startInput, endInput].forEach(wireDatePicker);

  const syncDateBounds = () => {
    const startValue = startInput.value;
    const endValue = endInput.value;
    if (startValue) {
      endInput.min = startValue;
    } else {
      endInput.removeAttribute("min");
    }
    if (startValue && endValue && endValue < startValue) {
      endInput.value = startValue;
      endInput.min = startValue;
    }
  };

  startInput.addEventListener("change", syncDateBounds);
  startInput.addEventListener("input", syncDateBounds);
  endInput.addEventListener("change", syncDateBounds);
  endInput.addEventListener("input", syncDateBounds);
  syncDateBounds();

  removeButton.addEventListener("click", () => {
    wrapper.remove();
    renumberRows(dayOffList, "Day off");
    scheduleCalculate();
  });

  return wrapper;
}

function getProjectPalette(index) {
  return projectColorPalette[index % projectColorPalette.length];
}

function applyProjectColor(row, index) {
  const { color, soft } = getProjectPalette(index);
  row.dataset.projectColor = color;
  row.dataset.projectSoftColor = soft;
  row.style.setProperty("--project-color", color);
  row.style.setProperty("--project-color-soft", soft);
}

function makeProjectRow(index) {
  const wrapper = document.createElement("div");
  wrapper.className = "project-row";
  wrapper.dataset.index = String(index);
  applyProjectColor(wrapper, index);

  wrapper.innerHTML = `
    <div class="row-top">
      <strong class="project-row-title">
        <span class="project-color-dot" aria-hidden="true"></span>
        <span>Project ${index + 1}</span>
      </strong>
      <button type="button" class="secondary remove-row">Remove</button>
    </div>
    <div class="row-grid">
      <label>
        Project name
        <input type="text" class="project-name" placeholder="Project ${index + 1}" />
      </label>
      <label>
        Hours
        <input type="number" class="project-hours" min="0" step="0.25" value="0" />
      </label>
      <label>
        Allocation %
        <input type="number" class="project-percent" min="0" max="100" step="0.1" value="0" />
      </label>
    </div>
  `;

  wrapper.querySelector(".remove-row").addEventListener("click", () => {
    wrapper.remove();
    renumberRows(projectList, "Project");
    projectCountInput.value = String(projectList.children.length || 1);
    scheduleCalculate();
  });

  return wrapper;
}

function renumberRows(container, label) {
  [...container.children].forEach((child, index) => {
    child.dataset.index = String(index);
    if (label === "Project") {
      applyProjectColor(child, index);
      const title = child.querySelector(".project-row-title");
      if (title) {
        title.innerHTML = `<span class="project-color-dot" aria-hidden="true"></span><span>${label} ${
          index + 1
        }</span>`;
      }
      const nameInput = child.querySelector(".project-name");
      if (nameInput) {
        nameInput.placeholder = `${label} ${index + 1}`;
      }
      return;
    }

    const heading = child.querySelector(".row-top strong");
    if (heading) heading.textContent = `${label} ${index + 1}`;
  });
}

function syncProjects(count) {
  const nextCount = Math.max(1, Number(count) || 1);
  while (projectList.children.length < nextCount) {
    projectList.appendChild(makeProjectRow(projectList.children.length));
  }
  while (projectList.children.length > nextCount) {
    projectList.lastElementChild.remove();
  }
  renumberRows(projectList, "Project");
  projectCountInput.value = String(nextCount);
}

function seedDefaults() {
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();

  monthNames.forEach((name, index) => {
    const option = document.createElement("option");
    option.value = String(index + 1);
    option.textContent = name;
    monthSelect.appendChild(option);
  });

  monthSelect.value = String(currentMonth);
  yearInput.value = String(currentYear);

  dayOffList.appendChild(makeDayOffRow(0));
  projectList.appendChild(makeProjectRow(0));
  projectList.appendChild(makeProjectRow(1));
}

function clampMonth(year, month) {
  let nextYear = year;
  let nextMonth = month;
  if (nextMonth < 1) {
    nextMonth = 12;
    nextYear -= 1;
  } else if (nextMonth > 12) {
    nextMonth = 1;
    nextYear += 1;
  }
  return { year: nextYear, month: nextMonth };
}

function shiftMonth(offset) {
  const currentYear = Number(yearInput.value);
  const currentMonth = Number(monthSelect.value);
  const next = clampMonth(currentYear, currentMonth + offset);
  yearInput.value = String(next.year);
  monthSelect.value = String(next.month);
  scheduleCalculate();
}

function buildMiniCalendar(year, month, label, selected = false, holidayKeys = new Set(), dayOffKeys = new Set()) {
  const daysInMonth = getDaysInMonth(year, month);
  const firstOfMonth = localDate(year, month, 1);
  const firstWeekStart = addDays(firstOfMonth, -(firstOfMonth.getDay() === 0 ? 6 : firstOfMonth.getDay() - 1));
  const today = new Date();
  const cells = [];
  let cursor = cloneDate(firstWeekStart);

  for (let week = 0; week < 6; week += 1) {
    for (let day = 0; day < 7; day += 1) {
      const inMonth = cursor.getMonth() + 1 === month && cursor.getFullYear() === year;
      const key = dateKey(cursor);
      const isToday =
        cursor.getFullYear() === today.getFullYear() &&
        cursor.getMonth() === today.getMonth() &&
        cursor.getDate() === today.getDate();
      const isHoliday = holidayKeys.has(key);
      const isDayOff = dayOffKeys.has(key);
      cells.push(`
        <span class="mini-day ${inMonth ? "in-month" : "out-month"} ${isToday ? "today" : ""} ${isHoliday ? "holiday" : ""} ${isDayOff ? "dayoff" : ""}">
          ${inMonth ? cursor.getDate() : ""}
        </span>
      `);
      cursor = addDays(cursor, 1);
    }
  }

  return `
    <article class="mini-calendar ${selected ? "selected" : ""}">
      <header>
        <strong>${label}</strong>
      </header>
      <div class="mini-weekdays">
        <span>S</span><span>T</span><span>Q</span><span>Q</span><span>S</span><span>S</span><span>D</span>
      </div>
      <div class="mini-grid">${cells.join("")}</div>
    </article>
  `;
}

function renderSidebar(year, month, holidays = [], dayOffEntries = []) {
  const holidayKeys = new Set(holidays.map((holiday) => dateKey(holiday.date)));
  const dayOffKeys = new Set();
  dayOffEntries.forEach((entry) => {
    collectWorkingDayKeysInRange(entry.start, entry.end, year, month, holidayKeys).forEach((key) =>
      dayOffKeys.add(key)
    );
  });

  sidebarMiniCalendars.innerHTML = `
    ${buildMiniCalendar(year, month, formatToolbarMonth(year, month), true, holidayKeys, dayOffKeys)}
  `;
}

function updateSidebarAllocation({
  year,
  month,
  dailyLimit,
  weekdayCapacityHours,
  holidays,
  dayOffEntries,
  projects,
}) {
  const holidayWeekdays = holidays.filter((holiday) => !isWeekend(holiday.date));
  const holidayKeys = new Set(holidays.map((holiday) => dateKey(holiday.date)));
  const blockedDays = new Set();

  dayOffEntries.forEach((entry) => {
    collectWorkingDayKeysInRange(entry.start, entry.end, year, month, holidayKeys).forEach((key) =>
      blockedDays.add(key)
    );
  });

  const holidayHours = holidayWeekdays.length * dailyLimit;
  const dayOffHours = blockedDays.size * dailyLimit;
  const rows = holidayWeekdays.length
    ? [
        `
      <div class="allocation-item allocation-item-holiday">
        <span class="allocation-item-color" aria-hidden="true"></span>
        <div class="allocation-item-copy">
          <strong>Holidays</strong>
          <span>${formatHours(holidayHours)}</span>
        </div>
        <strong class="allocation-item-percent">${formatPercent(
          weekdayCapacityHours > 0 ? (holidayHours / weekdayCapacityHours) * 100 : 0
        )}</strong>
      </div>
    `,
      ]
    : [];

  projects.forEach((project) => {
    const percent = weekdayCapacityHours > 0 ? (project.hours / weekdayCapacityHours) * 100 : 0;
    rows.push(`
      <div class="allocation-item" style="--project-color: ${project.color}; --project-color-soft: ${project.softColor}">
        <span class="allocation-item-color" aria-hidden="true"></span>
        <div class="allocation-item-copy">
          <strong>${project.name}</strong>
          <span>${formatHours(project.hours)}</span>
        </div>
        <strong class="allocation-item-percent">${formatPercent(percent)}</strong>
      </div>
    `);
  });

  rows.push(`
    <div class="allocation-item allocation-item-muted">
      <span class="allocation-item-color" aria-hidden="true"></span>
      <div class="allocation-item-copy">
        <strong>Days off</strong>
        <span>${formatHours(dayOffHours)}</span>
      </div>
      <strong class="allocation-item-percent">${formatPercent(
        weekdayCapacityHours > 0 ? (dayOffHours / weekdayCapacityHours) * 100 : 0
      )}</strong>
    </div>
  `);

  allocationBreakdown.innerHTML = rows.join("");
}

function updateSidebarCounts({ availableDays, holidays, dayOffEntries, projects, year, month }) {
  const projectHours = projects.length;
  const holidayKeys = new Set(holidays.map((holiday) => dateKey(holiday.date)));
  const blockedDays = new Set();
  dayOffEntries.forEach((entry) => {
    collectWorkingDayKeysInRange(entry.start, entry.end, year, month, holidayKeys).forEach((key) =>
      blockedDays.add(key)
    );
  });
  timesheetCountLabel.textContent = String(availableDays.length);
  holidayCountLabel.textContent = String(holidays.length);
  daysOffCountLabel.textContent = String(blockedDays.size);
  projectCountLabel.textContent = String(projectHours);
}

function readDayOffEntries(selectedYear, selectedMonth) {
  const monthStart = localDate(selectedYear, selectedMonth, 1);
  const monthEnd = localDate(selectedYear, selectedMonth, getDaysInMonth(selectedYear, selectedMonth));
  const entries = [];

  [...dayOffList.children].forEach((row, index) => {
    const note = row.querySelector(".day-off-note").value.trim();
    const start = parseDateInput(row.querySelector(".day-off-start").value);
    const end = parseDateInput(row.querySelector(".day-off-end").value);
    if (!start || !end) return;

    const rangeStart = start <= end ? start : end;
    const rangeEnd = start <= end ? end : start;
    if (rangeEnd < monthStart || rangeStart > monthEnd) return;

    entries.push({
      key: `${rangeStart.toISOString().slice(0, 10)}-${rangeEnd
        .toISOString()
        .slice(0, 10)}-${index}`,
      start: rangeStart,
      end: rangeEnd,
      note,
    });
  });

  return entries;
}

function readProjects() {
  const projects = [];
  [...projectList.children].forEach((row, index) => {
    const name = row.querySelector(".project-name").value.trim() || `Project ${index + 1}`;
    const hours = Number(row.querySelector(".project-hours").value);
    const percent = Number(row.querySelector(".project-percent").value);
    if ((!Number.isFinite(hours) || hours < 0) && (!Number.isFinite(percent) || percent < 0)) {
      return;
    }
    if (hours === 0 && percent === 0 && !name) return;
    projects.push({
      name,
      hours,
      percent,
      remaining: hours,
      order: index,
      color: row.dataset.projectColor || getProjectPalette(index).color,
      softColor: row.dataset.projectSoftColor || getProjectPalette(index).soft,
    });
  });
  return projects;
}

function resolveProjectTargets(projects, availableHours) {
  return projects.map((project) => {
    const targetHours =
      Number.isFinite(project.hours) && project.hours > 0
        ? project.hours
        : Number.isFinite(project.percent) && project.percent > 0
          ? (availableHours * project.percent) / 100
          : 0;

    return {
      ...project,
      hours: targetHours,
      remaining: targetHours,
    };
  });
}

async function buildAvailableDays(year, month, dayOffEntries, { preferOnlineHolidays = false } = {}) {
  const holidays = (await getPortugueseHolidays(year, { preferOnline: preferOnlineHolidays })).filter(
    (holiday) => holiday.date.getMonth() + 1 === month
  );
  const holidayLookup = new Map();
  holidays.forEach((holiday) => {
    holidayLookup.set(dateKey(holiday.date), holiday);
  });

  const blocked = new Map();
  dayOffEntries.forEach((entry) => {
    collectWorkingDayKeysInRange(entry.start, entry.end, year, month, new Set(holidayLookup.keys())).forEach(
      (key) => {
        blocked.set(key, entry.note || "Day off");
      }
    );
  });

  const availableDays = [];
  const daysInMonth = getDaysInMonth(year, month);

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = localDate(year, month, day);
    if (isWeekend(date)) continue;

    const holiday = holidayLookup.get(dateKey(date));
    if (holiday) continue;

    const dayOffReason = blocked.get(dateKey(date));
    if (dayOffReason) continue;

    availableDays.push(date);
  }

  return {
    holidays,
    availableDays,
    blocked,
  };
}

function pickSingleProject(projects, dailyLimit) {
  const eligible = projects
    .filter((project) => project.remaining >= dailyLimit)
    .sort((a, b) => {
      if (b.remaining !== a.remaining) return b.remaining - a.remaining;
      return a.order - b.order;
    });

  return eligible[0] || null;
}

function allocateHours(year, month, dailyLimit, availableDays, projects) {
  const schedule = [];
  const unallocatedProjects = [];

  availableDays.forEach((date) => {
    const totalRemaining = projects.reduce((sum, project) => sum + project.remaining, 0);
    if (totalRemaining <= 0) {
      schedule.push({ date, allocations: [], empty: true });
      return;
    }

    const singleProject = pickSingleProject(projects, dailyLimit);
    if (singleProject) {
      singleProject.remaining -= dailyLimit;
      schedule.push({
        date,
        allocations: [
          {
            name: singleProject.name,
            hours: dailyLimit,
            color: singleProject.color,
            softColor: singleProject.softColor,
          },
        ],
        empty: false,
      });
      return;
    }

    let remainingCapacity = dailyLimit;
    const allocations = [];
    for (const project of projects) {
      if (remainingCapacity <= 0) break;
      if (project.remaining <= 0) continue;
      const take = Math.min(remainingCapacity, project.remaining);
      project.remaining -= take;
      remainingCapacity -= take;
      allocations.push({ name: project.name, hours: take, color: project.color, softColor: project.softColor });
    }

    schedule.push({
      date,
      allocations,
      empty: allocations.length === 0,
    });
  });

  projects.forEach((project) => {
    if (project.remaining > 0) {
      unallocatedProjects.push({
        name: project.name,
        hours: project.remaining,
      });
    }
  });

  return { schedule, unallocatedProjects };
}

function renderSummary({
  year,
  month,
  holidays,
  availableDays,
  dayOffEntries,
  projectHours,
  dailyLimit,
  allocationResult,
}) {
  const totalWeekdays = (() => {
    let count = 0;
    const daysInMonth = getDaysInMonth(year, month);
    for (let day = 1; day <= daysInMonth; day += 1) {
      if (!isWeekend(localDate(year, month, day))) count += 1;
    }
    return count;
  })();

  const holidayWeekdays = holidays.filter((holiday) => !isWeekend(holiday.date));
  const availableHours = availableDays.length * dailyLimit;
  const utilizedHours = Math.min(projectHours, availableHours);
  const freeCapacity = Math.max(0, availableHours - projectHours);

  const cards = [
    { label: "Working days", value: String(availableDays.length) },
    { label: "Weekdays in month", value: String(totalWeekdays) },
    { label: "Holidays excluded", value: String(holidayWeekdays.length) },
    {
      label: "Holiday dates",
      value:
        holidayWeekdays
          .map((holiday) => `${holiday.name} (${formatMonthDay(holiday.date)})`)
          .join(", ") || "None",
    },
    { label: "Days off entries", value: String(dayOffEntries.length) },
    { label: "Available hours", value: `${availableHours.toFixed(2).replace(/\.00$/, "")}h` },
    { label: "Project hours", value: `${projectHours.toFixed(2).replace(/\.00$/, "")}h` },
    { label: "Used hours", value: `${utilizedHours.toFixed(2).replace(/\.00$/, "")}h` },
    { label: "Free capacity", value: `${freeCapacity.toFixed(2).replace(/\.00$/, "")}h` },
  ];

  summary.innerHTML = cards
    .map(
      (card) => `
        <div class="summary-item">
          <span>${card.label}</span>
          <strong>${card.value}</strong>
        </div>
      `
    )
    .join("");

  if (allocationResult.unallocatedProjects.length) {
    const overflow = allocationResult.unallocatedProjects
      .map((project) => `${project.name}: ${project.hours.toFixed(2).replace(/\.00$/, "")}h`)
      .join(", ");
    summary.insertAdjacentHTML(
      "beforeend",
      `
        <div class="summary-item error">
          <span>Unallocated project hours</span>
          <strong>${overflow}</strong>
        </div>
      `
    );
  }
}

function renderCalendar(schedule, holidays, blocked, year, month) {
  const holidayMap = new Map(holidays.map((holiday) => [dateKey(holiday.date), holiday]));
  const scheduleMap = new Map(schedule.map((day) => [dateKey(day.date), day]));
  const daysInMonth = getDaysInMonth(year, month);
  const firstOfMonth = localDate(year, month, 1);
  const firstWeekStart = addDays(firstOfMonth, -(firstOfMonth.getDay() === 0 ? 6 : firstOfMonth.getDay() - 1));

  const weekLabels = [
    "segunda-feira",
    "terça-feira",
    "quarta-feira",
    "quinta-feira",
    "sexta-feira",
    "sábado",
    "domingo",
  ];
  const weeks = [];
  let cursor = cloneDate(firstWeekStart);
  const lastOfMonth = localDate(year, month, daysInMonth);
  const today = new Date();

  while (cursor <= lastOfMonth || cursor.getMonth() + 1 === month) {
    const week = [];
    for (let i = 0; i < 7; i += 1) {
      const date = cloneDate(cursor);
      const inMonth = date.getMonth() + 1 === month && date.getFullYear() === year;
      const holiday = holidayMap.get(dateKey(date));
      const day = scheduleMap.get(dateKey(date));
      const blockedReason = blocked.get(dateKey(date));
      week.push({ date, inMonth, holiday, day, blockedReason });
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  }

  const hasAnyDay = schedule.length > 0;
  if (!hasAnyDay) {
    calendar.innerHTML = '<p class="empty-state">No available workdays to allocate.</p>';
    return;
  }

  calendar.innerHTML = `
    <div class="week-view">
      <div class="weekday-headers">
        ${weekLabels.map((label) => `<div class="weekday-header">${label}</div>`).join("")}
      </div>
      <div class="week-rows">
        ${weeks
          .map(
            (week) => `
              <div class="week-row">
                ${week
                  .map(({ date, inMonth, holiday, day, blockedReason }) => {
                    const allocations = (day?.allocations || [])
                      .map(
                        (item) => `
                          <div class="allocation-row" style="--project-color: ${item.color}; --project-color-soft: ${item.softColor}">
                            <span>${item.name}</span>
                            <strong>${item.hours.toFixed(2).replace(/\.00$/, "")}h</strong>
                          </div>
                        `
                      )
                      .join("");

                    const classes = [
                      "day-cell",
                      inMonth ? "in-month" : "out-month",
                      holiday ? "holiday" : "",
                      blockedReason ? "dayoff" : "",
                      date.getFullYear() === today.getFullYear() &&
                      date.getMonth() === today.getMonth() &&
                      date.getDate() === today.getDate()
                        ? "today"
                        : "",
                      day?.allocations?.length ? "allocated" : "",
                    ]
                      .filter(Boolean)
                      .join(" ");

                    const statusLabel = holiday
                      ? `<span class="tag warn">${holiday.name}</span>`
                      : day?.allocations?.length
                        ? `<span class="tag success">${day.allocations.length === 1 ? "Allocated" : "Mixed"}</span>`
                        : inMonth
                          ? `<span class="tag">No hours</span>`
                          : "";

                    return `
                      <div class="${classes}">
                        <header class="day-cell-head">
                          <div>
                            <strong>${formatLongWeekday(date)}</strong>
                            <span>${date.getDate()}</span>
                          </div>
                          ${statusLabel}
                        </header>
                        <div class="day-cell-body">
                          ${
                            !inMonth
                              ? '<p class="empty-state">Outside month</p>'
                              : holiday
                                ? `<p class="empty-state">Holiday: ${holiday.name}</p>`
                                : day
                                  ? allocations || '<p class="empty-state">No project hours assigned.</p>'
                                  : isWeekend(date)
                                    ? '<p class="empty-state">Weekend</p>'
                                    : blockedReason
                                      ? `<p class="empty-state">Day off${blockedReason ? `: ${blockedReason}` : ""}</p>`
                                      : '<p class="empty-state">No project hours assigned.</p>'
                          }
                        </div>
                      </div>
                    `;
                  })
                  .join("")}
              </div>
            `
          )
          .join("")}
      </div>
    </div>
  `;
}

async function calculate({ preferOnlineHolidays = false } = {}) {
  const year = Number(yearInput.value);
  const month = Number(monthSelect.value);
  const dailyLimit = Math.max(1, Number(dailyLimitInput.value) || 8);

  if (!year || !month) {
    summary.innerHTML = '<div class="summary-item error"><strong>Select a month and year.</strong></div>';
    calendar.innerHTML = "";
    return;
  }

  const projects = readProjects();
  if (!projects.length) {
    summary.innerHTML = '<div class="summary-item error"><strong>Add at least one project.</strong></div>';
    calendar.innerHTML = "";
    return;
  }

  const dayOffEntries = readDayOffEntries(year, month);
  const { holidays, availableDays, blocked } = await buildAvailableDays(year, month, dayOffEntries, {
    preferOnlineHolidays,
  });
  const availableHours = availableDays.length * dailyLimit;
  const weekdayCapacityHours = countWeekdaysInMonth(year, month) * dailyLimit;
  const projectClones = resolveProjectTargets(projects, availableHours);
  const allocationResult = allocateHours(year, month, dailyLimit, availableDays, projectClones);

  renderSummary({
    year,
    month,
    holidays,
    availableDays,
    dayOffEntries,
    projectHours: projectClones.reduce((sum, project) => sum + project.hours, 0),
    dailyLimit,
    allocationResult,
  });
  renderCalendar(allocationResult.schedule, holidays, blocked, year, month);
  renderSidebar(year, month, holidays, dayOffEntries);
  updateSidebarAllocation({
    year,
    month,
    dailyLimit,
    weekdayCapacityHours,
    holidays,
    dayOffEntries,
    projects: projectClones,
  });
  updateSidebarCounts({
    availableDays,
    holidays,
    dayOffEntries,
    projects,
    year,
    month,
  });
  toolbarTitle.textContent = formatToolbarMonth(year, month);
}

function scheduleCalculate() {
  if (calculateTimer) {
    clearTimeout(calculateTimer);
  }
  calculateTimer = setTimeout(() => {
    calculateTimer = null;
    calculate().catch((error) => {
      console.error(error);
      setHolidayConfigUnavailable(error.message || "Holiday configuration could not be loaded.");
    });
  }, 80);
}

document.getElementById("addDayOff").addEventListener("click", () => {
  dayOffList.appendChild(makeDayOffRow(dayOffList.children.length));
  scheduleCalculate();
});

monthSelect.addEventListener("change", scheduleCalculate);
yearInput.addEventListener("change", scheduleCalculate);
dailyLimitInput.addEventListener("change", scheduleCalculate);
prevMonthButton.addEventListener("click", () => shiftMonth(-1));
nextMonthButton.addEventListener("click", () => shiftMonth(1));
chooseHolidaysButton.addEventListener("click", () => {
  chooseHolidayConfigFile();
});
holidayConfigPicker.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    await readHolidayConfigFromFile(file);
    holidaySourceLabel.textContent = `Loaded holiday rules from selected file: ${holidayConfigFileName}.`;
    scheduleCalculate();
  } catch (error) {
    console.error(error);
    setHolidayConfigUnavailable("The selected holidays.json file could not be parsed.");
  }
});
refreshHolidaysButton.addEventListener("click", () => {
  refreshHolidaysButton.disabled = true;
  holidaySourceLabel.textContent = "Refreshing holidays from the online source...";
  calculate({ preferOnlineHolidays: true })
    .catch((error) => {
      console.error(error);
      setHolidayConfigUnavailable(error.message || "Online refresh failed.");
    })
    .finally(() => {
      refreshHolidaysButton.disabled = false;
    });
});
downloadHolidaysButton.addEventListener("click", async () => {
  downloadHolidaysButton.disabled = true;

  try {
    const config = await loadHolidayConfig();
    downloadJsonFile(holidayConfigFileName || "holidays.json", config);
    holidaySourceLabel.textContent = "Downloaded holiday rules file.";
  } catch (error) {
    console.error(error);
    holidaySourceLabel.textContent = "Holiday export failed.";
  } finally {
    downloadHolidaysButton.disabled = false;
  }
});
projectCountInput.addEventListener("change", () => {
  syncProjects(projectCountInput.value);
  scheduleCalculate();
});
dayOffList.addEventListener("input", scheduleCalculate);
dayOffList.addEventListener("change", scheduleCalculate);
projectList.addEventListener("input", scheduleCalculate);
projectList.addEventListener("change", scheduleCalculate);

seedDefaults();
loadHolidayConfig()
  .then(() => calculate())
  .catch((error) => {
    console.error(error);
    setHolidayConfigUnavailable(getHolidayConfigLoadHelpMessage());
  });

if (window.location.protocol === "file:") {
  setHolidayConfigUnavailable(getHolidayConfigLoadHelpMessage());
}
