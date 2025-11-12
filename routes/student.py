from flask import Blueprint, render_template, request, redirect, url_for, flash, session
from models import Student, Subject, ClassOffering, Attendance, Mark, Announcement, Fee
from app import db
from routes.auth import role_required
from sqlalchemy import func
from datetime import datetime

student_bp = Blueprint('student', __name__)

@student_bp.route('/dashboard')
@role_required('student')
def dashboard():
    """Student dashboard"""
    # Get student record
    student = Student.query.filter_by(user_id=session['user_id']).first()
    
    if not student:
        flash('Student profile not found', 'error')
        return redirect(url_for('auth.logout'))
    
    # Get enrolled subjects
    class_offerings = ClassOffering.query.filter_by(
        branch=student.branch,
        year=student.year,
        semester=student.semester,
        section=student.section,
        is_active=True
    ).all()
    
    # Calculate attendance percentage for each subject
    subjects_data = []
    for offering in class_offerings:
        subject = offering.subject
        
        # Get total classes and attended classes
        total_classes = Attendance.query.filter_by(
            student_id=student.id,
            subject_id=subject.id
        ).count()
        
        attended_classes = Attendance.query.filter_by(
            student_id=student.id,
            subject_id=subject.id,
            status='present'
        ).count()
        
        attendance_percentage = (attended_classes / total_classes * 100) if total_classes > 0 else 0
        
        subjects_data.append({
            'subject': subject,
            'total_classes': total_classes,
            'attended_classes': attended_classes,
            'attendance_percentage': round(attendance_percentage, 2)
        })
    
    # Calculate overall attendance
    total_all = sum(s['total_classes'] for s in subjects_data)
    attended_all = sum(s['attended_classes'] for s in subjects_data)
    overall_attendance = (attended_all / total_all * 100) if total_all > 0 else 0
    
    # Get recent announcements
    announcements = Announcement.query.filter(
        (Announcement.target_audience == 'all') |
        (Announcement.target_audience == 'student')
    ).filter_by(is_active=True).order_by(
        Announcement.is_pinned.desc(),
        Announcement.created_at.desc()
    ).limit(5).all()
    
    # Get fee status
    fee = Fee.query.filter_by(
        student_id=student.id,
        semester=student.semester
    ).first()
    
    return render_template('student/dashboard.html',
                         student=student,
                         subjects_data=subjects_data,
                         overall_attendance=round(overall_attendance, 2),
                         announcements=announcements,
                         fee=fee)

@student_bp.route('/attendance')
@role_required('student')
def attendance():
    """View detailed attendance"""
    student = Student.query.filter_by(user_id=session['user_id']).first()
    
    # Get enrolled subjects
    class_offerings = ClassOffering.query.filter_by(
        branch=student.branch,
        year=student.year,
        semester=student.semester,
        section=student.section,
        is_active=True
    ).all()
    
    # Get attendance details for each subject
    attendance_data = []
    for offering in class_offerings:
        subject = offering.subject
        
        # Get all attendance records
        attendance_records = Attendance.query.filter_by(
            student_id=student.id,
            subject_id=subject.id
        ).order_by(Attendance.date.desc()).all()
        
        total_classes = len(attendance_records)
        attended_classes = sum(1 for a in attendance_records if a.status == 'present')
        absent_classes = sum(1 for a in attendance_records if a.status == 'absent')
        
        attendance_percentage = (attended_classes / total_classes * 100) if total_classes > 0 else 0
        
        # Check for shortage (below 75%)
        has_shortage = attendance_percentage < 75
        
        attendance_data.append({
            'subject': subject,
            'total_classes': total_classes,
            'attended_classes': attended_classes,
            'absent_classes': absent_classes,
            'attendance_percentage': round(attendance_percentage, 2),
            'has_shortage': has_shortage,
            'records': attendance_records[:10]  # Show last 10 records
        })
    
    return render_template('student/attendance.html',
                         student=student,
                         attendance_data=attendance_data)

@student_bp.route('/marks')
@role_required('student')
def marks():
    """View marks and grades"""
    student = Student.query.filter_by(user_id=session['user_id']).first()
    
    # Get enrolled subjects
    class_offerings = ClassOffering.query.filter_by(
        branch=student.branch,
        year=student.year,
        semester=student.semester,
        section=student.section,
        is_active=True
    ).all()
    
    # Get marks for each subject
    marks_data = []
    for offering in class_offerings:
        subject = offering.subject
        
        # Get all marks records
        marks_records = Mark.query.filter_by(
            student_id=student.id,
            subject_id=subject.id
        ).order_by(Mark.date.desc()).all()
        
        # Group by assessment type
        marks_by_type = {}
        for mark in marks_records:
            if mark.assessment_type not in marks_by_type:
                marks_by_type[mark.assessment_type] = []
            marks_by_type[mark.assessment_type].append(mark)
        
        # Calculate total marks
        total_obtained = sum(m.marks for m in marks_records)
        total_max = sum(m.max_marks for m in marks_records)
        percentage = (total_obtained / total_max * 100) if total_max > 0 else 0
        
        marks_data.append({
            'subject': subject,
            'marks_by_type': marks_by_type,
            'total_obtained': round(total_obtained, 2),
            'total_max': round(total_max, 2),
            'percentage': round(percentage, 2)
        })
    
    return render_template('student/marks.html',
                         student=student,
                         marks_data=marks_data)

@student_bp.route('/profile', methods=['GET', 'POST'])
@role_required('student')
def profile():
    """View and edit student profile"""
    student = Student.query.filter_by(user_id=session['user_id']).first()
    
    if request.method == 'POST':
        try:
            # Update editable fields
            student.phone = request.form.get('phone', '')
            student.address = request.form.get('address', '')
            student.parents_phone = request.form.get('parents_phone', '')
            
            # Update user email if changed
            if request.form.get('email') != student.email:
                student.email = request.form['email']
                student.user.email = request.form['email']
            
            db.session.commit()
            flash('Profile updated successfully', 'success')
        except Exception as e:
            db.session.rollback()
            flash(f'Error updating profile: {str(e)}', 'error')
    
    return render_template('student/profile.html', student=student)

@student_bp.route('/timetable')
@role_required('student')
def timetable():
    """View class timetable"""
    student = Student.query.filter_by(user_id=session['user_id']).first()
    
    from models import Timetable
    
    # Get timetable for student's class
    timetable_entries = Timetable.query.filter_by(
        branch=student.branch,
        year=student.year,
        semester=student.semester,
        section=student.section
    ).order_by(Timetable.day_of_week, Timetable.start_time).all()
    
    # Organize by day
    days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    timetable_by_day = {day: [] for day in days}
    
    for entry in timetable_entries:
        if entry.day_of_week in timetable_by_day:
            timetable_by_day[entry.day_of_week].append(entry)
    
    return render_template('student/timetable.html',
                         student=student,
                         timetable_by_day=timetable_by_day,
                         days=days)
