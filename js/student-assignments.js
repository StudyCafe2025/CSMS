// Student Assignments Management
class StudentAssignments {
  constructor() {
    this.studentData = null;
    this.mySubjects = []; // Subjects for the student's current class
    this.allAssignments = []; // All assignments relevant to student's subjects (from assignments table)
    this.filteredAssignments = [];
    this.allResources = []; // All resources (to link assignment to resource file)
    this.currentPage = 1;
    this.itemsPerPage = 10;
    // Removed this.currentAssignment and related modal properties as they are moved to a new page
    this.init();
  }

  init() {
    if (!requireAuth() || !requireRole('student')) {
      return;
    }
    this.loadStudentData();
    this.setupEventListeners();
  }

  setupEventListeners() {
    document.getElementById('searchInput').addEventListener('input', () => this.filterAssignments());
    document.getElementById('subjectFilter').addEventListener('change', () => this.filterAssignments());
    document.getElementById('statusFilter').addEventListener('change', () => this.filterAssignments());
  }

  loadStudentData() {
    try {
      const currentUser = getCurrentUser();
      this.studentData = campusDB.getStudentByUserId(currentUser.id);
      
      if (!this.studentData) {
        this.showAlert('Student data not found.', 'error');
        return;
      }

      this.mySubjects = campusDB.getSubjectsForClass(
        this.studentData.branch,
        this.studentData.year,
        this.studentData.semester,
        this.studentData.section,
        true // Only active subjects
      );
      this.populateSubjectFilter();
      this.loadAssignmentsAndResources();
    } catch (error) {
      console.error('Error loading student data for assignments:', error);
      this.showAlert('Error loading student data.', 'error');
    }
  }

  populateSubjectFilter() {
    const subjectFilter = document.getElementById('subjectFilter');
    subjectFilter.innerHTML = '<option value="">All My Subjects</option>';
    this.mySubjects.forEach(subject => {
      const option = document.createElement('option');
      option.value = `${subject.id}_${subject.branch}_${subject.year}_${subject.semester}_${subject.section}`;
      option.textContent = `${subject.name} (${subject.code})`;
      subjectFilter.appendChild(option);
    });
  }

  loadAssignmentsAndResources() {
    try {
      const allAssignments = campusDB.getStorageData('assignments');
      this.allResources = campusDB.getStorageData('resources'); // Load all resources

      const mySubjectClassIds = this.mySubjects.map(s => `${s.id}_${s.branch}_${s.year}_${s.semester}_${s.section}`);

      // Filter assignments to only show those relevant to the student's subjects
      // Now includes both 'typed_questions' and 'assignment_question_paper' types
      this.allAssignments = allAssignments.filter(assignment => 
        mySubjectClassIds.includes(assignment.subject_class_id) &&
        (assignment.type === 'typed_questions' || assignment.type === 'assignment_question_paper')
      );
      
      this.filterAssignments(); // Initial filter and render
    } catch (error) {
      console.error('Error loading assignments and resources:', error);
      this.showAlert('Error loading assignments and resources', 'error');
    }
  }

  filterAssignments() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const subjectFilter = document.getElementById('subjectFilter').value;
    const statusFilter = document.getElementById('statusFilter').value;
    const now = new Date();

    this.filteredAssignments = this.allAssignments.filter(assignment => {
      const subject = this.mySubjects.find(s => 
        `${s.id}_${s.branch}_${s.year}_${s.semester}_${s.section}` === assignment.subject_class_id
      );
      const subjectName = subject ? subject.name.toLowerCase() : '';

      const matchesSearch = !searchTerm || 
                            assignment.title.toLowerCase().includes(searchTerm) ||
                            assignment.description.toLowerCase().includes(searchTerm) ||
                            subjectName.includes(searchTerm) ||
                            (assignment.questions && JSON.parse(assignment.questions).some(q => q.toLowerCase().includes(searchTerm))); // Search in questions too
      const matchesSubject = !subjectFilter || assignment.subject_class_id === subjectFilter;
      
      let matchesStatus = true;
      if (statusFilter) {
        const dueDate = new Date(assignment.due_date);
        if (statusFilter === 'upcoming') {
          matchesStatus = dueDate > now;
        } else if (statusFilter === 'active') {
          matchesStatus = dueDate <= now;
        } else if (statusFilter === 'overdue') {
          matchesStatus = dueDate < now;
        }
      }

      return matchesSearch && matchesSubject && matchesStatus;
    });

    this.currentPage = 1;
    this.renderAssignmentsTable();
    this.updateTotalCount();
  }

  renderAssignmentsTable() {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    const pageAssignments = this.filteredAssignments.slice(startIndex, endIndex);
    const tbody = document.getElementById('assignmentsTableBody');
    const now = new Date();

    if (pageAssignments.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center">No assignments found for the selected criteria</td></tr>';
      this.renderPagination();
      return;
    }

    tbody.innerHTML = pageAssignments.map(assignment => {
      const subject = this.mySubjects.find(s => 
        `${s.id}_${s.branch}_${s.year}_${s.semester}_${s.section}` === assignment.subject_class_id
      );
      const subjectDisplay = subject ? `${subject.name} (${subject.code})` : 'N/A';
      const dueDate = assignment.due_date ? new Date(assignment.due_date) : null;
      const uploadedByFaculty = campusDB.findById('faculty', assignment.created_by);
      const uploadedByName = uploadedByFaculty ? uploadedByFaculty.name : 'N/A';
      const uploadedOn = new Date(assignment.created_at);

      let statusText = '';
      let statusBadgeClass = '';
      if (!dueDate) {
        statusText = 'No Due Date';
        statusBadgeClass = 'badge-secondary';
      } else if (dueDate < now) {
        statusText = 'Overdue';
        statusBadgeClass = 'badge-error';
      } else if (dueDate > now) {
        statusText = 'Upcoming';
        statusBadgeClass = 'badge-warning';
      } else {
        statusText = 'Active';
        statusBadgeClass = 'badge-info';
      }

      // Removed typeText as it's not directly displayed in the table row, but in the new details page
      // let typeText = assignment.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      // if (assignment.type === 'typed_questions') {
      //     typeText = 'Typed Questions';
      // } else if (assignment.type === 'assignment_question_paper') {
      //     typeText = 'File Upload';
      // }

      return `
        <tr>
          <td><strong>${assignment.title}</strong></td>
          <td>${subjectDisplay}</td>
          <td>${dueDate ? dueDate.toLocaleDateString() : 'N/A'}</td>
          <td>${assignment.max_marks || 'N/A'}</td>
          <td>${uploadedByName}</td>
          <td>${uploadedOn.toLocaleDateString()}</td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="window.location.href='assignment-details.html?id=${assignment.id}'">
              <span>👁️</span> View
            </button>
          </td>
        </tr>
      `;
    }).join('');
    this.renderPagination();
  }

  renderPagination() {
    const totalPages = Math.ceil(this.filteredAssignments.length / this.itemsPerPage);
    const pagination = document.getElementById('pagination');
    if (totalPages <= 1) {
      pagination.innerHTML = '';
      return;
    }

    let paginationHTML = '';
    paginationHTML += `
      <button ${this.currentPage === 1 ? 'disabled' : ''} onclick="studentAssignments.goToPage(${this.currentPage - 1})">
        Previous
      </button>
    `;
    for (let i = 1; i <= totalPages; i++) {
      paginationHTML += `
        <button class="${i === this.currentPage ? 'active' : ''}" onclick="studentAssignments.goToPage(${i})">
          ${i}
        </button>
      `;
    }
    paginationHTML += `
      <button ${this.currentPage === totalPages ? 'disabled' : ''} onclick="studentAssignments.goToPage(${this.currentPage + 1})">
        Next
      </button>
    `;
    pagination.innerHTML = paginationHTML;
  }

  goToPage(page) {
    this.currentPage = page;
    this.renderAssignmentsTable();
  }

  updateTotalCount() {
    document.getElementById('totalAssignmentsCount').textContent = `${this.filteredAssignments.length} assignments`;
  }

  // Removed viewAssignmentDetails, hideDetailModal, downloadAssignmentFile as they are moved to student-assignment-details.js

  showAlert(message, type) {
    const existingAlerts = document.querySelectorAll('#assignmentsAlert .alert');
    existingAlerts.forEach(alert => alert.remove());

    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    
    const alertContainer = document.getElementById('assignmentsAlert');
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
let studentAssignments;
document.addEventListener('DOMContentLoaded', () => {
  studentAssignments = new StudentAssignments();
});