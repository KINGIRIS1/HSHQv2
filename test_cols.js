const fs = require('fs');
const content = fs.readFileSync('services/apiRecords.ts', 'utf8');
const req = content.match(/RECORD_DB_COLUMNS = \[[\s\S]*?\];/)[0];
const opt = content.match(/OPTIONAL_NEW_COLUMNS = \[[\s\S]*?\];/)[0];

const extract = (str) => {
  const matches = str.match(/'([^']+)'/g);
  return matches ? matches.map(m => m.replace(/'/g, '')) : [];
};

const reqCols = extract(req);
const optCols = extract(opt);

const standard = ['id', 'code', 'customerName', 'phoneNumber', 'cccd', 'ward', 'landPlot', 'mapSheet', 
    'area', 'address', 'group', 'content', 'recordType', 'receivedDate', 'receivedBy', 'deadline', 
    'assignedDate', 'submissionDate', 'approvalDate', 'completedDate', 'status', 'assignedTo', 'submittedTo', 
    'notes'];

reqCols.forEach(col => {
  if (!standard.includes(col) && !optCols.includes(col)) {
     console.log('MISSING FROM OPTIONAL:', col);
  }
});
