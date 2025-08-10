
// アプリケーション設定
const APP_CONFIG = {
    // キャンバスサイズ
    CANVAS_WIDTH: 600,
    CANVAS_HEIGHT: 600,
    
    // パーツのデフォルト設定
    DEFAULT_PART_SCALE: 1.0,
    DEFAULT_PART_X: 0,
    DEFAULT_PART_Y: 0,
    DEFAULT_PART_ROTATION: 0,
    
    // カテゴリごとのデフォルトサイズ（自然な顔の比率）
    CATEGORY_SCALES: {
        outline: 1.0,      // 輪郭は大きめ（顔全体を覆う）
        hair: 1.1,         // 髪はさらに大きめ（頭部全体を覆う）
        eyebrow: 0.2,      // 眉毛は小さめ
        eye: 0.2,          // 目は小さめ
        ear: 0.4,          // 耳は小さめ
        nose: 0.2,         // 鼻はかなり小さめ
        mouse: 0.3,        // 口は小さめ
        beard: 1.2,        // ひげは大きめ（顎全体を覆う）
        glasses: 0.5,      // メガネは大きめ（顔幅に合わせる）
        acc: 1.8,          // アクセサリーは大きめ（帽子など）
        wrinkles: 1.0,     // しわは標準
        extras: 1.0        // その他は標準
    },
    
    // パーツカテゴリごとの視覚的中心オフセット（SVG内容に応じた調整）
    VISUAL_CENTER_OFFSETS: {
        outline: { x: -217, y: -227 },        // 輪郭は中央
        hair: { x: -219, y: -220 },         // 髪は上部（頭頂部）
        eyebrow: { x: 3, y: -200 },      // 眉毛は目の上
        eye: { x: -2, y: -210 },          // 目は顔の中央より少し上
        ear: { x: 0, y: -220 },          // 耳は目と鼻の間
        nose: { x: -220, y: -220 },           // 鼻は顔の中央
        mouse: { x: -220, y: -220 },         // 口は鼻の下
        beard: { x: -150, y: -50 },         // ひげは口の下
        glasses: { x: -220, y: -220 },      // メガネは目と同じ高さ
        acc: { x: -215, y: -300 },         // アクセサリー（帽子など頭部）
        wrinkles: { x: 0, y: 0 },       // しわは顔全体
        extras: { x: 0, y: 0 }          // その他
    },
    
    // 左右対称パーツの間隔設定
    SYMMETRICAL_SPACING: {
        eye: 15,           // 目と目の間隔（左右の目の中心間の距離）
        eyebrow: 15,       // 眉毛の間隔（目に合わせる）
        ear: 50           // 耳の間隔（顔の幅に合わせる）
    },
    
    // スライダーの設定
    SLIDER_CONFIG: {
        SIZE: {
            min: 0.1,
            max: 3.0,
            step: 0.1,
            default: 1.0
        },
        POSITION: {
            min: -200,
            max: 200,
            step: 1,
            default: 0
        },
        ROTATION: {
            min: -180,
            max: 180,
            step: 1,
            default: 0
        },
        SPACING: {     
        min: -200, 
        max: 200,  
        step: 1,   
        default: 0 
        }
    },
    
    // ファイル名の設定
    FILE_NAMES: {
        PORTRAIT_PREFIX: 'portrait_',
        DATA_PREFIX: 'portrait_data_',
        EXTENSIONS: {
            IMAGE: '.png',
            DATA: '.json'
        }
    },
    
    // 参考画像の設定
    REFERENCE_IMAGE: {
        WIDTH: 200,
        HEIGHT: 150,
        POSITION: {
            top: 10,
            right: 10
        }
    }
};

// エラーメッセージ
const ERROR_MESSAGES = {
    MANIFEST_LOAD_FAILED: 'マニフェストファイルの読み込みに失敗しました',
    PART_LOAD_FAILED: 'パーツの読み込みに失敗しました',
    GOOGLE_DRIVE_AUTH_FAILED: 'Googleドライブの認証に失敗しました',
    GOOGLE_DRIVE_LOAD_FAILED: 'Googleドライブからの画像読み込みに失敗しました',
    SAVE_FAILED: '保存に失敗しました',
    SVG_NOT_FOUND: 'SVGファイルが見つかりません'
};

// 成功メッセージ
const SUCCESS_MESSAGES = {
    GOOGLE_DRIVE_LOADED: 'Googleドライブから画像を読み込みました',
    SAVE_SUCCESS: '似顔絵とパーツデータを保存しました！'
};

// 設定をエクスポート
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        GOOGLE_DRIVE_CONFIG,
        APP_CONFIG,
        ERROR_MESSAGES,
        SUCCESS_MESSAGES
    };
} 