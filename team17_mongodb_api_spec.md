## 1. MongoDB 컬렉션 설계

### 1.0 공통 enum 기준

아래 표준 코드를 사용하며, 프론트엔드와 백엔드는 같은 enum을 공유한다.

#### AllergyCode
참고: [MFDS Food Labeling System](https://www.mfds.go.kr/eng/wpge/m_14/de011005l001.do)

```ts
type AllergyCode =
  | 'EGG'        // 알류(가금류)
  | 'MILK'
  | 'BUCKWHEAT'
  | 'PEANUT'
  | 'SOYBEAN'
  | 'WHEAT'
  | 'MACKEREL'
  | 'CRAB'
  | 'SHRIMP'
  | 'PORK'
  | 'PEACH'
  | 'TOMATO'
  | 'SULFITES'  // 최종 제품에 SO2 10mg/kg 이상 포함되는 경우
  | 'WALNUT'
  | 'CHICKEN'
  | 'BEEF'
  | 'SQUID'
  | 'SHELLFISH' // 조개류: 굴, 전복, 홍합 등 포함
  | 'PINE_NUT'
```

#### DietaryLabelCode

```ts
type DietaryLabelCode =
  | 'HALAL'
  | 'VEGETARIAN'
  | 'VEGAN'
  | 'PESCATARIAN'
  | 'LACTO_VEGETARIAN'
  | 'OVO_VEGETARIAN'
  | 'LACTO_OVO_VEGETARIAN'
  | 'NO_PORK'
  | 'NO_BEEF'
```

#### CategoryCode

```ts
type CategoryCode =
  | 'KOREAN'
  | 'WESTERN'
  | 'CHINESE'
  | 'JAPANESE'
  | 'ASIAN'
  | 'SALAD'
  | 'SNACK'
  | 'DESSERT'
  | 'BEVERAGE'
  | 'OTHER'
```

---

### 1.1 `users`

일반 사용자, 매니저, 관리자를 함께 저장한다.

```ts
User {
  _id: ObjectId,

  email: string,              // unique, kaist.ac.kr only
  passwordHash: string,
  nickname: string,

  role: 'USER' | 'MANAGER' | 'ADMIN',

  isEmailVerified: boolean,

  dietaryProfile: {
    allergies: AllergyCode[],   // ['EGG', 'MILK', 'PEANUT']
    preferredIngredients: string[],
    dislikedIngredients: string[],
    dietaryLabels: DietaryLabelCode[]
  },

  reviewStats: {
    verifiedReviewCount: number
  },

  createdAt: Date,
  updatedAt: Date
}
```

#### 인덱스

```ts
users.createIndex({ email: 1 }, { unique: true })
users.createIndex({ role: 1 })
```

---

### 1.2 `auth_tokens`

이메일 인증, 비밀번호 재설정, refresh token 관리용 컬렉션이다.

```ts
AuthToken {
  _id: ObjectId,

  userId: ObjectId,

  type: 'EMAIL_VERIFY' | 'PASSWORD_RESET' | 'REFRESH_TOKEN',

  tokenHash: string,

  expiresAt: Date,
  usedAt?: Date,

  createdAt: Date,
  updatedAt: Date
}
```

#### 인덱스

```ts
auth_tokens.createIndex({ tokenHash: 1 }, { unique: true })
auth_tokens.createIndex({ userId: 1, type: 1 })
auth_tokens.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
```

---

### 1.3 `cafeterias`

식당 정보를 저장한다. 지도 페이지에 필요한 위치 정보도 함께 둔다.

```ts
Cafeteria {
  _id: ObjectId,

  name: string,                // e.g. 'Kaimaru'
  description?: string,

  location: {
    building?: string,
    floor?: string,
    address?: string,
    lat?: number,
    lng?: number
  },

  openingHours: {
    monday?: TimeRange[],
    tuesday?: TimeRange[],
    wednesday?: TimeRange[],
    thursday?: TimeRange[],
    friday?: TimeRange[],
    saturday?: TimeRange[],
    sunday?: TimeRange[]
  },

  isActive: boolean,

  createdAt: Date,
  updatedAt: Date
}

TimeRange {
  open: string,                // '11:30'
  close: string                // '13:00'
}
```

#### 인덱스

```ts
cafeterias.createIndex({ name: 1 }, { unique: true })
cafeterias.createIndex({ isActive: 1 })
```

---

### 1.4 `meals`

음식 자체의 기본 정보를 저장한다.  
예를 들어 `Mackerel Set`의 재료, 영양 정보, 알레르기 정보를 여기에 둔다.

```ts
Meal {
  _id: ObjectId,

  name: string,
  description?: string,

  category: CategoryCode,

  imageUrl?: string,

  ingredients: string[],
  allergens: AllergyCode[],
  dietaryLabels: DietaryLabelCode[],

  nutrition: {
    calories?: number,
    carbohydrate?: number,
    protein?: number,
    fat?: number,
    sodium?: number
  },

  createdBy: ObjectId,         // manager user id

  createdAt: Date,
  updatedAt: Date
}
```

#### 인덱스

```ts
meals.createIndex({ name: 'text', ingredients: 'text' })
meals.createIndex({ category: 1 })
meals.createIndex({ allergens: 1 })
meals.createIndex({ dietaryLabels: 1 })
```

---

### 1.5 `menu_servings`

특정 날짜와 식당에서 판매되는 메뉴 정보를 저장한다.

`Meal`은 음식 원본이고, `MenuServing`은 “오늘 카이마루에서 파는 Mackerel Set”처럼 실제 판매되는 단위다.

```ts
MenuServing {
  _id: ObjectId,

  mealId: ObjectId,
  cafeteriaId: ObjectId,

  date: string,                // '2026-04-08', Asia/Seoul local date
  mealTime: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'ALL_DAY',

  price: number,

  status: 'AVAILABLE' | 'SOLD_OUT' | 'HIDDEN',

  stock?: number,

  averageRating: number,
  verifiedReviewCount: number,

  createdBy: ObjectId,         // manager user id

  createdAt: Date,
  updatedAt: Date
}
```

#### 인덱스

```ts
menu_servings.createIndex(
  { date: 1, cafeteriaId: 1, mealTime: 1, mealId: 1 },
  { unique: true }
)
menu_servings.createIndex({ date: 1, status: 1 })
menu_servings.createIndex({ mealId: 1 })
menu_servings.createIndex({ averageRating: -1, verifiedReviewCount: -1 })
```

---

### 1.6 `receipts`

OCR 영수증 검증 정보를 저장한다.  
리뷰 조작을 막기 위해 **One Receipt, One Review** 정책을 적용한다.

```ts
Receipt {
  _id: ObjectId,

  userId: ObjectId,

  imageUrl: string,
  imageDeletedAt?: Date,

  ocrProvider: 'FAKE' | 'CLOVA' | 'GOOGLE_VISION',

  ocrRawText?: string,
  ocrRawTextDeletedAt?: Date,

  parsed: {
    purchasedAt?: Date,        // stored as UTC Date, interpreted in Asia/Seoul for matching
    cafeteriaName?: string,
    mealNames?: string[],
    totalPrice?: number
  },

  matchedMenuServingIds: ObjectId[],

  status: 'UPLOADED' | 'OCR_PROCESSING' | 'NEED_CONFIRMATION' | 'VERIFIED' | 'REJECTED' | 'USED',

  rejectReason?: string,

  confirmedMenuServingId?: ObjectId,

  usedForReview: boolean,
  reviewId?: ObjectId,

  createdAt: Date,
  updatedAt: Date
}
```

#### 인덱스

```ts
receipts.createIndex({ userId: 1, createdAt: -1 })
receipts.createIndex({ status: 1 })
receipts.createIndex({ reviewId: 1 }, { unique: true, sparse: true })
receipts.createIndex({ confirmedMenuServingId: 1 })
```

---

### 1.7 `reviews`

검증된 리뷰와 매니저 답변을 저장한다.

```ts
Review {
  _id: ObjectId,

  userId: ObjectId,
  mealId: ObjectId,
  menuServingId: ObjectId,
  cafeteriaId: ObjectId,

  receiptId: ObjectId,

  isVerified: boolean,

  rating: number,              // 1~5

  detailRatings: {
    taste: number,             // 1~5
    price: number,             // 1~5
    portion: number            // 1~5
  },

  content?: string,

  managerReply?: {
    managerId: ObjectId,
    content: string,
    repliedAt: Date,
    updatedAt?: Date
  },

  deletedAt?: Date,
  deletedBy?: ObjectId,
  deleteReason?: string,

  createdAt: Date,
  updatedAt: Date
}
```

#### 인덱스

```ts
reviews.createIndex({ menuServingId: 1, createdAt: -1 })
reviews.createIndex({ mealId: 1, createdAt: -1 })
reviews.createIndex({ cafeteriaId: 1, createdAt: -1 })
reviews.createIndex({ userId: 1, createdAt: -1 })
reviews.createIndex({ receiptId: 1 }, { unique: true })
reviews.createIndex({ deletedAt: 1 })
```

---

### 1.8 `favorites`

즐겨찾기 기능에 쓰는 컬렉션이다.

```ts
Favorite {
  _id: ObjectId,

  userId: ObjectId,
  mealId: ObjectId,

  createdAt: Date
}
```

#### 인덱스

```ts
favorites.createIndex({ userId: 1, mealId: 1 }, { unique: true })
```

---

### 1.9 `view_histories`

최근 본 메뉴, 히스토리 기능에 쓰는 컬렉션이다.

```ts
ViewHistory {
  _id: ObjectId,

  userId: ObjectId,
  mealId: ObjectId,
  menuServingId?: ObjectId,

  viewedAt: Date
}
```

#### 인덱스

```ts
view_histories.createIndex({ userId: 1, viewedAt: -1 })
```

---

### 1.10 `cafeteria_managers`

매니저가 관리할 식당과 권한을 저장한다. `users.role = 'MANAGER'`는 사용자 유형만 나타낸다. 실제 관리 범위는 이 컬렉션으로 판단한다.

```ts
CafeteriaManager {
  _id: ObjectId,

  userId: ObjectId,            // manager user id
  cafeteriaId: ObjectId,

  managerRole: 'OWNER' | 'STAFF',
  permissions: (
    | 'MENU_WRITE'
    | 'STATUS_WRITE'
    | 'REVIEW_REPLY'
    | 'ANALYTICS_READ'
  )[],

  isActive: boolean,

  assignedBy: ObjectId,        // admin user id

  createdAt: Date,
  updatedAt: Date
}
```

#### 인덱스

```ts
cafeteria_managers.createIndex({ userId: 1, cafeteriaId: 1 }, { unique: true })
cafeteria_managers.createIndex({ cafeteriaId: 1, isActive: 1 })
cafeteria_managers.createIndex({ userId: 1, isActive: 1 })
```

#### 규칙

```txt
- ADMIN은 모든 식당을 관리한다.
- MANAGER는 cafeteria_managers에 isActive=true로 매핑된 식당만 관리한다.
- 매니저 권한 확인은 role뿐 아니라 cafeteriaId 매핑과 permissions를 함께 검사한다.
- 식당 생성 및 매니저 배정은 ADMIN만 수행한다.
```

---

## 2. 핵심 관계

```txt
User 1 ─ N Review
User 1 ─ N Receipt
User 1 ─ N Favorite
User 1 ─ N ViewHistory
User 1 ─ N CafeteriaManager

Cafeteria 1 ─ N MenuServing
Cafeteria 1 ─ N CafeteriaManager
Meal 1 ─ N MenuServing

MenuServing 1 ─ N Review
Receipt 1 ─ 1 Review

Review N ─ 1 Meal
Review N ─ 1 Cafeteria
Review N ─ 1 MenuServing
```

이 설계의 핵심 비즈니스 규칙은 다음 한 줄이다.

```txt
1 Receipt = 1 Review
```

이 규칙은 `reviews.receiptId`의 unique index로 보장한다.
리뷰를 만들 때는 receipt 상태 변경과 review 생성을 하나의 transaction 또는 조건부 atomic update로 묶는다.
리뷰가 삭제되어도 영수증은 다시 쓰지 않는다. receipt.status는 `USED`, usedForReview는 `true`로 유지한다.

---

## 2.1 개인정보 및 민감정보 보관 정책

```txt
- allergy profile은 민감 건강 정보로 취급하며 본인 프로필 조회와 내부 필터링에만 사용한다.
- 다른 사용자, 매니저, 공개 API 응답에는 개별 사용자의 allergy profile을 노출하지 않는다.
- receipt.imageUrl은 public URL이 아니라 private object storage key 또는 signed URL 기반으로 관리한다.
- receipt.ocrRawText는 검증/디버깅에 필요한 최소 기간만 보관한다.
- MVP에서는 receipt image와 ocrRawText를 생성일 기준 최대 30일 보관 후 삭제 또는 마스킹하는 정책을 기본값으로 둔다.
- 리뷰가 생성된 뒤에도 One Receipt, One Review 증명을 위해 receiptId, parsed summary, status, reviewId는 유지한다.
- 모든 개인정보 및 영수증 관련 데이터는 HTTPS로 전송하고, 배포 환경에서는 DB/storage encryption at rest를 전제로 한다.
```

---

## 3. API 공통 규칙

### 기준 경로

```txt
/api
```

아래 엔드포인트는 이 기준 경로 뒤에 붙는 값이다. 예를 들어 `POST /auth/login`의 실제 경로는 `POST /api/auth/login`이다.

### 인증 방식

```txt
Authorization: Bearer <accessToken>
```

### 역할

```txt
USER     일반 사용자
MANAGER  식당 관리자
ADMIN    전체 관리자
```

### 이메일 인증 전 접근 정책

```txt
- 이메일 미인증 사용자도 로그인은 된다. 다만 메뉴 조회 기능만 열린다.
- 이메일 미인증 사용자가 허용되는 API:
  - GET /cafeterias
  - GET /cafeterias/:cafeteriaId
  - GET /meals
  - GET /meals/:mealId
  - GET /menu-servings
  - GET /menu-servings/:menuServingId
- 이메일 미인증 사용자에게는 프로필 수정, 즐겨찾기, 영수증 업로드, 리뷰 작성, 매니저 기능, 관리자 기능을 열지 않는다.
- 이메일 인증이 필요한 API는 Auth Guard를 지난 뒤 EmailVerified Guard를 통과한다.
```

### 날짜와 시간대

```txt
- 서비스의 기준 시간대는 Asia/Seoul이다.
- MenuServing.date는 Asia/Seoul 기준 로컬 날짜 문자열(YYYY-MM-DD)로 저장한다.
- Receipt.parsed.purchasedAt, createdAt, updatedAt 등 Date 타입은 UTC Date로 저장한다.
- 영수증과 메뉴 판매 정보 매칭, 주간 추천 from/to 계산은 Asia/Seoul 기준 날짜로 변환해서 수행한다.
- from/to 쿼리의 날짜 범위는 기본적으로 inclusive로 처리한다.
```

### 매니저 권한 검사

```txt
- ADMIN은 모든 식당 리소스에 접근한다.
- MANAGER는 cafeteria_managers에 isActive=true로 등록된 cafeteriaId에서만 수정, 답변, 통계 조회를 수행한다.
- MENU_WRITE: Meal/MenuServing 생성 및 수정
- STATUS_WRITE: 품절 상태 변경
- REVIEW_REPLY: 리뷰 답변 작성/수정
- ANALYTICS_READ: 담당 식당 통계 조회
```

### 공통 성공 응답

```json
{
  "success": true,
  "data": {},
  "message": "OK"
}
```

### 공통 에러 응답

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body"
  }
}
```

---

## 4. API 명세

## 4.1 인증 API

### 회원가입

```http
POST /auth/register
```

#### 요청

```json
{
  "email": "student@kaist.ac.kr",
  "password": "password1234",
  "nickname": "Jae"
}
```

#### 응답

```json
{
  "success": true,
  "data": {
    "userId": "665f...",
    "email": "student@kaist.ac.kr",
    "isEmailVerified": false,
    "emailDelivery": {
      "mode": "LOCAL_FALLBACK",
      "sent": false
    },
    "localVerification": {
      "token": "local-email-verify-token",
      "email": "student@kaist.ac.kr",
      "verificationLink": "http://localhost/verify-email?token=local-email-verify-token&email=student%40kaist.ac.kr"
    }
  },
  "message": "Verification email sent"
}
```

#### 규칙

```txt
- email은 kaist.ac.kr 도메인만 허용
- password는 hash 후 저장
- 가입 직후 이메일 인증 토큰 발송
- SMTP env가 설정되지 않은 local/dev 환경에서는 고정 인증 토큰과 확인 링크를 응답에 포함한다.
- local/dev 고정 인증 토큰은 email과 함께 검증하며, DB에는 userId scoped hash로 저장한다.
```

---

### 이메일 인증

```http
GET /auth/verify-email?token=...
```

SMTP env가 설정되지 않은 local/dev 환경의 고정 토큰은 email 식별자를 함께 전달한다.

```http
GET /auth/verify-email?token=local-email-verify-token&email=student@kaist.ac.kr
```

#### 응답

```json
{
  "success": true,
  "data": {
    "isEmailVerified": true
  },
  "message": "Email verified"
}
```

---

### 비밀번호 재설정 요청

```http
POST /auth/password-reset/request
```

#### 요청

```json
{
  "email": "student@kaist.ac.kr"
}
```

#### 응답

```json
{
  "success": true,
  "data": {
    "resetRequested": true,
    "emailDelivery": {
      "mode": "LOCAL_FALLBACK",
      "sent": false
    },
    "localPasswordReset": {
      "password": "UnieatsReset123!",
      "resetLink": "http://localhost/reset-password?token=local-password-reset-token&email=student%40kaist.ac.kr"
    }
  },
  "message": "Password reset instructions processed"
}
```

#### 규칙

```txt
- 존재하지 않는 이메일이어도 동일한 성공 응답을 반환해 계정 존재 여부를 노출하지 않는다.
- SMTP env가 설정되지 않은 local/dev 환경에서는 고정 비밀번호로 즉시 초기화한다.
- 비밀번호 초기화 시 기존 refresh token은 usedAt을 설정해 폐기한다.
```

### 비밀번호 재설정 확인

```http
POST /auth/password-reset/confirm
```

#### 요청

```json
{
  "token": "password-reset-token",
  "email": "student@kaist.ac.kr",
  "newPassword": "new-password1234"
}
```

#### 규칙

```txt
- SMTP env가 설정된 환경에서는 email 없이 token만으로 reset token을 검증한다.
- SMTP env가 설정되지 않은 local/dev 환경의 고정 토큰은 email과 함께 검증한다.
- 사용되었거나 만료된 reset token은 거부한다.
```

---

### 로그인

```http
POST /auth/login
```

#### 요청

```json
{
  "email": "student@kaist.ac.kr",
  "password": "password1234"
}
```

#### 응답

```json
{
  "success": true,
  "data": {
    "accessToken": "jwt-access-token",
    "refreshToken": "jwt-refresh-token",
    "user": {
      "id": "665f...",
      "email": "student@kaist.ac.kr",
      "nickname": "Jae",
      "role": "USER",
      "isEmailVerified": true
    }
  }
}
```

#### 규칙

```txt
- isEmailVerified=false인 사용자도 로그인은 허용한다.
- 다만 이메일 미인증 사용자는 메뉴 조회 API만 호출한다.
- refreshToken은 auth_tokens에 hash로 저장한다.
```

---

### Access Token 재발급

```http
POST /auth/refresh
```

#### 요청

```json
{
  "refreshToken": "jwt-refresh-token"
}
```

#### 응답

```json
{
  "success": true,
  "data": {
    "accessToken": "new-jwt-access-token",
    "refreshToken": "new-jwt-refresh-token"
  }
}
```

#### 규칙

```txt
- refreshToken은 원문 저장하지 않고 hash로 비교한다.
- refresh 성공 시 기존 refresh token은 usedAt을 설정해 폐기하고 새 refresh token을 발급한다.
- 만료되었거나 usedAt이 존재하는 refresh token은 거부한다.
```

---

### 로그아웃

```http
POST /auth/logout
```

#### 권한

```txt
USER, MANAGER, ADMIN
```

#### 요청

```json
{
  "refreshToken": "jwt-refresh-token"
}
```

#### 규칙

```txt
- 전달된 refreshToken의 hash를 찾아 usedAt을 설정한다.
- 로그아웃 후에는 해당 refreshToken으로 accessToken을 재발급하지 않는다.
```

---

### 내 정보 조회

```http
GET /auth/me
```

#### 권한

```txt
USER, MANAGER, ADMIN
```

---

## 4.2 사용자 API

### 내 프로필 조회

```http
GET /users/me
```

#### 응답

```json
{
  "success": true,
  "data": {
    "id": "665f...",
    "email": "student@kaist.ac.kr",
    "nickname": "Jae",
    "role": "USER",
    "dietaryProfile": {
      "allergies": ["EGG", "MILK"],
      "preferredIngredients": ["chicken"],
      "dislikedIngredients": ["onion"],
      "dietaryLabels": ["HALAL"]
    },
    "reviewStats": {
      "verifiedReviewCount": 3
    }
  }
}
```

---

### 내 프로필 수정

```http
PATCH /users/me
```

#### 요청

```json
{
  "nickname": "Jae",
  "dietaryProfile": {
    "allergies": ["EGG", "MILK"],
    "preferredIngredients": ["chicken"],
    "dislikedIngredients": ["onion"],
    "dietaryLabels": ["HALAL"]
  }
}
```

---

### 내 리뷰 목록

```http
GET /users/me/reviews?page=1&limit=20
```

---

### 즐겨찾기 추가

```http
POST /users/me/favorites
```

#### 요청

```json
{
  "mealId": "665f..."
}
```

---

### 즐겨찾기 삭제

```http
DELETE /users/me/favorites/:mealId
```

---

## 4.3 식당 API

### 식당 목록 조회

```http
GET /cafeterias
```

#### 응답

```json
{
  "success": true,
  "data": [
    {
      "id": "665f...",
      "name": "Kaimaru",
      "location": {
        "building": "N11",
        "floor": "1F",
        "lat": 36.0,
        "lng": 127.0
      },
      "openingHours": {
        "monday": [
          {
            "open": "11:30",
            "close": "13:00"
          }
        ]
      }
    }
  ]
}
```

### 식당 상세 조회

```http
GET /cafeterias/:cafeteriaId
```

---

### 식당 생성

```http
POST /cafeterias
```

#### 권한

```txt
ADMIN
```

#### 요청

```json
{
  "name": "Kaimaru",
  "description": "KAIST cafeteria",
  "location": {
    "building": "N11",
    "floor": "1F",
    "lat": 36.0,
    "lng": 127.0
  },
  "openingHours": {
    "monday": [
      {
        "open": "11:30",
        "close": "13:00"
      }
    ]
  }
}
```

---

### 식당 매니저 목록 조회

```http
GET /cafeterias/:cafeteriaId/managers
```

#### 권한

```txt
ADMIN
```

---

### 식당 매니저 배정

```http
POST /cafeterias/:cafeteriaId/managers
```

#### 권한

```txt
ADMIN
```

#### 요청

```json
{
  "userId": "665f...",
  "managerRole": "STAFF",
  "permissions": ["MENU_WRITE", "STATUS_WRITE", "REVIEW_REPLY"]
}
```

#### 규칙

```txt
- userId는 role=MANAGER인 사용자여야 한다.
- 같은 userId와 cafeteriaId 조합은 중복 생성하지 않는다.
- 기존 매핑이 있으면 PATCH로 isActive 또는 permissions를 수정한다.
```

---

### 식당 매니저 권한 수정

```http
PATCH /cafeterias/:cafeteriaId/managers/:userId
```

#### 권한

```txt
ADMIN
```

#### 요청

```json
{
  "managerRole": "OWNER",
  "permissions": ["MENU_WRITE", "STATUS_WRITE", "REVIEW_REPLY", "ANALYTICS_READ"],
  "isActive": true
}
```

---

## 4.4 음식 API

### 음식 원본 목록 조회

```http
GET /meals?q=mackerel&category=KOREAN&dietaryLabel=NO_BEEF&page=1&limit=20
```

---

### 음식 원본 상세 조회

```http
GET /meals/:mealId
```

---

### 음식 원본 생성

```http
POST /meals
```

#### 권한

```txt
MANAGER, ADMIN
```

#### 규칙

```txt
- ADMIN은 모든 음식 원본을 생성한다.
- MANAGER는 cafeteria_managers에 활성 매핑이 하나 이상 있고 MENU_WRITE 권한이 있을 때만 생성한다.
```

#### 요청

```json
{
  "name": "Mackerel Set",
  "description": "Grilled mackerel set",
  "category": "KOREAN",
  "imageUrl": "https://...",
  "ingredients": ["mackerel", "rice", "kimchi"],
  "allergens": ["MACKEREL"],
  "dietaryLabels": ["NO_BEEF"],
  "nutrition": {
    "calories": 430,
    "carbohydrate": 20,
    "protein": 35,
    "fat": 18,
    "sodium": 700
  }
}
```

---

### 음식 원본 수정

```http
PATCH /meals/:mealId
```

#### 권한

```txt
MANAGER, ADMIN
```

#### 규칙

```txt
- ADMIN은 모든 음식 원본을 수정한다.
- MANAGER는 본인이 만든 음식 원본이나 담당 식당의 MenuServing에 연결된 음식 원본만 수정한다.
```

---

## 4.5 메뉴 판매 API

대시보드와 검색 페이지가 주로 호출하는 핵심 API다.

### 오늘 / 주간 메뉴 조회

```http
GET /menu-servings?date=2026-04-08&cafeteriaId=665f...&category=KOREAN&mealTime=LUNCH&q=mackerel&hideAllergyConflicts=true&page=1&limit=20
```

#### 권한

```txt
Optional
```

로그인한 사용자가 `hideAllergyConflicts=true`를 보내면 해당 사용자의 알레르기 정보를 적용한다.

#### 응답

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "menuServingId",
        "date": "2026-04-08",
        "mealTime": "LUNCH",
        "price": 4900,
        "status": "AVAILABLE",
        "averageRating": 4.5,
        "verifiedReviewCount": 12,
        "cafeteria": {
          "id": "cafeteriaId",
          "name": "Kaimaru"
        },
        "meal": {
          "id": "mealId",
          "name": "Mackerel Set",
          "category": "KOREAN",
          "imageUrl": "https://...",
          "ingredients": ["mackerel", "rice"],
          "allergens": ["MACKEREL"],
          "dietaryLabels": ["NO_BEEF"]
        },
        "allergyWarning": {
          "hasConflict": true,
          "matchedAllergens": ["MACKEREL"]
        }
      }
    ],
    "page": 1,
    "limit": 20,
    "total": 1
  }
}
```

---

### 메뉴 판매 정보 상세 조회

```http
GET /menu-servings/:menuServingId
```

---

### 메뉴 판매 정보 생성

```http
POST /menu-servings
```

#### 권한

```txt
MANAGER, ADMIN
```

#### 규칙

```txt
- ADMIN은 모든 식당에 MenuServing을 생성한다.
- MANAGER는 요청한 cafeteriaId의 cafeteria_managers 매핑이 isActive=true이고 MENU_WRITE 권한이 있어야 한다.
- 같은 date, cafeteriaId, mealTime, mealId 조합은 중복 생성하지 않는다.
- 중복 생성 요청은 409 CONFLICT로 응답한다.
```

#### 요청

```json
{
  "mealId": "665f...",
  "cafeteriaId": "665f...",
  "date": "2026-04-08",
  "mealTime": "LUNCH",
  "price": 4900,
  "status": "AVAILABLE",
  "stock": 100
}
```

---

### 품절 처리

```http
PATCH /menu-servings/:menuServingId/status
```

#### 권한

```txt
MANAGER, ADMIN
```

#### 요청

```json
{
  "status": "SOLD_OUT"
}
```

#### 규칙

```txt
- ADMIN은 모든 MenuServing 상태를 수정한다.
- MANAGER는 해당 MenuServing의 cafeteriaId에서 cafeteria_managers 매핑이 isActive=true이고 STATUS_WRITE 권한이 있어야 한다.
- 상태 변경 성공 시 서버는 실시간 상태 변경 이벤트를 발행한다.
```

---

### 메뉴 판매 상태 실시간 구독

```http
GET /menu-servings/events
Accept: text/event-stream
```

#### 이벤트

```txt
event: menu-serving-status-updated
data: {"menuServingId":"665f...","status":"SOLD_OUT","updatedAt":"2026-04-08T03:10:00.000Z"}
```

#### 규칙

```txt
- 공개 메뉴 상태만 전송한다. 사용자, 매니저, 권한 정보는 이벤트 payload에 포함하지 않는다.
- 프론트엔드는 이 이벤트를 수신하면 현재 화면에 표시 중인 MenuServing의 status를 즉시 갱신한다.
- 연결 유지를 위해 heartbeat 이벤트를 주기적으로 보낼 수 있다.
```

---

## 4.6 영수증 API

### 영수증 업로드

```http
POST /receipts/upload
```

#### 권한

```txt
USER
```

#### 콘텐츠 타입

```txt
multipart/form-data
```

#### 폼 데이터

```txt
image: receipt image
```

업로드 성공 시 백엔드는 먼저 receipt document를 생성하고 `OCR_PROCESSING` 상태를 반환한다.
프론트엔드는 `GET /receipts/:receiptId`를 주기적으로 호출해서 OCR 완료 여부를 확인한다.

#### 응답

```json
{
  "success": true,
  "data": {
    "id": "665f...",
    "status": "OCR_PROCESSING",
    "parsed": {},
    "matchedMenuServings": []
  }
}
```

---

### 영수증 검증 결과 조회

```http
GET /receipts/:receiptId
```

#### 권한

```txt
USER
```

#### 응답 상태

```txt
OCR_PROCESSING: OCR 처리 중이다. 프론트엔드는 일정 간격으로 다시 조회한다.
NEED_CONFIRMATION: OCR 처리가 끝났고 사용자의 메뉴 확인이 필요하다.
REJECTED: OCR 실패, 중복 영수증 등으로 검증할 수 없다.
VERIFIED: 사용자가 매칭된 메뉴를 확인했다.
USED: 리뷰 작성에 이미 사용된 영수증이다.
```

---

### OCR webhook

OCR provider가 처리 결과를 백엔드에 업로드하는 내부 API다.

```http
POST /receipts/webhook
```

#### 헤더

```txt
X-OCR-Webhook-Secret: configured OCR_WEBHOOK_SECRET
```

#### 요청

```json
{
  "receiptId": "665f...",
  "rawText": "..."
}
```

실패 시에는 아래 형태로 전달한다.

```json
{
  "receiptId": "665f...",
  "error": "OCR processing failed"
}
```

#### 규칙

- 이 API는 사용자 클라이언트에서 직접 호출하지 않는다.
- `OCR_WEBHOOK_SECRET`이 일치하지 않으면 처리하지 않는다.
- `OCR_PROCESSING` 상태인 receipt만 webhook 결과로 갱신할 수 있다.

---

### 영수증 확인

OCR 결과를 사용자가 확인하는 단계다.

```http
POST /receipts/:receiptId/confirm
```

#### 권한

```txt
USER
```

#### 요청

```json
{
  "confirmedMenuServingId": "665f..."
}
```

#### 응답

```json
{
  "success": true,
  "data": {
    "receiptId": "665f...",
    "status": "VERIFIED",
    "confirmedMenuServingId": "665f..."
  }
}
```

#### 규칙

```txt
- receipt.userId는 현재 로그인 사용자와 같아야 한다.
- receipt.status는 NEED_CONFIRMATION이어야 한다.
- confirmedMenuServingId는 matchedMenuServingIds 안에 있어야 한다.
- 이미 usedForReview=true이면 다시 쓰지 않는다.
```

---

## 4.7 리뷰 API

### 특정 메뉴의 리뷰 목록 조회

```http
GET /menu-servings/:menuServingId/reviews?page=1&limit=20&sort=latest
```

#### 규칙

```txt
- deletedAt=null인 리뷰만 반환한다.
```

---

### 리뷰 작성

```http
POST /menu-servings/:menuServingId/reviews
```

#### 권한

```txt
USER
```

#### 요청

```json
{
  "receiptId": "665f...",
  "rating": 5,
  "detailRatings": {
    "taste": 5,
    "price": 4,
    "portion": 4
  },
  "content": "Fresh and good portion."
}
```

#### 응답

```json
{
  "success": true,
  "data": {
    "reviewId": "665f...",
    "isVerified": true,
    "rating": 5
  }
}
```

#### 규칙

```txt
- receipt.status는 VERIFIED여야 한다.
- receipt.userId는 현재 로그인 사용자와 같아야 한다.
- receipt.confirmedMenuServingId와 URL의 menuServingId가 같아야 한다.
- receipt.usedForReview=false여야 한다.
- 리뷰 생성, receipt.usedForReview=true/status=USED 변경, MenuServing 평균 갱신은 하나의 MongoDB transaction으로 처리
- transaction을 사용하지 못하는 환경에서는 receipt를 조건부 update({_id, status: VERIFIED, usedForReview: false})로 먼저 잠그고 실패 시 409 CONFLICT 반환
- 리뷰 생성 후 MenuServing.averageRating, verifiedReviewCount 업데이트
```

---

### 리뷰 삭제

```http
DELETE /reviews/:reviewId
```

#### 권한

```txt
USER, ADMIN
```

#### 규칙

```txt
- USER는 자기 리뷰만 삭제한다.
- 리뷰 삭제는 hard delete가 아니라 deletedAt을 설정하는 soft delete로 처리한다.
- 연결된 receipt는 계속 status=USED, usedForReview=true, reviewId를 유지한다.
- 삭제된 리뷰의 receipt로는 다시 리뷰를 작성하지 못한다.
- 삭제 후 평균 평점과 verifiedReviewCount는 deletedAt=null인 리뷰만 기준으로 재계산한다.
```

---

### 매니저 답변 작성 / 수정

```http
POST /reviews/:reviewId/reply
```

#### 권한

```txt
MANAGER, ADMIN
```

#### 규칙

```txt
- ADMIN은 모든 리뷰에 답변한다.
- MANAGER는 해당 review.cafeteriaId에서 cafeteria_managers 매핑이 isActive=true이고 REVIEW_REPLY 권한이 있어야 한다.
- 삭제된 리뷰에는 답변을 작성하거나 수정하지 않는다.
```

#### 요청

```json
{
  "content": "Thank you for your feedback. We will improve the portion size."
}
```

---

## 4.8 추천/통계 API

### 주간 추천 메뉴 조회

```http
GET /recommendations/weekly-best?from=2026-04-01&to=2026-04-08&limit=10
```

#### 응답

```json
{
  "success": true,
  "data": [
    {
      "menuServingId": "665f...",
      "mealName": "Mackerel Set",
      "cafeteriaName": "Kaimaru",
      "averageRating": 4.7,
      "verifiedReviewCount": 18,
      "positiveReviewCount": 15,
      "score": 13.58
    }
  ]
}
```

#### 추천 점수 예시

```txt
positiveReviewCount = rating >= 3인 검증 리뷰 수
score = averageRating * log(min(positiveReviewCount, 50) + 1)
```

단순 평균만 쓰면 리뷰 1개짜리 5점 메뉴가 1등으로 올라가는 문제가 생긴다.
그래서 긍정 리뷰 수를 함께 반영하되, 50개 이상부터는 리뷰 수 가중치가 더 커지지 않도록 상한을 둔다.
`from`, `to`는 리뷰 작성일(`reviews.createdAt`) 기준으로 적용하며, 값이 없으면 Asia/Seoul 기준 최근 7일을 사용한다.

---

### 식당 랭킹 조회

```http
GET /analytics/cafeteria-ranking?from=2026-04-01&to=2026-04-08&limit=10
```

#### 권한

```txt
USER, MANAGER, ADMIN
```

#### 응답

```json
{
  "success": true,
  "data": [
    {
      "cafeteriaId": "665f...",
      "cafeteriaName": "Kaimaru",
      "averageRating": 4.4,
      "verifiedReviewCount": 56,
      "positiveReviewCount": 48,
      "rank": 1
    }
  ]
}
```

#### 랭킹 규칙

식당 랭킹도 같은 기간 필터와 긍정 리뷰 가중치를 사용한다.
평균 별점은 해당 기간의 검증 리뷰 평균이며, 정렬 점수는 아래 기준으로 계산한다.

```txt
positiveReviewCount = rating >= 3인 검증 리뷰 수
score = averageRating * log(min(positiveReviewCount, 50) + 1)
```

---

## 5. NestJS 모듈 구조 추천

```txt
src/
  auth/
    auth.controller.ts
    auth.service.ts
    jwt.strategy.ts
    roles.guard.ts

  users/
    users.controller.ts
    users.service.ts
    schemas/user.schema.ts

  cafeterias/
    cafeterias.controller.ts
    cafeterias.service.ts
    schemas/cafeteria.schema.ts

  cafeteria-managers/
    cafeteria-managers.controller.ts
    cafeteria-managers.service.ts
    schemas/cafeteria-manager.schema.ts

  meals/
    meals.controller.ts
    meals.service.ts
    schemas/meal.schema.ts

  menu-servings/
    menu-servings.controller.ts
    menu-servings.service.ts
    schemas/menu-serving.schema.ts

  receipts/
    receipts.controller.ts
    receipts.service.ts
    ocr/
      ocr.provider.ts
      fake-ocr.provider.ts
      clova-ocr.provider.ts
    schemas/receipt.schema.ts

  reviews/
    reviews.controller.ts
    reviews.service.ts
    schemas/review.schema.ts

  recommendations/
    recommendations.controller.ts
    recommendations.service.ts

  analytics/
    analytics.controller.ts
    analytics.service.ts

  common/
    decorators/
    guards/
    filters/
    interceptors/
```

---

## 6. 초기 구현 순서

```txt
1. User / Auth schema + API
2. Cafeteria / CafeteriaManager schema + API
3. Meal / MenuServing schema + API
4. Dashboard 메뉴 조회 API
5. Review schema + 리뷰 작성 API
6. Receipt schema + Fake OCR API
7. Receipt 검증 후 리뷰 작성 연결
8. Manager 답변 API
9. Weekly Best / Ranking API
```

초기 구현에서는 실제 OCR을 바로 붙이지 않고 `FakeOcrProvider`로 시작한다.  
그러면 프론트엔드는 영수증 업로드 플로우를 먼저 완성하고, 이후 Clova OCR 또는 Google Vision OCR provider만 교체하면 된다.

---

## 7. MVP 체크리스트

### 1차 MVP

- [ ] 회원가입
- [ ] 로그인
- [ ] KAIST 이메일 도메인 검증
- [ ] 식당 목록 조회
- [ ] 메뉴 목록 조회
- [ ] 메뉴 상세 조회
- [ ] 관리자 식당 생성 및 식당-매니저 매핑
- [ ] 매니저 메뉴 등록
- [ ] 매니저 품절 처리
- [ ] 리뷰 작성
- [ ] 평균 평점 계산

### 2차 MVP

- [ ] 영수증 이미지 업로드
- [ ] Fake OCR 결과 반환
- [ ] 영수증 확인
- [ ] 검증된 영수증으로 리뷰 작성
- [ ] One Receipt, One Review 강제

### 3차 MVP

- [ ] 실제 OCR API 연동
- [ ] 알레르기 기반 필터링
- [ ] My Review 페이지
- [ ] 매니저 답변
- [ ] Weekly Best 추천
- [ ] 식당 랭킹
- [ ] 지도 페이지

---

## 8. 프론트엔드와 백엔드 병렬 작업 기준

프론트엔드는 API 구현을 기다리지 않고 mock response를 기준으로 아래 페이지부터 개발한다.

```txt
/login
/register
/dashboard
/search
/meals/[mealId]
/meals/[mealId]/reviews
/receipt
/my
/my/reviews
/manager
```

백엔드는 Swagger 문서를 프론트엔드와의 계약으로 유지한다.

권장 경로:

```txt
/api-docs
```

---

## 9. 팀원 역할 분담 예시

### 프론트엔드 담당

- Next.js 라우팅
- Dashboard / Search / Meal Detail
- Review UI
- My Page
- 반응형 모바일 UI

### 백엔드 담당

- NestJS 프로젝트 구조
- MongoDB / Mongoose schema
- Auth / User / Meal / MenuServing API
- Swagger 문서화

### 통합 담당

- Receipt upload
- OCR provider 구조
- Manager API
- Recommendation / Analytics API
- 배포, 테스트, seed data

---

## 10. 개발 시작 시 바로 만들 파일

```txt
apps/backend/src/auth/
apps/backend/src/users/
apps/backend/src/cafeterias/
apps/backend/src/cafeteria-managers/
apps/backend/src/meals/
apps/backend/src/menu-servings/
apps/backend/src/reviews/
apps/backend/src/receipts/
apps/backend/src/recommendations/
apps/backend/src/analytics/
apps/backend/src/common/

apps/frontend/app/login/
apps/frontend/app/register/
apps/frontend/app/dashboard/
apps/frontend/app/search/
apps/frontend/app/meals/[mealId]/
apps/frontend/app/receipt/
apps/frontend/app/my/
apps/frontend/app/manager/
```

---

## 11. 핵심 설계 포인트

1. `Meal`과 `MenuServing`을 분리한다.
   - `Meal`: 음식 자체의 정보
   - `MenuServing`: 특정 날짜 / 식당 / 시간대에 판매되는 정보

2. 리뷰는 `MenuServing`에 연결한다.
   - 같은 음식이라도 날짜, 식당, 가격, 품질이 다를 수 있기 때문이다.

3. 영수증은 리뷰와 1:1 관계로 둔다.
   - `reviews.receiptId`에 unique index를 걸어 조작을 막는다.
   - 리뷰 삭제 후에도 영수증을 재사용하지 않도록 `USED` 상태를 유지한다.

4. 매니저 권한은 식당별 매핑으로 판단한다.
   - `users.role=MANAGER`만으로는 수정 권한을 주지 않는다.
   - `cafeteria_managers`의 cafeteriaId와 permissions를 함께 확인한다.

5. OCR은 provider interface로 감싼다.
   - 처음에는 `FakeOcrProvider`
   - 이후 `ClovaOcrProvider` 또는 `GoogleVisionOcrProvider`로 교체

6. 알레르기 정보는 민감 정보이므로 서버 응답에서 불필요하게 노출하지 않는다.

7. 추천 시스템은 단순한 점수식으로 시작한다.
   - `averageRating * log(verifiedReviewCount + 1)` 정도로 시작한다.
