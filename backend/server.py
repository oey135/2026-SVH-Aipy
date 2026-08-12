#!/usr/bin/env python3
import json
import os
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from datetime import datetime, timedelta
from urllib.parse import urlparse, parse_qs

# 데이터 파일 경로
DATA_DIR = Path(__file__).parent.parent / "data"
DATA_FILE = DATA_DIR / "study_data.json"

# 데이터 초기화
def init_data():
    """데이터 파일 초기화"""
    if not DATA_DIR.exists():
        DATA_DIR.mkdir(parents=True, exist_ok=True)
    
    if not DATA_FILE.exists():
        default_data = {
            "today": datetime.now().strftime("%Y-%m-%d"),
            "ddays": [],
            "daily_plan": {
                "date": datetime.now().strftime("%Y-%m-%d"),
                "motivation": "",
                "total_study_time": 0,
                "subjects": []
            },
            "study_records": {
                "date": datetime.now().strftime("%Y-%m-%d"),
                "records": []
            }
        }
        save_data(default_data)

def load_data():
    """데이터 로드"""
    if DATA_FILE.exists():
        try:
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            return get_default_data()
    return get_default_data()

def save_data(data):
    """데이터 저장"""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def get_default_data():
    """기본 데이터 반환"""
    return {
        "today": datetime.now().strftime("%Y-%m-%d"),
        "ddays": [],
        "daily_plan": {
            "date": datetime.now().strftime("%Y-%m-%d"),
            "motivation": "",
            "total_study_time": 0,
            "subjects": []
        },
        "study_records": {
            "date": datetime.now().strftime("%Y-%m-%d"),
            "records": []
        }
    }

class StudyPlannerHandler(SimpleHTTPRequestHandler):
    """스터디 플래너 HTTP 핸들러"""
    
    def do_GET(self):
        """GET 요청 처리"""
        parsed_path = urlparse(self.path)
        path = parsed_path.path
        
        if path == '/api/data':
            self.send_json_response(load_data())
        elif path == '/api/today':
            data = load_data()
            self.send_json_response({"today": data["today"]})
        elif path.startswith('/api/'):
            self.send_error(404)
        else:
            # 정적 파일 제공
            if path == '/':
                path = '/index.html'
            
            file_path = Path(__file__).parent.parent / "frontend" / path.lstrip('/')
            
            if file_path.exists() and file_path.is_file():
                try:
                    with open(file_path, 'rb') as f:
                        content = f.read()
                    
                    # Content-Type 설정
                    content_type = 'text/html'
                    if path.endswith('.css'):
                        content_type = 'text/css'
                    elif path.endswith('.js'):
                        content_type = 'application/javascript'
                    elif path.endswith('.json'):
                        content_type = 'application/json'
                    
                    self.send_response(200)
                    self.send_header('Content-type', content_type)
                    self.send_header('Content-Length', len(content))
                    self.end_headers()
                    self.wfile.write(content)
                except Exception as e:
                    self.send_error(500, str(e))
            else:
                self.send_error(404)
    
    def do_POST(self):
        """POST 요청 처리"""
        parsed_path = urlparse(self.path)
        path = parsed_path.path
        
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8')
            request_data = json.loads(body) if body else {}
        except:
            self.send_error(400)
            return
        
        data = load_data()
        
        if path == '/api/dday/add':
            dday = request_data.get('dday', {})
            if 'name' in dday and 'date' in dday:
                data['ddays'].append({
                    'id': max([d.get('id', 0) for d in data['ddays']], default=0) + 1,
                    'name': dday['name'],
                    'date': dday['date']
                })
                save_data(data)
                self.send_json_response({"success": True, "ddays": data['ddays']})
            else:
                self.send_error(400)
        
        elif path == '/api/dday/update':
            dday_id = request_data.get('id')
            for i, d in enumerate(data['ddays']):
                if d.get('id') == dday_id:
                    d.update(request_data)
                    save_data(data)
                    self.send_json_response({"success": True, "ddays": data['ddays']})
                    return
            self.send_error(404)
        
        elif path == '/api/dday/delete':
            dday_id = request_data.get('id')
            data['ddays'] = [d for d in data['ddays'] if d.get('id') != dday_id]
            save_data(data)
            self.send_json_response({"success": True, "ddays": data['ddays']})
        
        elif path == '/api/plan/update':
            data['daily_plan'].update(request_data)
            save_data(data)
            self.send_json_response({"success": True, "plan": data['daily_plan']})
        
        elif path == '/api/plan/subject/add':
            subject = request_data.get('subject', {})
            if 'name' in subject:
                subject['id'] = max([s.get('id', 0) for s in data['daily_plan']['subjects']], default=0) + 1
                subject['tasks'] = subject.get('tasks', [])
                data['daily_plan']['subjects'].append(subject)
                save_data(data)
                self.send_json_response({"success": True, "subjects": data['daily_plan']['subjects']})
            else:
                self.send_error(400)
        
        elif path == '/api/plan/subject/delete':
            subject_id = request_data.get('id')
            data['daily_plan']['subjects'] = [s for s in data['daily_plan']['subjects'] if s.get('id') != subject_id]
            save_data(data)
            self.send_json_response({"success": True, "subjects": data['daily_plan']['subjects']})
        
        elif path == '/api/plan/task/add':
            subject_id = request_data.get('subject_id')
            task = request_data.get('task', {})
            for subject in data['daily_plan']['subjects']:
                if subject.get('id') == subject_id:
                    task['id'] = max([t.get('id', 0) for t in subject.get('tasks', [])], default=0) + 1
                    subject.setdefault('tasks', []).append(task)
                    save_data(data)
                    self.send_json_response({"success": True})
                    return
            self.send_error(404)
        
        elif path == '/api/plan/task/update':
            subject_id = request_data.get('subject_id')
            task_id = request_data.get('task_id')
            for subject in data['daily_plan']['subjects']:
                if subject.get('id') == subject_id:
                    for i, task in enumerate(subject.get('tasks', [])):
                        if task.get('id') == task_id:
                            subject['tasks'][i].update(request_data)
                            save_data(data)
                            self.send_json_response({"success": True})
                            return
            self.send_error(404)
        
        elif path == '/api/plan/task/delete':
            subject_id = request_data.get('subject_id')
            task_id = request_data.get('task_id')
            for subject in data['daily_plan']['subjects']:
                if subject.get('id') == subject_id:
                    subject['tasks'] = [t for t in subject.get('tasks', []) if t.get('id') != task_id]
                    save_data(data)
                    self.send_json_response({"success": True})
                    return
            self.send_error(404)
        
        elif path == '/api/study-record/add':
            record = request_data.get('record', {})
            if all(k in record for k in ['startTime', 'duration', 'subject_id']):
                record['id'] = max([r.get('id', 0) for r in data['study_records']['records']], default=0) + 1
                data['study_records']['records'].append(record)
                save_data(data)
                self.send_json_response({"success": True, "records": data['study_records']['records']})
            else:
                self.send_error(400)
        
        elif path == '/api/study-record/delete':
            record_id = request_data.get('id')
            data['study_records']['records'] = [r for r in data['study_records']['records'] if r.get('id') != record_id]
            save_data(data)
            self.send_json_response({"success": True, "records": data['study_records']['records']})
        
        else:
            self.send_error(404)
    
    def send_json_response(self, data):
        """JSON 응답 전송"""
        json_data = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Content-Length', len(json_data))
        self.end_headers()
        self.wfile.write(json_data)
    
    def log_message(self, format, *args):
        """로그 메시지 출력"""
        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {format % args}")

def run_server(port=8000):
    """서버 실행"""
    init_data()
    
    server_address = ('', port)
    httpd = HTTPServer(server_address, StudyPlannerHandler)
    
    print(f"스터디 플래너 서버가 http://localhost:{port} 에서 실행 중입니다.")
    print(f"Ctrl+C 를 눌러 종료할 수 있습니다.")
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n서버를 종료합니다.")
        httpd.server_close()

if __name__ == '__main__':
    run_server()
