/**
 * File script độc lập KHÔNG CẦN CÀI ĐẶT THƯ VIỆN: backup_supabase.cjs
 * Hoạt động trực tiếp trên mọi máy tính đã có Node.js (Node 18+) mà không cần npm install!
 * Cách dùng: node backup_supabase.cjs
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

// 1. Cấu hình địa chỉ Server và Khóa kết nối Supabase
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lrnfdksqepztnihrkgrr.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                     process.env.SUPABASE_KEY || 
                     process.env.SUPABASE_ANON_KEY || 
                     'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxybmZka3NxZXB6dG5paHJrZ3JyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4Njk1NzQsImV4cCI6MjA5MjQ0NTU3NH0.eIif2yiYZ8RwdoVLjHXBc73ookcWWEIqF_om7O-Eso8';

// 2. Danh sách toàn bộ các bảng dữ liệu của hệ thống QLHS
const TABLES = [
    'land_records',           // Hồ sơ đo đạc / tiếp nhận chính
    'dangky_records',         // Hồ sơ đăng ký / cấp giấy
    'luutru_records',         // Hồ sơ lưu trữ (vào sổ, sao lục, công văn)
    'contracts',              // Hợp đồng dịch vụ
    'thongtin_records',       // Dữ liệu ngăn chặn & thông tin đất đai
    'vphc_records',           // Biên bản vi phạm hành chính
    'bienban_records',        // Biên bản bàn giao & mượn trả
    'chinhly_records',        // Chỉnh lý bản đồ
    'tachthua_records',       // Tách thửa / hợp thửa
    'work_schedules',         // Lịch công tác cán bộ
    'employees',              // Danh sách cán bộ nhân viên
    'users',                  // Tài khoản người dùng hệ thống
    'holidays',               // Lịch nghỉ lễ tết
    'archive_batches',        // Đợt bàn giao lưu trữ
    'map_sheet_conversions',  // Chuyển đổi tờ bản đồ cũ / mới
    'price_list',             // Bảng giá dịch vụ
    'system_settings',        // Cấu hình hệ thống
    'excerpt_history',        // Lịch sử cấp số trích lục
    'excerpt_counters',       // Bộ đếm số trích lục
    'trichdo_history',        // Lịch sử cấp số trích đo
    'trichdo_counters',       // Bộ đếm số trích đo
    'messages',               // Tin nhắn nội bộ
    'archive_records'
];

// Hàm gọi HTTP REST API thuần túy (Không phụ thuộc thư viện ngoài)
function requestPostgrest(tableName, from, to) {
    return new Promise((resolve, reject) => {
        const urlStr = `${SUPABASE_URL}/rest/v1/${tableName}?select=*`;
        const parsedUrl = new URL(urlStr);

        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || 443,
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'GET',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Range-Unit': 'items',
                'Range': `${from}-${to}`,
                'Prefer': 'count=exact',
                'Accept': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => { body += chunk; });
            res.on('end', () => {
                if (res.statusCode === 404 || res.statusCode === 400 && body.includes('does not exist')) {
                    return resolve({ notFound: true, data: [] });
                }
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        const parsed = JSON.parse(body);
                        resolve({ notFound: false, data: Array.isArray(parsed) ? parsed : [] });
                    } catch (e) {
                        reject(new Error(`Lỗi parse JSON: ${body.slice(0, 100)}`));
                    }
                } else if (res.statusCode === 416) {
                    // Range out of bounds => hết dữ liệu
                    resolve({ notFound: false, data: [] });
                } else {
                    try {
                        const errObj = JSON.parse(body);
                        if (errObj.message && (errObj.message.includes('schema cache') || errObj.message.includes('does not exist'))) {
                            return resolve({ notFound: true, data: [] });
                        }
                    } catch (_) {}
                    reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 200)}`));
                }
            });
        });

        req.on('error', (e) => reject(e));
        req.end();
    });
}

// 3. Hàm tải phân trang (Bỏ qua giới hạn 1000 dòng mặc định)
async function fetchAllRows(tableName) {
    let allData = [];
    const PAGE_SIZE = 1000;
    let from = 0;
    let hasMore = true;

    while (hasMore) {
        const to = from + PAGE_SIZE - 1;
        const result = await requestPostgrest(tableName, from, to);

        if (result.notFound) {
            return null; // Bảng không tồn tại
        }

        const data = result.data;
        if (!data || data.length === 0) {
            hasMore = false;
        } else {
            allData = allData.concat(data);
            if (data.length < PAGE_SIZE) {
                hasMore = false;
            } else {
                from += PAGE_SIZE;
            }
        }
    }

    return allData;
}

// 4. Tiến trình chính
async function runBackup() {
    console.log('================================================================');
    console.log('🚀 Bắt đầu quá trình Backup dữ liệu (Không cần cài đặt thư viện)...');
    console.log(`🔗 Supabase URL: ${SUPABASE_URL}`);
    console.log('================================================================\n');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const outputDir = path.join(process.cwd(), 'backups');
    const timeFolder = path.join(outputDir, `backup_${timestamp}`);

    if (!fs.existsSync(timeFolder)) {
        fs.mkdirSync(timeFolder, { recursive: true });
    }

    let successCount = 0;
    let notFoundCount = 0;
    let failCount = 0;

    const fullBackupPayload = {
        backup_time: new Date().toISOString(),
        version: '2.1.1',
        source_url: SUPABASE_URL,
        data: {}
    };

    for (const table of TABLES) {
        process.stdout.write(`⏳ Đang tải bảng [${table.padEnd(22)}] ... `);
        try {
            const rows = await fetchAllRows(table);

            if (rows === null) {
                console.log(`⏩ Bỏ qua (Bảng chưa có dữ liệu trên Cloud)`);
                notFoundCount++;
                continue;
            }

            const filePath = path.join(timeFolder, `${table}.json`);
            fs.writeFileSync(filePath, JSON.stringify(rows, null, 2), 'utf-8');

            const stats = fs.statSync(filePath);
            const sizeKB = (stats.size / 1024).toFixed(1);
            console.log(`✅ ${rows.length.toString().padStart(5)} dòng (${sizeKB.padStart(8)} KB) -> ${table}.json`);

            fullBackupPayload.data[table] = rows;
            if (table === 'land_records') fullBackupPayload.data['records'] = rows;
            if (table === 'luutru_records') {
                fullBackupPayload.data['archive_vaoso'] = rows.filter(r => r.type === 'vaoso');
                fullBackupPayload.data['archive_saoluc'] = rows.filter(r => r.type === 'saoluc');
                fullBackupPayload.data['archive_congvan'] = rows.filter(r => r.type === 'congvan');
            }

            successCount++;
        } catch (err) {
            console.log(`❌ Thất bại: ${err?.message}`);
            failCount++;
        }
    }

    const masterBackupPath = path.join(timeFolder, `Full_Backup_System_${timestamp}.json`);
    fs.writeFileSync(masterBackupPath, JSON.stringify(fullBackupPayload, null, 2), 'utf-8');

    const latestBackupPath = path.join(outputDir, 'latest_full_backup.json');
    fs.writeFileSync(latestBackupPath, JSON.stringify(fullBackupPayload, null, 2), 'utf-8');

    console.log('\n================================================================');
    console.log(`🎉 HOÀN TẤT SAO LƯU:`);
    console.log(`   - Thành công: ${successCount} bảng`);
    console.log(`📁 Thư mục lưu trữ: ${timeFolder}`);
    console.log(`⭐ Tệp Full Backup để nạp vào giao diện phần mềm:`);
    console.log(`   👉 ${latestBackupPath}`);
    console.log('================================================================\n');
}

runBackup();
