// 状态变量
const state = {
    imgA: null,
    imgB: null,
    isLoadedA: false,
    isLoadedB: false,
    splitRatio: 0.5, // 分割线位置，0.0 - 1.0
    isDragging: false,
    canvasWidth: 0,
    canvasHeight: 0,
    scaleB: 1 // 图B相对于图A的缩放比例
};

// DOM 元素
const uploadA = document.getElementById('uploadA');
const uploadB = document.getElementById('uploadB');
const statusA = document.getElementById('statusA');
const statusB = document.getElementById('statusB');
const exportBtn = document.getElementById('exportBtn');
const canvas = document.getElementById('compareCanvas');
const ctx = canvas.getContext('2d');
const loadingMsg = document.getElementById('loadingMsg');
const canvasWrapper = document.getElementById('canvasWrapper');

// 初始化监听器
function initListeners() {
    uploadA.addEventListener('change', (e) => handleFileSelect(e, 'A'));
    uploadB.addEventListener('change', (e) => handleFileSelect(e, 'B'));
    
    // 鼠标事件
    canvas.addEventListener('mousedown', startDrag);
    window.addEventListener('mousemove', drag); // 绑定到 window 以防止拖出画布失效
    window.addEventListener('mouseup', stopDrag);
    
    // 触摸事件 (移动端支持)
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault(); // 防止滚动
        startDrag(e.touches[0]);
    }, { passive: false });
    window.addEventListener('touchmove', (e) => {
        if (state.isDragging) e.preventDefault();
        drag(e.touches[0]);
    }, { passive: false });
    window.addEventListener('touchend', stopDrag);

    // 导出
    exportBtn.addEventListener('click', exportImage);

    // 窗口大小改变时只需重新计算 bounding rect，不需要重绘 canvas 内容
    // 但我们的坐标计算依赖 getBoundingClientRect，它是实时的，所以不需要特殊处理
}

// 处理文件选择
function handleFileSelect(e, type) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            if (type === 'A') {
                state.imgA = img;
                state.isLoadedA = true;
                statusA.textContent = file.name;
            } else {
                state.imgB = img;
                state.isLoadedB = true;
                statusB.textContent = file.name;
            }
            checkAndInitCanvas();
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

// 检查是否两张图都加载完成，并初始化画布
function checkAndInitCanvas() {
    if (state.isLoadedA && state.isLoadedB) {
        initCanvasDimensions();
        canvas.style.display = 'block';
        loadingMsg.style.display = 'none';
        requestAnimationFrame(draw);
    }
}

// 初始化画布尺寸 (归一化逻辑)
function initCanvasDimensions() {
    // 以图A为基准
    const hA = state.imgA.height;
    const wA = state.imgA.width;
    
    // 计算图B的缩放比例，使其高度与图A一致
    const hB = state.imgB.height;
    state.scaleB = hA / hB;

    // 设置画布尺寸
    // 宽度设定：取图A的宽度 (也可选择 max(wA, state.imgB.width * state.scaleB))
    // 这里为了对比方便，通常假设两图主体对齐，故以图A为框
    state.canvasHeight = hA;
    state.canvasWidth = wA;

    canvas.width = state.canvasWidth;
    canvas.height = state.canvasHeight;
}

// 核心渲染函数
function draw(isExporting = false) {
    if (!state.isLoadedA || !state.isLoadedB) return;

    const w = state.canvasWidth;
    const h = state.canvasHeight;
    const splitX = w * state.splitRatio;

    // 清空画布
    ctx.clearRect(0, 0, w, h);

    // 1. 绘制左图 (Before) - 裁剪区域 [0, 0, splitX, h]
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, splitX, h);
    ctx.clip();
    // 绘制图A (原始尺寸)
    // 如果imgA本身大小和canvas大小一致:
    ctx.drawImage(state.imgA, 0, 0); 
    ctx.restore();

    // 2. 绘制右图 (After) - 裁剪区域 [splitX, 0, w, h]
    ctx.save();
    ctx.beginPath();
    ctx.rect(splitX, 0, w - splitX, h);
    ctx.clip();
    // 绘制图B (应用缩放)
    // 目标宽度 = imgB.width * scaleB
    // 目标高度 = imgB.height * scaleB (= h)
    const drawnWidthB = state.imgB.width * state.scaleB;
    ctx.drawImage(state.imgB, 0, 0, drawnWidthB, h);
    ctx.restore();

    // 3. 绘制UI装饰 (分割线和手柄)
    // 导出时，只画分割线，不画手柄
    drawSliderUI(splitX, h, isExporting);
}

function drawSliderUI(x, h, isExporting) {
    ctx.save();
    
    // 样式配置 (根据画布大小动态调整，避免在高分辨率图上太小)
    const lineWidth = Math.max(2, state.canvasWidth * 0.002);
    const circleRadius = Math.max(10, state.canvasWidth * 0.015);
    const arrowSize = circleRadius * 0.5;

    // 垂直线
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = '#fff';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 10;
    ctx.stroke();

    // 如果是导出模式，不画手柄
    if (isExporting) {
        ctx.restore();
        return;
    }

    // 手柄圆圈
    const centerY = h / 2;
    ctx.beginPath();
    ctx.arc(x, centerY, circleRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; // 纯白填充
    ctx.fill();
    ctx.lineWidth = lineWidth / 2;
    ctx.strokeStyle = '#ddd';
    ctx.stroke();

    // 手柄内的箭头 (简单绘制 < >)
    ctx.beginPath();
    ctx.fillStyle = '#666';
    // 左箭头
    ctx.moveTo(x - arrowSize/2, centerY);
    ctx.lineTo(x - arrowSize/4, centerY - arrowSize/2);
    ctx.lineTo(x - arrowSize/4, centerY + arrowSize/2);
    // 右箭头
    ctx.moveTo(x + arrowSize/2, centerY);
    ctx.lineTo(x + arrowSize/4, centerY - arrowSize/2);
    ctx.lineTo(x + arrowSize/4, centerY + arrowSize/2);
    ctx.fill();

    ctx.restore();
}

// 交互逻辑
function startDrag(e) {
    state.isDragging = true;
    updateSplitRatio(e);
}

function drag(e) {
    if (!state.isDragging) return;
    updateSplitRatio(e);
}

function stopDrag() {
    state.isDragging = false;
}

function updateSplitRatio(e) {
    // 获取鼠标/触摸在视口中的位置
    // e 可能是 MouseEvent 或 Touch 对象，都有 clientX
    const clientX = e.clientX;
    
    // 获取 Canvas 在屏幕上的位置和尺寸
    const rect = canvas.getBoundingClientRect();
    
    // 计算相对位置 (0 到 rect.width)
    let x = clientX - rect.left;
    
    // 边界限制
    if (x < 0) x = 0;
    if (x > rect.width) x = rect.width;
    
    // 转换为比例 (0.0 - 1.0)
    state.splitRatio = x / rect.width;
    
    // 触发重绘
    requestAnimationFrame(() => draw(false));
}

// 导出图片
function exportImage() {
    if (!state.isLoadedA || !state.isLoadedB) {
        alert("请先上传两张图片！");
        return;
    }

    try {
        // 1. 瞬间重绘，移除手柄
        draw(true);

        // 2. 使用 toDataURL 导出
        const dataURL = canvas.toDataURL('image/png');
        
        // 3. 立即恢复手柄
        draw(false);
        
        // 创建临时链接下载
        const link = document.createElement('a');
        link.href = dataURL;
        link.download = 'comparison_result.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (err) {
        console.error("Export failed:", err);
        alert("导出失败，可能是因为图片跨域或内存不足。");
        // 即使失败，也要尝试恢复UI
        draw(false);
    }
}

// 启动
initListeners();
