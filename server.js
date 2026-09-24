const express = require('express');
const mongoose = require('mongoose');

const app = express();
app.use(express.json());

// 1. LẤY BIẾN MÔI TRƯỜNG TỪ RENDER
const MONGO_URI = process.env.MONGO_URI;
const SCRIPT_URL = process.env.SCRIPT_URL;
const SERVER_URL = process.env.SERVER_URL; // Biến URL tự ping giữ server thức

if (!MONGO_URI) console.error("❌ LỖI: Chưa cài MONGO_URI!");
if (!SCRIPT_URL) console.error("❌ LỖI: Chưa cài SCRIPT_URL!");
if (!SERVER_URL) console.error("⚠️ CẢNH BÁO: Chưa cài SERVER_URL (Tính năng tự ping sẽ không chạy)!");

mongoose.connect(MONGO_URI)
    .then(async () => {
        console.log("✅ Đã kết nối MongoDB!");
        try {
            await KeyModel.syncIndexes();
            console.log("✅ Đã đồng bộ Index tự động xóa Key hết hạn!");
        } catch (idxErr) {
            console.error("⚠️ Lỗi đồng bộ Index:", idxErr.message);
        }
    })
    .catch(err => console.error("❌ Lỗi MongoDB:", err));

// 2. SCHEMA & MODEL
const keySchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    hwid: { type: String, required: true },
    token: { type: String, required: true },
    expiresAt: { type: Date, required: true }
});

keySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
const KeyModel = mongoose.model('Key', keySchema);

// Dọn dẹp chủ động mỗi 1 tiếng
setInterval(async () => {
    try {
        const result = await KeyModel.deleteMany({ expiresAt: { $lte: new Date() } });
        if (result.deletedCount > 0) {
            console.log(`🧹 [DỌN CSDL] Đã xóa ${result.deletedCount} key hết hạn.`);
        }
    } catch (cleanErr) {
        console.error("❌ Lỗi dọn dẹp Database:", cleanErr.message);
    }
}, 60 * 60 * 1000);

// CSS CHUNG CHO TẤT CẢ TRANG WEB
const COMMON_STYLE = `
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; }
    body {
        background: #090a0f;
        background-image: 
            radial-gradient(at 20% 20%, rgba(46, 204, 113, 0.1) 0px, transparent 50%),
            radial-gradient(at 80% 80%, rgba(231, 76, 60, 0.1) 0px, transparent 50%);
        color: #f1f5f9;
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
        padding: 20px;
    }
    .card {
        background: rgba(18, 22, 31, 0.85);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 24px;
        padding: 36px 28px;
        width: 100%;
        max-width: 420px;
        text-align: center;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
    }
    .icon-wrapper {
        width: 64px;
        height: 64px;
        border-radius: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 20px auto;
    }
    .icon-wrapper.success { background: rgba(46, 204, 113, 0.1); border: 1px solid rgba(46, 204, 113, 0.25); }
    .icon-wrapper.error { background: rgba(231, 76, 60, 0.1); border: 1px solid rgba(231, 76, 60, 0.25); }
    .icon-wrapper.warning { background: rgba(243, 156, 18, 0.1); border: 1px solid rgba(243, 156, 18, 0.25); }
    .icon-wrapper svg { width: 32px; height: 32px; }
    h2 { font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; margin-bottom: 8px; }
    p.sub { color: #94a3b8; font-size: 14px; line-height: 1.5; margin-bottom: 20px; }
    input {
        width: 100%; padding: 16px; font-size: 16px; font-weight: 700; text-align: center;
        background: #0f131c; color: #2ecc71; border: 1.5px solid rgba(255, 255, 255, 0.1);
        border-radius: 14px; outline: none; margin-bottom: 16px;
    }
    button {
        width: 100%; padding: 16px; background: linear-gradient(135deg, #2ecc71 0%, #27ae60 100%);
        color: #fff; border: none; border-radius: 14px; font-size: 15px; font-weight: 700;
        cursor: pointer; box-shadow: 0 8px 20px rgba(46, 204, 113, 0.3);
    }
    .timer-badge {
        display: inline-flex; align-items: center; gap: 6px; margin-top: 20px; padding: 8px 16px;
        background: rgba(243, 156, 18, 0.1); border: 1px solid rgba(243, 156, 18, 0.2);
        border-radius: 30px; font-size: 13px; color: #f39c12; font-weight: 600;
    }
`;

// ==========================================================
// 3. ROUTE TẠO / XEM KEY
// ==========================================================
app.get('/getkey', async (req, res) => {
    const hwid = req.query.hwid ? req.query.hwid.trim() : "";
    const token = req.query.token ? req.query.token.trim() : "";

    // LỖI: Thiếu HWID hoặc Token
    if (!hwid || !token) {
        return res.send(`
            <!DOCTYPE html>
            <html lang="vi">
            <head>
                <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Lỗi Truy Cập</title>
                <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
                <style>${COMMON_STYLE}</style>
            </head>
            <body>
                <div class="card">
                    <div class="icon-wrapper error">
                        <svg viewBox="0 0 24 24" fill="#e74c3c"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
                    </div>
                    <h2>TRUY CẬP KHÔNG HỢP LỆ</h2>
                    <p class="sub">Thiếu thông tin xác thực thiết bị.<br>Vui lòng mở lại game và bấm nút <b>LẤY KEY</b>.</p>
                </div>
            </body>
            </html>
        `);
    }

    try {
        const now = new Date();
        let keyData = await KeyModel.findOne({ hwid: hwid, expiresAt: { $gt: now } });

        let currentKey = "";
        let expiresAtTime = "";

        if (keyData) {
            if (keyData.token === token) {
                currentKey = keyData.key;
                expiresAtTime = new Date(keyData.expiresAt).getTime();
            } else {
                // LỖI: Token không khớp
                return res.send(`
                    <!DOCTYPE html>
                    <html lang="vi">
                    <head>
                        <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Link Hết Hạn</title>
                        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
                        <style>${COMMON_STYLE}</style>
                    </head>
                    <body>
                        <div class="card">
                            <div class="icon-wrapper warning">
                                <svg viewBox="0 0 24 24" fill="#f39c12"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
                            </div>
                            <h2>LINK ĐÃ HẾT HẠN</h2>
                            <p class="sub">Link này không thuộc phiên làm việc hiện tại.<br>Vui lòng vào lại game bấm <b>LẤY KEY</b> để nhận link mới nhất!</p>
                        </div>
                    </body>
                    </html>
                `);
            }
        } else {
            // TẠO KEY MỚI 24H
            currentKey = "PITAYA_" + Math.random().toString(36).substring(2, 10).toUpperCase();
            const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            expiresAtTime = expiresAt.getTime();

            await KeyModel.findOneAndUpdate(
                { hwid: hwid },
                { key: currentKey, hwid: hwid, token: token, expiresAt: expiresAt },
                { upsert: true, new: true }
            );
        }

        // THÀNH CÔNG: Hiện giao diện lấy Key
        res.send(`
            <!DOCTYPE html>
            <html lang="vi">
            <head>
                <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Pitaya Key System</title>
                <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
                <style>${COMMON_STYLE}</style>
            </head>
            <body>
                <div class="card">
                    <div class="icon-wrapper success">
                        <svg viewBox="0 0 24 24" fill="#2ecc71"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                    </div>
                    <h2>LẤY KEY THÀNH CÔNG</h2>
                    <p class="sub">Mã Key 24h của bạn đã sẵn sàng sử dụng</p>
                    
                    <input type="text" id="keyInput" value="${currentKey}" readonly>
                    <button onclick="copyKey()"><span id="btnText">📋 SAO CHÉP KEY</span></button>
                    
                    <div class="timer-badge">
                        ⏳ <span id="countdown">Đang tính thời gian...</span>
                    </div>
                </div>
                <script>
                    function copyKey() {
                        var copyText = document.getElementById("keyInput");
                        copyText.select();
                        navigator.clipboard.writeText(copyText.value);
                        var btnText = document.getElementById("btnText");
                        btnText.innerText = "✅ ĐÃ SAO CHÉP!";
                        setTimeout(() => { btnText.innerText = "📋 SAO CHÉP KEY"; }, 2000);
                    }
                    const expiresAt = ${expiresAtTime};
                    function updateTimer() {
                        const distance = expiresAt - new Date().getTime();
                        if (distance <= 0) {
                            document.getElementById("countdown").innerHTML = "Key đã hết hạn!";
                            return;
                        }
                        const h = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                        const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
                        const s = Math.floor((distance % (1000 * 60)) / 1000);
                        document.getElementById("countdown").innerHTML = "Hạn dùng: " + h + "h " + m + "m " + s + "s";
                    }
                    setInterval(updateTimer, 1000);
                    updateTimer();
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        res.send(`<h3>Lỗi Server: ${err.message}</h3>`);
    }
});

// ==========================================================
// 4. ROUTE VERIFY TỪ GAME ROBLOX
// ==========================================================
app.get('/verify', async (req, res) => {
    const hwid = req.query.hwid ? req.query.hwid.trim() : "";
    const key = req.query.key ? req.query.key.trim() : "";

    if (!hwid || !key) return res.json({ status: "error", message: "Thiếu dữ liệu" });

    try {
        const now = new Date();
        const keyData = await KeyModel.findOne({ 
            key: key, 
            hwid: hwid, 
            expiresAt: { $gt: now } 
        });

        if (keyData) {
            return res.json({ 
                status: "success", 
                scriptUrl: process.env.SCRIPT_URL 
            });
        } else {
            return res.json({ status: "invalid" });
        }
    } catch (err) {
        return res.json({ status: "error", message: err.message });
    }
});

// ROUTE TRANG CHỦ (Tối ưu giao diện khi mở trực tiếp domain)
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="vi">
        <head>
            <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Server Status</title>
            <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
            <style>${COMMON_STYLE}</style>
        </head>
        <body>
            <div class="card">
                <div class="icon-wrapper success">
                    <svg viewBox="0 0 24 24" fill="#2ecc71"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                </div>
                <h2>SERVER ONLINE</h2>
                <p class="sub">Hệ thống Key System đang hoạt động bình thường trên Render.</p>
            </div>
        </body>
        </html>
    `);
});

// Tự gọi chính mình giữ Render không ngủ đông
const https = require('https');
if (SERVER_URL) {
    setInterval(() => {
        https.get(SERVER_URL, (res) => {
            console.log('⏰ Ping tự động giữ server hoạt động!');
        }).on('error', (err) => {
            console.error('Lỗi Ping:', err.message);
        });
    }, 14 * 60 * 1000);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server chạy tại port ${PORT}`));
