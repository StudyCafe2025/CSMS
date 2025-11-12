from app import db
from models import (User, Student, Faculty, Department, Subject, ClassOffering,
                    Attendance, Mark, Announcement, Fee, Resource, Assignment, Timetable, Alteration)
from datetime import datetime, date

def initialize_database():
    """Initialize database with sample data"""
    print("Initializing database with sample data...")
    
    # Create users
    users_data = [
        {'username': 'admin', 'email': 'admin@campusiq.com', 'password': 'admin123', 'role': 'admin', 'name': 'System Administrator'},
        {'username': 'faculty', 'email': 'faculty@campusiq.com', 'password': 'faculty123', 'role': 'faculty', 'name': 'Dr. John Smith'},
        {'username': 'student', 'email': 'student@campusiq.com', 'password': 'student123', 'role': 'student', 'name': 'Alice Johnson'},
        {'username': 'bob.wilson', 'email': 'bob.wilson@student.campusiq.com', 'password': 'student123', 'role': 'student', 'name': 'Bob Wilson'},
        {'username': 'charlie.davis', 'email': 'charlie.davis@student.campusiq.com', 'password': 'student123', 'role': 'student', 'name': 'Charlie Davis'},
        {'username': 'dr.sarah', 'email': 'sarah.brown@campusiq.com', 'password': 'faculty123', 'role': 'faculty', 'name': 'Dr. Sarah Brown'},
        {'username': 'prof.olivia', 'email': 'olivia.king@campusiq.com', 'password': 'faculty123', 'role': 'faculty', 'name': 'Prof. Olivia King'},
        {'username': 'diana.prince', 'email': 'diana.prince@student.campusiq.com', 'password': 'student123', 'role': 'student', 'name': 'Diana Prince'},
        {'username': 'steve.rogers', 'email': 'steve.rogers@student.campusiq.com', 'password': 'student123', 'role': 'student', 'name': 'Steve Rogers'},
        {'username': 'peter.parker', 'email': 'peter.parker@student.campusiq.com', 'password': 'student123', 'role': 'student', 'name': 'Peter Parker'},
        {'username': 'ashok.kumar', 'email': 'ashok.kumar@campusiq.com', 'password': 'faculty123', 'role': 'faculty', 'name': 'Ashok Kumar'},
    ]
    
    users = []
    for user_data in users_data:
        user = User(
            username=user_data['username'],
            email=user_data['email'],
            role=user_data['role'],
            name=user_data['name']
        )
        user.set_password(user_data['password'])
        users.append(user)
        db.session.add(user)
    
    db.session.commit()
    print(f"Created {len(users)} users")
    
    # Create departments
    departments_data = [
        {'name': 'Civil Engineering', 'code': 'CE', 'head_of_department': 'Dr. Sarah Brown'},
        {'name': 'Mechanical Engineering', 'code': 'ME', 'head_of_department': 'Dr. Alex Lee'},
        {'name': 'Computer Science & Engineering', 'code': 'CSE', 'head_of_department': 'Dr. John Smith'},
        {'name': 'Electrical & Electronics Engineering', 'code': 'EEE', 'head_of_department': 'Dr. Emily White'},
        {'name': 'Computer Science & Engineering (Data Science)', 'code': 'CSD', 'head_of_department': 'Dr. Jane Green'},
        {'name': 'Electronics & Communication Engineering', 'code': 'ECE', 'head_of_department': 'Dr. Robert Black'},
        {'name': 'Artificial Intelligence & Data Science', 'code': 'AID', 'head_of_department': 'Prof. Olivia King'},
        {'name': 'Artificial Intelligence & Machine Learning', 'code': 'AIM', 'head_of_department': 'Dr. David Chen'},
        {'name': 'Computer Science & Engineering (Artificial Intelligence)', 'code': 'CSA', 'head_of_department': 'Dr. Sophia Lee'},
    ]
    
    for dept_data in departments_data:
        dept = Department(**dept_data)
        db.session.add(dept)
    
    db.session.commit()
    print(f"Created {len(departments_data)} departments")
    
    # Create faculty
    faculty_data = [
        {'user_id': 2, 'faculty_id': 'FAC001', 'name': 'Dr. John Smith', 'email': 'faculty@campusiq.com', 
         'department': 'Computer Science & Engineering', 'designation': 'Professor', 'phone': '9876543220', 
         'qualification': 'PhD in Computer Science', 'experience': 15},
        {'user_id': 6, 'faculty_id': 'FAC002', 'name': 'Dr. Sarah Brown', 'email': 'sarah.brown@campusiq.com', 
         'department': 'Civil Engineering', 'designation': 'Associate Professor', 'phone': '9876543221', 
         'qualification': 'PhD in Civil Engineering', 'experience': 10},
        {'user_id': 7, 'faculty_id': 'FAC003', 'name': 'Prof. Olivia King', 'email': 'olivia.king@campusiq.com', 
         'department': 'Artificial Intelligence & Data Science', 'designation': 'Professor', 'phone': '9876543222', 
         'qualification': 'PhD in AI', 'experience': 12},
        {'user_id': 1, 'faculty_id': 'FAC004', 'name': 'Dr. Robert Green', 'email': 'robert.green@campusiq.com', 
         'department': 'Mechanical Engineering', 'designation': 'Assistant Professor', 'phone': '9876543223', 
         'qualification': 'M.Tech in Mechanical Engineering', 'experience': 5},
        {'user_id': 11, 'faculty_id': 'FAC005', 'name': 'Ashok Kumar', 'email': 'ashok.kumar@campusiq.com', 
         'department': 'Computer Science & Engineering', 'designation': 'Assistant Professor', 'phone': '9876543224', 
         'qualification': 'M.Tech in CSE', 'experience': 8},
    ]
    
    for fac_data in faculty_data:
        fac = Faculty(**fac_data)
        db.session.add(fac)
    
    db.session.commit()
    print(f"Created {len(faculty_data)} faculty members")
    
    # Create students
    students_data = [
        {'user_id': 3, 'student_id': 'CS2021001', 'name': 'Alice Johnson', 'email': 'student@campusiq.com',
         'branch': 'Computer Science & Engineering', 'year': 3, 'semester': 5, 'section': 'A',
         'phone': '9876543210', 'address': '123 Student Street', 'father_name': 'Robert Johnson',
         'mother_name': 'Mary Johnson', 'parents_phone': '9988776655', 'date_of_birth': date(2002, 5, 15),
         'admission_date': date(2021, 8, 1), 'status': 'active'},
        {'user_id': 4, 'student_id': 'CS2021002', 'name': 'Bob Wilson', 'email': 'bob.wilson@student.campusiq.com',
         'branch': 'Computer Science & Engineering', 'year': 3, 'semester': 5, 'section': 'B',
         'phone': '9876543211', 'address': '124 Student Street', 'father_name': 'David Wilson',
         'mother_name': 'Lisa Wilson', 'parents_phone': '9988776656', 'date_of_birth': date(2002, 3, 22),
         'admission_date': date(2021, 8, 1), 'status': 'active'},
        {'user_id': 5, 'student_id': 'CE2022001', 'name': 'Charlie Davis', 'email': 'charlie.davis@student.campusiq.com',
         'branch': 'Civil Engineering', 'year': 2, 'semester': 3, 'section': 'A',
         'phone': '9876543212', 'address': '456 Civil Road', 'father_name': 'Paul Davis',
         'mother_name': 'Nancy Davis', 'parents_phone': '9988776657', 'date_of_birth': date(2003, 11, 10),
         'admission_date': date(2022, 8, 1), 'status': 'active'},
        {'user_id': 8, 'student_id': 'AID2024001', 'name': 'Diana Prince', 'email': 'diana.prince@student.campusiq.com',
         'branch': 'Artificial Intelligence & Data Science', 'year': 1, 'semester': 1, 'section': 'A',
         'phone': '9876543213', 'address': '789 AI Street', 'father_name': 'Richard Prince',
         'mother_name': 'Hippolyta Prince', 'parents_phone': '9988776658', 'date_of_birth': date(2006, 7, 1),
         'admission_date': date(2024, 8, 1), 'status': 'active'},
        {'user_id': 9, 'student_id': 'AID2024002', 'name': 'Steve Rogers', 'email': 'steve.rogers@student.campusiq.com',
         'branch': 'Artificial Intelligence & Data Science', 'year': 1, 'semester': 1, 'section': 'A',
         'phone': '9876543214', 'address': '101 Data Lane', 'father_name': 'Joseph Rogers',
         'mother_name': 'Sarah Rogers', 'parents_phone': '9988776659', 'date_of_birth': date(2006, 4, 4),
         'admission_date': date(2024, 8, 1), 'status': 'active'},
        {'user_id': 10, 'student_id': 'ME2024001', 'name': 'Peter Parker', 'email': 'peter.parker@student.campusiq.com',
         'branch': 'Mechanical Engineering', 'year': 1, 'semester': 1, 'section': 'A',
         'phone': '9876543215', 'address': '200 Web Street', 'father_name': 'Ben Parker',
         'mother_name': 'May Parker', 'parents_phone': '9988776660', 'date_of_birth': date(2006, 8, 10),
         'admission_date': date(2024, 8, 1), 'status': 'active'},
    ]
    
    for stud_data in students_data:
        stud = Student(**stud_data)
        db.session.add(stud)
    
    db.session.commit()
    print(f"Created {len(students_data)} students")
    
    # Create subjects (sample subset)
    subjects_data = [
        {'name': 'Data Structures', 'code': 'CS301', 'credits': 4, 'branch': 'Computer Science & Engineering', 'year': 3, 'semester': 5, 'type': 'theory'},
        {'name': 'Algorithms', 'code': 'CS302', 'credits': 4, 'branch': 'Computer Science & Engineering', 'year': 3, 'semester': 5, 'type': 'theory'},
        {'name': 'Database Systems', 'code': 'CS303', 'credits': 3, 'branch': 'Computer Science & Engineering', 'year': 3, 'semester': 5, 'type': 'theory'},
        {'name': 'Data Structures Lab', 'code': 'CS301L', 'credits': 2, 'branch': 'Computer Science & Engineering', 'year': 3, 'semester': 5, 'type': 'lab'},
        {'name': 'Engineering Mechanics', 'code': 'CE201', 'credits': 3, 'branch': 'Civil Engineering', 'year': 2, 'semester': 3, 'type': 'theory'},
        {'name': 'Introduction to AI & DS', 'code': 'AID101', 'credits': 4, 'branch': 'Artificial Intelligence & Data Science', 'year': 1, 'semester': 1, 'type': 'theory'},
        {'name': 'Mathematics for AI', 'code': 'AID102', 'credits': 4, 'branch': 'Artificial Intelligence & Data Science', 'year': 1, 'semester': 1, 'type': 'theory'},
        {'name': 'Engineering Graphics', 'code': 'EG101', 'credits': 3, 'branch': 'Mechanical Engineering', 'year': 1, 'semester': 1, 'type': 'theory'},
    ]
    
    for subj_data in subjects_data:
        subj = Subject(**subj_data)
        db.session.add(subj)
    
    db.session.commit()
    print(f"Created {len(subjects_data)} subjects")
    
    # Create class offerings
    class_offerings_data = [
        {'subject_id': 1, 'branch': 'Computer Science & Engineering', 'year': 3, 'semester': 5, 'section': 'A', 'subject_type': 'theory', 'faculty_id': 1, 'is_active': True, 'is_cleared': False},
        {'subject_id': 2, 'branch': 'Computer Science & Engineering', 'year': 3, 'semester': 5, 'section': 'A', 'subject_type': 'theory', 'faculty_id': 1, 'is_active': True, 'is_cleared': False},
        {'subject_id': 3, 'branch': 'Computer Science & Engineering', 'year': 3, 'semester': 5, 'section': 'B', 'subject_type': 'theory', 'faculty_id': 1, 'is_active': True, 'is_cleared': False},
        {'subject_id': 4, 'branch': 'Computer Science & Engineering', 'year': 3, 'semester': 5, 'section': 'A', 'subject_type': 'lab', 'faculty_id': 1, 'is_active': True, 'is_cleared': False},
        {'subject_id': 5, 'branch': 'Civil Engineering', 'year': 2, 'semester': 3, 'section': 'A', 'subject_type': 'theory', 'faculty_id': 2, 'is_active': True, 'is_cleared': False},
        {'subject_id': 6, 'branch': 'Artificial Intelligence & Data Science', 'year': 1, 'semester': 1, 'section': 'A', 'subject_type': 'theory', 'faculty_id': 3, 'is_active': True, 'is_cleared': False},
        {'subject_id': 7, 'branch': 'Artificial Intelligence & Data Science', 'year': 1, 'semester': 1, 'section': 'A', 'subject_type': 'theory', 'faculty_id': 3, 'is_active': True, 'is_cleared': False},
        {'subject_id': 8, 'branch': 'Mechanical Engineering', 'year': 1, 'semester': 1, 'section': 'A', 'subject_type': 'theory', 'faculty_id': 4, 'is_active': True, 'is_cleared': False},
    ]
    
    for co_data in class_offerings_data:
        co = ClassOffering(**co_data)
        db.session.add(co)
    
    db.session.commit()
    print(f"Created {len(class_offerings_data)} class offerings")
    
    # Create sample announcements
    announcements_data = [
        {'title': 'Welcome to New Semester', 'content': 'Welcome all students and faculty to the new academic semester. Please check your schedules and prepare accordingly.',
         'target_audience': 'all', 'created_by': 1, 'created_by_name': 'System Administrator', 'is_active': True, 'is_pinned': True, 'priority': 'high'},
        {'title': 'Mid-Term Exam Schedule Released', 'content': 'The schedule for mid-term examinations has been released. Students are advised to check the academic calendar for details.',
         'target_audience': 'student', 'created_by': 1, 'created_by_name': 'System Administrator', 'is_active': True, 'is_pinned': False, 'priority': 'normal'},
    ]
    
    for ann_data in announcements_data:
        ann = Announcement(**ann_data)
        db.session.add(ann)
    
    db.session.commit()
    print(f"Created {len(announcements_data)} announcements")
    
    # Create sample fees
    fees_data = [
        {'student_id': 1, 'semester': 5, 'tuition_fee': 50000, 'development_fee': 5000, 'examination_fee': 2000,
         'total_fee': 57000, 'paid_amount': 57000, 'due_amount': 0, 'payment_date': date(2024, 1, 10), 'status': 'paid'},
        {'student_id': 3, 'semester': 3, 'tuition_fee': 45000, 'development_fee': 4000, 'examination_fee': 1500,
         'total_fee': 50500, 'paid_amount': 40000, 'due_amount': 10500, 'payment_date': date(2024, 1, 10), 'status': 'partially_paid'},
    ]
    
    for fee_data in fees_data:
        fee = Fee(**fee_data)
        db.session.add(fee)
    
    db.session.commit()
    print(f"Created {len(fees_data)} fee records")
    
    print("Database initialization complete!")
