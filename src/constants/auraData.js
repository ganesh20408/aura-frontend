// Valid ONLY for Registration & Profile Setup (Never "General")
export const PROFILE_DEPARTMENTS = [
  'CIVIL', 'MECH', 'CSE', 'IT', 'ECE', 'EEE', 'MECT', 'CSBS',
  'AIML', 'DS', 'VLSA', 'EEE(CS)', 'ARCH', 'Fashion Technology', 'Interior design'
];

// Strictly only ARCH and DS have 5th Year (Sem 1 to Sem 10).
// All other departments have strictly 4 Years (Sem 1 to Sem 8).
export const FIFTH_YEAR_DEPTS = ['ARCH', 'DS'];

// 4-Year Curriculum Semesters (All departments except ARCH & DS)
export const STANDARD_SEMESTERS = [
  'Sem 1', 'Sem 2', 'Sem 3', 'Sem 4', 'Sem 5', 'Sem 6', 'Sem 7', 'Sem 8'
];

// 5-Year Curriculum Semesters (Strictly ARCH and DS)
export const EXTENDED_SEMESTERS = [
  ...STANDARD_SEMESTERS, 'Sem 9', 'Sem 10'
];

export const SEMESTERS = EXTENDED_SEMESTERS;

export const getAvailableSemesters = (dept) => {
  return FIFTH_YEAR_DEPTS.includes(dept) ? EXTENDED_SEMESTERS : STANDARD_SEMESTERS;
};

export const getAvailableYears = (dept) => {
  return FIFTH_YEAR_DEPTS.includes(dept) ? [1, 2, 3, 4, 5] : [1, 2, 3, 4];
};

// Valid for Uploading, Filtering & Searching (Includes "All")
export const RESOURCE_DEPARTMENTS = ['All', ...PROFILE_DEPARTMENTS];

export const ROLES = ['Student', 'Senior Student', 'Faculty', 'Admin'];

export const FACULTY_SUBROLES = ['HOD', 'Professor', 'Assistant Prof', 'Lab Tech'];

export const RESOURCE_TYPES = [
  'Lecture Notes', 'Question Bank', 'Lab Manual', 'Syllabus', 'Reference Book'
];

export const GUIDE_CATEGORIES = [
  'Placement Tip', 'Course Experience', 'Study Hack', 'Internship Guide', 'Campus Life'
];

export const EXTRACURRICULARS = {
  tech: [
    'AI Consortium', 'Algo Geeks', 'App Dev', 'AR/VR', 'Ascenders', 'Build Club',
    'Coders', 'MechaDroneX', 'EKALAVYA', 'Electronic Hardware', 'HAM', 'Innov CHEM',
    'IoT', 'Kernel', 'Math', 'School Of Thoughts', 'SDG', 'TCE IP Innovators',
    'Tech Explorers', 'Ventura'
  ],
  nonTech: [
    'All About Art', 'Always on Trend', 'Anglophile', 'Cinemates', 'Foreign Language',
    'Happy Hive', 'Literary', 'SADAS Debate', 'SAE', 'Sports & Cultural', 'Vyugam'
  ],
  sports: [
    'Athletics', 'Badminton', 'Ball Badminton', 'Basket Ball', 'Chess', 'Cricket',
    'Football', 'Handball', 'Hockey', 'Judo', 'Kabaddi', 'Kho-Kho', 'Table Tennis',
    'Tennis', 'Volley Ball'
  ],
  cultural: [
    'Andhadhi', 'Anything For Dance', 'Elitz', 'Morpheus', 'Photons',
    'Quizzards', 'Tamil Mandram', 'Tentkotta', 'Varna'
  ],
  volunteering: ['NCC', 'NSS', 'YRC']
};

export const BUG_CATEGORIES = [
  'App Crashes / Unexpected Freeze',
  'Notification Delay or Not Received',
  'Login / Auth / Session Issue',
  'UI Glitch / Layout Overlap',
  'Slow Loading / Network Timeout',
  'PDF / Document Viewer Issue',
  'Custom / Other Bug'
];

export const BUG_SEVERITIES = ['Low', 'Medium', 'High', 'Critical'];

export const JOB_TYPES = ['Internship', 'Full-Time', 'Part-Time', 'Hiring Challenge'];

export const BASE_ORDERED_TABS = [
  { key: 'dashboard', baseLabel: 'Smart Dashboard', shortLabel: 'Smart Feed', icon: '⚡', desc: 'Dept & Year personalized stream' },
  { key: 'library', baseLabel: 'Academic Library', shortLabel: 'Library', icon: '📚', desc: 'TRIZ Course ▸ Sem ▸ Type vault' },
  { key: 'qa', baseLabel: 'Q&A Board', shortLabel: 'Q&A Forum', icon: '💬', desc: 'Peer-to-peer discussion board' },
  { key: 'guides', baseLabel: 'Experiences & Guides', shortLabel: 'Guides', icon: '⭐', desc: 'Senior tips & 5-star ratings' },
  { key: 'updates', baseLabel: 'Campus Updates', shortLabel: 'Updates', icon: '💼', desc: 'Hiring radar & placement approvals' },
  { key: 'laura', baseLabel: 'Ask LAURA AI', shortLabel: 'LAURA AI', icon: '🤖', desc: 'Verified-only RAG assistant' },
  { key: 'upload', baseLabel: 'Upload Hub', shortLabel: 'Upload', icon: '☁️', desc: 'Uploadthing + AI auto-tagging' },
  { key: 'search', baseLabel: 'Global AI Search', shortLabel: 'Omni Search', icon: '🔍', desc: 'Unified Library, Q&A & Guides' },
  { key: 'notifications', baseLabel: 'Notifications', shortLabel: 'Alerts', icon: '🔔', desc: 'Multi-target blasts & triggers' }
];

export const ORDERED_TABS = BASE_ORDERED_TABS.map((t, idx) => ({
  ...t,
  id: idx + 1,
  label: `${idx + 1}. ${t.baseLabel}`
}));

export function getOrderedTabs(user) {
  const tabs = [...BASE_ORDERED_TABS];

  // Admin View: Route all submitted reports to an admin-only tab named Support and Feedback Hub, add this tab after notifications tab.
  if (user?.role === 'Admin') {
    tabs.push({
      key: 'support',
      baseLabel: 'Support and Feedback Hub',
      shortLabel: 'Support Hub',
      icon: '🛠️',
      desc: 'Bug reports & user assistance triage'
    });
  }

  // Profile tab
  tabs.push({
    key: 'profile',
    baseLabel: 'Profile',
    shortLabel: 'Profile',
    icon: '👤',
    desc: 'Stats, Dept/Year & Club arrays'
  });

  // User-Facing "Help" Tab: Add a Help tab after profile(don't include this tab for admins), where users can report bugs.
  if (user?.role !== 'Admin') {
    tabs.push({
      key: 'help',
      baseLabel: 'Help & Report Bug',
      shortLabel: 'Help Desk',
      icon: '🆘',
      desc: 'Report bugs & request app assistance'
    });
  }

  // Primary Admin: Dedicated Account Approvals tab
  if (user?.isPrimaryAdmin) {
    tabs.push({
      key: 'approvals',
      baseLabel: 'Account Approvals',
      shortLabel: 'Approvals',
      icon: '🛡️',
      desc: 'Review & approve Admin registrations'
    });
  }

  // Logout
  tabs.push({
    key: 'logout',
    baseLabel: 'Logout',
    shortLabel: 'Logout',
    icon: '🚪',
    desc: 'Wipe session & local cache'
  });

  return tabs.map((t, idx) => ({
    ...t,
    id: idx + 1,
    label: `${idx + 1}. ${t.baseLabel}`
  }));
}