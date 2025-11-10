// Student Attendance View
class StudentAttendance {
  constructor() {
    this.studentData = null;
    this.subjects = []; // Subjects for the student's current class
    this.attendance = [];
    this.currentCalendarDate = new Date();
    
    this.init();
  }

  init() {
    // Check authentication
    if (!requireAuth() || !requireRole('student')) {
      return;
    }

    this.loadStudentData();
  }

  loadStudentData() {
    try {
      const currentUser = getCurrentUser();
      this.studentData = campusDB.getStudentByUserId(currentUser.id);
      
      if (!this.studentData) {
        console.error('Student data not found');
        return;
      }

      this.loadAttendanceData();
      this.generateMonthOptions();
      this.renderCalendar();
    } catch (error) {
      console.error('Error loading student data:', error);
    }
  }

  loadAttendanceData() {
    try {
      // Get subjects for student's current class (branch, year, semester, section)
      // Subjects now have branch, year, semester, type directly
      this.subjects = campusDB.getSubjectsForClass(
        this.studentData.branch, 
        this.studentData.year, 
        this.studentData.semester, 
        this.studentData.section,
        true // Only active subjects
      );

      // Get attendance records for this student
      this.attendance = campusDB.getAttendance(this.studentData.id);

      this.calculateOverallStats();
      this.renderSubjectAttendance();
      this.renderRecentAttendance();
      this.renderWeeklyTrend();
      this.renderAttendanceInsights();
      this.checkAttendanceAlert();
    } catch (error) {
      console.error('Error loading attendance data:', error);
    }
  }

  calculateOverallStats() {
    const totalClasses = this.attendance.length;
    const classesPresent = this.attendance.filter(a => a.status === 'present').length;
    const classesAbsent = this.attendance.filter(a => a.status === 'absent').length;
    const overallAttendance = totalClasses > 0 ? Math.round((classesPresent / totalClasses) * 100) : 0;

    document.getElementById('overallAttendance').textContent = `${overallAttendance}%`;
    document.getElementById('totalClasses').textContent = totalClasses;
    document.getElementById('classesPresent').textContent = classesPresent;
    document.getElementById('classesAbsent').textContent = classesAbsent;

    // Update card colors based on attendance
    const overallCard = document.getElementById('overallAttendance').closest('.stat-card');
    if (overallAttendance >= 75) {
      overallCard.className = 'stat-card success';
    } else if (overallAttendance >= 60) {
      overallCard.className = 'stat-card warning';
    } else {
      overallCard.className = 'stat-card error';
    }
  }

  renderSubjectAttendance() {
    const tbody = document.getElementById('subjectAttendanceBody');
    
    if (this.subjects.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center">No subjects found</td></tr>';
      return;
    }

    tbody.innerHTML = this.subjects.map(subject => {
      const subjectAttendance = this.attendance.filter(a => a.subject_id === subject.id);
      const totalClasses = subjectAttendance.length;
      const present = subjectAttendance.filter(a => a.status === 'present').length;
      const absent = subjectAttendance.filter(a => a.status === 'absent').length;
      const percentage = totalClasses > 0 ? Math.round((present / totalClasses) * 100) : 0;

      // Calculate required classes to reach 75%
      const requiredClasses = this.calculateRequiredClasses(present, absent);

      return `
        <tr>
          <td><strong>${subject.name}</strong></td>
          <td>${subject.code}</td>
          <td>${totalClasses}</td>
          <td>${present}</td>
          <td>${absent}</td>
          <td>
            <span class="badge ${percentage >= 75 ? 'badge-success' : percentage >= 60 ? 'badge-warning' : 'badge-error'}">
              ${percentage}%
            </span>
          </td>
          <td>
            <span class="badge ${percentage >= 75 ? 'badge-success' : percentage >= 60 ? 'badge-warning' : 'badge-error'}">
              ${percentage >= 75 ? 'Good' : percentage >= 60 ? 'Average' : 'Poor'}
            </span>
          </td>
          <td>
            ${requiredClasses > 0 ? 
              `<span class="badge badge-warning">${requiredClasses} more</span>` : 
              `<span class="badge badge-success">Target met</span>`
            }
          </td>
        </tr>
      `;
    }).join('');
  }

  calculateRequiredClasses(present, absent) {
    const total = present + absent;
    if (total === 0) return 0;

    const currentPercentage = (present / total) * 100;
    if (currentPercentage >= 75) return 0;

    // Calculate how many consecutive classes needed to reach 75%
    let requiredClasses = 0;
    let tempPresent = present;
    let tempTotal = total;

    while ((tempPresent / tempTotal) * 100 < 75) {
      tempPresent++;
      tempTotal++;
      requiredClasses++;
    }

    return requiredClasses;
  }

  renderCalendar() {
    const year = this.currentCalendarDate.getFullYear();
    const month = this.currentCalendarDate.getMonth();
    
    document.getElementById('currentMonth').textContent = 
      this.currentCalendarDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const calendarGrid = document.getElementById('calendarGrid');
    
    let calendarHTML = '<div class="calendar-header" style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; margin-bottom: 10px;">';
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(day => {
      calendarHTML += `<div style="text-align: center; font-weight: 600; padding: 8px; background: var(--gray-100);">${day}</div>`;
    });
    calendarHTML += '</div>';

    calendarHTML += '<div class="calendar-days" style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px;">';

    // Empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      calendarHTML += '<div class="calendar-day empty" style="padding: 8px; min-height: 40px;"></div>';
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayAttendance = this.attendance.filter(a => a.date === dateString);
      
      let dayClass = 'calendar-day';
      let bgColor = 'var(--gray-50)';
      let title = `${day}`;

      if (dayAttendance.length > 0) {
        const presentCount = dayAttendance.filter(a => a.status === 'present').length;
        const absentCount = dayAttendance.filter(a => a.status === 'absent').length;
        
        if (absentCount > 0) {
          bgColor = 'var(--error)';
          dayClass += ' absent';
          title = `${day} - ${absentCount} absent, ${presentCount} present`;
        } else if (presentCount > 0) {
          bgColor = 'var(--success)';
          dayClass += ' present';
          title = `${day} - All ${presentCount} classes attended`;
        }
      }

      calendarHTML += `
        <div class="${dayClass}" 
             style="padding: 8px; min-height: 40px; background: ${bgColor}; text-align: center; cursor: pointer; border-radius: 4px; color: ${bgColor === 'var(--error)' || bgColor === 'var(--success)' ? 'white' : 'var(--gray-800)'};"
             title="${title}"
             onclick="showDayDetails('${dateString}')">
          ${day}
        </div>
      `;
    }

    calendarHTML += '</div>';
    calendarGrid.innerHTML = calendarHTML;
  }

  renderRecentAttendance() {
    const tbody = document.getElementById('recentAttendanceBody');
    
    // Get recent attendance records (last 10)
    const recentAttendance = [...this.attendance]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 10);

    if (recentAttendance.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center">No attendance records found</td></tr>';
      return;
    }

    tbody.innerHTML = recentAttendance.map(record => {
      const subject = this.subjects.find(s => s.id === record.subject_id); // Subject now has branch, year, semester, type
      const faculty = campusDB.getStorageData('faculty').find(f => f.id === record.marked_by); // Use marked_by from attendance record

      return `
        <tr>
          <td>${new Date(record.date).toLocaleDateString()}</td>
          <td>${subject ? subject.name : 'Unknown Subject'}</td>
          <td>
            <span class="badge ${record.status === 'present' ? 'badge-success' : 'badge-error'}">
              ${record.status === 'present' ? 'Present' : 'Absent'}
            </span>
          </td>
          <td>${record.reason || '-'}</td>
          <td>${faculty ? faculty.name : 'Unknown Faculty'}</td>
        </tr>
      `;
    }).join('');
  }

  renderWeeklyTrend() {
    const weeklyData = this.calculateWeeklyTrend();
    const container = document.getElementById('weeklyChart');
    
    if (weeklyData.length === 0) {
      container.innerHTML = '<p style="text-align: center; color: var(--gray-500); padding: 20px;">No data available for weekly trend</p>';
      return;
    }

    container.innerHTML = weeklyData.map(week => `
      <div style="margin-bottom: 15px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
          <span style="font-size: 0.9rem; font-weight: 500;">${week.week}</span>
          <span style="font-size: 0.9rem; color: var(--gray-600);"></span>
        </div>
        <div style="background: var(--gray-200); height: 8px; border-radius: 4px; overflow: hidden;">
          <div style="background: ${week.percentage >= 75 ? 'var(--success)' : week.percentage >= 60 ? 'var(--warning)' : 'var(--error)'}; height: 100%; width: ${week.percentage}%; transition: width 0.3s ease;"></div>
        </div>
        <div style="font-size: 0.8rem; color: var(--gray-500); margin-top: 2px;">
          ${week.present}/${week.total} classes attended
        </div>
      </div>
    `).join('');
  }

  calculateWeeklyTrend() {
    const weeklyData = [];
    const now = new Date();
    
    // Calculate for last 4 weeks
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - (i * 7 + 7));
      weekStart.setHours(0, 0, 0, 0);
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      const weekAttendance = this.attendance.filter(a => {
        const attendanceDate = new Date(a.date);
        return attendanceDate >= weekStart && attendanceDate <= weekEnd;
      });

      if (weekAttendance.length > 0) {
        const present = weekAttendance.filter(a => a.status === 'present').length;
        const total = weekAttendance.length;
        const percentage = Math.round((present / total) * 100); // Rounded
        weeklyData.push({
          week: `Week of ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
          present: present,
          total: total,
          percentage: percentage
        });
      }
    }

    return weeklyData;
  }

  renderAttendanceInsights() {
    const container = document.getElementById('attendanceInsights');
    const insights = this.generateInsights();
    
    container.innerHTML = insights.map(insight => `
      <div style="padding: 12px; margin-bottom: 10px; background: var(--gray-50); border-left: 4px solid ${insight.color}; border-radius: 4px;">
        <div style="font-weight: 600; color: var(--gray-800); margin-bottom: 5px;">
          ${insight.icon} ${insight.title}
        </div>
        <div style="font-size: 0.9rem; color: var(--gray-600);">
          ${insight.description}
        </div>
      </div>
    `).join('');
  }

  generateInsights() {
    const insights = [];
    const totalClasses = this.attendance.length;
    const present = this.attendance.filter(a => a.status === 'present').length;
    const overallPercentage = totalClasses > 0 ? Math.round((present / totalClasses) * 100) : 0; // Rounded

    // Overall performance insight
    if (overallPercentage >= 90) {
      insights.push({
        icon: '🎉',
        title: 'Excellent Attendance!',
        description: 'Your attendance is outstanding. Keep up the great work!',
        color: 'var(--success)'
      });
    } else if (overallPercentage >= 75) {
      insights.push({
        icon: '👍',
        title: 'Good Attendance',
        description: 'Your attendance meets the requirement. Try to maintain this level.',
        color: 'var(--success)'
      });
    } else if (overallPercentage >= 60) {
      insights.push({
        icon: '⚠️',
        title: 'Attention Needed',
        description: 'Your attendance is below the recommended 75%. Consider attending more classes.',
        color: 'var(--warning)'
      });
    } else {
      insights.push({
        icon: '🚨',
        title: 'Critical Alert',
        description: 'Your attendance is critically low. Immediate improvement is required to avoid academic consequences.',
        color: 'var(--error)'
      });
    }

    // Subject-specific insights
    const poorSubjects = this.subjects.filter(subject => {
      const subjectAttendance = this.attendance.filter(a => a.subject_id === subject.id);
      const subjectTotal = subjectAttendance.length;
      const subjectPresent = subjectAttendance.filter(a => a.status === 'present').length;
      const subjectPercentage = subjectTotal > 0 ? Math.round((subjectPresent / subjectTotal) * 100) : 100; // Rounded
      return subjectPercentage < 75;
    });

    if (poorSubjects.length > 0) {
      insights.push({
        icon: '📚',
        title: 'Focus Areas',
        description: `Subjects needing attention: ${poorSubjects.map(s => s.name).join(', ')}`,
        color: 'var(--warning)'
      });
    }

    // Recent trend insight
    const recentAttendance = this.attendance
      .filter(a => new Date(a.date) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
      .length;

    if (recentAttendance === 0) {
      insights.push({
        icon: '🗓️',
        title: 'No Recent Classes',
        description: 'No classes recorded in the past week.',
        color: 'var(--secondary)'
      });
    }

    return insights;
  }

  checkAttendanceAlert() {
    const totalClasses = this.attendance.length;
    const present = this.attendance.filter(a => a.status === 'present').length;
    const overallPercentage = totalClasses > 0 ? Math.round((present / totalClasses) * 100) : 0; // Rounded

    const alertContainer = document.getElementById('attendanceAlert');
    
    if (overallPercentage < 75 && totalClasses > 0) {
      alertContainer.innerHTML = `
        <div class="alert alert-warning">
          <strong>⚠️ Attendance Alert!</strong><br>
          Your overall attendance is ${overallPercentage}%, which is below the required 75%. 
          You need to attend ${this.calculateRequiredClasses(present, totalClasses - present)} more consecutive classes to meet the requirement.
        </div>
      `;
      alertContainer.style.display = 'block';
    } else {
      alertContainer.style.display = 'none';
    }
  }

  generateMonthOptions() {
    const monthFilter = document.getElementById('monthFilter');
    const currentDate = new Date();
    
    // Generate last 6 months
    for (let i = 0; i < 6; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const monthValue = date.toISOString().slice(0, 7); // YYYY-MM format
      const monthText = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      
      const option = document.createElement('option');
      option.value = monthValue;
      option.textContent = monthText;
      monthFilter.appendChild(option);
    }
  }

  changeMonth(direction) {
    this.currentCalendarDate.setMonth(this.currentCalendarDate.getMonth() + direction);
    this.renderCalendar();
  }

  // Removed exportAttendance() method as per user request.

  showAlert(message, type) {
    // Remove existing alerts
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

// Global functions
function showDayDetails(dateString) {
  // This function would typically open a modal or navigate to a page
  // showing detailed attendance for the selected date.
  // For now, we'll just show an alert.
  alert(`Details for ${new Date(dateString).toLocaleDateString()}:\n\n(Implementation for detailed view goes here)`);
}

// Initialize when DOM is loaded
let studentAttendance;
document.addEventListener('DOMContentLoaded', () => {
  studentAttendance = new StudentAttendance();
});