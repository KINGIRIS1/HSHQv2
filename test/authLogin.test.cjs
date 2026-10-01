// Regression checks for the entry points used by Login, App, and account management.
// Run: node test/authLogin.test.cjs
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const { build } = require('esbuild');

const state = { session: false, valid: true, active: true, calls: [] };
const profile = () => ({ username: 'staff-test', name: 'Test Staff', role: 'EMPLOYEE',
    employeeId: 'emp-test', active: state.active, password: 'must-not-reach-client' });
global.__authTestClient = {
    auth: {
        getSession: async () => ({ data: { session: state.session ? { user: { id: 'auth-test' } } : null }, error: null }),
        signInWithPassword: async () => {
            state.calls.push('auth:login');
            state.session = state.valid;
            return { error: state.valid ? null : { status: 400 } };
        },
        getUser: async () => ({ data: { user: state.session ? { id: 'auth-test' } : null }, error: null }),
        signOut: async () => { state.calls.push('auth:logout'); state.session = false; return { error: null }; },
    },
    from: table => {
        state.calls.push(`read:${table}`);
        assert.ok(state.session, 'No protected data request before successful Auth login');
        const rows = table === 'users' ? [profile()] : [{ id: 'emp-test', name: 'Test Staff' }];
        const query = {
            select: () => query, eq: () => query,
            maybeSingle: async () => ({ data: rows[0], error: null }),
            then: resolve => Promise.resolve({ data: rows, error: null }).then(resolve),
        };
        return query;
    },
    functions: { invoke: async (_name, options) => {
        state.calls.push(`account:${options.body.action}`);
        return { data: { user: profile(), success: true }, error: null };
    } },
};
global.window = new EventTarget();

async function main() {
    const root = path.resolve(__dirname, '..');
    const stubs = {
        supabaseClient: `export const supabase = globalThis.__authTestClient;
            export const isConfigured = true;
            export const hasAuthenticatedSession = async () => !!(await supabase.auth.getSession()).data.session;
            export const usernameToAuthEmail = async () => 'test@users.qlhshq.info.vn';`,
        apiCore: `export const CACHE_KEYS = { USERS: 'users', EMPLOYEES: 'employees' };
            export const logError = () => {};
            export const getFromCache = (_key, fallback) => fallback;
            export const saveToCache = () => {};
            export const mapUserFromDb = x => ({...x});
            export const mapUserToDb = x => x;
            export const mapEmployeeFromDb = x => ({...x});
            export const mapEmployeeToDb = x => x;
            export const normalizeDepartment = x => x;
            export const normalizePosition = x => x;`,
        apiSystem: `export const getSystemSetting = async key => {
                if (key === 'users_config') throw new Error('Legacy credential config must never be read');
                return null;
            };
            export const saveSystemSetting = async () => { throw new Error('Legacy account writes forbidden'); };`,
    };
    const result = await build({
        stdin: { contents: `export * from './services/apiPeople';`, resolveDir: root },
        bundle: true, platform: 'node', format: 'cjs', write: false,
        plugins: [{ name: 'mock-auth-boundary', setup(builder) {
            builder.onResolve({ filter: /\/\b(supabaseClient|apiCore|apiSystem)$/ }, args => ({
                path: args.path.split('/').pop(), namespace: 'auth-test',
            }));
            builder.onLoad({ filter: /.*/, namespace: 'auth-test' }, args => ({ contents: stubs[args.path] }));
        } }],
    });
    const entry = new Module(path.join(root, 'test/authLogin.bundle.cjs'), module);
    entry.filename = path.join(root, 'test/authLogin.bundle.cjs');
    entry.paths = module.paths;
    entry._compile(result.outputFiles[0].text, entry.filename);
    const api = entry.exports;

    assert.deepEqual(await api.fetchUsers(), []);
    assert.deepEqual(await api.fetchEmployees(), []);
    assert.equal(await api.findUserInDbDirectly('staff-test'), null);
    assert.deepEqual(state.calls, []);
    console.log('PASS signed-out account and employee reads do not call protected REST tables');

    state.valid = false;
    assert.equal((await api.authenticateUserCloud('staff-test', 'wrong')).status, 'INVALID_CREDENTIALS');
    assert.deepEqual(state.calls, ['auth:login']);
    console.log('PASS invalid credentials use Auth and never read password tables');

    state.calls = []; state.valid = true;
    const login = await api.authenticateUserCloud('staff-test', 'valid');
    assert.equal(login.status, 'SUCCESS');
    assert.equal(state.calls[0], 'auth:login');
    assert.ok(state.calls.includes('read:users'));
    assert.equal(login.user.password, undefined);
    console.log('PASS successful login establishes a session before reading the staff profile');

    assert.ok((await api.fetchUsers()).every(user => user.password === undefined));
    console.log('PASS account lists omit passwords');

    state.calls = [];
    assert.ok(await api.saveUserApi({ username: 'staff-test' }, true));
    assert.ok(await api.deleteUserApi('staff-test'));
    assert.deepEqual(state.calls, ['account:update', 'account:delete']);
    console.log('PASS account mutations use the authenticated account-management function');

    state.active = false; state.session = false; state.calls = [];
    assert.equal((await api.authenticateUserCloud('staff-test', 'valid')).status, 'ACCOUNT_DISABLED');
    assert.equal(state.session, false);
    assert.equal(state.calls.at(-1), 'auth:logout');
    console.log('PASS a disabled profile cannot retain a new session');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
