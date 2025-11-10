// Student Timetable Management
class StudentTimetable {
  constructor() {
    this.studentData = null;
    this.allTimetableEntries = []; // All recurring entries from DB
    this.allAlterations = []; // NEW: All date-specific alterations/suspensions
    this.filteredTimetableEntries = []; // Filtered recurring entries for display
    this.filteredAlterations = []; // NEW: Filtered alterations for display
    this.allSubjects = []; // To get subject names/codes
    this.allFaculty = []; // To get faculty names

    this.currentViewDate = new Date(); // Date for which timetable is displayed

    // Define fixed periods and lab blocks
    this.FIXED_PERIODS = [
      { id: 1, start: '09:15', end: '10:05', label: 'P1' },
      { id: 2, start: '10:05', end: '10:55', label: 'P2' },
      { id: 3, start: '10:55', end: '11:45', label: 'P3' },
      { id: 4, start: '11:45', end: '12:35', label: 'P4' },
      // Lunch Break 12:35-1:30
      { id: 5, start: '13:30', end: '14:20', label: 'P5' },
      { id: 6, start: '14:20', end: '15:10', label: 'P6' },
      { id: 7, start: '15:10', end: '16:00', label: 'P7' }
    ];

    this.LAB_BLOCKS = [
      { id: 101, start: '10:05', end: '12:35', label: 'Lab Block 1 (10:05 - 12:35)' }, // P2-P4
      { id: 102, start: '13:30', end: '16:00', label: 'Lab Block 2 (13:30 - 16:00)' }  // P5-P7
    ];

    this.init();
  }

  init() {
    if (!requireAuth() || !requireRole('student')) {
      return;
    }
    this.loadStudentData();
    this.setupDateNavigation(); // NEW
  }

  // NEW: Setup date navigation buttons
  setupDateNavigation() {
    const prevDayBtn = document.createElement('button');
    prevDayBtn.className = 'btn secondary btn-sm';
    prevDayBtn.innerHTML = '<span>&larr;</span> Previous Day';
    prevDayBtn.onclick = () => this.changeViewDate(-1);

    const nextDayBtn = document.createElement('button');
    nextDayBtn.className = 'btn secondary btn-sm';
    nextDayBtn.innerHTML = 'Next Day <span>&rarr;</span>';
    nextDayBtn.onclick = () => this.changeViewDate(1);

    const headerActions = document.querySelector('.header-actions');
    if (headerActions) {
      // Insert before the currentWeekRange span
      const currentWeekRangeSpan = document.getElementById('currentWeekRange');
      if (currentWeekRangeSpan) {
        headerActions.insertBefore(prevDayBtn, currentWeekRangeSpan);
        headerActions.insertBefore(nextDayBtn, currentWeekRangeSpan.nextSibling); // Insert after currentWeekRangeSpan
      } else {
        headerActions.appendChild(prevDayBtn);
        headerActions.appendChild(nextDayBtn);
      }
    }
  }

  // NEW: Change the current view date
  changeViewDate(days) {
    this.currentViewDate.setDate(this.currentViewDate.getDate() + days);
    this.loadTimetable(); // Reload timetable for the new date
  }

  loadStudentData() {
    try {
      const currentUser = getCurrentUser();
      this.studentData = campusDB.getStudentByUserId(currentUser.id);
      
      if (!this.studentData) {
        this.showAlert('Student data not found.', 'error');
        return;
      }

      this.allTimetableEntries = campusDB.getStorageData('timetables');
      this.allAlterations = campusDB.getStorageData('alterations'); // NEW: Fetch alterations
      this.allSubjects = campusDB.getStorageData('subjects');
      this.allFaculty = campusDB.getStorageData('faculty');

      this.loadTimetable();
    } catch (error) {
      console.error('Error loading student data for timetable:', error);
      this.showAlert('Error loading student data.', 'error');
    }
  }

  loadTimetable() {
    // Filter recurring timetable entries relevant to this student's class
    const filters = {
      branch: this.studentData.branch,
      year: this.studentData.year,
      semester: this.studentData.semester,
      section: this.studentData.section
    };
    this.filteredTimetableEntries = campusDB.getTimetableEntries(filters);
    
    // Filter alterations relevant to this student's class
    this.filteredAlterations = this.allAlterations.filter(alteration => {
      const originalEntry = this.filteredTimetableEntries.find(e => String(e.id) === String(alteration.timetableId));
      return originalEntry !== undefined; // Only alterations for recurring entries relevant to this student
    });

    this.timetableData = this.generateTimetableForDisplay(this.filteredTimetableEntries, this.filteredAlterations, this.currentViewDate);
    this.renderTimetable();
  }

  // NEW: generateTimetableForDisplay now accepts alterations and currentViewDate
  generateTimetableForDisplay(baseEntries, alterations, currentViewDate) {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const allDisplaySlots = [...this.FIXED_PERIODS, { id: 'lunch', start: '12:35', end: '13:30', label: 'Lunch Break' }]
        .sort((a, b) => a.start.localeCompare(b.start));

    const timetable = {}; // This will be timetable[day][period.start] = slotData
    days.forEach(day => {
        timetable[day] = {};
        allDisplaySlots.forEach(slot => {
            timetable[day][slot.start] = null; // Initialize as empty
        });
    });

    const currentViewDateString = currentViewDate.toISOString().split('T')[0];

    // Populate base entries and overlay alterations
    baseEntries.forEach(baseEntry => {
        const day = baseEntry.day_of_week;
        if (!day || !days.includes(day)) return;

        const startPeriod = allDisplaySlots.find(p => p.start === baseEntry.start_time);
        if (!startPeriod || startPeriod.id === 'lunch') {
            console.warn('generateTimetableForDisplay: Could not map start time or it is lunch for base entry', baseEntry);
            return;
        }

        // Check for alteration for this specific baseEntry on the current view date
        const appliedAlteration = alterations.find(alt =>
            String(alt.timetableId) === String(baseEntry.id) &&
            String(alt.date) === currentViewDateString
        );

        const slotData = {
            baseEntry: baseEntry,
            alteration: appliedAlteration,
        };

        // Place the slot data only in its starting slot
        timetable[day][startPeriod.start] = slotData;
    });

    // Add lunch breaks explicitly to the timetable structure
    const lunchSlot = allDisplaySlots.find(s => s.id === 'lunch');
    if (lunchSlot) {
        days.forEach(day => {
            timetable[day][lunchSlot.start] = { is_lunch: true, label: 'Lunch Break' };
        });
    }

    console.log('StudentTimetable: Generated Timetable Data:', timetable); // DIAGNOSTIC LOG
    return { days, periods: allDisplaySlots, timetable };
  }

  renderTimetable() {
    const container = document.getElementById('timetableContainer');
    const { days, periods, timetable } = this.timetableData; // periods here is allDisplaySlots

    // Determine grid columns dynamically: Day column + one column per period
    const gridColumnsStyle = `80px repeat(${periods.length}, 1fr)`;

    let timetableHTML = `
      <div class="timetable-grid" style="grid-template-columns: ${gridColumnsStyle};">
        <div class="timetable-header-cell">Day</div>
        ${periods.map(p => `<div class="timetable-header-cell">${p.label.split(' ')[0]}<br><small>${p.start}-${p.end}</small></div>`).join('')}
    `;

    const hasFilteredEntries = this.filteredTimetableEntries.length > 0;
    // For student timetable, filters are implicit from studentData, so no explicit UI filters to check
    const isAnyFilterActive = true; // Always consider active for student's own timetable

    // Update current view date display (this remains the same)
    const currentViewDateFormatted = this.currentViewDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const currentWeekRangeSpan = document.getElementById('currentWeekRange');
    if (currentWeekRangeSpan) {
      currentWeekRangeSpan.textContent = currentViewDateFormatted;
    }

    // Keep track of occupied cells for spanning
    const occupiedCells = new Set(); // Stores "dayIndex_periodIndex" for cells that are part of a span

    // Iterate through days (rows)
    days.forEach((day, dayIndex) => {
        timetableHTML += `<div class="timetable-day-row">`;
        timetableHTML += `<div class="timetable-header-cell">${day.substring(0, 3)}</div>`; // Day header cell

        // Iterate through periods (columns for this day)
        periods.forEach((period, periodIndex) => {
            const cellKey = `${dayIndex}_${periodIndex}`;
            if (occupiedCells.has(cellKey)) {
                // This cell is part of a previous span, so skip rendering a new cell here
                return;
            }

            const slotData = timetable[day]?.[period.start];

            if (slotData?.is_lunch) {
                timetableHTML += `<div class="timetable-class-cell lunch-break">Lunch</div>`;
            } else if (slotData) { // If there's any slot data (base entry or alteration)
                const entry = slotData.alteration || slotData.baseEntry; // Prioritize alteration for display
                const baseEntry = slotData.baseEntry; // Keep base entry for original details
                const subject = this.allSubjects.find(s => s.id === baseEntry.subject_id);

                let facultyIdToDisplay = entry.facultyIdNew || entry.current_faculty_id || entry.faculty_id;
                const faculty = this.allFaculty.find(f => String(f.id) === String(facultyIdToDisplay) || String(f.faculty_id) === String(facultyIdToDisplay));

                let cellClass = 'timetable-class-cell';
                let statusText = '';
                let statusColor = '';

                if (entry.alter_status === 'suspended') {
                    cellClass += ' suspended';
                    statusText = 'Suspended';
                    statusColor = 'var(--error-color)';
                } else if (entry.alter_status === 'altered') {
                    cellClass += ' altered';
                    statusText = `Altered to ${faculty?.name || 'N/A'}`;
                    statusColor = 'var(--warning-color)';
                } else {
                    statusText = 'Scheduled';
                    statusColor = 'var(--primary)';
                }

                // HTML entity encode for title attribute - REMOVED REASON
                const titleText = `${subject?.name || 'N/A'} (${subject?.code || 'N/A'}) - ${faculty?.name || 'N/A'} - ${baseEntry.room_number} - Status: ${statusText}`;

                // Calculate column span for this class
                const endPeriodIndex = periods.findIndex(p => p.end === baseEntry.end_time);
                const columnSpan = (endPeriodIndex !== -1 && endPeriodIndex >= periodIndex) ? (endPeriodIndex - periodIndex + 1) : 1;

                // Mark cells as occupied for spanning
                for (let c = 0; c < columnSpan; c++) {
                    occupiedCells.add(`${dayIndex}_${periodIndex + c}`);
                }

                timetableHTML += `
                    <div class="${cellClass}" style="grid-column: span ${columnSpan}; border-left: 4px solid ${statusColor};"
                         title="${titleText.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}">
                        <span class="subject-name">${subject?.code || 'N/A'}</span>
                        <span class="class-details">${faculty?.name || 'N/A'}</span>
                        <span class="room-details">${baseEntry.room_number}</span>
                        <span style="font-size: 0.7rem; color: ${statusColor}; font-weight: 500;">${statusText}</span>
                        <!-- Removed reason display for students -->
                    </div>
                `;
            } else {
                // If it's an empty slot, render an empty cell
                timetableHTML += `<div class="timetable-class-cell empty">\u2014</div>`; // Display "\u2014" for empty slots
            }
        });
        timetableHTML += `</div>`;
    });

    // Handle "No classes found" messages (these should be outside the day/period loops)
    if (!hasFilteredEntries && isAnyFilterActive) {
        timetableHTML += `<div class="timetable-class-cell empty" style="grid-column: 1 / -1; padding: 40px; color: var(--gray-500);">No classes found for your class.</div>`;
    } else if (!hasFilteredEntries && !isAnyFilterActive) {
        timetableHTML += `<div class="timetable-class-cell empty" style="grid-column: 1 / -1; padding: 40px; color: var(--gray-500);">No timetable data available for your class.</div>`;
    }

    timetableHTML += `</div>`;
    container.innerHTML = timetableHTML;
  }

  showAlert(message, type) {
    const existingAlerts = document.querySelectorAll('#timetableAlert .alert');
    existingAlerts.forEach(alert => alert.remove());

    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    
    const alertContainer = document.getElementById('timetableAlert');
    alertContainer.innerHTML = ''; // Clear previous alerts
    alertContainer.appendChild(alert);
    alertContainer.style.display = 'block';

    setTimeout(() => {
      if (alert.parentNode) {
        alertContainer.style.display = 'none';
        alert.remove();
      }
    }, 5000);
  }
}

// Initialize when DOM is loaded
let studentTimetable;
document.addEventListener('DOMContentLoaded', () => {
  studentTimetable = new StudentTimetable();
});
