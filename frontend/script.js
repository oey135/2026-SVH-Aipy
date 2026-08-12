// ============================================
// 스터디 플래너 애플리케이션 메인 스크립트 (v2)
// ============================================

// 전역 변수
let appData = {
    today: new Date().toISOString().split('T')[0],
    ddays: [],
    daily_plan: {
        date: new Date().toISOString().split('T')[0],
        motivation: '',
        total_study_time: 0,
        subjects: []
    },
    study_records: {
        date: new Date().toISOString().split('T')[0],
        records: []
    }
};

// 시간표 설정
const START_HOUR = 5;      // 오전 5시
const END_HOUR = 4;        // 다음날 새벽 4시
const CELLS_PER_HOUR = 6;  // 시간당 6칸 (10분씩)
const CELL_MINUTES = 10;   // 칸당 10분

const SUBJECT_COLORS = ['subject-1', 'subject-2', 'subject-3', 'subject-4', 'subject-5', 'subject-6', 'subject-7', 'subject-8'];

// 드래그 관련 변수
let isDragging = false;
let dragStart = null;
let dragEnd = null;
let draggedCells = [];
let selectedRecordId = null;

// ============================================
// 초기화
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    initializeUI();
    setupEventListeners();
    updateUI();
});

function initializeUI() {
    updateDateDisplay();
    generateTimeTable();
    setupModals();
}

function setupEventListeners() {
    // D-Day
    document.getElementById('addDdayBtn').addEventListener('click', openDdayModal);
    document.getElementById('ddayForm').addEventListener('submit', handleDdaySubmit);
    
    // 동기화
    document.getElementById('motivationInput').addEventListener('blur', saveDailyMotivation);
    
    // 과목 추가
    document.getElementById('addSubjectBtn').addEventListener('click', openSubjectModal);
    document.getElementById('subjectForm').addEventListener('submit', handleSubjectSubmit);
    
    // 드래그 종료 - document 레벨에서 처리
    document.addEventListener('mouseup', endDrag);
    
    // 종료 시 자동 저장
    window.addEventListener('beforeunload', () => saveData());
}

// ============================================
// 데이터 통신
// ============================================

async function loadData() {
    try {
        const response = await fetch('/api/data');
        if (response.ok) {
            appData = await response.json();
        }
    } catch (error) {
        console.error('데이터 로드 실패:', error);
    }
}

async function saveData() {
    try {
        await fetch('/api/plan/update', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(appData.daily_plan)
        });
    } catch (error) {
        console.error('데이터 저장 실패:', error);
    }
}

async function apiCall(endpoint, data) {
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        if (response.ok) {
            return await response.json();
        }
    } catch (error) {
        console.error('API 호출 실패:', error);
    }
}

// ============================================
// 헤더 업데이트
// ============================================

function updateDateDisplay() {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const day = today.getDate();
    const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][today.getDay()];
    
    document.getElementById('todayDate').textContent = `${year}년 ${month}월 ${day}일`;
    document.getElementById('dayOfWeek').textContent = `${dayOfWeek}요일`;
}

function saveDailyMotivation(e) {
    appData.daily_plan.motivation = e.target.value;
    saveData();
}

// ============================================
// D-Day 관리
// ============================================

function openDdayModal() {
    document.getElementById('ddayId').value = '';
    document.getElementById('ddayName').value = '';
    document.getElementById('ddayDate').value = '';
    document.getElementById('ddayModalTitle').textContent = 'D-Day 추가';
    document.getElementById('ddayModal').classList.add('show');
}

function editDday(id) {
    const dday = appData.ddays.find(d => d.id === id);
    if (dday) {
        document.getElementById('ddayId').value = dday.id;
        document.getElementById('ddayName').value = dday.name;
        document.getElementById('ddayDate').value = dday.date;
        document.getElementById('ddayModalTitle').textContent = 'D-Day 수정';
        document.getElementById('ddayModal').classList.add('show');
    }
}

async function handleDdaySubmit(e) {
    e.preventDefault();
    const id = document.getElementById('ddayId').value;
    const name = document.getElementById('ddayName').value;
    const date = document.getElementById('ddayDate').value;
    
    if (id) {
        // 수정
        await apiCall('/api/dday/update', { id: parseInt(id), name, date });
    } else {
        // 추가
        await apiCall('/api/dday/add', { dday: { name, date } });
    }
    
    await loadData();
    updateUI();
    closeDdayModal();
}

async function deleteDday(id) {
    if (confirm('삭제하시겠습니까?')) {
        await apiCall('/api/dday/delete', { id });
        await loadData();
        updateUI();
    }
}

function closeDdayModal() {
    document.getElementById('ddayModal').classList.remove('show');
}

function calculateDday(targetDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(targetDate);
    target.setHours(0, 0, 0, 0);
    
    const diff = Math.floor((target - today) / (1000 * 60 * 60 * 24));
    return diff;
}

function renderDdays() {
    const container = document.getElementById('ddayList');
    container.innerHTML = '';
    
    if (appData.ddays.length === 0) {
        container.innerHTML = '<div class="empty-state" style="font-size: 11px;">추가된 D-Day가 없습니다</div>';
        return;
    }
    
    appData.ddays.forEach(dday => {
        const days = calculateDday(dday.date);
        const isToday = days === 0;
        const isPassed = days < 0;
        
        let daysText = '';
        if (isToday) {
            daysText = 'D-Day!';
        } else if (isPassed) {
            daysText = `D+${Math.abs(days)}`;
        } else {
            daysText = `D-${days}`;
        }
        
        const item = document.createElement('div');
        item.className = 'dday-item';
        item.innerHTML = `
            <div class="dday-item-content">
                <div class="dday-name">${dday.name}</div>
                <div class="dday-count ${isPassed || isToday ? 'danger' : ''}">${daysText}</div>
            </div>
            <div class="dday-actions">
                <button class="btn-icon" onclick="editDday(${dday.id})">✏️</button>
                <button class="btn-icon" onclick="deleteDday(${dday.id})">🗑️</button>
            </div>
        `;
        container.appendChild(item);
    });
}

// ============================================
// 과목 관리
// ============================================

function openSubjectModal() {
    document.getElementById('subjectForm').reset();
    document.getElementById('subjectModal').classList.add('show');
}

function closeSubjectModal() {
    document.getElementById('subjectModal').classList.remove('show');
}

async function handleSubjectSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('subjectName').value;
    
    await apiCall('/api/plan/subject/add', {
        subject: { name, tasks: [], color: SUBJECT_COLORS[appData.daily_plan.subjects.length % SUBJECT_COLORS.length] }
    });
    
    await loadData();
    updateUI();
    closeSubjectModal();
}

async function deleteSubject(subjectId) {
    if (confirm('이 과목을 삭제하시겠습니까? 관련된 모든 할일도 삭제됩니다.')) {
        await apiCall('/api/plan/subject/delete', { id: subjectId });
        await loadData();
        updateUI();
    }
}

async function addTask(subjectId) {
    const input = document.querySelector(`input[data-subject-id="${subjectId}"]`);
    const taskText = input.value.trim();
    
    if (taskText) {
        await apiCall('/api/plan/task/add', {
            subject_id: subjectId,
            task: { title: taskText, completed: false }
        });
        input.value = '';
        await loadData();
        updateUI();
    }
}

async function toggleTask(subjectId, taskId, completed) {
    await apiCall('/api/plan/task/update', {
        subject_id: subjectId,
        task_id: taskId,
        completed: !completed
    });
    
    await loadData();
    updateUI();
}

async function deleteTask(subjectId, taskId) {
    if (confirm('이 할일을 삭제하시겠습니까?')) {
        await apiCall('/api/plan/task/delete', {
            subject_id: subjectId,
            task_id: taskId
        });
        await loadData();
        updateUI();
    }
}

function renderSubjects() {
    const container = document.getElementById('subjectsContainer');
    container.innerHTML = '';
    
    if (appData.daily_plan.subjects.length === 0) {
        container.innerHTML = '<div class="empty-state">추가된 과목이 없습니다</div>';
        return;
    }
    
    appData.daily_plan.subjects.forEach((subject, index) => {
        const card = document.createElement('div');
        card.className = 'subject-card';
        card.style.borderLeftColor = getCSSVariableValue(`--subject-${(index % 8) + 1}`);
        
        const completedCount = subject.tasks.filter(t => t.completed).length;
        const totalCount = subject.tasks.length;
        
        card.innerHTML = `
            <div class="subject-header">
                <div>
                    <div class="subject-name">${subject.name}</div>
                    <small style="color: var(--text-light);">완료: ${completedCount}/${totalCount}</small>
                </div>
                <button class="subject-delete-btn" onclick="deleteSubject(${subject.id})">삭제</button>
            </div>
            <div class="tasks-list">
                ${subject.tasks.map(task => `
                    <div class="task-item ${task.completed ? 'completed' : ''}">
                        <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}
                               onchange="toggleTask(${subject.id}, ${task.id}, ${task.completed})">
                        <span class="task-text">${task.title}</span>
                        <button class="task-delete-btn" onclick="deleteTask(${subject.id}, ${task.id})">×</button>
                    </div>
                `).join('')}
            </div>
            <div class="add-task-input">
                <input type="text" placeholder="할일 입력..." data-subject-id="${subject.id}">
                <button onclick="addTask(${subject.id})">추가</button>
            </div>
        `;
        
        container.appendChild(card);
    });
}

// ============================================
// 시간표 관리 (새로운 드래그 시스템)
// ============================================

function generateTimeTable() {
    const container = document.getElementById('timeTableGrid');
    container.innerHTML = '';
    
    if (appData.daily_plan.subjects.length === 0) {
        container.innerHTML = '<div class="empty-state">과목을 먼저 추가해주세요</div>';
        return;
    }
    
    // 시간대별 컬럼 생성 (5시 ~ 다음날 4시)
    for (let hour = 0; hour < 24; hour++) {
        const displayHour = (START_HOUR + hour) % 24;
        const column = document.createElement('div');
        column.className = 'time-column';
        
        // 시간 레이블
        const label = document.createElement('div');
        label.className = 'time-label';
        label.textContent = `${String(displayHour).padStart(2, '0')}:00`;
        column.appendChild(label);
        
        // 시간대별 셀들
        const cellsContainer = document.createElement('div');
        cellsContainer.className = 'time-cells';
        
        for (let cell = 0; cell < CELLS_PER_HOUR; cell++) {
            const timeStr = `${String(displayHour).padStart(2, '0')}:${String(cell * CELL_MINUTES).padStart(2, '0')}`;
            const timeCell = createTimeCell(timeStr, hour, cell);
            cellsContainer.appendChild(timeCell);
        }
        
        column.appendChild(cellsContainer);
        container.appendChild(column);
    }
    
    updateTimeTableDisplay();
}

function createTimeCell(timeStr, hourIndex, cellIndex) {
    const cell = document.createElement('div');
    cell.className = 'time-cell selectable';
    cell.dataset.time = timeStr;
    cell.dataset.hour = hourIndex;
    cell.dataset.cell = cellIndex;
    
    // 마우스 이벤트
    cell.addEventListener('mousedown', (e) => {
        if (appData.daily_plan.subjects.length === 0) return;
        isDragging = true;
        dragStart = { hour: parseInt(hourIndex), cell: parseInt(cellIndex), time: timeStr };
        dragEnd = { ...dragStart };
        draggedCells = [];
        updateDragPreview();
    });
    
    cell.addEventListener('mouseenter', () => {
        if (!isDragging) return;
        dragEnd = { hour: parseInt(cell.dataset.hour), cell: parseInt(cell.dataset.cell), time: cell.dataset.time };
        updateDragPreview();
    });
    
    cell.addEventListener('click', (e) => {
        if (!isDragging) {
            handleCellClick(timeStr);
        }
    });
    
    return cell;
}

function startDrag(e, cell, timeStr) {
    if (appData.daily_plan.subjects.length === 0) return;
    
    isDragging = true;
    dragStart = { hour: parseInt(cell.dataset.hour), cell: parseInt(cell.dataset.cell), time: timeStr };
    dragEnd = { ...dragStart };
    draggedCells = [];
    
    updateDragPreview();
}

function continueDrag(e, cell) {
    if (!isDragging) return;
    
    dragEnd = { hour: parseInt(cell.dataset.hour), cell: parseInt(cell.dataset.cell), time: cell.dataset.time };
    
    // 선택된 셀들 업데이트
    updateDragPreview();
}

function endDrag() {
    if (!isDragging) return;
    
    isDragging = false;
    
    if (draggedCells.length > 0 && dragStart && dragEnd) {
        // 드래그가 완료되면 과목 선택 모달 표시
        showChangeSubjectModal(draggedCells);
    }
    
    draggedCells.forEach(c => c.classList.remove('dragging'));
    draggedCells = [];
}

function updateDragPreview() {
    // 기존 선택 제거
    draggedCells.forEach(c => c.classList.remove('dragging'));
    draggedCells = [];
    
    // dragStart와 dragEnd를 통합 인덱스로 변환 (시간 * 6 + 셀)
    const startIdx = parseInt(dragStart.hour) * CELLS_PER_HOUR + parseInt(dragStart.cell);
    const endIdx = parseInt(dragEnd.hour) * CELLS_PER_HOUR + parseInt(dragEnd.cell);
    
    const minIdx = Math.min(startIdx, endIdx);
    const maxIdx = Math.max(startIdx, endIdx);
    
    // 모든 셀을 순회하며 범위에 속한 셀 선택
    const cells = document.querySelectorAll('.time-cell');
    cells.forEach(cell => {
        const hour = parseInt(cell.dataset.hour);
        const cellIndex = parseInt(cell.dataset.cell);
        const cellIdx = hour * CELLS_PER_HOUR + cellIndex;
        
        if (cellIdx >= minIdx && cellIdx <= maxIdx) {
            cell.classList.add('dragging');
            draggedCells.push(cell);
        }
    });
}

function handleCellClick(timeStr) {
    // 이미 기록이 있는 셀인 경우 그 기록의 과목을 변경
    const record = appData.study_records.records.find(r => {
        const recordEndTime = addMinutesToTime(r.startTime || r.time, r.duration || 10);
        return timeStr >= (r.startTime || r.time) && timeStr < recordEndTime;
    });
    
    if (record) {
        selectedRecordId = record.id;
        showChangeSubjectModal([document.querySelector(`[data-time="${timeStr}"]`)], record.subject_id);
    } else {
        // 빈 셀인 경우 그 셀을 선택해서 과목 선택
        const cell = document.querySelector(`[data-time="${timeStr}"]`);
        draggedCells = [cell];
        showChangeSubjectModal([cell]);
    }
}

function addMinutesToTime(timeStr, minutes) {
    const [hours, mins] = timeStr.split(':').map(Number);
    const totalMins = hours * 60 + mins + minutes;
    const newHours = Math.floor(totalMins / 60) % 24;
    const newMins = totalMins % 60;
    return `${String(newHours).padStart(2, '0')}:${String(newMins).padStart(2, '0')}`;
}

function showChangeSubjectModal(cells, currentSubjectId = null) {
    const container = document.getElementById('subjectOptions');
    const deleteBtn = document.getElementById('deleteStudyRecordBtn');
    container.innerHTML = '';
    
    appData.daily_plan.subjects.forEach((subject, index) => {
        const btn = document.createElement('button');
        btn.className = 'subject-option-btn';
        btn.type = 'button';
        
        const colorClass = SUBJECT_COLORS[index % SUBJECT_COLORS.length];
        const colorVar = getCSSVariableValue(`--${colorClass}`);
        
        btn.innerHTML = `
            <div class="subject-option-color" style="background: ${colorVar};"></div>
            <span class="subject-option-name">${subject.name}</span>
        `;
        
        btn.addEventListener('click', () => {
            applySubjectToRecord(cells, subject.id, colorClass);
            closeChangeSubjectModal();
        });
        
        container.appendChild(btn);
    });

    if (selectedRecordId) {
        deleteBtn.classList.remove('hidden');
        deleteBtn.onclick = async () => {
            await deleteStudyRecord();
            closeChangeSubjectModal();
        };
    } else {
        deleteBtn.classList.add('hidden');
        deleteBtn.onclick = null;
    }
    
    document.getElementById('changeSubjectModal').classList.add('show');
}

function closeChangeSubjectModal() {
    document.getElementById('changeSubjectModal').classList.remove('show');
    selectedRecordId = null;
    const deleteBtn = document.getElementById('deleteStudyRecordBtn');
    deleteBtn.classList.add('hidden');
    deleteBtn.onclick = null;
}

async function deleteStudyRecord() {
    if (!selectedRecordId) return;

    if (confirm('이 공부 기록을 삭제할까요?')) {
        await apiCall('/api/study-record/delete', { id: selectedRecordId });
        await loadData();
        updateUI();
    }
}

async function applySubjectToRecord(cells, subjectId, colorClass) {
    if (cells.length === 0) return;
    
    if (selectedRecordId) {
        // 기존 기록 수정
        await apiCall('/api/study-record/delete', { id: selectedRecordId });
    }
    
    // 새 기록 추가
    const startTime = cells[0].dataset.time;
    const duration = cells.length * CELL_MINUTES;
    
    const record = {
        startTime,
        duration,
        subject_id: subjectId,
        color: colorClass
    };
    
    await apiCall('/api/study-record/add', {
        record: record
    });
    
    await loadData();
    updateUI();
}

function updateTimeTableDisplay() {
    // 모든 셀 초기화
    document.querySelectorAll('.time-cell').forEach(cell => {
        cell.className = 'time-cell selectable';
        cell.innerHTML = '';
    });
    
    // 기록 표시
    appData.study_records.records.forEach(record => {
        const startTime = record.startTime || record.time;
        const duration = record.duration || 10;
        
        // 시작 시간부터 끝 시간까지의 모든 셀 찾기
        const [startHour, startMin] = startTime.split(':').map(Number);
        const totalStartMins = startHour * 60 + startMin;
        
        document.querySelectorAll('.time-cell').forEach(cell => {
            const cellTime = cell.dataset.time;
            const [cellHour, cellMin] = cellTime.split(':').map(Number);
            const cellTotalMins = cellHour * 60 + cellMin;
            
            const recordEndMins = totalStartMins + duration;
            
            if (cellTotalMins >= totalStartMins && cellTotalMins < recordEndMins) {
                const subject = appData.daily_plan.subjects.find(s => s.id === record.subject_id);
                const colorIndex = appData.daily_plan.subjects.indexOf(subject);
                const colorClass = SUBJECT_COLORS[colorIndex % SUBJECT_COLORS.length];
                
                cell.classList.add('filled', colorClass);
                
                // 첫 셀에만 과목명 표시
                if (cellTotalMins === totalStartMins) {
                    cell.innerHTML = `<span class="subject-name">${subject ? subject.name : '?'}</span>`;
                }
                
                // 클릭 이벤트 추가
                cell.addEventListener('click', (e) => {
                    e.stopPropagation();
                    selectedRecordId = record.id;
                    draggedCells = [cell];
                    showChangeSubjectModal([cell], record.subject_id);
                });
            }
        });
    });
}

function updateTotalStudyTime() {
    const totalMinutes = appData.study_records.records.reduce((sum, record) => {
        return sum + (record.duration || 10);
    }, 0);
    
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    
    if (hours > 0) {
        document.getElementById('totalStudyTime').textContent = `${hours}시간 ${mins}분`;
    } else {
        document.getElementById('totalStudyTime').textContent = `${mins}분`;
    }
}

// ============================================
// UI 업데이트
// ============================================

function updateUI() {
    renderDdays();
    renderSubjects();
    generateTimeTable();
    updateTotalStudyTime();
    document.getElementById('motivationInput').value = appData.daily_plan.motivation || '';
}

// ============================================
// 모달 관리
// ============================================

function setupModals() {
    // D-Day 모달
    const ddayModal = document.getElementById('ddayModal');
    const ddayClose = ddayModal.querySelector('.close');
    ddayClose.addEventListener('click', closeDdayModal);
    ddayModal.addEventListener('click', (e) => {
        if (e.target === ddayModal) closeDdayModal();
    });
    
    // 과목 모달
    const subjectModal = document.getElementById('subjectModal');
    const subjectClose = subjectModal.querySelector('.close');
    subjectClose.addEventListener('click', closeSubjectModal);
    subjectModal.addEventListener('click', (e) => {
        if (e.target === subjectModal) closeSubjectModal();
    });
    
    // 과목 선택 모달
    const changeSubjectModal = document.getElementById('changeSubjectModal');
    const changeSubjectClose = changeSubjectModal.querySelector('.close');
    changeSubjectClose.addEventListener('click', closeChangeSubjectModal);
    changeSubjectModal.addEventListener('click', (e) => {
        if (e.target === changeSubjectModal) closeChangeSubjectModal();
    });
}

// ============================================
// 유틸리티
// ============================================

function getCSSVariableValue(varName) {
    return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}
