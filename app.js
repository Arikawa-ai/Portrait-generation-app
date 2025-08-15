// カテゴリ名の日本語マッピング（全体で共有）
const CATEGORY_NAMES = {
    outline: '輪郭',
    hair: '髪',
    eyebrow: '眉毛',
    eye: '目',
    ear: '耳',
    nose: '鼻',
    mouse: '口',
    beard: 'ひげ',
    glasses: 'メガネ',
    acc: 'アクセサリー',
    wrinkles: 'しわ',
    extras: 'その他'
};

class PortraitApp {
    constructor() {
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.parts = {};
        this.selectedPart = null;
        this.manifest = null;
        this.referenceImage = null;
        // this.referenceImageOpacity = 0.3; // 削除
        
        // 左右対称のパーツを定義
        this.symmetricalParts = ['eye', 'ear', 'eyebrow'];
        
        // 初期化時にクリーンアップ
        setTimeout(() => {
            this.cleanupInvalidParts();
        }, 100);
        
        // 座標軸の表示フラグ
        this.showCoordinates = true;
        
        // キャッシュの追加
        this.svgCache = new Map();
        this.imageCache = new Map();
        this.thumbnailCache = new Map();
        
        // 現在の写真データ
        this.currentPhotoData = null;
        
        this.init();
    }

    async init() {
        await this.loadManifest();
        this.setupEventListeners();
        this.loadParts();
        this.setupImageUpload();
        this.setupPartsGrid();
        
        // URLパラメータから写真IDを取得して自動読み込み
        await this.loadPhotoFromURL();
        
        this.render();
        // バックグラウンドで事前読み込み
        this.preloadAllResources();
    }

    async loadManifest() {
        try {
            console.log('現在のURL:', window.location.href);
            console.log('完全なパス:', `${window.location.origin}/assets/manifest.json`);
            
            const response = await fetch('assets/manifest.json');
            console.log('レスポンス:', {
                ok: response.ok,
                status: response.status,
                statusText: response.statusText,
                url: response.url
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            this.manifest = await response.json();
            
            // 各カテゴリのパーツ数を確認
            Object.entries(this.manifest.categories).forEach(([category, data]) => {
            });
            
        } catch (error) {
            console.error(ERROR_MESSAGES.MANIFEST_LOAD_FAILED, error);
            console.error('エラー詳細:', {
                message: error.message,
                stack: error.stack,
                name: error.name
            });
            console.error('マニフェストファイルのパス: assets/manifest.json');
            console.error('現在のURL:', window.location.href);
            
            // ファイル構造の確認
            console.error('ファイル構造の確認が必要です。以下を確認してください:');
            console.error('1. ローカルサーバーで実行しているか');
            console.error('2. assets/manifest.jsonファイルが存在するか');
            console.error('3. ファイルパスが正しいか');
        }
    }

    setupEventListeners() {
        // パーツ選択のイベントリスナー（編集用プルダウンは除外）
        const partSelects = document.querySelectorAll('.part-select:not(#partSelector)');
        partSelects.forEach(select => {
            select.addEventListener('change', (e) => {
                console.log('[this.parts] 従来セレクトボックス:', e.target.id, e.target.value);
                this.onPartSelect(e.target.id, e.target.value);
            });
        });

        // 調整スライダーのイベントリスナー
        const sliders = ['sizeSlider', 'sizeYSlider', 'xSlider', 'ySlider', 'rotationSlider', 'spacingSlider'];
        sliders.forEach(sliderId => {
            const slider = document.getElementById(sliderId);
            const valueSpan = document.getElementById(sliderId.replace('Slider', 'Value'));
            
            if (!slider || !valueSpan) {
                console.warn(`スライダー要素が見つかりません: ${sliderId}`);
                return;
            }
            
            slider.addEventListener('input', (e) => {
                const value = e.target.value;
                if (sliderId === 'rotationSlider') {
                    valueSpan.textContent = value + '°';
                } else if (sliderId === 'spacingSlider') {
                    valueSpan.textContent = value;
                } else if (sliderId === 'sizeSlider' || sliderId === 'sizeYSlider') {
                    valueSpan.textContent = parseFloat(value).toFixed(1);
                } else {
                    valueSpan.textContent = value;
                }
                
                if (this.selectedPart) {
                    this.updatePartTransform(sliderId, value);
                }
            });
        });

        // パーツ選択プルダウンのイベントリスナー
        const partSelector = document.getElementById('partSelector');
        if (partSelector) {
            partSelector.addEventListener('change', (e) => {
                const selectedValue = e.target.value;
                
                if (selectedValue) {
                    // 1. 選択されたカテゴリで現在選択中のサムネイルを探す
                    const selectedThumbnailData = this.getSelectedThumbnailForCategory(selectedValue);
                    
                    if (selectedThumbnailData) {
                        console.log('[this.parts] 選択済みサムネイルから取得:', selectedThumbnailData);
                        
                        // 2. サムネイルから取得した正しいデータでthis.partsを更新
                        this.onPartSelectDirect(selectedThumbnailData.category, selectedThumbnailData.partId);
                        
                        // 3. パーツを編集対象に設定
                        this.selectPart(selectedValue);
                    } else {
                        // サムネイルが選択されていない場合は通常の処理
                        this.selectPart(selectedValue);
                    }
                } else {
                    this.deselectPart();
                    // すべてのサムネイルの選択を解除
                    document.querySelectorAll('.part-thumbnail').forEach(t => t.classList.remove('selected'));
                }
            });
        }

        // 保存ボタン
        document.getElementById('saveBtn').addEventListener('click', () => {
            this.savePortrait();
        });

        // クリアボタン
        document.getElementById('clearBtn').addEventListener('click', () => {
            this.clearCanvas();
        });
        
        // 座標軸表示切り替えボタン
        const coordBtn = document.getElementById('coordBtn');
        if (coordBtn) {
            coordBtn.addEventListener('click', () => {
                this.showCoordinates = !this.showCoordinates;
                coordBtn.textContent = this.showCoordinates ? '座標軸を非表示' : '座標軸を表示';
                this.render();
            });
        }
        
        // パーツリセットボタン
        const resetPartBtn = document.getElementById('resetPartBtn');
        if (resetPartBtn) {
            resetPartBtn.addEventListener('click', () => {
                this.resetSelectedPart();
            });
        }
    }

    async loadParts() {
        if (!this.manifest) return;

        const categories = Object.keys(this.manifest.categories);
        
        for (const category of categories) {
            const categoryData = this.manifest.categories[category];
            const select = document.getElementById(category + 'Select');
            
            if (select && categoryData.parts) {
                // デフォルトパーツを追加
                if (categoryData.defaultPart !== 0) {
                    const option = document.createElement('option');
                    option.value = categoryData.defaultPart;
                    option.textContent = `${categoryData.name} ${categoryData.defaultPart}`;
                    select.appendChild(option);
                }

                // その他のパーツを追加
                categoryData.parts.forEach(partNum => {
                    if (partNum !== 0 && partNum !== categoryData.defaultPart) {
                        const option = document.createElement('option');
                        option.value = partNum;
                        option.textContent = `${categoryData.name} ${partNum}`;
                        select.appendChild(option);
                    }
                });
            }
        }
    }

    // キャッシュ付きSVG読み込み
    async getCachedSVG(svgPath) {
        if (this.svgCache.has(svgPath)) {
            return this.svgCache.get(svgPath);
        }
        
        try {
            const response = await fetch(svgPath);
            if (response.ok) {
                const svgText = await response.text();
                this.svgCache.set(svgPath, svgText);
                return svgText;
            }
        } catch (error) {
            console.error(`SVG読み込みエラー: ${svgPath}`, error);
        }
        return null;
    }

    // キャッシュ付き画像オブジェクト取得
    async getCachedImage(svgPath, svgText) {
        const cacheKey = `${svgPath}_${svgText.length}`;
        
        if (this.imageCache.has(cacheKey)) {
            return this.imageCache.get(cacheKey);
        }
        
        const svgBlob = new Blob([svgText], {type: 'image/svg+xml'});
        const url = URL.createObjectURL(svgBlob);
        
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.imageCache.set(cacheKey, img);
                // URLは保持する（resolve時にURLを含む）
                resolve(img);
            };
            img.onerror = (error) => {
                URL.revokeObjectURL(url);
                reject(error);
            };
            img.src = url;
        });
    }

    // 事前読み込み（バックグラウンド）
    async preloadAllResources() {
        if (!this.manifest) return;
        
        const startTime = performance.now();
        
        const allPaths = [];
        Object.entries(this.manifest.categories).forEach(([category, data]) => {
            data.parts.forEach(partNum => {
                if (partNum !== 0) {
                    const folderName = category === 'mouth' ? 'mouse' : category;
                    const svgPath = `assets/${folderName}/${folderName}_${partNum.toString().padStart(3, '0')}.svg`;
                    allPaths.push(svgPath);
                }
            });
        });
        
        // 並列で事前読み込み（最大10個ずつ）
        const batchSize = 10;
        for (let i = 0; i < allPaths.length; i += batchSize) {
            const batch = allPaths.slice(i, i + batchSize);
            await Promise.all(batch.map(path => this.getCachedSVG(path)));
        }
        
        const endTime = performance.now();
    }

    // 直接的な引数渡しバージョン（新しい実装）
    onPartSelectDirect(category, value) {
        console.log('[this.parts] onPartSelectDirect呼び出し: category=' + category + ', value=' + value);
        
        if (value) {
            // 左右対称のパーツかチェック
            const isSymmetrical = this.symmetricalParts.includes(category);
            
            if (isSymmetrical) {
                // 左右対称のパーツの場合
                this.createSymmetricalParts(category, value);
            } else {
                // 通常のパーツの場合
                // 既存のパーツがある場合は値を保持、ない場合は新規作成
                if (!this.parts[category]) {
                    // カテゴリごとのデフォルトスケールを取得
                    const defaultScale = APP_CONFIG.CATEGORY_SCALES?.[category] || APP_CONFIG.DEFAULT_PART_SCALE;
                    
                    // 新規パーツを追加
                    this.parts[category] = {
                        id: value,
                        category: category,
                        x: APP_CONFIG.DEFAULT_PART_X,
                        y: APP_CONFIG.DEFAULT_PART_Y,
                        scaleX: defaultScale,  // 横方向のスケール
                        scaleY: defaultScale,  // 縦方向のスケール
                        rotation: APP_CONFIG.DEFAULT_PART_ROTATION,
                        zIndex: this.manifest.categories[category]?.zIndex || 1
                    };
                    console.log('[this.parts] 新規パーツ作成:', category, this.parts[category]);
                } else {
                    // 既存パーツのIDのみ更新（位置やサイズは保持）
                    this.parts[category].id = value;
                    console.log('[this.parts] パーツID更新:', category, this.parts[category]);
                }
            }
            
            // パーツ編集プルダウンを更新
            this.updatePartSelectorFromData();
            
            // 自動的にこのパーツを選択
            this.selectPart(category);
        } else {
            // パーツを削除
            const isSymmetrical = this.symmetricalParts.includes(category);
            
            if (isSymmetrical) {
                // 左右対称のパーツの場合、左右両方を削除
                if (this.selectedPart === category || this.selectedPart === category + '_left' || this.selectedPart === category + '_right') {
                    this.deselectPart();
                }
                delete this.parts[category + '_left'];
                delete this.parts[category + '_right'];
                console.log('[this.parts] 対称パーツ削除:', category + '_left', category + '_right');
            } else {
                // 通常のパーツの場合
                if (this.selectedPart === category) {
                    this.deselectPart();
                }
                delete this.parts[category];
                console.log('[this.parts] 通常パーツ削除:', category);
            }
        }
        
        // パーツ選択プルダウンを更新
        this.updatePartSelector();
        
        this.render();
    }

    // 従来のセレクトボックス用（後方互換性のため）
    onPartSelect(selectId, value) {
        const category = selectId.replace('Select', '');
        console.log('[this.parts] onPartSelect(従来版)呼び出し: selectId=' + selectId + ', category=' + category + ', value=' + value);
        // 新しい関数に転送
        this.onPartSelectDirect(category, value);
    }

    updatePartSelector() {
        // パーツ選択プルダウンを更新
        const partSelector = document.getElementById('partSelector');
        if (!partSelector) return;
        
        // 現在の選択を保存
        const currentSelection = partSelector.value;
        
        // オプションをクリア
        partSelector.innerHTML = '<option value="">パーツを選択してください</option>';
        
        // 現在配置されているパーツを追加（左右対称パーツは統合して表示）
        const addedCategories = new Set(); // 既に追加したカテゴリを追跡
        
        for (const [category, part] of Object.entries(this.parts)) {
            let displayCategory = category;
            let displayName = category;
            
            // 左右対称パーツの場合は基本カテゴリ名に変換
            if (category.endsWith('_left') || category.endsWith('_right')) {
                displayCategory = part.category; // 元のカテゴリ名を使用
                
                // 既に同じ基本カテゴリが追加されている場合はスキップ
                if (addedCategories.has(displayCategory)) {
                    continue;
                }
            }
            
            // 既に追加済みのカテゴリはスキップ
            if (addedCategories.has(displayCategory)) {
                continue;
            }
            
            const option = document.createElement('option');
            option.value = category; // 実際のキーを保持
            
            // カテゴリ名を日本語に変換
            option.textContent = CATEGORY_NAMES[displayCategory] || displayCategory;
            partSelector.appendChild(option);
            
            // 追加したカテゴリを記録
            addedCategories.add(displayCategory);
        }
        
        // 選択を復元
        partSelector.value = currentSelection;
    }

    selectPart(partKey) {
        console.log('[this.parts] selectPart開始:', partKey, '| 現在のパーツ:', Object.keys(this.parts));
        
        // パーツキーから基本カテゴリを取得（_left, _rightを除去）
        const baseCategory = partKey.replace(/_(left|right)$/, '');
        
        // 左右対称パーツかどうかチェック
        const isSymmetrical = this.symmetricalParts.includes(baseCategory);
        
        if (isSymmetrical) {
            // 左右対称パーツの場合、指定されたキーのパーツを選択
            // partKeyが具体的なキー（eye_left等）でない場合は左側を選択
            let targetPartKey = partKey;
            if (partKey === baseCategory) {
                targetPartKey = baseCategory + '_left';
            }
            
            if (this.parts[targetPartKey]) {
                console.log('[this.parts] 左右対称パーツ選択:', targetPartKey, '| データ:', this.parts[targetPartKey]);
                this.selectedPart = targetPartKey;
                const part = this.parts[targetPartKey];
                
                // プルダウンの値を更新（左右対称パーツはカテゴリ名で統一）
                const partSelector = document.getElementById('partSelector');
                if (partSelector) {
                    partSelector.value = baseCategory;
                }
                console.log('[this.parts] selectedPart設定完了:', this.selectedPart);
                
                // selectedPart表示は削除済み
                
                // スライダーの値を更新（基準値からの相対値で表示）
                const defaultScale = APP_CONFIG.CATEGORY_SCALES?.[baseCategory] || APP_CONFIG.DEFAULT_PART_SCALE;
                const scaleX = part.scaleX || part.scale || 1;
                const scaleY = part.scaleY || part.scale || 1;
                
                // デフォルトスケールを基準とした相対値を計算
                const relativeScaleX = scaleX / defaultScale;
                const relativeScaleY = scaleY / defaultScale;
                
                document.getElementById('sizeSlider').value = relativeScaleX;
                document.getElementById('sizeValue').textContent = relativeScaleX.toFixed(1);
                document.getElementById('sizeYSlider').value = relativeScaleY;
                document.getElementById('sizeYValue').textContent = relativeScaleY.toFixed(1);
                document.getElementById('xSlider').value = part.x;
                document.getElementById('xValue').textContent = part.x;
                document.getElementById('ySlider').value = part.y;
                document.getElementById('yValue').textContent = part.y;
                document.getElementById('rotationSlider').value = part.rotation;
                document.getElementById('rotationValue').textContent = part.rotation + '°';
                
                // 間隔スライダーの値を設定（調整値のみ表示）
                const spacingSlider = document.getElementById('spacingSlider');
                const spacingValue = document.getElementById('spacingValue');
                if (spacingSlider && spacingValue) {
                    const spacingAdjustment = part.spacing || 0;  // デフォルト間隔への調整値のみ
                    spacingSlider.value = spacingAdjustment;
                    spacingValue.textContent = spacingAdjustment;
                }
                
                // 回転スライダーの有効/無効制御
                const rotationSlider = document.getElementById('rotationSlider');
                const canRotate = ['eye', 'eyebrow', 'ear'].includes(baseCategory);
                console.log(`回転判定: baseCategory=${baseCategory}, canRotate=${canRotate}`);
                if (rotationSlider) {
                    rotationSlider.disabled = !canRotate;
                    rotationSlider.parentElement.style.opacity = canRotate ? '1' : '0.5';
                    console.log(`回転スライダー設定: disabled=${!canRotate}`);
                }
                
                // 間隔スライダーの有効/無効制御
                const allowSpacing = ['eye', 'eyebrow', 'ear'].includes(baseCategory);
                console.log(`間隔判定: baseCategory=${baseCategory}, allowSpacing=${allowSpacing}`);
                if (spacingSlider) {
                    spacingSlider.disabled = !allowSpacing;
                    spacingSlider.parentElement.style.opacity = allowSpacing ? '1' : '0.5';
                    console.log(`間隔スライダー設定: disabled=${!allowSpacing}`);
                }
            }
        } else {
            // 通常のパーツの場合
            this.selectedPart = partKey;
            const part = this.parts[partKey];
            
            if (!part) {
                console.warn(`パーツが見つかりません: ${partKey}`);
                return;
            }
            
            console.log('[this.parts] 通常パーツ選択:', partKey, '| データ:', this.parts[partKey]);
            
            // プルダウンの値を更新
            const partSelector = document.getElementById('partSelector');
            if (partSelector) {
                partSelector.value = baseCategory;
            }
            console.log('[this.parts] selectedPart設定完了:', this.selectedPart);
            
            // selectedPart表示は削除済み
            
            // スライダーの値を更新（基準値からの相対値で表示）
            const defaultScale = APP_CONFIG.CATEGORY_SCALES?.[baseCategory] || APP_CONFIG.DEFAULT_PART_SCALE;
            const scaleX = part.scaleX || part.scale || 1;
            const scaleY = part.scaleY || part.scale || 1;
            
            // デフォルトスケールを基準とした相対値を計算
            const relativeScaleX = scaleX / defaultScale;
            const relativeScaleY = scaleY / defaultScale;
            
            document.getElementById('sizeSlider').value = relativeScaleX;
            document.getElementById('sizeValue').textContent = relativeScaleX.toFixed(1);
            document.getElementById('sizeYSlider').value = relativeScaleY;
            document.getElementById('sizeYValue').textContent = relativeScaleY.toFixed(1);
            document.getElementById('xSlider').value = part.x;
            document.getElementById('xValue').textContent = part.x;
            document.getElementById('ySlider').value = part.y;
            document.getElementById('yValue').textContent = part.y;
            document.getElementById('rotationSlider').value = part.rotation;
            document.getElementById('rotationValue').textContent = part.rotation + '°';
            
            // 回転スライダーの有効/無効制御
            const rotationSlider = document.getElementById('rotationSlider');
            const canRotate = ['eye', 'eyebrow', 'ear'].includes(baseCategory);
            if (rotationSlider) {
                rotationSlider.disabled = !canRotate;
                rotationSlider.parentElement.style.opacity = canRotate ? '1' : '0.5';
            }
            
            // 間隔スライダーを無効化
            const spacingSlider = document.getElementById('spacingSlider');
            if (spacingSlider) {
                spacingSlider.disabled = true;
                spacingSlider.parentElement.style.opacity = '0.5';
            }
        }
        
        // パーツ選択後に再描画
        this.render();
    }

    deselectPart() {
        this.selectedPart = null;
        
        // 間隔スライダーを無効化
        const spacingSlider = document.getElementById('spacingSlider');
        if (spacingSlider) {
            spacingSlider.disabled = true;
            spacingSlider.parentElement.style.opacity = '0.5';
        }
    }

    resetSelectedPart() {
        if (!this.selectedPart || !this.parts[this.selectedPart]) {
            alert('リセットするパーツが選択されていません。');
            return;
        }

        const part = this.parts[this.selectedPart];
        const originalCategory = part.category;
        const isSymmetrical = this.symmetricalParts.includes(originalCategory);
        
        // デフォルト値を取得
        const defaultScale = APP_CONFIG.CATEGORY_SCALES?.[originalCategory] || APP_CONFIG.DEFAULT_PART_SCALE;
        const defaultX = APP_CONFIG.DEFAULT_PART_X;
        const defaultY = APP_CONFIG.DEFAULT_PART_Y;
        const defaultRotation = APP_CONFIG.DEFAULT_PART_ROTATION;

        if (isSymmetrical) {
            // 左右対称パーツの場合
            const leftPart = this.parts[originalCategory + '_left'];
            const rightPart = this.parts[originalCategory + '_right'];
            
            if (leftPart && rightPart) {
                
                // 左パーツをリセット
                leftPart.scaleX = defaultScale;
                leftPart.scaleY = defaultScale;
                leftPart.x = defaultX;  // 初期位置は0
                leftPart.y = defaultY;
                leftPart.rotation = defaultRotation;
                leftPart.spacing = 0;  // 調整値は0にリセット
                
                // 右パーツをリセット
                rightPart.scaleX = defaultScale;
                rightPart.scaleY = defaultScale;
                rightPart.x = defaultX;  // 初期位置は0
                rightPart.y = defaultY;
                rightPart.rotation = defaultRotation;
                rightPart.spacing = 0;  // 調整値は0にリセット // リセット時は両方とも0度
            }
        } else {
            // 通常のパーツの場合
            part.scaleX = defaultScale;
            part.scaleY = defaultScale;
            part.x = defaultX;
            part.y = defaultY;
            part.rotation = defaultRotation;
        }

        // UIスライダーを更新
        this.updateSlidersFromPart();
        
        // 再描画
        this.render();
        
    }

    updateSlidersFromPart() {
        if (!this.selectedPart || !this.parts[this.selectedPart]) return;

        const part = this.parts[this.selectedPart];
        const baseCategory = part.category;
        const defaultScale = APP_CONFIG.CATEGORY_SCALES?.[baseCategory] || APP_CONFIG.DEFAULT_PART_SCALE;
        
        const scaleX = part.scaleX || part.scale || 1;
        const scaleY = part.scaleY || part.scale || 1;
        
        // デフォルトスケールを基準とした相対値を計算
        const relativeScaleX = scaleX / defaultScale;
        const relativeScaleY = scaleY / defaultScale;

        // スライダーの値を更新（基準値からの相対値で表示）
        document.getElementById('sizeSlider').value = relativeScaleX;
        document.getElementById('sizeValue').textContent = relativeScaleX.toFixed(1);
        document.getElementById('sizeYSlider').value = relativeScaleY;
        document.getElementById('sizeYValue').textContent = relativeScaleY.toFixed(1);
        document.getElementById('xSlider').value = part.x;
        document.getElementById('xValue').textContent = part.x;
        document.getElementById('ySlider').value = part.y;
        document.getElementById('yValue').textContent = part.y;
        document.getElementById('rotationSlider').value = part.rotation;
        document.getElementById('rotationValue').textContent = part.rotation + '°';
    }

    updatePartTransform(sliderId, value) {
        if (!this.selectedPart || !this.parts[this.selectedPart]) return;
        
        const part = this.parts[this.selectedPart];
        const originalCategory = part.category;
        const isSymmetrical = this.symmetricalParts.includes(originalCategory);
        
        // 左右対称パーツの場合は両方を更新
        if (isSymmetrical) {
            const leftPart = this.parts[originalCategory + '_left'];
            const rightPart = this.parts[originalCategory + '_right'];
            
            if (leftPart && rightPart) {
                // デフォルトスケールを取得
                const defaultScale = APP_CONFIG.CATEGORY_SCALES?.[originalCategory] || APP_CONFIG.DEFAULT_PART_SCALE;
                
                switch (sliderId) {
                    case 'sizeSlider':
                        // 相対値を実際の値に変換
                        const actualScaleX = parseFloat(value) * defaultScale;
                        leftPart.scaleX = actualScaleX;
                        rightPart.scaleX = actualScaleX;
                        break;
                    case 'sizeYSlider':
                        // 相対値を実際の値に変換
                        const actualScaleY = parseFloat(value) * defaultScale;
                        leftPart.scaleY = actualScaleY;
                        rightPart.scaleY = actualScaleY;
                        break;
                    case 'xSlider':
                        // X座標は同じ値（間隔調整はspacingで行う）
                        leftPart.x = parseInt(value);
                        rightPart.x = parseInt(value);
                        break;
                    case 'ySlider':
                        // Y座標は同じ値
                        leftPart.y = parseInt(value);
                        rightPart.y = parseInt(value);
                        break;
                    case 'rotationSlider':
                        // 回転は目、眉毛、耳のみ可能
                        if (['eye', 'eyebrow', 'ear'].includes(originalCategory)) {
                            // +なら外側回転、-なら内側回転
                            // 左パーツ: スライダー値をそのまま適用（+で外側）
                            leftPart.rotation = parseInt(value);
                            // 右パーツ: スライダー値を反転（+で外側になるよう）
                            rightPart.rotation = -parseInt(value);
                        }
                        break;
                    case 'spacingSlider':
                        // 間隔調整
                        leftPart.spacing = parseFloat(value);
                        rightPart.spacing = parseFloat(value);
                        break;
                }
            }
        } else {
            // 通常のパーツの場合
            // デフォルトスケールを取得
            const defaultScale = APP_CONFIG.CATEGORY_SCALES?.[originalCategory] || APP_CONFIG.DEFAULT_PART_SCALE;
            
            switch (sliderId) {
                case 'sizeSlider':
                    // 相対値を実際の値に変換
                    part.scaleX = parseFloat(value) * defaultScale;
                    break;
                case 'sizeYSlider':
                    // 相対値を実際の値に変換
                    part.scaleY = parseFloat(value) * defaultScale;
                    break;
                case 'xSlider':
                    part.x = parseInt(value);
                    break;
                case 'ySlider':
                    part.y = parseInt(value);
                    break;
                case 'rotationSlider':
                    // 回転は目、眉毛、耳のみ可能（通常パーツには適用されないが念のため）
                    if (['eye', 'eyebrow', 'ear'].includes(originalCategory)) {
                        part.rotation = parseInt(value);
                    }
                    break;
            }
        }
        
        this.render();
    }

    async render() {
        // キャンバスをクリア
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 背景を描画
        this.ctx.fillStyle = '#f8f9fa';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 参考画像を半透明で描画（削除）
        // if (this.referenceImage) {
        //     this.ctx.save();
        //     this.ctx.globalAlpha = this.referenceImageOpacity;
        //     
        //     // 画像をキャンバスのサイズに合わせて描画
        //     const scale = Math.min(
        //         this.canvas.width / this.referenceImage.width,
        //         this.canvas.height / this.referenceImage.height
        //     );
        //     const width = this.referenceImage.width * scale;
        //     const height = this.referenceImage.height * scale;
        //     const x = (this.canvas.width - width) / 2;
        //     const y = (this.canvas.height - height) / 2;
        //     
        //     this.ctx.drawImage(this.referenceImage, x, y, width, height);
        //     this.ctx.restore();
        // }
        
        // 描画前に無効なパーツを一括削除
        this.cleanupInvalidParts();
        
        // パーツをzIndex順にソートして描画
        const sortedParts = Object.entries(this.parts)
            .sort(([,a], [,b]) => a.zIndex - b.zIndex);
        
        for (const [category, part] of sortedParts) {
            await this.drawPart(category, part);
        }
        
        // 座標軸を描画（表示フラグがONの場合のみ）
        if (this.showCoordinates) {
            this.drawCoordinateAxes();
        }
        
        // 選択されたパーツのハイライト（オプション：表示したい場合はコメントを外す）
        // if (this.selectedPart && this.parts[this.selectedPart]) {
        //     this.drawSelectionHighlight(this.parts[this.selectedPart]);
        // }
    }

    async drawPart(category, part) {
        try {
            // 元のカテゴリ名を取得（_left, _rightを除去）
            const originalCategory = part.category;
            
            // 無効なカテゴリをスキップ（削除は描画前に一括実行済み）
            if (!CATEGORY_NAMES.hasOwnProperty(originalCategory)) {
                console.warn(`無効なカテゴリのパーツをスキップ: ${originalCategory} (${category})`);
                return;
            }
            
            // mouth/mouseの名前不一致を修正
            const folderName = originalCategory === 'mouth' ? 'mouse' : originalCategory;
            const svgPath = `assets/${folderName}/${folderName}_${part.id.toString().padStart(3, '0')}.svg`;
            
            // キャッシュから読み込み
            const svgText = await this.getCachedSVG(svgPath);
            if (!svgText) {
                console.error(`SVGファイルが見つかりません: ${svgPath}`);
                return;
            }
            
            // キャッシュから画像オブジェクトを取得
            const img = await this.getCachedImage(svgPath, svgText);
            
            console.log(`画像描画中: ${category}_${part.id}`);
            console.log(`画像サイズ: ${img.width}x${img.height}`);
            this.ctx.save();
                    
                    // 常にキャンバスの中央を基準に描画
                    const centerX = this.canvas.width / 2;
                    const centerY = this.canvas.height / 2;
                    
                    // config.jsから統一されたオフセット値を使用
                    const categoryOffsets = {
                        outline: { x: 0, y: 0 },
                        hair: { x: 0, y: 0 },
                        eyebrow: { x: 0, y: -15 },
                        eye: { x: 0, y: 15 },
                        ear: { x: 0, y: 40 },
                        nose: { x: 0, y: 70 },
                        mouse: { x: 0, y: 130 },
                        beard: { x: 0, y: 0 },
                        glasses: { x: 0, y: 20 },
                        acc: { x: 0, y: 0 },
                        wrinkles: { x: 0, y: 0 },
                        extras: { x: 0, y: 0 }
                    };
                    
                    // カテゴリに応じたオフセットを取得（定義がない場合は{0,0}）
                    const offset = categoryOffsets[originalCategory] || { x: 0, y: 0 };
                    
                    // 基準位置にカテゴリオフセットを適用
                    this.ctx.translate(centerX + offset.x, centerY + offset.y);
                    
                    // 左右対称パーツの場合、間隔を考慮
                    if (part.isLeft || part.isRight) {
                        const defaultSpacing = APP_CONFIG.SYMMETRICAL_SPACING?.[originalCategory] || 0;
                        const spacingAdjustment = part.spacing || 0;
                        const totalSpacing = defaultSpacing + spacingAdjustment;
                        const xOffset = part.isLeft ? totalSpacing : -totalSpacing;
                        this.ctx.translate(xOffset + part.x, part.y);
                    } else {
                        this.ctx.translate(part.x, part.y);
                    }
                    
                    this.ctx.rotate(part.rotation * Math.PI / 180);
                    
                    // 右側のパーツは水平反転
                    const scaleX = part.scaleX || part.scale || 1;
                    const scaleY = part.scaleY || part.scale || 1;
                    if (part.isRight) {
                        this.ctx.scale(-scaleX, scaleY);
                    } else {
                        this.ctx.scale(scaleX, scaleY);
                    }
                    
                    // 視覚的中心オフセットを適用
                    const visualOffset = APP_CONFIG.VISUAL_CENTER_OFFSETS[originalCategory] || { x: 0, y: 0 };
                    console.log(`視覚的中心オフセット適用: ${originalCategory}`, visualOffset);
                    
                    // 画像を描画（視覚的中心を基準点(0,0)に調整）
                    const drawX = -img.width / 2 + visualOffset.x;
                    const drawY = -img.height / 2 + visualOffset.y;
                    console.log(`描画位置: drawX=${drawX}, drawY=${drawY}, imgSize=${img.width}x${img.height}`);
                    
                    this.ctx.drawImage(img, drawX, drawY);
                    
                    this.ctx.restore();
            
        } catch (error) {
            console.error(`${ERROR_MESSAGES.PART_LOAD_FAILED}: ${category}_${part.id}`, error);
            console.error('エラー詳細:', {
                message: error.message,
                stack: error.stack,
                name: error.name
            });
        }
    }

    drawSelectionHighlight(part) {
        this.ctx.save();
        this.ctx.strokeStyle = '#e74c3c';
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([5, 5]);
        
        // 常にキャンバスの中央を基準に描画
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        
        this.ctx.translate(centerX, centerY);
        this.ctx.translate(part.x, part.y);
        this.ctx.rotate(part.rotation * Math.PI / 180);
        const scaleX = part.scaleX || part.scale || 1;
        const scaleY = part.scaleY || part.scale || 1;
        this.ctx.scale(scaleX, scaleY);
        
        // 選択ハイライトを描画
        this.ctx.strokeRect(-25, -25, 50, 50);
        
        this.ctx.restore();
    }

    drawCoordinateAxes() {
        this.ctx.save();
        
        // 座標軸の基準点（パーツ描画と同じ基準）
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        
        // 座標軸のスタイル
        this.ctx.strokeStyle = '#007bff';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.globalAlpha = 0.7;
        
        // X軸（水平線）- キャンバス全幅
        this.ctx.beginPath();
        this.ctx.moveTo(0, centerY);
        this.ctx.lineTo(this.canvas.width, centerY);
        this.ctx.stroke();
        
        // Y軸（垂直線）- キャンバス全高
        this.ctx.beginPath();
        this.ctx.moveTo(centerX, 0);
        this.ctx.lineTo(centerX, this.canvas.height);
        this.ctx.stroke();
        
        // 目盛りを描画
        this.ctx.setLineDash([]);
        this.ctx.lineWidth = 1;
        this.ctx.fillStyle = '#007bff';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        // X軸の目盛り
        const halfWidth = this.canvas.width / 2;
        for (let x = -Math.floor(halfWidth / 50) * 50; x <= Math.floor(halfWidth / 50) * 50; x += 50) {
            if (x === 0) continue; // 原点はスキップ
            
            const screenX = centerX + x;
            if (screenX >= 0 && screenX <= this.canvas.width) {
            // 目盛り線
            this.ctx.beginPath();
                this.ctx.moveTo(screenX, centerY - 5);
                this.ctx.lineTo(screenX, centerY + 5);
            this.ctx.stroke();
            
            // 数値表示
                this.ctx.fillText(x.toString(), screenX, centerY + 15);
            }
        }
        
        // Y軸の目盛り
        this.ctx.textAlign = 'right';
        const halfHeight = this.canvas.height / 2;
        for (let y = -Math.floor(halfHeight / 50) * 50; y <= Math.floor(halfHeight / 50) * 50; y += 50) {
            if (y === 0) continue; // 原点はスキップ
            
            const screenY = centerY + y;
            if (screenY >= 0 && screenY <= this.canvas.height) {
            // 目盛り線
            this.ctx.beginPath();
                this.ctx.moveTo(centerX - 5, screenY);
                this.ctx.lineTo(centerX + 5, screenY);
            this.ctx.stroke();
            
            // 数値表示（Y軸は符号反転して表示）
                this.ctx.fillText((-y).toString(), centerX - 10, screenY);
            }
        }
        
        // 原点表示
        this.ctx.fillStyle = '#dc3545';
        this.ctx.textAlign = 'left';
        this.ctx.fillText('(0,0)', centerX + 5, centerY - 5);
        
        // 各パーツの基準位置を表示（削除）
        // this.drawPartPositionLabels(centerX, centerY);
        
        // キャンバス中心を点で描画（削除）
        // this.drawCanvasCenter();
        
        this.ctx.restore();
    }
    
    drawPartPositionLabels(centerX, centerY) {
        // カテゴリごとの基準位置を表示（統一されたオフセット値を使用）
        const categoryOffsets = {
            outline: { x: 0, y: 0, label: '輪郭' },
            hair: { x: 0, y: 0, label: '髪' },
            eyebrow: { x: 0, y: -15, label: '眉毛' },
            eye: { x: 0, y: 15, label: '目' },
            ear: { x: 0, y: 40, label: '耳' },
            nose: { x: 0, y: 70, label: '鼻' },
            mouse: { x: 0, y: 130, label: '口' },
            beard: { x: 0, y: 0, label: 'ひげ' },
            glasses: { x: 0, y: 20, label: 'メガネ' },
            acc: { x: 0, y: 0, label: 'アクセ' },
            wrinkles: { x: 0, y: 0, label: 'しわ' },
            extras: { x: 0, y: 0, label: 'その他' }
        };
        
        this.ctx.fillStyle = '#28a745';
        this.ctx.font = '10px Arial';
        this.ctx.textAlign = 'left';
        
        Object.entries(categoryOffsets).forEach(([category, offset]) => {
            const x = centerX + offset.x;
            const y = centerY + offset.y;
            
            // 小さな点を描画
            this.ctx.beginPath();
            this.ctx.arc(x, y, 3, 0, Math.PI * 2);
            this.ctx.fillStyle = '#28a745';
            this.ctx.fill();
            
            // ラベルを描画
            this.ctx.fillStyle = '#28a745';
            this.ctx.fillText(`${offset.label}(${offset.x},${-offset.y})`, x + 5, y - 5);
        });
    }
    
    drawCanvasCenter() {
        this.ctx.save();
        
        // キャンバスの真の中心点
        const canvasCenterX = this.canvas.width / 2;
        const canvasCenterY = this.canvas.height / 2;
        
        // 中心点を大きな赤い点で描画
        this.ctx.fillStyle = '#ff0000';
        this.ctx.beginPath();
        this.ctx.arc(canvasCenterX, canvasCenterY, 8, 0, Math.PI * 2);
        this.ctx.fill();
        
        // 白い縁を追加
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        
        // ラベルを描画
        this.ctx.fillStyle = '#ff0000';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText('キャンバス中心', canvasCenterX + 12, canvasCenterY - 5);
        
        this.ctx.restore();
    }

    setupImageUpload() {
        const uploadBtn = document.getElementById('uploadBtn');
        const fileInput = document.getElementById('fileInput');
        const statusDiv = document.getElementById('uploadStatus');
        const opacitySlider = document.getElementById('opacitySlider');
        const opacityValue = document.getElementById('opacityValue');
        
        // ファイル選択ボタンのクリックイベント
        uploadBtn.addEventListener('click', () => {
            fileInput.click();
        });
        
        // ファイル選択時の処理
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file && file.type.startsWith('image/')) {
                this.loadLocalImage(file);
            } else if (file) {
                statusDiv.textContent = '画像ファイルを選択してください';
                statusDiv.className = 'status error';
            }
        });
        
        // 透明度スライダーの処理（削除）
        // if (opacitySlider) {
        //     opacitySlider.addEventListener('input', (e) => {
        //         this.referenceImageOpacity = parseFloat(e.target.value);
        //         if (opacityValue) {
        //             opacityValue.textContent = Math.round(this.referenceImageOpacity * 100) + '%';
        //         }
        //         this.render();
        //     });
        // }
    }

    loadLocalImage(file) {
        const reader = new FileReader();
        const statusDiv = document.getElementById('uploadStatus');
        
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.referenceImage = img;
                this.render();
                
                // 参考画像プレビューを描画形式で更新
                this.updatePhotoDisplay();
                
                if (statusDiv) {
                    statusDiv.textContent = `画像を読み込みました: ${file.name}`;
                    statusDiv.className = 'status success';
                }
                
                // 透明度コントロールを表示（削除）
                // const opacityControl = document.querySelector('.opacity-control');
                // if (opacityControl) {
                //     opacityControl.style.display = 'block';
                // }
            };
            
            img.onerror = () => {
                if (statusDiv) {
                    statusDiv.textContent = '画像の読み込みに失敗しました';
                    statusDiv.className = 'status error';
                }
            };
            
            img.src = e.target.result;
        };
        
        reader.onerror = () => {
            if (statusDiv) {
                statusDiv.textContent = 'ファイルの読み込みに失敗しました';
                statusDiv.className = 'status error';
            }
        };
        
        reader.readAsDataURL(file);
    }

    createSymmetricalParts(category, partId) {
        
        // カテゴリごとのデフォルトスケールを取得
        const defaultScale = APP_CONFIG.CATEGORY_SCALES?.[category] || APP_CONFIG.DEFAULT_PART_SCALE;
        
        // 左右の間隔を設定（目や耳の間隔）
        const defaultSpacing = APP_CONFIG.SYMMETRICAL_SPACING?.[category] || 0;
        
        // 既存のパーツがある場合、spacing調整値を保持
        const existingLeftPart = this.parts[category + '_left'];
        const existingRightPart = this.parts[category + '_right'];
        const spacingAdjustment = existingLeftPart?.spacing || existingRightPart?.spacing || 0; // 調整値
        
        // 左のパーツ（キャンバス上では右側に表示）
        this.parts[category + '_left'] = {
            id: partId,
            category: category,
            x: APP_CONFIG.DEFAULT_PART_X,  // 初期位置は0
            y: APP_CONFIG.DEFAULT_PART_Y,
            scaleX: defaultScale,  // 横方向のスケール
            scaleY: defaultScale,  // 縦方向のスケール
            rotation: APP_CONFIG.DEFAULT_PART_ROTATION,
            spacing: spacingAdjustment,
            zIndex: this.manifest.categories[category]?.zIndex || 1,
            isLeft: true
        };
        
        // 右のパーツ（キャンバス上では左側に表示）
        this.parts[category + '_right'] = {
            id: partId,
            category: category,
            x: APP_CONFIG.DEFAULT_PART_X,  // 初期位置は0
            y: APP_CONFIG.DEFAULT_PART_Y,
            scaleX: defaultScale,  // 横方向のスケール
            scaleY: defaultScale,  // 縦方向のスケール
            rotation: APP_CONFIG.DEFAULT_PART_ROTATION,
            spacing: spacingAdjustment,
            zIndex: this.manifest.categories[category]?.zIndex || 1,
            isRight: true
        };
        
    }
    
    getSymmetryOffset(category) {
        // config.jsから間隔設定を取得
        const spacing = APP_CONFIG.SYMMETRICAL_SPACING || {};
        
        // カテゴリに応じた左右の間隔を設定（片側のオフセット値）
        // SYMMETRICAL_SPACINGは全体の間隔なので、半分の値を返す
        const fullSpacing = spacing[category] || 0; // デフォルトは0px
        
        return fullSpacing / 2; // 半分の値を返す（左右それぞれのオフセット）
    }

    setupPartsGrid() {
        // カテゴリタブのイベントリスナー
        const categoryTabs = document.querySelectorAll('.category-tab');
        categoryTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                // アクティブタブの切り替え
                categoryTabs.forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                
                // パーツ一覧を表示
                const category = e.target.dataset.category;
                this.showPartsForCategory(category);
            });
        });

        // 最初のカテゴリ（髪）を表示
        this.showPartsForCategory('hair');
    }

    async showPartsForCategory(category) {
        const thumbnailsContainer = document.getElementById('partsThumbnails');
        if (!thumbnailsContainer || !this.manifest) return;

        // コンテナをクリア
        thumbnailsContainer.innerHTML = '';

        const categoryData = this.manifest.categories[category];
        if (!categoryData || !categoryData.parts) return;

        // 並列でSVGを読み込み
        const loadPromises = categoryData.parts.map(async (partNum) => {
            if (partNum === 0) return null; // 0番は「なし」なのでスキップ

            const folderName = category === 'mouth' ? 'mouse' : category;
            const svgPath = `assets/${folderName}/${folderName}_${partNum.toString().padStart(3, '0')}.svg`;
            
            try {
                const svgText = await this.getCachedSVG(svgPath);
                if (svgText) {
                    // SVGを直接Data URLとして使用
                    const svgBlob = new Blob([svgText], {type: 'image/svg+xml'});
                    const url = URL.createObjectURL(svgBlob);
                    return { partNum, imgSrc: url, success: true };
                }
            } catch (error) {
                console.error(`サムネイル読み込みエラー: ${category}_${partNum}`, error);
            }
            return { partNum, success: false };
        });

        // 全て並列で読み込み
        const results = await Promise.all(loadPromises);

        // サムネイルを作成
        results.forEach(result => {
            if (!result) return;

            const thumbnail = document.createElement('div');
            thumbnail.className = 'part-thumbnail';
            thumbnail.dataset.category = category;
            thumbnail.dataset.partId = result.partNum;

            if (result.success) {
                const img = document.createElement('img');
                img.src = result.imgSrc;
                img.alt = `${category} ${result.partNum}`;
                thumbnail.appendChild(img);
            } else {
                thumbnail.textContent = result.partNum.toString();
            }

            thumbnailsContainer.appendChild(thumbnail);
        });

        // 「なし」オプションを追加
        const noneOption = document.createElement('div');
        noneOption.className = 'part-thumbnail';
        noneOption.dataset.category = category;
        noneOption.dataset.partId = '0';
        noneOption.textContent = 'なし';
        noneOption.style.display = 'flex';
        noneOption.style.alignItems = 'center';
        noneOption.style.justifyContent = 'center';
        noneOption.style.fontSize = '12px';
        noneOption.style.color = '#666';

        thumbnailsContainer.insertBefore(noneOption, thumbnailsContainer.firstChild);
        
        // イベントリスナーを追加
        this.attachThumbnailEventListeners(thumbnailsContainer);
    }

    // サムネイルのイベントリスナーを追加
    attachThumbnailEventListeners(container) {
        container.querySelectorAll('.part-thumbnail').forEach(thumbnail => {
            thumbnail.addEventListener('click', () => {
                const category = thumbnail.dataset.category;
                const partId = thumbnail.dataset.partId;
                
                if (partId === '0') {
                    this.selectPartFromGrid(category, '');
                } else {
                    this.selectPartFromGrid(category, partId);
                }
                
                // 選択状態の表示
                document.querySelectorAll('.part-thumbnail').forEach(t => t.classList.remove('selected'));
                thumbnail.classList.add('selected');
            });
        });
    }

    selectPartFromGrid(category, partId) {
        
        // 従来のセレクトボックスを更新
        const select = document.getElementById(category + 'Select');
        if (select) {
            console.log(`セレクトボックス発見: ${category + 'Select'}`);
            select.value = partId;
            // changeイベントを発火させて既存の処理を実行
            const changeEvent = new Event('change');
            select.dispatchEvent(changeEvent);
            console.log(`changeイベント発火済み`);
        } else {
            console.error(`セレクトボックスが見つかりません: ${category + 'Select'}`);
        }
        
        // 直接パーツを追加する処理も呼び出す（新しい関数を使用）
        this.onPartSelectDirect(category, partId);
    }

    updatePhotoDisplay() {
        const referenceDiv = document.getElementById('referenceImage');
        if (!referenceDiv || !this.referenceImage) return;

        // 既存のcanvasがあれば削除
        const existingCanvas = referenceDiv.querySelector('canvas');
        if (existingCanvas) {
            existingCanvas.remove();
        }

        // 新しいcanvasを作成
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // 親要素のサイズを取得
        const containerRect = referenceDiv.getBoundingClientRect();
        const containerWidth = referenceDiv.clientWidth;
        const containerHeight = referenceDiv.clientHeight;
        
        // canvasのサイズを設定（高解像度対応）
        const pixelRatio = window.devicePixelRatio || 1;
        canvas.width = containerWidth * pixelRatio;
        canvas.height = containerHeight * pixelRatio;
        canvas.style.width = containerWidth + 'px';
        canvas.style.height = containerHeight + 'px';
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.borderRadius = '100px';
        
        ctx.scale(pixelRatio, pixelRatio);
        
        // 画像を80%のサイズで描画（切り取りを防ぐため）
        const imgAspectRatio = this.referenceImage.width / this.referenceImage.height;
        const containerAspectRatio = containerWidth / containerHeight;
        const scaleFactor = 0.8; // 80%のサイズで表示
        
        let drawWidth, drawHeight, drawX, drawY;
        
        if (imgAspectRatio > containerAspectRatio) {
            // 画像の方が横長：高さを合わせて幅を調整
            drawHeight = containerHeight * scaleFactor;
            drawWidth = drawHeight * imgAspectRatio;
            drawX = (containerWidth - drawWidth) / 2;
            drawY = (containerHeight - drawHeight) / 2;
        } else {
            // 画像の方が縦長または同じ比率：幅を合わせて高さを調整
            drawWidth = containerWidth * scaleFactor;
            drawHeight = drawWidth / imgAspectRatio;
            drawX = (containerWidth - drawWidth) / 2;
            drawY = (containerHeight - drawHeight) / 2;
        }
        
        ctx.drawImage(this.referenceImage, drawX, drawY, drawWidth, drawHeight);
        
        // 既存の内容をクリアしてcanvasを追加
        referenceDiv.innerHTML = '';
        referenceDiv.appendChild(canvas);
    }

    async savePortrait() {
        try {
            // タイムスタンプを生成
            const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
            
            // パーツの座標データをJSONとして保存（絶対座標に変換）
            const absoluteParts = {};
            
            // 統一されたカテゴリオフセット（描画処理と同じ値）
            const categoryOffsets = {
                outline: { x: 0, y: 0 },
                hair: { x: 0, y: 0 },
                eyebrow: { x: 0, y: -15 },
                eye: { x: 0, y: 15 },
                ear: { x: 0, y: 40 },
                nose: { x: 0, y: 70 },
                mouse: { x: 0, y: 130 },
                beard: { x: 0, y: 0 },
                glasses: { x: 0, y: 20 },
                acc: { x: 0, y: 0 },
                wrinkles: { x: 0, y: 0 },
                extras: { x: 0, y: 0 }
            };
            
            // 各パーツを最終配置座標に変換
            const canvasCenterX = this.canvas.width / 2;
            const canvasCenterY = this.canvas.height / 2;
            
            for (const [partKey, part] of Object.entries(this.parts)) {
                const originalCategory = part.category;
                const categoryOffset = categoryOffsets[originalCategory] || { x: 0, y: 0 };
                
                // 最終配置座標を計算
                let finalX, finalY;
                
                if (part.isLeft || part.isRight) {
                    // 左右対称パーツの場合
                    const defaultSpacing = APP_CONFIG.SYMMETRICAL_SPACING?.[originalCategory] || 0;
                    const spacingAdjustment = part.spacing || 0;
                    const totalSpacing = defaultSpacing + spacingAdjustment;
                    const symmetryOffset = part.isLeft ? totalSpacing : -totalSpacing;
                    
                    finalX = canvasCenterX + categoryOffset.x + symmetryOffset + part.x;
                    finalY = canvasCenterY + categoryOffset.y + part.y;
                    
                    // 左右対称パーツには追加の間隔情報を含める
                    absoluteParts[partKey] = {
                        ...part,
                        // 最終配置座標（キャンバス上の実際の位置）
                        finalX: finalX,
                        finalY: finalY,
                        // 従来の情報も保持
                        categoryOffset: categoryOffset,
                        // 左右対称パーツ専用の間隔情報
                        symmetryInfo: {
                            defaultSpacing: defaultSpacing,
                            spacingAdjustment: spacingAdjustment,
                            totalSpacing: totalSpacing,
                            symmetryOffset: symmetryOffset,
                            side: part.isLeft ? 'left' : 'right'
                        },
                        canvasCenter: { x: canvasCenterX, y: canvasCenterY }
                    };
                } else {
                    // 通常パーツの場合
                    finalX = canvasCenterX + categoryOffset.x + part.x;
                    finalY = canvasCenterY + categoryOffset.y + part.y;
                    
                    absoluteParts[partKey] = {
                        ...part,
                        // 最終配置座標（キャンバス上の実際の位置）
                        finalX: finalX,
                        finalY: finalY,
                        // 従来の情報も保持
                        categoryOffset: categoryOffset,
                        canvasCenter: { x: canvasCenterX, y: canvasCenterY }
                    };
                }
            }
            
            const partsData = {
                timestamp: new Date().toISOString(),
                coordinateSystem: {
                    description: "finalX/finalYはキャンバス上の最終座標、categoryOffsetはカテゴリの基準オフセット",
                    canvasCenter: { x: this.canvas.width / 2, y: this.canvas.height / 2 },
                    symmetricalParts: "左右対称パーツには symmetryInfo が追加され、デフォルト間隔と調整値の詳細情報を含む"
                },
                parts: absoluteParts,
                canvasSize: {
                    width: this.canvas.width,
                    height: this.canvas.height
                },
                defaultSpacingConfig: APP_CONFIG.SYMMETRICAL_SPACING
            };

            let portraitUrl = null;
            
            // 保存処理の前に状態を確認
            console.log('=== 保存処理開始 ===');
            console.log('currentPhotoData存在:', !!this.currentPhotoData);
            console.log('window.supabase存在:', !!window.supabase);
            
            if (this.currentPhotoData) {
                console.log('currentPhotoDataの詳細:', this.currentPhotoData);
            }
            
            if (!this.currentPhotoData) {
                console.warn('currentPhotoDataが存在しません。URLパラメータで写真を読み込みましたか？');
            }
            
            if (!window.supabase) {
                console.warn('Supabaseクライアントが利用できません');
            }

            // 現在の写真データが存在する場合、Supabaseに保存してDBを更新
            if (this.currentPhotoData && window.supabase) {
                try {
                    console.log('似顔絵をSupabaseストレージに保存中...');
                    console.log('現在の写真データ:', this.currentPhotoData);
                    
                    // Canvas から直接Blobを取得（CSP問題を回避）
                    const blob = await new Promise(resolve => {
                        this.canvas.toBlob(resolve, 'image/png');
                    });
                    
                    // ファイル名を生成（写真IDと更新日時を含む）
                    const portraitFileName = `portrait_ID${this.currentPhotoData.picture_id}_${timestamp}.png`;
                    const jsonFileName = `portrait_data_ID${this.currentPhotoData.picture_id}_${timestamp}.json`;
                    console.log('アップロード予定ファイル名:', portraitFileName, jsonFileName);
                    console.log('Blobサイズ:', blob.size, 'bytes');
                    
                    // JSONファイルのBlobを作成
                    const jsonBlob = new Blob([JSON.stringify(partsData, null, 2)], {
                        type: 'application/json'
                    });
                    console.log('JSON Blobサイズ:', jsonBlob.size, 'bytes');
                    
                    // Supabaseストレージに画像をアップロード
                    const { data: uploadData, error: uploadError } = await window.supabase.storage
                        .from('portraits')
                        .upload(portraitFileName, blob, {
                            contentType: 'image/png',
                            upsert: true
                        });
                    
                    console.log('似顔絵アップロード結果:', { uploadData, uploadError });
                    
                    if (uploadError) {
                        throw new Error(`似顔絵ストレージアップロードエラー: ${uploadError.message}`);
                    }
                    
                    // Supabaseストレージに JSON ファイルをアップロード
                    const { data: jsonUploadData, error: jsonUploadError } = await window.supabase.storage
                        .from('json-data')
                        .upload(jsonFileName, jsonBlob, {
                            contentType: 'application/json',
                            upsert: true
                        });
                    
                    console.log('JSONアップロード結果:', { jsonUploadData, jsonUploadError });
                    
                    if (jsonUploadError) {
                        throw new Error(`JSONストレージアップロードエラー: ${jsonUploadError.message}`);
                    }
                    
                    // アップロードされた画像のパブリックURLを取得
                    const { data: urlData } = window.supabase.storage
                        .from('portraits')
                        .getPublicUrl(portraitFileName);
                    
                    // アップロードされたJSONのパブリックURLを取得
                    const { data: jsonUrlData } = window.supabase.storage
                        .from('json-data')
                        .getPublicUrl(jsonFileName);
                    
                    portraitUrl = urlData.publicUrl;
                    const jsonUrl = jsonUrlData.publicUrl;
                    console.log('似顔絵保存完了:', portraitUrl);
                    console.log('JSON保存完了:', jsonUrl);
                    console.log('URLデータ:', urlData);
                    console.log('アップロードファイル名:', portraitFileName, jsonFileName);
                    console.log('バケット名:', 'portraits', 'json-data');
                    
                    // データベースを更新
                    console.log('データベース更新開始:', {
                        picture_id: this.currentPhotoData.picture_id,
                        portrait_url: portraitUrl,
                        json_data_size: JSON.stringify(partsData).length,
                        json_data_preview: partsData
                    });
                    
                    console.log('更新するデータ:', {
                        status: '作成済',
                        portrait_url: portraitUrl,
                        json_url: jsonUrl,
                        json_data: partsData,
                        updated_at: new Date().toISOString()
                    });
                    
                    // 更新前にレコードの存在確認
                    console.log('レコード存在確認中...', this.currentPhotoData.picture_id);
                    const { data: existingRecord, error: existError } = await window.supabase
                        .from('portrait_db')
                        .select('picture_id, status, portrait_url, json_data')
                        .eq('picture_id', this.currentPhotoData.picture_id)
                        .single();
                    
                    if (existError) {
                        console.error('レコード存在確認エラー:', existError);
                        if (existError.code === 'PGRST116') {
                            throw new Error(`写真ID ${this.currentPhotoData.picture_id} のレコードが見つかりません。photo-list.htmlから正しくアクセスしていますか？`);
                        }
                        throw new Error(`レコード確認エラー: ${existError.message}`);
                    }
                    
                    console.log('更新対象レコード確認:', existingRecord);
                    
                    // Step 1: 更新処理のみ実行（RLS問題回避のため.select()なし）
                    const { error: updateError } = await window.supabase
                        .from('portrait_db')
                        .update({
                            status: '作成済',
                            portrait_url: portraitUrl,
                            json_url: jsonUrl,
                            json_data: partsData,
                            updated_at: new Date().toISOString()
                        })
                        .eq('picture_id', this.currentPhotoData.picture_id);
                    
                    if (updateError) {
                        console.error('データベース更新エラー:', updateError);
                        throw new Error(`データベース更新エラー: ${updateError.message}`);
                    }
                    
                    console.log('✅ データベース更新完了（RLS対応）');
                    
                    // Step 2: 更新結果を別途確認
                    const { data: updatedRecord, error: selectError } = await window.supabase
                        .from('portrait_db')
                        .select('picture_id, status, portrait_url, json_data')
                        .eq('picture_id', this.currentPhotoData.picture_id)
                        .single();
                    
                    if (selectError) {
                        console.warn('更新後の確認でエラー:', selectError);
                        // 更新は成功しているので、確認エラーは警告のみ
                    } else {
                        console.log('✅ 更新結果確認:', {
                            picture_id: updatedRecord.picture_id,
                            status: updatedRecord.status,
                            portrait_url_exists: !!updatedRecord.portrait_url,
                            json_data_exists: !!updatedRecord.json_data,
                            json_data_keys: updatedRecord.json_data ? Object.keys(updatedRecord.json_data) : null
                        });
                    }
                    
                    // 他のタブに更新を通知（更新されたデータを使用）
                    const notificationData = {
                        picture_id: this.currentPhotoData.picture_id,
                        status: '作成済',
                        portrait_url: portraitUrl,
                        json_url: jsonUrl,
                        json_data: partsData,
                        updated_at: new Date().toISOString()
                    };
                    
                    console.log('タブ間通知データ:', notificationData);
                    this.notifyOtherTabs('portrait_updated', notificationData);
                    
                    this.showNotification('似顔絵を保存し、データベースを更新しました！', 'success');
                    
                    // currentPhotoDataを更新（次回保存時のため）
                    this.currentPhotoData.status = '作成済';
                    this.currentPhotoData.portrait_url = portraitUrl;
                    this.currentPhotoData.json_url = jsonUrl;
                    this.currentPhotoData.json_data = partsData;
                    this.currentPhotoData.updated_at = new Date().toISOString();
                    
                    // 1.5秒後にphoto-list.htmlに遷移（ハイライト表示付き）
                    setTimeout(() => {
                        window.location.href = `photo-list.html?updated=${this.currentPhotoData.picture_id}`;
                    }, 1500);
                    
                } catch (dbError) {
                    console.error('データベース保存エラー:', dbError);
                    this.showNotification(`データベース保存エラー: ${dbError.message}`, 'error');
                }
            }
            
            // ローカルファイルとしてもダウンロード
            const localBlob = await new Promise(resolve => {
                this.canvas.toBlob(resolve, 'image/png');
            });
            const localBlobUrl = URL.createObjectURL(localBlob);
            const link = document.createElement('a');
            // 写真IDが存在する場合はIDを含む名前、そうでなければ従来の名前
            const portraitFileName = this.currentPhotoData 
                ? `portrait_ID${this.currentPhotoData.picture_id}_${timestamp}.png`
                : `${APP_CONFIG.FILE_NAMES.PORTRAIT_PREFIX}${timestamp}${APP_CONFIG.FILE_NAMES.EXTENSIONS.IMAGE}`;
            link.download = portraitFileName;
            link.href = localBlobUrl;
            link.click();
            
            // メモリリークを防ぐためURLを解放
            setTimeout(() => {
                URL.revokeObjectURL(localBlobUrl);
            }, 100);
            
            const jsonBlob = new Blob([JSON.stringify(partsData, null, 2)], {
                type: 'application/json'
            });
            const jsonUrl = URL.createObjectURL(jsonBlob);
            const jsonLink = document.createElement('a');
            // 写真IDが存在する場合はIDを含む名前、そうでなければ従来の名前
            const jsonFileName = this.currentPhotoData 
                ? `portrait_data_ID${this.currentPhotoData.picture_id}_${timestamp}.json`
                : `${APP_CONFIG.FILE_NAMES.DATA_PREFIX}${timestamp}${APP_CONFIG.FILE_NAMES.EXTENSIONS.DATA}`;
            jsonLink.download = jsonFileName;
            jsonLink.href = jsonUrl;
            jsonLink.click();
            
            // 結果に応じて適切なメッセージと処理を実行
            if (portraitUrl) {
                console.log('=== 保存成功 ===');
                alert('似顔絵を保存しました！データベースも更新されました。');
            } else if (this.currentPhotoData && !window.supabase) {
                console.log('=== Supabaseなしで保存 ===');
                alert('似顔絵をローカルに保存しました。データベース機能が利用できません。');
            } else if (!this.currentPhotoData) {
                console.log('=== currentPhotoDataなしで保存 ===');
                alert('似顔絵をローカルに保存しました。\n\n注意：データベースに保存するには、photo-list.htmlから「似顔絵作成」ボタンでアクセスしてください。');
            } else {
                console.log('=== 通常保存 ===');
                alert(SUCCESS_MESSAGES.SAVE_SUCCESS);
            }
            
            // photo-list.htmlへの遷移処理
            if (!portraitUrl) {
                if (confirm('写真一覧ページに移動しますか？')) {
                    window.location.href = 'photo-list.html';
                }
            }
            
        } catch (error) {
            console.error(ERROR_MESSAGES.SAVE_FAILED, error);
            alert(ERROR_MESSAGES.SAVE_FAILED);
        }
    }

    clearCanvas() {
        this.parts = {};
        this.selectedPart = null;
        this.referenceImage = null;
        
        // セレクトボックスをリセット
        const partSelects = document.querySelectorAll('.part-select');
        partSelects.forEach(select => {
            select.value = '';
        });
        
        // スライダーをリセット
        const sliders = ['sizeSlider', 'xSlider', 'ySlider', 'rotationSlider'];
        sliders.forEach(sliderId => {
            const slider = document.getElementById(sliderId);
            const valueSpan = document.getElementById(sliderId.replace('Slider', 'Value'));
            
            if (sliderId === 'sizeSlider') {
                slider.value = APP_CONFIG.SLIDER_CONFIG.SIZE.default;
                valueSpan.textContent = APP_CONFIG.SLIDER_CONFIG.SIZE.default.toFixed(1);
            } else if (sliderId === 'rotationSlider') {
                slider.value = APP_CONFIG.SLIDER_CONFIG.ROTATION.default;
                valueSpan.textContent = APP_CONFIG.SLIDER_CONFIG.ROTATION.default + '°';
            } else {
                slider.value = APP_CONFIG.SLIDER_CONFIG.POSITION.default;
                valueSpan.textContent = APP_CONFIG.SLIDER_CONFIG.POSITION.default;
            }
        });
        
        // selectedPart表示は削除済み
        
        // 参考画像をクリア
        const referenceDiv = document.getElementById('referenceImage');
        if (referenceDiv) {
            referenceDiv.innerHTML = '<p>写真をアップロード</p>';
        }
        
        // 透明度コントロールを非表示（削除）
        // const opacityControl = document.querySelector('.opacity-control');
        // if (opacityControl) {
        //     opacityControl.style.display = 'none';
        // }
        
        // ファイル入力をリセット
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.value = '';
        }
        
        this.render();
    }
}

// アプリケーションの初期化
document.addEventListener('DOMContentLoaded', () => {
    try {
        new PortraitApp();
    } catch (error) {
        console.error('アプリケーション初期化エラー:', error);
        console.error('エラー詳細:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        
        // エラーメッセージを画面に表示
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #f8d7da;
            color: #721c24;
            padding: 20px;
            border: 1px solid #f5c6cb;
            border-radius: 5px;
            z-index: 1000;
            max-width: 500px;
            text-align: center;
        `;
        errorDiv.innerHTML = `
            <h3>アプリケーション初期化エラー</h3>
            <p>${error.message || '不明なエラーが発生しました'}</p>
            <p>ブラウザの開発者ツール（F12）で詳細を確認してください。</p>
        `;
        document.body.appendChild(errorDiv);
    }
});

// PortraitApp クラスに追加する関数
PortraitApp.prototype.loadPhotoFromURL = async function() {
    try {
        // URLパラメータから写真IDを取得
        const urlParams = new URLSearchParams(window.location.search);
        const photoId = urlParams.get('photo_id');
        
        if (!photoId) {
            console.log('URLパラメータに photo_id が指定されていません');
            return;
        }
        
        
        // Supabaseクライアントの初期化完了を待つ
        await this.waitForSupabase();
        
        if (!window.supabase || typeof window.supabase.from !== 'function') {
            console.error('Supabaseクライアントの初期化に失敗しました');
            this.showNotification('データベース接続に失敗しました', 'error');
            return;
        }
        
        console.log('Supabaseクライアント確認完了');
        
        const { data: photoData, error } = await window.supabase
            .from('portrait_db')
            .select('*')
            .eq('picture_id', parseInt(photoId))
            .single();
        
        if (error) {
            console.error('写真データの取得に失敗:', error);
            this.showNotification(`写真ID ${photoId} の読み込みに失敗しました: ${error.message}`, 'error');
            return;
        }
        
        if (!photoData) {
            console.error(`写真ID ${photoId} が見つかりません`);
            this.showNotification(`写真ID ${photoId} が見つかりません`, 'error');
            return;
        }
        
        this.currentPhotoData = photoData;
        
        // 画像を読み込んで表示
        await this.loadImageFromUrl(photoData.picture_url);
        
        // 既存のJSONデータがあれば読み込み
        if (photoData.json_data && Object.keys(photoData.json_data).length > 0) {
            console.log('[this.parts] データ復元開始...');
            this.loadPartsFromData(photoData.json_data);
        }
        
        // 成功通知
        this.showNotification(`写真ID ${photoId} を読み込みました`, 'success');
        
    } catch (error) {
        console.error('写真読み込み処理でエラー:', error);
        this.showNotification('写真の読み込みでエラーが発生しました', 'error');
    }
};

PortraitApp.prototype.loadImageFromUrl = async function(imageUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = () => {
            this.referenceImage = img;
            
            // 参考画像表示エリアに画像を表示
            const referenceImageDiv = document.getElementById('referenceImage');
            if (referenceImageDiv) {
                referenceImageDiv.innerHTML = '';
                const displayImg = document.createElement('img');
                displayImg.src = imageUrl;
                displayImg.style.maxWidth = '100%';
                displayImg.style.maxHeight = '100%';
                displayImg.style.objectFit = 'contain';
                referenceImageDiv.appendChild(displayImg);
            }
            
            this.render();
            resolve();
        };
        
        img.onerror = () => {
            console.error('画像の読み込みに失敗:', imageUrl);
            reject(new Error('画像の読み込みに失敗しました'));
        };
        
        img.src = imageUrl;
    });
};

PortraitApp.prototype.loadPartsFromData = function(jsonData) {
    try {
        if (!jsonData.parts) {
            return;
        }
        
        // パーツデータを復元（有効なカテゴリのみ）
        const validParts = {};
        Object.entries(jsonData.parts).forEach(([partKey, partData]) => {
            if (partData && partData.category && CATEGORY_NAMES.hasOwnProperty(partData.category)) {
                validParts[partKey] = partData;
            } else {
                console.warn('[this.parts] 無効データ除外:', partKey, partData);
            }
        });
        
        this.parts = validParts;
        console.log('[this.parts] JSONからデータ読み込み完了:', Object.keys(this.parts));
        
        // 無効なパーツを完全に除去するクリーンアップ処理
        this.cleanupInvalidParts();
        
        // プルダウンも更新
        this.updatePartSelector();
        
        // UIの状態を更新
        this.updateUIFromPartsData();
        
        // 再描画
        this.render();
        
    } catch (error) {
        console.error('[this.parts] データ復元エラー:', error);
    }
};

PortraitApp.prototype.cleanupInvalidParts = function() {
    const initialCount = Object.keys(this.parts).length;
    const validParts = {};
    let removedCount = 0;
    let fixedCount = 0;
    
    Object.entries(this.parts).forEach(([partKey, partData]) => {
        if (!partData) {
            console.warn('[this.parts] 空データ削除:', partKey);
            removedCount++;
            return;
        }
        
        // category と id が入れ替わっている可能性をチェック
        let fixedPartData = { ...partData };
        let needsFix = false;
        
        // categoryが無効でidが有効なカテゴリ名の場合、入れ替わりの可能性
        if (!CATEGORY_NAMES.hasOwnProperty(partData.category) && 
            CATEGORY_NAMES.hasOwnProperty(partData.id)) {
            console.warn('[this.parts] category/id入れ替え修正:', partKey, partData);
            fixedPartData.category = partData.id;
            fixedPartData.id = partData.category;
            needsFix = true;
            fixedCount++;
        }
        
        // 修正後または元々正常なデータをチェック
        if (CATEGORY_NAMES.hasOwnProperty(fixedPartData.category)) {
            // IDが数値でない場合は削除
            if (isNaN(parseInt(fixedPartData.id))) {
                console.warn('[this.parts] 無効ID削除:', partKey, fixedPartData);
                removedCount++;
                return;
            }
            
            validParts[partKey] = fixedPartData;
            if (needsFix) {
                console.log('[this.parts] 修正完了:', partKey, '->', fixedPartData.category, fixedPartData.id);
            }
        } else {
            console.warn('[this.parts] 無効カテゴリ削除:', partKey, partData);
            removedCount++;
        }
    });
    
    this.parts = validParts;
    
    // パーツが修正または削除された場合のみプルダウンを更新
    if (removedCount > 0 || fixedCount > 0) {
        console.log(`[this.parts] クリーンアップ完了: ${fixedCount}修正 ${removedCount}削除`);
        this.updatePartSelectorFromData();
    }
};

PortraitApp.prototype.updateUIFromPartsData = function() {
    // セレクトボックスの状態を更新
    Object.entries(this.parts).forEach(([category, partData]) => {
        const selectElement = document.getElementById(`${category}Select`);
        if (selectElement && partData.file) {
            selectElement.value = partData.file;
        }
    });
    
    // パーツの編集プルダウンを更新
    this.updatePartSelectorFromData();
};

PortraitApp.prototype.updatePartSelectorFromData = function() {
    const partSelector = document.getElementById('partSelector');
    if (!partSelector) return;
    
    // 既存のオプション（最初の「パーツを選択してください」以外）をクリア
    while (partSelector.children.length > 1) {
        partSelector.removeChild(partSelector.lastChild);
    }
    
    // 左右対称パーツの重複を避けるため、追加済みカテゴリを記録
    const addedCategories = new Set();
    
    // 読み込まれたパーツをプルダウンに追加
    Object.entries(this.parts).forEach(([partKey, partData]) => {
        if (partData && partData.id !== undefined) {
            const category = partData.category;
            
            // 未知のカテゴリの場合は警告のみ表示（削除はしない）
            if (!CATEGORY_NAMES.hasOwnProperty(category)) {
                console.warn('[this.parts] 未知カテゴリ（保持）:', category, partKey);
                // returnしないで処理を続行
            }
            
            // 左右対称パーツの場合、カテゴリが既に追加されていればスキップ
            if ((partData.isLeft || partData.isRight) && addedCategories.has(category)) {
                return;
            }
            
            const option = document.createElement('option');
            
            // 左右対称パーツの場合はカテゴリ名をvalueとして使用、そうでなければpartKeyを使用
            if (partData.isLeft || partData.isRight) {
                option.value = category;
                addedCategories.add(category);
            } else {
                option.value = partKey;
            }
            
            // 表示名を作成（カテゴリ名のみ）
            const japaneseCategory = CATEGORY_NAMES[category] || category; // 未知のカテゴリは英語名のまま表示
            option.textContent = japaneseCategory;
            partSelector.appendChild(option);
        }
    });
    
    console.log('[this.parts] プルダウン更新完了:', Object.keys(this.parts));
    console.log('[this.parts] 現在のデータ:', this.parts);
};

PortraitApp.prototype.waitForSupabase = function() {
    return new Promise((resolve) => {
        // 既に初期化済みの場合はすぐに解決
        if (window.supabase && typeof window.supabase.from === 'function') {
            console.log('Supabaseクライアント既に利用可能');
            resolve();
            return;
        }
        
        // イベントリスナーで初期化完了を待つ
        const handleSupabaseReady = () => {
            window.removeEventListener('supabaseReady', handleSupabaseReady);
            resolve();
        };
        
        window.addEventListener('supabaseReady', handleSupabaseReady);
        
        // タイムアウト処理（10秒）
        setTimeout(() => {
            window.removeEventListener('supabaseReady', handleSupabaseReady);
            console.error('Supabase初期化タイムアウト');
            resolve(); // エラーでも続行
        }, 10000);
    });
};

PortraitApp.prototype.showNotification = function(message, type = 'info') {
    // 通知を表示する簡単な実装
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 5px;
        color: white;
        font-weight: bold;
        z-index: 1000;
        max-width: 300px;
        animation: slideIn 0.3s ease-out;
    `;
    
    // タイプに応じて色を変更
    switch (type) {
        case 'success':
            notification.style.background = '#28a745';
            break;
        case 'error':
            notification.style.background = '#dc3545';
            break;
        default:
            notification.style.background = '#007bff';
    }
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // 3秒後に自動的に削除
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000);
};

PortraitApp.prototype.notifyOtherTabs = function(eventType, data) {
    try {
        // BroadcastChannelを使用してタブ間通信
        if (typeof BroadcastChannel !== 'undefined') {
            const channel = new BroadcastChannel('portrait_app_updates');
            channel.postMessage({
                type: eventType,
                data: data,
                timestamp: new Date().toISOString()
            });
            console.log('BroadcastChannelでタブ間通知送信:', eventType, data);
        }
        
        // LocalStorageを使用したフォールバック
        const updateEvent = {
            type: eventType,
            data: data,
            timestamp: new Date().toISOString()
        };
        localStorage.setItem('portrait_app_last_update', JSON.stringify(updateEvent));
        console.log('LocalStorageでタブ間通知送信:', eventType, data);
        
    } catch (error) {
        console.error('タブ間通知の送信に失敗:', error);
    }
};

// プルダウン選択時に対応するサムネイルをハイライトし、サムネイルからデータを取得
PortraitApp.prototype.highlightCorrespondingThumbnail = function(partKey) {
    if (!this.parts[partKey]) return null;
    
    const partData = this.parts[partKey];
    const category = partData.category;
    const partId = partData.id;
    
    // 全てのサムネイルの選択を解除
    document.querySelectorAll('.part-thumbnail').forEach(t => t.classList.remove('selected'));
    
    // 対応するサムネイルを選択状態に
    const targetThumbnail = document.querySelector(
        `.part-thumbnail[data-category="${category}"][data-part-id="${partId}"]`
    );
    
    if (targetThumbnail) {
        targetThumbnail.classList.add('selected');
        
        // サムネイルから正しいデータを取得して返す
        const thumbnailCategory = targetThumbnail.dataset.category;
        const thumbnailPartId = targetThumbnail.dataset.partId;
        
        console.log('[this.parts] サムネイルから取得:', thumbnailCategory, thumbnailPartId);
        return {
            category: thumbnailCategory,
            partId: thumbnailPartId
        };
    }
    
    return null;
};

// プルダウン選択時に対応するカテゴリタブをアクティブにして、パーツ一覧を表示
PortraitApp.prototype.showCategoryForPart = function(partKey) {
    if (!this.parts[partKey]) return;
    
    const partData = this.parts[partKey];
    const category = partData.category;
    
    // 対応するカテゴリタブをアクティブに
    document.querySelectorAll('.category-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.category === category) {
            tab.classList.add('active');
        }
    });
    
    // そのカテゴリのパーツ一覧を表示
    this.showPartsForCategory(category);
    
};

// 指定されたカテゴリで現在選択中のサムネイルからデータを取得
PortraitApp.prototype.getSelectedThumbnailForCategory = function(category) {
    // カテゴリに基づいてパーツキーを決定（左右対称パーツの場合）
    let searchCategory = category;
    
    // 左右対称パーツの場合、基本カテゴリ名に変換
    if (category.endsWith('_left') || category.endsWith('_right')) {
        searchCategory = category.replace(/_left|_right$/, '');
    }
    
    // そのカテゴリの選択済みサムネイルを探す
    const selectedThumbnail = document.querySelector(
        `.part-thumbnail[data-category="${searchCategory}"].selected`
    );
    
    if (selectedThumbnail) {
        const thumbnailCategory = selectedThumbnail.dataset.category;
        const thumbnailPartId = selectedThumbnail.dataset.partId;
        
        console.log('[this.parts] 選択済みサムネイル発見:', thumbnailCategory, thumbnailPartId);
        
        return {
            category: thumbnailCategory,
            partId: thumbnailPartId
        };
    }
    
    console.log('[this.parts] 選択済みサムネイルなし:', searchCategory);
    return null;
}; 