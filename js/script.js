// --- DOM要素の取得 ---
const qrFileInput = document.getElementById('qrFileInput');
const imagePreview = document.getElementById('imagePreview');
const readResultStatus = document.getElementById('readResultStatus');
const inputText = document.getElementById('inputText');
const qrReadCanvas = document.getElementById('qrReadCanvas');
const readCtx = qrReadCanvas.getContext('2d');
const convertAndGenerateBtn = document.getElementById('convertAndGenerateBtn');
const generateStatus = document.getElementById('generateStatus');
const generatedQrCodeCanvas = document.getElementById('generatedQrCode');
const genCtx = generatedQrCodeCanvas.getContext('2d');
const saveQrBtn = document.getElementById('saveQrBtn'); // ★ 保存ボタンを取得

// --- ヘルパー関数 ---

/**
 * 文字列を各文字の文字コード配列に変換 (ASCII想定)
 */
function toAsciiBytes(str) {
    return Array.from(str).map(c => c.charCodeAt(0));
}

/**
 * 入力バイト配列を特定のルールで変換
 */
function convertBytes(bytes) {
    const len = bytes.length;
    if (len < 128) { return bytes; }
    let bytes128;
    if (len < 256) {
        bytes128 = bytes.slice(0, 127);
        bytes128.push(len & 0xFF);
    } else {
        bytes128 = bytes.slice(0, 126);
        bytes128.push((len >> 8) & 0xFF, len & 0xFF);
    }
    const result = [];
    for (let i = 0; i < len; i++) { result.push(bytes128[i % 128]); }
    return result;
}

/**
 * ステータスメッセージを表示
 */
function showStatus(element, message, isError = false) {
    element.textContent = message;
    element.className = isError ? 'error' : (message.includes('成功') ? 'success' : '');
}


/**
 * 読み込み結果表示エリアをクリア
 */
function clearReadResults() {
    showStatus(readResultStatus, '読み込み結果が表示されます...');
    inputText.value = '';
    imagePreview.style.display = 'none';
    imagePreview.src = '#';
}

/**
 * 生成結果表示エリアとCanvasをクリアし、保存ボタンを隠す
 */
function clearGenerateResults() {
    showStatus(generateStatus, '生成結果が表示されます...');
    if (genCtx) {
        genCtx.clearRect(0, 0, generatedQrCodeCanvas.width, generatedQrCodeCanvas.height);
    }
    saveQrBtn.classList.add('hidden'); // ★ 保存ボタンを隠す
    saveQrBtn.href = '#'; // ★ hrefをリセット
}


// --- イベントリスナー ---

// QRコード画像ファイル選択時
qrFileInput.addEventListener('change', (event) => {
    // ... (中身は前回の整理されたコードと同じ) ...
    const file = event.target.files[0];
    clearReadResults();
    if (!file) { showStatus(readResultStatus, 'ファイルが選択されていません。', true); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
        imagePreview.src = e.target.result;
        imagePreview.style.display = 'block';
        showStatus(readResultStatus, '画像を読み込み中...');
        const img = new Image();
        img.onload = () => {
            qrReadCanvas.width = img.width;
            qrReadCanvas.height = img.height;
            readCtx.drawImage(img, 0, 0, img.width, img.height);
            try {
                const imageData = readCtx.getImageData(0, 0, qrReadCanvas.width, qrReadCanvas.height);
                const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
                if (code?.data) {
                    showStatus(readResultStatus, 'QRコードの読み込みに成功しました！');
                    inputText.value = code.data;
                } else { showStatus(readResultStatus, 'QRコードが見つかりません。直接入力してください。', true); }
            } catch (err) {
                console.error("QRデコードエラー:", err);
                showStatus(readResultStatus, `デコードエラーが発生しました。`, true);
            }
        };
        img.onerror = () => {
            console.error("画像読み込みエラー");
            showStatus(readResultStatus, '画像の読み込みに失敗しました。', true);
            imagePreview.style.display = 'none';
        };
        img.src = e.target.result;
    };
    reader.onerror = () => {
        console.error("ファイル読み込みエラー");
        showStatus(readResultStatus, 'ファイルの読み込みに失敗しました。', true);
        imagePreview.style.display = 'none';
    };
    reader.readAsDataURL(file);
});

// 変換＆生成ボタンクリック時
convertAndGenerateBtn.addEventListener('click', () => {
    const originalString = inputText.value;
    clearGenerateResults(); // ★ 保存ボタンもここで隠される

    if (!originalString) {
        showStatus(generateStatus, '入力エリアに文字列がありません。', true);
        return;
    }

    showStatus(generateStatus, '変換・生成中...');

    try {
        const inputBytes = toAsciiBytes(originalString);
        const convertedBytes = convertBytes(inputBytes);

        if (convertedBytes.length === 0) {
            showStatus(generateStatus, '変換後のデータが空です。', true);
            return;
        }

        const segments = [{ data: new Uint8Array(convertedBytes), mode: 'byte' }];
        console.log(`QRコード生成データ: ${convertedBytes.length} バイト`);

        QRCode.toCanvas(generatedQrCodeCanvas, segments, {
            errorCorrectionLevel: 'L',
            margin: 2,
            scale: 6,
            color: { dark: "#000000", light: "#ffffff" }
        }, (error) => {
            if (error) {
                console.error('QRコード生成エラー:', error);
                showStatus(generateStatus, `生成エラー: ${error.message.includes('Data too long') ? 'データ長超過' : error.message}`, true);
                clearGenerateResults();
            } else {
                console.log('QRコード生成成功!');
                showStatus(generateStatus, `QRコードを生成しました！ (${convertedBytes.length} バイト)`);
                // ★★★ 生成成功時に保存ボタンを表示し、ダウンロードリンクを設定 ★★★
                try {
                    // Canvasの内容をPNGのデータURLとして取得
                    const dataUrl = generatedQrCodeCanvas.toDataURL('image/png');
                    saveQrBtn.href = dataUrl; // ダウンロードリンクを設定
                    saveQrBtn.classList.remove('hidden'); // ボタンを表示
                } catch (e) {
                    console.error("CanvasからDataURLの取得に失敗:", e);
                    showStatus(generateStatus, 'QRコードは生成されましたが、保存の準備に失敗しました。', true);
                     saveQrBtn.classList.add('hidden'); // 失敗したらボタンは隠す
                }
            }
        });

    } catch (error) {
        console.error('予期せぬエラー:', error);
        showStatus(generateStatus, `エラーが発生しました。`, true);
        clearGenerateResults(); // ここでもクリア（保存ボタンも隠れる）
    }
});

// --- 初期化処理 ---
document.addEventListener('DOMContentLoaded', () => {
    clearGenerateResults(); // 最初に生成エリアと保存ボタンをクリア/非表示
    console.log("QRコード 文字列変換ツール 初期化完了");
});