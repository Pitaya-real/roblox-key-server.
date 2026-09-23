const express = require('express');
const crypto = require('crypto');
const mongoose = require('mongoose');

const app = express();
app.use(express.json());

// 1. LẤY TẤT CẢ LINK & BẢO MẬT TỪ BIẾN MÔI TRƯỜNG RENDER
const MONGO_URI = process.env.MONGO_URI;
const SCRIPT_URL = process.env.SCRIPT_URL;

// Kiểm tra kết nối MongoDB
if (!MONGO_URI) {
    console.error("❌ LỖI: Chưa cài đặt MONGO_URI trên Render!");
} else {
    mongoose.connect(MONGO_URI)
        .then(() => console.log("✅ Kết nối MongoDB thành công!"))
        .catch(err => console.error("❌ Lỗi MongoDB:", err));
}

// 2. TẠO SCHEMA VÀ MODEL LƯU KEY
const keySchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    hwid: { type: String, required: true },
    expiresAt: { type: Date, required: true }
});

// Tự động xóa Key khỏi Database sau 24h
keySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const KeyModel = mongoose.model('Key', keySchema);

// ==========================================================
// 3. ROUTE TẠO KEY (Vượt link QC chuyển về đây)
// ==========================================================
app.get('/getkey', async (req, res) => {
    const hwid = req.query.hwid;
    
    // 1. CHẶN TRUY CẬP TRỰC TIẾP: Nếu không có HWID thì từ chối, bắt buộc phải vào từ game qua Link4M
    if (!hwid || hwid.trim() === "") {
        return res.send(`
            <!DOCTYPE html>
            <html lang="vi">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Truy Cập Không Hợp Lệ</title>
                <style>
                    body { background: #0f0f13; color: #fff; font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; text-align: center; }
                    .card { background: #1a1a24; padding: 30px; border-radius: 16px; box-shadow: 0 8px 25px rgba(0,0,0,0.7); max-width: 400px; border: 1px solid #2a2a3c; }
                    h2 { color: #e74c3c; margin-bottom: 10px; }
                    p { color: #a0a0ab; font-size: 14px; line-height: 1.5; }
                </style>
            </head>
            <body>
                <div class="card">
                    <h2>❌ Lỗi Truy Cập</h2>
                    <p>Bạn không thể truy cập trực tiếp trang này!<br>Vui lòng vào game, bấm nút <b>Lấy Key</b> và hoàn thành vượt link để nhận mã chính thức.</p>
                </div>
            </body>
            </html>
        `);
    }

    try {
        const now = new Date();
        let keyData = await KeyModel.findOne({ hwid: hwid });
        let currentKey = "";
        let expiresAtTime = "";

        // 2. KIỂM TRA KEY CŨ CÒN HẠN HAY KHÔNG
        if (keyData && new Date(keyData.expiresAt) > now) {
            currentKey = keyData.key;
            expiresAtTime = new Date(keyData.expiresAt).getTime(); // Lấy mốc thời gian hết hạn dạng miligiây
        } else {
            // Nếu chưa có hoặc đã hết hạn -> Tạo mới hoàn toàn một key 24h
            currentKey = "PITAYA_" + Math.random().toString(36).substring(2, 10).toUpperCase();
            const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 giờ tới
            expiresAtTime = expiresAt.getTime();

            if (keyData) {
                keyData.key = currentKey;
                keyData.expiresAt = expiresAt;
                await keyData.save();
            } else {
                await KeyModel.create({
                    hwid: hwid,
                    key: currentKey,
                    expiresAt: expiresAt
                });
            }
        }

        // 3. TRẢ VỀ GIAO DIỆN CÓ ĐỒNG HỒ ĐẾM NGƯỢC THỜI GIAN THỰC
        res.send(`
            <!DOCTYPE html>
            <html lang="vi">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Lấy Key Thành Công</title>
                <style>
                    body { background: #0f0f13; color: #fff; font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
                    .card { background: #1a1a24; padding: 30px; border-radius: 16px; box-shadow: 0 8px 25px rgba(0,0,0,0.7); text-align: center; width: 90%; max-width: 400px; border: 1px solid #2a2a3c; }
                    h2 { color: #2ecc71; margin-bottom: 10px; }
                    p { color: #a0a0ab; font-size: 14px; margin-bottom: 15px; }
                    .input-container { display: flex; gap: 10px; margin-bottom: 15px; }
                    input { flex: 1; padding: 12px; font-size: 16px; text-align: center; background: #121217; color: #2ecc71; border: 1px solid #33334d; border-radius: 8px; font-weight: bold; outline: none; }
                    button { width: 100%; padding: 12px; background: #2ecc71; color: #fff; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; font-weight: bold; transition: 0.2s; }
                    button:active { background: #27ae60; }
                    .timer { margin-top: 15px; font-size: 13px; color: #f39c12; font-weight: bold; }
                </style>
            </head>
            <body>
                <div class="card">
                    <h2>🎉 Vượt Link Thành Công</h2>
                    <p>Mã Key 24h của bạn:</p>
                    <div class="input-container">
                        <input type="text" id="keyInput" value="${currentKey}" readonly>
                    </div>
                    <button onclick="copyKey()">📋 SAO CHÉP KEY</button>
                    <div class="timer" id="countdown">Đang tải thời gian hết hạn...</div>
                </div>
                <script>
                    function copyKey() {
                        var copyText = document.getElementById("keyInput");
                        copyText.select();
                        copyText.setSelectionRange(0, 99999);
                        navigator.clipboard.writeText(copyText.value);
                        alert("Đã sao chép Key thành công!");
                    }

                    // Đồng hồ đếm ngược thời gian thực theo mốc expiresAt từ Database
                    const expiresAt = ${expiresAtTime};
                    function updateTimer() {
                        const now = new Date().getTime();
                        const distance = expiresAt - now;

                        if (distance < 0) {
                            document.getElementById("countdown").innerHTML = "⚠️ Key đã hết hạn! Vui lòng lấy link mới trong game.";
                            return;
                        }

                        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60 * 60 / 60));
                        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

                        document.getElementById("countdown").innerHTML = "⏳ Thời gian còn lại: " + hours + "h " + minutes + "m " + seconds + "s";
                    }
                    setInterval(updateTimer, 1000);
                    updateTimer();
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error("Database Error:", err);
        res.send(`<h3 style='color:red; text-align:center; margin-top:50px;'>Lỗi tạo Key trên Database! Chi tiết: ${err.message}</h3>`);
    }
});

// ==========================================================
// 4. API XÁC THỰC KEY (Roblox Client gọi đến)
// ==========================================================
app.post('/api/verify', async (req, res) => {
    const { key, hwid } = req.body;

    if (!key || !hwid) {
        return res.json({ valid: false, message: "Thiếu thông tin Key hoặc HWID!" });
    }

    try {
        const keyData = await KeyModel.findOne({ key: key });

        if (!keyData) {
            return res.json({ valid: false, message: "Key không tồn tại hoặc đã hết hạn!" });
        }

        if (keyData.hwid !== hwid) {
            return res.json({ valid: false, message: "Key này được tạo cho máy khác!" });
        }

        // Trả về kết quả hợp lệ và Link Raw Main Script từ Biến môi trường Render
        return res.json({ 
            valid: true, 
            message: "Xác thực thành công!",
            scriptUrl: SCRIPT_URL 
        });

    } catch (error) {
        return res.json({ valid: false, message: "Lỗi kết nối Server!" });
    }
});

app.get('/', (req, res) => {
    res.send("Server Key System bảo mật đang hoạt động!");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
