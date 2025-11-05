// 設定: 1文字あたりの遅延（ms）
// 小さくすると早く入力されます。例: 30, 50, 100
const typingDelay = 40;

// ユーティリティ: input/textarea に対してカーソル位置に文字を挿入
function insertIntoInput(el, text) {
  const start = el.selectionStart ?? 0;
  const end = el.selectionEnd ?? start;
  const value = el.value;
  el.value = value.slice(0, start) + text + value.slice(end);
  const newPos = start + text.length;
  el.selectionStart = el.selectionEnd = newPos;

  // dispatch input event so frameworks notice change
  el.dispatchEvent(new InputEvent('input', { bubbles: true }));
}

// contenteditable への挿入
function insertIntoContentEditable(el, text) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    // 選択範囲がない場合は末尾に挿入
    const textNode = document.createTextNode(text);
    el.appendChild(textNode);
    
    // カーソルを末尾に移動
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
    
    el.dispatchEvent(new InputEvent('input', { bubbles: true }));
    return;
  }
  
  const range = selection.getRangeAt(0);
  range.deleteContents();
  const textNode = document.createTextNode(text);
  range.insertNode(textNode);

  // place cursor after inserted node
  range.setStartAfter(textNode);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);

  el.dispatchEvent(new InputEvent('input', { bubbles: true }));
}

// 汎用挿入: 一文字ずつ挿入（await 用）
function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

async function typeTextIntoElement(el, text) {
  // 1文字ずつ入力
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (el.isContentEditable) {
      insertIntoContentEditable(el, ch);
    } else if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      insertIntoInput(el, ch);
    } else {
      // fallback: try document.execCommand (may work on some editable areas)
      try {
        document.execCommand('insertText', false, ch);
      } catch (e) {
        // 最終手段:直接挿入（非推奨）
        insertIntoContentEditable(document.activeElement, ch);
      }
    }

    // dispatch keyboard events (optional, 一部のサイト/ライブラリが key イベントを期待する場合に有効)
    try {
      const keyEventInit = { key: text[i], bubbles: true, cancelable: true };
      const down = new KeyboardEvent('keydown', keyEventInit);
      const press = new KeyboardEvent('keypress', keyEventInit);
      const up = new KeyboardEvent('keyup', keyEventInit);
      el.dispatchEvent(down);
      el.dispatchEvent(press);
      el.dispatchEvent(up);
    } catch (e) {
      // noop
    }

    await sleep(typingDelay);
  }
}

// paste をフック
function onPaste(e) {
  // すでに何かで preventDefault されていれば何もしない
  if (e.defaultPrevented) return;

  // 拡張機能の有効/無効チェック
  const key = 'pasteTyperEnabled';
  if (localStorage.getItem(key) === '0') return;

  // フォーカス中の要素
  const active = document.activeElement;
  if (!active) return;

  // 対象判定: input / textarea / contenteditable
  const isEditable =
    (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable);

  if (!isEditable) return; // 編集可能でない場所なら無視

  // クリップボードのテキストを取得（ユーザーの貼り付け操作があるので安全に取得可能）
  const clipboardData = e.clipboardData || window.clipboardData;
  if (!clipboardData) return;

  const pastedText = clipboardData.getData('text');
  if (!pastedText || pastedText.trim() === '') return; // テキストがなければ通常の貼り付けに任せる

  e.preventDefault(); // 通常の一気貼り付けを止める
  e.stopPropagation(); // イベントの伝播を止める

  // 非同期で文字列を1文字ずつ挿入
  typeTextIntoElement(active, pastedText).catch(err => {
    console.error('PasteTyper error:', err);
  });
}

// 初期化: DOMが準備できてから実行
function init() {
  // localStorageの初期化
  const key = 'pasteTyperEnabled';
  if (localStorage.getItem(key) === null) {
    localStorage.setItem(key, '1');
  }

  // キャプチャ段階で貼り付けを検知するため第三引数 true
  window.addEventListener('paste', onPaste, true);
  
  console.log('PasteTyper initialized');
}

// DOMが準備できてから初期化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  // すでに読み込み済みの場合は即座に実行
  init();
}
