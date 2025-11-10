// Admin Analytics Management
class AdminAnalytics {
  constructor() {
    this.allStudents = [];
    this.allFaculty = [];
    this.allDepartments = [];
    this.allSubjects = [];
    this.allClassOfferings = [];
    this.allAttendance = [];
    this.allMarks = [];
    this.allFees = [];

    this.enrollmentChart = null;
    this.attendanceChart = null;
    this.feeChart = null;
    this.performanceChart = null;

    this.init();
  }

  init() {
    if (!requireAuth() || !requireRole('admin')) {
      return;
    }
    this.loadData();
    this.setupEventListeners();
  }

  setupEventListeners() {
    document.getElementById('branchFilter').addEventListener('change', () => this.filterCharts());
    document.getElementById('yearFilter').addEventListener('change', () => this.filterCharts());
    document.getElementById('semesterFilter').addEventListener('change', () => this.filterCharts());
  }

  loadData() {
    try {
      this.allStudents = campusDB.getStorageData('students');
      this.allFaculty = campusDB.getStorageData('faculty');
      this.allDepartments = campusDB.getStorageData('departments');
      this.allSubjects = campusDB.getStorageData('subjects');
      this.allClassOfferings = campusDB.getStorageData('class_offerings');
      this.allAttendance = campusDB.getStorageData('attendance');
      this.allMarks = campusDB.getStorageData('marks');
      this.allFees = campusDB.getStorageData('fees');

      this.loadAnalytics();
    } catch (error) {
      console.error('Error loading analytics data:', error);
      this.showAlert('Error loading analytics data', 'error');
    }
  }

  loadAnalytics() {
    this.filterCharts(); // This will re-render all charts and metrics
    this.showAlert('Analytics data loaded successfully', 'success');
  }

  filterCharts() {
    const branchFilter = document.getElementById('branchFilter').value;
    const yearFilter = document.getElementById('yearFilter').value;
    const semesterFilter = document.getElementById('semesterFilter').value;

    let filteredStudents = [...this.allStudents];
    let filteredAttendance = [...this.allAttendance];
    let filteredMarks = [...this.allMarks];
    let filteredFees = [...this.allFees];

    if (branchFilter) {
      filteredStudents = filteredStudents.filter(s => s.branch === branchFilter);
      filteredFees = filteredFees.filter(f => filteredStudents.some(s => s.id === f.student_id));
    }
    if (yearFilter) {
      filteredStudents = filteredStudents.filter(s => s.year.toString() === yearFilter);
      filteredFees = filteredFees.filter(f => filteredStudents.some(s => s.id === f.student_id));
    }
    if (semesterFilter) {
      filteredStudents = filteredStudents.filter(s => s.semester.toString() === semesterFilter);
      filteredFees = filteredFees.filter(f => filteredStudents.some(s => s.id === f.student_id));
    }

    // Filter attendance and marks based on filtered students
    const filteredStudentIds = filteredStudents.map(s => s.id);
    filteredAttendance = filteredAttendance.filter(a => filteredStudentIds.includes(a.student_id));
    filteredMarks = filteredMarks.filter(m => filteredStudentIds.includes(m.student_id));

    this.updateKeyMetrics(filteredStudents, filteredAttendance, filteredFees);
    this.renderEnrollmentChart(filteredStudents);
    this.renderAttendanceChart(filteredStudents, filteredAttendance);
    this.renderFeeChart(filteredFees);
    this.renderPerformanceChart(filteredStudents, filteredMarks);
    this.renderDepartmentOverviewTable(filteredStudents, filteredAttendance, filteredFees);
  }

  updateKeyMetrics(students, attendance, fees) {
    const totalStudents = students.length;
    
    const totalClasses = attendance.length;
    const presentCount = attendance.filter(a => a.status === 'present').length;
    const avgAttendance = totalClasses > 0 ? Math.round((presentCount / totalClasses) * 100) : 0;

    const totalMarks = marks.reduce((sum, m) => sum + m.marks, 0);
    const totalMaxMarks = marks.reduce((sum, m) => sum + m.max_marks, 0);
    const avgPerformance = totalMaxMarks > 0 ? Math.round((totalMarks / totalMaxMarks) * 100) : 0;

    const pendingFees = fees.reduce((sum, fee) => sum + (fee.status !== 'paid' ? fee.due_amount : 0), 0);

    document.getElementById('totalStudentsMetric').textContent = totalStudents;
    document.getElementById('avgAttendanceMetric').textContent = `${avgAttendance}%`;
    document.getElementById('avgPerformanceMetric').textContent = `${avgPerformance}%`;
    document.getElementById('pendingFeesMetric').textContent = `₹${pendingFees.toLocaleString()}`;
  }

  renderEnrollmentChart(students) {
    const enrollmentByBranch = {};
    students.forEach(s => {
      enrollmentByBranch[s.branch] = (enrollmentByBranch[s.branch] || 0) + 1;
    });

    const labels = Object.keys(enrollmentByBranch);
    const data = Object.values(enrollmentByBranch);
    const colors = labels.map((_, i) => `hsl(${i * 50}, 70%, 50%)`);

    if (this.enrollmentChart) {
      this.enrollmentChart.destroy();
    }

    const ctx = document.getElementById('enrollmentChart').getContext('2d');
    this.enrollmentChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Number of Students',
          data: data,
          backgroundColor: colors,
          borderColor: colors.map(c => c.replace('50%)', '40%)')),
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Students'
            }
          }
        }
      }
    });
  }

  renderAttendanceChart(students, attendance) {
    const attendanceByBranch = {}; // { 'BranchName': { totalClasses: 0, presentClasses: 0 } }
    this.allDepartments.forEach(dept => {
      attendanceByBranch[dept.name] = { totalClasses: 0, presentClasses: 0 };
    });

    attendance.forEach(record => {
      const student = students.find(s => s.id === record.student_id);
      if (student && attendanceByBranch[student.branch]) {
        attendanceByBranch[student.branch].totalClasses++;
        if (record.status === 'present') {
          attendanceByBranch[student.branch].presentClasses++;
        }
      }
    });

    const labels = Object.keys(attendanceByBranch);
    const data = labels.map(branch => {
      const { totalClasses, presentClasses } = attendanceByBranch[branch];
      return totalClasses > 0 ? Math.round((presentClasses / totalClasses) * 100) : 0;
    });
    const colors = labels.map((_, i) => `hsl(${i * 50 + 30}, 70%, 50%)`);

    if (this.attendanceChart) {
      this.attendanceChart.destroy();
    }

    const ctx = document.getElementById('attendanceChart').getContext('2d');
    this.attendanceChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Attendance Rate (%)',
          data: data,
          backgroundColor: colors,
          borderColor: colors.map(c => c.replace('50%)', '40%)')),
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            title: {
              display: true,
              text: 'Attendance %'
            }
          }
        }
      }
    });
  }

  renderFeeChart(fees) {
    const feeStatusCounts = {
      paid: 0,
      partially_paid: 0,
      pending: 0
    };
    fees.forEach(f => {
      feeStatusCounts[f.status] = (feeStatusCounts[f.status] || 0) + 1;
    });

    const labels = ['Paid', 'Partially Paid', 'Pending'];
    const data = [feeStatusCounts.paid, feeStatusCounts.partially_paid, feeStatusCounts.pending];
    const colors = ['var(--success)', 'var(--warning)', 'var(--error)'];

    if (this.feeChart) {
      this.feeChart.destroy();
    }

    const ctx = document.getElementById('feeChart').getContext('2d');
    this.feeChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          label: 'Fee Records',
          data: data,
          backgroundColor: colors,
          borderColor: 'white',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
          },
          title: {
            display: true,
            text: 'Fee Collection Status'
          }
        }
      }
    });
  }

  renderPerformanceChart(students, marks) {
    const performanceByBranch = {}; // { 'BranchName': { totalPercentage: 0, count: 0 } }
    this.allDepartments.forEach(dept => {
      performanceByBranch[dept.name] = { totalPercentage: 0, count: 0 };
    });

    marks.forEach(record => {
      const student = students.find(s => s.id === record.student_id);
      if (student && performanceByBranch[student.branch]) {
        const percentage = record.max_marks > 0 ? (record.marks / record.max_marks) * 100 : 0;
        performanceByBranch[student.branch].totalPercentage += percentage;
        performanceByBranch[student.branch].count++;
      }
    });

    const labels = Object.keys(performanceByBranch);
    const data = labels.map(branch => {
      const { totalPercentage, count } = performanceByBranch[branch];
      return count > 0 ? Math.round(totalPercentage / count) : 0;
    });
    const colors = labels.map((_, i) => `hsl(${i * 50 + 60}, 70%, 50%)`);

    if (this.performanceChart) {
      this.performanceChart.destroy();
    }

    const ctx = document.getElementById('performanceChart').getContext('2d');
    this.performanceChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Average Performance (%)',
          data: data,
          backgroundColor: 'rgba(37, 99, 235, 0.2)',
          borderColor: 'var(--primary)',
          borderWidth: 2,
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            title: {
              display: true,
              text: 'Performance %'
            }
          }
        }
      }
    });
  }

  renderDepartmentOverviewTable(students, attendance, fees) {
    const tbody = document.getElementById('departmentOverviewTable');
    if (this.allDepartments.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center">No departments found</td></tr>';
      return;
    }

    const departmentData = this.allDepartments.map(dept => {
      const deptStudents = students.filter(s => s.branch === dept.name);
      const deptFaculty = this.allFaculty.filter(f => f.department === dept.name);
      
      const deptStudentIds = deptStudents.map(s => s.id);
      const deptAttendance = attendance.filter(a => deptStudentIds.includes(a.student_id));
      const presentCount = deptAttendance.filter(a => a.status === 'present').length;
      const avgAttendance = deptAttendance.length > 0 ? Math.round((presentCount / deptAttendance.length) * 100) : 0;

      const deptFees = fees.filter(f => deptStudentIds.includes(f.student_id));
      const totalFees = deptFees.reduce((sum, f) => sum + f.total_fee, 0);
      const paidFees = deptFees.reduce((sum, f) => sum + f.paid_amount, 0);
      const feeCollectionRate = totalFees > 0 ? Math.round((paidFees / totalFees) * 100) : 100;

      return `
        <tr>
          <td><strong>${dept.name}</strong></td>
          <td>${deptStudents.length}</td>
          <td>${deptFaculty.length}</td>
          <td>
            <span class="badge ${avgAttendance >= 75 ? 'badge-success' : avgAttendance >= 60 ? 'badge-warning' : 'badge-error'}">
              ${avgAttendance}%
            </span>
          </td>
          <td>
            <span class="badge ${feeCollectionRate >= 90 ? 'badge-success' : feeCollectionRate >= 70 ? 'badge-warning' : 'badge-error'}">
              ${feeCollectionRate}%
            </span>
          </td>
        </tr>
      `;
    }).join('');

    tbody.innerHTML = departmentData;
  }

  exportAnalytics() {
    try {
      const analyticsData = {
        timestamp: new Date().toISOString(),
        filters: {
          branch: document.getElementById('branchFilter').value,
          year: document.getElementById('yearFilter').value,
          semester: document.getElementById('semesterFilter').value,
        },
        keyMetrics: {
          totalStudents: document.getElementById('totalStudentsMetric').textContent,
          avgAttendance: document.getElementById('avgAttendanceMetric').textContent,
          avgPerformance: document.getElementById('avgPerformanceMetric').textContent,
          pendingFees: document.getElementById('pendingFeesMetric').textContent,
        },
        departmentOverview: this.allDepartments.map(dept => {
          const deptStudents = this.allStudents.filter(s => s.branch === dept.name);
          const deptFaculty = this.allFaculty.filter(f => f.department === dept.name);
          const deptStudentIds = deptStudents.map(s => s.id);
          const deptAttendance = this.allAttendance.filter(a => deptStudentIds.includes(a.student_id));
          const presentCount = deptAttendance.filter(a => a.status === 'present').length;
          const avgAttendance = deptAttendance.length > 0 ? Math.round((presentCount / deptAttendance.length) * 100) : 0;
          const deptFees = this.allFees.filter(f => deptStudentIds.includes(f.student_id));
          const totalFees = deptFees.reduce((sum, f) => sum + f.total_fee, 0);
          const paidFees = deptFees.reduce((sum, f) => sum + f.paid_amount, 0);
          const feeCollectionRate = totalFees > 0 ? Math.round((paidFees / totalFees) * 100) : 100;

          return {
            department: dept.name,
            total_students: deptStudents.length,
            total_faculty: deptFaculty.length,
            avg_attendance_percentage: avgAttendance,
            fee_collection_percentage: feeCollectionRate
          };
        })
      };

      const dataStr = JSON.stringify(analyticsData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `analytics_report_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
      this.showAlert('Analytics data exported successfully', 'success');

    } catch (error) {
      console.error('Error exporting analytics data:', error);
      this.showAlert('Error exporting analytics data', 'error');
    }
  }

  showAlert(message, type) {
    const existingAlerts = document.querySelectorAll('#analyticsAlert .alert');
    existingAlerts.forEach(alert => alert.remove());

    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    
    const alertContainer = document.getElementById('analyticsAlert');
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
let adminAnalytics;
document.addEventListener('DOMContentLoaded', () => {
  adminAnalytics = new AdminAnalytics();
});