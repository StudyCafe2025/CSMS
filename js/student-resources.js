// Student Resources Management
class StudentResources {
  constructor() {
    this.studentData = null;
    this.mySubjects = []; // Subjects for the student's current class
    this.allResources = []; // All resources relevant to student's subjects
    this.filteredResources = [];
    this.currentPage = 1;
    this.itemsPerPage = 10;
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
    document.getElementById('searchInput').addEventListener('input', () => this.filterResources());
    document.getElementById('subjectFilter').addEventListener('change', () => this.filterResources());
    document.getElementById('typeFilter').addEventListener('change', () => this.filterResources());
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
      this.loadResources();
    } catch (error) {
      console.error('Error loading student data for resources:', error);
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

  loadResources() {
    try {
      const allResources = campusDB.getStorageData('resources');
      const mySubjectClassIds = this.mySubjects.map(s => `${s.id}_${s.branch}_${s.year}_${s.semester}_${s.section}`);

      // Filter resources to only show those relevant to the student's subjects
      this.allResources = allResources.filter(resource => 
        mySubjectClassIds.includes(resource.subject_class_id)
      );
      
      this.filteredResources = [...this.allResources];
      this.renderResourcesTable();
      this.updateTotalCount();
    } catch (error) {
      console.error('Error loading resources:', error);
      this.showAlert('Error loading resources', 'error');
    }
  }

  filterResources() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const subjectFilter = document.getElementById('subjectFilter').value;
    const typeFilter = document.getElementById('typeFilter').value;

    this.filteredResources = this.allResources.filter(resource => {
      const subject = this.mySubjects.find(s => 
        `${s.id}_${s.branch}_${s.year}_${s.semester}_${s.section}` === resource.subject_class_id
      );
      const subjectName = subject ? subject.name.toLowerCase() : '';

      const matchesSearch = !searchTerm || 
                            resource.title.toLowerCase().includes(searchTerm) ||
                            resource.description.toLowerCase().includes(searchTerm) ||
                            subjectName.includes(searchTerm);
      const matchesSubject = !subjectFilter || resource.subject_class_id === subjectFilter;
      const matchesType = !typeFilter || resource.type === typeFilter;

      return matchesSearch && matchesSubject && matchesType;
    });

    this.currentPage = 1;
    this.renderResourcesTable();
    this.updateTotalCount();
  }

  renderResourcesTable() {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    const pageResources = this.filteredResources.slice(startIndex, endIndex);
    const tbody = document.getElementById('resourcesTableBody');

    if (pageResources.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center">No resources found</td></tr>';
      this.renderPagination();
      return;
    }

    tbody.innerHTML = pageResources.map(resource => {
      const subject = this.mySubjects.find(s => 
        `${s.id}_${s.branch}_${s.year}_${s.semester}_${s.section}` === resource.subject_class_id
      );
      const subjectDisplay = subject ? `${subject.name} (${subject.code})` : 'N/A';
      const uploadDate = new Date(resource.uploaded_at).toLocaleDateString();
      const uploadedByFaculty = campusDB.findById('faculty', resource.uploaded_by);
      const uploadedByName = uploadedByFaculty ? uploadedByFaculty.name : 'N/A';

      return `
        <tr>
          <td><strong>${resource.title}</strong></td>
          <td>${subjectDisplay}</td>
          <td>${resource.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</td>
          <td>${uploadedByName}</td>
          <td>${uploadDate}</td>
          <td>
            <button class="btn btn-primary btn-sm" onclick="studentResources.downloadResource(${resource.id})">
              <span>📥</span> Download
            </button>
          </td>
        </tr>
      `;
    }).join('');
    this.renderPagination();
  }

  renderPagination() {
    const totalPages = Math.ceil(this.filteredResources.length / this.itemsPerPage);
    const pagination = document.getElementById('pagination');
    if (totalPages <= 1) {
      pagination.innerHTML = '';
      return;
    }

    let paginationHTML = '';
    paginationHTML += `
      <button ${this.currentPage === 1 ? 'disabled' : ''} onclick="studentResources.goToPage(${this.currentPage - 1})">
        Previous
      </button>
    `;
    for (let i = 1; i <= totalPages; i++) {
      paginationHTML += `
        <button class="${i === this.currentPage ? 'active' : ''}" onclick="studentResources.goToPage(${i})">
          ${i}
        </button>
      `;
    }
    paginationHTML += `
      <button ${this.currentPage === totalPages ? 'disabled' : ''} onclick="studentResources.goToPage(${this.currentPage + 1})">
        Next
      </button>
    `;
    pagination.innerHTML = paginationHTML;
  }

  goToPage(page) {
    this.currentPage = page;
    this.renderResourcesTable();
  }

  updateTotalCount() {
    document.getElementById('totalResourcesCount').textContent = `${this.filteredResources.length} resources`;
  }

  downloadResource(id) {
    const resource = this.allResources.find(r => r.id === id);
    if (!resource || !resource.file_url) {
      this.showAlert('Resource file not found or URL is invalid.', 'error');
      return;
    }

    const a = document.createElement('a');
    a.href = resource.file_url;
    a.download = resource.file_name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    this.showAlert(`Downloading "${resource.file_name}"...`, 'info');
  }

  // Removed exportResources() method as per user request.

  showAlert(message, type) {
    const existingAlerts = document.querySelectorAll('#resourcesAlert .alert');
    existingAlerts.forEach(alert => alert.remove());

    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    
    const alertContainer = document.getElementById('resourcesAlert');
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
let studentResources;
document.addEventListener('DOMContentLoaded', () => {
  studentResources = new StudentResources();
});