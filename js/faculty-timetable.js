// FacultyTimetable - Final (Alter Date + Student visible alterations + Faculty Filter B)
// Paste as a single file replacing prior FacultyTimetable implementation.

class FacultyTimetable {
  constructor() {
    this.facultyData = null;
    this.facultyIdCandidates = [];
    this.allTimetableEntries = [];
    this.filteredTimetableEntries = [];
    this.allSubjects = [];
    this.allFaculty = [];
    this.allDepartments = [];
    this.timetableData = {};

    this.currentViewDate = new Date(); // Date for which timetable is displayed

    // Periods: Morning Lab covers P2-P4 (10:05 - 12:35)
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
    try {
      if (typeof requireAuth === 'function' && typeof requireRole === 'function') {
        if (!requireAuth() || !requireRole('faculty')) {
          console.warn('FacultyTimetable: auth/role check failed.');
          return;
        }
      }
      this.setupEventListeners();
      this.loadFacultyData();
      // Expose helper for student pages
      window.getAlterationsForDate = (dateStr) => this.getAlterationsForDate(dateStr);
    } catch (err) {
      console.error('FacultyTimetable: init error', err);
    }
  }

  setupEventListeners() {
    const safe = id => document.getElementById(id);
    if (safe('yearFilter')) safe('yearFilter').addEventListener('change', () => this.handleMainFilterChange());
    if (safe('branchFilter')) safe('branchFilter').addEventListener('change', () => this.handleMainFilterChange());
    if (safe('semesterFilter')) safe('semesterFilter').addEventListener('change', () => this.handleMainFilterChange());
    if (safe('sectionFilter')) safe('sectionFilter').addEventListener('change', () => this.handleMainFilterChange());

    if (safe('alterClassForm')) safe('alterClassForm').addEventListener('submit', (e) => { e.preventDefault(); this.saveAlteredClass(); });
    if (safe('suspendClassForm')) safe('suspendClassForm').addEventListener('submit', (e) => { e.preventDefault(); this.saveSuspendedClass(); });

    // If a timetableDate input exists (student/faculty can change view date), re-render on change
    const dateInput = safe('timetableDate');
    if (dateInput) dateInput.addEventListener('change', () => this.loadTimetable());
  }

  // NEW: Change the current view date
  changeViewDate(days) {
    this.currentViewDate.setDate(this.currentViewDate.getDate() + days);
    this.loadTimetable(); // Reload timetable for the new date
  }

  // ---------------- Load faculty and DB tables ----------------
  loadFacultyData() {
    try {
      // FIX: Corrected function call from `currentUser()` to `getCurrentUser()`
      const currentUser = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
      console.log('FacultyTimetable: currentUser ->', currentUser);

      // Try campusDB.getFacultyByUserId if available
      let facultyRec = null;
      if (typeof campusDB !== 'undefined' && typeof campusDB.getFacultyByUserId === 'function') {
        const userIdCandidate = currentUser?.id ?? currentUser?.user_id ?? currentUser?.uid ?? null;
        try { if (userIdCandidate != null) facultyRec = campusDB.getFacultyByUserId(userIdCandidate); } catch (e) { console.warn('FacultyTimetable: getFacultyByUserId threw', e); }
      }

      // fallback heuristics: search faculty storage
      if (!facultyRec && typeof campusDB !== 'undefined' && typeof campusDB.getStorageData === 'function') {
        const facList = campusDB.getStorageData('faculty') || [];
        facultyRec = facList.find(f =>
          (currentUser && (
            (f.user_id && String(f.user_id) === String(currentUser.id || currentUser.user_id || currentUser.uid)) ||
            (f.id && String(f.id) === String(currentUser.id || currentUser.user_id || currentUser.uid)) ||
            (f.faculty_id && String(f.faculty_id) === String(currentUser.faculty_id)) || // Use currentUser.faculty_id if available
            (f.email && currentUser.email && String(f.email).toLowerCase() === String(currentUser.email).toLowerCase())
          ))
        );
        if (!facultyRec && facList.length === 1) facultyRec = facList[0];
      }

      // final fallback: first faculty row
      if (!facultyRec && typeof campusDB !== 'undefined' && typeof campusDB.getStorageData === 'function') {
        const facList = campusDB.getStorageData('faculty') || [];
        if (facList.length) facultyRec = facList[0];
      }

      if (!facultyRec) {
        console.error('FacultyTimetable: faculty record not found.');
        this.showAlert('Faculty profile not found. Cannot load timetable.', 'error');
        return;
      }

      this.facultyData = facultyRec;
      console.log('FacultyTimetable: facultyData ->', this.facultyData);

      // Build candidate IDs
      const candidates = new Set();
      const pushIf = v => { if (v !== null && v !== undefined && v !== '') candidates.add(String(v)); };
      pushIf(this.facultyData.id);
      pushIf(this.facultyData.faculty_id);
      pushIf(this.facultyData.user_id);
      pushIf(this.facultyData.uid);
      pushIf(this.facultyData.fid);
      // FIX: Corrected function call from `getcurrentUser()` to `getCurrentUser()`
      const cur = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
      pushIf(cur?.id);
      pushIf(cur?.user_id);
      pushIf(cur?.uid);
      pushIf(cur?.faculty_id);
      this.facultyIdCandidates = Array.from(candidates);
      console.log('FacultyTimetable: facultyIdCandidates ->', this.facultyIdCandidates);

      // Load tables
      this.allTimetableEntries = (typeof campusDB.getStorageData === 'function') ? (campusDB.getStorageData('timetables') || []) : [];
      this.allSubjects = (typeof campusDB.getStorageData === 'function') ? (campusDB.getStorageData('subjects') || []) : [];
      this.allFaculty = (typeof campusDB.getStorageData === 'function') ? (campusDB.getStorageData('faculty') || []) : [];
      this.allDepartments = (typeof campusDB.getStorageData === 'function') ? (campusDB.getStorageData('departments') || []) : [];

      this.populateFilterDropdowns();
      this.loadTimetable();
    } catch (err) {
      console.error('FacultyTimetable: loadFacultyData error', err);
      this.showAlert('Error loading faculty data.', 'error');
    }
  }

  populateFilterDropdowns() {
    try {
      const branchElem = document.getElementById('branchFilter');
      if (branchElem) {
        branchElem.innerHTML = '<option value="">All Branches</option>';
        const names = (this.allDepartments || []).map(d => d.name || d.branch || d.department || d.dept).filter(Boolean);
        const unique = [...new Set(names)];
        unique.forEach(n => { const opt = document.createElement('option'); opt.value = n; opt.textContent = n; branchElem.appendChild(opt); });
      }
      const yearElem = document.getElementById('yearFilter');
      if (yearElem && yearElem.options.length === 0) {
        yearElem.innerHTML = '<option value="">All Years</option>';
        [1,2,3,4].forEach(y => { const o = document.createElement('option'); o.value = y; o.textContent = `Year ${y}`; yearElem.appendChild(o); });
      }
      this.populateSemesterDropdownForMainTable();
    } catch (err) { console.warn('populateFilterDropdowns err', err); }
  }

  handleMainFilterChange() { this.populateSemesterDropdownForMainTable(); this.loadTimetable(); }

  populateSemesterDropdownForMainTable() {
    const yearFilter = document.getElementById('yearFilter');
    const semesterFilter = document.getElementById('semesterFilter');
    if (!semesterFilter) return;
    const prev = semesterFilter.value || '';
    semesterFilter.innerHTML = '<option value="">All Semesters</option>';
    const y = parseInt(yearFilter?.value) || 0;
    if (y) {
      for (let i=1;i<=y*2;i++){ const o = document.createElement('option'); o.value = i; o.textContent = `Semester ${i}`; semesterFilter.appendChild(o); }
    }
    semesterFilter.value = prev;
  }

  // ---------------- Timetable load + filter ----------------
  loadTimetable() {
    try {
      console.log('FacultyTimetable: loadTimetable called');
      const branchFilter = (document.getElementById('branchFilter')?.value || '').trim();
      const yearFilter = (document.getElementById('yearFilter')?.value || '').trim();
      const semesterFilter = (document.getElementById('semesterFilter')?.value || '').trim();
      const sectionFilter = (document.getElementById('sectionFilter')?.value || '').trim();
      const filters = { branch: branchFilter, year: yearFilter, semester: semesterFilter, section: sectionFilter };
      console.log('FacultyTimetable: UI filters ->', filters);

      const rawEntries = (typeof campusDB.getStorageData === 'function') ? (campusDB.getStorageData('timetables') || []) : (this.allTimetableEntries || []);
      this.allTimetableEntries = rawEntries;
      console.log('FacultyTimetable: total raw timetable rows ->', rawEntries.length);

      if (!rawEntries.length) {
        this.filteredTimetableEntries = [];
        this.timetableData = this.generateTimetableForDisplay([]);
        this.renderTimetable();
        return;
      }

      const canonicalEntries = rawEntries.map(e => this.canonicalizeEntry(e));
      const candidates = (this.facultyIdCandidates.length ? this.facultyIdCandidates : [String(this.facultyData?.id ?? this.facultyData?.faculty_id ?? this.facultyData?.user_id ?? '')]);

      // Determine view date: #timetableDate or today
      const dateInput = document.getElementById('timetableDate');
      const viewDate = dateInput?.value || new Date().toISOString().slice(0,10);
      if (dateInput) dateInput.value = viewDate; // Ensure the input reflects the current view date
      this.currentViewDate = new Date(viewDate); // Update currentViewDate property
      console.log('FacultyTimetable: viewDate ->', viewDate);

      this.filteredTimetableEntries = canonicalEntries.filter(entry => {
        const entryFacultyIds = [entry.original_faculty_id, entry.current_faculty_id, entry.faculty_id, entry.fid, entry.user_id].filter(Boolean).map(String);
        const matchesFaculty = entryFacultyIds.length ? candidates.some(c => entryFacultyIds.some(eid => String(eid) === String(c))) : false;
        const matchesBranch = !filters.branch || String(entry.branch || '').toLowerCase() === String(filters.branch || '').toLowerCase();
        const matchesYear = !filters.year || String(entry.year) === String(filters.year);
        const matchesSemester = !filters.semester || String(entry.semester) === String(filters.semester);
        const matchesSection = !filters.section || String(entry.section || '').toLowerCase() === String(filters.section || '').toLowerCase();
        return matchesFaculty && matchesBranch && matchesYear && matchesSemester && matchesSection;
      });

      console.log('FacultyTimetable: filtered entries ->', this.filteredTimetableEntries.length);
      this.timetableData = this.generateTimetableForDisplay(this.filteredTimetableEntries, this.getAllAlterations(), this.currentViewDate);
      this.renderTimetable();
    } catch (err) {
      console.error('FacultyTimetable: loadTimetable error', err);
      this.showAlert('Error loading timetable.', 'error');
    }
  }

  canonicalizeEntry(raw) {
    try {
      const e = Object.assign({}, raw);
      const c = {};
      c.id = e.id ?? e.timetable_id ?? e.entry_id ?? null;
      c.branch = e.branch ?? e.department ?? e.dept ?? e.course ?? null;
      c.year = e.year ?? e.yr ?? e.academic_year ?? null;
      c.semester = e.semester ?? e.sem ?? e.sem_no ?? null;
      c.section = e.section ?? e.sec ?? e.section_name ?? null;
      c.day_of_week = e.day_of_week ?? e.day ?? e.dow ?? null;
      c.start_time = e.start_time ?? e.start ?? e.from ?? null;
      c.end_time = e.end_time ?? e.end ?? e.to ?? null;
      c.original_faculty_id = e.original_faculty_id ?? e.orig_faculty ?? e.orig_fid ?? e.original_fid ?? null;
      c.current_faculty_id = e.current_faculty_id ?? e.current_fid ?? e.assigned_faculty ?? null;
      c.faculty_id = e.faculty_id ?? e.fid ?? null;
      c.user_id = e.user_id ?? null;
      c.subject_id = e.subject_id ?? e.subject ?? e.sub_id ?? null;
      c.room_number = e.room_number ?? e.room ?? e.room_no ?? e.roomNumber ?? null;
      // prefer alter_status if present in row
      c.status = e.alter_status ?? e.status ?? e.state ?? 'scheduled';
      c.reason = e.alter_reason ?? e.reason ?? e.note ?? '';
      c._raw = e;
      if (c.day_of_week) c.day_of_week = this.normalizeDayName(c.day_of_week);
      return c;
    } catch (err) {
      console.error('canonicalizeEntry error', err, raw);
      return raw;
    }
  }

  normalizeDayName(dayRaw) {
    if (!dayRaw) return dayRaw;
    const s = String(dayRaw).trim().toLowerCase();
    const map = {
      mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
      monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday'
    };
    if (map[s]) return map[s];
    const key3 = s.slice(0,3);
    return map[key3] || (String(dayRaw).charAt(0).toUpperCase() + String(dayRaw).slice(1));
  }

  // ---------------- generate and render ----------------
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

    console.log('FacultyTimetable: Generated Timetable Data:', timetable); // DIAGNOSTIC LOG
    return { days, periods: allDisplaySlots, timetable };
  }

  // ---------------- render ----------------
  renderTimetable() {
    try {
      const container = document.getElementById('timetableContainer');
      if (!container) { console.warn('FacultyTimetable: #timetableContainer not found'); return; }
      const { days, periods, timetable } = this.timetableData; // periods here is allDisplaySlots

      // Determine grid columns dynamically: Day column + one column per period
      const gridColumnsStyle = `80px repeat(${periods.length}, 1fr)`;

      let timetableHTML = `
        <div class="timetable-grid" style="grid-template-columns: ${gridColumnsStyle};">
          <div class="timetable-header-cell">Day</div>
          ${periods.map(p => `<div class="timetable-header-cell">${p.label.split(' ')[0]}<br><small>${p.start}-${p.end}</small></div>`).join('')}
      `;

      const hasFilteredEntries = this.filteredTimetableEntries.length > 0;
      const isAnyFilterActive = document.getElementById('branchFilter')?.value || document.getElementById('yearFilter')?.value || document.getElementById('semesterFilter')?.value || document.getElementById('sectionFilter')?.value;

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
                  let actionsHtml = '';

                  if (entry.alter_status === 'suspended') {
                      cellClass += ' suspended';
                      statusText = 'Suspended';
                      statusColor = 'var(--error-color)';
                      actionsHtml = `<button class="btn success btn-sm" onclick="facultyTimetable.reactivateClass(${baseEntry.id})">Reactivate</button>`;
                  } else if (entry.alter_status === 'altered') {
                      cellClass += ' altered';
                      statusText = `Altered to ${faculty?.name || 'N/A'}`;
                      statusColor = 'var(--warning-color)';
                      actionsHtml = `<button class="btn secondary btn-sm" onclick="facultyTimetable.cancelAlteration(${baseEntry.id})">Cancel Alteration</button>`;
                  } else {
                      statusText = 'Scheduled';
                      statusColor = 'var(--primary)';
                      actionsHtml = `<button class="btn primary btn-sm" onclick="facultyTimetable.showAlterClassModal(${baseEntry.id})">Alter</button>
                                     <button class="btn danger btn-sm" onclick="facultyTimetable.showSuspendClassModal(${baseEntry.id})">Suspend</button>`;
                  }

                  // HTML entity encode for title attribute
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
                          <span class="class-details">${faculty?.name || 'N/A'}</span>
                          <span class="room-details">${baseEntry.room_number}</span>
                          <span style="font-size: 0.7rem; color: ${statusColor}; font-weight: 500;">${statusText}</span>
                          ${sanitizedReason ? `<span style="font-size: 0.65rem; color: var(--gray-500);">Reason: ${sanitizedReason}</span>` : ''}
                          <div style="margin-top:6px;" class="actions">
                            ${actionsHtml}
                          </div>
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
          timetableHTML += `<div class="timetable-class-cell empty" style="grid-column: 1 / -1; padding: 40px; color: var(--gray-500);">No classes found for the selected filters. Try adjusting your criteria.</div>`;
      } else if (!hasFilteredEntries && !isAnyFilterActive) {
          timetableHTML += `<div class="timetable-class-cell empty" style="grid-column: 1 / -1; padding: 40px; color: var(--gray-500);">No timetable data available for your class.</div>`;
      }

      timetableHTML += `</div>`;
      container.innerHTML = timetableHTML;
    } catch (err) {
      console.error('FacultyTimetable: renderTimetable error', err);
    }
  }

  findFacultyName(facId) {
    const f = this.allFaculty.find(x => String(x.id) === String(facId) || String(x.faculty_id) === String(facId) || String(x.user_id) === String(facId));
    return f?.name || f?.fullname || f?.faculty_id || null;
  }

  // ----------------- ALTER modal and persistence -----------------
  showAlterClassModal(entryId) {
    try {
      const rawRows = campusDB.getStorageData ? (campusDB.getStorageData('timetables') || []) : this.allTimetableEntries;
      const entryRaw = rawRows.find(r => String(r.id) === String(entryId) || String(r.timetable_id) === String(entryId));
      if (!entryRaw) { this.showAlert('Timetable entry not found.', 'error'); return; }
      const entry = this.canonicalizeEntry(entryRaw);

      // Ensure modal elements exist
      const modal = document.getElementById('alterClassModal');
      if (!modal) { this.showAlert('Alter modal not found.', 'error'); return; }

      document.getElementById('alterEntryId').value = entry.id;
      const subj = this.allSubjects.find(s => String(s.id) === String(entry.subject_id) || String(s.code) === String(entry.subject_id));
      document.getElementById('alterClassDetails').textContent = `${subj?.name || subj?.code || entry.subject_id || 'N/A'} - ${entry.branch || ''} Y${entry.year || ''} S${entry.semester || ''} Sec ${entry.section || ''} on ${entry.day_of_week} (${entry.start_time}-${entry.end_time})`;
      
      const originalFaculty = this.allFaculty.find(f => String(f.id) === String(entry.original_faculty_id) || String(f.faculty_id) === String(entry.original_faculty_id));
      document.getElementById('alterOriginalFaculty').textContent = originalFaculty?.name || originalFaculty?.faculty_id || 'N/A';

      // Set default date to today
      const dateInput = document.getElementById('alterDate');
      if (dateInput) dateInput.value = new Date().toISOString().slice(0,10);

      // Build eligible faculty list (Filter B: faculty who handle ANY subject for that same class section)
      const eligible = this.getEligibleFacultyForEntry_FilterB(entry);
      const newFacultySelect = document.getElementById('alterNewFaculty');
      newFacultySelect.innerHTML = '<option value="">Select New Faculty</option>';
      eligible.forEach(f => {
        const opt = document.createElement('option');
        opt.value = f.id ?? f.faculty_id ?? f.fid ?? f.user_id ?? '';
        opt.textContent = `${f.name || f.fullname || f.faculty_id || f.id} ${f.department ? ' - ' + f.department : ''}`;
        newFacultySelect.appendChild(opt);
      });

      document.getElementById('alterReason').value = '';
      modal.style.display = 'flex';
    } catch (err) {
      console.error('showAlterClassModal error', err);
      this.showAlert('Error opening alter modal', 'error');
    }
  }

  // Filter B: faculty who handle ANY subject for that class section (based on timetable rows)
  getEligibleFacultyForEntry_FilterB(entry) {
    try {
      // find all timetable rows that match the same branch/year/semester/section
      const matches = (this.allTimetableEntries || []).filter(r => {
        // normalize raw copy of r
        const rr = this.canonicalizeEntry(r);
        return String(rr.branch || '').toLowerCase() === String(entry.branch || '').toLowerCase() &&
               String(rr.year || '').toLowerCase() === String(entry.year || '').toLowerCase() &&
               String(rr.semester || rr.sem || '').toLowerCase() === String(entry.semester || '').toLowerCase() &&
               String(rr.section || '').toLowerCase() === String(entry.section || '').toLowerCase();
      });

      // collect faculty ids from those matches
      const facIds = new Set();
      matches.forEach(m => {
        const rr = this.canonicalizeEntry(m);
        if (rr.original_faculty_id) facIds.add(String(rr.original_faculty_id));
        if (rr.current_faculty_id) facIds.add(String(rr.current_faculty_id));
        if (rr.faculty_id) facIds.add(String(rr.faculty_id));
      });

      // map to faculty records
      const out = [];
      facIds.forEach(fid => {
        const f = this.allFaculty.find(ff => String(ff.id) === String(fid) || String(ff.faculty_id) === String(fid) || String(ff.user_id) === String(fid));
        if (f) out.push(f);
      });

      // exclude current faculty
      const result = out.filter(f => String(f.id ?? f.faculty_id ?? f.user_id) !== String(this.facultyData?.id ?? this.facultyData?.faculty_id ?? this.facultyData?.user_id));
      if (result.length) return result;

      // fallback: all faculty except current
      return this.allFaculty.filter(f => String(f.id ?? f.faculty_id ?? f.user_id) !== String(this.facultyData?.id ?? this.facultyData?.faculty_id ?? this.facultyData?.user_id));
    } catch (err) {
      console.error('getEligibleFacultyForEntry_FilterB error', err);
      return this.allFaculty.filter(f => String(f.id ?? f.faculty_id ?? f.user_id) !== String(this.facultyData?.id ?? this.facultyData?.faculty_id ?? this.facultyData?.user_id));
    }
  }

  saveAlteredClass() {
    try {
      const entryId = document.getElementById('alterEntryId')?.value;
      const newFacultyRaw = document.getElementById('alterNewFaculty')?.value;
      const dateVal = document.getElementById('alterDate')?.value || new Date().toISOString().slice(0,10);
      const reason = (document.getElementById('alterReason')?.value || '').trim();
      if (!entryId || !newFacultyRaw || !reason || !dateVal) { this.showAlert('Please select new faculty, date and provide a reason.', 'error'); return; }
      const newFacultyId = newFacultyRaw;

      // Update timetable row: set current_faculty_id, alter_status, alter_reason, alter_date
      if (typeof campusDB.update === 'function') {
        campusDB.update('timetables', Number(entryId), {
          current_faculty_id: newFacultyId,
          alter_status: 'altered',
          alter_reason: reason,
          alter_date: dateVal
        });
      } else {
        const rows = campusDB.getStorageData ? (campusDB.getStorageData('timetables') || []) : (this.allTimetableEntries || []);
        const idx = rows.findIndex(r => String(r.id) === String(entryId) || String(r.timetable_id) === String(entryId));
        if (idx === -1) { this.showAlert('Entry not found for alter', 'error'); return; }
        // ensure original stored
        rows[idx].original_faculty_id = rows[idx].original_faculty_id ?? rows[idx].orig_faculty ?? rows[idx].orig_fid ?? rows[idx].faculty_id ?? rows[idx].fid ?? null;
        rows[idx].current_faculty_id = newFacultyId;
        rows[idx].alter_status = 'altered';
        rows[idx].alter_reason = reason;
        rows[idx].alter_date = dateVal;
        localStorage.setItem('campusiq_timetables', JSON.stringify(rows));
      }

      // Create alteration record in campusiq_alterations
      const alt = this.buildAlterationRecord(entryId, newFacultyId, 'altered', reason, dateVal);
      this.saveAlteration(alt);

      this.hideAlterClassModal();
      this.showAlert('Class altered successfully', 'success');
      if (typeof authSystem !== 'undefined' && typeof authSystem.logActivity === 'function') {
        authSystem.logActivity('update', this.facultyData?.user_id ?? this.facultyData?.id, `Altered class ${entryId} -> ${newFacultyId} on ${dateVal}`);
      }
      setTimeout(() => this.loadTimetable(), 150);
    } catch (err) {
      console.error('saveAlteredClass error', err);
      this.showAlert('Error altering class', 'error');
    }
  }

  // Build standardized alteration object per your confirmed model
  buildAlterationRecord(timetableId, facultyIdNew, status, reason, dateVal) {
    // find the timetable row to copy source fields
    const rows = campusDB.getStorageData ? (campusDB.getStorageData('timetables') || []) : (this.allTimetableEntries || []);
    const r = rows.find(rr => String(rr.id) === String(timetableId) || String(rr.timetable_id) === String(timetableId)) || {};
    const canonical = this.canonicalizeEntry(r);
    return {
      timetableId: timetableId,
      facultyIdOriginal: canonical.original_faculty_id ?? canonical.faculty_id ?? null,
      facultyIdNew: facultyIdNew,
      date: dateVal, // YYYY-MM-DD
      reason: reason,
      periodId: canonical.start_time ?? canonical.periodId ?? null,
      branch: canonical.branch ?? null,
      year: canonical.year ?? null,
      sem: canonical.semester ?? canonical.sem ?? null,
      section: canonical.section ?? null,
      subject: canonical.subject_id ?? null,
      alter_status: status
    };
  }

  // persist alteration into campusiq_alterations array in localStorage (and campusDB if available)
  saveAlteration(altObj) {
    try {
      if (typeof campusDB !== 'undefined' && typeof campusDB.getStorageData === 'function') {
        const arr = campusDB.getStorageData('alterations') || []; // Ensure it's an array
        
        // Check if an alteration for this timetableId and date already exists
        const existingIndex = arr.findIndex(a => String(a.timetableId) === String(altObj.timetableId) && String(a.date) === String(altObj.date));
        
        if (existingIndex !== -1) {
          // Update existing alteration
          arr[existingIndex] = { ...arr[existingIndex], ...altObj };
        } else {
          // Add new alteration
          arr.push(altObj);
        }

        // If campusDB has a saveAlterations function, use it; otherwise write to localStorage key
        if (typeof campusDB.saveAlterations === 'function') {
          campusDB.saveAlterations(arr);
        } else {
          localStorage.setItem('campusiq_alterations', JSON.stringify(arr));
        }
        console.log('FacultyTimetable: saved/updated alteration via campusDB/localStorage', altObj);
      } else {
        // plain localStorage fallback
        const existing = this.getAllAlterationsFromLocalStorage();
        const existingIndex = existing.findIndex(a => String(a.timetableId) === String(altObj.timetableId) && String(a.date) === String(altObj.date));
        if (existingIndex !== -1) {
          existing[existingIndex] = { ...existing[existingIndex], ...altObj };
        } else {
          existing.push(altObj);
        }
        localStorage.setItem('campusiq_alterations', JSON.stringify(existing));
        console.log('FacultyTimetable: saved/updated alteration to localStorage', altObj);
      }
    } catch (err) {
      console.error('saveAlteration error', err);
    }
  }

  getAllAlterationsFromLocalStorage() {
    try {
      const raw = localStorage.getItem('campusiq_alterations');
      return raw ? JSON.parse(raw) : [];
    } catch (err) { return []; }
  }

  getAllAlterations() {
    try {
      if (typeof campusDB !== 'undefined' && typeof campusDB.getStorageData === 'function') {
        // If campusDB stores alterations under 'alterations' table
        const alt = campusDB.getStorageData('alterations');
        if (Array.isArray(alt)) return alt;
      }
      return this.getAllAlterationsFromLocalStorage();
    } catch (err) { console.error('getAllAlterations error', err); return []; }
  }

  // Exposed helper for Student side: get alterations for a specific date string (YYYY-MM-DD)
  getAlterationsForDate(dateStr) {
    if (!dateStr) dateStr = new Date().toISOString().slice(0,10);
    const all = this.getAllAlterations();
    return (all || []).filter(a => String(a.date) === String(dateStr));
  }

  // ---------------- suspend modal + save ----------------
  showSuspendClassModal(entryId) {
    try {
      const rawRows = campusDB.getStorageData ? (campusDB.getStorageData('timetables') || []) : this.allTimetableEntries;
      const entryRaw = rawRows.find(r => String(r.id) === String(entryId) || String(r.timetable_id) === String(entryId));
      if (!entryRaw) { this.showAlert('Timetable entry not found.', 'error'); return; }
      const entry = this.canonicalizeEntry(entryRaw);
      document.getElementById('suspendEntryId').value = entry.id;
      const subj = this.allSubjects.find(s => String(s.id) === String(entry.subject_id) || String(s.code) === String(entry.subject_id));
      document.getElementById('suspendClassDetails').textContent = `${subj?.name || subj?.code || entry.subject_id || 'N/A'} - ${entry.branch || ''} Y${entry.year || ''} S${entry.semester || ''} Sec ${entry.section || ''} on ${entry.day_of_week} (${entry.start_time}-${entry.end_time})`;

      // Set default date to today
      const dateInput = document.getElementById('suspendDate');
      if (dateInput) dateInput.value = new Date().toISOString().slice(0,10);

      document.getElementById('suspendReason').value = '';
      document.getElementById('suspendClassModal').style.display = 'flex';
    } catch (err) {
      console.error('showSuspendClassModal error', err);
      this.showAlert('Unable to open suspend modal', 'error');
    }
  }

  saveSuspendedClass() {
    try {
      const entryId = document.getElementById('suspendEntryId')?.value;
      const reason = (document.getElementById('suspendReason')?.value || '').trim();
      const dateVal = document.getElementById('suspendDate')?.value || new Date().toISOString().slice(0,10);
      if (!entryId || !reason || !dateVal) { this.showAlert('Please provide reason and date', 'error'); return; }

      if (typeof campusDB.update === 'function') {
        campusDB.update('timetables', Number(entryId), {
          alter_status: 'suspended',
          alter_reason: reason,
          alter_date: dateVal
        });
      } else {
        const rows = campusDB.getStorageData ? (campusDB.getStorageData('timetables') || []) : (this.allTimetableEntries || []);
        const idx = rows.findIndex(r => String(r.id) === String(entryId) || String(r.timetable_id) === String(entryId));
        if (idx === -1) { this.showAlert('Entry not found for suspend', 'error'); return; }
        rows[idx].alter_status = 'suspended';
        rows[idx].alter_reason = reason;
        rows[idx].alter_date = dateVal;
        localStorage.setItem('campusiq_timetables', JSON.stringify(rows));
      }

      // Save alteration record
      const alt = this.buildAlterationRecord(entryId, null, 'suspended', reason, dateVal);
      this.saveAlteration(alt);

      this.hideSuspendClassModal();
      this.showAlert('Class suspended successfully', 'success');
      if (typeof authSystem !== 'undefined' && typeof authSystem.logActivity === 'function') {
        authSystem.logActivity('update', this.facultyData?.user_id ?? this.facultyData?.id, `Suspended class ${entryId} on ${dateVal}`);
      }
      setTimeout(() => this.loadTimetable(), 150);
    } catch (err) {
      console.error('saveSuspendedClass error', err);
      this.showAlert('Error suspending class', 'error');
    }
  }

  // reactivate
  reactivateClass(entryId) {
    try {
      if (!confirm('Are you sure you want to reactivate this class?')) return;
      
      // Find the original timetable entry
      const originalEntry = this.allTimetableEntries.find(e => String(e.id) === String(entryId));
      if (!originalEntry) {
        this.showAlert('Original timetable entry not found.', 'error');
        return;
      }

      // Find and delete the specific alteration record for the current view date
      const currentViewDateString = this.currentViewDate.toISOString().split('T')[0];
      let allAlterations = this.getAllAlterations();
      const alterationIndex = allAlterations.findIndex(alt => 
        String(alt.timetableId) === String(entryId) && String(alt.date) === currentViewDateString
      );

      if (alterationIndex !== -1) {
        allAlterations.splice(alterationIndex, 1);
        this.saveAlteration(allAlterations); // Save the updated alterations list
      }

      // Revert the timetable entry's status and details to its original state
      // For simplicity, we assume 'scheduled' is the default active state without alteration
      // and original_faculty_id is the default faculty.
      if (typeof campusDB.update === 'function') {
        campusDB.update('timetables', Number(entryId), { 
          current_faculty_id: originalEntry.original_faculty_id, // Revert to original faculty
          alter_status: 'scheduled', 
          alter_reason: '', 
          alter_date: null // Clear alteration date
        });
      } else {
        const rows = campusDB.getStorageData ? (campusDB.getStorageData('timetables') || []) : this.allTimetableEntries;
        const idx = rows.findIndex(r => String(r.id) === String(entryId) || String(r.timetable_id) === String(entryId));
        if (idx !== -1) {
          rows[idx].current_faculty_id = rows[idx].original_faculty_id;
          rows[idx].alter_status = 'scheduled';
          rows[idx].alter_reason = '';
          rows[idx].alter_date = null;
          localStorage.setItem('campusiq_timetables', JSON.stringify(rows));
        }
      }

      this.showAlert('Class reactivated successfully', 'success');
      if (typeof authSystem !== 'undefined' && typeof authSystem.logActivity === 'function') {
        authSystem.logActivity('update', this.facultyData?.user_id ?? this.facultyData?.id, `Reactivated class ${entryId} on ${currentViewDateString}`);
      }
      setTimeout(() => this.loadTimetable(), 150);
    } catch (err) {
      console.error('reactivateClass error', err);
      this.showAlert('Error reactivating class', 'error');
    }
  }

  // NEW: Method to cancel a specific alteration
  cancelAlteration(entryId) {
    try {
      if (!confirm('Are you sure you want to cancel this alteration and revert to the original schedule?')) return;

      // Find the original timetable entry
      const originalEntry = this.allTimetableEntries.find(e => String(e.id) === String(entryId));
      if (!originalEntry) {
        this.showAlert('Original timetable entry not found.', 'error');
        return;
      }

      // Find and delete the specific alteration record for the current view date
      const currentViewDateString = this.currentViewDate.toISOString().split('T')[0];
      let allAlterations = this.getAllAlterations();
      const alterationIndex = allAlterations.findIndex(alt => 
        String(alt.timetableId) === String(entryId) && String(alt.date) === currentViewDateString
      );

      if (alterationIndex !== -1) {
        allAlterations.splice(alterationIndex, 1);
        this.saveAlteration(allAlterations); // Save the updated alterations list
      }

      // Revert the timetable entry's status and details to its original state
      // For simplicity, we assume 'scheduled' is the default active state without alteration
      // and original_faculty_id is the default faculty.
      if (typeof campusDB.update === 'function') {
        campusDB.update('timetables', Number(entryId), { 
          current_faculty_id: originalEntry.original_faculty_id, // Revert to original faculty
          alter_status: 'scheduled', 
          alter_reason: '', 
          alter_date: null // Clear alteration date
        });
      } else {
        const rows = campusDB.getStorageData ? (campusDB.getStorageData('timetables') || []) : this.allTimetableEntries;
        const idx = rows.findIndex(r => String(r.id) === String(entryId) || String(r.timetable_id) === String(entryId));
        if (idx !== -1) {
          rows[idx].current_faculty_id = rows[idx].original_faculty_id;
          rows[idx].alter_status = 'scheduled';
          rows[idx].alter_reason = '';
          rows[idx].alter_date = null;
          localStorage.setItem('campusiq_timetables', JSON.stringify(rows));
        }
      }

      this.showAlert('Alteration cancelled successfully. Reverted to original schedule.', 'success');
      if (typeof authSystem !== 'undefined' && typeof authSystem.logActivity === 'function') {
        authSystem.logActivity('update', this.facultyData?.user_id ?? this.facultyData?.id, `Cancelled alteration for class ${entryId} on ${currentViewDateString}`);
      }
      setTimeout(() => this.loadTimetable(), 150);
    } catch (err) {
      console.error('cancelAlteration error', err);
      this.showAlert('Error cancelling alteration', 'error');
    }
  }

  // ---------------- utils ----------------
  showAlert(message, type='info') {
    try {
      const cont = document.getElementById('timetableAlert');
      if (!cont) { console.log(`[${type}] ${message}`); return; }
      // HTML entity encode for message content
      const sanitizedMsg = String(message).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      cont.innerHTML = `<div class="alert alert-${type}">${sanitizedMsg}</div>`;
      cont.style.display = 'block';
      setTimeout(() => { cont.style.display = 'none'; cont.innerHTML = ''; }, 4500);
    } catch (err) { console.log(message); }
  }

  hideAlterClassModal() {
    document.getElementById('alterClassModal').style.display = 'none';
    document.getElementById('alterClassForm').reset();
  }

  hideSuspendClassModal() {
    document.getElementById('suspendClassModal').style.display = 'none';
    document.getElementById('suspendClassForm').reset();
  }

  exportTimetable() {
    if (this.filteredTimetableEntries.length === 0) {
      this.showAlert('No timetable entries to export for the current filters.', 'warning');
      return;
    }

    try {
      const exportData = this.filteredTimetableEntries.map(entry => {
        const subject = this.allSubjects.find(s => s.id === entry.subject_id);
        const originalFaculty = this.allFaculty.find(f => f.id === entry.original_faculty_id);
        const currentFaculty = this.allFaculty.find(f => f.id === entry.current_faculty_id);

        return {
          day_of_week: entry.day_of_week,
          start_time: entry.start_time,
          end_time: entry.end_time,
          branch: entry.branch,
          year: entry.year,
          semester: entry.semester,
          section: entry.section,
          subject_code: subject?.code || 'N/A',
          subject_name: subject?.name || 'N/A',
          original_faculty_id: originalFaculty?.faculty_id || 'N/A',
          original_faculty_name: originalFaculty?.name || 'N/A',
          current_faculty_id: currentFaculty?.faculty_id || 'N/A',
          current_faculty_name: currentFaculty?.name || 'N/A',
          room_number: entry.room_number,
          status: entry.alter_status || entry.status || 'scheduled',
          reason: entry.alter_reason || entry.reason || ''
        };
      });

      const headers = Object.keys(exportData[0] || {});
      const csvContent = [
        headers.join(','),
        ...exportData.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `faculty_timetable_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
      this.showAlert('Timetable exported successfully', 'success');

    } catch (error) {
      console.error('Error exporting timetable:', error);
      this.showAlert('Error exporting timetable', 'error');
    }
  }
}

// instantiate globally
let facultyTimetable = null;
document.addEventListener('DOMContentLoaded', () => {
  facultyTimetable = new FacultyTimetable();
  setTimeout(() => facultyTimetable.loadTimetable?.(), 300);
});

// Global functions for inline event handlers
function changeViewDate(days) {
  facultyTimetable.changeViewDate(days);
}

function exportTimetable() {
  facultyTimetable.exportTimetable();
}
