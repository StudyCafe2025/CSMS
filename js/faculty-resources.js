// Faculty Resources Management
class FacultyResources {
  constructor() {
    this.facultyData = null;
    this.subjectsTaught = [];
    this.resources = [];
    this.filteredResources = [];
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
    document.getElementById('searchInput').addEventListener('input', () => this.filterResources());
    document.getElementById('subjectFilter').addEventListener('change', () => this.filterResources());
    document.getElementById('typeFilter').addEventListener('change', () => this.filterResources());
    // Removed handleResourceTypeChange as assignment_question_paper is no longer managed here
    document.getElementById('resourceForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveResource();
    });
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
      this.populateSubjectDropdowns();
      this.loadResources();
    } catch (error) {
      console.error('Error loading faculty data for resources:', error);
      this.showAlert('Error loading faculty data.', 'error');
    }
  }

  populateSubjectDropdowns() {
    const subjectFilter = document.getElementById('subjectFilter');
    const resourceSubject = document.getElementById('resourceSubject');
    
    const optionsHtml = this.subjectsTaught.map(subject => 
      `<option value="${subject.id}_${subject.branch}_${subject.year}_${subject.semester}_${subject.section}">` +
      `${subject.name} (${subject.code}) - Y${subject.year} S${subject.semester} Sec ${subject.section}` +
      `</option>`
    ).join('');

    subjectFilter.innerHTML = '<option value="">All My Subjects</option>' + optionsHtml;
    resourceSubject.innerHTML = '<option value="">Select Subject & Class</option>' + optionsHtml;
  }

  loadResources() {
    try {
      // Filter out 'assignment_question_paper' type from resources, as they are now managed via Assignments page
      this.resources = campusDB.getStorageData('resources').filter(r => 
        r.uploaded_by === this.facultyData.id && r.type !== 'assignment_question_paper'
      );
      this.filteredResources = [...this.resources];
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

    this.filteredResources = this.resources.filter(resource => {
      const subject = this.subjectsTaught.find(s => 
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
      const subject = this.subjectsTaught.find(s => 
        `${s.id}_${s.branch}_${s.year}_${s.semester}_${s.section}` === resource.subject_class_id
      );
      const subjectDisplay = subject ? `${subject.name} (${subject.code})` : 'N/A';
      const uploadDate = new Date(resource.uploaded_at).toLocaleDateString();

      return `
        <tr>
          <td><strong>${resource.title}</strong></td>
          <td>${subjectDisplay}</td>
          <td>${resource.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</td>
          <td>${this.facultyData.name}</td>
          <td>${uploadDate}</td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="facultyResources.downloadResource(${resource.id})" style="margin-right: 5px;">
              <span>📥</span> Download
            </button>
            <button class="btn btn-danger btn-sm" onclick="facultyResources.deleteResource(${resource.id})">
              <span>🗑️</span> Delete
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
      <button ${this.currentPage === 1 ? 'disabled' : ''} onclick="facultyResources.goToPage(${this.currentPage - 1})">
        Previous
      </button>
    `;
    for (let i = 1; i <= totalPages; i++) {
      paginationHTML += `
        <button class="${i === this.currentPage ? 'active' : ''}" onclick="facultyResources.goToPage(${i})">
          ${i}
        </button>
      `;
    }
    paginationHTML += `
      <button ${this.currentPage === totalPages ? 'disabled' : ''} onclick="facultyResources.goToPage(${this.currentPage + 1})">
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

  showUploadResourceModal() {
    document.getElementById('resourceModalTitle').textContent = 'Upload New Resource';
    document.getElementById('resourceForm').reset();
    document.getElementById('resourceId').value = '';
    document.getElementById('uploadResourceModal').style.display = 'flex';
    // Ensure assignment-specific fields are hidden, as this page no longer handles them
    document.getElementById('assignmentFields').style.display = 'none';
    document.getElementById('assignmentDueDate').required = false;
    document.getElementById('assignmentMaxMarks').required = false;
    // Reset resource type dropdown to exclude assignment_question_paper if it was there
    document.getElementById('resourceType').innerHTML = `
        <option value="">Select Type</option>
        <option value="lecture_notes">Lecture Notes</option>
        <option value="syllabus">Syllabus</option>
        <option value="question_bank">Question Bank</option>
        <option value="other">Other</option>
    `;
  }

  hideUploadResourceModal() {
    document.getElementById('uploadResourceModal').style.display = 'none';
  }

  // Removed handleResourceTypeChange as assignment_question_paper is no longer managed here

  saveResource() {
    const title = document.getElementById('resourceTitle').value;
    const subjectClassId = document.getElementById('resourceSubject').value;
    const type = document.getElementById('resourceType').value;
    const fileInput = document.getElementById('resourceFile');
    const description = document.getElementById('resourceDescription').value;

    if (!title || !subjectClassId || !type || !fileInput.files.length) {
      this.showAlert('Please fill all required fields and select a file.', 'error');
      return;
    }

    const file = fileInput.files[0];
    const maxFileSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/zip'];

    if (file.size > maxFileSize) {
      this.showAlert('File size exceeds 5MB limit.', 'error');
      return;
    }
    if (!allowedTypes.includes(file.type)) {
      this.showAlert('Unsupported file type. Please upload PDF, DOCX, PPTX, or ZIP.', 'error');
      return;
    }

    // Simulate file upload by storing file metadata
    const newResource = {
      title: title,
      subject_class_id: subjectClassId,
      type: type,
      description: description,
      file_name: file.name,
      file_type: file.type,
      file_size: file.size,
      file_url: URL.createObjectURL(file), // In a real app, this would be a server URL
      uploaded_by: this.facultyData.id,
      uploaded_by_name: this.facultyData.name,
      uploaded_at: new Date().toISOString()
    };

    try {
      campusDB.create('resources', newResource);
      this.showAlert('Resource uploaded successfully', 'success');
      authSystem.logActivity('upload_resource', this.facultyData.user_id, `Uploaded resource: ${title}`);

      this.hideUploadResourceModal();
      this.loadResources();
    } catch (error) {
      console.error('Error uploading resource:', error);
      this.showAlert('Error uploading resource', 'error');
    }
  }

  downloadResource(id) {
    const resource = this.resources.find(r => r.id === id);
    if (!resource || !resource.file_url) {
      this.showAlert('Resource file not found or URL is invalid.', 'error');
      return;
    }

    // Simulate download by creating a temporary link
    const a = document.createElement('a');
    a.href = resource.file_url;
    a.download = resource.file_name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // In a real app, you might revokeObjectURL after download completes
    // URL.revokeObjectURL(resource.file_url); 

    this.showAlert(`Downloading "${resource.file_name}"...`, 'info');
  }

  deleteResource(id) {
    if (!confirm('Are you sure you want to delete this resource? This action cannot be undone.')) {
      return;
    }
    try {
      campusDB.delete('resources', id);
      this.showAlert('Resource deleted successfully', 'success');
      this.loadResources();
    } catch (error) {
      console.error('Error deleting resource:', error);
      this.showAlert('Error deleting resource', 'error');
    }
  }

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
function showUploadResourceModal() {
  facultyResources.showUploadResourceModal();
}

function hideUploadResourceModal() {
  facultyResources.hideUploadResourceModal();
}

function saveResource() {
  facultyResources.saveResource();
}

// Initialize when DOM is loaded
let facultyResources;
document.addEventListener('DOMContentLoaded', () => {
  facultyResources = new FacultyResources();
});