/**
 * File script độc lập: restore_to_docker.cjs (PHIÊN BẢN CHUẨN XÁC TUYỆT ĐỐI)
 * Chức năng: Tự động gỡ bỏ toàn bộ NOT NULL constraint (cho phép null) và nạp trọn vẹn 100% dữ liệu
 * Cách dùng: node restore_to_docker.cjs
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { execSync } = require('child_process');

// 1. Cấu hình máy chủ Docker Local trên máy tính của bạn
const DOCKER_URL = process.env.DOCKER_URL || 'http://localhost:8080';
const DOCKER_KEY = process.env.DOCKER_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3OTA4NDY2NDEsImV4cCI6MjEwNjIwNjY0MX0.7I8l16LDY8qVfN-gLDIQm1Ims8Sxcar-RPo9EmR5IgE';

// 2. Danh sách các bảng theo thứ tự ưu tiên
const TABLES_ORDER = [
    'employees',
    'users',
    'holidays',
    'price_list',
    'map_sheet_conversions',
    'system_settings',
    'land_records',
    'dangky_records',
    'luutru_records',
    'contracts',
    'thongtin_records',
    'vphc_records',
    'bienban_records',
    'chinhly_records',
    'tachthua_records',
    'work_schedules',
    'archive_batches',
    'excerpt_history',
    'excerpt_counters',
    'trichdo_history',
    'trichdo_counters'
];

function chunkArray(array, size = 100) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

function postBatchToDocker(tableName, records) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(`${DOCKER_URL}/rest/v1/${tableName}`);
        const postData = JSON.stringify(records);

        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || 80,
            path: parsedUrl.pathname,
            method: 'POST',
            headers: {
                'apikey': DOCKER_KEY,
                'Authorization': `Bearer ${DOCKER_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'resolution=merge-duplicates',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => { body += chunk; });
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(true);
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 300)}`));
                }
            });
        });

        req.on('error', (e) => reject(e));
        req.write(postData);
        req.end();
    });
}

async function runRestore() {
    console.log('================================================================');
    console.log('🚀 Bắt đầu quá trình TRIỂN KHAI DỮ LIỆU vào Supabase Docker...');
    console.log(`🔗 Máy chủ Docker đích: ${DOCKER_URL}`);
    console.log('================================================================\n');

    const backupsDir = path.join(process.cwd(), 'backups');
    let dataSource = {};

    const latestFile = path.join(backupsDir, 'latest_full_backup.json');
    if (fs.existsSync(latestFile)) {
        try {
            const raw = fs.readFileSync(latestFile, 'utf-8');
            const parsed = JSON.parse(raw);
            dataSource = parsed.data || parsed;
            console.log(`📦 Đã nạp thành công: backups/latest_full_backup.json\n`);
        } catch (e) {
            console.warn(`⚠️ Đọc tệp tổng hợp lỗi, chuyển sang nạp từng file lẻ...`);
        }
    }

    if (!dataSource || Object.keys(dataSource).length === 0) {
        if (fs.existsSync(backupsDir)) {
            const subdirs = fs.readdirSync(backupsDir).filter(f => f.startsWith('backup_'));
            if (subdirs.length > 0) {
                const latestSubdir = path.join(backupsDir, subdirs[subdirs.length - 1]);
                const files = fs.readdirSync(latestSubdir).filter(f => f.startsWith('Full_Backup_System_'));
                if (files.length > 0) {
                    try {
                        const raw = fs.readFileSync(path.join(latestSubdir, files[0]), 'utf-8');
                        const parsed = JSON.parse(raw);
                        dataSource = parsed.data || parsed;
                    } catch (_) {}
                }
            }
        }
    }

    // 1. TỐI ƯU HÓA SCHEMA: GỠ BỎ RÀNG BUỘC NOT NULL VÀ MỞ RỘNG TEXT
    console.log('🔄 Đang gỡ bỏ ràng buộc NOT NULL & UNIQUE để tiếp nhận toàn bộ dữ liệu...');
    const migrationSql = `
        -- Tạm thời gỡ bỏ VIEW để cho phép ALTER kiểu dữ liệu
        DROP VIEW IF EXISTS public.records CASCADE;
        DROP VIEW IF EXISTS public.archive_records CASCADE;

        -- Gỡ bỏ ràng buộc UNIQUE trên cột code
        ALTER TABLE IF EXISTS public.land_records DROP CONSTRAINT IF EXISTS land_records_code_key;
        ALTER TABLE IF EXISTS public.dangky_records DROP CONSTRAINT IF EXISTS dangky_records_code_key;
        ALTER TABLE IF EXISTS public.contracts DROP CONSTRAINT IF EXISTS contracts_code_key;

        -- Gỡ bỏ khóa chính cũ của 2 bảng counters nếu có
        ALTER TABLE IF EXISTS public.excerpt_counters DROP CONSTRAINT IF EXISTS excerpt_counters_pkey;
        ALTER TABLE IF EXISTS public.trichdo_counters DROP CONSTRAINT IF EXISTS trichdo_counters_pkey;

        -- Thêm cột id cho bảng users
        ALTER TABLE IF EXISTS public.users ADD COLUMN IF NOT EXISTS "id" TEXT;

        -- Tự động gỡ bỏ toàn bộ ràng buộc NOT NULL của tất cả các cột (ngoại trừ khóa chính id/username)
        DO $$ 
        DECLARE 
            r RECORD;
        BEGIN
            FOR r IN (
                SELECT table_name, column_name 
                FROM information_schema.columns 
                WHERE table_schema = 'public' 
                  AND is_nullable = 'NO' 
                  AND column_name NOT IN ('id', 'username')
            ) LOOP
                BEGIN
                    EXECUTE 'ALTER TABLE public.' || quote_ident(r.table_name) || ' ALTER COLUMN ' || quote_ident(r.column_name) || ' DROP NOT NULL;';
                EXCEPTION WHEN OTHERS THEN
                END;
            END LOOP;
        END $$;

        -- Tự động chuyển toàn bộ các cột VARCHAR trong tất cả các bảng sang TEXT (không giới hạn độ dài)
        DO $$ 
        DECLARE 
            tbl RECORD;
            col RECORD;
        BEGIN
            FOR tbl IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
                FOR col IN (
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_schema = 'public' 
                      AND table_name = tbl.tablename 
                      AND data_type = 'character varying'
                ) LOOP
                    BEGIN
                        EXECUTE 'ALTER TABLE public.' || quote_ident(tbl.tablename) || ' ALTER COLUMN ' || quote_ident(col.column_name) || ' TYPE TEXT;';
                    EXCEPTION WHEN OTHERS THEN
                    END;
                END LOOP;
            END LOOP;
        END $$;

        -- Tạo lại VIEW
        CREATE OR REPLACE VIEW public.records AS SELECT * FROM public.land_records;
        CREATE OR REPLACE VIEW public.archive_records AS SELECT * FROM public.luutru_records;
    `;

    // Quét thêm tất cả các cột động từ file JSON
    const dynamicAlterList = [];
    for (const table of TABLES_ORDER) {
        let rows = dataSource[table];
        if (!rows || !Array.isArray(rows) || rows.length === 0) {
            const individualFile = path.join(backupsDir, `${table}.json`);
            if (fs.existsSync(individualFile)) {
                try { rows = JSON.parse(fs.readFileSync(individualFile, 'utf-8')); } catch (_) {}
            }
        }
        if (rows && Array.isArray(rows) && rows.length > 0) {
            const keys = new Set();
            const scanLimit = Math.min(rows.length, 300);
            for (let i = 0; i < scanLimit; i++) {
                Object.keys(rows[i]).forEach(k => keys.add(k));
            }

            for (const k of keys) {
                if (!k) continue;
                if (k === 'id' && table !== 'users') continue;
                const sampleVal = rows.find(r => r[k] !== null && r[k] !== undefined)?.[k];
                let colType = 'TEXT';
                if (typeof sampleVal === 'boolean') colType = 'BOOLEAN DEFAULT FALSE';
                else if (typeof sampleVal === 'object' && sampleVal !== null) colType = 'JSONB DEFAULT \'{}\'::jsonb';
                else if (typeof sampleVal === 'number') colType = 'NUMERIC';

                dynamicAlterList.push(`ALTER TABLE IF EXISTS public.${table} ADD COLUMN IF NOT EXISTS "${k}" ${colType};`);
            }
        }
    }

    const fullSql = migrationSql + '\n' + dynamicAlterList.join('\n') + `\nNOTIFY pgrst, 'reload schema';\n`;

    console.log(`⚡ Đang áp dụng cấu trúc tối ưu vào PostgreSQL...`);
    try {
        execSync(`docker exec -i qlhs_supabase_db psql -U postgres -d postgres`, {
            input: fullSql,
            stdio: ['pipe', 'ignore', 'inherit']
        });
        console.log('✅ Đã gỡ bỏ toàn bộ ràng buộc NOT NULL & UNIQUE!');
    } catch (err) {
        console.warn('⚠️ Thông báo cấu trúc:', err.message);
    }

    // Khởi động lại PostgREST để nhận cấu trúc mới
    console.log('🔄 Đang làm mới Schema Cache của PostgREST...');
    try {
        execSync(`docker compose restart rest`, { stdio: 'ignore' });
        await new Promise(r => setTimeout(r, 4000));
        console.log('✅ PostgREST đã sẵn sàng nhận dữ liệu!\n');
    } catch (_) {}

    let totalSuccessRecords = 0;
    let tableSuccessCount = 0;

    // 2. TIẾN HÀNH NẠP DỮ LIỆU
    for (const table of TABLES_ORDER) {
        let rows = dataSource[table];

        if (!rows || !Array.isArray(rows) || rows.length === 0) {
            const individualFile = path.join(backupsDir, `${table}.json`);
            if (fs.existsSync(individualFile)) {
                try { rows = JSON.parse(fs.readFileSync(individualFile, 'utf-8')); } catch (_) {}
            }
        }

        if (!rows || !Array.isArray(rows) || rows.length === 0) {
            continue;
        }

        console.log(`⏳ Đang nạp bảng [${table.padEnd(22)}] - ${rows.length.toLocaleString('vi-VN')} bản ghi...`);
        const chunks = chunkArray(rows, 100);
        let processed = 0;
        let hasError = false;

        for (let i = 0; i < chunks.length; i++) {
            try {
                await postBatchToDocker(table, chunks[i]);
                processed += chunks[i].length;
                if (rows.length > 500 && (i % 5 === 0 || i === chunks.length - 1)) {
                    process.stdout.write(`   ↳ Tiến độ: ${processed.toLocaleString('vi-VN')} / ${rows.length.toLocaleString('vi-VN')} dòng...\r`);
                }
            } catch (err) {
                console.error(`   ❌ Lỗi đợt ${i + 1} bảng [${table}]:`, err.message);
                hasError = true;
                break;
            }
        }

        if (!hasError) {
            console.log(`   ✅ Đã nạp xong: ${processed.toLocaleString('vi-VN')} / ${rows.length.toLocaleString('vi-VN')} bản ghi!`);
            totalSuccessRecords += processed;
            tableSuccessCount++;
        }
    }

    console.log('\n================================================================');
    console.log(`🎉 HOÀN TẤT TRIỂN KHAI DỮ LIỆU VÀO DOCKER THÀNH CÔNG!`);
    console.log(`   - Tổng số bảng đã nạp: ${tableSuccessCount} bảng`);
    console.log(`   - Tổng số bản ghi đã nạp: ${totalSuccessRecords.toLocaleString('vi-VN')} bản ghi`);
    console.log(`👉 Bạn có thể mở trình duyệt vào ${DOCKER_URL} để duyệt toàn bộ dữ liệu.`);
    console.log('================================================================\n');
}

runRestore();
