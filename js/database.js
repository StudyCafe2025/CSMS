// SQLite Database Management using Web SQL API
class CampusDatabase {
  // Define a database version for schema management
  static DB_VERSION = 57; // Increment this version number for schema changes

  _nextId = 1000; // Initialize a counter for new IDs, starting higher than sample data

  constructor() {
    console.log('DB: CampusDatabase constructor called.');
    this.db = null;
    this.initDatabase();
  }

  initDatabase() {
    try {
      console.log('DB: initDatabase started.');
      this.db = {
        query: (sql, params, callback) => this.executeQuery(sql, params, callback)
      };
      console.log('DB: Database object (simulated) created.');
      this.createTables();
      console.log('DB: createTables completed.');
      this.insertSampleData();
      console.log('DB: insertSampleData completed.');
      console.log('DB: initDatabase completed successfully.');
    } catch (error) {
      console.error('DB: Database initialization failed:', error);
      // If initDatabase fails, ensure the database object is marked as invalid
      this.db = null; 
      throw error; // Re-throw to ensure the error is visible and potentially stops further execution
    }
  }

  executeQuery(sql, params = [], callback = null) {
    // Simulate database operations with localStorage
    try {
      const result = this.simulateQuery(sql, params);
      if (callback) callback(null, result);
      return result;
    } catch (error) {
      console.error('DB: Query execution failed:', sql, error);
      if (callback) callback(error, null);
      return null;
    }
  }

  simulateQuery(sql, params) {
    const sqlUpper = sql.toUpperCase().trim();

    if (sqlUpper.includes('CREATE TABLE')) {
      return {
        message: 'Table created successfully'
      };
    }
    if (sqlUpper.includes('INSERT INTO')) {
      const tableName = this.extractTableName(sql);
      const data = this.getStorageData(tableName);
      const newRecord = this.parseInsertData(sql, params);
      data.push(newRecord);
      localStorage.setItem(`campusiq_${tableName}`, JSON.stringify(data));
      return {
        insertId: newRecord.id,
        rowsAffected: 1
      };
    }
    if (sqlUpper.includes('SELECT')) {
      const tableName = this.extractTableName(sql);
      const data = this.getStorageData(tableName);
      return this.filterData(data, sql, params);
    }
    if (sqlUpper.includes('UPDATE')) {
      const tableName = this.extractTableName(sql);
      const data = this.getStorageData(tableName);
      const updatedData = this.updateData(data, sql, params);
      localStorage.setItem(`campusiq_${tableName}`, JSON.stringify(updatedData));
      return {
        rowsAffected: 1
      };
    }
    if (sqlUpper.includes('DELETE')) {
      const tableName = this.extractTableName(sql);
      const data = this.getStorageData(tableName);
      const filteredData = this.deleteData(data, sql, params);
      localStorage.setItem(`campusiq_${tableName}`, JSON.stringify(filteredData));
      return {
        rowsAffected: data.length - filteredData.length
      };
    }
    return {
      rows: []
    };
  }

  extractTableName(sql) {
    const matches = sql.match(/(?:FROM|INTO|UPDATE|TABLE)\s+(\w+)/i);
    return matches ? matches[1].toLowerCase() : 'unknown';
  }

  getStorageData(tableName) {
    const data = localStorage.getItem(`campusiq_${tableName}`);
    return data ? JSON.parse(data) : [];
  }

  parseInsertData(sql, params) {
    // This method is for simulating SQL INSERT, but actual `create` method is used for data objects.
    // It's kept for consistency but `create` handles ID generation.
    const id = this._nextId++; // Use the internal counter for consistency
    const record = {
      id,
      ...params
    };
    record.created_at = new Date().toISOString();
    return record;
  }

  filterData(data, sql, params) {
    // Simplified filtering - implement proper WHERE clause parsing
    if (sql.includes('WHERE')) {
      // Basic filtering logic would go here
      return {
        rows: data
      };
    }
    return {
      rows: data
    };
  }

  updateData(data, sql, params) {
    // Simplified update logic
    return data.map(record => {
      if (this.matchesWhereClause(record, sql, params)) {
        return { ...record,
          ...params,
          updated_at: new Date().toISOString()
        };
      }
      return record;
    });
  }

  deleteData(data, sql, params) {
    // Simplified delete logic
    return data.filter(record => !this.matchesWhereClause(record, sql, params));
  }

  matchesWhereClause(record, sql, params) {
    // Simplified matching - implement proper WHERE clause parsing
    return true; // Simplified for demo
  }

  createTables() {
    console.log('DB: createTables started.');
    // Create table structures in localStorage if they don't exist
    const tables = [
      'users',
      'students',
      'faculty',
      'departments',
      'subjects',
      'class_offerings', // New table
      'attendance',
      'marks',
      'assignments', // Modified table
      'announcements',
      'fees',
      'resources', // Added resources table
      // 'submissions', // REMOVED: No digital submissions
      'timetables', // NEW: Timetable table
      'alterations' // NEW: Table for date-specific timetable alterations/suspensions
    ];
    tables.forEach(table => {
      if (!localStorage.getItem(`campusiq_${table}`)) {
        localStorage.setItem(`campusiq_${table}`, JSON.stringify([]));
        console.log(`DB: Table 'campusiq_${table}' initialized in localStorage.`);
      }
    });
    console.log('DB: Tables ensured in localStorage.');
  }

  insertSampleData() {
    console.log('DB: insertSampleData started.');
    const storedVersion = parseInt(localStorage.getItem('campusiq_db_version') || '0');

    // If the stored version is older than the current version, or if sample data hasn't been loaded
    if (storedVersion < CampusDatabase.DB_VERSION) {
      console.warn(`DB: Database schema outdated (v${storedVersion}). Clearing old data and loading new sample data (v${CampusDatabase.DB_VERSION}).`);
      // Clear all existing campusiq_ data
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('campusiq_')) {
          localStorage.removeItem(key);
        }
      }
      localStorage.removeItem('campusiq_sample_loaded'); // Ensure this is also cleared
      this._nextId = 1000; // Reset _nextId when clearing data
    } else if (localStorage.getItem('campusiq_sample_loaded')) {
      // If version is up-to-date and sample data already loaded, do nothing
      // However, we need to ensure _nextId is correctly set based on existing data
      console.log('DB: Sample data already loaded and up-to-date. Initializing _nextId.');
      this.initializeNextId(); // Call this to set _nextId based on existing data
      return;
    }

    // Sample Users
    const users = [{
      id: 1,
      username: 'admin',
      email: 'admin@campusiq.com',
      password: 'admin123',
      role: 'admin',
      name: 'System Administrator',
      created_at: new Date().toISOString()
    }, {
      id: 2,
      username: 'faculty',
      email: 'faculty@campusiq.com',
      password: 'faculty123',
      role: 'faculty',
      name: 'Dr. John Smith',
      created_at: new Date().toISOString()
    }, {
      id: 3,
      username: 'student',
      email: 'student@campusiq.com',
      password: 'student123',
      role: 'student',
      name: 'Alice Johnson',
      created_at: new Date().toISOString()
    }, {
      id: 4,
      username: 'bob.wilson',
      email: 'bob.wilson@student.campusiq.com',
      password: 'student123',
      role: 'student',
      name: 'Bob Wilson',
      created_at: new Date().toISOString()
    }, {
      id: 5,
      username: 'charlie.davis',
      email: 'charlie.davis@student.campusiq.com',
      password: 'student123',
      role: 'student',
      name: 'Charlie Davis',
      created_at: new Date().toISOString()
    }, {
      id: 6,
      username: 'dr.sarah',
      email: 'sarah.brown@campusiq.com',
      password: 'faculty123',
      role: 'faculty',
      name: 'Dr. Sarah Brown',
      created_at: new Date().toISOString()
    }, { // NEW: User for AI&DS Faculty
      id: 7,
      username: 'prof.olivia',
      email: 'olivia.king@campusiq.com',
      password: 'faculty123',
      role: 'faculty',
      name: 'Prof. Olivia King',
      created_at: new Date().toISOString()
    }, { // NEW: Student for AI&DS
      id: 8,
      username: 'diana.prince',
      email: 'diana.prince@student.campusiq.com',
      password: 'student123',
      role: 'student',
      name: 'Diana Prince',
      created_at: new Date().toISOString()
    }, { // NEW: Student for AI&DS
      id: 9,
      username: 'steve.rogers',
      email: 'steve.rogers@student.campusiq.com',
      password: 'student123',
      role: 'student',
      name: 'Steve Rogers',
      created_at: new Date().toISOString()
    }, { // NEW: Student for Engineering Graphics
      id: 10,
      username: 'peter.parker',
      email: 'peter.parker@student.campusiq.com',
      password: 'student123',
      role: 'student',
      name: 'Peter Parker',
      created_at: new Date().toISOString()
    }, { // NEW: User for Ashok Kumar (FAC005)
      id: 11,
      username: 'ashok.kumar',
      email: 'ashok.kumar@campusiq.com',
      password: 'faculty123',
      role: 'faculty',
      name: 'Ashok Kumar',
      created_at: new Date().toISOString()
    }];

    // Sample Students (Restored to full content)
    const students = [{
      id: 1,
      user_id: 3, // Linked to student user
      name: 'Alice Johnson',
      email: 'student@campusiq.com',
      student_id: 'CS2021001',
      branch: 'Computer Science & Engineering',
      year: 3,
      semester: 5,
      section: 'A', // Added section
      phone: '9876543210',
      address: '123 Student Street',
      father_name: 'Robert Johnson',
      mother_name: 'Mary Johnson',
      parents_phone: '9988776655', // New field
      date_of_birth: '2002-05-15',
      admission_date: '2021-08-01',
      status: 'active',
      created_at: new Date().toISOString()
    }, {
      id: 2,
      user_id: 4,
      name: 'Bob Wilson',
      email: 'bob.wilson@student.campusiq.com',
      student_id: 'CS2021002',
      branch: 'Computer Science & Engineering',
      year: 3,
      semester: 5,
      section: 'B', // Added section
      phone: '9876543211',
      address: '124 Student Street',
      father_name: 'David Wilson',
      mother_name: 'Lisa Wilson',
      parents_phone: '9988776656', // New field
      date_of_birth: '2002-03-22',
      admission_date: '2021-08-01',
      status: 'active',
      created_at: new Date().toISOString()
    }, {
      id: 3,
      user_id: 5,
      name: 'Charlie Davis',
      email: 'charlie.davis@student.campusiq.com',
      student_id: 'CE2022001',
      branch: 'Civil Engineering',
      year: 2,
      semester: 3,
      section: 'A',
      phone: '9876543212',
      address: '456 Civil Road',
      father_name: 'Paul Davis',
      mother_name: 'Nancy Davis',
      parents_phone: '9988776657', // New field
      date_of_birth: '2003-11-10',
      admission_date: '2022-08-01',
      status: 'active',
      created_at: new Date().toISOString()
    }, { // NEW: Student for AI&DS
      id: 4,
      user_id: 8,
      name: 'Diana Prince',
      email: 'diana.prince@student.campusiq.com',
      student_id: 'AID2024001',
      branch: 'Artificial Intelligence & Data Science',
      year: 1,
      semester: 1,
      section: 'A',
      phone: '9876543213',
      address: '789 AI Street',
      father_name: 'Richard Prince',
      mother_name: 'Hippolyta Prince',
      parents_phone: '9988776658',
      date_of_birth: '2006-07-01',
      admission_date: '2024-08-01',
      status: 'active',
      created_at: new Date().toISOString()
    }, {
      id: 5,
      user_id: 9,
      name: 'Steve Rogers',
      email: 'steve.rogers@student.campusiq.com',
      student_id: 'AID2024002',
      branch: 'Artificial Intelligence & Data Science',
      year: 1,
      semester: 1,
      section: 'A',
      phone: '9876543214',
      address: '101 Data Lane',
      father_name: 'Joseph Rogers',
      mother_name: 'Sarah Rogers',
      parents_phone: '9988776659',
      date_of_birth: '2006-04-04',
      admission_date: '2024-08-01',
      status: 'active',
      created_at: new Date().toISOString()
    }, {
      id: 6,
      user_id: 10,
      name: 'Peter Parker',
      email: 'peter.parker@student.campusiq.com',
      student_id: 'ME2024001',
      branch: 'Mechanical Engineering',
      year: 1,
      semester: 1,
      section: 'A',
      phone: '9876543215',
      address: '200 Web Street',
      father_name: 'Ben Parker',
      mother_name: 'May Parker',
      parents_phone: '9988776660',
      date_of_birth: '2006-08-10',
      admission_date: '2024-08-01',
      status: 'active',
      created_at: new Date().toISOString()
    }];

    // Sample Faculty
    const faculty = [{
      id: 1,
      user_id: 2, // Linked to faculty user
      name: 'Dr. John Smith',
      email: 'faculty@campusiq.com',
      faculty_id: 'FAC001',
      department: 'Computer Science & Engineering',
      designation: 'Professor',
      phone: '9876543220',
      qualification: 'PhD in Computer Science',
      experience: 15,
      created_at: new Date().toISOString()
    }, {
      id: 2,
      user_id: 6, // Linked to Dr. Sarah Brown
      name: 'Dr. Sarah Brown',
      email: 'sarah.brown@campusiq.com',
      faculty_id: 'FAC002',
      department: 'Civil Engineering',
      designation: 'Associate Professor',
      phone: '9876543221',
      qualification: 'PhD in Civil Engineering',
      experience: 10,
      created_at: new Date().toISOString()
    }, { // NEW: Faculty for AI&DS
      id: 3,
      user_id: 7,
      name: 'Prof. Olivia King',
      email: 'olivia.king@campusiq.com',
      faculty_id: 'FAC003',
      department: 'Artificial Intelligence & Data Science',
      designation: 'Professor',
      phone: '9876543222',
      qualification: 'PhD in AI',
      experience: 12,
      created_at: new Date().toISOString()
    }, { // NEW: Faculty for Mechanical Engineering (for EG)
      id: 4,
      user_id: 1, // Admin user can also be faculty for demo
      name: 'Dr. Robert Green',
      email: 'robert.green@campusiq.com',
      faculty_id: 'FAC004',
      department: 'Mechanical Engineering',
      designation: 'Assistant Professor',
      phone: '9876543223',
      qualification: 'M.Tech in Mechanical Engineering',
      experience: 5,
      created_at: new Date().toISOString()
    }, { // NEW: Faculty Ashok Kumar
      id: 5,
      user_id: 11,
      name: 'Ashok Kumar',
      email: 'ashok.kumar@campusiq.com',
      faculty_id: 'FAC005',
      department: 'Computer Science & Engineering',
      designation: 'Assistant Professor',
      phone: '9876543224',
      qualification: 'M.Tech in CSE',
      experience: 8,
      created_at: new Date().toISOString()
    }];

    // Sample Departments
    const departments = [{
      id: 1,
      name: 'Civil Engineering',
      code: 'CE',
      head_of_department: 'Dr. Sarah Brown',
      created_at: new Date().toISOString()
    }, {
      id: 2,
      name: 'Mechanical Engineering',
      code: 'ME',
      head_of_department: 'Dr. Alex Lee',
      created_at: new Date().toISOString()
    }, {
      id: 3,
      name: 'Computer Science & Engineering',
      code: 'CSE',
      head_of_department: 'Dr. John Smith',
      created_at: new Date().toISOString()
    }, {
      id: 4,
      name: 'Electrical & Electronics Engineering',
      code: 'EEE',
      head_of_department: 'Dr. Emily White',
      created_at: new Date().toISOString()
    }, {
      id: 5,
      name: 'Computer Science & Engineering (Data Science)',
      code: 'CSD',
      head_of_department: 'Dr. Jane Green',
      created_at: new Date().toISOString()
    }, {
      id: 6,
      name: 'Electronics & Communication Engineering',
      code: 'ECE',
      head_of_department: 'Dr. Robert Black',
      created_at: new Date().toISOString()
    }, {
      id: 7,
      name: 'Artificial Intelligence & Data Science',
      code: 'AID',
      head_of_department: 'Prof. Olivia King',
      created_at: new Date().toISOString()
    }, {
      id: 8,
      name: 'Artificial Intelligence & Machine Learning',
      code: 'AIM',
      head_of_department: 'Dr. David Chen',
      created_at: new Date().toISOString()
    }, {
      id: 9,
      name: 'Computer Science & Engineering (Artificial Intelligence)',
      code: 'CSA',
      head_of_department: 'Dr. Sophia Lee',
      created_at: new Date().toISOString()
    }];

    // Sample Subjects (now with branch, year, semester, and type)
    // Filtered to only include 'theory', 'lab', 'skill_course'
    const subjects = [
      // Computer Science & Engineering
      { id: 101, name: 'Data Structures', code: 'CS301', credits: 4, branch: 'Computer Science & Engineering', year: 3, semester: 5, type: 'theory', created_at: new Date().toISOString() },
      { id: 102, name: 'Algorithms', code: 'CS302', credits: 4, branch: 'Computer Science & Engineering', year: 3, semester: 5, type: 'theory', created_at: new Date().toISOString() },
      { id: 103, name: 'Database Systems', code: 'CS303', credits: 3, branch: 'Computer Science & Engineering', year: 3, semester: 5, type: 'theory', created_at: new Date().toISOString() },
      { id: 109, name: 'Data Structures Lab', code: 'CS301L', credits: 2, branch: 'Computer Science & Engineering', year: 3, semester: 5, type: 'lab', created_at: new Date().toISOString() },
      { id: 112, name: 'Communication Skills', code: 'SKILL101', credits: 2, branch: 'Computer Science & Engineering', year: 1, semester: 1, type: 'skill_course', created_at: new Date().toISOString() },
      { id: 118, name: 'Introduction to Programming', code: 'CS101', credits: 3, branch: 'Computer Science & Engineering', year: 1, semester: 1, type: 'theory', created_at: new Date().toISOString() },
      { id: 120, name: 'Discrete Mathematics', code: 'MA201', credits: 4, branch: 'Computer Science & Engineering', year: 2, semester: 3, type: 'theory', created_at: new Date().toISOString() },
      { id: 121, name: 'Data Science Fundamentals', code: 'DS301', credits: 4, branch: 'Computer Science & Engineering', year: 3, semester: 5, type: 'theory', created_at: new Date().toISOString() },
      { id: 130, name: 'Web Technologies', code: 'CS305', credits: 3, branch: 'Computer Science & Engineering', year: 3, semester: 6, type: 'theory', created_at: new Date().toISOString() },
      { id: 131, name: 'Machine Learning', code: 'CS405', credits: 4, branch: 'Computer Science & Engineering', year: 4, semester: 8, type: 'theory', created_at: new Date().toISOString() },
      { id: 132, name: 'Python Programming Lab', code: 'CS101L', credits: 1, branch: 'Computer Science & Engineering', year: 1, semester: 1, type: 'lab', created_at: new Date().toISOString() },
      { id: 133, name: 'Advanced Python Skill', code: 'SKILL102', credits: 2, branch: 'Computer Science & Engineering', year: 1, semester: 2, type: 'skill_course', created_at: new Date().toISOString() },
      // Civil Engineering
      { id: 106, name: 'Engineering Mechanics', code: 'CE201', credits: 3, branch: 'Civil Engineering', year: 2, semester: 3, type: 'theory', created_at: new Date().toISOString() },
      { id: 119, name: 'Engineering Physics', code: 'PH102', credits: 4, branch: 'Civil Engineering', year: 1, semester: 2, type: 'theory', created_at: new Date().toISOString() },
      { id: 127, name: 'Advanced Calculus', code: 'MA101', credits: 4, branch: 'Civil Engineering', year: 1, semester: 1, type: 'theory', created_at: new Date().toISOString() },
      { id: 139, name: 'Structural Analysis', code: 'CE302', credits: 4, branch: 'Civil Engineering', year: 3, semester: 6, type: 'theory', created_at: new Date().toISOString() },
      { id: 140, name: 'Concrete Technology Lab', code: 'CE302L', credits: 2, branch: 'Civil Engineering', year: 3, semester: 6, type: 'lab', created_at: new Date().toISOString() },
      { id: 141, name: 'Water Resource Engg', code: 'CE401', credits: 3, branch: 'Civil Engineering', year: 4, semester: 7, type: 'theory', created_at: new Date().toISOString() },
      { id: 142, name: 'Geotechnical Engg Lab', code: 'CE401L', credits: 1, branch: 'Civil Engineering', year: 4, semester: 7, type: 'lab', created_at: new Date().toISOString() },
      // Mechanical Engineering
      { id: 107, name: 'Fluid Mechanics', code: 'ME301', credits: 4, branch: 'Mechanical Engineering', year: 3, semester: 5, type: 'theory', created_at: new Date().toISOString() },
      { id: 125, name: 'Workshop Practice', code: 'ME101L', credits: 1, branch: 'Mechanical Engineering', year: 1, semester: 2, type: 'lab', created_at: new Date().toISOString() },
      { id: 144, name: 'Thermodynamics', code: 'ME201', credits: 4, branch: 'Mechanical Engineering', year: 2, semester: 3, type: 'theory', created_at: new Date().toISOString() },
      { id: 145, name: 'Manufacturing Processes', code: 'ME302', credits: 3, branch: 'Mechanical Engineering', year: 3, semester: 6, type: 'theory', created_at: new Date().toISOString() },
      { id: 146, name: 'CAD/CAM Lab', code: 'ME302L', credits: 2, branch: 'Mechanical Engineering', year: 3, semester: 6, type: 'lab', created_at: new Date().toISOString() },
      // Electrical & Electronics Engineering
      { id: 18, name: 'Basic Electrical Engineering', code: 'EE101', credits: 3, branch: 'Electrical & Electronics Engineering', year: 1, semester: 1, type: 'theory', created_at: new Date().toISOString() },
      { id: 44, name: 'Digital Logic Design', code: 'EE301', credits: 4, branch: 'Electrical & Electronics Engineering', year: 2, semester: 3, type: 'theory', created_at: new Date().toISOString() },
      { id: 45, name: 'Circuit Theory', code: 'EE202', credits: 4, branch: 'Electrical & Electronics Engineering', year: 2, semester: 4, type: 'theory', created_at: new Date().toISOString() },
      { id: 46, name: 'Power Electronics', code: 'EE401', credits: 4, branch: 'Electrical & Electronics Engineering', year: 4, semester: 7, type: 'theory', created_at: new Date().toISOString() },
      { id: 47, name: 'Electrical Machines Lab', code: 'EE301L', credits: 2, branch: 'Electrical & Electronics Engineering', year: 3, semester: 5, type: 'lab', created_at: new Date().toISOString() },
      // Artificial Intelligence & Machine Learning
      { id: 48, name: 'Machine Learning Basics', code: 'AIM401', credits: 4, branch: 'Artificial Intelligence & Machine Learning', year: 4, semester: 7, type: 'theory', created_at: new Date().toISOString() },
      { id: 49, name: 'Neural Networks', code: 'AIM402', credits: 4, branch: 'Artificial Intelligence & Machine Learning', year: 4, semester: 8, type: 'theory', created_at: new Date().toISOString() },
      // NEW: Subjects for Artificial Intelligence & Data Science (AID) - 1st Year, Semester 1, Theory
      { id: 153, name: 'Introduction to AI & DS', code: 'AID101', credits: 4, branch: 'Artificial Intelligence & Data Science', year: 1, semester: 1, type: 'theory', created_at: new Date().toISOString() },
      { id: 154, name: 'Mathematics for AI', code: 'AID102', credits: 4, branch: 'Artificial Intelligence & Data Science', year: 1, semester: 1, type: 'theory', created_at: new Date().toISOString() },
      { id: 155, name: 'Programming Fundamentals (Python)', code: 'AID103', credits: 3, branch: 'Artificial Intelligence & Data Science', year: 1, semester: 1, type: 'theory', created_at: new Date().toISOString() },
      // NEW: Subject for Engineering Graphics (Special Course)
      { id: 156, name: 'Engineering Graphics', code: 'EG101', credits: 3, branch: 'Mechanical Engineering', year: 1, semester: 1, type: 'theory', created_at: new Date().toISOString() },
      // NEW: Subject for Problem Solving through C Programming
      { id: 157, name: 'Problem Solving through C Programming', code: '20A511T', credits: 3, branch: 'Computer Science & Engineering', year: 1, semester: 1, section: 'A', type: 'theory', created_at: new Date().toISOString() },
      // NEW: Subject for Data Structures Lab (for testing lab assignments)
      { id: 158, name: 'Data Structures Lab', code: 'CS301L_NEW', credits: 2, branch: 'Computer Science & Engineering', year: 1, semester: 1, section: 'A', type: 'lab', created_at: new Date().toISOString() }
    ];

    // Sample Class Offerings (linking subjects to classes and faculty)
    // Filtered to only include 'theory', 'lab', 'skill_course'
    const class_offerings = [
      // Existing CSE offerings (Dr. John Smith - FAC001)
      { id: 1, subject_id: 101, branch: 'Computer Science & Engineering', year: 3, semester: 5, section: 'A', subject_type: 'theory', faculty_id: 1, is_active: true, is_cleared: false, created_at: new Date().toISOString() },
      { id: 2, subject_id: 102, branch: 'Computer Science & Engineering', year: 3, semester: 5, section: 'A', subject_type: 'theory', faculty_id: 1, is_active: true, is_cleared: false, created_at: new Date().toISOString() },
      { id: 3, subject_id: 103, branch: 'Computer Science & Engineering', year: 3, semester: 5, section: 'B', subject_type: 'theory', faculty_id: 1, is_active: true, is_cleared: false, created_at: new Date().toISOString() },
      { id: 5, subject_id: 109, branch: 'Computer Science & Engineering', year: 3, semester: 5, section: 'A', subject_type: 'lab', faculty_id: 1, is_active: true, is_cleared: false, created_at: new Date().toISOString() },
      { id: 6, subject_id: 112, branch: 'Computer Science & Engineering', year: 1, semester: 1, section: 'A', subject_type: 'skill_course', faculty_id: 1, is_active: true, is_cleared: false, created_at: new Date().toISOString() },
      { id: 12, subject_id: 118, branch: 'Computer Science & Engineering', year: 1, semester: 1, section: 'A', subject_type: 'theory', faculty_id: 1, is_active: true, is_cleared: false, created_at: new Date().toISOString() },
      { id: 14, subject_id: 120, branch: 'Computer Science & Engineering', year: 2, semester: 3, section: 'A', subject_type: 'theory', faculty_id: 1, is_active: true, is_cleared: false, created_at: new Date().toISOString() },
      { id: 15, subject_id: 121, branch: 'Computer Science & Engineering', year: 3, semester: 5, section: 'A', subject_type: 'theory', faculty_id: 1, is_active: true, is_cleared: false, created_at: new Date().toISOString() },
      { id: 24, subject_id: 130, branch: 'Computer Science & Engineering', year: 3, semester: 6, section: 'A', subject_type: 'theory', faculty_id: 1, is_active: true, is_cleared: false, created_at: new Date().toISOString() },
      { id: 25, subject_id: 131, branch: 'Computer Science & Engineering', year: 4, semester: 8, section: 'A', subject_type: 'theory', faculty_id: 1, is_active: true, is_cleared: false, created_at: new Date().toISOString() },
      { id: 26, subject_id: 132, branch: 'Computer Science & Engineering', year: 1, semester: 1, section: 'A', subject_type: 'lab', faculty_id: 1, is_active: true, is_cleared: false, created_at: new Date().toISOString() },
      { id: 27, subject_id: 133, branch: 'Computer Science & Engineering', year: 1, semester: 2, section: 'A', subject_type: 'skill_course', faculty_id: 1, is_active: true, is_cleared: false, created_at: new Date().toISOString() },
      // Civil offerings (Dr. Sarah Brown - FAC002)
      { id: 4, subject_id: 106, branch: 'Civil Engineering', year: 2, semester: 3, section: 'A', subject_type: 'theory', faculty_id: 2, is_active: true, is_cleared: false, created_at: new Date().toISOString() },
      { id: 13, subject_id: 119, branch: 'Civil Engineering', year: 1, semester: 2, section: 'A', subject_type: 'theory', faculty_id: 2, is_active: true, is_cleared: false, created_at: new Date().toISOString() },
      { id: 21, subject_id: 127, branch: 'Civil Engineering', year: 1, semester: 1, section: 'A', subject_type: 'theory', faculty_id: 2, is_active: true, is_cleared: false, created_at: new Date().toISOString() },
      { id: 33, subject_id: 139, branch: 'Civil Engineering', year: 3, semester: 6, section: 'A', subject_type: 'theory', faculty_id: 2, is_active: true, is_cleared: false, created_at: new Date().toISOString() },
      { id: 34, subject_id: 140, branch: 'Civil Engineering', year: 3, semester: 6, section: 'A', subject_type: 'lab', faculty_id: 2, is_active: true, is_cleared: false, created_at: new Date().toISOString() },
      { id: 35, subject_id: 141, branch: 'Civil Engineering', year: 4, semester: 7, section: 'A', subject_type: 'theory', faculty_id: 2, is_active: true, is_cleared: false, created_at: new Date().toISOString() },
      { id: 36, subject_id: 142, branch: 'Civil Engineering', year: 4, semester: 7, section: 'A', subject_type: 'lab', faculty_id: 2, is_active: true, is_cleared: false, created_at: new Date().toISOString() },
      // Mechanical offerings (Dr. Sarah Brown - FAC002, Dr. Robert Green - FAC004)
      { id: 38, subject_id: 107, branch: 'Mechanical Engineering', year: 3, semester: 5, section: 'A', subject_type: 'theory', faculty_id: 2, is_active: true, is_cleared: false, created_at: new Date().toISOString() },
      { id: 39, subject_id: 125, branch: 'Mechanical Engineering', year: 1, semester: 2, section: 'A', subject_type: 'lab', faculty_id: 2, is_active: true, is_cleared: false, created_at: new Date().toISOString() },
      { id: 40, subject_id: 144, branch: 'Mechanical Engineering', year: 2, semester: 3, section: 'A', subject_type: 'theory', faculty_id: 2, is_active: true, is_cleared: false, created_at: new Date().toISOString() },
      { id: 41, subject_id: 145, branch: 'Mechanical Engineering', year: 3, semester: 6, section: 'A', subject_type: 'theory', faculty_id: 2, is_active: true, is_cleared: false, created_at: new Date().toISOString() },
      { id: 42, subject_id: 146, branch: 'Mechanical Engineering', year: 3, semester: 6, section: 'A', subject_type: 'lab', faculty_id: 2, is_active: true, is_cleared: false, created_at: new Date().toISOString() },
      // Electrical & Electronics Engineering (Dr. John Smith - FAC001)
      { id: 18, subject_id: 18, branch: 'Electrical & Electronics Engineering', year: 1, semester: 1, section: 'A', subject_type: 'theory', faculty_id: 1, is_active: true, is_cleared: false, created_at: new Date().toISOString() },
      { id: 44, subject_id: 44, branch: 'Electrical & Electronics Engineering', year: 2, semester: 3, section: 'A', subject_type: 'theory', faculty_id: 1, is_active: true, is_cleared: false, created_at: new Date().toISOString() },
      { id: 45, subject_id: 45, branch: 'Electrical & Electronics Engineering', year: 2, semester: 4, section: 'A', subject_type: 'theory', faculty_id: 1, is_active: true, is_cleared: false, created_at: new Date().toISOString() },
      { id: 46, subject_id: 46, branch: 'Electrical & Electronics Engineering', year: 4, semester: 7, section: 'A', subject_type: 'theory', faculty_id: 1, is_active: true, is_cleared: false, created_at: new Date().toISOString() },
      { id: 47, subject_id: 47, branch: 'Electrical & Electronics Engineering', year: 3, semester: 5, section: 'A', subject_type: 'lab', faculty_id: 1, is_active: true, is_cleared: false, created_at: new Date().toISOString() },
      // Artificial Intelligence & Machine Learning (Dr. John Smith - FAC001)
      { id: 48, name: 'Machine Learning Basics', code: 'AIM401', credits: 4, branch: 'Artificial Intelligence & Machine Learning', year: 4, semester: 7, type: 'theory', created_at: new Date().toISOString() },
      { id: 49, name: 'Neural Networks', code: 'AIM402', credits: 4, branch: 'Artificial Intelligence & Machine Learning', year: 4, semester: 8, type: 'theory', created_at: new Date().toISOString() },
      // NEW: Class offerings for Artificial Intelligence & Data Science (AID) - 1st Year, Semester 1, Section A (Prof. Olivia King - FAC003)
      { id: 51, subject_id: 153, branch: 'Artificial Intelligence & Data Science', year: 1, semester: 1, section: 'A', subject_type: 'theory', faculty_id: 3, is_active: true, is_cleared: false, created_at: new Date().toISOString() },
      { id: 52, subject_id: 154, branch: 'Artificial Intelligence & Data Science', year: 1, semester: 1, section: 'A', subject_type: 'theory', faculty_id: 3, is_active: true, is_cleared: false, created_at: new Date().toISOString() },
      { id: 53, subject_id: 155, branch: 'Artificial Intelligence & Data Science', year: 1, semester: 1, section: 'A', subject_type: 'theory', faculty_id: 3, is_active: true, is_cleared: false, created_at: new Date().toISOString() },
      // NEW: Class offering for Engineering Graphics (Special Course) (Dr. Robert Green - FAC004)
      { id: 54, subject_id: 156, branch: 'Mechanical Engineering', year: 1, semester: 1, section: 'A', subject_type: 'theory', faculty_id: 4, is_active: true, is_cleared: false, created_at: new Date().toISOString() },
      // NEW: Class offerings for Ashok Kumar (FAC005)
      { id: 55, subject_id: 118, branch: 'Computer Science & Engineering', year: 1, semester: 1, section: 'B', subject_type: 'theory', faculty_id: 5, is_active: true, is_cleared: false, created_at: new Date().toISOString() },
      { id: 56, subject_id: 132, branch: 'Computer Science & Engineering', year: 1, semester: 1, section: 'B', subject_type: 'lab', faculty_id: 5, is_active: true, is_cleared: false, created_at: new Date().toISOString() },
      // NEW: Class offering for Problem Solving through C Programming (Ashok Kumar - FAC005)
      { id: 57, subject_id: 157, branch: 'Computer Science & Engineering', year: 1, semester: 1, section: 'A', subject_type: 'theory', faculty_id: 5, is_active: true, is_cleared: false, created_at: new Date().toISOString() },
      // NEW: Class offering for Data Structures Lab (NEW) (Ashok Kumar - FAC005)
      { id: 58, subject_id: 158, branch: 'Computer Science & Engineering', year: 1, semester: 1, section: 'A', subject_type: 'lab', faculty_id: 5, is_active: true, is_cleared: false, created_at: new Date().toISOString() }
    ];

    // Sample Attendance
    const attendance = [
      { id: 1, student_id: 1, subject_id: 101, date: '2024-01-15', class_time: '09:15', status: 'present', marked_by: 1, reason: '', reason_for_change: '', created_at: new Date().toISOString() },
      { id: 2, student_id: 1, subject_id: 101, date: '2024-01-15', class_time: '10:05', status: 'absent', marked_by: 1, reason: 'Sick leave', reason_for_change: '', created_at: new Date().toISOString() },
      { id: 3, student_id: 1, subject_id: 101, date: '2024-01-16', class_time: '09:15', status: 'present', marked_by: 1, reason: '', reason_for_change: '', created_at: new Date().toISOString() },
      { id: 4, student_id: 3, subject_id: 106, date: '2024-01-15', class_time: '10:05', status: 'present', marked_by: 2, reason: '', reason_for_change: '', created_at: new Date().toISOString() },
      { id: 5, student_id: 1, subject_id: 109, date: '2024-01-17', class_time: '13:30', status: 'present', marked_by: 1, reason: '', reason_for_change: '', created_at: new Date().toISOString() },
      { id: 6, student_id: 4, subject_id: 153, date: '2024-09-01', class_time: '09:15', status: 'present', marked_by: 3, reason: '', reason_for_change: '', created_at: new Date().toISOString() },
      { id: 7, student_id: 5, subject_id: 153, date: '2024-09-01', class_time: '09:15', status: 'present', marked_by: 3, reason: '', reason_for_change: '', created_at: new Date().toISOString() },
      { id: 8, student_id: 4, subject_id: 154, date: '2024-09-02', class_time: '10:05', status: 'absent', marked_by: 3, reason: 'Fever', reason_for_change: '', created_at: new Date().toISOString() },
      { id: 9, student_id: 6, subject_id: 156, date: '2024-09-03', class_time: '11:45', status: 'present', marked_by: 4, reason: '', reason_for_change: '', created_at: new Date().toISOString() },
      { id: 10, student_id: 2, subject_id: 118, date: '2024-10-31', class_time: '09:15', status: 'present', marked_by: 5, reason: '', reason_for_change: '', created_at: new Date().toISOString() },
      { id: 11, student_id: 2, subject_id: 132, date: '2024-10-31', class_time: '13:30', status: 'absent', reason: '', marked_by: 5, reason_for_change: '', created_at: new Date().toISOString() },
      { id: 12, student_id: 1, subject_id: 157, date: '2024-11-01', class_time: '10:55', status: 'present', marked_by: 5, reason: '', reason_for_change: '', created_at: new Date().toISOString() },
      { id: 13, student_id: 1, subject_id: 158, date: '2024-11-02', class_time: '09:15', status: 'present', marked_by: 5, reason: '', reason_for_change: '', created_at: new Date().toISOString() }
    ];

    // Sample Marks
    const marks = [
      { id: 1, student_id: 1, subject_id: 101, assessment_type: 'mid1', marks: 19, max_marks: 25, date: '2024-01-20', entered_by: 1, created_at: new Date().toISOString() },
      { id: 2, student_id: 1, subject_id: 101, assessment_type: 'mid2', marks: 10, max_marks: 25, date: '2024-02-20', entered_by: 1, created_at: new Date().toISOString() },
      { id: 3, student_id: 3, subject_id: 106, assessment_type: 'mid1', marks: 18, max_marks: 25, date: '2024-01-25', entered_by: 2, created_at: new Date().toISOString() },
      { id: 4, student_id: 1, subject_id: 109, assessment_type: 'lab_exam', marks: 45, max_marks: 50, date: '2024-02-01', entered_by: 1, created_at: new Date().toISOString() },
      { id: 5, student_id: 4, subject_id: 153, assessment_type: 'quiz', marks: 8, max_marks: 10, date: '2024-09-10', entered_by: 3, created_at: new Date().toISOString() },
      { id: 6, student_id: 5, subject_id: 153, assessment_type: 'quiz', marks: 7, max_marks: 10, date: '2024-09-10', entered_by: 3, created_at: new Date().toISOString() },
      { id: 7, student_id: 6, subject_id: 156, assessment_type: 'mid1', marks: 8, max_marks: 10, date: '2024-09-15', entered_by: 4, created_at: new Date().toISOString() },
      { id: 8, student_id: 6, subject_id: 156, assessment_type: 'assignment', assignment_number: 1, marks: 15, max_marks: 20, date: '2024-09-20', entered_by: 4, created_at: new Date().toISOString() },
      { id: 9, student_id: 6, subject_id: 156, assessment_type: 'quiz', marks: 4, max_marks: 5, date: '2024-09-25', entered_by: 4, created_at: new Date().toISOString() },
      { id: 10, student_id: 1, subject_id: 102, assessment_type: 'mid1', marks: 0, max_marks: 25, date: '2024-02-01', entered_by: 1, created_at: new Date().toISOString() },
      { id: 11, student_id: 1, subject_id: 102, assessment_type: 'mid2', marks: 18, max_marks: 25, date: '2024-03-01', entered_by: 1, created_at: new Date().toISOString() },
      { id: 12, student_id: 1, subject_id: 101, assessment_type: 'assignment', assignment_number: 1, marks: 4, max_marks: 5, date: '2024-01-25', entered_by: 1, created_at: new Date().toISOString() },
      { id: 13, student_id: 1, subject_id: 101, assessment_type: 'assignment', assignment_number: 2, marks: 3, max_marks: 5, date: '2024-02-05', entered_by: 1, created_at: new Date().toISOString() },
      { id: 14, student_id: 1, subject_id: 101, assessment_type: 'assignment', assignment_number: 3, marks: 5, max_marks: 5, date: '2024-02-15', entered_by: 1, created_at: new Date().toISOString() },
      { id: 15, student_id: 1, subject_id: 101, assessment_type: 'assignment', assignment_number: 4, marks: 2, max_marks: 5, date: '2024-02-25', entered_by: 1, created_at: new Date().toISOString() },
      { id: 16, student_id: 1, subject_id: 101, assessment_type: 'assignment', assignment_number: 5, marks: 4, max_marks: 5, date: '2024-03-05', entered_by: 1, created_at: new Date().toISOString() },
      { id: 17, student_id: 1, subject_id: 101, assessment_type: 'external_exam', marks: 55, max_marks: 70, date: '2024-04-10', entered_by: 1, created_at: new Date().toISOString() },
      { id: 18, student_id: 6, subject_id: 156, assessment_type: 'external_exam', marks: 60, max_marks: 70, date: '2024-04-15', entered_by: 1, created_at: new Date().toISOString() },
      { id: 19, student_id: 2, subject_id: 118, assessment_type: 'mid1', marks: 20, max_marks: 25, date: '2024-10-20', entered_by: 5, created_at: new Date().toISOString() },
      { id: 20, student_id: 2, subject_id: 132, assessment_type: 'lab_exam', marks: 40, max_marks: 50, date: '2024-10-25', entered_by: 5, created_at: new Date().toISOString() },
      { id: 21, student_id: 1, subject_id: 157, assessment_type: 'mid1', marks: 22, max_marks: 25, date: '2024-11-05', entered_by: 5, created_at: new Date().toISOString() },
      { id: 22, student_id: 1, subject_id: 157, assessment_type: 'assignment', assignment_number: 1, marks: 4, max_marks: 5, date: '2024-11-01', entered_by: 5, created_at: new Date().toISOString() },
      { id: 23, student_id: 1, subject_id: 157, assessment_type: 'assignment', assignment_number: 2, marks: 3, max_marks: 5, date: '2024-11-08', entered_by: 5, created_at: new Date().toISOString() },
      { id: 24, student_id: 1, subject_id: 157, assessment_type: 'assignment', assignment_number: 3, marks: 5, max_marks: 5, date: '2024-11-15', entered_by: 5, created_at: new Date().toISOString() },
      { id: 25, student_id: 1, subject_id: 157, assessment_type: 'assignment', assignment_number: 4, marks: 2, max_marks: 5, date: '2024-11-22', entered_by: 5, created_at: new Date().toISOString() },
      { id: 26, student_id: 1, subject_id: 157, assessment_type: 'assignment', assignment_number: 5, marks: 4, max_marks: 5, date: '2024-11-29', entered_by: 5, created_at: new Date().toISOString() },
      { id: 27, student_id: 1, subject_id: 158, assessment_type: 'assignment', assignment_number: 1, marks: 4, max_marks: 5, date: '2024-11-03', entered_by: 5, created_at: new Date().toISOString() },
      { id: 28, student_id: 1, subject_id: 158, assessment_type: 'assignment', assignment_number: 2, marks: 3, max_marks: 5, date: '2024-11-10', entered_by: 5, created_at: new Date().toISOString() },
      { id: 29, student_id: 1, subject_id: 158, assessment_type: 'assignment', assignment_number: 3, marks: 5, max_marks: 5, date: '2024-11-17', entered_by: 5, created_at: new Date().toISOString() },
      { id: 30, student_id: 1, subject_id: 158, assessment_type: 'assignment', assignment_number: 4, marks: 2, max_marks: 5, date: '2024-11-24', entered_by: 5, created_at: new Date().toISOString() },
      { id: 31, student_id: 1, subject_id: 158, assessment_type: 'assignment', assignment_number: 5, marks: 4, max_marks: 5, date: '2024-12-01', entered_by: 5, created_at: new Date().toISOString() },
      { id: 32, student_id: 1, subject_id: 158, assessment_type: 'quiz', marks: 8, max_marks: 10, date: '2024-12-05', entered_by: 5, created_at: new Date().toISOString() }
    ];

    // Sample Announcements
    const announcements = [
      { id: 1, title: 'Welcome to New Semester', content: 'Welcome all students and faculty to the new academic semester. Please check your schedules and prepare accordingly.', target_audience: 'all', created_by: 1, created_by_name: 'System Administrator', created_at: new Date().toISOString(), is_active: true, is_pinned: true, priority: 'high', expires_at: null, send_email: true },
      { id: 2, title: 'Mid-Term Exam Schedule Released', content: 'The schedule for mid-term examinations has been released. Students are advised to check the academic calendar for details.', target_audience: 'student', created_by: 1, created_by_name: 'System Administrator', created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), is_active: true, is_pinned: false, priority: 'normal', expires_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), send_email: true },
      { id: 3, title: 'Faculty Meeting on Curriculum', content: 'There will be a faculty meeting next Tuesday to discuss curriculum updates for the upcoming academic year.', target_audience: 'faculty', created_by: 1, created_by_name: 'System Administrator', created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), is_active: true, is_pinned: false, priority: 'normal', expires_at: null, send_email: true },
      { id: 4, title: 'Draft Announcement for Review', content: 'This is a draft announcement that is not yet published.', target_audience: 'admin', created_by: 1, created_by_name: 'System Administrator', created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), is_active: false, status: 'draft', is_pinned: false, priority: 'normal', expires_at: null, send_email: false }
    ];

    // Sample Fees
    const fees = [
      { id: 1, student_id: 1, semester: 5, tuition_fee: 50000, development_fee: 5000, examination_fee: 2000, total_fee: 57000, paid_amount: 57000, due_amount: 0, payment_date: '2024-01-10', status: 'paid', created_at: new Date().toISOString() },
      { id: 2, student_id: 3, semester: 3, tuition_fee: 45000, development_fee: 4000, examination_fee: 1500, total_fee: 50500, paid_amount: 40000, due_amount: 10500, payment_date: '2024-01-10', status: 'partially_paid', created_at: new Date().toISOString() },
      { id: 3, student_id: 4, semester: 1, tuition_fee: 60000, development_fee: 5000, examination_fee: 2000, total_fee: 67000, paid_amount: 67000, due_amount: 0, payment_date: '2024-08-25', status: 'paid', created_at: new Date().toISOString() },
      { id: 4, student_id: 5, semester: 1, tuition_fee: 60000, development_fee: 5000, examination_fee: 2000, total_fee: 67000, paid_amount: 30000, due_amount: 37000, payment_date: '2024-08-20', status: 'partially_paid', created_at: new Date().toISOString() },
      { id: 5, student_id: 6, semester: 1, tuition_fee: 55000, development_fee: 4500, examination_fee: 1800, total_fee: 61300, paid_amount: 61300, due_amount: 0, payment_date: '2024-08-28', status: 'paid', created_at: new Date().toISOString() },
      { id: 6, student_id: 2, semester: 5, tuition_fee: 50000, development_fee: 5000, examination_fee: 2000, total_fee: 57000, paid_amount: 57000, due_amount: 0, payment_date: '2024-10-15', status: 'paid', created_at: new Date().toISOString() }
    ];

    // Sample Resources (for faculty to upload and students to view)
    const resources = [
      { id: 1, title: 'Data Structures Lecture 1 Notes', subject_class_id: '101_Computer Science & Engineering_3_5_A', type: 'lecture_notes', description: 'Introduction to Data Structures and Algorithms.', file_name: 'DS_Lec1.pdf', file_type: 'application/pdf', file_size: 123456, file_url: 'https://example.com/ds_lec1.pdf', uploaded_by: 1, uploaded_by_name: 'Dr. John Smith', uploaded_at: new Date().toISOString() },
      { id: 2, title: 'Algorithms Assignment 1', subject_class_id: '102_Computer Science & Engineering_3_5_A', type: 'assignment_question_paper', description: 'First assignment covering sorting algorithms.', file_name: 'Algo_Assign1.docx', file_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', file_size: 54321, file_url: 'https://example.com/algo_assign1.docx', uploaded_by: 1, uploaded_by_name: 'Dr. John Smith', uploaded_at: new Date().toISOString() },
      { id: 3, title: 'AI&DS Introduction Slides', subject_class_id: '153_Artificial Intelligence & Data Science_1_1_A', type: 'lecture_notes', description: 'Slides for the first lecture of Introduction to AI & DS.', file_name: 'AID_Intro.pptx', file_type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', file_size: 200000, file_url: 'https://example.com/aid_intro.pptx', uploaded_by: 3, uploaded_by_name: 'Prof. Olivia King', uploaded_at: new Date().toISOString() },
      { id: 4, title: 'Engineering Graphics Basics', subject_class_id: '156_Mechanical Engineering_1_1_A', type: 'lecture_notes', description: 'Introduction to Engineering Graphics concepts.', file_name: 'EG_Basics.pdf', file_type: 'application/pdf', file_size: 150000, file_url: 'https://example.com/eg_basics.pdf', uploaded_by: 4, uploaded_by_name: 'Dr. Robert Green', uploaded_at: new Date().toISOString() },
      { id: 5, title: 'Intro to Programming Syllabus', subject_class_id: '118_Computer Science & Engineering_1_1_B', type: 'syllabus', description: 'Syllabus for Introduction to Programming.', file_name: 'CS101_Syll-abus.pdf', file_type: 'application/pdf', file_size: 50000, file_url: 'https://example.com/cs101_syllabus.pdf', uploaded_by: 5, uploaded_by_name: 'Ashok Kumar', uploaded_at: new Date().toISOString() },
      { id: 6, title: 'C Programming Assignment 1 Question Paper', subject_class_id: '157_Computer Science & Engineering_1_1_A', type: 'assignment_question_paper', description: 'First assignment question paper for C Programming.', file_name: 'C_Assign1_QP.pdf', file_type: 'application/pdf', file_size: 75000, file_url: 'https://example.com/c_assign1_qp.pdf', uploaded_by: 5, uploaded_by_name: 'Ashok Kumar', uploaded_at: new Date().toISOString() }
    ];

    // Sample Assignments (now links to resources, or has typed questions)
    const assignments = [
      { id: 1, title: 'Data Structures Mid-Term Project', subject_class_id: '101_Computer Science & Engineering_3_5_A', type: 'project', description: 'Implement a graph traversal algorithm.', max_marks: 50, due_date: '2024-03-15', created_by: 1, created_by_name: 'Dr. John Smith', created_at: new Date().toISOString(), is_completed: false, resource_id: null, questions: null },
      { id: 2, title: 'Algorithms Quiz 1', subject_class_id: '102_Computer Science & Engineering_3_5_A', type: 'quiz', description: 'Quiz on basic sorting algorithms.', max_marks: 10, due_date: '2024-02-20', created_by: 1, created_by_name: 'Dr. John Smith', created_at: new Date().toISOString(), is_completed: false, resource_id: null, questions: null },
      { id: 3, title: 'AI&DS Homework 1', subject_class_id: '153_Artificial Intelligence & Data Science_1_1_A', type: 'assignment', description: 'Research on applications of AI in daily life.', max_marks: 20, due_date: '2024-09-20', created_by: 3, created_by_name: 'Prof. Olivia King', created_at: new Date().toISOString(), is_completed: false, resource_id: null, questions: null },
      { id: 4, title: 'EG Sheet 1 Submission', subject_class_id: '156_Mechanical Engineering_1_1_A', type: 'assignment', description: 'Submission for first engineering drawing sheet.', max_marks: 10, due_date: '2024-09-22', created_by: 4, created_by_name: 'Dr. Robert Green', created_at: new Date().toISOString(), resource_id: null, questions: null },
      { id: 5, title: 'EG Quiz on Projections', subject_class_id: '156_Mechanical Engineering_1_1_A', type: 'quiz', description: 'Quiz on orthographic projections.', max_marks: 10, due_date: '2024-09-28', created_by: 4, created_by_name: 'Dr. Robert Green', created_at: new Date().toISOString(), resource_id: null, questions: null },
      { id: 6, title: 'C Programming Assignment 1', subject_class_id: '157_Computer Science & Engineering_1_1_A', type: 'assignment_question_paper', description: 'Download the question paper and complete the tasks.', max_marks: 25, due_date: '2024-11-15', created_by: 5, created_by_name: 'Ashok Kumar', created_at: new Date().toISOString(), is_completed: false, resource_id: 6, questions: null },
      // NEW: Sample Assignment with typed questions
      { id: 7, title: 'Data Structures Problem Set 1', subject_class_id: '101_Computer Science & Engineering_3_5_A', type: 'typed_questions', description: 'Solve the following problems on arrays and linked lists.', max_marks: 30, due_date: '2024-12-01', created_by: 1, created_by_name: 'Dr. John Smith', created_at: new Date().toISOString(), is_completed: false, resource_id: null, questions: JSON.stringify([
        "1. Explain the difference between an array and a linked list. (5 marks)",
        "2. Write a C function to reverse a singly linked list. (10 marks)",
        "3. Implement a stack using arrays in Java. (8 marks)",
        "4. Describe the time complexity of common array operations (access, insertion, deletion). (7 marks)"
      ]) }
    ];

    // Sample Submissions (REMOVED as per new workflow)
    const submissions = [];

    // NEW: Sample Timetable entries with new fixed timings
    const timetables = [
      { id: 1, day_of_week: 'Monday', start_time: '09:15', end_time: '10:05', subject_id: 101, branch: 'Computer Science & Engineering', year: 3, semester: 5, section: 'A', original_faculty_id: 1, current_faculty_id: 1, room_number: 'LH-101', status: 'scheduled', reason: '', alter_date: null, created_at: new Date().toISOString() },
      { id: 2, day_of_week: 'Monday', start_time: '10:05', end_time: '10:55', subject_id: 102, branch: 'Computer Science & Engineering', year: 3, semester: 5, section: 'A', original_faculty_id: 1, current_faculty_id: 1, room_number: 'LH-102', status: 'scheduled', reason: '', alter_date: null, created_at: new Date().toISOString() },
      { id: 3, day_of_week: 'Tuesday', start_time: '10:05', end_time: '12:35', subject_id: 109, branch: 'Computer Science & Engineering', year: 3, semester: 5, section: 'A', original_faculty_id: 1, current_faculty_id: 1, room_number: 'Lab-101', status: 'scheduled', reason: '', alter_date: null, created_at: new Date().toISOString() }, // Corrected morning lab timing
      { id: 4, day_of_week: 'Wednesday', start_time: '09:15', end_time: '10:05', subject_id: 101, branch: 'Computer Science & Engineering', year: 3, semester: 5, section: 'A', original_faculty_id: 1, current_faculty_id: 1, room_number: 'LH-101', status: 'scheduled', reason: '', alter_date: null, created_at: new Date().toISOString() },
      { id: 5, day_of_week: 'Monday', start_time: '13:30', end_time: '16:00', subject_id: 156, branch: 'Mechanical Engineering', year: 1, semester: 1, section: 'A', original_faculty_id: 4, current_faculty_id: 4, room_number: 'Drawing Hall-1', status: 'scheduled', reason: '', alter_date: null, created_at: new Date().toISOString() },
      { id: 6, day_of_week: 'Wednesday', start_time: '10:05', end_time: '10:55', subject_id: 156, branch: 'Mechanical Engineering', year: 1, semester: 1, section: 'A', original_faculty_id: 4, current_faculty_id: 4, room_number: 'Drawing Hall-1', status: 'scheduled', reason: '', alter_date: null, created_at: new Date().toISOString() },
      { id: 7, day_of_week: 'Tuesday', start_time: '09:15', end_time: '10:05', subject_id: 153, branch: 'Artificial Intelligence & Data Science', year: 1, semester: 1, section: 'A', original_faculty_id: 3, current_faculty_id: 3, room_number: 'LH-301', status: 'scheduled', reason: '', alter_date: null, created_at: new Date().toISOString() },
      { id: 8, day_of_week: 'Thursday', start_time: '10:05', end_time: '10:55', subject_id: 154, branch: 'Artificial Intelligence & Data Science', year: 1, semester: 1, section: 'A', original_faculty_id: 3, current_faculty_id: 3, room_number: 'LH-302', status: 'scheduled', reason: '', alter_date: null, created_at: new Date().toISOString() },
      { id: 9, day_of_week: 'Friday', start_time: '13:30', end_time: '16:00', subject_id: 155, branch: 'Artificial Intelligence & Data Science', year: 1, semester: 1, section: 'A', original_faculty_id: 3, current_faculty_id: 3, room_number: 'Lab-201', status: 'scheduled', reason: '', alter_date: null, created_at: new Date().toISOString() },
      { id: 10, day_of_week: 'Thursday', start_time: '09:15', end_time: '10:05', subject_id: 118, branch: 'Computer Science & Engineering', year: 1, semester: 1, section: 'B', original_faculty_id: 5, current_faculty_id: 5, room_number: 'LH-103', status: 'scheduled', reason: '', alter_date: null, created_at: new Date().toISOString() },
      { id: 11, day_of_week: 'Thursday', start_time: '13:30', end_time: '16:00', subject_id: 132, branch: 'Computer Science & Engineering', year: 1, semester: 1, section: 'B', original_faculty_id: 5, current_faculty_id: 5, room_number: 'Lab-102', status: 'scheduled', reason: '', alter_date: null, created_at: new Date().toISOString() },
      { id: 12, day_of_week: 'Monday', start_time: '10:55', end_time: '11:45', subject_id: 157, branch: 'Computer Science & Engineering', year: 1, semester: 1, section: 'A', original_faculty_id: 5, current_faculty_id: 5, room_number: 'LH-104', status: 'scheduled', reason: '', alter_date: null, created_at: new Date().toISOString() },
      { id: 13, day_of_week: 'Tuesday', start_time: '10:05', end_time: '12:35', subject_id: 158, branch: 'Computer Science & Engineering', year: 1, semester: 1, section: 'A', original_faculty_id: 5, current_faculty_id: 5, room_number: 'Lab-103', status: 'scheduled', reason: '', alter_date: null, created_at: new Date().toISOString() }
    ];

    // NEW: Sample Alterations (for single-day overrides)
    const alterations = [
      { id: 1, timetableId: 1, facultyIdOriginal: 1, facultyIdNew: 5, date: '2024-11-15', reason: 'Original faculty on leave', periodId: '09:15', branch: 'Computer Science & Engineering', year: 3, sem: 5, section: 'A', subject: 101, alter_status: 'altered', created_at: new Date().toISOString() },
      { id: 2, timetableId: 2, facultyIdOriginal: 1, facultyIdNew: null, date: '2024-11-18', reason: 'Department meeting', periodId: '10:05', branch: 'Computer Science & Engineering', year: 3, sem: 5, section: 'A', subject: 102, alter_status: 'suspended', created_at: new Date().toISOString() },
      { id: 3, timetableId: 12, facultyIdOriginal: 5, facultyIdNew: 1, date: '2024-11-25', reason: 'Ashok Kumar on leave', periodId: '10:55', branch: 'Computer Science & Engineering', year: 1, sem: 1, section: 'A', subject: 157, alter_status: 'altered', created_at: new Date().toISOString() }
    ];


    // Store sample data
    localStorage.setItem('campusiq_users', JSON.stringify(users));
    localStorage.setItem('campusiq_students', JSON.stringify(students));
    localStorage.setItem('campusiq_faculty', JSON.stringify(faculty));
    localStorage.setItem('campusiq_departments', JSON.stringify(departments));
    localStorage.setItem('campusiq_subjects', JSON.stringify(subjects));
    localStorage.setItem('campusiq_class_offerings', JSON.stringify(class_offerings)); // New table
    localStorage.setItem('campusiq_attendance', JSON.stringify(attendance));
    localStorage.setItem('campusiq_marks', JSON.stringify(marks));
    localStorage.setItem('campusiq_announcements', JSON.stringify(announcements));
    localStorage.setItem('campusiq_fees', JSON.stringify(fees));
    localStorage.setItem('campusiq_resources', JSON.stringify(resources)); // New table
    localStorage.setItem('campusiq_assignments', JSON.stringify(assignments)); // Modified table
    localStorage.setItem('campusiq_submissions', JSON.stringify(submissions)); // REMOVED: Submissions table is now empty
    localStorage.setItem('campusiq_timetables', JSON.stringify(timetables)); // NEW: Timetable table
    localStorage.setItem('campusiq_alterations', JSON.stringify(alterations)); // NEW: Alterations table

    // Mark sample data as loaded and set current DB version
    console.log('DB: All sample data inserted into localStorage.');
    localStorage.setItem('campusiq_sample_loaded', 'true');
    localStorage.setItem('campusiq_db_version', CampusDatabase.DB_VERSION.toString());
    console.log('DB: Sample data loaded and DB_VERSION set to', CampusDatabase.DB_VERSION);

    // After inserting sample data, ensure _nextId is correctly set
    this.initializeNextId();
  }

  initializeNextId() {
    let maxId = 0;
    const tables = [
      'users',
      'students',
      'faculty',
      'departments',
      'subjects',
      'class_offerings',
      'attendance',
      'marks',
      'assignments',
      'announcements',
      'fees',
      'resources',
      // 'submissions', // REMOVED
      'timetables',
      'alterations' // NEW
    ];
    tables.forEach(table => {
      const records = this.getStorageData(table);
      if (records.length > 0) {
        const currentMax = Math.max(...records.map(r => r.id).filter(id => typeof id === 'number'));
        if (currentMax > maxId) {
          maxId = currentMax;
        }
      }
    });
    this._nextId = Math.max(this._nextId, maxId + 1);
    console.log('DB: Initialized _nextId to:', this._nextId);
  }

  // Utility methods for common database operations
  authenticate(username, password) {
    console.log(`DB: Authenticating username: ${username}, password: ${password}`); // ADDED LOG
    const users = this.getStorageData('users');
    const foundUser = users.find(user => user.username === username && user.password === password);
    console.log('DB: Found user during authentication:', foundUser); // ADDED LOG
    return foundUser;
  }

  getUserById(id) {
    const users = this.getStorageData('users');
    return users.find(user => user.id === id);
  }

  findUserByUsername(username) {
    const users = this.getStorageData('users');
    return users.find(user => user.username === username);
  }

  getStudentByUserId(userId) {
    const students = this.getStorageData('students');
    return students.find(student => student.user_id === userId);
  }

  getFacultyByUserId(userId) {
    const faculty = this.getStorageData('faculty');
    return faculty.find(f => f.user_id === userId);
  }

  getStudents(filters = {}) {
    let students = this.getStorageData('students');
    if (filters.branch) {
      students = students.filter(s => s.branch === filters.branch);
    }
    if (filters.year) {
      students = students.filter(s => s.year === filters.year);
    }
    if (filters.semester) {
      students = students.filter(s => s.semester === filters.semester);
    }
    if (filters.section) { // New filter
      students = students.filter(s => s.section === filters.section);
    }
    return students;
  }

  // New helper to get subjects for a specific class (branch, year, semester, section)
  // This now filters the subjects table directly, as subjects are defined with these attributes
  getSubjectsForClass(branch, year, semester, section, isActiveOnly = true) {
    const subjects = this.getStorageData('subjects');
    const classOfferings = this.getStorageData('class_offerings');

    // First, find the specific subjects that match the class criteria
    const matchingSubjects = subjects.filter(s =>
      s.branch === branch && s.year === year && s.semester === semester
    );

    // Then, find class offerings for these subjects and the specific section
    const filteredOfferings = classOfferings.filter(co => {
      const subjectMatches = matchingSubjects.some(s => s.id === co.subject_id);
      const sectionMatches = co.section === section;
      const activeMatches = isActiveOnly ? co.is_active : true;
      return subjectMatches && sectionMatches && activeMatches;
    });

    return filteredOfferings.map(co => {
      const subject = subjects.find(s => s.id === co.subject_id);
      const faculty = this.findById('faculty', co.faculty_id);
      return subject ? { ...subject,
        class_offering_id: co.id,
        section: co.section,
        faculty_id: co.faculty_id,
        faculty_name: faculty?.name || 'N/A'
      } : null;
    }).filter(Boolean);
  }

  // New helper to get subjects taught by a specific faculty
  // This now filters class_offerings and then joins with the subjects table (which has branch, year, semester, type)
  getSubjectsTaughtByFaculty(facultyId, isActiveOnly = true) {
    const classOfferings = this.getStorageData('class_offerings');
    const subjects = this.getStorageData('subjects');

    const filteredOfferings = classOfferings.filter(co => {
      const matchesFaculty = co.faculty_id === facultyId;
      const matchesActive = isActiveOnly ? co.is_active : true;
      return matchesFaculty && matchesActive;
    });

    return filteredOfferings.map(co => {
      const subject = subjects.find(s => s.id === co.subject_id); // Subject now has branch, year, semester, type
      const faculty = this.findById('faculty', co.faculty_id); // Ensure faculty name is available
      return subject ? { ...subject,
        class_offering_id: co.id,
        section: co.section,
        faculty_id: co.faculty_id,
        faculty_name: faculty?.name || 'N/A'
      } : null;
    }).filter(Boolean);
  }

  // New helper to get student count by department
  getStudentCountByDepartment(departmentName) {
    const students = this.getStorageData('students');
    return students.filter(student => student.branch === departmentName).length;
  }

  // New helper to get faculty count by department
  getFacultyCountByDepartment(departmentName) {
    const faculty = this.getStorageData('faculty');
    return faculty.filter(f => f.department === departmentName).length;
  }

  getAttendance(studentId, subjectId = null) {
    const attendance = this.getStorageData('attendance');
    return attendance.filter(a =>
      (!studentId || a.student_id === studentId) &&
      (!subjectId || a.subject_id === subjectId)
    );
  }

  getMarks(studentId, subjectId = null) {
    const marks = this.getStorageData('marks');
    return marks.filter(m =>
      (!studentId || m.student_id === studentId) &&
      (!subjectId || m.subject_id === subjectId)
    );
  }

  getAnnouncements(targetAudience = null) {
    const announcements = this.getStorageData('announcements');
    const now = new Date();
    return announcements.filter(a =>
      a.is_active &&
      (!a.expires_at || new Date(a.expires_at) > now) && // Not expired
      (!targetAudience || a.target_audience === 'all' || a.target_audience === targetAudience)
    ).sort((a, b) => {
      // Pinned announcements first, then by creation date (newest first)
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      return new Date(b.created_at) - new Date(a.created_at);
    });
  }

  // NEW: Timetable specific getters
  getTimetableEntries(filters = {}) {
    let timetables = this.getStorageData('timetables');
    return timetables.filter(entry => {
      const matchesBranch = !filters.branch || entry.branch === filters.branch;
      const matchesYear = !filters.year || entry.year == parseInt(filters.year);
      const matchesSemester = !filters.semester || entry.semester == parseInt(filters.semester);
      const matchesSection = !filters.section || entry.section === filters.section;
      const matchesSubject = !filters.subject_id || entry.subject_id == parseInt(filters.subject_id);
      
      // If faculty_id filter is provided, check against both original and current faculty
      const matchesFaculty = !filters.faculty_id || (entry.original_faculty_id == parseInt(filters.faculty_id) || entry.current_faculty_id == parseInt(filters.faculty_id));
      
      const matchesDay = !filters.day_of_week || entry.day_of_week === filters.day_of_week;

      return matchesBranch && matchesYear && matchesSemester && matchesSection && matchesSubject && matchesFaculty && matchesDay;
    });
  }

  // CRUD Operations
  create(tableName, data) {
    const records = this.getStorageData(tableName);
    // Ensure _nextId is up-to-date before creating a new record
    this.initializeNextId();
    const newRecord = {
      id: this._nextId++, // Use and increment the counter
      ...data,
      created_at: new Date().toISOString()
    };
    records.push(newRecord);
    localStorage.setItem(`campusiq_${tableName}`, JSON.stringify(records));
    console.log(`DB: Created record in ${tableName}:`, newRecord);
    return newRecord;
  }

  update(tableName, id, data) {
    const records = this.getStorageData(tableName);
    const index = records.findIndex(r => r.id == id);
    if (index !== -1) {
      records[index] = { ...records[index],
        ...data,
        updated_at: new Date().toISOString()
      };
      localStorage.setItem(`campusiq_${tableName}`, JSON.stringify(records));
      console.log(`DB: Updated record in ${tableName} (ID: ${id}):`, records[index]);
      return records[index];
    }
    console.warn(`DB: Failed to update record in ${tableName} (ID: ${id}). Not found.`);
    return null;
  }

  delete(tableName, id) {
    const records = this.getStorageData(tableName);
    const filteredRecords = records.filter(r => r.id != id);
    localStorage.setItem(`campusiq_${tableName}`, JSON.stringify(filteredRecords));
    console.log(`DB: Deleted record from ${tableName} (ID: ${id}).`);
    return records.length !== filteredRecords.length;
  }

  findById(tableName, id) {
    const records = this.getStorageData(tableName);
    return records.find(r => r.id == id);
  }

  findBy(tableName, criteria) {
    const records = this.getStorageData(tableName);
    return records.filter(record => {
      return Object.keys(criteria).every(key => record[key] === criteria[key]);
    });
  }

  // NEW: Method to save alterations (used by FacultyTimetable)
  saveAlterations(data) {
    localStorage.setItem('campusiq_alterations', JSON.stringify(data));
    console.log('DB: Alterations saved.');
  }
}

// Initialize database instance and make it globally accessible
try {
    window.campusDB = new CampusDatabase();
    if (window.campusDB instanceof CampusDatabase && window.campusDB.db !== null) {
        console.log('DB: CONFIRMATION: window.campusDB is an instance of CampusDatabase and successfully initialized.');
    } else {
        console.error('DB: CRITICAL ERROR: window.campusDB is NOT an instance of CampusDatabase or its internal db is null after initialization.');
        window.campusDB = null; // Explicitly set to null if initialization failed
    }
} catch (e) {
    console.error('DB: CRITICAL ERROR: Error during CampusDatabase instantiation:', e);
    window.campusDB = null; // Ensure it's null if constructor itself fails
}
