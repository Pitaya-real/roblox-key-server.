const express = require('express');
const mongoose = require('mongoose');

const app = express();
app.use(express.json());

// 1. LẤY BIẾN MÔI TRƯỜNG TỪ RENDER
const MONGO_URI = process.env.MONGO_URI;
const SCRIPT_URL = process.env.SCRIPT_URL; // Link script gốc cài trên Render

if (!MONGO_URI) console.error("❌ LỖI: Chưa cài MONGO_URI!");
if (!SCRIPT_URL) console.error("❌ LỖI: Chưa cài SCRIPT_URL!");

mongoose.connect(MONGO_URI)
    .then(async () => {
        console.log("✅ Đã kết nối MongoDB!");
        // Tự động rebuild Index để đảm bảo tính năng TTL (xóa tự động) hoạt động 100%
        try {
            await KeyModel.syncIndexes();
            console.log("✅ Đã đồng bộ Index tự động xóa Key hết hạn!");
        } catch (idxErr) {
            console.error("⚠️ Lỗi đồng bộ Index:", idxErr.message);
        }
    })
    .catch(err => console.error("❌ Lỗi MongoDB:", err));

// 2. SCHEMA LƯU KEY VÀ TOKEN 24H
const keySchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    hwid: { type: String, required: true },
    token: { type: String, required: true },
    expiresAt: { type: Date, required: true }
});

// LỚP 1: Cấu hình TTL Index của MongoDB (Xóa tự động khi expiresAt <= thời gian hiện tại)
keySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const KeyModel = mongoose.model('Key', keySchema);

// LỚP 2: Dọn dẹp chủ động bằng Node.js (Chạy mỗi 1 giờ để giải phóng hoàn toàn dung lượng)
setInterval(async () => {
    try {
        const result = await KeyModel.deleteMany({ expiresAt: { $lte: new Date() } });
        if (result.deletedCount > 0) {
            console.log(`🧹 [DỌN CƠ CSDL] Đã xóa ${result.deletedCount} key hết hạn khỏi Database.`);
        }
    } catch (cleanErr) {
        console.error("❌ Lỗi dọn dẹp Database:", cleanErr.message);
    }
}, 60 * 60 * 1000); // 1 tiếng quét 1 lần

// ==========================================================
// 3. ROUTE TẠO / XEM KEY (Dành cho Web)
// URL: /getkey?hwid=...&token=...
// ==========================================================
app.get('/getkey', async (req, res) => {
    const hwid = req.query.hwid ? req.query.hwid.trim() : "";
    const token = req.query.token ? req.query.token.trim() : "";

    if (!hwid || !token) {
        return res.send(`
            <!DOCTYPE html>
            <html lang="vi">
            <head>
                <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Lỗi Truy Cập</title>
                <style>
                    body { background: #0f0f13; color: #fff; font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; text-align: center; }
                    .card { background: #1a1a24; padding: 30px; border-radius: 16px; border: 1px solid #2a2a3c; max-width: 400px; }
                    h2 { color: #e74c3c; } p { color: #a0a0ab; font-size: 14px; }
                </style>
            </head>
            <body>
                <div class="card">
                    <h2>❌ Truy Cập Không Hợp Lệ</h2>
                    <p>Thiếu thông tin xác thực!<br>Vui lòng vào lại game và bấm nút <b>LẤY KEY</b>.</p>
                </div>
            </body>
            </html>
        `);
    }

    try {
        const now = new Date();
        
        // Tìm key còn hạn trong DB
        let keyData = await KeyModel.findOne({ hwid: hwid, expiresAt: { $gt: now } });

        let currentKey = "";
        let expiresAtTime = "";

        if (keyData) {
            // Key CÒN HẠN: So sánh Token
            if (keyData.token === token) {
                currentKey = keyData.key;
                expiresAtTime = new Date(keyData.expiresAt).getTime();
            } else {
                return res.send(`
                    <!DOCTYPE html>
                    <html lang="vi">
                    <head>
                        <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Token Không Hợp Lệ</title>
                        <style>
                            body { background: #0f0f13; color: #fff; font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; text-align: center; }
                            .card { background: #1a1a24; padding: 30px; border-radius: 16px; border: 1px solid #2a2a3c; max-width: 400px; }
                            h2 { color: #e74c3c; } p { color: #a0a0ab; font-size: 14px; }
                        </style>
                    </head>
                    <body>
                        <div class="card">
                            <h2>⚠️ Mã Xác Thực Không Đúng</h2>
                            <p>Link này không khớp với phiên làm việc hiện tại.<br>Vui lòng mở game và bấm <b>LẤY KEY</b> để lấy đúng link!</p>
                        </div>
                    </body>
                    </html>
                `);
            }
        } else {
            // Key HẾT HẠN hoặc CHƯA TẠO -> Tạo mới Key 24h
            currentKey = "PITAYA_" + Math.random().toString(36).substring(2, 10).toUpperCase();
            const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            expiresAtTime = expiresAt.getTime();

            await KeyModel.findOneAndUpdate(
                { hwid: hwid },
                { key: currentKey, hwid: hwid, token: token, expiresAt: expiresAt },
                { upsert: true, new: true }
            );
        }

        res.send(`
            <!DOCTYPE html>
            <html lang="vi">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Lấy Key Thành Công</title>
                <style>
                    body { background: #0f0f13; color: #fff; font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
                    .card { background: #1a1a24; padding: 30px; border-radius: 16px; text-align: center; width: 90%; max-width: 400px; border: 1px solid #2a2a3c; box-shadow: 0 8px 25px rgba(0,0,0,0.7); }
                    h2 { color: #2ecc71; margin-bottom: 10px; }
                    p { color: #a0a0ab; font-size: 14px; margin-bottom: 15px; }
                    input { width: 100%; padding: 12px; font-size: 16px; text-align: center; background: #121217; color: #2ecc71; border: 1px solid #33334d; border-radius: 8px; font-weight: bold; margin-bottom: 15px; box-sizing: border-box; outline: none; }
                    button { width: 100%; padding: 12px; background: #2ecc71; color: #fff; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; font-weight: bold; }
                    .timer { margin-top: 15px; font-size: 13px; color: #f39c12; font-weight: bold; }
                </style>
            </head>
            <body>
                <div class="card">
                    <h2>🎉 Lấy Key Thành Công</h2>
                    <p>Mã Key 24h của bạn:</p>
                    <input type="text" id="keyInput" value="${currentKey}" readonly>
                    <button onclick="copyKey()">📋 SAO CHÉP KEY</button>
                    <div class="timer" id="countdown">Đang tính thời gian...</div>
                </div>
                <script>
                    function copyKey() {
                        var copyText = document.getElementById("keyInput");
                        copyText.select();
                        navigator.clipboard.writeText(copyText.value);
                        alert("Đã sao chép Key!");
                    }
                    const expiresAt = ${expiresAtTime};
                    function updateTimer() {
                        const distance = expiresAt - new Date().getTime();
                        if (distance <= 0) {
                            document.getElementById("countdown").innerHTML = "⚠️ Key đã hết hạn! Vui lòng vào game lấy link mới.";
                            return;
                        }
                        const h = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                        const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60 * 60 / 60));
                        const s = Math.floor((distance % (1000 * 60)) / 1000);
                        document.getElementById("countdown").innerHTML = "⏳ Thời gian còn lại: " + h + "h " + m + "m " + s + "s";
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
// URL: /verify?hwid=...&key=...
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

app.get('/', (req, res) => res.send("Server Key System đang hoạt động!"));

// Tự gọi lại chính mình mỗi 14 phút để Render không bị ngủ đông
const https = require('https');
setInterval(() => {
    https.get('https://my-key-system-eyd6.onrender.com', (res) => {
        console.log('⏰ Ping tự động giữ server hoạt động!');
    }).on('error', (err) => {
        console.error('Lỗi Ping:', err.message);
    });
}, 14 * 60 * 1000); // 14 phút ping 1 lần (Render ngủ sau 15 phút)

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server chạy tại port ${PORT}`));
