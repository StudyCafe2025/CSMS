console.log('TEST: js/test.js loaded and executed.');

// Attempt to access global objects after they should have been initialized
document.addEventListener('DOMContentLoaded', () => {
    console.log('TEST: DOMContentLoaded event fired.');
    if (window.campusDB) {
        console.log('TEST: window.campusDB is available.');
        try {
            const dbVersion = localStorage.getItem('campusiq_db_version');
            console.log('TEST: Current DB_VERSION from localStorage:', dbVersion);
            const users = window.campusDB.getStorageData('users');
            console.log('TEST: Successfully retrieved users from campusDB:', users.length, 'users found.');
            
            const timetables = window.campusDB.getStorageData('timetables');
            console.log('TEST: Successfully retrieved timetables from campusDB:', timetables.length, 'entries found.');
            timetables.forEach(entry => {
                console.log(`  Timetable Entry ID: ${entry.id}, Day: ${entry.day_of_week}, Time: ${entry.start_time}-${entry.end_time}, Subject ID: ${entry.subject_id}, Branch: ${entry.branch}, Year: ${entry.year}, Semester: ${entry.semester}, Section: ${entry.section}`);
            });

        } catch (e) {
            console.error('TEST: Error accessing campusDB after initialization:', e);
        }
    } else {
        console.error('TEST: window.campusDB is NOT available after DOMContentLoaded.');
    }

    if (typeof authSystem !== 'undefined') {
        console.log('TEST: authSystem is available.');
        if (authSystem.isAuthenticated()) {
            console.log('TEST: authSystem reports user is authenticated.');
        } else {
            console.log('TEST: authSystem reports no user is authenticated.');
        }
    } else {
        console.error('TEST: authSystem is NOT available after DOMContentLoaded.');
    }
});