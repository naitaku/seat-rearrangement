document.addEventListener('DOMContentLoaded', function() {
    let members = [];
    let currentLayout = null;
    
    // メンバー登録フォームの処理
    document.getElementById('memberForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        const nameInput = document.getElementById('memberName');
        const name = nameInput.value.trim();
        
        if (name) {
            const response = await fetch('/api/members', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name: name })
            });
            
            if (response.ok) {
                const member = await response.json();
                members.push(member);
                updateMemberList();
                updateMemberPool();
                nameInput.value = '';
            }
        }
    });

    // メンバーリストの更新
    async function updateMemberList() {
        const response = await fetch('/api/members');
        members = await response.json();
        
        const memberList = document.getElementById('memberList');
        memberList.innerHTML = members.map(member => `
            <div class="list-group-item d-flex justify-content-between align-items-center">
                ${member.name}
                <button class="btn btn-danger btn-sm delete-member" data-member-id="${member.id}">削除</button>
            </div>
        `).join('');
        
        // 削除ボタンのイベントリスナーを追加
        document.querySelectorAll('.delete-member').forEach(button => {
            button.addEventListener('click', async (e) => {
                if (confirm('このメンバーを削除してもよろしいですか？')) {
                    const memberId = e.target.dataset.memberId;
                    const response = await fetch(`/api/members/${memberId}`, {
                        method: 'DELETE'
                    });
                    
                    if (response.ok) {
                        updateMemberList();
                        updateMemberPool();
                        initializeSeatingChart(); // 座席表も更新
                    }
                }
            });
        });
        
        updateMemberPool();
    }

    // 座席表の初期化
    function initializeSeatingChart() {
        const seatingChart = document.getElementById('seatingChart');
        seatingChart.innerHTML = '';
        
        for (let i = 1; i <= 16; i++) {
            const seat = document.createElement('div');
            seat.className = 'seat empty';
            seat.dataset.seatNumber = i;
            seat.innerHTML = `
                <div class="seat-number">席番号: ${i}</div>
                <div class="member-name"></div>
            `;
            
            seat.addEventListener('dragover', handleDragOver);
            seat.addEventListener('drop', handleDrop);
            seat.addEventListener('dragstart', handleDragStart);
            seat.addEventListener('dragend', handleDragEnd);
            seat.addEventListener('contextmenu', handleContextMenu);
            seat.draggable = true;
            
            seatingChart.appendChild(seat);
        }
    }

    // 右クリックメニューハンドラ
    function handleContextMenu(e) {
        e.preventDefault();
        const seat = e.target.closest('.seat');
        const memberName = seat.querySelector('.member-name');
        
        if (memberName && memberName.dataset.memberId) {
            // 座席の割り当てを解除
            seat.classList.add('empty');
            memberName.textContent = '';
            memberName.removeAttribute('data-member-id');
            
            // メンバープールに戻す
            updateMemberPool();
        }
    }

    // メンバープールの更新
    function updateMemberPool() {
        const memberPool = document.querySelector('.member-list');
        const assignedMemberIds = Array.from(document.querySelectorAll('.seat .member-name[data-member-id]'))
            .map(el => parseInt(el.dataset.memberId));
        
        // 未割り当てのメンバーのみを表示
        const unassignedMembers = members.filter(member => !assignedMemberIds.includes(member.id));
        
        memberPool.innerHTML = unassignedMembers.map(member => `
            <div class="member-item" draggable="true" data-member-id="${member.id}">
                ${member.name}
            </div>
        `).join('');
        
        document.querySelectorAll('.member-item').forEach(item => {
            item.addEventListener('dragstart', handleDragStart);
            item.addEventListener('dragend', handleDragEnd);
        });
    }

    // ドラッグ&ドロップ処理
    function handleDragStart(e) {
        e.target.classList.add('dragging');
        if (e.target.classList.contains('member-item')) {
            e.dataTransfer.setData('memberId', e.target.dataset.memberId);
        } else if (e.target.classList.contains('seat')) {
            const memberId = e.target.querySelector('.member-name').dataset.memberId;
            if (memberId) {
                e.dataTransfer.setData('memberId', memberId);
                e.dataTransfer.setData('fromSeat', e.target.dataset.seatNumber);
            }
        }
    }

    function handleDragEnd(e) {
        e.target.classList.remove('dragging');
        document.querySelectorAll('.drag-over').forEach(element => {
            element.classList.remove('drag-over');
        });
    }

    function handleDragOver(e) {
        e.preventDefault();
        e.target.closest('.seat').classList.add('drag-over');
    }

    function handleDrop(e) {
        e.preventDefault();
        const seat = e.target.closest('.seat');
        seat.classList.remove('drag-over');
        
        const memberId = e.dataTransfer.getData('memberId');
        const fromSeat = e.dataTransfer.getData('fromSeat');
        
        if (memberId) {
            const member = members.find(m => m.id === parseInt(memberId));
            if (member) {
                // 既に他の座席に同じメンバーが割り当てられているか確認
                const existingSeat = document.querySelector(`.seat .member-name[data-member-id="${memberId}"]`);
                if (existingSeat && existingSeat.closest('.seat') !== seat) {
                    // 既存の割り当てを解除
                    const oldSeat = existingSeat.closest('.seat');
                    oldSeat.classList.add('empty');
                    existingSeat.textContent = '';
                    existingSeat.removeAttribute('data-member-id');
                }

                if (fromSeat) {
                    const oldSeat = document.querySelector(`.seat[data-seat-number="${fromSeat}"]`);
                    oldSeat.classList.add('empty');
                    oldSeat.querySelector('.member-name').textContent = '';
                    oldSeat.querySelector('.member-name').removeAttribute('data-member-id');
                }
                
                // 新しい座席に割り当て
                seat.classList.remove('empty');
                seat.querySelector('.member-name').textContent = member.name;
                seat.querySelector('.member-name').dataset.memberId = member.id;
                
                // メンバープールを更新
                updateMemberPool();
            }
        }
    }

    // 座席表の保存
    document.getElementById('saveLayout').addEventListener('click', async function() {
        const name = document.getElementById('layoutName').value.trim();
        if (!name) {
            alert('座席表名を入力してください');
            return;
        }
        
        const seats = [];
        document.querySelectorAll('.seat').forEach(seat => {
            const seatNumber = parseInt(seat.dataset.seatNumber);
            const memberName = seat.querySelector('.member-name');
            const memberId = memberName.dataset.memberId ? parseInt(memberName.dataset.memberId) : null;
            
            seats.push({
                seat_number: seatNumber,
                member_id: memberId
            });
        });
        
        const response = await fetch('/api/layouts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: name,
                seats: seats
            })
        });
        
        if (response.ok) {
            alert('座席表を保存しました');
            updateLayoutList();
        }
    });

    // 座席表リストの更新
    async function updateLayoutList() {
        const response = await fetch('/api/layouts');
        const layouts = await response.json();
        
        const layoutSelect = document.getElementById('layoutSelect');
        layoutSelect.innerHTML = '<option value="">座席表を選択...</option>' +
            layouts.map(layout => `
                <option value="${layout.id}">${layout.name}</option>
            `).join('');
        
        // 移動計画用のセレクトボックスも更新
        const fromLayout = document.getElementById('fromLayout');
        const toLayout = document.getElementById('toLayout');
        fromLayout.innerHTML = toLayout.innerHTML = '<option value="">選択してください</option>' +
            layouts.map(layout => `
                <option value="${layout.id}">${layout.name}</option>
            `).join('');
    }

    // 座席表の読み込み
    document.getElementById('layoutSelect').addEventListener('change', async function(e) {
        const layoutId = e.target.value;
        if (layoutId) {
            const response = await fetch(`/api/layouts/${layoutId}`);
            const assignments = await response.json();
            
            // 座席表をクリア
            initializeSeatingChart();
            
            // 座席を割り当て
            assignments.forEach(assignment => {
                if (assignment.member_id) {
                    const member = members.find(m => m.id === assignment.member_id);
                    if (member) {
                        const seat = document.querySelector(`.seat[data-seat-number="${assignment.seat_number}"]`);
                        seat.classList.remove('empty');
                        seat.querySelector('.member-name').textContent = member.name;
                        seat.querySelector('.member-name').dataset.memberId = member.id;
                    }
                }
            });
            
            // 編集モードを有効化
            document.getElementById('layoutName').value = layoutSelect.options[layoutSelect.selectedIndex].text;
            document.getElementById('saveLayout').style.display = 'none';
            document.getElementById('updateLayout').style.display = 'inline-block';
            document.getElementById('deleteLayout').style.display = 'inline-block';
            currentLayout = layoutId;
            
            updateMemberPool();
        } else {
            initializeSeatingChart();
            document.getElementById('layoutName').value = '';
            document.getElementById('saveLayout').style.display = 'inline-block';
            document.getElementById('updateLayout').style.display = 'none';
            document.getElementById('deleteLayout').style.display = 'none';
            currentLayout = null;
        }
    });

    // 座席表の更新
    document.getElementById('updateLayout').addEventListener('click', async function() {
        if (!currentLayout) return;
        
        const name = document.getElementById('layoutName').value.trim();
        if (!name) {
            alert('座席表名を入力してください');
            return;
        }
        
        const seats = [];
        document.querySelectorAll('.seat').forEach(seat => {
            const seatNumber = parseInt(seat.dataset.seatNumber);
            const memberName = seat.querySelector('.member-name');
            const memberId = memberName.dataset.memberId ? parseInt(memberName.dataset.memberId) : null;
            
            seats.push({
                seat_number: seatNumber,
                member_id: memberId
            });
        });
        
        const response = await fetch(`/api/layouts/${currentLayout}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: name,
                seats: seats
            })
        });
        
        if (response.ok) {
            alert('座席表を更新しました');
            updateLayoutList();
        }
    });

    // 座席表の削除
    document.getElementById('deleteLayout').addEventListener('click', async function() {
        if (!currentLayout) return;
        
        if (confirm('この座席表を削除してもよろしいですか？')) {
            const response = await fetch(`/api/layouts/${currentLayout}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                alert('座席表を削除しました');
                document.getElementById('layoutSelect').value = '';
                document.getElementById('layoutSelect').dispatchEvent(new Event('change'));
                updateLayoutList();
            }
        }
    });

    // 移動計画の計算
    document.getElementById('calculateMoves').addEventListener('click', async function() {
        const fromLayoutId = document.getElementById('fromLayout').value;
        const toLayoutId = document.getElementById('toLayout').value;
        const movesList = document.getElementById('movesList');
        
        if (!fromLayoutId || !toLayoutId) {
            alert('移動元と移動先の座席表を選択してください');
            return;
        }
        
        try {
            movesList.innerHTML = '<div class="alert alert-info">移動手順を計算中...</div>';
            
            const response = await fetch('/api/calculate-moves', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    from_layout_id: parseInt(fromLayoutId),
                    to_layout_id: parseInt(toLayoutId)
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const moves = await response.json();
            console.log('Received moves:', moves); // デバッグ用
            
            if (!moves || moves.length === 0) {
                movesList.innerHTML = '<div class="alert alert-info">移動は必要ありません。</div>';
                return;
            }

            // メンバー情報を取得
            const membersResponse = await fetch('/api/members');
            const allMembers = await membersResponse.json();
            console.log('All members:', allMembers); // デバッグ用

            const memberMap = {};
            allMembers.forEach(member => {
                memberMap[member.id] = member.name;
            });
            
            // 移動手順を表示
            const movesHtml = moves.map((move, index) => {
                const memberName = memberMap[move.member_id] || `メンバー${move.member_id}`;
                return `
                    <div class="move-item">
                        ${index + 1}. ${memberName}: 席${move.from_seat} → 席${move.to_seat}
                    </div>
                `;
            }).join('');

            if (movesHtml) {
                movesList.innerHTML = `
                    <div class="moves-container">
                        <h4>移動手順:</h4>
                        ${movesHtml}
                    </div>
                `;
            } else {
                movesList.innerHTML = '<div class="alert alert-warning">移動手順を生成できませんでした。</div>';
            }
        } catch (error) {
            console.error('Error calculating moves:', error);
            movesList.innerHTML = '<div class="alert alert-danger">移動手順の計算中にエラーが発生しました。</div>';
        }
    });

    // 初期化
    initializeSeatingChart();
    updateMemberList();
    updateLayoutList();
});
