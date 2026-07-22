import express, { Request, Response, NextFunction } from 'express';
// @ts-ignore
import jsonServer from 'json-server';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const server = jsonServer.create();
let dbFile = process.env.DB_PATH || path.join(__dirname, 'server/db.json');

// In production (Cloud Run), the filesystem is read-only except for /tmp
if (process.env.NODE_ENV === 'production') {
    dbFile = '/tmp/db.json';
    // Copy initial db.json to /tmp if it doesn't exist
    const initialDbFile = path.join(__dirname, 'server/db.json');
    if (!fs.existsSync(dbFile) && fs.existsSync(initialDbFile)) {
        fs.copyFileSync(initialDbFile, dbFile);
    }
}

const router = jsonServer.router(dbFile);
const middlewares = jsonServer.defaults();

// --- TỐI ƯU HÓA TỐC ĐỘ CẬP NHẬT ---
let releaseDir = path.join(__dirname, 'release');
if (!fs.existsSync(releaseDir)) {
    // Thử tìm ở thư mục gốc project (khi chạy dev)
    releaseDir = path.join(__dirname, 'release');
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

// Use default middlewares (logger, static, cors and no-cache)
server.use(middlewares);
server.use(jsonServer.bodyParser);

// Middleware hiển thị log (Chỉ log các request API, không log file tĩnh nữa do đã khai báo static ở trên)
server.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
        if (res.statusCode >= 400 || req.url.includes('App.tsx')) {
            console.log(`[REQ] ${req.method} ${req.url} - ${res.statusCode} (${Date.now() - start}ms)`);
        }
    });
    next();
});

// Custom Routes
server.post('/api/backup', (req: Request, res: Response) => {
    try {
        const { backupData, customDirectory } = req.body;
        if (!backupData) {
            return res.status(400).json({ error: "Thiếu dữ liệu sao lưu." });
        }
        
        let targetDir = customDirectory ? customDirectory.trim() : '';
        if (!targetDir) {
            targetDir = path.join(__dirname, 'server/backups');
        }
        
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }
        
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const fileName = `sao_luu_he_thong_${dateStr}_${now.getTime()}.json`;
        const filePath = path.join(targetDir, fileName);
        
        fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2));
        console.log(`[AN TOAN] Da sao luu du lieu thanh cong vao thu muc chi dinh: ${filePath}`);
        
        res.json({ 
            success: true, 
            message: "Sao lưu thành công", 
            filePath: filePath,
            fileName: fileName
        });
    } catch (error: any) {
        console.error("Loi khi thuc hien ghi file sao luu:", error);
        res.status(500).json({ 
            error: "Lỗi ghi file trên hệ thống", 
            details: error.message 
        });
    }
});

server.post('/api/backup/restore', (req: Request, res: Response) => {
    try {
        const { backupData } = req.body;
        if (!backupData || !backupData.data) {
            return res.status(400).json({ error: "Dữ liệu sao lưu không đúng định dạng." });
        }
        
        const db = router.db;
        // Ghi đè toàn bộ db.json bằng dữ liệu sao lưu
        db.setState(backupData.data).write();
        
        res.json({ 
            success: true, 
            message: "Khôi phục dữ liệu hệ thống thành công!" 
        });
    } catch (error: any) {
        console.error("Loi khi khoi phuc du lieu tu sao luu:", error);
        res.status(500).json({ 
            error: "Lỗi khôi phục dữ liệu trên server", 
            details: error.message 
        });
    }
});

server.post('/custom/bulk', (req: Request, res: Response) => {
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

server.post('/custom/update-missing', (req: Request, res: Response) => {
    const db = router.db;
    const incomingData = req.body;
    if (Array.isArray(incomingData)) {
        try {
            const dbRecords = db.get('records').value();
            let updatedCount = 0;
            dbRecords.forEach((dbRecord: any) => {
                const match = incomingData.find((i: any) => i.code && dbRecord.code && i.code.toString().trim() === dbRecord.code.toString().trim());
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

server.post('/system/reset', (req: Request, res: Response) => {
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

server.post('/custom/counters', (req: Request, res: Response) => {
    try {
        const db = router.db;
        db.set('excerpt_counters', req.body).write();
        res.jsonp(req.body);
    } catch (error) {
        res.status(500).jsonp({ error: "Lỗi." });
    }
});

// Vite middleware setup
const startServer = async () => {
    if (process.env.NODE_ENV !== 'production') {
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: 'spa',
        });
        server.use(vite.middlewares);
    } else {
        const distPath = path.join(__dirname, 'dist');
        server.use(express.static(distPath));
        
        // SPA fallback for HTML requests
        server.use((req: Request, res: Response, next: NextFunction) => {
            if (req.method === 'GET' && req.headers.accept?.includes('text/html')) {
                res.sendFile(path.join(distPath, 'index.html'));
            } else {
                next();
            }
        });
    }

    // Use router AFTER custom routes and Vite middleware (for API fallback)
    // Ideally, API should be under /api prefix, but current frontend expects root.
    // json-server router handles requests matching db.json keys.
    server.use(router);

    const PORT = 3000;
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
};

startServer();
