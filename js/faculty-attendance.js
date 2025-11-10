// Faculty Attendance Management
class FacultyAttendance {
  constructor() {
    this.facultyData = null;
    this.subjectsTaught = []; // Renamed to reflect new structure
    this.studentsInClass = []; // Students for the currently selected class offering
    this.attendance = [];
    this.allTimetableEntries = []; // NEW: To fetch timetable data
    
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
      { id: 101, start: '09:15', end: '12:35', label: 'Lab Block 1 (P1-P4)' },
      { id: 102, start: '13:30', end: '16:00', label: 'Lab Block 2 (P5-P7)' }
    ];
    
    this.init();
  }

  init() {
    // Check authentication
    if (!requireAuth() || !requireRole('faculty')) {
      return;
    }

    this.loadFacultyData();
    this.setupEventListeners();
    this.initializeDateFilter();
  }

  loadFacultyData() {
    try {
      const currentUser = getCurrentUser();
      this.facultyData = campusDB.getFacultyByUserId(currentUser.id);
      
      if (!this.facultyData) {
        this.showAlert('Faculty data not found. Please ensure your user account is linked to a faculty profile.', 'error');
        return;
      }

      // Load subjects taught by this faculty from class_offerings
      this.subjectsTaught = campusDB.getSubjectsTaughtByFaculty(this.facultyData.id, true);
      this.allTimetableEntries = campusDB.getStorageData('timetables'); // NEW: Load all timetable entries

      this.loadSubjectsDropdown();
      this.generateMonthOptions();
    } catch (error) {
      console.error('Error loading faculty data:', error);
    }
  }

  setupEventListeners() {
    document.getElementById('attendanceForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveAttendance();
    });

    document.getElementById('editAttendanceForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveEditedAttendance();
    });

    // New: Event listener for period change in Mark Attendance modal
    document.getElementById('attendancePeriod').addEventListener('change', () => this.handlePeriodChange());
    // New: Event listener for subject change in Mark Attendance modal
    document.getElementById('attendanceSubject').addEventListener('change', () => this.handleSubjectChange());
    document.getElementById('attendanceDate').addEventListener('change', () => this.handleSubjectChange()); // Also trigger on date change
  }

  initializeDateFilter() {
    // Set today's date as default
    const today = new Date();
    const dateString = today.toISOString().split('T')[0];

    document.getElementById('dateFilter').value = dateString;
    document.getElementById('attendanceDate').value = dateString;
    
    // Do NOT set default period or time here. It will be handled by handleSubjectChange.
    // Clear them initially.
    document.getElementById('attendancePeriod').innerHTML = '<option value="">Select Period</option>';
    document.getElementById('attendancePeriod').value = '';
    document.getElementById('attendancePeriod').disabled = true; // Disable until subject is selected
    document.getElementById('attendanceTime').value = '';
  }

  loadSubjectsDropdown() {
    try {
      // Populate subject dropdowns with subjects this faculty teaches
      // Subject objects now contain branch, year, semester, type
      const subjectOptions = this.subjectsTaught.map(subject => 
        `<option value="${subject.id}_${subject.branch}_${subject.year}_${subject.semester}_${subject.section}">${subject.name} (${subject.code}) - Y${subject.year} S${subject.semester} Sec ${subject.section} (${subject.type.charAt(0).toUpperCase() + subject.type.slice(1)})</option>`
      ).join('');

      document.getElementById('subjectFilter').innerHTML = '<option value="">Select Subject & Class</option>' + subjectOptions;
      document.getElementById('attendanceSubject').innerHTML = '<option value="">Select Subject & Class</option>' + subjectOptions;
    } catch (error) {
      console.error('Error loading subjects:', error);
    }
  }

  // New function to handle subject change in Mark Attendance modal
  handleSubjectChange() {
    const selectedSubjectValue = document.getElementById('attendanceSubject').value;
    const selectedDate = document.getElementById('attendanceDate').value;
    const periodSelect = document.getElementById('attendancePeriod');
    const hiddenTimeInput = document.getElementById('attendanceTime');

    periodSelect.innerHTML = '<option value="">Select Period</option>';
    hiddenTimeInput.value = '';
    document.getElementById('studentsAttendanceList').style.display = 'none'; // Hide student list until period is selected

    if (!selectedSubjectValue || !selectedDate) {
      periodSelect.disabled = true;
      return;
    }

    const [subjectId, branch, year, semester, section] = selectedSubjectValue.split('_');
    const subject = this.subjectsTaught.find(s => 
      s.id == subjectId && 
      s.branch === branch && 
      s.year == parseInt(year) && 
      s.semester == parseInt(semester) && 
      s.section === section
    );

    if (!subject) {
      periodSelect.disabled = true;
      return;
    }

    this.populatePeriodDropdown(subject, selectedDate); // Pass subject and date
    periodSelect.disabled = false;
    
    // After populating, if there's only one option, select it and trigger handlePeriodChange
    if (periodSelect.options.length === 2) { // "Select Period" + one actual period
      periodSelect.selectedIndex = 1;
      this.handlePeriodChange();
    } else {
      this.handlePeriodChange(); // Trigger to clear/load students if no single option
    }
  }

  // New function to dynamically populate the Period dropdown based on timetable
  populatePeriodDropdown(subject, date) {
    const periodSelect = document.getElementById('attendancePeriod');
    periodSelect.innerHTML = '<option value="">Select Period</option>';

    const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });

    // Filter timetable entries for this subject, faculty, and class details
    const relevantTimetableEntries = this.allTimetableEntries.filter(entry =>
      entry.subject_id == subject.id && // Use == for potential type coercion
      entry.faculty_id == this.facultyData.id && // Use == for potential type coercion
      entry.branch === subject.branch &&
      entry.year == subject.year && // Use == for potential type coercion
      entry.semester == subject.semester && // Use == for potential type coercion
      entry.section === subject.section &&
      entry.day_of_week === dayOfWeek &&
      entry.status !== 'suspended' // Only show non-suspended classes
    ).sort((a, b) => a.start_time.localeCompare(b.start_time)); // Sort by time

    if (relevantTimetableEntries.length === 0) {
      periodSelect.innerHTML = '<option value="">No classes scheduled for this subject on this day</option>';
      periodSelect.disabled = true;
      return;
    }

    relevantTimetableEntries.forEach(entry => {
      const option = document.createElement('option');
      option.value = entry.start_time; // Use start_time as value
      option.textContent = `${entry.start_time} - ${entry.end_time} (Room: ${entry.room_number})`;
      periodSelect.appendChild(option);
    });
    periodSelect.disabled = false;
  }

  // New function to handle period change in Mark Attendance modal
  handlePeriodChange() {
    const selectedSubjectValue = document.getElementById('attendanceSubject').value;
    const selectedDate = document.getElementById('attendanceDate').value;
    const selectedTime = document.getElementById('attendancePeriod').value; // Now this is the start_time
    const hiddenTimeInput = document.getElementById('attendanceTime');

    if (!selectedSubjectValue || !selectedDate || !selectedTime) {
      hiddenTimeInput.value = '';
      document.getElementById('studentsAttendanceList').style.display = 'none';
      return;
    }
    
    hiddenTimeInput.value = selectedTime; // Store the selected start_time
    this.loadStudentsForAttendance(); // Reload students for the new period/time
  }

  async loadStudentsForAttendance() {
    const selectedSubjectValue = document.getElementById('attendanceSubject').value;
    const date = document.getElementById('attendanceDate').value;
    const time = document.getElementById('attendanceTime').value; // Now read from hidden input (start_time)

    if (!selectedSubjectValue || !date || !time) {
      document.getElementById('studentsAttendanceList').style.display = 'none';
      return;
    }

    const [subjectId, branch, year, semester, section] = selectedSubjectValue.split('_');
    // Find the subject from subjectsTaught, which now has branch, year, semester, type
    const subject = this.subjectsTaught.find(s => 
      s.id == subjectId && 
      s.branch === branch && 
      s.year == parseInt(year) && 
      s.semester == parseInt(semester) && 
      s.section === section
    );
    if (!subject) {
      console.error('FacultyAttendance: Subject not found for loading students:', selectedSubjectValue);
      document.getElementById('studentsAttendanceList').style.display = 'none';
      return;
    }

    // Get students for this specific class offering
    const filters = { branch: branch, year: parseInt(year), semester: parseInt(semester), section: section };
    this.studentsInClass = campusDB.getStudents(filters);

    // Get existing attendance for this subject, date, and time
    const existingAttendance = campusDB.getStorageData('attendance').filter(a => 
      a.subject_id == subjectId && a.date === date && a.class_time === time
    );
    const existingAttendanceMap = new Map(existingAttendance.map(a => [a.student_id, a]));

    const container = document.getElementById('studentsAttendanceList');
    const grid = document.getElementById('studentsAttendanceBody');

    if (this.studentsInClass.length === 0) {
      container.style.display = 'none';
      grid.innerHTML = '<p class="text-center text-gray-500">No students found for this class.</p>';
      return;
    }

    container.style.display = 'block';
    grid.innerHTML = this.studentsInClass.map(student => {
      const record = existingAttendanceMap.get(student.id);
      const status = record ? record.status : 'not_marked';
      // Reason input removed from initial marking, it will only be asked on edit if status changes.

      return `
        <div class="student-attendance-item" data-student-id="${student.id}" data-status="${status}">
          <button type="button" class="student-status-btn status-${status}" onclick="facultyAttendance.toggleStudentStatus(${student.id})">
            <span class="student-roll">${student.student_id}</span>
            <span class="student-name">${student.name}</span>
            <span class="status-indicator">
              ${status === 'present' ? '✅' : status === 'absent' ? '❌' : ''}
            </span>
          </button>
        </div>
      `;
    }).join('');
  }

  toggleStudentStatus(studentId) {
    const studentItem = document.querySelector(`.student-attendance-item[data-student-id="${studentId}"]`);
    if (!studentItem) return;

    const currentStatus = studentItem.dataset.status;
    let newStatus;
    let newIndicator;

    switch (currentStatus) {
      case 'not_marked':
        newStatus = 'present';
        newIndicator = '✅';
        break;
      case 'present':
        newStatus = 'absent';
        newIndicator = '❌';
        break;
      case 'absent':
        newStatus = 'not_marked';
        newIndicator = '';
        break;
      default:
        newStatus = 'not_marked';
        newIndicator = '';
    }

    studentItem.dataset.status = newStatus;
    const statusBtn = studentItem.querySelector('.student-status-btn');
    statusBtn.className = `student-status-btn status-${newStatus}`;
    statusBtn.querySelector('.status-indicator').textContent = newIndicator;

    // Reason input is not part of this initial marking flow
  }

  markAllPresent() {
    this.studentsInClass.forEach(student => {
      const studentItem = document.querySelector(`.student-attendance-item[data-student-id="${student.id}"]`);
      if (studentItem) {
        studentItem.dataset.status = 'present';
        const statusBtn = studentItem.querySelector('.student-status-btn');
        statusBtn.className = `student-status-btn status-present`;
        statusBtn.querySelector('.status-indicator').textContent = '✅';
      }
    });
  }

  markAllAbsent() {
    this.studentsInClass.forEach(student => {
      const studentItem = document.querySelector(`.student-attendance-item[data-student-id="${student.id}"]`);
      if (studentItem) {
        studentItem.dataset.status = 'absent';
        const statusBtn = studentItem.querySelector('.student-status-btn');
        statusBtn.className = `student-status-btn status-absent`;
        statusBtn.querySelector('.status-indicator').textContent = '❌';
      }
    });
  }

  loadAttendance() {
    const selectedSubjectValue = document.getElementById('subjectFilter').value;
    const date = document.getElementById('dateFilter').value;

    if (!selectedSubjectValue || !date) {
      this.showAlert('Please select both subject/class and date', 'warning');
      document.getElementById('attendanceStats').style.display = 'none';
      document.getElementById('attendanceTableBody').innerHTML = '<tr><td colspan="6" class="text-center">Select subject and date to view attendance</td></tr>';
      document.getElementById('monthlyOverview').style.display = 'none'; // Hide monthly overview
      return;
    }

    const [subjectId, branch, year, semester, section] = selectedSubjectValue.split('_');
    const subject = this.subjectsTaught.find(s => 
      s.id == subjectId && s.branch === branch && s.year == parseInt(year) && s.semester == parseInt(semester) && s.section === section
    );
    if (!subject) return;

    // Get students for this specific class offering
    const filters = { branch: branch, year: parseInt(year), semester: parseInt(semester), section: section };
    const students = campusDB.getStudents(filters);

    // Get attendance records for this date and subject
    const attendanceRecords = campusDB.getStorageData('attendance').filter(a => 
      a.subject_id == subjectId && a.date === date
    ).sort((a, b) => a.class_time.localeCompare(b.class_time)); // Sort by time

    this.renderAttendanceTable(students, attendanceRecords, subject, date);
    this.showAttendanceStats(students, attendanceRecords);
    this.loadMonthlyOverview(); // Also load monthly overview when daily is loaded
  }

  renderAttendanceTable(students, attendanceRecords, subject, date) {
    const tbody = document.getElementById('attendanceTableBody');
    
    if (students.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center">No students found for this subject/class</td></tr>';
      return;
    }

    // Group attendance records by student and time for display
    const studentAttendanceMap = new Map();
    students.forEach(student => {
      studentAttendanceMap.set(student.id, []);
    });
    attendanceRecords.forEach(record => {
      if (studentAttendanceMap.has(record.student_id)) {
        studentAttendanceMap.get(record.student_id).push(record);
      }
    });

    let tableRows = '';
    students.forEach(student => {
      const recordsForStudent = studentAttendanceMap.get(student.id);
      if (recordsForStudent.length === 0) {
        tableRows += `
          <tr>
            <td>${student.student_id}</td>
            <td>${student.name}</td>
            <td>-</td>
            <td>
              <span class="badge badge-secondary">Not Marked</span>
            </td>
            <td>-</td>
            <td>
              <!-- No individual mark button here, use the modal for new entries -->
            </td>
          </tr>
        `;
      } else {
        recordsForStudent.forEach((record, index) => {
          const status = record.status;
          const reason = record.reason;
          tableRows += `
            <tr>
              <td>${index === 0 ? student.student_id : ''}</td>
              <td>${index === 0 ? student.name : ''}</td>
              <td>${record.class_time || 'N/A'}</td>
              <td>
                <span class="badge ${this.getStatusBadgeClass(status)}">
                  ${this.getStatusText(status)}
                </span>
              </td>
              <td>${reason || '-'}</td>
              <td>
                <button class="btn btn-primary btn-sm" onclick="showEditAttendanceModal(${record.id})">
                  <span>✏️</span>
                </button>
              </td>
            </tr>
          `;
        });
      }
    });
    tbody.innerHTML = tableRows;
  }

  showAttendanceStats(students, attendanceRecords) {
    const totalStudents = students.length;
    const presentCount = attendanceRecords.filter(r => r.status === 'present').length;
    const absentCount = attendanceRecords.filter(r => r.status === 'absent').length;
    const attendanceRate = totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 0;

    document.getElementById('totalStudents').textContent = totalStudents;
    document.getElementById('presentCount').textContent = presentCount;
    document.getElementById('absentCount').textContent = absentCount;
    document.getElementById('attendanceRate').textContent = `${attendanceRate}%`;

    document.getElementById('attendanceStats').style.display = 'grid';
  }

  getStatusBadgeClass(status) {
    switch (status) {
      case 'present': return 'badge-success';
      case 'absent': return 'badge-error';
      default: return 'badge-secondary';
    }
  }

  getStatusText(status) {
    switch (status) {
      case 'present': return 'Present';
      case 'absent': return 'Absent';
      default: return 'Not Marked';
    }
  }

  saveAttendance() {
    const selectedSubjectValue = document.getElementById('attendanceSubject').value;
    const date = document.getElementById('attendanceDate').value;
    const time = document.getElementById('attendanceTime').value; // Read from hidden input

    if (!selectedSubjectValue || !date || !time) {
      this.showAlert('Please select subject/class, date, and period', 'error');
      return;
    }

    const [subjectId, branch, year, semester, section] = selectedSubjectValue.split('_');

    try {
      let savedCount = 0;
      let deletedCount = 0;
      const errors = [];

      this.studentsInClass.forEach(student => {
        const studentItem = document.querySelector(`.student-attendance-item[data-student-id="${student.id}"]`);
        if (!studentItem) return;

        const status = studentItem.dataset.status;
        // For initial marking, reason is always empty as per requirement
        const reason = ''; 

        // Find existing record for this student, subject, date, and time
        const existingRecord = campusDB.getStorageData('attendance').find(a => 
          a.student_id === student.id && a.subject_id == subjectId && a.date === date && a.class_time === time
        );

        if (status === 'not_marked') {
          // If status is 'not_marked' and an existing record is found, delete it
          if (existingRecord) {
            campusDB.delete('attendance', existingRecord.id);
            deletedCount++;
          }
          // Otherwise, do nothing (no record to create or update)
        } else {
          // If status is 'present' or 'absent', create or update the record
          const attendanceData = {
            student_id: student.id,
            subject_id: parseInt(subjectId),
            date: date,
            class_time: time, // Store class time
            status: status,
            reason: reason, // Reason is empty for initial marking
            marked_by: this.facultyData.id // Faculty ID
          };

          try {
            if (existingRecord) {
              // If record exists, and status is changing, prevent direct overwrite here
              // User must use the 'Edit' button for changes to existing records.
              if (existingRecord.status !== status) {
                errors.push(`Attendance for ${student.name} is already marked as ${existingRecord.status}. Use 'Edit' to change.`);
                return;
              }
              // If status is same, no update needed, skip to prevent accidental overwrites without reason
            } else {
              campusDB.create('attendance', attendanceData);
              savedCount++;
            }
          } catch (error) {
            errors.push(`Error saving attendance for ${student.name}: ${error.message}`);
          }
        }
      });

      if (errors.length === 0) {
        let message = `Attendance saved successfully for ${savedCount} students.`;
        if (deletedCount > 0) {
          message += ` ${deletedCount} records removed.`;
        }
        this.showAlert(message, 'success');
        this.hideAttendanceModal();
        this.loadAttendance(); // Refresh the attendance view
      } else {
        this.showAlert(`Partially saved. ${errors.length} errors occurred.`, 'warning');
        console.error('Attendance save errors:', errors);
      }

    } catch (error) {
      console.error('Error saving attendance:', error);
      this.showAlert('Error saving attendance', 'error');
    }
  }

  // New: Show Edit Attendance Modal
  showEditAttendanceModal(recordId) {
    const record = campusDB.findById('attendance', recordId);
    if (!record) {
      this.showAlert('Attendance record not found.', 'error');
      return;
    }

    const student = campusDB.findById('students', record.student_id);
    const subject = campusDB.findById('subjects', record.subject_id); // Subject now has branch, year, semester, type

    document.getElementById('editAttendanceRecordId').value = record.id;
    document.getElementById('editStudentName').value = student ? student.name : 'N/A';
    document.getElementById('editSubjectName').value = subject ? `${subject.name} (${subject.code})` : 'N/A';
    document.getElementById('editAttendanceDate').value = record.date;
    document.getElementById('editAttendanceTime').value = record.class_time || '';
    document.getElementById('editAttendanceStatus').value = record.status;
    document.getElementById('editAttendanceReason').value = record.reason_for_change || record.reason || ''; // Pre-fill with existing reason or reason_for_change

    // Store original status to detect changes
    document.getElementById('editAttendanceStatus').dataset.originalStatus = record.status;

    // Toggle reason field visibility based on initial status
    this.toggleEditReasonField(); // Call to set initial visibility and required state

    document.getElementById('editAttendanceModal').style.display = 'flex';
  }

  // New: Save Edited Attendance
  saveEditedAttendance() {
    const recordId = parseInt(document.getElementById('editAttendanceRecordId').value);
    const oldRecord = campusDB.findById('attendance', recordId);
    if (!oldRecord) {
      this.showAlert('Original attendance record not found.', 'error');
      return;
    }

    const newStatus = document.getElementById('editAttendanceStatus').value;
    const newReason = document.getElementById('editAttendanceReason').value;
    const newTime = document.getElementById('editAttendanceTime').value;
    const originalStatus = document.getElementById('editAttendanceStatus').dataset.originalStatus;


    if (!newTime) {
      this.showAlert('Please enter a valid time.', 'error');
      return;
    }

    // If status changes OR if status is 'absent' and reason is empty
    if (originalStatus !== newStatus || (newStatus === 'absent' && !newReason)) {
        if (!newReason) {
            this.showAlert('Reason for changing attendance status or for absence is required.', 'error');
            return;
        }
    }

    try {
      campusDB.update('attendance', recordId, { 
        status: newStatus, 
        reason: newStatus === 'absent' ? newReason : '', // Only save reason if absent
        class_time: newTime,
        reason_for_change: newReason // Store reason for any change
      });
      this.showAlert('Attendance updated successfully', 'success');
      this.hideEditAttendanceModal();
      this.loadAttendance(); // Refresh the attendance view
    } catch (error) {
      console.error('Error saving edited attendance:', error);
      this.showAlert('Error saving edited attendance', 'error');
    }
  }

  generateMonthOptions() {
    const monthFilter = document.getElementById('monthFilter');
    const currentDate = new Date();
    
    // Generate last 6 months
    for (let i = 0; i < 6; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const monthValue = date.toISOString().slice(0, 7); // YYYY-MM format
      const monthText = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      
      const option = document.createElement('option');
      option.value = monthValue;
      option.textContent = monthText;
      monthFilter.appendChild(option);
    }
  }

  loadMonthlyOverview() {
    const month = document.getElementById('monthFilter').value;
    const selectedSubjectValue = document.getElementById('subjectFilter').value;

    if (!month || !selectedSubjectValue) {
      document.getElementById('monthlyOverview').style.display = 'none';
      return;
    }

    const [subjectId, branch, year, semester, section] = selectedSubjectValue.split('_');
    const subject = this.subjectsTaught.find(s => 
      s.id == subjectId && 
      s.branch === branch && 
      s.year == parseInt(year) && 
      s.semester == parseInt(semester) && 
      s.section === section
    );
    if (!subject) return;

    // Get students for this specific class offering
    const students = campusDB.getStudents({ branch: branch, year: parseInt(year), semester: parseInt(semester), section: section });

    // Get attendance records for this month and subject
    const attendanceRecords = campusDB.getStorageData('attendance').filter(a => 
      a.subject_id == subjectId && a.date.startsWith(month)
    );

    this.renderMonthlyOverview(students, attendanceRecords);
  }

  renderMonthlyOverview(students, attendanceRecords) {
    const tbody = document.getElementById('monthlyOverviewBody');
    
    if (students.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center">No students found</td></tr>';
      document.getElementById('monthlyOverview').style.display = 'block';
      return;
    }

    tbody.innerHTML = students.map(student => {
      const studentRecords = attendanceRecords.filter(r => r.student_id === student.id);
      const totalClasses = studentRecords.length;
      const presentCount = studentRecords.filter(r => r.status === 'present').length;
      const absentCount = studentRecords.filter(r => r.status === 'absent').length;
      const attendancePercentage = totalClasses > 0 ? Math.round((presentCount / totalClasses) * 100) : 0;

      return `
        <tr>
          <td>${student.student_id}</td>
          <td>${student.name}</td>
          <td>${totalClasses}</td>
          <td>${presentCount}</td>
          <td>${absentCount}</td>
          <td>${attendancePercentage}%</td>
          <td>
            <span class="badge ${attendancePercentage >= 75 ? 'badge-success' : attendancePercentage >= 60 ? 'badge-warning' : 'badge-error'}">
              ${attendancePercentage >= 75 ? 'Good' : attendancePercentage >= 60 ? 'Average' : 'Poor'}
            </span>
          </td>
        </tr>
      `;
    }).join('');

    document.getElementById('monthlyOverview').style.display = 'block';
  }

  exportAttendance() {
    const selectedSubjectValue = document.getElementById('subjectFilter').value;
    const date = document.getElementById('dateFilter').value;

    if (!selectedSubjectValue) {
      this.showAlert('Please select a subject/class', 'warning');
      return;
    }

    const [subjectId, branch, year, semester, section] = selectedSubjectValue.split('_');
    const subject = this.subjectsTaught.find(s => 
      s.id == subjectId && 
      s.branch === branch && 
      s.year == parseInt(year) && 
      s.semester == parseInt(semester) && 
      s.section === section
    );
    if (!subject) return;

    let data, filename;

    if (date) {
      // Export daily attendance
      const students = campusDB.getStudents({ branch: branch, year: parseInt(year), semester: parseInt(semester), section: section });
      const attendanceRecords = campusDB.getStorageData('attendance').filter(a => 
        a.subject_id == subjectId && a.date === date
      ).sort((a, b) => a.class_time.localeCompare(b.class_time));

      data = students.flatMap(student => {
        const recordsForStudent = attendanceRecords.filter(r => r.student_id === student.id);
        if (recordsForStudent.length === 0) {
          return [{
            student_id: student.student_id,
            name: student.name,
            class_time: 'N/A',
            status: 'not_marked',
            reason: ''
          }];
        } else {
          return recordsForStudent.map(record => ({
            student_id: student.student_id,
            name: student.name,
            class_time: record.class_time || 'N/A',
            status: record.status,
            reason: record.reason || ''
          }));
        }
      });

      filename = `attendance_${subject.code}_${branch}_Y${year}_S${semester}_Sec${section}_${date}.csv`;
    } else {
      // Export monthly overview
      const month = document.getElementById('monthFilter').value;
      if (!month) {
        this.showAlert('Please select date or month for export', 'warning');
        return;
      }

      const students = campusDB.getStudents({ branch: branch, year: parseInt(year), semester: parseInt(semester), section: section });
      const attendanceRecords = campusDB.getStorageData('attendance').filter(a => 
        a.subject_id == subjectId && a.date.startsWith(month)
      );

      data = students.map(student => {
        const studentRecords = attendanceRecords.filter(r => r.student_id === student.id);
        const totalClasses = studentRecords.length;
        const presentCount = studentRecords.filter(r => r.status === 'present').length;
        const attendancePercentage = totalClasses > 0 ? Math.round((presentCount / totalClasses) * 100) : 0;

        return {
          student_id: student.student_id,
          name: student.name,
          total_classes: totalClasses,
          present: presentCount,
          absent: totalClasses - presentCount,
          attendance_percentage: attendancePercentage
        };
      });

      filename = `attendance_${subject.code}_${branch}_Y${year}_S${semester}_Sec${section}_${month}.csv`;
    }

    // Convert to CSV
    const headers = Object.keys(data[0] || {});
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
    ].join('\n');

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    this.showAlert('Attendance exported successfully', 'success');
  }

  showAttendanceModal() {
    document.getElementById('attendanceModal').style.display = 'flex';
    // Reset form and pre-fill date/time
    document.getElementById('attendanceForm').reset();
    this.initializeDateFilter(); // This will set default date and clear period/time
    document.getElementById('studentsAttendanceList').style.display = 'none'; // Hide student list initially
    document.getElementById('attendanceSubject').value = ''; // Clear subject selection
    document.getElementById('studentsAttendanceBody').innerHTML = ''; // Clear student list
    document.getElementById('attendancePeriod').innerHTML = '<option value="">Select Period</option>'; // Clear periods
    document.getElementById('attendancePeriod').disabled = true; // Disable until subject is selected
  }

  hideAttendanceModal() {
    document.getElementById('attendanceModal').style.display = 'none';
    document.getElementById('studentsAttendanceList').style.display = 'none';
  }

  hideEditAttendanceModal() {
    document.getElementById('editAttendanceModal').style.display = 'none';
  }

  toggleEditReasonField() {
    const statusSelect = document.getElementById('editAttendanceStatus');
    const reasonGroup = document.getElementById('editReasonGroup');
    const reasonInput = document.getElementById('editAttendanceReason');
    const originalStatus = statusSelect.dataset.originalStatus;

    // Show reason field if status is 'absent' OR if status is changing
    if (statusSelect.value === 'absent' || originalStatus !== statusSelect.value) {
      reasonGroup.style.display = 'block';
      reasonInput.required = true;
    } else {
      reasonGroup.style.display = 'none';
      reasonInput.required = false;
      reasonInput.value = ''; // Clear reason if not required
    }
  }

  showAlert(message, type) {
    // Remove existing alerts
    const existingAlerts = document.querySelectorAll('.content-area .alert');
    existingAlerts.forEach(alert => alert.remove());

    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    
    const contentArea = document.querySelector('.content-area');
    contentArea.insertBefore(alert, contentArea.firstChild);

    setTimeout(() => {
      if (alert.parentNode) {
        alert.remove();
      }
    }, 5000);
  }
}

// Global functions
function showDayDetails(dateString) {
  // This function would typically open a modal or navigate to a page
  // showing detailed attendance for the selected date.
  // For now, we'll just show an alert.
  alert(`Details for ${new Date(dateString).toLocaleDateString()}:\n\n(Implementation for detailed view goes here)`);
}

// Initialize when DOM is loaded
let facultyAttendance; // Changed from studentAttendance to facultyAttendance
document.addEventListener('DOMContentLoaded', () => {
  facultyAttendance = new FacultyAttendance();
});

// Global functions for inline event handlers (for modals)
function showMarkAttendanceModal() {
  facultyAttendance.showAttendanceModal();
}

function hideAttendanceModal() {
  facultyAttendance.hideAttendanceModal();
}

function saveAttendance() {
  facultyAttendance.saveAttendance();
}

function markAllPresent() {
  facultyAttendance.markAllPresent();
}

function markAllAbsent() {
  facultyAttendance.markAllAbsent();
}

function showEditAttendanceModal(recordId) {
  facultyAttendance.showEditAttendanceModal(recordId);
}

function hideEditAttendanceModal() {
  facultyAttendance.hideEditAttendanceModal();
}

function saveEditedAttendance() {
  facultyAttendance.saveEditedAttendance();
}

function toggleEditReasonField() {
  facultyAttendance.toggleEditReasonField();
}