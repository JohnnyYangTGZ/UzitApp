const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const downloadsDir = 'C:\\Users\\jyang\\Downloads';
const files = [
  'FINAL UC 2.0 STAFFING.xlsx',
  'SFO - Urgent Care vacation_schedule 2026.xlsx',
  'URGENT CARE_(WEEK-1_template).xlsm',
  'URGENT CARE_(WEEK-2_template).xlsm',
  'Urgent Care staff by role and seniority.xlsx'
];

files.forEach(file => {
  console.log(`\n======================================`);
  console.log(`Analyzing: ${file}`);
  const filePath = path.join(downloadsDir, file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }
  
  try {
    const workbook = xlsx.readFile(filePath);
    console.log(`Sheet Names: ${workbook.SheetNames.join(', ')}`);
    
    workbook.SheetNames.forEach(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      // Convert to JSON and print first 5 rows
      const json = xlsx.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
      console.log(`\n--- Sheet: ${sheetName} ---`);
      if (json.length === 0) {
         console.log("Empty sheet.");
      } else {
         console.log(`Total Rows: ${json.length}`);
         const limit = Math.min(json.length, 10);
         console.log(`First ${limit} rows:`);
         for (let i = 0; i < limit; i++) {
           console.log(JSON.stringify(json[i]));
         }
      }
    });
  } catch (err) {
    console.log(`Error reading file: ${err.message}`);
  }
});
