// Faculty Students Management
class FacultyStudents {
  constructor() {
    this.facultyData = null;
    this.subjectsTaught = [];
    this.allStudents = []; // All students relevant to this faculty's classes
    this.filteredStudents = [];
    this.currentPage = 1;
    this.itemsPerPage = 10;
    this.init();
  }

  init() {
    if (!requireAuth() || !requireRole('faculty')) {
      return;
    }
    this.loadFacultyData();
    this.setupEventListeners();
  }

  setupEventListeners() {
    document.getElementById('searchInput').addEventListener('input', () => this.filterStudents());
    document.getElementById('subjectFilter').addEventListener('change', () => this.filterStudents());
    document.getElementById('yearFilter').addEventListener('change', () => this.filterStudents());
    document.getElementById('semesterFilter').addEventListener('change', () => this.filterStudents());
    document.getElementById('sectionFilter').addEventListener('change', () => this.filterStudents());
  }

  loadFacultyData() {
    try {
      const currentUser = getCurrentUser();
      this.facultyData = campusDB.getFacultyByUserId(currentUser.id);
      
      if (!this.facultyData) {
        this.showAlert('Faculty data not found.', 'error');
        return;
      }

      this.subjectsTaught = campusDB.getSubjectsTaughtByFaculty(this.facultyData.id, true);
      console.log('Faculty ID:', this.facultyData.id); // Debug log
      console.log('Faculty subjects taught:', this.subjectsTaught); // Debug log
      this.populateSubjectFilter();
      this.loadAllRelevantStudents();
    } catch (error) {
      console.error('Error loading faculty data:', error);
      this.showAlert('Error loading faculty data.', 'error');
    }
  }

  populateSubjectFilter() {
    const subjectFilter = document.getElementById('subjectFilter');
    subjectFilter.innerHTML = '<option value="">All My Subjects</option>';
    this.subjectsTaught.forEach(subject => {
      const option = document.createElement('option');
      option.value = `${subject.id}_${subject.branch}_${subject.year}_${subject.semester}_${subject.section}`;
      option.textContent = `${subject.name} (${subject.code}) - Y${subject.year} S${subject.semester} Sec ${subject.section}`;
      subjectFilter.appendChild(option);
    });
  }

  loadAllRelevantStudents() {
    const uniqueStudentIds = new Set();
    this.allStudents = [];

    this.subjectsTaught.forEach(subject => {
      const filters = {
        branch: subject.branch,
        year: subject.year,
        semester: subject.semester,
        section: subject.section
      };
      console.log(`Fetching students for subject: ${subject.name} with filters:`, filters); // Debug log
      const studentsInSubjectClass = campusDB.getStudents(filters);
      console.log(`Found ${studentsInSubjectClass.length} students for ${subject.name} (${subject.code})`); // Debug log

      studentsInSubjectClass.forEach(student => {
        if (!uniqueStudentIds.has(student.id)) {
          this.allStudents.push(student);
          uniqueStudentIds.add(student.id);
        }
      });
    });
    console.log('All unique students relevant to faculty classes:', this.allStudents); // Debug log

    if (this.allStudents.length === 0) {
      this.showAlert('No students found assigned to any of your active classes. Please ensure students are enrolled in classes you teach.', 'info');
    }

    this.filterStudents(); // Initial filter and render
  }

  filterStudents() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const subjectFilterValue = document.getElementById('subjectFilter').value;
    const yearFilter = document.getElementById('yearFilter').value;
    const semesterFilter = document.getElementById('semesterFilter').value;
    const sectionFilter = document.getElementById('sectionFilter').value;

    console.log('Applying filters - Subject:', subjectFilterValue, 'Year:', yearFilter, 'Semester:', semesterFilter, 'Section:', sectionFilter, 'Search:', searchTerm); // Debug log

    let tempStudents = [...this.allStudents];

    if (subjectFilterValue) {
      const [subjectId, branch, year, semester, section] = subjectFilterValue.split('_');
      tempStudents = tempStudents.filter(student => 
        student.branch === branch &&
        student.year.toString() === year &&
        student.semester.toString() === semester &&
        student.section === section
      );
    }

    if (yearFilter) {
      tempStudents = tempStudents.filter(student => student.year.toString() === yearFilter);
    }
    if (semesterFilter) {
      tempStudents = tempStudents.filter(student => student.semester.toString() === semesterFilter);
    }
    if (sectionFilter) {
      tempStudents = tempStudents.filter(student => student.section === sectionFilter);
    }

    this.filteredStudents = tempStudents.filter(student => {
      return !searchTerm || 
             student.name.toLowerCase().includes(searchTerm) ||
             student.student_id.toLowerCase().includes(searchTerm) ||
             student.email.toLowerCase().includes(searchTerm);
    });

    console.log('Filtered students after all criteria:', this.filteredStudents); // Debug log

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
      tbody.innerHTML = '<tr><td colspan="8" class="text-center">No students found for the selected criteria</td></tr>';
      this.renderPagination();
      return;
    }

    tbody.innerHTML = pageStudents.map(student => `
      <tr>
        <td><strong>${student.student_id}</strong></td>
        <td>${student.name}</td>
        <td>${student.email}</td>
        <td>${student.branch}</td>
        <td>Year ${student.year}</td>
        <td>Sem ${student.semester}</td>
        <td>${student.section || 'N/A'}</td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="facultyStudents.viewStudentDetails(${student.id})">
            <span>👁️</span> View
          </button>
        </td>
      </tr>
    `).join('');
    this.renderPagination();
  }

  renderPagination() {
    const totalPages = Math.ceil(this.filteredStudents.length / this.itemsPerPage);
    const pagination = document.getElementById('pagination');
    if (totalPages <= 1) {
      pagination.innerHTML = '';
      return;
    }

    let paginationHTML = '';
    paginationHTML += `
      <button ${this.currentPage === 1 ? 'disabled' : ''} onclick="facultyStudents.goToPage(${this.currentPage - 1})">
        Previous
      </button>
    `;
    for (let i = 1; i <= totalPages; i++) {
      paginationHTML += `
        <button class="${i === this.currentPage ? 'active' : ''}" onclick="facultyStudents.goToPage(${i})">
          ${i}
        </button>
      `;
    }
    paginationHTML += `
      <button ${this.currentPage === totalPages ? 'disabled' : ''} onclick="facultyStudents.goToPage(${this.currentPage + 1})">
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
    document.getElementById('totalStudentsCount').textContent = `${this.filteredStudents.length} students`;
  }

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

  hideStudentDetailsModal() {
    document.getElementById('studentDetailsModal').style.display = 'none';
  }

  exportStudents() {
    if (this.filteredStudents.length === 0) {
      this.showAlert('No students to export', 'warning');
      return;
    }

    const headers = ['student_id', 'name', 'email', 'branch', 'year', 'semester', 'section', 'phone', 'address', 'father_name', 'mother_name', 'parents_phone', 'date_of_birth', 'status'];
    const csvContent = [
      headers.join(','),
      ...this.filteredStudents.map(student => headers.map(header => `"${student[header] || ''}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `my_students_export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    this.showAlert('Students exported successfully', 'success');
  }

  showAlert(message, type) {
    const existingAlerts = document.querySelectorAll('#facultyStudentsAlert .alert');
    existingAlerts.forEach(alert => alert.remove());

    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    
    const alertContainer = document.getElementById('facultyStudentsAlert');
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

// Initialize when DOM is loaded
let facultyStudents;
document.addEventListener('DOMContentLoaded', () => {
  facultyStudents = new FacultyStudents();
});