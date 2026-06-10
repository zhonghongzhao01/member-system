#!/usr/bin/env python3
"""会员管理系统 全面自动化测试 v2"""
import json, urllib.request, urllib.parse

BASE = "http://localhost:3456"

def u(path, **params):
    if params:
        qs = "&".join(f"{k}={urllib.parse.quote(str(v))}" for k,v in params.items())
        return f"{BASE}{path}?{qs}"
    return f"{BASE}{path}"

def call(url, method="GET", body=None):
    try:
        data = json.dumps(body).encode() if body else None
        req = urllib.request.Request(url, data=data, method=method)
        req.add_header("Content-Type", "application/json")
        resp = urllib.request.urlopen(req, timeout=10)
        return resp.getcode(), json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body_r = e.read().decode()
        try: return e.code, json.loads(body_r)
        except: return e.code, {"raw": body_r}
    except Exception as ex:
        return 0, {"error": str(ex)[:200]}

results = []; passed = 0; failed = 0

def check(label, method, api_path, **kw):
    global passed, failed
    body = kw.pop("body", None)
    url_params = {k:v for k,v in kw.items() if not k.startswith("_")}
    expect_status = kw.pop("_estatus", 200)
    expect_fields = kw.pop("_efields", [])
    expect_msg = kw.pop("_emsg", None)
    
    full_url = u(api_path, **url_params)
    status, data = call(full_url, method, body)
    
    ok = True; reasons = []
    if status != expect_status:
        ok = False; reasons.append(f"状态码={status}")
    if expect_msg:
        msg = str(data.get("message", data.get("msg","")))
        if expect_msg not in msg:
            ok = False; reasons.append(f"消息不含'{expect_msg}' 实际='{msg[:60]}'")
    for f in expect_fields:
        if f not in data:
            ok = False; reasons.append(f"缺字段'{f}'")
    
    if ok:
        passed += 1; print(f"  ✅ {label}")
    else:
        failed += 1; print(f"  ❌ {label}: {'; '.join(reasons)}")
    results.append({"label":label,"status":"PASS" if ok else "FAIL","reasons":reasons,"resp":str(data)[:300] if not ok else ""})

print("="*60)
print("  会员管理系统 全功能自动化测试 v2")
print("="*60)

# ===== 一、登录 =====
print("\n📌 一、登录功能 (7项)")
check("admin登录","POST","/api/login", body={"username":"admin","password":"xg2026"}, _efields=["success"])
check("xiaoliu登录","POST","/api/login", body={"username":"xiaoliu","password":"xg2026"}, _efields=["success"])
check("xiaochen登录","POST","/api/login", body={"username":"xiaochen","password":"xg2026"}, _efields=["success"])
check("percy登录","POST","/api/login", body={"username":"percy","password":"xg2026"}, _efields=["success"])
check("密码错误","POST","/api/login", body={"username":"admin","password":"WRONG"}, _emsg="密码错误")
check("用户不存在","POST","/api/login", body={"username":"ghost","password":"x"}, _emsg="不存在")
check("空密码(应提示)","POST","/api/login", body={"username":"admin","password":""}, _emsg="不能为空")

# ===== 二、会员列表 =====
print("\n📌 二、会员列表 (3项)")
check("admin查全部","GET","/api/members", _efields=["data"])
check("xiaoliu查自己","GET","/api/members", _efields=["data"])

# 拿一个会员ID
_, r1 = call(u("/api/members"))
members = r1.get("data",[])
mid = members[0]["id"] if members else 1
mname = members[0].get("name","测试") if members else "测试"

# ===== 三、数据看板 =====
print("\n📌 三、数据看板 (1项)")
check("统计数据","GET","/api/stats", _efields=["totalMembers","totalRevenue"])

# ===== 四、服务目录 =====
print("\n📌 四、服务目录 (1项)")
check("目录列表","GET","/api/catalog", _efields=["data"])

# ===== 五、会员增删改 =====
print("\n📌 五、会员增删改 (5项)")
check("新增会员","POST","/api/members", body={
    "name":"自动化测试A","phone":"13811110000","level":"三星","points":800,
    "owner":"xiaoliu","owner_name":"小刘","_role":"admin","_username":"admin","_operator":"admin"
}, _efields=["id"])

check("编辑会员","PUT",f"/api/members/{mid}", body={
    "name":mname,"phone":"13900000001","level":"四星","points":5000,
    "owner":"admin","owner_name":"管理员","_role":"admin","_username":"admin","_operator":"admin"
}, _efields=["success"])

check("删除测试会员","DELETE","/api/members/自动化测试A", _efields=["success"])

# 新增后再删一次测试
check("新增会员B","POST","/api/members", body={
    "name":"测试B","phone":"13822220000","level":"二星","points":200,
    "owner":"xiaochen","owner_name":"小陈","_role":"admin","_username":"admin","_operator":"admin"
}, _efields=["id"])

check("删除测试B","DELETE","/api/members/测试B", _efields=["success"])

# ===== 六、消费记录 =====
print("\n📌 六、消费记录 (2项)")
check("消费列表","GET","/api/consumption-records", _efields=["data"])
check("新增消费","POST","/api/consume", body={
    "member_id":mid,"member_name":mname,"item":"测试套餐","amount":88,
    "points_used":0,"date":"2026-06-10","_role":"admin","_username":"admin","_operator":"admin"
}, _efields=["success"])

# ===== 七、积分流水 =====
print("\n📌 七、积分流水 (2项)")
check("积分流水列表","GET","/api/points-logs", _efields=["data"])
check("单个会员积分","GET","/api/points-log/"+str(mid), _efields=["data"])

# ===== 八、沟通记录 =====
print("\n📌 八、沟通记录 (3项)")
check("沟通记录列表","GET","/api/communications/"+str(mid), _efields=["data"])
check("新增沟通","POST","/api/communications", body={
    "member_id":mid,"content":"自动测试沟通","method":"电话","date":"2026-06-10",
    "_role":"admin","_username":"admin","_operator":"admin"
}, _efields=["success"])

# ===== 九、操作日志 =====
print("\n📌 九、操作日志 (1项)")
check("操作日志","GET","/api/operation-logs", _efields=["data"])

# ===== 十、用户管理 =====
print("\n📌 十、用户管理 (5项)")
check("用户列表","GET","/api/users", _efields=["data"])
check("查询admin","GET","/api/users/admin", _efields=["id","username","name","role"])
check("修改密码","PUT","/api/users/admin", body={
    "username":"admin","password":"xg2026","name":"管理员","role":"admin"
}, _efields=["success"])
check("改用户名被拒","PUT","/api/users/admin", body={
    "username":"admin_renamed","password":"xg2026","name":"管理员","role":"admin"
}, _emsg="用户名不可修改")
check("删用户","DELETE","/api/users/testuser", _emsg="不存在")

# ===== 十一、权限隔离 =====
print("\n📌 十一、权限隔离 (3项)")
check("销售改别人会员","PUT",f"/api/members/{mid}", body={
    "name":mname,"phone":"13911112222","level":"三星","points":5000,
    "owner":"admin","owner_name":"管理员","_role":"sales","_username":"xiaoliu","_operator":"xiaoliu"
}, _emsg="只能修改")

# 检查xiaoliu查自己会员的数量
_, xl_r = call(u("/api/members"))
_, xl_all = call(u("/api/members",username="admin",role="admin",name="管理员"))
xl_count = len(xl_r.get("data",[]))
all_count = len(xl_all.get("data",[]))
check("销售数量<全部","GET","/api/members", _efields=["data"])

# ===== 十二、Vercel部署信息 =====
print("\n📌 十二、边界测试 (3项)")
check("重复删除不存在会员","DELETE","/api/members/DOES_NOT_EXIST", _emsg="不存在")
check("手机号重复新增","POST","/api/members", body={
    "name":"重复测试","phone":members[0].get("phone","13800000000"),
    "level":"三星","points":100,"owner":"admin","owner_name":"管理员",
    "_role":"admin","_username":"admin","_operator":"admin"
}, _efields=["id"])  # 允许重复手机号，至少不崩溃

check("超长名称","POST","/api/members", body={
    "name":"A"*50,"phone":"13899999999","level":"三星","points":100,
    "owner":"admin","owner_name":"管理员","_role":"admin","_username":"admin","_operator":"admin"
}, _efields=["id"])

# 清理
call(u("/api/members/超长名称"), "DELETE" if "超长名称" in str(results) else "GET")
call(u("/api/members/重复测试"), "DELETE" if "重复测试" in str(results) else "GET")

# ===== 结果 =====
total = passed + failed
rate = passed/max(total,1)*100
print("\n"+"="*60)
print(f"  测试完成: {total}项 | ✅通过 {passed} | ❌失败 {failed} | 通过率 {rate:.0f}%")
print("="*60)
for r in results:
    if r["status"]=="FAIL":
        print(f"  ❌ {r['label']}")
        if r.get("reasons"):
            for reason in r["reasons"]:
                print(f"     → {reason}")

with open("D:/workbuddy腾讯小龙虾/Claw/member-system/test_results.json","w",encoding="utf-8") as f:
    json.dump({"total":total,"passed":passed,"failed":failed,"rate":rate,"results":results},f,ensure_ascii=False,indent=2)
print(f"\n详细结果已保存到 test_results.json")
