import React from 'react';
import { ShieldCheck, Building2, CloudUpload, Lock } from 'lucide-react';

interface TmailLoginViewProps {
  onLogin: () => Promise<void>;
  isLoggingIn: boolean;
  errorMessage: string | null;
  onOpenAdmin: () => void;
}

export const TmailLoginView: React.FC<TmailLoginViewProps> = ({
  onLogin,
  isLoggingIn,
  errorMessage,
  onOpenAdmin,
}) => {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* Left: Primary Login Card (Focal Anchor) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-8 sm:p-10 flex flex-col justify-between">
          <div>
            <p className="text-sm font-medium text-blue-700 mb-3">
              宜蘭縣政府教育處公務彙整系統
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight leading-tight mb-4 [text-wrap:balance]">
              宜蘭縣各級學校資料線上繳交平台
            </h1>
            <p className="text-base text-slate-600 leading-relaxed max-w-xl mb-8">
              本平台連結宜蘭縣教育處 Tmail 帳號進行身分驗證，並直接將貴校繳交之各項資料檔案同步上傳至管理者 Tmail Google 雲端硬碟彙整存查。
            </p>

            {errorMessage && (
              <div
                role="alert"
                className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800 leading-relaxed"
              >
                {errorMessage}
              </div>
            )}

            <div className="space-y-4">
              <button
                type="button"
                onClick={onLogin}
                disabled={isLoggingIn}
                className="gsi-material-button w-full sm:w-auto min-w-[280px]"
              >
                <div className="gsi-material-button-content-wrapper">
                  <div className="gsi-material-button-icon">
                    <svg
                      version="1.1"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 48 48"
                      style={{ display: 'block' }}
                    >
                      <path
                        fill="#EA4335"
                        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                      />
                      <path
                        fill="#4285F4"
                        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                      />
                      <path
                        fill="#34A853"
                        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                      />
                    </svg>
                  </div>
                  <span>
                    {isLoggingIn
                      ? '正在連線驗證 Tmail...'
                      : '使用宜蘭縣 Tmail 帳號登入驗證'}
                  </span>
                </div>
              </button>

              <p className="text-xs text-slate-500 leading-relaxed">
                驗證網域限制：<span className="font-mono text-slate-700">@tmail.ilc.edu.tw</span> · 登入時請同意授權雲端硬碟存取權限以利傳送檔案。
              </p>
            </div>
          </div>

          <div className="pt-8 mt-8 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <span className="text-xs text-slate-500">
              承辦管理者如需設定上傳項目或檢視各校繳交總表
            </span>
            <button
              type="button"
              onClick={onOpenAdmin}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-blue-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Lock className="w-3.5 h-3.5" />
              進入管理者後台
            </button>
          </div>
        </div>

        {/* Right: Clear 3-Step Workflow Guide */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-8 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-6">
              資料繳交作業流程
            </h2>
            <ol className="space-y-6">
              <li className="flex gap-4">
                <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-slate-700">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-1">
                    01. 宜蘭縣 Tmail 身分驗證
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    使用學校公務 <span className="font-mono text-xs">@tmail.ilc.edu.tw</span> Google 帳號登入，確保資料來源具公務身分識別。
                  </p>
                </div>
              </li>

              <li className="flex gap-4">
                <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-slate-700">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-1">
                    02. 選擇服務學校
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    驗證通過後，依鄉鎮市或校名關鍵字選取貴校，系統將記憶學校資訊並同步該校項目狀態。
                  </p>
                </div>
              </li>

              <li className="flex gap-4">
                <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-slate-700">
                  <CloudUpload className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-1">
                    03. 上傳檔案至 Tmail 雲端硬碟
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    依管理者設定之項目上傳對應檔案，檔案將自動命名歸檔並共用至管理者 Tmail 雲端硬碟。
                  </p>
                </div>
              </li>
            </ol>
          </div>

          <div className="pt-6 mt-8 border-t border-slate-200 text-xs text-slate-500 leading-relaxed">
            同校不同承辦人員登入並選擇同一學校後，皆可即時查看該校已完成與尚未繳交的項目清單。
          </div>
        </div>
      </div>
    </div>
  );
};
