const fs = require('fs');

let content = fs.readFileSync('components/AppRoutes.tsx', 'utf-8');

// 1. Add isArchiveMeasurementView definition
content = content.replace(
    /const isOtherView = \['other_records'.+?\n/,
    match => match + `        const isArchiveMeasurementView = ['archive_records', 'archive_assign_tasks', 'archive_completed_list', 'archive_pending_check_list', 'archive_check_list', 'archive_handover_list', 'archive_director_completed'].includes(currentView);\n`
);

// 2. Add archive titles
content = content.replace(
    /if \(currentView === 'check_list' \|\| currentView === 'other_check_list'\)/g,
    `if (currentView === 'check_list' || currentView === 'other_check_list' || currentView === 'archive_check_list')`
);
content = content.replace(
    /if \(currentView === 'director_completed' \|\| currentView === 'other_director_completed'\)/g,
    `if (currentView === 'director_completed' || currentView === 'other_director_completed' || currentView === 'archive_director_completed')`
);
content = content.replace(
    /if \(currentView === 'handover_list' \|\| currentView === 'other_handover_list'\)/g,
    `if (currentView === 'handover_list' || currentView === 'other_handover_list' || currentView === 'archive_handover_list')`
);
content = content.replace(
    /if \(currentView === 'assign_tasks' \|\| currentView === 'other_assign_tasks'\)/g,
    `if (currentView === 'assign_tasks' || currentView === 'other_assign_tasks' || currentView === 'archive_assign_tasks')`
);
content = content.replace(
    /else if \(currentView === 'other_records'\) title = 'Hồ sơ khác';/g,
    `else if (currentView === 'other_records') title = 'Hồ sơ khác';
        else if (currentView === 'archive_records') title = 'Lưu trữ (Cung cấp TLĐĐ)';
        else if (currentView === 'archive_completed_list') title = 'Đã thực hiện';
        else if (currentView === 'archive_pending_check_list') title = 'Chờ kiểm tra';`
);

// 3. Add archive sub-headers (duplicate MEASUREMENT TICKETS logic)
const measurementTabsRegex = /{isMeasurementView && \(\s*<div className="flex border-b border-gray-200 bg-gray-50 px-4 overflow-x-auto">[\s\S]*?<\/div>\s*\)}/m;
const measurementTabsMatch = content.match(measurementTabsRegex);
if (measurementTabsMatch) {
    let archiveTabs = measurementTabsMatch[0]
        .replace(/isMeasurementView/g, 'isArchiveMeasurementView')
        .replace(/'all_records'/g, "'archive_records'")
        .replace(/'assign_tasks'/g, "'archive_assign_tasks'")
        .replace(/'completed_list'/g, "'archive_completed_list'")
        .replace(/'pending_check_list'/g, "'archive_pending_check_list'")
        .replace(/'check_list'/g, "'archive_check_list'")
        .replace(/'director_completed'/g, "'archive_director_completed'")
        .replace(/'handover_list'/g, "'archive_handover_list'");
    
    content = content.replace(measurementTabsMatch[0], measurementTabsMatch[0] + '\n\n                {/* SUB-HEADER TABS FOR ARCHIVE RECORDS */}\n                ' + archiveTabs);
}

// 4. Update the rest of the file where currentView checks contain handover_list etc.
content = content.replace(/currentView === 'handover_list' \|\| currentView === 'other_handover_list'/g, "currentView === 'handover_list' || currentView === 'other_handover_list' || currentView === 'archive_handover_list'");
content = content.replace(/currentView !== 'handover_list' && currentView !== 'other_handover_list'/g, "currentView !== 'handover_list' && currentView !== 'other_handover_list' && currentView !== 'archive_handover_list'");
content = content.replace(/currentView === 'all_records' \|\| currentView === 'other_records'/g, "currentView === 'all_records' || currentView === 'other_records' || currentView === 'archive_records'");
content = content.replace(/currentView !== 'all_records' && currentView !== 'other_records'/g, "currentView !== 'all_records' && currentView !== 'other_records' && currentView !== 'archive_records'");
content = content.replace(/currentView === 'assign_tasks' \|\| currentView === 'other_assign_tasks'/g, "currentView === 'assign_tasks' || currentView === 'other_assign_tasks' || currentView === 'archive_assign_tasks'");
content = content.replace(/currentView !== 'assign_tasks' && currentView !== 'other_assign_tasks'/g, "currentView !== 'assign_tasks' && currentView !== 'other_assign_tasks' && currentView !== 'archive_assign_tasks'");
content = content.replace(/currentView === 'check_list' \|\| currentView === 'other_check_list'/g, "currentView === 'check_list' || currentView === 'other_check_list' || currentView === 'archive_check_list'");
content = content.replace(/currentView === 'completed_list'/g, "(currentView === 'completed_list' || currentView === 'archive_completed_list')");
content = content.replace(/currentView === 'pending_check_list'/g, "(currentView === 'pending_check_list' || currentView === 'archive_pending_check_list')");

// Delete 'archive_records' switch case
content = content.replace(/case 'archive_records':\s+return \(\s+<SaoLucView currentUser={currentUser} wards={wards} \/>\s+\);\n/g, "");

fs.writeFileSync('components/AppRoutes.tsx', content);
