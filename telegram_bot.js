// 이 파일은 GitHub Actions 환경에서 Node.js 런타임으로 실행됩니다.
// 실제 웹사이트 크롤링 및 텔레그램/이메일 알림을 처리하는 서버 역할을 합니다.

// --- 환경 변수 설정 (GitHub Secrets에 저장되어야 함) ---
// 1. FIREBASE_CREDENTIALS: Firebase 서비스 계정 JSON (Base64 인코딩)
// 2. TELEGRAM_BOT_TOKEN: 텔레그램 봇 토큰
// *3. EMAIL_SERVICE_API_KEY: 실제 이메일 발송을 위한 API 키 (여기서는 시뮬레이션)

const admin = require('firebase-admin');
const axios = require('axios');

// 텔레그램 봇 API 설정
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

// --- Firebase Admin 초기화 ---
// FIREBASE_CREDENTIALS 환경 변수 검사
if (!process.env.FIREBASE_CREDENTIALS) {
    console.error("FIREBASE_CREDENTIALS 환경 변수가 설정되지 않았습니다. 스크립트를 종료합니다.");
    process.exit(1);
}

try {
    // Base64로 인코딩된 인증 정보를 디코딩하여 JSON으로 파싱
    const serviceAccountJson = Buffer.from(process.env.FIREBASE_CREDENTIALS, 'base64').toString('utf-8');
    const serviceAccount = JSON.parse(serviceAccountJson);

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
} catch (error) {
    // FIREBASE_CREDENTIALS의 JSON 형식이 잘못되었을 때 이 오류가 발생할 수 있습니다.
    console.error("Firebase Admin 초기화 오류:", error.message);
    process.exit(1);
}

const db = admin.firestore();

// --- 알림 발송 함수 ---

/**
 * 텔레그램으로 알림 메시지를 발송합니다.
 */
async function sendTelegramNotification(chatId, url) {
    if (!TELEGRAM_BOT_TOKEN) {
        console.log(`[PASS] 텔레그램 토큰 없음. Chat ID ${chatId} 알림 건너뜀.`);
        return;
    }

    const messageText = `
*새로운 게시글이 올라옴!*
---------------------------------
[알림] 요청하신 키워드가 감지되었습니다.

게시판 주소: ${url}

해당 링크를 확인해 보세요.
`;
    
    try {
        await axios.post(TELEGRAM_API_URL, {
            chat_id: chatId,
            text: messageText,
            parse_mode: 'Markdown'
        });
        console.log(`[성공] Chat ID ${chatId}로 텔레그램 알림 전송 완료: ${url}`);
    } catch (error) {
        // 텔레그램 ID가 잘못되었거나 봇이 사용자에게 차단되었을 때 이 오류가 발생할 수 있습니다.
        console.error(`[오류] 텔레그램 전송 실패 (Chat ID: ${chatId}):`, error.response ? error.response.data : error.message);
    }
}

/**
 * 이메일로 알림 메시지를 발송합니다. (실제로는 SendGrid/Mailgun API 연동 필요)
 */
async function sendEmailNotification(email, url) {
    // *실제 환경에서는 여기에 이메일 서비스 API 연동 코드가 들어갑니다.*
    // 현재는 GitHub Actions 로그에 출력하는 방식으로 시뮬레이션합니다.
    const emailSubject = `[키워드 알림] 새로운 게시글이 올라옴: ${url}`;
    const emailBody = `새로운 게시글이 감지되었습니다. 게시판 주소: ${url}`;

    console.log(`[시뮬레이션] 이메일 발송: To: ${email}, Subject: ${emailSubject}, Body: ${emailBody}`);
    // 실제 API 호출 예시: await sendGrid.send({ to: email, subject: emailSubject, html: emailBody });
}

// --- 핵심 로직: 감지 및 알림 ---

/**
 * Firestore에서 설정을 읽고 키워드 감지를 시뮬레이션합니다.
 * 실제 크롤링 코드가 여기에 들어갈 것입니다.
 */
async function runScraper() {
    // Canvas 환경의 __app_id가 아닌, 스크립트가 실행될 때 기본 ID 사용을 가정
    const appId = "default-app-id"; 
    console.log(`--- 키워드 감지 시작 (App ID: ${appId}) ---`);
    const colPath = `artifacts/${appId}/users`;
    let totalAlerts = 0;
    
    try {
        // 모든 사용자 폴더를 순회하여 설정을 가져옵니다.
        const usersRef = db.collection(colPath);
        const userDocs = await usersRef.listDocuments();

        for (const userDoc of userDocs) {
            const userId = userDoc.id;
            // 프론트엔드에서 데이터를 저장한 컬렉션 이름은 'scraper_configs'입니다.
            const configsRef = db.collection(`${colPath}/${userId}/scraper_configs`);
            const snapshot = await configsRef.get();
            
            if (snapshot.empty) {
                console.log(`[PASS] 사용자 ${userId}: 저장된 설정 없음.`);
                continue;
            }

            console.log(`[INFO] 사용자 ${userId}의 설정 ${snapshot.size}개를 확인합니다.`);

            for (const doc of snapshot.docs) {
                const config = doc.data();
                const { url, keyword, telegramId, email } = config;
                
                // --- 1. 실제 스크레이핑 로직이 들어갈 부분 ---
                let isKeywordFound = false;
                
                // *주의: 실제 배포 시, 이 시뮬레이션 코드를 
                // puppeteer나 cheerio를 사용한 웹 크롤링 코드로 대체해야 합니다.*

                // 현재는 시뮬레이션: 키워드에 "특별공급"이나 "맑은"이 포함된 경우 새 글이 발견되었다고 가정
                if (keyword && (keyword.includes('특별공급') || keyword.includes('맑은'))) {
                    isKeywordFound = true;
                }
                // --- ---------------------------------- ---


                if (isKeywordFound) {
                    // 키워드가 발견되었으므로 알림 발송
                    if (telegramId) {
                        await sendTelegramNotification(telegramId, url);
                        totalAlerts++;
                    }
                    if (email) {
                        await sendEmailNotification(email, url);
                        totalAlerts++;
                    }
                } else {
                    console.log(`[CHECK] ${url} (${keyword}): 새 글 없음.`);
                }
            }
        }
    } catch (error) {
        console.error("데이터 처리 중 심각한 오류 발생:", error.message);
    }
    
    console.log(`--- 키워드 감지 종료. 총 ${totalAlerts}건 알림 (텔레그램/이메일) 시도 완료. ---`);
}

// 스크립트 실행
runScraper();
