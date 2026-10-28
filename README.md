# gamenews

## 생애주기 자산배분 경제 게임 (`index.html`)

브라우저로 `index.html`을 열면 바로 실행됩니다.

- 턴마다 선택 사항 3개: 금액과 이익/손실 여부는 **턴 완료 전까지 비공개**
- 1턴에서 가정 형태(맞벌이/외벌이)를 고르면 3턴까지 유지, 2턴에는 둘째 출산 선택지(국가 지원금 포함)
- 외벌이는 1~3턴에 부업 선택 가능(맞벌이는 선택 불가)
- 턴 완료 시 ① 결과치(투자 정산 + 선택 결과) → ② 선택에 따른 연봉 변화 → ③ 총 이월 자금 순서로 공개
- 다음 턴은 상단 탭(강조 표시)을 눌러 이동
- 선택지 내용·확률·금액은 `index.html`의 `choices` 객체에서 수정

## Vercel 배포

빌드 과정이 없는 정적 사이트입니다. `vercel.json`에서 Framework Preset을 "Other"(`"framework": null`)로 고정해 두었으므로, 저장소 루트의 `index.html`이 그대로 서비스됩니다.

1. [vercel.com/new](https://vercel.com/new)에서 GitHub 저장소 `ranha0924/gamenews`를 Import
2. 설정은 그대로 두고 **Deploy**
3. 이후 `main` 브랜치에 push하면 자동으로 재배포되고, 다른 브랜치는 미리보기(Preview) 주소로 배포됩니다.
