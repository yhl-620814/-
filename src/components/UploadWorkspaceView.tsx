import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileUp,
  FolderOpen,
  FolderSync,
  Mail,
  RefreshCw,
  RotateCcw,
  Upload,
  XCircle,
} from 'lucide-react';
import {
  auth,
  db,
  getAccessToken,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase';
import { uploadSchoolFileToDrive } from '../lib/drive';
import {
  AppDriveSettings,
  FIELD_LIMITS,
  SchoolItemStatus,
  UploadItem,
  UploadTopic,
  UserProfile,
} from '../types';

interface UploadWorkspaceViewProps {
  profile: UserProfile;
  hasDriveToken: boolean;
  onRefreshDriveAuth: () => Promise<void>;
  onChangeSchool: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatTimestamp(ts?: { toDate?: () => Date }): string {
  if (!ts?.toDate) return '剛剛';
  const d = ts.toDate();
  return d.toLocaleString('zh-TW', {
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

export const UploadWorkspaceView: React.FC<UploadWorkspaceViewProps> = ({
  profile,
  hasDriveToken,
  onRefreshDriveAuth,
  onChangeSchool,
}) => {
  const [topics, setTopics] = useState<UploadTopic[]>([]);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [statusMap, setStatusMap] = useState<Record<string, SchoolItemStatus | null>>({});
  const [driveSettings, setDriveSettings] = useState<AppDriveSettings | null>(null);

  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState<string | null>(null);
  const [pendingOverwrite, setPendingOverwrite] = useState<{
    item: UploadItem;
    file: File;
    existingFileName: string;
  } | null>(null);

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Subscribe to uploadTopics
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'uploadTopics'),
      (snapshot) => {
        const list: UploadTopic[] = [];
        snapshot.forEach((docSnap) => {
          const t = docSnap.data() as UploadTopic;
          if (t.active) list.push(t);
        });
        list.sort((a, b) => a.sortOrder - b.sortOrder);
        setTopics(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'uploadTopics');
      }
    );
    return () => unsub();
  }, []);

  // Subscribe to active upload items
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'uploadItems'),
      (snapshot) => {
        const list: UploadItem[] = [];
        snapshot.forEach((docSnap) => {
          const item = docSnap.data() as UploadItem;
          if (item.active) {
            list.push(item);
          }
        });
        list.sort((a, b) => a.sortOrder - b.sortOrder);
        setItems(list);
        setLoadingItems(false);
      },
      (error) => {
        setLoadingItems(false);
        handleFirestoreError(error, OperationType.LIST, 'uploadItems');
      }
    );

    return () => unsub();
  }, []);

  // Subscribe to shared Drive target folder setting
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'appSettings', 'drive'),
      (snap) => {
        if (snap.exists()) {
          setDriveSettings(snap.data() as AppDriveSettings);
        } else {
          setDriveSettings(null);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'appSettings/drive');
      }
    );
    return () => unsub();
  }, []);

  // Subscribe to each active item's per-school status doc (uses single-doc GET, compliant with Pillar 8)
  useEffect(() => {
    if (!profile.schoolId || items.length === 0) {
      setStatusMap({});
      return;
    }

    const unsubscribers = items.map((item) => {
      const path = `schoolProgress/${profile.schoolId}/items/${item.id}`;
      return onSnapshot(
        doc(db, 'schoolProgress', profile.schoolId, 'items', item.id),
        (snap) => {
          setStatusMap((prev) => ({
            ...prev,
            [item.id]: snap.exists() ? (snap.data() as SchoolItemStatus) : null,
          }));
        },
        (error) => {
          handleFirestoreError(error, OperationType.GET, path);
        }
      );
    });

    return () => {
      unsubscribers.forEach((u) => u());
    };
  }, [profile.schoolId, items]);

  // Group items hierarchically by active Topic
  const groupedSections = useMemo(() => {
    const topicMap = new Map<string, UploadTopic>();
    for (const t of topics) {
      topicMap.set(t.id, t);
    }

    const sections: Array<{
      id: string;
      title: string;
      description: string;
      items: UploadItem[];
    }> = [];

    for (const topic of topics) {
      const topicItems = items.filter((it) => it.topicId === topic.id);
      if (topicItems.length > 0) {
        sections.push({
          id: topic.id,
          title: topic.title,
          description: topic.description,
          items: topicItems,
        });
      }
    }

    const ungrouped = items.filter((it) => !it.topicId || !topicMap.has(it.topicId));
    if (ungrouped.length > 0) {
      sections.push({
        id: '__general',
        title: topics.length > 0 ? '其他未歸類繳交項目' : '應繳交資料項目清單',
        description: '',
        items: ungrouped,
      });
    }

    return sections;
  }, [topics, items]);

  const completedCount = useMemo(() => {
    return items.filter((item) => {
      const st = statusMap[item.id];
      return st && (st.status === 'uploaded' || st.status === 'approved');
    }).length;
  }, [items, statusMap]);

  const validateFileForItem = (item: UploadItem, file: File): string | null => {
    if (file.name.length > FIELD_LIMITS.FILENAME_MAX) {
      return `檔名過長（最多 ${FIELD_LIMITS.FILENAME_MAX} 字元），請縮短檔名後再上傳。`;
    }
    const maxBytes = item.maxSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
      return `檔案大小超過上限（${formatBytes(file.size)} > ${item.maxSizeMB} MB）。`;
    }
    if (item.acceptedFormats && item.acceptedFormats !== '不限格式') {
      const allowedExts = item.acceptedFormats
        .split(/[,，、\s]+/)
        .map((s) => s.trim().toLowerCase().replace(/^\./, ''))
        .filter(Boolean);
      if (allowedExts.length > 0 && !allowedExts.includes('不限') && !allowedExts.includes('*')) {
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        if (!allowedExts.includes(ext)) {
          return `檔案格式不符，此項目僅接受：${item.acceptedFormats}`;
        }
      }
    }
    return null;
  };

  const executeUpload = async (item: UploadItem, file: File) => {
    setUploadError(null);
    setUploadSuccessMsg(null);

    const token = await getAccessToken();
    if (!token) {
      setUploadError('尚未取得 Google Drive 上傳授權，請先點擊上方「重新授權 Google 雲端硬碟」。');
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser || !currentUser.email) {
      setUploadError('登入狀態已失效，請重新登入 Tmail。');
      return;
    }

    setUploadingItemId(item.id);
    try {
      const driveRes = await uploadSchoolFileToDrive(token, file, {
        schoolName: profile.schoolName,
        itemTitle: item.title,
        targetFolderId: driveSettings?.targetFolderId || undefined,
        uploaderEmail: currentUser.email,
      });

      const submissionId = `${profile.schoolId}__${item.id}`;
      const historyId = `hist_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const submissionRef = doc(db, 'submissions', submissionId);
      const progressRef = doc(db, 'schoolProgress', profile.schoolId, 'items', item.id);
      const historyRef = doc(db, 'uploadHistory', historyId);

      const batch = writeBatch(db);
      const existingProgress = statusMap[item.id];
      const topicTitle = (item.topicTitle || '').slice(0, FIELD_LIMITS.TITLE_MAX);

      if (existingProgress) {
        batch.update(submissionRef, {
          itemTitle: item.title.slice(0, FIELD_LIMITS.TITLE_MAX),
          fileName: file.name.slice(0, FIELD_LIMITS.FILENAME_MAX),
          fileSize: file.size,
          mimeType: driveRes.mimeType.slice(0, 120),
          driveFileId: driveRes.fileId.slice(0, 128),
          driveWebViewLink: driveRes.webViewLink.slice(0, 500),
          sharedWithAdmin: driveRes.sharedWithAdmin,
          uploadedByUid: currentUser.uid,
          uploadedByEmail: currentUser.email,
          uploadedByName: profile.displayName.slice(0, 120),
          status: 'uploaded',
          reviewNote: '',
          updatedAt: serverTimestamp(),
        });
      } else {
        batch.set(submissionRef, {
          id: submissionId,
          schoolId: profile.schoolId,
          schoolName: profile.schoolName,
          itemId: item.id,
          itemTitle: item.title.slice(0, FIELD_LIMITS.TITLE_MAX),
          fileName: file.name.slice(0, FIELD_LIMITS.FILENAME_MAX),
          fileSize: file.size,
          mimeType: driveRes.mimeType.slice(0, 120),
          driveFileId: driveRes.fileId.slice(0, 128),
          driveWebViewLink: driveRes.webViewLink.slice(0, 500),
          sharedWithAdmin: driveRes.sharedWithAdmin,
          uploadedByUid: currentUser.uid,
          uploadedByEmail: currentUser.email,
          uploadedByName: profile.displayName.slice(0, 120),
          status: 'uploaded',
          reviewNote: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      batch.set(progressRef, {
        schoolId: profile.schoolId,
        itemId: item.id,
        status: 'uploaded',
        fileName: file.name.slice(0, FIELD_LIMITS.FILENAME_MAX),
        fileSize: file.size,
        driveFileId: driveRes.fileId.slice(0, 128),
        driveWebViewLink: driveRes.webViewLink.slice(0, 500),
        uploadedByUid: currentUser.uid,
        uploadedByName: profile.displayName.slice(0, 120),
        reviewNote: '',
        updatedAt: serverTimestamp(),
      });

      batch.set(historyRef, {
        id: historyId,
        submissionId,
        schoolId: profile.schoolId,
        schoolName: profile.schoolName,
        topicTitle,
        itemId: item.id,
        itemTitle: item.title.slice(0, FIELD_LIMITS.TITLE_MAX),
        fileName: file.name.slice(0, FIELD_LIMITS.FILENAME_MAX),
        fileSize: file.size,
        mimeType: driveRes.mimeType.slice(0, 120),
        driveFileId: driveRes.fileId.slice(0, 128),
        driveWebViewLink: driveRes.webViewLink.slice(0, 500),
        uploadedByUid: currentUser.uid,
        uploadedByEmail: currentUser.email,
        uploadedByName: profile.displayName.slice(0, 120),
        status: 'uploaded',
        reviewNote: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      try {
        await batch.commit();
      } catch (fsErr) {
        // Fallback: if submission didn't exist yet even though progress existed, setDoc directly
        try {
          await setDoc(submissionRef, {
            id: submissionId,
            schoolId: profile.schoolId,
            schoolName: profile.schoolName,
            itemId: item.id,
            itemTitle: item.title.slice(0, FIELD_LIMITS.TITLE_MAX),
            fileName: file.name.slice(0, FIELD_LIMITS.FILENAME_MAX),
            fileSize: file.size,
            mimeType: driveRes.mimeType.slice(0, 120),
            driveFileId: driveRes.fileId.slice(0, 128),
            driveWebViewLink: driveRes.webViewLink.slice(0, 500),
            sharedWithAdmin: driveRes.sharedWithAdmin,
            uploadedByUid: currentUser.uid,
            uploadedByEmail: currentUser.email,
            uploadedByName: profile.displayName.slice(0, 120),
            status: 'uploaded',
            reviewNote: '',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          await setDoc(progressRef, {
            schoolId: profile.schoolId,
            itemId: item.id,
            status: 'uploaded',
            fileName: file.name.slice(0, FIELD_LIMITS.FILENAME_MAX),
            fileSize: file.size,
            driveFileId: driveRes.fileId.slice(0, 128),
            driveWebViewLink: driveRes.webViewLink.slice(0, 500),
            uploadedByUid: currentUser.uid,
            uploadedByName: profile.displayName.slice(0, 120),
            reviewNote: '',
            updatedAt: serverTimestamp(),
          });
          await setDoc(historyRef, {
            id: historyId,
            submissionId,
            schoolId: profile.schoolId,
            schoolName: profile.schoolName,
            topicTitle,
            itemId: item.id,
            itemTitle: item.title.slice(0, FIELD_LIMITS.TITLE_MAX),
            fileName: file.name.slice(0, FIELD_LIMITS.FILENAME_MAX),
            fileSize: file.size,
            mimeType: driveRes.mimeType.slice(0, 120),
            driveFileId: driveRes.fileId.slice(0, 128),
            driveWebViewLink: driveRes.webViewLink.slice(0, 500),
            uploadedByUid: currentUser.uid,
            uploadedByEmail: currentUser.email,
            uploadedByName: profile.displayName.slice(0, 120),
            status: 'uploaded',
            reviewNote: '',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (retryErr) {
          handleFirestoreError(retryErr ?? fsErr, OperationType.WRITE, `submissions/${submissionId}`);
        }
      }

      setUploadSuccessMsg(`「${item.title}」已成功上傳至 Tmail 雲端硬碟並完成繳交登記。`);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : '檔案上傳失敗，請稍後再試。');
    } finally {
      setUploadingItemId(null);
      if (fileInputRefs.current[item.id]) {
        fileInputRefs.current[item.id]!.value = '';
      }
    }
  };

  const handleFileSelected = (item: UploadItem, file: File | undefined) => {
    if (!file) return;
    setUploadError(null);
    setUploadSuccessMsg(null);

    const validationError = validateFileForItem(item, file);
    if (validationError) {
      setUploadError(validationError);
      if (fileInputRefs.current[item.id]) {
        fileInputRefs.current[item.id]!.value = '';
      }
      return;
    }

    const existing = statusMap[item.id];
    if (existing) {
      if (existing.status === 'approved') {
        setUploadError('此項目已由管理者審核通過，如需異動請聯繫管理者退回。');
        return;
      }
      setPendingOverwrite({
        item,
        file,
        existingFileName: existing.fileName,
      });
      return;
    }

    void executeUpload(item, file);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top School & Tmail Identity Banner (Strictly at top of Upload Interface) */}
      <section
        aria-label="服務學校與 Tmail 帳號資訊"
        className="bg-white border border-slate-200 rounded-xl p-6 mb-6"
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5 text-slate-700 font-medium">
                <Building2 className="w-3.5 h-3.5 text-blue-700" />
                {profile.schoolTownship}
              </span>
              <span aria-hidden="true">·</span>
              <span>{profile.schoolLevel}</span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1.5 font-mono text-slate-700">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                {profile.email}
              </span>
              <span aria-hidden="true">·</span>
              <span>承辦人：{profile.displayName}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              {profile.schoolName}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-4 shrink-0">
            <div className="pr-4 border-r border-slate-200">
              <div className="text-xs text-slate-500">本年度繳交進度</div>
              <div className="text-xl font-bold text-slate-900 tabular-nums">
                {completedCount} <span className="text-sm font-normal text-slate-500">/ {items.length} 項</span>
              </div>
            </div>

            <button
              type="button"
              onClick={onChangeSchool}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <RefreshCw className="w-4 h-4" />
              切換服務學校
            </button>
          </div>
        </div>
      </section>

      {/* Drive OAuth Token Re-authorization Banner (if page was refreshed) */}
      {!hasDriveToken && (
        <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <FolderSync className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900">
              <p className="font-semibold">需要重新連接 Google 雲端硬碟授權</p>
              <p className="text-amber-800 text-xs mt-0.5">
                為保護帳號安全，雲端硬碟存取權杖僅保留於記憶體中。上傳檔案前請重新授權 Tmail Google Drive 連線。
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onRefreshDriveAuth}
            className="px-4 py-2 rounded-lg bg-amber-700 text-white text-xs font-semibold hover:bg-amber-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            授權 Google 雲端硬碟
          </button>
        </div>
      )}

      {/* Feedback Alerts */}
      {uploadError && (
        <div
          role="alert"
          className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-sm text-red-800"
        >
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <span>{uploadError}</span>
        </div>
      )}

      {uploadSuccessMsg && (
        <div
          role="status"
          className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3 text-sm text-emerald-800"
        >
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <span>{uploadSuccessMsg}</span>
        </div>
      )}

      {/* Grouped Upload Items by Major Topic */}
      {loadingItems ? (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-24 rounded-lg bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : groupedSections.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl py-16 px-6 text-center">
          <FileUp className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-900 mb-1">
            目前尚無開放上傳的資料項目
          </h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            管理者尚未建立或啟用需要各校繳交的資料項目，請於管理者後台新增主題與項目後重新檢視。
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedSections.map((section, sectionIdx) => {
            const sectionDone = section.items.filter((item) => {
              const st = statusMap[item.id];
              return st && (st.status === 'uploaded' || st.status === 'approved');
            }).length;

            return (
              <section
                key={section.id}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden"
              >
                <div className="px-6 py-4 bg-slate-50/70 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <FolderOpen className="w-4 h-4 text-blue-700 shrink-0" />
                      <h2 className="text-base font-bold text-slate-900">
                        {String(sectionIdx + 1).padStart(2, '0')}. {section.title}
                      </h2>
                    </div>
                    {section.description && (
                      <p className="text-xs text-slate-600 mt-1">{section.description}</p>
                    )}
                  </div>
                  <span className="text-xs font-mono text-slate-600 tabular-nums whitespace-nowrap shrink-0">
                    本主題完成 {sectionDone} / {section.items.length} 項
                  </span>
                </div>

                <div className="divide-y divide-slate-200">
                  {section.items.map((item, idx) => {
                    const st = statusMap[item.id];
                    const isUploading = uploadingItemId === item.id;
                    const overdue = isPastDeadline(item.deadline);
                    const isLocked = st?.status === 'approved';

                    return (
                      <div
                        key={item.id}
                        className="p-6 hover:bg-slate-50/70 transition-colors flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6"
                      >
                        <div className="space-y-2 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                            <span className="font-mono text-slate-400 tabular-nums">
                              {sectionIdx + 1}.{idx + 1}
                            </span>

                            {st?.status === 'approved' ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                                <CheckCircle2 className="w-4 h-4" />
                                已上傳 · 已審核
                              </span>
                            ) : st?.status === 'uploaded' ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                                <Clock className="w-4 h-4" />
                                已上傳 · 待審核
                              </span>
                            ) : st?.status === 'rejected' ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                                <RotateCcw className="w-4 h-4" />
                                退件需補件
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 font-semibold text-red-700">
                                <XCircle className="w-4 h-4" />
                                {overdue ? '逾期未上傳' : '未上傳'}
                              </span>
                            )}

                            <span aria-hidden="true" className="text-slate-300">·</span>
                            <span className="text-slate-600">
                              {item.isRequired ? '必繳項目' : '選繳項目'}
                            </span>
                            <span aria-hidden="true" className="text-slate-300">·</span>
                            <span className="text-slate-600">
                              格式：{item.acceptedFormats}
                            </span>
                            <span aria-hidden="true" className="text-slate-300">·</span>
                            <span className="text-slate-600 tabular-nums">
                              上限 {item.maxSizeMB} MB
                            </span>
                            {item.deadline && (
                              <>
                                <span aria-hidden="true" className="text-slate-300">·</span>
                                <span
                                  className={`tabular-nums ${
                                    overdue && !st ? 'text-red-700 font-semibold' : 'text-slate-600'
                                  }`}
                                >
                                  期限：{item.deadline}
                                  {overdue && !st ? '（已逾期）' : ''}
                                </span>
                              </>
                            )}
                          </div>

                          <h3 className="text-base font-semibold text-slate-900">
                            {item.title}
                          </h3>

                          {item.description && (
                            <p className="text-sm text-slate-600 leading-relaxed max-w-3xl">
                              {item.description}
                            </p>
                          )}

                          {st && (
                            <div className="pt-1 text-xs text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-1">
                              <span className="font-medium text-slate-900 truncate max-w-xs">
                                檔案：{st.fileName}
                              </span>
                              <span aria-hidden="true" className="text-slate-300">·</span>
                              <span className="font-mono tabular-nums">{formatBytes(st.fileSize)}</span>
                              <span aria-hidden="true" className="text-slate-300">·</span>
                              <span>上傳者：{st.uploadedByName}</span>
                              <span aria-hidden="true" className="text-slate-300">·</span>
                              <span className="font-mono tabular-nums">
                                {formatTimestamp(st.updatedAt)}
                              </span>
                            </div>
                          )}

                          {st?.status === 'rejected' && st.reviewNote && (
                            <p className="text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 inline-block">
                              管理者退件備註：{st.reviewNote}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 shrink-0">
                          {st?.driveWebViewLink && (
                            <a
                              href={st.driveWebViewLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              檢視雲端檔案
                            </a>
                          )}

                          <input
                            ref={(el) => {
                              fileInputRefs.current[item.id] = el;
                            }}
                            type="file"
                            className="hidden"
                            onChange={(e) => handleFileSelected(item, e.target.files?.[0])}
                          />

                          {!isLocked && (
                            <button
                              type="button"
                              disabled={isUploading}
                              onClick={() => {
                                if (!hasDriveToken) {
                                  void onRefreshDriveAuth();
                                  return;
                                }
                                fileInputRefs.current[item.id]?.click();
                              }}
                              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                                st
                                  ? 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
                                  : 'bg-blue-700 text-white hover:bg-blue-800'
                              } disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                              <Upload className="w-4 h-4" />
                              <span>
                                {isUploading
                                  ? '正在上傳至雲端...'
                                  : st
                                  ? '重新上傳覆蓋'
                                  : '選擇檔案上傳'}
                              </span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Explicit Overwrite Confirmation Dialog */}
      {pendingOverwrite && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="overwrite-dialog-title"
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6">
            <h3 id="overwrite-dialog-title" className="text-lg font-bold text-slate-900 mb-2">
              確認重新上傳並覆蓋繳交紀錄？
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              項目「<strong className="text-slate-900">{pendingOverwrite.item.title}</strong>」目前已有已上傳檔案（
              <span className="font-mono text-xs">{pendingOverwrite.existingFileName}</span>）。
              繼續上傳將會把新檔案（<span className="font-mono text-xs">{pendingOverwrite.file.name}</span>
              ）傳送至雲端硬碟，並於上傳歷程留存新紀錄。
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  if (fileInputRefs.current[pendingOverwrite.item.id]) {
                    fileInputRefs.current[pendingOverwrite.item.id]!.value = '';
                  }
                  setPendingOverwrite(null);
                }}
                className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = pendingOverwrite;
                  setPendingOverwrite(null);
                  void executeUpload(target.item, target.file);
                }}
                className="px-4 py-2 rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 cursor-pointer whitespace-nowrap"
              >
                確認上傳並覆蓋
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
