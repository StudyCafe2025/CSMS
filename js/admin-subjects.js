// Admin Subjects Management
class AdminSubjects {
  constructor() {
    this.subjects = [];
    this.filteredSubjects = [];
    this.importData = [];
    this.init();
  }

  init() {
    // Check authentication
    if (!requireAuth() || !requireRole('admin')) {
      return;
    }

    this.loadSubjects();
    this.setupEventListeners();
    this.handleURLParams();
  }

  setupEventListeners() {
    // Search and filter
    document.getElementById('searchInput').addEventListener('input', () => this.filterSubjects());
    document.getElementById('branchFilter').addEventListener('change', () => this.filterSubjects());
    document.getElementById('typeFilter').addEventListener('change', () => this.filterSubjects());

    // Subject form
    document.getElementById('subjectForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveSubject();
    });
  }

  handleURLParams() {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    
    if (action === 'add') {
      this.showAddSubjectModal();
    } else if (action === 'import') {
      this.showImportSubjectModal();
    }
  }

  // New function to handle year filter change and populate semester dropdown
  handleYearFilterChange() {
    this.populateSemesterDropdownForFilter();
    this.filterSubjects();
  }

  // New function to populate semester dropdown in main filter
  populateSemesterDropdownForFilter() {
    const yearFilter = document.getElementById('yearFilter').value;
    const semesterFilter = document.getElementById('semesterFilter');
    const currentSemester = semesterFilter.value;

    semesterFilter.innerHTML = '<option value="">All Semesters</option>';

    if (yearFilter) {
      const year = parseInt(yearFilter);
      const maxSemesterForYear = year * 2; // Cumulative semesters up to the selected year
      for (let i = 1; i <= maxSemesterForYear; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `Semester ${i}`;
        semesterFilter.appendChild(option);
      }
    }

    semesterFilter.value = currentSemester; // Restore previous selection if still valid
  }

  // New function to populate semester dropdown in modal
  populateSemesterDropdownForModal() {
    const yearSelect = document.getElementById('subjectYear');
    const semesterSelect = document.getElementById('subjectSemester');
    const selectedYear = yearSelect.value;
    const currentSemester = semesterSelect.value;

    semesterSelect.innerHTML = '<option value="">Select Semester</option>';

    if (selectedYear) {
      const year = parseInt(selectedYear);
      const maxSemesterForYear = year * 2; // Cumulative semesters up to the selected year
      for (let i = 1; i <= maxSemesterForYear; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `Semester ${i}`;
        semesterSelect.appendChild(option);
      }
    }

    semesterSelect.value = currentSemester; // Restore previous selection if still valid
  }

  loadSubjects() {
    try {
      this.subjects = campusDB.getStorageData('subjects');
      this.filteredSubjects = [...this.subjects];
      this.renderSubjectsTable();
      this.updateTotalCount();
    } catch (error) {
      console.error('Error loading subjects:', error);
      this.showAlert('Error loading subjects', 'error');
    }
  }

  filterSubjects() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const branchFilter = document.getElementById('branchFilter').value;
    const yearFilter = document.getElementById('yearFilter').value;
    const semesterFilter = document.getElementById('semesterFilter').value;
    const typeFilter = document.getElementById('typeFilter').value;

    this.filteredSubjects = this.subjects.filter(subject => {
      const matchesSearch = !searchTerm || 
        subject.name.toLowerCase().includes(searchTerm) || 
        subject.code.toLowerCase().includes(searchTerm);
      const matchesBranch = !branchFilter || subject.branch === branchFilter;
      const matchesYear = !yearFilter || subject.year.toString() === yearFilter;
      const matchesSemester = !semesterFilter || subject.semester.toString() === semesterFilter;
      const matchesType = !typeFilter || subject.type === typeFilter;

      return matchesSearch && matchesBranch && matchesYear && matchesSemester && matchesType;
    });

    this.renderSubjectsTable();
    this.updateTotalCount();
  }

  renderSubjectsTable() {
    const tbody = document.getElementById('subjectsTableBody');

    if (this.filteredSubjects.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center">No subjects found</td></tr>';
      return;
    }

    tbody.innerHTML = this.filteredSubjects.map(subject => `
      <tr>
        <td><strong>${subject.code}</strong></td>
        <td>${subject.name}</td>
        <td>${subject.branch}</td>
        <td>Year ${subject.year}</td>
        <td>Sem ${subject.semester}</td>
        <td>
          <span class="badge ${this.getTypeBadgeClass(subject.type)}">
            ${subject.type.charAt(0).toUpperCase() + subject.type.slice(1)}
          </span>
        </td>
        <td>${subject.credits}</td>
        <td>
          <button class="btn btn-primary btn-sm" onclick="adminSubjects.editSubject(${subject.id})" style="margin-right: 5px;">
            <span>✏️</span>
          </button>
          <button class="btn btn-danger btn-sm" onclick="adminSubjects.deleteSubject(${subject.id})">
            <span>🗑️</span>
          </button>
        </td>
      </tr>
    `).join('');
  }

  getTypeBadgeClass(type) {
    switch (type) {
      case 'theory': return 'badge-info';
      case 'lab': return 'badge-success';
      case 'skill_course': return 'badge-warning';
      default: return 'badge-secondary';
    }
  }

  updateTotalCount() {
    document.getElementById('totalCount').textContent = `${this.filteredSubjects.length} subjects`;
  }

  showAddSubjectModal() {
    document.getElementById('subjectModalTitle').textContent = 'Add Subject';
    document.getElementById('subjectForm').reset();
    document.getElementById('subjectId').value = '';
    
    // Initialize semester dropdown as empty
    document.getElementById('subjectSemester').innerHTML = '<option value="">Select Semester</option>';
    
    document.getElementById('subjectModal').style.display = 'flex';
  }

  editSubject(id) {
    const subject = this.subjects.find(s => s.id === id);
    if (!subject) return;

    document.getElementById('subjectModalTitle').textContent = 'Edit Subject';
    document.getElementById('subjectId').value = subject.id;
    document.getElementById('subjectName').value = subject.name || '';
    document.getElementById('subjectCode').value = subject.code || '';
    document.getElementById('subjectBranch').value = subject.branch || '';
    document.getElementById('subjectYear').value = subject.year || '';
    document.getElementById('subjectType').value = subject.type || '';
    document.getElementById('subjectCredits').value = subject.credits || '';

    // Populate semester dropdown based on the subject's year, then set the semester
    this.populateSemesterDropdownForModal();
    document.getElementById('subjectSemester').value = subject.semester || '';

    document.getElementById('subjectModal').style.display = 'flex';
  }

  saveSubject() {
    const formData = {
      name: document.getElementById('subjectName').value,
      code: document.getElementById('subjectCode').value,
      branch: document.getElementById('subjectBranch').value,
      year: parseInt(document.getElementById('subjectYear').value),
      semester: parseInt(document.getElementById('subjectSemester').value),
      type: document.getElementById('subjectType').value,
      credits: parseInt(document.getElementById('subjectCredits').value)
    };

    // Validation
    if (!formData.name || !formData.code || !formData.branch || 
        !formData.year || !formData.semester || !formData.type || formData.credits === undefined) { // Changed to check for undefined
      this.showAlert('Please fill all required fields', 'error');
      return;
    }

    try {
      const subjectId = document.getElementById('subjectId').value;
      
      // Check for duplicate subject code
      const existingSubject = this.subjects.find(s => 
        s.code === formData.code && 
        s.branch === formData.branch && 
        s.year === formData.year && 
        s.semester === formData.semester && 
        s.type === formData.type && 
        s.id != subjectId
      );

      if (existingSubject) {
        this.showAlert('Subject with this code already exists for this class and type', 'error');
        return;
      }

      if (subjectId) {
        // Update existing subject
        campusDB.update('subjects', parseInt(subjectId), formData);
        this.showAlert('Subject updated successfully', 'success');
      } else {
        // Add new subject
        campusDB.create('subjects', formData);
        this.showAlert('Subject added successfully', 'success');
      }

      this.hideSubjectModal();
      this.loadSubjects();
    } catch (error) {
      console.error('Error saving subject:', error);
      this.showAlert('Error saving subject', 'error');
    }
  }

  deleteSubject(id) {
    const subject = this.subjects.find(s => s.id === id);
    if (!subject) return;

    if (!confirm(`Are you sure you want to delete "${subject.name}" (${subject.code})? This action cannot be undone.`)) {
      return;
    }

    try {
      // Check if subject is being used in class offerings
      const classOfferings = campusDB.getStorageData('class_offerings');
      const isInUse = classOfferings.some(co => co.subject_id === id);

      if (isInUse) {
        this.showAlert('Cannot delete subject. It is currently allocated to classes.', 'error');
        return;
      }

      campusDB.delete('subjects', id);
      this.showAlert('Subject deleted successfully', 'success');
      this.loadSubjects();
    } catch (error) {
      console.error('Error deleting subject:', error);
      this.showAlert('Error deleting subject', 'error');
    }
  }

  hideSubjectModal() {
    document.getElementById('subjectModal').style.display = 'none';
  }

  // Import functionality
  showImportSubjectModal() {
    document.getElementById('importSubjectModal').style.display = 'flex';
    document.getElementById('importSubjectResults').style.display = 'none';
    document.getElementById('importSubjectBtn').style.display = 'block';
    document.getElementById('importSubjectBtn').disabled = true;
  }

  hideImportSubjectModal() {
    document.getElementById('importSubjectModal').style.display = 'none';
    document.getElementById('subjectCsvFile').value = '';
    document.getElementById('importSubjectPreview').style.display = 'none';
    document.getElementById('importSubjectResults').style.display = 'none';
    document.getElementById('importSubjectBtn').disabled = true;
    this.importData = [];
  }

  handleSubjectFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      this.showAlert('Please select a CSV file', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      this.parseSubjectCSV(e.target.result);
    };
    reader.readAsText(file);
  }

  parseSubjectCSV(csvText) {
    try {
      const lines = csvText.split(/\r?\n/).filter(line => line.trim());
      if (lines.length < 2) {
        this.showAlert('CSV file must contain at least a header row and one data row', 'error');
        return;
      }

      const csvSplitRegex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
      const headers = lines[0].split(csvSplitRegex).map(h => h.trim().replace(/^"|"$/g, ''));
      const requiredHeaders = ['name', 'code', 'branch', 'year', 'semester', 'type', 'credits'];
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

      if (missingHeaders.length > 0) {
        this.showAlert(`Missing required columns: ${missingHeaders.join(', ')}`, 'error');
        return;
      }

      this.importData = lines.slice(1).map(line => {
        const values = line.split(csvSplitRegex).map(v => v.trim().replace(/^"|"$/g, ''));
        const subject = {};
        headers.forEach((header, index) => {
          subject[header] = values[index] || '';
          if (header === 'type') {
            subject[header] = subject[header].toLowerCase().replace(/_/g, ' '); // Normalize type to lowercase and replace underscore
          }
        });
        return subject;
      });

      this.showImportSubjectPreview();
      document.getElementById('importSubjectBtn').disabled = false;
    } catch (error) {
      console.error('Error parsing CSV:', error);
      this.showAlert('Error parsing CSV file', 'error');
    }
  }

  showImportSubjectPreview() {
    const preview = document.getElementById('importSubjectPreview');
    const previewHeader = document.getElementById('previewSubjectHeader');
    const previewBody = document.getElementById('previewSubjectBody');

    if (this.importData.length === 0) return;

    preview.style.display = 'block';
    const headers = Object.keys(this.importData[0]);
    previewHeader.innerHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;

    const previewRows = this.importData.slice(0, 5);
    previewBody.innerHTML = previewRows.map(subject => `
      <tr>${headers.map(h => `<td>${subject[h]}</td>`).join('')}</tr>
    `).join('');
  }

  importSubjects() {
    if (this.importData.length === 0) return;

    try {
      let successCount = 0;
      let errorCount = 0;
      const errors = [];

      this.importData.forEach((subjectData, index) => {
        try {
          // Validate required fields
          if (!subjectData.name || !subjectData.code || !subjectData.branch || 
              !subjectData.year || !subjectData.semester || !subjectData.type || subjectData.credits === '') { // Check for empty string for credits
            errors.push(`Row ${index + 2}: Missing required fields`);
            errorCount++;
            return;
          }

          // Validate data types
          const year = parseInt(subjectData.year);
          const semester = parseInt(subjectData.semester);
          const credits = parseInt(subjectData.credits);
          const type = subjectData.type.toLowerCase().replace(/_/g, ' '); // Ensure type is normalized here too

          if (isNaN(year) || year < 1 || year > 4) {
            errors.push(`Row ${index + 2}: Invalid year (must be 1-4)`);
            errorCount++;
            return;
          }

          if (isNaN(semester) || semester < 1 || semester > 8) {
            errors.push(`Row ${index + 2}: Invalid semester (must be 1-8)`);
            errorCount++;
            return;
          }

          // Modified credits validation: allow 0 for 'theory' type, otherwise 1-6
          if (isNaN(credits) || credits < 0 || credits > 6 || (credits === 0 && type !== 'theory')) {
            errors.push(`Row ${index + 2}: Invalid credits (must be 1-6, or 0 for non-credit theory courses)`);
            errorCount++;
            return;
          }

          // Validate subject type
          if (!['theory', 'lab', 'skill course'].includes(type)) { // Updated to 'skill course'
            errors.push(`Row ${index + 2}: Invalid type (must be theory, lab, or skill course)`);
            errorCount++;
            return;
          }

          // Check for duplicates
          const existingSubject = this.subjects.find(s => 
            s.code === subjectData.code && 
            s.branch === subjectData.branch && 
            s.year === year && 
            s.semester === semester && 
            s.type === type
          );

          if (existingSubject) {
            errors.push(`Row ${index + 2}: Subject with code '${subjectData.code}' already exists for this class and type`);
            errorCount++;
            return;
          }

          const subjectRecord = {
            name: subjectData.name,
            code: subjectData.code,
            branch: subjectData.branch,
            year: year,
            semester: semester,
            type: type,
            credits: credits
          };

          campusDB.create('subjects', subjectRecord);
          successCount++;
        } catch (error) {
          errors.push(`Row ${index + 2}: ${error.message}`);
          errorCount++;
        }
      });

      const results = document.getElementById('importSubjectResults');
      const stats = document.getElementById('importSubjectStats');
      const importAlertDiv = results.querySelector('.alert');

      stats.innerHTML = `
        <div>Successfully imported: ${successCount} subjects</div>
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
      this.loadSubjects();
      document.getElementById('importSubjectBtn').style.display = 'none';
    } catch (error) {
      console.error('Error importing subjects:', error);
      this.showAlert('Error importing subjects', 'error');
    }
  }

  downloadSubjectTemplate() {
    const template = `name,code,branch,year,semester,type,credits
Data Structures,CS301,Computer Science & Engineering,3,5,theory,4
Data Structures Lab,CS301L,Computer Science & Engineering,3,5,lab,2
Algorithms,CS302,Computer Science & Engineering,3,6,theory,4
Database Systems,CS303,Computer Science & Engineering,3,5,theory,3
Engineering Mechanics,CE201,Civil Engineering,2,3,theory,3
Communication Skills,SKILL101,Computer Science & Engineering,1,1,skill course,2
Environmental Science,ENV101,Artificial Intelligence & Data Science,1,1,theory,0`; // Added example for 0 credits
    const blob = new Blob([template], {
      type: 'text/csv'
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'subjects_import_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  showAlert(message, type) {
    // Remove existing alerts
    const existingAlerts = document.querySelectorAll('.content-area .alert');
    existingAlerts.forEach(alert => alert.remove());

    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    
    const contentArea = document.querySelector('.content-area');
    if (contentArea) {
      contentArea.insertBefore(alert, contentArea.firstChild);
    }

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (alert.parentNode) {
        alert.remove();
      }
    }, 5000);
  }
}

// Global functions for inline event handlers
function showAddSubjectModal() {
  adminSubjects.showAddSubjectModal();
}

function hideSubjectModal() {
  adminSubjects.hideSubjectModal();
}

function saveSubject() {
  adminSubjects.saveSubject();
}

function showImportSubjectModal() {
  adminSubjects.showImportSubjectModal();
}

function hideImportSubjectModal() {
  adminSubjects.hideImportSubjectModal();
}

function handleSubjectFileSelect(event) {
  adminSubjects.handleSubjectFileSelect(event);
}

function importSubjects() {
  adminSubjects.importSubjects();
}

function downloadSubjectTemplate() {
  adminSubjects.downloadSubjectTemplate();
}

function exportSubjects() {
  if (adminSubjects.filteredSubjects.length === 0) {
    adminSubjects.showAlert('No subjects to export', 'warning');
    return;
  }

  const headers = ['name', 'code', 'branch', 'year', 'semester', 'type', 'credits'];
  const csvContent = [
    headers.join(','),
    ...adminSubjects.filteredSubjects.map(subject => 
      headers.map(header => `"${subject[header] || ''}"`).join(',')
    )
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `subjects_export_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);

  adminSubjects.showAlert('Subjects exported successfully', 'success');
}

// Initialize when DOM is loaded
let adminSubjects;
document.addEventListener('DOMContentLoaded', () => {
  adminSubjects = new AdminSubjects();
});