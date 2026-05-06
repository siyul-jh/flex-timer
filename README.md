# flexTimer

macOS 메뉴바에서 flex.team 근무 시간을 바로 확인할 수 있는 Electron 앱입니다.

> flex.team을 업무 도구로 사용하면서, 근무 시간을 확인하려면 매번 브라우저를 열어야 했습니다.
> 메뉴바에서 바로 볼 수 있으면 어떨까 싶어 직접 만들었습니다.

---

## Features

- **메뉴바 상주** — 앱 전환 없이 메뉴바에서 현재 근무 시간 실시간 확인
- **근무 시간 기록** — 출퇴근 시간 기록 및 누적 근무 시간 관리
- **macOS 네이티브 UX** — 시스템 트레이에 자연스럽게 통합

---

## Tech Stack

| 목적 | 선택 |
|------|------|
| 런타임 | Electron |
| 패키지 매니저 | Yarn 4 (Berry) |
| 언어 | JavaScript |

---

## 기술적 의사결정

**왜 Electron인가?**
macOS 메뉴바 앱을 만드는 가장 현실적인 선택지였습니다. Swift/Obj-C로 네이티브 앱을 만들 수도 있지만, 웹 기술로 빠르게 프로토타입을 만들고 실제로 쓸 수 있는 도구를 만드는 게 목적이었습니다. Electron의 `Tray` API로 메뉴바 아이콘과 팝업을 구현했습니다.

---

## Getting Started

Node.js, Yarn 4 (Berry) 환경이 필요합니다.

```bash
corepack enable
yarn install
yarn start
```

### 빌드

```bash
yarn build
```

---

## 배경

flex.team을 실제로 사용하면서 불편함을 느껴 만든 개인 도구입니다.
"필요한 게 없으면 직접 만든다"는 접근으로 시작했고, 실제로 매일 사용하고 있습니다.
