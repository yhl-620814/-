import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  AlertCircle,
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  ExternalLink,
  FolderOpen,
  FolderPlus,
  History,
  KeyRound,
  Lock,
  LogOut,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { YILAN_SCHOOLS, YILAN_TOWNSHIPS } from '../data/yilanSchools';
import { createAdminCollectionFolder } from '../lib/drive';
import {
  auth,
  db,
  getAccessToken,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase';
import {
  ADMIN_TMAIL_EMAIL,
  AppDriveSettings,
  FIELD_LIMITS,
  SchoolLevel,
  SubmissionRecord,
  SubmissionStatus,
  UploadHistoryRecord,
  UploadItem,
  UploadTopic,
} from '../types';

interface AdminConsoleViewProps {
  currentUserEmail: string | null;
  hasDriveToken: boolean;
  onConnectAdminTmail: () => Promise<void>;
  onBackToPortal: () => void;
}

type AdminTab = 'matrix' | 'history' | 'items' | 'drive';

interface AdminServerStatus {
  needsInitialSetup: boolean;
  usernameHint: string;
  authenticated: boolean;
  username: string | null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDateTime(ts?: { toDate?: () => Date }): string {
  if (!ts?.toDate) return '-';
  return ts.toDate().toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function isPastDeadline(deadline: string): boolean {
  if (!deadline) return false;
  const endOfDay = new Date(`${deadline}T23:59:59`);
  return !Number.isNaN(endOfDay.getTime()) && Date.now() > endOfDay.getTime();
}

function getDriveDownloadUrl(driveFileId: string): string {
  return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(driveFileId)}`;
}

export const AdminConsoleView: React.FC<AdminConsoleViewProps> = ({
  currentUserEmail,
  hasDriveToken,
  onConnectAdminTmail,
  onBackToPortal,
}) => {
  // Server-backed admin auth state (token held strictly in React memory)
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [serverStatus, setServerStatus] = useState<AdminServerStatus | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const [usernameInput, setUsernameInput] = useState('yhl');
  const [passwordInput, setPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [submittingAuth, setSubmittingAuth] = useState(false);

  // Admin workspace state
  const [activeTab, setActiveTab] = useState<AdminTab>('matrix');
  const [uploadTopics, setUploadTopics] = useState<UploadTopic[]>([]);
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);
  const [historyRecords, setHistoryRecords] = useState<UploadHistoryRecord[]>([]);
  const [driveSettings, setDriveSettings] = useState<AppDriveSettings | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  // Matrix filters & reminder preview
  const [schoolSearch, setSchoolSearch] = useState('');
  const [townshipFilter, setTownshipFilter] = useState<string>('全部');
  const [levelFilter, setLevelFilter] = useState<'全部' | SchoolLevel>('全部');
  const [completionFilter, setCompletionFilter] = useState<
    'all' | 'incomplete' | 'overdue' | 'complete'
  >('all');
  const [reminderModalOpen, setReminderModalOpen] = useState(false);
  const [reminderCopied, setReminderCopied] = useState(false);

  // History filters
  const [historySearch, setHistorySearch] = useState('');
  const [historyItemFilter, setHistoryItemFilter] = useState<string>('all');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<
    'all' | SubmissionStatus
  >('all');
  const [updatingHistoryId, setUpdatingHistoryId] = useState<string | null>(null);

  // Submission detail / review modal
  const [selectedSubmission, setSelectedSubmission] = useState<SubmissionRecord | null>(null);
  const [reviewNoteInput, setReviewNoteInput] = useState('');
  const [reviewBusy, setReviewBusy] = useState(false);
  const [confirmDeleteSub, setConfirmDeleteSub] = useState<SubmissionRecord | null>(null);

  // Topic editor state
  const [topicFormOpen, setTopicFormOpen] = useState(false);
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [topicTitle, setTopicTitle] = useState('');
  const [topicDesc, setTopicDesc] = useState('');
  const [topicActive, setTopicActive] = useState(true);
  const [topicSortOrder, setTopicSortOrder] = useState(1);
  const [savingTopic, setSavingTopic] = useState(false);
  const [confirmDeleteTopic, setConfirmDeleteTopic] = useState<UploadTopic | null>(null);

  // Item editor state
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemFormOpen, setItemFormOpen] = useState(false);
  const [itemTopicId, setItemTopicId] = useState('');
  const [itemTitle, setItemTitle] = useState('');
  const [itemDesc, setItemDesc] = useState('');
  const [itemFormats, setItemFormats] = useState('pdf, docx, xlsx');
  const [itemMaxMB, setItemMaxMB] = useState(20);
  const [itemDeadline, setItemDeadline] = useState('');
  const [itemRequired, setItemRequired] = useState(true);
  const [itemActive, setItemActive] = useState(true);
  const [itemSortOrder, setItemSortOrder] = useState(1);
  const [savingItem, setSavingItem] = useState(false);
  const [confirmDeleteItem, setConfirmDeleteItem] = useState<UploadItem | null>(null);

  // Drive setup state
  const [folderNameInput, setFolderNameInput] = useState('宜蘭縣各校資料繳交彙整區');
  const [creatingFolder, setCreatingFolder] = useState(false);

  const isAdminTmailReady =
    currentUserEmail?.toLowerCase() === ADMIN_TMAIL_EMAIL.toLowerCase();

  // Check server admin auth status on mount
  useEffect(() => {
    let active = true;
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/admin/status', {
          headers: adminToken ? { Authorization: `Bearer ${adminToken}` } : {},
        });
        if (!res.ok) throw new Error('無法連線至管理驗證服務');
        const data = (await res.json()) as AdminServerStatus;
        if (!active) return;
        setServerStatus(data);
        if (data.usernameHint) {
          setUsernameInput(data.usernameHint);
        }
      } catch (err) {
        if (!active) return;
        setAuthError(err instanceof Error ? err.message : '驗證狀態讀取失敗');
      } finally {
        if (active) setAuthLoading(false);
      }
    };
    void fetchStatus();
    return () => {
      active = false;
    };
  }, [adminToken]);

  // Subscribe to Firestore collections only when BOTH server admin token AND admin Tmail Google session are ready
  useEffect(() => {
    if (!adminToken || !isAdminTmailReady) {
      return;
    }

    const unsubTopics = onSnapshot(
      collection(db, 'uploadTopics'),
      (snap) => {
        const list: UploadTopic[] = [];
        snap.forEach((d) => list.push(d.data() as UploadTopic));
        list.sort((a, b) => a.sortOrder - b.sortOrder);
        setUploadTopics(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'uploadTopics')
    );

    const unsubItems = onSnapshot(
      collection(db, 'uploadItems'),
      (snap) => {
        const list: UploadItem[] = [];
        snap.forEach((d) => list.push(d.data() as UploadItem));
        list.sort((a, b) => a.sortOrder - b.sortOrder);
        setUploadItems(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'uploadItems')
    );

    const unsubSubs = onSnapshot(
      collection(db, 'submissions'),
      (snap) => {
        const list: SubmissionRecord[] = [];
        snap.forEach((d) => list.push(d.data() as SubmissionRecord));
        setSubmissions(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'submissions')
    );

    const unsubHistory = onSnapshot(
      collection(db, 'uploadHistory'),
      (snap) => {
        const list: UploadHistoryRecord[] = [];
        snap.forEach((d) => list.push(d.data() as UploadHistoryRecord));
        list.sort((a, b) => {
          const tA = a.createdAt?.toMillis?.() ?? 0;
          const tB = b.createdAt?.toMillis?.() ?? 0;
          return tB - tA;
        });
        setHistoryRecords(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'uploadHistory')
    );

    const unsubSettings = onSnapshot(
      doc(db, 'appSettings', 'drive'),
      (snap) => {
        setDriveSettings(snap.exists() ? (snap.data() as AppDriveSettings) : null);
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'appSettings/drive')
    );

    return () => {
      unsubTopics();
      unsubItems();
      unsubSubs();
      unsubHistory();
      unsubSettings();
    };
  }, [adminToken, isAdminTmailReady]);

  const handleServerLoginOrSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setSubmittingAuth(true);

    try {
      if (serverStatus?.needsInitialSetup) {
        if (passwordInput !== confirmPasswordInput) {
          throw new Error('兩次輸入的密碼不一致，請重新確認。');
        }
        const res = await fetch('/api/admin/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: usernameInput.trim(),
            password: passwordInput,
          }),
        });
        const data = (await res.json()) as { token?: string; error?: string };
        if (!res.ok || !data.token) {
          throw new Error(data.error || '初始化設定失敗');
        }
        setAdminToken(data.token);
        setPasswordInput('');
        setConfirmPasswordInput('');
      } else {
        const res = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: usernameInput.trim(),
            password: passwordInput,
          }),
        });
        const data = (await res.json()) as { token?: string; error?: string };
        if (!res.ok || !data.token) {
          throw new Error(data.error || '登入失敗，請檢查帳號與密碼。');
        }
        setAdminToken(data.token);
        setPasswordInput('');
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : '驗證失敗');
    } finally {
      setSubmittingAuth(false);
    }
  };

  // Lookup map: `${schoolId}__${itemId}` -> SubmissionRecord
  const submissionMap = useMemo(() => {
    const map: Record<string, SubmissionRecord> = {};
    for (const sub of submissions) {
      map[`${sub.schoolId}__${sub.itemId}`] = sub;
    }
    return map;
  }, [submissions]);

  const topicLookup = useMemo(() => {
    const map: Record<string, UploadTopic> = {};
    for (const t of uploadTopics) {
      map[t.id] = t;
    }
    return map;
  }, [uploadTopics]);

  const activeItems = useMemo(() => {
    return uploadItems.filter((item) => {
      if (!item.active) return false;
      if (item.topicId && topicLookup[item.topicId] && !topicLookup[item.topicId].active) {
        return false;
      }
      return true;
    });
  }, [uploadItems, topicLookup]);

  const overdueItems = useMemo(() => {
    return activeItems
      .filter((item) => isPastDeadline(item.deadline))
      .map((item) => {
        const missingCount = YILAN_SCHOOLS.filter(
          (school) => !submissionMap[`${school.id}__${item.id}`]
        ).length;
        return { item, missingCount };
      })
      .filter((entry) => entry.missingCount > 0);
  }, [activeItems, submissionMap]);

  const filteredSchools = useMemo(() => {
    const kw = schoolSearch.trim();
    return YILAN_SCHOOLS.filter((school) => {
      if (townshipFilter !== '全部' && school.township !== townshipFilter) return false;
      if (levelFilter !== '全部' && school.level !== levelFilter) return false;
      if (kw && !school.name.includes(kw) && !school.township.includes(kw)) return false;

      if (completionFilter !== 'all' && activeItems.length > 0) {
        const uploadedCount = activeItems.filter((item) => {
          const sub = submissionMap[`${school.id}__${item.id}`];
          return sub && (sub.status === 'uploaded' || sub.status === 'approved');
        }).length;
        const hasOverdueMissing = activeItems.some((item) => {
          return isPastDeadline(item.deadline) && !submissionMap[`${school.id}__${item.id}`];
        });

        if (completionFilter === 'complete' && uploadedCount < activeItems.length) return false;
        if (completionFilter === 'incomplete' && uploadedCount === activeItems.length) return false;
        if (completionFilter === 'overdue' && !hasOverdueMissing) return false;
      }
      return true;
    });
  }, [schoolSearch, townshipFilter, levelFilter, completionFilter, activeItems, submissionMap]);

  const metrics = useMemo(() => {
    const totalSchools = YILAN_SCHOOLS.length;
    const totalActiveItems = activeItems.length;
    let completeSchools = 0;
    let uploadedSlots = 0;
    let overdueMissingSlots = 0;

    if (totalActiveItems > 0) {
      for (const school of YILAN_SCHOOLS) {
        let schoolDone = 0;
        for (const item of activeItems) {
          const sub = submissionMap[`${school.id}__${item.id}`];
          if (sub && (sub.status === 'uploaded' || sub.status === 'approved')) {
            schoolDone += 1;
            uploadedSlots += 1;
          } else if (!sub && isPastDeadline(item.deadline)) {
            overdueMissingSlots += 1;
          }
        }
        if (schoolDone === totalActiveItems) {
          completeSchools += 1;
        }
      }
    }
    const totalSlots = totalSchools * totalActiveItems;
    const missingSlots = Math.max(0, totalSlots - uploadedSlots);
    return {
      totalSchools,
      totalActiveItems,
      completeSchools,
      uploadedSlots,
      missingSlots,
      overdueMissingSlots,
    };
  }, [activeItems, submissionMap]);

  const missingSchoolsSummary = useMemo(() => {
    return filteredSchools
      .map((school) => {
        const missingItems = activeItems.filter(
          (item) => !submissionMap[`${school.id}__${item.id}`]
        );
        const overdueMissing = missingItems.filter((item) => isPastDeadline(item.deadline));
        return {
          school,
          missingItems,
          overdueMissing,
        };
      })
      .filter((entry) => entry.missingItems.length > 0);
  }, [filteredSchools, activeItems, submissionMap]);

  const reminderNoticeText = useMemo(() => {
    if (missingSchoolsSummary.length === 0) return '';
    const lines = [
      '【宜蘭縣學校資料繳交催辦通知】',
      '下列學校尚有應繳交或已逾截止日之項目未完成上傳，請儘速登入平台辦理：',
      '',
      ...missingSchoolsSummary.map(({ school, missingItems, overdueMissing }) => {
        const list = missingItems
          .map((it) => {
            const isOverdue = overdueMissing.some((o) => o.id === it.id);
            return `${it.title}${it.deadline ? `（截止 ${it.deadline}${isOverdue ? '，已逾期' : ''}）` : ''}`;
          })
          .join('、');
        return `• ${school.name}：${list}`;
      }),
    ];
    return lines.join('\n');
  }, [missingSchoolsSummary]);

  const filteredHistory = useMemo(() => {
    const kw = historySearch.trim().toLowerCase();
    return historyRecords.filter((rec) => {
      if (historyItemFilter !== 'all' && rec.itemId !== historyItemFilter) return false;
      if (historyStatusFilter !== 'all' && rec.status !== historyStatusFilter) return false;
      if (kw) {
        const hay = `${rec.schoolName} ${rec.fileName} ${rec.itemTitle} ${rec.topicTitle} ${rec.uploadedByName} ${rec.uploadedByEmail}`.toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });
  }, [historyRecords, historySearch, historyItemFilter, historyStatusFilter]);

  const exportCsv = () => {
    const headers = [
      '鄉鎮市',
      '學制',
      '學校名稱',
      ...activeItems.map((i) => `${i.title}（狀態）`),
      ...activeItems.map((i) => `${i.title}（檔案連結）`),
    ];

    const rows = filteredSchools.map((school) => {
      const statuses = activeItems.map((item) => {
        const sub = submissionMap[`${school.id}__${item.id}`];
        if (!sub) return isPastDeadline(item.deadline) ? '逾期未上傳' : '未上傳';
        if (sub.status === 'approved') return `已審核 (${sub.fileName})`;
        if (sub.status === 'rejected') return `需補件 (${sub.fileName})`;
        return `待審核 (${sub.fileName})`;
      });
      const links = activeItems.map((item) => {
        const sub = submissionMap[`${school.id}__${item.id}`];
        return sub?.driveWebViewLink || '';
      });
      return [school.township, school.level, school.name, ...statuses, ...links];
    });

    const csvContent =
      '\uFEFF' +
      [headers, ...rows]
        .map((row) =>
          row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
        )
        .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `宜蘭縣各校資料繳交狀況_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportMissingSchoolsCsv = (overdueOnly = false) => {
    const targetList = overdueOnly
      ? missingSchoolsSummary.filter((e) => e.overdueMissing.length > 0)
      : missingSchoolsSummary;

    if (targetList.length === 0) {
      setActionMsg(
        overdueOnly
          ? '目前篩選範圍內沒有逾期未上傳的學校。'
          : '目前篩選範圍內所有學校皆已完成上傳！'
      );
      return;
    }

    const headers = [
      '鄉鎮市',
      '學制',
      '學校名稱',
      '是否含逾期未繳項目',
      '未上傳項目總數',
      '逾期未上傳項目（含截止日）',
      '尚未上傳項目清單（含截止日）',
    ];

    const rows = targetList.map(({ school, missingItems, overdueMissing }) => {
      const overdueText = overdueMissing
        .map((it) => `${it.title}${it.deadline ? `（截止 ${it.deadline}）` : ''}`)
        .join('；');
      const allMissingText = missingItems
        .map((it) => `${it.title}${it.deadline ? `（截止 ${it.deadline}）` : ''}`)
        .join('；');
      return [
        school.township,
        school.level,
        school.name,
        overdueMissing.length > 0 ? '是（已逾期）' : '否',
        overdueOnly ? overdueMissing.length : missingItems.length,
        overdueText || '無',
        allMissingText,
      ];
    });

    const csvContent =
      '\uFEFF' +
      [headers, ...rows]
        .map((row) =>
          row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
        )
        .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `宜蘭縣${overdueOnly ? '逾期' : '尚未上傳'}學校催辦名單_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    setActionMsg(`已一鍵匯出 ${targetList.length} 所尚未完成繳交的學校催辦名單（CSV）。`);
  };

  const exportHistoryCsv = () => {
    const headers = [
      '上傳時間',
      '學校名稱',
      '大主題',
      '資料項目名稱',
      '檔案名稱',
      '檔案大小',
      '上傳者姓名',
      '上傳者Tmail',
      '審核狀態',
      '審核備註',
      'Google雲端檢視連結',
    ];

    const rows = filteredHistory.map((rec) => [
      formatDateTime(rec.createdAt),
      rec.schoolName,
      rec.topicTitle || '一般項目',
      rec.itemTitle,
      rec.fileName,
      formatBytes(rec.fileSize),
      rec.uploadedByName,
      rec.uploadedByEmail,
      rec.status === 'approved'
        ? '已審核'
        : rec.status === 'rejected'
        ? '退件需補件'
        : '待審核',
      rec.reviewNote || '',
      rec.driveWebViewLink,
    ]);

    const csvContent =
      '\uFEFF' +
      [headers, ...rows]
        .map((row) =>
          row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
        )
        .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `宜蘭縣學校上傳歷程紀錄_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Topic CRUD handlers
  const openNewTopicForm = () => {
    setEditingTopicId(null);
    setTopicTitle('');
    setTopicDesc('');
    setTopicActive(true);
    setTopicSortOrder(uploadTopics.length + 1);
    setTopicFormOpen(true);
  };

  const openEditTopicForm = (topic: UploadTopic) => {
    setEditingTopicId(topic.id);
    setTopicTitle(topic.title);
    setTopicDesc(topic.description);
    setTopicActive(topic.active);
    setTopicSortOrder(topic.sortOrder);
    setTopicFormOpen(true);
  };

  const handleSaveTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    setDataError(null);
    setActionMsg(null);
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const cleanTitle = topicTitle.trim().slice(0, FIELD_LIMITS.TITLE_MAX);
    if (!cleanTitle) {
      setDataError('請輸入大主題名稱。');
      return;
    }

    setSavingTopic(true);
    try {
      const id = editingTopicId || `topic_${Date.now()}`;
      const path = `uploadTopics/${id}`;
      if (editingTopicId) {
        try {
          const batch = writeBatch(db);
          batch.update(doc(db, 'uploadTopics', id), {
            title: cleanTitle,
            description: topicDesc.trim().slice(0, FIELD_LIMITS.DESCRIPTION_MAX),
            active: topicActive,
            sortOrder: Math.max(0, Math.min(10000, Number(topicSortOrder) || 0)),
            updatedAt: serverTimestamp(),
          });
          // Sync topicTitle onto existing child items
          for (const child of uploadItems.filter((it) => it.topicId === id)) {
            batch.update(doc(db, 'uploadItems', child.id), {
              topicTitle: cleanTitle,
              updatedAt: serverTimestamp(),
            });
          }
          await batch.commit();
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, path);
        }
        setActionMsg(`已更新大主題「${cleanTitle}」。`);
      } else {
        try {
          await setDoc(doc(db, 'uploadTopics', id), {
            id,
            title: cleanTitle,
            description: topicDesc.trim().slice(0, FIELD_LIMITS.DESCRIPTION_MAX),
            active: topicActive,
            sortOrder: Math.max(0, Math.min(10000, Number(topicSortOrder) || 0)),
            createdByUid: uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, path);
        }
        setActionMsg(`已新增大主題「${cleanTitle}」。`);
      }
      setTopicFormOpen(false);
    } finally {
      setSavingTopic(false);
    }
  };

  const handleConfirmDeleteTopic = async () => {
    if (!confirmDeleteTopic) return;
    const target = confirmDeleteTopic;
    setConfirmDeleteTopic(null);
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'uploadTopics', target.id));
      for (const child of uploadItems.filter((it) => it.topicId === target.id)) {
        batch.update(doc(db, 'uploadItems', child.id), {
          topicId: '',
          topicTitle: '',
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
      setActionMsg(`已刪除大主題「${target.title}」（其下子項目已移至未歸類項目）。`);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `uploadTopics/${target.id}`);
    }
  };

  // Item CRUD handlers
  const openNewItemForm = (presetTopicId = '') => {
    setEditingItemId(null);
    setItemTopicId(presetTopicId || uploadTopics[0]?.id || '');
    setItemTitle('');
    setItemDesc('');
    setItemFormats('pdf, docx, xlsx');
    setItemMaxMB(20);
    setItemDeadline('');
    setItemRequired(true);
    setItemActive(true);
    setItemSortOrder(uploadItems.length + 1);
    setItemFormOpen(true);
  };

  const openEditItemForm = (item: UploadItem) => {
    setEditingItemId(item.id);
    setItemTopicId(item.topicId || '');
    setItemTitle(item.title);
    setItemDesc(item.description);
    setItemFormats(item.acceptedFormats);
    setItemMaxMB(item.maxSizeMB);
    setItemDeadline(item.deadline);
    setItemRequired(item.isRequired);
    setItemActive(item.active);
    setItemSortOrder(item.sortOrder);
    setItemFormOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setDataError(null);
    setActionMsg(null);

    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const cleanTitle = itemTitle.trim().slice(0, FIELD_LIMITS.TITLE_MAX);
    if (!cleanTitle) {
      setDataError('請輸入子項目名稱。');
      return;
    }

    const chosenTopic = itemTopicId ? topicLookup[itemTopicId] : null;
    const topicIdVal = chosenTopic ? chosenTopic.id : '';
    const topicTitleVal = chosenTopic ? chosenTopic.title.slice(0, FIELD_LIMITS.TITLE_MAX) : '';

    setSavingItem(true);
    try {
      const id = editingItemId || `item_${Date.now()}`;
      const path = `uploadItems/${id}`;
      if (editingItemId) {
        try {
          await updateDoc(doc(db, 'uploadItems', id), {
            topicId: topicIdVal,
            topicTitle: topicTitleVal,
            title: cleanTitle,
            description: itemDesc.trim().slice(0, FIELD_LIMITS.DESCRIPTION_MAX),
            acceptedFormats:
              itemFormats.trim().slice(0, FIELD_LIMITS.ACCEPTED_FORMATS_MAX) || '不限格式',
            maxSizeMB: Math.min(FIELD_LIMITS.MAX_SIZE_MB_LIMIT, Math.max(1, Number(itemMaxMB) || 20)),
            deadline: itemDeadline.trim().slice(0, FIELD_LIMITS.DEADLINE_MAX),
            isRequired: itemRequired,
            active: itemActive,
            sortOrder: Math.max(0, Math.min(10000, Number(itemSortOrder) || 0)),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, path);
        }
        setActionMsg(`已更新子項目「${cleanTitle}」。`);
      } else {
        try {
          await setDoc(doc(db, 'uploadItems', id), {
            id,
            topicId: topicIdVal,
            topicTitle: topicTitleVal,
            title: cleanTitle,
            description: itemDesc.trim().slice(0, FIELD_LIMITS.DESCRIPTION_MAX),
            acceptedFormats:
              itemFormats.trim().slice(0, FIELD_LIMITS.ACCEPTED_FORMATS_MAX) || '不限格式',
            maxSizeMB: Math.min(FIELD_LIMITS.MAX_SIZE_MB_LIMIT, Math.max(1, Number(itemMaxMB) || 20)),
            deadline: itemDeadline.trim().slice(0, FIELD_LIMITS.DEADLINE_MAX),
            isRequired: itemRequired,
            active: itemActive,
            sortOrder: Math.max(0, Math.min(10000, Number(itemSortOrder) || 0)),
            createdByUid: uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, path);
        }
        setActionMsg(`已新增子項目「${cleanTitle}」。`);
      }
      setItemFormOpen(false);
    } finally {
      setSavingItem(false);
    }
  };

  const handleSeedSampleHierarchy = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setDataError(null);

    const sampleTopics = [
      {
        id: 'topic_school_eval',
        title: '115學年度校務評鑑與發展計畫',
        description: '包含自我評鑑總表與年度校務推動佐證資料。',
        sortOrder: 1,
      },
      {
        id: 'topic_infosec_digital',
        title: '資訊安全暨數位學習推動填報',
        description: '包含年度資安個資盤點清冊與生生用平板執行成果。',
        sortOrder: 2,
      },
    ];

    const sampleItems = [
      {
        id: 'item_eval_report',
        topicId: 'topic_school_eval',
        topicTitle: '115學年度校務評鑑與發展計畫',
        title: '校務發展自我評鑑總表（核章版）',
        description: '請各校彙整年度校務評鑑自評報告，核章後掃描為 PDF 檔上傳。',
        acceptedFormats: 'pdf',
        maxSizeMB: 25,
        deadline: '2026-12-15',
        isRequired: true,
        sortOrder: 1,
      },
      {
        id: 'item_eval_photos',
        topicId: 'topic_school_eval',
        topicTitle: '115學年度校務評鑑與發展計畫',
        title: '特色課程教學成果佐證簡報',
        description: '請檢附校訂特色課程簡報或活動紀錄檔。',
        acceptedFormats: 'pdf, pptx',
        maxSizeMB: 30,
        deadline: '2026-12-20',
        isRequired: false,
        sortOrder: 2,
      },
      {
        id: 'item_infosec_inventory',
        topicId: 'topic_infosec_digital',
        topicTitle: '資訊安全暨數位學習推動填報',
        title: '學校資訊安全暨個資盤點清冊',
        description: '請填寫最新一季校內資訊系統與個人資料檔案盤點表（Excel 或 PDF）。',
        acceptedFormats: 'xlsx, xls, pdf',
        maxSizeMB: 15,
        deadline: '2026-11-20',
        isRequired: true,
        sortOrder: 3,
      },
      {
        id: 'item_digital_learning',
        topicId: 'topic_infosec_digital',
        topicTitle: '資訊安全暨數位學習推動填報',
        title: '數位學習精進方案執行成果報告',
        description: '請檢附公開觀議課紀錄與數位平台使用統計佐證檔案。',
        acceptedFormats: 'pdf, docx, zip',
        maxSizeMB: 50,
        deadline: '2026-12-31',
        isRequired: true,
        sortOrder: 4,
      },
    ];

    try {
      const batch = writeBatch(db);
      for (const t of sampleTopics) {
        batch.set(doc(db, 'uploadTopics', t.id), {
          ...t,
          active: true,
          createdByUid: uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      for (const s of sampleItems) {
        batch.set(doc(db, 'uploadItems', s.id), {
          ...s,
          active: true,
          createdByUid: uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
      setActionMsg('已載入 2 個大主題與 4 個子項目範例（含一筆已逾截止日範例以呈現催辦警示）。');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'uploadTopics');
    }
  };

  const handleConfirmDeleteItem = async () => {
    if (!confirmDeleteItem) return;
    const target = confirmDeleteItem;
    setConfirmDeleteItem(null);
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'uploadItems', target.id));
      await batch.commit();
      setActionMsg(`已刪除項目「${target.title}」。`);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `uploadItems/${target.id}`);
    }
  };

  const handleUpdateSubmissionReview = async (
    sub: SubmissionRecord,
    nextStatus: SubmissionStatus
  ) => {
    setReviewBusy(true);
    try {
      const note = reviewNoteInput.trim().slice(0, FIELD_LIMITS.REVIEW_NOTE_MAX);
      const batch = writeBatch(db);
      batch.update(doc(db, 'submissions', sub.id), {
        status: nextStatus,
        reviewNote: note,
        updatedAt: serverTimestamp(),
      });
      batch.update(doc(db, 'schoolProgress', sub.schoolId, 'items', sub.itemId), {
        status: nextStatus,
        reviewNote: note,
        updatedAt: serverTimestamp(),
      });

      // Also sync matching history record(s) with same driveFileId
      for (const h of historyRecords.filter(
        (rec) => rec.submissionId === sub.id && rec.driveFileId === sub.driveFileId
      )) {
        batch.update(doc(db, 'uploadHistory', h.id), {
          status: nextStatus,
          reviewNote: note,
          updatedAt: serverTimestamp(),
        });
      }

      await batch.commit();
      setSelectedSubmission(null);
      setActionMsg(`已更新「${sub.schoolName} - ${sub.itemTitle}」審核狀態。`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `submissions/${sub.id}`);
    } finally {
      setReviewBusy(false);
    }
  };

  const handleToggleHistoryReview = async (
    rec: UploadHistoryRecord,
    nextStatus: SubmissionStatus
  ) => {
    setUpdatingHistoryId(rec.id);
    setDataError(null);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'uploadHistory', rec.id), {
        status: nextStatus,
        reviewNote: rec.reviewNote || '',
        updatedAt: serverTimestamp(),
      });

      // If this history record is the latest submission for that school+item, sync submissions & schoolProgress too
      const latestSub = submissionMap[`${rec.schoolId}__${rec.itemId}`];
      if (latestSub && latestSub.driveFileId === rec.driveFileId) {
        batch.update(doc(db, 'submissions', latestSub.id), {
          status: nextStatus,
          reviewNote: rec.reviewNote || '',
          updatedAt: serverTimestamp(),
        });
        batch.update(doc(db, 'schoolProgress', rec.schoolId, 'items', rec.itemId), {
          status: nextStatus,
          reviewNote: rec.reviewNote || '',
          updatedAt: serverTimestamp(),
        });
      }

      await batch.commit();
      setActionMsg(
        `已將「${rec.schoolName} - ${rec.fileName}」設為「${
          nextStatus === 'approved' ? '已審核' : '待審核'
        }」。`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `uploadHistory/${rec.id}`);
    } finally {
      setUpdatingHistoryId(null);
    }
  };

  const handleConfirmDeleteSubmission = async () => {
    if (!confirmDeleteSub) return;
    const target = confirmDeleteSub;
    setConfirmDeleteSub(null);
    setSelectedSubmission(null);
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'submissions', target.id));
      batch.delete(doc(db, 'schoolProgress', target.schoolId, 'items', target.itemId));
      await batch.commit();
      setActionMsg(`已移除「${target.schoolName} - ${target.itemTitle}」目前繳交狀態紀錄。`);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `submissions/${target.id}`);
    }
  };

  const handleBindAdminDriveFolder = async () => {
    setDataError(null);
    setActionMsg(null);
    const token = await getAccessToken();
    if (!token) {
      setDataError('尚未取得 Google Drive 授權，請點擊下方按鈕重新連接 Tmail 授權。');
      return;
    }

    setCreatingFolder(true);
    try {
      const folder = await createAdminCollectionFolder(
        token,
        folderNameInput.trim() || '宜蘭縣各校資料繳交彙整區'
      );
      await setDoc(doc(db, 'appSettings', 'drive'), {
        adminEmail: ADMIN_TMAIL_EMAIL,
        targetFolderId: folder.folderId,
        targetFolderName: folder.folderName,
        targetFolderUrl: folder.folderUrl,
        updatedAt: serverTimestamp(),
      });
      setActionMsg(`已在您的 Tmail 雲端硬碟建立並綁定資料夾「${folder.folderName}」。`);
    } catch (err) {
      setDataError(err instanceof Error ? err.message : '建立雲端硬碟資料夾失敗。');
    } finally {
      setCreatingFolder(false);
    }
  };

  // 1. Server Admin Password Gate
  if (authLoading) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center text-sm text-slate-500">
        正在檢查管理者驗證狀態...
      </div>
    );
  }

  if (!adminToken) {
    const isSetup = Boolean(serverStatus?.needsInitialSetup);
    return (
      <div className="max-w-md mx-auto px-4 py-14">
        <div className="bg-white border border-slate-200 rounded-xl p-8">
          <div className="flex items-center gap-2.5 text-blue-700 mb-3">
            <Lock className="w-5 h-5" />
            <span className="text-xs font-semibold tracking-wide">
              {isSetup ? '管理者初次啟用設定' : '管理者後台身分驗證'}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            {isSetup ? '建立管理者登入密碼' : '管理者後台登入'}
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed mb-6">
            {isSetup
              ? '系統偵測尚未設定環境變數密碼，請為管理者帳號（預設 yhl）設定登入密碼以完成安全啟用。'
              : '請輸入管理者帳號與密碼，進入各校上傳項目管理、上傳歷程與催辦總表。'}
          </p>

          {authError && (
            <div
              role="alert"
              className="mb-5 p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800"
            >
              {authError}
            </div>
          )}

          <form onSubmit={handleServerLoginOrSetup} className="space-y-4">
            <div>
              <label
                htmlFor="admin-username"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                管理者帳號
              </label>
              <input
                id="admin-username"
                type="text"
                required
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                className="w-full h-11 px-3.5 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600"
              />
            </div>

            <div>
              <label
                htmlFor="admin-password"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                {isSetup ? '設定管理者密碼' : '管理者密碼'}
              </label>
              <input
                id="admin-password"
                type="password"
                required
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="請輸入密碼"
                className="w-full h-11 px-3.5 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600"
              />
            </div>

            {isSetup && (
              <div>
                <label
                  htmlFor="admin-password-confirm"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  確認密碼
                </label>
                <input
                  id="admin-password-confirm"
                  type="password"
                  required
                  value={confirmPasswordInput}
                  onChange={(e) => setConfirmPasswordInput(e.target.value)}
                  placeholder="請再次輸入密碼"
                  className="w-full h-11 px-3.5 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={submittingAuth}
              className="w-full h-11 rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {submittingAuth
                ? '驗證中...'
                : isSetup
                ? '完成設定並進入後台'
                : '登入管理者後台'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-200 text-center">
            <button
              type="button"
              onClick={onBackToPortal}
              className="text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              返回一般學校上傳入口
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Require Admin Tmail Google Workspace Connection
  if (!isAdminTmailReady) {
    return (
      <div className="max-w-xl mx-auto px-4 py-14">
        <div className="bg-white border border-slate-200 rounded-xl p-8">
          <div className="flex items-center gap-2 text-blue-700 mb-3">
            <KeyRound className="w-5 h-5" />
            <span className="text-xs font-semibold">步驟 2：連結管理者 Tmail 雲端權限</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">
            請登入管理者 Tmail Google 帳號
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed mb-6">
            後台密碼已通過驗證。為確保資料庫管理權限及將檔案直接寫入您的 Tmail 雲端硬碟，請使用管理者帳號{' '}
            <span className="font-mono text-xs text-slate-900 font-semibold">
              {ADMIN_TMAIL_EMAIL}
            </span>{' '}
            完成 Google 驗證。
            {currentUserEmail && (
              <span className="block mt-2 text-amber-800">
                目前偵測到的帳號為 {currentUserEmail}，請切換為 {ADMIN_TMAIL_EMAIL}。
              </span>
            )}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onConnectAdminTmail}
              className="px-5 py-2.5 rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 transition-colors cursor-pointer whitespace-nowrap"
            >
              以 {ADMIN_TMAIL_EMAIL} 登入驗證
            </button>
            <button
              type="button"
              onClick={() => setAdminToken(null)}
              className="px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
            >
              登出後台
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Group items by Topic for Tab 3 (Item Management)
  const ungroupedItems = uploadItems.filter((it) => !it.topicId || !topicLookup[it.topicId]);

  // 3. Full Admin Console
  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top Admin Control Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <p className="text-xs font-medium text-blue-700 mb-1">
            管理者帳號：{serverStatus?.username || 'yhl'} · {ADMIN_TMAIL_EMAIL}
          </p>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            宜蘭縣各校資料繳交管理後台
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('matrix')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'matrix'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              各校繳交矩陣
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 ${
                activeTab === 'history'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              上傳歷程紀錄表
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('items')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'items'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              上傳項目管理
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('drive')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'drive'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tmail 雲端硬碟設定
            </button>
          </div>

          <button
            type="button"
            onClick={() => setAdminToken(null)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
            鎖定後台
          </button>
        </div>
      </div>

      {dataError && (
        <div
          role="alert"
          className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-sm text-red-800"
        >
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <span>{dataError}</span>
        </div>
      )}

      {actionMsg && (
        <div
          role="status"
          className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start justify-between gap-3 text-sm text-emerald-800"
        >
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <span>{actionMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionMsg(null)}
            className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TAB 1: SCHOOL × ITEM MATRIX + OVERDUE REMINDER */}
      {activeTab === 'matrix' && (
        <div className="space-y-6">
          {/* Overdue Warning & Reminder Banner */}
          {overdueItems.length > 0 && (
            <div
              role="alert"
              className="bg-red-50 border border-red-300 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-red-800 font-bold text-sm">
                  <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
                  <span>
                    催辦警示：共有 {overdueItems.length} 個項目已超過截止日期且仍有學校尚未上傳
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-red-800">
                  {overdueItems.map(({ item, missingCount }) => (
                    <span key={item.id} className="tabular-nums">
                      • <strong>{item.title}</strong>（截止 {item.deadline} · 尚缺{' '}
                      <strong>{missingCount}</strong> 校）
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setReminderModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-red-300 bg-white text-xs font-semibold text-red-800 hover:bg-red-100 cursor-pointer whitespace-nowrap"
                >
                  <BellRing className="w-3.5 h-3.5" />
                  檢視催辦明細
                </button>
                <button
                  type="button"
                  onClick={() => exportMissingSchoolsCsv(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-700 text-white text-xs font-semibold hover:bg-red-800 cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  一鍵導出逾期未上傳名單
                </button>
              </div>
            </div>
          )}

          {/* 4-Column Summary KPI Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs text-slate-500 mb-1">宜蘭縣納管學校數</div>
              <div className="text-2xl font-bold text-slate-900 tabular-nums">
                {metrics.totalSchools} <span className="text-xs font-normal text-slate-500">校</span>
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs text-slate-500 mb-1">目前開放上傳項目</div>
              <div className="text-2xl font-bold text-slate-900 tabular-nums">
                {metrics.totalActiveItems} <span className="text-xs font-normal text-slate-500">項</span>
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs text-slate-500 mb-1">已全數完成繳交學校</div>
              <div className="text-2xl font-bold text-emerald-700 tabular-nums">
                {metrics.completeSchools}{' '}
                <span className="text-xs font-normal text-slate-500">
                  / {metrics.totalSchools} 校
                </span>
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs text-slate-500 mb-1">已上傳 / 未上傳（含逾期）</div>
              <div className="text-2xl font-bold text-slate-900 tabular-nums">
                <span className="text-emerald-700">{metrics.uploadedSlots}</span>
                <span className="text-slate-300 mx-1.5">/</span>
                <span className="text-red-700">{metrics.missingSlots}</span>
                {metrics.overdueMissingSlots > 0 && (
                  <span className="block text-[11px] font-medium text-red-700 mt-0.5">
                    其中 {metrics.overdueMissingSlots} 項次已逾期
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Filters & Actions */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex flex-col xl:flex-row xl:items-center gap-3 justify-between">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 flex-1">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={schoolSearch}
                    onChange={(e) => setSchoolSearch(e.target.value)}
                    placeholder="搜尋學校名稱..."
                    className="w-full h-10 pl-9 pr-3 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-blue-600"
                  />
                </div>

                <select
                  value={townshipFilter}
                  onChange={(e) => setTownshipFilter(e.target.value)}
                  className="h-10 px-3 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-blue-600"
                >
                  <option value="全部">全部鄉鎮市</option>
                  {YILAN_TOWNSHIPS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>

                <select
                  value={levelFilter}
                  onChange={(e) => setLevelFilter(e.target.value as '全部' | SchoolLevel)}
                  className="h-10 px-3 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-blue-600"
                >
                  <option value="全部">全部學制</option>
                  <option value="國小">國小</option>
                  <option value="國中">國中</option>
                  <option value="高中職">高中職</option>
                  <option value="特教">特教</option>
                </select>

                <select
                  value={completionFilter}
                  onChange={(e) =>
                    setCompletionFilter(
                      e.target.value as 'all' | 'incomplete' | 'overdue' | 'complete'
                    )
                  }
                  className="h-10 px-3 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-blue-600"
                >
                  <option value="all">全部繳交狀態</option>
                  <option value="incomplete">尚有未上傳項目</option>
                  <option value="overdue">含逾期未上傳項目</option>
                  <option value="complete">已全數上傳完成</option>
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => exportMissingSchoolsCsv(false)}
                  disabled={activeItems.length === 0}
                  className="inline-flex items-center justify-center gap-2 px-4 h-10 rounded-lg bg-red-700 text-white text-xs font-semibold hover:bg-red-800 disabled:opacity-40 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <BellRing className="w-4 h-4" />
                  一鍵導出未上傳學校名單
                </button>
                <button
                  type="button"
                  onClick={exportCsv}
                  disabled={activeItems.length === 0}
                  className="inline-flex items-center justify-center gap-2 px-4 h-10 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Download className="w-4 h-4" />
                  匯出完整矩陣 CSV
                </button>
              </div>
            </div>

            {/* Legend */}
            <div className="mt-4 pt-4 border-t border-slate-200 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
              <span className="text-slate-500">狀態圖例：</span>
              <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                綠色：已上傳／已審核
              </span>
              <span className="inline-flex items-center gap-1.5 text-red-700 font-semibold">
                <XCircle className="w-4 h-4" />
                紅色：未上傳
              </span>
              <span className="inline-flex items-center gap-1.5 text-red-900 font-semibold">
                <AlertTriangle className="w-4 h-4" />
                深紅警示：逾期未上傳
              </span>
              <span className="inline-flex items-center gap-1.5 text-amber-700 font-semibold">
                <RotateCcw className="w-4 h-4" />
                橘黃色：退件需補件
              </span>
            </div>
          </div>

          {/* Matrix Table */}
          {activeItems.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
              <h2 className="text-base font-semibold text-slate-900 mb-2">
                尚未設定任何開放上傳的資料項目
              </h2>
              <p className="text-sm text-slate-500 mb-6">
                請先建立大主題與子項目，各校即可登入選擇並開始上傳檔案，本矩陣將即時呈現每校每項目的紅綠狀態與逾期警示。
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={handleSeedSampleHierarchy}
                  className="px-4 py-2.5 rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 cursor-pointer"
                >
                  一鍵載入多層次範例主題與項目
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('items');
                    openNewTopicForm();
                  }}
                  className="px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  手動建立大主題
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto max-h-[620px]">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-100 sticky top-0 z-20 border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4 text-xs font-semibold text-slate-700 sticky left-0 bg-slate-100 z-30 min-w-[230px] border-r border-slate-200">
                        學校名稱（{filteredSchools.length} 校）
                      </th>
                      <th className="py-3 px-3 text-xs font-semibold text-slate-700 whitespace-nowrap border-r border-slate-200">
                        完成率
                      </th>
                      {activeItems.map((item) => {
                        const overdue = isPastDeadline(item.deadline);
                        return (
                          <th
                            key={item.id}
                            className={`py-3 px-4 text-xs font-semibold min-w-[175px] border-r border-slate-200 last:border-r-0 ${
                              overdue ? 'bg-red-50/90 text-red-900' : 'text-slate-700'
                            }`}
                          >
                            {item.topicTitle && (
                              <div className="text-[11px] font-medium text-blue-700 truncate mb-0.5">
                                {item.topicTitle}
                              </div>
                            )}
                            <div className="line-clamp-2 leading-snug">{item.title}</div>
                            {item.deadline && (
                              <div
                                className={`mt-1 text-[11px] font-mono tabular-nums ${
                                  overdue ? 'text-red-700 font-bold' : 'text-slate-500 font-normal'
                                }`}
                              >
                                {overdue ? `已逾期（${item.deadline}）` : `截止：${item.deadline}`}
                              </div>
                            )}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm">
                    {filteredSchools.map((school) => {
                      const doneCount = activeItems.filter((item) => {
                        const sub = submissionMap[`${school.id}__${item.id}`];
                        return sub && (sub.status === 'uploaded' || sub.status === 'approved');
                      }).length;

                      return (
                        <tr key={school.id} className="hover:bg-slate-50/70">
                          <td className="py-2.5 px-4 sticky left-0 bg-white z-10 border-r border-slate-200">
                            <div className="font-medium text-slate-900 text-sm">
                              {school.name}
                            </div>
                            <div className="text-xs text-slate-500">
                              {school.township} · {school.level}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-xs font-mono tabular-nums text-slate-700 border-r border-slate-200 whitespace-nowrap">
                            {doneCount}/{activeItems.length}
                          </td>
                          {activeItems.map((item) => {
                            const sub = submissionMap[`${school.id}__${item.id}`];
                            const overdue = isPastDeadline(item.deadline);

                            if (!sub) {
                              return (
                                <td
                                  key={item.id}
                                  className="p-2 border-r border-slate-200 last:border-r-0"
                                >
                                  <div
                                    className={`w-full py-2 px-3 rounded-md border text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap ${
                                      overdue
                                        ? 'bg-red-100 border-red-400 text-red-900'
                                        : 'bg-red-50 border-red-200 text-red-700'
                                    }`}
                                  >
                                    {overdue ? (
                                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                    ) : (
                                      <XCircle className="w-3.5 h-3.5 shrink-0" />
                                    )}
                                    <span>{overdue ? '逾期未繳' : '未上傳'}</span>
                                  </div>
                                </td>
                              );
                            }

                            const isRejected = sub.status === 'rejected';
                            const isApproved = sub.status === 'approved';
                            return (
                              <td
                                key={item.id}
                                className="p-2 border-r border-slate-200 last:border-r-0"
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedSubmission(sub);
                                    setReviewNoteInput(sub.reviewNote || '');
                                  }}
                                  className={`w-full py-2 px-3 rounded-md border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                                    isRejected
                                      ? 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
                                      : isApproved
                                      ? 'bg-emerald-100 border-emerald-400 text-emerald-900 hover:bg-emerald-200/70'
                                      : 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                                  }`}
                                  title={`${sub.fileName}（點擊檢視與審核）`}
                                >
                                  {isRejected ? (
                                    <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                                  ) : isApproved ? (
                                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                  ) : (
                                    <Clock className="w-3.5 h-3.5 shrink-0" />
                                  )}
                                  <span>
                                    {isApproved ? '已審核' : isRejected ? '需補件' : '待審核'}
                                  </span>
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: UPLOAD HISTORY LOG TABLE */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  上傳歷程紀錄表
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  依時間序列完整保留各校每次上傳之檔案紀錄、雲端下載連結，並可即時切換「已審核／待審核」確認檔案內容。
                </p>
              </div>
              <button
                type="button"
                onClick={exportHistoryCsv}
                disabled={filteredHistory.length === 0}
                className="inline-flex items-center gap-2 px-4 h-10 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Download className="w-4 h-4" />
                匯出歷程 CSV
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="搜尋學校、檔名或上傳者..."
                  className="w-full h-10 pl-9 pr-3 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-blue-600"
                />
              </div>

              <select
                value={historyItemFilter}
                onChange={(e) => setHistoryItemFilter(e.target.value)}
                className="h-10 px-3 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-blue-600"
              >
                <option value="all">全部上傳項目</option>
                {uploadItems.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.topicTitle ? `${it.topicTitle} / ` : ''}
                    {it.title}
                  </option>
                ))}
              </select>

              <select
                value={historyStatusFilter}
                onChange={(e) =>
                  setHistoryStatusFilter(e.target.value as 'all' | SubmissionStatus)
                }
                className="h-10 px-3 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-blue-600"
              >
                <option value="all">全部審核狀態</option>
                <option value="uploaded">待審核</option>
                <option value="approved">已審核</option>
                <option value="rejected">退件需補件</option>
              </select>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {filteredHistory.length === 0 ? (
              <div className="py-16 px-6 text-center text-sm text-slate-500">
                目前尚無符合條件的上傳歷程紀錄。當學校上傳檔案後，此處會自動紀錄時間、檔案名稱、下載連結與審核狀態。
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-100 border-b border-slate-200 text-xs font-semibold text-slate-700">
                    <tr>
                      <th className="py-3 px-4 whitespace-nowrap">上傳時間</th>
                      <th className="py-3 px-4 whitespace-nowrap">學校名稱</th>
                      <th className="py-3 px-4 min-w-[200px]">主題 / 項目名稱</th>
                      <th className="py-3 px-4 min-w-[220px]">檔案名稱 / 大小</th>
                      <th className="py-3 px-4 whitespace-nowrap">上傳承辦人</th>
                      <th className="py-3 px-4 whitespace-nowrap">檔案檢視 / 下載</th>
                      <th className="py-3 px-4 whitespace-nowrap">審核狀態</th>
                      <th className="py-3 px-4 whitespace-nowrap text-right">審核操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm">
                    {filteredHistory.map((rec) => {
                      const isBusy = updatingHistoryId === rec.id;
                      const isApproved = rec.status === 'approved';
                      const isRejected = rec.status === 'rejected';

                      return (
                        <tr key={rec.id} className="hover:bg-slate-50/70">
                          <td className="py-3 px-4 text-xs font-mono tabular-nums text-slate-600 whitespace-nowrap">
                            {formatDateTime(rec.createdAt)}
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-900 whitespace-nowrap">
                            {rec.schoolName}
                          </td>
                          <td className="py-3 px-4">
                            {rec.topicTitle && (
                              <div className="text-[11px] text-blue-700 font-medium">
                                {rec.topicTitle}
                              </div>
                            )}
                            <div className="text-sm text-slate-900">{rec.itemTitle}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-sm font-medium text-slate-900 break-all">
                              {rec.fileName}
                            </div>
                            <div className="text-xs font-mono tabular-nums text-slate-500">
                              {formatBytes(rec.fileSize)}
                            </div>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="text-xs font-medium text-slate-900">
                              {rec.uploadedByName}
                            </div>
                            <div className="text-[11px] font-mono text-slate-500">
                              {rec.uploadedByEmail}
                            </div>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <a
                                href={rec.driveWebViewLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                檢視
                              </a>
                              <a
                                href={getDriveDownloadUrl(rec.driveFileId)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-blue-200 bg-blue-50 text-xs font-medium text-blue-800 hover:bg-blue-100"
                              >
                                <Download className="w-3.5 h-3.5" />
                                下載
                              </a>
                            </div>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            {isApproved ? (
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                                <CheckCircle2 className="w-4 h-4" />
                                已審核
                              </span>
                            ) : isRejected ? (
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                                <RotateCcw className="w-4 h-4" />
                                退件需補件
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                                <Clock className="w-4 h-4 text-amber-600" />
                                待審核
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-right">
                            <div className="inline-flex items-center gap-1.5">
                              {isApproved ? (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => handleToggleHistoryReview(rec, 'uploaded')}
                                  className="px-3 py-1.5 rounded-md border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                                >
                                  改為待審核
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => handleToggleHistoryReview(rec, 'approved')}
                                  className="px-3 py-1.5 rounded-md bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 disabled:opacity-50 cursor-pointer"
                                >
                                  確認已審核
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: MULTI-LEVEL TOPIC & SUB-ITEM MANAGER */}
      {activeTab === 'items' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                多層次上傳項目設定（大主題 → 子項目）
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                先建立「大主題」，再於主題下新增多個需要上傳檔案的「子項目」與截止日期，各校畫面將依層次分類呈現。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {uploadTopics.length === 0 && uploadItems.length === 0 && (
                <button
                  type="button"
                  onClick={handleSeedSampleHierarchy}
                  className="px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
                >
                  載入範例主題與項目
                </button>
              )}
              <button
                type="button"
                onClick={openNewTopicForm}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-800 text-sm font-semibold hover:bg-blue-100 transition-colors cursor-pointer whitespace-nowrap"
              >
                <FolderPlus className="w-4 h-4" />
                新增大主題
              </button>
              <button
                type="button"
                onClick={() => openNewItemForm()}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                新增子項目
              </button>
            </div>
          </div>

          {/* Topic Editor Form */}
          {topicFormOpen && (
            <form
              onSubmit={handleSaveTopic}
              className="bg-white border border-blue-300 rounded-xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <h3 className="text-base font-semibold text-slate-900">
                  {editingTopicId ? '編輯大主題' : '新增大主題'}
                </h3>
                <button
                  type="button"
                  onClick={() => setTopicFormOpen(false)}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    大主題名稱 *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={FIELD_LIMITS.TITLE_MAX}
                    value={topicTitle}
                    onChange={(e) => setTopicTitle(e.target.value)}
                    placeholder="例如：115學年度校務評鑑與發展計畫"
                    className="w-full h-11 px-3.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    排序順序
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={9999}
                    required
                    value={topicSortOrder}
                    onChange={(e) => setTopicSortOrder(Number(e.target.value))}
                    className="w-full h-11 px-3.5 text-sm bg-slate-50 border border-slate-200 rounded-lg tabular-nums focus:outline-none focus:bg-white focus:border-blue-600"
                  />
                </div>
                <div className="md:col-span-4">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    主題說明（選填）
                  </label>
                  <input
                    type="text"
                    maxLength={FIELD_LIMITS.DESCRIPTION_MAX}
                    value={topicDesc}
                    onChange={(e) => setTopicDesc(e.target.value)}
                    placeholder="簡要說明此大主題包含的填報範圍..."
                    className="w-full h-11 px-3.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={topicActive}
                    onChange={(e) => setTopicActive(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-700"
                  />
                  啟用此大主題（停用後其下所有子項目將暫時對學校隱藏）
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTopicFormOpen(false)}
                    className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={savingTopic}
                    className="px-5 py-2 rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 disabled:opacity-50 cursor-pointer"
                  >
                    {savingTopic ? '儲存中...' : editingTopicId ? '儲存主題變更' : '建立大主題'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Sub-item Editor Form */}
          {itemFormOpen && (
            <form
              onSubmit={handleSaveItem}
              className="bg-white border border-blue-200 rounded-xl p-6 space-y-5"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <h3 className="text-base font-semibold text-slate-900">
                  {editingItemId ? '編輯子項目（上傳檔案設定）' : '新增子項目（上傳檔案設定）'}
                </h3>
                <button
                  type="button"
                  onClick={() => setItemFormOpen(false)}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    所屬大主題
                  </label>
                  <select
                    value={itemTopicId}
                    onChange={(e) => setItemTopicId(e.target.value)}
                    className="w-full h-11 px-3.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-blue-600"
                  >
                    <option value="">不歸類（顯示於一般繳交項目）</option>
                    {uploadTopics.map((t) => (
                      <option key={t.id} value={t.id}>
                        #{t.sortOrder} {t.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    子項目名稱 *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={FIELD_LIMITS.TITLE_MAX}
                    value={itemTitle}
                    onChange={(e) => setItemTitle(e.target.value)}
                    placeholder="例如：校務發展自我評鑑總表（核章版）"
                    className="w-full h-11 px-3.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-blue-600"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    填報／上傳說明
                  </label>
                  <textarea
                    rows={3}
                    maxLength={FIELD_LIMITS.DESCRIPTION_MAX}
                    value={itemDesc}
                    onChange={(e) => setItemDesc(e.target.value)}
                    placeholder="說明檔案命名規範、核章要求或注意事項..."
                    className="w-full p-3.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    允許副檔名（逗號分隔，或填「不限格式」）
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={FIELD_LIMITS.ACCEPTED_FORMATS_MAX}
                    value={itemFormats}
                    onChange={(e) => setItemFormats(e.target.value)}
                    placeholder="pdf, docx, xlsx"
                    className="w-full h-11 px-3.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-blue-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      檔案上限（MB）
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      required
                      value={itemMaxMB}
                      onChange={(e) => setItemMaxMB(Number(e.target.value))}
                      className="w-full h-11 px-3.5 text-sm bg-slate-50 border border-slate-200 rounded-lg tabular-nums focus:outline-none focus:bg-white focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      顯示排序
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={9999}
                      required
                      value={itemSortOrder}
                      onChange={(e) => setItemSortOrder(Number(e.target.value))}
                      className="w-full h-11 px-3.5 text-sm bg-slate-50 border border-slate-200 rounded-lg tabular-nums focus:outline-none focus:bg-white focus:border-blue-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    繳交截止日期（設定後逾期將自動於後台紅色警示）
                  </label>
                  <input
                    type="date"
                    value={itemDeadline}
                    onChange={(e) => setItemDeadline(e.target.value)}
                    className="w-full h-11 px-3.5 text-sm bg-slate-50 border border-slate-200 rounded-lg tabular-nums focus:outline-none focus:bg-white focus:border-blue-600"
                  />
                </div>

                <div className="flex items-center gap-6 pt-5">
                  <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={itemRequired}
                      onChange={(e) => setItemRequired(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-blue-700"
                    />
                    必繳項目
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={itemActive}
                      onChange={(e) => setItemActive(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-blue-700"
                    />
                    開放學校上傳
                  </label>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setItemFormOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={savingItem}
                  className="px-5 py-2 rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 disabled:opacity-50 cursor-pointer"
                >
                  {savingItem ? '儲存中...' : editingItemId ? '儲存變更' : '建立子項目'}
                </button>
              </div>
            </form>
          )}

          {/* Hierarchical Topic -> Sub-items List */}
          <div className="space-y-5">
            {uploadTopics.map((topic) => {
              const children = uploadItems.filter((it) => it.topicId === topic.id);
              return (
                <div
                  key={topic.id}
                  className="bg-white border border-slate-200 rounded-xl overflow-hidden"
                >
                  <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-1">
                        <FolderOpen className="w-4 h-4 text-blue-700" />
                        <span className="font-mono tabular-nums">主題 #{topic.sortOrder}</span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={`font-semibold ${
                            topic.active ? 'text-emerald-700' : 'text-slate-500'
                          }`}
                        >
                          {topic.active ? '啟用中' : '已停用'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">共 {children.length} 個子項目</span>
                      </div>
                      <h3 className="text-base font-bold text-slate-900">{topic.title}</h3>
                      {topic.description && (
                        <p className="text-xs text-slate-600 mt-0.5">{topic.description}</p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => openNewItemForm(topic.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-700 text-white text-xs font-semibold hover:bg-blue-800 cursor-pointer whitespace-nowrap"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        在此主題新增子項目
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditTopicForm(topic)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        編輯主題
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteTopic(topic)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 bg-white text-xs font-medium text-red-700 hover:bg-red-50 cursor-pointer whitespace-nowrap"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        刪除
                      </button>
                    </div>
                  </div>

                  {children.length === 0 ? (
                    <div className="p-8 text-center text-sm text-slate-500">
                      此大主題下尚未建立需要上傳檔案的子項目，請點擊「在此主題新增子項目」。
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-200">
                      {children.map((item) => {
                        const overdue = isPastDeadline(item.deadline);
                        return (
                          <div
                            key={item.id}
                            className="px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:bg-slate-50/50"
                          >
                            <div className="space-y-1 pl-4">
                              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500">
                                <span className="font-mono tabular-nums text-slate-400">
                                  #{item.sortOrder}
                                </span>
                                <span
                                  className={`font-semibold ${
                                    item.active ? 'text-emerald-700' : 'text-slate-500'
                                  }`}
                                >
                                  {item.active ? '開放上傳中' : '已停用'}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span>{item.isRequired ? '必繳' : '選繳'}</span>
                                <span aria-hidden="true">·</span>
                                <span>格式：{item.acceptedFormats}</span>
                                <span aria-hidden="true">·</span>
                                <span className="tabular-nums">上限 {item.maxSizeMB} MB</span>
                                {item.deadline && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span
                                      className={`tabular-nums ${
                                        overdue ? 'text-red-700 font-semibold' : ''
                                      }`}
                                    >
                                      期限：{item.deadline}
                                      {overdue ? '（已逾期）' : ''}
                                    </span>
                                  </>
                                )}
                              </div>
                              <h4 className="text-sm font-semibold text-slate-900">
                                {item.title}
                              </h4>
                              {item.description && (
                                <p className="text-xs text-slate-600">{item.description}</p>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => openEditItemForm(item)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                編輯
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteItem(item)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-xs font-medium text-red-700 hover:bg-red-50 cursor-pointer whitespace-nowrap"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                刪除
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {ungroupedItems.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
                  <h3 className="text-base font-semibold text-slate-900">
                    一般／未歸類上傳項目（{ungroupedItems.length} 項）
                  </h3>
                </div>
                <div className="divide-y divide-slate-200">
                  {ungroupedItems.map((item) => (
                    <div
                      key={item.id}
                      className="px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500">
                          <span className="font-mono tabular-nums text-slate-400">
                            #{item.sortOrder}
                          </span>
                          <span
                            className={`font-semibold ${
                              item.active ? 'text-emerald-700' : 'text-slate-500'
                            }`}
                          >
                            {item.active ? '開放上傳中' : '已停用'}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>格式：{item.acceptedFormats}</span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">上限 {item.maxSizeMB} MB</span>
                          {item.deadline && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="tabular-nums">期限：{item.deadline}</span>
                            </>
                          )}
                        </div>
                        <h4 className="text-sm font-semibold text-slate-900">{item.title}</h4>
                        {item.description && (
                          <p className="text-xs text-slate-600">{item.description}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEditItemForm(item)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          編輯
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteItem(item)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-xs font-medium text-red-700 hover:bg-red-50 cursor-pointer whitespace-nowrap"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          刪除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {uploadTopics.length === 0 && uploadItems.length === 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-sm text-slate-500">
                目前尚未建立任何大主題或子項目，請點擊右上角「新增大主題」或「載入範例主題與項目」。
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: TMAIL GOOGLE DRIVE SETTINGS */}
      {activeTab === 'drive' && (
        <div className="max-w-3xl bg-white border border-slate-200 rounded-xl p-8 space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-1">
              管理者 Tmail Google 雲端硬碟接收設定
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              各校透過本平台上傳的檔案，皆會自動設定共用權限給管理者帳號（
              <span className="font-mono text-xs text-slate-900">{ADMIN_TMAIL_EMAIL}</span>
              ）。您也可在此建立一個專屬的「雲端硬碟彙整資料夾」，讓學校上傳時直接集中存放至該資料夾。
            </p>
          </div>

          {!hasDriveToken && (
            <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-between gap-4">
              <span className="text-xs text-amber-900">
                建立雲端硬碟資料夾前，請先授權 Google Drive 存取權限。
              </span>
              <button
                type="button"
                onClick={onConnectAdminTmail}
                className="px-3.5 py-2 rounded-lg bg-amber-700 text-white text-xs font-semibold hover:bg-amber-800 cursor-pointer whitespace-nowrap"
              >
                授權 Google Drive
              </button>
            </div>
          )}

          {driveSettings?.targetFolderId && (
            <div className="p-5 rounded-lg bg-emerald-50/70 border border-emerald-200 space-y-2">
              <div className="text-xs font-semibold text-emerald-800">
                目前已綁定的 Tmail 雲端硬碟彙整資料夾
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    {driveSettings.targetFolderName}
                  </p>
                  <p className="text-xs font-mono text-slate-500 mt-0.5">
                    Folder ID: {driveSettings.targetFolderId}
                  </p>
                </div>
                <a
                  href={driveSettings.targetFolderUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white border border-emerald-300 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 whitespace-nowrap"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  開啟 Google 雲端硬碟資料夾
                </a>
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-slate-200 space-y-4">
            <div>
              <label
                htmlFor="drive-folder-name"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                建立或連結彙整資料夾名稱
              </label>
              <input
                id="drive-folder-name"
                type="text"
                value={folderNameInput}
                onChange={(e) => setFolderNameInput(e.target.value)}
                className="w-full h-11 px-3.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-blue-600"
              />
            </div>
            <button
              type="button"
              disabled={creatingFolder}
              onClick={handleBindAdminDriveFolder}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 disabled:opacity-50 cursor-pointer"
            >
              <FolderPlus className="w-4 h-4" />
              <span>
                {creatingFolder
                  ? '正在建立資料夾並設定共用...'
                  : '在 Tmail 雲端硬碟建立／綁定彙整資料夾'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Reminder Preview Modal */}
      {reminderModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full p-6 space-y-4">
            <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  尚未上傳學校催辦明細（{missingSchoolsSummary.length} 校）
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  可直接複製下方文字發送群組公告，或一鍵下載 CSV 名單辦理催繳聯繫。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReminderModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-[340px] overflow-y-auto bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-800 whitespace-pre-wrap leading-relaxed font-sans">
              {reminderNoticeText || '目前所有學校皆已完成上傳！'}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (!reminderNoticeText) return;
                  void navigator.clipboard.writeText(reminderNoticeText);
                  setReminderCopied(true);
                  setTimeout(() => setReminderCopied(false), 2000);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                {reminderCopied ? '已複製催辦文字' : '複製催辦公告文字'}
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => exportMissingSchoolsCsv(false)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-700 text-white text-xs font-semibold hover:bg-red-800 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  匯出 CSV 名單
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Submission Review / Detail Modal */}
      {selectedSubmission && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 space-y-5">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <p className="text-xs text-slate-500 mb-1">{selectedSubmission.itemTitle}</p>
                <h3 className="text-lg font-bold text-slate-900">
                  {selectedSubmission.schoolName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSubmission(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">檔案名稱</span>
                <span className="font-medium text-slate-900 text-right break-all">
                  {selectedSubmission.fileName}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">檔案大小</span>
                <span className="font-mono tabular-nums text-slate-900">
                  {formatBytes(selectedSubmission.fileSize)}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">上傳承辦人</span>
                <span className="text-slate-900 text-right">
                  {selectedSubmission.uploadedByName}（
                  <span className="font-mono text-xs">{selectedSubmission.uploadedByEmail}</span>）
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">上傳時間</span>
                <span className="font-mono tabular-nums text-slate-900">
                  {formatDateTime(selectedSubmission.updatedAt)}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">目前審核狀態</span>
                <span className="font-semibold text-slate-900">
                  {selectedSubmission.status === 'approved'
                    ? '已審核'
                    : selectedSubmission.status === 'rejected'
                    ? '退件需補件'
                    : '待審核'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <a
                href={selectedSubmission.driveWebViewLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                線上檢視檔案
              </a>
              <a
                href={getDriveDownloadUrl(selectedSubmission.driveFileId)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-blue-200 bg-blue-50 text-xs font-semibold text-blue-800 hover:bg-blue-100 transition-colors"
              >
                <Download className="w-4 h-4" />
                下載檔案確認
              </a>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                審核備註／退件原因（選填）
              </label>
              <textarea
                rows={2}
                maxLength={FIELD_LIMITS.REVIEW_NOTE_MAX}
                value={reviewNoteInput}
                onChange={(e) => setReviewNoteInput(e.target.value)}
                placeholder="例如：檔案內容正確無誤，或請補上校長核章頁..."
                className="w-full p-3 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-blue-600"
              />
            </div>

            <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                disabled={reviewBusy}
                onClick={() => setConfirmDeleteSub(selectedSubmission)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 text-xs font-semibold text-red-700 hover:bg-red-50 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                刪除紀錄
              </button>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={reviewBusy}
                  onClick={() => handleUpdateSubmissionReview(selectedSubmission, 'uploaded')}
                  className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  設為待審核
                </button>
                <button
                  type="button"
                  disabled={reviewBusy}
                  onClick={() => handleUpdateSubmissionReview(selectedSubmission, 'rejected')}
                  className="px-3 py-2 rounded-lg border border-amber-300 bg-amber-50 text-xs font-semibold text-amber-800 hover:bg-amber-100 cursor-pointer"
                >
                  退件要求補件
                </button>
                <button
                  type="button"
                  disabled={reviewBusy}
                  onClick={() => handleUpdateSubmissionReview(selectedSubmission, 'approved')}
                  className="px-4 py-2 rounded-lg bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 cursor-pointer"
                >
                  確認已審核
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Topic Confirmation Dialog */}
      {confirmDeleteTopic && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-2">確認刪除此大主題？</h3>
            <p className="text-sm text-slate-600 mb-5">
              您確定要刪除大主題「<strong className="text-slate-900">{confirmDeleteTopic.title}</strong>
              」嗎？其下的子項目將會保留並移至「一般／未歸類上傳項目」。
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDeleteTopic(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteTopic}
                className="px-4 py-2 rounded-lg bg-red-700 text-white text-sm font-semibold hover:bg-red-800 cursor-pointer"
              >
                確認刪除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Item Confirmation Dialog */}
      {confirmDeleteItem && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-2">確認刪除此上傳項目？</h3>
            <p className="text-sm text-slate-600 mb-5">
              您確定要刪除項目「<strong className="text-slate-900">{confirmDeleteItem.title}</strong>
              」嗎？刪除後各校將無法再檢視或上傳此項目。
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDeleteItem(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteItem}
                className="px-4 py-2 rounded-lg bg-red-700 text-white text-sm font-semibold hover:bg-red-800 cursor-pointer"
              >
                確認刪除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Submission Confirmation Dialog */}
      {confirmDeleteSub && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-2">確認移除繳交紀錄？</h3>
            <p className="text-sm text-slate-600 mb-5">
              將移除「<strong className="text-slate-900">{confirmDeleteSub.schoolName}</strong>」於項目「
              {confirmDeleteSub.itemTitle}」的目前繳交狀態，使其回復為未上傳（紅色）狀態。
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDeleteSub(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSubmission}
                className="px-4 py-2 rounded-lg bg-red-700 text-white text-sm font-semibold hover:bg-red-800 cursor-pointer"
              >
                確認移除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
