// Vercel Serverless Function: POST /api/character
// Generates a long, structured "art-direction brief" style prompt for turning a
// photo/character into a specific stylized avatar (e.g. for a profile picture),
// meant to be pasted into ChatGPT alongside an attached reference photo.

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST 요청만 지원합니다.' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: '서버에 GEMINI_API_KEY가 설정되지 않았습니다. Vercel 프로젝트 환경 변수를 확인해주세요.' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const { subject, styleWorld, target } = body || {};

  const TARGET_NAMES = { chatgpt: 'ChatGPT', gemini: 'Gemini', claude: 'Claude' };
  const targetName = TARGET_NAMES[target] || TARGET_NAMES.chatgpt;

  if (typeof subject !== 'string' || !subject.trim()) {
    res.status(400).json({ error: '변환할 캐릭터나 사진에 대한 설명을 입력해주세요.' });
    return;
  }
  if (subject.length > 500) {
    res.status(400).json({ error: '설명이 너무 길어요. 500자 이하로 줄여주세요.' });
    return;
  }
  if (typeof styleWorld !== 'string' || !styleWorld.trim()) {
    res.status(400).json({ error: '원하는 스타일/세계관을 입력해주세요.' });
    return;
  }
  if (styleWorld.length > 200) {
    res.status(400).json({ error: '스타일 설명이 너무 길어요. 200자 이하로 줄여주세요.' });
    return;
  }

  const subjectTrimmed = subject.trim();
  const styleTrimmed = styleWorld.trim();

  const prompt = `당신은 사진이나 캐릭터 묘사를 받아 특정 스타일 세계관의 아바타로 재해석하는 이미지 생성 프롬프트를 전문적으로 작성하는 프롬프트 엔지니어다.

아래 정보를 참고해서, ${targetName}의 이미지 생성 기능에 그대로 붙여넣어 쓸 수 있는 매우 상세하고 정교한 "아트 디렉션 브리프" 형식의 프롬프트 하나를 작성하라. 사용자는 이 프롬프트와 함께 변환하고 싶은 사진을 ${targetName}에 첨부할 예정이다.

변환 대상: "${subjectTrimmed}"
목표 스타일/세계관: "${styleTrimmed}"

다음 구조와 분량, 톤을 반드시 따를 것 (실제 업계 아트 디렉터가 작성한 상세 브리프처럼):

1. 첫 문장: "당신은 (사진 속 인물/캐릭터)을 ${styleTrimmed}로 변환하는 전문 [적절한 직함]이다" 형태의 역할 정의 한 문장.
2. "[입력]" 섹션: 사용자가 무엇을 입력하거나 첨부해야 하는지 (캐릭터명 기재, 이미지 첨부 등).
3. "[작업]" 섹션: 원본에서 분석해서 반영해야 할 특징들을 번호를 매겨 나열하라 (헤어스타일, 머리색, 눈 색상·눈매, 표정, 의상, 액세서리, 상징 요소, 대표 컬러 등 대상 성격에 맞게 구체적으로).
4. "[${styleTrimmed} SPEC]" 섹션(하나 이상, 필요하면 여러 개로 나눠도 됨): 목표 스타일의 구조적 규칙을 항목별로 매우 구체적으로 기술하라 — 비율/등신, 시점, 얼굴 구조(눈·코·입 표현 방식), 헤어 표현 규칙, 신체·팔다리 비율, 채색·셰이딩 규칙, 그 세계관 특유의 필수 요소(있다면) 등. 실제로 그 스타일을 잘 아는 전문가가 쓴 것처럼 정확하고 디테일해야 한다.
   - 매우 중요한 제약 (신체 비율): "${styleTrimmed}"라는 이름/설명 안에 "SD", "치비", "chibi", "도트", "픽셀", "마스코트", "Q버전" 같은 단어가 명시적으로 들어있지 않다면, 절대로 "2~3등신", "SD 체형", "통통한 몸", "짧고 통통한 팔다리" 같은 표현을 쓰지 마라. 실제 정식 방영 TV 애니메이션·영화·게임 캐릭터(예: 짱구는 못말려, 안녕자두야, 마루코는 아홉살, 디즈니, 지브리, 포켓몬스터 등 대부분의 캐릭터)는 SD/치비 체형이 아니라 정상적인 아동·성인 신체 비율(대략 4~7등신)을 쓴다. 이런 경우 "정상적인 초등학생 체형의 4~5등신", "만화적으로 단순화됐지만 팔다리 비율은 자연스러운 아동 체형" 처럼 그 작품에 실제로 맞는 비율을 서술하라. 근거 없이 캐릭터를 더 아이처럼·둥글게·통통하게 만들지 말고, "${styleTrimmed}"를 아는 사람이 보면 바로 알아볼 만큼 그 작품 고유의 실제 그림체(선화 두께, 눈코입 비례, 신체 비율, 색감)를 정확히 재현하는 데 집중하라.
   - 매우 중요한 제약 (주름 묘사 금지): 옷의 주름·접힘·구김, 피부의 잔주름이나 팔다리 관절 부분의 음영 주름 등 "주름"에 해당하는 표현은 SPEC의 어떤 항목에도 넣지 마라. 그림자·셰이딩을 설명할 때도 "옷 주름을 따라 그림자를 넣는다"처럼 주름을 근거로 든 표현을 쓰지 말고, 대신 완전히 평면적인 단색 블록 위주의 셀 셰이딩으로만 서술하라.
5. "[출력 조건]" 섹션: 인스타그램·카카오톡 등 SNS 프로필 사진으로 바로 쓸 수 있도록 — 정사각형 캔버스, 단색(가급적 흰색) 배경, 인물 단독, 중앙 배치, 전신 또는 상반신 중 스타일에 맞는 쪽, 텍스트·로고·워터마크·UI 금지 등을 명시하라.
6. "[절대 금지]" 섹션: 목표 스타일과 혼동되기 쉬운 다른 스타일이나 흔한 실수를 실제로 있을 법하게 구체적으로 나열하라 (예: 실사, 3D 렌더, 다른 유명 프랜차이즈·작품 스타일과의 혼동, 과도한 디테일, 원본 인물의 얼굴을 그대로 복제하는 것 등 — 대상과 스타일에 맞게 판단해서 작성). 이 섹션에는 반드시 "옷 주름, 피부 주름 등 주름 표현 금지" 항목을 포함하라.
7. 마지막 문단: 목표를 한 번 더 강조하며 마무리하는 1~2문장.

전체 분량은 짧지 않게, 실제 전문 아트 디렉터의 상세 지시서 수준으로 작성하라. 각 섹션은 줄바꿈으로 명확히 구분하고, 대괄호 섹션 제목은 그대로 유지하라. 프롬프트 본문만 출력하고 그 외의 설명, 인사말, 따옴표는 절대 추가하지 마라.`;

  const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const geminiBody = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const data = await r.json();

    if (!r.ok) {
      const message = (data && data.error && data.error.message) || 'Gemini API 호출에 실패했어요.';
      res.status(502).json({ error: message });
      return;
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      const finishReason = data?.candidates?.[0]?.finishReason;
      res.status(502).json({ error: finishReason === 'SAFETY' ? '요청이 안전 정책에 의해 거부됐어요. 내용을 바꿔서 다시 시도해주세요.' : 'Gemini가 결과를 생성하지 못했어요.' });
      return;
    }

    res.status(200).json({ prompt: text.trim() });
  } catch (err) {
    clearTimeout(timeout);
    if (err && err.name === 'AbortError') {
      res.status(504).json({ error: '요청 시간이 초과됐어요. 잠시 후 다시 시도해주세요.' });
      return;
    }
    res.status(500).json({ error: '서버에서 오류가 발생했어요. 잠시 후 다시 시도해주세요.' });
  }
};
