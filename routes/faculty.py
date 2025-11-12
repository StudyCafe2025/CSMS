from flask import Blueprint, render_template, request, redirect, url_for, flash, session
from models import Faculty, Student, Subject, ClassOffering, Attendance, Mark, Announcement
from app import db
from routes.auth import role_required
from datetime import datetime, date
from sqlalchemy import func

faculty_bp = Blueprint('faculty', __name__)

@faculty_bp.route('/dashboard')
@role_required('faculty')
def dashboard():
    """Faculty dashboard"""
    # Get faculty record
    faculty = Faculty.query.filter_by(user_id=session['user_id']).first()
    
    if not faculty:
        flash('Faculty profile not found', 'error')
        return redirect(url_for('auth.logout'))
    
    # Get assigned subjects
    class_offerings = ClassOffering.query.filter_by(
        faculty_id=faculty.id,
        is_active=True
    ).all()
    
    # Get subjects with student counts
    subjects_data = []
    for offering in class_offerings:
        subject = offering.subject
        student_count = Student.query.filter_by(
            branch=offering.branch,
            year=offering.year,
            semester=offering.semester,
            section=offering.section,
            status='active'
        ).count()
        
        subjects_data.append({
            'offering': offering,
            'subject': subject,
            'student_count': student_count
        })
    
    # Get recent announcements
    announcements = Announcement.query.filter(
        (Announcement.target_audience == 'all') |
        (Announcement.target_audience == 'faculty')
    ).filter_by(is_active=True).order_by(
        Announcement.is_pinned.desc(),
        Announcement.created_at.desc()
    ).limit(5).all()
    
    return render_template('faculty/dashboard.html',
                         faculty=faculty,
                         subjects_data=subjects_data,
                         announcements=announcements)

@faculty_bp.route('/attendance')
@role_required('faculty')
def attendance():
    """View and mark attendance"""
    faculty = Faculty.query.filter_by(user_id=session['user_id']).first()
    
    # Get assigned subjects
    class_offerings = ClassOffering.query.filter_by(
        faculty_id=faculty.id,
        is_active=True
    ).all()
    
    return render_template('faculty/attendance.html',
                         faculty=faculty,
                         class_offerings=class_offerings)

@faculty_bp.route('/attendance/mark', methods=['GET', 'POST'])
@role_required('faculty')
def mark_attendance():
    """Mark attendance for a class"""
    faculty = Faculty.query.filter_by(user_id=session['user_id']).first()
    
    if request.method == 'POST':
        try:
            subject_id = int(request.form['subject_id'])
            branch = request.form['branch']
            year = int(request.form['year'])
            semester = int(request.form['semester'])
            section = request.form['section']
            attendance_date = datetime.strptime(request.form['date'], '%Y-%m-%d').date()
            class_time = request.form['class_time']
            
            # Get students for this class
            students = Student.query.filter_by(
                branch=branch,
                year=year,
                semester=semester,
                section=section,
                status='active'
            ).all()
            
            # Mark attendance for each student
            for student in students:
                status = request.form.get(f'attendance_{student.id}', 'absent')
                
                # Check if attendance already exists
                existing = Attendance.query.filter_by(
                    student_id=student.id,
                    subject_id=subject_id,
                    date=attendance_date,
                    class_time=class_time
                ).first()
                
                if existing:
                    existing.status = status
                else:
                    attendance = Attendance(
                        student_id=student.id,
                        subject_id=subject_id,
                        date=attendance_date,
                        class_time=class_time,
                        status=status,
                        marked_by=faculty.id
                    )
                    db.session.add(attendance)
            
            db.session.commit()
            flash('Attendance marked successfully', 'success')
            return redirect(url_for('faculty.attendance'))
        except Exception as e:
            db.session.rollback()
            flash(f'Error marking attendance: {str(e)}', 'error')
    
    # GET request - show form
    offering_id = request.args.get('offering_id')
    if offering_id:
        offering = ClassOffering.query.get_or_404(offering_id)
        
        # Get students for this class
        students = Student.query.filter_by(
            branch=offering.branch,
            year=offering.year,
            semester=offering.semester,
            section=offering.section,
            status='active'
        ).order_by(Student.student_id).all()
        
        return render_template('faculty/mark_attendance.html',
                             offering=offering,
                             students=students,
                             today=date.today())
    
    return redirect(url_for('faculty.attendance'))

@faculty_bp.route('/marks')
@role_required('faculty')
def marks():
    """View and enter marks"""
    faculty = Faculty.query.filter_by(user_id=session['user_id']).first()
    
    # Get assigned subjects
    class_offerings = ClassOffering.query.filter_by(
        faculty_id=faculty.id,
        is_active=True
    ).all()
    
    return render_template('faculty/marks.html',
                         faculty=faculty,
                         class_offerings=class_offerings)

@faculty_bp.route('/marks/enter', methods=['GET', 'POST'])
@role_required('faculty')
def enter_marks():
    """Enter marks for students"""
    faculty = Faculty.query.filter_by(user_id=session['user_id']).first()
    
    if request.method == 'POST':
        try:
            subject_id = int(request.form['subject_id'])
            branch = request.form['branch']
            year = int(request.form['year'])
            semester = int(request.form['semester'])
            section = request.form['section']
            assessment_type = request.form['assessment_type']
            max_marks = float(request.form['max_marks'])
            marks_date = datetime.strptime(request.form['date'], '%Y-%m-%d').date()
            assignment_number = request.form.get('assignment_number')
            
            # Get students for this class
            students = Student.query.filter_by(
                branch=branch,
                year=year,
                semester=semester,
                section=section,
                status='active'
            ).all()
            
            # Enter marks for each student
            for student in students:
                marks_value = request.form.get(f'marks_{student.id}')
                if marks_value:
                    mark = Mark(
                        student_id=student.id,
                        subject_id=subject_id,
                        assessment_type=assessment_type,
                        assignment_number=int(assignment_number) if assignment_number else None,
                        marks=float(marks_value),
                        max_marks=max_marks,
                        date=marks_date,
                        entered_by=faculty.id
                    )
                    db.session.add(mark)
            
            db.session.commit()
            flash('Marks entered successfully', 'success')
            return redirect(url_for('faculty.marks'))
        except Exception as e:
            db.session.rollback()
            flash(f'Error entering marks: {str(e)}', 'error')
    
    # GET request - show form
    offering_id = request.args.get('offering_id')
    if offering_id:
        offering = ClassOffering.query.get_or_404(offering_id)
        
        # Get students for this class
        students = Student.query.filter_by(
            branch=offering.branch,
            year=offering.year,
            semester=offering.semester,
            section=offering.section,
            status='active'
        ).order_by(Student.student_id).all()
        
        return render_template('faculty/enter_marks.html',
                             offering=offering,
                             students=students,
                             today=date.today())
    
    return redirect(url_for('faculty.marks'))

@faculty_bp.route('/students')
@role_required('faculty')
def students():
    """View students in assigned classes"""
    faculty = Faculty.query.filter_by(user_id=session['user_id']).first()
    
    # Get assigned subjects
    class_offerings = ClassOffering.query.filter_by(
        faculty_id=faculty.id,
        is_active=True
    ).all()
    
    # Get all students from assigned classes
    students_list = []
    for offering in class_offerings:
        students = Student.query.filter_by(
            branch=offering.branch,
            year=offering.year,
            semester=offering.semester,
            section=offering.section,
            status='active'
        ).all()
        
        for student in students:
            if student not in students_list:
                students_list.append(student)
    
    return render_template('faculty/students.html',
                         faculty=faculty,
                         students=students_list)

@faculty_bp.route('/profile', methods=['GET', 'POST'])
@role_required('faculty')
def profile():
    """View and edit faculty profile"""
    faculty = Faculty.query.filter_by(user_id=session['user_id']).first()
    
    if request.method == 'POST':
        try:
            faculty.phone = request.form.get('phone', '')
            faculty.qualification = request.form.get('qualification', '')
            
            # Update user email if changed
            if request.form.get('email') != faculty.email:
                faculty.email = request.form['email']
                faculty.user.email = request.form['email']
            
            db.session.commit()
            flash('Profile updated successfully', 'success')
        except Exception as e:
            db.session.rollback()
            flash(f'Error updating profile: {str(e)}', 'error')
    
    return render_template('faculty/profile.html', faculty=faculty)
