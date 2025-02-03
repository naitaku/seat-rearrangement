from flask import Flask, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///seats.db'
db = SQLAlchemy(app)

class Member(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)

class SeatLayout(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class SeatAssignment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    layout_id = db.Column(db.Integer, db.ForeignKey('seat_layout.id'), nullable=False)
    seat_number = db.Column(db.Integer, nullable=False)
    member_id = db.Column(db.Integer, db.ForeignKey('member.id'), nullable=True)

with app.app_context():
    db.create_all()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/members', methods=['GET', 'POST'])
def members():
    if request.method == 'POST':
        data = request.json
        member = Member(name=data['name'])
        db.session.add(member)
        db.session.commit()
        return jsonify({'id': member.id, 'name': member.name})
    
    members = Member.query.all()
    return jsonify([{'id': m.id, 'name': m.name} for m in members])

@app.route('/api/layouts', methods=['GET', 'POST'])
def layouts():
    if request.method == 'POST':
        data = request.json
        layout = SeatLayout(name=data['name'])
        db.session.add(layout)
        db.session.commit()
        
        # Create seat assignments
        for seat_data in data['seats']:
            assignment = SeatAssignment(
                layout_id=layout.id,
                seat_number=seat_data['seat_number'],
                member_id=seat_data.get('member_id')
            )
            db.session.add(assignment)
        db.session.commit()
        return jsonify({'id': layout.id, 'name': layout.name})
    
    layouts = SeatLayout.query.all()
    return jsonify([{'id': l.id, 'name': l.name} for l in layouts])

@app.route('/api/layouts/<int:layout_id>')
def get_layout(layout_id):
    assignments = SeatAssignment.query.filter_by(layout_id=layout_id).all()
    return jsonify([{
        'seat_number': a.seat_number,
        'member_id': a.member_id
    } for a in assignments])

def calculate_optimal_moves(current_layout, target_layout):
    moves = []
    current = current_layout.copy()
    
    # 各メンバーの現在の位置と目標位置を特定
    member_positions = {}  # member_id -> (current_seat, target_seat)
    for seat, member_id in current.items():
        if member_id is not None:
            member_positions[member_id] = {'current': seat, 'target': None}
    
    for seat, member_id in target_layout.items():
        if member_id is not None:
            if member_id in member_positions:
                member_positions[member_id]['target'] = seat
            else:
                print(f"Warning: Member {member_id} in target layout but not in current layout")

    # 移動が必要なメンバーを特定
    members_to_move = [
        member_id for member_id, positions in member_positions.items()
        if positions['target'] is not None and positions['current'] != positions['target']
    ]

    print("Members to move:", members_to_move)  # デバッグ出力
    
    # 各メンバーを移動
    for member_id in members_to_move:
        current_seat = member_positions[member_id]['current']
        target_seat = member_positions[member_id]['target']
        
        # 目標の席が空いているか確認
        if current[target_seat] is None:
            # 直接移動可能
            moves.append({
                'member_id': member_id,
                'from_seat': current_seat,
                'to_seat': target_seat
            })
            current[target_seat] = member_id
            current[current_seat] = None
        else:
            # 空席を探す
            empty_seats = [seat for seat, member in current.items() if member is None]
            if empty_seats:
                temp_seat = empty_seats[0]
                # 一時的な席に移動
                moves.append({
                    'member_id': member_id,
                    'from_seat': current_seat,
                    'to_seat': temp_seat
                })
                current[temp_seat] = member_id
                current[current_seat] = None
                
                # 目標の席にいる人を移動
                blocking_member = current[target_seat]
                blocking_member_target = None
                for m, pos in member_positions.items():
                    if m == blocking_member:
                        blocking_member_target = pos['target']
                        break
                
                # ブロッキングメンバーを移動
                if blocking_member_target is not None:
                    moves.append({
                        'member_id': blocking_member,
                        'from_seat': target_seat,
                        'to_seat': blocking_member_target
                    })
                    current[blocking_member_target] = blocking_member
                    current[target_seat] = None
                
                # 最終的な移動
                moves.append({
                    'member_id': member_id,
                    'from_seat': temp_seat,
                    'to_seat': target_seat
                })
                current[target_seat] = member_id
                current[temp_seat] = None

    print("Final moves:", moves)  # デバッグ出力
    return moves

@app.route('/api/calculate-moves', methods=['POST'])
def calculate_moves():
    data = request.json
    current_layout = {a.seat_number: a.member_id 
                     for a in SeatAssignment.query.filter_by(layout_id=data['from_layout_id']).all()}
    target_layout = {a.seat_number: a.member_id 
                    for a in SeatAssignment.query.filter_by(layout_id=data['to_layout_id']).all()}
    
    # デバッグ情報をログに出力
    print("Current layout:", current_layout)
    print("Target layout:", target_layout)
    
    moves = calculate_optimal_moves(current_layout, target_layout)
    
    # デバッグ情報をログに出力
    print("Calculated moves:", moves)
    
    return jsonify(moves)

if __name__ == '__main__':
    app.run(debug=True, port=5001)
