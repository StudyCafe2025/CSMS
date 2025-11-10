// Admin Timetable Management
class AdminTimetable {
  constructor() {
    this.allTimetableEntries = [];
    this.filteredTimetableEntries = [];
    this.allSubjects = [];
    this.allFaculty = [];
    this.allDepartments = []; // For branch dropdown

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
    if (!requireAuth() || !requireRole('admin')) {
      return;
    }
    this.loadData();
    this.setupEventListeners();
    this.setupDateNavigation(); // NEW
  }

  setupEventListeners() {
    // Main filter bar listeners
    document.getElementById('branchFilter').addEventListener('change', () => this.filterTimetable());
    document.getElementById('yearFilter').addEventListener('change', () => this.handleYearFilterChange());
    document.getElementById('semesterFilter').addEventListener('change', () => this.filterTimetable());
    document.getElementById('sectionFilter').addEventListener('change', () => this.filterTimetable());

    // Modal filter listeners
    document.getElementById('entryBranch').addEventListener('change', () => this.handleModalFilterChange());
    document.getElementById('entryYear').addEventListener('change', () => this.handleModalFilterChange());
    document.getElementById('entrySemester').addEventListener('change', () => this.handleModalFilterChange());
    document.getElementById('entrySection').addEventListener('change', () => this.handleModalFilterChange());
    document.getElementById('entrySubject').addEventListener('change', () => this.handleSubjectChangeInModal());
    document.getElementById('entryPeriodBlock').addEventListener('change', () => this.handlePeriodBlockChange());
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
    this.filterTimetable(); // Reload timetable for the new date
  }

  loadData() {
    try {
      this.allTimetableEntries = campusDB.getStorageData('timetables');
      this.allSubjects = campusDB.getStorageData('subjects');
      this.allFaculty = campusDB.getStorageData('faculty');
      this.allDepartments = campusDB.getStorageData('departments');

      this.populateFilterDropdowns();
      this.filterTimetable(); // Initial render
    } catch (error) {
      console.error('AdminTimetable: Error loading data:', error);
      this.showAlert('Error loading data', 'error');
    }
  }

  populateFilterDropdowns() {
    const branchFilter = document.getElementById('branchFilter');
    const entryBranch = document.getElementById('entryBranch');
    const facultySelect = document.getElementById('entryFaculty');

    const uniqueBranches = [...new Set(this.allDepartments.map(d => d.name))];
    branchFilter.innerHTML = '<option value="">All Branches</option>' + uniqueBranches.map(b => `<option value="${b}">${b}</option>`).join('');
    entryBranch.innerHTML = '<option value="">Select Branch</option>' + uniqueBranches.map(b => `<option value="${b}">${b}</option>`).join('');

    facultySelect.innerHTML = '<option value="">Select Faculty</option>' + this.allFaculty.map(f => `<option value="${f.id}">${f.name} (${f.faculty_id})</option>`).join('');

    // Initialize semester dropdowns as empty/disabled
    document.getElementById('semesterFilter').innerHTML = '<option value="">All Semesters</option>';
    document.getElementById('entrySemester').innerHTML = '<option value="">Select Semester</option>';
    document.getElementById('entrySemester').disabled = true;
    document.getElementById('entrySubject').innerHTML = '<option value="">Select Subject</option>';
    document.getElementById('entrySubject').disabled = true;

    // Populate period block dropdown in modal
    this.populatePeriodBlockDropdown();
  }

  handleYearFilterChange() {
    this.populateSemesterDropdownForFilter();
    this.filterTimetable();
  }

  populateSemesterDropdownForFilter() {
    const yearFilter = document.getElementById('yearFilter').value;
    const semesterFilter = document.getElementById('semesterFilter');
    const currentSemester = semesterFilter.value;
    semesterFilter.innerHTML = '<option value="">All Semesters</option>';

    if (yearFilter) {
      const year = parseInt(yearFilter);
      const maxSemesterForYear = year * 2;
      for (let i = 1; i <= maxSemesterForYear; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `Semester ${i}`;
        semesterFilter.appendChild(option);
      }
    }
    semesterFilter.value = currentSemester;
  }

  handleModalFilterChange() {
    const branch = document.getElementById('entryBranch').value;
    const year = document.getElementById('entryYear').value;
    const semester = document.getElementById('entrySemester').value;
    const section = document.getElementById('entrySection').value;

    this.populateSemesterDropdownForModal(year);
    this.populateSubjectDropdownForModal(branch, year, semester, section);
  }

  populateSemesterDropdownForModal(selectedYear) {
    const semesterSelect = document.getElementById('entrySemester');
    const currentSemester = semesterSelect.value;
    semesterSelect.innerHTML = '<option value="">Select Semester</option>';

    if (selectedYear) {
      const year = parseInt(selectedYear);
      const maxSemesterForYear = year * 2;
      for (let i = 1; i <= maxSemesterForYear; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `Semester ${i}`;
        semesterSelect.appendChild(option);
      }
      semesterSelect.disabled = false;
    } else {
      semesterSelect.disabled = true;
    }
    semesterSelect.value = currentSemester;
  }

  populateSubjectDropdownForModal(branch = '', year = '', semester = '', section = '') {
    const subjectSelect = document.getElementById('entrySubject');
    const currentSubjectId = subjectSelect.value;
    subjectSelect.innerHTML = '<option value="">Select Subject</option>';

    let filteredSubjects = this.allSubjects.filter(s => 
      (!branch || s.branch === branch) &&
      (!year || s.year == parseInt(year)) &&
      (!semester || s.semester == parseInt(semester))
    );

    // Further filter by class_offerings to ensure only subjects allocated to this class are shown
    const classOfferings = campusDB.getStorageData('class_offerings');
    filteredSubjects = filteredSubjects.filter(s => 
      classOfferings.some(co => 
        co.subject_id === s.id && 
        co.branch === s.branch && 
        co.year === s.year && 
        co.semester === s.semester && 
        co.section === section &&
        co.is_active // Only active class offerings
      )
    );

    filteredSubjects.sort((a, b) => a.name.localeCompare(b.name));

    if (filteredSubjects.length === 0) {
      subjectSelect.innerHTML = '<option value="">No Subjects Found for this Class</option>';
      subjectSelect.disabled = true;
    } else {
      subjectSelect.innerHTML = '<option value="">Select Subject</option>' + filteredSubjects.map(s => `<option value="${s.id}">${s.name} (${s.code})</option>`).join('');
      subjectSelect.disabled = false;
    }
    if (currentSubjectId) {
      subjectSelect.value = currentSubjectId;
    }
  }

  handleSubjectChangeInModal() {
    const subjectId = document.getElementById('entrySubject').value;
    const facultySelect = document.getElementById('entryFaculty');
    const periodBlockSelect = document.getElementById('entryPeriodBlock');
    
    if (!subjectId) {
      facultySelect.value = '';
      periodBlockSelect.value = ''; // Clear period block
      return;
    }

    const branch = document.getElementById('entryBranch').value;
    const year = parseInt(document.getElementById('entryYear').value);
    const semester = parseInt(document.getElementById('entrySemester').value);
    const section = document.getElementById('entrySection').value;

    // Find the class offering for this subject and class details
    const classOffering = campusDB.getStorageData('class_offerings').find(co =>
      co.subject_id == subjectId &&
      co.branch === branch &&
      co.year === year &&
      co.semester === semester &&
      co.section === section
    );

    if (classOffering && classOffering.faculty_id) {
      facultySelect.value = classOffering.faculty_id;
    } else {
      facultySelect.value = ''; // Clear if no faculty assigned or not found
    }

    // Update period block options based on subject type
    this.populatePeriodBlockDropdown(classOffering?.subject_type);
  }

  populatePeriodBlockDropdown(subjectType = '') {
    const periodBlockSelect = document.getElementById('entryPeriodBlock');
    const currentSelection = periodBlockSelect.value;
    periodBlockSelect.innerHTML = '<option value="">Select Period/Block</option>';

    if (subjectType === 'lab') {
      this.LAB_BLOCKS.forEach(block => {
        const option = document.createElement('option');
        option.value = `${block.start}-${block.end}`;
        option.textContent = block.label;
        periodBlockSelect.appendChild(option);
      });
    } else { // Default to theory periods
      this.FIXED_PERIODS.forEach(period => {
        const option = document.createElement('option');
        option.value = `${period.start}-${period.end}`;
        option.textContent = period.label;
        periodBlockSelect.appendChild(option);
      });
    }
    periodBlockSelect.value = currentSelection;
  }

  handlePeriodBlockChange() {
    const selectedBlock = document.getElementById('entryPeriodBlock').value;
    const startTimeInput = document.getElementById('entryStartTime');
    const endTimeInput = document.getElementById('entryEndTime');

    if (selectedBlock) {
      const [start, end] = selectedBlock.split('-');
      startTimeInput.value = start;
      endTimeInput.value = end;
    } else {
      startTimeInput.value = '';
      endTimeInput.value = '';
    }
  }

  filterTimetable() {
    const branchFilter = document.getElementById('branchFilter').value;
    const yearFilter = document.getElementById('yearFilter').value;
    const semesterFilter = document.getElementById('semesterFilter').value;
    const sectionFilter = document.getElementById('sectionFilter').value;
    // Removed dayFilter as it's no longer applicable for the vertical layout

    const filters = {
      branch: branchFilter,
      year: yearFilter,
      semester: semesterFilter,
      section: sectionFilter,
    };

    this.filteredTimetableEntries = campusDB.getTimetableEntries(filters);
    this.timetableData = this.generateTimetableForDisplay(this.filteredTimetableEntries, campusDB.getStorageData('alterations'), this.currentViewDate);
    this.renderTimetable();
    this.updateTotalCount();
  }

  // NEW: generateTimetableForDisplay for Admin
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

    baseEntries.forEach(baseEntry => {
        const day = baseEntry.day_of_week;
        if (!day || !days.includes(day)) return;

        const startPeriod = allDisplaySlots.find(p => p.start === baseEntry.start_time);
        if (!startPeriod || startPeriod.id === 'lunch') {
            console.warn('generateTimetableForDisplay: Could not map start time or it is lunch for base entry', baseEntry);
            return;
        }

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

    const lunchSlot = allDisplaySlots.find(s => s.id === 'lunch');
    if (lunchSlot) {
        days.forEach(day => {
            timetable[day][lunchSlot.start] = { is_lunch: true, label: 'Lunch Break' };
        });
    }

    return { days, periods: allDisplaySlots, timetable };
  }

  renderTimetable() {
    const container = document.getElementById('timetableContainer');
    const { days, periods, timetable } = this.timetableData;

    const gridColumnsStyle = `80px repeat(${periods.length}, 1fr)`;

    let timetableHTML = `
      <div class="timetable-grid" style="grid-template-columns: ${gridColumnsStyle};">
        <div class="timetable-header-cell">Day</div>
        ${periods.map(p => `<div class="timetable-header-cell">${p.label.split(' ')[0]}<br><small>${p.start}-${p.end}</small></div>`).join('')}
    `;

    const hasFilteredEntries = this.filteredTimetableEntries.length > 0;
    const isAnyFilterActive = document.getElementById('branchFilter').value || document.getElementById('yearFilter').value || document.getElementById('semesterFilter').value || document.getElementById('sectionFilter').value;

    // Update current view date display
    const currentViewDateFormatted = this.currentViewDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const currentWeekRangeSpan = document.getElementById('currentWeekRange');
    if (currentWeekRangeSpan) {
      currentWeekRangeSpan.textContent = currentViewDateFormatted;
    }

    // Keep track of occupied cells for spanning
    const occupiedCells = new Set(); // Stores "dayIndex_periodIndex" for cells that are part of a span

    days.forEach((day, dayIndex) => {
        timetableHTML += `<div class="timetable-day-row">`;
        timetableHTML += `<div class="timetable-header-cell">${day.substring(0, 3)}</div>`;

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
                const entry = slotData.alteration || slotData.baseEntry;
                const baseEntry = slotData.baseEntry;
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

                const sanitizedReason = entry.reason ? String(entry.reason).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';

                // Calculate column span for this class
                const endPeriodIndex = periods.findIndex(p => p.end === baseEntry.end_time);
                const columnSpan = (endPeriodIndex !== -1 && endPeriodIndex >= periodIndex) ? (endPeriodIndex - periodIndex + 1) : 1;

                // Mark cells as occupied for spanning
                for (let c = 0; c < columnSpan; c++) {
                    occupiedCells.add(`${dayIndex}_${periodIndex + c}`);
                }

                timetableHTML += `
                    <div class="${cellClass}" style="grid-column: span ${columnSpan}; border-left: 4px solid ${statusColor};"
                         title="${subject?.name || 'N/A'} (${subject?.code || 'N/A'}) - ${faculty?.name || 'N/A'} - ${baseEntry.room_number} - Status: ${statusText} ${sanitizedReason ? `(Reason: ${sanitizedReason})` : ''}">
                        <span class="subject-name">${subject?.code || 'N/A'}</span>
                        <span class="class-details">${baseEntry.branch} Y${baseEntry.year} S${baseEntry.semester} Sec ${baseEntry.section}</span>
                        <span class="room-details">${baseEntry.room_number} (${faculty?.name || 'N/A'})</span>
                        <span style="font-size: 0.7rem; color: ${statusColor}; font-weight: 500;">${statusText}</span>
                        ${sanitizedReason ? `<span style="font-size: 0.65rem; color: var(--gray-500);">Reason: ${sanitizedReason}</span>` : ''}
                        <div class="actions">
                            <button class="btn btn-primary btn-sm" onclick="adminTimetable.editTimetableEntry(${baseEntry.id})">\u270f\ufe0f</button>
                            <button class="btn btn-danger btn-sm" onclick="adminTimetable.deleteTimetableEntry(${baseEntry.id})">\ud83d\uddd1\ufe0f</button>
                        </div>
                    </div>
                `;
            } else {
                // If it's an empty slot, render an empty cell
                timetableHTML += `<div class="timetable-class-cell empty">\u2014</div>`;
            }
        });
        timetableHTML += `</div>`;
    });

    if (!hasFilteredEntries && isAnyFilterActive) {
        timetableHTML += `<div class="timetable-class-cell empty" style="grid-column: 1 / -1; padding: 40px; color: var(--gray-500);">No classes found for the selected filters. Try adjusting your criteria.</div>`;
    } else if (!hasFilteredEntries && !isAnyFilterActive) {
        timetableHTML += `<div class="timetable-class-cell empty" style="grid-column: 1 / -1; padding: 40px; color: var(--gray-500);">Use the filters above to view a specific class timetable.</div>`;
    }

    timetableHTML += `</div>`;
    container.innerHTML = timetableHTML;
  }

  updateTotalCount() {
    document.getElementById('totalTimetableEntries').textContent = `${this.filteredTimetableEntries.length} entries`;
  }

  showAddTimetableModal() {
    document.getElementById('timetableModalTitle').textContent = 'Add Timetable Entry';
    document.getElementById('timetableForm').reset();
    document.getElementById('timetableEntryId').value = '';
    
    // Reset dropdowns and disable dependent ones
    this.populateFilterDropdowns(); // Resets branch, faculty
    document.getElementById('entryYear').value = '';
    document.getElementById('entrySemester').innerHTML = '<option value="">Select Semester</option>';
    document.getElementById('entrySemester').disabled = true;
    document.getElementById('entrySection').value = '';
    document.getElementById('entrySubject').innerHTML = '<option value="">Select Subject</option>';
    document.getElementById('entrySubject').disabled = true;
    document.getElementById('entryStartTime').value = ''; // Clear hidden time inputs
    document.getElementById('entryEndTime').value = '';

    // Re-populate period block dropdown based on default (theory)
    this.populatePeriodBlockDropdown('theory');

    document.getElementById('timetableModal').style.display = 'flex';
  }

  editTimetableEntry(id) {
    const entry = this.allTimetableEntries.find(e => e.id === id);
    if (!entry) {
      this.showAlert('Timetable entry not found.', 'error');
      return;
    }

    document.getElementById('timetableModalTitle').textContent = 'Edit Timetable Entry';
    document.getElementById('timetableEntryId').value = entry.id;
    document.getElementById('entryBranch').value = entry.branch || '';
    document.getElementById('entryYear').value = entry.year || '';
    
    this.populateSemesterDropdownForModal(entry.year);
    document.getElementById('entrySemester').value = entry.semester || '';
    
    document.getElementById('entrySection').value = entry.section || '';
    
    // Get subject type to correctly populate period block dropdown
    const subject = this.allSubjects.find(s => s.id === entry.subject_id);
    this.populateSubjectDropdownForModal(entry.branch, entry.year, entry.semester, entry.section);
    document.getElementById('entrySubject').value = entry.subject_id || '';
    
    this.populatePeriodBlockDropdown(subject?.type); // Populate based on subject type
    document.getElementById('entryPeriodBlock').value = `${entry.start_time}-${entry.end_time}`; // Set selected block

    document.getElementById('entryFaculty').value = entry.faculty_id || '';
    document.getElementById('entryDayOfWeek').value = entry.day_of_week || '';
    document.getElementById('entryStartTime').value = entry.start_time || '';
    document.getElementById('entryEndTime').value = entry.end_time || '';
    document.getElementById('entryRoomNumber').value = entry.room_number || '';

    document.getElementById('timetableModal').style.display = 'flex';
  }

  saveTimetableEntry() {
    const entryId = document.getElementById('timetableEntryId').value;
    const formData = {
      day_of_week: document.getElementById('entryDayOfWeek').value,
      start_time: document.getElementById('entryStartTime').value,
      end_time: document.getElementById('entryEndTime').value,
      subject_id: parseInt(document.getElementById('entrySubject').value),
      branch: document.getElementById('entryBranch').value,
      year: parseInt(document.getElementById('entryYear').value),
      semester: parseInt(document.getElementById('entrySemester').value),
      section: document.getElementById('entrySection').value,
      faculty_id: parseInt(document.getElementById('entryFaculty').value),
      room_number: document.getElementById('entryRoomNumber').value
    };

    // Basic validation
    if (!formData.day_of_week || !formData.start_time || !formData.end_time ||
        isNaN(formData.subject_id) || !formData.branch || isNaN(formData.year) ||
        isNaN(formData.semester) || !formData.section || isNaN(formData.faculty_id) || !formData.room_number) {
      this.showAlert('Please fill all required fields.', 'error');
      return;
    }

    // Time validation
    if (formData.start_time >= formData.end_time) {
      this.showAlert('Start time must be before end time.', 'error');
      return;
    }

    // Check for lunch break conflict
    if ((formData.start_time < '13:30' && formData.end_time > '12:35') ||
        (formData.start_time === '12:35' && formData.end_time === '13:30')) {
        this.showAlert('Cannot schedule classes during lunch break (12:35 - 13:30).', 'error');
        return;
    }

    try {
      // Check for conflicts (same class, same day, overlapping time)
      const conflictingEntry = this.allTimetableEntries.find(e =>
        e.id != entryId && // Exclude current entry if editing
        e.day_of_week === formData.day_of_week &&
        e.branch === formData.branch &&
        e.year === formData.year &&
        e.semester === formData.semester &&
        e.section === formData.section &&
        (
          (formData.start_time < e.end_time && formData.end_time > e.start_time) // Overlap check
        )
      );

      if (conflictingEntry) {
        const subject = this.allSubjects.find(s => s.id === conflictingEntry.subject_id);
        this.showAlert(`Time conflict: This class already has an entry for ${conflictingEntry.day_of_week} from ${conflictingEntry.start_time} to ${conflictingEntry.end_time} for ${subject?.code || 'N/A'}.`, 'error');
        return;
      }

      // Check for faculty conflicts (same faculty, same day, overlapping time)
      const facultyConflictingEntry = this.allTimetableEntries.find(e =>
        e.id != entryId &&
        e.faculty_id === formData.faculty_id &&
        e.day_of_week === formData.day_of_week &&
        (
          (formData.start_time < e.end_time && formData.end_time > e.start_time)
        )
      );

      if (facultyConflictingEntry) {
        const subject = this.allSubjects.find(s => s.id === facultyConflictingEntry.subject_id);
        this.showAlert(`Faculty conflict: Assigned faculty is already teaching ${subject?.code || 'N/A'} on ${facultyConflictingEntry.day_of_week} from ${facultyConflictingEntry.start_time} to ${facultyConflictingEntry.end_time}.`, 'error');
        return;
      }

      // Check for room conflicts (same room, same day, overlapping time)
      const roomConflictingEntry = this.allTimetableEntries.find(e =>
        e.id != entryId &&
        e.room_number === formData.room_number &&
        e.day_of_week === formData.day_of_week &&
        (
          (formData.start_time < e.end_time && formData.end_time > e.start_time)
        )
      );

      if (roomConflictingEntry) {
        const subject = this.allSubjects.find(s => s.id === roomConflictingEntry.subject_id);
        this.showAlert(`Room conflict: Room ${formData.room_number} is already occupied by ${subject?.code || 'N/A'} on ${roomConflictingEntry.day_of_week} from ${roomConflictingEntry.start_time} to ${roomConflictingEntry.end_time}.`, 'error');
        return;
      }


      if (entryId) {
        campusDB.update('timetables', parseInt(entryId), formData);
        this.showAlert('Timetable entry updated successfully', 'success');
      } else {
        campusDB.create('timetables', formData);
        this.showAlert('Timetable entry added successfully', 'success');
      }
      this.hideTimetableModal();
      this.loadData();
    } catch (error) {
      console.error('Error saving timetable entry:', error);
      this.showAlert('Error saving timetable entry', 'error');
    }
  }

  deleteTimetableEntry(id) {
    if (!confirm('Are you sure you want to delete this timetable entry? This action cannot be undone.')) {
      return;
    }
    try {
      campusDB.delete('timetables', id);
      this.showAlert('Timetable entry deleted successfully', 'success');
      this.loadData();
    } catch (error) {
      console.error('Error deleting timetable entry:', error);
      this.showAlert('Error deleting timetable entry', 'error');
    }
  }

  hideTimetableModal() {
    document.getElementById('timetableModal').style.display = 'none';
  }

  // Import Timetable functionality
  showImportTimetableModal() {
    document.getElementById('importTimetableModal').style.display = 'flex';
    document.getElementById('importTimetableResults').style.display = 'none';
    document.getElementById('importTimetableBtn').style.display = 'block';
    document.getElementById('importTimetableBtn').disabled = true;
    document.getElementById('timetableCsvFile').value = ''; // Clear file input
    document.getElementById('importTimetablePreview').style.display = 'none'; // Hide preview
    this.importData = []; // Clear previous import data
  }

  hideImportTimetableModal() {
    document.getElementById('importTimetableModal').style.display = 'none';
    document.getElementById('timetableCsvFile').value = '';
    document.getElementById('importTimetablePreview').style.display = 'none';
    document.getElementById('importTimetableResults').style.display = 'none';
    document.getElementById('importTimetableBtn').disabled = true;
    this.importData = [];
  }

  handleTimetableFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      this.showAlert('Please select a CSV file', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      this.parseTimetableCSV(e.target.result);
    };
    reader.readAsText(file);
  }

  parseTimetableCSV(csvText) {
    try {
      const lines = csvText.split(/\r?\n/).filter(line => line.trim());
      if (lines.length < 2) {
        this.showAlert('CSV file must contain at least a header row and one data row', 'error');
        return;
      }

      const csvSplitRegex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
      const headers = lines[0].split(csvSplitRegex).map(h => h.trim().replace(/^"|"$/g, ''));
      const requiredHeaders = ['day_of_week', 'start_time', 'end_time', 'branch', 'year', 'semester', 'section', 'subject_code', 'faculty_id', 'room_number'];
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

      if (missingHeaders.length > 0) {
        this.showAlert(`Missing required columns: ${missingHeaders.join(', ')}`, 'error');
        return;
      }

      this.importData = lines.slice(1).map(line => {
        const values = line.split(csvSplitRegex).map(v => v.trim().replace(/^"|"$/g, ''));
        const entry = {};
        headers.forEach((header, index) => {
          entry[header] = values[index] || '';
        });
        return entry;
      });

      this.showImportTimetablePreview();
      document.getElementById('importTimetableBtn').disabled = false;
    } catch (error) {
      console.error('Error parsing CSV:', error);
      this.showAlert('Error parsing CSV file', 'error');
    }
  }

  showImportTimetablePreview() {
    const preview = document.getElementById('importTimetablePreview');
    const previewHeader = document.getElementById('previewTimetableHeader');
    const previewBody = document.getElementById('previewTimetableBody');

    if (this.importData.length === 0) return;

    preview.style.display = 'block';
    const headers = Object.keys(this.importData[0]);
    previewHeader.innerHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;

    const previewRows = this.importData.slice(0, 5);
    previewBody.innerHTML = previewRows.map(entry => `
      <tr>${headers.map(h => `<td>${entry[h]}</td>`).join('')}</tr>
    `).join('');
  }

  importTimetable() {
    if (this.importData.length === 0) return;

    try {
      let successCount = 0;
      let errorCount = 0;
      const errors = [];

      this.importData.forEach((entryData, index) => {
        try {
          // Validate required fields
          if (!entryData.day_of_week || !entryData.start_time || !entryData.end_time ||
              !entryData.branch || !entryData.year || !entryData.semester || !entryData.section ||
              !entryData.subject_code || !entryData.faculty_id || !entryData.room_number) {
            errors.push(`Row ${index + 2}: Missing required fields.`);
            errorCount++;
            return;
          }

          const subject = this.allSubjects.find(s => s.code === entryData.subject_code);
          if (!subject) {
            errors.push(`Row ${index + 2}: Subject with code '${entryData.subject_code}' not found.`);
            errorCount++;
            return;
          }

          const faculty = this.allFaculty.find(f => f.faculty_id === entryData.faculty_id);
          if (!faculty) {
            errors.push(`Row ${index + 2}: Faculty with ID '${entryData.faculty_id}' not found.`);
            errorCount++;
            return;
          }

          const newEntry = {
            day_of_week: entryData.day_of_week,
            start_time: entryData.start_time,
            end_time: entryData.end_time,
            subject_id: subject.id,
            branch: entryData.branch,
            year: parseInt(entryData.year),
            semester: parseInt(entryData.semester),
            section: entryData.section,
            faculty_id: faculty.id,
            room_number: entryData.room_number
          };

          // Check for conflicts before creating (simplified, full conflict check is in saveTimetableEntry)
          const conflictingEntry = this.allTimetableEntries.find(e =>
            e.day_of_week === newEntry.day_of_week &&
            e.branch === newEntry.branch &&
            e.year === newEntry.year &&
            e.semester === newEntry.semester &&
            e.section === newEntry.section &&
            (
              (newEntry.start_time < e.end_time && newEntry.end_time > e.start_time)
            )
          );

          if (conflictingEntry) {
            errors.push(`Row ${index + 2}: Time conflict for this class on ${newEntry.day_of_week} from ${newEntry.start_time} to ${newEntry.end_time}.`);
            errorCount++;
            return;
          }

          campusDB.create('timetables', newEntry);
          successCount++;
        } catch (error) {
          errors.push(`Row ${index + 2}: ${error.message}`);
          errorCount++;
        }
      });

      const results = document.getElementById('importTimetableResults');
      const stats = document.getElementById('importTimetableStats');
      const importAlertDiv = results.querySelector('.alert');

      stats.innerHTML = `
        <div>Successfully imported: ${successCount} timetable entries</div>
        ${errorCount > 0 ? `<div style="color: var(--error);">Errors: ${errorCount}</div>` : ''}
        ${errors.length > 0 ? `<div style="margin-top: 10px;"><strong>Error Details:</strong><ul>${errors.map(e => `<li>${e}</li>`).join('')}</ul></div>` : ''}
      `;

      if (errorCount > 0) {
        importAlertDiv.className = 'alert alert-warning';
        importAlertDiv.querySelector('strong').textContent = 'Import completed with errors!';
      } else {
        importAlertDiv.className = 'alert alert-success';
        importAlertDiv.querySelector('strong').textContent = 'Import completed successfully!';
      }
      results.style.display = 'block';
      this.loadData(); // Refresh the table
      document.getElementById('importTimetableBtn').style.display = 'none';
    } catch (error) {
      console.error('Error importing timetables:', error);
      this.showAlert('Error importing timetables', 'error');
      document.getElementById('importTimetableBtn').disabled = false;
      document.getElementById('importTimetableBtn').style.display = 'block';
    }
  }

  downloadTimetableTemplate() {
    const template = `day_of_week,start_time,end_time,branch,year,semester,section,subject_code,faculty_id,room_number
Monday,09:15,10:05,Computer Science & Engineering,3,5,A,CS301,FAC001,LH-101
Monday,10:05,10:55,Computer Science & Engineering,3,5,A,CS302,FAC001,LH-102
Tuesday,10:05,12:35,Computer Science & Engineering,3,5,A,CS301L,FAC001,Lab-101
Wednesday,13:30,16:00,Mechanical Engineering,1,1,A,EG101,FAC004,Drawing Hall-1`;
    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'timetable_import_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
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

// instantiate globally
let adminTimetable;
document.addEventListener('DOMContentLoaded', () => {
  adminTimetable = new AdminTimetable();
});

// Global functions for inline event handlers
function changeViewDate(days) {
  adminTimetable.changeViewDate(days);
}

function exportTimetable() {
  adminTimetable.exportTimetable();
}
