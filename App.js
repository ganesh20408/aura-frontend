import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  SafeAreaView,
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
  PanResponder
} from 'react-native';
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
  GUIDE_CATEGORIES,
  EXTRACURRICULARS,
  ORDERED_TABS
} from './src/constants/auraData';
import { ThemeProvider, useAuraTheme } from './src/theme/ThemeContext';
import AdaptiveNavigation from './src/components/AdaptiveNavigation';
import InAppPdfReader from './src/components/InAppPdfReader';

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

// --- INDEPENDENT LOCALIZED SEARCH BAR PER VIEW ---
function LocalizedSearchBar({ sectionLabel, value, onChange }) {
  const { theme } = useAuraTheme();
  return (
    <View
      style={[
        styles.localSearchBox,
        { backgroundColor: theme.card, borderColor: theme.border }
      ]}
    >
      <Text style={{ marginRight: 8, fontSize: 15 }}>🔍</Text>
      <TextInput
        accessibilityLabel={`Search within ${sectionLabel}`}
        style={[styles.localSearchInput, { color: theme.text }]}
        placeholder={`Search inside ${sectionLabel} only...`}
        placeholderTextColor={theme.textMuted}
        value={value}
        onChangeText={onChange}
      />
      {value ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Clear local search"
          style={styles.clearSearchBtn}
          onPress={() => onChange('')}
        >
          <Text style={{ color: theme.textMuted, fontWeight: 'bold' }}>✕</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function AuraWorkspace() {
  const { theme, isDark, toggleTheme } = useAuraTheme();
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768;

  // --- SESSION & AUTH STATE ---
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);

  // Registration / Login Form
  const [authName, setAuthName] = useState('');
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authRole, setAuthRole] = useState('Student');
  const [authDepartment, setAuthDepartment] = useState('CSE');
  const [authYear, setAuthYear] = useState(1);
  const [authFacultyRole, setAuthFacultyRole] = useState('Assistant Prof');
  const [showRegClubs, setShowRegClubs] = useState(false);
  const [authClubs, setAuthClubs] = useState({
    tech: [], nonTech: [], sports: [], cultural: [], volunteering: []
  });

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
    laura: '',
    upload: '',
    search: '',
    notifications: '',
    profile: ''
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

  // --- IN-APP PDF READER MODAL ---
  const [pdfModal, setPdfModal] = useState({ visible: false, url: '', title: '' });

  // --- TAB 3: Q&A FORM ---
  const [newQuestion, setNewQuestion] = useState('');
  const [newQuestionDept, setNewQuestionDept] = useState('General');
  const [answerInputs, setAnswerInputs] = useState({});

  // --- TAB 4: GUIDES FORM ---
  const [guideTitle, setGuideTitle] = useState('');
  const [guideCategory, setGuideCategory] = useState('Placement Tip');
  const [guideDept, setGuideDept] = useState('General');
  const [guideContent, setGuideContent] = useState('');

  // --- TAB 5: ASK LAURA AI ---
  const [lauraQuery, setLauraQuery] = useState('');
  const [lauraResponse, setLauraResponse] = useState(null);
  const [lauraLoading, setLauraLoading] = useState(false);

  // --- TAB 6: UPLOAD HUB ---
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCourse, setUploadCourse] = useState('');
  const [uploadSemester, setUploadSemester] = useState('Sem 3');
  const [uploadType, setUploadType] = useState('Lecture Notes');
  const [uploadDept, setUploadDept] = useState('CSE');
  const [uploadYear, setUploadYear] = useState(1);
  const [uploadSummary, setUploadSummary] = useState('');
  const [uploadedPdfUrl, setUploadedPdfUrl] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);

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
    }
  }, [token]);

  const apiHeader = useMemo(() => ({
    headers: { Authorization: `Bearer ${token}` }
  }), [token]);

  const fetchAllData = async () => {
    try {
      const [resList, qaList, guideList, noteList, statsRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/resources`, apiHeader),
        axios.get(`${BACKEND_URL}/api/qa`, apiHeader),
        axios.get(`${BACKEND_URL}/api/guides`, apiHeader),
        axios.get(`${BACKEND_URL}/api/notifications`, apiHeader),
        axios.get(`${BACKEND_URL}/api/profile/stats`, apiHeader)
      ]);
      setResources(resList.data);
      setQuestions(qaList.data);
      setGuides(guideList.data);
      setNotifications(noteList.data);
      setProfileStats(statsRes.data);

      if (user?.role === 'Admin') {
        const usersRes = await axios.get(`${BACKEND_URL}/api/admin/users`, apiHeader);
        setAdminUsers(usersRes.data);
      }
    } catch (err) {
      console.log('Sync error:', err.message);
    }
  };

  // --- AUTH SUBMIT ---
  const handleAuthSubmit = async () => {
    try {
      const endpoint = isRegistering ? '/api/auth/register' : '/api/auth/login';
      const payload = isRegistering
        ? {
            name: authName,
            username: authUsername,
            password: authPassword,
            role: authRole,
            department: authDepartment,
            year: ['Student', 'Senior Student'].includes(authRole) ? authYear : null,
            facultyRole: authRole === 'Faculty' ? authFacultyRole : null,
            clubs: authClubs
          }
        : { username: authUsername, password: authPassword };

      const res = await axios.post(`${BACKEND_URL}${endpoint}`, payload);
      await AsyncStorage.setItem('@aura_token', res.data.token);
      await AsyncStorage.setItem('@aura_user', JSON.stringify(res.data.user));
      setToken(res.data.token);
      setUser(res.data.user);
      syncProfileState(res.data.user);
    } catch (err) {
      Alert.alert('Authentication Alert', err.response?.data?.error || err.message);
    }
  };

  // --- TAB 10: LOGOUT ---
  const handleLogout = async () => {
    await AsyncStorage.multiRemove(['@aura_token', '@aura_user']);
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
      if (!uploadTitle) setUploadTitle(res.data.detectedMeta.suggestedTitle);
      setUploadType(res.data.detectedMeta.resourceType);
      setUploadSemester(res.data.detectedMeta.semester);
      setUploadSummary(res.data.detectedMeta.aiSummary);

      Alert.alert('Uploadthing Complete', 'Secure PDF URL received and AI tags detected!');
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
    try {
      await axios.post(
        `${BACKEND_URL}/api/resources`,
        {
          title: uploadTitle,
          course: uploadCourse || 'Core Subject',
          semester: uploadSemester,
          resourceType: uploadType,
          department: uploadDept,
          targetYear: uploadYear,
          summary: uploadSummary,
          pdfUrl: uploadedPdfUrl
        },
        apiHeader
      );
      setUploadTitle('');
      setUploadCourse('');
      setUploadSummary('');
      setUploadedPdfUrl('');
      fetchAllData();
      Alert.alert('Archived!', 'Resource saved to MongoDB Atlas.');
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

  // ==========================================================================
  // RENDER AUTHENTICATION VIEW (With Strict Conditional 5th Year Validation)
  // ==========================================================================
  if (loadingSession) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.bg, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!user || !token) {
    const conditionalYears = getConditionalYearOptions(authRole, authDepartment);
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: theme.bg }]}>
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
                style={[styles.authToggleBtn, !isRegistering && { backgroundColor: theme.primary }]}
                onPress={() => setIsRegistering(false)}
              >
                <Text style={{ color: !isRegistering ? '#fff' : theme.textMuted, fontWeight: 'bold' }}>
                  Sign In
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="tab"
                accessibilityState={{ selected: isRegistering }}
                style={[styles.authToggleBtn, isRegistering && { backgroundColor: theme.primary }]}
                onPress={() => setIsRegistering(true)}
              >
                <Text style={{ color: isRegistering ? '#fff' : theme.textMuted, fontWeight: 'bold' }}>
                  Create Account
                </Text>
              </TouchableOpacity>
            </View>

            {isRegistering && (
              <TextInput
                style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                placeholder="Full Name"
                placeholderTextColor={theme.textMuted}
                value={authName}
                onChangeText={setAuthName}
              />
            )}

            <TextInput
              style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
              placeholder="Username"
              placeholderTextColor={theme.textMuted}
              autoCapitalize="none"
              value={authUsername}
              onChangeText={setAuthUsername}
            />
            <TextInput
              style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
              placeholder="Password"
              placeholderTextColor={theme.textMuted}
              secureTextEntry
              value={authPassword}
              onChangeText={setAuthPassword}
            />

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

                <Text style={[styles.label, { color: theme.text }]}>
                  2. Academic Department ("General" Restricted)
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
                      {FIFTH_YEAR_DEPTS.includes(authDepartment) && authRole === 'Senior Student'
                        ? '(5th Year Unlocked for ARCH/DS)'
                        : ''}
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
                    {Object.entries(EXTRACURRICULARS).map(([catKey, clubArr]) => (
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

            <TouchableOpacity
              accessibilityRole="button"
              style={[styles.primaryBtn, { backgroundColor: theme.primary, marginTop: 14 }]}
              onPress={handleAuthSubmit}
            >
              <Text style={styles.primaryBtnText}>
                {isRegistering ? 'Complete Registration' : 'Enter AURA Workspace'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ==========================================================================
  // FILTERED DATA STREAMS
  // ==========================================================================
  const smartFeedResources = resources.filter((r) => {
    const matchesDeptAndYear =
      r.department === user.department &&
      (!user.year || Number(r.targetYear) === Number(user.year));
    const q = localSearch.dashboard.toLowerCase();
    return matchesDeptAndYear && (!q || `${r.title} ${r.course} ${r.summary}`.toLowerCase().includes(q));
  });

  const libraryResources = resources.filter((r) => {
    const allowedDept = r.department === user.department || r.department === 'General';
    const q = localSearch.library.toLowerCase();
    return allowedDept && (!q || `${r.title} ${r.course} ${r.semester} ${r.resourceType}`.toLowerCase().includes(q));
  });

  const trizGroupedLibrary = {};
  libraryResources.forEach((r) => {
    const key = `${r.course}  ▸  ${r.semester}  ▸  ${r.resourceType}`;
    if (!trizGroupedLibrary[key]) trizGroupedLibrary[key] = [];
    trizGroupedLibrary[key].push(r);
  });

  const filteredQA = questions.filter((qItem) => {
    const q = localSearch.qa.toLowerCase();
    return !q || `${qItem.question} ${qItem.askerName} ${qItem.department}`.toLowerCase().includes(q);
  });

  const filteredGuides = guides.filter((g) => {
    const q = localSearch.guides.toLowerCase();
    return !q || `${g.title} ${g.category} ${g.content} ${g.authorName}`.toLowerCase().includes(q);
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

  const currentTabMeta = ORDERED_TABS.find((t) => t.key === activeTabKey) || ORDERED_TABS[0];

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
            📐 {item.course} • {item.semester} • {item.resourceType} ({item.department} • Yr {item.targetYear})
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

            {user.role === 'Admin' && adminUsers.length > 0 && (
              <View style={[styles.formBox, { backgroundColor: theme.surfaceElevated, marginTop: 14 }]}>
                <Text style={[styles.subLabel, { color: theme.accent }]}>
                  🛡️ Admin Account Approval Queue ({adminUsers.length})
                </Text>
                {adminUsers.map((u) => (
                  <View key={u._id} style={[styles.rowBetween, { paddingVertical: 6 }]}>
                    <Text style={{ color: theme.text, fontSize: 12 }}>
                      {u.name} (@{u.username}) — {u.role} [{u.department}]
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.smallBadgeBtn,
                        { backgroundColor: u.isApproved ? theme.success : theme.warning }
                      ]}
                      onPress={async () => {
                        await axios.patch(
                          `${BACKEND_URL}/api/admin/users/${u._id}/approve`,
                          { isApproved: !u.isApproved },
                          apiHeader
                        );
                        fetchAllData();
                      }}
                    >
                      <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>
                        {u.isApproved ? 'Approved' : 'Approve'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        );

      case 'library':
        return (
          <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.sectionHeader, { color: theme.text }]}>📚 2. Academic Library</Text>
            <Text style={[styles.sectionSub, { color: theme.textMuted }]}>
              Multi-level TRIZ Dimension hierarchy (Course ▸ Semester ▸ Type) for {user.department} + General.
            </Text>
            <LocalizedSearchBar
              sectionLabel="Academic Library"
              value={localSearch.library}
              onChange={(v) => updateLocalSearch('library', v)}
            />
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
              Decentralized peer-to-peer academic discussion forum.
            </Text>
            <LocalizedSearchBar
              sectionLabel="Q&A Board"
              value={localSearch.qa}
              onChange={(v) => updateLocalSearch('qa', v)}
            />
            <View style={[styles.formBox, { backgroundColor: theme.surfaceElevated }]}>
              <TextInput
                style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                placeholder="Ask a question..."
                placeholderTextColor={theme.textMuted}
                value={newQuestion}
                onChangeText={setNewQuestion}
              />
              <AccessibleChipGroup
                options={RESOURCE_DEPARTMENTS}
                selected={newQuestionDept}
                onSelect={setNewQuestionDept}
              />
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: theme.primary }]}
                onPress={async () => {
                  if (!newQuestion) return;
                  await axios.post(
                    `${BACKEND_URL}/api/qa`,
                    { question: newQuestion, department: newQuestionDept },
                    apiHeader
                  );
                  setNewQuestion('');
                  fetchAllData();
                }}
              >
                <Text style={styles.primaryBtnText}>Post Question</Text>
              </TouchableOpacity>
            </View>

            {filteredQA.map((qItem) => (
              <View key={qItem._id} style={[styles.resourceCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>Q: {qItem.question}</Text>
                <Text style={{ color: theme.textMuted, fontSize: 11, marginBottom: 6 }}>
                  Asked by {qItem.askerName} ({qItem.askerRole}) • [{qItem.department}]
                </Text>
                {qItem.answers?.map((ans, idx) => (
                  <View key={idx} style={[styles.answerItem, { backgroundColor: theme.surface }]}>
                    <Text style={{ color: theme.text, fontSize: 13 }}>{ans.text}</Text>
                    <Text style={{ color: theme.accent, fontSize: 11, marginTop: 2 }}>
                      — {ans.responderName} ({ans.responderRole})
                    </Text>
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
              Senior tips and career experiences with clickable 5-star ratings.
            </Text>
            <LocalizedSearchBar
              sectionLabel="Experiences & Guides"
              value={localSearch.guides}
              onChange={(v) => updateLocalSearch('guides', v)}
            />
            <View style={[styles.formBox, { backgroundColor: theme.surfaceElevated }]}>
              <TextInput
                style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                placeholder="Guide Title"
                placeholderTextColor={theme.textMuted}
                value={guideTitle}
                onChangeText={setGuideTitle}
              />
              <AccessibleChipGroup options={GUIDE_CATEGORIES} selected={guideCategory} onSelect={setGuideCategory} />
              <TextInput
                style={[styles.input, { minHeight: 70, backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                multiline
                placeholder="Share your experience or placement strategy..."
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
                    { title: guideTitle, category: guideCategory, department: guideDept, content: guideContent },
                    apiHeader
                  );
                  setGuideTitle('');
                  setGuideContent('');
                  fetchAllData();
                }}
              >
                <Text style={styles.primaryBtnText}>Publish Guide</Text>
              </TouchableOpacity>
            </View>

            {filteredGuides.map((g) => (
              <View key={g._id} style={[styles.resourceCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <View style={styles.rowBetween}>
                  <Text style={[styles.cardTitle, { color: theme.text }]}>{g.title}</Text>
                  <Text style={{ color: theme.accent, fontSize: 12, fontWeight: 'bold' }}>{g.category}</Text>
                </View>
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
              style={[styles.primaryBtn, { backgroundColor: '#0284c7', marginBottom: 14 }]}
              onPress={handlePickAndUploadToUploadthing}
              disabled={uploadingFile}
            >
              {uploadingFile ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>1️⃣ Select PDF & Upload to Uploadthing</Text>
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

            <Text style={[styles.subLabel, { color: theme.accent }]}>Department ("General" Allowed Here)</Text>
            <AccessibleChipGroup options={RESOURCE_DEPARTMENTS} selected={uploadDept} onSelect={setUploadDept} />

            <Text style={[styles.subLabel, { color: theme.accent }]}>Semester</Text>
            <AccessibleChipGroup options={SEMESTERS} selected={uploadSemester} onSelect={setUploadSemester} />

            <Text style={[styles.subLabel, { color: theme.accent }]}>Resource Type</Text>
            <AccessibleChipGroup options={RESOURCE_TYPES} selected={uploadType} onSelect={setUploadType} />

            <Text style={[styles.subLabel, { color: theme.accent }]}>Target Academic Year</Text>
            <AccessibleChipGroup
              options={FIFTH_YEAR_DEPTS.includes(uploadDept) ? [1, 2, 3, 4, 5] : [1, 2, 3, 4]}
              selected={uploadYear}
              onSelect={setUploadYear}
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
                    {!noteTargetAllYears && (
                      <>
                        <Text style={[styles.subLabel, { color: theme.accent }]}>Specific Years</Text>
                        <AccessibleChipGroup
                          multi
                          options={[1, 2, 3, 4, 5]}
                          selected={noteYears}
                          onSelect={setNoteYears}
                          renderLabel={(y) => `Year ${y}`}
                        />
                      </>
                    )}

                    <Text style={[styles.subLabel, { color: theme.accent }]}>Target Departments</Text>
                    <AccessibleChipGroup multi options={PROFILE_DEPARTMENTS} selected={noteDepts} onSelect={setNoteDepts} />

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

                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: theme.primary, marginTop: 10 }]}
                  onPress={async () => {
                    if (!noteTitle || !noteMsg) return;
                    await axios.post(
                      `${BACKEND_URL}/api/notifications`,
                      {
                        title: noteTitle,
                        message: noteMsg,
                        targetAll: noteTargetAll,
                        targetAllYears: noteTargetAllYears,
                        targetYears: noteYears,
                        targetDepartments: noteDepts,
                        targetTechClubs: noteTechClubs,
                        targetNonTechClubs: noteNonTechClubs,
                        targetSportsTeams: noteSportsTeams,
                        targetCulturalAssociations: noteCulturalAssocs,
                        targetVolunteeringGroups: noteVolunteeringGroups
                      },
                      apiHeader
                    );
                    setNoteTitle('');
                    setNoteMsg('');
                    fetchAllData();
                    Alert.alert('Dispatched!', 'Targeted notification sent.');
                  }}
                >
                  <Text style={styles.primaryBtnText}>Send Multi-Target Broadcast</Text>
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

            <Text style={[styles.subLabel, { color: theme.accent }]}>
              Academic Department ("General" Prohibited)
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
                    ? '(5th Year Visible for ARCH/DS)'
                    : '(Years 1–4)'}
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
              Update Extracurricular Club Memberships
            </Text>
            {Object.entries(EXTRACURRICULARS).map(([catKey, clubList]) => {
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

            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: theme.primary, marginTop: 12 }]}
              onPress={async () => {
                try {
                  const res = await axios.put(
                    `${BACKEND_URL}/api/profile`,
                    {
                      name: editName,
                      role: editRole,
                      department: editDept,
                      year: editYear,
                      facultyRole: editFacultyRole,
                      clubs: editClubs
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
          </View>
        );
      }

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.bg }]} {...panResponder.panHandlers}>
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
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuraWorkspace />
    </ThemeProvider>
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
  smallBadgeBtn: { minHeight: 34, paddingHorizontal: 10, borderRadius: 6, justifyContent: 'center' }
});
