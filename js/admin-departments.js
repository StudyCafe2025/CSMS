// Admin Departments Management
class AdminDepartments {
  constructor() {
    this.departments = [];
    this.filteredDepartments = [];
    this.init();
  }

  init() {
    // Check authentication
    if (!requireAuth() || !requireRole('admin')) {
      return;
    }

    this.loadDepartments();
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Search functionality
    document.getElementById('searchInput').addEventListener('input', () => this.filterDepartments());

    // Department form
    document.getElementById('departmentForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveDepartment();
    });
  }

  loadDepartments() {
    try {
      this.departments = campusDB.getStorageData('departments');
      this.filteredDepartments = [...this.departments];
      this.renderDepartmentsTable();
      this.updateTotalCount();
    } catch (error) {
      console.error('Error loading departments:', error);
      this.showAlert('Error loading departments', 'error');
    }
  }

  filterDepartments() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();

    this.filteredDepartments = this.departments.filter(department => {
      return !searchTerm || 
        department.name.toLowerCase().includes(searchTerm) ||
        department.code.toLowerCase().includes(searchTerm) ||
        (department.head_of_department && department.head_of_department.toLowerCase().includes(searchTerm));
    });

    this.renderDepartmentsTable();
    this.updateTotalCount();
  }

  renderDepartmentsTable() {
    const tbody = document.getElementById('departmentsTableBody');

    if (this.filteredDepartments.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center">No departments found</td></tr>';
      return;
    }

    tbody.innerHTML = this.filteredDepartments.map(department => {
      // Get student and faculty counts for this department
      const studentCount = campusDB.getStudentCountByDepartment(department.name);
      const facultyCount = campusDB.getFacultyCountByDepartment(department.name);

      return `
        <tr>
          <td><strong>${department.code}</strong></td>
          <td>${department.name}</td>
          <td>${department.head_of_department || 'Not Assigned'}</td>
          <td>
            <a href="department-details.html?department=${encodeURIComponent(department.name)}" 
               class="btn btn-secondary btn-sm" style="text-decoration: none;">
              ${studentCount} students
            </a>
          </td>
          <td>
            <span class="badge badge-info">${facultyCount} faculty</span>
          </td>
          <td>
            <button class="btn btn-primary btn-sm" onclick="adminDepartments.editDepartment(${department.id})" style="margin-right: 5px;">
              <span>✏️</span>
            </button>
            <button class="btn btn-danger btn-sm" onclick="adminDepartments.deleteDepartment(${department.id})">
              <span>🗑️</span>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  updateTotalCount() {
    document.getElementById('totalCount').textContent = `${this.filteredDepartments.length} departments`;
  }

  showAddDepartmentModal() {
    document.getElementById('departmentModalTitle').textContent = 'Add Department';
    document.getElementById('departmentForm').reset();
    document.getElementById('departmentId').value = '';
    
    // Set readonly fields
    document.getElementById('totalStudents').value = '0';
    document.getElementById('totalFaculty').value = '0';
    
    document.getElementById('departmentModal').style.display = 'flex';
  }

  editDepartment(id) {
    const department = this.departments.find(d => d.id === id);
    if (!department) return;

    document.getElementById('departmentModalTitle').textContent = 'Edit Department';
    document.getElementById('departmentId').value = department.id;
    document.getElementById('departmentName').value = department.name || '';
    document.getElementById('departmentCode').value = department.code || '';
    document.getElementById('headOfDepartment').value = department.head_of_department || '';
    
    // Set current counts
    const studentCount = campusDB.getStudentCountByDepartment(department.name);
    const facultyCount = campusDB.getFacultyCountByDepartment(department.name);
    document.getElementById('totalStudents').value = studentCount;
    document.getElementById('totalFaculty').value = facultyCount;

    document.getElementById('departmentModal').style.display = 'flex';
  }

  saveDepartment() {
    const formData = {
      name: document.getElementById('departmentName').value.trim(),
      code: document.getElementById('departmentCode').value.trim().toUpperCase(),
      head_of_department: document.getElementById('headOfDepartment').value.trim()
    };

    // Validation
    if (!formData.name || !formData.code) {
      this.showAlert('Please fill all required fields', 'error');
      return;
    }

    try {
      const departmentId = document.getElementById('departmentId').value;
      
      // Check for duplicate department name or code
      const existingDepartment = this.departments.find(d => 
        (d.name === formData.name || d.code === formData.code) && 
        d.id != departmentId
      );

      if (existingDepartment) {
        this.showAlert('Department with this name or code already exists', 'error');
        return;
      }

      if (departmentId) {
        // Update existing department
        const oldDepartment = this.departments.find(d => d.id == departmentId);
        const oldName = oldDepartment.name;
        
        campusDB.update('departments', parseInt(departmentId), formData);
        
        // If department name changed, update references in students and faculty
        if (oldName !== formData.name) {
          this.updateDepartmentReferences(oldName, formData.name);
        }
        
        this.showAlert('Department updated successfully', 'success');
      } else {
        // Add new department
        campusDB.create('departments', formData);
        this.showAlert('Department added successfully', 'success');
      }

      this.hideDepartmentModal();
      this.loadDepartments();
    } catch (error) {
      console.error('Error saving department:', error);
      this.showAlert('Error saving department', 'error');
    }
  }

  updateDepartmentReferences(oldName, newName) {
    try {
      // Update student records
      const students = campusDB.getStorageData('students');
      students.forEach(student => {
        if (student.branch === oldName) {
          campusDB.update('students', student.id, { branch: newName });
        }
      });

      // Update faculty records
      const faculty = campusDB.getStorageData('faculty');
      faculty.forEach(f => {
        if (f.department === oldName) {
          campusDB.update('faculty', f.id, { department: newName });
        }
      });

      // Update subjects records
      const subjects = campusDB.getStorageData('subjects');
      subjects.forEach(subject => {
        if (subject.branch === oldName) {
          campusDB.update('subjects', subject.id, { branch: newName });
        }
      });

      // Update class offerings records
      const classOfferings = campusDB.getStorageData('class_offerings');
      classOfferings.forEach(co => {
        if (co.branch === oldName) {
          campusDB.update('class_offerings', co.id, { branch: newName });
        }
      });

    } catch (error) {
      console.error('Error updating department references:', error);
      this.showAlert('Department updated but some references may not be updated', 'warning');
    }
  }

  deleteDepartment(id) {
    const department = this.departments.find(d => d.id === id);
    if (!department) return;

    // Check if department has students or faculty
    const studentCount = campusDB.getStudentCountByDepartment(department.name);
    const facultyCount = campusDB.getFacultyCountByDepartment(department.name);

    if (studentCount > 0 || facultyCount > 0) {
      this.showAlert(`Cannot delete department. It has ${studentCount} students and ${facultyCount} faculty members.`, 'error');
      return;
    }

    if (!confirm(`Are you sure you want to delete "${department.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      campusDB.delete('departments', id);
      this.showAlert('Department deleted successfully', 'success');
      this.loadDepartments();
    } catch (error) {
      console.error('Error deleting department:', error);
      this.showAlert('Error deleting department', 'error');
    }
  }

  deleteAllDepartments() {
    if (this.departments.length === 0) {
      this.showAlert('No departments to delete.', 'warning');
      return;
    }

    // Check if any department has students or faculty
    let hasData = false;
    for (const dept of this.departments) {
      const studentCount = campusDB.getStudentCountByDepartment(dept.name);
      const facultyCount = campusDB.getFacultyCountByDepartment(dept.name);
      if (studentCount > 0 || facultyCount > 0) {
        hasData = true;
        break;
      }
    }

    if (hasData) {
      this.showAlert('Cannot delete all departments. Some departments have students or faculty.', 'error');
      return;
    }

    const confirmation = prompt(
      `WARNING: You are about to delete ALL ${this.departments.length} departments. This action is irreversible. To confirm, please type "DELETE ALL" in the box below:`
    );

    if (confirmation === 'DELETE ALL') {
      try {
        // Clear the departments table
        localStorage.setItem('campusiq_departments', JSON.stringify([]));
        this.showAlert('All departments have been successfully deleted.', 'success');
        this.loadDepartments();
      } catch (error) {
        console.error('Error deleting all departments:', error);
        this.showAlert('An error occurred while deleting all departments.', 'error');
      }
    } else if (confirmation !== null) {
      this.showAlert('Deletion cancelled. Confirmation phrase did not match.', 'info');
    } else {
      this.showAlert('Deletion cancelled.', 'info');
    }
  }

  hideDepartmentModal() {
    document.getElementById('departmentModal').style.display = 'none';
  }

  exportDepartments() {
    if (this.filteredDepartments.length === 0) {
      this.showAlert('No departments to export', 'warning');
      return;
    }

    try {
      // Enhanced export with student and faculty counts
      const exportData = this.filteredDepartments.map(dept => ({
        name: dept.name,
        code: dept.code,
        head_of_department: dept.head_of_department || '',
        total_students: campusDB.getStudentCountByDepartment(dept.name),
        total_faculty: campusDB.getFacultyCountByDepartment(dept.name),
        created_at: dept.created_at || ''
      }));

      const headers = ['name', 'code', 'head_of_department', 'total_students', 'total_faculty', 'created_at'];
      const csvContent = [
        headers.join(','),
        ...exportData.map(dept => headers.map(header => `"${dept[header] || ''}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], {
        type: 'text/csv'
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `departments_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      this.showAlert('Departments exported successfully', 'success');
    } catch (error) {
      console.error('Error exporting departments:', error);
      this.showAlert('Error exporting departments', 'error');
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
function showAddDepartmentModal() {
  adminDepartments.showAddDepartmentModal();
}

function hideDepartmentModal() {
  adminDepartments.hideDepartmentModal();
}

function saveDepartment() {
  adminDepartments.saveDepartment();
}

function exportDepartments() {
  adminDepartments.exportDepartments();
}

function deleteAllDepartments() {
  adminDepartments.deleteAllDepartments();
}

// Initialize when DOM is loaded
let adminDepartments;
document.addEventListener('DOMContentLoaded', () => {
  adminDepartments = new AdminDepartments();
});