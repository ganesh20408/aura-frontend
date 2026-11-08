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

export const ORDERED_TABS = [
  { id: 1, key: 'dashboard', label: '1. Smart Dashboard', shortLabel: 'Smart Feed', icon: '⚡', desc: 'Dept & Year personalized stream' },
  { id: 2, key: 'library', label: '2. Academic Library', shortLabel: 'Library', icon: '📚', desc: 'TRIZ Course ▸ Sem ▸ Type vault' },
  { id: 3, key: 'qa', label: '3. Q&A Board', shortLabel: 'Q&A Forum', icon: '💬', desc: 'Peer-to-peer discussion board' },
  { id: 4, key: 'guides', label: '4. Experiences & Guides', shortLabel: 'Guides', icon: '⭐', desc: 'Senior tips & 5-star ratings' },
  { id: 5, key: 'laura', label: '5. Ask LAURA AI', shortLabel: 'LAURA AI', icon: '🤖', desc: 'Verified-only RAG assistant' },
  { id: 6, key: 'upload', label: '6. Upload Hub', shortLabel: 'Upload', icon: '☁️', desc: 'Uploadthing + AI auto-tagging' },
  { id: 7, key: 'search', label: '7. Global AI Search', shortLabel: 'Omni Search', icon: '🔍', desc: 'Unified Library, Q&A & Guides' },
  { id: 8, key: 'notifications', label: '8. Notifications', shortLabel: 'Alerts', icon: '🔔', desc: 'Multi-target blasts & triggers' },
  { id: 9, key: 'profile', label: '9. Profile', shortLabel: 'Profile', icon: '👤', desc: 'Stats, Dept/Year & Club arrays' },
  { id: 10, key: 'logout', label: '10. Logout', shortLabel: 'Logout', icon: '🚪', desc: 'Wipe session & local cache' }
];

export function getOrderedTabs(user) {
  const tabs = [...ORDERED_TABS];
  if (user?.isPrimaryAdmin) {
    const profileIdx = tabs.findIndex(t => t.key === 'profile');
    if (profileIdx !== -1) {
      tabs.splice(profileIdx + 1, 0, {
        id: 10,
        key: 'approvals',
        label: '10. Account Approvals',
        shortLabel: 'Approvals',
        icon: '🛡️',
        desc: 'Review & approve Admin registrations'
      });
      const logoutTab = tabs.find(t => t.key === 'logout');
      if (logoutTab) {
        logoutTab.id = 11;
        logoutTab.label = '11. Logout';
      }
    }
  }
  return tabs;
}