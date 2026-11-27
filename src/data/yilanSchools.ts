import { YilanSchool } from '../types';

export const YILAN_TOWNSHIPS = [
  '宜蘭市',
  '羅東鎮',
  '蘇澳鎮',
  '頭城鎮',
  '礁溪鄉',
  '壯圍鄉',
  '員山鄉',
  '冬山鄉',
  '五結鄉',
  '三星鄉',
  '大同鄉',
  '南澳鄉',
] as const;

export const YILAN_SCHOOLS: YilanSchool[] = [
  // 宜蘭市
  { id: 'ilc_ilsh', name: '國立宜蘭高級中學', township: '宜蘭市', level: '高中職' },
  { id: 'ilc_lygsh', name: '國立蘭陽女子高級中學', township: '宜蘭市', level: '高中職' },
  { id: 'ilc_ilvs', name: '國立宜蘭高級商業職業學校', township: '宜蘭市', level: '高中職' },
  { id: 'ilc_ilses', name: '國立宜蘭特殊教育學校', township: '宜蘭市', level: '特教' },
  { id: 'ilc_fsjh', name: '宜蘭縣立復興國民中學', township: '宜蘭市', level: '國中' },
  { id: 'ilc_iljh', name: '宜蘭縣立宜蘭國民中學', township: '宜蘭市', level: '國中' },
  { id: 'ilc_chjh', name: '宜蘭縣立中華國民中學', township: '宜蘭市', level: '國中' },
  { id: 'ilc_kxjh', name: '宜蘭縣立凱旋國民中學', township: '宜蘭市', level: '國中' },
  { id: 'ilc_iles', name: '宜蘭縣宜蘭市宜蘭國民小學', township: '宜蘭市', level: '國小' },
  { id: 'ilc_cses', name: '宜蘭縣宜蘭市中山國民小學', township: '宜蘭市', level: '國小' },
  { id: 'ilc_gfes', name: '宜蘭縣宜蘭市光復國民小學', township: '宜蘭市', level: '國小' },
  { id: 'ilc_lmes', name: '宜蘭縣宜蘭市黎明國民小學', township: '宜蘭市', level: '國小' },
  { id: 'ilc_yces', name: '宜蘭縣宜蘭市育才國民小學', township: '宜蘭市', level: '國小' },
  { id: 'ilc_lses', name: '宜蘭縣宜蘭市力行國民小學', township: '宜蘭市', level: '國小' },
  { id: 'ilc_npes', name: '宜蘭縣宜蘭市南屏國民小學', township: '宜蘭市', level: '國小' },
  { id: 'ilc_sses', name: '宜蘭縣宜蘭市新生國民小學', township: '宜蘭市', level: '國小' },
  { id: 'ilc_kxes', name: '宜蘭縣宜蘭市凱旋國民小學', township: '宜蘭市', level: '國小' },

  // 羅東鎮
  { id: 'ilc_ldsh', name: '國立羅東高級中學', township: '羅東鎮', level: '高中職' },
  { id: 'ilc_ldvs', name: '國立羅東高級商業職業學校', township: '羅東鎮', level: '高中職' },
  { id: 'ilc_ldivs', name: '國立羅東高級工業職業學校', township: '羅東鎮', level: '高中職' },
  { id: 'ilc_ldjh', name: '宜蘭縣立羅東國民中學', township: '羅東鎮', level: '國中' },
  { id: 'ilc_dgjh', name: '宜蘭縣立東光國民中學', township: '羅東鎮', level: '國中' },
  { id: 'ilc_ghjh', name: '宜蘭縣立國華國民中學', township: '羅東鎮', level: '國中' },
  { id: 'ilc_ldes', name: '宜蘭縣羅東鎮羅東國民小學', township: '羅東鎮', level: '國小' },
  { id: 'ilc_gjes', name: '宜蘭縣羅東鎮公正國民小學', township: '羅東鎮', level: '國小' },
  { id: 'ilc_cges', name: '宜蘭縣羅東鎮成功國民小學', township: '羅東鎮', level: '國小' },
  { id: 'ilc_bces', name: '宜蘭縣羅東鎮北成國民小學', township: '羅東鎮', level: '國小' },
  { id: 'ilc_zles', name: '宜蘭縣羅東鎮竹林國民小學', township: '羅東鎮', level: '國小' },

  // 蘇澳鎮
  { id: 'ilc_savs', name: '國立蘇澳高級海事水產職業學校', township: '蘇澳鎮', level: '高中職' },
  { id: 'ilc_sajh', name: '宜蘭縣立蘇澳國民中學', township: '蘇澳鎮', level: '國中' },
  { id: 'ilc_najh', name: '宜蘭縣立南安國民中學', township: '蘇澳鎮', level: '國中' },
  { id: 'ilc_whjh', name: '宜蘭縣立文化國民中學', township: '蘇澳鎮', level: '國中' },
  { id: 'ilc_saes', name: '宜蘭縣蘇澳鎮蘇澳國民小學', township: '蘇澳鎮', level: '國小' },
  { id: 'ilc_smes', name: '宜蘭縣蘇澳鎮士敏國民小學', township: '蘇澳鎮', level: '國小' },
  { id: 'ilc_ymes', name: '宜蘭縣蘇澳鎮岳明國民中小學', township: '蘇澳鎮', level: '國小' },
  { id: 'ilc_yles', name: '宜蘭縣蘇澳鎮永樂國民小學', township: '蘇澳鎮', level: '國小' },
  { id: 'ilc_ples', name: '宜蘭縣蘇澳鎮蓬萊國民小學', township: '蘇澳鎮', level: '國小' },
  { id: 'ilc_naes', name: '宜蘭縣蘇澳鎮南安國民小學', township: '蘇澳鎮', level: '國小' },
  { id: 'ilc_mses', name: '宜蘭縣蘇澳鎮馬賽國民小學', township: '蘇澳鎮', level: '國小' },

  // 頭城鎮
  { id: 'ilc_tcvs', name: '國立頭城高級家事商業職業學校', township: '頭城鎮', level: '高中職' },
  { id: 'ilc_tcjh', name: '宜蘭縣立頭城國民中學', township: '頭城鎮', level: '國中' },
  { id: 'ilc_tces', name: '宜蘭縣頭城鎮頭城國民小學', township: '頭城鎮', level: '國小' },
  { id: 'ilc_dxes', name: '宜蘭縣頭城鎮大溪國民小學', township: '頭城鎮', level: '國小' },
  { id: 'ilc_gf2es', name: '宜蘭縣頭城鎮梗枋國民小學', township: '頭城鎮', level: '國小' },
  { id: 'ilc_zaes', name: '宜蘭縣頭城鎮竹安國民小學', township: '頭城鎮', level: '國小' },
  { id: 'ilc_dles', name: '宜蘭縣頭城鎮大里國民小學', township: '頭城鎮', level: '國小' },
  { id: 'ilc_eces', name: '宜蘭縣頭城鎮二城國民小學', township: '頭城鎮', level: '國小' },
  { id: 'ilc_rwes', name: '宜蘭縣頭城鎮人文國民中小學', township: '頭城鎮', level: '國小' },

  // 礁溪鄉
  { id: 'ilc_jxjh', name: '宜蘭縣立礁溪國民中學', township: '礁溪鄉', level: '國中' },
  { id: 'ilc_wsjh', name: '宜蘭縣立吳沙國民中學', township: '礁溪鄉', level: '國中' },
  { id: 'ilc_jxes', name: '宜蘭縣礁溪鄉礁溪國民小學', township: '礁溪鄉', level: '國小' },
  { id: 'ilc_ltes', name: '宜蘭縣礁溪鄉龍潭國民小學', township: '礁溪鄉', level: '國小' },
  { id: 'ilc_sjes', name: '宜蘭縣礁溪鄉四結國民小學', township: '礁溪鄉', level: '國小' },
  { id: 'ilc_ytes', name: '宜蘭縣礁溪鄉玉田國民小學', township: '礁溪鄉', level: '國小' },
  { id: 'ilc_sces', name: '宜蘭縣礁溪鄉三村國民小學', township: '礁溪鄉', level: '國小' },

  // 壯圍鄉
  { id: 'ilc_zwjh', name: '宜蘭縣立壯圍國民中學', township: '壯圍鄉', level: '國中' },
  { id: 'ilc_zwes', name: '宜蘭縣壯圍鄉壯圍國民小學', township: '壯圍鄉', level: '國小' },
  { id: 'ilc_dfes', name: '宜蘭縣壯圍鄉大福國民小學', township: '壯圍鄉', level: '國小' },
  { id: 'ilc_snes', name: '宜蘭縣壯圍鄉新南國民小學', township: '壯圍鄉', level: '國小' },
  { id: 'ilc_gges', name: '宜蘭縣壯圍鄉公館國民小學', township: '壯圍鄉', level: '國小' },
  { id: 'ilc_gtes', name: '宜蘭縣壯圍鄉古亭國民小學', township: '壯圍鄉', level: '國小' },
  { id: 'ilc_gles', name: '宜蘭縣壯圍鄉過嶺國民小學', township: '壯圍鄉', level: '國小' },

  // 員山鄉
  { id: 'ilc_ysjh', name: '宜蘭縣立員山國民中學', township: '員山鄉', level: '國中' },
  { id: 'ilc_ncjh', name: '宜蘭縣立內城國民中小學', township: '員山鄉', level: '國中' },
  { id: 'ilc_yses', name: '宜蘭縣員山鄉員山國民小學', township: '員山鄉', level: '國小' },
  { id: 'ilc_tles', name: '宜蘭縣員山鄉同樂國民小學', township: '員山鄉', level: '國小' },
  { id: 'ilc_dhes', name: '宜蘭縣員山鄉大湖國民小學', township: '員山鄉', level: '國小' },
  { id: 'ilc_qxes', name: '宜蘭縣員山鄉七賢國民小學', township: '員山鄉', level: '國小' },
  { id: 'ilc_sges', name: '宜蘭縣員山鄉深溝國民小學', township: '員山鄉', level: '國小' },
  { id: 'ilc_hses', name: '宜蘭縣員山鄉湖山國民小學', township: '員山鄉', level: '國小' },

  // 冬山鄉
  { id: 'ilc_cxsh', name: '宜蘭縣立慈心華德福教育實驗高級中等學校', township: '冬山鄉', level: '高中職' },
  { id: 'ilc_dsjh', name: '宜蘭縣立冬山國民中學', township: '冬山鄉', level: '國中' },
  { id: 'ilc_sajh2', name: '宜蘭縣立順安國民中學', township: '冬山鄉', level: '國中' },
  { id: 'ilc_dses', name: '宜蘭縣冬山鄉冬山國民小學', township: '冬山鄉', level: '國小' },
  { id: 'ilc_qges', name: '宜蘭縣冬山鄉清溝國民小學', township: '冬山鄉', level: '國小' },
  { id: 'ilc_gxes', name: '宜蘭縣冬山鄉廣興國民小學', township: '冬山鄉', level: '國小' },
  { id: 'ilc_kles', name: '宜蘭縣冬山鄉柯林國民小學', township: '冬山鄉', level: '國小' },
  { id: 'ilc_dxes2', name: '宜蘭縣冬山鄉東興國民小學', township: '冬山鄉', level: '國小' },
  { id: 'ilc_wyes', name: '宜蘭縣冬山鄉武淵國民小學', township: '冬山鄉', level: '國小' },
  { id: 'ilc_djes', name: '宜蘭縣冬山鄉大進國民小學', township: '冬山鄉', level: '國小' },
  { id: 'ilc_saes2', name: '宜蘭縣冬山鄉順安國民小學', township: '冬山鄉', level: '國小' },

  // 五結鄉
  { id: 'ilc_wjjh', name: '宜蘭縣立五結國民中學', township: '五結鄉', level: '國中' },
  { id: 'ilc_lzjh', name: '宜蘭縣立利澤國民中學', township: '五結鄉', level: '國中' },
  { id: 'ilc_xzjh', name: '宜蘭縣立興中國民中學', township: '五結鄉', level: '國中' },
  { id: 'ilc_wjes', name: '宜蘭縣五結鄉五結國民小學', township: '五結鄉', level: '國小' },
  { id: 'ilc_lzes', name: '宜蘭縣五結鄉利澤國民小學', township: '五結鄉', level: '國小' },
  { id: 'ilc_xwes', name: '宜蘭縣五結鄉孝威國民小學', township: '五結鄉', level: '國小' },
  { id: 'ilc_zxes', name: '宜蘭縣五結鄉中興國民小學', township: '五結鄉', level: '國小' },
  { id: 'ilc_xjes', name: '宜蘭縣五結鄉學進國民小學', township: '五結鄉', level: '國小' },

  // 三星鄉
  { id: 'ilc_sxjh', name: '宜蘭縣立三星國民中學', township: '三星鄉', level: '國中' },
  { id: 'ilc_sxes', name: '宜蘭縣三星鄉三星國民小學', township: '三星鄉', level: '國小' },
  { id: 'ilc_wfes', name: '宜蘭縣三星鄉萬富國民小學', township: '三星鄉', level: '國小' },
  { id: 'ilc_dyes', name: '宜蘭縣三星鄉大隱國民小學', township: '三星鄉', level: '國小' },
  { id: 'ilc_dzes', name: '宜蘭縣三星鄉大洲國民小學', township: '三星鄉', level: '國小' },
  { id: 'ilc_xmes', name: '宜蘭縣三星鄉憲明國民小學', township: '三星鄉', level: '國小' },

  // 大同鄉
  { id: 'ilc_dtjh', name: '宜蘭縣立大同國民中學', township: '大同鄉', level: '國中' },
  { id: 'ilc_dtes', name: '宜蘭縣大同鄉大同國民小學', township: '大同鄉', level: '國小' },
  { id: 'ilc_sqes', name: '宜蘭縣大同鄉四季國民小學', township: '大同鄉', level: '國小' },
  { id: 'ilc_hxes', name: '宜蘭縣大同鄉寒溪國民小學', township: '大同鄉', level: '國小' },
  { id: 'ilc_nses', name: '宜蘭縣大同鄉南山國民小學', township: '大同鄉', level: '國小' },
  { id: 'ilc_lses2', name: '宜蘭縣大同鄉樂水國民小學', township: '大同鄉', level: '國小' },

  // 南澳鄉
  { id: 'ilc_nash', name: '宜蘭縣立南澳高級中學', township: '南澳鄉', level: '高中職' },
  { id: 'ilc_naes2', name: '宜蘭縣南澳鄉南澳國民小學', township: '南澳鄉', level: '國小' },
  { id: 'ilc_bhes', name: '宜蘭縣南澳鄉碧候國民小學', township: '南澳鄉', level: '國小' },
  { id: 'ilc_daes', name: '宜蘭縣南澳鄉東澳國民小學', township: '南澳鄉', level: '國小' },
  { id: 'ilc_wtes', name: '宜蘭縣南澳鄉武塔國民小學', township: '南澳鄉', level: '國小' },
  { id: 'ilc_jyes', name: '宜蘭縣南澳鄉金岳國民小學', township: '南澳鄉', level: '國小' },
  { id: 'ilc_jyes2', name: '宜蘭縣南澳鄉金洋國民小學', township: '南澳鄉', level: '國小' },
  { id: 'ilc_ahes', name: '宜蘭縣南澳鄉澳花國民小學', township: '南澳鄉', level: '國小' },
];
