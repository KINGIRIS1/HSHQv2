
const jsonServer = require('json-server');
const path = require('path');
const fs = require('fs');
let express;
try {
  express = require('express');
} catch (error) {
  console.error("Error: Cannot find module 'express'.");
  console.error("Please run 'cd server && npm install' to install dependencies.");
  process.exit(1);
}

// Lấy đường dẫn DB từ biến môi trường (do Electron truyền vào) hoặc mặc định tại thư mục hiện tại
// DB_PATH được Electron set vào thư mục AppData của người dùng để có quyền Ghi
const dbFile = process.env.DB_PATH || path.join(__dirname, 'db.json');

console.log(`Dang su dung Database tai: ${dbFile}`);

const server = jsonServer.create();
const router = jsonServer.router(dbFile);
const middlewares = jsonServer.defaults();

// --- TỐI ƯU HÓA TỐC ĐỘ CẬP NHẬT ---
// Đưa cấu hình Static File lên TRƯỚC các middleware mặc định.
// Điều này giúp việc tải file bỏ qua Logger và BodyParser, tăng tốc độ đáng kể.
let releaseDir = path.join(__dirname, '../release');
if (!fs.existsSync(releaseDir)) {
    // Thử tìm ở thư mục gốc project (khi chạy dev)
    releaseDir = path.join(__dirname, '../../release');
}
console.log(`Update Server path: ${releaseDir}`);
server.use('/updates', express.static(releaseDir));
// ------------------------------------

// --- TỰ ĐỘNG SAO LƯU (AUTO BACKUP) ---
try {
    if (fs.existsSync(dbFile)) {
        const backupDir = path.join(path.dirname(dbFile), 'backups');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }
        
        const now = new Date();
        const timeStr = now.toISOString().replace(/T/, '-').replace(/:/g, '-').split('.')[0];
        const backupFile = path.join(backupDir, `db-${timeStr}.json`);
        
        fs.copyFileSync(dbFile, backupFile);
        console.log(`[AN TOAN] Da tu dong sao luu du lieu tai: backups/db-${timeStr}.json`);

        const files = fs.readdirSync(backupDir);
        if (files.length > 20) {
            files.sort((a, b) => {
                return fs.statSync(path.join(backupDir, b)).mtime.getTime() - 
                       fs.statSync(path.join(backupDir, a)).mtime.getTime();
            });
            const fileToDelete = path.join(backupDir, files[files.length - 1]);
            fs.unlinkSync(fileToDelete);
            console.log(`[DON DEP] Da xoa ban sao luu cu: ${fileToDelete}`);
        }
    }
} catch (err) {
    console.error("[LOI] Khong the sao luu du lieu tu dong:", err);
}
// -------------------------------------

// Dữ liệu mặc định
const DEFAULT_DATA = {
    records: [], 
    excerpt_history: [],
    excerpt_counters: { "Tân Khai": 0, "Tân Quan": 0, "Minh Đức": 0, "Tân Hưng": 0 },
    employees: [],
    users: [{ username: 'admin', password: '123', name: 'Administrator', role: 'ADMIN' }]
};

if (!fs.existsSync(dbFile)) {
    console.log("Khoi tao co so du lieu ban dau...");
    const dir = path.dirname(dbFile);
    if (!fs.existsSync(dir)){ fs.mkdirSync(dir, { recursive: true }); }
    fs.writeFileSync(dbFile, JSON.stringify(DEFAULT_DATA, null, 2));
}

server.use(middlewares);
server.use(jsonServer.bodyParser);

// Middleware hiển thị log (Chỉ log các request API, không log file tĩnh nữa do đã khai báo static ở trên)
server.use((req, res, next) => {
    if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
        console.log(`${new Date().toLocaleTimeString()} - ${req.method} request received`);
    }
    next();
});

// Custom Routes
server.post('/custom/bulk', (req, res) => {
    const db = router.db;
    const data = req.body;
    if (Array.isArray(data)) {
        try {
            const records = db.get('records').value();
            const newRecords = records.concat(data);
            db.set('records', newRecords).write();
            res.jsonp({ success: true, count: data.length });
        } catch (error) {
            res.status(500).jsonp({ error: "Lỗi Server." });
        }
    } else {
        res.status(400).jsonp({ error: "Dữ liệu sai." });
    }
});

server.post('/custom/update-missing', (req, res) => {
    const db = router.db;
    const incomingData = req.body;
    if (Array.isArray(incomingData)) {
        try {
            const dbRecords = db.get('records').value();
            let updatedCount = 0;
            dbRecords.forEach(dbRecord => {
                const match = incomingData.find(i => i.code && dbRecord.code && i.code.toString().trim() === dbRecord.code.toString().trim());
                if (match) {
                    let changed = false;
                    Object.keys(match).forEach(key => {
                        if (key === 'id' || key === 'status') return;
                        const dbVal = dbRecord[key];
                        const matchVal = match[key];
                        const isDbEmpty = dbVal === null || dbVal === undefined || dbVal === '' || dbVal === 'Nhập từ Excel';
                        const isMatchHasData = matchVal !== null && matchVal !== undefined && matchVal !== '';
                        if (isDbEmpty && isMatchHasData) {
                            dbRecord[key] = matchVal;
                            changed = true;
                        }
                    });
                    if (changed) updatedCount++;
                }
            });
            if (updatedCount > 0) db.write();
            res.jsonp({ success: true, count: updatedCount });
        } catch (error) {
            res.status(500).jsonp({ error: "Lỗi Server." });
        }
    } else {
        res.status(400).jsonp({ error: "Dữ liệu sai." });
    }
});

server.post('/system/reset', (req, res) => {
    try {
        const db = router.db;
        const currentEmployees = db.get('employees').value();
        const currentUsers = db.get('users').value();
        const currentCounters = db.get('excerpt_counters').value();
        const initialData = { records: [], excerpt_history: [], excerpt_counters: currentCounters, employees: currentEmployees, users: currentUsers };
        db.setState(initialData).write();
        res.jsonp({ success: true });
    } catch (error) {
        res.status(500).jsonp({ error: "Lỗi Server." });
    }
});

server.post('/custom/counters', (req, res) => {
    try {
        const db = router.db;
        db.set('excerpt_counters', req.body).write();
        res.jsonp(req.body);
    } catch (error) {
        res.status(500).jsonp({ error: "Lỗi." });
    }
});

server.use(router);

// ĐỔI PORT TỪ 3000 -> 3005 ĐỂ TRÁNH XUNG ĐỘT
const PORT = 3005;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Update feed available at: http://localhost:${PORT}/updates`);
});
