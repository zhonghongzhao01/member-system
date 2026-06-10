const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3456;
const DB_FILE = path.join(__dirname, 'db', 'xingguan.json');

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ===== 工具函数 =====
function readDB() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch(e) { return { users:[], members:[], orders:[], points_log:[], catalog:[], consumption_records:[], communications:[], logs:[] }; }
}
function writeDB(db) { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8'); }
function hashPassword(pwd) { return crypto.createHash('sha256').update(pwd + 'xingguan_2026').digest('hex'); }
function genId(prefix, list) {
  const nums = list.map(x => parseInt((x.id||'').replace(prefix,''))).filter(n=>!isNaN(n));
  return prefix + String(Math.max(0,...nums)+1).padStart(3,'0');
}
function addLog(db, username, action, target, detail) {
  if (!db.logs) db.logs = [];
  db.logs.push({ id: genId('L', db.logs), username, action, target, detail, time: new Date().toISOString() });
}

// ===== 登录 =====
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const db = readDB();
  const user = (db.users||[]).find(u => u.username === username);
  if (!user) return res.json({ success:false, message:'用户名不存在' });
  if (!user.is_active) return res.json({ success:false, message:'账号已禁用，请联系管理员' });
  if (user.password !== hashPassword(password)) return res.json({ success:false, message:'密码错误' });
  const { password:pwd, ...userInfo } = user;
  addLog(db, username, 'login', 'system', '用户登录');
  writeDB(db);
  res.json({ success:true, user: userInfo });
});

// ===== 修改密码 =====
app.post('/api/change-password', (req, res) => {
  const { username, oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) return res.json({ success:false, message:'请填写完整' });
  if (newPassword.length < 4) return res.json({ success:false, message:'新密码至少4位' });
  const db = readDB();
  const user = (db.users||[]).find(u => u.username === username);
  if (!user) return res.json({ success:false, message:'用户不存在' });
  if (user.password !== hashPassword(oldPassword)) return res.json({ success:false, message:'原密码错误' });
  user.password = hashPassword(newPassword);
  addLog(db, username, 'change_password', 'system', '修改密码');
  writeDB(db);
  res.json({ success:true, message:'密码修改成功' });
});

// ===== 用户管理（管理员）=====
app.get('/api/users', (req, res) => {
  const db = readDB();
  const list = (db.users||[]).map(u => { const {password, ...info} = u; return info; });
  res.json({ success:true, data: list });
});

app.post('/api/users', (req, res) => {
  const db = readDB();
  if (!db.users) db.users = [];
  const { username, name, role, password } = req.body;
  if (!username || !name || !role) return res.json({ success:false, message:'请填写完整' });
  if (db.users.find(u => u.username === username)) return res.json({ success:false, message:'用户名已存在' });
  const newUser = { id: Date.now(), username, password: hashPassword(password||'xg2026'), name, role, is_active: 1 };
  db.users.push(newUser);
  addLog(db, req.body.operator||'admin', 'add_user', 'user', '新增用户：'+name);
  writeDB(db);
  const { password:pwd, ...ret } = newUser;
  res.json({ success:true, data: ret });
});

app.put('/api/users/:lookup', (req, res) => {
  const db = readDB();
  const lookup = req.params.lookup;
  // 支持按数字ID或用户名字符串查找
  const numId = parseInt(lookup);
  const user = isNaN(numId)
    ? (db.users||[]).find(u => u.username === lookup)
    : (db.users||[]).find(u => u.id === numId);
  if (!user) return res.json({ success:false, message:'用户不存在' });
  const { name, role, is_active, password, username } = req.body;
  // 用户名不可修改（管理员设定后锁定）
  if (username && username !== user.username) {
    return res.json({ success:false, message: '用户名不可修改' });
  }
  if (name) user.name = name;
  if (role) user.role = role;
  if (is_active !== undefined) user.is_active = is_active ? 1 : 0;
  if (password) user.password = hashPassword(password);
  addLog(db, req.body.operator || req.query.operator || 'admin', 'edit_user', 'user', '修改用户：'+user.name);
  writeDB(db);
  const { password:pwd, ...ret } = user;
  res.json({ success:true, data: ret });
});

// ===== 会员：列表（按权限过滤——世界级销售团队核心安全功能）=====
app.get('/api/members', (req, res) => {
  const db = readDB();
  let list = db.members || [];
  const { username, name, role } = req.query;
  
  // 世界级销售团队标准：后端强制权限过滤
  // 销售只能看到自己的客户，防止客户资料泄露和抢客户
  if (role !== 'admin' && username) {
    const before = list.length;
    list = list.filter(m => {
      // 兼容新旧数据：owner存英文名，owner_name存中文名
      if (!m.owner && !m.owner_name) return false; // 无归属客户，销售看不到（归管理员）
      return m.owner === username || m.owner_name === name || m.owner === name;
    });
    console.log(`[权限过滤] ${username}(${name}) 能看到 ${list.length}/${before} 个客户`);
  }
  
  res.json({ success:true, data: list });
});

// ===== 会员：单个详情 =====
app.get('/api/members/:id', (req, res) => {
  const db = readDB();
  const m = (db.members||[]).find(x => x.id === req.params.id);
  if (m) {
    addLog(db, req.query.username||'', 'view_member', m.id, '查看会员：'+m.name);
    writeDB(db);
    res.json({ success:true, data: m });
  } else {
    res.json({ success:false, message:'会员不存在' });
  }
});

// ===== 会员：新增 =====
app.post('/api/members', (req, res) => {
  const db = readDB();
  if (!db.members) db.members = [];
  const d = req.body;
  const newMember = {
    id: genId('M', db.members),
    name: d.name,
    phone: d.phone,
    gender: d.gender || '',
    age: d.age || '',
    type: d.type || '散客',
    product: d.product || '',
    amount: d.amount || 0,
    points: d.points || 0,
    total_spent: d.amount || 0,
    join_date: d.join_date || new Date().toISOString().slice(0,10),
    source: d.source || '',
    status: d.status || '新登记',
    owner: d.owner || req.body._username || '',
    owner_name: d.owner_name || req.body._username || '',
    next_followup: d.next_followup || '',
    note: d.note || ''
  };
  db.members.push(newMember);
  
  // 自动记录积分
  if (newMember.points > 0) {
    if (!db.points_log) db.points_log = [];
    db.points_log.push({
      id: genId('PL', db.points_log),
      member_id: newMember.id,
      member_name: newMember.name,
      change_type: '购买获得',
      points_change: newMember.points,
      related_order_id: '',
      balance_after: newMember.points,
      operator: d._operator || '',
      log_date: new Date().toISOString().slice(0,10),
      note: '新增会员，初始积分'
    });
  }
  
  addLog(db, d._operator||'', 'add_member', newMember.id, '新增会员：'+newMember.name);
  writeDB(db);
  res.json({ success:true, data: newMember });
});

// ===== 会员：修改 =====
app.put('/api/members/:id', (req, res) => {
  const db = readDB();
  const idx = (db.members||[]).findIndex(x => x.id === req.params.id);
  if (idx === -1) return res.json({ success:false, message:'会员不存在' });
  const old = db.members[idx];
  const d = req.body;
  
  // 世界级销售团队：销售只能修改自己的客户
  const role = d._role || req.query.role || '';
  const reqUser = d._username || req.query.username || '';
  const reqOperator = d._operator || req.query.operator || '';
  if (role !== 'admin' && old.owner && old.owner !== reqUser && old.owner_name !== reqOperator) {
    return res.json({ success:false, message:'只能修改自己负责的客户' });
  }
  
  db.members[idx] = { ...old, ...d, id: old.id };
  addLog(db, d._operator||'', 'edit_member', old.id, '修改会员：'+old.name);
  writeDB(db);
  res.json({ success:true, data: db.members[idx] });
});

// ===== 会员：删除 =====
app.delete('/api/members/:id', (req, res) => {
  const db = readDB();
  const idx = (db.members||[]).findIndex(x => x.id === req.params.id);
  if (idx === -1) return res.json({ success:false, message:'会员不存在' });
  const m = db.members[idx];
  
  // 世界级销售团队：只有管理员能删除
  if (req.query.role !== 'admin') return res.json({ success:false, message:'只有管理员能删除会员' });
  
  db.members.splice(idx, 1);
  addLog(db, req.query.username||'', 'delete_member', m.id, '删除会员：'+m.name);
  writeDB(db);
  res.json({ success:true });
});

// ===== 消费记录 =====
app.get('/api/consumption', (req, res) => {
  const db = readDB();
  let list = db.consumption_records || [];
  const { username, name, role } = req.query;
  if (role !== 'admin' && username) {
    list = list.filter(c => c.operator === username || c.operator === name);
  }
  res.json({ success:true, data: list });
});

app.post('/api/consumption', (req, res) => {
  const db = readDB();
  if (!db.consumption_records) db.consumption_records = [];
  const d = req.body;
  const record = {
    id: genId('CR', db.consumption_records),
    member_id: d.member_id,
    member_name: d.member_name,
    item_id: d.item_id || '',
    item_name: d.item_name || '',
    consume_type: d.consume_type || '',
    location: d.location || '',
    points_spent: d.points_spent || 0,
    cash_spent: d.cash_spent || 0,
    consume_date: d.consume_date || new Date().toISOString().slice(0,10),
    operator: d._operator || '',
    note: d.note || ''
  };
  db.consumption_records.push(record);
  
  // 更新会员积分
  const member = (db.members||[]).find(m => m.id === d.member_id);
  if (member && record.points_spent > 0) {
    member.points = Math.max(0, (member.points||0) - record.points_spent);
    if (!db.points_log) db.points_log = [];
    db.points_log.push({
      id: genId('PL', db.points_log),
      member_id: d.member_id,
      member_name: d.member_name,
      change_type: '消费扣除',
      points_change: -record.points_spent,
      related_order_id: '',
      related_service_id: record.item_id,
      balance_after: member.points,
      operator: d._operator || '',
      log_date: new Date().toISOString().slice(0,10),
      note: record.item_name
    });
  }
  
  addLog(db, d._operator||'', 'add_consumption', record.id, '消费记录：'+d.member_name+' '+record.item_name);
  writeDB(db);
  res.json({ success:true, data: record });
});

// ===== 仪表盘数据 =====
app.get('/api/dashboard', (req, res) => {
  const db = readDB();
  const { username, name, role } = req.query;
  let members = db.members || [];
  
  // 按权限过滤
  if (role !== 'admin' && username) {
    members = members.filter(m => m.owner === username || m.owner_name === name || m.owner === name);
  }
  
  const orders = db.orders || [];
  const pointsLog = db.points_log || [];
  const today = new Date().toISOString().slice(0,10);
  const thisMonth = today.slice(0,7);
  
  const totalMembers = members.length;
  const coreMembers = members.filter(m => m.type === '核心会员').length;
  const trialMembers = members.filter(m => m.type === '试用会员').length;
  const thisMonthNew = members.filter(m => (m.join_date||'').startsWith(thisMonth)).length;
  const needFollowup = members.filter(m => (m.next_followup||'') <= today && (m.next_followup||'') !== '').length;
  
  const totalRevenue = orders.filter(o => o.status === '已完成').reduce((s,o) => s + (o.amount||0), 0);
  const totalPointsIssued = pointsLog.filter(l => l.points_change > 0).reduce((s,l) => s + l.points_change, 0);
  const totalPointsUsed = pointsLog.filter(l => l.points_change < 0).reduce((s,l) => s + Math.abs(l.points_change), 0);
  
  // 销售排行（只有管理员能看到全部）
  let salesRanking = [];
  if (role === 'admin') {
    const salesMap = {};
    (db.members||[]).forEach(m => {
      const owner = m.owner_name || m.owner || '未分配';
      if (!salesMap[owner]) salesMap[owner] = { name: owner, count: 0, revenue: 0 };
      salesMap[owner].count++;
      salesMap[owner].revenue += m.amount || 0;
    });
    salesRanking = Object.values(salesMap).sort((a,b) => b.count - a.count);
  }
  
  res.json({
    success: true,
    data: {
      totalMembers, coreMembers, trialMembers, thisMonthNew, needFollowup,
      totalRevenue, totalPointsIssued, totalPointsUsed, salesRanking,
      recentMembers: members.slice(-5).reverse(),
      todayFollowup: members.filter(m => m.next_followup === today).length
    }
  });
});

// ===== 销售团队管理（管理员专属）=====
app.get('/api/sales-team', (req, res) => {
  const db = readDB();
  const salesUsers = (db.users || []).filter(u => u.role === 'sales');
  const members = db.members || [];
  const consumptionRecords = db.consumption_records || [];
  const result = salesUsers.map(u => {
    const myMembers = members.filter(m => m.owner === u.username);
    const myMemberIds = myMembers.map(m => m.id);
    const myConsumptions = consumptionRecords.filter(c => myMemberIds.includes(c.member_id));
    const following = myMembers.filter(m => m.status === '跟进中').length;
    const converted = myMembers.filter(m => m.status === '已转化').length;
    const intent = myMembers.filter(m => m.status === '有意向').length;
    const newReg = myMembers.filter(m => m.status === '新登记').length;
    const lost = myMembers.filter(m => m.status === '已流失' || m.status === '暂不考虑').length;
    const totalConsumption = myConsumptions.reduce((s, c) => s + (c.cash_spent || 0), 0)
      + myMembers.reduce((s, m) => s + (m.total_spent || 0), 0);
    const totalPoints = myMembers.reduce((s, m) => s + (m.points || 0), 0);
    const overdue = myMembers.filter(m => (m.next_followup || '') !== '' && m.next_followup < new Date().toISOString().slice(0, 10)).length;
    return {
      username: u.username,
      name: u.name || u.username,
      total_customers: myMembers.length,
      following,
      converted,
      intent,
      new_reg: newReg,
      lost,
      overdue_followup: overdue,
      total_consumption: totalConsumption,
      total_points: totalPoints,
      customers: myMembers.map(m => ({
        id: m.id, name: m.name, phone: m.phone, type: m.type,
        status: m.status, points: m.points, total_spent: m.total_spent,
        last_followup: m.last_followup || '', next_followup: m.next_followup || '',
        product: m.product || '', source: m.source || '', join_date: m.join_date || ''
      }))
    };
  });
  res.json({ success: true, data: result });
});

// ===== 操作日志 =====
app.get('/api/logs', (req, res) => {
  const db = readDB();
  let logs = db.logs || [];
  const { username, role } = req.query;
  // 销售只能看到自己的操作日志
  if (role !== 'admin' && username) {
    logs = logs.filter(l => l.username === username);
  }
  res.json({ success:true, data: logs.slice(-100).reverse() });
});

// ===== 服务/商品目录 =====
app.get('/api/catalog', (req, res) => {
  const db = readDB();
  res.json({ success:true, data: db.catalog || [] });
});

// ===== 统计数据（前端用 /api/stats）=====
app.get('/api/stats', (req, res) => {
  const db = readDB();
  const { username, name, role } = req.query;
  let members = db.members || [];
  if (role !== 'admin' && username) {
    members = members.filter(m => m.owner === username || m.owner_name === name || m.owner === name);
  }
  const total_members = members.length;
  const core_members = members.filter(m => m.type === '核心会员').length;
  const trial_members = members.filter(m => m.type === '试用会员').length;
  const total_points = members.reduce((s,m) => s + (m.points||0), 0);
  const total_spent = members.reduce((s,m) => s + (m.total_spent||m.amount||0), 0);
  res.json({ success:true, data: { total_members, core_members, trial_members, total_points, total_spent } });
});

// ===== 消费记录列表（前端用 /api/consumption-records）=====
app.get('/api/consumption-records', (req, res) => {
  const db = readDB();
  let records = db.consumption_records || [];
  const { username, name, role } = req.query;
  // 世界级销售权限：销售只能看自己操作的消费记录
  if (role !== 'admin' && username) {
    records = records.filter(c => c.operator === username || c.operator === name);
  }
  const result = records.map(r => ({
    consume_id: r.id, member_id: r.member_id, member_name: r.member_name,
    consume_type: r.consume_type, location: r.location,
    points_spent: r.points_spent, cash_spent: r.cash_spent,
    consume_date: r.consume_date, operator: r.operator, note: r.note
  }));
  res.json({ success:true, data: result });
});

// ===== 单个会员的消费记录 =====
app.get('/api/consumption/:member_id', (req, res) => {
  const db = readDB();
  let records = (db.consumption_records || [])
    .filter(r => r.member_id === req.params.member_id);
  // 权限检查：销售只能查看自己操作的消费记录
  const { username, name:uname, role } = req.query;
  if (role !== 'admin' && username) {
    records = records.filter(r => r.operator === username || r.operator === uname);
  }
  const result = records.map(r => ({
    consume_id: r.id, member_id: r.member_id, member_name: r.member_name,
    consume_type: r.consume_type, location: r.location,
    points_spent: r.points_spent, cash_spent: r.cash_spent,
    consume_date: r.consume_date, operator: r.operator, note: r.note
  }));
  res.json({ success:true, data: result });
});

// ===== 消费记录新增（前端用 /api/consume）=====
app.post('/api/consume', (req, res) => {
  const db = readDB();
  if (!db.consumption_records) db.consumption_records = [];
  const d = req.body;
  const member = (db.members||[]).find(m => m.id === d.member_id);
  const memberName = member ? member.name : (d.member_name || '');
  const record = {
    id: genId('CR', db.consumption_records),
    member_id: d.member_id,
    member_name: memberName,
    item_id: d.item_id || '',
    item_name: d.item_name || '',
    consume_type: d.consume_type || '',
    location: d.location || '',
    points_spent: d.points_spent || 0,
    cash_spent: d.cash_spent || 0,
    consume_date: d.consume_date || new Date().toISOString().slice(0,10),
    operator: d.operator || '',
    note: d.note || ''
  };
  db.consumption_records.push(record);
  // 更新会员积分
  if (member && record.points_spent > 0) {
    member.points = Math.max(0, (member.points||0) - record.points_spent);
    member.total_spent = (member.total_spent||0) + (record.cash_spent||0);
    if (!db.points_log) db.points_log = [];
    db.points_log.push({
      id: genId('PL', db.points_log),
      member_id: d.member_id,
      member_name: member.name,
      change_type: '消费扣除',
      points_change: -record.points_spent,
      related_order_id: '',
      balance_after: member.points,
      operator: d.operator || '',
      log_date: new Date().toISOString().slice(0,10),
      note: record.item_name
    });
  }
  addLog(db, d.operator||'', 'consume', record.id, '消费记录：'+memberName+' '+record.item_name);
  writeDB(db);
  res.json({ success:true, data: { consume_id: record.id, ...record } });
});

// ===== 积分流水列表（前端用 /api/points-logs）=====
app.get('/api/points-logs', (req, res) => {
  const db = readDB();
  let logs = db.points_log || [];
  const { username, name, role } = req.query;
  // 世界级销售权限：销售只能看自己操作的积分流水
  if (role !== 'admin' && username) {
    logs = logs.filter(l => l.operator === username || l.operator === name);
  }
  const result = logs.map(l => ({
    log_id: l.id, member_id: l.member_id, member_name: l.member_name,
    change_type: l.change_type, points_change: l.points_change,
    balance_after: l.balance_after, log_date: l.log_date,
    operator: l.operator, note: l.note
  }));
  res.json({ success:true, data: result });
});

// ===== 单个会员的积分流水 =====
app.get('/api/points-log/:member_id', (req, res) => {
  const db = readDB();
  let logs = (db.points_log || [])
    .filter(l => l.member_id === req.params.member_id);
  // 权限检查：销售只能看自己操作的积分记录
  const { username, name:uname, role } = req.query;
  if (role !== 'admin' && username) {
    logs = logs.filter(l => l.operator === username || l.operator === uname);
  }
  const result = logs.map(l => ({
    log_id: l.id, member_id: l.member_id, member_name: l.member_name,
    change_type: l.change_type, points_change: l.points_change,
    balance_after: l.balance_after, log_date: l.log_date,
    operator: l.operator, note: l.note
  }));
  res.json({ success:true, data: result });
});

// ===== 沟通记录 =====
app.get('/api/communications/:member_id', (req, res) => {
  const db = readDB();
  const comms = (db.communications || [])
    .filter(c => c.member_id === req.params.member_id);
  res.json({ success:true, data: comms });
});

app.post('/api/communications', (req, res) => {
  const db = readDB();
  if (!db.communications) db.communications = [];
  const d = req.body;
  const comm = {
    id: 'CM' + String((db.communications.length+1)).padStart(3,'0'),
    member_id: d.member_id,
    comm_type: d.comm_type,
    comm_date: d.comm_date || new Date().toISOString().slice(0,10),
    content: d.content || '',
    next_followup: d.next_followup || '',
    operator: d.operator || '',
    photos: d.photos || []  // 拍照上传：base64图片数组
  };
  db.communications.push(comm);
  // 更新会员的下次跟进日期和状态
  const member = (db.members||[]).find(m => m.id === d.member_id);
  if (member) {
    if (d.next_followup) member.next_followup = d.next_followup;
    // 更新跟进状态
    if (d.followup_status) member.followup_status = d.followup_status;
    // 记录最后跟进时间
    member.last_followup = d.comm_date || new Date().toISOString().slice(0,10);
  }
  addLog(db, d.operator||'', 'comm', comm.id, '沟通记录：'+(member?member.name:''));
  writeDB(db);
  res.json({ success:true, data: comm });
});

// ===== 操作日志（前端用 /api/operation-logs）=====
app.get('/api/operation-logs', (req, res) => {
  const db = readDB();
  const logs = (db.logs || []).map(l => ({
    username: l.username, action: l.action, target: l.target,
    detail: l.detail, timestamp: l.time
  }));
  res.json({ success:true, data: logs.slice(-200).reverse() });
});

// ===== 用户管理：单个用户查询 =====
app.get('/api/users/:username', (req, res) => {
  const db = readDB();
  const user = (db.users||[]).find(u => u.username === req.params.username);
  if (!user) return res.json({ success:false, message:'用户不存在' });
  const { password, ...info } = user;
  res.json({ success:true, data: info });
});

// ===== 用户管理：删除用户 =====
app.delete('/api/users/:username', (req, res) => {
  const db = readDB();
  const idx = (db.users||[]).findIndex(u => u.username === req.params.username);
  if (idx === -1) return res.json({ success:false, message:'用户不存在' });
  const u = db.users[idx];
  db.users.splice(idx, 1);
  addLog(db, req.query.operator||'admin', 'delete_user', 'user', '删除用户：'+u.name);
  writeDB(db);
  res.json({ success:true, message:'删除成功' });
});

// ===== 健康检查 =====
app.get('/api/health', (req, res) => {
  res.json({ status:'ok', time: new Date().toISOString(), version:'2.1' });
});

// ===== 启动 =====
app.listen(PORT, () => {
  const msg = `
╔══════════════════════════════════════════════════════════╗
║   行馆旅居会员管理系统 后端服务已启动 (世界级销售团队版)  ║
╠══════════════════════════════════════════════════════════╣
║   本机访问:  http://localhost:${PORT}                       ║
║   版本: 2.1 (全API对齐+权限过滤+操作日志+销售保护)     ║
╚══════════════════════════════════════════════════════════╝
`;
  console.log(msg);
  console.log('📁 数据库:', DB_FILE);
  const db = readDB();
  console.log('📊 当前数据: 用户', db.users?.length||0, '人, 会员', db.members?.length||0, '人');
});
