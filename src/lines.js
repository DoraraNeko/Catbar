// 猫のセリフ。{time} は現在の再生位置、{left} は残り時間に置き換わる
(function (root) {
  'use strict';

  const LINES = [
    // ふつうのセリフ
    '再生ボタンを押した君はえらい',
    '今日もいい再生っぷりだにゃ',
    'いま{time}。順調に伸びてるよ',
    '残り{left}。ぼくの伸びしろもそれくらい',
    '3分たったよ。ぼくは3分ぶん伸びた',
    '胴が長いのは仕様です',
    'ぼくの頭をつかむとシークできるよ。やさしくね',
    '一時停止したら、ぼくは寝るからね',
    '最後まで行ったら、ぼくはバーの端っこ。行き止まり',
    '全画面にすると、ぼくも全力で伸びる',
    '読み込み中は、ぼくも足踏み',
    '何回でも巻き戻していいんだよ',
    '1.5倍速でも、ぼくは平常心',
    '2倍速？ぼくの胴体も2倍速で伸びるよ',
    '動画は逃げないよ。ぼくは伸びるけど',
    'いいところだから、静かにしてるね',
    'この先、名シーンの予感がする',
    '字幕をつけると、ぼくにも内容がわかる',
    '音量、上げすぎてない？',
    'ちょっと水でも飲んだら？',
    'まばたき、忘れてない？',
    '画面から少し離れて見ようね',
    'ここまで見たなら、もう最後まで見よう',
    'ぼくは{time}ぶんの長さになりました',
    '伸びるのって、けっこう気持ちいい',
    'この動画、ぼくの胴体にちょうどいい長さ',
    'シークバーの上で暮らしてます',
    '止めたいときは、スペースキーでどうぞ',
    '矢印キーで5秒とばせるよ。ぼくはその分ワープする',
    'ずっと見てくれてありがとう',

    // 皮肉の効いたセリフ
    'その「あと1本だけ」、今日何回目？',
    '「後で見る」リスト、後で見たことある？',
    '寝る前にちょっとだけ、が一番長いんだよ',
    '倍速で見るなら、要約を読めばよかったのでは',
    '広告をスキップする指の速さ、プロ級だね',
    'イントロ飛ばしたでしょ。見てたよ',
    'おすすめ欄を信じすぎないでね',
    'コメント欄のほうが面白いって顔してる',
    '作業用BGMって言いながら、画面をガン見してるよね',
    '勉強になる動画を見てる時間で、勉強できたかもね',
    'また同じところを巻き戻してる。好きなんだね',
    '途中で寝落ちしても、ぼくは止まらない',
    '動画を見ながらスマホを見る。それ、二重視聴っていうんだよ',
    'サムネと内容、だいたい合ってた？',
    '「〇〇してみた」の「みた」までが長いよね',
    'ぼくがいなかったら、ただの棒なのにね',
    '長い動画ほど、ぼくは得をする',
    '時間泥棒はこの動画であって、ぼくではない',
    '見終わったらちゃんと寝るんだよ。たぶん寝ないけど',
    '広告の5秒は長いのに、動画の1時間は一瞬だね',
    'その姿勢、首にきてない？',
    '明日の自分に謝る準備はできた？',
    '結論だけ知りたいなら、ぼくを最後まで引っぱれば？',
    '残り{left}。今から寝ても、もう遅いかもね',
    'チャンネル登録までは求めないよ。ぼくはね',
    '3分ごとにしゃべる猫、そろそろ慣れた？',
    'シークバーをいじってばかりで、内容見てる？',
    '「ながら見」の「ながら」の方が本業になってない？',
    'ぼくの胴の長さが、君が溶かした時間です',
    'さっきから同じ動画を見てる気がするのは、気のせい？',
  ];

  // 直近 historySize 個と被らないように、ランダムに選ぶ
  function createPicker(lines, historySize, random) {
    const rnd = random || Math.random;
    const keep = Math.min(historySize, lines.length - 1);
    const history = [];
    return function pick() {
      const candidates = [];
      for (let i = 0; i < lines.length; i++) if (!history.includes(i)) candidates.push(i);
      const i = candidates[Math.floor(rnd() * candidates.length)];
      history.push(i);
      while (history.length > keep) history.shift();
      return lines[i];
    };
  }

  // {time}・{left} を置き換える。長さが不明で {left} を埋められないときは null
  function fill(line, currentTime, duration, formatTime) {
    if (line.includes('{left}') && !(Number.isFinite(duration) && duration > 0)) return null;
    return line
      .replace(/\{time\}/g, formatTime(currentTime))
      .replace(/\{left\}/g, formatTime(Math.max(0, duration - currentTime)));
  }

  const api = { LINES, createPicker, fill };
  root.CSB = Object.assign(root.CSB || {}, { lines: api });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
