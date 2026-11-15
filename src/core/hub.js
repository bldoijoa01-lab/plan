export const BOOKMARK_KINDS = [
  { id: 'docs', icon: '📝', label: '구글 독스', cls: 'bk-docs' },
  { id: 'sheet', icon: '📊', label: '스프레드시트', cls: 'bk-sheet' },
  { id: 'slide', icon: '📽️', label: '프레젠테이션', cls: 'bk-slide' },
  { id: 'pdf', icon: '📕', label: 'PDF 문서', cls: 'bk-pdf' },
  { id: 'hwp', icon: '📄', label: '한글(HWP)', cls: 'bk-hwp' },
  { id: 'onenote', icon: '📓', label: '원노트 메모', cls: 'bk-onenote' },
  { id: 'drive', icon: '📁', label: '드라이브', cls: 'bk-drive' },
  { id: 'keep', icon: '💡', label: '구글 킵', cls: 'bk-keep' },
  { id: 'cal', icon: '📅', label: '캘린더', cls: 'bk-cal' },
  { id: 'link', icon: '🔗', label: '웹 문서', cls: 'bk-link' },
];

export const KIND_MAP = Object.fromEntries(BOOKMARK_KINDS.map((k) => [k.id, k]));

export function detectBookmarkKind(url, name = '') {
  const u = String(url || '').toLowerCase();
  const n = String(name || '').toLowerCase();
  if (
    u.includes('/spreadsheets') ||
    u.includes('sheets.google') ||
    /\.(xlsx?|csv)(\?|#|$)/i.test(n)
  ) {
    return 'sheet';
  }
  if (u.includes('/document') || u.includes('docs.google.com/document')) return 'docs';
  if (
    u.includes('/presentation') ||
    u.includes('slides.google') ||
    /\.pptx?(\?|#|$)/i.test(n)
  ) {
    return 'slide';
  }
  if (
    u.startsWith('#note:') ||
    u.includes('onenote.com') ||
    u.includes('onedrive.live') ||
    u.includes('1drv.ms')
  ) {
    return 'onenote';
  }
  if (u.includes('keep.google')) return 'keep';
  if (u.includes('calendar.google')) return 'cal';
  if (/\.pdf(\?|#|$)/i.test(n) || /\.pdf(\?|#|$)/i.test(u)) return 'pdf';
  if (/\.hwpx?(\?|#|$)/i.test(n) || /\.hwpx?(\?|#|$)/i.test(u)) return 'hwp';
  if (u.includes('drive.google')) return 'drive';
  return 'link';
}

export const HUB_CATEGORY_META = [
  { id: 'all', icon: '📚', label: '전체' },
  { id: 'starred', icon: '⭐', label: '즐겨찾기' },
  { id: '학교·세특', icon: '🏫', label: '학교·세특' },
  { id: '수행·활동지', icon: '✍️', label: '수행·활동지' },
  { id: '교재·시험지', icon: '📕', label: '교재·시험지' },
  { id: '입시·진학', icon: '🎓', label: '입시·진학' },
  { id: '원노트·메모', icon: '📓', label: '원노트·메모' },
];

export const DEFAULT_HUB_DOCS = [
  // ===== 학교·세특 =====
  {
    id: 'gd_bci_xlsx',
    name: '생기부_통합관리_BCI_생명과학_수정.xlsx',
    kind: 'sheet',
    group: '학교·세특',
    modifiedAt: '2026-11-15',
    defaultStarred: true,
    url: 'https://docs.google.com/spreadsheets/d/1_eo_efzfCuPdkouk1ISWLXP3jevh14Mw/edit?usp=drivesdk',
  },
  {
    id: 'gd_scilab_chk',
    name: '2026.과학실 활동학생 체크용(AI*SW 등)',
    kind: 'sheet',
    group: '학교·세특',
    modifiedAt: '2026-11-14',
    defaultStarred: false,
    url: 'https://docs.google.com/spreadsheets/d/1ZF35uylivGDHjuYBarXXdGt3DB8j7Xmb7sH5ABcf0oI/edit?usp=drivesdk',
  },
  {
    id: 'gd_att_2026_2',
    name: '2026. 2학기 학사 출석부',
    kind: 'sheet',
    group: '학교·세특',
    modifiedAt: '2026-11-13',
    defaultStarred: true,
    url: 'https://docs.google.com/spreadsheets/d/1x44yloYFfYqS5OE-tUCc6eladZ5cTvR3QkhJBjJR_20/edit?usp=drivesdk',
  },
  {
    id: 'gd_oros_exp',
    name: 'OROS 실험 기록 (측정 데이터)',
    kind: 'sheet',
    group: '학교·세특',
    modifiedAt: '2026-11-12',
    defaultStarred: false,
    url: 'https://docs.google.com/spreadsheets/d/18g2aJofFwmI_uQgWo6NVB1OGXwVEZyVvDIHzYuw35eM/edit?usp=drivesdk',
  },
  {
    id: 'gd_sw_univ',
    name: '2026. SW로대학가기,,,,',
    kind: 'sheet',
    group: '학교·세특',
    modifiedAt: '2026-11-12',
    defaultStarred: false,
    url: 'https://docs.google.com/spreadsheets/d/1WEIaaf-wmN87VeXo4Ize9ufYEjvizrhz1F_3LBvHgek/edit?usp=drivesdk',
  },
  {
    id: 'gd_sw_plan',
    name: '2026. SW계획서',
    kind: 'docs',
    group: '학교·세특',
    modifiedAt: '2026-11-11',
    defaultStarred: true,
    url: 'https://docs.google.com/document/d/10RyP15mIq0whzYpcuTHbpdiHKUBcEYKh8UOpOSVRVCA/edit?usp=drivesdk',
  },
  {
    id: 'gd_cnn_slide',
    name: '합성곱 신경망(CNN) 발표자료',
    kind: 'slide',
    group: '학교·세특',
    modifiedAt: '2026-11-11',
    defaultStarred: false,
    url: 'https://docs.google.com/presentation/d/1N04LkuYwUVKZQgJyYWyHrdEvG32Nrmmvgo_daEaaDvs/edit?usp=drivesdk',
  },
  {
    id: 'gd_moss_doc',
    name: 'MOSS 장기프로젝트 계획서',
    kind: 'docs',
    group: '학교·세특',
    modifiedAt: '2026-11-09',
    defaultStarred: false,
    url: 'https://docs.google.com/document/d/14ZS1lHuY6O_ARa5kP4L4hYVEDl6_G_bmFsOqO5wBZzk/edit?usp=drivesdk',
  },
  {
    id: 'gd_selfstudy_2',
    name: '2학년부 자율학습 참여표',
    kind: 'sheet',
    group: '학교·세특',
    modifiedAt: '2026-11-09',
    defaultStarred: false,
    url: 'https://docs.google.com/spreadsheets/d/1pQ51g2Ts9gka40DwkRMiyyQWhE4SE2DB8X_21IknSvU/edit?usp=drivesdk',
  },
  {
    id: 'gd_chem_exp_doc',
    name: '화학실험 개인 재설계 탐구 기록지',
    kind: 'docs',
    group: '학교·세특',
    modifiedAt: '2026-11-07',
    defaultStarred: false,
    url: 'https://docs.google.com/document/d/17Q9GFLYcamdjPzDWStdxd7fIdo287NasvEmzajEZeSw/edit?usp=drivesdk',
  },
  {
    id: 'gd_saenggibu_tpl',
    name: '생기부_양식.xlsx',
    kind: 'sheet',
    group: '학교·세특',
    modifiedAt: '2026-11-02',
    defaultStarred: false,
    url: 'https://docs.google.com/spreadsheets/d/1evOzJWH284hCLiZC96VqgdKqg09Qt5X-/edit?usp=drivesdk',
  },
  {
    id: 'gd_saenggibu_rec',
    name: '생기부 기록 양식',
    kind: 'sheet',
    group: '학교·세특',
    modifiedAt: '2026-09-11',
    defaultStarred: false,
    url: 'https://docs.google.com/spreadsheets/d/194nLp6wIxUXgz2LrHOlbtdADu4C9IOnatcbcK1wM5iI/edit?usp=drivesdk',
  },
  {
    id: 'gd_sci_roadmap',
    name: '2026 오송고 과학과 연간 마스터 로드맵',
    kind: 'slide',
    group: '학교·세특',
    modifiedAt: '2026-05-18',
    defaultStarred: false,
    url: 'https://docs.google.com/presentation/d/1j30OLp6TsmpHaHTVldOGye4RV38IQuEjX1UQyBRmnPk/edit?usp=drivesdk',
  },
  {
    id: 'gd_bio_ai_guide',
    name: '바이오인포매틱스 & Bio-AI 융합 프로그램 완벽 안내',
    kind: 'slide',
    group: '학교·세특',
    modifiedAt: '2026-05-19',
    defaultStarred: false,
    url: 'https://docs.google.com/presentation/d/1YTiC3pwndKLtpwXGRQhCVqbI4h5f5UlO_8gal-aOras/edit?usp=drivesdk',
  },

  // ===== 수행·활동지 =====
  {
    id: 'gd_math_week_hwp',
    name: '2026. 창의수학주간 탐구 보고서(2612 박준선).hwp',
    kind: 'hwp',
    group: '수행·활동지',
    modifiedAt: '2026-11-14',
    defaultStarred: true,
    url: 'https://drive.google.com/file/d/1XdaWxRIo2Fg5obW4GTOTZdjRfEmENnNi/view?usp=drivesdk',
  },
  {
    id: 'gd_ann_sheet',
    name: '인공신경망 실습파일의 사본',
    kind: 'sheet',
    group: '수행·활동지',
    modifiedAt: '2026-11-05',
    defaultStarred: false,
    url: 'https://docs.google.com/spreadsheets/d/1tfkReb8RR1kmQJksIB_i0PNzw1cDAJ7-rpg1EpfVQU8/edit?usp=drivesdk',
  },
  {
    id: 'gd_math_ppt',
    name: '창의수학발표회_2612 박준선 팀.pptx',
    kind: 'slide',
    group: '수행·활동지',
    modifiedAt: '2026-11-02',
    defaultStarred: false,
    url: 'https://docs.google.com/presentation/d/1qi7yJ5aBQePkcvymHJoz-3a_6Vtt6CDU/edit?usp=drivesdk',
  },
  {
    id: 'gd_fusion_sci_ppt',
    name: '2026_융합과학탐구프로젝트_중간발표양식.pptx',
    kind: 'slide',
    group: '수행·활동지',
    modifiedAt: '2026-11-02',
    defaultStarred: false,
    url: 'https://docs.google.com/presentation/d/1P9bwZhBoL6mxz-uSzIYZDITFpOHegKzr/edit?usp=drivesdk',
  },
  {
    id: 'gd_sw_ppt',
    name: 'SW 발표자료.pptx',
    kind: 'slide',
    group: '수행·활동지',
    modifiedAt: '2026-11-02',
    defaultStarred: false,
    url: 'https://docs.google.com/presentation/d/1UfBYxVta3pwBQtcwNM9n4b3PTPi_EbD7/edit?usp=drivesdk',
  },
  {
    id: 'gd_geom_xlsx',
    name: '2612 박준선 기하 수행 자료.xlsx',
    kind: 'sheet',
    group: '수행·활동지',
    modifiedAt: '2026-10-26',
    defaultStarred: false,
    url: 'https://docs.google.com/spreadsheets/d/1VFlTJh-1_fatBR3eoeJNzl-dy4lflqbz/edit?usp=drivesdk',
  },
  {
    id: 'gd_proj_perim',
    name: '정사영_둘레_탐구.xlsx',
    kind: 'sheet',
    group: '수행·활동지',
    modifiedAt: '2026-10-22',
    defaultStarred: false,
    url: 'https://docs.google.com/spreadsheets/d/1elaPRDoePFCD2BaO7FmsajOD0vza0hjL/edit?usp=drivesdk',
  },
  {
    id: 'gd_mat_energy_team',
    name: '물질과에너지_게임연구실_E_박준선 팀',
    kind: 'sheet',
    group: '수행·활동지',
    modifiedAt: '2026-10-22',
    defaultStarred: false,
    url: 'https://docs.google.com/spreadsheets/d/1ilGAnf6aB6MP46hX5yhlZV1HXUhEn_s6Ol0fw0McMUQ/edit?usp=drivesdk',
  },
  {
    id: 'gd_eng_crit_pdf',
    name: '(2612_박준선) Outline for English Literary Criticism.pdf',
    kind: 'pdf',
    group: '수행·활동지',
    modifiedAt: '2026-09-27',
    defaultStarred: false,
    url: 'https://drive.google.com/file/d/1SuMXIqN_bssIU_T2SFUtqcTTnmaPoBns/view',
  },
  {
    id: 'gd_comp_media_pdf',
    name: '(2612_박준선) Outline for Analysis of Expressions in Comparative Media.pdf',
    kind: 'pdf',
    group: '수행·활동지',
    modifiedAt: '2026-09-02',
    defaultStarred: false,
    url: 'https://drive.google.com/file/d/1ZKXACZdy7qnoiywVf807Xz64rqgKOeMU/view',
  },
  {
    id: 'gd_comp_lit_pdf',
    name: '(2612_박준선) Outline for Analysis of Comparative Literature.pdf',
    kind: 'pdf',
    group: '수행·활동지',
    modifiedAt: '2026-08-04',
    defaultStarred: false,
    url: 'https://drive.google.com/file/d/1nu5dwgpZLtQxt18Wvcst_RWwBjVOhtoy/view',
  },
  {
    id: 'gd_opinion_pdf',
    name: '(2612_박준선) Outline for Opinion Writing.pdf',
    kind: 'pdf',
    group: '수행·활동지',
    modifiedAt: '2026-08-04',
    defaultStarred: false,
    url: 'https://drive.google.com/file/d/1mhm4K8iLNyRs5fIHCRYy7OPH0NzdO9Ql/view',
  },
  {
    id: 'gd_stat_act1',
    name: '(활동지1_학술통계분석) 1213 박준선.hwp',
    kind: 'hwp',
    group: '수행·활동지',
    modifiedAt: '2025-10-11',
    defaultStarred: false,
    url: 'https://drive.google.com/file/d/1-L6a5BS0qCJS9XmkG7eRcNwjOWp6i-8E/view',
  },
  {
    id: 'gd_stat_act2',
    name: '(활동지2_학술통계 분석 성찰지) 1213 박준선.hwp',
    kind: 'hwp',
    group: '수행·활동지',
    modifiedAt: '2025-12-22',
    defaultStarred: false,
    url: 'https://drive.google.com/file/d/1XRiDFQSeU4gKwsg82UiqhUAXvCclzfAA/view',
  },

  // ===== 교재·시험지 =====
  {
    id: 'gd_mech_final',
    name: '오송고_역학과_에너지_기말고사_대비.pdf',
    kind: 'pdf',
    group: '교재·시험지',
    modifiedAt: '2026-11-10',
    defaultStarred: false,
    url: 'https://drive.google.com/file/d/1kAHp3JxO2ymUze355-b2MaU0KIXjRm_9/view?usp=drivesdk',
  },
  {
    id: 'gd_mech_ebs',
    name: '역학과에너지_EBS문제지.pdf',
    kind: 'pdf',
    group: '교재·시험지',
    modifiedAt: '2026-11-10',
    defaultStarred: false,
    url: 'https://drive.google.com/file/d/16UWL1Pp06Lvn0StfVX79qCUNkYz6bcid/view?usp=drivesdk',
  },
  {
    id: 'gd_mech_exam',
    name: '역학과에너지_시험지양식_해설포함.pdf',
    kind: 'pdf',
    group: '교재·시험지',
    modifiedAt: '2026-11-10',
    defaultStarred: false,
    url: 'https://drive.google.com/file/d/17Iw1vZkvinYfkPYkam1TobFlOmFsBt50/view?usp=drivesdk',
  },
  {
    id: 'gd_ai_danchoo',
    name: 'EBS 인공지능 DANCHOO+.pdf',
    kind: 'pdf',
    group: '교재·시험지',
    modifiedAt: '2026-11-10',
    defaultStarred: false,
    url: 'https://drive.google.com/file/d/1_-Etz_R48qb3aoubkVoIw-1rKwE5JY5E/view?usp=drivesdk',
  },
  {
    id: 'gd_aimath_ox',
    name: '인공지능수학_OX퀴즈_시험지.pdf',
    kind: 'pdf',
    group: '교재·시험지',
    modifiedAt: '2026-11-09',
    defaultStarred: false,
    url: 'https://drive.google.com/file/d/1MEdnjWIjkVcm56QNc_u-ko2i-B4ipG--/view?usp=drivesdk',
  },
  {
    id: 'gd_aimath_exam',
    name: '인공지능수학_시험지.pdf',
    kind: 'pdf',
    group: '교재·시험지',
    modifiedAt: '2026-11-08',
    defaultStarred: false,
    url: 'https://drive.google.com/file/d/1dE7inYR_PRHVr6fdPvbt3hmjZkIxETpB/view?usp=drivesdk',
  },
  {
    id: 'gd_aibasic_ox',
    name: '인공지능기초_OX퀴즈_시험지.pdf',
    kind: 'pdf',
    group: '교재·시험지',
    modifiedAt: '2026-11-08',
    defaultStarred: false,
    url: 'https://drive.google.com/file/d/1U13oeYThwUyuUhpWGqOIaf6XKtFO9WuH/view?usp=drivesdk',
  },
  {
    id: 'gd_aibasic_concept',
    name: '인공지능기초_개념서.pdf',
    kind: 'pdf',
    group: '교재·시험지',
    modifiedAt: '2026-11-07',
    defaultStarred: false,
    url: 'https://drive.google.com/file/d/12Aa6LamLPLwTRpr80vduVVrrVL9AbqFn/view?usp=drivesdk',
  },
  {
    id: 'gd_aibasic_26q',
    name: '인공지능기초_개념변별연습문제_26문항_시험지양식.pdf',
    kind: 'pdf',
    group: '교재·시험지',
    modifiedAt: '2026-11-07',
    defaultStarred: false,
    url: 'https://drive.google.com/file/d/1WhMEZxLPzENwSA-3YOfmdFTtDlfqEUbT/view?usp=drivesdk',
  },
  {
    id: 'gd_aibasic_killer1',
    name: '인공지능기초_킬러대비_교재1_논리추론.pdf',
    kind: 'pdf',
    group: '교재·시험지',
    modifiedAt: '2026-11-06',
    defaultStarred: false,
    url: 'https://drive.google.com/file/d/1Z0dNpqKD2PAL5X7BYVBKVEu3I2J6Fa-1/view?usp=drivesdk',
  },
  {
    id: 'gd_aibasic_killer2',
    name: '인공지능기초_킬러대비_교재2_기계학습판별눈금함정.pdf',
    kind: 'pdf',
    group: '교재·시험지',
    modifiedAt: '2026-11-06',
    defaultStarred: false,
    url: 'https://drive.google.com/file/d/1CoYkFvbRAUy1bruNdtM4pDsXVn4ynlHG/view?usp=drivesdk',
  },
  {
    id: 'gd_aibasic_killer3',
    name: '인공지능기초_킬러대비_교재3_개념변형모음.pdf',
    kind: 'pdf',
    group: '교재·시험지',
    modifiedAt: '2026-11-06',
    defaultStarred: false,
    url: 'https://drive.google.com/file/d/1_f6TeOthtsmeuipSws4k67MpuzW0HgLt/view?usp=drivesdk',
  },
  {
    id: 'gd_ssen_geom_quick',
    name: '(22개정) 쎈 기하 (빠른답지).pdf',
    kind: 'pdf',
    group: '교재·시험지',
    modifiedAt: '2026-09-22',
    defaultStarred: false,
    url: 'https://drive.google.com/file/d/1KPOteurw5MGaS1YZdrRhLa8rvUcO-rPb/view',
  },
  {
    id: 'gd_ssen_geom_12',
    name: '(22개정) 쎈 기하 (1·2단원 답지).pdf',
    kind: 'pdf',
    group: '교재·시험지',
    modifiedAt: '2026-09-22',
    defaultStarred: false,
    url: 'https://drive.google.com/file/d/1q3JZxGEI27gskdU6qR-rw4Yb1A9V0Zzj/view',
  },
  {
    id: 'gd_ssen_geom_3',
    name: '(22개정) 쎈 기하 (3단원 답지).pdf',
    kind: 'pdf',
    group: '교재·시험지',
    modifiedAt: '2026-09-22',
    defaultStarred: false,
    url: 'https://drive.google.com/file/d/1SoQUe026DqL0w4ub5J84LjESX7AfqRHj/view',
  },
  {
    id: 'gd_wanja_mat_ans',
    name: '(22개정) 완자 물질과에너지 정답 (학생용).pdf',
    kind: 'pdf',
    group: '교재·시험지',
    modifiedAt: '2026-08-21',
    defaultStarred: false,
    url: 'https://drive.google.com/file/d/1tfGrzhF-5L0VT3ZVa2kqcWHlzqlmSYci/view',
  },
  {
    id: 'gd_wanja_mech_ans',
    name: '(22개정) 완자 고등역학과에너지 정답 (학생용).pdf',
    kind: 'pdf',
    group: '교재·시험지',
    modifiedAt: '2026-08-20',
    defaultStarred: false,
    url: 'https://drive.google.com/file/d/1uCyLRXHQFbwxUT-XlHekll-51oNaJYsk/view',
  },
  {
    id: 'gd_chem_book',
    name: '(용량 변경) 화학 교재.pdf',
    kind: 'pdf',
    group: '교재·시험지',
    modifiedAt: '2026-05-08',
    defaultStarred: false,
    url: 'https://drive.google.com/file/d/1VzTUqiub6DKbvbyxajTt5MoWQW2Kd6yb/view',
  },
  {
    id: 'gd_wanja_phys_11',
    name: '(22개정) 완자 물리학 1-1. 힘과 운동.pdf',
    kind: 'pdf',
    group: '교재·시험지',
    modifiedAt: '2026-02-04',
    defaultStarred: false,
    url: 'https://drive.google.com/file/d/1pr00Vxx0K0Zh2ItG1aIdgBPLBM_rFhSg/view',
  },
  {
    id: 'gd_wanja_phys_21',
    name: '(22개정) 완자 물리학 2-1. 전기.pdf',
    kind: 'pdf',
    group: '교재·시험지',
    modifiedAt: '2026-02-04',
    defaultStarred: false,
    url: 'https://drive.google.com/file/d/1KfON-US_pTkkVE09Pzd9mZ93TmLu688y/view',
  },
  {
    id: 'gd_wanja_phys_22',
    name: '(22개정) 완자 물리학 2-2. 자기.pdf',
    kind: 'pdf',
    group: '교재·시험지',
    modifiedAt: '2026-02-04',
    defaultStarred: false,
    url: 'https://drive.google.com/file/d/1hDeLut6mzk3nK4hxUjEJJFmzAcXxQ-MH/view',
  },

  // ===== 입시·진학 =====
  {
    id: 'gd_univ_counsel_js',
    name: '2028_진학상담자료_박준선.xlsx',
    kind: 'sheet',
    group: '입시·진학',
    modifiedAt: '2026-11-12',
    defaultStarred: true,
    url: 'https://docs.google.com/spreadsheets/d/1rGg0xtcjOLQMk8i04xvJ8QycvImPEMX1/edit?usp=drivesdk',
  },
  {
    id: 'gd_univ_counsel_01',
    name: '01. 2028 대입 진학 상담 자료 (작성본)',
    kind: 'sheet',
    group: '입시·진학',
    modifiedAt: '2026-11-12',
    defaultStarred: false,
    url: 'https://docs.google.com/spreadsheets/d/19cHWzVWiINNie_EjemaCT-iJ0W6x1sKCOEe800SdtHQ/edit?usp=drivesdk',
  },
  {
    id: 'gd_univ_2028_common',
    name: '2028학년도 학사과정 입학전형 시행계획.pdf',
    kind: 'pdf',
    group: '입시·진학',
    modifiedAt: '2026-11-12',
    defaultStarred: false,
    url: 'https://drive.google.com/file/d/1uT05EZErpN-_mylrsLxAX3qGZKKgeM4F/view?usp=drivesdk',
  },
  {
    id: 'gd_univ_snu',
    name: '서울대학교_2028_전형시행계획.pdf',
    kind: 'pdf',
    group: '입시·진학',
    modifiedAt: '2026-11-12',
    defaultStarred: false,
    url: 'https://drive.google.com/file/d/1N2hI4I7uqiEHWqVp1MZON4NKAqslsGoC/view?usp=drivesdk',
  },
  {
    id: 'gd_univ_yonsei',
    name: '연세대학교_2028_전형시행계획.pdf',
    kind: 'pdf',
    group: '입시·진학',
    modifiedAt: '2026-11-12',
    defaultStarred: false,
    url: 'https://drive.google.com/file/d/1LI8f1TB6zeUv0KeJKPgO0jEdMqvQecZ6/view?usp=drivesdk',
  },
  {
    id: 'gd_univ_korea',
    name: '고려대학교_2028_전형시행계획.pdf',
    kind: 'pdf',
    group: '입시·진학',
    modifiedAt: '2026-11-12',
    defaultStarred: false,
    url: 'https://drive.google.com/file/d/1XoqhgKZhUVOx4Uf-O6KH-rovejCbLoXU/view?usp=drivesdk',
  },
  {
    id: 'gd_univ_skku',
    name: '성균관대학교_2028_전형시행계획.pdf',
    kind: 'pdf',
    group: '입시·진학',
    modifiedAt: '2026-11-12',
    defaultStarred: false,
    url: 'https://drive.google.com/file/d/1uZuMqKu5N-RwxX5dVGawgtRtzIugDqbu/view?usp=drivesdk',
  },
  {
    id: 'gd_univ_hanyang',
    name: '한양대학교_2028_전형시행계획.pdf',
    kind: 'pdf',
    group: '입시·진학',
    modifiedAt: '2026-11-12',
    defaultStarred: false,
    url: 'https://drive.google.com/file/d/1htQnMUoAPzaOu4xeZEtRpfD394t2bJLk/view?usp=drivesdk',
  },
  {
    id: 'gd_univ_sogang',
    name: '서강대학교_2028_전형시행계획.pdf',
    kind: 'pdf',
    group: '입시·진학',
    modifiedAt: '2026-11-12',
    defaultStarred: false,
    url: 'https://drive.google.com/file/d/1QxQYSWjIzo_hPJ81b_kE5YKOTOgHf6Pk/view?usp=drivesdk',
  },
  {
    id: 'gd_univ_cau',
    name: '중앙대학교_2028_전형시행계획.pdf',
    kind: 'pdf',
    group: '입시·진학',
    modifiedAt: '2026-11-12',
    defaultStarred: false,
    url: 'https://drive.google.com/file/d/1YPnpjZhPS8fYxDAUdSdRqx0r8R9omUlu/view?usp=drivesdk',
  },
  {
    id: 'gd_univ_khu',
    name: '경희대학교_2028_전형시행계획.pdf',
    kind: 'pdf',
    group: '입시·진학',
    modifiedAt: '2026-11-12',
    defaultStarred: false,
    url: 'https://drive.google.com/file/d/1A7KZqvGmbR9lUfWcyngVNBGpsLU4d7pC/view?usp=drivesdk',
  },
  {
    id: 'gd_univ_uos',
    name: '서울시립대학교_2028_전형시행계획.pdf',
    kind: 'pdf',
    group: '입시·진학',
    modifiedAt: '2026-11-12',
    defaultStarred: false,
    url: 'https://drive.google.com/file/d/1vrwP8HwTWQFuMuzo7D5_ubJwWeAfFw1j/view?usp=drivesdk',
  },
  {
    id: 'gd_univ_konkuk',
    name: '건국대학교_2028_전형시행계획.pdf',
    kind: 'pdf',
    group: '입시·진학',
    modifiedAt: '2026-11-12',
    defaultStarred: false,
    url: 'https://drive.google.com/file/d/1MoWyaBlGCC__vaVMgC9HxQl6siHYECKy/view?usp=drivesdk',
  },
  {
    id: 'gd_univ_dongguk',
    name: '동국대학교_2028_전형시행계획.pdf',
    kind: 'pdf',
    group: '입시·진학',
    modifiedAt: '2026-11-12',
    defaultStarred: false,
    url: 'https://drive.google.com/file/d/1K4IfDpsKH4KuXe5AbZQQS5CU_fT16TVF/view?usp=drivesdk',
  },
  {
    id: 'gd_univ_hongik',
    name: '홍익대학교서울_2028_전형시행계획.pdf',
    kind: 'pdf',
    group: '입시·진학',
    modifiedAt: '2026-11-12',
    defaultStarred: false,
    url: 'https://drive.google.com/file/d/1BaI-o52Ru8kMbaAGn8SzE5s24o3p399Y/view?usp=drivesdk',
  },
  {
    id: 'gd_univ_cnu',
    name: '충남대학교_2028_전형시행계획.pdf',
    kind: 'pdf',
    group: '입시·진학',
    modifiedAt: '2026-11-12',
    defaultStarred: false,
    url: 'https://drive.google.com/file/d/12lTpokyl7A0NZDjIqiZnkDuG8KOnxnga/view?usp=drivesdk',
  },
];

const DEFAULT_DOC_BY_ID = new Map(DEFAULT_HUB_DOCS.map((d) => [d.id, d]));
const DEFAULT_DOC_BY_URL = new Map(DEFAULT_HUB_DOCS.map((d) => [d.url, d]));

function normalizeDocRecord(raw, fallbackOrder) {
  if (!raw || typeof raw !== 'object') return null;
  const name = String(raw.name || '').trim();
  const url = String(raw.url || '').trim();
  if (!name || !url) return null;
  const id = String(raw.id || '').trim() || 'bm_' + name;
  const kind = KIND_MAP[raw.kind] ? raw.kind : detectBookmarkKind(url, name);
  const group = String(raw.group || '기본').trim() || '기본';
  const modifiedAt = String(raw.modifiedAt || '').trim();
  const rec = {
    id,
    name,
    url,
    kind,
    group,
    modifiedAt,
  };
  if (raw.noteId) rec.noteId = String(raw.noteId);
  if (raw.sub) rec.sub = String(raw.sub);
  if (fallbackOrder != null) {
    rec.order = Number.isFinite(Number(raw.order)) ? Number(raw.order) : fallbackOrder;
  }
  return rec;
}

export function normalizeHubState(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const rawItems = Array.isArray(src.items) ? src.items : [];
  const rawCustom = Array.isArray(src.customDocs) ? src.customDocs : [];
  const unstarredSet = new Set(
    (Array.isArray(src.unstarredIds) ? src.unstarredIds : [])
      .map((x) => String(x || '').trim())
      .filter(Boolean)
  );

  let items = rawItems
    .map((x, idx) => normalizeDocRecord(x, idx + 1))
    .filter(Boolean);

  // 첫 초기화(아직 initialized 플래그가 없고 items도 비어 있을 때)만 기본 추천 즐겨찾기 5종 자동 시드
  if (!src.initialized && items.length === 0) {
    items = DEFAULT_HUB_DOCS.filter(
      (d) => d.defaultStarred && !unstarredSet.has(d.id)
    ).map((d, idx) => ({
      id: d.id,
      name: d.name,
      url: d.url,
      kind: d.kind,
      group: d.group,
      modifiedAt: d.modifiedAt || '',
      order: idx + 1,
    }));
  }

  items.sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
  items = items.map((x, idx) => ({ ...x, order: idx + 1 }));

  const customDocs = [];
  const customSeenIds = new Set();
  const customSeenUrls = new Set();

  const pushCustomDoc = (entry) => {
    const rec = normalizeDocRecord(entry, null);
    if (!rec) return;
    if (rec.noteId || rec.id.startsWith('note:')) return;
    if (DEFAULT_DOC_BY_ID.has(rec.id) || DEFAULT_DOC_BY_URL.has(rec.url)) return;
    if (customSeenIds.has(rec.id) || customSeenUrls.has(rec.url)) return;
    customSeenIds.add(rec.id);
    customSeenUrls.add(rec.url);
    customDocs.push(rec);
  };

  for (const c of rawCustom) pushCustomDoc(c);
  // 기존 items에 있던 사용자 정의 문서도 카탈로그에 보존(즐겨찾기 해제 시에도 목록에 남도록)
  for (const it of items) pushCustomDoc(it);

  return {
    items,
    customDocs,
    unstarredIds: [...unstarredSet],
    initialized: true,
  };
}

export function buildHubDocumentCatalog(hubState, notesState) {
  const hub = normalizeHubState(hubState);
  const starredById = new Map();
  const starredByUrl = new Map();

  for (const bm of hub.items) {
    starredById.set(bm.id, bm);
    if (bm.url && !bm.url.startsWith('#')) {
      starredByUrl.set(bm.url, bm);
    }
  }

  const catalog = [];
  const seenIds = new Set();
  const seenUrls = new Set();

  const appendEntry = (base, meta) => {
    if (!base || seenIds.has(base.id)) return;
    if (base.url && !base.url.startsWith('#') && seenUrls.has(base.url)) return;
    seenIds.add(base.id);
    if (base.url && !base.url.startsWith('#')) seenUrls.add(base.url);

    const starEntry =
      starredById.get(base.id) ||
      (base.url && !base.url.startsWith('#') ? starredByUrl.get(base.url) : null);

    catalog.push({
      id: base.id,
      name: starEntry ? starEntry.name : base.name,
      url: base.url,
      kind: starEntry ? starEntry.kind : base.kind,
      group: starEntry ? starEntry.group : base.group,
      modifiedAt: base.modifiedAt || '',
      ...(base.noteId ? { noteId: base.noteId } : {}),
      ...(base.sub ? { sub: base.sub } : {}),
      ...meta,
      starred: Boolean(starEntry),
      starOrder: starEntry ? starEntry.order ?? 9999 : null,
    });
  };

  for (const doc of DEFAULT_HUB_DOCS) {
    appendEntry(doc, { isDefault: true, isCustom: false, isNote: false });
  }

  for (const doc of hub.customDocs) {
    appendEntry(doc, { isDefault: false, isCustom: true, isNote: false });
  }

  const notes =
    notesState && Array.isArray(notesState.items) ? notesState.items : [];
  for (const note of notes) {
    if (!note || !note.id) continue;
    appendEntry(
      {
        id: 'note:' + note.id,
        noteId: note.id,
        name: note.title || '제목 없는 메모',
        kind: 'onenote',
        group: '원노트·메모',
        modifiedAt: String(note.updatedAt || note.date || '').slice(0, 10),
        url: note.onenoteWebUrl || '#note:' + note.id,
        sub: note.subject || '일반',
      },
      { isDefault: false, isCustom: false, isNote: true }
    );
  }

  return catalog;
}

export function toggleHubStar(hubState, docId, notesState) {
  const hub = normalizeHubState(hubState);
  const catalog = buildHubDocumentCatalog(hub, notesState);
  const target = catalog.find((d) => d.id === docId);

  const matchIdx = hub.items.findIndex(
    (x) =>
      x.id === docId ||
      (target &&
        target.url &&
        !target.url.startsWith('#') &&
        x.url === target.url)
  );

  const unstarredSet = new Set(hub.unstarredIds || []);

  if (matchIdx >= 0) {
    const removed = hub.items[matchIdx];
    const nextItems = hub.items
      .filter((_, idx) => idx !== matchIdx)
      .map((x, idx) => ({ ...x, order: idx + 1 }));
    unstarredSet.add(docId);
    if (removed && removed.id) unstarredSet.add(removed.id);
    return normalizeHubState({
      ...hub,
      items: nextItems,
      unstarredIds: [...unstarredSet],
      initialized: true,
    });
  }

  if (!target) return hub;

  const maxOrder = hub.items.reduce((m, x) => Math.max(m, x.order ?? 0), 0);
  unstarredSet.delete(target.id);
  const nextItems = [
    ...hub.items,
    {
      id: target.id,
      name: target.name,
      url: target.url,
      kind: target.kind,
      group: target.group,
      modifiedAt: target.modifiedAt || '',
      ...(target.noteId ? { noteId: target.noteId } : {}),
      order: maxOrder + 1,
    },
  ];

  return normalizeHubState({
    ...hub,
    items: nextItems,
    unstarredIds: [...unstarredSet],
    initialized: true,
  });
}
