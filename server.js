const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const USERS_FILE = path.join(__dirname, 'users.json');
const STORES_FILE = path.join(__dirname, 'stores.json');

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));

// Stores dosyası yoksa oluştur
if (!fs.existsSync(STORES_FILE)) {
    fs.writeFileSync(STORES_FILE, JSON.stringify({}, null, 2));
}

// Şifre doğrulama fonksiyonu
function verifyAdmin(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'Yetkisiz erişim' });
    }
    
    const encoded = authHeader.split(' ')[1];
    const decoded = Buffer.from(encoded, 'base64').toString();
    const [username, password] = decoded.split(':');
    
    // Admin kontrolü (kullanıcı adı admin veya şifre wowburger2024)
    if (username === 'admin' || password === 'wowburger2024') {
        return next();
    }
    
    // Normal kullanıcı kontrolü (boşlukları temizle)
    let users = [];
    try {
        users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    } catch (e) {}
    
    const trimmedUsername = username ? username.trim() : '';
    const trimmedPassword = password ? password.trim() : '';
    
    const user = users.find(u => 
        u.username && u.username.trim() === trimmedUsername && 
        u.password === trimmedPassword
    );
    
    if (user) {
        req.user = user;
        next();
    } else {
        console.log('Auth failed for:', trimmedUsername, 'password:', trimmedPassword);
        return res.status(401).json({ error: 'Yanlış şifre veya kullanıcı adı' });
    }
}

// Kullanıcı kayıt (email olmadan!)
app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Kullanıcı adı ve şifre zorunludur' });
    }
    
    let users = [];
    try {
        users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    } catch (e) {}
    
    // Kullanıcı adı kontrolü
    if (users.find(u => u.username === username)) {
        return res.status(400).json({ error: 'Bu kullanıcı adı zaten alınmış' });
    }
    
    // Kullanıcıyı kaydet
    users.push({
        username,
        password,
        createdAt: new Date().toISOString()
    });
    
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    
    res.json({ success: true, message: 'Kayıt başarılı!' });
});

// Giriş
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    let users = [];
    try {
        users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    } catch (e) {}
    
    const user = users.find(u => u.username === username && u.password === password);
    
    if (user) {
        res.json({ success: true, user: { username: user.username } });
    } else {
        res.status(401).json({ error: 'Geçersiz kullanıcı adı veya şifre' });
    }
});

// Tüm ürünleri getir (herkes görebilir)
app.get('/api/products', (req, res) => {
    fs.readFile(DATA_FILE, 'utf8', (err, data) => {
        if (err) {
            return res.status(500).json({ error: 'Veri okunamadı' });
        }
        res.json(JSON.parse(data));
    });
});

// Ürün ekle (admin veya doğrulanmış kullanıcı)
app.post('/api/products', verifyAdmin, (req, res) => {
    const { name, price, image } = req.body;
    
    if (!name || !price) {
        return res.status(400).json({ error: 'Ürün adı ve fiyatı zorunludur' });
    }
    
    fs.readFile(DATA_FILE, 'utf8', (err, data) => {
        if (err) {
            return res.status(500).json({ error: 'Veri okunamadı' });
        }
        
        const products = JSON.parse(data);
        const newProduct = {
            id: Date.now(),
            name,
            price: parseFloat(price),
            image: image || ''
        };
        
        products.push(newProduct);
        
        fs.writeFile(DATA_FILE, JSON.stringify(products, null, 2), (err) => {
            if (err) {
                return res.status(500).json({ error: 'Veri kaydedilemedi' });
            }
            res.json(newProduct);
        });
    });
});

// Ürün güncelle
app.put('/api/products/:id', verifyAdmin, (req, res) => {
    const { id } = req.params;
    const { name, price, image } = req.body;
    
    fs.readFile(DATA_FILE, 'utf8', (err, data) => {
        if (err) {
            return res.status(500).json({ error: 'Veri okunamadı' });
        }
        
        let products = JSON.parse(data);
        const index = products.findIndex(p => p.id == id);
        
        if (index === -1) {
            return res.status(404).json({ error: 'Ürün bulunamadı' });
        }
        
        products[index] = {
            ...products[index],
            name: name || products[index].name,
            price: price ? parseFloat(price) : products[index].price,
            image: image || products[index].image
        };
        
        fs.writeFile(DATA_FILE, JSON.stringify(products, null, 2), (err) => {
            if (err) {
                return res.status(500).json({ error: 'Veri kaydedilemedi' });
            }
            res.json(products[index]);
        });
    });
});

// Ürün sil
app.delete('/api/products/:id', verifyAdmin, (req, res) => {
    const { id } = req.params;
    
    fs.readFile(DATA_FILE, 'utf8', (err, data) => {
        if (err) {
            return res.status(500).json({ error: 'Veri okunamadı' });
        }
        
        let products = JSON.parse(data);
        products = products.filter(p => p.id != id);
        
        fs.writeFile(DATA_FILE, JSON.stringify(products, null, 2), (err) => {
            if (err) {
                return res.status(500).json({ error: 'Veri kaydedilemedi' });
            }
            res.json({ success: true });
        });
    });
});

// ========== DÜKKAN API'LERİ ==========

// Dükkan bilgilerini getir (kullanıcı adı ile)
app.get('/api/store/:username', (req, res) => {
    const { username } = req.params;
    const stores = JSON.parse(fs.readFileSync(STORES_FILE, 'utf8'));
    res.json(stores[username] || { name: 'Dükkan', logo: '', description: '' });
});

// Dükkan bilgilerini güncelle (giriş yapmış kullanıcı)
app.put('/api/store', verifyAdmin, (req, res) => {
    const { name, logo, description } = req.body;
    const username = req.user.username;
    
    const stores = JSON.parse(fs.readFileSync(STORES_FILE, 'utf8'));
    stores[username] = { name, logo, description, updatedAt: new Date().toISOString() };
    
    fs.writeFileSync(STORES_FILE, JSON.stringify(stores, null, 2));
    res.json({ success: true, store: stores[username] });
});

// Dükkan ürünlerini getir
app.get('/api/store/:username/products', (req, res) => {
    const { username } = req.params;
    const stores = JSON.parse(fs.readFileSync(STORES_FILE, 'utf8'));
    const store = stores[username];
    
    if (!store || !store.products) {
        return res.json([]);
    }
    res.json(store.products);
});

// Dükkan ürünlerini güncelle
app.put('/api/store/:username/products', verifyAdmin, (req, res) => {
    const { username } = req.params;
    const { products } = req.body;
    
    // Sadece kendi dükkanını güncelleyebilir
    if (req.user.username !== username && req.user.username !== 'admin') {
        return res.status(403).json({ error: 'Yetkisiz işlem' });
    }
    
    const stores = JSON.parse(fs.readFileSync(STORES_FILE, 'utf8'));
    if (!stores[username]) {
        stores[username] = { name: 'Dükkan', logo: '', description: '' };
    }
    stores[username].products = products;
    stores[username].updatedAt = new Date().toISOString();
    
    fs.writeFileSync(STORES_FILE, JSON.stringify(stores, null, 2));
    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`🚀 Server çalışıyor: http://localhost:${PORT}`);
});
