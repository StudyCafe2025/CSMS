// Admin Department Details Management
class AdminDepartmentDetails {
  constructor() {
    this.departmentName = '';
    this.allStudents = [];
    this.filteredStudents = [];
    this.allFaculty = [];
    this.filteredFaculty = [];
    this.studentsCurrentPage = 1;
    this.studentsItemsPerPage = 10;
    this.facultyCurrentPage = 1;
    this.facultyItemsPerPage = 10;
    this.init();
  }

  init() {
    if (!requireAuth() || !requireRole('admin')) {
      return;
    }
    this.getDepartmentFromUrl();
    if (this.departmentName) {
      this.loadDepartmentData();
      this.showSection('students'); // Default to showing students
    } else {
      this.showAlert('Department not specified in URL.', 'error');
      document.getElementById('departmentDetailsTitle').textContent = 'Error';
    }
  }

  getDepartmentFromUrl() {
    const params = new URLSearchParams(window.location.search);
    this.departmentName = decodeURIComponent(params.get('department'));
  }

  loadDepartmentData() {
    try {
      const department = campusDB.findBy('departments', {
        name: this.departmentName
      })[0];
      if (department) {
        document.getElementById('departmentDetailsTitle').textContent = `${this.departmentName} Details`;
        document.getElementById('departmentNameHeader').textContent = this.departmentName;
        document.getElementById('departmentCode').textContent = `Code: ${department.code}`;
        document.getElementById('departmentHOD').textContent = `HOD: ${department.head_of_department || 'N/A'}`;
      } else {
        this.showAlert(`Department "${this.departmentName}" not found.`, 'error');
        document.getElementById('departmentDetailsTitle').textContent = 'Department Not Found';
        return;
      }

      this.allStudents = campusDB.getStudents({
        branch: this.departmentName
      });
      this.filteredStudents = [...this.allStudents];
      document.getElementById('totalStudentsCount').textContent = this.allStudents.length;

      this.allFaculty = campusDB.findBy('faculty', {
        department: this.departmentName
      });
      this.filteredFaculty = [...this.allFaculty];
      document.getElementById('totalFacultyCount').textContent = this.allFaculty.length;

      document.getElementById('studentsDepartmentName').textContent = this.departmentName;
      document.getElementById('facultyDepartmentName').textContent = this.departmentName;

      this.renderStudentsTable();
      this.renderFacultyTable();
    } catch (error) {
      console.error('Error loading department data:', error);
      this.showAlert('Error loading department data.', 'error');
    }
  }

  showSection(section) {
    document.getElementById('studentsSection').style.display = 'none';
    document.getElementById('facultySection').style.display = 'none';
    document.getElementById('showStudentsBtn').classList.remove('btn-primary');
    document.getElementById('showStudentsBtn').classList.add('btn-secondary');
    document.getElementById('showFacultyBtn').classList.remove('btn-primary');
    document.getElementById('showFacultyBtn').classList.add('btn-secondary');

    if (section === 'students') {
      document.getElementById('studentsSection').style.display = 'block';
      document.getElementById('showStudentsBtn').classList.remove('btn-secondary');
      document.getElementById('showStudentsBtn').classList.add('btn-primary');
      this.renderStudentsTable(); // Re-render to ensure pagination is correct
    } else if (section === 'faculty') {
      document.getElementById('facultySection').style.display = 'block';
      document.getElementById('showFacultyBtn').classList.remove('btn-secondary');
      document.getElementById('showFacultyBtn').classList.add('btn-primary');
      this.renderFacultyTable(); // Re-render to ensure pagination is correct
    }
  }

  renderStudentsTable() {
    const startIndex = (this.studentsCurrentPage - 1) * this.studentsItemsPerPage;
    const endIndex = startIndex + this.studentsItemsPerPage;
    const pageStudents = this.filteredStudents.slice(startIndex, endIndex);
    const tbody = document.getElementById('departmentStudentsTableBody');

    if (pageStudents.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center">No students found in this department</td></tr>';
      this.renderStudentsPagination();
      return;
    }

    tbody.innerHTML = pageStudents.map(student => `
      <tr onclick="departmentDetails.viewStudentDetails(${student.id})" style="cursor: pointer;">
        <td><strong>${student.student_id}</strong></td>
        <td>${student.name}</td>
        <td>${student.email}</td>
        <td>Year ${student.year}</td>
        <td>Sem ${student.semester}</td>
        <td>${student.section || 'N/A'}</td>
        <td>
          <span class="badge ${student.status === 'active' ? 'badge-success' : 'badge-warning'}">
            ${student.status || 'active'}
          </span>
        </td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); departmentDetails.viewStudentDetails(${student.id})">
            <span>👁️</span>
          </button>
        </td>
      </tr>
    `).join('');
    this.renderStudentsPagination();
  }

  renderStudentsPagination() {
    const totalPages = Math.ceil(this.filteredStudents.length / this.studentsItemsPerPage);
    const pagination = document.getElementById('studentsPagination');
    if (totalPages <= 1) {
      pagination.innerHTML = '';
      return;
    }

    let paginationHTML = '';
    paginationHTML += `
      <button ${this.studentsCurrentPage === 1 ? 'disabled' : ''} onclick="departmentDetails.goToStudentsPage(${this.studentsCurrentPage - 1})">
        Previous
      </button>
    `;
    for (let i = 1; i <= totalPages; i++) {
      paginationHTML += `
        <button class="${i === this.studentsCurrentPage ? 'active' : ''}" onclick="departmentDetails.goToStudentsPage(${i})">
          ${i}
        </button>
      `;
    }
    paginationHTML += `
      <button ${this.studentsCurrentPage === totalPages ? 'disabled' : ''} onclick="departmentDetails.goToStudentsPage(${this.studentsCurrentPage + 1})">
        Next
      </button>
    `;
    pagination.innerHTML = paginationHTML;
  }

  goToStudentsPage(page) {
    this.studentsCurrentPage = page;
    this.renderStudentsTable();
  }

  renderFacultyTable() {
    const startIndex = (this.facultyCurrentPage - 1) * this.facultyItemsPerPage;
    const endIndex = startIndex + this.facultyItemsPerPage;
    const pageFaculty = this.filteredFaculty.slice(startIndex, endIndex);
    const tbody = document.getElementById('departmentFacultyTableBody');

    if (pageFaculty.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center">No faculty found in this department</td></tr>';
      this.renderFacultyPagination();
      return;
    }

    const allClassOfferings = campusDB.getStorageData('class_offerings');
    const allSubjects = campusDB.getStorageData('subjects');

    tbody.innerHTML = pageFaculty.map(faculty => {
      const subjectsTaught = allClassOfferings
        .filter(co => co.faculty_id === faculty.id && co.is_active)
        .map(co => allSubjects.find(s => s.id === co.subject_id)?.name)
        .filter(Boolean);

      return `
        <tr onclick="departmentDetails.viewFacultyDetails(${faculty.id})" style="cursor: pointer;">
          <td><strong>${faculty.faculty_id}</strong></td>
          <td>${faculty.name}</td>
          <td>${faculty.email}</td>
          <td>${faculty.designation}</td>
          <td>${faculty.experience || 0} years</td>
          <td>
            <div style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${subjectsTaught.length > 0 ? subjectsTaught.join(', ') : 'N/A'}">
              ${subjectsTaught.length > 0 ? subjectsTaught.slice(0, 2).join(', ') + (subjectsTaught.length > 2 ? '...' : '') : 'N/A'}
            </div>
          </td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); departmentDetails.viewFacultyDetails(${faculty.id})">
              <span>👁️</span>
            </button>
          </td>
        </tr>
      `;
    }).join('');
    this.renderFacultyPagination();
  }

  renderFacultyPagination() {
    const totalPages = Math.ceil(this.filteredFaculty.length / this.facultyItemsPerPage);
    const pagination = document.getElementById('facultyPagination');
    if (totalPages <= 1) {
      pagination.innerHTML = '';
      return;
    }

    let paginationHTML = '';
    paginationHTML += `
      <button ${this.facultyCurrentPage === 1 ? 'disabled' : ''} onclick="departmentDetails.goToFacultyPage(${this.facultyCurrentPage - 1})">
        Previous
      </button>
    `;
    for (let i = 1; i <= totalPages; i++) {
      paginationHTML += `
        <button class="${i === this.facultyCurrentPage ? 'active' : ''}" onclick="departmentDetails.goToFacultyPage(${i})">
          ${i}
        </button>
      `;
    }
    paginationHTML += `
      <button ${this.facultyCurrentPage === totalPages ? 'disabled' : ''} onclick="departmentDetails.goToFacultyPage(${this.facultyCurrentPage + 1})">
        Next
      </button>
    `;
    pagination.innerHTML = paginationHTML;
  }

  goToFacultyPage(page) {
    this.facultyCurrentPage = page;
    this.renderFacultyTable();
  }

  // New: Show Student Details Modal
  viewStudentDetails(studentId) {
    const student = campusDB.findById('students', studentId);
    if (!student) {
      this.showAlert('Student details not found.', 'error');
      return;
    }

    document.getElementById('modalStudentName').textContent = student.name || 'N/A';
    document.getElementById('modalStudentId').textContent = student.student_id || 'N/A';
    document.getElementById('modalStudentEmail').textContent = student.email || 'N/A';
    document.getElementById('modalStudentPhone').textContent = student.phone || 'N/A';
    document.getElementById('modalStudentBranch').textContent = student.branch || 'N/A';
    document.getElementById('modalStudentYear').textContent = student.year ? `Year ${student.year}` : 'N/A';
    document.getElementById('modalStudentSemester').textContent = student.semester ? `Semester ${student.semester}` : 'N/A';
    document.getElementById('modalStudentSection').textContent = student.section || 'N/A';
    document.getElementById('modalStudentDOB').textContent = student.date_of_birth || 'N/A';
    document.getElementById('modalStudentStatus').textContent = (student.status || 'active').charAt(0).toUpperCase() + (student.status || 'active').slice(1);
    document.getElementById('modalStudentAddress').textContent = student.address || 'N/A';
    document.getElementById('modalStudentFatherName').textContent = student.father_name || 'N/A';
    document.getElementById('modalStudentMotherName').textContent = student.mother_name || 'N/A';

    document.getElementById('studentDetailsModal').style.display = 'flex';
  }

  // New: Hide Student Details Modal
  hideStudentDetailsModal() {
    document.getElementById('studentDetailsModal').style.display = 'none';
  }

  // New: Show Faculty Details Modal
  viewFacultyDetails(facultyId) {
    const faculty = campusDB.findById('faculty', facultyId);
    if (!faculty) {
      this.showAlert('Faculty details not found.', 'error');
      return;
    }

    const subjectsTaught = campusDB.getSubjectsTaughtByFaculty(faculty.id, false) // Get all subjects, active or not
      .map(s => `${s.name} (Y${s.year}, S${s.semester}, Sec ${s.section})`);

    document.getElementById('modalFacultyName').textContent = faculty.name || 'N/A';
    document.getElementById('modalFacultyId').textContent = faculty.faculty_id || 'N/A';
    document.getElementById('modalFacultyEmail').textContent = faculty.email || 'N/A';
    document.getElementById('modalFacultyPhone').textContent = faculty.phone || 'N/A';
    document.getElementById('modalFacultyDepartment').textContent = faculty.department || 'N/A';
    document.getElementById('modalFacultyDesignation').textContent = faculty.designation || 'N/A';
    document.getElementById('modalFacultyQualification').textContent = faculty.qualification || 'N/A';
    document.getElementById('modalFacultyExperience').textContent = faculty.experience ? `${faculty.experience} years` : 'N/A';
    document.getElementById('modalFacultyAddress').textContent = faculty.address || 'N/A';
    document.getElementById('modalFacultySubjectsTaught').textContent = subjectsTaught.length > 0 ? subjectsTaught.join('; ') : 'N/A';

    document.getElementById('facultyDetailsModal').style.display = 'flex';
  }

  // New: Hide Faculty Details Modal
  hideFacultyDetailsModal() {
    document.getElementById('facultyDetailsModal').style.display = 'none';
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
let departmentDetails;
document.addEventListener('DOMContentLoaded', () => {
  departmentDetails = new AdminDepartmentDetails();
});