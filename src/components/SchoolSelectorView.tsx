import React, { useMemo, useState } from 'react';
import { Search, Check, Building2, ArrowRight } from 'lucide-react';
import { YILAN_SCHOOLS, YILAN_TOWNSHIPS } from '../data/yilanSchools';
import { SchoolLevel, YilanSchool } from '../types';

interface SchoolSelectorViewProps {
  userEmail: string;
  userName: string;
  currentSchoolId?: string;
  onConfirmSchool: (school: YilanSchool) => Promise<void>;
  isSaving: boolean;
}

const LEVELS: Array<'全部' | SchoolLevel> = ['全部', '國小', '國中', '高中職', '特教'];

export const SchoolSelectorView: React.FC<SchoolSelectorViewProps> = ({
  userEmail,
  userName,
  currentSchoolId,
  onConfirmSchool,
  isSaving,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTownship, setSelectedTownship] = useState<string>('全部');
  const [selectedLevel, setSelectedLevel] = useState<'全部' | SchoolLevel>('全部');
  const [pickedSchool, setPickedSchool] = useState<YilanSchool | null>(() => {
    if (!currentSchoolId) return null;
    return YILAN_SCHOOLS.find((s) => s.id === currentSchoolId) || null;
  });

  const filteredSchools = useMemo(() => {
    const keyword = searchQuery.trim();
    return YILAN_SCHOOLS.filter((school) => {
      if (selectedTownship !== '全部' && school.township !== selectedTownship) {
        return false;
      }
      if (selectedLevel !== '全部' && school.level !== selectedLevel) {
        return false;
      }
      if (keyword && !school.name.includes(keyword) && !school.township.includes(keyword)) {
        return false;
      }
      return true;
    });
  }, [searchQuery, selectedTownship, selectedLevel]);

  const handleConfirm = async () => {
    if (!pickedSchool) return;
    await onConfirmSchool(pickedSchool);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      {/* Verified Tmail Context Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-emerald-700 mb-1">
            Tmail 身分驗證通過
          </p>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            請選擇您目前服務的宜蘭縣學校
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            登入帳號：<span className="font-medium text-slate-900">{userName}</span>
            <span className="mx-2 text-slate-300">·</span>
            <span className="font-mono text-xs text-slate-700">{userEmail}</span>
          </p>
        </div>
        <button
          type="button"
          disabled={!pickedSchool || isSaving}
          onClick={handleConfirm}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <span>{isSaving ? '儲存中...' : '確認進入資料上傳介面'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Filters & Search */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pb-6 border-b border-slate-200">
          <div className="md:col-span-6 relative">
            <label htmlFor="school-search" className="sr-only">
              搜尋學校名稱
            </label>
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="school-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="輸入學校名稱或鄉鎮關鍵字（例如：公正、羅東、復興）"
              className="w-full h-11 pl-10 pr-4 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-600"
            />
          </div>

          <div className="md:col-span-3">
            <label htmlFor="township-select" className="sr-only">
              篩選鄉鎮市
            </label>
            <select
              id="township-select"
              value={selectedTownship}
              onChange={(e) => setSelectedTownship(e.target.value)}
              className="w-full h-11 px-3.5 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600"
            >
              <option value="全部">全部鄉鎮市（12 區）</option>
              {YILAN_TOWNSHIPS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3 flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
            {LEVELS.map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setSelectedLevel(lvl)}
                className={`flex-1 px-2.5 py-2 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  selectedLevel === lvl
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        {/* School List */}
        <div className="pt-5">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
            <span>
              符合條件共 <strong className="text-slate-900 tabular-nums">{filteredSchools.length}</strong> 所學校
            </span>
            {pickedSchool && (
              <span>
                已選取：<strong className="text-blue-700">{pickedSchool.name}</strong>
              </span>
            )}
          </div>

          {filteredSchools.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              找不到符合條件的學校，請調整搜尋關鍵字或篩選條件。
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[460px] overflow-y-auto pr-1">
              {filteredSchools.map((school) => {
                const isSelected = pickedSchool?.id === school.id;
                return (
                  <button
                    key={school.id}
                    type="button"
                    onClick={() => setPickedSchool(school)}
                    aria-pressed={isSelected}
                    className={`text-left p-4 rounded-lg border transition-colors cursor-pointer flex items-start justify-between gap-3 ${
                      isSelected
                        ? 'bg-blue-50/70 border-blue-600 ring-1 ring-blue-600'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                        <Building2 className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                        <span>{school.township}</span>
                        <span aria-hidden="true">·</span>
                        <span>{school.level}</span>
                      </div>
                      <p className="text-sm font-semibold text-slate-900 leading-snug">
                        {school.name}
                      </p>
                    </div>
                    {isSelected && (
                      <span className="w-5 h-5 rounded-full bg-blue-700 text-white flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom Confirm Bar */}
        <div className="pt-6 mt-6 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="text-sm text-slate-600">
            {pickedSchool ? (
              <span>
                即將以 <strong className="text-slate-900">{pickedSchool.name}</strong> 進入資料上傳介面
              </span>
            ) : (
              <span>請點選上方列表中的服務學校</span>
            )}
          </div>
          <button
            type="button"
            disabled={!pickedSchool || isSaving}
            onClick={handleConfirm}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <span>{isSaving ? '儲存中...' : '進入資料上傳介面'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
