// Admin Students Management
class AdminStudents {
  constructor() {
    this.students = [];
    this.filteredStudents = [];
    this.selectedStudents = new Set();
    this.currentPage = 1;
    this.itemsPerPage = 10;
    this.importData = [];
    this.init();
  }

  init() {
    // Check authentication
    if (!requireAuth() || !requireRole('admin')) {
      return;
    }

    this.loadStudents();
    this.setupEventListeners();
    this.handleURLParams();
  }

  setupEventListeners() {
    // Search and filter
    document.getElementById('searchInput').addEventListener('input', () => this.filterStudents());
    document.getElementById('branchFilter').addEventListener('change', () => this.filterStudents());
    document.getElementById('yearFilter').addEventListener('change', () => this.filterStudents());
    document.getElementById('semesterFilter').addEventListener('change', () => this.filterStudents());
    document.getElementById('sectionFilter').addEventListener('change', () => this.filterStudents()); // New filter

    // Student form
    document.getElementById('studentForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveStudent();
    });
  }

  handleURLParams() {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    const branch = params.get('branch'); // New: Check for branch filter

    if (action === 'import') {
      this.showImportModal();
    } else if (action === 'add') {
      this.showAddStudentModal();
    }

    if (branch) {
      document.getElementById('branchFilter').value = branch;
      this.filterStudents(); // Apply filter immediately
    }
  }

  loadStudents() {
    try {
      this.students = campusDB.getStorageData('students');
      this.filteredStudents = [...this.students];
      this.renderStudentsTable();
      this.updateTotalCount();
    } catch (error) {
      console.error('Error loading students:', error);
      this.showAlert('Error loading students', 'error');
    }
  }

  filterStudents() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const branchFilter = document.getElementById('branchFilter').value;
    const yearFilter = document.getElementById('yearFilter').value;
    const semesterFilter = document.getElementById('semesterFilter').value;
    const sectionFilter = document.getElementById('sectionFilter').value; // New filter

    this.filteredStudents = this.students.filter(student => {
      const matchesSearch = !searchTerm || student.name.toLowerCase().includes(searchTerm) || student.email.toLowerCase().includes(searchTerm) || student.student_id.toLowerCase().includes(searchTerm);
      const matchesBranch = !branchFilter || student.branch === branchFilter;
      const matchesYear = !yearFilter || student.year.toString() === yearFilter;
      const matchesSemester = !semesterFilter || student.semester.toString() === semesterFilter;
      const matchesSection = !sectionFilter || student.section === sectionFilter; // New filter

      return matchesSearch && matchesBranch && matchesYear && matchesSemester && matchesSection;
    });
    this.currentPage = 1;
    this.renderStudentsTable();
    this.updateTotalCount();
  }

  renderStudentsTable() {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    const pageStudents = this.filteredStudents.slice(startIndex, endIndex);
    const tbody = document.getElementById('studentsTableBody');

    if (pageStudents.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10" class="text-center">No students found</td></tr>';
      this.renderPagination();
      return;
    }

    tbody.innerHTML = pageStudents.map(student => `
      <tr>
        <td>
          <input type="checkbox" class="student-checkbox" value="${student.id}" onchange="adminStudents.toggleStudentSelection(${student.id})" ${this.selectedStudents.has(student.id) ? 'checked' : ''}>
        </td>
        <td><strong>${student.student_id}</strong></td>
        <td>${student.name}</td>
        <td>${student.email}</td>
        <td>${student.branch}</td>
        <td>Year ${student.year}</td>
        <td>Sem ${student.semester}</td>
        <td>${student.section || 'N/A'}</td>
        <td>
          <span class="badge ${student.status === 'active' ? 'badge-success' : 'badge-warning'}">
            ${student.status || 'active'}
          </span>
        </td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="adminStudents.viewStudent(${student.id})" style="margin-right: 5px;">
            <span>👁️</span>
          </button>
          <button class="btn btn-primary btn-sm" onclick="adminStudents.editStudent(${student.id})" style="margin-right: 5px;">
            <span>✏️</span>
          </button>
          <button class="btn btn-danger btn-sm" onclick="adminStudents.deleteStudent(${student.id})">
            <span>🗑️</span>
          </button>
        </td>
      </tr>
    `).join('');
    this.renderPagination();
    this.updateBulkActions();
  }

  renderPagination() {
    const totalPages = Math.ceil(this.filteredStudents.length / this.itemsPerPage);
    const pagination = document.getElementById('pagination');
    if (totalPages <= 1) {
      pagination.innerHTML = '';
      return;
    }

    let paginationHTML = '';
    // Previous button
    paginationHTML += `
      <button ${this.currentPage === 1 ? 'disabled' : ''} onclick="adminStudents.goToPage(${this.currentPage - 1})">
        Previous
      </button>
    `;

    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= this.currentPage - 2 && i <= this.currentPage + 2)) {
        paginationHTML += `
          <button class="${i === this.currentPage ? 'active' : ''}" onclick="adminStudents.goToPage(${i})">
            ${i}
          </button>
        `;
      } else if (i === this.currentPage - 3 || i === this.currentPage + 3) {
        paginationHTML += '<span>...</span>';
      }
    }

    // Next button
    paginationHTML += `
      <button ${this.currentPage === totalPages ? 'disabled' : ''} onclick="adminStudents.goToPage(${this.currentPage + 1})">
        Next
      </button>
    `;
    pagination.innerHTML = paginationHTML;
  }

  goToPage(page) {
    this.currentPage = page;
    this.renderStudentsTable();
  }

  updateTotalCount() {
    document.getElementById('totalCount').textContent = `${this.filteredStudents.length} students`;
  }

  toggleStudentSelection(studentId) {
    if (this.selectedStudents.has(studentId)) {
      this.selectedStudents.delete(studentId);
    } else {
      this.selectedStudents.add(studentId);
    }
    this.updateBulkActions();
  }

  updateBulkActions() {
    const bulkActions = document.getElementById('bulkActions');
    const selectedCount = document.getElementById('selectedCount');
    const selectAllCheckbox = document.getElementById('selectAll');

    if (this.selectedStudents.size > 0) {
      bulkActions.style.display = 'block';
      selectedCount.textContent = `${this.selectedStudents.size} students selected`;
    } else {
      bulkActions.style.display = 'none';
    }

    // Update select all checkbox
    const visibleStudentIds = this.filteredStudents.slice(
      (this.currentPage - 1) * this.itemsPerPage,
      this.currentPage * this.itemsPerPage
    ).map(s => s.id);

    const allVisible = visibleStudentIds.length > 0 && visibleStudentIds.every(id => this.selectedStudents.has(id));
    const someVisible = visibleStudentIds.some(id => this.selectedStudents.has(id));

    selectAllCheckbox.checked = allVisible;
    selectAllCheckbox.indeterminate = someVisible && !allVisible;
  }

  showAddStudentModal() {
    document.getElementById('studentModalTitle').textContent = 'Add Student';
    document.getElementById('studentForm').reset();
    document.getElementById('studentId').value = '';
    document.getElementById('studentModal').style.display = 'flex';
  }

  editStudent(id) {
    const student = this.students.find(s => s.id === id);
    if (!student) return;

    document.getElementById('studentModalTitle').textContent = 'Edit Student';
    document.getElementById('studentId').value = student.id;
    document.getElementById('studentName').value = student.name || '';
    document.getElementById('studentEmail').value = student.email || '';
    document.getElementById('studentStudentId').value = student.student_id || '';
    document.getElementById('studentPhone').value = student.phone || '';
    document.getElementById('studentBranch').value = student.branch || '';
    document.getElementById('studentYear').value = student.year || '';
    document.getElementById('studentSemester').value = student.semester || '';
    document.getElementById('studentSection').value = student.section || ''; // New field
    document.getElementById('studentDOB').value = student.date_of_birth || '';
    document.getElementById('studentAddress').value = student.address || '';
    document.getElementById('studentFatherName').value = student.father_name || '';
    document.getElementById('studentMotherName').value = student.mother_name || '';
    document.getElementById('studentParentsPhone').value = student.parents_phone || ''; // New field

    document.getElementById('studentModal').style.display = 'flex';
  }

  viewStudent(id) {
    // Redirect to the new student profile page
    window.location.href = `student-profile.html?id=${id}`;
  }

  saveStudent() {
    const formData = {
      name: document.getElementById('studentName').value,
      email: document.getElementById('studentEmail').value,
      student_id: document.getElementById('studentStudentId').value,
      phone: document.getElementById('studentPhone').value,
      branch: document.getElementById('studentBranch').value,
      year: parseInt(document.getElementById('studentYear').value),
      semester: parseInt(document.getElementById('studentSemester').value),
      section: document.getElementById('studentSection').value, // New field
      date_of_birth: document.getElementById('studentDOB').value,
      address: document.getElementById('studentAddress').value,
      father_name: document.getElementById('studentFatherName').value,
      mother_name: document.getElementById('studentMotherName').value,
      parents_phone: document.getElementById('studentParentsPhone').value, // New field
      status: 'active'
    };

    try {
      const studentId = document.getElementById('studentId').value;
      if (studentId) {
        // Update existing student
        campusDB.update('students', parseInt(studentId), formData);
        this.showAlert('Student updated successfully', 'success');
      } else {
        // Add new student
        campusDB.create('students', formData);
        this.showAlert('Student added successfully', 'success');
      }
      this.hideStudentModal();
      this.loadStudents();
    } catch (error) {
      console.error('Error saving student:', error);
      this.showAlert('Error saving student', 'error');
    }
  }

  deleteStudent(id) {
    if (!confirm('Are you sure you want to delete this student? This action cannot be undone.')) {
      return;
    }
    try {
      campusDB.delete('students', id);
      this.showAlert('Student deleted successfully', 'success');
      this.loadStudents();
    } catch (error) {
      console.error('Error deleting student:', error);
      this.showAlert('Error deleting student', 'error');
    }
  }

  deleteAllStudents() {
    if (this.students.length === 0) {
      this.showAlert('No students to delete.', 'warning');
      return;
    }

    const confirmation = prompt(
      `WARNING: You are about to delete ALL ${this.students.length} student records. This action is irreversible. To confirm, please type "DELETE ALL" in the box below:`
    );

    if (confirmation === 'DELETE ALL') {
      try {
        // Clear the 'students' table in localStorage
        localStorage.setItem('campusiq_students', JSON.stringify([]));
        // Also remove any associated user accounts if they exist (simplified for demo)
        const users = campusDB.getStorageData('users');
        const nonStudentUsers = users.filter(user => user.role !== 'student');
        localStorage.setItem('campusiq_users', JSON.stringify(nonStudentUsers));

        this.showAlert('All student records have been successfully deleted.', 'success');
        this.loadStudents(); // Reload to show empty table
      } catch (error) {
        console.error('Error deleting all students:', error);
        this.showAlert('An error occurred while deleting all students.', 'error');
      }
    } else if (confirmation !== null) {
      this.showAlert('Deletion cancelled. Confirmation phrase did not match.', 'info');
    } else {
      this.showAlert('Deletion cancelled.', 'info');
    }
  }

  showImportModal() {
    document.getElementById('importModal').style.display = 'flex';
    // Reset import results when modal is opened
    document.getElementById('importResults').style.display = 'none';
    document.getElementById('importBtn').style.display = 'block'; // Ensure button is visible
    document.getElementById('importBtn').disabled = true; // But disabled until file selected
  }

  hideImportModal() {
    document.getElementById('importModal').style.display = 'none';
    document.getElementById('csvFile').value = '';
    document.getElementById('importPreview').style.display = 'none';
    document.getElementById('importResults').style.display = 'none';
    document.getElementById('importBtn').disabled = true;
    this.importData = [];
  }

  hideStudentModal() {
    document.getElementById('studentModal').style.display = 'none';
  }

  handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      this.showAlert('Please select a CSV file', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      this.parseCSV(e.target.result);
    };
    reader.readAsText(file);
  }

  parseCSV(csvText) {
    try {
      // Handle different line endings and filter empty lines
      const lines = csvText.split(/\r?\n/).filter(line => line.trim());
      if (lines.length < 2) {
        this.showAlert('CSV file must contain at least a header row and one data row', 'error');
        return;
      }

      // Regex to split by comma, but not if comma is inside double quotes
      const csvSplitRegex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
      const headers = lines[0].split(csvSplitRegex).map(h => h.trim().replace(/^"|"$/g, ''));
      const requiredHeaders = ['name', 'email', 'student_id', 'branch', 'year', 'semester', 'section', 'username', 'password'];
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

      if (missingHeaders.length > 0) {
        this.showAlert(`Missing required columns: ${missingHeaders.join(', ')}`, 'error');
        return;
      }

      this.importData = lines.slice(1).map(line => {
        const values = line.split(csvSplitRegex).map(v => v.trim().replace(/^"|"$/g, ''));
        const student = {};
        headers.forEach((header, index) => {
          student[header] = values[index] || '';
        });
        return student;
      });

      this.showImportPreview();
      document.getElementById('importBtn').disabled = false;
    } catch (error) {
      console.error('Error parsing CSV:', error);
      this.showAlert('Error parsing CSV file', 'error');
    }
  }

  showImportPreview() {
    const preview = document.getElementById('importPreview');
    const previewHeader = document.getElementById('previewHeader');
    const previewBody = document.getElementById('previewBody');

    if (this.importData.length === 0) return;

    // Show preview
    preview.style.display = 'block';
    // Generate header
    const headers = Object.keys(this.importData[0]);
    previewHeader.innerHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;

    // Generate body (first 5 rows)
    const previewRows = this.importData.slice(0, 5);
    previewBody.innerHTML = previewRows.map(student => `
      <tr>${headers.map(h => `<td>${student[h]}</td>`).join('')}</tr>
    `).join('');
  }

  importStudents() {
    if (this.importData.length === 0) return;

    try {
      let successCount = 0;
      let errorCount = 0;
      const errors = [];

      this.importData.forEach((studentData, index) => {
        try {
          // Validate required fields for student and user creation
          if (!studentData.name || !studentData.email || !studentData.student_id || !studentData.username || !studentData.password || !studentData.section) {
            errors.push(`Row ${index + 2}: Missing required fields (name, email, student_id, branch, year, semester, section, username, password)`);
            errorCount++;
            return;
          }

          // Check for duplicate student ID
          const existingStudentById = this.students.find(s => s.student_id === studentData.student_id);
          if (existingStudentById) {
            errors.push(`Row ${index + 2}: Student ID ${studentData.student_id} already exists`);
            errorCount++;
            return;
          }

          // Handle user account creation/update
          let user = campusDB.findUserByUsername(studentData.username);
          let userId;
          if (user) {
            // If user exists, ensure it's not linked to another student or faculty
            if (user.role !== 'student' || (existingStudentById && existingStudentById.user_id !== user.id)) {
              errors.push(`Row ${index + 2}: Username '${studentData.username}' already exists and is linked to another account or role.`);
              errorCount++;
              return;
            }
            // Update existing user
            campusDB.update('users', user.id, {
              email: studentData.email,
              password: studentData.password, // In a real app, hash this!
              name: studentData.name // Update user's name as well
            });
            userId = user.id;
          } else {
            // Create new user
            const newUser = campusDB.create('users', {
              username: studentData.username,
              email: studentData.email,
              password: studentData.password, // In a real app, hash this!
              role: 'student',
              name: studentData.name
            });
            userId = newUser.id;
          }

          // Process student data
          const student = {
            user_id: userId, // Link to the user account
            name: studentData.name,
            email: studentData.email,
            student_id: studentData.student_id,
            branch: studentData.branch,
            year: parseInt(studentData.year) || 1,
            semester: parseInt(studentData.semester) || 1,
            section: studentData.section, // New field
            phone: studentData.phone || '',
            address: studentData.address || '',
            father_name: studentData.father_name || '',
            mother_name: studentData.mother_name || '',
            parents_phone: studentData.parents_phone || '', // New field
            date_of_birth: studentData.date_of_birth || '',
            status: 'active'
          };
          campusDB.create('students', student);
          successCount++;
        } catch (error) {
          errors.push(`Row ${index + 2}: ${error.message}`);
          errorCount++;
        }
      });

      // Show results
      const results = document.getElementById('importResults');
      const stats = document.getElementById('importStats');
      const importAlertDiv = results.querySelector('.alert'); // Get the alert div inside results

      stats.innerHTML = `
        <div>Successfully imported: ${successCount} students</div>
        ${errorCount > 0 ? `<div style="color: var(--error);">Errors: ${errorCount}</div>` : ''}
        ${errors.length > 0 ? `<div style="margin-top: 10px;"><strong>Error Details:</strong><ul>${errors.map(e => `<li>${e}</li>`).join('')}</ul></div>` : ''}
      `;

      // Update the alert class and message based on success/error
      if (errorCount > 0) {
        importAlertDiv.className = 'alert alert-warning'; // Use warning for partial success
        importAlertDiv.querySelector('strong').textContent = 'Import completed with errors!';
      } else {
        importAlertDiv.className = 'alert alert-success';
        importAlertDiv.querySelector('strong').textContent = 'Import completed successfully!';
      }
      results.style.display = 'block';

      // Refresh students list
      this.loadStudents();
      // Hide import button after processing
      document.getElementById('importBtn').style.display = 'none';
    } catch (error) {
      console.error('Error importing students:', error);
      this.showAlert('Error importing students', 'error');
      // If an error occurs in the outer try-catch, re-enable the import button
      document.getElementById('importBtn').disabled = false;
      document.getElementById('importBtn').style.display = 'block';
    }
  }

  downloadTemplate() {
    const template = `name,email,student_id,branch,year,semester,section,phone,address,father_name,mother_name,parents_phone,date_of_birth,username,password
John Doe,john.doe@example.com,CS2024001,Computer Science & Engineering,1,1,A,9876543210,"123 Main St, Apt 1",Robert Doe,Mary Doe,9988776655,2005-01-15,john.doe,pass123
Jane Smith,jane.smith@example.com,CS2024002,Computer Science & Engineering,1,1,B,9876543211,"456 Oak Ave",David Smith,Lisa Smith,9988776656,2005-03-20,jane.smith,pass123`;
    const blob = new Blob([template], {
      type: 'text/csv'
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'student_import_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  exportStudents() {
    if (this.filteredStudents.length === 0) {
      this.showAlert('No students to export', 'warning');
      return;
    }

    const headers = ['name', 'email', 'student_id', 'branch', 'year', 'semester', 'section', 'phone', 'address', 'father_name', 'mother_name', 'parents_phone', 'date_of_birth', 'status'];
    const csvContent = [
      headers.join(','),
      ...this.filteredStudents.map(student => headers.map(header => `"${student[header] || ''}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], {
      type: 'text/csv'
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `students_export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    this.showAlert('Students exported successfully', 'success');
  }

  showAlert(message, type) {
    // Remove existing alerts
    const existingAlerts = document.querySelectorAll('.content-area .alert');
    existingAlerts.forEach(alert => alert.remove());

    // Create new alert
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    // Insert at top of content area
    const contentArea = document.querySelector('.content-area');
    contentArea.insertBefore(alert, contentArea.firstChild);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (alert.parentNode) {
        alert.remove();
      }
    }, 5000);
  }

  // New: Show Bulk Update Modal
  showBulkUpdateModal() {
    if (this.selectedStudents.size === 0) {
      this.showAlert('No students selected for bulk update.', 'warning');
      return;
    }
    document.getElementById('bulkUpdateSelectedCount').textContent = this.selectedStudents.size;
    document.getElementById('bulkUpdateYearInput').value = ''; // Clear previous input
    document.getElementById('bulkUpdateSemesterInput').value = ''; // Clear previous input
    document.getElementById('bulkUpdateModal').style.display = 'flex';
  }

  // New: Hide Bulk Update Modal
  hideBulkUpdateModal() {
    document.getElementById('bulkUpdateModal').style.display = 'none';
  }

  // New: Save Bulk Update
  saveBulkUpdate() {
    const newYear = document.getElementById('bulkUpdateYearInput').value;
    const newSemester = document.getElementById('bulkUpdateSemesterInput').value;

    if (!newYear || !newSemester) {
      this.showAlert('Please enter both year and semester.', 'error');
      return;
    }

    const parsedYear = parseInt(newYear);
    const parsedSemester = parseInt(newSemester);

    if (isNaN(parsedYear) || parsedYear < 1 || parsedYear > 4) {
      this.showAlert('Invalid year. Please enter a number between 1 and 4.', 'error');
      return;
    }
    if (isNaN(parsedSemester) || parsedSemester < 1 || parsedSemester > 8) {
      this.showAlert('Invalid semester. Please enter a number between 1 and 8.', 'error');
      return;
    }

    try {
      this.selectedStudents.forEach(studentId => {
        campusDB.update('students', studentId, {
          year: parsedYear,
          semester: parsedSemester
        });
      });
      this.showAlert(`Updated year and semester for ${this.selectedStudents.size} students`, 'success');
      this.selectedStudents.clear();
      this.hideBulkUpdateModal();
      this.loadStudents(); // Reload to reflect changes
    } catch (error) {
      this.showAlert('Error updating students', 'error');
      console.error('Error updating students year and semester:', error);
    }
  }
}

// Global functions for inline event handlers
function showImportModal() {
  adminStudents.showImportModal();
}

function hideImportModal() {
  adminStudents.hideImportModal();
}

function showAddStudentModal() {
  adminStudents.showAddStudentModal();
}

function hideStudentModal() {
  adminStudents.hideStudentModal();
}

function handleFileSelect(event) {
  adminStudents.handleFileSelect(event);
}

function downloadTemplate() {
  adminStudents.downloadTemplate();
}

function importStudents() {
  adminStudents.importStudents();
}

function saveStudent() {
  adminStudents.saveStudent();
}

function exportStudents() {
  adminStudents.exportStudents();
}

function deleteAllStudents() {
  adminStudents.deleteAllStudents();
}

function toggleSelectAll() {
  const selectAll = document.getElementById('selectAll');
  const startIndex = (adminStudents.currentPage - 1) * adminStudents.itemsPerPage;
  const endIndex = startIndex + adminStudents.itemsPerPage;
  const pageStudents = adminStudents.filteredStudents.slice(startIndex, endIndex);

  if (selectAll.checked) {
    pageStudents.forEach(student => adminStudents.selectedStudents.add(student.id));
  } else {
    pageStudents.forEach(student => adminStudents.selectedStudents.delete(student.id));
  }
  adminStudents.renderStudentsTable();
}

function clearSelection() {
  adminStudents.selectedStudents.clear();
  adminStudents.renderStudentsTable();
}

// Removed old bulkUpdateYear and bulkUpdateSemester functions
function bulkDeleteStudents() {
  if (adminStudents.selectedStudents.size === 0) return;
  if (!confirm(`Are you sure you want to delete ${adminStudents.selectedStudents.size} selected students? This action cannot be undone.`)) {
    return;
  }
  try {
    adminStudents.selectedStudents.forEach(studentId => {
      campusDB.delete('students', studentId);
    });
    adminStudents.showAlert(`Deleted ${adminStudents.selectedStudents.size} students`, 'success');
    adminStudents.selectedStudents.clear();
    adminStudents.loadStudents();
  } catch (error) {
    adminStudents.showAlert('Error deleting students', 'error');
  }
}

// New global functions for bulk update modal
function showBulkUpdateModal() {
  adminStudents.showBulkUpdateModal();
}

function hideBulkUpdateModal() {
  adminStudents.hideBulkUpdateModal();
}

function saveBulkUpdate() {
  adminStudents.saveBulkUpdate();
}

// Initialize when DOM is loaded
let adminStudents;
document.addEventListener('DOMContentLoaded', () => {
  adminStudents = new AdminStudents();
});