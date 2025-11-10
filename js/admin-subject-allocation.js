// Admin Subject Allocation Management
class AdminSubjectAllocation {
  constructor() {
    this.classOfferings = [];
    this.filteredOfferings = [];
    this.subjects = []; // All subjects (now with branch, year, semester, type)
    this.faculty = [];
    this.departments = []; // Store departments for branch dropdowns
    this.importData = []; // Added for import functionality
    this.init();
  }

  init() {
    // Check authentication
    if (!requireAuth() || !requireRole('admin')) {
      return;
    }
    this.loadData();
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Filters are handled by onchange in HTML
    // Form submission
    document.getElementById('allocateSubjectForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveClassOffering();
    });

    // New: Event listeners for dynamic subject dropdown in the modal
    document.getElementById('offeringBranch').addEventListener('change', () => this.handleClassDetailsChange());
    document.getElementById('offeringYear').addEventListener('change', () => this.handleClassDetailsChange());
    document.getElementById('offeringSemester').addEventListener('change', () => this.handleClassDetailsChange());
    document.getElementById('offeringType').addEventListener('change', () => this.handleClassDetailsChange()); // New listener for subject type

    // Main filter bar year change listener
    document.getElementById('yearFilter').addEventListener('change', () => this.handleMainFilterChange());
  }

  loadData() {
    try {
      this.classOfferings = campusDB.getStorageData('class_offerings');
      this.subjects = campusDB.getStorageData('subjects'); // Subjects now include branch, year, semester, type
      this.faculty = campusDB.getStorageData('faculty');
      this.departments = campusDB.getStorageData('departments'); // Load departments

      this.filteredOfferings = [...this.classOfferings];
      this.renderClassOfferingsTable();
      this.updateTotalCount();
      this.populateFilterDropdowns(); // Populate general filters (main page and modal branch)
      this.populateSubjectsDropdown(); // Initial load of subjects (unfiltered) for the modal
      // Initialize main filter semester dropdown
      this.populateSemesterDropdownForMainTable();
    } catch (error) {
      console.error('Error loading data:', error);
      this.showAlert('Error loading data', 'error');
    }
  }

  // Renamed and refactored to only populate the main filter dropdowns and modal branch/faculty
  populateFilterDropdowns() {
    const branchFilterSelect = document.getElementById('branchFilter');
    const offeringBranchSelect = document.getElementById('offeringBranch');
    const branches = [...new Set(this.departments.map(d => d.name))];

    [branchFilterSelect, offeringBranchSelect].forEach(selectElement => {
      const currentValue = selectElement.value; // Preserve current selection if any
      selectElement.innerHTML = '<option value="">All Branches</option>' + branches.map(b => `<option value="${b}">${b}</option>`).join('');
      if (currentValue) {
        selectElement.value = currentValue;
      }
    });

    const facultySelect = document.getElementById('offeringFaculty');
    if (this.faculty.length === 0) { // NEW LOGIC
      facultySelect.innerHTML = '<option value="">No Faculty Available</option>';
      facultySelect.disabled = true;
    } else {
      const facultyOptions = this.faculty.map(f => {
        return `<option value="${f.id}">${f.name} (${f.faculty_id})</option>`;
      }).join('');
      facultySelect.innerHTML = '<option value="">Select Faculty</option>' + facultyOptions;
      facultySelect.disabled = false;
    }
  }

  // New function to handle changes in Branch, Year, Semester or Type for the allocation modal
  handleClassDetailsChange() {
    const selectedBranch = document.getElementById('offeringBranch').value;
    const selectedYear = document.getElementById('offeringYear').value;
    const selectedSemester = document.getElementById('offeringSemester').value;
    const selectedType = document.getElementById('offeringType').value; // Get selected type

    this.populateSemesterDropdownForModal(selectedYear); // Update modal semester dropdown
    this.populateSubjectsDropdown(selectedBranch, selectedYear, selectedSemester, selectedType);
  }

  // New function to populate the Semester dropdown in the modal based on selected year
  populateSemesterDropdownForModal(selectedYear) {
    const semesterSelect = document.getElementById('offeringSemester');
    const currentSemester = semesterSelect.value;
    semesterSelect.innerHTML = '<option value="">Select Semester</option>';

    if (selectedYear) {
      const year = parseInt(selectedYear);
      const maxSemesterForYear = year * 2; // Cumulative semesters up to the selected year
      for (let i = 1; i <= maxSemesterForYear; i++) { // Loop from 1 to maxSemesterForYear
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `Semester ${i}`;
        semesterSelect.appendChild(option);
      }
      semesterSelect.disabled = false; // <--- This enables it
    } else {
      semesterSelect.disabled = true; // Disable if no year is selected
    }
    semesterSelect.value = currentSemester; // Restore previous selection if still valid
  }

  // New/Modified function to populate the Subject dropdown dynamically
  populateSubjectsDropdown(selectedBranch = '', selectedYear = '', selectedSemester = '', selectedType = '') {
    const subjectSelect = document.getElementById('offeringSubject');
    const currentSubjectId = subjectSelect.value; // Preserve current selection

    let filteredSubjects = [...this.subjects];
    if (selectedBranch) {
      filteredSubjects = filteredSubjects.filter(s => s.branch === selectedBranch);
    }
    if (selectedYear) {
      filteredSubjects = filteredSubjects.filter(s => s.year == parseInt(selectedYear));
    }
    if (selectedSemester) {
      filteredSubjects = filteredSubjects.filter(s => s.semester == parseInt(selectedSemester));
    }
    if (selectedType) {
      filteredSubjects = filteredSubjects.filter(s => s.type === selectedType);
    }

    // If the currently selected subject is not in the filtered list, but it's an edit,
    // ensure it's still an option. This handles cases where a subject might be
    // allocated to a specific branch/year/semester/type but not typically listed for it.
    if (currentSubjectId && !filteredSubjects.some(s => s.id == currentSubjectId)) {
      const existingSubject = this.subjects.find(s => s.id == currentSubjectId);
      if (existingSubject) {
        filteredSubjects.push(existingSubject);
      }
    }

    // Sort filtered subjects by name
    filteredSubjects.sort((a, b) => a.name.localeCompare(b.name));

    if (filteredSubjects.length === 0) {
      subjectSelect.innerHTML = '<option value="">No Subjects Found for this Class</option>';
      subjectSelect.disabled = true;
    } else {
      subjectSelect.innerHTML = '<option value="">Select Subject</option>' + filteredSubjects.map(s => `<option value="${s.id}">${s.name} (${s.code})</option>`).join('');
      subjectSelect.disabled = false;
    }
    // Restore previous selection if it's still a valid option
    if (currentSubjectId) {
      subjectSelect.value = currentSubjectId;
    }
  }

  // New function to handle changes in the main filter bar's year dropdown
  handleMainFilterChange() {
    this.populateSemesterDropdownForMainTable();
    this.filterOfferings(); // Trigger general filtering after semester update
  }

  // New function to populate the Semester dropdown in the main filter bar
  populateSemesterDropdownForMainTable() {
    const yearFilter = document.getElementById('yearFilter').value;
    const semesterFilter = document.getElementById('semesterFilter');
    const currentSemester = semesterFilter.value; // Preserve current selection
    semesterFilter.innerHTML = '<option value="">All Semesters</option>'; // Always include "All Semesters"

    if (yearFilter) {
      const year = parseInt(yearFilter);
      const maxSemesterForYear = year * 2; // Cumulative semesters up to the selected year
      for (let i = 1; i <= maxSemesterForYear; i++) { // Loop from 1 to maxSemesterForYear
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `Semester ${i}`;
        semesterFilter.appendChild(option);
      }
    }
    semesterFilter.value = currentSemester; // Restore previous selection if still valid
  }

  filterOfferings() {
    const branchFilter = document.getElementById('branchFilter').value;
    const yearFilter = document.getElementById('yearFilter').value;
    const semesterFilter = document.getElementById('semesterFilter').value;
    const sectionFilter = document.getElementById('sectionFilter').value;
    const statusFilter = document.getElementById('statusFilter').value;

    this.filteredOfferings = this.classOfferings.filter(offering => {
      const matchesBranch = !branchFilter || offering.branch === branchFilter;
      const matchesYear = !yearFilter || offering.year.toString() === yearFilter;
      const matchesSemester = !semesterFilter || offering.semester.toString() === semesterFilter;
      const matchesSection = !sectionFilter || offering.section === sectionFilter;
      let matchesStatus = true;
      if (statusFilter === 'active') {
        matchesStatus = offering.is_active && !offering.is_cleared;
      } else if (statusFilter === 'cleared') {
        matchesStatus = offering.is_cleared;
      } else if (statusFilter === 'inactive') {
        matchesStatus = !offering.is_active && !offering.is_cleared;
      }
      return matchesBranch && matchesYear && matchesSemester && matchesSection && matchesStatus;
    });
    this.renderClassOfferingsTable();
    this.updateTotalCount();
  }

  renderClassOfferingsTable() {
    const tbody = document.getElementById('classOfferingsTableBody');
    if (this.filteredOfferings.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="text-center">No class offerings found</td></tr>';
      return;
    }

    tbody.innerHTML = this.filteredOfferings.map(offering => {
      const subject = this.subjects.find(s => s.id === offering.subject_id);
      const faculty = this.faculty.find(f => f.id === offering.faculty_id);

      let statusText = 'Inactive';
      let statusBadgeClass = 'badge-secondary';
      if (offering.is_cleared) {
        statusText = 'Cleared';
        statusBadgeClass = 'badge-success';
      } else if (offering.is_active) {
        statusText = 'Active';
        statusBadgeClass = 'badge-info';
      }

      return `
        <tr>
          <td>${offering.branch}</td>
          <td>Year ${offering.year}</td>
          <td>Sem ${offering.semester}</td>
          <td>Sec ${offering.section}</td>
          <td><strong>${subject?.name || 'N/A'}</strong> (${subject?.code || 'N/A'})</td>
          <td><span class="badge ${subject?.type === 'theory' ? 'badge-info' : 'badge-secondary'}">${subject?.type.charAt(0).toUpperCase() + subject?.type.slice(1) || 'N/A'}</span></td>
          <td>${faculty?.name || 'N/A'}</td>
          <td>
            <span class="badge ${statusBadgeClass}">${statusText}</span>
          </td>
          <td>
            <button class="btn btn-primary btn-sm" onclick="subjectAllocation.editClassOffering(${offering.id})" style="margin-right: 5px;">
              <span>✏️</span>
            </button>
            <button class="btn btn-danger btn-sm" onclick="subjectAllocation.deleteClassOffering(${offering.id})">
              <span>🗑️</span>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  updateTotalCount() {
    document.getElementById('totalOfferings').textContent = `${this.filteredOfferings.length} offerings`;
  }

  showAllocateSubjectModal() {
    document.getElementById('allocateSubjectModalTitle').textContent = 'Allocate Subject';
    document.getElementById('allocateSubjectForm').reset();
    document.getElementById('offeringId').value = '';
    document.getElementById('offeringStatus').value = 'active'; // Default to active
    this.populateFilterDropdowns(); // Populate general filters (main page and modal branch)
    // Clear and initialize semester dropdown based on the (empty) initial year selection
    document.getElementById('offeringSemester').innerHTML = '<option value="">Select Semester</option>';
    document.getElementById('offeringSemester').disabled = true; // Disable until year is selected
    // Clear and disable subject dropdown
    document.getElementById('offeringSubject').innerHTML = '<option value="">Select Subject</option>';
    document.getElementById('offeringSubject').disabled = true;
    document.getElementById('allocateSubjectModal').style.display = 'flex';
  }

  editClassOffering(id) {
    const offering = this.classOfferings.find(o => o.id === id);
    if (!offering) return;

    document.getElementById('allocateSubjectModalTitle').textContent = 'Edit Subject Allocation';
    document.getElementById('offeringId').value = offering.id;
    document.getElementById('offeringBranch').value = offering.branch || '';
    document.getElementById('offeringYear').value = offering.year || '';
    document.getElementById('offeringSemester').value = offering.semester || '';
    document.getElementById('offeringSection').value = offering.section || '';
    document.getElementById('offeringType').value = offering.subject_type || ''; // Set subject type

    // Populate semester dropdown based on the existing offering's year
    this.populateSemesterDropdownForModal(offering.year);
    // Populate subjects dropdown based on the existing offering's branch, year, semester, and type
    this.populateSubjectsDropdown(offering.branch, offering.year, offering.semester, offering.subject_type);

    // Set values after options are populated
    document.getElementById('offeringSemester').value = offering.semester || '';
    document.getElementById('offeringSubject').value = offering.subject_id || ''; // Set subject after populating
    document.getElementById('offeringFaculty').value = offering.faculty_id || '';

    let statusValue = 'inactive';
    if (offering.is_cleared) {
      statusValue = 'cleared';
    } else if (offering.is_active) {
      statusValue = 'active';
    }
    document.getElementById('offeringStatus').value = statusValue;

    this.populateFilterDropdowns(); // Re-populate general filters to ensure latest data
    document.getElementById('allocateSubjectModal').style.display = 'flex';
  }

  saveClassOffering() {
    const offeringId = document.getElementById('offeringId').value;
    const status = document.getElementById('offeringStatus').value;
    const formData = {
      subject_id: parseInt(document.getElementById('offeringSubject').value),
      branch: document.getElementById('offeringBranch').value,
      year: parseInt(document.getElementById('offeringYear').value),
      semester: parseInt(document.getElementById('offeringSemester').value),
      section: document.getElementById('offeringSection').value,
      subject_type: document.getElementById('offeringType').value, // New field
      faculty_id: parseInt(document.getElementById('offeringFaculty').value),
      is_active: status === 'active',
      is_cleared: status === 'cleared'
    };

    // --- NEW VALIDATION ---
    if (isNaN(formData.subject_id)) {
      this.showAlert('Please select a valid Subject.', 'error');
      return;
    }
    if (isNaN(formData.faculty_id)) {
      this.showAlert('Please select a valid Faculty.', 'error');
      return;
    }
    if (!formData.branch) {
      this.showAlert('Please select a valid Branch.', 'error');
      return;
    }
    if (isNaN(formData.year)) {
      this.showAlert('Please select a valid Year.', 'error');
      return;
    }
    if (isNaN(formData.semester)) {
      this.showAlert('Please select a valid Semester.', 'error');
      return;
    }
    if (!formData.section) {
      this.showAlert('Please select a valid Section.', 'error');
      return;
    }
    if (!formData.subject_type) { // New validation
      this.showAlert('Please select a valid Subject Type.', 'error');
      return;
    }
    // --- END NEW VALIDATION ---

    try {
      // Validate that the selected subject's branch, year, semester, and type match the offering's details
      const selectedSubject = this.subjects.find(s => s.id === formData.subject_id);
      if (!selectedSubject || selectedSubject.branch !== formData.branch || selectedSubject.year !== formData.year || selectedSubject.semester !== formData.semester || selectedSubject.type !== formData.subject_type) { // New type validation
        this.showAlert('Selected Subject does not match the specified Branch, Year, Semester, and Type.', 'error');
        return;
      }

      // Basic validation for duplicates
      const existingOffering = this.classOfferings.find(o =>
        o.branch === formData.branch &&
        o.year === formData.year &&
        o.semester === formData.semester &&
        o.section === formData.section &&
        o.subject_id === formData.subject_id &&
        o.subject_type === formData.subject_type && // Include type in duplicate check
        o.id != offeringId // Exclude current item if editing
      );

      if (existingOffering) {
        this.showAlert('This subject is already allocated to this class (branch, year, semester, section, type).', 'error');
        return;
      }

      if (offeringId) {
        campusDB.update('class_offerings', parseInt(offeringId), formData);
        this.showAlert('Subject allocation updated successfully', 'success');
      } else {
        campusDB.create('class_offerings', formData);
        this.showAlert('Subject allocated successfully', 'success');
      }
      this.hideAllocateSubjectModal();
      this.loadData(); // Reload all data to refresh tables
    } catch (error) {
      console.error('Error saving class offering:', error);
      this.showAlert('Error saving subject allocation', 'error');
    }
  }

  deleteClassOffering(id) {
    if (!confirm('Are you sure you want to delete this subject allocation? This action cannot be undone.')) {
      return;
    }
    try {
      campusDB.delete('class_offerings', id);
      this.showAlert('Subject allocation deleted successfully', 'success');
      this.loadData();
    } catch (error) {
      console.error('Error deleting class offering:', error);
      this.showAlert('Error deleting subject allocation', 'error');
    }
  }

  hideAllocateSubjectModal() {
    document.getElementById('allocateSubjectModal').style.display = 'none';
  }

  // New import related methods
  showImportAllocationModal() {
    document.getElementById('importAllocationModal').style.display = 'flex';
    document.getElementById('importAllocationResults').style.display = 'none';
    document.getElementById('importAllocationBtn').style.display = 'block';
    document.getElementById('importAllocationBtn').disabled = true;
    document.getElementById('allocationCsvFile').value = ''; // Clear file input
    document.getElementById('importAllocationPreview').style.display = 'none'; // Hide preview
    this.importData = []; // Clear previous import data
  }

  hideImportAllocationModal() {
    document.getElementById('importAllocationModal').style.display = 'none';
    document.getElementById('allocationCsvFile').value = '';
    document.getElementById('importAllocationPreview').style.display = 'none';
    document.getElementById('importAllocationResults').style.display = 'none';
    document.getElementById('importAllocationBtn').disabled = true;
    this.importData = [];
  }

  handleAllocationFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      this.showAlert('Please select a CSV file', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      this.parseAllocationCSV(e.target.result);
    };
    reader.readAsText(file);
  }

  parseAllocationCSV(csvText) {
    try {
      const lines = csvText.split(/\r?\n/).filter(line => line.trim());
      if (lines.length < 2) {
        this.showAlert('CSV file must contain at least a header row and one data row', 'error');
        return;
      }

      const csvSplitRegex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
      const headers = lines[0].split(csvSplitRegex).map(h => h.trim().replace(/^"|"$/g, ''));
      const requiredHeaders = ['branch', 'year', 'semester', 'section', 'subject_type', 'subject_code', 'faculty_id'];
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

      if (missingHeaders.length > 0) {
        this.showAlert(`Missing required columns: ${missingHeaders.join(', ')}`, 'error');
        return;
      }

      this.importData = lines.slice(1).map(line => {
        const values = line.split(csvSplitRegex).map(v => v.trim().replace(/^"|"$/g, ''));
        const allocation = {};
        headers.forEach((header, index) => {
          allocation[header] = values[index] || '';
        });
        return allocation;
      });

      this.showImportAllocationPreview();
      document.getElementById('importAllocationBtn').disabled = false;
    } catch (error) {
      console.error('Error parsing CSV:', error);
      this.showAlert('Error parsing CSV file', 'error');
    }
  }

  showImportAllocationPreview() {
    const preview = document.getElementById('importAllocationPreview');
    const previewHeader = document.getElementById('previewAllocationHeader');
    const previewBody = document.getElementById('previewAllocationBody');

    if (this.importData.length === 0) return;

    preview.style.display = 'block';
    const headers = Object.keys(this.importData[0]);
    previewHeader.innerHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;

    const previewRows = this.importData.slice(0, 5);
    previewBody.innerHTML = previewRows.map(allocation => `
      <tr>${headers.map(h => `<td>${allocation[h]}</td>`).join('')}</tr>
    `).join('');
  }

  importAllocations() {
    if (this.importData.length === 0) return;

    try {
      let successCount = 0;
      let errorCount = 0;
      const errors = [];

      this.importData.forEach((allocationData, index) => {
        try {
          // Validate required fields
          if (!allocationData.branch || !allocationData.year || !allocationData.semester || !allocationData.section || !allocationData.subject_type || !allocationData.subject_code || !allocationData.faculty_id) {
            errors.push(`Row ${index + 2}: Missing required fields.`);
            errorCount++;
            return;
          }

          const subject = this.subjects.find(s =>
            s.code === allocationData.subject_code &&
            s.branch === allocationData.branch &&
            s.year == parseInt(allocationData.year) &&
            s.semester == parseInt(allocationData.semester) &&
            s.type === allocationData.subject_type
          );
          if (!subject) {
            errors.push(`Row ${index + 2}: Subject with code '${allocationData.subject_code}' and matching class details not found.`);
            errorCount++;
            return;
          }

          const faculty = this.faculty.find(f => f.faculty_id === allocationData.faculty_id);
          if (!faculty) {
            errors.push(`Row ${index + 2}: Faculty with ID '${allocationData.faculty_id}' not found.`);
            errorCount++;
            return;
          }

          const is_active = (allocationData.is_active || 'true').toLowerCase() === 'true';
          const is_cleared = (allocationData.is_cleared || 'false').toLowerCase() === 'true';

          const newAllocation = {
            subject_id: subject.id,
            branch: allocationData.branch,
            year: parseInt(allocationData.year),
            semester: parseInt(allocationData.semester),
            section: allocationData.section,
            subject_type: allocationData.subject_type,
            faculty_id: faculty.id,
            is_active: is_active,
            is_cleared: is_cleared
          };

          // Check for duplicates before creating
          const existingOffering = this.classOfferings.find(o =>
            o.branch === newAllocation.branch &&
            o.year === newAllocation.year &&
            o.semester === newAllocation.semester &&
            o.section === newAllocation.section &&
            o.subject_id === newAllocation.subject_id &&
            o.subject_type === newAllocation.subject_type
          );
          if (existingOffering) {
            errors.push(`Row ${index + 2}: Duplicate allocation for Subject '${subject.name}' in Year ${newAllocation.year}, Sem ${newAllocation.semester}, Sec ${newAllocation.section}.`);
            errorCount++;
            return;
          }

          campusDB.create('class_offerings', newAllocation);
          successCount++;
        } catch (error) {
          errors.push(`Row ${index + 2}: ${error.message}`);
          errorCount++;
        }
      });

      const results = document.getElementById('importAllocationResults');
      const stats = document.getElementById('importAllocationStats');
      const importAlertDiv = results.querySelector('.alert');

      stats.innerHTML = `
        <div>Successfully imported: ${successCount} allocations</div>
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
      document.getElementById('importAllocationBtn').style.display = 'none';
    } catch (error) {
      console.error('Error importing allocations:', error);
      this.showAlert('Error importing allocations', 'error');
      document.getElementById('importAllocationBtn').disabled = false;
      document.getElementById('importAllocationBtn').style.display = 'block';
    }
  }

  downloadAllocationTemplate() {
    const template = `branch,year,semester,section,subject_type,subject_code,faculty_id,is_active,is_cleared
Computer Science & Engineering,3,5,A,theory,CS301,FAC001,true,false
Civil Engineering,2,3,A,theory,CE201,FAC002,true,false
Computer Science & Engineering,3,5,B,lab,CS301L,FAC001,true,false
Computer Science & Engineering,1,1,A,skill_course,SKILL101,FAC001,true,false
Artificial Intelligence & Data Science,1,1,A,theory,AID101,FAC003,true,false
Artificial Intelligence & Data Science,1,1,A,theory,AID102,FAC003,true,false
Artificial Intelligence & Data Science,1,1,A,theory,AID103,FAC003,true,false`; // Updated template with only allowed types
    const blob = new Blob([template], {
      type: 'text/csv'
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'subject_allocation_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  showAlert(message, type) {
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

// Global functions for inline event handlers
function showAllocateSubjectModal() {
  subjectAllocation.showAllocateSubjectModal();
}

function hideAllocateSubjectModal() {
  subjectAllocation.hideAllocateSubjectModal();
}

function saveClassOffering() {
  subjectAllocation.saveClassOffering();
}

function showImportAllocationModal() {
  subjectAllocation.showImportAllocationModal();
}

function hideImportAllocationModal() {
  subjectAllocation.hideImportAllocationModal();
}

function handleAllocationFileSelect(event) {
  subjectAllocation.handleAllocationFileSelect(event);
}

function importAllocations() {
  subjectAllocation.importAllocations();
}

function downloadAllocationTemplate() {
  subjectAllocation.downloadAllocationTemplate();
}

// Initialize when DOM is loaded
let subjectAllocation;
document.addEventListener('DOMContentLoaded', () => {
  subjectAllocation = new AdminSubjectAllocation();
});