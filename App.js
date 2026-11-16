import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  useWindowDimensions,
  Animated,
  PanResponder,
  StatusBar as RNStatusBar,
  Linking,
  Modal
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Updates from 'expo-updates';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import axios from 'axios';

import {
  PROFILE_DEPARTMENTS,
  FIFTH_YEAR_DEPTS,
  RESOURCE_DEPARTMENTS,
  ROLES,
  FACULTY_SUBROLES,
  RESOURCE_TYPES,
  SEMESTERS,
  STANDARD_SEMESTERS,
  EXTENDED_SEMESTERS,
  getAvailableSemesters,
  getAvailableYears,
  GUIDE_CATEGORIES,
  EXTRACURRICULARS,
  ORDERED_TABS,
  getOrderedTabs,
  BUG_CATEGORIES,
  BUG_SEVERITIES,
  JOB_TYPES,
  UPLOAD_TOPIC_PRESETS,
  GUIDE_TOPIC_PRESETS,
  QNA_CLUB_CATEGORIES
} from './src/constants/auraData';
import { ThemeProvider, useAuraTheme } from './src/theme/ThemeContext';
import AdaptiveNavigation from './src/components/AdaptiveNavigation';
import InAppPdfReader from './src/components/InAppPdfReader';
import {
  initNotificationsAsync,
  displaySystemNotification,
  syncIncomingNotifications
} from './src/services/notificationService';

// ============================================================================
// IMPORTANT: Replace with your live Render URL (e.g. https://aura-backend.onrender.com)
// when building your APK or testing against cloud hosting!
// ============================================================================
const BACKEND_URL = 'https://aura-backend-illn.onrender.com';

// --- ACCESSIBLE CHIP GROUP WITH 44pt TOUCH TARGET COMPLIANCE ---
function AccessibleChipGroup({ options, selected, onSelect, multi = false, renderLabel }) {
  const { theme } = useAuraTheme();
  return (
    <View style={styles.chipWrap}>
      {options.map((opt) => {
        const isSelected = multi ? (selected || []).includes(opt) : selected === opt;
        const label = renderLabel ? renderLabel(opt) : String(opt);
        return (
          <TouchableOpacity
            key={String(opt)}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={label}
            style={[
              styles.chip,
              {
                backgroundColor: isSelected ? theme.primary : theme.card,
                borderColor: isSelected ? theme.accent : theme.border
              }
            ]}
            onPress={() => {
              if (multi) {
                const exists = (selected || []).includes(opt);
                onSelect(exists ? selected.filter((i) => i !== opt) : [...(selected || []), opt]);
              } else {
                onSelect(opt);
              }
            }}
          >
            <Text
              style={{
                color: isSelected ? '#ffffff' : theme.textSecondary,
                fontWeight: isSelected ? '700' : '500',
                fontSize: 12
              }}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// --- COLLAPSIBLE LOCALIZED SEARCH BAR PER VIEW ---
function LocalizedSearchBar({ sectionLabel, value, onChange }) {
  const { theme } = useAuraTheme();
  const [isExpanded, setIsExpanded] = useState(Boolean(value));
  const inputRef = useRef(null);

  useEffect(() => {
    if (value && !isExpanded) {
      setIsExpanded(true);
    }
  }, [value]);

  const handleToggle = () => {
    if (isExpanded && !value) {
      setIsExpanded(false);
    } else if (!isExpanded) {
      setIsExpanded(true);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  };

  const handleClear = () => {
    onChange('');
    setIsExpanded(false);
  };

  if (!isExpanded) {
    return (
      <View style={{ marginBottom: 10, alignItems: 'flex-start' }}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`Open search for ${sectionLabel}`}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 6,
            paddingHorizontal: 12,
            borderRadius: 18,
            borderWidth: 1,
            backgroundColor: theme.card,
            borderColor: theme.border
          }}
          onPress={handleToggle}
        >
          <Text style={{ fontSize: 13, marginRight: 6 }}>🔍</Text>
          <Text style={{ fontSize: 12, color: theme.textMuted, fontWeight: '500' }}>
            Search in {sectionLabel}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.localSearchBox,
        { backgroundColor: theme.card, borderColor: theme.accent, marginBottom: 10 }
      ]}
    >
      <TouchableOpacity onPress={handleToggle} style={{ marginRight: 6 }}>
        <Text style={{ fontSize: 14 }}>🔍</Text>
      </TouchableOpacity>
      <TextInput
        ref={inputRef}
        autoFocus
        accessibilityLabel={`Search within ${sectionLabel}`}
        style={[styles.localSearchInput, { color: theme.text }]}
        placeholder={`Search inside ${sectionLabel}...`}
        placeholderTextColor={theme.textMuted}
        value={value}
        onChangeText={onChange}
      />
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Close search"
        style={styles.clearSearchBtn}
        onPress={handleClear}
      >
        <Text style={{ color: theme.textMuted, fontWeight: 'bold', fontSize: 13 }}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

function AuraWorkspace() {
  const { theme, isDark, toggleTheme } = useAuraTheme();
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768;
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'android' ? Math.max(insets.top, RNStatusBar.currentHeight || 28) : insets.top;
  const bottomInset = insets.bottom;

  // --- SESSION & AUTH STATE ---
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);

  // Registration / Login Form
  const [authName, setAuthName] = useState('');
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');
  const [authRole, setAuthRole] = useState('Student');
  const [authDepartment, setAuthDepartment] = useState('CSE');
  const [authYear, setAuthYear] = useState(1);
  const [authFacultyRole, setAuthFacultyRole] = useState('Assistant Prof');
  const [showRegClubs, setShowRegClubs] = useState(false);
  const [authClubs, setAuthClubs] = useState({
    tech: [], nonTech: [], sports: [], cultural: [], volunteering: []
  });
  const [authError, setAuthError] = useState('');
  const [authNotice, setAuthNotice] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authApprovalPending, setAuthApprovalPending] = useState(false);
  const [authPendingAdminUser, setAuthPendingAdminUser] = useState('');

  // --- NAVIGATION & ANIMATED TAB TRANSITION STATE ---
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [offCanvasVisible, setOffCanvasVisible] = useState(false);
  const [activeTabKey, setActiveTabKey] = useState('dashboard');
  const tabFadeAnim = useRef(new Animated.Value(1)).current;
  const tabSlideAnim = useRef(new Animated.Value(0)).current;

  // Edge Swipe Gesture Control to open Off-Canvas Menu seamlessly on Mobile
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        gestureState.dx > 28 && Math.abs(gestureState.dy) < 25,
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > 55) {
          setOffCanvasVisible(true);
        }
      }
    })
  ).current;

  const triggerTabTransition = (nextKey) => {
    tabFadeAnim.setValue(0);
    tabSlideAnim.setValue(14);
    setActiveTabKey(nextKey);
    Animated.parallel([
      Animated.timing(tabFadeAnim, {
        toValue: 1,
        duration: 210,
        useNativeDriver: true
      }),
      Animated.spring(tabSlideAnim, {
        toValue: 0,
        friction: 8,
        tension: 70,
        useNativeDriver: true
      })
    ]).start();
  };

  // --- INDEPENDENT LOCALIZED SEARCH STATE ---
  const [localSearch, setLocalSearch] = useState({
    dashboard: '',
    library: '',
    qa: '',
    guides: '',
    updates: '',
    laura: '',
    upload: '',
    search: '',
    notifications: '',
    support: '',
    profile: '',
    help: '',
    approvals: ''
  });
  const updateLocalSearch = (key, val) =>
    setLocalSearch((prev) => ({ ...prev, [key]: val }));

  // --- PLATFORM DATA STATES ---
  const [resources, setResources] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [guides, setGuides] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [profileStats, setProfileStats] = useState(null);
  const [adminUsers, setAdminUsers] = useState([]);
  const [jobsData, setJobsData] = useState({
    jobs: [],
    canApproveGlobally: false,
    canApproveDepartments: [],
    isPlacementInCharge: false,
    managedDepartment: null
  });
  const [supportTickets, setSupportTickets] = useState([]);
  const [placementIncharges, setPlacementIncharges] = useState([]);

  // --- TAB: UPDATES & HIRING STATE ---
  const [hiringSubTab, setHiringSubTab] = useState('radar'); // 'radar' | 'approvals' | 'create'
  const [jobCompany, setJobCompany] = useState('');
  const [jobRole, setJobRole] = useState('');
  const [jobType, setJobType] = useState('Internship');
  const [jobDescription, setJobDescription] = useState('');
  const [jobApplyUrl, setJobApplyUrl] = useState('');
  const [jobSourceUrl, setJobSourceUrl] = useState('');
  const [jobLocation, setJobLocation] = useState('On-site / Hybrid');
  const [jobStipend, setJobStipend] = useState('Competitive');
  const [jobDeadline, setJobDeadline] = useState('');
  const [jobTargetDepts, setJobTargetDepts] = useState(['CSE', 'IT', 'DS']);
  const [jobTargetYears, setJobTargetYears] = useState([3, 4]);
  const [jobAdminImmediate, setJobAdminImmediate] = useState(false);
  const [jobSubmitting, setJobSubmitting] = useState(false);
  const [jobAiTagging, setJobAiTagging] = useState(false);

  // Review & 1-Tap Approval Modal state
  const [reviewJobModal, setReviewJobModal] = useState(null);
  const [reviewSelectedDepts, setReviewSelectedDepts] = useState([]);
  const [reviewSelectedYears, setReviewSelectedYears] = useState([3, 4]);
  const [reviewApproving, setReviewApproving] = useState(false);

  // --- TAB: USER HELP & BUG REPORT STATE ---
  const [helpCategory, setHelpCategory] = useState(BUG_CATEGORIES[0]);
  const [helpTitle, setHelpTitle] = useState('');
  const [helpDescription, setHelpDescription] = useState('');
  const [helpSeverity, setHelpSeverity] = useState('Medium');
  const [helpScreenshot, setHelpScreenshot] = useState(null);
  const [helpSubmitting, setHelpSubmitting] = useState(false);
  const [helpSuccess, setHelpSuccess] = useState(false);

  // --- TAB: ADMIN SUPPORT & FEEDBACK HUB STATE ---
  const [supportFilter, setSupportFilter] = useState('All');
  const [activeTicketModal, setActiveTicketModal] = useState(null);
  const [ticketAdminNotes, setTicketAdminNotes] = useState('');
  const [ticketUpdating, setTicketUpdating] = useState(false);

  // --- IN-APP PDF READER MODAL ---
  const [pdfModal, setPdfModal] = useState({ visible: false, url: '', title: '' });

  // --- TAB 2: ADMIN ACADEMIC LIBRARY FILTER ---
  const [adminLibraryDept, setAdminLibraryDept] = useState('All Departments');

  // --- TAB 3: Q&A FORM & CLUB INTEGRATION ---
  const [newQuestion, setNewQuestion] = useState('');
  const [newQuestionDept, setNewQuestionDept] = useState('All');
  const [newQClubCategory, setNewQClubCategory] = useState(null);
  const [newQClubName, setNewQClubName] = useState(null);
  const [qaClubCategoryFilter, setQaClubCategoryFilter] = useState('All');
  const [qaClubNameFilter, setQaClubNameFilter] = useState('All');
  const [answerInputs, setAnswerInputs] = useState({});

  // --- TAB 4: GUIDES FORM & EXPANDED TAGS ---
  const [guideTitle, setGuideTitle] = useState('');
  const [guideCategory, setGuideCategory] = useState('Placement Tip');
  const [guideDept, setGuideDept] = useState('All');
  const [guideContent, setGuideContent] = useState('');
  const [guideSelectedTopics, setGuideSelectedTopics] = useState([]);
  const [guideTopicFilter, setGuideTopicFilter] = useState('All');

  // --- TAB 5: ASK LAURA AI ---
  const [lauraQuery, setLauraQuery] = useState('');
  const [lauraResponse, setLauraResponse] = useState(null);
  const [lauraLoading, setLauraLoading] = useState(false);

  // --- TAB 6: UPLOAD HUB & ENHANCED AI TAGGING ---
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCourse, setUploadCourse] = useState('');
  const [uploadSemester, setUploadSemester] = useState('');
  const [uploadType, setUploadType] = useState('Lecture Notes');
  const [uploadDept, setUploadDept] = useState('All');
  const [uploadYear, setUploadYear] = useState('All Years');
  const [uploadSummary, setUploadSummary] = useState('');
  const [uploadSelectedTopics, setUploadSelectedTopics] = useState(['Exam Prep']);
  const [customTopicInput, setCustomTopicInput] = useState('');
  const [uploadedPdfUrl, setUploadedPdfUrl] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [isAiAutoTaggingResource, setIsAiAutoTaggingResource] = useState(false);

  // --- TAB 10: PRIMARY ADMIN COHORT PROMOTION & GAMIFICATION ---
  const [approvalsSubTab, setApprovalsSubTab] = useState('admins'); // 'admins' | 'promotion'
  const [cohortStats, setCohortStats] = useState(null);
  const [promotingCohort, setPromotingCohort] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardDeptFilter, setLeaderboardDeptFilter] = useState('All');
  const [currentUserPUPMeta, setCurrentUserPUPMeta] = useState(null);

  // --- TAB 8: MULTI-TARGET NOTIFICATION ARRAYS ---
  const [noteTitle, setNoteTitle] = useState('');
  const [noteMsg, setNoteMsg] = useState('');
  const [noteTargetAll, setNoteTargetAll] = useState(false);
  const [noteTargetAllYears, setNoteTargetAllYears] = useState(false);
  const [noteYears, setNoteYears] = useState([]);
  const [noteDepts, setNoteDepts] = useState([]);
  const [noteTechClubs, setNoteTechClubs] = useState([]);
  const [noteNonTechClubs, setNoteNonTechClubs] = useState([]);
  const [noteSportsTeams, setNoteSportsTeams] = useState([]);
  const [noteCulturalAssocs, setNoteCulturalAssocs] = useState([]);
  const [noteVolunteeringGroups, setNoteVolunteeringGroups] = useState([]);

  // --- TAB 9: PROFILE EDIT ---
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('Student');
  const [editDept, setEditDept] = useState('CSE');
  const [editYear, setEditYear] = useState(1);
  const [editFacultyRole, setEditFacultyRole] = useState('Assistant Prof');
  const [editClubs, setEditClubs] = useState({
    tech: [], nonTech: [], sports: [], cultural: [], volunteering: []
  });

  // --- MAIN ADMIN PERSPECTIVE SWITCHER (POV TESTING) ---
  const [mainAdminBackup, setMainAdminBackup] = useState(null);

  // --- STRICT 5TH YEAR CONDITIONAL RENDERING HELPER ---
  // Returns Year 5 ONLY if department is strictly "ARCH" or "DS"
  const getConditionalYearOptions = (selectedRole, selectedDept) => {
    if (selectedRole === 'Student') return [1, 2];
    if (selectedRole === 'Senior Student') {
      const isFifthYearEligible = FIFTH_YEAR_DEPTS.includes(selectedDept);
      return isFifthYearEligible ? [3, 4, 5] : [3, 4];
    }
    return [];
  };

  // --- RESTORE PERSISTENT SESSION ---
  useEffect(() => {
    (async () => {
      try {
        const savedToken = await AsyncStorage.getItem('@aura_token');
        const savedUser = await AsyncStorage.getItem('@aura_user');
        const savedBackup = await AsyncStorage.getItem('@aura_main_admin_backup');
        if (savedBackup) {
          try {
            setMainAdminBackup(JSON.parse(savedBackup));
          } catch (e) {
            console.log('Error parsing admin backup:', e);
          }
        }
        if (savedToken && savedUser) {
          const parsedUser = JSON.parse(savedUser);
          setToken(savedToken);
          setUser(parsedUser);
          syncProfileState(parsedUser);
        }
      } catch (e) {
        console.log('Session restore error:', e);
      } finally {
        setLoadingSession(false);
      }
    })();

    // Automatic silent OTA update check on launch
    (async () => {
      if (__DEV__) return;
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch (e) {
        console.log('Auto OTA update error:', e.message);
      }
    })();
  }, []);

  const syncProfileState = (u) => {
    if (!u) return;
    setEditName(u.name || '');
    setEditRole(u.role || 'Student');
    setEditDept(u.department || 'CSE');
    setEditYear(u.year || (u.role === 'Senior Student' ? 3 : 1));
    setEditFacultyRole(u.facultyRole || 'Assistant Prof');
    setEditClubs(u.clubs || { tech: [], nonTech: [], sports: [], cultural: [], volunteering: [] });
    setUploadDept(u.department || 'CSE');
    setUploadYear(u.year || 1);
  };

  useEffect(() => {
    if (token && user) {
      fetchAllData();
      (async () => {
        const pushToken = await initNotificationsAsync();
        if (pushToken) {
          try {
            await axios.post(
              `${BACKEND_URL}/api/users/push-token`,
              { pushToken },
              { headers: { Authorization: `Bearer ${token}` } }
            );
          } catch (e) {
            console.log('Push token register info:', e.message);
          }
        }
      })();
    }
  }, [token]);

  const apiHeader = useMemo(() => ({
    headers: { Authorization: `Bearer ${token}` }
  }), [token]);

  const fetchAllData = async () => {
    try {
      const [resList, qaList, guideList, noteList, statsRes, jobsRes, lbRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/resources`, apiHeader),
        axios.get(`${BACKEND_URL}/api/qa`, apiHeader),
        axios.get(`${BACKEND_URL}/api/guides`, apiHeader),
        axios.get(`${BACKEND_URL}/api/notifications`, apiHeader),
        axios.get(`${BACKEND_URL}/api/profile/stats`, apiHeader),
        axios.get(`${BACKEND_URL}/api/jobs`, apiHeader).catch(() => ({ data: { jobs: [] } })),
        axios.get(`${BACKEND_URL}/api/leaderboard`, apiHeader).catch(() => ({ data: { leaderboard: [] } }))
      ]);
      setResources(resList.data);
      setQuestions(qaList.data);
      setGuides(guideList.data);
      setNotifications(noteList.data);
      setProfileStats(statsRes.data);
      if (jobsRes.data) setJobsData(jobsRes.data);
      if (lbRes.data?.leaderboard) setLeaderboard(lbRes.data.leaderboard);
      if (lbRes.data?.currentUser) setCurrentUserPUPMeta(lbRes.data.currentUser);
      syncIncomingNotifications(noteList.data);

      if (user?.role === 'Admin') {
        const [usersRes, ticketsRes, inchargesRes, cohortRes] = await Promise.all([
          axios.get(`${BACKEND_URL}/api/admin/users`, apiHeader).catch(() => ({ data: { users: [] } })),
          axios.get(`${BACKEND_URL}/api/support/tickets`, apiHeader).catch(() => ({ data: [] })),
          axios.get(`${BACKEND_URL}/api/admin/placement-incharges`, apiHeader).catch(() => ({ data: { incharges: [] } })),
          user?.isPrimaryAdmin
            ? axios.get(`${BACKEND_URL}/api/admin/cohort-stats`, apiHeader).catch(() => ({ data: null }))
            : Promise.resolve({ data: null })
        ]);
        setAdminUsers(usersRes.data.users || usersRes.data);
        if (ticketsRes.data) setSupportTickets(ticketsRes.data);
        if (inchargesRes.data) setPlacementIncharges(inchargesRes.data.incharges || []);
        if (cohortRes.data) setCohortStats(cohortRes.data);
      }
    } catch (err) {
      console.log('Sync error:', err.message);
      if (err.response?.status === 401) {
        handleLogout();
      }
    }
  };

  const fetchCohortStats = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/cohort-stats`, apiHeader);
      if (res.data) setCohortStats(res.data);
    } catch (e) {
      console.log('Error fetching cohort stats:', e.message);
    }
  };

  const handlePromoteCohort = async (cohortNum) => {
    const cohortDescriptions = {
      1: 'Promote all 1st-Year students to 2nd Year?',
      2: 'Promote all 2nd-Year students to 3rd Year and auto-upgrade role to "Senior Student"?',
      3: 'Promote all 3rd-Year students to 4th Year?',
      4: 'Process 4th-Year cohort? (ARCH & DS advance to 5th Year; all other 4-year degree students graduate to Alumni)',
      5: 'Graduate all 5th-Year ARCH & DS students to Alumni status?'
    };

    Alert.alert(
      'Confirm Academic Year Promotion',
      cohortDescriptions[cohortNum] || `Promote Cohort ${cohortNum}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm & Promote',
          style: 'destructive',
          onPress: async () => {
            setPromotingCohort(cohortNum);
            try {
              const res = await axios.post(
                `${BACKEND_URL}/api/admin/promote-cohort`,
                { cohort: cohortNum },
                apiHeader
              );
              Alert.alert('Promotion Complete', res.data.message);
              fetchCohortStats();
              fetchAllData();
            } catch (err) {
              Alert.alert('Promotion Error', err.response?.data?.error || err.message);
            } finally {
              setPromotingCohort(null);
            }
          }
        }
      ]
    );
  };

  const handleUpvoteAnswer = async (qId, ansId) => {
    try {
      const res = await axios.post(
        `${BACKEND_URL}/api/qa/${qId}/answers/${ansId}/upvote`,
        {},
        apiHeader
      );
      if (res.data?.success) {
        fetchAllData();
      }
    } catch (err) {
      Alert.alert('Upvote', err.response?.data?.error || err.message);
    }
  };

  const handleAcceptAnswer = async (qId, ansId) => {
    try {
      const res = await axios.post(
        `${BACKEND_URL}/api/qa/${qId}/answers/${ansId}/accept`,
        {},
        apiHeader
      );
      if (res.data?.success) {
        Alert.alert('Accepted Solution!', 'Answer marked as Accepted. Responder awarded +50 Plus Ultra Points!');
        fetchAllData();
      }
    } catch (err) {
      Alert.alert('Accept Answer', err.response?.data?.error || err.message);
    }
  };

  const handleAiAutoTagResource = async () => {
    if (!uploadTitle && !uploadCourse && !uploadSummary) {
      return Alert.alert('Auto-Tag with AI', 'Please enter a title, course, or summary to auto-tag.');
    }
    setIsAiAutoTaggingResource(true);
    try {
      const res = await axios.post(
        `${BACKEND_URL}/api/resources/ai-autotag`,
        { title: uploadTitle, description: uploadCourse, summary: uploadSummary },
        apiHeader
      );
      if (res.data) {
        if (res.data.department && res.data.department !== 'General') {
          setUploadDept(res.data.department);
        }
        if (res.data.semester) {
          let sem = res.data.semester;
          if (!FIFTH_YEAR_DEPTS.includes(res.data.department || uploadDept) && ['Sem 9', 'Sem 10'].includes(sem)) {
            sem = 'Sem 8';
          }
          setUploadSemester(sem);
        }
        if (res.data.resourceType) setUploadType(res.data.resourceType);
        if (res.data.targetYear !== undefined) {
          setUploadYear(res.data.targetYear === 0 ? 'All Years' : res.data.targetYear);
        }
        if (res.data.suggestedTopics && res.data.suggestedTopics.length > 0) {
          setUploadSelectedTopics(res.data.suggestedTopics);
        }
        if (!uploadSummary && res.data.aiSummary) {
          setUploadSummary(res.data.aiSummary);
        }
        Alert.alert('AI Auto-Tag Complete', 'Document Type, Semester, Department, and Topic tags updated!');
      }
    } catch (err) {
      Alert.alert('Auto-Tag Error', err.response?.data?.error || err.message);
    } finally {
      setIsAiAutoTaggingResource(false);
    }
  };

  // --- MAIN ADMIN PERSPECTIVE SWITCHER HANDLERS ---
  const handleSwitchAccount = async (targetUserId, targetName) => {
    try {
      const activeAdminToken = mainAdminBackup?.token || token;
      const res = await axios.post(
        `${BACKEND_URL}/api/admin/switch-account`,
        { targetUserId },
        { headers: { Authorization: `Bearer ${activeAdminToken}` } }
      );

      // Save original main admin session if not already stored
      if (!mainAdminBackup) {
        const backupData = { token, user };
        await AsyncStorage.setItem('@aura_main_admin_backup', JSON.stringify(backupData));
        setMainAdminBackup(backupData);
      }

      await AsyncStorage.setItem('@aura_token', res.data.token);
      await AsyncStorage.setItem('@aura_user', JSON.stringify(res.data.user));
      setToken(res.data.token);
      setUser(res.data.user);
      syncProfileState(res.data.user);

      Alert.alert(
        'POV Testing Activated',
        `Now testing AURA as: ${res.data.user.name} (${res.data.user.role} • ${res.data.user.department}${res.data.user.year ? ` • Yr ${res.data.user.year}` : ''}).\n\nTap "👑 Exit to Main Admin" in the banner to return anytime.`
      );
    } catch (err) {
      Alert.alert('Perspective Switch Alert', err.response?.data?.error || err.message);
    }
  };

  const handleSwitchPresetPersona = async (preset) => {
    try {
      const activeAdminToken = mainAdminBackup?.token || token;
      const res = await axios.post(
        `${BACKEND_URL}/api/admin/switch-account`,
        preset,
        { headers: { Authorization: `Bearer ${activeAdminToken}` } }
      );

      if (!mainAdminBackup) {
        const backupData = { token, user };
        await AsyncStorage.setItem('@aura_main_admin_backup', JSON.stringify(backupData));
        setMainAdminBackup(backupData);
      }

      await AsyncStorage.setItem('@aura_token', res.data.token);
      await AsyncStorage.setItem('@aura_user', JSON.stringify(res.data.user));
      setToken(res.data.token);
      setUser(res.data.user);
      syncProfileState(res.data.user);

      Alert.alert(
        'Preset Persona Activated',
        `Now testing as: ${res.data.user.name} (${res.data.user.role} • ${res.data.user.department}${res.data.user.year ? ` • Yr ${res.data.user.year}` : ''}).\n\nTap "👑 Exit to Main Admin" in the banner to return anytime.`
      );
    } catch (err) {
      Alert.alert('Persona Switch Alert', err.response?.data?.error || err.message);
    }
  };

  const handleSwitchBackToMainAdmin = async () => {
    try {
      const backupJson = await AsyncStorage.getItem('@aura_main_admin_backup');
      const backup = backupJson ? JSON.parse(backupJson) : mainAdminBackup;
      if (!backup) {
        Alert.alert('Notice', 'No previous Main Admin session found.');
        return;
      }

      await AsyncStorage.removeItem('@aura_main_admin_backup');
      await AsyncStorage.setItem('@aura_token', backup.token);
      await AsyncStorage.setItem('@aura_user', JSON.stringify(backup.user));

      setMainAdminBackup(null);
      setToken(backup.token);
      setUser(backup.user);
      syncProfileState(backup.user);

      Alert.alert(
        'Main Admin Restored',
        `Welcome back, ${backup.user.name}! Main Admin session has been restored.`
      );
    } catch (err) {
      Alert.alert('Error Returning to Admin', err.message);
    }
  };

  // --- OVER-THE-AIR (OTA) EAS UPDATES HANDLER ---
  const handleCheckForUpdates = async () => {
    if (__DEV__) {
      Alert.alert(
        'Development Mode',
        'Over-The-Air (OTA) updates run on installed preview/production builds. In development mode, Metro bundler hot-reloads code directly.'
      );
      return;
    }
    try {
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        Alert.alert(
          'Update Found!',
          'A new update is available. Downloading latest changes now...',
          [{ text: 'OK' }]
        );
        await Updates.fetchUpdateAsync();
        Alert.alert(
          'Update Downloaded!',
          'The latest code and UI improvements have been downloaded over the air. Restart the app now to apply them?',
          [
            { text: 'Later', style: 'cancel' },
            {
              text: 'Restart Now',
              onPress: async () => {
                await Updates.reloadAsync();
              }
            }
          ]
        );
      } else {
        Alert.alert('App Up to Date', 'You are already running the latest version of AURA.');
      }
    } catch (e) {
      Alert.alert('Update Status', `OTA check: ${e.message}`);
    }
  };

  // --- AUTH SUBMIT ---
  const handleAuthSubmit = async () => {
    // 1. Instant Client-Side Pre-Flight Validations (0ms immediate feedback)
    setAuthError('');
    setAuthNotice('');

    const cleanUsername = authUsername.trim();
    const cleanPassword = authPassword.trim();
    const cleanConfirmPassword = authConfirmPassword.trim();
    const cleanName = authName.trim();

    if (!cleanUsername) {
      setAuthError('Please enter your username.');
      return;
    }

    if (!cleanPassword) {
      setAuthError('Please enter your password.');
      return;
    }

    if (isRegistering) {
      if (!cleanName) {
        setAuthError('Please enter your full name.');
        return;
      }
      if (cleanPassword.length < 4) {
        setAuthError('Password must be at least 4 characters long.');
        return;
      }
      if (cleanPassword !== cleanConfirmPassword) {
        setAuthError('Password mismatch: Passwords do not match. Please re-enter.');
        return;
      }
    }

    // 2. Set submitting state to immediately disable button and show spinner
    setAuthSubmitting(true);

    // 3. Render cloud spin-up watchdog (informs user as Render free-tier boots up)
    const timers = [];
    timers.push(setTimeout(() => {
      setAuthNotice('Connecting to AURA Cloud... (Waking up server, please wait)');
    }, 2500));
    timers.push(setTimeout(() => {
      setAuthNotice('Server spin-up in progress (Render free tier wakes in 30-50s)...');
    }, 12000));
    timers.push(setTimeout(() => {
      setAuthNotice('Almost ready! Establishing secure connection to MongoDB Atlas...');
    }, 32000));

    try {
      const endpoint = isRegistering ? '/api/auth/register' : '/api/auth/login';
      const payload = isRegistering
        ? {
            name: cleanName,
            username: cleanUsername,
            password: cleanPassword,
            role: authRole,
            department: authRole === 'Admin' ? 'Administration' : authDepartment,
            year: ['Student', 'Senior Student'].includes(authRole) ? authYear : null,
            facultyRole: authRole === 'Faculty' ? authFacultyRole : null,
            clubs: authRole === 'Admin' ? { tech: [], nonTech: [], sports: [], cultural: [], volunteering: [] } : authClubs
          }
        : { username: cleanUsername, password: cleanPassword };

      const res = await axios.post(`${BACKEND_URL}${endpoint}`, payload, {
        timeout: 65000
      });

      timers.forEach(clearTimeout);
      setAuthNotice('');

      if (res.data.pendingApproval) {
        setIsRegistering(false);
        setAuthPassword('');
        setAuthConfirmPassword('');
        setAuthApprovalPending(true);
        setAuthPendingAdminUser(cleanUsername);
        setAuthError('');
        Alert.alert(
          'Admin Registration Submitted',
          `Administrator account @${cleanUsername} registered successfully! It is pending authorization by the Primary Administrator. It will display "Approval Pending" until approved.`,
          [{ text: 'OK' }]
        );
        return;
      }

      if (res.data.isFirstAdmin) {
        Alert.alert(
          'Primary Admin Initialized',
          'Welcome, Administrator! You are the primary Admin with authority to approve subsequent admin accounts.'
        );
      }

      await AsyncStorage.setItem('@aura_token', res.data.token);
      await AsyncStorage.setItem('@aura_user', JSON.stringify(res.data.user));
      setToken(res.data.token);
      setUser(res.data.user);
      syncProfileState(res.data.user);
    } catch (err) {
      timers.forEach(clearTimeout);
      setAuthNotice('');

      let message = 'An unexpected error occurred. Please try again.';
      if (err.response?.data?.isPendingApproval || (err.response?.status === 403 && err.response?.data?.error?.toLowerCase().includes('pending'))) {
        setAuthApprovalPending(true);
        setAuthPendingAdminUser(err.response?.data?.adminUsername || cleanUsername);
        message = err.response?.data?.error || 'Your Administrator account is pending approval by the Primary Administrator.';
      } else if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        message = 'Cloud server spin-up timed out. The free hosting takes 30-50s to wake up on first tap. Please tap again now.';
      } else if (err.response?.data?.error) {
        message = err.response.data.error;
      } else if (err.message === 'Network Error' || !err.response) {
        message = 'Connecting to AURA cloud server... The cloud host is currently waking up from sleep (takes 30-50s on free hosting) or deploying updates. Please wait 10-15 seconds and tap again.';
      } else {
        message = err.message || 'Authentication failed.';
      }

      setAuthError(message);
    } finally {
      timers.forEach(clearTimeout);
      setAuthSubmitting(false);
    }
  };

  // --- TAB 10: LOGOUT ---
  const handleLogout = async () => {
    await AsyncStorage.multiRemove(['@aura_token', '@aura_user', '@aura_main_admin_backup']);
    setMainAdminBackup(null);
    setToken(null);
    setUser(null);
    setResources([]);
    setQuestions([]);
    setGuides([]);
    setNotifications([]);
  };

  const handleSelectNavigationTab = (tab) => {
    if (tab.key === 'logout') {
      handleLogout();
      return;
    }
    triggerTabTransition(tab.key);
  };

  // --- UPLOADTHING INTAKE ---
  const handlePickAndUploadToUploadthing = async () => {
    try {
      const docRes = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' });
      if (docRes.canceled) return;
      const file = docRes.assets[0];
      setUploadingFile(true);

      const formData = new FormData();
      if (Platform.OS === 'web' && file.file) {
        formData.append('pdf', file.file);
      } else {
        formData.append('pdf', {
          uri: file.uri,
          name: file.name || 'document.pdf',
          type: file.mimeType || 'application/pdf'
        });
      }

      const res = await axios.post(`${BACKEND_URL}/api/uploadthing/upload`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      setUploadedPdfUrl(res.data.pdfUrl);
      if (res.data.detectedMeta) {
        const meta = res.data.detectedMeta;
        if (!uploadTitle && meta.suggestedTitle) setUploadTitle(meta.suggestedTitle);
        if (meta.resourceType) setUploadType(meta.resourceType);
        if (meta.department && meta.department !== 'General') setUploadDept(meta.department);
        let detectedSem = meta.semester;
        if (!FIFTH_YEAR_DEPTS.includes(meta.department || uploadDept) && ['Sem 9', 'Sem 10'].includes(detectedSem)) {
          detectedSem = 'Sem 8';
        }
        if (detectedSem) setUploadSemester(detectedSem);
        if (meta.targetYear !== undefined) {
          setUploadYear(meta.targetYear === 0 ? 'All Years' : meta.targetYear);
        }
        if (meta.suggestedTopics && meta.suggestedTopics.length > 0) {
          setUploadSelectedTopics(meta.suggestedTopics);
        }
        if (meta.aiSummary) setUploadSummary(meta.aiSummary);
      }

      Alert.alert('Uploadthing Complete', 'Secure PDF URL received and AI tags auto-detected!');
    } catch (err) {
      Alert.alert('Upload Error', err.response?.data?.error || err.message);
    } finally {
      setUploadingFile(false);
    }
  };

  const handleSaveResourceToMongo = async () => {
    if (!uploadTitle || !uploadedPdfUrl) {
      return Alert.alert('Incomplete', 'Please upload a PDF file first and verify the title.');
    }
    const finalYear = (uploadYear === 'All Years' || uploadYear === 'All' || uploadYear === 0 || !uploadYear)
      ? 0
      : Number(uploadYear);
    const finalSemester = uploadSemester && uploadSemester !== 'None (Optional)' && uploadSemester !== 'None'
      ? uploadSemester
      : null;

    if (finalSemester && ['Sem 9', 'Sem 10'].includes(finalSemester) && !FIFTH_YEAR_DEPTS.includes(uploadDept)) {
      return Alert.alert('Invalid Semester', `Sem 9 and Sem 10 are strictly restricted to ARCH and DS departments. ${uploadDept} only has Sem 1 through Sem 8.`);
    }
    if (finalYear === 5 && !FIFTH_YEAR_DEPTS.includes(uploadDept)) {
      return Alert.alert('Invalid Academic Year', `5th Year is strictly restricted to ARCH and DS departments. ${uploadDept} only has 4 years.`);
    }
    try {
      await axios.post(
        `${BACKEND_URL}/api/resources`,
        {
          title: uploadTitle,
          course: uploadCourse || 'Core Subject',
          semester: finalSemester,
          resourceType: uploadType,
          department: uploadDept,
          targetYear: finalYear,
          summary: uploadSummary,
          tags: [...uploadSelectedTopics, uploadType, uploadDept, finalSemester].filter(Boolean),
          pdfUrl: uploadedPdfUrl
        },
        apiHeader
      );
      setUploadTitle('');
      setUploadCourse('');
      setUploadSummary('');
      setUploadedPdfUrl('');
      setUploadSelectedTopics(['Exam Prep']);
      fetchAllData();
      Alert.alert('Archived!', 'Resource saved to MongoDB Atlas with multi-select tags.');
    } catch (err) {
      Alert.alert('Save Error', err.response?.data?.error || err.message);
    }
  };

  const handleVerifyResource = async (id) => {
    try {
      await axios.patch(`${BACKEND_URL}/api/resources/${id}/verify`, {}, apiHeader);
      fetchAllData();
    } catch (err) {
      Alert.alert('Verification Error', err.response?.data?.error || err.message);
    }
  };

  const handleAskLaura = async () => {
    const q = lauraQuery || localSearch.laura;
    if (!q) return Alert.alert('Ask LAURA', 'Enter an academic question first.');
    try {
      setLauraLoading(true);
      const res = await axios.post(`${BACKEND_URL}/api/laura-ai/ask`, { query: q }, apiHeader);
      setLauraResponse(res.data);
    } catch (err) {
      Alert.alert('LAURA Error', err.message);
    } finally {
      setLauraLoading(false);
    }
  };

  // --- HIRING & UPDATES ACTION HANDLERS ---
  const handleAiAutoTag = async () => {
    if (!jobRole && !jobDescription) {
      return Alert.alert('Input Needed', 'Please enter a Role title or Description first to run AI auto-tagging.');
    }
    try {
      setJobAiTagging(true);
      const res = await axios.post(`${BACKEND_URL}/api/jobs/ai-autotag`, {
        role: jobRole,
        description: jobDescription,
        company: jobCompany
      }, apiHeader);

      if (res.data?.targetDepartments?.length > 0) {
        setJobTargetDepts(res.data.targetDepartments);
      }
      if (res.data?.targetYears?.length > 0) {
        setJobTargetYears(res.data.targetYears);
      }
      Alert.alert(
        'AI Auto-Tag Complete',
        `Tagged Departments: ${res.data.targetDepartments.join(', ')}\nDefault Target Years: ${res.data.targetYears.map(y => `Yr ${y}`).join(', ')}${res.data.targetYears.includes(5) ? ' (Includes Yr 5 for ARCH/DS)' : ''}\n\nNote: 1st & 2nd years can be optionally selected below.`
      );
    } catch (err) {
      Alert.alert('AI Tagging Error', err.response?.data?.error || err.message);
    } finally {
      setJobAiTagging(false);
    }
  };

  const handleCreateJob = async () => {
    if (!jobCompany.trim()) return Alert.alert('Required', 'Please enter Company name.');
    if (!jobRole.trim()) return Alert.alert('Required', 'Please enter Role title.');
    if (!jobDescription.trim()) return Alert.alert('Required', 'Please provide job description & requirements.');
    if (!jobApplyUrl.trim()) return Alert.alert('Required', 'Please provide an application or LinkedIn link.');
    if (jobTargetDepts.length === 0) return Alert.alert('Target Needed', 'Select at least one eligible department.');

    try {
      setJobSubmitting(true);
      await axios.post(`${BACKEND_URL}/api/jobs`, {
        company: jobCompany.trim(),
        role: jobRole.trim(),
        jobType,
        description: jobDescription.trim(),
        applyUrl: jobApplyUrl.trim(),
        sourceUrl: jobSourceUrl.trim(),
        location: jobLocation.trim(),
        stipendOrSalary: jobStipend.trim(),
        deadline: jobDeadline.trim(),
        targetDepartments: jobTargetDepts,
        targetYears: jobTargetYears,
        adminImmediatePublish: user?.role === 'Admin' && jobAdminImmediate
      }, apiHeader);

      await fetchAllData();
      setJobCompany('');
      setJobRole('');
      setJobDescription('');
      setJobApplyUrl('');
      setJobSourceUrl('');
      setJobDeadline('');
      setHiringSubTab('radar');
      Alert.alert('Success', 'Hiring post submitted! Department in-charges have been notified for review & approval.');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || err.message);
    } finally {
      setJobSubmitting(false);
    }
  };

  const handleOpenReviewModal = (job) => {
    const isAdmin = user?.role === 'Admin';
    const inChargeDept = user?.placementDepartment || (user?.isPlacementInCharge ? user?.department : null);

    setReviewJobModal(job);
    setReviewSelectedYears(job.targetYears && job.targetYears.length > 0 ? job.targetYears : [3, 4]);

    if (isAdmin) {
      const pendingDepts = (job.departmentApprovals || [])
        .filter((da) => da.status === 'Pending')
        .map((da) => da.department);
      setReviewSelectedDepts(pendingDepts.length > 0 ? pendingDepts : job.targetDepartments || []);
    } else if (inChargeDept) {
      setReviewSelectedDepts([inChargeDept]);
    }
  };

  const handleApproveDepartment = async (jobId) => {
    if (reviewSelectedDepts.length === 0) {
      return Alert.alert('Selection Required', 'Please select at least one department to approve.');
    }
    if (reviewSelectedYears.length === 0) {
      return Alert.alert('Target Years Required', 'Please select at least one target year cohort.');
    }
    try {
      setReviewApproving(true);
      const isAdmin = user?.role === 'Admin';
      const isAllSelected = reviewSelectedDepts.length === (reviewJobModal?.targetDepartments?.length || 0);

      const res = await axios.patch(
        `${BACKEND_URL}/api/jobs/${jobId}/approve-department`,
        {
          departmentsToApprove: reviewSelectedDepts,
          isGlobalAdminOverride: isAdmin && isAllSelected,
          updatedTargetYears: reviewSelectedYears
        },
        apiHeader
      );

      await fetchAllData();
      setReviewJobModal(null);
      Alert.alert(
        'Department Approved & Broadcasted',
        `Approved for: ${res.data.approvedDepartments.join(', ')}!\nPush notifications dispatched to eligible students in these departments.`
      );
    } catch (err) {
      Alert.alert('Approval Error', err.response?.data?.error || err.message);
    } finally {
      setReviewApproving(false);
    }
  };

  const handleRejectDepartment = async (jobId, dept) => {
    try {
      await axios.patch(
        `${BACKEND_URL}/api/jobs/${jobId}/reject-department`,
        { departmentToReject: dept },
        apiHeader
      );
      await fetchAllData();
      if (reviewJobModal) setReviewJobModal(null);
      Alert.alert('Rejected', `Hiring update rejected for department ${dept}.`);
    } catch (err) {
      Alert.alert('Reject Error', err.response?.data?.error || err.message);
    }
  };

  const handleDeleteJob = async (jobId) => {
    Alert.alert('Confirm Delete', 'Are you sure you want to delete this hiring update?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await axios.delete(`${BACKEND_URL}/api/jobs/${jobId}`, apiHeader);
            await fetchAllData();
            Alert.alert('Deleted', 'Hiring post removed.');
          } catch (err) {
            Alert.alert('Error', err.response?.data?.error || err.message);
          }
        }
      }
    ]);
  };

  // --- HELP & BUG REPORTING ACTION HANDLERS ---
  const handlePickScreenshot = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: 'image/*'
      });
      if (res.canceled) return;
      setHelpScreenshot(res.assets[0]);
    } catch (err) {
      Alert.alert('Screenshot Picker Error', err.message);
    }
  };

  const handleSubmitBugReport = async () => {
    if (!helpTitle.trim()) return Alert.alert('Required', 'Please enter a summary title for the bug.');
    if (!helpDescription.trim()) return Alert.alert('Required', 'Please describe the bug and what happened.');

    try {
      setHelpSubmitting(true);
      let screenshotUrl = null;

      if (helpScreenshot) {
        const formData = new FormData();
        if (Platform.OS === 'web' && helpScreenshot.file) {
          formData.append('screenshot', helpScreenshot.file);
        } else {
          formData.append('screenshot', {
            uri: helpScreenshot.uri,
            name: helpScreenshot.name || 'screenshot.png',
            type: helpScreenshot.mimeType || 'image/png'
          });
        }
        const uploadRes = await axios.post(`${BACKEND_URL}/api/support/upload-screenshot`, formData, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        });
        screenshotUrl = uploadRes.data?.url;
      }

      const deviceInfo = {
        os: Platform.OS,
        osVersion: String(Platform.Version),
        appVersion: '2.0.0 (Expo SDK 58)',
        screenDimensions: `${Math.round(width)}x${Math.round(height)}`,
        deviceBrand: Platform.constants?.Brand || Platform.OS,
        platform: Platform.OS
      };

      await axios.post(
        `${BACKEND_URL}/api/support/tickets`,
        {
          category: helpCategory,
          title: helpTitle.trim(),
          description: helpDescription.trim(),
          severity: helpSeverity,
          screenshotUrl,
          deviceInfo
        },
        apiHeader
      );

      setHelpTitle('');
      setHelpDescription('');
      setHelpScreenshot(null);
      setHelpSuccess(true);
      Alert.alert(
        'Bug Report Submitted',
        'Thank you! Your bug report along with automatic device diagnostics has been sent directly to the Admin Support and Feedback Hub.'
      );
    } catch (err) {
      Alert.alert('Submission Error', err.response?.data?.error || err.message);
    } finally {
      setHelpSubmitting(false);
    }
  };

  const handleUpdateTicketStatus = async (ticketId, newStatus) => {
    try {
      setTicketUpdating(true);
      await axios.patch(
        `${BACKEND_URL}/api/support/tickets/${ticketId}`,
        {
          status: newStatus,
          adminNotes: ticketAdminNotes
        },
        apiHeader
      );
      await fetchAllData();
      setActiveTicketModal(null);
      setTicketAdminNotes('');
      Alert.alert('Ticket Updated', `Ticket marked as "${newStatus}"!`);
    } catch (err) {
      Alert.alert('Update Error', err.response?.data?.error || err.message);
    } finally {
      setTicketUpdating(false);
    }
  };

  // ==========================================================================
  // RENDER AUTHENTICATION VIEW (With Strict Conditional 5th Year Validation)
  // ==========================================================================
  if (loadingSession) {
    return (
      <View
        style={[
          styles.screen,
          {
            backgroundColor: theme.bg,
            justifyContent: 'center',
            alignItems: 'center',
            paddingTop: topInset,
            paddingBottom: bottomInset
          }
        ]}
      >
        <StatusBar style={isDark ? 'light' : 'dark'} translucent />
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!user || !token) {
    const conditionalYears = getConditionalYearOptions(authRole, authDepartment);
    return (
      <View
        style={[
          styles.screen,
          {
            backgroundColor: theme.bg,
            paddingTop: topInset,
            paddingBottom: bottomInset
          }
        ]}
      >
        <StatusBar style={isDark ? 'light' : 'dark'} translucent />
        <ScrollView contentContainerStyle={styles.authContainer}>
          <View style={[styles.authCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.rowBetween}>
              <View>
                <Text style={[styles.brandTitle, { color: theme.primary }]}>AURA</Text>
                <Text style={{ color: theme.textMuted, fontSize: 12 }}>
                  Academic User Resource Archive
                </Text>
              </View>
              <TouchableOpacity
                accessibilityRole="switch"
                accessibilityLabel="Toggle Dark Mode"
                style={[styles.themePill, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
                onPress={toggleTheme}
              >
                <Text style={{ color: theme.text, fontSize: 12, fontWeight: 'bold' }}>
                  {isDark ? '☀️ Light' : '🌙 Dark'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.authToggleRow, { backgroundColor: theme.card }]}>
              <TouchableOpacity
                accessibilityRole="tab"
                accessibilityState={{ selected: !isRegistering }}
                disabled={authSubmitting}
                style={[styles.authToggleBtn, !isRegistering && { backgroundColor: theme.primary }]}
                onPress={() => {
                  setIsRegistering(false);
                  setAuthError('');
                  setAuthNotice('');
                  setAuthApprovalPending(false);
                }}
              >
                <Text style={{ color: !isRegistering ? '#fff' : theme.textMuted, fontWeight: 'bold' }}>
                  Sign In
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="tab"
                accessibilityState={{ selected: isRegistering }}
                disabled={authSubmitting}
                style={[styles.authToggleBtn, isRegistering && { backgroundColor: theme.primary }]}
                onPress={() => {
                  setIsRegistering(true);
                  setAuthError('');
                  setAuthNotice('');
                  setAuthApprovalPending(false);
                }}
              >
                <Text style={{ color: isRegistering ? '#fff' : theme.textMuted, fontWeight: 'bold' }}>
                  Create Account
                </Text>
              </TouchableOpacity>
            </View>

            {/* ADMIN APPROVAL PENDING STATUS BANNER */}
            {authApprovalPending && !isRegistering && (
              <View
                style={[
                  styles.authAlertBanner,
                  {
                    backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#FEF3C7',
                    borderColor: isDark ? '#F59E0B' : '#FCD34D'
                  }
                ]}
              >
                <Text style={{ fontSize: 20, marginRight: 8 }}>⏳</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: isDark ? '#FCD34D' : '#92400E', fontWeight: 'bold', fontSize: 13, marginBottom: 2 }}>
                    Approval Pending Status
                  </Text>
                  <Text style={{ color: isDark ? '#FDE68A' : '#78350F', fontSize: 12, lineHeight: 18 }}>
                    Your Administrator account (@{authPendingAdminUser || authUsername}) is currently awaiting authorization by the Primary Administrator.
                    {'\n'}• Once the Primary Admin approves your account, enter your password and sign in directly.
                  </Text>
                </View>
              </View>
            )}

            {/* INSTANT CLIENT-SIDE & SERVER ERROR BANNER */}
            {!!authError && (
              <View
                style={[
                  styles.authAlertBanner,
                  {
                    backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEF2F2',
                    borderColor: isDark ? '#EF4444' : '#FCA5A5'
                  }
                ]}
              >
                <Text style={{ fontSize: 16, marginRight: 8 }}>⚠️</Text>
                <Text
                  style={[
                    styles.authAlertText,
                    { color: isDark ? '#FCA5A5' : '#B91C1C' }
                  ]}
                >
                  {authError}
                </Text>
              </View>
            )}

            {/* RENDER CLOUD HOST WAKE-UP BANNER */}
            {!!authNotice && (
              <View
                style={[
                  styles.authAlertBanner,
                  {
                    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF',
                    borderColor: isDark ? '#3B82F6' : '#93C5FD'
                  }
                ]}
              >
                <ActivityIndicator size="small" color={isDark ? '#93C5FD' : '#2563EB'} style={{ marginRight: 8 }} />
                <Text
                  style={[
                    styles.authAlertText,
                    { color: isDark ? '#93C5FD' : '#1D4ED8' }
                  ]}
                >
                  {authNotice}
                </Text>
              </View>
            )}

            {isRegistering && (
              <TextInput
                style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                placeholder="Full Name"
                placeholderTextColor={theme.textMuted}
                value={authName}
                onChangeText={(t) => {
                  setAuthName(t);
                  if (authError) setAuthError('');
                }}
                editable={!authSubmitting}
              />
            )}

            <TextInput
              style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
              placeholder="Username"
              placeholderTextColor={theme.textMuted}
              autoCapitalize="none"
              value={authUsername}
              onChangeText={(t) => {
                setAuthUsername(t);
                if (authError) setAuthError('');
                if (authApprovalPending) setAuthApprovalPending(false);
              }}
              editable={!authSubmitting}
            />
            <TextInput
              style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
              placeholder="Password"
              placeholderTextColor={theme.textMuted}
              secureTextEntry
              value={authPassword}
              onChangeText={(t) => {
                setAuthPassword(t);
                if (authError) setAuthError('');
              }}
              editable={!authSubmitting}
            />

            {isRegistering && (
              <TextInput
                style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                placeholder="Confirm Password"
                placeholderTextColor={theme.textMuted}
                secureTextEntry
                value={authConfirmPassword}
                onChangeText={(t) => {
                  setAuthConfirmPassword(t);
                  if (authError) setAuthError('');
                }}
                editable={!authSubmitting}
              />
            )}

            {isRegistering && (
              <>
                <Text style={[styles.label, { color: theme.text }]}>1. Select Role</Text>
                <AccessibleChipGroup
                  options={ROLES}
                  selected={authRole}
                  onSelect={(r) => {
                    setAuthRole(r);
                    if (r === 'Student') setAuthYear(1);
                    if (r === 'Senior Student') setAuthYear(3);
                  }}
                />

                {authRole === 'Admin' ? (
                  <View
                    style={{
                      backgroundColor: theme.primarySoft,
                      borderColor: theme.accent,
                      borderWidth: 1,
                      borderRadius: 12,
                      padding: 14,
                      marginVertical: 12
                    }}
                  >
                    <Text style={{ color: theme.accent, fontWeight: 'bold', fontSize: 13, marginBottom: 4 }}>
                      🛡️ Administrator Registration (No Extra Details Required)
                    </Text>
                    <Text style={{ color: theme.textSecondary, fontSize: 12, lineHeight: 18 }}>
                      • Admins do not require department, year, or extracurricular clubs.
                      {'\n'}• The first registered Admin becomes the primary system administrator.
                      {'\n'}• Subsequent Admin registrations will be held pending your approval.
                    </Text>
                  </View>
                ) : (
                  <>
                    <Text style={[styles.label, { color: theme.text }]}>
                      2. Academic Department ("All" Restricted)
                    </Text>
                    <AccessibleChipGroup
                      options={PROFILE_DEPARTMENTS}
                      selected={authDepartment}
                      onSelect={(dept) => {
                        setAuthDepartment(dept);
                        // Enforce strict 5th Year validation when switching away from ARCH or DS
                        if (!FIFTH_YEAR_DEPTS.includes(dept) && authYear === 5) {
                          setAuthYear(4);
                        }
                      }}
                    />

                    {['Student', 'Senior Student'].includes(authRole) && (
                      <>
                        <Text style={[styles.label, { color: theme.text }]}>
                          3. Academic Year{' '}
                          {FIFTH_YEAR_DEPTS.includes(authDepartment)
                            ? '(5-Year Curriculum • Years 1–5, Sem 1–10)'
                            : '(4-Year Curriculum • Years 1–4, Sem 1–8)'}
                        </Text>
                        <AccessibleChipGroup
                          options={conditionalYears}
                          selected={authYear}
                          onSelect={setAuthYear}
                          renderLabel={(yr) => `${yr}${yr === 1 ? 'st' : yr === 2 ? 'nd' : yr === 3 ? 'rd' : 'th'} Year`}
                        />
                      </>
                    )}

                    {authRole === 'Faculty' && (
                      <>
                        <Text style={[styles.label, { color: theme.text }]}>Faculty Designation</Text>
                        <AccessibleChipGroup
                          options={FACULTY_SUBROLES}
                          selected={authFacultyRole}
                          onSelect={setAuthFacultyRole}
                        />
                      </>
                    )}

                    <TouchableOpacity
                      style={[styles.secondaryBtn, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
                      onPress={() => setShowRegClubs(!showRegClubs)}
                    >
                      <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '700' }}>
                        {showRegClubs ? '▲ Hide Extracurricular Clubs (Skippable)' : '▼ Join Extracurricular Clubs (Optional)'}
                      </Text>
                    </TouchableOpacity>

                    {showRegClubs && (
                      <View style={{ marginTop: 8 }}>
                        {Object.entries(EXTRACURRICULARS)
                          .filter(([catKey]) => authRole !== 'Faculty' || catKey !== 'sports')
                          .map(([catKey, clubArr]) => (
                          <View key={catKey}>
                            <Text style={[styles.subLabel, { color: theme.accent }]}>{catKey.toUpperCase()}</Text>
                            <AccessibleChipGroup
                              multi
                              options={clubArr}
                              selected={authClubs[catKey]}
                              onSelect={(updated) => setAuthClubs({ ...authClubs, [catKey]: updated })}
                            />
                          </View>
                        ))}
                      </View>
                    )}
                  </>
                )}
              </>
            )}

            <TouchableOpacity
              accessibilityRole="button"
              disabled={authSubmitting}
              style={[
                styles.primaryBtn,
                {
                  backgroundColor: theme.primary,
                  marginTop: 14,
                  opacity: authSubmitting ? 0.75 : 1,
                  flexDirection: 'row',
                  justifyContent: 'center',
                  alignItems: 'center'
                }
              ]}
              onPress={handleAuthSubmit}
            >
              {authSubmitting ? (
                <>
                  <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 8 }} />
                  <Text style={styles.primaryBtnText}>
                    {isRegistering ? 'Creating Account...' : 'Signing In...'}
                  </Text>
                </>
              ) : (
                <Text style={styles.primaryBtnText}>
                  {isRegistering ? 'Complete Registration' : 'Enter AURA Workspace'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Check for over-the-air updates"
              onPress={handleCheckForUpdates}
              style={{ marginTop: 14, alignSelf: 'center', padding: 8 }}
            >
              <Text style={{ color: theme.textMuted, fontSize: 12, fontWeight: '500' }}>
                🔄 Check for Updates (v2.0.0)
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ==========================================================================
  // FILTERED DATA STREAMS
  // ==========================================================================
  const smartFeedResources = resources.filter((r) => {
    const matchesDept =
      r.department === user.department || r.department === 'All' || r.department === 'General';
    const matchesYear =
      !r.targetYear || r.targetYear === 0 || r.targetYear === 'All' || Number(r.targetYear) === Number(user.year);
    const matchesDeptAndYear = matchesDept && matchesYear;
    const q = localSearch.dashboard.toLowerCase();
    return matchesDeptAndYear && (!q || `${r.title} ${r.course} ${r.summary}`.toLowerCase().includes(q));
  });

  const libraryResources = resources.filter((r) => {
    let allowedDept = false;
    if (user?.role === 'Admin') {
      if (adminLibraryDept === 'All Departments') {
        allowedDept = true;
      } else if (adminLibraryDept === 'General') {
        allowedDept = r.department === 'General' || r.department === 'All';
      } else {
        allowedDept = r.department === adminLibraryDept || r.department === 'All';
      }
    } else {
      allowedDept =
        r.department === user.department || r.department === 'All' || r.department === 'General';
    }
    const q = localSearch.library.toLowerCase();
    return allowedDept && (!q || `${r.title} ${r.course} ${r.semester || ''} ${r.resourceType} ${r.department} ${r.tags?.join(' ') || ''}`.toLowerCase().includes(q));
  });

  const trizGroupedLibrary = {};
  libraryResources.forEach((r) => {
    const semLabel = r.semester ? r.semester : 'All Semesters';
    const key = `${r.course}  ▸  ${semLabel}  ▸  ${r.resourceType}`;
    if (!trizGroupedLibrary[key]) trizGroupedLibrary[key] = [];
    trizGroupedLibrary[key].push(r);
  });

  const filteredQA = questions.filter((qItem) => {
    const q = localSearch.qa.toLowerCase();
    const matchesSearch = !q || `${qItem.question} ${qItem.askerName} ${qItem.department} ${qItem.clubCategory || ''} ${qItem.clubName || ''}`.toLowerCase().includes(q);
    const matchesCategory = qaClubCategoryFilter === 'All' || qItem.clubCategory === qaClubCategoryFilter;
    const matchesClub = qaClubNameFilter === 'All' || qItem.clubName === qaClubNameFilter;
    return matchesSearch && matchesCategory && matchesClub;
  });

  const filteredGuides = guides.filter((g) => {
    const q = localSearch.guides.toLowerCase();
    const matchesSearch = !q || `${g.title} ${g.category} ${g.content} ${g.authorName} ${g.topics?.join(' ') || ''}`.toLowerCase().includes(q);
    const matchesTopic = guideTopicFilter === 'All' || (g.topics && g.topics.includes(guideTopicFilter));
    return matchesSearch && matchesTopic;
  });

  const globalQuery = localSearch.search.toLowerCase().trim();
  const globalLibraryMatches = resources.filter(
    (r) => !globalQuery || `${r.title} ${r.summary} ${r.course} ${r.department}`.toLowerCase().includes(globalQuery)
  );
  const globalQaMatches = questions.filter(
    (q) => !globalQuery || `${q.question} ${q.department}`.toLowerCase().includes(globalQuery)
  );
  const globalGuideMatches = guides.filter(
    (g) => !globalQuery || `${g.title} ${g.content} ${g.category}`.toLowerCase().includes(globalQuery)
  );

  const filteredNotifications = notifications.filter((n) => {
    const q = localSearch.notifications.toLowerCase();
    return !q || `${n.title} ${n.message} ${n.entryPathTriggers?.join(' ')}`.toLowerCase().includes(q);
  });

  const activeOrderedTabs = getOrderedTabs(user);
  const currentTabMeta = activeOrderedTabs.find((t) => t.key === activeTabKey) || activeOrderedTabs[0];

  // --- REUSABLE RESOURCE CARD ---
  const renderResourceCard = (item) => (
    <View
      key={item._id}
      style={[
        styles.resourceCard,
        { backgroundColor: theme.card, borderColor: theme.border }
      ]}
    >
      <View style={styles.rowBetween}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>{item.title}</Text>
          <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '600', marginTop: 2 }}>
            📐 {item.course}{item.semester ? ` • ${item.semester}` : ''} • {item.resourceType} ({item.department} • {item.targetYear === 0 || !item.targetYear ? 'All Years' : `Yr ${item.targetYear}`})
          </Text>
        </View>
        {item.verified ? (
          <View style={styles.verifiedCompositeBadge}>
            <Text style={styles.verifiedBadgeText}>✅ Verified</Text>
            <Text style={styles.verifiedSubText}>{item.moderatorTag}</Text>
            <Text style={styles.verifiedSubText}>★ {item.peerFeedbackScore} Peer Score</Text>
          </View>
        ) : (
          <View style={styles.unverifiedBadge}>
            <Text style={styles.unverifiedText}>⏳ Unverified</Text>
          </View>
        )}
      </View>

      <Text style={[styles.summaryText, { color: theme.textSecondary }]}>{item.summary}</Text>
      <Text style={{ color: theme.textMuted, fontSize: 11 }}>
        Uploaded by {item.uploaderName} ({item.uploaderRole})
      </Text>

      <View style={[styles.rowBetween, { marginTop: 10 }]}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`Preview ${item.title} in In-App PDF Reader`}
          style={[styles.previewBtn, { backgroundColor: theme.primary }]}
          onPress={() => setPdfModal({ visible: true, url: item.pdfUrl, title: item.title })}
        >
          <Text style={styles.previewBtnText}>👁️ Read In-App PDF</Text>
        </TouchableOpacity>

        {!item.verified && ['Senior Student', 'Faculty', 'Admin'].includes(user.role) && (
          <TouchableOpacity
            accessibilityRole="button"
            style={[styles.previewBtn, { backgroundColor: theme.success }]}
            onPress={() => handleVerifyResource(item._id)}
          >
            <Text style={styles.previewBtnText}>✓ Verify Document</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  // ==========================================================================
  // RENDER ACTIVE TAB VIEW
  // ==========================================================================
  const renderActiveTabContent = () => {
    switch (activeTabKey) {
      case 'dashboard':
        return (
          <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.sectionHeader, { color: theme.text }]}>⚡ 1. Smart Dashboard</Text>
            <Text style={[styles.sectionSub, { color: theme.textMuted }]}>
              Personalized feed mapped strictly to {user.department}
              {user.year ? ` • Year ${user.year}` : ''}.
            </Text>
            <LocalizedSearchBar
              sectionLabel="Smart Dashboard"
              value={localSearch.dashboard}
              onChange={(v) => updateLocalSearch('dashboard', v)}
            />
            {smartFeedResources.length === 0 ? (
              <Text style={{ color: theme.textMuted, fontStyle: 'italic' }}>
                No resources uploaded specifically for {user.department} {user.year ? `Year ${user.year}` : ''} yet.
              </Text>
            ) : (
              smartFeedResources.map(renderResourceCard)
            )}

            {/* PLUS ULTRA LEADERBOARD & TOP MENTORS */}
            <View
              style={[
                styles.formBox,
                {
                  backgroundColor: theme.surfaceElevated,
                  marginTop: 14,
                  borderColor: '#f59e0b',
                  borderWidth: 1
                }
              ]}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: 18, marginRight: 6 }}>🏆</Text>
                  <Text style={[styles.subLabel, { color: '#f59e0b', fontSize: 13, marginTop: 0, marginBottom: 0, fontWeight: 'bold' }]}>
                    Plus Ultra Top Mentors & Contributors
                  </Text>
                </View>
                {currentUserPUPMeta && (
                  <View style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 }}>
                    <Text style={{ color: '#d97706', fontSize: 11, fontWeight: 'bold' }}>
                      Your PUP: ⚡ {currentUserPUPMeta.points || user.plusUltraPoints || 0}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={{ color: theme.textMuted, fontSize: 11, marginBottom: 10 }}>
                Earn Plus Ultra Points (PUP) by answering Q&A queries, receiving upvotes, and uploading verified guides!
              </Text>

              {/* Department Filter Chips for Leaderboard */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 10 }}>
                {['All', ...PROFILE_DEPARTMENTS].map((dept) => {
                  const isSel = leaderboardDeptFilter === dept;
                  return (
                    <TouchableOpacity
                      key={dept}
                      style={{
                        paddingVertical: 4,
                        paddingHorizontal: 10,
                        borderRadius: 14,
                        backgroundColor: isSel ? '#f59e0b' : theme.card,
                        borderWidth: 1,
                        borderColor: isSel ? '#f59e0b' : theme.border
                      }}
                      onPress={async () => {
                        setLeaderboardDeptFilter(dept);
                        try {
                          const query = dept === 'All' ? '' : `?department=${encodeURIComponent(dept)}`;
                          const res = await axios.get(`${BACKEND_URL}/api/leaderboard${query}`, apiHeader);
                          if (res.data?.leaderboard) setLeaderboard(res.data.leaderboard);
                        } catch (e) {
                          console.log('Leaderboard filter error:', e);
                        }
                      }}
                    >
                      <Text style={{ color: isSel ? '#fff' : theme.text, fontSize: 11, fontWeight: isSel ? '700' : '500' }}>
                        {dept}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {leaderboard.length === 0 ? (
                <Text style={{ color: theme.textMuted, fontSize: 11, fontStyle: 'italic', paddingVertical: 6 }}>
                  No ranked mentors in this department yet. Be the first to earn Plus Ultra Points!
                </Text>
              ) : (
                leaderboard.slice(0, 5).map((m, idx) => (
                  <View
                    key={m._id || idx}
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      backgroundColor: theme.card,
                      padding: 10,
                      borderRadius: 8,
                      marginBottom: 6,
                      borderWidth: 1,
                      borderColor: idx === 0 ? '#f59e0b' : theme.border
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 8 }}>
                      <Text style={{ fontSize: 14, fontWeight: 'bold', width: 24, color: idx === 0 ? '#f59e0b' : idx === 1 ? '#94a3b8' : idx === 2 ? '#b45309' : theme.textMuted }}>
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                      </Text>
                      <View>
                        <Text style={{ color: theme.text, fontSize: 12, fontWeight: 'bold' }}>
                          {m.name}
                        </Text>
                        <Text style={{ color: theme.textMuted, fontSize: 10 }}>
                          {m.department || 'Campus'}{m.year ? ` • Yr ${m.year}` : ''} • {m.role}
                        </Text>
                        {m.badges && m.badges.length > 0 && (
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                            {m.badges.slice(0, 2).map((b) => (
                              <View key={b} style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>
                                <Text style={{ color: '#d97706', fontSize: 9, fontWeight: 'bold' }}>★ {b}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ color: '#f59e0b', fontWeight: 'bold', fontSize: 13 }}>
                        ⚡ {m.plusUltraPoints || 0}
                      </Text>
                      <Text style={{ color: theme.textMuted, fontSize: 9 }}>PUP</Text>
                    </View>
                  </View>
                ))
              )}
            </View>

            {user.role === 'Admin' && (
              <View
                style={[
                  styles.formBox,
                  {
                    backgroundColor: theme.surfaceElevated,
                    marginTop: 14,
                    borderColor: theme.accent,
                    borderWidth: 1
                  }
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={{ fontSize: 16, marginRight: 6 }}>{user.isPrimaryAdmin ? '👑' : '🛡️'}</Text>
                  <Text style={[styles.subLabel, { color: theme.accent, fontSize: 13, marginTop: 0, marginBottom: 0 }]}>
                    {user.isPrimaryAdmin ? 'Primary Admin POV Testing & Persona Sandbox' : 'Administrator Persona Sandbox'}
                  </Text>
                </View>
                <Text style={{ color: theme.textMuted, fontSize: 11, marginBottom: 10, lineHeight: 16 }}>
                  {user.isPrimaryAdmin
                    ? 'You have complete POV testing privileges. Select a test persona below, or visit "10. Account Approvals" in the menu to test specific user accounts.'
                    : 'Test the application through standardized student and faculty personas below to inspect personalized streams, filters, and department restrictions.'}
                </Text>

                <Text style={{ color: theme.textSecondary, fontSize: 11, fontWeight: 'bold', marginBottom: 6 }}>
                  ONE-TAP TEST PERSONAS:
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {[
                    { label: '🎓 Yr 1 CSE Student', params: { presetRole: 'Student', presetDepartment: 'CSE', presetYear: 1 } },
                    { label: '🏛️ Yr 5 ARCH Senior', params: { presetRole: 'Senior Student', presetDepartment: 'ARCH', presetYear: 5 } },
                    { label: '📊 Yr 5 DS Senior', params: { presetRole: 'Senior Student', presetDepartment: 'DS', presetYear: 5 } },
                    { label: '⚡ Yr 4 EEE Senior', params: { presetRole: 'Senior Student', presetDepartment: 'EEE', presetYear: 4 } },
                    { label: '👨‍🏫 ECE Professor', params: { presetRole: 'Faculty', presetDepartment: 'ECE', presetFacultyRole: 'Professor' } },
                    { label: '🔬 Mechanical Assistant Prof', params: { presetRole: 'Faculty', presetDepartment: 'MECH', presetFacultyRole: 'Assistant Prof' } },
                    { label: '🛡️ Secondary Admin', params: { presetRole: 'Admin', presetDepartment: 'Administration' } }
                  ].map((persona) => (
                    <TouchableOpacity
                      key={persona.label}
                      accessibilityRole="button"
                      accessibilityLabel={`Switch to ${persona.label}`}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: theme.card,
                          borderColor: theme.border,
                          paddingVertical: 6,
                          paddingHorizontal: 10,
                          minHeight: 34
                        }
                      ]}
                      onPress={() => handleSwitchPresetPersona(persona.params)}
                    >
                      <Text style={{ color: theme.text, fontSize: 11, fontWeight: '600' }}>
                        {persona.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {user.isPrimaryAdmin && (
                  <TouchableOpacity
                    style={[styles.secondaryBtn, { borderColor: theme.accent, marginTop: 10, backgroundColor: theme.primarySoft }]}
                    onPress={() => triggerTabTransition('approvals')}
                  >
                    <Text style={{ color: theme.accent, fontSize: 12, fontWeight: 'bold' }}>
                      🛡️ Open Dedicated Account Approvals Tab ({adminUsers.filter(u => u.role === 'Admin' && !u.isApproved).length} Pending)
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        );

      case 'library':
        return (
          <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.sectionHeader, { color: theme.text }]}>📚 2. Academic Library</Text>
            <Text style={[styles.sectionSub, { color: theme.textMuted }]}>
              {user.role === 'Admin'
                ? 'Full Cross-Department Vault with Administrator Deep Triage & Inspection.'
                : `Multi-level TRIZ Dimension hierarchy (Course ▸ Semester ▸ Type) for ${user.department} + All.`}
            </Text>
            <LocalizedSearchBar
              sectionLabel="Academic Library"
              value={localSearch.library}
              onChange={(v) => updateLocalSearch('library', v)}
            />

            {user?.role === 'Admin' && (
              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 12, fontWeight: 'bold', color: theme.accent, marginBottom: 6 }}>
                  🏛️ Admin Department Filter ({libraryResources.length} Documents):
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 2 }}>
                  {['All Departments', 'General', ...PROFILE_DEPARTMENTS].map((dept) => {
                    const isSel = adminLibraryDept === dept;
                    return (
                      <TouchableOpacity
                        key={dept}
                        style={{
                          paddingVertical: 5,
                          paddingHorizontal: 12,
                          borderRadius: 16,
                          backgroundColor: isSel ? theme.primary : theme.card,
                          borderColor: isSel ? theme.primary : theme.border,
                          borderWidth: 1
                        }}
                        onPress={() => setAdminLibraryDept(dept)}
                      >
                        <Text style={{ color: isSel ? '#fff' : theme.text, fontSize: 11, fontWeight: isSel ? '700' : '500' }}>
                          {dept}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {Object.keys(trizGroupedLibrary).length === 0 ? (
              <Text style={{ color: theme.textMuted }}>No matching documents in library.</Text>
            ) : (
              Object.entries(trizGroupedLibrary).map(([groupTitle, items]) => (
                <View key={groupTitle} style={[styles.trizGroupBox, { backgroundColor: theme.surfaceElevated }]}>
                  <Text style={{ color: theme.accent, fontWeight: 'bold', marginBottom: 8 }}>
                    🗂️ {groupTitle}
                  </Text>
                  {items.map(renderResourceCard)}
                </View>
              ))
            )}
          </View>
        );

      case 'qa':
        return (
          <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.sectionHeader, { color: theme.text }]}>💬 3. Q&A Board</Text>
            <Text style={[styles.sectionSub, { color: theme.textMuted }]}>
              Decentralized peer-to-peer academic and club forum. Earn +10 PUP per upvote and +50 PUP for accepted answers!
            </Text>
            <LocalizedSearchBar
              sectionLabel="Q&A Board"
              value={localSearch.qa}
              onChange={(v) => updateLocalSearch('qa', v)}
            />

            {/* Club Category Filter Bar */}
            <View style={{ marginBottom: 10 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: theme.accent, marginBottom: 4 }}>
                🏷️ Filter by Extracurricular Club Category:
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {['All', 'Tech', 'Non-Tech', 'Sports', 'Cultural', 'Volunteering'].map((cat) => {
                  const isSel = qaClubCategoryFilter === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={{
                        paddingVertical: 4,
                        paddingHorizontal: 10,
                        borderRadius: 14,
                        backgroundColor: isSel ? theme.primary : theme.card,
                        borderColor: isSel ? theme.primary : theme.border,
                        borderWidth: 1
                      }}
                      onPress={() => {
                        setQaClubCategoryFilter(cat);
                        setQaClubNameFilter('All');
                      }}
                    >
                      <Text style={{ color: isSel ? '#fff' : theme.text, fontSize: 11, fontWeight: isSel ? '700' : '500' }}>
                        {cat === 'All' ? '🌐 All Clubs & Academic' : cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Sub-Filter for specific clubs if a club category is active */}
            {qaClubCategoryFilter !== 'All' && (
              <View style={{ marginBottom: 12 }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {['All', ...(EXTRACURRICULARS[qaClubCategoryFilter === 'Non-Tech' ? 'nonTech' : qaClubCategoryFilter.toLowerCase()] || [])].map((cl) => {
                    const isSel = qaClubNameFilter === cl;
                    return (
                      <TouchableOpacity
                        key={cl}
                        style={{
                          paddingVertical: 3,
                          paddingHorizontal: 8,
                          borderRadius: 12,
                          backgroundColor: isSel ? theme.accent : theme.surfaceElevated,
                          borderColor: isSel ? theme.accent : theme.border,
                          borderWidth: 1
                        }}
                        onPress={() => setQaClubNameFilter(cl)}
                      >
                        <Text style={{ color: isSel ? '#fff' : theme.textSecondary, fontSize: 10, fontWeight: isSel ? '700' : '400' }}>
                          {cl}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            <View style={[styles.formBox, { backgroundColor: theme.surfaceElevated }]}>
              <TextInput
                style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                placeholder="Ask an academic or club question..."
                placeholderTextColor={theme.textMuted}
                value={newQuestion}
                onChangeText={setNewQuestion}
              />
              <Text style={[styles.subLabel, { color: theme.accent, marginTop: 4 }]}>Academic Department Tag</Text>
              <AccessibleChipGroup
                options={RESOURCE_DEPARTMENTS}
                selected={newQuestionDept}
                onSelect={setNewQuestionDept}
              />

              {/* Optional Extracurricular Club Tag */}
              <Text style={[styles.subLabel, { color: theme.accent, marginTop: 8 }]}>
                Extracurricular Club Tag (Optional)
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 8 }}>
                {['None', 'Tech', 'Non-Tech', 'Sports', 'Cultural', 'Volunteering'].map((cat) => {
                  const isSel = (cat === 'None' && !newQClubCategory) || newQClubCategory === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={{
                        paddingVertical: 4,
                        paddingHorizontal: 10,
                        borderRadius: 14,
                        backgroundColor: isSel ? theme.accent : theme.card,
                        borderWidth: 1,
                        borderColor: isSel ? theme.accent : theme.border
                      }}
                      onPress={() => {
                        setNewQClubCategory(cat === 'None' ? null : cat);
                        setNewQClubName(null);
                      }}
                    >
                      <Text style={{ color: isSel ? '#fff' : theme.text, fontSize: 11, fontWeight: isSel ? '700' : '500' }}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {newQClubCategory && (
                <View style={{ marginBottom: 8 }}>
                  <Text style={[styles.subLabel, { color: theme.textMuted, fontSize: 11 }]}>Select Specific {newQClubCategory} Club:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                    {(EXTRACURRICULARS[newQClubCategory === 'Non-Tech' ? 'nonTech' : newQClubCategory.toLowerCase()] || []).map((clubItem) => {
                      const isSel = newQClubName === clubItem;
                      return (
                        <TouchableOpacity
                          key={clubItem}
                          style={{
                            paddingVertical: 3,
                            paddingHorizontal: 8,
                            borderRadius: 12,
                            backgroundColor: isSel ? theme.primary : theme.card,
                            borderWidth: 1,
                            borderColor: isSel ? theme.primary : theme.border
                          }}
                          onPress={() => setNewQClubName(clubItem)}
                        >
                          <Text style={{ color: isSel ? '#fff' : theme.text, fontSize: 10, fontWeight: isSel ? '700' : '400' }}>
                            {clubItem}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: theme.primary, marginTop: 8 }]}
                onPress={async () => {
                  if (!newQuestion) return;
                  await axios.post(
                    `${BACKEND_URL}/api/qa`,
                    {
                      question: newQuestion,
                      department: newQuestionDept,
                      clubCategory: newQClubCategory,
                      clubName: newQClubName
                    },
                    apiHeader
                  );
                  setNewQuestion('');
                  setNewQClubCategory(null);
                  setNewQClubName(null);
                  fetchAllData();
                }}
              >
                <Text style={styles.primaryBtnText}>Post Question</Text>
              </TouchableOpacity>
            </View>

            {filteredQA.map((qItem) => (
              <View key={qItem._id} style={[styles.resourceCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Text style={[styles.cardTitle, { color: theme.text, flex: 1, paddingRight: 6 }]}>
                    Q: {qItem.question}
                  </Text>
                  {qItem.clubName ? (
                    <View style={{ backgroundColor: 'rgba(56, 189, 248, 0.15)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, borderWidth: 1, borderColor: '#38bdf8' }}>
                      <Text style={{ color: '#0284c7', fontSize: 10, fontWeight: 'bold' }}>
                        🏷️ {qItem.clubCategory}: {qItem.clubName}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text style={{ color: theme.textMuted, fontSize: 11, marginBottom: 8, marginTop: 2 }}>
                  Asked by {qItem.askerName} ({qItem.askerRole}) • [{qItem.department}]
                </Text>
                {qItem.answers?.map((ans, idx) => (
                  <View key={ans._id || idx} style={[styles.answerItem, { backgroundColor: theme.surface, borderColor: ans.isAccepted ? '#10b981' : theme.border, borderWidth: ans.isAccepted ? 1.5 : 1 }]}>
                    {ans.isAccepted && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                        <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#10b981' }}>
                          ✅ Accepted Solution (+50 PUP)
                        </Text>
                      </View>
                    )}
                    <Text style={{ color: theme.text, fontSize: 13 }}>{ans.text}</Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                      <Text style={{ color: theme.accent, fontSize: 11 }}>
                        — {ans.responderName} ({ans.responderRole})
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        {/* Upvote Answer Button */}
                        <TouchableOpacity
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: (ans.upvoters || []).includes(user?._id) ? 'rgba(245, 158, 11, 0.2)' : theme.card,
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: (ans.upvoters || []).includes(user?._id) ? '#f59e0b' : theme.border
                          }}
                          onPress={() => handleUpvoteAnswer(qItem._id, ans._id)}
                        >
                          <Text style={{ fontSize: 11, color: '#f59e0b', fontWeight: 'bold', marginRight: 3 }}>▲</Text>
                          <Text style={{ fontSize: 11, color: theme.text, fontWeight: '600' }}>
                            {ans.upvotes || 0}
                          </Text>
                          <Text style={{ fontSize: 9, color: theme.textMuted, marginLeft: 2 }}>+10 PUP</Text>
                        </TouchableOpacity>

                        {/* Accept Solution Button (For Question Asker, Admin or Faculty) */}
                        {!ans.isAccepted && (String(qItem.askerId) === String(user?._id) || ['Admin', 'Faculty'].includes(user?.role)) && (
                          <TouchableOpacity
                            style={{
                              backgroundColor: 'rgba(16, 185, 129, 0.15)',
                              paddingHorizontal: 8,
                              paddingVertical: 3,
                              borderRadius: 12,
                              borderWidth: 1,
                              borderColor: '#10b981'
                            }}
                            onPress={() => handleAcceptAnswer(qItem._id, ans._id)}
                          >
                            <Text style={{ fontSize: 10, color: '#059669', fontWeight: 'bold' }}>✓ Accept (+50)</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </View>
                ))}
                <View style={[styles.rowBetween, { marginTop: 8 }]}>
                  <TextInput
                    style={[
                      styles.input,
                      { flex: 1, marginBottom: 0, marginRight: 8, backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }
                    ]}
                    placeholder="Write an answer..."
                    placeholderTextColor={theme.textMuted}
                    value={answerInputs[qItem._id] || ''}
                    onChangeText={(txt) => setAnswerInputs({ ...answerInputs, [qItem._id]: txt })}
                  />
                  <TouchableOpacity
                    style={[styles.previewBtn, { backgroundColor: theme.primary }]}
                    onPress={async () => {
                      const text = answerInputs[qItem._id];
                      if (!text) return;
                      await axios.post(`${BACKEND_URL}/api/qa/${qItem._id}/answer`, { text }, apiHeader);
                      setAnswerInputs({ ...answerInputs, [qItem._id]: '' });
                      fetchAllData();
                    }}
                  >
                    <Text style={styles.previewBtnText}>Reply</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        );

      case 'guides':
        return (
          <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.sectionHeader, { color: theme.text }]}>⭐ 4. Experiences & Guides</Text>
            <Text style={[styles.sectionSub, { color: theme.textMuted }]}>
              Senior tips, career experiences, and interview guides with ratings & Plus Ultra Points (+25 PUP for 4★+).
            </Text>
            <LocalizedSearchBar
              sectionLabel="Experiences & Guides"
              value={localSearch.guides}
              onChange={(v) => updateLocalSearch('guides', v)}
            />

            {/* Topic Filter Chips */}
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: theme.accent, marginBottom: 4 }}>
                🏷️ Filter by Topic Tag:
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {['All', ...GUIDE_TOPIC_PRESETS].map((t) => {
                  const isSel = guideTopicFilter === t;
                  return (
                    <TouchableOpacity
                      key={t}
                      style={{
                        paddingVertical: 4,
                        paddingHorizontal: 10,
                        borderRadius: 14,
                        backgroundColor: isSel ? theme.primary : theme.card,
                        borderColor: isSel ? theme.primary : theme.border,
                        borderWidth: 1
                      }}
                      onPress={() => setGuideTopicFilter(t)}
                    >
                      <Text style={{ color: isSel ? '#fff' : theme.text, fontSize: 11, fontWeight: isSel ? '700' : '500' }}>
                        {t}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <View style={[styles.formBox, { backgroundColor: theme.surfaceElevated }]}>
              <TextInput
                style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                placeholder="Guide Title"
                placeholderTextColor={theme.textMuted}
                value={guideTitle}
                onChangeText={setGuideTitle}
              />
              <AccessibleChipGroup options={GUIDE_CATEGORIES} selected={guideCategory} onSelect={setGuideCategory} />

              <Text style={[styles.subLabel, { color: theme.accent, marginTop: 8 }]}>Select Topic Tags (Multi-Select):</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 6 }}>
                {GUIDE_TOPIC_PRESETS.map((top) => {
                  const isSel = guideSelectedTopics.includes(top);
                  return (
                    <TouchableOpacity
                      key={top}
                      style={{
                        paddingVertical: 4,
                        paddingHorizontal: 9,
                        borderRadius: 12,
                        backgroundColor: isSel ? theme.accent : theme.card,
                        borderColor: isSel ? theme.accent : theme.border,
                        borderWidth: 1
                      }}
                      onPress={() => {
                        setGuideSelectedTopics((prev) =>
                          isSel ? prev.filter((x) => x !== top) : [...prev, top]
                        );
                      }}
                    >
                      <Text style={{ color: isSel ? '#fff' : theme.textSecondary, fontSize: 11, fontWeight: isSel ? 'bold' : 'normal' }}>
                        {isSel ? '✓ ' : ''}{top}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TextInput
                style={[styles.input, { minHeight: 70, backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                multiline
                placeholder="Share your experience, interview questions, or study strategy..."
                placeholderTextColor={theme.textMuted}
                value={guideContent}
                onChangeText={setGuideContent}
              />
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: theme.primary }]}
                onPress={async () => {
                  if (!guideTitle || !guideContent) return;
                  await axios.post(
                    `${BACKEND_URL}/api/guides`,
                    {
                      title: guideTitle,
                      category: guideCategory,
                      department: guideDept,
                      content: guideContent,
                      topics: guideSelectedTopics,
                      tags: guideSelectedTopics
                    },
                    apiHeader
                  );
                  setGuideTitle('');
                  setGuideContent('');
                  setGuideSelectedTopics([]);
                  fetchAllData();
                }}
              >
                <Text style={styles.primaryBtnText}>Publish Guide (+15 PUP)</Text>
              </TouchableOpacity>
            </View>

            {filteredGuides.map((g) => (
              <View key={g._id} style={[styles.resourceCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <View style={styles.rowBetween}>
                  <Text style={[styles.cardTitle, { color: theme.text }]}>{g.title}</Text>
                  <Text style={{ color: theme.accent, fontSize: 12, fontWeight: 'bold' }}>{g.category}</Text>
                </View>

                {g.topics && g.topics.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginVertical: 4 }}>
                    {g.topics.map((tp) => (
                      <View key={tp} style={{ backgroundColor: 'rgba(99, 102, 241, 0.12)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                        <Text style={{ color: theme.accent, fontSize: 10, fontWeight: '600' }}>#{tp}</Text>
                      </View>
                    ))}
                  </View>
                )}

                <Text style={[styles.summaryText, { color: theme.textSecondary, fontStyle: 'normal' }]}>{g.content}</Text>
                <View style={styles.rowBetween}>
                  <Text style={{ color: theme.textMuted, fontSize: 11 }}>By {g.authorName} ({g.authorRole})</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <TouchableOpacity
                        key={star}
                        accessibilityRole="button"
                        accessibilityLabel={`Rate ${star} stars`}
                        style={{ paddingHorizontal: 4, minHeight: 36, justifyContent: 'center' }}
                        onPress={async () => {
                          await axios.post(`${BACKEND_URL}/api/guides/${g._id}/rate`, { stars: star }, apiHeader);
                          fetchAllData();
                        }}
                      >
                        <Text style={{ fontSize: 19, color: star <= Math.round(g.averageRating) ? '#facc15' : '#475569' }}>
                          ★
                        </Text>
                      </TouchableOpacity>
                    ))}
                    <Text style={{ color: '#facc15', fontSize: 12, fontWeight: 'bold', marginLeft: 4 }}>
                      {g.averageRating || '0.0'} ({g.ratings?.length || 0})
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        );

      case 'updates': {
        const isAdmin = user.role === 'Admin';
        const inChargeDept = user.placementDepartment || (user.isPlacementInCharge ? user.department : null);
        const canReviewOrPost = isAdmin || Boolean(user.isPlacementInCharge && inChargeDept);

        const publishedJobs = (jobsData.jobs || []).filter((j) => {
          if (isAdmin) return true;
          if (j.isGloballyPublished) return true;
          return (j.departmentApprovals || []).some((da) => da.status === 'Published');
        });

        const pendingJobs = (jobsData.jobs || []).filter((j) => {
          if (isAdmin) {
            return (j.departmentApprovals || []).some((da) => da.status === 'Pending');
          }
          if (inChargeDept) {
            return (j.departmentApprovals || []).some(
              (da) => da.department === inChargeDept && da.status === 'Pending'
            );
          }
          return false;
        });

        const filteredJobs = (hiringSubTab === 'approvals' ? pendingJobs : publishedJobs).filter((j) => {
          const q = (localSearch.updates || '').toLowerCase();
          if (!q) return true;
          return (
            (j.company || '').toLowerCase().includes(q) ||
            (j.role || '').toLowerCase().includes(q) ||
            (j.description || '').toLowerCase().includes(q) ||
            (j.targetDepartments || []).join(' ').toLowerCase().includes(q)
          );
        });

        return (
          <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.sectionHeader, { color: theme.text }]}>💼 5. Campus Updates</Text>
            <Text style={[styles.sectionSub, { color: theme.textMuted }]}>
              Verified hiring radar, corporate openings & placement broadcasts targeted strictly by department and year.
            </Text>

            {/* SUB-TABS: Hiring Radar (Default) | Approvals (if In-Charge/Admin) | Post Opening */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 12 }}>
              <TouchableOpacity
                style={[
                  styles.chip,
                  {
                    backgroundColor: hiringSubTab === 'radar' ? theme.primary : theme.card,
                    borderColor: hiringSubTab === 'radar' ? theme.accent : theme.border,
                    paddingHorizontal: 14,
                    paddingVertical: 8
                  }
                ]}
                onPress={() => setHiringSubTab('radar')}
              >
                <Text style={{ color: hiringSubTab === 'radar' ? '#fff' : theme.text, fontWeight: '700', fontSize: 13 }}>
                  💼 Hiring Radar ({publishedJobs.length})
                </Text>
              </TouchableOpacity>

              {canReviewOrPost && (
                <TouchableOpacity
                  style={[
                    styles.chip,
                    {
                      backgroundColor: hiringSubTab === 'approvals' ? theme.primary : theme.card,
                      borderColor: hiringSubTab === 'approvals' ? theme.accent : theme.border,
                      paddingHorizontal: 14,
                      paddingVertical: 8
                    }
                  ]}
                  onPress={() => setHiringSubTab('approvals')}
                >
                  <Text style={{ color: hiringSubTab === 'approvals' ? '#fff' : theme.text, fontWeight: '700', fontSize: 13 }}>
                    📋 1-Tap Reviews {pendingJobs.length > 0 ? `(${pendingJobs.length} Pending)` : ''}
                  </Text>
                </TouchableOpacity>
              )}

              {canReviewOrPost && (
                <TouchableOpacity
                  style={[
                    styles.chip,
                    {
                      backgroundColor: hiringSubTab === 'create' ? theme.primary : theme.card,
                      borderColor: hiringSubTab === 'create' ? theme.accent : theme.border,
                      paddingHorizontal: 14,
                      paddingVertical: 8
                    }
                  ]}
                  onPress={() => setHiringSubTab('create')}
                >
                  <Text style={{ color: hiringSubTab === 'create' ? '#fff' : theme.text, fontWeight: '700', fontSize: 13 }}>
                    ➕ Post Opening
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <LocalizedSearchBar
              sectionLabel="Updates & Hiring"
              value={localSearch.updates}
              onChange={(v) => updateLocalSearch('updates', v)}
            />

            {/* VIEW 1: POST OPENING FORM */}
            {hiringSubTab === 'create' && (
              <View style={[styles.resourceCard, { backgroundColor: theme.card, borderColor: theme.border, marginTop: 8 }]}>
                <Text style={[styles.cardTitle, { color: theme.text, marginBottom: 8 }]}>
                  📝 Post New Hiring Opportunity
                </Text>
                <Text style={{ color: theme.textMuted, fontSize: 12, marginBottom: 12 }}>
                  Submit hiring details from LinkedIn or recruiters. AI Auto-Tagging will extract eligible departments and default target years.
                </Text>

                <Text style={[styles.label, { color: theme.text }]}>Company Name *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                  placeholder="e.g. Google, Microsoft, Zoho, L&T..."
                  placeholderTextColor={theme.textMuted}
                  value={jobCompany}
                  onChangeText={setJobCompany}
                />

                <Text style={[styles.label, { color: theme.text }]}>Role Title *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                  placeholder="e.g. SDE Intern, Embedded Systems Trainee, Architect Intern..."
                  placeholderTextColor={theme.textMuted}
                  value={jobRole}
                  onChangeText={setJobRole}
                />

                <View style={styles.rowBetween}>
                  <View style={{ flex: 1, marginRight: 6 }}>
                    <Text style={[styles.label, { color: theme.text }]}>Job Type</Text>
                    <AccessibleChipGroup
                      options={JOB_TYPES}
                      selected={jobType}
                      onSelect={setJobType}
                    />
                  </View>
                </View>

                <Text style={[styles.label, { color: theme.text, marginTop: 8 }]}>Location / Mode</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                  placeholder="e.g. Bengaluru / Hybrid / Remote"
                  placeholderTextColor={theme.textMuted}
                  value={jobLocation}
                  onChangeText={setJobLocation}
                />

                <Text style={[styles.label, { color: theme.text }]}>Stipend / CTC</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                  placeholder="e.g. ₹45,000 / month, 8.5 LPA, As per industry standards"
                  placeholderTextColor={theme.textMuted}
                  value={jobStipend}
                  onChangeText={setJobStipend}
                />

                <Text style={[styles.label, { color: theme.text }]}>Application URL (LinkedIn or Career Link) *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                  placeholder="https://linkedin.com/jobs/view/... or career portal link"
                  placeholderTextColor={theme.textMuted}
                  value={jobApplyUrl}
                  onChangeText={setJobApplyUrl}
                  autoCapitalize="none"
                />

                <Text style={[styles.label, { color: theme.text }]}>Application Deadline (Optional)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                  placeholder="e.g. 25 Nov 2026, Rolling basis, End of month"
                  placeholderTextColor={theme.textMuted}
                  value={jobDeadline}
                  onChangeText={setJobDeadline}
                />

                <Text style={[styles.label, { color: theme.text }]}>Job Description & Qualifications *</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.surface,
                      color: theme.text,
                      borderColor: theme.border,
                      height: 90,
                      textAlignVertical: 'top'
                    }
                  ]}
                  placeholder="Paste or summarize role description, required skills, eligibility criteria..."
                  placeholderTextColor={theme.textMuted}
                  value={jobDescription}
                  onChangeText={setJobDescription}
                  multiline
                />

                {/* AI AUTO-TAG BUTTON */}
                <TouchableOpacity
                  style={[
                    styles.primaryBtn,
                    {
                      backgroundColor: theme.accent,
                      marginVertical: 10,
                      flexDirection: 'row',
                      justifyContent: 'center',
                      alignItems: 'center'
                    }
                  ]}
                  onPress={handleAiAutoTag}
                  disabled={jobAiTagging}
                >
                  {jobAiTagging ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={[styles.primaryBtnText, { color: '#000' }]}>
                      ✨ Run AI Auto-Tagging (Depts & Default Years)
                    </Text>
                  )}
                </TouchableOpacity>

                {/* TARGET DEPARTMENTS CHIPS */}
                <Text style={[styles.label, { color: theme.text, marginTop: 4 }]}>
                  Eligible Departments ({jobTargetDepts.length} selected):
                </Text>
                <AccessibleChipGroup
                  options={PROFILE_DEPARTMENTS}
                  selected={jobTargetDepts}
                  onSelect={setJobTargetDepts}
                  multi
                />

                {/* TARGET YEARS CHIPS (Editable, with 1 & 2 as optional tags) */}
                <Text style={[styles.label, { color: theme.text, marginTop: 12 }]}>
                  Target Year Cohorts:
                </Text>
                <Text style={{ color: theme.textMuted, fontSize: 11, marginBottom: 6 }}>
                  Defaults set to 3rd & 4th years (+ 5th for ARCH/DS). 1st & 2nd years are optional for early internships/challenges.
                </Text>
                <View style={styles.chipWrap}>
                  {[1, 2, 3, 4, 5].map((yr) => {
                    const isSelected = jobTargetYears.includes(yr);
                    const isOptionalEarlyYear = yr === 1 || yr === 2;
                    return (
                      <TouchableOpacity
                        key={String(yr)}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: isSelected ? theme.primary : theme.surface,
                            borderColor: isSelected ? theme.accent : theme.border,
                            paddingHorizontal: 12,
                            paddingVertical: 7
                          }
                        ]}
                        onPress={() => {
                          if (isSelected) {
                            setJobTargetYears(jobTargetYears.filter((y) => y !== yr));
                          } else {
                            setJobTargetYears([...jobTargetYears, yr].sort((a, b) => a - b));
                          }
                        }}
                      >
                        <Text style={{ color: isSelected ? '#fff' : theme.textSecondary, fontWeight: '700', fontSize: 12 }}>
                          {`Year ${yr}`}{isOptionalEarlyYear ? ' (Optional)' : ''}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {isAdmin && (
                  <TouchableOpacity
                    style={[
                      styles.rowBetween,
                      {
                        backgroundColor: jobAdminImmediate ? theme.primarySoft : theme.surface,
                        padding: 10,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: jobAdminImmediate ? theme.accent : theme.border,
                        marginTop: 12
                      }
                    ]}
                    onPress={() => setJobAdminImmediate(!jobAdminImmediate)}
                  >
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={{ color: theme.text, fontWeight: 'bold', fontSize: 12 }}>
                        👑 Admin Global Override: Publish Immediately
                      </Text>
                      <Text style={{ color: theme.textMuted, fontSize: 10 }}>
                        Bypasses in-charge approval and sends push notifications to all selected departments right away.
                      </Text>
                    </View>
                    <Text style={{ fontSize: 18 }}>{jobAdminImmediate ? '✅' : '⬜'}</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[
                    styles.primaryBtn,
                    { backgroundColor: theme.primary, marginTop: 16 }
                  ]}
                  onPress={handleCreateJob}
                  disabled={jobSubmitting}
                >
                  {jobSubmitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.primaryBtnText}>
                      🚀 Submit for Placement In-Charge Review
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* VIEW 2: 1-TAP REVIEWS & APPROVALS (For In-Charges & Admins) */}
            {hiringSubTab === 'approvals' && (
              <View style={{ marginTop: 8 }}>
                {inChargeDept && (
                  <View style={[styles.triggerBanner, { backgroundColor: theme.primarySoft, marginBottom: 10 }]}>
                    <Text style={{ color: theme.accent, fontSize: 12, fontWeight: 'bold' }}>
                      🎓 You are the Department Placement In-Charge for: {inChargeDept}
                    </Text>
                  </View>
                )}
                {isAdmin && (
                  <View style={[styles.triggerBanner, { backgroundColor: '#fef3c7', borderColor: '#f59e0b', borderWidth: 1, marginBottom: 10 }]}>
                    <Text style={{ color: '#b45309', fontSize: 12, fontWeight: 'bold' }}>
                      👑 Administrator Global Mode: You can multi-select and override approvals for any or all departments at once.
                    </Text>
                  </View>
                )}

                {pendingJobs.length === 0 ? (
                  <View style={[styles.resourceCard, { backgroundColor: theme.card, borderColor: theme.border, padding: 24, alignItems: 'center' }]}>
                    <Text style={{ fontSize: 32, marginBottom: 8 }}>🎉</Text>
                    <Text style={{ color: theme.text, fontWeight: 'bold', fontSize: 15 }}>
                      No Pending Approvals
                    </Text>
                    <Text style={{ color: theme.textMuted, fontSize: 12, textAlign: 'center', marginTop: 4 }}>
                      All hiring opportunities targeting your eligible departments have been reviewed.
                    </Text>
                  </View>
                ) : (
                  pendingJobs.map((job) => {
                    return (
                      <View
                        key={job._id}
                        style={[
                          styles.resourceCard,
                          { backgroundColor: theme.card, borderColor: theme.border, marginBottom: 12 }
                        ]}
                      >
                        <View style={styles.rowBetween}>
                          <View style={{ flex: 1, paddingRight: 8 }}>
                            <Text style={[styles.cardTitle, { color: theme.text }]}>
                              {job.role}
                            </Text>
                            <Text style={{ color: theme.accent, fontSize: 13, fontWeight: 'bold', marginTop: 2 }}>
                              🏢 {job.company} • 📍 {job.location}
                            </Text>
                          </View>
                          <View style={[styles.badge, { backgroundColor: theme.primarySoft, borderColor: theme.accent, borderWidth: 1 }]}>
                            <Text style={{ color: theme.accent, fontSize: 11, fontWeight: 'bold' }}>
                              {job.jobType}
                            </Text>
                          </View>
                        </View>

                        <Text style={{ color: theme.textSecondary, fontSize: 12, marginVertical: 6 }} numberOfLines={3}>
                          {job.description}
                        </Text>

                        {/* Status across eligible departments */}
                        <Text style={{ color: theme.textMuted, fontSize: 11, fontWeight: 'bold', marginTop: 4 }}>
                          Department Review Status:
                        </Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 6 }}>
                          {(job.departmentApprovals || []).map((da) => {
                            const isApproved = da.status === 'Published';
                            const isRejected = da.status === 'Rejected';
                            const isMine = inChargeDept === da.department;
                            return (
                              <View
                                key={da.department}
                                style={{
                                  paddingHorizontal: 8,
                                  paddingVertical: 4,
                                  borderRadius: 6,
                                  borderWidth: 1,
                                  backgroundColor: isApproved ? '#dcfce7' : isRejected ? '#fee2e2' : '#fef3c7',
                                  borderColor: isApproved ? '#16a34a' : isRejected ? '#dc2626' : '#d97706',
                                  flexDirection: 'row',
                                  alignItems: 'center'
                                }}
                              >
                                <Text style={{
                                  fontSize: 10,
                                  fontWeight: 'bold',
                                  color: isApproved ? '#166534' : isRejected ? '#991b1b' : '#92400e'
                                }}>
                                  {da.department}: {da.status}{isMine ? ' (You)' : ''}
                                </Text>
                              </View>
                            );
                          })}
                        </View>

                        <Text style={{ color: theme.textMuted, fontSize: 11, marginBottom: 10 }}>
                          Target Cohorts: {job.targetYears?.map(y => `Yr ${y}`).join(', ')} • Compensation: {job.stipendOrSalary}
                        </Text>

                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <TouchableOpacity
                            style={[
                              styles.primaryBtn,
                              { backgroundColor: theme.primary, flex: 1, paddingVertical: 10 }
                            ]}
                            onPress={() => handleOpenReviewModal(job)}
                          >
                            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12, textAlign: 'center' }}>
                              ⚡ 1-Tap Review & Approve
                            </Text>
                          </TouchableOpacity>

                          {isAdmin && (
                            <TouchableOpacity
                              style={[
                                styles.previewBtn,
                                { borderColor: theme.danger, paddingHorizontal: 12 }
                              ]}
                              onPress={() => handleDeleteJob(job._id)}
                            >
                              <Text style={{ color: theme.danger, fontWeight: 'bold', fontSize: 12 }}>
                                🗑️
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            )}

            {/* VIEW 3: HIRING RADAR (Main Student / Campus Feed) */}
            {hiringSubTab === 'radar' && (
              <View style={{ marginTop: 8 }}>
                {filteredJobs.length === 0 ? (
                  <View style={[styles.resourceCard, { backgroundColor: theme.card, borderColor: theme.border, padding: 24, alignItems: 'center' }]}>
                    <Text style={{ fontSize: 32, marginBottom: 8 }}>💼</Text>
                    <Text style={{ color: theme.text, fontWeight: 'bold', fontSize: 15 }}>
                      No Hiring Openings Found
                    </Text>
                    <Text style={{ color: theme.textMuted, fontSize: 12, textAlign: 'center', marginTop: 4 }}>
                      {localSearch.updates
                        ? `No openings match "${localSearch.updates}".`
                        : `No approved openings currently targeted to ${user.department} ${user.year ? `Year ${user.year}` : ''}.`}
                    </Text>
                  </View>
                ) : (
                  filteredJobs.map((job) => {
                    return (
                      <View
                        key={job._id}
                        style={[
                          styles.resourceCard,
                          { backgroundColor: theme.card, borderColor: theme.border, marginBottom: 12 }
                        ]}
                      >
                        <View style={styles.rowBetween}>
                          <View style={{ flex: 1, paddingRight: 8 }}>
                            <Text style={[styles.cardTitle, { color: theme.text, fontSize: 16 }]}>
                              {job.role}
                            </Text>
                            <Text style={{ color: theme.accent, fontSize: 13, fontWeight: 'bold', marginTop: 2 }}>
                              🏢 {job.company}
                            </Text>
                          </View>
                          <View style={[styles.badge, { backgroundColor: theme.primarySoft, borderColor: theme.accent, borderWidth: 1 }]}>
                            <Text style={{ color: theme.accent, fontSize: 11, fontWeight: 'bold' }}>
                              {job.jobType}
                            </Text>
                          </View>
                        </View>

                        {/* Meta Tags Row */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 6 }}>
                          <View style={{ backgroundColor: theme.surface, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                            <Text style={{ color: theme.textSecondary, fontSize: 11 }}>
                              📍 {job.location || 'On-site / Hybrid'}
                            </Text>
                          </View>
                          <View style={{ backgroundColor: theme.surface, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                            <Text style={{ color: theme.textSecondary, fontSize: 11 }}>
                              💰 {job.stipendOrSalary || 'Competitive'}
                            </Text>
                          </View>
                          {job.deadline ? (
                            <View style={{ backgroundColor: theme.surface, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                              <Text style={{ color: theme.textSecondary, fontSize: 11 }}>
                                ⏰ Deadline: {job.deadline}
                              </Text>
                            </View>
                          ) : null}
                        </View>

                        <Text style={{ color: theme.textSecondary, fontSize: 13, lineHeight: 19, marginVertical: 6 }}>
                          {job.description}
                        </Text>

                        {/* Eligible Departments & Target Years */}
                        <View style={{ backgroundColor: theme.surface, padding: 8, borderRadius: 8, marginVertical: 6 }}>
                          <Text style={{ color: theme.textMuted, fontSize: 11, fontWeight: 'bold' }}>
                            🎯 Eligible Departments: {(job.targetDepartments || []).join(', ')}
                          </Text>
                          <Text style={{ color: theme.textMuted, fontSize: 11, marginTop: 2 }}>
                            🎓 Target Batches: {(job.targetYears || []).map(y => `Year ${y}`).join(', ')}
                          </Text>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                          <TouchableOpacity
                            style={[
                              styles.primaryBtn,
                              { backgroundColor: '#0284c7', flex: 1, paddingVertical: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }
                            ]}
                            onPress={() => {
                              if (job.applyUrl) {
                                Linking.openURL(job.applyUrl).catch(() =>
                                  Alert.alert('Link Error', 'Unable to open application link.')
                                );
                              } else {
                                Alert.alert('Notice', 'No application link provided.');
                              }
                            }}
                          >
                            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>
                              Apply on LinkedIn / Portal ↗
                            </Text>
                          </TouchableOpacity>

                          {isAdmin && (
                            <TouchableOpacity
                              style={[
                                styles.previewBtn,
                                { borderColor: theme.danger, paddingHorizontal: 12 }
                              ]}
                              onPress={() => handleDeleteJob(job._id)}
                            >
                              <Text style={{ color: theme.danger, fontWeight: 'bold', fontSize: 12 }}>
                                🗑️
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            )}
          </View>
        );
      }

      case 'laura':
        return (
          <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.sectionHeader, { color: theme.text }]}>🤖 5. Ask LAURA AI</Text>
            <Text style={[styles.sectionSub, { color: theme.textMuted }]}>
              RAG interface querying strictly VERIFIED resources with composite verification badges.
            </Text>
            <LocalizedSearchBar
              sectionLabel="LAURA AI Verified Sources"
              value={localSearch.laura}
              onChange={(v) => updateLocalSearch('laura', v)}
            />
            <View style={styles.rowBetween}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0, marginRight: 8, backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                placeholder="Ask LAURA AI a syllabus question..."
                placeholderTextColor={theme.textMuted}
                value={lauraQuery}
                onChangeText={setLauraQuery}
              />
              <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: theme.primary }]} onPress={handleAskLaura}>
                <Text style={styles.primaryBtnText}>{lauraLoading ? '...' : 'Ask LAURA'}</Text>
              </TouchableOpacity>
            </View>
            {lauraResponse && (
              <View style={{ marginTop: 14 }}>
                <View style={[styles.lauraAnswerBox, { backgroundColor: theme.primarySoft, borderColor: theme.primary }]}>
                  <Text style={{ color: theme.accent, fontWeight: 'bold', marginBottom: 6 }}>
                    🔒 Verified-Only RAG Response (TRIZ Composite Materials Rule)
                  </Text>
                  <Text style={{ color: theme.text, lineHeight: 20 }}>{lauraResponse.answer}</Text>
                </View>
                <Text style={[styles.subLabel, { color: theme.accent, marginTop: 12 }]}>Verified Source Citations:</Text>
                {lauraResponse.sources?.map(renderResourceCard)}
              </View>
            )}
          </View>
        );

      case 'upload':
        return (
          <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.sectionHeader, { color: theme.text }]}>☁️ 6. Upload Hub</Text>
            <Text style={[styles.sectionSub, { color: theme.textMuted }]}>
              Direct-to-Uploadthing PDF intake with automatic AI tagging & metadata detection.
            </Text>
            <LocalizedSearchBar
              sectionLabel="Upload Hub"
              value={localSearch.upload}
              onChange={(v) => updateLocalSearch('upload', v)}
            />
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: '#0284c7', marginBottom: 8 }]}
              onPress={handlePickAndUploadToUploadthing}
              disabled={uploadingFile}
            >
              {uploadingFile ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>1️⃣ Select PDF & Upload to Uploadthing</Text>
              )}
            </TouchableOpacity>

            {/* Instant AI Auto-Tagging Trigger */}
            <TouchableOpacity
              style={[styles.secondaryBtn, { borderColor: theme.accent, marginBottom: 12, backgroundColor: theme.primarySoft, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }]}
              onPress={handleAiAutoTagResource}
              disabled={isAiAutoTaggingResource}
            >
              {isAiAutoTaggingResource ? (
                <ActivityIndicator size="small" color={theme.accent} />
              ) : (
                <Text style={{ color: theme.accent, fontWeight: 'bold', fontSize: 13 }}>
                  ⚡ Auto-Tag with AI (Extract Dept, Sem, Type & Topics)
                </Text>
              )}
            </TouchableOpacity>

            {uploadedPdfUrl ? (
              <Text style={{ color: theme.success, fontSize: 12, marginBottom: 10 }}>
                ✓ Secure Uploadthing URL Ready: {uploadedPdfUrl}
              </Text>
            ) : null}

            <TextInput
              style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
              placeholder="Resource Title"
              placeholderTextColor={theme.textMuted}
              value={uploadTitle}
              onChangeText={setUploadTitle}
            />
            <TextInput
              style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
              placeholder="Course Code / Subject"
              placeholderTextColor={theme.textMuted}
              value={uploadCourse}
              onChangeText={setUploadCourse}
            />

            {/* Rich Topic Tags & Category Multi-Select */}
            <Text style={[styles.subLabel, { color: theme.accent }]}>Topic Tags & Category (Multi-Select)</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 6 }}>
              {UPLOAD_TOPIC_PRESETS.map((tPreset) => {
                const isSel = uploadSelectedTopics.includes(tPreset);
                return (
                  <TouchableOpacity
                    key={tPreset}
                    style={{
                      paddingVertical: 5,
                      paddingHorizontal: 10,
                      borderRadius: 12,
                      backgroundColor: isSel ? theme.primary : theme.card,
                      borderColor: isSel ? theme.primary : theme.border,
                      borderWidth: 1
                    }}
                    onPress={() => {
                      setUploadSelectedTopics((prev) =>
                        isSel ? prev.filter((x) => x !== tPreset) : [...prev, tPreset]
                      );
                    }}
                  >
                    <Text style={{ color: isSel ? '#fff' : theme.text, fontSize: 11, fontWeight: isSel ? '700' : '400' }}>
                      {isSel ? '✓ ' : ''}{tPreset}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Custom Topic Tag Input */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0, marginRight: 8, backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                placeholder="Add custom topic tag..."
                placeholderTextColor={theme.textMuted}
                value={customTopicInput}
                onChangeText={setCustomTopicInput}
              />
              <TouchableOpacity
                style={[styles.previewBtn, { backgroundColor: theme.accent }]}
                onPress={() => {
                  const clean = customTopicInput.trim();
                  if (clean && !uploadSelectedTopics.includes(clean)) {
                    setUploadSelectedTopics([...uploadSelectedTopics, clean]);
                    setCustomTopicInput('');
                  }
                }}
              >
                <Text style={styles.previewBtnText}>+ Add</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.subLabel, { color: theme.accent }]}>Department ("All" Allowed Here)</Text>
            <AccessibleChipGroup
              options={RESOURCE_DEPARTMENTS}
              selected={uploadDept}
              onSelect={(dept) => {
                setUploadDept(dept);
                // Strict 5th Year and Sem 9/10 reset for non-ARCH/DS departments
                if (!FIFTH_YEAR_DEPTS.includes(dept)) {
                  if (uploadYear === 5) setUploadYear('All Years');
                  if (['Sem 9', 'Sem 10'].includes(uploadSemester)) setUploadSemester('');
                }
              }}
            />

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
              <Text style={[styles.subLabel, { color: theme.accent, marginBottom: 0 }]}>
                Semester (Optional){' '}
                {FIFTH_YEAR_DEPTS.includes(uploadDept)
                  ? '(Sem 1–10 • ARCH/DS)'
                  : '(Sem 1–8)'}
              </Text>
              {uploadSemester ? (
                <TouchableOpacity onPress={() => setUploadSemester('')}>
                  <Text style={{ color: theme.danger, fontSize: 11, fontWeight: 'bold' }}>✕ Clear (Optional)</Text>
                </TouchableOpacity>
              ) : (
                <Text style={{ color: theme.textMuted, fontSize: 11, fontStyle: 'italic' }}>Optional / All Semesters</Text>
              )}
            </View>
            <AccessibleChipGroup
              options={['None (Optional)', ...getAvailableSemesters(uploadDept)]}
              selected={uploadSemester || 'None (Optional)'}
              onSelect={(sem) => setUploadSemester(sem === 'None (Optional)' ? '' : sem)}
            />

            <Text style={[styles.subLabel, { color: theme.accent }]}>Resource Type</Text>
            <AccessibleChipGroup options={RESOURCE_TYPES} selected={uploadType} onSelect={setUploadType} />

            <Text style={[styles.subLabel, { color: theme.accent }]}>
              Target Academic Year (Required){' '}
              {FIFTH_YEAR_DEPTS.includes(uploadDept)
                ? '(Years 1–5 or All Years • ARCH/DS)'
                : '(Years 1–4 or All Years)'}
            </Text>
            <AccessibleChipGroup
              options={['All Years', ...getAvailableYears(uploadDept)]}
              selected={uploadYear}
              onSelect={setUploadYear}
              renderLabel={(yr) => (yr === 'All Years' ? '🌟 All Years' : `Year ${yr}`)}
            />

            <TextInput
              style={[styles.input, { minHeight: 65, backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
              multiline
              placeholder="AI Extracted Summary"
              placeholderTextColor={theme.textMuted}
              value={uploadSummary}
              onChangeText={setUploadSummary}
            />

            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: theme.primary }]} onPress={handleSaveResourceToMongo}>
              <Text style={styles.primaryBtnText}>2️⃣ Save Metadata & PDF URL to MongoDB Atlas</Text>
            </TouchableOpacity>
          </View>
        );

      case 'search':
        return (
          <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.sectionHeader, { color: theme.text }]}>🔍 7. Global AI Search</Text>
            <Text style={[styles.sectionSub, { color: theme.textMuted }]}>
              Unified cross-platform search combining Library, Q&A, and Senior Guides.
            </Text>
            <LocalizedSearchBar
              sectionLabel="Global AI Knowledge Base"
              value={localSearch.search}
              onChange={(v) => updateLocalSearch('search', v)}
            />
            <Text style={[styles.subLabel, { color: theme.accent }]}>📄 Library Matches ({globalLibraryMatches.length})</Text>
            {globalLibraryMatches.slice(0, 4).map(renderResourceCard)}

            <Text style={[styles.subLabel, { color: theme.accent }]}>💬 Q&A Matches ({globalQaMatches.length})</Text>
            {globalQaMatches.slice(0, 3).map((q) => (
              <View key={q._id} style={[styles.resourceCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>[Q&A] {q.question}</Text>
                <Text style={{ color: theme.textMuted, fontSize: 11 }}>Asked by {q.askerName}</Text>
              </View>
            ))}

            <Text style={[styles.subLabel, { color: theme.accent }]}>⭐ Guide Matches ({globalGuideMatches.length})</Text>
            {globalGuideMatches.slice(0, 3).map((g) => (
              <View key={g._id} style={[styles.resourceCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>[Guide] {g.title} (★ {g.averageRating})</Text>
                <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{g.content}</Text>
              </View>
            ))}
          </View>
        );

      case 'notifications':
        return (
          <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.sectionHeader, { color: theme.text }]}>🔔 8. Multi-Target Notifications</Text>
            <Text style={[styles.sectionSub, { color: theme.textMuted }]}>
              Target combinations of Departments, Years (or All Years), Tech Clubs, Non-Tech Clubs, Sports Teams, Cultural Associations, and Volunteering Groups.
            </Text>
            <LocalizedSearchBar
              sectionLabel="Notifications"
              value={localSearch.notifications}
              onChange={(v) => updateLocalSearch('notifications', v)}
            />

            {['Admin', 'Faculty'].includes(user.role) && (
              <View style={[styles.formBox, { backgroundColor: theme.surfaceElevated }]}>
                <Text style={[styles.subLabel, { color: theme.accent }]}>
                  📢 Dispatch Multi-Target Notification Blast ({user.role})
                </Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                  placeholder="Notification Title"
                  placeholderTextColor={theme.textMuted}
                  value={noteTitle}
                  onChangeText={setNoteTitle}
                />
                <TextInput
                  style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                  placeholder="Broadcast message details..."
                  placeholderTextColor={theme.textMuted}
                  value={noteMsg}
                  onChangeText={setNoteMsg}
                />

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                  <TouchableOpacity
                    style={[
                      styles.chip,
                      {
                        backgroundColor: noteTargetAll ? theme.primary : theme.card,
                        borderColor: theme.border
                      }
                    ]}
                    onPress={() => setNoteTargetAll(!noteTargetAll)}
                  >
                    <Text style={{ color: noteTargetAll ? '#fff' : theme.text, fontWeight: 'bold', fontSize: 12 }}>
                      🌐 Target Entire Campus
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.chip,
                      {
                        backgroundColor: noteTargetAllYears ? theme.primary : theme.card,
                        borderColor: theme.border
                      }
                    ]}
                    onPress={() => setNoteTargetAllYears(!noteTargetAllYears)}
                  >
                    <Text style={{ color: noteTargetAllYears ? '#fff' : theme.text, fontWeight: 'bold', fontSize: 12 }}>
                      🎓 Target All Years (Years 1–5)
                    </Text>
                  </TouchableOpacity>
                </View>

                {!noteTargetAll && (
                  <>
                    <Text style={[styles.subLabel, { color: theme.accent }]}>Target Years</Text>
                    <AccessibleChipGroup
                      multi
                      options={['All Years', 1, 2, 3, 4, 5]}
                      selected={noteTargetAllYears ? ['All Years'] : noteYears}
                      onSelect={(arr) => {
                        if (arr.includes('All Years')) {
                          setNoteTargetAllYears(true);
                          setNoteYears([]);
                        } else {
                          setNoteTargetAllYears(false);
                          setNoteYears(arr.filter((y) => y !== 'All Years'));
                        }
                      }}
                      renderLabel={(y) => (y === 'All Years' ? '🌟 All Years' : `Year ${y}${y === 5 ? ' (ARCH/DS)' : ''}`)}
                    />

                    <Text style={[styles.subLabel, { color: theme.accent }]}>Target Departments</Text>
                    <AccessibleChipGroup
                      multi
                      options={['All', ...PROFILE_DEPARTMENTS]}
                      selected={noteDepts}
                      onSelect={(arr) => {
                        if (arr.includes('All') && !noteDepts.includes('All')) {
                          setNoteDepts(['All']);
                        } else if (noteDepts.includes('All') && arr.length > 1) {
                          setNoteDepts(arr.filter((d) => d !== 'All'));
                        } else {
                          setNoteDepts(arr);
                        }
                      }}
                      renderLabel={(d) => (d === 'All' ? '🌐 All Departments' : d)}
                    />

                    <Text style={[styles.subLabel, { color: theme.accent }]}>Target Tech Clubs</Text>
                    <AccessibleChipGroup multi options={EXTRACURRICULARS.tech} selected={noteTechClubs} onSelect={setNoteTechClubs} />

                    <Text style={[styles.subLabel, { color: theme.accent }]}>Target Non-Tech Clubs</Text>
                    <AccessibleChipGroup multi options={EXTRACURRICULARS.nonTech} selected={noteNonTechClubs} onSelect={setNoteNonTechClubs} />

                    <Text style={[styles.subLabel, { color: theme.accent }]}>Target Sports Teams</Text>
                    <AccessibleChipGroup multi options={EXTRACURRICULARS.sports} selected={noteSportsTeams} onSelect={setNoteSportsTeams} />

                    <Text style={[styles.subLabel, { color: theme.accent }]}>Target Cultural Associations (Shristi)</Text>
                    <AccessibleChipGroup multi options={EXTRACURRICULARS.cultural} selected={noteCulturalAssocs} onSelect={setNoteCulturalAssocs} />

                    <Text style={[styles.subLabel, { color: theme.accent }]}>Target Volunteering Groups</Text>
                    <AccessibleChipGroup multi options={EXTRACURRICULARS.volunteering} selected={noteVolunteeringGroups} onSelect={setNoteVolunteeringGroups} />
                  </>
                )}

                {/* LIVE NOTIFICATION RECIPIENT PREVIEW BANNER */}
                {(() => {
                  let audienceText = '';
                  if (noteTargetAll) {
                    audienceText = 'Entire Campus (All Departments, All Years & All Extracurricular Groups)';
                  } else {
                    const parts = [];

                    // Clubs / Groups
                    const selectedGroups = [
                      ...noteVolunteeringGroups,
                      ...noteTechClubs,
                      ...noteNonTechClubs,
                      ...noteSportsTeams,
                      ...noteCulturalAssocs
                    ];
                    if (selectedGroups.length > 0) {
                      parts.push(
                        selectedGroups.length <= 3
                          ? selectedGroups.join(', ')
                          : `${selectedGroups.slice(0, 3).join(', ')} +${selectedGroups.length - 3} more`
                      );
                    }

                    // Years
                    if (noteTargetAllYears || noteYears.includes('All Years') || noteYears.length === 0) {
                      parts.push('All Years');
                    } else {
                      parts.push(noteYears.map(y => `${y}${y === 1 ? 'st' : y === 2 ? 'nd' : y === 3 ? 'rd' : 'th'} Yr`).join(' & '));
                    }

                    // Departments
                    if (noteDepts.length > 0 && !noteDepts.includes('All')) {
                      parts.push(
                        noteDepts.length <= 3
                          ? noteDepts.join(', ')
                          : `${noteDepts.slice(0, 3).join(', ')} +${noteDepts.length - 3} more`
                      );
                    } else {
                      parts.push('All Departments');
                    }

                    audienceText = parts.join(' • ');
                  }

                  return (
                    <View
                      style={{
                        backgroundColor: 'rgba(56, 189, 248, 0.12)',
                        borderColor: '#0284c7',
                        borderWidth: 1.5,
                        borderRadius: 10,
                        padding: 10,
                        marginTop: 12,
                        marginBottom: 4
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                        <Text style={{ fontSize: 13, marginRight: 5 }}>🎯</Text>
                        <Text style={{ color: '#0284c7', fontWeight: 'bold', fontSize: 12 }}>
                          Live Recipient Audience Preview:
                        </Text>
                      </View>
                      <Text style={{ color: theme.text, fontSize: 12, fontWeight: '600', lineHeight: 16 }}>
                        {audienceText}
                      </Text>
                    </View>
                  );
                })()}

                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: theme.primary, marginTop: 10 }]}
                  onPress={async () => {
                    if (!noteTitle || !noteMsg) return;
                    const isAllYears = noteTargetAllYears || noteYears.includes('All Years');
                    const cleanYears = isAllYears ? [] : noteYears.filter((y) => y !== 'All Years').map(Number);
                    await axios.post(
                      `${BACKEND_URL}/api/notifications`,
                      {
                        title: noteTitle,
                        message: noteMsg,
                        targetAll: noteTargetAll,
                        targetAllYears: isAllYears,
                        targetYears: cleanYears,
                        targetDepartments: noteDepts,
                        targetTechClubs: noteTechClubs,
                        targetNonTechClubs: noteNonTechClubs,
                        targetSportsTeams: noteSportsTeams,
                        targetCulturalAssociations: noteCulturalAssocs,
                        targetVolunteeringGroups: noteVolunteeringGroups
                      },
                      apiHeader
                    );
                    await displaySystemNotification({
                      title: noteTitle,
                      body: noteMsg
                    });
                    setNoteTitle('');
                    setNoteMsg('');
                    fetchAllData();
                    Alert.alert(
                      'Dispatched!',
                      'Targeted notification sent to the campus feed and delivered directly to the phone notification bar outside the app.'
                    );
                  }}
                >
                  <Text style={styles.primaryBtnText}>Send Multi-Target Broadcast</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Test Notification in Phone's Notification Bar"
                  style={[styles.secondaryBtn, { borderColor: theme.accent, marginTop: 8 }]}
                  onPress={async () => {
                    await displaySystemNotification({
                      title: 'AURA System Test Alert',
                      body: 'Testing notification bar alert! Notifications are successfully delivered to your phone outside the app.'
                    });
                    Alert.alert('Alert Delivered', 'Check your phone’s notification bar at the top of your screen.');
                  }}
                >
                  <Text style={{ color: theme.accent, fontWeight: 'bold', fontSize: 12 }}>
                    🔔 Test Alert in Phone's Notification Bar
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {filteredNotifications.map((n) => (
              <View key={n._id} style={[styles.resourceCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <View style={[styles.triggerBanner, { backgroundColor: theme.primarySoft }]}>
                  <Text style={{ color: theme.accent, fontSize: 11, fontWeight: 'bold' }}>
                    🎯 Received via Trigger Path: {n.entryPathTriggers?.join('  •  ')}
                  </Text>
                </View>
                <Text style={[styles.cardTitle, { color: theme.text }]}>{n.title}</Text>
                <Text style={{ color: theme.textSecondary, fontSize: 13, marginVertical: 6 }}>{n.message}</Text>
                <Text style={{ color: theme.textMuted, fontSize: 11 }}>
                  Dispatched by {n.senderName} ({n.senderRole})
                </Text>
              </View>
            ))}
          </View>
        );

      case 'support': {
        if (user.role !== 'Admin') {
          return (
            <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.sectionHeader, { color: theme.danger }]}>🛡️ Access Restricted</Text>
              <Text style={{ color: theme.textSecondary, fontSize: 13, marginTop: 8 }}>
                The Support and Feedback Hub is strictly accessible to verified campus administrators.
              </Text>
            </View>
          );
        }

        const totalTickets = supportTickets.length;
        const openTickets = supportTickets.filter((t) => t.status === 'Open').length;
        const investigatingTickets = supportTickets.filter((t) => t.status === 'Investigating').length;
        const resolvedTickets = supportTickets.filter((t) => t.status === 'Resolved').length;

        const filteredTickets = supportTickets.filter((t) => {
          if (supportFilter !== 'All' && t.status !== supportFilter) return false;
          const q = (localSearch.support || '').toLowerCase();
          if (!q) return true;
          return (
            (t.title || '').toLowerCase().includes(q) ||
            (t.description || '').toLowerCase().includes(q) ||
            (t.reporterName || '').toLowerCase().includes(q) ||
            (t.category || '').toLowerCase().includes(q)
          );
        });

        return (
          <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.sectionHeader, { color: theme.text }]}>🛠️ Support and Feedback Hub</Text>
            <Text style={[styles.sectionSub, { color: theme.textMuted }]}>
              Triage user bug reports, review device diagnostics, inspect screenshot evidence, and resolve technical tickets.
            </Text>

            {/* METRIC COUNTERS */}
            <View style={{ flexDirection: 'row', gap: 8, marginVertical: 10 }}>
              <View style={[styles.statBox, { backgroundColor: theme.card, flex: 1, padding: 8 }]}>
                <Text style={{ color: theme.textMuted, fontSize: 10 }}>TOTAL</Text>
                <Text style={[styles.statValue, { color: theme.text, fontSize: 18 }]}>{totalTickets}</Text>
              </View>
              <View style={[styles.statBox, { backgroundColor: '#fef2f2', flex: 1, padding: 8 }]}>
                <Text style={{ color: '#991b1b', fontSize: 10, fontWeight: 'bold' }}>OPEN</Text>
                <Text style={[styles.statValue, { color: '#dc2626', fontSize: 18 }]}>{openTickets}</Text>
              </View>
              <View style={[styles.statBox, { backgroundColor: '#fefce8', flex: 1, padding: 8 }]}>
                <Text style={{ color: '#854d0e', fontSize: 10, fontWeight: 'bold' }}>INVESTIGATING</Text>
                <Text style={[styles.statValue, { color: '#ca8a04', fontSize: 18 }]}>{investigatingTickets}</Text>
              </View>
              <View style={[styles.statBox, { backgroundColor: '#f0fdf4', flex: 1, padding: 8 }]}>
                <Text style={{ color: '#166534', fontSize: 10, fontWeight: 'bold' }}>RESOLVED</Text>
                <Text style={[styles.statValue, { color: '#16a34a', fontSize: 18 }]}>{resolvedTickets}</Text>
              </View>
            </View>

            {/* STATUS FILTER CHIPS */}
            <AccessibleChipGroup
              options={['All', 'Open', 'Investigating', 'Resolved', 'Closed']}
              selected={supportFilter}
              onSelect={setSupportFilter}
            />

            <LocalizedSearchBar
              sectionLabel="Support Tickets"
              value={localSearch.support}
              onChange={(v) => updateLocalSearch('support', v)}
            />

            {/* TICKET LIST */}
            {filteredTickets.length === 0 ? (
              <View style={[styles.resourceCard, { backgroundColor: theme.card, borderColor: theme.border, padding: 24, alignItems: 'center', marginTop: 10 }]}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>🎉</Text>
                <Text style={{ color: theme.text, fontWeight: 'bold', fontSize: 15 }}>
                  No Bug Reports Found
                </Text>
                <Text style={{ color: theme.textMuted, fontSize: 12, textAlign: 'center', marginTop: 4 }}>
                  {supportFilter !== 'All' ? `No tickets under "${supportFilter}" status.` : 'No user-submitted bug reports.'}
                </Text>
              </View>
            ) : (
              filteredTickets.map((t) => {
                const isCritical = t.severity === 'Critical';
                const isHigh = t.severity === 'High';
                const isResolved = t.status === 'Resolved' || t.status === 'Closed';

                return (
                  <View
                    key={t._id}
                    style={[
                      styles.resourceCard,
                      { backgroundColor: theme.card, borderColor: isCritical ? '#ef4444' : theme.border, marginBottom: 12 }
                    ]}
                  >
                    <View style={styles.rowBetween}>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={[styles.cardTitle, { color: theme.text, fontSize: 15 }]}>
                          {t.title}
                        </Text>
                        <Text style={{ color: theme.textMuted, fontSize: 11, marginTop: 2 }}>
                          📌 Category: {t.category}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <View style={{
                          backgroundColor: isCritical ? '#fee2e2' : isHigh ? '#ffedd5' : '#e0f2fe',
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 6
                        }}>
                          <Text style={{
                            fontSize: 10,
                            fontWeight: 'bold',
                            color: isCritical ? '#991b1b' : isHigh ? '#9a3412' : '#0369a1'
                          }}>
                            {t.severity}
                          </Text>
                        </View>
                        <View style={{
                          backgroundColor: isResolved ? '#dcfce7' : t.status === 'Investigating' ? '#fef3c7' : '#fee2e2',
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 6
                        }}>
                          <Text style={{
                            fontSize: 10,
                            fontWeight: 'bold',
                            color: isResolved ? '#166534' : t.status === 'Investigating' ? '#92400e' : '#991b1b'
                          }}>
                            {t.status}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <Text style={{ color: theme.textSecondary, fontSize: 13, marginVertical: 6 }}>
                      {t.description}
                    </Text>

                    {/* REPORTER & TELEMETRY BOX */}
                    <View style={{ backgroundColor: theme.surface, padding: 8, borderRadius: 8, marginVertical: 6 }}>
                      <Text style={{ color: theme.textMuted, fontSize: 11 }}>
                        👤 Reported by: @{t.reporterUsername} ({t.reporterName}) • {t.reporterRole} ({t.reporterDepartment || 'All'})
                      </Text>
                      <Text style={{ color: theme.textMuted, fontSize: 11, marginTop: 2 }}>
                        📱 Device: {t.deviceInfo?.os} (v{t.deviceInfo?.osVersion}) • Screen: {t.deviceInfo?.screenDimensions} • App: {t.deviceInfo?.appVersion}
                      </Text>
                    </View>

                    {/* SCREENSHOT BUTTON IF PRESENT */}
                    {t.screenshotUrl && (
                      <TouchableOpacity
                        style={[
                          styles.previewBtn,
                          { borderColor: theme.accent, backgroundColor: theme.primarySoft, paddingVertical: 6, marginVertical: 4, alignItems: 'center' }
                        ]}
                        onPress={() => Linking.openURL(t.screenshotUrl).catch(() => Alert.alert('Error', 'Unable to open screenshot URL'))}
                      >
                        <Text style={{ color: theme.accent, fontWeight: 'bold', fontSize: 11 }}>
                          🖼️ View Attached Screenshot
                        </Text>
                      </TouchableOpacity>
                    )}

                    {t.adminNotes ? (
                      <View style={{ backgroundColor: '#f0fdf4', padding: 8, borderRadius: 6, marginVertical: 4 }}>
                        <Text style={{ color: '#166534', fontSize: 11 }}>
                          💬 Admin Resolution Note: {t.adminNotes} (Resolved by {t.resolvedBy || 'Admin'})
                        </Text>
                      </View>
                    ) : null}

                    {/* ACTION CONTROLS */}
                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                      {t.status === 'Open' && (
                        <TouchableOpacity
                          style={[styles.primaryBtn, { backgroundColor: '#f59e0b', flex: 1, paddingVertical: 8 }]}
                          onPress={() => handleUpdateTicketStatus(t._id, 'Investigating')}
                        >
                          <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>
                            🔍 Investigate
                          </Text>
                        </TouchableOpacity>
                      )}

                      {t.status !== 'Resolved' && (
                        <TouchableOpacity
                          style={[styles.primaryBtn, { backgroundColor: '#10b981', flex: 1, paddingVertical: 8 }]}
                          onPress={() => {
                            setActiveTicketModal(t);
                            setTicketAdminNotes(t.adminNotes || '');
                          }}
                        >
                          <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>
                            ✅ Resolve Ticket
                          </Text>
                        </TouchableOpacity>
                      )}

                      {t.status !== 'Closed' && (
                        <TouchableOpacity
                          style={[styles.previewBtn, { borderColor: theme.textMuted, paddingHorizontal: 12, paddingVertical: 8 }]}
                          onPress={() => handleUpdateTicketStatus(t._id, 'Closed')}
                        >
                          <Text style={{ color: theme.textMuted, fontSize: 11, fontWeight: 'bold' }}>
                            Close
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </View>
        );
      }

      case 'profile': {
        const profileConditionalYears = getConditionalYearOptions(editRole, editDept);
        return (
          <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.sectionHeader, { color: theme.text }]}>👤 9. Profile & Activity Stats</Text>
            <LocalizedSearchBar
              sectionLabel="Profile Clubs"
              value={localSearch.profile}
              onChange={(v) => updateLocalSearch('profile', v)}
            />

            {mainAdminBackup && (
              <View
                style={{
                  backgroundColor: '#fef3c7',
                  borderColor: '#f59e0b',
                  borderWidth: 1,
                  borderRadius: 10,
                  padding: 12,
                  marginBottom: 14
                }}
              >
                <Text style={{ color: '#92400e', fontWeight: 'bold', fontSize: 13, marginBottom: 4 }}>
                  🧪 Active POV Test Mode
                </Text>
                <Text style={{ color: '#78350f', fontSize: 12, lineHeight: 18, marginBottom: 8 }}>
                  You are viewing and testing this profile as {user.name} ({user.role} • {user.department}{user.year ? ` • Yr ${user.year}` : ''}).
                </Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Exit POV testing mode and return to Main Admin"
                  style={{
                    backgroundColor: '#0f172a',
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 6,
                    alignSelf: 'flex-start'
                  }}
                  onPress={handleSwitchBackToMainAdmin}
                >
                  <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>👑 Exit POV to Main Admin</Text>
                </TouchableOpacity>
              </View>
            )}

            {user.isPrimaryAdmin && (
              <View style={{ backgroundColor: 'rgba(217, 119, 6, 0.12)', borderColor: '#d97706', borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 12 }}>
                <Text style={{ color: '#d97706', fontWeight: 'bold', fontSize: 12 }}>
                  👑 Verified Main Administrator
                </Text>
                <Text style={{ color: theme.textMuted, fontSize: 11, marginTop: 2 }}>
                  Sole authority for account switching, perspective testing, and admin approvals.
                </Text>
              </View>
            )}

            {/* PLUS ULTRA ACADEMY STATUS & BADGES */}
            <View
              style={{
                backgroundColor: theme.surfaceElevated,
                borderRadius: 12,
                padding: 14,
                marginBottom: 14,
                borderWidth: 1.5,
                borderColor: '#f59e0b'
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#f59e0b' }}>
                    ⚡ Plus Ultra Academy Status
                  </Text>
                  <Text style={{ fontSize: 22, fontWeight: 'bold', color: theme.text, marginTop: 2 }}>
                    {currentUserPUPMeta?.points || user.plusUltraPoints || 0} PUP
                  </Text>
                </View>
                <View style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16 }}>
                  <Text style={{ color: '#d97706', fontWeight: 'bold', fontSize: 12 }}>
                    {(currentUserPUPMeta?.points || user.plusUltraPoints || 0) >= 300
                      ? '⭐ Elite Mentor'
                      : (currentUserPUPMeta?.points || user.plusUltraPoints || 0) >= 100
                      ? '🎖️ Active Scholar'
                      : '🌱 Aspirant'}
                  </Text>
                </View>
              </View>

              <Text style={{ color: theme.textMuted, fontSize: 11, marginTop: 6 }}>
                Campus Rank: #{currentUserPUPMeta?.rank || 1} • Earn points via accepted Q&A solutions & verified contributions.
              </Text>

              {user.badges && user.badges.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                  {user.badges.map((b) => (
                    <View
                      key={b}
                      style={{
                        backgroundColor: theme.card,
                        borderWidth: 1,
                        borderColor: '#f59e0b',
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 12
                      }}
                    >
                      <Text style={{ color: theme.accent, fontSize: 11, fontWeight: '600' }}>🏆 {b}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {profileStats && (
              <View style={styles.statsGrid}>
                <View style={[styles.statBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <Text style={[styles.statNumber, { color: theme.primary }]}>{profileStats.uploadsCount}</Text>
                  <Text style={{ color: theme.textMuted, fontSize: 10 }}>Uploads</Text>
                </View>
                <View style={[styles.statBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <Text style={[styles.statNumber, { color: theme.success }]}>{profileStats.verifiedUploadsCount}</Text>
                  <Text style={{ color: theme.textMuted, fontSize: 10 }}>Verified</Text>
                </View>
                <View style={[styles.statBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <Text style={[styles.statNumber, { color: theme.accent }]}>{profileStats.questionsAsked}</Text>
                  <Text style={{ color: theme.textMuted, fontSize: 10 }}>Q&As</Text>
                </View>
                <View style={[styles.statBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <Text style={[styles.statNumber, { color: '#facc15' }]}>{profileStats.guidesCount}</Text>
                  <Text style={{ color: theme.textMuted, fontSize: 10 }}>Guides</Text>
                </View>
              </View>
            )}

            <Text style={[styles.subLabel, { color: theme.accent }]}>Full Name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
              value={editName}
              onChangeText={setEditName}
            />

            {editRole === 'Admin' ? (
              <View
                style={{
                  backgroundColor: theme.primarySoft,
                  borderColor: theme.accent,
                  borderWidth: 1,
                  borderRadius: 10,
                  padding: 12,
                  marginVertical: 12
                }}
              >
                <Text style={{ color: theme.accent, fontWeight: 'bold', fontSize: 13, marginBottom: 4 }}>
                  🛡️ Administrator Account
                </Text>
                <Text style={{ color: theme.textSecondary, fontSize: 12, lineHeight: 18 }}>
                  Root administrative account. Department and extracurricular clubs are not applicable to the administrator role.
                </Text>
              </View>
            ) : (
              <>
                <Text style={[styles.subLabel, { color: theme.accent }]}>
                  Academic Department ("All" Prohibited)
                </Text>
                <AccessibleChipGroup
                  options={PROFILE_DEPARTMENTS}
                  selected={editDept}
                  onSelect={(d) => {
                    setEditDept(d);
                    // Enforce strict 5th Year reset if switching away from ARCH or DS
                    if (!FIFTH_YEAR_DEPTS.includes(d) && editYear === 5) {
                      setEditYear(4);
                    }
                  }}
                />

                {['Student', 'Senior Student'].includes(editRole) && (
                  <>
                    <Text style={[styles.subLabel, { color: theme.accent }]}>
                      Academic Year{' '}
                      {FIFTH_YEAR_DEPTS.includes(editDept) && editRole === 'Senior Student'
                        ? '(5-Year Curriculum • Years 1–5, Sem 1–10)'
                        : '(4-Year Curriculum • Years 1–4, Sem 1–8)'}
                    </Text>
                    <AccessibleChipGroup
                      options={profileConditionalYears}
                      selected={editYear}
                      onSelect={setEditYear}
                      renderLabel={(yr) => `${yr}${yr === 1 ? 'st' : yr === 2 ? 'nd' : yr === 3 ? 'rd' : 'th'} Year`}
                    />
                  </>
                )}

                <Text style={[styles.subLabel, { color: theme.accent, marginTop: 14 }]}>
                  Update Extracurricular Club Memberships {editRole === 'Faculty' ? '(Sports Restricted for Faculty)' : ''}
                </Text>
                {Object.entries(EXTRACURRICULARS)
                  .filter(([catKey]) => editRole !== 'Faculty' || catKey !== 'sports')
                  .map(([catKey, clubList]) => {
                  const filteredClubs = clubList.filter(
                    (c) => !localSearch.profile || c.toLowerCase().includes(localSearch.profile.toLowerCase())
                  );
                  return (
                    <View key={catKey} style={{ marginBottom: 8 }}>
                      <Text style={{ color: theme.textSecondary, fontSize: 11, fontWeight: 'bold', marginBottom: 4 }}>
                        {catKey.toUpperCase()}
                      </Text>
                      <AccessibleChipGroup
                        multi
                        options={filteredClubs}
                        selected={editClubs[catKey] || []}
                        onSelect={(arr) => setEditClubs({ ...editClubs, [catKey]: arr })}
                      />
                    </View>
                  );
                })}
              </>
            )}

            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: theme.primary, marginTop: 12 }]}
              onPress={async () => {
                try {
                  const res = await axios.put(
                    `${BACKEND_URL}/api/profile`,
                    {
                      name: editName,
                      role: editRole,
                      department: editRole === 'Admin' ? 'Administration' : editDept,
                      year: ['Student', 'Senior Student'].includes(editRole) ? editYear : null,
                      facultyRole: editRole === 'Faculty' ? editFacultyRole : null,
                      clubs: editRole === 'Admin' ? { tech: [], nonTech: [], sports: [], cultural: [], volunteering: [] } : editClubs
                    },
                    apiHeader
                  );
                  setUser(res.data);
                  await AsyncStorage.setItem('@aura_user', JSON.stringify(res.data));
                  fetchAllData();
                  Alert.alert('Saved', 'Profile and extracurricular memberships updated!');
                } catch (err) {
                  Alert.alert('Error', err.response?.data?.error || err.message);
                }
              }}
            >
              <Text style={styles.primaryBtnText}>Save Profile Changes</Text>
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Check for Over-The-Air Updates"
              style={[
                styles.secondaryBtn,
                {
                  borderColor: theme.accent,
                  marginTop: 10,
                  backgroundColor: theme.primarySoft
                }
              ]}
              onPress={handleCheckForUpdates}
            >
              <Text style={{ color: theme.accent, fontWeight: 'bold', fontSize: 13 }}>
                🔄 Check for Over-The-Air (OTA) Updates
              </Text>
            </TouchableOpacity>
          </View>
        );
      }

      case 'help': {
        if (user.role === 'Admin') {
          return (
            <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.sectionHeader, { color: theme.accent }]}>🛠️ Admin View</Text>
              <Text style={{ color: theme.textSecondary, fontSize: 13, marginTop: 8 }}>
                Administrators manage bug reports and user assistance tickets in the dedicated "Support and Feedback Hub" tab.
              </Text>
            </View>
          );
        }

        return (
          <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.sectionHeader, { color: theme.text }]}>🆘 Help & Bug Report</Text>
            <Text style={[styles.sectionSub, { color: theme.textMuted }]}>
              Report technical glitches, app crashes, or request assistance. Diagnostics and device telemetry are automatically attached.
            </Text>

            {helpSuccess && (
              <View style={[styles.triggerBanner, { backgroundColor: '#dcfce7', borderColor: '#16a34a', borderWidth: 1, marginBottom: 12 }]}>
                <Text style={{ color: '#166534', fontWeight: 'bold', fontSize: 12 }}>
                  ✅ Bug Report Submitted Successfully! Our engineering team will review the diagnostics and address the issue.
                </Text>
              </View>
            )}

            {/* PRESET BUG CATEGORY SELECTION */}
            <Text style={[styles.label, { color: theme.text }]}>1. Select Bug Category *</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 6 }}>
              {BUG_CATEGORIES.map((cat) => {
                const isSelected = helpCategory === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: isSelected ? theme.primary : theme.card,
                        borderColor: isSelected ? theme.accent : theme.border,
                        paddingHorizontal: 12,
                        paddingVertical: 7
                      }
                    ]}
                    onPress={() => setHelpCategory(cat)}
                  >
                    <Text style={{ color: isSelected ? '#fff' : theme.textSecondary, fontWeight: isSelected ? '700' : '500', fontSize: 12 }}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* SEVERITY LEVEL */}
            <Text style={[styles.label, { color: theme.text, marginTop: 10 }]}>2. Severity Level</Text>
            <AccessibleChipGroup
              options={BUG_SEVERITIES}
              selected={helpSeverity}
              onSelect={setHelpSeverity}
            />

            {/* BUG TITLE */}
            <Text style={[styles.label, { color: theme.text, marginTop: 10 }]}>3. Bug Summary Title *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
              placeholder="e.g. App crashed when opening 3rd year syllabus PDF..."
              placeholderTextColor={theme.textMuted}
              value={helpTitle}
              onChangeText={setHelpTitle}
            />

            {/* BUG DESCRIPTION */}
            <Text style={[styles.label, { color: theme.text }]}>4. Detailed Description & Reproduction Steps *</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.card,
                  color: theme.text,
                  borderColor: theme.border,
                  height: 100,
                  textAlignVertical: 'top'
                }
              ]}
              placeholder="Explain what you were doing, what went wrong, and any error message shown..."
              placeholderTextColor={theme.textMuted}
              value={helpDescription}
              onChangeText={setHelpDescription}
              multiline
            />

            {/* OPTIONAL SCREENSHOT ATTACHMENT */}
            <Text style={[styles.label, { color: theme.text }]}>5. Screenshot Attachment (Optional)</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 6 }}>
              <TouchableOpacity
                style={[
                  styles.previewBtn,
                  { borderColor: theme.accent, backgroundColor: theme.primarySoft, paddingHorizontal: 14, paddingVertical: 9 }
                ]}
                onPress={handlePickScreenshot}
              >
                <Text style={{ color: theme.accent, fontWeight: 'bold', fontSize: 12 }}>
                  📸 {helpScreenshot ? 'Change Screenshot' : 'Attach Screenshot'}
                </Text>
              </TouchableOpacity>

              {helpScreenshot && (
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <Text style={{ color: theme.text, fontSize: 11, flex: 1 }} numberOfLines={1}>
                    📎 {helpScreenshot.name}
                  </Text>
                  <TouchableOpacity onPress={() => setHelpScreenshot(null)} style={{ padding: 4 }}>
                    <Text style={{ color: theme.danger, fontWeight: 'bold' }}>✕</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* AUTOMATICALLY CAPTURED DEVICE DIAGNOSTICS CARD */}
            <View style={{ backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1, borderRadius: 8, padding: 10, marginVertical: 12 }}>
              <Text style={{ color: theme.accent, fontSize: 11, fontWeight: 'bold', marginBottom: 4 }}>
                🔍 Telemetry & Device Diagnostics (Auto-Captured):
              </Text>
              <Text style={{ color: theme.textSecondary, fontSize: 11 }}>
                • OS: {Platform.OS} (Version: {String(Platform.Version)}){'\n'}
                • App Version: 2.0.0 (Expo SDK 58){'\n'}
                • Screen Dimensions: {Math.round(width)} x {Math.round(height)} pt{'\n'}
                • Account: @{user.username} ({user.role} • {user.department || 'Administration'})
              </Text>
            </View>

            {/* SUBMIT BUTTON */}
            <TouchableOpacity
              style={[
                styles.primaryBtn,
                { backgroundColor: theme.primary, marginTop: 4 }
              ]}
              onPress={handleSubmitBugReport}
              disabled={helpSubmitting}
            >
              {helpSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>
                  📤 Submit Bug Report & Diagnostics
                </Text>
              )}
            </TouchableOpacity>
          </View>
        );
      }

      case 'approvals': {
        if (!user.isPrimaryAdmin) {
          return (
            <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.sectionHeader, { color: theme.danger }]}>🛡️ Access Restricted</Text>
              <Text style={{ color: theme.textSecondary, fontSize: 13, marginTop: 8 }}>
                Only the designated Primary Administrator is authorized to view and manage account approvals.
              </Text>
            </View>
          );
        }

        const pendingAdmins = adminUsers.filter((u) => u.role === 'Admin' && !u.isApproved);
        const filteredUsers = adminUsers.filter((u) => {
          if (!localSearch.approvals) return true;
          const q = localSearch.approvals.toLowerCase();
          return (
            (u.name || '').toLowerCase().includes(q) ||
            (u.username || '').toLowerCase().includes(q) ||
            (u.role || '').toLowerCase().includes(q) ||
            (u.department || '').toLowerCase().includes(q)
          );
        });

        return (
          <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <Text style={{ fontSize: 24, marginRight: 8 }}>🛡️</Text>
              <View>
                <Text style={[styles.sectionHeader, { color: theme.text, marginBottom: 0 }]}>
                  10. Account Approvals & Administration
                </Text>
                <Text style={{ color: theme.textMuted, fontSize: 12 }}>
                  Primary Admin Command Center • Authorize secondary admins & manage accounts
                </Text>
              </View>
            </View>

            <View
              style={{
                backgroundColor: 'rgba(217, 119, 6, 0.12)',
                borderColor: '#d97706',
                borderWidth: 1,
                borderRadius: 10,
                padding: 12,
                marginVertical: 12
              }}
            >
              <Text style={{ color: '#d97706', fontWeight: 'bold', fontSize: 13 }}>
                👑 Verified Primary Administrator: @{user.username}
              </Text>
              <Text style={{ color: theme.textSecondary, fontSize: 11, marginTop: 3, lineHeight: 16 }}>
                You alone have sole authority to authorize new Admin accounts, reject unapproved registrations, and switch into any user's POV.
              </Text>
            </View>

            {/* SUB-TAB SELECTOR: ADMIN APPROVALS vs PROMOTE ACADEMIC YEAR */}
            <View style={{ flexDirection: 'row', backgroundColor: theme.surfaceElevated, borderRadius: 10, padding: 4, marginVertical: 12 }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  borderRadius: 8,
                  backgroundColor: approvalsSubTab === 'admins' ? theme.primary : 'transparent',
                  alignItems: 'center'
                }}
                onPress={() => setApprovalsSubTab('admins')}
              >
                <Text style={{ color: approvalsSubTab === 'admins' ? '#fff' : theme.text, fontWeight: '700', fontSize: 13 }}>
                  🛡️ Admin Approvals ({pendingAdmins.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  borderRadius: 8,
                  backgroundColor: approvalsSubTab === 'promotion' ? theme.primary : 'transparent',
                  alignItems: 'center'
                }}
                onPress={() => {
                  setApprovalsSubTab('promotion');
                  fetchCohortStats();
                }}
              >
                <Text style={{ color: approvalsSubTab === 'promotion' ? '#fff' : theme.text, fontWeight: '700', fontSize: 13 }}>
                  🎓 Promote Academic Year
                </Text>
              </TouchableOpacity>
            </View>

            {approvalsSubTab === 'promotion' ? (
              <View style={[styles.formBox, { backgroundColor: theme.surfaceElevated, marginBottom: 16 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={{ fontSize: 22, marginRight: 8 }}>🎓</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: 'bold', color: theme.text }}>
                      Batch Cohort Academic Year Promotion
                    </Text>
                    <Text style={{ fontSize: 11, color: theme.textMuted }}>
                      Independent triggers per cohort. Batches start on different dates; promote when term concludes.
                    </Text>
                  </View>
                </View>

                {/* Cohort Stats Summary */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 10 }}>
                  <View style={[styles.statBox, { backgroundColor: theme.card, flex: 1, minWidth: '45%', padding: 8 }]}>
                    <Text style={{ color: theme.textMuted, fontSize: 10 }}>1ST YEAR ACTIVE</Text>
                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.text }}>{cohortStats?.cohort1 ?? '...'}</Text>
                  </View>
                  <View style={[styles.statBox, { backgroundColor: theme.card, flex: 1, minWidth: '45%', padding: 8 }]}>
                    <Text style={{ color: theme.textMuted, fontSize: 10 }}>2ND YEAR ACTIVE</Text>
                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.text }}>{cohortStats?.cohort2 ?? '...'}</Text>
                  </View>
                  <View style={[styles.statBox, { backgroundColor: theme.card, flex: 1, minWidth: '45%', padding: 8 }]}>
                    <Text style={{ color: theme.textMuted, fontSize: 10 }}>3RD YEAR ACTIVE</Text>
                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.text }}>{cohortStats?.cohort3 ?? '...'}</Text>
                  </View>
                  <View style={[styles.statBox, { backgroundColor: theme.card, flex: 1, minWidth: '45%', padding: 8 }]}>
                    <Text style={{ color: theme.textMuted, fontSize: 10 }}>4TH YEAR ACTIVE</Text>
                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.text }}>
                      {cohortStats?.cohort4Total ?? '...'} ({cohortStats?.cohort4ArchDs ?? 0} ARCH/DS)
                    </Text>
                  </View>
                  <View style={[styles.statBox, { backgroundColor: theme.card, flex: 1, minWidth: '45%', padding: 8 }]}>
                    <Text style={{ color: theme.textMuted, fontSize: 10 }}>5TH YEAR (ARCH & DS)</Text>
                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.accent }}>{cohortStats?.cohort5 ?? '...'}</Text>
                  </View>
                  <View style={[styles.statBox, { backgroundColor: theme.card, flex: 1, minWidth: '45%', padding: 8 }]}>
                    <Text style={{ color: theme.textMuted, fontSize: 10 }}>GRADUATED ALUMNI</Text>
                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.success }}>{cohortStats?.alumni ?? '...'}</Text>
                  </View>
                </View>

                {/* INDIVIDUAL COHORT PROMOTION CARDS */}
                {[
                  {
                    cohort: 1,
                    title: 'Cohort 1: 1st Year ➔ 2nd Year',
                    desc: 'Promotes all active 1st-year students to 2nd-year academic standing.',
                    count: cohortStats?.cohort1 ?? 0,
                    btnLabel: 'Promote 1st Year ➔ 2nd Year'
                  },
                  {
                    cohort: 2,
                    title: 'Cohort 2: 2nd Year ➔ 3rd Year (Auto Senior Upgrade)',
                    desc: 'Promotes 2nd-year students to 3rd Year and auto-upgrades their role to "Senior Student" (enabling student mentoring & document verification privileges).',
                    count: cohortStats?.cohort2 ?? 0,
                    btnLabel: 'Promote 2nd Year ➔ 3rd Year (+ Senior Role)'
                  },
                  {
                    cohort: 3,
                    title: 'Cohort 3: 3rd Year ➔ 4th Year',
                    desc: 'Promotes all current 3rd-year students to final 4th-year status.',
                    count: cohortStats?.cohort3 ?? 0,
                    btnLabel: 'Promote 3rd Year ➔ 4th Year'
                  },
                  {
                    cohort: 4,
                    title: 'Cohort 4: 4th Year ➔ 5th Year (ARCH & DS) or Graduate',
                    desc: 'Strictly 5-Year Degree programs (Architecture & Data Science) advance to 5th Year. All other standard 4-year department students graduate to Alumni.',
                    count: cohortStats?.cohort4Total ?? 0,
                    btnLabel: 'Process 4th Year Batch'
                  },
                  {
                    cohort: 5,
                    title: 'Cohort 5: 5th Year ARCH & DS ➔ Graduate',
                    desc: 'Graduates final 5th-year ARCH and DS students and archives accounts to verified Alumni status.',
                    count: cohortStats?.cohort5 ?? 0,
                    btnLabel: 'Graduate 5th Year (ARCH/DS) ➔ Alumni'
                  }
                ].map((item) => (
                  <View
                    key={item.cohort}
                    style={{
                      backgroundColor: theme.card,
                      borderWidth: 1,
                      borderColor: theme.border,
                      borderRadius: 10,
                      padding: 12,
                      marginBottom: 10
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: 'bold', color: theme.text }}>
                      {item.title}
                    </Text>
                    <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 3, lineHeight: 16 }}>
                      {item.desc}
                    </Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                      <Text style={{ fontSize: 11, fontWeight: 'bold', color: theme.accent }}>
                        Cohort Size: {item.count} student(s)
                      </Text>
                      <TouchableOpacity
                        style={[styles.smallBadgeBtn, { backgroundColor: theme.primary, minWidth: 140 }]}
                        onPress={() => handlePromoteCohort(item.cohort)}
                        disabled={promotingCohort === item.cohort}
                      >
                        {promotingCohort === item.cohort ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>
                            {item.btnLabel}
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <>
            {/* PENDING ADMIN APPROVALS QUEUE */}
            <View style={[styles.formBox, { backgroundColor: theme.surfaceElevated, marginBottom: 16 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={[styles.subLabel, { color: theme.accent, fontSize: 13, marginTop: 0, marginBottom: 0 }]}>
                  ⏳ Pending Administrator Approvals ({pendingAdmins.length})
                </Text>
                {pendingAdmins.length > 0 && (
                  <View style={{ backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 }}>
                    <Text style={{ color: '#b45309', fontSize: 11, fontWeight: 'bold' }}>Action Required</Text>
                  </View>
                )}
              </View>

              {pendingAdmins.length === 0 ? (
                <Text style={{ color: theme.textMuted, fontSize: 12, paddingVertical: 8, fontStyle: 'italic' }}>
                  ✓ No pending approvals. All registered administrators are currently approved.
                </Text>
              ) : (
                pendingAdmins.map((pAdmin) => (
                  <View
                    key={pAdmin._id}
                    style={{
                      backgroundColor: theme.card,
                      borderColor: '#f59e0b',
                      borderWidth: 1,
                      borderRadius: 10,
                      padding: 12,
                      marginBottom: 10
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <Text style={{ color: theme.text, fontWeight: 'bold', fontSize: 13 }}>
                        {pAdmin.name} (@{pAdmin.username})
                      </Text>
                      <View style={{ backgroundColor: '#fef3c7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                        <Text style={{ color: '#92400e', fontSize: 10, fontWeight: 'bold' }}>Pending Approval</Text>
                      </View>
                    </View>
                    <Text style={{ color: theme.textMuted, fontSize: 11, marginBottom: 10 }}>
                      Registered: {new Date(pAdmin.createdAt).toLocaleString()} • Dept: {pAdmin.department || 'Administration'}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity
                        accessibilityRole="button"
                        style={[styles.smallBadgeBtn, { backgroundColor: theme.success, flex: 1, minHeight: 38 }]}
                        onPress={async () => {
                          try {
                            await axios.patch(
                              `${BACKEND_URL}/api/admin/users/${pAdmin._id}/approve`,
                              { isApproved: true },
                              apiHeader
                            );
                            fetchAllData();
                            Alert.alert('Approved', `Admin account @${pAdmin.username} is now approved and can sign in!`);
                          } catch (err) {
                            Alert.alert('Error', err.response?.data?.error || err.message);
                          }
                        }}
                      >
                        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>
                          ✅ Approve Administrator
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        accessibilityRole="button"
                        style={[styles.smallBadgeBtn, { backgroundColor: theme.danger, flex: 1, minHeight: 38 }]}
                        onPress={async () => {
                          try {
                            await axios.delete(
                              `${BACKEND_URL}/api/admin/users/${pAdmin._id}`,
                              apiHeader
                            );
                            fetchAllData();
                            Alert.alert('Rejected', `Admin registration @${pAdmin.username} was rejected and deleted.`);
                          } catch (err) {
                            Alert.alert('Error', err.response?.data?.error || err.message);
                          }
                        }}
                      >
                        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>
                          ❌ Reject & Delete
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>

            {/* ALL SYSTEM ACCOUNTS & FULL POV TESTING DIRECTORY */}
            <View style={[styles.formBox, { backgroundColor: theme.surfaceElevated }]}>
              <Text style={[styles.subLabel, { color: theme.accent, fontSize: 13, marginBottom: 4 }]}>
                👥 All System Accounts & User POV Directory ({adminUsers.length})
              </Text>
              <Text style={{ color: theme.textMuted, fontSize: 11, marginBottom: 10 }}>
                As Primary Admin, tap "👁️ POV Test" on any account below to inspect the app directly through their exact perspective.
              </Text>

              <LocalizedSearchBar
                sectionLabel="Search Accounts"
                value={localSearch.approvals}
                onChange={(v) => updateLocalSearch('approvals', v)}
              />

              {filteredUsers.length === 0 ? (
                <Text style={{ color: theme.textMuted, fontSize: 12, paddingVertical: 8, fontStyle: 'italic' }}>
                  No accounts found matching search.
                </Text>
              ) : (
                filteredUsers.map((u) => {
                  const isSelf = String(u._id) === String(user._id);
                  return (
                    <View
                      key={u._id}
                      style={[
                        styles.rowBetween,
                        {
                          paddingVertical: 10,
                          borderBottomWidth: 1,
                          borderBottomColor: theme.border
                        }
                      ]}
                    >
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={{ color: theme.text, fontSize: 12, fontWeight: '700' }}>
                          {u.name} (@{u.username}) {isSelf ? '👑 [You - Primary Admin]' : (u.isPrimaryAdmin ? '👑 [Primary Admin]' : (u.role === 'Admin' ? '🛡️ [Admin]' : ''))}
                        </Text>
                        <Text style={{ color: theme.textMuted, fontSize: 11 }}>
                          Role: {u.role} {u.year ? `• Year ${u.year}` : ''} • Dept: {u.department || 'Administration'}
                          {u.role === 'Admin' && !u.isApproved ? ' • ⚠️ [Pending Approval]' : ''}
                        </Text>
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        {!isSelf && (
                          <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel={`Test perspective of ${u.name}`}
                            style={[styles.smallBadgeBtn, { backgroundColor: '#0284c7' }]}
                            onPress={() => handleSwitchAccount(u._id, u.name)}
                          >
                            <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>👁️ POV Test</Text>
                          </TouchableOpacity>
                        )}

                        {!isSelf && u.role === 'Admin' && (
                          <TouchableOpacity
                            style={[
                              styles.smallBadgeBtn,
                              { backgroundColor: u.isApproved ? theme.warning : theme.success }
                            ]}
                            onPress={async () => {
                              try {
                                await axios.patch(
                                  `${BACKEND_URL}/api/admin/users/${u._id}/approve`,
                                  { isApproved: !u.isApproved },
                                  apiHeader
                                );
                                fetchAllData();
                              } catch (err) {
                                Alert.alert('Approval Error', err.response?.data?.error || err.message);
                              }
                            }}
                          >
                            <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>
                              {u.isApproved ? 'Revoke' : 'Approve'}
                            </Text>
                          </TouchableOpacity>
                        )}

                        {!isSelf && (
                          <TouchableOpacity
                            style={[styles.smallBadgeBtn, { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderWidth: 1, borderColor: theme.danger }]}
                            onPress={() => {
                              Alert.alert(
                                'Delete User',
                                `Are you sure you want to delete @${u.username}?`,
                                [
                                  { text: 'Cancel', style: 'cancel' },
                                  {
                                    text: 'Delete',
                                    style: 'destructive',
                                    onPress: async () => {
                                      try {
                                        await axios.delete(`${BACKEND_URL}/api/admin/users/${u._id}`, apiHeader);
                                        fetchAllData();
                                        Alert.alert('Deleted', `Account @${u.username} removed.`);
                                      } catch (err) {
                                        Alert.alert('Error', err.response?.data?.error || err.message);
                                      }
                                    }
                                  }
                                ]
                              );
                            }}
                          >
                            <Text style={{ color: theme.danger, fontSize: 11, fontWeight: 'bold' }}>Delete</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </>
        )}
      </View>
    );
  }

      default:
        return null;
    }
  };

  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: theme.bg,
          paddingTop: topInset,
          paddingBottom: bottomInset
        }
      ]}
      {...panResponder.panHandlers}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} translucent />
      {/* PERSISTENT MAIN ADMIN POV TESTING BANNER */}
      {mainAdminBackup && (
        <View style={[styles.povBanner, { backgroundColor: '#f59e0b', borderBottomColor: '#d97706' }]}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 13, marginRight: 4 }}>🧪</Text>
              <Text style={styles.povBadgeText}>POV TEST MODE</Text>
            </View>
            <Text style={styles.povTitleText} numberOfLines={1}>
              {user?.name} ({user?.role}{user?.year ? ` • Yr ${user?.year}` : ''} • {user?.department})
            </Text>
            <Text style={styles.povSubText} numberOfLines={1}>
              Previewing user experience. Original Admin: {mainAdminBackup.user?.name}
            </Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Exit POV testing mode and return to Main Admin"
            style={styles.povExitBtn}
            onPress={handleSwitchBackToMainAdmin}
          >
            <Text style={styles.povExitBtnText}>👑 Exit POV</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* MOBILE-FIRST TOP BAR (Shown when Sticky Sidebar is hidden on smaller viewports) */}
      {!isLargeScreen && (
        <View style={[styles.mobileTopBar, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Open Off-Canvas Navigation Drawer"
            style={[styles.hamburgerBtn, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
            onPress={() => setOffCanvasVisible(true)}
          >
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: 'bold' }}>☰</Text>
          </TouchableOpacity>

          <View style={{ flex: 1, marginHorizontal: 12 }}>
            <Text style={{ color: theme.primary, fontWeight: '900', fontSize: 16 }}>
              AURA • {currentTabMeta.shortLabel}
            </Text>
            <Text style={{ color: theme.textMuted, fontSize: 11 }} numberOfLines={1}>
              {user.department} {user.year ? `• Year ${user.year}` : ''} ({user.role})
            </Text>
          </View>

          <TouchableOpacity
            accessibilityRole="switch"
            accessibilityLabel="Toggle Dark or Light Theme"
            style={[styles.hamburgerBtn, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
            onPress={toggleTheme}
          >
            <Text style={{ fontSize: 16 }}>{isDark ? '☀️' : '🌙'}</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.mainLayout}>
        {/* ADAPTIVE STICKY SIDEBAR + OFF-CANVAS MODAL DRAWER */}
        <AdaptiveNavigation
          isLargeScreen={isLargeScreen}
          sidebarExpanded={sidebarExpanded}
          setSidebarExpanded={setSidebarExpanded}
          offCanvasVisible={offCanvasVisible}
          setOffCanvasVisible={setOffCanvasVisible}
          activeTabKey={activeTabKey}
          onSelectTab={handleSelectNavigationTab}
          user={user}
          mainAdminBackup={mainAdminBackup}
          onExitPOV={handleSwitchBackToMainAdmin}
        />

        {/* ANIMATED MAIN VIEWPORT */}
        <ScrollView
          style={{ flex: 1, backgroundColor: theme.bg }}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        >
          <Animated.View
            style={{
              opacity: tabFadeAnim,
              transform: [{ translateY: tabSlideAnim }]
            }}
          >
            {renderActiveTabContent()}
          </Animated.View>
        </ScrollView>
      </View>

      {/* IN-APP PDF READER */}
      <InAppPdfReader
        visible={pdfModal.visible}
        pdfUrl={pdfModal.url}
        title={pdfModal.title}
        onClose={() => setPdfModal({ visible: false, url: '', title: '' })}
      />

      {/* 1-TAP REVIEW & HIRING APPROVAL MODAL */}
      {reviewJobModal && (
        <Modal
          visible={true}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setReviewJobModal(null)}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
            <View style={{ backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1, borderRadius: 14, padding: 18, width: '100%', maxWidth: 520, maxHeight: '90%' }}>
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.rowBetween}>
                  <Text style={[styles.cardTitle, { color: theme.text, fontSize: 17 }]}>
                    ⚡ 1-Tap Opportunity Review
                  </Text>
                  <TouchableOpacity onPress={() => setReviewJobModal(null)} style={{ padding: 4 }}>
                    <Text style={{ color: theme.textMuted, fontSize: 16, fontWeight: 'bold' }}>✕</Text>
                  </TouchableOpacity>
                </View>

                <Text style={{ color: theme.accent, fontSize: 13, fontWeight: 'bold', marginTop: 4 }}>
                  🏢 {reviewJobModal.company} • {reviewJobModal.role} ({reviewJobModal.jobType})
                </Text>
                <Text style={{ color: theme.textMuted, fontSize: 11, marginTop: 2 }}>
                  📍 {reviewJobModal.location} • 💰 {reviewJobModal.stipendOrSalary}
                </Text>

                <View style={{ backgroundColor: theme.surface, padding: 10, borderRadius: 8, marginVertical: 10 }}>
                  <Text style={{ color: theme.textSecondary, fontSize: 12, lineHeight: 18 }}>
                    {reviewJobModal.description}
                  </Text>
                </View>

                {/* TARGET DEPARTMENTS TO APPROVE */}
                <Text style={[styles.label, { color: theme.text, marginTop: 4 }]}>
                  {user.role === 'Admin' ? '👑 Admin Override: Select Departments to Approve & Broadcast:' : `Department Approval: ${user.placementDepartment || user.department}`}
                </Text>
                {user.role === 'Admin' ? (
                  <>
                    <View style={{ flexDirection: 'row', gap: 8, marginVertical: 6 }}>
                      <TouchableOpacity
                        style={[styles.chip, { backgroundColor: theme.primarySoft, borderColor: theme.accent }]}
                        onPress={() => setReviewSelectedDepts([...reviewJobModal.targetDepartments])}
                      >
                        <Text style={{ color: theme.accent, fontSize: 11, fontWeight: 'bold' }}>Select All Eligible</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.chip, { backgroundColor: theme.surface, borderColor: theme.border }]}
                        onPress={() => setReviewSelectedDepts([])}
                      >
                        <Text style={{ color: theme.textMuted, fontSize: 11 }}>Clear</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 6 }}>
                      {(reviewJobModal.targetDepartments || []).map((dept) => {
                        const isSelected = reviewSelectedDepts.includes(dept);
                        return (
                          <TouchableOpacity
                            key={dept}
                            style={[
                              styles.chip,
                              {
                                backgroundColor: isSelected ? theme.primary : theme.surface,
                                borderColor: isSelected ? theme.accent : theme.border,
                                paddingHorizontal: 10,
                                paddingVertical: 6
                              }
                            ]}
                            onPress={() => {
                              if (isSelected) {
                                setReviewSelectedDepts(reviewSelectedDepts.filter((d) => d !== dept));
                              } else {
                                setReviewSelectedDepts([...reviewSelectedDepts, dept]);
                              }
                            }}
                          >
                            <Text style={{ color: isSelected ? '#fff' : theme.textSecondary, fontWeight: 'bold', fontSize: 11 }}>
                              {dept} {isSelected ? '✓' : ''}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </>
                ) : (
                  <View style={{ backgroundColor: theme.primarySoft, padding: 8, borderRadius: 6, marginVertical: 6 }}>
                    <Text style={{ color: theme.accent, fontWeight: 'bold', fontSize: 12 }}>
                      Department: {user.placementDepartment || user.department} (Your In-Charge Area)
                    </Text>
                  </View>
                )}

                {/* TARGET YEAR COHORTS (Editable, 3 & 4 default, 5 for ARCH/DS, 1 & 2 optional) */}
                <Text style={[styles.label, { color: theme.text, marginTop: 8 }]}>
                  Target Year Cohorts (Editable):
                </Text>
                <Text style={{ color: theme.textMuted, fontSize: 11, marginBottom: 6 }}>
                  Defaults: 3rd & 4th years (+ 5th for ARCH/DS). Tap to toggle 1st & 2nd years for internships.
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 6 }}>
                  {[1, 2, 3, 4, 5].map((yr) => {
                    const isSelected = reviewSelectedYears.includes(yr);
                    const isEarly = yr === 1 || yr === 2;
                    return (
                      <TouchableOpacity
                        key={String(yr)}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: isSelected ? theme.primary : theme.surface,
                            borderColor: isSelected ? theme.accent : theme.border,
                            paddingHorizontal: 10,
                            paddingVertical: 6
                          }
                        ]}
                        onPress={() => {
                          if (isSelected) {
                            setReviewSelectedYears(reviewSelectedYears.filter((y) => y !== yr));
                          } else {
                            setReviewSelectedYears([...reviewSelectedYears, yr].sort((a, b) => a - b));
                          }
                        }}
                      >
                        <Text style={{ color: isSelected ? '#fff' : theme.textSecondary, fontWeight: 'bold', fontSize: 11 }}>
                          Year {yr}{isEarly ? ' (Optional)' : ''}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* ACTION BUTTONS */}
                <View style={{ gap: 8, marginTop: 14 }}>
                  <TouchableOpacity
                    style={[
                      styles.primaryBtn,
                      { backgroundColor: '#16a34a', paddingVertical: 12 }
                    ]}
                    onPress={() => handleApproveDepartment(reviewJobModal._id)}
                    disabled={reviewApproving}
                  >
                    {reviewApproving ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={[styles.primaryBtnText, { textAlign: 'center' }]}>
                        {user.role === 'Admin'
                          ? `🚀 Broadcast to ${reviewSelectedDepts.length} Selected Dept(s)`
                          : `✅ Approve & Broadcast to ${user.placementDepartment || user.department}`}
                      </Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.previewBtn,
                      { borderColor: theme.danger, paddingVertical: 10 }
                    ]}
                    onPress={() => handleRejectDepartment(reviewJobModal._id, user.placementDepartment || user.department)}
                  >
                    <Text style={{ color: theme.danger, fontWeight: 'bold', fontSize: 12, textAlign: 'center' }}>
                      ❌ Reject for Department
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* RESOLVE SUPPORT TICKET MODAL (ADMIN ONLY) */}
      {activeTicketModal && (
        <Modal
          visible={true}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setActiveTicketModal(null)}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
            <View style={{ backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1, borderRadius: 14, padding: 18, width: '100%', maxWidth: 480 }}>
              <View style={styles.rowBetween}>
                <Text style={[styles.cardTitle, { color: theme.text, fontSize: 16 }]}>
                  Resolve Support Ticket
                </Text>
                <TouchableOpacity onPress={() => setActiveTicketModal(null)} style={{ padding: 4 }}>
                  <Text style={{ color: theme.textMuted, fontSize: 16, fontWeight: 'bold' }}>✕</Text>
                </TouchableOpacity>
              </View>

              <Text style={{ color: theme.accent, fontSize: 13, fontWeight: 'bold', marginTop: 4 }}>
                {activeTicketModal.title}
              </Text>
              <Text style={{ color: theme.textMuted, fontSize: 11 }}>
                Reporter: @{activeTicketModal.reporterUsername} ({activeTicketModal.reporterName}) • {activeTicketModal.category}
              </Text>

              <Text style={[styles.label, { color: theme.text, marginTop: 12 }]}>
                Resolution Summary / Admin Notes:
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.surface,
                    color: theme.text,
                    borderColor: theme.border,
                    height: 80,
                    textAlignVertical: 'top'
                  }
                ]}
                placeholder="Describe fix, workaround, or patch applied..."
                placeholderTextColor={theme.textMuted}
                value={ticketAdminNotes}
                onChangeText={setTicketAdminNotes}
                multiline
              />

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <TouchableOpacity
                  style={[styles.previewBtn, { flex: 1, borderColor: theme.textMuted, paddingVertical: 10 }]}
                  onPress={() => setActiveTicketModal(null)}
                >
                  <Text style={{ color: theme.textMuted, fontWeight: 'bold', textAlign: 'center' }}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.primaryBtn, { flex: 1, backgroundColor: '#10b981', paddingVertical: 10 }]}
                  onPress={() => handleUpdateTicketStatus(activeTicketModal._id, 'Resolved')}
                  disabled={ticketUpdating}
                >
                  {ticketUpdating ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={[styles.primaryBtnText, { textAlign: 'center' }]}>Confirm Resolved</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuraWorkspace />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  mainLayout: { flex: 1, flexDirection: 'row' },
  mobileTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1
  },
  hamburgerBtn: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  sectionCard: {
    borderRadius: 14,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1
  },
  sectionHeader: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
  sectionSub: { fontSize: 12, marginBottom: 14 },
  localSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    minHeight: 46,
    marginBottom: 14
  },
  localSearchInput: { flex: 1, paddingVertical: 8, fontSize: 13 },
  clearSearchBtn: { minWidth: 36, minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  resourceCard: {
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 15, fontWeight: 'bold' },
  summaryText: { fontSize: 13, marginVertical: 8, fontStyle: 'italic' },
  verifiedCompositeBadge: {
    backgroundColor: 'rgba(22, 163, 74, 0.16)',
    borderWidth: 1,
    borderColor: '#22c55e',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    alignItems: 'flex-end'
  },
  verifiedBadgeText: { color: '#22c55e', fontSize: 11, fontWeight: 'bold' },
  verifiedSubText: { color: '#86efac', fontSize: 9 },
  unverifiedBadge: {
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    borderWidth: 1,
    borderColor: '#eab308',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8
  },
  unverifiedText: { color: '#eab308', fontSize: 11, fontWeight: 'bold' },
  previewBtn: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center'
  },
  previewBtnText: { color: '#ffffff', fontSize: 12, fontWeight: 'bold' },
  trizGroupBox: {
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#2563eb'
  },
  authContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 18 },
  authCard: {
    padding: 22,
    borderRadius: 14,
    width: '100%',
    maxWidth: 540,
    borderWidth: 1
  },
  brandTitle: { fontSize: 32, fontWeight: '900' },
  themePill: {
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center'
  },
  authToggleRow: { flexDirection: 'row', marginVertical: 14, borderRadius: 10, padding: 4 },
  authToggleBtn: { flex: 1, minHeight: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 8 },
  authAlertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12
  },
  authAlertText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18
  },
  input: {
    paddingHorizontal: 12,
    paddingVertical: 11,
    minHeight: 46,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
    fontSize: 13
  },
  label: { fontSize: 13, fontWeight: 'bold', marginTop: 8, marginBottom: 6 },
  subLabel: { fontSize: 12, fontWeight: 'bold', marginTop: 10, marginBottom: 6 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  chip: {
    minHeight: 40,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    justifyContent: 'center',
    marginRight: 6,
    marginBottom: 6
  },
  primaryBtn: {
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center'
  },
  primaryBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },
  secondaryBtn: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8
  },
  formBox: { padding: 12, borderRadius: 10, marginBottom: 14 },
  answerItem: { padding: 8, borderRadius: 8, marginTop: 6 },
  lauraAnswerBox: { padding: 14, borderRadius: 10, borderWidth: 1 },
  triggerBanner: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    marginBottom: 6,
    alignSelf: 'flex-start'
  },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 14 },
  statBox: {
    width: '23%',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1
  },
  statNumber: { fontSize: 20, fontWeight: '900' },
  smallBadgeBtn: { minHeight: 34, paddingHorizontal: 10, borderRadius: 6, justifyContent: 'center' },
  povBanner: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 999
  },
  povBadgeText: {
    color: '#78350f',
    fontWeight: '900',
    fontSize: 10,
    letterSpacing: 0.5
  },
  povTitleText: {
    color: '#0f172a',
    fontWeight: 'bold',
    fontSize: 13,
    marginTop: 2
  },
  povSubText: {
    color: '#78350f',
    fontSize: 11
  },
  povExitBtn: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3
  },
  povExitBtnText: {
    color: '#f8fafc',
    fontWeight: '800',
    fontSize: 12
  }
});