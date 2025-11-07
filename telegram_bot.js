// 이 파일은 GitHub Actions 환경에서 Node.js 런타임으로 실행됩니다.
// [수정됨] 1. 초기 스캔 기능 추가
// [수정됨] 2. 이후 새 글 감지 시뮬레이션 기능 추가

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
if (!process.env.FIREBASE_CREDENTIALS) {
    console.error("FIREBASE_CREDENTIALS 환경 변수가 설정되지 않았습니다. 스크립트를 종료합니다.");
    process.exit(1);
}

try {
    const serviceAccountJson = Buffer.from(process.env.FIREBASE_CREDENTIALS, 'base64').toString('utf-8');
    const serviceAccount = JSON.parse(serviceAccountJson);

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
} catch (error) {
    console.error("Firebase Admin 초기화 오류:", error.message);
    process.exit(1);
}

const db = admin.firestore();

// --- 알림 발송 함수 ---

/**
 * 텔레그램으로 알림 메시지를 발송합니다. (알림 타입 추가)
 * @param {string} chatId - 알림을 받을 사용자의 Chat ID
 * @param {string} url - 감지된 게시판 주소
 * @param {string} keyword - 감지된 키워드
 * @param {string} type - 'initial' (초기 스캔) 또는 'new' (새 글)
 * @param {number} count - (초기 스캔 시) 발견된 게시글 수 (시뮬레이션)
 */
async function sendTelegramNotification(chatId, url, keyword, type = 'new', count = 0) {
    if (!TELEGRAM_BOT_TOKEN) {
        console.log(`[PASS] 텔레그램 토큰 없음. Chat ID ${chatId} 알림 건너뜀.`);
        return;
    }

    let messageText = '';

    if (type === 'initial') {
        // [신규] 초기 스캔 완료 메시지
        messageText = `
*✅ 초기 스캔 완료*
---------------------------------
'${keyword}' 키워드로 '${url}'을(를) 스캔했습니다.

*최근 2개월간 ${count}개의 관련 글을 찾았습니다.* (시뮬레이션)

이제부터 이 게시판에서 해당 키워드의 새 글이 올라오면 알려드립니다.
`;
    } else {
        // [기존] 새 글 발견 메시지
        messageText = `
*🔔 새로운 게시글이 올라옴!*
---------------------------------
[알림] '${keyword}' 키워드가 감지되었습니다.

게시판 주소: ${url}

해당 링크를 확인해 보세요.
`;
    }
    
    try {
        await axios.post(TELEGRAM_API_URL, {
            chat_id: chatId,
            text: messageText,
            parse_mode: 'Markdown'
        });
        console.log(`[성공] Chat ID ${chatId}로 텔레그램 알림 전송 완료 (타입: ${type})`);
    } catch (error) {
        console.error(`[오류] 텔레그램 전송 실패 (Chat ID: ${chatId}):`, error.response ? error.response.data : error.message);
    }
}

/**
 * 이메일로 알림 메시지를 발송합니다. (시뮬레이션)
 */
async function sendEmailNotification(email, url, keyword, type = 'new', count = 0) {
    let emailSubject = '';
    let emailBody = '';

    if (type === 'initial') {
        emailSubject = `[키워드 알림] '${keyword}' 초기 스캔 완료`;
        emailBody = `최근 2개월간 ${count}개의 관련 글을 찾았습니다. (시뮬레이션)`;
    } else {
        emailSubject = `[키워드 알림] 새로운 게시글이 올라옴: ${url}`;
        emailBody = `새로운 게시글이 감지되었습니다. 게시판 주소: ${url}`;
    }

    console.log(`[시뮬레이션] 이메일 발송: To: ${email}, Subject: ${emailSubject}, Body: ${emailBody}`);
}

// --- 핵심 로직: 감지 및 알림 ---

async function runScraper() {
    // Canvas 환경의 __app_id가 아닌, 스크립트가 실행될 때 기본 ID 사용을 가정
    const appId = "default-app-id"; 
    console.log(`--- 키워드 감지 시작 (App ID: ${appId}) ---`);
    const colPath = `artifacts/${appId}/users`;
    let totalAlerts = 0;
    
    try {
        const usersRef = db.collection(colPath);
        const userDocs = await usersRef.listDocuments();

        for (const userDoc of userDocs) {
            const userId = userDoc.id;
            const configsRef = db.collection(`${colPath}/${userId}/scraper_configs`);
            const snapshot = await configsRef.get();
            
            if (snapshot.empty) {
                console.log(`[PASS] 사용자 ${userId}: 저장된 설정 없음.`);
                continue;
            }

            console.log(`[INFO] 사용자 ${userId}의 설정 ${snapshot.size}개를 확인합니다.`);

            for (const doc of snapshot.docs) {
                const config = doc.data();
                const { url, keyword, telegramId, email, lastInitialScrapeCompleted } = config;
                
                // --- 1. 실제 스크레이핑 로직이 들어갈 부분 ---
                // *주의: 실제 배포 시, 이 시뮬레이션 코드를 
                // puppeteer나 cheerio를 사용한 웹 크롤링 코드로 대체해야 합니다.*

                if (!lastInitialScrapeCompleted) {
                    // [신규] 1. 초기 스캔을 수행한 적이 없는 경우
                    console.log(`[INFO] 초기 스캔 수행: ${url} (키워드: ${keyword})`);
                    
                    // (시뮬레이션: '특별공급'이나 '맑은'이 포함된 경우 3~7개의 글을 찾았다고 가정)
                    let foundCount = 0;
                    if (keyword && (keyword.includes('특별공급') || keyword.includes('맑은'))) {
                        foundCount = Math.floor(Math.random() * 5) + 3; // 3~7개
                    }

                    if (foundCount > 0) {
                        if (telegramId) {
                            await sendTelegramNotification(telegramId, url, keyword, 'initial', foundCount);
                            totalAlerts++;
                        }
                        if (email) {
                            await sendEmailNotification(email, url, keyword, 'initial', foundCount);
                            totalAlerts++;
                        }
                    }
                    
                    // Firestore 문서를 업데이트하여 초기 스캔 완료로 표시
                    await doc.ref.update({ lastInitialScrapeCompleted: true });

                } else {
                    // [기존] 2. 이미 초기 스캔을 완료한 경우 (새 글 감시)
                    
                    // (시뮬레이션: 10% 확률로 새 글을 발견했다고 가정)
                    if (Math.random() < 0.1) {
                        console.log(`[INFO] 새 글 발견 (시뮬레이션): ${url} (키워드: ${keyword})`);
                        
                        if (telegramId) {
                            await sendTelegramNotification(telegramId, url, keyword, 'new');
                            totalAlerts++;
                        }
                        if (email) {
                            await sendEmailNotification(email, url, keyword, 'new');
                            totalAlerts++;
                        }
                    } else {
                         console.log(`[CHECK] 새 글 없음: ${url} (${keyword})`);
                    }
                }
                // --- ---------------------------------- ---
            }
        }
    } catch (error) {
        console.error("데이터 처리 중 심각한 오류 발생:", error.message);
    }
    
    console.log(`--- 키워드 감지 종료. 총 ${totalAlerts}건 알림 (텔레그램/이메일) 시도 완료. ---`);
}

// 스크립트 실행
runScraper();
