// Admin Fees Management
class AdminFees {
  constructor() {
    this.fees = [];
    this.filteredFees = [];
    this.students = []; // To link student IDs to names
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

    this.loadData();
    this.setupEventListeners();
  }

  setupEventListeners() {
    document.getElementById('searchInput').addEventListener('input', () => this.filterFees());
    document.getElementById('semesterFilter').addEventListener('change', () => this.filterFees());
    document.getElementById('statusFilter').addEventListener('change', () => this.filterFees());

    document.getElementById('feeForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveFee();
    });
  }

  loadData() {
    try {
      this.fees = campusDB.getStorageData('fees');
      this.students = campusDB.getStorageData('students'); // Load all students for lookup
      this.filteredFees = [...this.fees];
      this.updateStats();
      this.renderFeeTable();
    } catch (error) {
      console.error('Error loading fee data:', error);
      this.showAlert('Error loading fee data', 'error');
    }
  }

  updateStats() {
    const totalRecords = this.fees.length;
    const totalCollected = this.fees.reduce((sum, fee) => sum + (fee.paid_amount || 0), 0);
    const totalDue = this.fees.reduce((sum, fee) => sum + (fee.due_amount || 0), 0);
    const partiallyPaid = this.fees.filter(fee => fee.status === 'partially_paid').length;

    document.getElementById('totalFeeRecords').textContent = totalRecords;
    document.getElementById('totalCollected').textContent = `₹${totalCollected.toLocaleString()}`;
    document.getElementById('totalDue').textContent = `₹${totalDue.toLocaleString()}`;
    document.getElementById('partiallyPaid').textContent = partiallyPaid;
  }

  filterFees() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const semesterFilter = document.getElementById('semesterFilter').value;
    const statusFilter = document.getElementById('statusFilter').value;

    this.filteredFees = this.fees.filter(fee => {
      const student = this.students.find(s => s.id === fee.student_id);
      const studentName = student ? student.name.toLowerCase() : '';
      const studentId = student ? student.student_id.toLowerCase() : '';

      const matchesSearch = !searchTerm || studentName.includes(searchTerm) || studentId.includes(searchTerm);
      const matchesSemester = !semesterFilter || fee.semester.toString() === semesterFilter;
      const matchesStatus = !statusFilter || fee.status === statusFilter;

      return matchesSearch && matchesSemester && matchesStatus;
    });

    this.currentPage = 1;
    this.renderFeeTable();
  }

  renderFeeTable() {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    const pageFees = this.filteredFees.slice(startIndex, endIndex);
    const tbody = document.getElementById('feeTableBody');

    document.getElementById('filteredCount').textContent = `${this.filteredFees.length} records`;

    if (pageFees.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="text-center">No fee records found</td></tr>';
      this.renderPagination();
      return;
    }

    tbody.innerHTML = pageFees.map(fee => {
      const student = this.students.find(s => s.id === fee.student_id);
      const studentName = student ? student.name : 'N/A';
      const studentId = student ? student.student_id : 'N/A';

      let statusText = 'Pending';
      let statusBadgeClass = 'badge-error';
      if (fee.status === 'paid') {
        statusText = 'Paid';
        statusBadgeClass = 'badge-success';
      } else if (fee.status === 'partially_paid') {
        statusText = 'Partially Paid';
        statusBadgeClass = 'badge-warning';
      }

      return `
        <tr>
          <td><strong>${studentId}</strong></td>
          <td>${studentName}</td>
          <td>Semester ${fee.semester}</td>
          <td>₹${fee.total_fee.toLocaleString()}</td>
          <td>₹${fee.paid_amount.toLocaleString()}</td>
          <td>₹${fee.due_amount.toLocaleString()}</td>
          <td>
            <span class="badge ${statusBadgeClass}">${statusText}</span>
          </td>
          <td>${fee.payment_date || 'N/A'}</td>
          <td>
            <button class="btn btn-primary btn-sm" onclick="adminFees.editFee(${fee.id})" style="margin-right: 5px;">
              <span>✏️</span>
            </button>
            <button class="btn btn-danger btn-sm" onclick="adminFees.deleteFee(${fee.id})">
              <span>🗑️</span>
            </button>
          </td>
        </tr>
      `;
    }).join('');
    this.renderPagination();
  }

  renderPagination() {
    const totalPages = Math.ceil(this.filteredFees.length / this.itemsPerPage);
    const pagination = document.getElementById('pagination');
    if (totalPages <= 1) {
      pagination.innerHTML = '';
      return;
    }

    let paginationHTML = '';
    paginationHTML += `
      <button ${this.currentPage === 1 ? 'disabled' : ''} onclick="adminFees.goToPage(${this.currentPage - 1})">
        Previous
      </button>
    `;
    for (let i = 1; i <= totalPages; i++) {
      paginationHTML += `
        <button class="${i === this.currentPage ? 'active' : ''}" onclick="adminFees.goToPage(${i})">
          ${i}
        </button>
      `;
    }
    paginationHTML += `
      <button ${this.currentPage === totalPages ? 'disabled' : ''} onclick="adminFees.goToPage(${this.currentPage + 1})">
        Next
      </button>
    `;
    pagination.innerHTML = paginationHTML;
  }

  goToPage(page) {
    this.currentPage = page;
    this.renderFeeTable();
  }

  showAddFeeModal() {
    document.getElementById('feeModalTitle').textContent = 'Add Fee Record';
    document.getElementById('feeForm').reset();
    document.getElementById('feeId').value = '';
    document.getElementById('studentNameDisplay').textContent = ''; // Clear student name
    document.getElementById('dueAmount').value = '0'; // Default due amount
    document.getElementById('feeModal').style.display = 'flex';
  }

  editFee(id) {
    const fee = this.fees.find(f => f.id === id);
    if (!fee) return;

    document.getElementById('feeModalTitle').textContent = 'Edit Fee Record';
    document.getElementById('feeId').value = fee.id;
    
    const student = this.students.find(s => s.id === fee.student_id);
    document.getElementById('studentIdInput').value = student ? student.student_id : '';
    document.getElementById('studentNameDisplay').textContent = student ? `Student: ${student.name}` : 'Student not found';

    document.getElementById('feeSemester').value = fee.semester || '';
    document.getElementById('totalFee').value = fee.total_fee || 0;
    document.getElementById('paidAmount').value = fee.paid_amount || 0;
    document.getElementById('dueAmount').value = fee.due_amount || 0;
    document.getElementById('paymentDate').value = fee.payment_date || '';
    document.getElementById('feeStatus').value = fee.status || 'pending';

    document.getElementById('feeModal').style.display = 'flex';
  }

  loadStudentName() {
    const studentIdInput = document.getElementById('studentIdInput').value;
    const studentNameDisplay = document.getElementById('studentNameDisplay');
    const student = this.students.find(s => s.student_id === studentIdInput);
    if (student) {
      studentNameDisplay.textContent = `Student: ${student.name}`;
      studentNameDisplay.style.color = 'var(--success)';
    } else {
      studentNameDisplay.textContent = 'Student not found';
      studentNameDisplay.style.color = 'var(--error)';
    }
  }

  calculateDue() {
    const totalFee = parseFloat(document.getElementById('totalFee').value) || 0;
    const paidAmount = parseFloat(document.getElementById('paidAmount').value) || 0;
    const dueAmount = totalFee - paidAmount;
    document.getElementById('dueAmount').value = Math.max(0, dueAmount);

    // Update status based on due amount
    const feeStatusSelect = document.getElementById('feeStatus');
    if (dueAmount <= 0) {
      feeStatusSelect.value = 'paid';
    } else if (paidAmount > 0) {
      feeStatusSelect.value = 'partially_paid';
    } else {
      feeStatusSelect.value = 'pending';
    }
  }

  saveFee() {
    const studentIdInput = document.getElementById('studentIdInput').value;
    const student = this.students.find(s => s.student_id === studentIdInput);

    if (!student) {
      this.showAlert('Invalid Student ID. Please enter a valid Student ID.', 'error');
      return;
    }

    const totalFee = parseFloat(document.getElementById('totalFee').value);
    const paidAmount = parseFloat(document.getElementById('paidAmount').value);
    const dueAmount = parseFloat(document.getElementById('dueAmount').value);

    const formData = {
      student_id: student.id,
      semester: parseInt(document.getElementById('feeSemester').value),
      total_fee: totalFee,
      paid_amount: paidAmount,
      due_amount: dueAmount,
      payment_date: document.getElementById('paymentDate').value || null,
      status: document.getElementById('feeStatus').value
    };

    // Basic validation
    if (!formData.student_id || !formData.semester || isNaN(formData.total_fee) || isNaN(formData.paid_amount)) {
      this.showAlert('Please fill all required fields with valid data.', 'error');
      return;
    }
    if (formData.paid_amount > formData.total_fee) {
      this.showAlert('Paid amount cannot be greater than total fee.', 'error');
      return;
    }

    try {
      const feeId = document.getElementById('feeId').value;
      if (feeId) {
        campusDB.update('fees', parseInt(feeId), formData);
        this.showAlert('Fee record updated successfully', 'success');
      } else {
        // Check for duplicate fee record for the same student and semester
        const existingFee = this.fees.find(f => f.student_id === formData.student_id && f.semester === formData.semester);
        if (existingFee) {
          this.showAlert('A fee record for this student and semester already exists. Please edit the existing record.', 'error');
          return;
        }
        campusDB.create('fees', formData);
        this.showAlert('Fee record added successfully', 'success');
      }
      this.hideFeeModal();
      this.loadData();
    } catch (error) {
      console.error('Error saving fee record:', error);
      this.showAlert('Error saving fee record', 'error');
    }
  }

  deleteFee(id) {
    if (!confirm('Are you sure you want to delete this fee record? This action cannot be undone.')) {
      return;
    }
    try {
      campusDB.delete('fees', id);
      this.showAlert('Fee record deleted successfully', 'success');
      this.loadData();
    } catch (error) {
      console.error('Error deleting fee record:', error);
      this.showAlert('Error deleting fee record', 'error');
    }
  }

  hideFeeModal() {
    document.getElementById('feeModal').style.display = 'none';
  }

  // Import functionality
  showImportFeesModal() {
    document.getElementById('importFeesModal').style.display = 'flex';
    document.getElementById('importFeesResults').style.display = 'none';
    document.getElementById('importFeesBtn').style.display = 'block';
    document.getElementById('importFeesBtn').disabled = true;
    document.getElementById('feesCsvFile').value = ''; // Clear file input
    document.getElementById('importFeesPreview').style.display = 'none'; // Hide preview
    this.importData = []; // Clear previous import data
  }

  hideImportFeesModal() {
    document.getElementById('importFeesModal').style.display = 'none';
    document.getElementById('feesCsvFile').value = '';
    document.getElementById('importFeesPreview').style.display = 'none';
    document.getElementById('importFeesResults').style.display = 'none';
    document.getElementById('importFeesBtn').disabled = true;
    this.importData = [];
  }

  handleFeesFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      this.showAlert('Please select a CSV file', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      this.parseFeesCSV(e.target.result);
    };
    reader.readAsText(file);
  }

  parseFeesCSV(csvText) {
    try {
      const lines = csvText.split(/\r?\n/).filter(line => line.trim());
      if (lines.length < 2) {
        this.showAlert('CSV file must contain at least a header row and one data row', 'error');
        return;
      }

      const csvSplitRegex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
      const headers = lines[0].split(csvSplitRegex).map(h => h.trim().replace(/^"|"$/g, ''));
      const requiredHeaders = ['student_id', 'semester', 'total_fee', 'paid_amount', 'payment_date', 'status'];
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

      if (missingHeaders.length > 0) {
        this.showAlert(`Missing required columns: ${missingHeaders.join(', ')}`, 'error');
        return;
      }

      this.importData = lines.slice(1).map(line => {
        const values = line.split(csvSplitRegex).map(v => v.trim().replace(/^"|"$/g, ''));
        const fee = {};
        headers.forEach((header, index) => {
          fee[header] = values[index] || '';
        });
        return fee;
      });

      this.showImportFeesPreview();
      document.getElementById('importFeesBtn').disabled = false;
    } catch (error) {
      console.error('Error parsing CSV:', error);
      this.showAlert('Error parsing CSV file', 'error');
    }
  }

  showImportFeesPreview() {
    const preview = document.getElementById('importFeesPreview');
    const previewHeader = document.getElementById('previewFeesHeader');
    const previewBody = document.getElementById('previewFeesBody');

    if (this.importData.length === 0) return;

    preview.style.display = 'block';
    const headers = Object.keys(this.importData[0]);
    previewHeader.innerHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;

    const previewRows = this.importData.slice(0, 5);
    previewBody.innerHTML = previewRows.map(fee => `
      <tr>${headers.map(h => `<td>${fee[h]}</td>`).join('')}</tr>
    `).join('');
  }

  importFees() {
    if (this.importData.length === 0) return;

    try {
      let successCount = 0;
      let errorCount = 0;
      const errors = [];

      this.importData.forEach((feeData, index) => {
        try {
          // Validate required fields
          if (!feeData.student_id || !feeData.semester || !feeData.total_fee || !feeData.paid_amount || !feeData.status) {
            errors.push(`Row ${index + 2}: Missing required fields.`);
            errorCount++;
            return;
          }

          const student = this.students.find(s => s.student_id === feeData.student_id);
          if (!student) {
            errors.push(`Row ${index + 2}: Student with ID '${feeData.student_id}' not found.`);
            errorCount++;
            return;
          }

          const semester = parseInt(feeData.semester);
          const totalFee = parseFloat(feeData.total_fee);
          const paidAmount = parseFloat(feeData.paid_amount);
          const paymentDate = feeData.payment_date || null;
          const status = feeData.status;

          if (isNaN(semester) || semester < 1 || semester > 8) {
            errors.push(`Row ${index + 2}: Invalid semester (must be 1-8)`);
            errorCount++;
            return;
          }
          if (isNaN(totalFee) || totalFee < 0) {
            errors.push(`Row ${index + 2}: Invalid total fee`);
            errorCount++;
            return;
          }
          if (isNaN(paidAmount) || paidAmount < 0) {
            errors.push(`Row ${index + 2}: Invalid paid amount`);
            errorCount++;
            return;
          }
          if (paidAmount > totalFee) {
            errors.push(`Row ${index + 2}: Paid amount cannot be greater than total fee`);
            errorCount++;
            return;
          }
          if (!['paid', 'partially_paid', 'pending'].includes(status)) {
            errors.push(`Row ${index + 2}: Invalid status (must be paid, partially_paid, or pending)`);
            errorCount++;
            return;
          }

          const dueAmount = totalFee - paidAmount;

          const newFee = {
            student_id: student.id,
            semester: semester,
            total_fee: totalFee,
            paid_amount: paidAmount,
            due_amount: dueAmount,
            payment_date: paymentDate,
            status: status
          };

          // Check for duplicates before creating
          const existingFee = this.fees.find(f => f.student_id === newFee.student_id && f.semester === newFee.semester);
          if (existingFee) {
            errors.push(`Row ${index + 2}: Duplicate fee record for Student ID '${feeData.student_id}' and Semester ${semester}.`);
            errorCount++;
            return;
          }

          campusDB.create('fees', newFee);
          successCount++;
        } catch (error) {
          errors.push(`Row ${index + 2}: ${error.message}`);
          errorCount++;
        }
      });

      const results = document.getElementById('importFeesResults');
      const stats = document.getElementById('importFeesStats');
      const importAlertDiv = results.querySelector('.alert');

      stats.innerHTML = `
        <div>Successfully imported: ${successCount} fee records</div>
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
      document.getElementById('importFeesBtn').style.display = 'none';
    } catch (error) {
      console.error('Error importing fees:', error);
      this.showAlert('Error importing fees', 'error');
      document.getElementById('importFeesBtn').disabled = false;
      document.getElementById('importFeesBtn').style.display = 'block';
    }
  }

  downloadFeesTemplate() {
    const template = `student_id,semester,total_fee,paid_amount,payment_date,status
CS2021001,5,57000,57000,2024-01-10,paid
CE2022001,3,50500,40000,2024-01-15,partially_paid
CS2021002,5,57000,0,,pending`;
    const blob = new Blob([template], {
      type: 'text/csv'
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fees_import_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  exportFees() {
    if (this.filteredFees.length === 0) {
      this.showAlert('No fee records to export', 'warning');
      return;
    }

    try {
      const exportData = this.filteredFees.map(fee => {
        const student = this.students.find(s => s.id === fee.student_id);
        const studentId = student ? student.student_id : 'N/A';
        const studentName = student ? student.name : 'N/A';

        return {
          student_id: studentId,
          student_name: studentName,
          semester: fee.semester,
          total_fee: fee.total_fee,
          paid_amount: fee.paid_amount,
          due_amount: fee.due_amount,
          status: fee.status,
          payment_date: fee.payment_date || ''
        };
      });

      const headers = ['student_id', 'student_name', 'semester', 'total_fee', 'paid_amount', 'due_amount', 'status', 'payment_date'];
      const csvContent = [
        headers.join(','),
        ...exportData.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], {
        type: 'text/csv'
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fees_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      this.showAlert('Fee records exported successfully', 'success');
    } catch (error) {
      console.error('Error exporting fees:', error);
      this.showAlert('Error exporting fees', 'error');
    }
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
function showAddFeeModal() {
  adminFees.showAddFeeModal();
}

function hideFeeModal() {
  adminFees.hideFeeModal();
}

function saveFee() {
  adminFees.saveFee();
}

function showImportFeesModal() {
  adminFees.showImportFeesModal();
}

function hideImportFeesModal() {
  adminFees.hideImportFeesModal();
}

function handleFeesFileSelect(event) {
  adminFees.handleFeesFileSelect(event);
}

function importFees() {
  adminFees.importFees();
}

function downloadFeesTemplate() {
  adminFees.downloadFeesTemplate();
}

function exportFees() {
  adminFees.exportFees();
}

// Initialize when DOM is loaded
let adminFees;
document.addEventListener('DOMContentLoaded', () => {
  adminFees = new AdminFees();
});