const regimeBands = [
  { min: 80, name: '공격 구간', summary: '수급·매크로·섹터 확산이 동시에 우호적인 구간입니다.', action: '주도주 보유, 눌림 관심, 과도한 추격은 제한' },
  { min: 65, name: '상승 지속 구간', summary: '핵심 조건은 좋지만 일부 부담이 남아 있는 구간입니다.', action: '분할 접근, 종가와 수급 지속성 확인' },
  { min: 50, name: '중립 구간', summary: '방향성 확인이 필요한 구간입니다.', action: '추격 금지, 기준 가격과 수급 재확인' },
  { min: 35, name: '약화 구간', summary: '가격은 버틸 수 있지만 수급·확산이 약해지는 구간입니다.', action: '비중 축소, 현금 확보, 신규 진입 제한' },
  { min: 0, name: '리스크오프 구간', summary: '환율·금리·외국인·미국 반도체가 부담으로 작용하는 구간입니다.', action: '방어 우선, 물타기 금지, 현금 관리' }
];

const samsungType = (total, values) => {
  const [foreign, institution, volume, relative, macro, usSemi, breadth] = values;
  if (total >= 80 && foreign >= 15 && volume >= 11 && usSemi >= 11 && breadth >= 7) return '반도체 업황 재평가형 상승';
  if (total >= 65 && foreign >= 15 && breadth <= 5) return '외국인 패시브 유입형 상승';
  if (volume >= 11 && foreign <= 8 && institution <= 4) return '뉴스·정책 기대감형 상승';
  if (total >= 50 && foreign <= 10 && breadth <= 5 && usSemi <= 8) return '숏커버·되돌림형 상승';
  if (volume >= 11 && foreign <= 6 && breadth <= 4) return '분배형 상승 주의';
  return getRegime(total).name;
};

const scenarioData = {
  gapUp: {
    title: '삼성전자 장 초반 갭상승',
    meaning: '기대감이 선반영되었을 가능성이 있습니다. 장 초반 강세만으로 추세를 확정하면 위험합니다.',
    check: '외국인 순매수 지속, 거래대금 증가, 종가 고가권 유지, 관련주 확산 여부를 확인합니다.',
    action: '장중 고점 추격보다 종가와 수급 확인 후 분할 대응합니다.'
  },
  gapDown: {
    title: '삼성전자 장 초반 갭하락',
    meaning: '미국장 영향, 환율 부담, 단기 수급 충격이 반영된 출발일 수 있습니다.',
    check: '장 초반 저가 이탈 여부보다 외국인 수급, 코스피 회복력, 미국 반도체 선물 분위기를 봅니다.',
    action: '투매성 추격매도보다 오전 변동성 진정 후 종가 기준으로 판단합니다.'
  },
  foreignBuy: {
    title: '외국인 강한 순매수',
    meaning: '대형주 또는 반도체 중심으로 기관성 자금이 들어오는 구간일 수 있습니다.',
    check: '삼성전자 단독 매수인지, 코스피 대형주와 SK하이닉스까지 동반 매수인지 확인합니다.',
    action: '주도주 보유 우위. 다만 단기 급등 후에는 눌림 확인이 유리합니다.'
  },
  foreignSell: {
    title: '외국인 순매도 전환',
    meaning: '상승을 만들던 핵심 수급이 약해지는 신호일 수 있습니다.',
    check: '환율 상승, 미국 반도체 약세, 기관 방어 실패가 같이 나오는지 확인합니다.',
    action: '비중 확대 금지. 수익 구간은 일부 보호, 손실 구간은 물타기보다 비중 점검이 우선입니다.'
  },
  fxSpike: {
    title: '환율 급등',
    meaning: '외국인 자금 환경이 불안정해지는 대표 신호입니다.',
    check: '환율 급등과 외국인 순매도가 동시에 나오는지, 코스피 대형주가 같이 약해지는지 봅니다.',
    action: '대형주 신규 진입을 줄이고 현금 비중을 높이는 방향으로 봅니다.'
  },
  usSemiDrop: {
    title: '미국 반도체 급락',
    meaning: '국내 반도체 갭하락 가능성이 커지는 구간입니다.',
    check: 'SOX 전체 하락인지, 엔비디아·마이크론·ASML 중 어디가 약한지 분해해서 확인합니다.',
    action: '장 초반 하락 추격보다 반등 강도, 거래량, 외국인 수급을 확인합니다.'
  },
  policyNews: {
    title: '정책 뉴스 급등',
    meaning: '재료성 단기 급등일 가능성과 실제 수급 재평가 가능성을 구분해야 합니다.',
    check: '뉴스 이후 외국인·기관 동반 수급이 붙는지, 관련주가 확산되는지 확인합니다.',
    action: '뉴스만 보고 추격하지 않고 수급과 종가로 진짜 강도를 판단합니다.'
  },
  breakEven: {
    title: '본전 회복',
    meaning: '심리적으로 전량 매도하고 싶은 구간이지만, 시장 레짐과 종목 흐름을 분리해야 합니다.',
    check: '본전이 왔기 때문에 파는 것인지, 수급과 추세가 꺾여서 줄이는 것인지 구분합니다.',
    action: '전량 매도보다 일부 비중 조절 후 나머지는 레짐과 수급으로 판단합니다.'
  }
};

function getRegime(total) {
  return regimeBands.find(band => total >= band.min) || regimeBands[regimeBands.length - 1];
}

function updateCalculator(name) {
  const panel = document.querySelector(`[data-calculator="${name}"]`);
  if (!panel) return;
  const inputs = [...panel.querySelectorAll('input[type="range"]')];
  const values = inputs.map(input => Number(input.value));
  const total = values.reduce((sum, value) => sum + value, 0);
  inputs.forEach(input => {
    const out = input.parentElement.querySelector('output');
    if (out) out.textContent = input.value;
  });

  const totalEl = document.getElementById(`${name}Total`);
  const regimeEl = document.getElementById(`${name}Regime`);
  const interpretation = document.getElementById(`${name}Interpretation`);
  const regime = getRegime(total);
  if (totalEl) totalEl.textContent = total;
  if (regimeEl) regimeEl.textContent = name === 'samsung' ? samsungType(total, values) : regime.name;
  if (interpretation) {
    const title = name === 'samsung' ? samsungType(total, values) : regime.name;
    interpretation.innerHTML = `
      <span class="card-label">판정 결과</span>
      <h3>${title}</h3>
      <p>${regime.summary}</p>
      <ul class="mini-list">
        <li>총점: ${total}/100</li>
        <li>대응 관점: ${regime.action}</li>
        <li>핵심: 점수보다 수급·매크로·확산의 조합을 우선 확인</li>
      </ul>
    `;
  }
}

function setupCalculators() {
  document.querySelectorAll('[data-calculator] input[type="range"]').forEach(input => {
    input.addEventListener('input', () => updateCalculator(input.closest('[data-calculator]').dataset.calculator));
  });
  updateCalculator('market');
  updateCalculator('samsung');
}

function setupMaterialSearch() {
  const input = document.getElementById('materialSearch');
  const cards = [...document.querySelectorAll('.material-card')];
  if (!input) return;
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    cards.forEach(card => {
      const text = `${card.textContent} ${card.dataset.keywords || ''}`.toLowerCase();
      card.classList.toggle('is-hidden', q && !text.includes(q));
    });
  });
}

function setupScenario() {
  const picker = document.getElementById('scenarioPicker');
  const result = document.getElementById('scenarioResult');
  if (!picker || !result) return;
  const render = () => {
    const item = scenarioData[picker.value];
    result.innerHTML = `
      <h3>${item.title}</h3>
      <div class="scenario-columns">
        <div><strong>해석</strong><p>${item.meaning}</p></div>
        <div><strong>확인할 것</strong><p>${item.check}</p></div>
        <div><strong>대응 기준</strong><p>${item.action}</p></div>
      </div>
    `;
  };
  picker.addEventListener('change', render);
  render();
}

function serializeReport() {
  const form = document.getElementById('reportForm');
  const data = new FormData(form);
  const labels = {
    date: '날짜', kospi: '코스피 흐름', samsung: '삼성전자 흐름', flow: '외국인·기관 수급', macro: '환율·금리·미국 반도체', breadth: '반도체·전력 인프라 확산 여부', regime: '오늘 시장 레짐', conclusion: '오늘의 결론', tomorrow: '내일 봐야 할 것', position: '내 포지션 대응'
  };
  return Object.entries(labels).map(([key, label]) => `${label}:\n${data.get(key) || ''}`).join('\n\n');
}

function setupReport() {
  const form = document.getElementById('reportForm');
  const save = document.getElementById('saveReport');
  const copy = document.getElementById('copyReport');
  const clear = document.getElementById('clearReport');
  if (!form) return;

  const saved = localStorage.getItem('strategy-note-report');
  if (saved) {
    const obj = JSON.parse(saved);
    Object.entries(obj).forEach(([key, value]) => {
      const field = form.elements[key];
      if (field) field.value = value;
    });
  } else if (form.elements.date) {
    form.elements.date.valueAsDate = new Date();
  }

  save?.addEventListener('click', () => {
    const obj = Object.fromEntries(new FormData(form).entries());
    localStorage.setItem('strategy-note-report', JSON.stringify(obj));
    save.textContent = '저장 완료';
    setTimeout(() => save.textContent = '저장', 1300);
  });

  copy?.addEventListener('click', async () => {
    const text = serializeReport();
    try {
      await navigator.clipboard.writeText(text);
      copy.textContent = '복사 완료';
      setTimeout(() => copy.textContent = '텍스트 복사', 1300);
    } catch (e) {
      alert(text);
    }
  });

  clear?.addEventListener('click', () => {
    form.reset();
    localStorage.removeItem('strategy-note-report');
    if (form.elements.date) form.elements.date.valueAsDate = new Date();
  });
}

function setupMenu() {
  const btn = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.nav');
  if (!btn || !nav) return;
  btn.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    btn.setAttribute('aria-expanded', String(open));
  });
  nav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => nav.classList.remove('is-open')));
}

function setupPrint() {
  document.getElementById('printSite')?.addEventListener('click', () => window.print());
}

document.addEventListener('DOMContentLoaded', () => {
  setupMenu();
  setupCalculators();
  setupMaterialSearch();
  setupScenario();
  setupReport();
  setupPrint();
});
