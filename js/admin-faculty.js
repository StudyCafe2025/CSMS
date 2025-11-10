// Admin Faculty Management
class AdminFaculty {
  constructor() {
    this.faculty = [];
    this.filteredFaculty = [];
    this.importData = []; // Added for import functionality
    this.init();
  }

  init() {
    // Check authentication
    if (!requireAuth() || !requireRole('admin')) {
      return;
    }
    this.loadFaculty();
    this.setupEventListeners();
    this.handleURLParams();
  }

  setupEventListeners() {
    // Search and filter
    document.getElementById('searchInput').addEventListener('input', () => this.filterFaculty());
    document.getElementById('departmentFilter').addEventListener('change', () => this.filterFaculty());
    document.getElementById('designationFilter').addEventListener('change', () => this.filterFaculty());

    // Faculty form
    document.getElementById('facultyForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveFaculty();
    });
  }

  handleURLParams() {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    if (action === 'add') {
      this.showAddFacultyModal();
    } else if (action === 'import') { // Added for import functionality
      this.showImportFacultyModal();
    }
  }

  loadFaculty() {
    try {
      this.faculty = campusDB.getStorageData('faculty');
      this.filteredFaculty = [...this.faculty];
      this.renderFacultyTable();
      this.updateTotalCount();
    } catch (error) {
      console.error('Error loading faculty:', error);
      this.showAlert('Error loading faculty', 'error');
    }
  }

  filterFaculty() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const departmentFilter = document.getElementById('departmentFilter').value;
    const designationFilter = document.getElementById('designationFilter').value;

    this.filteredFaculty = this.faculty.filter(faculty => {
      const matchesSearch = !searchTerm || faculty.name.toLowerCase().includes(searchTerm) || faculty.email.toLowerCase().includes(searchTerm) || faculty.faculty_id.toLowerCase().includes(searchTerm) || faculty.department.toLowerCase().includes(searchTerm);
      const matchesDepartment = !departmentFilter || faculty.department === departmentFilter;
      const matchesDesignation = !designationFilter || faculty.designation === designationFilter;
      return matchesSearch && matchesDepartment && matchesDesignation;
    });
    this.renderFacultyTable();
    this.updateTotalCount();
  }

  renderFacultyTable() {
    const tbody = document.getElementById('facultyTableBody');
    if (this.filteredFaculty.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center">No faculty found</td></tr>';
      return;
    }

    const allClassOfferings = campusDB.getStorageData('class_offerings');
    const allSubjects = campusDB.getStorageData('subjects');

    tbody.innerHTML = this.filteredFaculty.map(faculty => {
      const subjectsTaught = allClassOfferings
        .filter(co => co.faculty_id === faculty.id && co.is_active)
        .map(co => allSubjects.find(s => s.id === co.subject_id)?.name)
        .filter(Boolean); // Filter out undefined/null subjects

      return `
        <tr>
          <td><strong>${faculty.faculty_id}</strong></td>
          <td>${faculty.name}</td>
          <td>${faculty.email}</td>
          <td>${faculty.department}</td>
          <td>${faculty.designation}</td>
          <td>${faculty.experience || 0} years</td>
          <td>
            <div style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${subjectsTaught.length > 0 ? subjectsTaught.join(', ') : 'N/A'}">
              ${subjectsTaught.length > 0 ? subjectsTaught.slice(0, 2).join(', ') + (subjectsTaught.length > 2 ? '...' : '') : 'N/A'}
            </div>
          </td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="adminFaculty.viewFaculty(${faculty.id})"
            style="margin-right: 5px;">
              <span>👁️</span>
            </button>
            <button class="btn btn-primary btn-sm" onclick="adminFaculty.editFaculty(${faculty.id})"
            style="margin-right: 5px;">
              <span>✏️</span>
            </button>
            <button class="btn btn-danger btn-sm" onclick="adminFaculty.deleteFaculty(${faculty.id})">
              <span>🗑️</span>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  updateTotalCount() {
    document.getElementById('totalCount').textContent = `${this.filteredFaculty.length} faculty`;
  }

  showAddFacultyModal() {
    document.getElementById('facultyModalTitle').textContent = 'Add Faculty';
    document.getElementById('facultyForm').reset();
    document.getElementById('facultyId').value = '';
    document.getElementById('facultyModal').style.display = 'flex';
  }

  editFaculty(id) {
    const faculty = this.faculty.find(f => f.id === id);
    if (!faculty) return;

    document.getElementById('facultyModalTitle').textContent = 'Edit Faculty';
    document.getElementById('facultyId').value = faculty.id;
    document.getElementById('facultyName').value = faculty.name || '';
    document.getElementById('facultyEmail').value = faculty.email || '';
    document.getElementById('facultyFacultyId').value = faculty.faculty_id || '';
    document.getElementById('facultyPhone').value = faculty.phone || '';
    document.getElementById('facultyDepartment').value = faculty.department || '';
    document.getElementById('facultyDesignation').value = faculty.designation || '';
    document.getElementById('facultyQualification').value = faculty.qualification || '';
    document.getElementById('facultyExperience').value = faculty.experience || '';
    document.getElementById('facultyAddress').value = faculty.address || '';

    document.getElementById('facultyModal').style.display = 'flex';
  }

  viewFaculty(id) {
    const faculty = this.faculty.find(f => f.id === id);
    if (!faculty) return;

    const subjectsTaught = campusDB.getSubjectsTaughtByFaculty(faculty.id, true)
      .map(s => `${s.name} (${s.code}) for Year ${s.year}, Sem ${s.semester}, Sec ${s.section}`);

    alert(`Faculty Details:
Name: ${faculty.name}
ID: ${faculty.faculty_id}
Email: ${faculty.email}
Department: ${faculty.department}
Designation: ${faculty.designation}
Qualification: ${faculty.qualification || 'N/A'}
Experience: ${faculty.experience || 0} years
Phone: ${faculty.phone || 'N/A'}
Subjects Taught: ${subjectsTaught.length > 0 ? subjectsTaught.join('\n - ') : 'N/A'}
Address: ${faculty.address || 'N/A'}`);
  }

  saveFaculty() {
    const formData = {
      name: document.getElementById('facultyName').value,
      email: document.getElementById('facultyEmail').value,
      faculty_id: document.getElementById('facultyFacultyId').value,
      phone: document.getElementById('facultyPhone').value,
      department: document.getElementById('facultyDepartment').value,
      designation: document.getElementById('facultyDesignation').value,
      qualification: document.getElementById('facultyQualification').value,
      experience: parseInt(document.getElementById('facultyExperience').value) || 0,
      address: document.getElementById('facultyAddress').value
    };

    try {
      const facultyId = document.getElementById('facultyId').value;
      if (facultyId) {
        // Update existing faculty
        campusDB.update('faculty', parseInt(facultyId), formData);
        this.showAlert('Faculty updated successfully', 'success');
      } else {
        // Add new faculty
        campusDB.create('faculty', formData);
        this.showAlert('Faculty added successfully', 'success');
      }
      this.hideFacultyModal();
      this.loadFaculty();
    } catch (error) {
      console.error('Error saving faculty:', error);
      this.showAlert('Error saving faculty', 'error');
    }
  }

  deleteFaculty(id) {
    if (!confirm('Are you sure you want to delete this faculty member? This action cannot be undone.')) {
      return;
    }
    try {
      campusDB.delete('faculty', id);
      this.showAlert('Faculty deleted successfully', 'success');
      this.loadFaculty();
    } catch (error) {
      console.error('Error deleting faculty:', error);
      this.showAlert('Error deleting faculty', 'error');
    }
  }

  deleteAllFaculty() {
    if (this.faculty.length === 0) {
      this.showAlert('No faculty to delete.', 'warning');
      return;
    }

    const confirmation = prompt(
      `WARNING: You are about to delete ALL ${this.faculty.length} faculty records. This action is irreversible. To confirm, please type "DELETE ALL" in the box below:`
    );

    if (confirmation === 'DELETE ALL') {
      try {
        // Clear the 'faculty' table in localStorage
        localStorage.setItem('campusiq_faculty', JSON.stringify([]));
        // Also remove any associated user accounts if they exist (simplified for demo)
        const users = campusDB.getStorageData('users');
        const nonFacultyUsers = users.filter(user => user.role !== 'faculty');
        localStorage.setItem('campusiq_users', JSON.stringify(nonFacultyUsers));

        this.showAlert('All faculty records have been successfully deleted.', 'success');
        this.loadFaculty(); // Reload to show empty table
      } catch (error) {
        console.error('Error deleting all faculty:', error);
        this.showAlert('An error occurred while deleting all faculty.', 'error');
      }
    } else if (confirmation !== null) {
      this.showAlert('Deletion cancelled. Confirmation phrase did not match.', 'info');
    } else {
      this.showAlert('Deletion cancelled.', 'info');
    }
  }

  // New import related methods
  showImportFacultyModal() {
    document.getElementById('importFacultyModal').style.display = 'flex';
    document.getElementById('importFacultyResults').style.display = 'none';
    document.getElementById('importFacultyBtn').style.display = 'block';
    document.getElementById('importFacultyBtn').disabled = true;
  }

  hideImportFacultyModal() {
    document.getElementById('importFacultyModal').style.display = 'none';
    document.getElementById('facultyCsvFile').value = '';
    document.getElementById('importFacultyPreview').style.display = 'none';
    document.getElementById('importFacultyResults').style.display = 'none';
    document.getElementById('importFacultyBtn').disabled = true;
    this.importData = [];
  }

  handleFacultyFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      this.showAlert('Please select a CSV file', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      this.parseFacultyCSV(e.target.result);
    };
    reader.readAsText(file);
  }

  parseFacultyCSV(csvText) {
    try {
      const lines = csvText.split(/\r?\n/).filter(line => line.trim());
      if (lines.length < 2) {
        this.showAlert('CSV file must contain at least a header row and one data row', 'error');
        return;
      }

      const csvSplitRegex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
      const headers = lines[0].split(csvSplitRegex).map(h => h.trim().replace(/^"|"$/g, ''));
      const requiredHeaders = ['name', 'email', 'faculty_id', 'department', 'designation', 'username', 'password'];
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

      if (missingHeaders.length > 0) {
        this.showAlert(`Missing required columns: ${missingHeaders.join(', ')}`, 'error');
        return;
      }

      this.importData = lines.slice(1).map(line => {
        const values = line.split(csvSplitRegex).map(v => v.trim().replace(/^"|"$/g, ''));
        const faculty = {};
        headers.forEach((header, index) => {
          faculty[header] = values[index] || '';
        });
        return faculty;
      });

      this.showImportFacultyPreview();
      document.getElementById('importFacultyBtn').disabled = false;
    } catch (error) {
      console.error('Error parsing CSV:', error);
      this.showAlert('Error parsing CSV file', 'error');
    }
  }

  showImportFacultyPreview() {
    const preview = document.getElementById('importFacultyPreview');
    const previewHeader = document.getElementById('previewFacultyHeader');
    const previewBody = document.getElementById('previewFacultyBody');

    if (this.importData.length === 0) return;

    preview.style.display = 'block';
    const headers = Object.keys(this.importData[0]);
    previewHeader.innerHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;

    const previewRows = this.importData.slice(0, 5);
    previewBody.innerHTML = previewRows.map(faculty => `
      <tr>${headers.map(h => `<td>${faculty[h]}</td>`).join('')}</tr>
    `).join('');
  }

  importFaculty() {
    if (this.importData.length === 0) return;

    try {
      let successCount = 0;
      let errorCount = 0;
      const errors = [];

      this.importData.forEach((facultyData, index) => {
        try {
          if (!facultyData.name || !facultyData.email || !facultyData.faculty_id || !facultyData.username || !facultyData.password) {
            errors.push(`Row ${index + 2}: Missing required fields (name, email, faculty_id, username, password)`);
            errorCount++;
            return;
          }

          const existingFacultyById = this.faculty.find(f => f.faculty_id === facultyData.faculty_id);
          if (existingFacultyById) {
            errors.push(`Row ${index + 2}: Faculty ID ${facultyData.faculty_id} already exists`);
            errorCount++;
            return;
          }

          let user = campusDB.findUserByUsername(facultyData.username);
          let userId;
          if (user) {
            if (user.role !== 'faculty' || (existingFacultyById && existingFacultyById.user_id !== user.id)) {
              errors.push(`Row ${index + 2}: Username '${facultyData.username}' already exists and is linked to another account or role.`);
              errorCount++;
              return;
            }
            campusDB.update('users', user.id, {
              email: facultyData.email,
              password: facultyData.password, // In a real app, hash this!
              name: facultyData.name
            });
            userId = user.id;
          } else {
            const newUser = campusDB.create('users', {
              username: facultyData.username,
              email: facultyData.email,
              password: facultyData.password, // In a real app, hash this!
              role: 'faculty',
              name: facultyData.name
            });
            userId = newUser.id;
          }

          // Subjects are no longer imported directly with faculty, they are allocated via class_offerings
          const facultyRecord = {
            user_id: userId,
            name: facultyData.name,
            email: facultyData.email,
            faculty_id: facultyData.faculty_id,
            department: facultyData.department,
            designation: facultyData.designation,
            qualification: facultyData.qualification || '',
            experience: parseInt(facultyData.experience) || 0,
            address: facultyData.address || ''
          };
          campusDB.create('faculty', facultyRecord);
          successCount++;
        } catch (error) {
          errors.push(`Row ${index + 2}: ${error.message}`);
          errorCount++;
        }
      });

      const results = document.getElementById('importFacultyResults');
      const stats = document.getElementById('importFacultyStats');
      const importAlertDiv = results.querySelector('.alert');

      stats.innerHTML = `
        <div>Successfully imported: ${successCount} faculty members</div>
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
      this.loadFaculty();
      document.getElementById('importFacultyBtn').style.display = 'none';
    } catch (error) {
      console.error('Error importing faculty:', error);
      this.showAlert('Error importing faculty', 'error');
      document.getElementById('importFacultyBtn').disabled = false;
      document.getElementById('importFacultyBtn').style.display = 'block';
    }
  }

  downloadFacultyTemplate() {
    const template = `name,email,faculty_id,department,designation,qualification,experience,phone,address,username,password
Dr. John Smith,john.smith@example.com,FAC001,Computer Science & Engineering,Professor,"PhD in CS",15,9876543210,"123 Faculty Quarters",john.smith,faculty123
Dr. Jane Doe,jane.doe@example.com,FAC002,Civil Engineering,"Associate Professor","M.Tech in EE",10,9876543211,"456 Staff Colony",jane.doe,faculty123`;
    const blob = new Blob([template], {
      type: 'text/csv'
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'faculty_import_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  hideFacultyModal() {
    document.getElementById('facultyModal').style.display = 'none';
  }

  exportFaculty() {
    if (this.filteredFaculty.length === 0) {
      this.showAlert('No faculty to export', 'warning');
      return;
    }

    const headers = ['name', 'email', 'faculty_id', 'department', 'designation', 'qualification', 'experience', 'phone', 'address'];
    const csvContent = [
      headers.join(','),
      ...this.filteredFaculty.map(faculty => headers.map(header => {
        let value = faculty[header] || '';
        return `"${value}"`;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], {
      type: 'text/csv'
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `faculty_export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    this.showAlert('Faculty exported successfully', 'success');
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
}

// Global functions for inline event handlers
function showAddFacultyModal() {
  adminFaculty.showAddFacultyModal();
}

function hideFacultyModal() {
  adminFaculty.hideFacultyModal();
}

function saveFaculty() {
  adminFaculty.saveFaculty();
}

function exportFaculty() {
  adminFaculty.exportFaculty();
}

function downloadFacultyTemplate() {
  adminFaculty.downloadFacultyTemplate();
}

function showImportFacultyModal() { // New global function for import
  adminFaculty.showImportFacultyModal();
}

function hideImportFacultyModal() { // New global function for import
  adminFaculty.hideImportFacultyModal();
}

function handleFacultyFileSelect(event) { // New global function for import
  adminFaculty.handleFacultyFileSelect(event);
}

function importFaculty() { // New global function for import
  adminFaculty.importFaculty();
}

// Initialize when DOM is loaded
let adminFaculty;
document.addEventListener('DOMContentLoaded', () => {
  adminFaculty = new AdminFaculty();
});