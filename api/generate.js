// Vercel Serverless Function: POST /api/generate
// Gemini API 키는 환경 변수(GEMINI_API_KEY)로만 다루며 클라이언트에는 절대 내려주지 않는다.

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
  const { idea, style, useEnglish, platforms, attachment } = body || {};

  if (typeof idea !== 'string' || !idea.trim()) {
    res.status(400).json({ error: '무엇을 만들고 싶은지 입력해주세요.' });
    return;
  }
  if (idea.length > 800) {
    res.status(400).json({ error: '요청 내용이 너무 길어요. 800자 이하로 줄여주세요.' });
    return;
  }
  if (typeof style === 'string' && style.length > 300) {
    res.status(400).json({ error: '스타일 설명이 너무 길어요. 300자 이하로 줄여주세요.' });
    return;
  }
  if (!Array.isArray(platforms) || platforms.length === 0) {
    res.status(400).json({ error: '통역할 AI를 하나 이상 선택해주세요.' });
    return;
  }
  if (platforms.length > 12) {
    res.status(400).json({ error: '한 번에 요청할 수 있는 플랫폼 수를 초과했어요.' });
    return;
  }
  for (const p of platforms) {
    if (!p || typeof p.id !== 'string' || typeof p.label !== 'string' || typeof p.dialect !== 'string') {
      res.status(400).json({ error: '플랫폼 정보가 올바르지 않아요.' });
      return;
    }
  }

  const ALLOWED_ATTACHMENT_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
  const MAX_ATTACHMENT_BASE64_LENGTH = 4200000; // ~3MB decoded

  let attachmentPart = null;
  if (attachment != null) {
    if (typeof attachment !== 'object' || typeof attachment.mimeType !== 'string' || typeof attachment.data !== 'string') {
      res.status(400).json({ error: '첨부 파일 형식이 올바르지 않아요.' });
      return;
    }
    if (!ALLOWED_ATTACHMENT_TYPES.includes(attachment.mimeType)) {
      res.status(400).json({ error: '이미지(PNG/JPG/WEBP) 또는 PDF 파일만 첨부할 수 있어요.' });
      return;
    }
    if (attachment.data.length > MAX_ATTACHMENT_BASE64_LENGTH) {
      res.status(400).json({ error: '첨부 파일이 너무 커요. 3MB 이하로 올려주세요.' });
      return;
    }
    attachmentPart = { inlineData: { mimeType: attachment.mimeType, data: attachment.data } };
  }

  const langLine = useEnglish
    ? '이미지·영상 플랫폼의 프롬프트는 영어로 작성하라 (해당 AI들이 영어 프롬프트에서 더 좋은 결과를 내는 경우가 많다). 텍스트 생성 AI(ChatGPT, Claude, Gemini)를 위한 지시문은 한국어로 작성하라.'
    : '모든 프롬프트를 한국어로 작성하라.';

  const platformLines = platforms
    .map((p) => `- id: "${p.id}" (${p.label}) — 관례: ${p.dialect}`)
    .join('\n');

  const prompt = `다음은 사용자가 만들고 싶은 것에 대한 설명이다.

요청 내용: "${idea.trim()}"
원하는 분위기/스타일: "${(style || '').trim() || '특별히 명시되지 않음'}"

${langLine}

아래 나열된 각 생성형 AI 플랫폼마다, 위 요청을 그 플랫폼에 최적화된 프롬프트로 "번역"하라. 각 플랫폼은 서로 다른 프롬프트 문법과 관례를 가지므로 반드시 그 관례를 따르는 형태로 작성하라:

${platformLines}

각 프롬프트는 실제로 해당 플랫폼에 바로 붙여넣어 쓸 수 있는 완성된 형태여야 하며, 설명이나 따옴표 없이 프롬프트 본문만 담아야 한다. 이미지·영상 플랫폼의 경우 관례에 맞는 파라미터(비율, 스타일 태그 등)를 포함하라.${attachmentPart ? '\n\n참고: 사용자가 이미지 또는 PDF 파일을 함께 첨부했다. 그 파일에 나타난 스타일·형식·구성·톤을 분석해서 위 요청 내용과 결합한 뒤, 각 플랫폼 프롬프트에 그 특징을 구체적으로 반영하라. 첨부 파일이 시험지·족보 같은 특정 문서 양식이라면 문항 구성, 배치, 표기 방식 등 형식적 특징을 프롬프트 안에 명확히 서술하라.' : ''}`;

  const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const parts = [{ text: prompt }];
  if (attachmentPart) parts.push(attachmentPart);

  const geminiBody = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            id: { type: 'STRING' },
            prompt: { type: 'STRING' },
          },
          required: ['id', 'prompt'],
        },
      },
    },
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

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      res.status(502).json({ error: '결과 형식이 올바르지 않아요. 다시 시도해주세요.' });
      return;
    }

    if (!Array.isArray(parsed)) {
      res.status(502).json({ error: '결과 형식이 올바르지 않아요. 다시 시도해주세요.' });
      return;
    }

    res.status(200).json({ results: parsed });
  } catch (err) {
    clearTimeout(timeout);
    if (err && err.name === 'AbortError') {
      res.status(504).json({ error: '요청 시간이 초과됐어요. 잠시 후 다시 시도해주세요.' });
      return;
    }
    res.status(500).json({ error: '서버에서 오류가 발생했어요. 잠시 후 다시 시도해주세요.' });
  }
};
