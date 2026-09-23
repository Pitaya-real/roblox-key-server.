const express = require('express');
const crypto = require('crypto');
const app = express();

// Cho phép Server đọc dữ liệu JSON gửi lên từ Roblox
app.use(express.json());

// Cấu hình lưu trữ Key tạm thời trên RAM
// (Mỗi khi Server khởi động lại, bộ nhớ này sẽ làm mới)
const keysDatabase = new Map();

// ==========================================================
// 1. TRANG TẠO KEY (Được gọi sau khi người dùng vượt link QC)
// Đường dẫn: https://domain-cua-ban.onrender.com/getkey?hwid=MA_HWID
// ==========================================================
app.get('/getkey', (req, res) => {
    const hwid = req.query.hwid;
    
    if (!hwid) {
        return res.status(400).send(`
            <h2 style="color: red; text-align: center; font-family: sans-serif; margin-top: 50px;">
                ❌ Lỗi: Không tìm thấy HWID (Mã máy) trong yêu cầu!
            </h2>
        `);
    }

    // Tạo Key ngẫu nhiên gồm 8 ký tự (Ví dụ: KEY_A1B2C3D4)
    const newKey = "KEY_" + crypto.randomBytes(4).toString('hex').toUpperCase();
    
    // Đặt thời hạn cho Key: 24 Giờ (24 * 60 * 60 * 1000 miligiây)
    const expiresAt = Date.now() + (24 * 60 * 60 * 1000);

    // Lưu Key + HWID + Hạn sử dụng vào Database
    keysDatabase.set(newKey, {
        hwid: hwid,
        expiresAt: expiresAt
    });

    // Trả về giao diện Web hiển thị Key cho người dùng Copy trên điện thoại
    res.send(`
        <!DOCTYPE html>
        <html lang="vi">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Key Roblox Của Bạn</title>
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    background-color: #121212;
                    color: #ffffff;
                    text-align: center;
                    padding: 20px;
                    margin: 0;
                }
                .container {
                    margin-top: 40px;
                    background: #1e1e1e;
                    padding: 30px 20px;
                    border-radius: 12px;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.5);
                    display: inline-block;
                    max-width: 90%;
                }
                .key-box {
                    background: #2a2a2a;
                    color: #00ff88;
                    font-size: 24px;
                    font-weight: bold;
                    padding: 15px 25px;
                    border-radius: 8px;
                    border: 2px dashed #007bff;
                    margin: 20px 0;
                    letter-spacing: 2px;
                    word-break: break-all;
                }
                .info {
                    color: #aaa;
                    font-size: 14px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h2 style="color: #007bff; margin-top: 0;">🎉 VƯỢT LINK THÀNH CÔNG!</h2>
                <p>Key này dành riêng cho máy của bạn và có thời hạn <b>24 Giờ</b>:</p>
                
                <div class="key-box">${newKey}</div>
                
                <p class="info">Hãy sao chép Key trên và dán vào Roblox UI để sử dụng Script.</p>
            </div>
        </body>
        </html>
    `);
});

// ==========================================================
// 2. API XÁC THỰC KEY (Dành cho Roblox Lua Script gọi vào)
// Đường dẫn: https://domain-cua-ban.onrender.com/api/verify
// ==========================================================
app.post('/api/verify', (req, res) => {
    const { key, hwid } = req.body;

    // Kiểm tra dữ liệu đầu vào
    if (!key || !hwid) {
        return res.json({ 
            valid: false, 
            message: "Thiếu dữ liệu Key hoặc HWID gửi lên!" 
        });
    }

    const keyData = keysDatabase.get(key);

    // 1. Kiểm tra Key có tồn tại trên hệ thống không
    if (!keyData) {
        return res.json({ 
            valid: false, 
            message: "Key không tồn tại hoặc không hợp lệ!" 
        });
    }

    // 2. Kiểm tra HWID (Khóa theo máy, chống chia sẻ Key cho người khác)
    if (keyData.hwid !== hwid) {
        return res.json({ 
            valid: false, 
            message: "Key này được tạo cho máy khác, bạn không thể sử dụng!" 
        });
    }

    // 3. Kiểm tra thời hạn Key (24h)
    if (Date.now() > keyData.expiresAt) {
        keysDatabase.delete(key); // Xóa Key đã hết hạn khỏi bộ nhớ
        return res.json({ 
            valid: false, 
            message: "Key đã hết hạn 24h! Vui lòng bấm Lấy Key lại." 
        });
    }

    // NẾU TẤT CẢ ĐỀU ĐÚNG: Trả về kết quả xác nhận + Link Main Script
    return res.json({ 
        valid: true, 
        message: "Xác thực thành công!",
        // Thay link dưới bằng Link Raw Main Script tính năng game của bạn trên GitHub
        scriptUrl: "https://raw.githubusercontent.com/Pitaya-real/Illegal-Soccer/refs/heads/main/main.lua" 
    });
});

// Route kiểm tra trạng thái Server
app.get('/', (req, res) => {
    res.send("Server Key System Roblox đang hoạt động bình thường!");
});

// ==========================================================
// BẮT BUỘC CHO RENDER: Lắng nghe Cổng (Port) do Render cấp
// ==========================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server Node.js đang chạy trên cổng ${PORT}`);
});
