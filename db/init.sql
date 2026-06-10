-- 行馆旅居会员管理系统 - 数据库初始化脚本
-- SQLite 数据库

-- ========== 1. 用户表（登录账号） ==========
CREATE TABLE IF NOT EXISTS users (
    user_id        INTEGER PRIMARY KEY AUTOINCREMENT,
    username       TEXT    NOT NULL UNIQUE,
    password       TEXT    NOT NULL,               -- 简单MD5存储，生产环境请用bcrypt
    real_name      TEXT,
    role           TEXT    NOT NULL DEFAULT 'sales', -- admin | manager | sales | service
    is_active      INTEGER NOT NULL DEFAULT 1,     -- 1=启用 0=禁用
    created_at     TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    last_login     TEXT
);

-- ========== 2. 会员表 ==========
CREATE TABLE IF NOT EXISTS members (
    member_id      TEXT    PRIMARY KEY,            -- M001, M002...
    name           TEXT    NOT NULL,
    phone          TEXT,
    gender         TEXT,
    age            INTEGER,
    join_date      TEXT    NOT NULL DEFAULT (date('now')),
    source         TEXT,                             -- 微信 | 抖音 | 老客户推荐 | 线下活动 | 线上平台 | 商务拓展
    status         TEXT    NOT NULL DEFAULT 'new',  -- new | following | intended | converted | lost
    owner_user_id  INTEGER,                         -- 关联users.user_id，负责人
    total_points   INTEGER NOT NULL DEFAULT 0,
    total_spent    REAL    NOT NULL DEFAULT 0,
    note           TEXT,
    created_at     TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at     TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (owner_user_id) REFERENCES users(user_id)
);

-- ========== 3. 订单表 ==========
CREATE TABLE IF NOT EXISTS orders (
    order_id       TEXT    PRIMARY KEY,            -- 小程序订单号 或 XG20260609001
    member_id      TEXT    NOT NULL,
    order_type     TEXT    NOT NULL,                -- 礼包购买 | 商城商品 | 康养服务 | 住宿
    product_name   TEXT,
    amount         REAL    NOT NULL DEFAULT 0,
    points_earned  INTEGER NOT NULL DEFAULT 0,
    order_date     TEXT    NOT NULL DEFAULT (date('now')),
    status         TEXT    NOT NULL DEFAULT 'completed', -- pending | completed | cancelled
    payment_method TEXT,                             -- 微信 | 支付宝 | 积分抵扣 | 银行转账
    location       TEXT,                             -- 消费地点/基地
    operator_id    INTEGER,                         -- 操作人（users.user_id）
    note           TEXT,
    created_at     TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (member_id)   REFERENCES members(member_id),
    FOREIGN KEY (operator_id) REFERENCES users(user_id)
);

-- ========== 4. 积分流水表 ==========
CREATE TABLE IF NOT EXISTS points_log (
    log_id         INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id      TEXT    NOT NULL,
    change_type    TEXT    NOT NULL,                -- 购买获得 | 消费扣除 | 管理员调整 | 过期 | 签到奖励
    points_change  INTEGER NOT NULL,                -- 正=获得，负=扣除
    related_order_id    TEXT,                      -- 关联订单号（可空）
    related_item   TEXT,                             -- 关联服务/商品名称
    balance_after  INTEGER NOT NULL,                -- 变动后余额
    operator_id    INTEGER,                         -- 操作人
    log_date       TEXT    NOT NULL DEFAULT (date('now')),
    note           TEXT,
    created_at     TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (member_id)    REFERENCES members(member_id),
    FOREIGN KEY (operator_id)   REFERENCES users(user_id)
);

-- ========== 5. 服务/商品目录表 ==========
CREATE TABLE IF NOT EXISTS catalog (
    item_id        TEXT    PRIMARY KEY,            -- I001, I002...
    item_name      TEXT    NOT NULL,
    category       TEXT    NOT NULL,                -- 康养服务 | 商城商品 | 住宿 | 餐饮
    points_cost    INTEGER NOT NULL DEFAULT 0,      -- 所需积分
    cash_price     REAL,
    description    TEXT,
    location       TEXT,                             -- 适用地点（南川基地/线上/所有）
    is_active      INTEGER NOT NULL DEFAULT 1,     -- 1=上架 0=下架
    created_at     TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- ========== 6. 消费记录表 ==========
CREATE TABLE IF NOT EXISTS consumption_records (
    consume_id    INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id     TEXT    NOT NULL,
    item_id       TEXT,                             -- 关联catalog.item_id
    consume_type  TEXT    NOT NULL,                -- 住宿 | 康养服务 | 商城商品 | 餐饮
    location      TEXT,                             -- 南川基地 | 线上商城 | 合作机构
    points_spent  INTEGER NOT NULL DEFAULT 0,
    cash_spent    REAL    NOT NULL DEFAULT 0,
    consume_date  TEXT    NOT NULL DEFAULT (date('now')),
    operator_id   INTEGER,                         -- 办理人（users.user_id）
    note          TEXT,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (member_id)  REFERENCES members(member_id),
    FOREIGN KEY (item_id)     REFERENCES catalog(item_id),
    FOREIGN KEY (operator_id) REFERENCES users(user_id)
);

-- ========== 7. 沟通记录表 ==========
CREATE TABLE IF NOT EXISTS communications (
    comm_id       INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id     TEXT    NOT NULL,
    comm_type     TEXT    NOT NULL,                -- 电话 | 微信 | 面谈 | 短信
    comm_date     TEXT    NOT NULL DEFAULT (date('now')),
    content       TEXT,
    next_followup TEXT,
    operator_id   INTEGER,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (member_id)   REFERENCES members(member_id),
    FOREIGN KEY (operator_id) REFERENCES users(user_id)
);

-- ========== 8. 基地/地点表（可扩展） ==========
CREATE TABLE IF NOT EXISTS locations (
    loc_id         INTEGER PRIMARY KEY AUTOINCREMENT,
    loc_name       TEXT    NOT NULL UNIQUE,
    loc_type       TEXT,                             -- 基地 | 合作机构 | 线上
    address        TEXT,
    is_active      INTEGER NOT NULL DEFAULT 1
);

-- ========== 索引 ==========
CREATE INDEX IF NOT EXISTS idx_members_owner    ON members(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_members_status   ON members(status);
CREATE INDEX IF NOT EXISTS idx_members_phone   ON members(phone);
CREATE INDEX IF NOT EXISTS idx_orders_member   ON orders(member_id);
CREATE INDEX IF NOT EXISTS idx_orders_date     ON orders(order_date);
CREATE INDEX IF NOT EXISTS idx_pointslog_member ON points_log(member_id);
CREATE INDEX IF NOT EXISTS idx_pointslog_date   ON points_log(log_date);
CREATE INDEX IF NOT EXISTS idx_consumption_mem  ON consumption_records(member_id);
CREATE INDEX IF NOT EXISTS idx_communications  ON communications(member_id);

-- ========== 初始数据 ==========

-- 管理员账号（密码：123456，登录后请修改）
INSERT OR IGNORE INTO users (username, password, real_name, role) VALUES
    ('admin',   'e10adc3949ba59abbe56e057f20f883e', '钟总',   'admin'),
    ('manager', 'e10adc3949ba59abbe56e057f20f883e', '经理',   'manager'),
    ('sales1',  'e10adc3949ba59abbe56e057f20f883e', '小陈',   'sales'),
    ('sales2',  'e10adc3949ba59abbe56e057f20f883e', '小刘',   'sales'),
    ('service1','e10adc3949ba59abbe56e057f20f883e', '客服1号', 'service');

-- 基地/地点
INSERT OR IGNORE INTO locations (loc_name, loc_type, address) VALUES
    ('南川基地', '基地', '重庆市南川区'),
    ('线上商城', '线上', ''),
    ('所有基地', '通用', '');

-- 商品/服务目录（初始数据）
INSERT OR IGNORE INTO catalog (item_id, item_name, category, points_cost, cash_price, description, location, is_active) VALUES
    ('I001', '4980元旅居礼包',   '礼包',   10000, 4980, '核心产品，含住宿+积分',   '所有基地', 1),
    ('I002', '500元康养礼包',    '礼包',   800,   500,  '试用产品，含基础康养服务', '所有基地', 1),
    ('I003', '温泉康养套餐',       '康养服务', 2000,  888,  '南川基地温泉+住宿',   '南川基地', 1),
    ('I004', '养生茶礼盒',        '商城商品', 300,   128,  '精美礼盒装',        '线上商城', 1),
    ('I005', '二星基地住宿(1晚)',  '住宿',   1000,  0,    '二星标准间，100积分/天', '所有基地', 1),
    ('I006', '三星基地住宿(1晚)',  '住宿',   1600,  0,    '三星标准间，160积分/天', '所有基地', 1),
    ('I007', '四星基地住宿(1晚)',  '住宿',   2000,  0,    '四星标准间，200积分/天', '所有基地', 1),
    ('I008', '五星基地住宿(1晚)',  '住宿',   2400,  0,    '五星标准间，240积分/天', '所有基地', 1);

-- 示例会员数据（从原HTML迁移）
INSERT OR IGNORE INTO members (member_id, name, phone, gender, age, join_date, source, status, owner_user_id, total_points, total_spent, note) VALUES
    ('M001', '张桂芳',   '138****6789', '女', 62, '2026-03-15', '微信',       'converted', 3, 8500,  4980, '退休教师，喜欢温泉，南川基地住过2次'),
    ('M002', '李建国',   '139****8801', '男', 65, '2026-02-20', '老客户推荐', 'converted', 3, 18000, 9960, '企业退休干部，带老伴一起，偏好四星基地'),
    ('M003', '王大妈',   '136****2345', '女', 58, '2026-05-10', '抖音',       'following', 4, 800,   500,  '刷抖音看到的，先试试500的，说住得好再升级'),
    ('M004', '赵大爷',   '137****4567', '男', 71, '2026-04-28', '线下活动',   'following', 3, 200,   500,  '社区活动来的，已用掉600积分住二星'),
    ('M005', '新华保险重庆分公司', '023-****888', '', 0,  '2026-03-01', '商务拓展',   'converted', 1, 100000, 49800, '采购10份4980礼包作为员工福利，可谈长期合作'),
    ('M006', '刘阿姨',   '158****9012', '女', 55, '2026-05-18', '微信',       'following', 4, 0,     300,  '经朋友推荐来的，住了2晚三星现金支付，对积分有兴趣'),
    ('M007', '陈先生',   '189****3456', '男', 48, '2026-05-25', '抖音',       'following', 4, 0,     128,  '买了养生茶礼盒，给父母看的，后续可能买礼包'),
    ('M008', '周阿姨',   '135****7890', '女', 63, '2026-06-01', '线下活动',   'following', 3, 0,     0,    '社区宣讲会来的，留了电话说要跟儿子商量'),
    ('M009', '孙先生',   '186****0123', '男', 42, '2026-06-03', '抖音',       'new',       4, 0,     0,    '看了抖音来的，家有老人，考虑中'),
    ('M010', '吴阿姨',   '152****5678', '女', 67, '2026-06-05', '微信',       'new',       3, 0,     0,    '加微信问了价格，还没决定'),
    ('M011', '重庆XX地产集团', '023-****666', '', 0,  '2026-04-15', '商务拓展',   'converted', 1, 50000,  24900, '采购5份4980礼包，VIP客户答谢用'),
    ('M012', '钱阿姨',   '131****3456', '女', 60, '2026-04-02', '老客户推荐', 'intended',  3, 10000, 4980, '张桂芳推荐的，已买礼包但还没入住'),
    ('M013', 'L李群',    '待补',      '',  0,  '2026-06-08', '线上平台',   'converted', NULL, 10000, 4980, '订单号8090819351547410'),
    ('M014', '怡然自乐', '待补',      '',  0,  '2026-06-01', '线上平台',   'converted', NULL, 800,   500,  '订单号8029026848487385'),
    ('M015', '钟贵均',   '待补',      '',  0,  '2026-05-31', '线上平台',   'converted', NULL, 800,   500,  '订单号8023001365357384');

-- 示例订单数据
INSERT OR IGNORE INTO orders (order_id, member_id, order_type, product_name, amount, points_earned, order_date, status, payment_method, location, operator_id, note) VALUES
    ('8090819351547410', 'M013', '礼包购买', '4980元旅居礼包', 4980, 10000, '2026-06-08', 'completed', '微信', '线上', NULL, '线上平台订单'),
    ('8029026848487385', 'M014', '礼包购买', '500元康养礼包',  500,   800, '2026-06-01', 'completed', '微信', '线上', NULL, '线上平台订单'),
    ('8023001365357384', 'M015', '礼包购买', '500元康养礼包',  500,   800, '2026-05-31', 'completed', '微信', '线上', NULL, '线上平台订单'),
    ('XG20260315001',    'M001', '礼包购买', '4980元旅居礼包', 4980,  8500, '2026-03-15', 'completed', '微信', '南川基地', 3, ''),
    ('XG20260220001',    'M002', '礼包购买', '4980元旅居礼包×2', 9960, 18000, '2026-02-20', 'completed', '银行转账', '南川基地', 3, ''),
    ('XG20260510001',    'M003', '礼包购买', '500元康养礼包',  500,   800, '2026-05-10', 'completed', '微信', '线上', 4, ''),
    ('XG20260428001',    'M004', '礼包购买', '500元康养礼包',  500,   200, '2026-04-28', 'completed', '现金', '南川基地', 3, ''),
    ('XG20260301001',    'M005', '企业采购', '4980元旅居礼包×10', 49800, 100000, '2026-03-01', 'completed', '对公转账', '', 1, ''),
    ('XG20260518001',    'M006', '单次住宿', '三星基地住宿2晚', 300, 0, '2026-05-18', 'completed', '现金', '南川基地', 4, ''),
    ('XG20260525001',    'M007', '商城商品', '养生茶礼盒', 128, 0, '2026-05-25', 'completed', '微信', '线上', 4, ''),
    ('XG20260415001',    'M011', '企业采购', '4980元旅居礼包×5', 24900, 50000, '2026-04-15', 'completed', '对公转账', '', 1, ''),
    ('XG20260402001',    'M012', '礼包购买', '4980元旅居礼包', 4980, 10000, '2026-04-02', 'completed', '微信', '南川基地', 3, '');

-- 示例积分流水
INSERT OR IGNORE INTO points_log (member_id, change_type, points_change, related_order_id, related_item, balance_after, operator_id, log_date, note) VALUES
    ('M001', '购买获得', 8500,  'XG20260315001', '4980元旅居礼包', 8500,  3, '2026-03-15', ''),
    ('M002', '购买获得', 18000, 'XG20260220001', '4980元旅居礼包×2', 18000, 3, '2026-02-20', ''),
    ('M003', '购买获得', 800,   'XG20260510001', '500元康养礼包', 800,   4, '2026-05-10', ''),
    ('M004', '购买获得', 200,   'XG20260428001', '500元康养礼包', 200,   3, '2026-04-28', ''),
    ('M004', '消费扣除', -600,  NULL,           '二星基地住宿2晚', 200,   3, '2026-05-15', '使用积分抵扣住宿'),
    ('M005', '购买获得', 100000,'XG20260301001', '企业批量采购', 100000,1, '2026-03-01', ''),
    ('M011', '购买获得', 50000, 'XG20260415001', '企业批量采购', 50000, 1, '2026-04-15', ''),
    ('M012', '购买获得', 10000, 'XG20260402001', '4980元旅居礼包', 10000, 3, '2026-04-02', ''),
    ('M013', '购买获得', 10000, '8090819351547410', '4980元旅居礼包', 10000, NULL, '2026-06-08', '线上订单'),
    ('M014', '购买获得', 800,   '8029026848487385', '500元康养礼包', 800,   NULL, '2026-06-01', '线上订单'),
    ('M015', '购买获得', 800,   '8023001365357384', '500元康养礼包', 800,   NULL, '2026-05-31', '线上订单');

-- 示例消费记录
INSERT OR IGNORE INTO consumption_records (member_id, item_id, consume_type, location, points_spent, cash_spent, consume_date, operator_id, note) VALUES
    ('M004', 'I005', '住宿', '南川基地', 600, 0, '2026-05-15', 3, '二星住宿2晚，积分抵扣');

-- 示例沟通记录
INSERT OR IGNORE INTO communications (member_id, comm_type, comm_date, content, next_followup, operator_id) VALUES
    ('M003', '微信', '2026-06-10', '客户对温泉套餐有兴趣，计划月底带老伴来体验', '2026-06-15', 4),
    ('M004', '电话', '2026-06-08', '赵大爷对康养套餐有兴趣，下次来南川时安排体验', '2026-06-12', 3),
    ('M006', '微信', '2026-06-10', '刘阿姨对积分体系很感兴趣，给其详细介绍了兑换规则', '2026-06-16', 4),
    ('M008', '面谈', '2026-06-07', '在社区宣讲会现场沟通，阿姨说要跟儿子商量，保持跟进', '2026-06-18', 3),
    ('M009', '微信', '2026-06-08', '孙先生咨询了带父母入住的政策，发送了详细资料', '2026-06-12', 4),
    ('M012', '微信', '2026-06-09', '钱阿姨已买礼包，还未安排入住，主动跟进一下', '2026-06-20', 3);
