// ===== INITIALIZATION & STATE =====
let currentUser = null;
let currentRole = null;
let authRole = null;
let authMode = 'login';

const STORAGE_KEYS = {
    tasks: 'tasks',
    users: 'users',
    userProfiles: 'userProfiles',
    courses: 'courses',
    courseProgress: 'courseProgress',
    inquiries: 'inquiries',
    conversations: 'conversations',
    schedules: 'schedules',
    session: 'currentSession'
};

const SUPABASE_SYNC_KEYS = [
    STORAGE_KEYS.tasks,
    STORAGE_KEYS.users,
    STORAGE_KEYS.userProfiles,
    STORAGE_KEYS.courses,
    STORAGE_KEYS.courseProgress,
    STORAGE_KEYS.inquiries,
    STORAGE_KEYS.conversations,
    STORAGE_KEYS.schedules
];

function generateId() {
    return Date.now() + Math.floor(Math.random() * 1000);
}

function parseStoredJson(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return fallback;
        return JSON.parse(raw);
    } catch (_error) {
        localStorage.removeItem(key);
        return fallback;
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', init);

async function init() {
    // Demo mode: pre-fill realistic sample data on the first visit.
    if (localStorage.getItem(DEMO_SEED_KEY) !== DEMO_SEED_VERSION) {
        seedDemoData();
    }
    ensureDefaultKeys();

    // Cloud sync is optional; in demo mode this resolves to false immediately.
    try {
        await (window.bizBuddySupabaseReady || Promise.resolve(false));
    } catch (_error) {
        // Stay in local mode.
    }
    await loadStateFromSupabase();

    ensureDataConsistency();

    setupNav();
    setupScroll();
    setupGlobalInteractions();

    const session = getCurrentSession();
    if (session) {
        // Refresh the session from the stored user so admin changes (e.g. VA approval) apply.
        const storedUser = getUserById(session.id);
        if (storedUser) {
            currentUser = storedUser;
            currentRole = storedUser.role;
            saveCurrentSession(storedUser);
            openDashboard(storedUser.role);
        } else {
            clearCurrentSession();
        }
    }
    updateNavForSession();

    syncAllStateToSupabase();
}

function ensureDefaultKeys() {
    const defaults = {
        [STORAGE_KEYS.tasks]: [],
        [STORAGE_KEYS.users]: [],
        [STORAGE_KEYS.userProfiles]: {},
        [STORAGE_KEYS.courses]: DEMO_COURSES,
        [STORAGE_KEYS.courseProgress]: {},
        [STORAGE_KEYS.inquiries]: [],
        [STORAGE_KEYS.conversations]: [],
        [STORAGE_KEYS.schedules]: []
    };
    Object.entries(defaults).forEach(([key, value]) => {
        if (!localStorage.getItem(key)) {
            localStorage.setItem(key, JSON.stringify(value));
        }
    });
}

// ===== DEMO DATA =====
const DEMO_SEED_KEY = 'bizbuddyDemoSeed';
const DEMO_SEED_VERSION = '2';

const DEMO_COURSES = [
    {
        id: 1,
        title: 'Executive Inbox Management',
        level: 'Beginner',
        duration: '2h 30m',
        description: 'Prioritization frameworks, tone standards, and response workflows.'
    },
    {
        id: 2,
        title: 'Calendar Intelligence for VAs',
        level: 'Intermediate',
        duration: '3h 00m',
        description: 'Design conflict-free schedules and cross-timezone executive calendars.'
    },
    {
        id: 3,
        title: 'Board-Level Reporting Basics',
        level: 'Advanced',
        duration: '4h 15m',
        description: 'Build concise reports and dashboards for leadership updates.'
    }
];

function buildDemoData() {
    const now = Date.now();
    const hour = 60 * 60 * 1000;
    const day = 24 * hour;
    const iso = (offsetMs) => new Date(now + offsetMs).toISOString();
    const date = (offsetMs) => iso(offsetMs).slice(0, 10);

    // Upcoming call slot: 2 days from now at 10:00 local time.
    const callSlot = new Date(now + 2 * day);
    callSlot.setHours(10, 0, 0, 0);
    const pastCall = new Date(now - 3 * day);
    pastCall.setHours(15, 30, 0, 0);

    const users = [
        { id: 'admin1', email: 'admin@bizbuddy.com', password: 'admin123', role: 'admin' },
        { id: 'client1', email: 'client@bizbuddy.com', password: 'client123', role: 'client' },
        { id: 'client2', email: 'marcus@northwindcap.com', password: 'demo1234', role: 'client' },
        { id: 'va1', email: 'va@bizbuddy.com', password: 'va12345', role: 'va', approvalStatus: 'approved' },
        { id: 'va2', email: 'daniel.okafor@bizbuddy.com', password: 'demo1234', role: 'va', approvalStatus: 'approved' },
        { id: 'va3', email: 'priya.raman@bizbuddy.com', password: 'demo1234', role: 'va', approvalStatus: 'approved' },
        { id: 'va4', email: 'jamie.cruz@gmail.com', password: 'demo1234', role: 'va', approvalStatus: 'pending' }
    ];

    const blankProfile = {
        name: '', email: '', bio: '', skills: '', tools: '', experienceYears: '', hourlyRate: '',
        availability: '', timezone: '', cvLink: '', portfolioLink: '',
        verificationStatus: '', verificationDocName: '', verificationDocData: ''
    };

    const userProfiles = {
        admin1: { ...blankProfile, name: 'Biz Buddy Admin', email: 'admin@bizbuddy.com' },
        client1: {
            ...blankProfile,
            name: 'Alexandra Reyes',
            email: 'client@bizbuddy.com',
            bio: 'COO at Brightline Ventures. Needs proactive support across board prep and investor relations.',
            skills: 'Operations, Investor Relations'
        },
        client2: {
            ...blankProfile,
            name: 'Marcus Chen',
            email: 'marcus@northwindcap.com',
            bio: 'Managing Partner, Northwind Capital.',
            skills: 'Private Equity, Deal Flow'
        },
        va1: {
            ...blankProfile,
            name: 'Sofia Navarro',
            email: 'va@bizbuddy.com',
            bio: 'Executive assistant with 6 years supporting founders and C-suite leaders across US and EU time zones.',
            skills: 'Executive coordination, admin, calendar management, content, board decks',
            tools: 'Google Workspace, Notion, Asana, Canva',
            experienceYears: '6',
            hourlyRate: '18',
            availability: 'Full-time',
            timezone: 'GMT+8',
            verificationStatus: 'verified'
        },
        va2: {
            ...blankProfile,
            name: 'Daniel Okafor',
            email: 'daniel.okafor@bizbuddy.com',
            bio: 'Research-focused VA. Market scans, competitor analysis, and investor CRM hygiene.',
            skills: 'Research, data analysis, CRM management, reporting',
            tools: 'HubSpot, Airtable, Excel, Notion',
            experienceYears: '4',
            hourlyRate: '15',
            availability: 'Part-time',
            timezone: 'GMT+1',
            verificationStatus: 'verified'
        },
        va3: {
            ...blankProfile,
            name: 'Priya Raman',
            email: 'priya.raman@bizbuddy.com',
            bio: 'Travel and events specialist for globally mobile executives.',
            skills: 'Travel planning, admin, events, vendor coordination',
            tools: 'Google Workspace, Slack, Navan',
            experienceYears: '5',
            hourlyRate: '16',
            availability: 'Full-time',
            timezone: 'GMT+5:30',
            verificationStatus: 'unverified'
        },
        va4: {
            ...blankProfile,
            name: 'Jamie Cruz',
            email: 'jamie.cruz@gmail.com',
            bio: 'Customer support lead moving into executive assistance.',
            skills: 'Inbox management, customer support, scheduling',
            tools: 'Zendesk, Google Workspace',
            experienceYears: '2',
            hourlyRate: '10',
            availability: 'Project-based',
            timezone: 'GMT+8',
            cvLink: 'https://example.com/jamie-cruz-cv.pdf',
            portfolioLink: 'https://example.com/jamie-cruz-portfolio',
            verificationStatus: 'unverified'
        }
    };

    const baseTask = {
        deadline: '', applicants: [], acceptedVaId: null, messages: [], ratings: {},
        milestone: '', attachmentName: '', attachmentData: '', invoiceStatus: 'pending'
    };

    const tasks = [
        {
            ...baseTask,
            id: 1,
            title: 'Quarterly board deck',
            description: 'Create a 20-slide deck for the Q3 investor meeting from our finance and ops updates.',
            category: 'content',
            budget: 650,
            deadline: date(10 * day),
            status: 'open',
            clientId: 'client1',
            postedDate: date(-3 * day),
            applicants: ['va1', 'va2'],
            milestone: 'Outline due in 3 days'
        },
        {
            ...baseTask,
            id: 2,
            title: 'Executive travel & calendar',
            description: 'Coordinate a multi-city trip (New York, London, Singapore) and rebalance the calendar around it.',
            category: 'travel',
            budget: 420,
            deadline: date(7 * day),
            status: 'open',
            clientId: 'client2',
            postedDate: date(-2 * day),
            applicants: ['va3'],
            milestone: 'Draft itinerary in 48 hours'
        },
        {
            ...baseTask,
            id: 3,
            title: 'Inbox triage & weekly digest',
            description: 'Own daily inbox triage and send a Friday digest of decisions needed.',
            category: 'admin',
            budget: 380,
            status: 'in-progress',
            clientId: 'client1',
            postedDate: date(-12 * day),
            applicants: ['va1'],
            acceptedVaId: 'va1',
            milestone: 'First digest this Friday',
            messages: [
                { senderId: 'client1', text: 'Welcome aboard! Please flag anything from the board chair as urgent.', createdAt: iso(-5 * day) },
                { senderId: 'va1', text: 'Got it. I have set up filters and a priority label for board mail.', createdAt: iso(-5 * day + 2 * hour) },
                { senderId: 'va1', text: 'Inbox is down from 412 to 37 unread. Digest draft is in your Drive.', createdAt: iso(-1 * day) }
            ]
        },
        {
            ...baseTask,
            id: 4,
            title: 'Investor CRM cleanup',
            description: 'Deduplicate and tag 1,200 investor contacts in HubSpot ahead of the fundraise.',
            category: 'research',
            budget: 300,
            status: 'completed',
            clientId: 'client1',
            postedDate: date(-20 * day),
            applicants: ['va1', 'va2'],
            acceptedVaId: 'va1',
            milestone: 'Delivered',
            messages: [
                { senderId: 'va1', text: 'Cleanup complete: 214 duplicates merged, all contacts tagged by stage.', createdAt: iso(-2 * day) }
            ]
        },
        {
            ...baseTask,
            id: 5,
            title: 'APAC market research brief',
            description: 'Summarize market size, key players, and regulatory notes for APAC expansion.',
            category: 'research',
            budget: 540,
            status: 'completed',
            clientId: 'client2',
            postedDate: date(-30 * day),
            applicants: ['va2'],
            acceptedVaId: 'va2',
            invoiceStatus: 'paid',
            ratings: { clientToVa: 5, vaToClient: 5 }
        },
        {
            ...baseTask,
            id: 6,
            title: 'Weekly KPI dashboard',
            description: 'Build a one-page weekly KPI dashboard from Stripe and HubSpot exports.',
            category: 'content',
            budget: 450,
            status: 'completed',
            clientId: 'client2',
            postedDate: date(-40 * day),
            applicants: ['va1'],
            acceptedVaId: 'va1',
            invoiceStatus: 'paid',
            ratings: { clientToVa: 5, vaToClient: 4 }
        },
        {
            ...baseTask,
            id: 7,
            title: 'Lisbon leadership offsite logistics',
            description: 'Book venue, hotel block, and ground transport for a 12-person leadership offsite.',
            category: 'travel',
            budget: 720,
            deadline: date(21 * day),
            status: 'open',
            clientId: 'client1',
            postedDate: date(-1 * day),
            milestone: 'Venue shortlist in 5 days'
        }
    ];

    const conversations = [
        {
            id: 101,
            clientId: 'client1',
            vaId: 'va1',
            createdAt: iso(-6 * day),
            updatedAt: iso(-4 * hour),
            messages: [
                { senderId: 'client1', text: 'Hi Sofia, loved your work on the CRM cleanup. Would you take on the board deck too?', createdAt: iso(-6 * day), readBy: ['client1', 'va1'] },
                { senderId: 'va1', text: 'Absolutely. I just applied, and I can have an outline to you within 3 days.', createdAt: iso(-6 * day + 3 * hour), readBy: ['va1', 'client1'] },
                { senderId: 'va1', text: 'Happy to walk through the narrative on a quick call this week.', createdAt: iso(-4 * hour), readBy: ['va1'] }
            ]
        },
        {
            id: 102,
            clientId: 'client1',
            vaId: 'va2',
            createdAt: iso(-2 * day),
            updatedAt: iso(-2 * day),
            messages: [
                { senderId: 'client1', text: 'Daniel, are you available for the research-heavy slides in the board deck?', createdAt: iso(-2 * day), readBy: ['client1'] }
            ]
        },
        {
            id: 103,
            clientId: 'client2',
            vaId: 'va1',
            createdAt: iso(-9 * day),
            updatedAt: iso(-1 * day),
            messages: [
                { senderId: 'client2', text: 'Thanks for the KPI dashboard. Can we keep the same format monthly?', createdAt: iso(-1 * day), readBy: ['client2'] }
            ]
        }
    ];

    const schedules = [
        { id: 201, clientId: 'client1', vaId: 'va1', time: callSlot.toISOString(), status: 'pending', createdAt: iso(-4 * hour) },
        { id: 202, clientId: 'client2', vaId: 'va1', time: pastCall.toISOString(), status: 'accepted', createdAt: iso(-5 * day) }
    ];

    const inquiries = [
        {
            id: 301,
            name: 'Hannah Whitfield',
            email: 'hannah@lumenhealth.io',
            message: 'We are a Series B healthtech team looking for two executive VAs for our CEO and CFO. Can we talk next week?',
            submittedAt: iso(-2 * day)
        },
        {
            id: 302,
            name: 'Omar Haddad',
            email: 'omar@haddadpartners.com',
            message: 'Interested in a part-time VA for travel and calendar. What does onboarding look like?',
            submittedAt: iso(-6 * hour)
        }
    ];

    const courseProgress = {
        va1: { 1: 'completed', 2: 'enrolled' }
    };

    return {
        [STORAGE_KEYS.users]: users,
        [STORAGE_KEYS.userProfiles]: userProfiles,
        [STORAGE_KEYS.tasks]: tasks,
        [STORAGE_KEYS.courses]: DEMO_COURSES,
        [STORAGE_KEYS.courseProgress]: courseProgress,
        [STORAGE_KEYS.inquiries]: inquiries,
        [STORAGE_KEYS.conversations]: conversations,
        [STORAGE_KEYS.schedules]: schedules
    };
}

function seedDemoData() {
    const data = buildDemoData();
    Object.entries(data).forEach(([key, value]) => {
        localStorage.setItem(key, JSON.stringify(value));
    });
    localStorage.removeItem(STORAGE_KEYS.session);
    localStorage.setItem(DEMO_SEED_KEY, DEMO_SEED_VERSION);
}

function resetDemoData() {
    if (!window.confirm('Reset all demo data? This restores the sample users, tasks and messages, and signs you out.')) {
        return;
    }

    seedDemoData();
    syncAllStateToSupabase();
    document.querySelectorAll('.modal').forEach((modal) => {
        if (modal.style.display === 'flex') {
            closeModal(modal.id);
        }
    });

    currentUser = null;
    currentRole = null;
    showLandingSections();
    updateNavForSession();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast('Demo data reset. Sample data restored.', 'success');
}

// ===== HTML ESCAPING =====
function escapeHtml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function safeUrl(value) {
    const url = String(value || '');
    if (isValidHttpUrl(url) || url.startsWith('data:')) {
        return escapeHtml(url);
    }
    return '#';
}

// ===== INFO MODAL (Privacy / Terms) =====
const INFO_PAGES = {
    privacy: {
        title: 'Privacy',
        subtitle: 'How Biz Buddy handles your information.',
        body: [
            'We only collect the details needed to match clients with virtual assistants: contact information, profile details, and task information you choose to share.',
            'Client and VA data is never sold. Confidential task material is visible only to the client and the VA assigned to that task.',
            'In this demo, all data is stored in your browser only and can be cleared at any time with "Reset demo data" in the footer.',
            'Questions? Email hello@bizbuddy.com.'
        ]
    },
    terms: {
        title: 'Terms',
        subtitle: 'The essentials of working with Biz Buddy.',
        body: [
            'Clients post tasks with a clear scope and budget. VAs apply, and the client selects one VA per task.',
            'Payment is released by the client once a task is marked complete. Both parties can rate each other after completion.',
            'All VAs agree to confidentiality and professional standards before their application is approved.',
            'Full terms of service are available on request at hello@bizbuddy.com.'
        ]
    }
};

function openInfoModal(pageKey) {
    const page = INFO_PAGES[pageKey];
    if (!page) {
        return;
    }

    document.getElementById('infoModalTitle').innerText = page.title;
    document.getElementById('infoModalSubtitle').innerText = page.subtitle;
    document.getElementById('infoModalBody').innerHTML = page.body
        .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
        .join('');

    const modal = document.getElementById('infoModal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

// ===== NAV LOGIN / DASHBOARD BUTTON =====
function updateNavForSession() {
    const navLoginBtn = document.getElementById('navLoginBtn');
    if (navLoginBtn) {
        navLoginBtn.innerText = currentUser ? 'My Dashboard' : 'Login';
    }
}

function handleNavLoginClick() {
    const navLinks = document.querySelector('.nav-links');
    if (navLinks) navLinks.classList.remove('active');

    if (currentUser) {
        openDashboard(currentUser.role);
        return;
    }
    openLoginModal();
}

function showLandingSections() {
    const dashboard = document.getElementById('dashboard');
    if (dashboard) {
        dashboard.style.display = 'none';
    }
    ['home', 'services', 'requirements', 'about', 'contact'].forEach((id) => {
        const element = document.getElementById(id);
        if (element) element.style.display = '';
    });
}

function isSupabaseEnabled() {
    return Boolean(window.bizBuddySupabaseEnabled && window.bizBuddySupabase);
}

async function loadStateFromSupabase() {
    if (!isSupabaseEnabled()) {
        return;
    }

    try {
        const { data, error } = await window.bizBuddySupabase
            .from('app_state')
            .select('key,data');

        if (error || !Array.isArray(data)) {
            return;
        }

        data.forEach((row) => {
            if (!row || !row.key || !SUPABASE_SYNC_KEYS.includes(row.key)) {
                return;
            }
            localStorage.setItem(row.key, JSON.stringify(row.data));
        });
    } catch (_error) {
        // Keep local mode available if cloud sync fails.
    }
}

function syncStateKeyToSupabase(key, value) {
    if (!isSupabaseEnabled() || !SUPABASE_SYNC_KEYS.includes(key)) {
        return;
    }

    window.bizBuddySupabase
        .from('app_state')
        .upsert(
            {
                key,
                data: value,
                updated_at: new Date().toISOString()
            },
            { onConflict: 'key' }
        )
        .then(() => {})
        .catch(() => {});
}

function syncAllStateToSupabase() {
    SUPABASE_SYNC_KEYS.forEach((key) => {
        syncStateKeyToSupabase(key, parseStoredJson(key, null));
    });
}

function ensureDataConsistency() {
    const users = getUsers();
    const normalizedUsers = users.map((user) => {
        if (user.role === 'va' && !user.approvalStatus) {
            return { ...user, approvalStatus: 'approved' };
        }
        return user;
    });
    saveUsers(normalizedUsers);

    const tasks = getTasks();
    const normalizedTasks = tasks.map((task) => ({
        ...task,
        applicants: Array.isArray(task.applicants) ? task.applicants : [],
        acceptedVaId: task.acceptedVaId || null,
        messages: Array.isArray(task.messages) ? task.messages : [],
        ratings: task.ratings || {},
        milestone: task.milestone || '',
        attachmentName: task.attachmentName || '',
        attachmentData: task.attachmentData || '',
        invoiceStatus: task.invoiceStatus || 'pending'
    }));
    saveTasks(normalizedTasks);

    const conversations = getConversations();
    const normalizedConversations = conversations.map((conversation) => ({
        ...conversation,
        messages: Array.isArray(conversation.messages)
            ? conversation.messages.map((message) => ({
                ...message,
                readBy: Array.isArray(message.readBy) ? message.readBy : []
            }))
            : [],
        createdAt: conversation.createdAt || new Date().toISOString(),
        updatedAt: conversation.updatedAt || conversation.createdAt || new Date().toISOString()
    }));
    saveConversations(normalizedConversations);

    const schedules = getSchedules();
    const normalizedSchedules = schedules.map((schedule) => ({
        ...schedule,
        status: schedule.status || 'pending',
        createdAt: schedule.createdAt || new Date().toISOString()
    }));
    saveSchedules(normalizedSchedules);

    const profiles = getProfiles();
    const normalizedProfiles = Object.fromEntries(
        Object.entries(profiles).map(([userId, profile]) => [
            userId,
            {
                ...profile,
                verificationStatus: profile.verificationStatus || 'unverified',
                verificationDocName: profile.verificationDocName || '',
                verificationDocData: profile.verificationDocData || ''
            }
        ])
    );
    saveProfiles(normalizedProfiles);
}

function getUserById(userId) {
    return getUsers().find((user) => user.id === userId) || null;
}

function getUserDisplay(userId) {
    const user = getUserById(userId);
    return user ? user.email : 'Unknown user';
}

function setupGlobalInteractions() {
    window.addEventListener('click', (event) => {
        if (event.target.classList && event.target.classList.contains('modal')) {
            closeModal(event.target.id);
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            document.querySelectorAll('.modal').forEach((modal) => {
                if (modal.style.display === 'flex') {
                    closeModal(modal.id);
                }
            });
        }
    });

    const signupRoleSelect = document.getElementById('signupRole');
    if (signupRoleSelect) {
        signupRoleSelect.addEventListener('change', updateSignupRequirementUI);
    }
}

function showToast(message, variant = 'info') {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
        return;
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${variant}`;
    toast.innerText = message;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast-hide');
        setTimeout(() => toast.remove(), 250);
    }, 2400);
}

function getUsers() {
    return parseStoredJson(STORAGE_KEYS.users, []);
}

function saveUsers(users) {
    localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(users));
    syncStateKeyToSupabase(STORAGE_KEYS.users, users);
}

function getCurrentSession() {
    return parseStoredJson(STORAGE_KEYS.session, null);
}

function saveCurrentSession(user) {
    localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(user));
}

function clearCurrentSession() {
    localStorage.removeItem(STORAGE_KEYS.session);
}

function getProfiles() {
    return parseStoredJson(STORAGE_KEYS.userProfiles, {});
}

function saveProfiles(profiles) {
    localStorage.setItem(STORAGE_KEYS.userProfiles, JSON.stringify(profiles));
    syncStateKeyToSupabase(STORAGE_KEYS.userProfiles, profiles);
}

function getCourses() {
    return parseStoredJson(STORAGE_KEYS.courses, []);
}

function getCourseProgress() {
    return parseStoredJson(STORAGE_KEYS.courseProgress, {});
}

function saveCourseProgress(progress) {
    localStorage.setItem(STORAGE_KEYS.courseProgress, JSON.stringify(progress));
    syncStateKeyToSupabase(STORAGE_KEYS.courseProgress, progress);
}

function getInquiries() {
    return parseStoredJson(STORAGE_KEYS.inquiries, []);
}

function saveInquiries(inquiries) {
    localStorage.setItem(STORAGE_KEYS.inquiries, JSON.stringify(inquiries));
    syncStateKeyToSupabase(STORAGE_KEYS.inquiries, inquiries);
}

function getConversations() {
    return parseStoredJson(STORAGE_KEYS.conversations, []);
}

function saveConversations(conversations) {
    localStorage.setItem(STORAGE_KEYS.conversations, JSON.stringify(conversations));
    syncStateKeyToSupabase(STORAGE_KEYS.conversations, conversations);
}

function getSchedules() {
    return parseStoredJson(STORAGE_KEYS.schedules, []);
}

function saveSchedules(schedules) {
    localStorage.setItem(STORAGE_KEYS.schedules, JSON.stringify(schedules));
    syncStateKeyToSupabase(STORAGE_KEYS.schedules, schedules);
}

function toCsv(rows) {
    if (!rows.length) {
        return '';
    }

    const headers = Object.keys(rows[0]);
    const csvRows = [headers.join(',')];
    rows.forEach((row) => {
        const line = headers.map((header) => {
            const value = row[header] == null ? '' : String(row[header]);
            return `"${value.replace(/"/g, '""')}"`;
        }).join(',');
        csvRows.push(line);
    });
    return csvRows.join('\n');
}

function downloadTextFile(filename, content, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: mimeType });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(downloadUrl);
}

function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function getAverageRatingForVA(vaId) {
    const ratings = getTasks()
        .filter((task) => task.acceptedVaId === vaId && task.ratings && task.ratings.clientToVa)
        .map((task) => Number(task.ratings.clientToVa));

    if (!ratings.length) {
        return 0;
    }

    return ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
}

// ===== NAVIGATION =====
function setupNav() {
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');

    // Toggle mobile menu
    if (hamburger && navLinks) {
        hamburger.addEventListener('click', () => {
            navLinks.classList.toggle('active');
        });
        hamburger.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                navLinks.classList.toggle('active');
            }
        });
    }

    // Close the mobile menu after choosing any nav button
    if (navLinks) {
        navLinks.querySelectorAll('button').forEach((button) => {
            button.addEventListener('click', () => navLinks.classList.remove('active'));
        });
    }

    // Handle nav link clicks (and footer section links)
    document.querySelectorAll('.nav-link, .section-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const href = link.getAttribute('href');

            if (href) {
                // Show landing sections, hide dashboard
                showLandingSections();

                // Scroll to section
                const targetSection = document.querySelector(href);
                if (targetSection) {
                    targetSection.scrollIntoView({ behavior: 'smooth' });
                }
            }

            // Close mobile menu
            if (navLinks) navLinks.classList.remove('active');
        });
    });
}

// ===== SCROLL ANIMATIONS =====
function setupScroll() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in');
            }
        });
    }, { threshold: 0.1 });

    // Observe sections and cards
    document.querySelectorAll('section, .service-card, .about-content, .contact-content').forEach(element => {
        observer.observe(element);
    });
}

// ===== DASHBOARD FUNCTIONS =====
function openDashboard(role) {
    const resolvedRole = role || (currentUser && currentUser.role) || 'client';
    currentRole = resolvedRole;

    // Hide landing sections
    ['home', 'services', 'requirements', 'about', 'contact'].forEach(id => {
        const element = document.getElementById(id);
        if (element) element.style.display = 'none';
    });

    // Show dashboard
    const dashboard = document.getElementById('dashboard');
    if (dashboard) {
        dashboard.style.display = 'block';
    }

    // Update dashboard title
    const dashboardTitle = document.getElementById('dashboardTitle');
    if (dashboardTitle) {
        if (resolvedRole === 'client') {
            dashboardTitle.innerText = 'Client office';
        } else if (resolvedRole === 'va') {
            dashboardTitle.innerText = 'VA suite';
        } else if (resolvedRole === 'admin') {
            dashboardTitle.innerText = 'Admin oversight';
        }
    }

    // Show appropriate dashboard panel
    const clientDash = document.getElementById('clientDashboard');
    const vaDash = document.getElementById('vaDashboard');
    const adminDash = document.getElementById('adminDashboard');

    if (clientDash) clientDash.style.display = resolvedRole === 'client' ? 'grid' : 'none';
    if (vaDash) vaDash.style.display = resolvedRole === 'va' ? 'grid' : 'none';
    if (adminDash) adminDash.style.display = resolvedRole === 'admin' ? 'grid' : 'none';

    // Render appropriate content
    if (resolvedRole === 'client') {
        renderClientTasks();
        renderClientVADirectory();
        renderClientConversations();
        renderClientMatches();
    } else if (resolvedRole === 'va') {
        renderVATasks();
        renderVAAssignedTasks();
        renderVAConversations();
        renderVASchedules();
        renderVACourses();
    } else if (resolvedRole === 'admin') {
        renderAdminStats();
    }

    updateDashboardNotifications(resolvedRole);

    // Scroll to dashboard
    if (dashboard) {
        dashboard.scrollIntoView({ behavior: 'smooth' });
    }
}

function logout() {
    showLandingSections();

    // Reset user
    currentUser = null;
    currentRole = null;
    clearCurrentSession();
    updateNavForSession();

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast('Logged out.', 'info');
}

// ===== TASK MANAGEMENT =====
function getTasks() {
    const tasks = parseStoredJson(STORAGE_KEYS.tasks, []);
    return Array.isArray(tasks) ? tasks : [];
}

function saveTasks(tasks) {
    localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(tasks));
    syncStateKeyToSupabase(STORAGE_KEYS.tasks, tasks);
}

function renderClientTasks() {
    if (!currentUser) {
        return;
    }

    const tasks = getTasks().filter(t => t.clientId === currentUser.id);
    const clientTasksContainer = document.getElementById('clientTasks');
    const clientTaskSummary = document.getElementById('clientTaskSummary');

    const openCount = tasks.filter(task => task.status === 'open').length;
    const inProgressCount = tasks.filter(task => task.status === 'in-progress').length;
    const completedCount = tasks.filter(task => task.status === 'completed').length;

    if (clientTaskSummary) {
        clientTaskSummary.innerText = `Total ${tasks.length} · Open ${openCount} · In progress ${inProgressCount} · Completed ${completedCount}`;
    }

    if (!clientTasksContainer) {
        return;
    }

    if (!tasks.length) {
        clientTasksContainer.innerHTML = '<p>No tasks posted</p>';
        return;
    }

    clientTasksContainer.innerHTML = tasks.map(task => {
        const applicants = Array.isArray(task.applicants) ? task.applicants : [];
        const acceptedVaDisplay = task.acceptedVaId ? getUserDisplay(task.acceptedVaId) : 'None selected';
        const applicantMarkup = applicants.length
            ? applicants.map((applicantId) => {
                const applicantEmail = getUserDisplay(applicantId);
                const isAccepted = task.acceptedVaId === applicantId;
                const canAccept = !task.acceptedVaId && task.status === 'open';

                return `
                    <div class="inline-row">
                        <span class="chip">${escapeHtml(applicantEmail)}</span>
                        ${isAccepted
                            ? '<span class="status-badge">Accepted</span>'
                            : canAccept
                                ? `<button class="btn btn-primary btn-sm" onclick="acceptApplicant(${task.id}, '${applicantId}')">Accept</button>`
                                : ''
                        }
                    </div>
                `;
            }).join('')
            : '<p>No applicants yet.</p>';

        return `
            <div class="task-item">
                <strong>${escapeHtml(task.title)}</strong>
                <span>$${escapeHtml(task.budget)} · ${escapeHtml(task.status)}</span>
                <p>${escapeHtml(task.description)}</p>
                <p>Milestone: ${escapeHtml(task.milestone || 'Not set')}</p>
                <p>Invoice: ${escapeHtml(task.invoiceStatus || 'pending')}</p>
                ${task.attachmentData ? `<p><a href="${safeUrl(task.attachmentData)}" download="${escapeHtml(task.attachmentName || 'task-brief')}">Download brief</a></p>` : ''}
                <p>Selected VA: ${escapeHtml(acceptedVaDisplay)}</p>
                <div class="sub-block">
                    <p>Applicants (${applicants.length})</p>
                    <div class="inline-list">${applicantMarkup}</div>
                </div>
                ${renderClientTaskStatusAction(task)}
                ${task.status === 'completed' && task.invoiceStatus !== 'paid'
                    ? `<button class="btn btn-primary btn-sm" onclick="releasePayment(${task.id})">Release Payment</button>`
                    : task.invoiceStatus === 'paid'
                        ? '<span class="status-badge">Paid</span>'
                        : ''
                }
                ${renderTaskThread(task, 'client')}
                ${renderTaskRating(task, 'client')}
            </div>
        `;
    }).join('');
}

function renderClientTaskStatusAction(task) {
    if (task.status === 'completed') {
        return `<button class="btn btn-primary btn-sm" onclick="updateTaskStatus(${task.id}, 'open')">Reopen</button>`;
    }

    if (task.status === 'open') {
        return task.acceptedVaId
            ? `<button class="btn btn-primary btn-sm" onclick="updateTaskStatus(${task.id}, 'in-progress')">Start Task</button>`
            : '<p>Accept an applicant to start this task.</p>';
    }

    return `<button class="btn btn-primary btn-sm" onclick="updateTaskStatus(${task.id}, 'completed')">Mark Complete</button>`;
}

function updateDashboardNotifications(role) {
    const badge = document.getElementById('dashboardNotifications');
    if (!badge || !currentUser) {
        return;
    }

    let count = 0;
    if (role === 'client') {
        count += getTasks().filter((task) => task.clientId === currentUser.id && (task.applicants || []).length > 0 && !task.acceptedVaId).length;
        count += getUnreadConversationCount(currentUser.id);
    } else if (role === 'va') {
        count += getUnreadConversationCount(currentUser.id);
        count += getSchedules().filter((schedule) => schedule.vaId === currentUser.id && schedule.status === 'pending').length;
    } else if (role === 'admin') {
        count += getUsers().filter((user) => user.role === 'va' && user.approvalStatus === 'pending').length;
        count += getInquiries().length;
    }

    if (count > 0) {
        badge.style.display = 'inline-block';
        badge.innerText = `${count} New`;
    } else {
        badge.style.display = 'none';
    }
}

function getUnreadConversationCount(userId) {
    const conversations = getConversations().filter((conversation) => conversation.clientId === userId || conversation.vaId === userId);
    let unreadCount = 0;
    conversations.forEach((conversation) => {
        (conversation.messages || []).forEach((message) => {
            const readBy = Array.isArray(message.readBy) ? message.readBy : [];
            if (message.senderId !== userId && !readBy.includes(userId)) {
                unreadCount += 1;
            }
        });
    });
    return unreadCount;
}

function renderVATasks() {
    const vaApprovalNote = document.getElementById('vaApprovalNote');
    const availableTasks = getTasks().filter(t => t.status === 'open');
    const vaTasksContainer = document.getElementById('vaTasks');

    if (!currentUser || currentUser.role !== 'va') {
        return;
    }

    if (currentUser.approvalStatus !== 'approved') {
        if (vaApprovalNote) {
            vaApprovalNote.innerText = 'Your application is pending admin approval. You can browse tasks but cannot apply yet.';
        }

        if (vaTasksContainer) {
            vaTasksContainer.innerHTML = '<p>Approval pending. Task applications will unlock after admin approval.</p>';
        }
        return;
    }

    if (vaApprovalNote) {
        vaApprovalNote.innerText = 'Apply to matching tasks and grow your client portfolio.';
    }

    if (vaTasksContainer) {
        if (availableTasks.length > 0) {
            vaTasksContainer.innerHTML = availableTasks.map(task => `
                <div class="task-item">
                    <strong>${escapeHtml(task.title)}</strong>
                    <span>$${escapeHtml(task.budget)}</span>
                    <p>${escapeHtml(task.description)}</p>
                    <p>Client: ${escapeHtml(getUserDisplay(task.clientId))}${task.milestone ? ` · Milestone: ${escapeHtml(task.milestone)}` : ''}</p>
                    ${(task.applicants || []).includes(currentUser?.id)
                        ? '<button class="btn btn-primary btn-sm" disabled>Applied</button>'
                        : `<button class="btn btn-primary btn-sm" onclick="applyForTask(${task.id})">Apply</button>`
                    }
                </div>
            `).join('');
        } else {
            vaTasksContainer.innerHTML = '<p>No open tasks</p>';
        }
    }
}

function renderVAAssignedTasks() {
    if (!currentUser || currentUser.role !== 'va') {
        return;
    }

    const assignedContainer = document.getElementById('vaAssignedTasks');
    if (!assignedContainer) {
        return;
    }

    const assignedTasks = getTasks().filter((task) => task.acceptedVaId === currentUser.id);
    if (!assignedTasks.length) {
        assignedContainer.innerHTML = '<p>No assigned tasks yet.</p>';
        return;
    }

    assignedContainer.innerHTML = assignedTasks.map((task) => `
        <div class="task-item">
            <strong>${escapeHtml(task.title)}</strong>
            <span>$${escapeHtml(task.budget)} · ${escapeHtml(task.status)}</span>
            <p>${escapeHtml(task.description)}</p>
            <p>Client: ${escapeHtml(getUserDisplay(task.clientId))} · Invoice: ${escapeHtml(task.invoiceStatus || 'pending')}</p>
            ${renderTaskThread(task, 'va')}
            ${renderTaskRating(task, 'va')}
        </div>
    `).join('');
}

function renderClientVADirectory() {
    if (!currentUser || currentUser.role !== 'client') {
        return;
    }

    const directory = document.getElementById('clientVaDirectory');
    if (!directory) {
        return;
    }

    const searchQuery = (document.getElementById('clientVaSearch')?.value || '').trim().toLowerCase();
    const profiles = getProfiles();
    const users = getUsers();
    const approvedVAs = users.filter((user) => user.role === 'va' && user.approvalStatus === 'approved');

    const filteredVAs = approvedVAs.filter((vaUser) => {
        const profile = profiles[vaUser.id] || {};
        const skills = (profile.skills || '').toLowerCase();
        const tools = (profile.tools || '').toLowerCase();
        const availability = (profile.availability || '').toLowerCase();
        const timezone = (profile.timezone || '').toLowerCase();
        const name = (profile.name || '').toLowerCase();
        const email = (vaUser.email || '').toLowerCase();
        const haystack = `${name} ${email} ${skills} ${tools} ${availability} ${timezone}`;
        return !searchQuery || haystack.includes(searchQuery);
    });

    if (!filteredVAs.length) {
        directory.innerHTML = '<p>No matching VAs found.</p>';
        return;
    }

    directory.innerHTML = filteredVAs.map((vaUser) => {
        const profile = profiles[vaUser.id] || {};
        const rateLabel = profile.hourlyRate ? `$${profile.hourlyRate}/hr` : 'Rate on request';
        const availabilityLabel = profile.availability || 'Availability not set';
        const rating = getAverageRatingForVA(vaUser.id);
        const verificationLabel = profile.verificationStatus === 'verified' ? 'Verified' : 'Unverified';
        return `
            <div class="task-item">
                <strong>${escapeHtml(profile.name || 'VA Professional')}</strong>
                <span>${escapeHtml(vaUser.email)}</span>
                <p>${escapeHtml(profile.skills || 'Skills will appear after profile completion.')}</p>
                <p>${escapeHtml(rateLabel)} · ${escapeHtml(availabilityLabel)}</p>
                <p>${verificationLabel} · Rating ${rating ? rating.toFixed(1) : 'N/A'}</p>
                <div class="inline-row">
                    <button class="btn btn-primary btn-sm" onclick="openVAProfilePreview('${vaUser.id}')">View Profile</button>
                    <button class="btn btn-primary btn-sm" onclick="openPrivateMessageModal('${vaUser.id}')">Message</button>
                    ${profile.cvLink ? `<a href="${safeUrl(profile.cvLink)}" target="_blank" rel="noopener noreferrer">CV</a>` : ''}
                    ${profile.portfolioLink ? `<a href="${safeUrl(profile.portfolioLink)}" target="_blank" rel="noopener noreferrer">Portfolio</a>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function renderClientMatches() {
    if (!currentUser || currentUser.role !== 'client') {
        return;
    }

    const container = document.getElementById('clientMatches');
    if (!container) {
        return;
    }

    const tasks = getTasks().filter((task) => task.clientId === currentUser.id && task.status === 'open');
    const latestTask = tasks[tasks.length - 1];
    if (!latestTask) {
        container.innerHTML = '<p>Post a task to see recommended VA matches.</p>';
        return;
    }

    const profiles = getProfiles();
    const approvedVAs = getUsers().filter((user) => user.role === 'va' && user.approvalStatus === 'approved');

    const scored = approvedVAs.map((vaUser) => {
        const profile = profiles[vaUser.id] || {};
        const profileText = `${profile.skills || ''} ${profile.tools || ''}`.toLowerCase();
        let score = 0;
        if (profileText.includes((latestTask.category || '').toLowerCase())) {
            score += 3;
        }
        if ((profile.availability || '').toLowerCase().includes('full')) {
            score += 2;
        }
        const rating = getAverageRatingForVA(vaUser.id);
        score += rating;

        return { vaUser, profile, score, rating };
    }).sort((a, b) => b.score - a.score).slice(0, 3);

    if (!scored.length) {
        container.innerHTML = '<p>No matches available yet.</p>';
        return;
    }

    container.innerHTML = scored.map((item) => `
        <div class="task-item">
            <strong>${escapeHtml(item.profile.name || item.vaUser.email)}</strong>
            <span>Score ${item.score.toFixed(1)} · Rating ${item.rating ? item.rating.toFixed(1) : 'N/A'}</span>
            <p>${escapeHtml(item.profile.skills || 'Skills not added yet.')}</p>
            <div class="inline-row">
                <button class="btn btn-primary btn-sm" onclick="openVAProfilePreview('${item.vaUser.id}')">View Profile</button>
                <button class="btn btn-primary btn-sm" onclick="openPrivateMessageModal('${item.vaUser.id}')">Message</button>
            </div>
        </div>
    `).join('');
}

function renderClientConversations() {
    if (!currentUser || currentUser.role !== 'client') {
        return;
    }

    const container = document.getElementById('clientConversations');
    if (!container) {
        return;
    }

    const conversations = getConversations()
        .filter((conversation) => conversation.clientId === currentUser.id)
        .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

    if (!conversations.length) {
        container.innerHTML = '<p>No private messages yet.</p>';
        return;
    }

    markConversationsAsRead(conversations, currentUser.id);

    container.innerHTML = conversations.map((conversation) => renderConversationCard(conversation, 'client')).join('');
}

function renderVAConversations() {
    if (!currentUser || currentUser.role !== 'va') {
        return;
    }

    const container = document.getElementById('vaConversations');
    if (!container) {
        return;
    }

    const conversations = getConversations()
        .filter((conversation) => conversation.vaId === currentUser.id)
        .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

    if (!conversations.length) {
        container.innerHTML = '<p>No private messages yet.</p>';
        return;
    }

    markConversationsAsRead(conversations, currentUser.id);

    container.innerHTML = conversations.map((conversation) => renderConversationCard(conversation, 'va')).join('');
}

function markConversationsAsRead(conversations, userId) {
    let hasUpdates = false;
    conversations.forEach((conversation) => {
        (conversation.messages || []).forEach((message) => {
            message.readBy = Array.isArray(message.readBy) ? message.readBy : [];
            if (message.senderId !== userId && !message.readBy.includes(userId)) {
                message.readBy.push(userId);
                hasUpdates = true;
            }
        });
    });

    if (hasUpdates) {
        saveConversations(getConversations().map((savedConversation) => {
            const updated = conversations.find((conversation) => conversation.id === savedConversation.id);
            return updated || savedConversation;
        }));
    }
}

function renderConversationCard(conversation, viewerRole) {
    const counterpartId = viewerRole === 'client' ? conversation.vaId : conversation.clientId;
    const counterpart = getUserDisplay(counterpartId);
    const messages = Array.isArray(conversation.messages) ? conversation.messages : [];

    const lastMessages = messages.slice(-3);
    const messagesMarkup = lastMessages.length
        ? lastMessages.map((message) => `
            <div class="message-item">
                <strong>${escapeHtml(getUserDisplay(message.senderId))}</strong>
                <p>${escapeHtml(message.text)}</p>
            </div>
        `).join('')
        : '<p>No messages yet.</p>';

    return `
        <div class="task-item">
            <strong>${viewerRole === 'client' ? 'VA' : 'Client'}: ${escapeHtml(counterpart)}</strong>
            <div class="message-list">${messagesMarkup}</div>
            <div class="inline-row">
                <input class="message-input" id="conversationReply${viewerRole}${conversation.id}" type="text" placeholder="Write a private message..." onkeydown="if (event.key === 'Enter') { event.preventDefault(); sendConversationReply(${conversation.id}, '${viewerRole}'); }">
                <button class="btn btn-primary btn-sm" onclick="sendConversationReply(${conversation.id}, '${viewerRole}')">Send</button>
            </div>
        </div>
    `;
}

function openPrivateMessageModal(vaId) {
    if (!currentUser || currentUser.role !== 'client') {
        showToast('Only clients can start private VA messages.', 'error');
        return;
    }

    const vaUser = getUserById(vaId);
    if (!vaUser || vaUser.role !== 'va') {
        showToast('Selected VA profile not found.', 'error');
        return;
    }

    const pmVaId = document.getElementById('pmVaId');
    const recipient = document.getElementById('privateMessageRecipient');
    if (pmVaId) {
        pmVaId.value = vaId;
    }
    if (recipient) {
        const vaName = (getProfiles()[vaId] || {}).name;
        recipient.innerText = `Send a direct message to ${vaName ? `${vaName} (${vaUser.email})` : vaUser.email}`;
    }

    const form = document.getElementById('privateMessageForm');
    if (form) {
        form.reset();
        if (pmVaId) {
            pmVaId.value = vaId;
        }
    }

    const modal = document.getElementById('privateMessageModal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function openVAProfilePreview(vaId) {
    if (!currentUser || currentUser.role !== 'client') {
        showToast('Only clients can view VA profile previews.', 'error');
        return;
    }

    const vaUser = getUserById(vaId);
    if (!vaUser || vaUser.role !== 'va' || vaUser.approvalStatus !== 'approved') {
        showToast('VA profile is unavailable.', 'error');
        return;
    }

    const profiles = getProfiles();
    const profile = profiles[vaId] || {};

    const previewVaId = document.getElementById('previewVaId');
    const vaPreviewName = document.getElementById('vaPreviewName');
    const vaPreviewSubtitle = document.getElementById('vaPreviewSubtitle');
    const vaPreviewContent = document.getElementById('vaPreviewContent');
    const previewInviteTask = document.getElementById('previewInviteTask');

    if (previewVaId) {
        previewVaId.value = vaId;
    }

    if (vaPreviewName) {
        vaPreviewName.innerText = profile.name || 'VA Professional';
    }

    if (vaPreviewSubtitle) {
        vaPreviewSubtitle.innerText = vaUser.email;
    }

    if (vaPreviewContent) {
        const rating = getAverageRatingForVA(vaId);
        vaPreviewContent.innerHTML = `
            <p><strong>Bio:</strong> ${escapeHtml(profile.bio || 'No bio provided yet.')}</p>
            <p><strong>Skills:</strong> ${escapeHtml(profile.skills || 'Not specified')}</p>
            <p><strong>Tools:</strong> ${escapeHtml(profile.tools || 'Not specified')}</p>
            <p><strong>Experience:</strong> ${profile.experienceYears ? `${escapeHtml(profile.experienceYears)} years` : 'Not specified'}</p>
            <p><strong>Rate:</strong> ${profile.hourlyRate ? `$${escapeHtml(profile.hourlyRate)}/hr` : 'Not specified'}</p>
            <p><strong>Availability:</strong> ${escapeHtml(profile.availability || 'Not specified')}</p>
            <p><strong>Timezone:</strong> ${escapeHtml(profile.timezone || 'Not specified')}</p>
            <p><strong>Verification:</strong> ${escapeHtml(profile.verificationStatus || 'unverified')}</p>
            <p><strong>Average Rating:</strong> ${rating ? rating.toFixed(1) : 'N/A'}</p>
            <div class="inline-row" style="margin-top: 0.5rem;">
                ${profile.cvLink ? `<a href="${safeUrl(profile.cvLink)}" target="_blank" rel="noopener noreferrer">View CV</a>` : ''}
                ${profile.portfolioLink ? `<a href="${safeUrl(profile.portfolioLink)}" target="_blank" rel="noopener noreferrer">View Portfolio</a>` : ''}
            </div>
        `;
    }

    if (previewInviteTask) {
        const clientOpenTasks = getTasks().filter((task) =>
            task.clientId === currentUser.id && task.status === 'open' && !task.acceptedVaId
        );

        previewInviteTask.innerHTML = clientOpenTasks.length
            ? `<option value="">Select one of your open tasks</option>${clientOpenTasks
                .map((task) => `<option value="${task.id}">${escapeHtml(task.title)} ($${escapeHtml(task.budget)})</option>`)
                .join('')}`
            : '<option value="">No open tasks available</option>';
    }

    const previewCallTime = document.getElementById('previewCallTime');
    if (previewCallTime) {
        previewCallTime.value = '';
        const minDate = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
        previewCallTime.min = minDate.toISOString().slice(0, 16);
    }

    const modal = document.getElementById('vaProfilePreviewModal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function messagePreviewedVA() {
    const vaId = document.getElementById('previewVaId')?.value || '';
    if (!vaId) {
        showToast('Select a VA profile first.', 'error');
        return;
    }

    closeModal('vaProfilePreviewModal');
    openPrivateMessageModal(vaId);
}

function addConversationMessage(clientId, vaId, text, senderId = clientId) {
    const conversations = getConversations();
    let conversation = conversations.find((item) => item.clientId === clientId && item.vaId === vaId);

    if (!conversation) {
        conversation = {
            id: Date.now(),
            clientId,
            vaId,
            messages: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        conversations.push(conversation);
    }

    conversation.messages.push({
        senderId,
        text,
        createdAt: new Date().toISOString(),
        readBy: [senderId]
    });
    conversation.updatedAt = new Date().toISOString();

    saveConversations(conversations);
}

function invitePreviewedVAToTask() {
    if (!currentUser || currentUser.role !== 'client') {
        showToast('Only clients can send task invitations.', 'error');
        return;
    }

    const vaId = document.getElementById('previewVaId')?.value || '';
    const taskId = Number(document.getElementById('previewInviteTask')?.value || 0);

    if (!vaId) {
        showToast('Please select a VA first.', 'error');
        return;
    }

    if (!taskId) {
        showToast('Please choose one of your open tasks.', 'error');
        return;
    }

    const vaUser = getUserById(vaId);
    if (!vaUser || vaUser.role !== 'va' || vaUser.approvalStatus !== 'approved') {
        showToast('This VA is unavailable for invitations.', 'error');
        return;
    }

    const tasks = getTasks();
    const taskIndex = tasks.findIndex((task) => task.id === taskId);
    if (taskIndex === -1) {
        showToast('Task not found.', 'error');
        return;
    }

    const task = tasks[taskIndex];
    if (task.clientId !== currentUser.id) {
        showToast('You can only invite VAs to your own tasks.', 'error');
        return;
    }

    if (task.status !== 'open' || task.acceptedVaId) {
        showToast('Only open tasks without selected VA can receive invitations.', 'error');
        return;
    }

    const applicants = Array.isArray(task.applicants) ? task.applicants : [];
    if (!applicants.includes(vaId)) {
        task.applicants = [...applicants, vaId];
    }

    tasks[taskIndex] = task;
    saveTasks(tasks);

    addConversationMessage(
        currentUser.id,
        vaId,
        `Hi, I invited you to apply for "${task.title}" with a budget of $${task.budget}. Let me know if you are interested.`
    );

    closeModal('vaProfilePreviewModal');
    renderClientTasks();
    renderClientConversations();
    renderClientMatches();
    updateDashboardNotifications('client');
    showToast('Invitation sent. VA added to applicant shortlist.', 'success');
}

function handlePrivateMessageSend(event) {
    event.preventDefault();

    if (!currentUser || currentUser.role !== 'client') {
        showToast('Only clients can send this message.', 'error');
        return;
    }

    const vaId = document.getElementById('pmVaId')?.value || '';
    const text = (document.getElementById('privateMessageText')?.value || '').trim();

    if (!vaId || !text) {
        showToast('Please complete your message.', 'error');
        return;
    }

    const users = getUsers();
    const vaUser = users.find((user) => user.id === vaId && user.role === 'va' && user.approvalStatus === 'approved');
    if (!vaUser) {
        showToast('This VA is unavailable for direct messages.', 'error');
        return;
    }

    const conversations = getConversations();
    let conversation = conversations.find((item) => item.clientId === currentUser.id && item.vaId === vaId);

    if (!conversation) {
        conversation = {
            id: Date.now(),
            clientId: currentUser.id,
            vaId,
            messages: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        conversations.push(conversation);
    }

    conversation.messages.push({
        senderId: currentUser.id,
        text,
        createdAt: new Date().toISOString(),
        readBy: [currentUser.id]
    });
    conversation.updatedAt = new Date().toISOString();

    saveConversations(conversations);
    closeModal('privateMessageModal');
    renderClientConversations();
    updateDashboardNotifications('client');
    showToast('Private message sent.', 'success');
}

function sendConversationReply(conversationId, viewerRole) {
    if (!currentUser) {
        showToast('Please log in first.', 'error');
        return;
    }

    const input = document.getElementById(`conversationReply${viewerRole}${conversationId}`);
    const text = (input?.value || '').trim();
    if (!text) {
        showToast('Message cannot be empty.', 'error');
        return;
    }

    const conversations = getConversations();
    const conversation = conversations.find((item) => item.id === conversationId);
    if (!conversation) {
        showToast('Conversation not found.', 'error');
        return;
    }

    const isParticipant = conversation.clientId === currentUser.id || conversation.vaId === currentUser.id;
    if (!isParticipant) {
        showToast('You are not part of this conversation.', 'error');
        return;
    }

    conversation.messages = Array.isArray(conversation.messages) ? conversation.messages : [];
    conversation.messages.push({
        senderId: currentUser.id,
        text,
        createdAt: new Date().toISOString(),
        readBy: [currentUser.id]
    });
    conversation.updatedAt = new Date().toISOString();

    saveConversations(conversations);

    if (input) {
        input.value = '';
    }

    if (currentUser.role === 'client') {
        renderClientConversations();
        updateDashboardNotifications('client');
    } else if (currentUser.role === 'va') {
        renderVAConversations();
        updateDashboardNotifications('va');
    }
    showToast('Message sent.', 'success');
}

function renderVASchedules() {
    if (!currentUser || currentUser.role !== 'va') {
        return;
    }

    const container = document.getElementById('vaSchedules');
    if (!container) {
        return;
    }

    const schedules = getSchedules().filter((schedule) => schedule.vaId === currentUser.id)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (!schedules.length) {
        container.innerHTML = '<p>No call invitations yet.</p>';
        return;
    }

    container.innerHTML = schedules.map((schedule) => `
        <div class="task-item">
            <strong>Client: ${escapeHtml(getUserDisplay(schedule.clientId))}</strong>
            <span>${escapeHtml(schedule.status)}</span>
            <p>Proposed time: ${new Date(schedule.time).toLocaleString()}</p>
            ${schedule.status === 'pending'
                ? `<div class="inline-row">
                <button class="btn btn-primary btn-sm" onclick="updateScheduleStatus(${schedule.id}, 'accepted')">Accept</button>
                <button class="btn btn-primary btn-sm" onclick="updateScheduleStatus(${schedule.id}, 'declined')">Decline</button>
            </div>`
                : ''}
        </div>
    `).join('');
}

function scheduleCallWithPreviewedVA() {
    if (!currentUser || currentUser.role !== 'client') {
        showToast('Only clients can schedule calls.', 'error');
        return;
    }

    const vaId = document.getElementById('previewVaId')?.value || '';
    const dateTime = document.getElementById('previewCallTime')?.value || '';
    if (!vaId || !dateTime) {
        showToast('Please choose a valid call schedule time.', 'error');
        return;
    }

    if (Number.isNaN(new Date(dateTime).getTime()) || new Date(dateTime).getTime() <= Date.now()) {
        showToast('Please choose a call time in the future.', 'error');
        return;
    }

    const schedule = {
        id: generateId(),
        clientId: currentUser.id,
        vaId,
        time: new Date(dateTime).toISOString(),
        status: 'pending',
        createdAt: new Date().toISOString()
    };

    const schedules = getSchedules();
    schedules.push(schedule);
    saveSchedules(schedules);

    addConversationMessage(currentUser.id, vaId, `I proposed a call on ${new Date(schedule.time).toLocaleString()}. Please confirm if this works for you.`);
    closeModal('vaProfilePreviewModal');
    renderClientConversations();
    updateDashboardNotifications('client');
    showToast('Call invitation sent.', 'success');
}

function updateScheduleStatus(scheduleId, status) {
    if (!currentUser || currentUser.role !== 'va') {
        showToast('Only VAs can update call invitations.', 'error');
        return;
    }

    const schedules = getSchedules();
    const scheduleIndex = schedules.findIndex((schedule) => schedule.id === scheduleId && schedule.vaId === currentUser.id);
    if (scheduleIndex === -1) {
        showToast('Schedule invitation not found.', 'error');
        return;
    }

    schedules[scheduleIndex].status = status;
    saveSchedules(schedules);

    addConversationMessage(
        schedules[scheduleIndex].clientId,
        currentUser.id,
        `I ${status} the call invitation for ${new Date(schedules[scheduleIndex].time).toLocaleString()}.`,
        currentUser.id
    );
    renderVASchedules();
    renderVAConversations();
    updateDashboardNotifications('va');
    showToast(`Call invitation ${status}.`, 'success');
}

function renderAdminStats() {
    const tasks = getTasks();
    const users = getUsers();
    const totalUsersEl = document.getElementById('totalUsers');
    const activeTasksEl = document.getElementById('activeTasks');
    const completedTasksEl = document.getElementById('completedTasks');

    if (totalUsersEl) totalUsersEl.innerText = users.length;
    if (activeTasksEl) {
        activeTasksEl.innerText = tasks.filter(x => x.status === 'open' || x.status === 'in-progress').length;
    }
    if (completedTasksEl) {
        completedTasksEl.innerText = tasks.filter(x => x.status === 'completed').length;
    }

    renderAdminInquiries();
    renderAdminVAApplications();
    renderAdminTaskModeration();
}

function renderAdminTaskModeration() {
    const container = document.getElementById('adminTaskModeration');
    if (!container) {
        return;
    }

    const tasks = getTasks().slice(-6).reverse();
    if (!tasks.length) {
        container.innerHTML = '<p>No tasks to moderate.</p>';
        return;
    }

    container.innerHTML = tasks.map((task) => `
        <div class="task-item">
            <strong>${escapeHtml(task.title)}</strong>
            <span>${escapeHtml(task.status)} · ${escapeHtml(task.invoiceStatus || 'pending')}</span>
            <p>Client: ${escapeHtml(getUserDisplay(task.clientId))}</p>
            <div class="inline-row">
                <button class="btn btn-primary btn-sm" onclick="moderateTask(${task.id}, 'open')">Set Open</button>
                <button class="btn btn-primary btn-sm" onclick="moderateTask(${task.id}, 'completed')">Set Completed</button>
                <button class="btn btn-primary btn-sm" onclick="moderateTask(${task.id}, 'delete')">Delete</button>
            </div>
        </div>
    `).join('');
}

function moderateTask(taskId, action) {
    if (!currentUser || currentUser.role !== 'admin') {
        showToast('Only admins can moderate tasks.', 'error');
        return;
    }

    const tasks = getTasks();
    const taskIndex = tasks.findIndex((task) => task.id === taskId);
    if (taskIndex === -1) {
        showToast('Task not found.', 'error');
        return;
    }

    if (action === 'delete') {
        if (!window.confirm(`Delete task "${tasks[taskIndex].title}"? This cannot be undone.`)) {
            return;
        }
        tasks.splice(taskIndex, 1);
    } else {
        tasks[taskIndex].status = action;
    }

    saveTasks(tasks);
    renderAdminStats();
    updateDashboardNotifications('admin');
    showToast(action === 'delete' ? 'Task deleted.' : `Task set to ${action}.`, 'success');
}

function applyForTask(taskId) {
    if (!currentUser || currentUser.role !== 'va') {
        showToast('Please log in as a VA to apply.', 'error');
        return;
    }

    if (currentUser.approvalStatus !== 'approved') {
        showToast('Your VA application is still pending admin approval.', 'error');
        return;
    }

    const tasks = getTasks();
    const taskIndex = tasks.findIndex(task => task.id === taskId);
    if (taskIndex === -1) {
        showToast('Task not found.', 'error');
        return;
    }

    const task = tasks[taskIndex];
    const applicants = Array.isArray(task.applicants) ? task.applicants : [];
    if (applicants.includes(currentUser.id)) {
        showToast('You already applied for this task.', 'info');
        return;
    }

    task.applicants = [...applicants, currentUser.id];
    tasks[taskIndex] = task;
    saveTasks(tasks);
    renderVATasks();
    showToast('Application submitted successfully.', 'success');
}

function updateTaskStatus(taskId, status) {
    if (!currentUser || currentUser.role !== 'client') {
        showToast('Only clients can update task status.', 'error');
        return;
    }

    const tasks = getTasks();
    const taskIndex = tasks.findIndex(task => task.id === taskId);
    if (taskIndex === -1 || tasks[taskIndex].clientId !== currentUser.id) {
        showToast('Task not found.', 'error');
        return;
    }

    if ((status === 'in-progress' || status === 'completed') && !tasks[taskIndex].acceptedVaId) {
        showToast('Please accept a VA applicant first.', 'error');
        return;
    }

    tasks[taskIndex].status = status;
    saveTasks(tasks);
    renderClientTasks();
    renderClientMatches();
    updateDashboardNotifications('client');
    showToast(`Task updated to ${status}.`, 'success');
}

function releasePayment(taskId) {
    if (!currentUser || currentUser.role !== 'client') {
        showToast('Only clients can release payment.', 'error');
        return;
    }

    const tasks = getTasks();
    const taskIndex = tasks.findIndex((task) => task.id === taskId && task.clientId === currentUser.id);
    if (taskIndex === -1) {
        showToast('Task not found.', 'error');
        return;
    }

    if (tasks[taskIndex].status !== 'completed') {
        showToast('Task must be completed before releasing payment.', 'error');
        return;
    }

    tasks[taskIndex].invoiceStatus = 'paid';
    saveTasks(tasks);
    renderClientTasks();
    renderAdminStats();
    showToast('Payment marked as paid.', 'success');
}

function acceptApplicant(taskId, vaId) {
    if (!currentUser || currentUser.role !== 'client') {
        showToast('Only clients can accept applicants.', 'error');
        return;
    }

    const tasks = getTasks();
    const taskIndex = tasks.findIndex((task) => task.id === taskId);
    if (taskIndex === -1) {
        showToast('Task not found.', 'error');
        return;
    }

    const task = tasks[taskIndex];
    if (task.clientId !== currentUser.id) {
        showToast('You can only update your own tasks.', 'error');
        return;
    }

    const applicants = Array.isArray(task.applicants) ? task.applicants : [];
    if (!applicants.includes(vaId)) {
        showToast('Applicant not found for this task.', 'error');
        return;
    }

    if (task.acceptedVaId && task.acceptedVaId !== vaId) {
        showToast('A VA is already selected for this task.', 'error');
        return;
    }

    task.acceptedVaId = vaId;
    task.status = 'in-progress';
    tasks[taskIndex] = task;
    saveTasks(tasks);
    renderClientTasks();
    renderClientMatches();
    updateDashboardNotifications('client');
    showToast('VA accepted. Task moved to in progress.', 'success');
}

function renderTaskThread(task, viewerRole) {
    if (!task.acceptedVaId) {
        return '';
    }

    const canSeeThread = viewerRole === 'client'
        ? task.clientId === currentUser?.id
        : task.acceptedVaId === currentUser?.id;

    if (!canSeeThread) {
        return '';
    }

    const messages = Array.isArray(task.messages) ? task.messages : [];
    const messagesMarkup = messages.length
        ? messages.map((message) => `
            <div class="message-item">
                <strong>${escapeHtml(getUserDisplay(message.senderId))}</strong>
                <p>${escapeHtml(message.text)}</p>
            </div>
        `).join('')
        : '<p>No messages yet.</p>';

    return `
        <div class="sub-block">
            <p>Task Chat</p>
            <div class="message-list">${messagesMarkup}</div>
            ${task.status !== 'completed'
                ? `<div class="inline-row"><input class="message-input" id="taskMessage${viewerRole}${task.id}" type="text" placeholder="Type update..." onkeydown="if (event.key === 'Enter') { event.preventDefault(); sendTaskMessage(${task.id}, '${viewerRole}'); }" /><button class="btn btn-primary btn-sm" onclick="sendTaskMessage(${task.id}, '${viewerRole}')">Send</button></div>`
                : ''
            }
        </div>
    `;
}

function sendTaskMessage(taskId, senderRole) {
    if (!currentUser) {
        showToast('Please log in first.', 'error');
        return;
    }

    const input = document.getElementById(`taskMessage${senderRole}${taskId}`);
    const text = (input?.value || '').trim();
    if (!text) {
        showToast('Message cannot be empty.', 'error');
        return;
    }

    const tasks = getTasks();
    const taskIndex = tasks.findIndex((task) => task.id === taskId);
    if (taskIndex === -1) {
        showToast('Task not found.', 'error');
        return;
    }

    const task = tasks[taskIndex];
    const isParticipant = task.clientId === currentUser.id || task.acceptedVaId === currentUser.id;
    if (!isParticipant) {
        showToast('You are not part of this task.', 'error');
        return;
    }

    const messages = Array.isArray(task.messages) ? task.messages : [];
    messages.push({
        senderId: currentUser.id,
        text,
        createdAt: new Date().toISOString()
    });

    task.messages = messages;
    tasks[taskIndex] = task;
    saveTasks(tasks);

    if (input) {
        input.value = '';
    }

    if (currentUser.role === 'client') {
        renderClientTasks();
    } else if (currentUser.role === 'va') {
        renderVAAssignedTasks();
    }
    showToast('Task update sent.', 'success');
}

function renderTaskRating(task, viewerRole) {
    if (task.status !== 'completed' || !task.acceptedVaId) {
        return '';
    }

    const ratings = task.ratings || {};
    if (viewerRole === 'client' && task.clientId === currentUser?.id) {
        if (ratings.clientToVa) {
            return `<p>Rating given to VA: ${ratings.clientToVa}/5</p>`;
        }

        return `
            <div class="sub-block">
                <p>Rate your VA</p>
                <div class="inline-row">
                    <select id="taskRatingclient${task.id}">
                        <option value="">Select</option>
                        <option value="5">5</option>
                        <option value="4">4</option>
                        <option value="3">3</option>
                        <option value="2">2</option>
                        <option value="1">1</option>
                    </select>
                    <button class="btn btn-primary btn-sm" onclick="submitTaskRating(${task.id}, 'client')">Submit</button>
                </div>
            </div>
        `;
    }

    if (viewerRole === 'va' && task.acceptedVaId === currentUser?.id) {
        if (ratings.vaToClient) {
            return `<p>Your client rating: ${ratings.vaToClient}/5</p>`;
        }

        return `
            <div class="sub-block">
                <p>Rate your client</p>
                <div class="inline-row">
                    <select id="taskRatingva${task.id}">
                        <option value="">Select</option>
                        <option value="5">5</option>
                        <option value="4">4</option>
                        <option value="3">3</option>
                        <option value="2">2</option>
                        <option value="1">1</option>
                    </select>
                    <button class="btn btn-primary btn-sm" onclick="submitTaskRating(${task.id}, 'va')">Submit</button>
                </div>
            </div>
        `;
    }

    return '';
}

function submitTaskRating(taskId, ratingFromRole) {
    if (!currentUser) {
        showToast('Please log in first.', 'error');
        return;
    }

    const ratingEl = document.getElementById(`taskRating${ratingFromRole}${taskId}`);
    const rating = Number(ratingEl?.value || 0);
    if (!rating || rating < 1 || rating > 5) {
        showToast('Please select a rating from 1 to 5.', 'error');
        return;
    }

    const tasks = getTasks();
    const taskIndex = tasks.findIndex((task) => task.id === taskId);
    if (taskIndex === -1) {
        showToast('Task not found.', 'error');
        return;
    }

    const task = tasks[taskIndex];
    const ratings = task.ratings || {};

    if (ratingFromRole === 'client' && task.clientId === currentUser.id) {
        ratings.clientToVa = rating;
    } else if (ratingFromRole === 'va' && task.acceptedVaId === currentUser.id) {
        ratings.vaToClient = rating;
    } else {
        showToast('You cannot rate this task.', 'error');
        return;
    }

    task.ratings = ratings;
    tasks[taskIndex] = task;
    saveTasks(tasks);

    if (currentUser.role === 'client') {
        renderClientTasks();
    } else {
        renderVAAssignedTasks();
    }
    showToast('Rating submitted.', 'success');
}

function renderVACourses() {
    const courses = getCourses();
    const progress = getCourseProgress();
    const vaCourseContainer = document.getElementById('vaCourses');

    if (!vaCourseContainer) {
        return;
    }

    if (!currentUser || currentUser.role !== 'va') {
        vaCourseContainer.innerHTML = '<p>Please log in as a VA to view courses.</p>';
        return;
    }

    const userCourseState = progress[currentUser.id] || {};
    const vaCourseSummary = document.getElementById('vaCourseSummary');
    const completedCount = Object.values(userCourseState).filter(value => value === 'completed').length;
    const enrolledCount = Object.values(userCourseState).filter(value => value === 'enrolled').length;

    if (vaCourseSummary) {
        vaCourseSummary.innerText = `Completed ${completedCount} · In progress ${enrolledCount} · Certificates ${completedCount}`;
    }

    vaCourseContainer.innerHTML = courses.map(course => {
        const state = userCourseState[course.id] || 'not-started';
        let actionMarkup = `<button class="btn btn-primary btn-sm" onclick="enrollCourse(${course.id})">Enroll</button>`;

        if (state === 'enrolled') {
            actionMarkup = `<button class="btn btn-primary btn-sm" onclick="completeCourse(${course.id})">Mark Complete</button>`;
        }

        if (state === 'completed') {
            actionMarkup = `<button class="btn btn-primary btn-sm" onclick="downloadCertificate(${course.id})">View Certificate</button>`;
        }

        return `
            <div class="task-item">
                <strong>${escapeHtml(course.title)}</strong>
                <span>${escapeHtml(course.level)} · ${escapeHtml(course.duration)}</span>
                <p>${escapeHtml(course.description)}</p>
                ${actionMarkup}
            </div>
        `;
    }).join('');
}

function enrollCourse(courseId) {
    if (!currentUser || currentUser.role !== 'va') {
        showToast('Please log in as a VA to enroll in courses.', 'error');
        return;
    }

    const progress = getCourseProgress();
    const userCourseState = progress[currentUser.id] || {};
    if (userCourseState[courseId] === 'completed') {
        showToast('You already completed this course.', 'info');
        return;
    }

    userCourseState[courseId] = 'enrolled';
    progress[currentUser.id] = userCourseState;
    saveCourseProgress(progress);
    renderVACourses();
    showToast('Course enrolled.', 'success');
}

function completeCourse(courseId) {
    if (!currentUser || currentUser.role !== 'va') {
        showToast('Please log in as a VA to complete courses.', 'error');
        return;
    }

    const progress = getCourseProgress();
    const userCourseState = progress[currentUser.id] || {};
    userCourseState[courseId] = 'completed';
    progress[currentUser.id] = userCourseState;
    saveCourseProgress(progress);
    renderVACourses();
    showToast('Course marked completed.', 'success');
}

function downloadCertificate(courseId) {
    if (!currentUser || currentUser.role !== 'va') {
        showToast('Please log in as a VA first.', 'error');
        return;
    }

    const course = getCourses().find(item => item.id === courseId);
    if (!course) {
        showToast('Course not found.', 'error');
        return;
    }

    const certificateName = (getProfiles()[currentUser.id] || {}).name || currentUser.email;
    const certificateContent = [
        'Biz Buddy Certificate of Completion',
        `Name: ${certificateName}`,
        `Course: ${course.title}`,
        `Date: ${new Date().toLocaleDateString()}`
    ].join('\n');

    const blob = new Blob([certificateContent], { type: 'text/plain' });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `${course.title.replace(/\s+/g, '-').toLowerCase()}-certificate.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(downloadUrl);
    showToast('Certificate downloaded.', 'success');
}

function renderAdminInquiries() {
    const inquiryContainer = document.getElementById('adminInquiries');
    if (!inquiryContainer) {
        return;
    }

    const inquiries = getInquiries().slice(-5).reverse();
    if (!inquiries.length) {
        inquiryContainer.innerHTML = '<p>No inquiries yet.</p>';
        return;
    }

    inquiryContainer.innerHTML = inquiries.map((inquiry) => `
        <div class="task-item">
            <strong>${escapeHtml(inquiry.name)}</strong>
            <span>${escapeHtml(inquiry.email)}</span>
            <p>${escapeHtml(inquiry.message)}</p>
            <p>Received ${inquiry.submittedAt ? new Date(inquiry.submittedAt).toLocaleString() : 'recently'}</p>
        </div>
    `).join('');
}

function renderAdminVAApplications() {
    const container = document.getElementById('adminVaApplications');
    if (!container) {
        return;
    }

    const profiles = getProfiles();
    const vaUsers = getUsers().filter((user) => user.role === 'va');
    if (!vaUsers.length) {
        container.innerHTML = '<p>No VA applications yet.</p>';
        return;
    }

    container.innerHTML = vaUsers.map((vaUser) => {
        const profile = profiles[vaUser.id] || {};
        const status = vaUser.approvalStatus || 'approved';
        const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);

        return `
            <div class="task-item">
                <strong>${escapeHtml(profile.name ? `${profile.name} · ${vaUser.email}` : vaUser.email)}</strong>
                <span>${escapeHtml(statusLabel)}</span>
                <p>Verification: ${escapeHtml(profile.verificationStatus || 'unverified')}</p>
                <p>CV: ${profile.cvLink ? `<a href="${safeUrl(profile.cvLink)}" target="_blank" rel="noopener noreferrer">Open</a>` : 'Not provided'}</p>
                <p>Portfolio: ${profile.portfolioLink ? `<a href="${safeUrl(profile.portfolioLink)}" target="_blank" rel="noopener noreferrer">Open</a>` : 'Not provided'}</p>
                ${profile.verificationDocData ? `<p><a href="${safeUrl(profile.verificationDocData)}" download="${escapeHtml(profile.verificationDocName || 'verification')}">Verification file</a></p>` : ''}
                <div class="inline-row">
                    <button class="btn btn-primary btn-sm" onclick="updateVAApproval('${vaUser.id}', 'approved')">Approve</button>
                    <button class="btn btn-primary btn-sm" onclick="updateVAApproval('${vaUser.id}', 'rejected')">Reject</button>
                    <button class="btn btn-primary btn-sm" onclick="updateVAApproval('${vaUser.id}', 'pending')">Set Pending</button>
                    <button class="btn btn-primary btn-sm" onclick="setVAVerification('${vaUser.id}', 'verified')">Mark Verified</button>
                </div>
            </div>
        `;
    }).join('');
}

function setVAVerification(vaId, status) {
    if (!currentUser || currentUser.role !== 'admin') {
        showToast('Only admins can verify VAs.', 'error');
        return;
    }

    const profiles = getProfiles();
    const profile = profiles[vaId] || {};
    profile.verificationStatus = status;
    profiles[vaId] = profile;
    saveProfiles(profiles);
    renderAdminVAApplications();
    showToast(`VA verification set to ${status}.`, 'success');
}

function bulkApproveVAs() {
    if (!currentUser || currentUser.role !== 'admin') {
        showToast('Only admins can bulk approve.', 'error');
        return;
    }

    const users = getUsers().map((user) => {
        if (user.role === 'va' && user.approvalStatus === 'pending') {
            return { ...user, approvalStatus: 'approved' };
        }
        return user;
    });
    saveUsers(users);
    renderAdminStats();
    updateDashboardNotifications('admin');
    showToast('All pending VA applications approved.', 'success');
}

function exportDataCsv(type) {
    if (!currentUser || currentUser.role !== 'admin') {
        showToast('Only admins can export data.', 'error');
        return;
    }

    let rows = [];
    if (type === 'users') {
        rows = getUsers().map((user) => ({
            id: user.id,
            email: user.email,
            role: user.role,
            approvalStatus: user.approvalStatus || ''
        }));
    } else if (type === 'tasks') {
        rows = getTasks().map((task) => ({
            id: task.id,
            title: task.title,
            status: task.status,
            budget: task.budget,
            invoiceStatus: task.invoiceStatus || 'pending',
            clientId: task.clientId,
            acceptedVaId: task.acceptedVaId || ''
        }));
    } else if (type === 'inquiries') {
        rows = getInquiries().map((inquiry) => ({
            id: inquiry.id,
            name: inquiry.name,
            email: inquiry.email,
            message: inquiry.message,
            submittedAt: inquiry.submittedAt
        }));
    }

    if (!rows.length) {
        showToast('No data available for export.', 'info');
        return;
    }

    const csv = toCsv(rows);
    downloadTextFile(`${type}-export.csv`, csv, 'text/csv');
    showToast(`${type} export downloaded.`, 'success');
}

function updateVAApproval(vaId, status) {
    if (!currentUser || currentUser.role !== 'admin') {
        showToast('Only admins can review applications.', 'error');
        return;
    }

    const users = getUsers();
    const userIndex = users.findIndex((user) => user.id === vaId && user.role === 'va');
    if (userIndex === -1) {
        showToast('VA account not found.', 'error');
        return;
    }

    users[userIndex].approvalStatus = status;
    saveUsers(users);

    if (currentUser.id === vaId) {
        currentUser = users[userIndex];
        saveCurrentSession(currentUser);
    }

    renderAdminStats();
    updateDashboardNotifications('admin');
    showToast(`VA status updated to ${status}.`, 'success');
}

// ===== MODAL FUNCTIONS =====
function openPostTaskModal() {
    const form = document.getElementById('postTaskForm');
    if (form) {
        form.reset();
    }
    const modal = document.getElementById('postTaskModal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function openProfileModal() {
    if (!currentUser) {
        showToast('Please log in first.', 'error');
        return;
    }

    const profiles = getProfiles();
    const profile = profiles[currentUser.id] || {};

    const profileNameEl = document.getElementById('profileName');
    const profileEmailEl = document.getElementById('profileEmail');
    const profileBioEl = document.getElementById('profileBio');
    const profileSkillsEl = document.getElementById('profileSkills');
    const profileToolsEl = document.getElementById('profileTools');
    const profileExperienceEl = document.getElementById('profileExperience');
    const profileRateEl = document.getElementById('profileRate');
    const profileAvailabilityEl = document.getElementById('profileAvailability');
    const profileTimezoneEl = document.getElementById('profileTimezone');
    const profileVerificationPreview = document.getElementById('profileVerificationPreview');
    const vaProfileFieldsEl = document.getElementById('vaProfileFields');

    if (profileNameEl) profileNameEl.value = profile.name || '';
    if (profileEmailEl) profileEmailEl.value = profile.email || currentUser.email || '';
    if (profileBioEl) profileBioEl.value = profile.bio || '';
    if (profileSkillsEl) profileSkillsEl.value = profile.skills || '';
    if (profileToolsEl) profileToolsEl.value = profile.tools || '';
    if (profileExperienceEl) profileExperienceEl.value = profile.experienceYears || '';
    if (profileRateEl) profileRateEl.value = profile.hourlyRate || '';
    if (profileAvailabilityEl) profileAvailabilityEl.value = profile.availability || '';
    if (profileTimezoneEl) profileTimezoneEl.value = profile.timezone || '';
    if (profileVerificationPreview) {
        profileVerificationPreview.innerHTML = profile.verificationDocData
            ? `<a href="${safeUrl(profile.verificationDocData)}" download="${escapeHtml(profile.verificationDocName || 'verification-doc')}">Current verification file</a>`
            : '<span>No verification file uploaded yet.</span>';
    }
    if (vaProfileFieldsEl) {
        vaProfileFieldsEl.style.display = currentUser.role === 'va' ? 'block' : 'none';
    }
    const profileVerificationFileEl = document.getElementById('profileVerificationFile');
    if (profileVerificationFileEl) profileVerificationFileEl.value = '';

    const modal = document.getElementById('profileModal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function openLoginModal(role) {
    authRole = role || null;
    ['loginForm', 'signupForm'].forEach((formId) => {
        const form = document.getElementById(formId);
        if (form) form.reset();
    });
    setAuthMode('login');
    updateSignupRequirementUI();
    const modal = document.getElementById('loginModal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

// ===== AUTH FUNCTIONS (Login/Signup) =====
function setAuthMode(mode) {
    authMode = mode;

    const authTitle = document.getElementById('authTitle');
    const authSubtitle = document.getElementById('authSubtitle');
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const signupRoleGroup = document.getElementById('signupRoleGroup');
    const vaApplicationFields = document.getElementById('vaApplicationFields');
    const vaRequirementsChecklist = document.getElementById('vaRequirementsChecklist');
    const authTabs = document.querySelectorAll('.auth-tab');

    // Update title and subtitle
    if (authTitle && authSubtitle) {
        if (mode === 'login') {
            authTitle.innerText = 'Log in to Biz Buddy';
            authSubtitle.innerText = 'Use your email to sign in.';
        } else {
            authTitle.innerText = 'Create your account';
            authSubtitle.innerText = 'Join Biz Buddy to get started.';
        }
    }

    // Toggle forms
    if (loginForm) loginForm.style.display = mode === 'login' ? 'block' : 'none';
    if (signupForm) signupForm.style.display = mode === 'signup' ? 'block' : 'none';

    // Show role selection only if opening sign up without pre-selected role
    if (signupRoleGroup) {
        signupRoleGroup.style.display = !authRole && mode === 'signup' ? 'block' : 'none';
    }

    if (vaApplicationFields) {
        vaApplicationFields.style.display = mode === 'signup' && isVASignupFlow() ? 'block' : 'none';
    }

    if (vaRequirementsChecklist) {
        vaRequirementsChecklist.style.display = mode === 'signup' && isVASignupFlow() ? 'block' : 'none';
    }

    // Update active tab
    authTabs.forEach(tab => {
        const tabMode = tab.getAttribute('data-mode');
        if (tabMode === mode) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    // Clear error messages
    clearAuthErrors();
    updateSignupRequirementUI();
}

function isVASignupFlow() {
    if (authRole === 'va') {
        return true;
    }

    const selectedRole = document.getElementById('signupRole')?.value || 'client';
    return authMode === 'signup' && selectedRole === 'va';
}

function updateSignupRequirementUI() {
    const vaApplicationFields = document.getElementById('vaApplicationFields');
    const checklist = document.getElementById('vaRequirementsChecklist');

    if (vaApplicationFields) {
        vaApplicationFields.style.display = isVASignupFlow() ? 'block' : 'none';
    }

    if (checklist) {
        checklist.style.display = isVASignupFlow() ? 'block' : 'none';
    }
}

function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function isValidHttpUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_error) {
        return false;
    }
}

function showAuthError(message) {
    const errorElement = document.getElementById('authError');
    if (errorElement) {
        errorElement.innerText = message;
        errorElement.style.display = 'block';
    }
}

function clearAuthErrors() {
    const errorElements = document.querySelectorAll('.error-message');
    errorElements.forEach(el => {
        el.style.display = 'none';
        el.innerText = '';
    });

    const authError = document.getElementById('authError');
    if (authError) {
        authError.style.display = 'none';
    }
}

function handleLogin(event) {
    event.preventDefault();
    clearAuthErrors();

    const email = (document.getElementById('loginEmail')?.value || '').trim();
    const password = document.getElementById('loginPassword')?.value || '';

    // Basic validation
    if (!email || !password) {
        showAuthError('Please fill in all fields');
        return;
    }

    if (!email.includes('@')) {
        showAuthError('Please enter a valid email');
        return;
    }

    const users = getUsers();
    const matchedUser = users.find(user => user.email.toLowerCase() === email.toLowerCase());

    if (!matchedUser || matchedUser.password !== password) {
        showAuthError('Invalid email or password');
        return;
    }

    if (authRole && matchedUser.role !== authRole) {
        showAuthError(`This account is not registered as ${authRole.toUpperCase()}`);
        return;
    }

    closeModal('loginModal');
    currentUser = matchedUser;
    saveCurrentSession(matchedUser);
    openDashboard(matchedUser.role);
    updateNavForSession();
    if (matchedUser.role === 'va' && matchedUser.approvalStatus !== 'approved') {
        showToast('VA application is pending admin review.', 'info');
        return;
    }
    showToast('Welcome back.', 'success');
}

function handleSignup(event) {
    event.preventDefault();
    clearAuthErrors();

    const email = (document.getElementById('signupEmail')?.value || '').trim();
    const password = document.getElementById('signupPassword')?.value || '';
    const confirmPassword = document.getElementById('signupConfirm')?.value || '';
    const role = authRole || document.getElementById('signupRole')?.value || 'client';

    // Basic validation
    if (!email || !password || !confirmPassword) {
        showAuthError('Please fill in all fields');
        return;
    }

    if (!isValidEmail(email)) {
        showAuthError('Please enter a valid email');
        return;
    }

    if (password.length < 6) {
        showAuthError('Password must be at least 6 characters');
        return;
    }

    if (password !== confirmPassword) {
        showAuthError('Passwords do not match');
        return;
    }

    if (role === 'va') {
        const cvLink = (document.getElementById('signupCvLink')?.value || '').trim();
        const portfolioLink = (document.getElementById('signupPortfolioLink')?.value || '').trim();
        const vaDetailsError = document.getElementById('signupVaDetailsError');
        const reqEnglish = document.getElementById('reqEnglish')?.checked;
        const reqTools = document.getElementById('reqTools')?.checked;
        const reqConfidentiality = document.getElementById('reqConfidentiality')?.checked;
        const requirementError = document.getElementById('signupRequirementsError');

        if (!cvLink || !portfolioLink) {
            if (vaDetailsError) {
                vaDetailsError.innerText = 'Please add both your CV link and portfolio link.';
                vaDetailsError.style.display = 'block';
            }
            return;
        }

        if (!isValidHttpUrl(cvLink) || !isValidHttpUrl(portfolioLink)) {
            if (vaDetailsError) {
                vaDetailsError.innerText = 'Please enter valid links starting with http:// or https://';
                vaDetailsError.style.display = 'block';
            }
            return;
        }

        if (!(reqEnglish && reqTools && reqConfidentiality)) {
            if (requirementError) {
                requirementError.innerText = 'Please confirm all VA requirements before creating your account.';
                requirementError.style.display = 'block';
            }
            return;
        }
    }

    const users = getUsers();
    const hasExisting = users.some(user => user.email.toLowerCase() === email.toLowerCase());
    if (hasExisting) {
        showAuthError('An account with this email already exists');
        return;
    }

    let nextIndex = users.filter(user => user.role === role).length + 1;
    while (users.some(user => user.id === `${role}${nextIndex}`)) {
        nextIndex += 1;
    }
    const nextRoleId = `${role}${nextIndex}`;
    const newUser = {
        id: nextRoleId,
        email,
        password,
        role,
        approvalStatus: role === 'va' ? 'pending' : undefined
    };

    users.push(newUser);
    saveUsers(users);

    const profiles = getProfiles();
    profiles[newUser.id] = {
        name: '',
        email,
        bio: '',
        skills: '',
        tools: '',
        experienceYears: '',
        hourlyRate: '',
        availability: '',
        timezone: '',
        cvLink: role === 'va' ? (document.getElementById('signupCvLink')?.value || '').trim() : '',
        portfolioLink: role === 'va' ? (document.getElementById('signupPortfolioLink')?.value || '').trim() : '',
        verificationStatus: role === 'va' ? 'unverified' : '',
        verificationDocName: '',
        verificationDocData: ''
    };
    saveProfiles(profiles);

    closeModal('loginModal');
    currentUser = newUser;
    saveCurrentSession(newUser);
    openDashboard(role);
    updateNavForSession();
    showToast(role === 'va' ? 'VA account created and submitted for admin review.' : 'Account created successfully.', 'success');
}

const MAX_ATTACHMENT_BYTES = 1024 * 1024;

async function handlePostTask(event) {
    event.preventDefault();

    if (!currentUser || currentUser.role !== 'client') {
        showToast('Please log in as a client to post tasks.', 'error');
        return;
    }

    const title = (document.getElementById('taskTitle')?.value || '').trim();
    const description = (document.getElementById('taskDescription')?.value || '').trim();
    const budget = Number(document.getElementById('taskBudget')?.value || 0);
    const category = document.getElementById('taskCategory')?.value || '';
    const milestone = (document.getElementById('taskMilestone')?.value || '').trim();
    const attachmentFile = document.getElementById('taskAttachment')?.files?.[0] || null;

    if (!title || !description || !category) {
        showToast('Please complete all task fields.', 'error');
        return;
    }

    if (!Number.isFinite(budget) || budget <= 0) {
        showToast('Please enter a budget greater than $0.', 'error');
        return;
    }

    if (attachmentFile && attachmentFile.size > MAX_ATTACHMENT_BYTES) {
        showToast('Attachment is too large for demo storage (max 1 MB).', 'error');
        return;
    }

    const tasks = getTasks();
    const nextId = tasks.length ? Math.max(...tasks.map(task => task.id)) + 1 : 1;
    let attachmentData = '';
    let attachmentName = '';
    if (attachmentFile) {
        attachmentData = await fileToDataUrl(attachmentFile);
        attachmentName = attachmentFile.name;
    }

    const newTask = {
        id: nextId,
        title,
        description,
        category,
        budget,
        deadline: '',
        status: 'open',
        clientId: currentUser.id,
        postedDate: new Date().toISOString().slice(0, 10),
        applicants: [],
        acceptedVaId: null,
        messages: [],
        ratings: {},
        milestone,
        attachmentData,
        attachmentName,
        invoiceStatus: 'pending'
    };

    tasks.push(newTask);
    try {
        saveTasks(tasks);
    } catch (_error) {
        showToast('Could not save the task: browser storage is full.', 'error');
        return;
    }

    const form = document.getElementById('postTaskForm');
    if (form) {
        form.reset();
    }

    closeModal('postTaskModal');
    renderClientTasks();
    renderClientMatches();
    renderAdminStats();
    showToast('Task posted successfully.', 'success');
}

async function handleProfileSave(event) {
    event.preventDefault();

    if (!currentUser) {
        showToast('Please log in first.', 'error');
        return;
    }

    const name = (document.getElementById('profileName')?.value || '').trim();
    const email = (document.getElementById('profileEmail')?.value || '').trim();
    const bio = (document.getElementById('profileBio')?.value || '').trim();
    const skills = (document.getElementById('profileSkills')?.value || '').trim();
    const tools = (document.getElementById('profileTools')?.value || '').trim();
    const experienceYears = (document.getElementById('profileExperience')?.value || '').trim();
    const hourlyRate = (document.getElementById('profileRate')?.value || '').trim();
    const availability = (document.getElementById('profileAvailability')?.value || '').trim();
    const timezone = (document.getElementById('profileTimezone')?.value || '').trim();
    const verificationFile = document.getElementById('profileVerificationFile')?.files?.[0] || null;

    if (!name || !email) {
        showToast('Name and email are required.', 'error');
        return;
    }

    if (!isValidEmail(email)) {
        showToast('Please enter a valid email address.', 'error');
        return;
    }

    const emailTaken = getUsers().some((user) => user.id !== currentUser.id && user.email.toLowerCase() === email.toLowerCase());
    if (emailTaken) {
        showToast('That email is already used by another account.', 'error');
        return;
    }

    if (currentUser.role === 'va') {
        if (experienceYears && (Number(experienceYears) < 0 || !Number.isFinite(Number(experienceYears)))) {
            showToast('Years of experience must be 0 or more.', 'error');
            return;
        }
        if (hourlyRate && (Number(hourlyRate) < 0 || !Number.isFinite(Number(hourlyRate)))) {
            showToast('Hourly rate must be 0 or more.', 'error');
            return;
        }
        if (verificationFile && verificationFile.size > MAX_ATTACHMENT_BYTES) {
            showToast('Verification file is too large for demo storage (max 1 MB).', 'error');
            return;
        }
    }

    const profiles = getProfiles();
    const previousProfile = profiles[currentUser.id] || {};
    let verificationDocData = previousProfile.verificationDocData || '';
    let verificationDocName = previousProfile.verificationDocName || '';
    if (currentUser.role === 'va' && verificationFile) {
        verificationDocData = await fileToDataUrl(verificationFile);
        verificationDocName = verificationFile.name;
    }

    profiles[currentUser.id] = {
        ...previousProfile,
        name,
        email,
        bio,
        skills,
        tools: currentUser.role === 'va' ? tools : previousProfile.tools || '',
        experienceYears: currentUser.role === 'va' ? experienceYears : previousProfile.experienceYears || '',
        hourlyRate: currentUser.role === 'va' ? hourlyRate : previousProfile.hourlyRate || '',
        availability: currentUser.role === 'va' ? availability : previousProfile.availability || '',
        timezone: currentUser.role === 'va' ? timezone : previousProfile.timezone || '',
        verificationDocData,
        verificationDocName,
        verificationStatus: currentUser.role === 'va'
            ? previousProfile.verificationStatus || 'unverified'
            : previousProfile.verificationStatus || ''
    };
    saveProfiles(profiles);

    const users = getUsers();
    const userIndex = users.findIndex(user => user.id === currentUser.id);
    if (userIndex > -1) {
        users[userIndex].email = email;
        saveUsers(users);
        currentUser = users[userIndex];
        saveCurrentSession(currentUser);
    }

    closeModal('profileModal');
    showToast('Profile updated successfully.', 'success');

    if (currentUser.role === 'client') {
        renderClientVADirectory();
        renderClientMatches();
    } else if (currentUser.role === 'va') {
        renderVAConversations();
    }
}

function handleContactSubmit(event) {
    event.preventDefault();

    const name = (document.getElementById('contactName')?.value || '').trim();
    const email = (document.getElementById('contactEmail')?.value || '').trim();
    const message = (document.getElementById('contactMessage')?.value || '').trim();

    if (!name || !email || !message) {
        showToast('Please complete the contact form.', 'error');
        return;
    }

    if (!isValidEmail(email)) {
        showToast('Please enter a valid email address.', 'error');
        return;
    }

    const inquiries = getInquiries();
    inquiries.push({
        id: Date.now(),
        name,
        email,
        message,
        submittedAt: new Date().toISOString()
    });
    saveInquiries(inquiries);

    const form = document.getElementById('contactForm');
    if (form) {
        form.reset();
    }

    showToast('Message sent. We will reach out soon.', 'success');

    if (currentUser && currentUser.role === 'admin') {
        renderAdminInquiries();
        updateDashboardNotifications('admin');
    }
}
