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
        
        // 座標軸の表示フラグ
        this.showCoordinates = true;
        
        this.init();
    }

    async init() {
        await this.loadManifest();
        this.setupEventListeners();
        this.loadParts();
        this.setupImageUpload();
        this.setupPartsGrid();
        this.render();
    }

    async loadManifest() {
        try {
            console.log('マニフェストファイルを読み込み中...');
            console.log('現在のURL:', window.location.href);
            console.log('完全なパス:', `${window.location.origin}/assets/assets/manifest.json`);
            
            const response = await fetch('assets/assets/manifest.json');
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
            console.log('マニフェストファイル読み込み成功:', this.manifest);
            
            // 各カテゴリのパーツ数を確認
            Object.entries(this.manifest.categories).forEach(([category, data]) => {
                console.log(`${category}: ${data.parts.length}個のパーツ`);
            });
            
        } catch (error) {
            console.error(ERROR_MESSAGES.MANIFEST_LOAD_FAILED, error);
            console.error('エラー詳細:', {
                message: error.message,
                stack: error.stack,
                name: error.name
            });
            console.error('マニフェストファイルのパス: assets/assets/manifest.json');
            console.error('現在のURL:', window.location.href);
            
            // ファイル構造の確認
            console.error('ファイル構造の確認が必要です。以下を確認してください:');
            console.error('1. ローカルサーバーで実行しているか');
            console.error('2. assets/assets/manifest.jsonファイルが存在するか');
            console.error('3. ファイルパスが正しいか');
        }
    }

    setupEventListeners() {
        // パーツ選択のイベントリスナー
        const partSelects = document.querySelectorAll('.part-select');
        partSelects.forEach(select => {
            select.addEventListener('change', (e) => {
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
                if (e.target.value) {
                    this.selectPart(e.target.value);
                } else {
                    this.deselectPart();
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

    onPartSelect(selectId, value) {
        const category = selectId.replace('Select', '');
        console.log(`onPartSelect呼び出し: selectId=${selectId}, value=${value}, category=${category}`);
        
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
                    console.log(`新規パーツ作成: ${category}`, this.parts[category]);
                } else {
                    // 既存パーツのIDのみ更新（位置やサイズは保持）
                    this.parts[category].id = value;
                }
            }
            
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
            } else {
                // 通常のパーツの場合
                if (this.selectedPart === category) {
                    this.deselectPart();
                }
                delete this.parts[category];
            }
        }
        
        // パーツ選択プルダウンを更新
        this.updatePartSelector();
        
        console.log(`パーツ状況:`, this.parts);
        this.render();
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
            const categoryNames = {
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
            
            option.textContent = categoryNames[displayCategory] || displayCategory;
            partSelector.appendChild(option);
            
            // 追加したカテゴリを記録
            addedCategories.add(displayCategory);
        }
        
        // 選択を復元
        partSelector.value = currentSelection;
    }

    selectPart(category) {
        // 左右対称パーツかどうかチェック
        const isSymmetrical = this.symmetricalParts.includes(category);
        
        if (isSymmetrical) {
            // 左右対称パーツの場合は左側を選択
            const leftPartKey = category + '_left';
            if (this.parts[leftPartKey]) {
                this.selectedPart = leftPartKey;
                const part = this.parts[leftPartKey];
                
                // UIを更新（selectedPart要素が存在する場合のみ）
                const selectedPartElement = document.getElementById('selectedPart');
                if (selectedPartElement) {
                    const categoryNames = {
                        eye: '目',
                        eyebrow: '眉毛', 
                        ear: '耳'
                    };
                    const displayName = categoryNames[category] || category;
                    selectedPartElement.textContent = `${displayName}: ${part.id}`;
                }
                
                // スライダーの値を更新
                const scaleX = part.scaleX || part.scale || 1;
                const scaleY = part.scaleY || part.scale || 1;
                document.getElementById('sizeSlider').value = scaleX;
                document.getElementById('sizeValue').textContent = scaleX.toFixed(1);
                document.getElementById('sizeYSlider').value = scaleY;
                document.getElementById('sizeYValue').textContent = scaleY.toFixed(1);
                document.getElementById('xSlider').value = part.x;
                document.getElementById('xValue').textContent = part.x;
                document.getElementById('ySlider').value = part.y;
                document.getElementById('yValue').textContent = part.y;
                document.getElementById('rotationSlider').value = part.rotation;
                document.getElementById('rotationValue').textContent = part.rotation + '°';
                
                // 間隔スライダーの値を設定
                const spacingSlider = document.getElementById('spacingSlider');
                const spacingValue = document.getElementById('spacingValue');
                if (spacingSlider && spacingValue) {
                    const spacing = part.spacing || APP_CONFIG.SYMMETRICAL_SPACING?.[category] || 0;
                    spacingSlider.value = spacing;
                    spacingValue.textContent = spacing;
                }
                
                // 回転スライダーの有効/無効制御
                const rotationSlider = document.getElementById('rotationSlider');
                const canRotate = ['eye', 'eyebrow', 'ear'].includes(category);
                console.log(`回転判定: category=${category}, canRotate=${canRotate}`);
                if (rotationSlider) {
                    rotationSlider.disabled = !canRotate;
                    rotationSlider.parentElement.style.opacity = canRotate ? '1' : '0.5';
                    console.log(`回転スライダー設定: disabled=${!canRotate}`);
                }
                
                // 間隔スライダーの表示/非表示
                const allowSpacing = ['eye', 'eyebrow', 'ear'].includes(category);
                console.log(`間隔判定: category=${category}, allowSpacing=${allowSpacing}`);
                if (spacingSlider) {
                    const spacingControl = spacingSlider.closest('.control-group');
                    if (spacingControl) {
                        spacingControl.style.display = allowSpacing ? 'block' : 'none';
                        console.log(`間隔スライダー設定: display=${allowSpacing ? 'block' : 'none'}`);
                    }
                }
            }
        } else {
            // 通常のパーツの場合
            this.selectedPart = category;
            const part = this.parts[category];
            
            if (!part) {
                console.warn(`パーツが見つかりません: ${category}`);
                return;
            }
            
            // UIを更新（selectedPart要素が存在する場合のみ）
            const selectedPartElement = document.getElementById('selectedPart');
            if (selectedPartElement) {
                selectedPartElement.textContent = `${category}: ${part.id}`;
            }
            
            // スライダーの値を更新
            const scaleX = part.scaleX || part.scale || 1;
            const scaleY = part.scaleY || part.scale || 1;
            document.getElementById('sizeSlider').value = scaleX;
            document.getElementById('sizeValue').textContent = scaleX.toFixed(1);
            document.getElementById('sizeYSlider').value = scaleY;
            document.getElementById('sizeYValue').textContent = scaleY.toFixed(1);
            document.getElementById('xSlider').value = part.x;
            document.getElementById('xValue').textContent = part.x;
            document.getElementById('ySlider').value = part.y;
            document.getElementById('yValue').textContent = part.y;
            document.getElementById('rotationSlider').value = part.rotation;
            document.getElementById('rotationValue').textContent = part.rotation + '°';
            
            // 回転スライダーの有効/無効制御
            const rotationSlider = document.getElementById('rotationSlider');
            const canRotate = ['eye', 'eyebrow', 'ear'].includes(category);
            console.log(`通常パーツ回転判定: category=${category}, canRotate=${canRotate}`);
            if (rotationSlider) {
                rotationSlider.disabled = !canRotate;
                rotationSlider.parentElement.style.opacity = canRotate ? '1' : '0.5';
            }
            
            // 間隔スライダーを非表示
            const spacingSlider = document.getElementById('spacingSlider');
            if (spacingSlider) {
                const spacingControl = spacingSlider.closest('.control-group');
                if (spacingControl) {
                    spacingControl.style.display = 'none';
                    console.log(`通常パーツ間隔スライダー: 非表示`);
                }
            }
        }
    }

    deselectPart() {
        this.selectedPart = null;
        const selectedPartElement = document.getElementById('selectedPart');
        if (selectedPartElement) {
            selectedPartElement.textContent = 'なし';
        }
        
        // 間隔スライダーを非表示
        const spacingSlider = document.getElementById('spacingSlider');
        if (spacingSlider) {
            const spacingControl = spacingSlider.closest('.control-group');
            if (spacingControl) {
                spacingControl.style.display = 'none';
            }
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
        
        console.log(`パーツリセット完了: ${originalCategory}`);
    }

    updateSlidersFromPart() {
        if (!this.selectedPart || !this.parts[this.selectedPart]) return;

        const part = this.parts[this.selectedPart];
        const scaleX = part.scaleX || part.scale || 1;
        const scaleY = part.scaleY || part.scale || 1;

        // スライダーの値を更新
        document.getElementById('sizeSlider').value = scaleX;
        document.getElementById('sizeValue').textContent = scaleX.toFixed(1);
        document.getElementById('sizeYSlider').value = scaleY;
        document.getElementById('sizeYValue').textContent = scaleY.toFixed(1);
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
                switch (sliderId) {
                    case 'sizeSlider':
                        leftPart.scaleX = parseFloat(value);
                        rightPart.scaleX = parseFloat(value);
                        break;
                    case 'sizeYSlider':
                        leftPart.scaleY = parseFloat(value);
                        rightPart.scaleY = parseFloat(value);
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
            switch (sliderId) {
                case 'sizeSlider':
                    part.scaleX = parseFloat(value);
                    break;
                case 'sizeYSlider':
                    part.scaleY = parseFloat(value);
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
        
        console.log(`パーツ状況:`, this.parts);
        this.render();
    }

    async render() {
        console.log(`レンダリング開始。現在のパーツ数: ${Object.keys(this.parts).length}`);
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
            
            // mouth/mouseの名前不一致を修正
            const folderName = originalCategory === 'mouth' ? 'mouse' : originalCategory;
            const svgPath = `assets/assets/${folderName}/${folderName}_${part.id.toString().padStart(3, '0')}.svg`;
            console.log(`SVGファイルを読み込み中: ${svgPath}`);
            console.log(`現在のURL: ${window.location.href}`);
            console.log(`完全なパス: ${window.location.origin}/${svgPath}`);
            
            const response = await fetch(svgPath);
            
            if (!response.ok) {
                console.error(`SVGファイルが見つかりません: ${svgPath}`);
                console.error(`HTTP Status: ${response.status} ${response.statusText}`);
                console.error(`レスポンスURL: ${response.url}`);
                
                // ファイルの存在確認を試行
                const testResponse = await fetch('assets/assets/manifest.json');
                if (testResponse.ok) {
                    console.log('マニフェストファイルは正常に読み込めます');
                } else {
                    console.error('マニフェストファイルも読み込めません。ローカルサーバーで実行してください。');
                }
                return;
            }
            
            const svgText = await response.text();
            console.log(`SVGファイル読み込み成功: ${svgPath}`);
            console.log(`SVG内容の長さ: ${svgText.length}文字`);
            
            // SVGをDataURLに変換
            const svgBlob = new Blob([svgText], {type: 'image/svg+xml'});
            const url = URL.createObjectURL(svgBlob);
            console.log(`Blob URL作成: ${url}`);
            
            // 画像の読み込みを待つためPromiseを使用
            await new Promise((resolve, reject) => {
                const img = new Image();
                
                img.onload = () => {
                    console.log(`画像描画中: ${category}_${part.id}`);
                    console.log(`画像サイズ: ${img.width}x${img.height}`);
                    this.ctx.save();
                    
                    // 常にキャンバスの中央を基準に描画
                    const centerX = this.canvas.width / 2;
                    const centerY = this.canvas.height / 2;
                    
                    // カテゴリごとの自動配置オフセット（顔の自然な配置）
                    const categoryOffsets = {
                        outline: { x: 0, y: 0 },      // 輪郭の視覚的中心
                        hair: { x: 0, y: 0 },        // 髪の重心は上寄り
                        eyebrow: { x: 0, y: -15 },       // 眉毛の中心
                        eye: { x: 0, y: 15 },           // 目の中心
                        ear: { x: 0, y: 40 },          // 耳の中心
                        nose: { x: 0, y: 70 },         // 鼻の中心
                        mouse: { x: 0, y: 130 },         // 口の中心
                        beard: { x: 0, y: 0 },        // ひげの重心は下寄り
                        glasses: { x: 0, y: 20 },       // メガネの中心
                        acc: { x: 0, y: 0 },           // アクセサリーの中心
                        wrinkles: { x: 0, y: 0 },      // しわの中心
                        extras: { x: 0, y: 0 }         // その他の中心
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
                    
                    URL.revokeObjectURL(url);
                    resolve();
                };
                
                img.onerror = (error) => {
                    console.error(`画像読み込みエラー: ${svgPath}`, error);
                    console.error('エラー詳細:', {
                        message: error.message,
                        type: error.type,
                        target: error.target
                    });
                    URL.revokeObjectURL(url);
                    reject(error);
                };
                
                img.src = url;
            });
            
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
        // カテゴリごとの基準位置を表示
        const categoryOffsets = {
            outline: { x: 0, y: 0, label: '輪郭' },
            hair: { x: 0, y: -80, label: '髪' },
            eyebrow: { x: 0, y: -40, label: '眉毛' },
            eye: { x: 0, y: -25, label: '目' },
            ear: { x: 0, y: -10, label: '耳' },
            nose: { x: 0, y: 0, label: '鼻' },
            mouse: { x: 0, y: 25, label: '口' },
            beard: { x: 0, y: 45, label: 'ひげ' },
            glasses: { x: 0, y: -25, label: 'メガネ' },
            acc: { x: 0, y: -100, label: 'アクセ' }
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
        console.log(`左右対称パーツ作成: ${category}, ID: ${partId}`);
        
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
        
        console.log(`左パーツ作成: ${category}_left`, this.parts[category + '_left']);
        console.log(`右パーツ作成: ${category}_right`, this.parts[category + '_right']);
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

        // パーツのサムネイルを作成
        for (const partNum of categoryData.parts) {
            if (partNum === 0) continue; // 0番は「なし」なのでスキップ

            const thumbnail = document.createElement('div');
            thumbnail.className = 'part-thumbnail';
            thumbnail.dataset.category = category;
            thumbnail.dataset.partId = partNum;

            // SVGを読み込んでサムネイル表示
            try {
                const folderName = category === 'mouth' ? 'mouse' : category;
                const svgPath = `assets/assets/${folderName}/${folderName}_${partNum.toString().padStart(3, '0')}.svg`;
                
                const response = await fetch(svgPath);
                if (response.ok) {
                    const svgText = await response.text();
                    const svgBlob = new Blob([svgText], {type: 'image/svg+xml'});
                    const url = URL.createObjectURL(svgBlob);

                    const img = document.createElement('img');
                    img.src = url;
                    img.alt = `${category} ${partNum}`;
                    img.onload = () => URL.revokeObjectURL(url);
                    
                    thumbnail.appendChild(img);
                } else {
                    thumbnail.textContent = partNum.toString();
                }
            } catch (error) {
                console.error(`サムネイル読み込みエラー: ${category}_${partNum}`, error);
                thumbnail.textContent = partNum.toString();
            }

            // クリックイベント
            thumbnail.addEventListener('click', () => {
                this.selectPartFromGrid(category, partNum);
                
                // 選択状態の表示
                document.querySelectorAll('.part-thumbnail').forEach(t => t.classList.remove('selected'));
                thumbnail.classList.add('selected');
            });

            thumbnailsContainer.appendChild(thumbnail);
        }

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

        noneOption.addEventListener('click', () => {
            this.selectPartFromGrid(category, '');
            
            // 選択状態の表示
            document.querySelectorAll('.part-thumbnail').forEach(t => t.classList.remove('selected'));
            noneOption.classList.add('selected');
        });

        thumbnailsContainer.insertBefore(noneOption, thumbnailsContainer.firstChild);
    }

    selectPartFromGrid(category, partId) {
        console.log(`パーツ選択: ${category}, ID: ${partId}`);
        
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
        
        // 直接パーツを追加する処理も呼び出す
        this.onPartSelect(category + 'Select', partId);
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
            // キャンバスをPNG画像として保存
            const imageData = this.canvas.toDataURL('image/png');
            const link = document.createElement('a');
            const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
            link.download = `${APP_CONFIG.FILE_NAMES.PORTRAIT_PREFIX}${timestamp}${APP_CONFIG.FILE_NAMES.EXTENSIONS.IMAGE}`;
            link.href = imageData;
            link.click();
            
            // パーツの座標データをJSONとして保存（絶対座標に変換）
            const absoluteParts = {};
            
            // カテゴリごとの自動配置オフセット（app.jsの描画処理と同じ値）
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
                } else {
                    // 通常パーツの場合
                    finalX = canvasCenterX + categoryOffset.x + part.x;
                    finalY = canvasCenterY + categoryOffset.y + part.y;
                }
                
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
            
            const partsData = {
                timestamp: new Date().toISOString(),
                coordinateSystem: {
                    description: "absoluteX/absoluteYはキャンバス中心(500,400)からの絶対座標、relativeX/relativeYは各カテゴリ基準位置からの相対座標",
                    canvasCenter: { x: this.canvas.width / 2, y: this.canvas.height / 2 }
                },
                parts: absoluteParts,
                canvasSize: {
                    width: this.canvas.width,
                    height: this.canvas.height
                }
            };
            
            const jsonBlob = new Blob([JSON.stringify(partsData, null, 2)], {
                type: 'application/json'
            });
            const jsonUrl = URL.createObjectURL(jsonBlob);
            const jsonLink = document.createElement('a');
            jsonLink.download = `${APP_CONFIG.FILE_NAMES.DATA_PREFIX}${timestamp}${APP_CONFIG.FILE_NAMES.EXTENSIONS.DATA}`;
            jsonLink.href = jsonUrl;
            jsonLink.click();
            
            // 成功メッセージを表示
            alert(SUCCESS_MESSAGES.SAVE_SUCCESS);
            
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
        
        const selectedPartElement = document.getElementById('selectedPart');
        if (selectedPartElement) {
            selectedPartElement.textContent = 'なし';
        }
        
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
        console.log('アプリケーション初期化開始...');
        new PortraitApp();
        console.log('アプリケーション初期化完了');
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