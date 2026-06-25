const monthSelect = document.getElementById("month");
const yearInput = document.getElementById("year");
const dailyLimitInput = document.getElementById("dailyLimit");
const dayOffList = document.getElementById("dayOffList");
const projectList = document.getElementById("projectList");
const projectCountInput = document.getElementById("projectCount");
const summary = document.getElementById("summary");
const calendar = document.getElementById("calendar");
let calculateTimer = null;

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const fixedPortugueseHolidays = [
  { month: 1, day: 1, name: "New Year" },
  { month: 4, day: 25, name: "Freedom Day" },
  { month: 5, day: 1, name: "Labour Day" },
  { month: 6, day: 10, name: "Portugal Day" },
  { month: 8, day: 15, name: "Assumption of Mary" },
  { month: 10, day: 5, name: "Republic Day" },
  { month: 11, day: 1, name: "All Saints' Day" },
  { month: 12, day: 1, name: "Restoration of Independence" },
  { month: 12, day: 8, name: "Immaculate Conception" },
  { month: 12, day: 25, name: "Christmas Day" },
];

function localDate(year, month, day) {
  return new Date(year, month - 1, day, 12);
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function formatDate(date) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatMonthDay(date) {
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatWeekday(date) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
  }).format(date);
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

function getPortugueseHolidays(year) {
  const easter = getEasterSunday(year);
  const holidays = fixedPortugueseHolidays.map((holiday) => ({
    date: localDate(year, holiday.month, holiday.day),
    name: holiday.name,
    type: "national",
  }));

  holidays.push({
    date: addDays(easter, -2),
    name: "Good Friday",
    type: "national",
  });

  holidays.push({
    date: addDays(easter, 60),
    name: "Corpus Christi",
    type: "national",
  });

  holidays.push({
    date: localDate(year, 6, 13),
    name: "Lisbon municipal holiday",
    type: "municipal",
  });

  return holidays;
}

function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function parseDateInput(value) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return localDate(year, month, day);
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
        Type
        <select class="day-off-type">
          <option value="single">Single day</option>
          <option value="range">Date range / week</option>
        </select>
      </label>
      <label class="single-field">
        Date
        <input type="date" class="day-off-start" />
      </label>
      <label class="range-field" hidden>
        Start
        <input type="date" class="day-off-range-start" />
      </label>
      <label class="range-field" hidden>
        End
        <input type="date" class="day-off-range-end" />
      </label>
      <label>
        Note
        <input type="text" class="day-off-note" placeholder="Vacation, appointment, etc." />
      </label>
    </div>
  `;

  const typeSelect = wrapper.querySelector(".day-off-type");
  const singleField = wrapper.querySelector(".single-field");
  const rangeFields = wrapper.querySelectorAll(".range-field");
  const removeButton = wrapper.querySelector(".remove-row");

  typeSelect.addEventListener("change", () => {
    const isRange = typeSelect.value === "range";
    singleField.hidden = isRange;
    rangeFields.forEach((field) => {
      field.hidden = !isRange;
    });
  });

  removeButton.addEventListener("click", () => {
    wrapper.remove();
    renumberRows(dayOffList, "Day off");
  });

  return wrapper;
}

function makeProjectRow(index) {
  const wrapper = document.createElement("div");
  wrapper.className = "project-row";
  wrapper.dataset.index = String(index);

  wrapper.innerHTML = `
    <div class="row-top">
      <strong>Project ${index + 1}</strong>
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
    </div>
  `;

  wrapper.querySelector(".remove-row").addEventListener("click", () => {
    wrapper.remove();
    renumberRows(projectList, "Project");
    projectCountInput.value = String(projectList.children.length || 1);
  });

  return wrapper;
}

function renumberRows(container, label) {
  [...container.children].forEach((child, index) => {
    const heading = child.querySelector(".row-top strong");
    if (heading) heading.textContent = `${label} ${index + 1}`;
    child.dataset.index = String(index);
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

function readDayOffEntries(selectedYear, selectedMonth) {
  const monthStart = localDate(selectedYear, selectedMonth, 1);
  const monthEnd = localDate(selectedYear, selectedMonth, getDaysInMonth(selectedYear, selectedMonth));
  const entries = [];

  [...dayOffList.children].forEach((row, index) => {
    const type = row.querySelector(".day-off-type").value;
    const note = row.querySelector(".day-off-note").value.trim();
    if (type === "single") {
      const date = parseDateInput(row.querySelector(".day-off-start").value);
      if (!date) return;
      if (date < monthStart || date > monthEnd) return;
      entries.push({
        key: `${date.toISOString().slice(0, 10)}-${index}`,
        start: date,
        end: date,
        note,
      });
      return;
    }

    const start = parseDateInput(row.querySelector(".day-off-range-start").value);
    const end = parseDateInput(row.querySelector(".day-off-range-end").value);
    if (!start || !end) return;

    const normalizedStart = start < end ? start : end;
    const normalizedEnd = start < end ? end : start;
    if (normalizedEnd < monthStart || normalizedStart > monthEnd) return;

    entries.push({
      key: `${normalizedStart.toISOString().slice(0, 10)}-${normalizedEnd
        .toISOString()
        .slice(0, 10)}-${index}`,
      start: normalizedStart,
      end: normalizedEnd,
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
    if (!Number.isFinite(hours) || hours < 0) {
      return;
    }
    if (hours === 0 && !name) return;
    projects.push({
      name,
      hours,
      remaining: hours,
      order: index,
    });
  });
  return projects;
}

function buildAvailableDays(year, month, dayOffEntries) {
  const holidays = getPortugueseHolidays(year).filter((holiday) => holiday.date.getMonth() + 1 === month);
  const holidayLookup = new Map();
  holidays.forEach((holiday) => {
    holidayLookup.set(dateKey(holiday.date), holiday);
  });

  const blocked = new Map();
  dayOffEntries.forEach((entry) => {
    for (
      let cursor = cloneDate(entry.start);
      cursor <= entry.end;
      cursor = addDays(cursor, 1)
    ) {
      if (cursor.getMonth() + 1 !== month) continue;
      if (cursor.getFullYear() !== year) continue;
      blocked.set(dateKey(cursor), entry.note || "Day off");
    }
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
        allocations: [{ name: singleProject.name, hours: dailyLimit }],
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
      allocations.push({ name: project.name, hours: take });
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
  projects,
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
  const projectHours = projects.reduce((sum, project) => sum + project.hours, 0);
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
    { label: "Days off entered", value: String(dayOffEntries.length) },
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

  const weekLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const weeks = [];
  let cursor = cloneDate(firstWeekStart);
  const lastOfMonth = localDate(year, month, daysInMonth);

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
                          <div class="allocation-row">
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
                      blockedReason ? "blocked" : "",
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
                            <strong>${formatWeekday(date)}</strong>
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
                                      ? `<p class="empty-state">${blockedReason}</p>`
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

function calculate() {
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
  const { holidays, availableDays, blocked } = buildAvailableDays(year, month, dayOffEntries);
  const projectClones = projects.map((project) => ({ ...project }));
  const allocationResult = allocateHours(year, month, dailyLimit, availableDays, projectClones);

  renderSummary({
    year,
    month,
    holidays,
    availableDays,
    dayOffEntries,
    projects,
    dailyLimit,
    allocationResult,
  });
  renderCalendar(allocationResult.schedule, holidays, blocked, year, month);
}

function scheduleCalculate() {
  if (calculateTimer) {
    clearTimeout(calculateTimer);
  }
  calculateTimer = setTimeout(() => {
    calculateTimer = null;
    calculate();
  }, 80);
}

document.getElementById("addDayOff").addEventListener("click", () => {
  dayOffList.appendChild(makeDayOffRow(dayOffList.children.length));
  scheduleCalculate();
});

document.getElementById("syncProjects").addEventListener("click", () => {
  syncProjects(projectCountInput.value);
  scheduleCalculate();
});

document.getElementById("calculate").addEventListener("click", calculate);
monthSelect.addEventListener("change", calculate);
yearInput.addEventListener("change", calculate);
dailyLimitInput.addEventListener("change", calculate);
projectCountInput.addEventListener("change", () => {
  syncProjects(projectCountInput.value);
  scheduleCalculate();
});
dayOffList.addEventListener("input", scheduleCalculate);
dayOffList.addEventListener("change", scheduleCalculate);
projectList.addEventListener("input", scheduleCalculate);
projectList.addEventListener("change", scheduleCalculate);

seedDefaults();
calculate();
