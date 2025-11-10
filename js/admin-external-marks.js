// Admin External Marks Management
class AdminExternalMarks {
  constructor() {
    this.allStudents = [];
    this.allSubjects = [];
    this.allMarks = []; // All marks, including internal and external
    this.filteredExternalMarks = [];
    this.studentsInClass = []; // Students for the currently selected class offering
    this.currentPage = 1;
    this.itemsPerPage = 10;
    this.marksCalculator = window.marksCalculator; // Use the global MarksCalculator instance
    this.init();
  }

  init() {
    if (!requireAuth() || !requireRole('admin')) {
      return;
    }
    this.loadData();
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Main filter bar listeners
    document.getElementById('branchFilter').addEventListener('change', () => this.filterMarks());
    document.getElementById('yearFilter').addEventListener('change', () => this.handleYearFilterChange());
    document.getElementById('semesterFilter').addEventListener('change', () => this.filterMarks());
    document.getElementById('sectionFilter').addEventListener('change', () => this.filterMarks());
    document.getElementById('subjectFilter').addEventListener('change', () => this.filterMarks());
    document.getElementById('searchInput').addEventListener('input', () => this.filterMarks());

    // Modal form submission
    document.getElementById('externalMarksForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveExternalMarks();
    });

    // Modal filter listeners
    document.getElementById('marksBranch').addEventListener('change', () => this.handleModalFilterChange());
    document.getElementById('marksYear').addEventListener('change', () => this.handleModalFilterChange());
    document.getElementById('marksSemester').addEventListener('change', () => this.handleModalFilterChange());
    document.getElementById('marksSection').addEventListener('change', () => this.handleModalFilterChange());
    document.getElementById('marksSubject').addEventListener('change', () => this.loadStudentsForMarksEntry());
  }

  loadData() {
    try {
      this.allStudents = campusDB.getStorageData('students');
      this.allSubjects = campusDB.getStorageData('subjects');
      this.allMarks = campusDB.getStorageData('marks'); // Load all marks
      
      this.populateFilterDropdowns();
      this.filterMarks(); // Initial render of external marks
    } catch (error) {
      console.error('AdminExternalMarks: Error loading data:', error);
      this.showAlert('Error loading data', 'error');
    }
  }

  populateFilterDropdowns() {
    // Populate main filter dropdowns
    const branchFilter = document.getElementById('branchFilter');
    const yearFilter = document.getElementById('yearFilter');
    const semesterFilter = document.getElementById('semesterFilter');
    const subjectFilter = document.getElementById('subjectFilter');

    const uniqueBranches = [...new Set(this.allSubjects.map(s => s.branch))];
    branchFilter.innerHTML = '<option value="">All Branches</option>' + uniqueBranches.map(b => `<option value="${b}">${b}</option>`).join('');

    // Populate modal dropdowns
    const marksBranch = document.getElementById('marksBranch');
    const marksYear = document.getElementById('marksYear');
    const marksSemester = document.getElementById('marksSemester');
    const marksSubject = document.getElementById('marksSubject');

    marksBranch.innerHTML = '<option value="">Select Branch</option>' + uniqueBranches.map(b => `<option value="${b}">${b}</option>`).join('');
    
    // Initialize semester dropdowns as empty/disabled
    semesterFilter.innerHTML = '<option value="">All Semesters</option>';
    marksSemester.innerHTML = '<option value="">Select Semester</option>';
    marksSemester.disabled = true;
    subjectFilter.innerHTML = '<option value="">All Subjects</option>'; // Ensure main subject filter is populated
    marksSubject.innerHTML = '<option value="">Select Subject</option>';
    marksSubject.disabled = true;
  }

  handleYearFilterChange() {
    this.populateSemesterDropdownForFilter();
    this.filterMarks();
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
    const branch = document.getElementById('marksBranch').value;
    const year = document.getElementById('marksYear').value;
    const semester = document.getElementById('marksSemester').value;
    const section = document.getElementById('marksSection').value;

    this.populateSemesterDropdownForModal(year);
    this.populateSubjectDropdownForModal(branch, year, semester, section);
    this.loadStudentsForMarksEntry(); // Reload students if filters change
  }

  populateSemesterDropdownForModal(selectedYear) {
    const semesterSelect = document.getElementById('marksSemester');
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
    const subjectSelect = document.getElementById('marksSubject');
    const currentSubjectId = subjectSelect.value;
    subjectSelect.innerHTML = '<option value="">Select Subject</option>';

    let filteredSubjects = this.allSubjects.filter(s => 
      (!branch || s.branch === branch) &&
      (!year || s.year == parseInt(year)) &&
      (!semester || s.semester == parseInt(semester)) &&
      s.type === 'theory' // Only show theory subjects for external marks
    );

    // Ensure the selected subject is part of a class offering for the given section
    const classOfferings = campusDB.getStorageData('class_offerings');
    filteredSubjects = filteredSubjects.filter(s => 
      classOfferings.some(co => 
        co.subject_id === s.id && 
        co.branch === s.branch && 
        co.year === s.year && 
        co.semester === s.semester && 
        co.section === section &&
        co.subject_type === 'theory' // Ensure it's a theory class offering
      )
    );

    filteredSubjects.sort((a, b) => a.name.localeCompare(b.name));

    if (filteredSubjects.length === 0) {
      subjectSelect.innerHTML = '<option value="">No Theory Subjects Found for this Class</option>';
      subjectSelect.disabled = true;
    } else {
      subjectSelect.innerHTML = '<option value="">Select Subject</option>' + filteredSubjects.map(s => `<option value="${s.id}">${s.name} (${s.code})</option>`).join('');
      subjectSelect.disabled = false;
    }
    if (currentSubjectId) {
      subjectSelect.value = currentSubjectId;
    }
  }

  filterMarks() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const branchFilter = document.getElementById('branchFilter').value;
    const yearFilter = document.getElementById('yearFilter').value;
    const semesterFilter = document.getElementById('semesterFilter').value;
    const sectionFilter = document.getElementById('sectionFilter').value;
    const subjectFilter = document.getElementById('subjectFilter').value;

    this.filteredExternalMarks = this.allMarks.filter(mark => {
      if (mark.assessment_type !== 'external_exam') return false;

      const student = this.allStudents.find(s => s.id === mark.student_id);
      const subject = this.allSubjects.find(s => s.id === mark.subject_id);

      if (!student || !subject) return false;

      const matchesSearch = !searchTerm || 
                            student.name.toLowerCase().includes(searchTerm) ||
                            student.student_id.toLowerCase().includes(searchTerm) ||
                            subject.name.toLowerCase().includes(searchTerm) ||
                            subject.code.toLowerCase().includes(searchTerm);
      const matchesBranch = !branchFilter || student.branch === branchFilter;
      const matchesYear = !yearFilter || student.year.toString() === yearFilter;
      const matchesSemester = !semesterFilter || student.semester.toString() === semesterFilter;
      const matchesSection = !sectionFilter || student.section === sectionFilter;
      const matchesSubject = !subjectFilter || mark.subject_id.toString() === subjectFilter;

      return matchesSearch && matchesBranch && matchesYear && matchesSemester && matchesSection && matchesSubject;
    });

    this.currentPage = 1;
    this.renderExternalMarksTable();
    this.updateTotalCount();
  }

  renderExternalMarksTable() {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    const pageMarks = this.filteredExternalMarks.slice(startIndex, endIndex);
    const tbody = document.getElementById('externalMarksTableBody');

    document.getElementById('totalExternalMarksCount').textContent = `${this.filteredExternalMarks.length} records`;

    if (pageMarks.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center">No external marks records found</td></tr>'; // Adjusted colspan
      this.renderPagination();
      return;
    }

    tbody.innerHTML = pageMarks.map(mark => {
      const student = this.allStudents.find(s => s.id === mark.student_id);
      const subject = this.allSubjects.find(s => s.id === mark.subject_id);
      const studentName = student ? student.name : 'N/A';
      const studentId = student ? student.student_id : 'N/A';
      const subjectDisplay = subject ? `${subject.name} (${subject.code})` : 'N/A';
      
      const percentage = mark.max_marks > 0 ? Math.round((mark.marks / mark.max_marks) * 100) : 0;

      return `
        <tr>
          <td><strong>${studentId}</strong></td>
          <td>${studentName}</td>
          <td>${subjectDisplay}</td>
          <td>${mark.marks}</td>
          <td>${mark.max_marks}</td>
          <td>
            <span class="badge ${this.marksCalculator.getPercentageBadgeClass(percentage)}">${percentage}%</span>
          </td>
          <td>${new Date(mark.date).toLocaleDateString()}</td>
          <td>
            <button class="btn btn-primary btn-sm" onclick="adminExternalMarks.editExternalMarks(${mark.id})" style="margin-right: 5px;">
              <span>✏️</span> Edit
            </button>
            <button class="btn btn-danger btn-sm" onclick="adminExternalMarks.deleteExternalMarks(${mark.id})">
              <span>🗑️</span> Delete
            </button>
          </td>
        </tr>
      `;
    }).join('');
    this.renderPagination();
  }

  renderPagination() {
    const totalPages = Math.ceil(this.filteredExternalMarks.length / this.itemsPerPage);
    const pagination = document.getElementById('pagination');
    if (totalPages <= 1) {
      pagination.innerHTML = '';
      return;
    }

    let paginationHTML = '';
    paginationHTML += `
      <button ${this.currentPage === 1 ? 'disabled' : ''} onclick="adminExternalMarks.goToPage(${this.currentPage - 1})">
        Previous
      </button>
    `;
    for (let i = 1; i <= totalPages; i++) {
      paginationHTML += `
        <button class="${i === this.currentPage ? 'active' : ''}" onclick="adminExternalMarks.goToPage(${i})">
          ${i}
        </button>
      `;
    }
    paginationHTML += `
      <button ${this.currentPage === totalPages ? 'disabled' : ''} onclick="adminExternalMarks.goToPage(${this.currentPage + 1})">
        Next
      </button>
    `;
    pagination.innerHTML = paginationHTML;
  }

  goToPage(page) {
    this.currentPage = page;
    this.renderExternalMarksTable();
  }

  updateTotalCount() {
    document.getElementById('totalExternalMarksCount').textContent = `${this.filteredExternalMarks.length} records`;
  }

  showAddExternalMarksModal() {
    document.getElementById('externalMarksModalTitle').textContent = 'Add External Marks';
    document.getElementById('externalMarksForm').reset();
    document.getElementById('marksId').value = '';
    document.getElementById('studentsMarksList').style.display = 'none';
    document.getElementById('studentsMarksBody').innerHTML = '';
    document.getElementById('marksMaxMarks').value = 70; // Default max marks for external
    
    // Reset modal filters
    document.getElementById('marksBranch').value = '';
    document.getElementById('marksYear').value = '';
    document.getElementById('marksSemester').innerHTML = '<option value="">Select Semester</option>';
    document.getElementById('marksSemester').disabled = true;
    document.getElementById('marksSection').value = '';
    document.getElementById('marksSubject').innerHTML = '<option value="">Select Subject</option>';
    document.getElementById('marksSubject').disabled = true;

    document.getElementById('externalMarksModal').style.display = 'flex';
  }

  editExternalMarks(id) {
    const mark = this.allMarks.find(m => m.id === id && m.assessment_type === 'external_exam');
    if (!mark) {
      this.showAlert('External mark record not found.', 'error');
      return;
    }

    document.getElementById('externalMarksModalTitle').textContent = 'Edit External Marks';
    document.getElementById('marksId').value = mark.id;

    const student = this.allStudents.find(s => s.id === mark.student_id);
    const subject = this.allSubjects.find(s => s.id === mark.subject_id);

    if (student && subject) {
      document.getElementById('marksBranch').value = student.branch;
      document.getElementById('marksYear').value = student.year;
      this.populateSemesterDropdownForModal(student.year); // Populate semester dropdown
      document.getElementById('marksSemester').value = student.semester;
      document.getElementById('marksSection').value = student.section;
      this.populateSubjectDropdownForModal(student.branch, student.year, student.semester, student.section); // Populate subject dropdown
      document.getElementById('marksSubject').value = subject.id;
      document.getElementById('marksMaxMarks').value = mark.max_marks;

      // Load only the specific student for editing
      this.studentsInClass = [student];
      this.renderStudentsMarksInputs(mark); // Pass the existing mark for pre-filling
      document.getElementById('studentsMarksList').style.display = 'block';
      document.getElementById('bulkMarks').style.display = 'none'; // Hide bulk entry for edit
      document.querySelector('#studentsMarksList button.btn-secondary:nth-of-type(1)').style.display = 'none'; // Hide "Apply to All"
      document.querySelector('#studentsMarksList button.btn-secondary:nth-of-type(2)').style.display = 'none'; // Hide "Mark All Absent"
    } else {
      this.showAlert('Associated student or subject not found.', 'error');
      return;
    }

    document.getElementById('externalMarksModal').style.display = 'flex';
  }

  loadStudentsForMarksEntry() {
    const branch = document.getElementById('marksBranch').value;
    const year = document.getElementById('marksYear').value;
    const semester = document.getElementById('marksSemester').value;
    const section = document.getElementById('marksSection').value;
    const subjectId = document.getElementById('marksSubject').value;

    if (!branch || !year || !semester || !section || !subjectId) {
      document.getElementById('studentsMarksList').style.display = 'none';
      return;
    }

    const filters = { branch: branch, year: parseInt(year), semester: parseInt(semester), section: section };
    this.studentsInClass = campusDB.getStudents(filters);

    this.renderStudentsMarksInputs();
    document.getElementById('studentsMarksList').style.display = 'block';
    document.getElementById('bulkMarks').style.display = 'block'; // Show bulk entry for new marks
    document.querySelector('#studentsMarksList button.btn-secondary:nth-of-type(1)').style.display = 'inline-block'; // Show "Apply to All"
    document.querySelector('#studentsMarksList button.btn-secondary:nth-of-type(2)').style.display = 'inline-block'; // Show "Mark All Absent"
  }

  renderStudentsMarksInputs(existingMark = null) {
    const tbody = document.getElementById('studentsMarksBody');
    const maxMarks = parseInt(document.getElementById('marksMaxMarks').value) || 70;
    
    if (this.studentsInClass.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center">No students found for this class</td></tr>';
      return;
    }

    tbody.innerHTML = this.studentsInClass.map(student => {
      const mark = existingMark && existingMark.student_id === student.id ? existingMark : 
                   this.allMarks.find(m => m.student_id === student.id && m.subject_id == document.getElementById('marksSubject').value && m.assessment_type === 'external_exam');
      
      const marksValue = mark ? mark.marks : '';
      const isAbsent = mark && mark.marks === 0 && mark.max_marks > 0; // Assuming 0 marks means absent if max_marks is positive
      const percentage = mark && mark.max_marks > 0 ? Math.round((mark.marks / mark.max_marks) * 100) : 0;

      return `
        <tr data-student-id="${student.id}">
          <td>${student.student_id}</td>
          <td>${student.name}</td>
          <td>
            <input type="number" class="form-input marks-input" id="marks_${student.id}" min="0" max="${maxMarks}" 
                   value="${marksValue}" onchange="adminExternalMarks.updatePercentage(${student.id})" ${isAbsent ? 'disabled' : ''}>
          </td>
          <td>
            <span id="percentage_${student.id}" class="badge ${this.marksCalculator.getPercentageBadgeClass(percentage)}">${isAbsent ? 'Absent' : percentage + '%'}</span>
          </td>
          <td>
            <input type="checkbox" id="absent_${student.id}" onchange="adminExternalMarks.toggleAbsent(${student.id})" ${isAbsent ? 'checked' : ''}>
          </td>
        </tr>
      `;
    }).join('');
  }

  updatePercentage(studentId) {
    const marksInput = document.getElementById(`marks_${studentId}`);
    const maxMarks = parseInt(document.getElementById('marksMaxMarks').value) || 70;
    const marks = parseInt(marksInput.value) || 0;
    const percentage = maxMarks > 0 ? Math.round((marks / maxMarks) * 100) : 0;
    
    const percentageSpan = document.getElementById(`percentage_${studentId}`);
    percentageSpan.textContent = `${percentage}%`;
    percentageSpan.className = `badge ${this.marksCalculator.getPercentageBadgeClass(percentage)}`;
  }

  updateAllPercentages() {
    this.studentsInClass.forEach(student => {
      this.updatePercentage(student.id);
    });
  }

  toggleAbsent(studentId) {
    const absentCheckbox = document.getElementById(`absent_${studentId}`);
    const marksInput = document.getElementById(`marks_${studentId}`);
    
    if (absentCheckbox.checked) {
      marksInput.value = '';
      marksInput.disabled = true;
      document.getElementById(`percentage_${studentId}`).textContent = 'Absent';
      document.getElementById(`percentage_${studentId}`).className = 'badge badge-error';
    } else {
      marksInput.disabled = false;
      this.updatePercentage(studentId);
    }
  }

  applyBulkMarks() {
    const bulkMarks = document.getElementById('bulkMarks').value;
    if (bulkMarks === '' || isNaN(bulkMarks)) {
      this.showAlert('Please enter a valid marks value', 'error');
      return;
    }
    const maxMarks = parseInt(document.getElementById('marksMaxMarks').value) || 70;
    const parsedBulkMarks = parseInt(bulkMarks);

    if (parsedBulkMarks < 0 || parsedBulkMarks > maxMarks) {
      this.showAlert(`Bulk marks must be between 0 and ${maxMarks}`, 'error');
      return;
    }

    this.studentsInClass.forEach(student => {
      const marksInput = document.getElementById(`marks_${student.id}`);
      const absentCheckbox = document.getElementById(`absent_${student.id}`);
      
      if (!absentCheckbox.checked) {
        marksInput.value = parsedBulkMarks;
        this.updatePercentage(student.id);
      }
    });

    document.getElementById('bulkMarks').value = '';
  }

  setAllAbsent() {
    this.studentsInClass.forEach(student => {
      const absentCheckbox = document.getElementById(`absent_${student.id}`);
      absentCheckbox.checked = true;
      this.toggleAbsent(student.id);
    });
  }

  saveExternalMarks() {
    const marksId = document.getElementById('marksId').value;
    const subjectId = parseInt(document.getElementById('marksSubject').value);
    const maxMarks = parseInt(document.getElementById('marksMaxMarks').value);

    if (!subjectId || !maxMarks) {
      this.showAlert('Please select a subject and enter max marks.', 'error');
      return;
    }

    try {
      let savedCount = 0;
      const errors = [];
      const currentUser = getCurrentUser();

      this.studentsInClass.forEach(student => {
        const marksInput = document.getElementById(`marks_${student.id}`);
        const absentCheckbox = document.getElementById(`absent_${student.id}`);
        
        const marks = absentCheckbox.checked ? 0 : parseInt(marksInput.value) || 0;
        
        if (!absentCheckbox.checked && marksInput.value === '') {
          return; // Skip students without marks entered if not explicitly marked absent
        }

        if (marks < 0 || marks > maxMarks) {
          errors.push(`Marks for ${student.name} (${marks}) are out of range (0-${maxMarks}).`);
          return;
        }

        const markData = {
          student_id: student.id,
          subject_id: subjectId,
          assessment_type: 'external_exam',
          marks: marks,
          max_marks: maxMarks,
          date: new Date().toISOString().split('T')[0],
          entered_by: currentUser.id
        };

        try {
          const existingMark = this.allMarks.find(m => 
            m.student_id === student.id && 
            m.subject_id === subjectId && 
            m.assessment_type === 'external_exam'
          );

          if (existingMark) {
            campusDB.update('marks', existingMark.id, markData);
          } else {
            campusDB.create('marks', markData);
          }
          savedCount++;
        } catch (error) {
          errors.push(`Error saving marks for ${student.name}: ${error.message}`);
        }
      });

      if (errors.length === 0) {
        this.showAlert(`External marks saved successfully for ${savedCount} students`, 'success');
        this.hideExternalMarksModal();
        this.loadData(); // Reload all data to refresh tables
      } else {
        this.showAlert(`Partially saved. ${errors.length} errors occurred.`, 'warning');
        console.error('External marks save errors:', errors);
      }

    } catch (error) {
      console.error('Error saving external marks:', error);
      this.showAlert('Error saving external marks', 'error');
    }
  }

  deleteExternalMarks(id) {
    if (!confirm('Are you sure you want to delete this external marks record? This action cannot be undone.')) {
      return;
    }
    try {
      campusDB.delete('marks', id);
      this.showAlert('External marks record deleted successfully', 'success');
      this.loadData();
    } catch (error) {
      console.error('Error deleting external marks record:', error);
      this.showAlert('Error deleting external marks record', 'error');
    }
  }

  hideExternalMarksModal() {
    document.getElementById('externalMarksModal').style.display = 'none';
  }

  showAlert(message, type) {
    const existingAlerts = document.querySelectorAll('#externalMarksAlert .alert');
    existingAlerts.forEach(alert => alert.remove());

    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    
    const alertContainer = document.getElementById('externalMarksAlert');
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

// Global functions for inline event handlers
let adminExternalMarks;
document.addEventListener('DOMContentLoaded', () => {
  adminExternalMarks = new AdminExternalMarks();
});