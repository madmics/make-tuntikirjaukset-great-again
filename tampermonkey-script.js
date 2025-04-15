// ==UserScript==
// @name         Work Time Calculator
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Calculate work time in Ultima
// @match        https://adminet.admicom.fi/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const fullWorkTime = 7.5; // hours   

  // Convert HH:MM to minutes
  function timeToMinutes(timeStr) {
    const [h, m] = timeStr.split(":").map(Number);
    return h * 60 + m;
  }

  // Convert minutes to HH:MM
  function minutesToTime(mins) {
    const h = Math.floor(mins / 60);
    const m = Math.round(mins) % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  function init() {
    // Find 'day rows'
    const collapsibles = document.querySelectorAll('[data-role="collapsible"]');
    if (!collapsibles.length) {
      console.log("No collapsible elements found.");
      return;
    }

    let timeEntries = null;
    let currentDayRow = null;

    // Find the collapsible that contains current date in it in 11.04.2025 format
    const today = new Date();
    const todayStr = `${String(today.getDate()).padStart(2, '0')}.${String(today.getMonth() + 1).padStart(2, '0')}.${today.getFullYear()}`;
    console.log("Today's date:", todayStr);
    for (let collapsible of collapsibles) {
      const headerText = collapsible.querySelector('.ui-collapsible-heading-toggle').textContent.trim();

      if (headerText.includes(todayStr)) {
        currentDayRow = collapsible;
        timeEntries = collapsible.querySelectorAll('[data-role="listview"] li');
        break;
      }
    }

    if (!timeEntries) {
      console.log("No timeEntries found.");
      return;
    }

    if (!currentDayRow) {
      console.log("No currentDayRow found.");
      return;
    }

    console.log("timeEntries found:", timeEntries.length);

    let workedHours = 0;
    let ongoingTimeEntry = null;

    // Iterate through the timestamp rows
    for (let timeEntry of timeEntries) {
      console.log("Row:");

      // Extract time range using more specific selectors
      const timeRangeElement = timeEntry.querySelector('.ui-li-aside');
      const timeRangeText = timeRangeElement ? timeRangeElement.innerHTML.match(/\d{2}:\d{2}-\d{2}:\d{2}/) : "";
      const workedHoursElement = timeRangeElement ? timeRangeElement.querySelector('span.normal') : null;
      const workedHoursText = workedHoursElement ? workedHoursElement.textContent : "";

      console.log("  timeRange:", timeRangeText);
      console.log("  workedHours:", workedHoursText);

      if (timeRangeText !== null && workedHoursText.length) {
        workedHours += parseFloat(workedHoursText);
      }

      if (timeRangeElement && timeRangeElement.textContent.includes('Kesken')) {
        ongoingTimeEntry = timeEntry;
      }
    }

    // Find start time from last timestamp row
    let ongoingStartMinutes = 0;
    if (ongoingTimeEntry) {
      console.log("Ongoing row:");
      const timeText = ongoingTimeEntry.innerHTML;
      const startTimeMatch = timeText.match(/(\d{2}:\d{2})-/);

      if (startTimeMatch && startTimeMatch[1]) {
        const startTime = startTimeMatch[1];
        console.log("  Found start time:", startTime);
        ongoingStartMinutes = timeToMinutes(startTime);
      } else {
        console.log("  Start time not found");
      }
    } else {
      console.log("No ongoingTimeEntry found");
    }
    if (!ongoingStartMinutes) {
      // Use current time as fallback
      const now = new Date();
      ongoingStartMinutes = timeToMinutes(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
    }

    // Find dayRow header element
    const rowHeaderElement = currentDayRow.querySelector('a.ui-collapsible-heading-toggle');
    if (!rowHeaderElement) {
      console.log("No rowHeaderElement found.");
      return;
    }

    // Find kertymä
    const accumulatedHoursElement = document.querySelector('.ui-body p');
    if (!accumulatedHoursElement) {
      console.log("No accumulatedHoursElement found.");
      return;
    }
    const accumulatedHoursMatch = accumulatedHoursElement.textContent.match(/(-?\d+(?:\.\d{1,2})?)/);
    if (accumulatedHoursMatch === null) {
      console.log("No accumulated hours found.");
      return;
    }
    const accumulatedHoursRaw = parseFloat(accumulatedHoursMatch[1]);
    console.log("Accumulated hours raw:", accumulatedHoursRaw);
    const accumulatedHours =
      workedHours ?
        (fullWorkTime + accumulatedHoursRaw - workedHours).toFixed(2)
        :
        accumulatedHoursRaw;
    console.log("Accumulated hours:", accumulatedHours);

    // Calculate how many more minutes needed to reach full work time
    const neededMinutes = fullWorkTime * 60 - (workedHours * 60);
    const neededMinutesWithAccumulatedHours = neededMinutes - (accumulatedHours * 60);
    console.log("Needed minutes:", neededMinutes);
    console.log("Needed minutes with accumulated hours:", neededMinutesWithAccumulatedHours);
    const minutesToWork = ongoingStartMinutes + neededMinutes;
    const minutesToWorkWithAccumulatedHours = ongoingStartMinutes + neededMinutesWithAccumulatedHours;
    const workDoneAtTime = minutesToTime(minutesToWork);
    const workDoneAtTimeWithAccumulatedHours = minutesToTime(minutesToWorkWithAccumulatedHours);
    console.log("Work done at time:", workDoneAtTime);
    console.log("Work done at time with accumulated hours:", workDoneAtTimeWithAccumulatedHours);

    // Create result div
    const resultDiv = document.createElement('div');
    resultDiv.style.textAlign = 'right';
    resultDiv.style.color = 'orange';

    // Set the result text
    let resultText = "";
    if (neededMinutes > 0) {
      resultText = fullWorkTime + ` h reached at ${workDoneAtTime}`;
    } else {
      resultText = fullWorkTime + ` h done`;
    }
    if (neededMinutesWithAccumulatedHours > 0) {
      resultText += ` (${workDoneAtTimeWithAccumulatedHours})`;
    }
    resultDiv.textContent = resultText;

    // Append the result div to the row header
    rowHeaderElement.appendChild(resultDiv);
  }

  // HADLE PAGE LOAD
  // Case 1: If the page is already fully loaded
  if (document.readyState === 'complete') {
    init();
  } else {
    // Case 2: Wait for normal load event
    window.addEventListener('load', init, { once: true });
  }
  // Case 3: Handle back/forward cache (bfcache)
  window.addEventListener('pageshow', function (event) {
    if (event.persisted) {
      console.log('Page loaded from bfcache');
      init();
    }
  });
})();
