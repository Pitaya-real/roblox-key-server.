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
    if (!hwid) {
        return res.status(400).send(`<h2 style="color: red; text-align: center;">❌ Thiếu mã HWID!</h2>`);
    }

    const newKey = "PITAYA_" + crypto.randomBytes(4).toString('hex').toUpperCase();
    const expiresAt = new Date(Date.now() + (24 * 60 * 60 * 1000)); // Hạn 24 giờ

    try {
        await KeyModel.create({ key: newKey, hwid: hwid, expiresAt: expiresAt });

        res.send(`
            <!DOCTYPE html>
            <html lang="vi">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Key Roblox Của Bạn</title>
                <style>
                    body { font-family: sans-serif; background: #121212; color: #fff; text-align: center; padding: 20px; }
                    .container { margin-top: 40px; background: #1e1e1e; padding: 30px; border-radius: 12px; display: inline-block; }
                    .key-box { background: #2a2a2a; color: #00ff88; font-size: 24px; font-weight: bold; padding: 15px; border-radius: 8px; border: 2px dashed #007bff; margin: 20px 0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h2 style="color: #007bff;">🎉 VƯỢT LINK THÀNH CÔNG!</h2>
                    <p>Key này có thời hạn <b>24 Giờ</b>:</p>
                    <div class="key-box">${newKey}</div>
                    <p style="color: #aaa;">Copy Key và dán vào Roblox UI để sử dụng.</p>
                </div>
            </body>
            </html>
        `);
    } catch (error) {
        res.status(500).send("Lỗi tạo Key trên Database!");
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
