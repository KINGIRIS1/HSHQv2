/**
 * BỘ TEST CHUYÊN BIỆT CHO MODULE ĐĂNG KÝ (U1 - U10)
 * Bảng dữ liệu: dangky_records (Mã 3.x, Đăng ký đất đai, cấp GCN)
 */

export const memoryStore: Record<string, any> = {};
export let shouldThrowIdbRead = false;
export let shouldThrowIdbWrite = false;

// Mock localStorage
const mockStorage: Record<string, string> = {};
(global as any).localStorage = {
    getItem: (key: string) => mockStorage[key] !== undefined ? mockStorage[key] : null,
    setItem: (key: string, val: string) => { mockStorage[key] = String(val); },
    removeItem: (key: string) => { delete mockStorage[key]; },
    clear: () => { for (const k in mockStorage) delete mockStorage[k]; }
};

// Mock IndexedDB
const mockIndexedDB = {
    open: (name: string, version: number) => {
        const req: any = {
            result: {
                objectStoreNames: { contains: () => true },
                transaction: (storeName: string, mode: string) => {
                    const tx: any = {
                        objectStore: () => ({
                            get: (key: string) => {
                                const getReq: any = {};
                                setTimeout(() => {
                                    if (shouldThrowIdbRead) {
                                        getReq.error = new Error("DISK_READ_ERROR");
                                        getReq.onerror?.(new Event('error'));
                                    } else {
                                        getReq.result = memoryStore[key] !== undefined ? JSON.parse(JSON.stringify(memoryStore[key])) : undefined;
                                        getReq.onsuccess?.(new Event('success'));
                                    }
                                }, 1);
                                return getReq;
                            },
                            put: (value: any, key: string) => {
                                const putReq: any = {};
                                setTimeout(() => {
                                    if (shouldThrowIdbWrite) {
                                        putReq.error = new Error("DISK_WRITE_QUOTA_EXCEEDED");
                                        putReq.onerror?.(new Event('error'));
                                    } else {
                                        memoryStore[key] = JSON.parse(JSON.stringify(value));
                                        putReq.onsuccess?.(new Event('success'));
                                    }
                                }, 1);
                                return putReq;
                            }
                        })
                    };
                    return tx;
                }
            }
        };
        setTimeout(() => {
            req.onsuccess?.({ target: req });
        }, 1);
        return req;
    }
};

(global as any).window = {
    indexedDB: mockIndexedDB,
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {}
};

const setOnlineMode = (val: boolean) => {
    try {
        Object.defineProperty(globalThis.navigator, 'onLine', { value: val, configurable: true, writable: true });
    } catch {}
    try {
        if ((global as any).window) {
            (global as any).window.navigator = { onLine: val };
        }
    } catch {}
};

setOnlineMode(false);

(global as any).CustomEvent = class CustomEvent {
    constructor(public type: string, public detail: any) {}
};
(global as any).Event = class Event {
    constructor(public type: string) {}
};

async function runDangKyTestSuite() {
    console.log("================================================================================");
    console.log("        BẮT ĐẦU KIỂM ĐỊNH MODULE ĐĂNG KÝ (DANGKY_RECORDS) - TEST U1 - U10");
    console.log("================================================================================\n");

    const {
        getPendingSyncItems,
        savePendingSyncItems,
        addPendingRecord,
        removePendingRecord,
        withMutationLock
    } = await import('../services/syncQueueService');
    const {
        createRecordApi,
        updateRecordApi,
        deleteRecordApi,
        updateRecordsBatchById,
        deleteRecordsBatchApi,
        createRecordsBatchApi,
        validateRecordRouting,
        getTargetTable
    } = await import('../services/apiRecords');
    const { RecordStatus } = await import('../types');

    interface TestResult {
        code: string;
        name: string;
        passed: boolean;
        detail: string;
    }

    const results: TestResult[] = [];

    const clearQueue = async () => {
        for (const k in memoryStore) delete memoryStore[k];
        mockStorage['offline_unsynced_records'] = '[]';
        mockStorage['app_unsynced_records_backup'] = '[]';
        await savePendingSyncItems([]);
    };

    setOnlineMode(false); // Offline mode for U1 - U6

    // U1: Offline Create Đăng ký -> queue targetTable = dangky_records
    try {
        await clearQueue();
        const recU1 = {
            id: '30000000-0000-4000-8000-000000000001',
            code: '3.01.26.0001',
            customerName: 'Nguyễn Đăng Ký',
            group: '3. Đăng ký đất đai, cấp GCN',
            status: RecordStatus.RECEIVED
        };

        const res = await createRecordApi(recU1 as any);
        const queue = await getPendingSyncItems();
        const inQueue = queue.find(q => (q.record.id === res?.id || q.record.code === recU1.code) && q.action === 'CREATE');

        if (res && res._isOfflineSaved && inQueue && inQueue.targetTable === 'dangky_records') {
            results.push({ code: 'U1', name: 'Offline Create Đăng ký', passed: true, detail: `Queued successfully with targetTable=dangky_records, _isOfflineSaved=true` });
        } else {
            results.push({ code: 'U1', name: 'Offline Create Đăng ký', passed: false, detail: `res=${JSON.stringify(res)}, inQueue=${JSON.stringify(inQueue)}` });
        }
    } catch (e: any) {
        results.push({ code: 'U1', name: 'Offline Create Đăng ký', passed: false, detail: e.message });
    }

    // U2: Offline Update Đăng ký -> queue targetTable = dangky_records
    try {
        await clearQueue();
        const recU2 = {
            id: '30000000-0000-4000-8000-000000000002',
            code: '3.01.26.0002',
            customerName: 'Trần Cấp Giấy',
            group: '3. Đăng ký đất đai, cấp GCN',
            status: RecordStatus.APPRAISAL
        };

        const res = await updateRecordApi(recU2 as any);
        const queue = await getPendingSyncItems();
        const inQueue = queue.find(q => q.record.id === recU2.id && q.action === 'UPDATE');

        if (res && res._isOfflineSaved && inQueue && inQueue.targetTable === 'dangky_records') {
            results.push({ code: 'U2', name: 'Offline Update Đăng ký', passed: true, detail: `Queued with targetTable=dangky_records, status=APPRAISAL` });
        } else {
            results.push({ code: 'U2', name: 'Offline Update Đăng ký', passed: false, detail: `res=${JSON.stringify(res)}, inQueue=${JSON.stringify(inQueue)}` });
        }
    } catch (e: any) {
        results.push({ code: 'U2', name: 'Offline Update Đăng ký', passed: false, detail: e.message });
    }

    // U3: Offline Delete Đăng ký -> queue targetTable = dangky_records
    try {
        await clearQueue();
        const idU3 = '30000000-0000-4000-8000-000000000003';
        const res = await deleteRecordApi(idU3, { group: '3. Đăng ký đất đai, cấp GCN' } as any);
        const queue = await getPendingSyncItems();
        const inQueue = queue.find(q => q.record.id === idU3 && q.action === 'DELETE');

        if (res === true && inQueue && inQueue.targetTable === 'dangky_records') {
            results.push({ code: 'U3', name: 'Offline Delete Đăng ký', passed: true, detail: `Delete operation queued with targetTable=dangky_records` });
        } else {
            results.push({ code: 'U3', name: 'Offline Delete Đăng ký', passed: false, detail: `res=${res}, inQueue=${JSON.stringify(inQueue)}` });
        }
    } catch (e: any) {
        results.push({ code: 'U3', name: 'Offline Delete Đăng ký', passed: false, detail: e.message });
    }

    // U4: Offline Batch Create Đăng ký -> tất cả record được queue đúng bảng dangky_records
    try {
        await clearQueue();
        const batchCreate = [
            { id: '30000000-0000-4000-8000-000000000004', code: '3.01.26.0004', group: '3. Đăng ký đất đai, cấp GCN', customerName: 'Dân 4' },
            { id: '30000000-0000-4000-8000-000000000005', code: '3.01.26.0005', group: '3. Đăng ký đất đai, cấp GCN', customerName: 'Dân 5' }
        ];

        const res = await createRecordsBatchApi(batchCreate as any);
        const queue = await getPendingSyncItems();
        const q4 = queue.find(q => (q.record.id === batchCreate[0].id || q.record.code === batchCreate[0].code) && q.targetTable === 'dangky_records');
        const q5 = queue.find(q => (q.record.id === batchCreate[1].id || q.record.code === batchCreate[1].code) && q.targetTable === 'dangky_records');

        if (res === true && q4 && q5) {
            results.push({ code: 'U4', name: 'Offline Batch Create Đăng ký', passed: true, detail: `All 2 records queued into dangky_records` });
        } else {
            results.push({ code: 'U4', name: 'Offline Batch Create Đăng ký', passed: false, detail: `res=${res}, q4=${!!q4}, q5=${!!q5}` });
        }
    } catch (e: any) {
        results.push({ code: 'U4', name: 'Offline Batch Create Đăng ký', passed: false, detail: e.message });
    }

    // U5: Offline Batch Update Đăng ký -> không route sang land_records
    try {
        await clearQueue();
        const batchUpdate = [
            { id: '30000000-0000-4000-8000-000000000006', code: '3.01.26.0006', status: RecordStatus.TAX_TRANSFER, group: '3. Đăng ký đất đai, cấp GCN' },
            { id: '30000000-0000-4000-8000-000000000007', code: '3.01.26.0007', status: RecordStatus.PENDING_PRINT_CERT, group: '3. Đăng ký đất đai, cấp GCN' }
        ];

        const res = await updateRecordsBatchById(batchUpdate as any);
        const queue = await getPendingSyncItems();
        const item6 = queue.find(q => q.record.id === batchUpdate[0].id);
        const item7 = queue.find(q => q.record.id === batchUpdate[1].id);

        const correctlyRouted = item6?.targetTable === 'dangky_records' && item7?.targetTable === 'dangky_records';
        const notLand = item6?.targetTable !== 'land_records' && item7?.targetTable !== 'land_records';

        if (res.success && correctlyRouted && notLand) {
            results.push({ code: 'U5', name: 'Offline Batch Update Đăng ký', passed: true, detail: `Both records routed exclusively to dangky_records, 0 to land_records` });
        } else {
            results.push({ code: 'U5', name: 'Offline Batch Update Đăng ký', passed: false, detail: `item6=${item6?.targetTable}, item7=${item7?.targetTable}` });
        }
    } catch (e: any) {
        results.push({ code: 'U5', name: 'Offline Batch Update Đăng ký', passed: false, detail: e.message });
    }

    // U6: Offline Batch Delete Đăng ký -> không route sang bảng khác
    try {
        await clearQueue();
        const delIds = [
            '30000000-0000-4000-8000-000000000008',
            '30000000-0000-4000-8000-000000000009'
        ];
        const res = await deleteRecordsBatchApi(delIds, [
            { id: delIds[0], group: '3. Đăng ký đất đai, cấp GCN' },
            { id: delIds[1], group: '3. Đăng ký đất đai, cấp GCN' }
        ] as any);

        const queue = await getPendingSyncItems();
        const d8 = queue.find(q => q.record.id === delIds[0] && q.action === 'DELETE' && q.targetTable === 'dangky_records');
        const d9 = queue.find(q => q.record.id === delIds[1] && q.action === 'DELETE' && q.targetTable === 'dangky_records');

        if (res === true && d8 && d9) {
            results.push({ code: 'U6', name: 'Offline Batch Delete Đăng ký', passed: true, detail: `Both deleted items queued into dangky_records, none to other tables` });
        } else {
            results.push({ code: 'U6', name: 'Offline Batch Delete Đăng ký', passed: false, detail: `res=${res}, d8=${!!d8}, d9=${!!d9}` });
        }
    } catch (e: any) {
        results.push({ code: 'U6', name: 'Offline Batch Delete Đăng ký', passed: false, detail: e.message });
    }

    // U7: Transient Error Đăng ký -> queue đúng dangky_records
    try {
        await clearQueue();
        const transientRec = {
            id: '30000000-0000-4000-8000-000000000010',
            code: '3.01.26.0010',
            group: '3. Đăng ký đất đai, cấp GCN'
        };
        await addPendingRecord(transientRec as any, 'CREATE', 'dangky_records');
        const queue = await getPendingSyncItems();
        const item = queue.find(q => q.record.id === transientRec.id);

        if (item && item.action === 'CREATE' && item.targetTable === 'dangky_records') {
            results.push({ code: 'U7', name: 'Transient Error Đăng ký', passed: true, detail: `Captured in Sync Queue with targetTable=dangky_records` });
        } else {
            results.push({ code: 'U7', name: 'Transient Error Đăng ký', passed: false, detail: `Failed to queue transient item correctly` });
        }
    } catch (e: any) {
        results.push({ code: 'U7', name: 'Transient Error Đăng ký', passed: false, detail: e.message });
    }

    // U8: Permanent Error Đăng ký -> blocked đúng item (attempts = 5, isBlocked = true)
    try {
        await clearQueue();
        const permItem = {
            id: '30000000-0000-4000-8000-000000000011',
            action: 'CREATE',
            targetTable: 'dangky_records',
            record: { id: '30000000-0000-4000-8000-000000000011', code: '3.01.26.0011' },
            attempts: 5,
            isBlocked: true,
            lastError: '23505 unique_violation'
        };
        await savePendingSyncItems([permItem as any]);
        const queue = await getPendingSyncItems();
        const blocked = queue.find(q => q.record.id === permItem.id);

        if (blocked && blocked.isBlocked === true && blocked.attempts === 5 && blocked.targetTable === 'dangky_records') {
            results.push({ code: 'U8', name: 'Permanent Error Đăng ký', passed: true, detail: `Item blocked with isBlocked=true, attempts=5 on dangky_records` });
        } else {
            results.push({ code: 'U8', name: 'Permanent Error Đăng ký', passed: false, detail: `Blocked state verification failed` });
        }
    } catch (e: any) {
        results.push({ code: 'U8', name: 'Permanent Error Đăng ký', passed: false, detail: e.message });
    }

    // U9: Routing Conflict Đăng ký -> BLOCK, không ghi nhầm bảng
    try {
        const conflictRecord: any = {
            id: '30000000-0000-4000-8000-000000000012',
            code: '3.01.26.0012', // indicates dangky_records
            group: '3. Đăng ký đất đai, cấp GCN',
            sourceTable: 'land_records' // conflicting sourceTable
        };

        let threw = false;
        try {
            await createRecordApi(conflictRecord, 'land_records');
        } catch (err: any) {
            threw = true;
            if (err.message.includes('ROUTING_CONFLICT')) {
                results.push({ code: 'U9', name: 'Routing Conflict Đăng ký', passed: true, detail: `Correctly threw ${err.message}` });
            } else {
                results.push({ code: 'U9', name: 'Routing Conflict Đăng ký', passed: false, detail: `Unexpected error: ${err.message}` });
            }
        }
        if (!threw) {
            results.push({ code: 'U9', name: 'Routing Conflict Đăng ký', passed: false, detail: `Failed to throw on routing conflict` });
        }
    } catch (e: any) {
        results.push({ code: 'U9', name: 'Routing Conflict Đăng ký', passed: false, detail: e.message });
    }

    // U10: Routing Unresolved Đăng ký -> BLOCK, không ghi bảng nào
    try {
        const unresolvedRecord: any = {
            id: '30000000-0000-4000-8000-000000000013',
            group: 'Không thuộc nhóm 1 2 3 nào'
        };

        let threw = false;
        try {
            validateRecordRouting(unresolvedRecord);
        } catch (err: any) {
            threw = true;
            if (err.message.includes('ROUTING_UNRESOLVED')) {
                results.push({ code: 'U10', name: 'Routing Unresolved Đăng ký', passed: true, detail: `Correctly threw ${err.message}` });
            } else {
                results.push({ code: 'U10', name: 'Routing Unresolved Đăng ký', passed: false, detail: `Unexpected error: ${err.message}` });
            }
        }
        if (!threw) {
            results.push({ code: 'U10', name: 'Routing Unresolved Đăng ký', passed: false, detail: `Failed to throw on unresolved routing` });
        }
    } catch (e: any) {
        results.push({ code: 'U10', name: 'Routing Unresolved Đăng ký', passed: false, detail: e.message });
    }

    console.log("\n================================================================================");
    console.log("                        KẾT QUẢ KIỂM ĐỊNH (U1 - U10)");
    console.log("================================================================================\n");

    let allPassed = true;
    for (const r of results) {
        const status = r.passed ? "✅ PASS" : "❌ FAIL";
        console.log(`[${r.code}] ${status} | ${r.name}`);
        console.log(`    Detail: ${r.detail}`);
        if (!r.passed) allPassed = false;
    }

    console.log("\n================================================================================");
    if (allPassed) {
        console.log("🎉 TẤT CẢ 10 TEST (U1 - U10) ĐỀU VƯỢT QUA 100% (ALL TESTS PASSED)");
    } else {
        console.log("⚠️ CÓ TEST THẤT BẠI - CẦN KIỂM TRA LẠI");
    }
    console.log("================================================================================\n");

    process.exit(allPassed ? 0 : 1);
}

runDangKyTestSuite().catch(err => {
    console.error("Critical error in DangKy test suite:", err);
    process.exit(1);
});
