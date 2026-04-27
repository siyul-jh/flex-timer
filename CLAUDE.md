# FlexTimer (Electron) — Claude Code 가이드

## 프로젝트 개요

flex.team 근무 시간을 macOS 메뉴바에 실시간으로 표시하는 Electron 앱

## 실행

```bash
npm install
npm start
```

## 빌드 (.app / .dmg)

```bash
npm run build
# dist/ 폴더에 FlexTimer.dmg 생성
```

## 파일 구조 (Feature-Sliced Design v2.1)

```
src/
├── app/
│   ├── main.js         ← Electron 메인 프로세스 (Tray, Window, IPC, Tick)
│   └── preload.js      ← contextBridge (main ↔ renderer IPC)
├── entities/
│   └── work-data/
│       ├── api/        ← flex.team API 호출 (getCurrentStatus, getWorkClockData)
│       └── model/      ← fetchWorkData: API 병렬 호출 후 정규화 반환
├── features/
│   └── clock-actions/  ← clockIn / clockOut API 호출
├── pages/
│   ├── popover/ui/     ← 메뉴바 드롭다운 UI (popover.html/js/css)
│   └── settings/ui/    ← 설정 창 UI (index.html/js/style.css)
└── shared/
    ├── api/            ← fetchFlexAPI 공통 요청 헬퍼
    ├── constants/      ← 앱 전역 상수
    └── lib/settings.js ← 설정 파일 읽기/쓰기 (electron-store 대신 JSON 파일)
```

## 인증 방식

- `session.defaultSession.cookies`에서 flex.team 쿠키 자동 수집
- 로그인 창(BrowserWindow)으로 flex.team/login → 쿠키 자동 저장
- 별도 토큰 관리 불필요
- 쿠키 변경 감지 시 자동 데이터 재로드 (`setupCookieListener`)

## API 엔드포인트

```
# 현재 출근 상태
GET /api/v2/time-tracking/work-schedules/users/{userId}/current-status

# 오늘 출퇴근 기록
GET /api/v2/time-tracking/work-clock/users
    ?userIdHashes={userId}&timeStampFrom={ms}&timeStampTo={ms}
```

두 API는 `Promise.all`로 병렬 호출.

## IPC 채널

| 채널                  | 방향            | 타입    | 설명                     |
| --------------------- | --------------- | ------- | ------------------------ |
| `request-data`        | renderer → main | send/on | 데이터 요청              |
| `work-data`           | main → renderer | send    | 전체 WorkData 전송       |
| `tick`                | main → renderer | send    | 1초마다 elapsed 갱신     |
| `refresh`             | renderer → main | send/on | 강제 데이터 재로드       |
| `open-login`          | renderer → main | send/on | 로그인 창 열기           |
| `open-settings`       | renderer → main | send/on | 설정 창 열기             |
| `quit`                | renderer → main | send/on | 앱 종료                  |
| `get-break-minutes`   | renderer → main | invoke  | 현재 휴게시간(분) 조회   |
| `set-break-minutes`   | renderer → main | send/on | 휴게시간 변경 및 저장    |
| `get-settings`        | renderer → main | invoke  | 전체 설정 조회           |
| `save-settings`       | renderer → main | send/on | 전체 설정 저장           |
| `get-launch-at-login` | renderer → main | invoke  | 로그인 시 자동 실행 여부 |
| `set-launch-at-login` | renderer → main | send/on | 로그인 시 자동 실행 설정 |
| `clock-in`            | renderer → main | invoke  | 출근 처리                |
| `clock-out`           | renderer → main | invoke  | 퇴근 처리                |
| `resize-window`       | renderer → main | send/on | 창 크기 조정             |

## 주요 기능

### 휴게시간 자동 차감

`calcBreakOverlapMs(clockInTime, endTime, settings)` — 출근 ~ 현재(또는 퇴근) 구간 중 휴게 시간대(`breakStartTime`~`breakEndTime`)와 겹치는 밀리초를 반환. 실근무 시간 계산에 사용.

### 퇴근 후 상태 표시

- 퇴근 기록이 있으면 트레이: `--:--` 고정
- 팝오버: `HH:MM 출근 → HH:MM 퇴근` + 순수 근무 시간(`totalWorkedSec`) 표시

### 초과 근무 알림

순수 근무 7시간 30분(`OVERTIME_THRESHOLD_S`) 초과 시 macOS Notification 1회 발송.

### 우클릭 컨텍스트 메뉴

트레이 우클릭 시 `Menu.buildFromTemplate` + `tray.popUpContextMenu` 사용:

- 출근하기 / 퇴근하기 (현재 상태에 따라 활성/비활성)
- Flex 열기 (`shell.openExternal`)
- 새로고침 / 설정 / 종료

### 로그인 시 자동 실행

설정 창에서 토글. `app.getLoginItemSettings()` / `app.setLoginItemSettings()` 사용.

### macOS 위젯 (없음)

Electron은 macOS 네이티브 위젯 미지원. 메뉴바 드롭다운으로 대체.
